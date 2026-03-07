use lettre::message::header::{ContentType, Header, HeaderName, HeaderValue};
use lettre::message::{Attachment, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use serde::Deserialize;
use std::time::Duration;

/// X-Priority 邮件头
#[derive(Clone, Debug)]
struct XPriority(String);

impl Header for XPriority {
    fn name() -> HeaderName {
        HeaderName::new_from_ascii_str("X-Priority")
    }
    fn parse(s: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(XPriority(s.to_string()))
    }
    fn display(&self) -> HeaderValue {
        HeaderValue::dangerous_new_pre_encoded(Self::name(), self.0.clone(), self.0.clone())
    }
}

/// Importance 邮件头
#[derive(Clone, Debug)]
struct ImportanceHeader(String);

impl Header for ImportanceHeader {
    fn name() -> HeaderName {
        HeaderName::new_from_ascii_str("Importance")
    }
    fn parse(s: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(ImportanceHeader(s.to_string()))
    }
    fn display(&self) -> HeaderValue {
        HeaderValue::dangerous_new_pre_encoded(Self::name(), self.0.clone(), self.0.clone())
    }
}

/// 自定义 Disposition-Notification-To 头（已读回执）
#[derive(Clone, Debug)]
struct DispositionNotificationTo(String);

impl Header for DispositionNotificationTo {
    fn name() -> HeaderName {
        HeaderName::new_from_ascii_str("Disposition-Notification-To")
    }

    fn parse(s: &str) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(DispositionNotificationTo(s.to_string()))
    }

    fn display(&self) -> HeaderValue {
        HeaderValue::dangerous_new_pre_encoded(
            Self::name(),
            self.0.clone(),
            self.0.clone(),
        )
    }
}

/// keyring 服务名常量
const KEYRING_SERVICE: &str = "com.aidocplus.email";

/// SMTP 超时（秒）
const SMTP_TIMEOUT_SECS: u64 = 30;

/// 共享 HTML 邮件 CSS 样式
const EMAIL_CSS: &str = r#"body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
h1, h2, h3, h4, h5, h6 { margin-top: 1em; margin-bottom: 0.5em; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background-color: #f5f5f5; }
code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
pre { background-color: #f5f5f5; padding: 12px; border-radius: 5px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding: 0.5em 1em; color: #666; }
img { max-width: 100%; height: auto; }"#;

/// 附件信息
#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
pub struct AttachmentInfo {
    pub path: String,
    pub filename: String,
    pub mimeType: String,
}

// ── 凭证管理命令（Phase 1.1: 密钥链安全存储） ──

/// 存储邮箱密码到 OS 密钥链
#[tauri::command]
#[allow(non_snake_case)]
pub fn store_email_credential(accountId: String, password: String) -> Result<String, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &accountId)
        .map_err(|e| format!("KEYRING_INIT_FAILED: {}", e))?;
    entry
        .set_password(&password)
        .map_err(|e| format!("KEYRING_STORE_FAILED: {}", e))?;
    Ok("CREDENTIAL_STORED".to_string())
}

/// 从 OS 密钥链删除邮箱密码
#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_email_credential(accountId: String) -> Result<String, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &accountId)
        .map_err(|e| format!("KEYRING_INIT_FAILED: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok("CREDENTIAL_DELETED".to_string()),
        Err(keyring::Error::NoEntry) => Ok("CREDENTIAL_NOT_FOUND".to_string()),
        Err(e) => Err(format!("KEYRING_DELETE_FAILED: {}", e)),
    }
}

/// 从 OS 密钥链读取邮箱密码（内部使用）
fn get_credential(account_id: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, account_id)
        .map_err(|e| format!("KEYRING_INIT_FAILED: {}", e))?;
    entry
        .get_password()
        .map_err(|e| format!("KEYRING_GET_FAILED: {}", e))
}

