/// PDF 导出模块
/// 生成公文排版 HTML 文件，供 Tauri WebviewWindow 内嵌预览并打印为 PDF
use super::html;

/// 将 Markdown 导出为可打印的 HTML 文件
/// 返回生成的 HTML 文件路径，由调用方决定如何打开（应用内预览窗口或外部浏览器）
pub fn export_to_pdf(markdown: &str, title: &str, output_path: &str) -> crate::error::Result<String> {
    use crate::error::AppError;
    // 确保输出目录存在
    if let Some(parent) = std::path::Path::new(output_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::ExportFailed(format!("创建输出目录失败: {}", e)))?;
    }

    // 生成公文样式 HTML（已包含 @page 打印规则）
    let html_content = html::export_to_html(markdown, title)?;

    // 添加打印工具栏 + 自动打印脚本
    let print_html = html_content.replace(
        "</body>",
        r#"<div id="print-toolbar" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#f0f0f0;border-bottom:1px solid #ccc;padding:8px 16px;display:flex;align-items:center;gap:12px;font-family:'Microsoft YaHei','PingFang SC',sans-serif;font-size:14px;">
    <button onclick="window.print()" style="background:#1677ff;color:#fff;border:none;border-radius:4px;padding:6px 16px;cursor:pointer;font-size:14px;">🖨️ 打印 / 另存为 PDF</button>
    <span style="color:#666;">提示：在打印对话框中选择「另存为 PDF」即可导出 PDF 文件</span>
</div>
<div style="height:48px;"></div>
<style>
@media print { #print-toolbar { display: none !important; } body { margin-top: 0 !important; } div[style*="height:48px"] { display: none !important; } }
</style>
</body>"#
    );

    // 将 HTML 写入 .pdf 旁边的 .html 文件
    let html_path = if output_path.ends_with(".pdf") {
        output_path.replace(".pdf", "_print.html")
    } else {
        format!("{}.html", output_path)
    };

    std::fs::write(&html_path, &print_html)
        .map_err(|e| AppError::ExportFailed(format!("写入文件失败: {}", e)))?;

    Ok(html_path)
}
