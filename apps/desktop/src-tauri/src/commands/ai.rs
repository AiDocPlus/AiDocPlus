use crate::ai::{AIConfig, ChatMessage, OpenAIResponse};
use crate::error::AppError;
use crate::tools;
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// 流式状态管理：使用 request_id 作为 key，支持多个并发流独立控制
static STREAM_STATES: OnceLock<Mutex<HashMap<String, AtomicBool>>> = OnceLock::new();

fn get_stream_states() -> &'static Mutex<HashMap<String, AtomicBool>> {
    STREAM_STATES.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 流处理 Buffer 最大限制（10MB），防止恶意服务器发送无限数据
const MAX_BUFFER_SIZE: usize = 10 * 1024 * 1024;

/// AI 请求连接超时（15 秒）
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
/// AI 非流式请求总超时（5 分钟，长文本生成可能耗时较久）
const REQUEST_TIMEOUT: Duration = Duration::from_secs(300);
/// AI 流式请求总超时（10 分钟，流式传输持续时间更长）
const STREAM_TIMEOUT: Duration = Duration::from_secs(600);

/// 将 reqwest 错误转换为用户友好的提示信息
fn friendly_reqwest_error(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        return "AI 服务请求超时，请检查网络连接或稍后重试".to_string();
    }
    if e.is_connect() {
        return "无法连接到 AI 服务，请检查网络连接和代理设置".to_string();
    }
    if e.is_request() {
        return format!("请求 AI 服务失败: {}", e);
    }
    if e.is_decode() {
        return "AI 服务返回数据格式异常".to_string();
    }
    format!("AI 服务通信错误: {}", e)
}

/// 创建带超时和代理配置的 HTTP 客户端
fn build_ai_client(
    connect_timeout: Duration,
    request_timeout: Duration,
    proxy_url: Option<&str>,
) -> reqwest::Client {
    let mut builder = reqwest::Client::builder()
        .connect_timeout(connect_timeout)
        .timeout(request_timeout);

    if let Some(url) = proxy_url.filter(|u| !u.is_empty()) {
        if let Ok(proxy) = reqwest::Proxy::all(url) {
            builder = builder.proxy(proxy);
        }
    }

    builder.build().unwrap_or_else(|_| reqwest::Client::new())
}

/// 创建带超时配置的 HTTP 客户端（非流式）
fn ai_client_with_opts(proxy_url: Option<&str>, connect_secs: Option<u64>, request_secs: Option<u64>) -> reqwest::Client {
    let ct = connect_secs.filter(|&s| s > 0).map(Duration::from_secs).unwrap_or(CONNECT_TIMEOUT);
    let rt = request_secs.filter(|&s| s > 0).map(Duration::from_secs).unwrap_or(REQUEST_TIMEOUT);
    build_ai_client(ct, rt, proxy_url)
}

/// 创建带超时配置的 HTTP 客户端（流式，超时更长）
fn ai_stream_client_with_opts(proxy_url: Option<&str>, connect_secs: Option<u64>, request_secs: Option<u64>) -> reqwest::Client {
    let ct = connect_secs.filter(|&s| s > 0).map(Duration::from_secs).unwrap_or(CONNECT_TIMEOUT);
    let rt = request_secs.filter(|&s| s > 0).map(Duration::from_secs).unwrap_or(STREAM_TIMEOUT);
    build_ai_client(ct, rt, proxy_url)
}

/// 向后兼容：无额外配置的流式客户端（用于内部辅助函数如 stream_openai_responses）
fn ai_stream_client() -> reqwest::Client {
    build_ai_client(CONNECT_TIMEOUT, STREAM_TIMEOUT, None)
}

#[tauri::command]
pub fn stop_ai_stream(request_id: Option<String>) {
    let states = get_stream_states();
    if let Some(id) = request_id {
        // 停止特定的流
        if let Ok(states) = states.lock() {
            if let Some(cancelled) = states.get(&id) {
                cancelled.store(true, Ordering::SeqCst);
            }
        }
    } else {
        // 停止所有流（向后兼容）
        if let Ok(states) = states.lock() {
            for cancelled in states.values() {
                cancelled.store(true, Ordering::SeqCst);
            }
        }
    }
}

/// 清理已完成的流
fn cleanup_stream(request_id: &str) {
    let states = get_stream_states();
    if let Ok(mut states) = states.lock() {
        states.remove(request_id);
    }
}

