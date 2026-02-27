#![allow(unused_assignments, unused_variables)]

use crate::error::Result;
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use std::fs;
use std::io::Read;
use std::path::Path;

/// ZIP 炸弹防护限制
const MAX_UNCOMPRESSED_SIZE: u64 = 100 * 1024 * 1024; // 100MB
const MAX_FILE_COUNT: usize = 1000;
const MAX_SINGLE_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB

/// 导入文件并返回 Markdown 格式的内容
/// 支持：.txt, .md, .csv, .html, .xml, .json, .docx
#[tauri::command]
pub fn import_file(path: String) -> Result<String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        // 纯文本类文件：直接读取
        "txt" | "md" | "markdown" | "json" | "xml" | "csv" | "html" | "htm" | "yaml" | "yml"
        | "toml" | "ini" | "log" | "rst" | "tex" | "rtf" => {
            fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
        }
        // Word 文档
        "docx" => import_docx(&path),
        _ => Err(format!(
            "不支持的文件格式: .{}\n\n支持的格式：txt, md, json, xml, csv, html, yaml, toml, docx",
            ext
        )),
    }
}

/// 解析 DOCX 文件，提取文本内容并转换为 Markdown
fn import_docx(path: &str) -> Result<String> {
    let file = fs::File::open(path).map_err(|e| format!("打开 DOCX 文件失败: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("解压 DOCX 文件失败: {}", e))?;

    // ZIP 炸弹防护：检查文件数量
    if archive.len() > MAX_FILE_COUNT {
        return Err(format!(
            "DOCX 文件包含过多文件 ({} > {})，可能是 ZIP 炸弹攻击",
            archive.len(), MAX_FILE_COUNT
        ));
    }

    // ZIP 炸弹防护：检查总解压大小
    let mut total_uncompressed_size: u64 = 0;
    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(|e| format!("读取 ZIP 条目失败: {}", e))?;
        total_uncompressed_size += file.size();

        if total_uncompressed_size > MAX_UNCOMPRESSED_SIZE {
            return Err(format!(
                "DOCX 文件解压后过大 ({} > {} 字节)，可能是 ZIP 炸弹攻击",
                total_uncompressed_size, MAX_UNCOMPRESSED_SIZE
            ));
        }
    }

    // DOCX 的主要内容在 word/document.xml 中
    let mut xml_content = String::new();
    {
        let doc_xml = archive
            .by_name("word/document.xml")
            .map_err(|e| format!("读取 DOCX 内容失败: {}", e))?;

        // 检查单个文件大小
        if doc_xml.size() > MAX_SINGLE_FILE_SIZE {
            return Err(format!(
                "DOCX 内部文件过大 ({} > {} 字节)，拒绝处理",
                doc_xml.size(), MAX_SINGLE_FILE_SIZE
            ));
        }

        // 限制读取大小，防止内存耗尽
        let mut limited_reader = doc_xml.take(MAX_SINGLE_FILE_SIZE);
        limited_reader
            .read_to_string(&mut xml_content)
            .map_err(|e| format!("读取 XML 内容失败: {}", e))?;
    }

    parse_docx_xml(&xml_content)
}

/// 解析 DOCX 的 XML 内容，转换为 Markdown
fn parse_docx_xml(xml: &str) -> Result<String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut output = String::new();
    let mut current_paragraph = String::new();
    let mut in_paragraph = false;
    let mut in_run = false;
    let mut in_text = false;
    let mut is_bold = false;
    let mut is_italic = false;
    let mut is_heading = false;
    let mut heading_level: u8 = 0;
    let mut in_table = false;
    let mut in_table_row = false;
    let mut table_cells: Vec<String> = Vec::new();
    let mut current_cell = String::new();
    let mut in_table_cell = false;
    let mut is_first_row = true;
    let mut in_hyperlink = false;
    let mut is_list_item = false;
    let mut list_num_id: Option<String> = None;

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let local_name = e.local_name();
                let name = std::str::from_utf8(local_name.as_ref()).unwrap_or("");

                match name {
                    "p" => {
                        in_paragraph = true;
                        current_paragraph.clear();
                        is_bold = false;
                        is_italic = false;
                        is_heading = false;
                        heading_level = 0;
                        is_list_item = false;
                        list_num_id = None;
                    }
                    "r" => {
                        in_run = true;
                    }
                    "t" => {
                        in_text = true;
                    }
                    "b" if in_run || in_paragraph => {
                        // 检查 w:val="0" 的情况（表示不加粗）
                        let is_off = e.attributes().filter_map(|a| a.ok()).any(|a| {
                            std::str::from_utf8(a.key.as_ref()).unwrap_or("") == "val"
                                && std::str::from_utf8(&a.value).unwrap_or("") == "0"
                        });
                        if !is_off {
                            is_bold = true;
                        }
                    }
                    "i" if in_run || in_paragraph => {
                        let is_off = e.attributes().filter_map(|a| a.ok()).any(|a| {
                            std::str::from_utf8(a.key.as_ref()).unwrap_or("") == "val"
                                && std::str::from_utf8(&a.value).unwrap_or("") == "0"
                        });
                        if !is_off {
                            is_italic = true;
                        }
                    }
                    "pStyle" => {
                        // 检测标题样式 Heading1, Heading2, ...
                        for attr in e.attributes().filter_map(|a| a.ok()) {
                            if std::str::from_utf8(attr.key.as_ref()).unwrap_or("") == "val" {
                                let val = std::str::from_utf8(&attr.value).unwrap_or("");
                                if let Some(level_str) = val.strip_prefix("Heading") {
                                    if let Ok(level) = level_str.parse::<u8>() {
                                        is_heading = true;
                                        heading_level = level.min(6);
                                    }
                                }
                                // 中文 Word 模板可能用 "标题 1" 等
                                if val.starts_with("标题") || val.starts_with("heading") {
                                    let digits: String =
                                        val.chars().filter(|c| c.is_ascii_digit()).collect();
                                    if let Ok(level) = digits.parse::<u8>() {
                                        is_heading = true;
                                        heading_level = level.min(6);
                                    }
                                }
                            }
                        }
                    }
                    "numId" => {
                        // 列表项标记
                        for attr in e.attributes().filter_map(|a| a.ok()) {
                            if std::str::from_utf8(attr.key.as_ref()).unwrap_or("") == "val" {
                                let val =
                                    std::str::from_utf8(&attr.value).unwrap_or("0").to_string();
                                if val != "0" {
                                    is_list_item = true;
                                    list_num_id = Some(val);
                                }
                            }
                        }
                    }
                    "tbl" => {
                        in_table = true;
                        is_first_row = true;
                    }
                    "tr" => {
                        in_table_row = true;
                        table_cells.clear();
                    }
                    "tc" => {
                        in_table_cell = true;
                        current_cell.clear();
                    }
                    "hyperlink" => {
                        in_hyperlink = true;
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_text {
                    let text = e.unescape().unwrap_or_default().to_string();
                    if in_table_cell {
                        current_cell.push_str(&text);
                    } else {
                        // 应用格式
                        let formatted = if is_bold && is_italic {
                            format!("***{}***", text)
                        } else if is_bold {
                            format!("**{}**", text)
                        } else if is_italic {
                            format!("*{}*", text)
                        } else {
                            text
                        };
                        current_paragraph.push_str(&formatted);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let local_name = e.local_name();
                let name = std::str::from_utf8(local_name.as_ref()).unwrap_or("");

                match name {
                    "t" => {
                        in_text = false;
                    }
                    "r" => {
                        in_run = false;
                        is_bold = false;
                        is_italic = false;
                    }
                    "p" => {
                        in_paragraph = false;
                        let trimmed = current_paragraph.trim().to_string();

                        if in_table_cell {
                            // 表格单元格内的段落
                            if !current_cell.is_empty() && !trimmed.is_empty() {
                                current_cell.push(' ');
                            }
                            current_cell.push_str(&trimmed);
                        } else if is_heading && heading_level > 0 {
                            let prefix = "#".repeat(heading_level as usize);
                            output.push_str(&format!("{} {}\n\n", prefix, trimmed));
                        } else if is_list_item {
                            output.push_str(&format!("- {}\n", trimmed));
                        } else if !trimmed.is_empty() {
                            output.push_str(&trimmed);
                            output.push_str("\n\n");
                        }

                        current_paragraph.clear();
                    }
                    "tc" => {
                        in_table_cell = false;
                        table_cells.push(current_cell.trim().to_string());
                    }
                    "tr" => {
                        in_table_row = false;
                        if !table_cells.is_empty() {
                            let row = format!("| {} |", table_cells.join(" | "));
                            output.push_str(&row);
                            output.push('\n');

                            // 在第一行后添加分隔行
                            if is_first_row {
                                let sep = format!(
                                    "| {} |",
                                    table_cells
                                        .iter()
                                        .map(|_| "---")
                                        .collect::<Vec<_>>()
                                        .join(" | ")
                                );
                                output.push_str(&sep);
                                output.push('\n');
                                is_first_row = false;
                            }
                        }
                    }
                    "tbl" => {
                        in_table = false;
                        output.push('\n');
                    }
                    "hyperlink" => {
                        in_hyperlink = false;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(format!("解析 DOCX XML 失败: {}", e));
            }
            _ => {}
        }
        buf.clear();
    }

    // 清理多余的空行
    let result = output
        .lines()
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    if result.is_empty() {
        return Err("DOCX 文件内容为空或无法解析".to_string());
    }

    Ok(result)
}
