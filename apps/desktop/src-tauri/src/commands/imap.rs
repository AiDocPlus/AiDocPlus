// ── IMAP 收件后端（Phase 6） ──

use async_imap::Session;
use futures_util::TryStreamExt;
use mailparse::{parse_mail, MailHeaderMap};
use native_tls::TlsConnector;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::net::TcpStream;
use tokio_native_tls::TlsStream;

/// 邮件摘要（收件箱列表项）
#[derive(Debug, Serialize, Clone)]
#[allow(non_snake_case)]
pub struct EmailSummary {
    pub uid: u32,
    pub messageId: String,
    pub subject: String,
    pub fromName: String,
    pub fromEmail: String,
    pub date: String,
    pub isRead: bool,
    pub hasAttachment: bool,
    pub preview: String,
}

/// 邮件正文（详情）
#[derive(Debug, Serialize)]
#[allow(non_snake_case)]
pub struct EmailDetail {
    pub uid: u32,
    pub messageId: String,
    pub subject: String,
    pub fromName: String,
    pub fromEmail: String,
    pub toList: Vec<String>,
    pub ccList: Vec<String>,
    pub date: String,
    pub textBody: String,
    pub htmlBody: String,
    pub isRead: bool,
    pub attachments: Vec<AttachmentSummary>,
}

/// 附件摘要
#[derive(Debug, Serialize)]
#[allow(non_snake_case)]
pub struct AttachmentSummary {
    pub filename: String,
    pub mimeType: String,
    pub size: usize,
}

/// 邮箱文件夹信息
#[derive(Debug, Serialize)]
pub struct MailboxInfo {
    pub name: String,
    pub delimiter: String,
    pub flags: Vec<String>,
    pub exists: u32,
    pub unseen: u32,
}

/// IMAP 连接参数
#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
pub struct ImapParams {
    pub host: String,
    pub port: u16,
    pub email: String,
    pub password: Option<String>,
    pub accountId: Option<String>,
    #[allow(dead_code)]
    pub encryption: Option<String>,
}

const KEYRING_SERVICE: &str = "com.aidocplus.email";

fn get_imap_password(params: &ImapParams) -> crate::error::Result<String> {
    if let Some(ref pwd) = params.password {
        if !pwd.is_empty() {
            return Ok(pwd.clone());
        }
    }
    if let Some(ref id) = params.accountId {
        use crate::error::ResultExt;
        let entry = keyring::Entry::new(KEYRING_SERVICE, id)
            .context("KEYRING_INIT_FAILED")?;
        return entry.get_password().context("KEYRING_GET_FAILED");
    }
    Err(crate::error::AppError::ValidationError(
        "IMAP_PASSWORD_REQUIRED".to_string(),
    ))
}

type ImapSession = Session<TlsStream<TcpStream>>;

async fn connect_imap_tls(
    host: &str,
    port: u16,
    email: &str,
    password: &str,
) -> crate::error::Result<ImapSession> {
    use crate::error::AppError;

    let tls_connector = TlsConnector::builder()
        .build()
        .map_err(|e| AppError::ExternalToolError(format!("TLS_BUILD_FAILED: {}", e)))?;
    let tokio_connector = tokio_native_tls::TlsConnector::from(tls_connector);

    let addr = format!("{}:{}", host, port);
    let tcp = TcpStream::connect(&addr)
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_CONNECT_FAILED: {}", e)))?;

    let tls_stream = tokio_connector
        .connect(host, tcp)
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_TLS_FAILED: {}", e)))?;

    let client = async_imap::Client::new(tls_stream);
    let session = client
        .login(email, password)
        .await
        .map_err(|(e, _)| AppError::ExternalToolError(format!("IMAP_LOGIN_FAILED: {}", e)))?;

    Ok(session)
}