/// 测试 SMTP 连接
/// 支持两种模式：
/// - 传 password：直接使用（账户编辑/新建时测试）
/// - 传 accountId + 不传 password：从密钥链获取
#[tauri::command]
#[allow(non_snake_case)]
pub async fn test_smtp_connection(
    smtpHost: String,
    smtpPort: u16,
    encryption: String,
    email: String,
    password: Option<String>,
    accountId: Option<String>,
) -> Result<String, String> {
    let pwd = resolve_password(password, accountId.as_deref())?;
    let creds = Credentials::new(email.clone(), pwd);

    let transport = build_smtp_transport(&smtpHost, smtpPort, &encryption, creds)
        .map_err(|e| format!("SMTP_BUILD_FAILED: {}", e))?;

    transport
        .test_connection()
        .await
        .map_err(|e| format!("SMTP_TEST_FAILED: {}", e))?;

    Ok(format!("SMTP_TEST_OK: {}:{}", smtpHost, smtpPort))
}

/// 发送邮件
/// 支持两种模式：
/// - 传 password：直接使用（向后兼容）
/// - 传 accountId + 不传 password：从密钥链获取（推荐）
#[tauri::command]
#[allow(non_snake_case)]
pub async fn send_email(
    smtpHost: String,
    smtpPort: u16,
    encryption: String,
    email: String,
    password: Option<String>,
    accountId: Option<String>,
    displayName: Option<String>,
    replyTo: Option<String>,
    to: Vec<String>,
    cc: Vec<String>,
    bcc: Vec<String>,
    subject: String,
    body: String,
    isHtml: bool,
    isRawHtml: Option<bool>,
    attachments: Option<Vec<AttachmentInfo>>,
    requestReadReceipt: Option<bool>,
    priority: Option<String>,
) -> Result<String, String> {
    if to.is_empty() {
        return Err("RECIPIENT_EMPTY".to_string());
    }

    let pwd = resolve_password(password, accountId.as_deref())?;

    // 构建发件人
    let from_mailbox: Mailbox = if let Some(ref name) = displayName {
        format!("{} <{}>", name, email)
            .parse()
            .map_err(|e| format!("SENDER_FORMAT_ERROR: {}", e))?
    } else {
        email
            .parse()
            .map_err(|e| format!("SENDER_FORMAT_ERROR: {}", e))?
    };

    let mut builder = Message::builder()
        .from(from_mailbox.clone())
        .subject(&subject);

    // 已读回执（Phase 4.2）
    if requestReadReceipt.unwrap_or(false) {
        builder = builder.header(DispositionNotificationTo(from_mailbox.to_string()));
    }

    // 邮件优先级（X-Priority + Importance）
    if let Some(ref p) = priority {
        let (x_priority, importance) = match p.as_str() {
            "high" => ("1", "High"),
            "low" => ("5", "Low"),
            _ => ("3", "Normal"),
        };
        builder = builder
            .header(XPriority(x_priority.to_string()))
            .header(ImportanceHeader(importance.to_string()));
    }

    // Reply-To 头（Phase 4.2）
    if let Some(ref reply_to_addr) = replyTo {
        let trimmed = reply_to_addr.trim();
        if !trimmed.is_empty() {
            let reply_mailbox: Mailbox = trimmed
                .parse()
                .map_err(|e| format!("REPLY_TO_FORMAT_ERROR: {} - {}", trimmed, e))?;
            builder = builder.reply_to(reply_mailbox);
        }
    }

    // 添加收件人
    for addr in &to {
        let mailbox: Mailbox = addr
            .trim()
            .parse()
            .map_err(|e| format!("RECIPIENT_FORMAT_ERROR: {} - {}", addr, e))?;
        builder = builder.to(mailbox);
    }

    // 添加抄送
    for addr in &cc {
        let trimmed = addr.trim();
        if trimmed.is_empty() {
            continue;
        }
        let mailbox: Mailbox = trimmed
            .parse()
            .map_err(|e| format!("CC_FORMAT_ERROR: {} - {}", addr, e))?;
        builder = builder.cc(mailbox);
    }

    // 添加密送
    for addr in &bcc {
        let trimmed = addr.trim();
        if trimmed.is_empty() {
            continue;
        }
        let mailbox: Mailbox = trimmed
            .parse()
            .map_err(|e| format!("BCC_FORMAT_ERROR: {} - {}", addr, e))?;
        builder = builder.bcc(mailbox);
    }

    // 构建邮件正文
    let raw_html = isRawHtml.unwrap_or(false);
    let content_part = if raw_html {
        let html_body = wrap_html_email(&body);
        let plain_text = strip_html_tags(&body);
        MultiPart::alternative()
            .singlepart(
                SinglePart::builder()
                    .header(ContentType::TEXT_PLAIN)
                    .body(plain_text),
            )
            .singlepart(
                SinglePart::builder()
                    .header(ContentType::TEXT_HTML)
                    .body(html_body),
            )
    } else if isHtml {
        let html_body = markdown_to_html(&body);
        MultiPart::alternative()
            .singlepart(
                SinglePart::builder()
                    .header(ContentType::TEXT_PLAIN)
                    .body(body.clone()),
            )
            .singlepart(
                SinglePart::builder()
                    .header(ContentType::TEXT_HTML)
                    .body(html_body),
            )
    } else {
        MultiPart::alternative()
            .singlepart(
                SinglePart::builder()
                    .header(ContentType::TEXT_PLAIN)
                    .body(body.clone()),
            )
    };

    // 构建附件（含路径安全校验 Phase 1.3）
    let attachment_list = attachments.unwrap_or_default();
    let message = if attachment_list.is_empty() {
        builder
            .multipart(content_part)
            .map_err(|e| format!("EMAIL_BUILD_FAILED: {}", e))?
    } else {
        let mut mixed = MultiPart::mixed().multipart(content_part);
        for att in &attachment_list {
            validate_attachment_path(&att.path)?;
            let file_content = std::fs::read(&att.path)
                .map_err(|e| format!("ATTACHMENT_READ_FAILED: {} - {}", att.filename, e))?;
            let ct: ContentType = att.mimeType.parse().unwrap_or(ContentType::TEXT_PLAIN);
            let attachment_part = Attachment::new(att.filename.clone()).body(file_content, ct);
            mixed = mixed.singlepart(attachment_part);
        }
        builder
            .multipart(mixed)
            .map_err(|e| format!("EMAIL_BUILD_FAILED: {}", e))?
    };

    // 发送
    let creds = Credentials::new(email.clone(), pwd);
    let transport = build_smtp_transport(&smtpHost, smtpPort, &encryption, creds)
        .map_err(|e| format!("SMTP_BUILD_FAILED: {}", e))?;

    transport
        .send(message)
        .await
        .map_err(|e| format!("SEND_FAILED: {}", e))?;

    let recipients: Vec<&str> = to.iter().map(|s| s.as_str()).collect();
    Ok(format!(
        "SEND_OK: {}",
        recipients.join(", ")
    ))
}

