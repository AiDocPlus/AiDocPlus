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
) -> Result<String> {
    let config = get_ai_config(&app, provider, api_key, model, base_url);
    let web_search = enable_web_search.unwrap_or(false);
    let client = reqwest::Client::new();

    // OpenAI + 联网搜索 → Responses API（非流式）
    if config.provider == "openai" && web_search {
        return call_openai_responses(&config, &client, &messages, max_tokens).await;
    }

    // Anthropic + 联网搜索 → Anthropic Messages API（非流式）
    if config.provider == "anthropic" && web_search {
        return call_anthropic_with_search(&config, &client, &messages, max_tokens).await;
    }

    let mut request_body = json!({
        "messages": messages,
        "model": config.get_default_model(),
        "temperature": temperature.unwrap_or(0.7),
        "stream": false
    });

    if let Some(mt) = max_tokens {
        request_body["max_tokens"] = json!(mt);
    }

    // 联网搜索：根据 provider 注入正确的参数格式
    if web_search {
        inject_web_search_params(&mut request_body, &config);
    }

    let url = format!("{}/chat/completions", config.get_base_url());

    let mut request_builder = client.post(&url).json(&request_body);

    // Set API key based on provider
    if let Some(key) = config.api_key {
        match config.provider.as_str() {
            "anthropic" => {
                request_builder = request_builder.header("x-api-key", key);
            }
            _ => {
                request_builder = request_builder.header("Authorization", format!("Bearer {}", key));
            }
        }
    }

    let response = request_builder
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| AppError::AIError(format!("Failed to connect to AI service: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(AppError::AIError(format!(
            "AI API error ({}): {}",
            status, error_text
        )));
    }

    let openai_response: OpenAIResponse = response
        .json()
        .await
        .map_err(|e| AppError::AIError(format!("Failed to parse response: {}", e)))?;

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
        OpenAIResponse::Stream(_) => Err(AppError::AIError(
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

    let config = get_ai_config(&app, provider, api_key, model, base_url);
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

    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", config.get_base_url());
    let docs = project_documents.unwrap_or_default();

    // Function Calling 循环：先用非流式检测 tool_calls，执行工具后再次调用
    let mut current_messages: Vec<serde_json::Value> = messages.iter().map(|m| {
        json!({ "role": m.role, "content": m.content })
    }).collect();

    if use_tools {
        let tool_defs = tools::get_builtin_tool_definitions();
        let max_rounds = 5;

        for _round in 0..max_rounds {
            if is_stream_cancelled(&req_id) { break; }

            let mut tool_request = json!({
                "messages": current_messages,
                "model": config.get_default_model(),
                "temperature": 0.7,
                "stream": false,
                "tools": tool_defs
            });

            if web_search {
                inject_web_search_params(&mut tool_request, &config);
            }

            let mut req_builder = client
                .post(&url)
                .header("Content-Type", "application/json")
                .json(&tool_request);

            if let Some(key) = &config.api_key {
                match config.provider.as_str() {
                    "anthropic" => { req_builder = req_builder.header("x-api-key", key); }
                    _ => { req_builder = req_builder.header("Authorization", format!("Bearer {}", key)); }
                }
            }

            let resp = req_builder
                .timeout(Duration::from_secs(120))
                .send()
                .await
                .map_err(|e| AppError::AIError(format!("Tool call failed: {}", e)))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let err = resp.text().await.unwrap_or_default();
                return Err(AppError::AIError(format!("Tool call error ({}): {}", status, err)));
            }

            let json_resp: serde_json::Value = resp.json().await
                .map_err(|e| AppError::AIError(format!("Parse tool response failed: {}", e)))?;

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
        "temperature": 0.7,
        "stream": true
    });

    // 联网搜索：根据 provider 注入正确的参数格式
    if web_search {
        inject_web_search_params(&mut request_body, &config);
    }

    // 深度思考：根据 provider 注入思考模式参数
    let thinking = enable_thinking.unwrap_or(false);
    inject_thinking_params(&mut request_body, &config, thinking);

    let mut req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(request_body.to_string());

    if let Some(key) = &config.api_key {
        match config.provider.as_str() {
            "anthropic" => {
                req_builder = req_builder.header("x-api-key", key);
            }
            _ => {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", key));
            }
        }
    }

    let response = req_builder
        .send()
        .await
        .map_err(|e| AppError::AIError(format!("Stream connection failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AIError(format!(
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
        },
    ];

    let response = chat(app, messages, provider, api_key, model, base_url, None, None, None).await?;

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
    });

    chat_stream(app, messages, provider, api_key, model, base_url, window, enable_web_search, enable_thinking, None, None, request_id).await
}