/// 检查流是否被取消
fn is_stream_cancelled(request_id: &str) -> bool {
    let states = get_stream_states();
    if let Ok(states) = states.lock() {
        if let Some(cancelled) = states.get(request_id) {
            return cancelled.load(Ordering::SeqCst);
        }
    }
    false
}

type Result<T> = std::result::Result<T, AppError>;

#[tauri::command]
pub async fn chat(
    app: AppHandle,
    messages: Vec<ChatMessage>,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
    enable_web_search: Option<bool>,
    service_id: Option<String>,
    proxy_url: Option<String>,
    connect_timeout_secs: Option<u64>,
    request_timeout_secs: Option<u64>,
) -> Result<String> {
    let config = get_ai_config(&app, provider, api_key, model, base_url, service_id);
    let web_search = enable_web_search.unwrap_or(false);
    let client = ai_client_with_opts(proxy_url.as_deref(), connect_timeout_secs, request_timeout_secs);

    // OpenAI + 联网搜索 → Responses API（非流式）
    if config.provider == "openai" && web_search {
        return call_openai_responses(&config, &client, &messages, max_tokens).await;
    }

    // Anthropic + 联网搜索 → Anthropic Messages API（非流式）
    if config.provider == "anthropic" && web_search {
        return call_anthropic_with_search(&config, &client, &messages, max_tokens).await;
    }

    // 合并多个 system 消息为一个（部分 provider 如 MiniMax 不支持多 system 消息）
    let merged_messages = merge_system_messages(&messages);
    let json_messages = messages_to_json(&merged_messages, &config.provider);

    let mut request_body = json!({
        "messages": json_messages,
        "model": config.get_default_model(),
        "temperature": temperature.unwrap_or_else(|| get_default_temperature(&config)),
        "stream": false
    });

    // 注入 max_tokens：优先使用传入值，否则使用 provider 推荐的默认值
    request_body["max_tokens"] = json!(max_tokens.unwrap_or_else(|| get_default_max_tokens(&config)));

    // 联网搜索：根据 provider 注入正确的参数格式
    if web_search {
        inject_web_search_params(&mut request_body, &config);
    }

    let url = format!("{}/chat/completions", config.get_base_url());

    let request_builder = config.apply_auth(client.post(&url).json(&request_body));

    let response = request_builder
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| AppError::AiError(friendly_reqwest_error(&e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(AppError::AiError(format!(
            "AI API error ({}): {}",
            status, error_text
        )));
    }

    let openai_response: OpenAIResponse = response
        .json()
        .await
        .map_err(|e| AppError::AiError(format!("Failed to parse response: {}", e)))?;

    match openai_response {
        OpenAIResponse::Chat(resp) => {
            let content = resp
                .choices
                .first()
                .and_then(|c| c.message.as_ref())
                .map(|m| m.content.clone())
                .unwrap_or_default();

            Ok(content)
        }
        OpenAIResponse::Stream(_) => Err(AppError::AiError(
            "Unexpected stream response in non-stream mode".to_string(),
        )),
    }
}

#[tauri::command]
pub async fn chat_stream(
    app: AppHandle,
    messages: Vec<ChatMessage>,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    window: tauri::Window,
    enable_web_search: Option<bool>,
    enable_thinking: Option<bool>,
    enable_tools: Option<bool>,
    project_documents: Option<Vec<serde_json::Value>>,
    request_id: Option<String>,
    service_id: Option<String>,
    proxy_url: Option<String>,
    connect_timeout_secs: Option<u64>,
    request_timeout_secs: Option<u64>,
) -> Result<String> {
    let req_id = request_id.clone().unwrap_or_default();

    // 注册新的流
    if let Ok(mut states) = get_stream_states().lock() {
        states.insert(req_id.clone(), AtomicBool::new(false));
    }

    // 确保在函数退出时清理流状态
    struct StreamGuard {
        request_id: String,
    }
    impl Drop for StreamGuard {
        fn drop(&mut self) {
            cleanup_stream(&self.request_id);
        }
    }
    let _guard = StreamGuard { request_id: req_id.clone() };

    let config = get_ai_config(&app, provider, api_key, model, base_url, service_id);
    let web_search = enable_web_search.unwrap_or(false);
    let use_tools = enable_tools.unwrap_or(false);

    // OpenAI + 联网搜索 → Responses API
    if config.provider == "openai" && web_search {
        return stream_openai_responses(&config, &messages, &req_id, &window).await;
    }

    // Anthropic + 联网搜索 → Anthropic Messages API（原生格式）
    if config.provider == "anthropic" && web_search {
        return stream_anthropic_with_search(&config, &messages, &req_id, &window).await;
    }

    let client = ai_stream_client_with_opts(proxy_url.as_deref(), connect_timeout_secs, request_timeout_secs);
    let url = format!("{}/chat/completions", config.get_base_url());
    let docs = project_documents.unwrap_or_default();

    // 合并多个 system 消息为一个（部分 provider 如 MiniMax 不支持多 system 消息）
    let merged_messages = merge_system_messages(&messages);

    // Function Calling 循环：先用非流式检测 tool_calls，执行工具后再次调用
    let mut current_messages: Vec<serde_json::Value> = messages_to_json(&merged_messages, &config.provider);

    if use_tools {
        let tool_defs = tools::get_builtin_tool_definitions();
        let max_rounds = 5;

        for _round in 0..max_rounds {
            if is_stream_cancelled(&req_id) { break; }

            let mut tool_request = json!({
                "messages": current_messages,
                "model": config.get_default_model(),
                "temperature": get_default_temperature(&config),
                "stream": false,
                "tools": tool_defs
            });

            if web_search {
                inject_web_search_params(&mut tool_request, &config);
            }

            let req_builder = config.apply_auth(
                client.post(&url)
                    .header("Content-Type", "application/json")
                    .json(&tool_request)
            );

            let resp = req_builder
                .timeout(Duration::from_secs(120))
                .send()
                .await
                .map_err(|e| AppError::AiError(friendly_reqwest_error(&e)))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let err = resp.text().await.unwrap_or_default();
                return Err(AppError::AiError(format!("Tool call error ({}): {}", status, err)));
            }

            let json_resp: serde_json::Value = resp.json().await
                .map_err(|e| AppError::AiError(format!("Parse tool response failed: {}", e)))?;

            let choice = json_resp.get("choices")
                .and_then(|c| c.get(0));

            let finish_reason = choice
                .and_then(|c| c.get("finish_reason"))
                .and_then(|f| f.as_str())
                .unwrap_or("");

            if finish_reason != "tool_calls" {
                // AI 没有请求工具调用，跳出循环进入流式输出
                break;
            }

            // 提取 tool_calls 并执行
            let tool_calls = choice
                .and_then(|c| c.get("message"))
                .and_then(|m| m.get("tool_calls"))
                .and_then(|tc| tc.as_array());

            if let Some(calls) = tool_calls {
                // 将 assistant 消息（含 tool_calls）加入对话
                if let Some(assistant_msg) = choice.and_then(|c| c.get("message")) {
                    current_messages.push(assistant_msg.clone());
                }

                // 通知前端正在执行工具
                let _ = window.emit("ai:stream:chunk", json!({
                    "request_id": req_id,
                    "content": "\n\n> 🔧 正在调用工具...\n\n"
                }));

                for call_val in calls {
                    let tool_call: tools::ToolCall = match serde_json::from_value(call_val.clone()) {
                        Ok(tc) => tc,
                        Err(_) => continue,
                    };

                    let result = tools::execute_tool(&tool_call, &docs);

                    // 将工具结果加入对话
                    current_messages.push(json!({
                        "role": "tool",
                        "tool_call_id": result.tool_call_id,
                        "content": result.content
                    }));
                }
            } else {
                break;
            }
        }
    }

    // 最终流式输出
    let mut request_body = json!({
        "messages": current_messages,
        "model": config.get_default_model(),
        "temperature": get_default_temperature(&config),
        "max_tokens": get_default_max_tokens(&config),
        "stream": true
    });

    // 联网搜索：根据 provider 注入正确的参数格式
    if web_search {
        inject_web_search_params(&mut request_body, &config);
    }

    // 深度思考：根据 provider 注入思考模式参数
    let thinking = enable_thinking.unwrap_or(false);
    inject_thinking_params(&mut request_body, &config, thinking);

    let req_builder = config.apply_auth(
        client.post(&url)
            .header("Content-Type", "application/json")
            .body(request_body.to_string())
    );

    let response = req_builder
        .send()
        .await
        .map_err(|e| AppError::AiError(friendly_reqwest_error(&e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AiError(format!(
            "Stream failed ({}): {}", status, error_text
        )));
    }

    stream_sse_chat_completions(response, &req_id, &window).await
}

#[tauri::command]
pub async fn generate_content(
    app: AppHandle,
    author_notes: String,
    current_content: String,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    service_id: Option<String>,
    proxy_url: Option<String>,
    connect_timeout_secs: Option<u64>,
    request_timeout_secs: Option<u64>,
) -> Result<String> {
    let user_prompt = if current_content.is_empty() {
        author_notes.clone()
    } else {
        format!(
            "{}\n\n---\n参考素材如下：\n{}",
            author_notes, current_content
        )
    };

    let messages = vec![
        ChatMessage {
            role: "user".to_string(),
            content: user_prompt,
            images: None,
        },
    ];

    let response = chat(app, messages, provider, api_key, model, base_url, None, None, None, service_id, proxy_url, connect_timeout_secs, request_timeout_secs).await?;

    Ok(response)
}

#[tauri::command]
pub async fn generate_content_stream(
    app: AppHandle,
    author_notes: String,
    current_content: String,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    window: tauri::Window,
    conversation_history: Option<Vec<ChatMessage>>,
    system_prompt: Option<String>,
    enable_web_search: Option<bool>,
    enable_thinking: Option<bool>,
    request_id: Option<String>,
    service_id: Option<String>,
    proxy_url: Option<String>,
    connect_timeout_secs: Option<u64>,
    request_timeout_secs: Option<u64>,
) -> Result<String> {
    let user_prompt = if current_content.is_empty() {
        author_notes.clone()
    } else {
        format!(
            "{}\n\n---\n参考素材如下：\n{}",
            author_notes, current_content
        )
    };

    // Build messages: only add system message if frontend provided a non-empty system_prompt
    let mut messages: Vec<ChatMessage> = Vec::new();
    if let Some(sp) = system_prompt.filter(|s| !s.trim().is_empty()) {
        messages.push(ChatMessage {
            role: "system".to_string(),
            content: sp,
            images: None,
        });
    }

    // Add conversation history if provided (exclude the last message as it will be the current user prompt)
    if let Some(history) = conversation_history {
        // Take all but the last message if there's history, since the current user message will be added
        let history_len = history.len().saturating_sub(1);
        messages.extend_from_slice(&history[..history_len]);
    }

    // Add current user message
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: user_prompt,
        images: None,
    });

    chat_stream(app, messages, provider, api_key, model, base_url, window, enable_web_search, enable_thinking, None, None, request_id, service_id, proxy_url, connect_timeout_secs, request_timeout_secs).await
}

