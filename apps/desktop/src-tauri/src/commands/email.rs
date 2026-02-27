use lettre::message::{header::ContentType, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

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
        .map_err(|e| format!("构建 SMTP 连接失败: {}", e))?;

    transport
        .test_connection()
        .await
        .map_err(|e| format!("SMTP 连接测试失败: {}", e))?;

    Ok(format!("连接成功！SMTP 服务器 {}:{} 验证通过", smtpHost, smtpPort))
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
) -> Result<String, String> {
    if to.is_empty() {
        return Err("收件人不能为空".to_string());
    }

    // 构建发件人
    let from_mailbox: Mailbox = if let Some(ref name) = displayName {
        format!("{} <{}>", name, email)
            .parse()
            .map_err(|e| format!("发件人地址格式错误: {}", e))?
    } else {
        email
            .parse()
            .map_err(|e| format!("发件人地址格式错误: {}", e))?
    };

    let mut builder = Message::builder()
        .from(from_mailbox)
        .subject(&subject);

    // 添加收件人
    for addr in &to {
        let mailbox: Mailbox = addr
            .trim()
            .parse()
            .map_err(|e| format!("收件人地址 '{}' 格式错误: {}", addr, e))?;
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
            .map_err(|e| format!("抄送地址 '{}' 格式错误: {}", addr, e))?;
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
            .map_err(|e| format!("密送地址 '{}' 格式错误: {}", addr, e))?;
        builder = builder.bcc(mailbox);
    }

    // 构建邮件正文
    let raw_html = isRawHtml.unwrap_or(false);
    let message = if raw_html {
        // body 已经是完整 HTML（富文本编辑器输出），包装邮件模板后直接发送
        let html_body = wrap_html_email(&body);
        // 生成纯文本备用版本（简单去标签）
        let plain_text = strip_html_tags(&body);
        builder
            .multipart(
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
                    ),
            )
            .map_err(|e| format!("构建邮件失败: {}", e))?
    } else if isHtml {
        // Markdown → HTML 转换
        let html_body = markdown_to_html(&body);
        builder
            .multipart(
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
                    ),
            )
            .map_err(|e| format!("构建邮件失败: {}", e))?
    } else {
        builder
            .body(body.clone())
            .map_err(|e| format!("构建邮件失败: {}", e))?
    };

    // 发送
    let creds = Credentials::new(email.clone(), password);
    let transport = build_smtp_transport(&smtpHost, smtpPort, &encryption, creds)
        .map_err(|e| format!("构建 SMTP 连接失败: {}", e))?;

    transport
        .send(message)
        .await
        .map_err(|e| format!("发送邮件失败: {}", e))?;

    let recipients: Vec<&str> = to.iter().map(|s| s.as_str()).collect();
    Ok(format!(
        "邮件已成功发送至 {}",
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
                .map_err(|e| format!("TLS 参数错误: {}", e))?;
            Ok(
                AsyncSmtpTransport::<Tokio1Executor>::relay(host)
                    .map_err(|e| format!("SMTP relay 错误: {}", e))?
                    .port(port)
                    .tls(Tls::Wrapper(tls_params))
                    .credentials(creds)
                    .build(),
            )
        }
        "starttls" => {
            let tls_params = TlsParameters::new(host.to_string())
                .map_err(|e| format!("TLS 参数错误: {}", e))?;
            Ok(
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host)
                    .map_err(|e| format!("SMTP STARTTLS relay 错误: {}", e))?
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
    options.render.unsafe_ = true;

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
