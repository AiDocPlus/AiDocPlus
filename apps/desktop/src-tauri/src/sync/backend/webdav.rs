/**
 * sync/backend/webdav.rs — 坚果云 WebDAV 同步后端（reqwest 0.13 async）
 */
use crate::sync::types::{RemoteFileInfo, SyncBackend};
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use reqwest::header::{HeaderMap, AUTHORIZATION};
use std::fs;
use std::path::PathBuf;

pub struct WebDAVBackend {
    base_url: String,
    username: String,
    password: String,
    remote_dir: String,
    client: reqwest::Client,
}

impl WebDAVBackend {
    pub fn new(base_url: &str, username: &str, password: &str, remote_dir: &str) -> Self {
        let base_url = if base_url.ends_with('/') {
            base_url.to_string()
        } else {
            format!("{}/", base_url)
        };
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .danger_accept_invalid_certs(true)
            .build()
            .expect("reqwest client 创建失败");

        Self {
            base_url,
            username: username.to_string(),
            password: password.to_string(),
            remote_dir: remote_dir.to_string(),
            client,
        }
    }

    fn remote_url(&self, path: &str) -> String {
        let clean = path.trim_start_matches('/');
        if clean.is_empty() {
            format!("{}{}", self.base_url, self.remote_dir)
        } else {
            format!("{}{}/{}", self.base_url, self.remote_dir, clean)
        }
    }

    fn auth_headers(&self) -> HeaderMap {
        let cred = format!("{}:{}", self.username, self.password);
        let encoded = BASE64_STANDARD.encode(cred);
        let auth_val = format!("Basic {}", encoded);
        let mut headers = HeaderMap::new();
        if let Ok(val) = auth_val.parse() {
            headers.insert(AUTHORIZATION, val);
        }
        headers
    }

    async fn mkcol(&self, url: &str) -> Result<(), String> {
        let method = reqwest::Method::from_bytes(b"MKCOL").unwrap();
        let resp = self
            .client
            .request(method, url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| format!("MKCOL 请求失败: {}", e))?;
        let status = resp.status();
        if status == 201 || status == 200 || status == 405 || status == 409 {
            Ok(())
        } else {
            Err(format!("创建目录失败, HTTP {}", status))
        }
    }
}

#[async_trait]
impl SyncBackend for WebDAVBackend {
    async fn test_connection(&self) -> Result<(), String> {
        let url = self.remote_url("");
        let method = reqwest::Method::from_bytes(b"PROPFIND").unwrap();
        let resp = self
            .client
            .request(method, &url)
            .headers(self.auth_headers())
            .header("Depth", "0")
            .send()
            .await
            .map_err(|e| format!("连接失败: {}", e))?;
        match resp.status().as_u16() {
            207 | 200 | 404 => Ok(()),
            401 => Err("认证失败，请检查用户名和应用密码".into()),
            s => Err(format!("连接失败, HTTP {}", s)),
        }
    }

    async fn ensure_remote_dirs(&self, sub_dirs: &[&str]) -> Result<(), String> {
        self.mkcol(&self.remote_url("")).await?;
        for dir in sub_dirs {
            self.mkcol(&self.remote_url(dir)).await?;
        }
        Ok(())
    }

    async fn list_remote_files(&self, prefix: &str) -> Result<Vec<RemoteFileInfo>, String> {
        let url = self.remote_url(prefix);
        let method = reqwest::Method::from_bytes(b"PROPFIND").unwrap();
        let resp = self
            .client
            .request(method, &url)
            .headers(self.auth_headers())
            .header("Depth", "infinity")
            .send()
            .await
            .map_err(|e| format!("PROPFIND 失败: {}", e))?;
        if resp.status().as_u16() == 404 {
            return Ok(Vec::new());
        }
        if resp.status().as_u16() != 207 {
            return Err(format!("列出文件失败, HTTP {}", resp.status()));
        }
        let body = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
        Ok(parse_propfind(&body, &self.remote_dir))
    }