#[tauri::command]
pub async fn test_api_connection(
    app: AppHandle,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    service_id: Option<String>,
    proxy_url: Option<String>,
    connect_timeout_secs: Option<u64>,
    request_timeout_secs: Option<u64>,
) -> Result<String> {
    let config = get_ai_config(&app, provider, api_key, model, base_url, service_id);
    let client = ai_client_with_opts(proxy_url.as_deref(), connect_timeout_secs, request_timeout_secs);
    let url = format!("{}/chat/completions", config.get_base_url());

    let request_body = json!({
        "messages": [{"role": "user", "content": "Hi"}],
        "model": config.get_default_model(),
        "max_tokens": 5,
        "stream": false
    });

    let req_builder = config.apply_auth(
        client.post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
    );

    let response = req_builder
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| AppError::AiError(friendly_reqwest_error(&e)))?;

    if response.status().is_success() {
        Ok(format!("连接成功！模型: {}", config.get_default_model()))
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(AppError::AiError(format!("API 返回错误 ({}): {}", status, error_text)))
    }
}

/// OpenAI Responses API 非流式调用
async fn call_openai_responses(
    config: &AIConfig,
    client: &reqwest::Client,
    messages: &[ChatMessage],
    max_tokens: Option<u32>,
) -> Result<String> {
    let url = format!("{}/responses", config.get_base_url());

    let input: Vec<serde_json::Value> = messages_to_json(messages, "openai");

    let mut request_body = json!({
        "model": config.get_default_model(),
        "input": input,
        "tools": [{ "type": "web_search" }]
    });

    if let Some(mt) = max_tokens {
        request_body["max_tokens"] = json!(mt);
    }

    let req_builder = config.apply_auth(
        client.post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
    );

    let response = req_builder
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| AppError::AiError(friendly_reqwest_error(&e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AiError(format!("OpenAI Responses API error ({}): {}", status, error_text)));
    }

    let json_val: serde_json::Value = response.json().await
        .map_err(|e| AppError::AiError(format!("Failed to parse Responses API response: {}", e)))?;

    // 从 output 数组中提取文本内容
    let output_text = json_val.get("output_text")
        .and_then(|t| t.as_str())
        .unwrap_or("");

    Ok(output_text.to_string())
}

