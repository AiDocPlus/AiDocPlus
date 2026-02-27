use comrak::{markdown_to_html, Options};
use super::styles;

/// 将 Markdown 转换为带公文样式的完整 HTML 文档
pub fn export_to_html(markdown: &str, title: &str) -> Result<String, String> {
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.strikethrough = true;
    options.extension.tasklist = true;
    options.extension.autolink = true;
    options.render.unsafe_ = true;

    let html_body = markdown_to_html(markdown, &options);
    let css = styles::get_html_css();

    let full_html = format!(
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>{css}</style>
</head>
<body>
{html_body}
</body>
</html>"#,
        title = html_escape(title),
        css = css,
        html_body = html_body
    );

    Ok(full_html)
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
