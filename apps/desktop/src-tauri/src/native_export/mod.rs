pub mod styles;
pub mod html;
pub mod txt;
pub mod docx;
pub mod pdf;

use std::fs;
use std::path::Path;

/// 原生导出入口
pub fn export_native(
    markdown: &str,
    title: &str,
    output_path: &str,
    format: &str,
) -> Result<String, String> {
    // 确保输出目录存在
    if let Some(parent) = Path::new(output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建输出目录失败: {}", e))?;
    }

    match format {
        "md" => {
            fs::write(output_path, markdown).map_err(|e| format!("写入文件失败: {}", e))?;
            Ok(output_path.to_string())
        }
        "html" => {
            let html_content = html::export_to_html(markdown, title)?;
            fs::write(output_path, html_content).map_err(|e| format!("写入文件失败: {}", e))?;
            Ok(output_path.to_string())
        }
        "docx" => {
            docx::export_to_docx(markdown, output_path)?;
            Ok(output_path.to_string())
        }
        "pdf" => {
            pdf::export_to_pdf(markdown, title, output_path)
        }
        "txt" => {
            let text = txt::export_to_txt(markdown)?;
            fs::write(output_path, text).map_err(|e| format!("写入文件失败: {}", e))?;
            Ok(output_path.to_string())
        }
        _ => Err(format!("不支持的导出格式: {}", format)),
    }
}