/// Anthropic Claude Messages API 非流式调用（带联网搜索）
async fn call_anthropic_with_search(
    config: &AIConfig,
    client: &reqwest::Client,
    messages: &[ChatMessage],
    max_tokens: Option<u32>,
) -> Result<String> {
    let url = format!("{}/messages", config.get_base_url());

    let mut system_content = String::new();
    let mut api_messages: Vec<serde_json::Value> = Vec::new();

    for msg in messages {
        if msg.role == "system" {
            system_content = msg.content.clone();
        } else {
            api_messages.push(message_to_json(msg, "anthropic"));
        }
    }

    let mut request_body = json!({
        "model": config.get_default_model(),
        "max_tokens": max_tokens.unwrap_or(8192),
        "messages": api_messages,
        "tools": [{
            "type": "web_search_20250305",
            "name": "web_search",
            "max_uses": 5
        }]
    });

    if !system_content.is_empty() {
        request_body["system"] = json!(system_content);
    }

    let req_builder = config.apply_auth(
        client.post(&url)
            .header("Content-Type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .header("anthropic-beta", "web-search-2025-03-05")
            .json(&request_body)
    );

    let response = req_builder
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| AppError::AiError(friendly_reqwest_error(&e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AiError(format!("Anthropic API error ({}): {}", status, error_text)));
    }

    let json_val: serde_json::Value = response.json().await
        .map_err(|e| AppError::AiError(format!("Failed to parse Anthropic response: {}", e)))?;

    // 从 content 数组中提取文本
    let mut result = String::new();
    if let Some(content_arr) = json_val.get("content").and_then(|c| c.as_array()) {
        for block in content_arr {
            if let Some(block_type) = block.get("type").and_then(|t| t.as_str()) {
                if block_type == "text" {
                    if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                        result.push_str(text);
                    }
                }
            }
        }
    }

    Ok(result)
}

