use std::collections::HashMap;
use std::path::PathBuf;

// ── 通用 HTTP 请求命令 ──
// 所有微信 API 调用（直连、云托管、自建代理、第三方服务商）统一走此命令

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
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();

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
        let fp = file_path.as_deref().unwrap();
        let path = PathBuf::from(fp);
        if !path.exists() {
            return Err(format!("文件不存在: {}", fp));
        }

        let fname = file_name
            .clone()
            .or_else(|| {
                path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "file".to_string());

        let file_bytes = tokio::fs::read(&path)
            .await
            .map_err(|e| format!("读取文件失败: {}", e))?;

        let mime = guess_mime(&fname);

        let part = reqwest::multipart::Part::bytes(file_bytes)
            .file_name(fname)
            .mime_str(mime)
            .map_err(|e| format!("构建上传数据失败: {}", e))?;

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
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = resp.status().as_u16();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if status >= 400 {
        return Err(format!(
            "HTTP {} : {}",
            status,
            serde_json::to_string(&body).unwrap_or_default()
        ));
    }

    Ok(body)
}