    async fn download_file(&self, remote_path: &str, local_path: &PathBuf) -> Result<(), String> {
        let url = self.remote_url(remote_path);
        let resp = self
            .client
            .get(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| format!("下载失败: {}", e))?;
        if resp.status().as_u16() != 200 {
            return Err(format!("下载失败, HTTP {}", resp.status()));
        }
        let data = resp.bytes().await.map_err(|e| format!("读取响应失败: {}", e))?;
        if let Some(parent) = local_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
        }
        fs::write(local_path, &data).map_err(|e| format!("写入文件失败: {}", e))
    }

    async fn upload_file(&self, local_path: &PathBuf, remote_path: &str) -> Result<(), String> {
        let data = fs::read(local_path).map_err(|e| format!("读取本地文件失败: {}", e))?;

        if let Some(parent) = std::path::Path::new(remote_path).parent() {
            let p_str = parent.to_string_lossy().to_string();
            let p_str = p_str.trim_start_matches('/').trim_end_matches('/');
            if !p_str.is_empty() {
                let parts: Vec<&str> = p_str.split('/').collect();
                let mut cumulative = String::new();
                for part in &parts {
                    if cumulative.is_empty() {
                        cumulative.push_str(part);
                    } else {
                        cumulative.push_str("/");
                        cumulative.push_str(part);
                    }
                    self.mkcol(&self.remote_url(&cumulative)).await?;
                }
            }
        }

        let url = self.remote_url(remote_path);
        let resp = self
            .client
            .put(&url)
            .headers(self.auth_headers())
            .body(data.clone())
            .send()
            .await
            .map_err(|e| format!("上传失败: {}", e))?;

        match resp.status().as_u16() {
            200 | 201 | 204 => Ok(()),
            409 => {
                // 409: 同名集合（目录）已存在（旧版 bug 残留），先删除再重试
                let _ = self.delete_remote_file(remote_path).await;
                let resp = self
                    .client
                    .put(&url)
                    .headers(self.auth_headers())
                    .body(data)
                    .send()
                    .await
                    .map_err(|e| format!("上传重试失败: {}", e))?;
                match resp.status().as_u16() {
                    200 | 201 | 204 => Ok(()),
                    s => Err(format!("上传失败, HTTP {}", s)),
                }
            }
            s => Err(format!("上传失败, HTTP {}", s)),
        }
    }

    async fn delete_remote_file(&self, remote_path: &str) -> Result<(), String> {
        let url = self.remote_url(remote_path);
        let resp = self
            .client
            .delete(&url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| format!("删除失败: {}", e))?;
        match resp.status().as_u16() {
            200 | 204 | 404 => Ok(()),
            s => Err(format!("删除失败, HTTP {}", s)),
        }
    }
}

/// 解析 PROPFIND multistatus XML（使用 quick-xml）
fn parse_propfind(xml: &str, remote_dir: &str) -> Vec<RemoteFileInfo> {
    let mut results = Vec::new();
    let base = format!("{}/", remote_dir);

    let mut reader = Reader::from_str(xml);
    let mut buf = Vec::new();

    let mut in_response = false;
    let mut current_href: Option<String> = None;
    let mut current_mtime: Option<u64> = None;
    let mut current_size: Option<u64> = None;
    let mut capture_text = false;
    let mut text_buf = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let local_name = e.local_name();
                let tag = std::str::from_utf8(local_name.as_ref()).unwrap_or("");

                match tag {
                    "response" => {
                        in_response = true;
                        current_href = None;
                        current_mtime = None;
                        current_size = None;
                    }
                    "href" | "getlastmodified" | "getcontentlength" => {
                        capture_text = true;
                        text_buf.clear();
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) => {
                if capture_text {
                    let text = String::from_utf8_lossy(e.as_ref());
                    text_buf.push_str(&text);
                }
            }
            Ok(Event::End(ref e)) => {
                let local_name = e.local_name();
                let tag = std::str::from_utf8(local_name.as_ref()).unwrap_or("");

                match tag {
                    "href" => {
                        if in_response {
                            let decoded = urlencoding::decode(&text_buf)
                                .unwrap_or_else(|_| text_buf.clone().into())
                                .to_string();
                            current_href = Some(decoded);
                            capture_text = false;
                        }
                    }
                    "getlastmodified" => {
                        current_mtime = parse_http_date(&text_buf);
                        capture_text = false;
                    }
                    "getcontentlength" => {
                        current_size = text_buf.trim().parse().ok();
                        capture_text = false;
                    }
                    "response" => {
                        if let Some(href) = current_href.take() {
                            if let Some(idx) = href.find(&base) {
                                let relative = href[idx + base.len()..].to_string();
                                if !relative.is_empty() && !relative.ends_with('/') {
                                    results.push(RemoteFileInfo {
                                        path: relative,
                                        mtime_ms: current_mtime,
                                        size: current_size,
                                    });
                                }
                            }
                        }
                        in_response = false;
                    }
                    _ => {
                        capture_text = false;
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                eprintln!("[webdav] XML 解析错误: {:?}", e);
                break;
            }
            _ => {}
        }
        buf.clear();
    }

    results
}

fn parse_http_date(s: &str) -> Option<u64> {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() < 5 {
        return None;
    }
    let day: u32 = parts[1].parse().ok()?;
    let year: i32 = parts[3].parse().ok()?;
    let month = month_to_num(parts[2])?;
    let time_parts: Vec<&str> = parts[4].split(':').collect();
    if time_parts.len() != 3 {
        return None;
    }
    let hour: u32 = time_parts[0].parse().ok()?;
    let minute: u32 = time_parts[1].parse().ok()?;
    let second: u32 = time_parts[2].parse().ok()?;

    let date = chrono::NaiveDate::from_ymd_opt(year, month, day)?;
    let time = chrono::NaiveTime::from_hms_opt(hour, minute, second)?;
    let dt = chrono::NaiveDateTime::new(date, time);
    let timestamp = dt.and_utc().timestamp();
    Some(timestamp as u64 * 1000)
}

fn month_to_num(m: &str) -> Option<u32> {
    match m {
        "Jan" => Some(1), "Feb" => Some(2), "Mar" => Some(3),
        "Apr" => Some(4), "May" => Some(5), "Jun" => Some(6),
        "Jul" => Some(7), "Aug" => Some(8), "Sep" => Some(9),
        "Oct" => Some(10), "Nov" => Some(11), "Dec" => Some(12),
        _ => None,
    }
}
