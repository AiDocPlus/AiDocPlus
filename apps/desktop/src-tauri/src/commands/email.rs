use lettre::message::header::ContentType;
use lettre::message::{Attachment, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use serde::Deserialize;

/// 附件信息
#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
pub struct AttachmentInfo {
    pub path: String,
    pub filename: String,
    pub mimeType: String,
}

/// 测试 SMTP 连接
#[tauri::command]
#[allow(non_snake_case)]
pub async fn test_smtp_connection(
    smtpHost: String,
    smtpPort: u16,
    encryption: String,
    email: String,
    password: String,
) -> Result<String, String> {
    let creds = Credentials::new(email.clone(), password);

    let transport = build_smtp_transport(&smtpHost, smtpPort, &encryption, creds)
        .map_err(|e| format!("SMTP_BUILD_FAILED: {}", e))?;

    transport
        .test_connection()
        .await
        .map_err(|e| format!("SMTP_TEST_FAILED: {}", e))?;

    Ok(format!("SMTP_TEST_OK: {}:{}", smtpHost, smtpPort))
}

/// 发送邮件
#[tauri::command]
#[allow(non_snake_case)]
pub async fn send_email(
    smtpHost: String,
    smtpPort: u16,
    encryption: String,
    email: String,
    password: String,
    displayName: Option<String>,
    to: Vec<String>,
    cc: Vec<String>,
    bcc: Vec<String>,
    subject: String,
    body: String,
    isHtml: bool,
    isRawHtml: Option<bool>,
    attachments: Option<Vec<AttachmentInfo>>,
) -> Result<String, String> {
    if to.is_empty() {
        return Err("RECIPIENT_EMPTY".to_string());
    }

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
        .from(from_mailbox)
        .subject(&subject);

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
        // body 已经是完整 HTML（富文本编辑器输出），包装邮件模板后直接发送
        let html_body = wrap_html_email(&body);
        // 生成纯文本备用版本（简单去标签）
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
        // Markdown → HTML 转换
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
        // 纯文本模式
        MultiPart::alternative()
            .singlepart(
                SinglePart::builder()
                    .header(ContentType::TEXT_PLAIN)
                    .body(body.clone()),
            )
    };

    // 构建附件
    let attachment_list = attachments.unwrap_or_default();
    let message = if attachment_list.is_empty() {
        builder
            .multipart(content_part)
            .map_err(|e| format!("EMAIL_BUILD_FAILED: {}", e))?
    } else {
        let mut mixed = MultiPart::mixed().multipart(content_part);
        for att in &attachment_list {
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
    let creds = Credentials::new(email.clone(), password);
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

/// 构建 SMTP 传输
fn build_smtp_transport(
    host: &str,
    port: u16,
    encryption: &str,
    creds: Credentials,
) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
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
                    .build(),
            )
        }
        _ => {
            // 无加密
            Ok(
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(host)
                    .port(port)
                    .credentials(creds)
                    .build(),
            )
        }
    }
}

/// 将富文本编辑器输出的 HTML 片段包装为完整的邮件 HTML 模板
fn wrap_html_email(html_fragment: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }}
h1, h2, h3, h4, h5, h6 {{ margin-top: 1em; margin-bottom: 0.5em; }}
table {{ border-collapse: collapse; width: 100%; margin: 1em 0; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
th {{ background-color: #f5f5f5; }}
code {{ background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }}
pre {{ background-color: #f5f5f5; padding: 12px; border-radius: 5px; overflow-x: auto; }}
pre code {{ background: none; padding: 0; }}
blockquote {{ border-left: 4px solid #ddd; margin: 1em 0; padding: 0.5em 1em; color: #666; }}
img {{ max-width: 100%; height: auto; }}
</style>
</head>
<body>
{}
</body>
</html>"#,
        html_fragment
    )
}

/// 简单去除 HTML 标签，生成纯文本备用版本
fn strip_html_tags(html: &str) -> String {
    let re = regex::Regex::new(r"<[^>]+>").unwrap();
    let text = re.replace_all(html, "");
    // 合并多余空行
    let re_lines = regex::Regex::new(r"\n{3,}").unwrap();
    re_lines.replace_all(&text, "\n\n").trim().to_string()
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

    // 包装为完整的 HTML 邮件模板
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }}
h1, h2, h3, h4, h5, h6 {{ margin-top: 1em; margin-bottom: 0.5em; }}
table {{ border-collapse: collapse; width: 100%; margin: 1em 0; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
th {{ background-color: #f5f5f5; }}
code {{ background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }}
pre {{ background-color: #f5f5f5; padding: 12px; border-radius: 5px; overflow-x: auto; }}
pre code {{ background: none; padding: 0; }}
blockquote {{ border-left: 4px solid #ddd; margin: 1em 0; padding: 0.5em 1em; color: #666; }}
img {{ max-width: 100%; }}
</style>
</head>
<body>
{}
</body>
</html>"#,
        html_body
    )
}