/// SSE 事件类型
enum SseEvent<'a> {
    Done,
    Data(&'a serde_json::Value),
}

/// 通用 SSE 流事件处理器：封装 buffer 管理、流取消检查、大小限制、行拆分、JSON 解析
/// 单一回调处理所有事件，避免多闭包借用冲突
async fn for_each_sse_event<F>(
    response: reqwest::Response,
    req_id: &str,
    mut on_event: F,
) -> Result<()>
where
    F: FnMut(SseEvent<'_>),
{
    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        if is_stream_cancelled(req_id) {
            break;
        }

        let chunk = chunk_result
            .map_err(|e| AppError::AiError(friendly_reqwest_error(&e)))?;

        if buffer.len() + chunk.len() > MAX_BUFFER_SIZE {
            return Err(AppError::AiError("Response too large, exceeded buffer limit".to_string()));
        }

        buffer.extend_from_slice(&chunk);

        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line_bytes: Vec<u8> = buffer.drain(..=pos).collect();
            let line_str = String::from_utf8_lossy(&line_bytes);
            let line_str = line_str.trim_end_matches('\n').trim_end_matches('\r');

            if line_str.is_empty() {
                continue;
            }

            if let Some(data) = line_str.strip_prefix("data: ") {
                if data == "[DONE]" {
                    on_event(SseEvent::Done);
                    continue;
                }

                if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(data) {
                    if is_stream_cancelled(req_id) {
                        break;
                    }
                    on_event(SseEvent::Data(&json_val));
                }
            }
        }
    }

    Ok(())
}