#[tauri::command]
pub async fn test_api_connection(
    app: AppHandle,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
) -> Result<String> {
    let config = get_ai_config(&app, provider, api_key, model, base_url);
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", config.get_base_url());

    let request_body = json!({
        "messages": [{"role": "user", "content": "Hi"}],
        "model": config.get_default_model(),
        "max_tokens": 5,
        "stream": false
    });

    let mut req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body);

    if let Some(key) = &config.api_key {
        match config.provider.as_str() {
            "anthropic" => {
                req_builder = req_builder.header("x-api-key", key);
            }
            _ => {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", key));
            }
        }
    }

    let response = req_builder
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| AppError::AIError(format!("连接失败: {}", e)))?;

    if response.status().is_success() {
        Ok(format!("连接成功！模型: {}", config.get_default_model()))
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Err(AppError::AIError(format!("API 返回错误 ({}): {}", status, error_text)))
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

    let input: Vec<serde_json::Value> = messages.iter().map(|m| {
        json!({ "role": m.role, "content": m.content })
    }).collect();

    let mut request_body = json!({
        "model": config.get_default_model(),
        "input": input,
        "tools": [{ "type": "web_search" }]
    });

    if let Some(mt) = max_tokens {
        request_body["max_tokens"] = json!(mt);
    }

    let mut req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body);

    if let Some(key) = &config.api_key {
        req_builder = req_builder.header("Authorization", format!("Bearer {}", key));
    }

    let response = req_builder
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| AppError::AIError(format!("OpenAI Responses API failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AIError(format!("OpenAI Responses API error ({}): {}", status, error_text)));
    }

    let json_val: serde_json::Value = response.json().await
        .map_err(|e| AppError::AIError(format!("Failed to parse Responses API response: {}", e)))?;

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
            api_messages.push(json!({ "role": msg.role, "content": msg.content }));
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

    let mut req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("anthropic-version", "2023-06-01")
        .header("anthropic-beta", "web-search-2025-03-05")
        .json(&request_body);

    if let Some(key) = &config.api_key {
        req_builder = req_builder.header("x-api-key", key);
    }

    let response = req_builder
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| AppError::AIError(format!("Anthropic API failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AIError(format!("Anthropic API error ({}): {}", status, error_text)));
    }

    let json_val: serde_json::Value = response.json().await
        .map_err(|e| AppError::AIError(format!("Failed to parse Anthropic response: {}", e)))?;

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

/// 通用 SSE 流式解析（OpenAI Chat Completions 格式）
/// 解析 choices[0].delta.content 和 choices[0].delta.reasoning_content
async fn stream_sse_chat_completions(
    response: reqwest::Response,
    req_id: &str,
    window: &tauri::Window,
) -> Result<String> {
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    let mut full_content = String::new();
    let mut buffer = Vec::new();
    let mut in_reasoning = false;

    while let Some(chunk_result) = stream.next().await {
        if is_stream_cancelled(req_id) {
            break;
        }

        let chunk = chunk_result
            .map_err(|e| AppError::AIError(format!("Stream error: {}", e)))?;

        if buffer.len() + chunk.len() > MAX_BUFFER_SIZE {
            return Err(AppError::AIError("Response too large, exceeded buffer limit".to_string()));
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
                    // 如果还在 reasoning 状态，关闭 think 标签
                    if in_reasoning {
                        let _ = window.emit("ai:stream:chunk", json!({
                            "request_id": req_id,
                            "content": "</think>"
                        }));
                        full_content.push_str("</think>");
                        in_reasoning = false;
                    }
                    continue;
                }

                if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(data) {
                    let delta = json_val
                        .get("choices")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("delta"));

                    if let Some(delta) = delta {
                        if is_stream_cancelled(req_id) {
                            break;
                        }

                        // 处理 reasoning_content（Qwen/DeepSeek/xAI 思考内容）
                        if let Some(reasoning) = delta.get("reasoning_content").and_then(|r| r.as_str()) {
                            if !reasoning.is_empty() {
                                if !in_reasoning {
                                    // 开始思考：发送 <think> 开标签
                                    let _ = window.emit("ai:stream:chunk", json!({
                                        "request_id": req_id,
                                        "content": "<think>"
                                    }));
                                    full_content.push_str("<think>");
                                    in_reasoning = true;
                                }
                                full_content.push_str(reasoning);
                                let _ = window.emit("ai:stream:chunk", json!({
                                    "request_id": req_id,
                                    "content": reasoning
                                }));
                            }
                        }

                        // 处理 content（正文内容）
                        if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                            if !content.is_empty() {
                                // 如果从 reasoning 切换到 content，关闭 think 标签
                                if in_reasoning {
                                    let _ = window.emit("ai:stream:chunk", json!({
                                        "request_id": req_id,
                                        "content": "</think>"
                                    }));
                                    full_content.push_str("</think>");
                                    in_reasoning = false;
                                }
                                full_content.push_str(content);
                                let _ = window.emit("ai:stream:chunk", json!({
                                    "request_id": req_id,
                                    "content": content
                                }));
                            }
                        }
                    }
                }
            }
        }
    }

    // 安全关闭：如果流结束时仍在 reasoning 状态
    if in_reasoning {
        let _ = window.emit("ai:stream:chunk", json!({
            "request_id": req_id,
            "content": "</think>"
        }));
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
    let client = reqwest::Client::new();
    let base_url = config.get_base_url();
    let url = format!("{}/responses", base_url);

    // 将 ChatMessage 转换为 Responses API 的 input 格式
    let input: Vec<serde_json::Value> = messages.iter().map(|m| {
        json!({
            "role": m.role,
            "content": m.content
        })
    }).collect();

    let request_body = json!({
        "model": config.get_default_model(),
        "input": input,
        "tools": [{ "type": "web_search" }],
        "stream": true
    });

    let mut req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(request_body.to_string());

    if let Some(key) = &config.api_key {
        req_builder = req_builder.header("Authorization", format!("Bearer {}", key));
    }

    let response = req_builder
        .send()
        .await
        .map_err(|e| AppError::AIError(format!("OpenAI Responses API connection failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AIError(format!(
            "OpenAI Responses API failed ({}): {}", status, error_text
        )));
    }

    // Responses API SSE 事件格式与 Chat Completions 不同
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    let mut full_content = String::new();
    let mut buffer = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        if is_stream_cancelled(req_id) {
            break;
        }

        let chunk = chunk_result
            .map_err(|e| AppError::AIError(format!("Stream error: {}", e)))?;

        if buffer.len() + chunk.len() > MAX_BUFFER_SIZE {
            return Err(AppError::AIError("Response too large".to_string()));
        }

        buffer.extend_from_slice(&chunk);

        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line_bytes: Vec<u8> = buffer.drain(..=pos).collect();
            let line_str = String::from_utf8_lossy(&line_bytes);
            let line_str = line_str.trim_end_matches('\n').trim_end_matches('\r');

            if line_str.is_empty() {
                continue;
            }

            // Responses API 使用 "event: xxx" + "data: {}" 格式
            if let Some(data) = line_str.strip_prefix("data: ") {
                if data == "[DONE]" {
                    continue;
                }

                if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(data) {
                    let event_type = json_val.get("type").and_then(|t| t.as_str()).unwrap_or("");

                    match event_type {
                        // 文本增量输出
                        "response.output_text.delta" => {
                            if let Some(delta) = json_val.get("delta").and_then(|d| d.as_str()) {
                                if !delta.is_empty() && !is_stream_cancelled(req_id) {
                                    full_content.push_str(delta);
                                    let _ = window.emit("ai:stream:chunk", json!({
                                        "request_id": req_id,
                                        "content": delta
                                    }));
                                }
                            }
                        }
                        // 推理内容增量（reasoning 模型）
                        "response.reasoning_summary_text.delta" => {
                            if let Some(delta) = json_val.get("delta").and_then(|d| d.as_str()) {
                                if !delta.is_empty() && !is_stream_cancelled(req_id) {
                                    // 包裹为 <think> 标签
                                    let think_content = format!("<think>{}</think>", delta);
                                    full_content.push_str(&think_content);
                                    let _ = window.emit("ai:stream:chunk", json!({
                                        "request_id": req_id,
                                        "content": think_content
                                    }));
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    Ok(full_content)
}

/// Anthropic Claude 原生 Messages API 流式调用（支持 web_search server tool）
async fn stream_anthropic_with_search(
    config: &AIConfig,
    messages: &[ChatMessage],
    req_id: &str,
    window: &tauri::Window,
) -> Result<String> {
    let client = reqwest::Client::new();
    let base_url = config.get_base_url();
    let url = format!("{}/messages", base_url);

    // 分离 system 消息和对话消息（Anthropic 格式要求 system 在顶层）
    let mut system_content = String::new();
    let mut api_messages: Vec<serde_json::Value> = Vec::new();

    for msg in messages {
        if msg.role == "system" {
            system_content = msg.content.clone();
        } else {
            api_messages.push(json!({
                "role": msg.role,
                "content": msg.content
            }));
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

    let mut req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("anthropic-version", "2023-06-01")
        .header("anthropic-beta", "web-search-2025-03-05")
        .body(request_body.to_string());

    if let Some(key) = &config.api_key {
        req_builder = req_builder.header("x-api-key", key);
    }

    let response = req_builder
        .send()
        .await
        .map_err(|e| AppError::AIError(format!("Anthropic API connection failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown".to_string());
        return Err(AppError::AIError(format!(
            "Anthropic API failed ({}): {}", status, error_text
        )));
    }

    // Anthropic SSE 格式：event: xxx \n data: {} \n\n
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    let mut full_content = String::new();
    let mut buffer = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        if is_stream_cancelled(req_id) {
            break;
        }

        let chunk = chunk_result
            .map_err(|e| AppError::AIError(format!("Stream error: {}", e)))?;

        if buffer.len() + chunk.len() > MAX_BUFFER_SIZE {
            return Err(AppError::AIError("Response too large".to_string()));
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
                if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(data) {
                    let event_type = json_val.get("type").and_then(|t| t.as_str()).unwrap_or("");

                    match event_type {
                        // 文本增量
                        "content_block_delta" => {
                            if let Some(delta) = json_val.get("delta") {
                                let delta_type = delta.get("type").and_then(|t| t.as_str()).unwrap_or("");
                                match delta_type {
                                    "text_delta" => {
                                        if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                                            if !text.is_empty() && !is_stream_cancelled(req_id) {
                                                full_content.push_str(text);
                                                let _ = window.emit("ai:stream:chunk", json!({
                                                    "request_id": req_id,
                                                    "content": text
                                                }));
                                            }
                                        }
                                    }
                                    "thinking_delta" => {
                                        if let Some(thinking) = delta.get("thinking").and_then(|t| t.as_str()) {
                                            if !thinking.is_empty() && !is_stream_cancelled(req_id) {
                                                let think_text = format!("<think>{}</think>", thinking);
                                                full_content.push_str(&think_text);
                                                let _ = window.emit("ai:stream:chunk", json!({
                                                    "request_id": req_id,
                                                    "content": think_text
                                                }));
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

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
            } else {
                request_body["thinking"] = json!({ "type": "disabled" });
            }
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

fn get_ai_config(
    _app: &AppHandle,
    provider: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
) -> AIConfig {
    let provider_val = provider.unwrap_or_else(|| {
        std::env::var("AI_PROVIDER").unwrap_or_else(|_| "openai".to_string())
    });

    let api_key_val = api_key.or_else(|| {
        std::env::var("AI_API_KEY").ok()
    });

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
