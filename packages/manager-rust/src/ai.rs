use crate::types::AIServiceConfig;
use serde_json::json;
use tauri::{Emitter, Window};

/// 构建请求体（与主程序保持一致，使用 json! 宏动态构建）
fn build_request_body(
    config: &AIServiceConfig,
    system_prompt: &str,
    user_prompt: &str,
    stream: bool,
) -> serde_json::Value {
    let mut body = json!({
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_prompt }
        ],
        "model": config.model,
        "temperature": config.temperature as f64,
        "stream": stream
    });
    if config.max_tokens > 0 {
        body["max_tokens"] = json!(config.max_tokens);
    }
    body
}

/// 调用 AI API 生成资源（非流式）
pub async fn ai_generate(
    config: &AIServiceConfig,
    system_prompt: &str,
    user_prompt: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
    let request_body = build_request_body(config, system_prompt, user_prompt, false);

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", config.api_key))
        .body(request_body.to_string())
        .send()
        .await
        .map_err(|e| format!("AI 请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("AI API 返回错误 {}: {}", status, body));
    }

    let resp: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 AI 响应失败: {}", e))?;

    resp.get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "AI 未返回内容".to_string())
}

/// 调用 AI API 生成资源（流式 SSE）
pub async fn ai_generate_stream(
    window: Window,
    config: &AIServiceConfig,
    system_prompt: &str,
    user_prompt: &str,
    event_name: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));
    let request_body = build_request_body(config, system_prompt, user_prompt, true);

    eprintln!("[AI Stream] 请求 URL: {}", url);
    eprintln!("[AI Stream] 模型: {}, max_tokens: {}", config.model, config.max_tokens);
    eprintln!("[AI Stream] 正在发送请求...");

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", config.api_key))
        .body(request_body.to_string())
        .send()
        .await
        .map_err(|e| {
            let err = format!("AI 请求失败: {}", e);
            eprintln!("[AI Stream] {}", err);
            err
        })?;

    eprintln!("[AI Stream] 收到响应，状态码: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let err = format!("AI API 返回错误 {}: {}", status, body);
        eprintln!("[AI Stream] {}", err);
        return Err(err);
    }

    let mut full_content = String::new();
    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;

    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取流失败: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        // 按行处理 SSE 数据
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || !line.starts_with("data: ") {
                continue;
            }

            let data = &line[6..];
            if data == "[DONE]" {
                break;
            }

            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(delta) = parsed
                    .get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("delta"))
                    .and_then(|d| d.get("content"))
                    .and_then(|c| c.as_str())
                {
                    full_content.push_str(delta);
                    let _ = window.emit(
                        event_name,
                        serde_json::json!({
                            "type": "delta",
                            "content": delta
                        }),
                    );
                }
            }
        }
    }

    let _ = window.emit(
        event_name,
        serde_json::json!({
            "type": "done",
            "content": full_content
        }),
    );

    Ok(full_content)
}