/// 通用 SSE 流式解析（OpenAI Chat Completions 格式）
/// 解析 choices[0].delta.content 和 choices[0].delta.reasoning_content
async fn stream_sse_chat_completions(
    response: reqwest::Response,
    req_id: &str,
    window: &tauri::Window,
) -> Result<String> {
    let mut full_content = String::new();
    let mut in_reasoning = false;

    for_each_sse_event(response, req_id, |event| {
        match event {
            SseEvent::Done => {
                if in_reasoning {
                    let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": "</think>" }));
                    full_content.push_str("</think>");
                    in_reasoning = false;
                }
            }
            SseEvent::Data(json_val) => {
                let delta = json_val
                    .get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("delta"));

                if let Some(delta) = delta {
                    // 处理 reasoning_content（Qwen/DeepSeek/xAI 思考内容）
                    if let Some(reasoning) = delta.get("reasoning_content").and_then(|r| r.as_str()) {
                        if !reasoning.is_empty() {
                            if !in_reasoning {
                                let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": "<think>" }));
                                full_content.push_str("<think>");
                                in_reasoning = true;
                            }
                            full_content.push_str(reasoning);
                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": reasoning }));
                        }
                    }

                    // 处理 content（正文内容）
                    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                        if !content.is_empty() {
                            if in_reasoning {
                                let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": "</think>" }));
                                full_content.push_str("</think>");
                                in_reasoning = false;
                            }
                            full_content.push_str(content);
                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": content }));
                        }
                    }
                }
            }
        }
    }).await?;

    // 安全关闭：如果流结束时仍在 reasoning 状态
    if in_reasoning {
        let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": "</think>" }));
        full_content.push_str("</think>");
    }

    Ok(full_content)
}

