//! Pandoc 导出功能测试
//!
//! 这是一个简单的集成测试，用于验证 Pandoc 导出功能

use std::fs;
use std::path::PathBuf;

fn main() {
    println!("Pandoc 导出功能测试\n====================");

    // 创建测试文档内容
    let test_content = r#"
# 测试文档标题

这是一段中文测试内容，用于验证 Pandoc 导出功能。

## 功能测试

- PDF 导出（使用 XeLaTeX 引擎）
- DOCX 导出
- HTML 导出
- EPUB 导出

### 中文字体支持

此测试使用 STHeiti 字体进行中文渲染。

## 表格测试

| 格式 | 支持情况 | 说明 |
|------|----------|------|
| PDF | ✅ | 支持 CJK 字体 |
| DOCX | ✅ | 原生支持 |
| HTML | ✅ | UTF-8 编码 |
| EPUB | ✅ | 电子书格式 |

## 代码测试

```
这是代码块
用于验证格式是否正确保留
```
"#;

    // 创建临时目录
    let temp_dir = std::env::temp_dir().join("pandoc_test");
    fs::create_dir_all(&temp_dir).expect("无法创建临时目录");

    // 写入测试 Markdown 文件
    let md_path = temp_dir.join("test.md");
    fs::write(&md_path, test_content).expect("无法写入测试文件");
    println!("✅ 创建测试文件: {}", md_path.display());

    // 测试各种格式
    let formats = vec![
        ("html", "html"),
        ("docx", "docx"),
        ("epub", "epub"),
        ("latex", "tex"),
    ];

    for (format, ext) in &formats {
        let output_path = temp_dir.join(format!("test.{ext}"));

        println!("\n测试 {} 导出...", format.to_uppercase());

        // 构建 pandoc 命令
        let result = std::process::Command::new("pandoc")
            .arg("-f")
            .arg("markdown")
            .arg("-t")
            .arg(format)
            .arg("-o")
            .arg(&output_path)
            .arg(&md_path)
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    let size = fs::metadata(&output_path).unwrap().len();
                    println!("✅ {} 导出成功 (大小: {} bytes)", format.to_uppercase(), size);
                } else {
                    println!("❌ {} 导出失败: {}", format.to_uppercase(),
                           String::from_utf8_lossy(&output.stderr));
                }
            }
            Err(e) => {
                println!("❌ {} 导出错误: {}", format.to_uppercase(), e);
            }
        }
    }

    // 测试 PDF 导出（需要中文字体支持）
    println!("\n测试 PDF 导出（使用 STHeiti 字体）...");
    let pdf_path = temp_dir.join("test.pdf");

    let result = std::process::Command::new("pandoc")
        .arg("-f")
        .arg("markdown")
        .arg("-o")
        .arg(&pdf_path)
        .arg("--pdf-engine=xelatex")
        .arg("-V")
        .arg("CJKmainfont=STHeiti")
        .arg(&md_path)
        .output();

    match result {
        Ok(output) => {
            if output.status.success() {
                let size = fs::metadata(&pdf_path).unwrap().len();
                println!("✅ PDF 导出成功 (大小: {} bytes)", size);
            } else {
                println!("❌ PDF 导出失败: {}",
                       String::from_utf8_lossy(&output.stderr));
            }
        }
        Err(e) => {
            println!("❌ PDF 导出错误: {}", e);
        }
    }

    println!("\n====================");
    println!("测试文件保存在: {}", temp_dir.display());
}