// ── 内部工具函数 ──

/// 解析密码：优先使用传入的 password，否则从密钥链通过 accountId 获取
fn resolve_password(password: Option<String>, account_id: Option<&str>) -> Result<String, String> {
    if let Some(pwd) = password {
        if !pwd.is_empty() {
            return Ok(pwd);
        }
    }
    if let Some(id) = account_id {
        return get_credential(id);
    }
    Err("PASSWORD_REQUIRED: 需要提供密码或有效的 accountId".to_string())
}

/// 附件路径安全校验（Phase 1.3）
/// 只允许访问用户主目录下的文件和系统临时目录
fn validate_attachment_path(path: &str) -> Result<(), String> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|e| format!("ATTACHMENT_PATH_INVALID: {} - {}", path, e))?;
    let canonical_str = canonical.to_string_lossy();

    // 允许用户主目录
    if let Some(home) = dirs::home_dir() {
        if canonical.starts_with(&home) {
            return Ok(());
        }
    }

    // 允许系统临时目录
    let temp_dir = std::env::temp_dir();
    if canonical.starts_with(&temp_dir) {
        return Ok(());
    }

    Err(format!(
        "ATTACHMENT_PATH_FORBIDDEN: 附件路径不在允许的目录范围内: {}",
        canonical_str
    ))
}