/// 获取邮箱文件夹列表
#[tauri::command]
#[allow(non_snake_case)]
pub async fn imap_list_mailboxes(params: ImapParams) -> crate::error::Result<Vec<MailboxInfo>> {
    use crate::error::AppError;
    let pwd = get_imap_password(&params)?;
    let mut session = connect_imap_tls(&params.host, params.port, &params.email, &pwd).await?;

    let mailboxes = session
        .list(Some(""), Some("*"))
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_LIST_FAILED: {}", e)))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_LIST_COLLECT_FAILED: {}", e)))?;

    let mut result = Vec::new();
    for mb in &mailboxes {
        let name = mb.name().to_string();
        let delimiter = mb.delimiter().unwrap_or("/").to_string();
        let flags: Vec<String> = mb.attributes().iter().map(|f| format!("{:?}", f)).collect();
        result.push(MailboxInfo {
            name,
            delimiter,
            flags,
            exists: 0,
            unseen: 0,
        });
    }

    let _ = session.logout().await;
    Ok(result)
}

/// 获取收件箱邮件列表（最近 N 封）
#[tauri::command]
#[allow(non_snake_case)]
pub async fn imap_fetch_inbox(
    params: ImapParams,
    mailbox: Option<String>,
    limit: Option<u32>,
) -> crate::error::Result<Vec<EmailSummary>> {
    use crate::error::AppError;
    let pwd = get_imap_password(&params)?;
    let mut session = connect_imap_tls(&params.host, params.port, &params.email, &pwd).await?;

    let folder = mailbox.unwrap_or_else(|| "INBOX".to_string());
    let mailbox_data = session
        .select(&folder)
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_SELECT_FAILED: {}", e)))?;

    let total = mailbox_data.exists;
    if total == 0 {
        let _ = session.logout().await;
        return Ok(vec![]);
    }

    let n = limit.unwrap_or(50).min(total);
    let start = if total > n { total - n + 1 } else { 1 };
    let sequence = format!("{}:{}", start, total);

    let messages = session
        .fetch(&sequence, "(UID FLAGS RFC822.HEADER BODY.PEEK[TEXT]<0.512>)")
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_FETCH_FAILED: {}", e)))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_FETCH_COLLECT_FAILED: {}", e)))?;

    let mut summaries: Vec<EmailSummary> = Vec::new();
    for msg in messages.iter().rev() {
        let uid = msg.uid.unwrap_or(msg.message);
        let mut flags = msg.flags();
        let is_read = flags.any(|f| matches!(f, async_imap::types::Flag::Seen));

        let header_bytes = msg.header().unwrap_or_default();
        let parsed = match parse_mail(header_bytes) {
            Ok(p) => p,
            Err(_) => continue,
        };

        let subject = parsed
            .headers
            .get_first_value("Subject")
            .unwrap_or_default();
        let from_raw = parsed.headers.get_first_value("From").unwrap_or_default();
        let (from_name, from_email) = parse_from(&from_raw);
        let date = parsed.headers.get_first_value("Date").unwrap_or_default();
        let message_id = parsed
            .headers
            .get_first_value("Message-ID")
            .unwrap_or_default();

        let body_bytes = msg.text().unwrap_or_default();
        let preview = String::from_utf8_lossy(body_bytes)
            .chars()
            .take(200)
            .collect::<String>()
            .replace('\r', "");

        summaries.push(EmailSummary {
            uid,
            messageId: message_id,
            subject: decode_mime_header(&subject),
            fromName: from_name,
            fromEmail: from_email,
            date,
            isRead: is_read,
            hasAttachment: false,
            preview: preview.trim().to_string(),
        });
    }

    let _ = session.logout().await;
    Ok(summaries)
}

