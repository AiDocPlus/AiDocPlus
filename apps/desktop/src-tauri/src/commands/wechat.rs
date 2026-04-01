use std::collections::HashMap;

// ── 通用 HTTP 请求命令 ──
// 所有微信 API 调用（直连、云托管、自建代理、第三方服务商）统一走此命令

/// 上传文件最大大小（20 MB）
const MAX_UPLOAD_FILE_SIZE: usize = 20 * 1024 * 1024;
/// 响应体最大大小（10 MB）
const MAX_RESPONSE_BODY_SIZE: usize = 10 * 1024 * 1024;

fn guess_mime(name: &str) -> &'static str {
    if name.ends_with(".png") {
        "image/png"
    } else if name.ends_with(".gif") {
        "image/gif"
    } else if name.ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg"
    }
}

#[tauri::command]
pub async fn wechat_http_request(
    url: String,
    method: String,
    headers: Option<HashMap<String, String>>,
    json_body: Option<serde_json::Value>,
    file_field: Option<String>,
    file_path: Option<String>,
    file_name: Option<String>,
    extra_form: Option<HashMap<String, String>>,
) -> crate::error::Result<serde_json::Value> {
    use crate::error::{AppError, ResultExt};

    // SSRF 防护：校验 URL 不得指向内网
    crate::security::validate_url_not_private(&url, "wechat_http_request")?;

    // 构建客户端（禁用重定向到内网）
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let is_multipart = file_field.is_some() && file_path.is_some();

    let mut builder = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => client.post(&url),
    };

    if let Some(ref h) = headers {
        for (k, v) in h {
            builder = builder.header(k.as_str(), v.as_str());
        }
    }

    if is_multipart {
        let fp = file_path.as_deref()
            .ok_or_else(|| AppError::ValidationError("multipart 请求需要 file_path".into()))?;

        // 路径安全：验证 file_path 在允许的目录内（防止任意文件读取）
        let safe_path = crate::security::validate_path_allowed(
            std::path::Path::new(fp), "file_path"
        )?;

        let fname = file_name
            .clone()
            .or_else(|| {
                safe_path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "file".to_string());

        // 读取文件内容并检查大小
        let metadata = tokio::fs::metadata(&safe_path)
            .await
            .context("读取文件元数据失败")?;
        let file_size = metadata.len() as usize;
        if file_size > MAX_UPLOAD_FILE_SIZE {
            return Err(AppError::ValidationError(format!(
                "上传文件过大（{} > {} 字节）",
                file_size, MAX_UPLOAD_FILE_SIZE
            )));
        }

        let file_bytes = tokio::fs::read(&safe_path)
            .await
            .context("读取文件失败")?;

        let mime = guess_mime(&fname);

        let part = reqwest::multipart::Part::bytes(file_bytes)
            .file_name(fname)
            .mime_str(mime)
            .context("构建上传数据失败")?;

        let field_name = file_field.unwrap_or_else(|| "media".to_string());
        let mut form = reqwest::multipart::Form::new().part(field_name, part);

        if let Some(ref ef) = extra_form {
            for (k, v) in ef {
                form = form.text(k.clone(), v.clone());
            }
        }

        builder = builder.multipart(form);
    } else if let Some(ref body) = json_body {
        builder = builder
            .header("Content-Type", "application/json")
            .json(body);
    }

    let resp = builder
        .send()
        .await
        .map_err(|e| AppError::ExternalToolError(format!("请求失败: {}", e)))?;

    let status = resp.status().as_u16();

    // 限制响应体大小，防止内存耗尽
    let body_bytes = resp.bytes().await.map_err(|e| {
        AppError::ExternalToolError(format!("读取响应失败: {}", e))
    })?;
    if body_bytes.len() > MAX_RESPONSE_BODY_SIZE {
        return Err(AppError::SecurityError(format!(
            "响应体过大（{} > {} 字节），可能存在内存耗尽攻击",
            body_bytes.len(), MAX_RESPONSE_BODY_SIZE
        )));
    }

    let body: serde_json::Value = serde_json::from_slice(&body_bytes)
        .context("解析响应 JSON 失败")?;

    if status >= 400 {
        return Err(AppError::ExternalToolError(format!(
            "HTTP {} : {}",
            status,
            serde_json::to_string(&body).unwrap_or_default()
        )));
    }

    Ok(body)
}
