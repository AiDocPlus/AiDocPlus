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

    builder.build().unwrap_or_else(|e| {
        eprintln!("[ai] HTTP 客户端构建失败，使用默认客户端: {}", e);
        reqwest::Client::new()
    })
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
        return call_openai_responses(&config, &client, &messages, max_tokens, temperature).await;
    }

    // Anthropic + 联网搜索 → Anthropic Messages API（非流式）
    if config.provider == "anthropic" && web_search {
        return call_anthropic_with_search(&config, &client, &messages, max_tokens, temperature).await;
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

    // 注入 max_tokens：传入 0 或 None 时由 AI 模型自行决定
    let max_tok = resolve_max_tokens(max_tokens, &config);
    inject_max_tokens(&mut request_body, max_tok);

    // 联网搜索：根据 provider 注入正确的参数格式
    if web_search {
        inject_web_search_params(&mut request_body, &config);
    }

    let url = format!("{}/chat/completions", config.get_base_url());

    let request_builder = config.apply_auth(client.post(&url).json(&request_body));

    let response = request_builder
        .header("Content-Type", "application/json")
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
    tool_scope: Option<String>,
    project_documents: Option<Vec<serde_json::Value>>,
    request_id: Option<String>,
    service_id: Option<String>,
    proxy_url: Option<String>,
    connect_timeout_secs: Option<u64>,
    request_timeout_secs: Option<u64>,
    max_tokens: Option<u32>,
    temperature: Option<f64>,
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
    let stream_max_tokens = resolve_max_tokens(max_tokens, &config);
    let resolved_temp = temperature.unwrap_or_else(|| get_default_temperature(&config));
    let web_search = enable_web_search.unwrap_or(false);
    let use_tools = enable_tools.unwrap_or(false);

    // 解析工具 scope（stock / stock:financial / stock:technical / document / all，默认 all）
    let scope = match tool_scope.as_deref() {
        Some("stock") => tools::ToolScope::Stock,
        Some("stock:financial") => tools::ToolScope::StockFinancial,
        Some("stock:technical") => tools::ToolScope::StockTechnical,
        Some("document") => tools::ToolScope::Document,
        _ => tools::ToolScope::All,
    };

    // 两阶段执行：当同时启用工具调用和联网搜索时，工具调用阶段不注入 web_search，
    // 工具调用结束后再进行带 web_search 的流式输出
    // OpenAI + 纯联网搜索（无工具）→ Responses API
    if config.provider == "openai" && web_search && !use_tools {
        return stream_openai_responses(&config, &messages, &req_id, &window, max_tokens, proxy_url.as_deref(), connect_timeout_secs, request_timeout_secs).await;
    }

    // Anthropic + 纯联网搜索（无工具）→ Anthropic Messages API（原生格式）
    if config.provider == "anthropic" && web_search && !use_tools {
        return stream_anthropic_with_search(&config, &messages, &req_id, &window, max_tokens, proxy_url.as_deref(), connect_timeout_secs, request_timeout_secs).await;
    }

    let client = ai_stream_client_with_opts(proxy_url.as_deref(), connect_timeout_secs, request_timeout_secs);
    let url = format!("{}/chat/completions", config.get_base_url());
    let docs = project_documents.unwrap_or_default();

    // 合并多个 system 消息为一个（部分 provider 如 MiniMax 不支持多 system 消息）
    let merged_messages = merge_system_messages(&messages);

    // Function Calling 循环：先用非流式检测 tool_calls，执行工具后再次调用
    let mut current_messages: Vec<serde_json::Value> = messages_to_json(&merged_messages, &config.provider);
    let mut tools_were_called = false;

    if use_tools {
        let tool_defs = tools::get_tool_definitions(scope);
        let max_rounds = 8;

        for _round in 0..max_rounds {
            if is_stream_cancelled(&req_id) { break; }

            // 使用流式请求检测工具调用（兼容 MiniMax 等不支持非流式 Function Calling 的 provider）
            let mut tool_request = json!({
                "messages": current_messages,
                "model": config.get_default_model(),
                "temperature": resolved_temp,
                "stream": true,
                "tools": tool_defs
            });
            inject_max_tokens(&mut tool_request, stream_max_tokens);

            let req_builder = config.apply_auth(
                client.post(&url)
                    .header("Content-Type", "application/json")
                    .body(tool_request.to_string())
            );

            let resp = match req_builder.send().await {
                Ok(r) => r,
                Err(e) => {
                    let _ = window.emit("ai:stream:chunk", json!({
                        "request_id": req_id,
                        "content": format!("\n\n> ⚠️ 工具调用失败（{}），将直接生成回复。\n\n", friendly_reqwest_error(&e))
                    }));
                    break;
                }
            };

            if !resp.status().is_success() {
                let status = resp.status();
                let err_body = resp.text().await.unwrap_or_default();
                let _ = window.emit("ai:stream:chunk", json!({
                    "request_id": req_id,
                    "content": format!("\n\n> ⚠️ 工具调用失败 ({})，将直接生成回复。\n\n", status)
                }));
                eprintln!("[Tool] HTTP error {}: {}", status, err_body);
                break;
            }

            // 从 SSE 流中累积 tool_calls（流式 Function Calling）
            let stream_result = collect_stream_tool_calls(resp, &req_id, &window).await;
            let (accumulated_tool_calls, assistant_tool_msg, got_tool_calls, early_assistant_text) =
                match stream_result {
                    Ok(r) => r,
                    Err(e) => {
                        eprintln!("[Tool] stream collect error: {}", e);
                        break;
                    }
                };

            if !got_tool_calls {
                // 模型本轮直接输出正文（无 tool_calls）
                if let Some(text) = early_assistant_text {
                    if !assistant_tool_msg.is_null() {
                        current_messages.push(assistant_tool_msg);
                    }
                    // 无论是否之前调用过工具，模型本轮已给出最终回复，直接返回
                    // （tools_were_called=true 说明工具调用阶段已结束，本轮是 AI 的最终总结）
                    return Ok(text);
                }
                break;
            }

            // 将 assistant 消息（含 tool_calls）加入对话
            current_messages.push(assistant_tool_msg);
            tools_were_called = true;

            for tool_call in accumulated_tool_calls {
                // 通知前端正在执行具体工具
                let tool_display = format_tool_call_display(&tool_call);
                let _ = window.emit("ai:stream:chunk", json!({
                    "request_id": req_id,
                    "content": format!("\n\n> 🔧 {}\n", tool_display)
                }));

                let result = tools::execute_tool(&tool_call, &docs).await;

                // 将工具结果加入对话
                current_messages.push(json!({
                    "role": "tool",
                    "tool_call_id": result.tool_call_id,
                    "content": result.content
                }));
            }
        }

        // 两阶段策略：工具调用结束后，如果同时开启了联网搜索，
        // 追加提示让 AI 在最终流式输出中利用联网搜索补充信息
        if tools_were_called && web_search {
            let _ = window.emit("ai:stream:chunk", json!({
                "request_id": req_id,
                "content": "\n\n> 🌐 正在联网搜索最新资讯...\n\n"
            }));
            // 附言：引导模型在最终阶段结合联网补充新闻/公告，且不与工具数值矛盾
            current_messages.push(json!({
                "role": "user",
                "content": "请基于上文工具返回的数据撰写分析；若当前请求已启用联网搜索，请补充检索近期新闻、公告或市场评论（如适用），数值仍以工具结果为准，勿编造。\n\n【重要】禁止再调用任何工具。必须直接输出：先给出 Markdown 分析摘要，再在末尾用 ```json 代码块输出结构化研究数据（字段需包含 stock、financials、technicals、theses、risk、news、peers 等与一键研究模板一致）。"
            }));
        }
    }

    // 最终流式输出（两阶段策略说明：
    // 工具调用有结果时，OpenAI/Anthropic 走 Chat Completions 而非 Responses/Messages API，
    // 因为 current_messages 中含 tool 角色消息，只有 Chat Completions 支持这种格式）
    let mut request_body = json!({
        "messages": current_messages,
        "model": config.get_default_model(),
        "temperature": resolved_temp,
        "stream": true
    });
    inject_max_tokens(&mut request_body, stream_max_tokens);

    // 联网搜索：根据 provider 注入正确的参数格式
    // 注意：当 tools_were_called=true 时，current_messages 中含 role:"tool" 消息，
    // 此时不能再覆盖 tools 字段为联网搜索工具（会导致 provider 报错），
    // 联网搜索需求已通过两阶段策略中的 user prompt 引导实现
    if web_search && !tools_were_called {
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

    let mut full = stream_sse_chat_completions(response, &req_id, &window).await?;
    if !has_visible_content(&full) {
        let hint = "\n\n> ⚠️ 模型未返回正文（可能因上下文过长或输出限制）。可尝试在设置中提高「最大输出 token」或减少单次工具数据后重试。\n\n";
        let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": hint }));
        full.push_str(hint);
    }
    Ok(full)
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
    max_tokens: Option<u32>,
    temperature: Option<f64>,
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

    // Add conversation history if provided
    // Note: history contains prior assistant/user turns; the current user prompt is added separately below
    if let Some(history) = conversation_history {
        messages.extend(history);
    }

    // Add current user message
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: user_prompt,
        images: None,
    });

    chat_stream(
        app,
        messages,
        provider,
        api_key,
        model,
        base_url,
        window,
        enable_web_search,
        enable_thinking,
        None,
        None,
        None,
        request_id,
        service_id,
        proxy_url,
        connect_timeout_secs,
        request_timeout_secs,
        max_tokens,
        temperature,
    )
    .await
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
    temperature: Option<f64>,
) -> Result<String> {
    let url = format!("{}/responses", config.get_base_url());

    let input: Vec<serde_json::Value> = messages_to_json(messages, "openai");

    let mut request_body = json!({
        "model": config.get_default_model(),
        "input": input,
        "tools": [{ "type": "web_search" }],
        "temperature": temperature.unwrap_or_else(|| get_default_temperature(config))
    });

    // Responses API 使用 max_output_tokens 而非 max_tokens
    if let Some(n) = resolve_max_tokens(max_tokens, config) {
        request_body["max_output_tokens"] = json!(n);
    }

    let req_builder = config.apply_auth(
        client.post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
    );

    let response = req_builder
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
    temperature: Option<f64>,
) -> Result<String> {
    let url = format!("{}/messages", config.get_base_url());

    let mut system_parts: Vec<String> = Vec::new();
    let mut api_messages: Vec<serde_json::Value> = Vec::new();

    for msg in messages {
        if msg.role == "system" {
            system_parts.push(msg.content.clone());
        } else {
            api_messages.push(message_to_json(msg, "anthropic"));
        }
    }
    let system_content = system_parts.join("\n\n");

    let mut request_body = json!({
        "model": config.get_default_model(),
        "messages": api_messages,
        "tools": [{
            "type": "web_search_20250305",
            "name": "web_search",
            "max_uses": 5
        }],
        "temperature": temperature.unwrap_or_else(|| get_default_temperature(config))
    });
    inject_max_tokens(&mut request_body, resolve_max_tokens(max_tokens, config));

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
    F: FnMut(SseEvent<'_>) + Send,
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

            let data = line_str.strip_prefix("data: ").or_else(|| line_str.strip_prefix("data:"));
            if let Some(data) = data {
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

/// 从流式 SSE 响应中累积解析 tool_calls（流式 Function Calling）
/// 返回: (tool_calls列表, assistant消息json, 是否有tool_calls, 无tool_calls时的完整展示文本)
async fn collect_stream_tool_calls(
    response: reqwest::Response,
    req_id: &str,
    window: &tauri::Window,
) -> Result<(Vec<tools::ToolCall>, serde_json::Value, bool, Option<String>)> {
    // 累积 tool_calls 的各字段（流式下是分块到来的）
        // 使用 Mutex/AtomicBool 替代 RefCell/Cell，确保 Send 安全
    let tool_calls_map: std::sync::Mutex<std::collections::BTreeMap<usize, serde_json::Value>> = std::sync::Mutex::new(std::collections::BTreeMap::new());
    let finish_reason: std::sync::Mutex<String> = std::sync::Mutex::new(String::new());
    let assistant_api_text: std::sync::Mutex<String> = std::sync::Mutex::new(String::new());
    let in_reasoning: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

    let req_id_owned = req_id.to_string();

    let think_tag = "\u{1f4ad}"; // 💭

    let flush_reasoning_close = || {
        if in_reasoning.load(std::sync::atomic::Ordering::Relaxed) {
            let _ = window.emit("ai:stream:chunk", json!({ "request_id": &req_id_owned, "content": think_tag }));
            assistant_api_text.lock().unwrap().push_str(think_tag);
            in_reasoning.store(false, std::sync::atomic::Ordering::Relaxed);
        }
    };

    for_each_sse_event(response, req_id, |event| {
        match event {
            SseEvent::Done => return,
            SseEvent::Data(json_val) => {
                let choice = json_val.get("choices").and_then(|c| c.get(0));

                if let Some(fr) = choice.and_then(|c| c.get("finish_reason")).and_then(|f| f.as_str()) {
                    if !fr.is_empty() && fr != "null" {
                        *finish_reason.lock().unwrap() = fr.to_string();
                    }
                }

                if let Some(delta) = choice.and_then(|c| c.get("delta")) {
                    // reasoning_content（DeepSeek/Qwen3/GLM-5 等）
                    if let Some(reasoning) = delta.get("reasoning_content").and_then(|r| r.as_str()) {
                        if !reasoning.is_empty() {
                            if !in_reasoning.load(std::sync::atomic::Ordering::Relaxed) {
                                let _ = window.emit("ai:stream:chunk", json!({ "request_id": &req_id_owned, "content": think_tag }));
                                assistant_api_text.lock().unwrap().push_str(think_tag);
                                in_reasoning.store(true, std::sync::atomic::Ordering::Relaxed);
                            }
                            assistant_api_text.lock().unwrap().push_str(reasoning);
                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": &req_id_owned, "content": reasoning }));
                        }
                    }

                    // 正文
                    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                        if !content.is_empty() {
                            flush_reasoning_close();
                            assistant_api_text.lock().unwrap().push_str(content);
                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": &req_id_owned, "content": content }));
                        }
                    }

                    // tool_calls
                    if let Some(tcs) = delta.get("tool_calls").and_then(|tc| tc.as_array()) {
                        for tc_delta in tcs {
                            let idx = tc_delta.get("index")
                                .and_then(|i| i.as_u64())
                                .unwrap_or(0) as usize;

                            let mut map_guard = tool_calls_map.lock().unwrap();
                            let entry = map_guard.entry(idx).or_insert_with(|| json!({
                                "id": "",
                                "type": "function",
                                "function": { "name": "", "arguments": "" }
                            }));

                            if let Some(id) = tc_delta.get("id").and_then(|v| v.as_str()) {
                                if !id.is_empty() {
                                    entry["id"] = json!(id);
                                }
                            }
                            if let Some(name) = tc_delta.get("function").and_then(|f| f.get("name")).and_then(|n| n.as_str()) {
                                if !name.is_empty() {
                                    let cur = entry["function"]["name"].as_str().unwrap_or("").to_string();
                                    entry["function"]["name"] = json!(cur + name);
                                }
                            }
                            if let Some(args) = tc_delta.get("function").and_then(|f| f.get("arguments")).and_then(|a| a.as_str()) {
                                let cur = entry["function"]["arguments"].as_str().unwrap_or("").to_string();
                                entry["function"]["arguments"] = json!(cur + args);
                            }
                        }
                    }
                }
            }
        }
    }).await?;

    flush_reasoning_close();

    let got_tool_calls = finish_reason.lock().unwrap().as_str() == "tool_calls" || !tool_calls_map.lock().unwrap().is_empty();
    let api_text = assistant_api_text.into_inner().unwrap();

    if !got_tool_calls {
        let early = if api_text.trim().is_empty() {
            None
        } else {
            Some(api_text.clone())
        };
        let msg = if api_text.trim().is_empty() {
            json!(null)
        } else {
            json!({
                "role": "assistant",
                "content": api_text
            })
        };
        return Ok((vec![], msg, false, early));
    }

    let mut tool_calls: Vec<tools::ToolCall> = Vec::new();
    let mut tool_calls_json: Vec<serde_json::Value> = Vec::new();

    for (_, tc_val) in tool_calls_map.into_inner().unwrap() {
        tool_calls_json.push(tc_val.clone());
        match serde_json::from_value::<tools::ToolCall>(tc_val.clone()) {
            Ok(tc) => tool_calls.push(tc),
            Err(e) => eprintln!("[Tool] deserialize ToolCall error: {} val={}", e, tc_val),
        }
    }

    let content_field: serde_json::Value = if api_text.trim().is_empty() {
        serde_json::Value::Null
    } else {
        json!(api_text)
    };

    let assistant_msg = json!({
        "role": "assistant",
        "content": content_field,
        "tool_calls": tool_calls_json
    });

    Ok((tool_calls, assistant_msg, true, None))
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
    // 过滤 minimax:tool_call 块（MiniMax 联网搜索内部格式）
    let mut pending_buf: Option<String> = None;
    let mut in_tool_call_block = false;

    for_each_sse_event(response, req_id, |event| {
        match event {
            SseEvent::Done => {
                if in_reasoning {
                    let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": "</think>" }));
                    full_content.push_str("</think>");
                    in_reasoning = false;
                }
                // 流结束时输出 pending_buf 中剩余的内容
                if let Some(buf) = pending_buf.as_mut() {
                    if in_tool_call_block {
                        *buf = buf.replace("<minimax:tool_call>", "");
                    }
                    if !buf.is_empty() {
                        full_content.push_str(buf);
                        let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": &*buf }));
                    }
                    pending_buf = None;
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

                    // 处理 content（正文内容），过滤 minimax:tool_call 块
                    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                        if !content.is_empty() {
                            if in_reasoning {
                                let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": "</think>" }));
                                full_content.push_str("</think>");
                                in_reasoning = false;
                            }

                            // 将新内容追加到 pending_buf，处理 tool_call 块过滤
                            let buf = pending_buf.get_or_insert_with(String::new);
                            buf.push_str(content);

                            loop {
                                if in_tool_call_block {
                                    // 在 tool_call 块内，寻找结束标签
                                    if let Some(end_pos) = buf.find("</minimax:tool_call>") {
                                        // 跳过整个 tool_call 块（包括结束标签）
                                        let after = buf[end_pos + "</minimax:tool_call>".len()..].to_string();
                                        *buf = after;
                                        in_tool_call_block = false;
                                    } else {
                                        // 还没找到结束标签，继续等待
                                        break;
                                    }
                                } else {
                                    // 不在 tool_call 块内，寻找开始标签
                                    if let Some(start_pos) = buf.find("<minimax:tool_call>") {
                                        // 输出开始标签之前的内容
                                        let before = buf[..start_pos].to_string();
                                        if !before.is_empty() {
                                            full_content.push_str(&before);
                                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": &before }));
                                        }
                                        let after = buf[start_pos + "<minimax:tool_call>".len()..].to_string();
                                        *buf = after;
                                        in_tool_call_block = true;
                                    } else {
                                        // 没有 tool_call 块，但需保留尾部可能是开始标签前缀的内容
                                        // 安全阈值：如果 pending_buf 超过开始标签长度，可以安全输出前面部分
                                        const TAG: &str = "<minimax:tool_call>";
                                        if buf.len() > TAG.len() {
                                            let safe_len = buf.len() - TAG.len();
                                            let safe = buf[..safe_len].to_string();
                                            if !safe.is_empty() {
                                                full_content.push_str(&safe);
                                                let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": &safe }));
                                            }
                                            *buf = buf[safe_len..].to_string();
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }).await?;

    // 安全关闭：如果流结束时仍在 reasoning 状态（SSE 流异常断开未触发 Done handler）
    if in_reasoning {
        let reasoning_end = "\n\n";
        let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": reasoning_end }));
        full_content.push_str(reasoning_end);
    }

    // 安全 flush：确保 pending_buf 中残留内容全部输出
    // （当 SSE 流未发送 [DONE] 就断开时，Done handler 不会触发，pending_buf 可能仍有 ≤17 字符残留）
    if let Some(buf) = pending_buf.as_mut() {
        if in_tool_call_block {
            *buf = buf.replace("<minimax:tool_call>", "");
        }
        if !buf.is_empty() {
            full_content.push_str(buf);
            let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": &*buf }));
        }
    }

    Ok(full_content)
}

/// OpenAI Responses API 流式调用（支持内置 web_search 工具）
async fn stream_openai_responses(
    config: &AIConfig,
    messages: &[ChatMessage],
    req_id: &str,
    window: &tauri::Window,
    max_tokens: Option<u32>,
    proxy_url: Option<&str>,
    connect_timeout_secs: Option<u64>,
    request_timeout_secs: Option<u64>,
) -> Result<String> {
    let client = ai_stream_client_with_opts(proxy_url, connect_timeout_secs, request_timeout_secs);
    let base_url = config.get_base_url();
    let url = format!("{}/responses", base_url);

    // 将 ChatMessage 转换为 Responses API 的 input 格式（支持多模态图片）
    let input: Vec<serde_json::Value> = messages_to_json(messages, "openai");

    let mut request_body = json!({
        "model": config.get_default_model(),
        "input": input,
        "tools": [{ "type": "web_search" }],
        "stream": true
    });
    // Responses API 使用 max_output_tokens 而非 max_tokens
    if let Some(n) = resolve_max_tokens(max_tokens, config) {
        request_body["max_output_tokens"] = json!(n);
    }

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
    let in_reasoning = std::sync::atomic::AtomicBool::new(false);

    for_each_sse_event(response, req_id, |event| {
        if let SseEvent::Data(json_val) = event {
            let event_type = json_val.get("type").and_then(|t| t.as_str()).unwrap_or("");

            match event_type {
                // 文本增量输出
                "response.output_text.delta" => {
                    // 从推理切换到正文时关闭 💭 标记
                    if in_reasoning.load(std::sync::atomic::Ordering::Relaxed) {
                        let close = "💭";
                        full_content.push_str(close);
                        let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": close }));
                        in_reasoning.store(false, std::sync::atomic::Ordering::Relaxed);
                    }
                    if let Some(delta) = json_val.get("delta").and_then(|d| d.as_str()) {
                        if !delta.is_empty() {
                            full_content.push_str(delta);
                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": delta }));
                        }
                    }
                }
                // 推理内容增量（reasoning 模型如 o3/o4-mini，默认产生）
                "response.reasoning.delta" => {
                    if let Some(delta) = json_val.get("delta").and_then(|d| d.as_str()) {
                        if !delta.is_empty() {
                            if !in_reasoning.load(std::sync::atomic::Ordering::Relaxed) {
                                let open = "💭";
                                full_content.push_str(open);
                                let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": open }));
                                in_reasoning.store(true, std::sync::atomic::Ordering::Relaxed);
                            }
                            full_content.push_str(delta);
                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": delta }));
                        }
                    }
                }
                // 推理摘要增量（需要请求中设置 reasoning.summary 参数才产生）
                "response.reasoning_summary_text.delta" => {
                    if let Some(delta) = json_val.get("delta").and_then(|d| d.as_str()) {
                        if !delta.is_empty() {
                            let think_content = format!("💭{}😎", delta);
                            full_content.push_str(&think_content);
                            let _ = window.emit("ai:stream:chunk", json!({ "request_id": req_id, "content": think_content }));
                        }
                    }
                }
                _ => {}
            }
        }
    }).await?;

    // 流结束时关闭 reasoning 标记
    if in_reasoning.load(std::sync::atomic::Ordering::Relaxed) {
        full_content.push_str("💭");
    }

    Ok(full_content)
}

/// Anthropic Claude 原生 Messages API 流式调用（支持 web_search server tool）
async fn stream_anthropic_with_search(
    config: &AIConfig,
    messages: &[ChatMessage],
    req_id: &str,
    window: &tauri::Window,
    max_tokens: Option<u32>,
    proxy_url: Option<&str>,
    connect_timeout_secs: Option<u64>,
    request_timeout_secs: Option<u64>,
) -> Result<String> {
    let client = ai_stream_client_with_opts(proxy_url, connect_timeout_secs, request_timeout_secs);
    let base_url = config.get_base_url();
    let url = format!("{}/messages", base_url);

    // 分离 system 消息和对话消息（Anthropic 格式要求 system 在顶层）
    let mut system_parts: Vec<String> = Vec::new();
    let mut api_messages: Vec<serde_json::Value> = Vec::new();

    for msg in messages {
        if msg.role == "system" {
            system_parts.push(msg.content.clone());
        } else {
            api_messages.push(message_to_json(msg, "anthropic"));
        }
    }
    let system_content = system_parts.join("\n\n");

    let mut request_body = json!({
        "model": config.get_default_model(),
        "messages": api_messages,
        "tools": [{
            "type": "web_search_20250305",
            "name": "web_search",
            "max_uses": 5
        }],
        "stream": true
    });
    // 使用本次请求 max_tokens（<=0 或 None 时回退 provider 默认值）
    inject_max_tokens(&mut request_body, resolve_max_tokens(max_tokens, config));

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

/// 解析 max_tokens：用户显式传入 >0 时优先使用；否则使用 provider 默认值（16384）。
fn resolve_max_tokens(requested: Option<u32>, config: &AIConfig) -> Option<u32> {
    match requested {
        Some(n) if n > 0 => Some(n),
        _ => {
            let default = get_default_max_tokens(config);
            if default > 0 { Some(default) } else { None }
        }
    }
}

/// 如果 resolve_max_tokens 返回 Some，注入到 request_body；否则移除 max_tokens 字段。
fn inject_max_tokens(body: &mut serde_json::Value, max_tokens: Option<u32>) {
    match max_tokens {
        Some(n) => { body["max_tokens"] = json!(n); }
        None => { body.as_object_mut().map(|m| { m.remove("max_tokens"); }); }
    }
}

/// 检查模型输出中是否包含可见正文（忽略 <think> 思考块）
fn has_visible_content(raw: &str) -> bool {
    let mut result = String::with_capacity(raw.len());
    let mut idx = 0usize;

    while let Some(start_rel) = raw[idx..].find("<think>") {
        let start = idx + start_rel;
        // 追加 <think> 之前的正文
        result.push_str(&raw[idx..start]);
        let after_start = start + "<think>".len();
        if let Some(end_rel) = raw[after_start..].find("</think>") {
            // 跳过完整 think 块
            idx = after_start + end_rel + "</think>".len();
        } else {
            // 未闭合 think：后续全部视为思考内容
            idx = raw.len();
            break;
        }
    }
    if idx < raw.len() {
        result.push_str(&raw[idx..]);
    }

    !result.trim().is_empty()
}

/// 格式化工具调用显示文本（用于反馈给用户）
fn format_tool_call_display(tool_call: &tools::ToolCall) -> String {
    let name = &tool_call.function.name;
    let args: serde_json::Value = serde_json::from_str(&tool_call.function.arguments)
        .unwrap_or(serde_json::Value::Null);

    // 提取关键参数（ts_code / keyword / trade_date 等）用于显示
    let param_hint = if let Some(obj) = args.as_object() {
        let key_params = ["ts_code", "keyword", "trade_date", "index_code", "search", "query", "document_id"];
        key_params.iter()
            .find_map(|k| obj.get(*k).and_then(|v| v.as_str()).map(|v| format!("({}=\"{}\")", k, v)))
            .unwrap_or_default()
    } else {
        String::new()
    };

    format!("调用 {}{}", name, param_hint)
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
    use crate::error::{AppError, ResultExt};
    let home = dirs::home_dir().ok_or_else(|| AppError::Internal("无法获取用户主目录".to_string()))?;
    let config_dir = home.join(".aidocplus");
    std::fs::create_dir_all(&config_dir)
        .context("创建配置目录失败")?;
    crate::config::atomic_write(&config_dir.join("ai-services.json"), &json)?;
    Ok(())
}