/// 获取单封邮件详情
#[tauri::command]
#[allow(non_snake_case)]
pub async fn imap_fetch_email(
    params: ImapParams,
    mailbox: Option<String>,
    uid: u32,
) -> crate::error::Result<EmailDetail> {
    use crate::error::AppError;
    let pwd = get_imap_password(&params)?;
    let mut session = connect_imap_tls(&params.host, params.port, &params.email, &pwd).await?;

    let folder = mailbox.unwrap_or_else(|| "INBOX".to_string());
    session
        .select(&folder)
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_SELECT_FAILED: {}", e)))?;

    let messages = session
        .uid_fetch(uid.to_string(), "RFC822")
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_UID_FETCH_FAILED: {}", e)))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_UID_FETCH_COLLECT_FAILED: {}", e)))?;

    let msg = messages
        .first()
        .ok_or_else(|| AppError::DocumentNotFound(format!("邮件 UID {} 不存在", uid)))?;

    let raw = msg.body().unwrap_or_default();
    let parsed = parse_mail(raw)
        .map_err(|e| AppError::ExternalToolError(format!("MAIL_PARSE_FAILED: {}", e)))?;

    let subject = parsed.headers.get_first_value("Subject").unwrap_or_default();
    let from_raw = parsed.headers.get_first_value("From").unwrap_or_default();
    let (from_name, from_email) = parse_from(&from_raw);
    let date = parsed.headers.get_first_value("Date").unwrap_or_default();
    let message_id = parsed
        .headers
        .get_first_value("Message-ID")
        .unwrap_or_default();
    let to_raw = parsed.headers.get_first_value("To").unwrap_or_default();
    let cc_raw = parsed.headers.get_first_value("Cc").unwrap_or_default();

    let is_read = msg.flags().any(|f| matches!(f, async_imap::types::Flag::Seen));

    let (text_body, html_body, attachments) = extract_parts(&parsed);

    let to_list: Vec<String> = to_raw
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    let cc_list: Vec<String> = cc_raw
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // 标记为已读
    let _ = session
        .uid_store(uid.to_string(), "+FLAGS (\\Seen)")
        .await;

    let _ = session.logout().await;

    Ok(EmailDetail {
        uid,
        messageId: message_id,
        subject: decode_mime_header(&subject),
        fromName: from_name,
        fromEmail: from_email,
        toList: to_list,
        ccList: cc_list,
        date,
        textBody: text_body,
        htmlBody: html_body,
        isRead: is_read,
        attachments,
    })
}

/// 标记邮件已读/未读
#[tauri::command]
#[allow(non_snake_case)]
pub async fn imap_mark_read(
    params: ImapParams,
    mailbox: Option<String>,
    uid: u32,
    read: bool,
) -> crate::error::Result<String> {
    use crate::error::AppError;
    let pwd = get_imap_password(&params)?;
    let mut session = connect_imap_tls(&params.host, params.port, &params.email, &pwd).await?;

    let folder = mailbox.unwrap_or_else(|| "INBOX".to_string());
    session
        .select(&folder)
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_SELECT_FAILED: {}", e)))?;

    let flag_cmd = if read {
        "+FLAGS (\\Seen)"
    } else {
        "-FLAGS (\\Seen)"
    };

    session
        .uid_store(uid.to_string(), flag_cmd)
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_STORE_FAILED: {}", e)))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_STORE_COLLECT_FAILED: {}", e)))?;

    let _ = session.logout().await;
    Ok(format!("MARK_OK: uid={} read={}", uid, read))
}

/// 删除邮件（标记 \\Deleted 后 EXPUNGE）
#[tauri::command]
#[allow(non_snake_case)]
pub async fn imap_delete_email(
    params: ImapParams,
    mailbox: Option<String>,
    uid: u32,
) -> crate::error::Result<String> {
    use crate::error::AppError;
    let pwd = get_imap_password(&params)?;
    let mut session = connect_imap_tls(&params.host, params.port, &params.email, &pwd).await?;

    let folder = mailbox.unwrap_or_else(|| "INBOX".to_string());
    session
        .select(&folder)
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_SELECT_FAILED: {}", e)))?;

    session
        .uid_store(uid.to_string(), "+FLAGS (\\Deleted)")
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_STORE_FAILED: {}", e)))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_STORE_COLLECT_FAILED: {}", e)))?;

    session
        .expunge()
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_EXPUNGE_FAILED: {}", e)))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_EXPUNGE_COLLECT_FAILED: {}", e)))?;

    let _ = session.logout().await;
    Ok(format!("DELETE_OK: uid={}", uid))
}

/// 搜索邮件（关键词全文搜索）
#[tauri::command]
#[allow(non_snake_case)]
pub async fn imap_search(
    params: ImapParams,
    mailbox: Option<String>,
    query: String,
) -> crate::error::Result<Vec<u32>> {
    use crate::error::AppError;
    let pwd = get_imap_password(&params)?;
    let mut session = connect_imap_tls(&params.host, params.port, &params.email, &pwd).await?;

    let folder = mailbox.unwrap_or_else(|| "INBOX".to_string());
    session
        .select(&folder)
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_SELECT_FAILED: {}", e)))?;

    let criteria = format!("TEXT \"{}\"", query.replace('"', "\\\""));
    let uids = session
        .uid_search(criteria)
        .await
        .map_err(|e| AppError::ExternalToolError(format!("IMAP_SEARCH_FAILED: {}", e)))?;

    let _ = session.logout().await;
    let mut uid_list: Vec<u32> = uids.into_iter().collect();
    uid_list.sort_unstable_by(|a, b| b.cmp(a));
    uid_list.truncate(100);
    Ok(uid_list)
}