/// OpenAI Responses API 流式调用（支持内置 web_search 工具）
async fn stream_openai_responses(
    config: &AIConfig,
    messages: &[ChatMessage],
    req_id: &str,
    window: &tauri::Window,
) -> Result<String> {
    let client = ai_stream_client();
    let base_url = config.get_base_url();
    let url = format!("{}/responses", base_url);

    // 将 ChatMessage 转换为 Responses API 的 input 格式（支持多模态图片）
    let input: Vec<serde_json::Value> = messages_to_json(messages, "openai");

    let request_body = json!({
        "model": config.get_default_model(),
        "input": input,
        "tools": [{ "type": "web_search" }],
        "stream": true
    });

    let req_builder = config.apply_auth(
        client.post(&url)
            .header("Content-Type", "application/json")
            .body(request_body.to_string())
    );

    let response = req_builder
        .send()
        .await
        .map_err(|e| AppError::AiError(friendly_reqwest_error(&e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AiError(format!(
            "OpenAI Responses API failed ({}): {}", status, error_text
        )));
    }

    // Responses API SSE 事件格式与 Chat Completions 不同
    let mut full_content = String::new();

    for_each_sse_event(response, req_id, |event| {
        if let SseEvent::Data(json_val) = event {
            let event_type = json_val.get("type").and_then(|t| t.as_str()).unwrap_or("");

            match event_type {
                // 文本增量输出
                "response.output_text.delta" => {
                    if let Some(delta) = json_val.get("delta").and_then(|d| d.as_str()) {
                        if !delta.is_empty() {
                            full_content.push_str(delta);
                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": delta }));
                        }
                    }
                }
                // 推理内容增量（reasoning 模型）
                "response.reasoning_summary_text.delta" => {
                    if let Some(delta) = json_val.get("delta").and_then(|d| d.as_str()) {
                        if !delta.is_empty() {
                            let think_content = format!("<think>{}</think>", delta);
                            full_content.push_str(&think_content);
                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": think_content }));
                        }
                    }
                }
                _ => {}
            }
        }
    }).await?;

    Ok(full_content)
}

/// Anthropic Claude 原生 Messages API 流式调用（支持 web_search server tool）
async fn stream_anthropic_with_search(
    config: &AIConfig,
    messages: &[ChatMessage],
    req_id: &str,
    window: &tauri::Window,
) -> Result<String> {
    let client = ai_stream_client();
    let base_url = config.get_base_url();
    let url = format!("{}/messages", base_url);

    // 分离 system 消息和对话消息（Anthropic 格式要求 system 在顶层）
    let mut system_content = String::new();
    let mut api_messages: Vec<serde_json::Value> = Vec::new();

    for msg in messages {
        if msg.role == "system" {
            system_content = msg.content.clone();
        } else {
            api_messages.push(message_to_json(msg, "anthropic"));
        }
    }

    let mut request_body = json!({
        "model": config.get_default_model(),
        "max_tokens": 8192,
        "messages": api_messages,
        "tools": [{
            "type": "web_search_20250305",
            "name": "web_search",
            "max_uses": 5
        }],
        "stream": true
    });

    if !system_content.is_empty() {
        request_body["system"] = json!(system_content);
    }

    let req_builder = config.apply_auth(
        client.post(&url)
            .header("Content-Type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .header("anthropic-beta", "web-search-2025-03-05")
            .body(request_body.to_string())
    );

    let response = req_builder
        .send()
        .await
        .map_err(|e| AppError::AiError(friendly_reqwest_error(&e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AiError(format!(
            "Anthropic API failed ({}): {}", status, error_text
        )));
    }

    // Anthropic SSE 格式：event: xxx \n data: {} \n\n
    let mut full_content = String::new();

    for_each_sse_event(response, req_id, |event| {
        if let SseEvent::Data(json_val) = event {
            let event_type = json_val.get("type").and_then(|t| t.as_str()).unwrap_or("");

            if event_type == "content_block_delta" {
                if let Some(delta) = json_val.get("delta") {
                    let delta_type = delta.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    match delta_type {
                        "text_delta" => {
                            if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                                if !text.is_empty() {
                                    full_content.push_str(text);
                                    let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": text }));
                                }
                            }
                        }
                        "thinking_delta" => {
                            if let Some(thinking) = delta.get("thinking").and_then(|t| t.as_str()) {
                                if !thinking.is_empty() {
                                    let think_text = format!("<think>{}</think>", thinking);
                                    full_content.push_str(&think_text);
                                    let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": think_text }));
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }).await?;

    Ok(full_content)
}

/// 根据 provider 注入联网搜索参数（Chat Completions 层）
fn inject_web_search_params(request_body: &mut serde_json::Value, config: &AIConfig) {
    match config.provider.as_str() {
        // GLM: 智谱自有的 web_search tool 格式
        "glm" | "glm-code" => {
            request_body["tools"] = json!([{
                "type": "web_search",
                "web_search": {
                    "enable": true,
                    "search_engine": "search_pro"
                }
            }]);
        }
        // Qwen: 通过 enable_search 参数启用
        "qwen" => {
            request_body["enable_search"] = json!(true);
        }
        // Kimi: 官方内置工具 $web_search
        "kimi" | "kimi-code" => {
            request_body["tools"] = json!([{
                "type": "builtin_function",
                "function": {
                    "name": "$web_search"
                }
            }]);
        }
        // Gemini: Google Search grounding
        "gemini" => {
            request_body["tools"] = json!([{
                "google_search": {}
            }]);
        }
        // xAI: web_search tool（OpenAI 兼容格式）
        "xai" => {
            request_body["tools"] = json!([{
                "type": "web_search"
            }]);
        }
        // DeepSeek/MiniMax: 无内置联网搜索（将在 Function Calling 阶段通过自定义工具实现）
        // OpenAI: 需要 Responses API（单独处理）
        // Anthropic: 需要原生 Messages API（单独处理）
        _ => {}
    }
}

/// 根据 provider 注入深度思考参数
fn inject_thinking_params(request_body: &mut serde_json::Value, config: &AIConfig, enabled: bool) {
    match config.provider.as_str() {
        // Qwen: 通过 enable_thinking 参数控制
        "qwen" => {
            request_body["enable_thinking"] = json!(enabled);
        }
        // GLM (GLM-5/GLM-4.5): 通过 thinking.type 参数控制
        // GLM-5 默认 disabled，GLM-4.5 默认 enabled（动态）
        // 思考内容通过 reasoning_content 字段返回
        "glm" | "glm-code" => {
            if enabled {
                request_body["thinking"] = json!({ "type": "enabled" });
            }
            // 不再主动 disabled，让 GLM-5 保持默认行为（enabled/强制思考）
        }
        // DeepSeek: deepseek-reasoner 自动启用思考，无额外参数
        // 由用户在设置中选择 reasoner 模型
        "deepseek" => {}
        // Kimi/MiniMax: 使用 <think> 标签的模型自动启用思考
        "kimi" | "kimi-code" | "minimax" | "minimax-code" => {}
        // OpenAI: o3/o4-mini 等推理模型自动启用
        "openai" => {}
        // xAI: Grok 推理模型自动启用
        "xai" => {}
        // Gemini: 2.5+ 自动启用思考
        "gemini" => {}
        // Anthropic: Extended Thinking 需要特殊参数（在原生 API 中处理）
        "anthropic" => {}
        _ => {}
    }
}

/// 根据 provider 返回推荐的默认 temperature（从注册表获取）
fn get_default_temperature(config: &AIConfig) -> f64 {
    config.defaults().default_temperature
}

/// 根据 provider 返回推荐的默认 max_tokens（从注册表获取）
fn get_default_max_tokens(config: &AIConfig) -> u32 {
    config.defaults().default_max_tokens
}

/// 合并多个 system 消息为一个（部分 provider 如 MiniMax 不支持多 system 消息）
/// 将所有 system 消息内容合并到第一条 system 消息中，移除后续的 system 消息
fn merge_system_messages(messages: &[ChatMessage]) -> Vec<ChatMessage> {
    let system_parts: Vec<&str> = messages.iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect();

    if system_parts.len() <= 1 {
        return messages.to_vec();
    }

    let merged_system = system_parts.join("\n\n");
    let mut result: Vec<ChatMessage> = Vec::new();
    let mut system_emitted = false;

    for m in messages {
        if m.role == "system" {
            if !system_emitted {
                result.push(ChatMessage {
                    role: "system".to_string(),
                    content: merged_system.clone(),
                    images: None,
                });
                system_emitted = true;
            }
            // 跳过后续的 system 消息
        } else {
            result.push(m.clone());
        }
    }

    result
}

/// 将 ChatMessage 转为 API 兼容的 JSON（支持多模态图片）
/// 对于 Anthropic provider，图片使用 source.type=base64 格式
/// 对于其他 provider（OpenAI 兼容），图片使用 image_url.url=data:... 格式
fn message_to_json(msg: &ChatMessage, provider: &str) -> serde_json::Value {
    let images = msg.images.as_deref().unwrap_or(&[]);
    if images.is_empty() {
        // 纯文本消息
        return json!({ "role": msg.role, "content": msg.content });
    }

    // 多模态消息：text + images
    let mut content_parts: Vec<serde_json::Value> = Vec::new();

    // 文本部分
    if !msg.content.is_empty() {
        content_parts.push(json!({ "type": "text", "text": msg.content }));
    }

    // 图片部分
    for img in images {
        if provider == "anthropic" {
            // Anthropic 原生格式
            content_parts.push(json!({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img.mime_type,
                    "data": img.data
                }
            }));
        } else {
            // OpenAI 兼容格式
            content_parts.push(json!({
                "type": "image_url",
                "image_url": {
                    "url": format!("data:{};base64,{}", img.mime_type, img.data)
                }
            }));
        }
    }

    json!({ "role": msg.role, "content": content_parts })
}

/// 批量转换消息列表
fn messages_to_json(messages: &[ChatMessage], provider: &str) -> Vec<serde_json::Value> {
    messages.iter().map(|m| message_to_json(m, provider)).collect()
}

fn get_ai_config(
    _app: &AppHandle,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
    service_id: Option<String>,
) -> AIConfig {
    let provider_val = provider.unwrap_or_else(|| {
        std::env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string())
    });

    // API Key 优先级：传入值 → keyring → 环境变量
    let api_key_val = api_key
        .filter(|k| !k.is_empty() && k != "__KEYRING__")
        .or_else(|| {
            service_id.as_deref()
                .and_then(super::credential::get_ai_key_from_keyring)
        })
        .or_else(|| std::env::var("AI_API_KEY").ok());

    let base_url_val = base_url
        .filter(|s| !s.is_empty())
        .or_else(|| std::env::var("AI_BASE_URL").ok());

    AIConfig {
        provider: provider_val,
        api_key: api_key_val,
        base_url: base_url_val,
        model,
    }
}

/// 导出全部 AI 服务列表到共享文件 ~/.aidocplus/ai-services.json
/// 供资源管理器等外部工具读取，支持多服务切换
#[tauri::command]
pub fn export_ai_services(json: String) -> crate::error::Result<()> {
    use crate::error::AppError;
    let home = dirs::home_dir().ok_or_else(|| AppError::Internal("无法获取用户主目录".to_string()))?;
    let config_dir = home.join(".aidocplus");
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| AppError::Internal(format!("创建配置目录失败: {}", e)))?;
    crate::config::atomic_write(&config_dir.join("ai-services.json"), &json)?;
    Ok(())
}