/// 构建 SMTP 传输（含超时设置 Phase 1.4）
fn build_smtp_transport(
    host: &str,
    port: u16,
    encryption: &str,
    creds: Credentials,
) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
    let timeout = Duration::from_secs(SMTP_TIMEOUT_SECS);
    match encryption {
        "tls" => {
            let tls_params = TlsParameters::new(host.to_string())
                .map_err(|e| format!("TLS_PARAM_ERROR: {}", e))?;
            Ok(
                AsyncSmtpTransport::<Tokio1Executor>::relay(host)
                    .map_err(|e| format!("SMTP_RELAY_ERROR: {}", e))?
                    .port(port)
                    .tls(Tls::Wrapper(tls_params))
                    .credentials(creds)
                    .timeout(Some(timeout))
                    .build(),
            )
        }
        "starttls" => {
            let tls_params = TlsParameters::new(host.to_string())
                .map_err(|e| format!("TLS_PARAM_ERROR: {}", e))?;
            Ok(
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host)
                    .map_err(|e| format!("SMTP_STARTTLS_RELAY_ERROR: {}", e))?
                    .port(port)
                    .tls(Tls::Required(tls_params))
                    .credentials(creds)
                    .timeout(Some(timeout))
                    .build(),
            )
        }
        _ => {
            Ok(
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(host)
                    .port(port)
                    .credentials(creds)
                    .timeout(Some(timeout))
                    .build(),
            )
        }
    }
}

/// 将 HTML 片段包装为完整的邮件 HTML 模板（使用共享 CSS）
fn wrap_html_email(html_fragment: &str) -> String {
    format!(
        "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<style>\n{}\n</style>\n</head>\n<body>\n{}\n</body>\n</html>",
        EMAIL_CSS, html_fragment
    )
}

/// 去除 HTML 标签，生成结构化纯文本备用版本（Phase 4.5 改进）
fn strip_html_tags(html: &str) -> String {
    // 块级标签前后加换行
    let block_re = regex::Regex::new(r"(?i)</(p|div|h[1-6]|li|tr|blockquote|pre)>").unwrap();
    let text = block_re.replace_all(html, "\n");
    // <br> 标签转换行
    let br_re = regex::Regex::new(r"(?i)<br\s*/?>").unwrap();
    let text = br_re.replace_all(&text, "\n");
    // <hr> 转分隔线
    let hr_re = regex::Regex::new(r"(?i)<hr\s*/?>").unwrap();
    let text = hr_re.replace_all(&text, "\n---\n");
    // 去除所有剩余标签
    let tag_re = regex::Regex::new(r"<[^>]+>").unwrap();
    let text = tag_re.replace_all(&text, "");
    // HTML 实体解码
    let text = text
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ");
    // 合并多余空行
    let lines_re = regex::Regex::new(r"\n{3,}").unwrap();
    lines_re.replace_all(&text, "\n\n").trim().to_string()
}

/// 使用 comrak 将 Markdown 转换为 HTML
fn markdown_to_html(markdown: &str) -> String {
    use comrak::{markdown_to_html as comrak_md2html, Options};
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.strikethrough = true;
    options.extension.tasklist = true;
    options.extension.autolink = true;
    options.render.r#unsafe = true;

    let html_body = comrak_md2html(markdown, &options);
    wrap_html_email(&html_body)
}