/// 获取多个邮箱未读数
#[tauri::command]
#[allow(non_snake_case)]
pub async fn imap_get_status(
    params: ImapParams,
    mailboxes: Vec<String>,
) -> crate::error::Result<HashMap<String, u32>> {
    let pwd = get_imap_password(&params)?;
    let mut session = connect_imap_tls(&params.host, params.port, &params.email, &pwd).await?;

    let mut result = HashMap::new();
    for mb in &mailboxes {
        if let Ok(status) = session.status(mb, "(UNSEEN)").await {
            result.insert(mb.clone(), status.unseen.unwrap_or(0));
        }
    }

    let _ = session.logout().await;
    Ok(result)
}

// ── 内部工具函数 ──

fn parse_from(raw: &str) -> (String, String) {
    let raw = raw.trim();
    if raw.contains('<') {
        let email = raw
            .split('<')
            .nth(1)
            .unwrap_or("")
            .trim_end_matches('>')
            .trim()
            .to_string();
        let name = raw
            .split('<')
            .next()
            .unwrap_or("")
            .trim()
            .trim_matches('"')
            .to_string();
        let name = decode_mime_header(&name);
        (name, email)
    } else {
        (String::new(), raw.to_string())
    }
}

fn decode_mime_header(s: &str) -> String {
    if !s.contains("=?") {
        return s.to_string();
    }
    // 简单 fallback：去除编码标记，保留可读文本
    let re = regex::Regex::new(r"=\?[^?]+\?[BQbq]\?([^?]*)\?=").unwrap();
    let decoded = re.replace_all(s, |caps: &regex::Captures| {
        let encoded = &caps[1];
        // Base64 解码尝试
        if let Ok(bytes) = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded) {
            String::from_utf8(bytes).unwrap_or_else(|_| encoded.to_string())
        } else {
            encoded.to_string()
        }
    });
    decoded.into_owned()
}

fn extract_parts(
    parsed: &mailparse::ParsedMail<'_>,
) -> (String, String, Vec<AttachmentSummary>) {
    let mut text_body = String::new();
    let mut html_body = String::new();
    let mut attachments = Vec::new();

    collect_parts(parsed, &mut text_body, &mut html_body, &mut attachments);

    (text_body, html_body, attachments)
}

fn collect_parts(
    mail: &mailparse::ParsedMail<'_>,
    text: &mut String,
    html: &mut String,
    attachments: &mut Vec<AttachmentSummary>,
) {
    let ct = mail.ctype.mimetype.to_lowercase();
    if mail.subparts.is_empty() {
        let disposition = mail
            .headers
            .get_first_value("Content-Disposition")
            .unwrap_or_default()
            .to_lowercase();
        if disposition.starts_with("attachment") {
            let disp_raw = mail
                .headers
                .get_first_value("Content-Disposition")
                .unwrap_or_default();
            let filename = extract_param(&disp_raw, "filename")
                .unwrap_or_else(|| "未知附件".to_string());
            let body = mail.get_body_raw().unwrap_or_default();
            attachments.push(AttachmentSummary {
                filename,
                mimeType: ct.clone(),
                size: body.len(),
            });
        } else if ct == "text/html" {
            if let Ok(body) = mail.get_body() {
                *html = body;
            }
        } else if ct.starts_with("text/") {
            if let Ok(body) = mail.get_body() {
                *text = body;
            }
        }
    } else {
        for sub in &mail.subparts {
            collect_parts(sub, text, html, attachments);
        }
    }
}

fn extract_param(header_val: &str, param: &str) -> Option<String> {
    for part in header_val.split(';') {
        let part = part.trim();
        if part.to_lowercase().starts_with(param) {
            if let Some(val) = part.split('=').nth(1) {
                return Some(val.trim().trim_matches('"').to_string());
            }
        }
    }
    None
}
