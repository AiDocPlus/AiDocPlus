use crate::ai::{AIConfig, ChatMessage, OpenAIResponse};
use crate::error::AppError;
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
    let client = reqwest::Client::new();

    let mut request_body = json!({
        "messages": messages,
        "model": config.get_default_model(),
        "temperature": temperature.unwrap_or(0.7),
        "stream": false
    });

    if let Some(mt) = max_tokens {
        request_body["max_tokens"] = json!(mt);
    }

    // 智谱 GLM 联网搜索工具（由前端控制是否启用）
    if enable_web_search.unwrap_or(false) && (config.provider == "glm" || config.provider == "glm-code") {
        request_body["tools"] = json!([{
            "type": "web_search",
            "web_search": {
                "enable": true,
                "search_engine": "search_pro"
            }
        }]);
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
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", config.get_base_url());

    let mut request_body = json!({
        "messages": messages,
        "model": config.get_default_model(),
        "temperature": 0.7,
        "stream": true
    });

    // 智谱 GLM 联网搜索工具（由前端控制是否启用）
    if enable_web_search.unwrap_or(false) && (config.provider == "glm" || config.provider == "glm-code") {
        request_body["tools"] = json!([{
            "type": "web_search",
            "web_search": {
                "enable": true,
                "search_engine": "search_pro"
            }
        }]);
    }

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
        return Err(AppError::AIError(format!(
            "Stream failed with status: {}",
            response.status()
        )));
    }

    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;

    let mut full_content = String::new();
    let mut buffer = Vec::new();

    while let Some(chunk_result) = stream.next().await {
        // 检查是否被前端取消（使用 request_id 查询）
        if is_stream_cancelled(&req_id) {
            break;
        }

        let chunk = chunk_result
            .map_err(|e| AppError::AIError(format!("Stream error: {}", e)))?;

        // Buffer 大小限制，防止内存耗尽
        if buffer.len() + chunk.len() > MAX_BUFFER_SIZE {
            return Err(AppError::AIError("Response too large, exceeded buffer limit".to_string()));
        }

        buffer.extend_from_slice(&chunk);

        // Process SSE lines
        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line_bytes: Vec<u8> = buffer.drain(..=pos).collect();
            // 去掉行尾的 \n 和可能的 \r
            let line_str = String::from_utf8_lossy(&line_bytes);
            let line_str = line_str.trim_end_matches('\n').trim_end_matches('\r');

            if line_str.is_empty() {
                continue;
            }

            if let Some(data) = line_str.strip_prefix("data: ") {
                if data == "[DONE]" {
                    continue;
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = json
                        .get("choices")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("delta"))
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                    {
                        // 再次检查取消标志，避免在处理 buffer 期间被取消后仍发送事件
                        if is_stream_cancelled(&req_id) {
                            break;
                        }
                        full_content.push_str(content);

                        // Emit event to frontend with request_id
                        let _ = window.emit("ai:stream:chunk", json!({
                            "request_id": req_id,
                            "content": content
                        }));
                    }
                }
            }
        }
    }

    Ok(full_content)
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

    chat_stream(app, messages, provider, api_key, model, base_url, window, enable_web_search, request_id).await
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
