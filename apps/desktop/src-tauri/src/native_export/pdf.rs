/// PDF 导出模块
/// 生成公文排版 HTML 文件并自动用系统浏览器打开，用户可通过浏览器打印为 PDF
use super::html;

/// 将 Markdown 导出为可打印 PDF 的 HTML 文件
/// 生成的 HTML 包含 @page CSS 规则，浏览器打印时自动应用公文排版
pub fn export_to_pdf(markdown: &str, title: &str, output_path: &str) -> Result<String, String> {
    // 确保输出目录存在
    if let Some(parent) = std::path::Path::new(output_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建输出目录失败: {}", e))?;
    }

    // 生成公文样式 HTML（已包含 @page 打印规则）
    let html_content = html::export_to_html(markdown, title)?;

    // 添加自动打印脚本的 HTML
    let print_html = html_content.replace(
        "</body>",
        r#"<script>
// 页面加载后自动弹出打印对话框，用户可选择"另存为 PDF"
window.onload = function() {
    setTimeout(function() { window.print(); }, 500);
};
</script>
</body>"#
    );

    // 将 HTML 写入 .pdf 旁边的 .html 文件
    let html_path = if output_path.ends_with(".pdf") {
        output_path.replace(".pdf", "_print.html")
    } else {
        format!("{}.html", output_path)
    };

    std::fs::write(&html_path, &print_html)
        .map_err(|e| format!("写入文件失败: {}", e))?;

    // 用系统默认浏览器打开 HTML 文件
    open_in_browser(&html_path);

    Ok(html_path)
}

fn open_in_browser(path: &str) {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(path).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/c", "start", "", path]).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(path).spawn();
    }
}
