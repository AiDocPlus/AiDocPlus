use comrak::{parse_document, Arena, Options};
use comrak::nodes::{AstNode, NodeValue, NodeHeading, ListType};
use docx_rs::*;
use std::fs::File;
use super::styles;

/// 将 Markdown 转换为符合公文排版标准的 DOCX 文件
pub fn export_to_docx(markdown: &str, output_path: &str) -> crate::error::Result<()> {
    use crate::error::AppError;
    let arena = Arena::new();
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.strikethrough = true;
    options.extension.tasklist = true;
    options.extension.autolink = true;

    let root = parse_document(&arena, markdown, &options);

    let mut docx = Docx::new();

    // 设置页面尺寸 A4 (twip)
    docx = docx.page_size(styles::mm_to_twip(210.0) as u32, styles::mm_to_twip(297.0) as u32);

    // 设置公文标准页边距
    docx = docx.page_margin(
        PageMargin::new()
            .top(styles::mm_to_twip(styles::PAGE_MARGIN_TOP))
            .bottom(styles::mm_to_twip(styles::PAGE_MARGIN_BOTTOM))
            .left(styles::mm_to_twip(styles::PAGE_MARGIN_LEFT))
            .right(styles::mm_to_twip(styles::PAGE_MARGIN_RIGHT))
    );

    // 设置默认字体
    docx = docx.default_fonts(
        RunFonts::new()
            .east_asia(styles::FONT_FANGSONG[0])
            .ascii(styles::FONT_WESTERN)
            .hi_ansi(styles::FONT_WESTERN)
    );

    // 设置默认字号 (3号 = 16pt = 32 half-points)
    docx = docx.default_size(styles::pt_to_half_point(styles::FONT_SIZE_BODY));

    // 设置默认行距 (固定值29pt = 580twip，符合公文标准每页22行)
    docx = docx.default_line_spacing(
        LineSpacing::new()
            .line_rule(LineSpacingType::Exact)
            .line(styles::pt_to_twip(styles::LINE_SPACING_PT))
            .before(0)
            .after(0)
    );

    // 添加页脚页码（公文格式：居中，"— X —"）
    let page_num_run = Run::new()
        .add_field_char(FieldCharType::Begin, false)
        .add_instr_text(InstrText::PAGE(InstrPAGE {}))
        .add_field_char(FieldCharType::Separate, false)
        .add_text("1")
        .add_field_char(FieldCharType::End, false)
        .size(styles::pt_to_half_point(styles::FONT_SIZE_FOOTNOTE))
        .fonts(RunFonts::new()
            .east_asia(styles::FONT_FANGSONG[0])
            .ascii(styles::FONT_WESTERN)
            .hi_ansi(styles::FONT_WESTERN));
    let dash_run_left = Run::new()
        .add_text("— ")
        .size(styles::pt_to_half_point(styles::FONT_SIZE_FOOTNOTE))
        .fonts(RunFonts::new()
            .east_asia(styles::FONT_FANGSONG[0])
            .ascii(styles::FONT_WESTERN)
            .hi_ansi(styles::FONT_WESTERN));
    let dash_run_right = Run::new()
        .add_text(" —")
        .size(styles::pt_to_half_point(styles::FONT_SIZE_FOOTNOTE))
        .fonts(RunFonts::new()
            .east_asia(styles::FONT_FANGSONG[0])
            .ascii(styles::FONT_WESTERN)
            .hi_ansi(styles::FONT_WESTERN));
    let footer_para = Paragraph::new()
        .align(AlignmentType::Center)
        .add_run(dash_run_left)
        .add_run(page_num_run)
        .add_run(dash_run_right);
    let footer = Footer::new().add_paragraph(footer_para);
    docx = docx.footer(footer);

    // 遍历 AST 生成 DOCX 元素
    for child in root.children() {
        process_node(child, &mut docx);
    }

    // 写入文件
    let file = File::create(output_path).map_err(|e| AppError::ExportFailed(format!("创建文件失败: {}", e)))?;
    docx.build().pack(file).map_err(|e| AppError::ExportFailed(format!("生成 DOCX 失败: {}", e)))?;

    Ok(())
}

/// 应用公文标准段落格式：首行缩进2字符 + 固定行距
fn apply_standard_para_style(para: Paragraph) -> Paragraph {
    para.indent(
        Some(0),
        Some(SpecialIndentType::FirstLine(styles::chars_to_twip(styles::FIRST_LINE_INDENT))),
        None,
        None,
    ).line_spacing(
        LineSpacing::new()
            .line_rule(LineSpacingType::Exact)
            .line(styles::pt_to_twip(styles::LINE_SPACING_PT))
            .before(0)
            .after(0)
    )
}

fn process_node<'a>(node: &'a AstNode<'a>, docx: &mut Docx) {
    match &node.data.borrow().value {
        NodeValue::Paragraph => {
            let mut para = apply_standard_para_style(Paragraph::new());
            let runs = collect_inline_runs(node);
            for run in runs {
                para = para.add_run(run);
            }
            *docx = std::mem::take(docx).add_paragraph(para);
        }
        NodeValue::Heading(NodeHeading { level, .. }) => {
            let mut para = if *level == 1 {
                // 一级标题（文件标题）：居中，不缩进，较大行距
                Paragraph::new()
                    .align(AlignmentType::Center)
                    .line_spacing(
                        LineSpacing::new()
                            .line_rule(LineSpacingType::Exact)
                            .line(styles::pt_to_twip(36.0))
                            .before(0)
                            .after(0)
                    )
            } else {
                // 其他标题：首行缩进2字符（公文标准）
                apply_standard_para_style(Paragraph::new())
            };

            let runs = collect_inline_runs(node);
            for run in runs {
                let styled_run = style_heading_run(run, *level);
                para = para.add_run(styled_run);
            }
            *docx = std::mem::take(docx).add_paragraph(para);
        }
        NodeValue::CodeBlock(cb) => {
            // 代码块：用单行单列表格包裹，实现灰色背景效果
            let code_text = cb.literal.to_string();
            let mut paragraphs: Vec<Paragraph> = Vec::new();
            for line in code_text.lines() {
                let run = Run::new()
                    .add_text(line)
                    .fonts(RunFonts::new().ascii("Consolas").east_asia("Consolas").hi_ansi("Consolas"))
                    .size(styles::pt_to_half_point(styles::FONT_SIZE_FOOTNOTE));
                let para = Paragraph::new()
                    .line_spacing(
                        LineSpacing::new()
                            .line_rule(LineSpacingType::Exact)
                            .line(styles::pt_to_twip(14.0))
                            .before(0)
                            .after(0)
                    )
                    .add_run(run);
                paragraphs.push(para);
            }
            // 如果代码块为空，添加一个空段落
            if paragraphs.is_empty() {
                paragraphs.push(Paragraph::new());
            }
            let mut cell = TableCell::new();
            for p in paragraphs {
                cell = cell.add_paragraph(p);
            }
            cell = cell.shading(Shading::new().fill("F5F5F5"));
            let row = TableRow::new(vec![cell]);
            let table = Table::new(vec![row])
                .set_grid(vec![])
                .indent(0);
            *docx = std::mem::take(docx).add_table(table);
        }
        NodeValue::List(list) => {
            process_list(node, docx, list.list_type == ListType::Ordered, list.start as usize, 0);
        }
        NodeValue::BlockQuote => {
            for child in node.children() {
                if let NodeValue::Paragraph = &child.data.borrow().value {
                    let mut para = apply_standard_para_style(Paragraph::new());
                    let runs = collect_inline_runs(child);
                    for run in runs {
                        let run = run.italic();
                        para = para.add_run(run);
                    }
                    *docx = std::mem::take(docx).add_paragraph(para);
                }
            }
        }
        NodeValue::ThematicBreak => {
            // 分隔线 - 用空段落表示
            let para = Paragraph::new();
            *docx = std::mem::take(docx).add_paragraph(para);
        }
        NodeValue::Table(_) => {
            process_table(node, docx);
        }
        _ => {
            // 递归处理其他块级元素
            for child in node.children() {
                process_node(child, docx);
            }
        }
    }
}

/// 收集节点内的所有内联元素为 Run 列表
fn collect_inline_runs<'a>(node: &'a AstNode<'a>) -> Vec<Run> {
    let mut runs = Vec::new();
    collect_inline_runs_recursive(node, &mut runs, false, false, false, false);
    runs
}

fn collect_inline_runs_recursive<'a>(
    node: &'a AstNode<'a>,
    runs: &mut Vec<Run>,
    bold: bool,
    italic: bool,
    code: bool,
    strikethrough: bool,
) {
    for child in node.children() {
        match &child.data.borrow().value {
            NodeValue::Text(text) => {
                let mut run = Run::new()
                    .add_text(text.as_ref())
                    .fonts(RunFonts::new().east_asia(styles::FONT_FANGSONG[0]).ascii(styles::FONT_WESTERN))
                    .size(styles::pt_to_half_point(styles::FONT_SIZE_BODY));
                if bold { run = run.bold(); }
                if italic { run = run.italic(); }
                if strikethrough { run = run.strike(); }
                if code {
                    run = run.fonts(RunFonts::new().ascii("Consolas").east_asia("Consolas").hi_ansi("Consolas"));
                }
                runs.push(run);
            }
            NodeValue::SoftBreak | NodeValue::LineBreak => {
                runs.push(Run::new().add_break(BreakType::TextWrapping));
            }
            NodeValue::Code(c) => {
                let text = c.literal.to_string();
                let run = Run::new()
                    .add_text(&text)
                    .fonts(RunFonts::new().ascii("Consolas").east_asia("Consolas").hi_ansi("Consolas"))
                    .size(styles::pt_to_half_point(styles::FONT_SIZE_BODY));
                runs.push(run);
            }
            NodeValue::Strong => {
                collect_inline_runs_recursive(child, runs, true, italic, code, strikethrough);
            }
            NodeValue::Emph => {
                collect_inline_runs_recursive(child, runs, bold, true, code, strikethrough);
            }
            NodeValue::Strikethrough => {
                collect_inline_runs_recursive(child, runs, bold, italic, code, true);
            }
            NodeValue::Link(link) => {
                // 先输出链接文本，再输出 URL
                collect_inline_runs_recursive(child, runs, bold, italic, code, strikethrough);
                let url = link.url.clone();
                if !url.is_empty() {
                    let url_run = Run::new()
                        .add_text(&format!(" ({})", url))
                        .size(styles::pt_to_half_point(styles::FONT_SIZE_SMALL))
                        .color("0066CC");
                    runs.push(url_run);
                }
            }
            NodeValue::TaskItem(task) => {
                // 任务列表项：添加 ☑/☐ 前缀
                let is_checked = task.symbol == Some('x') || task.symbol == Some('X');
                let check_char = if is_checked { "☑ " } else { "☐ " };
                let check_run = Run::new()
                    .add_text(check_char)
                    .fonts(RunFonts::new().east_asia(styles::FONT_FANGSONG[0]).ascii(styles::FONT_WESTERN))
                    .size(styles::pt_to_half_point(styles::FONT_SIZE_BODY));
                runs.push(check_run);
                // 递归处理子内容
                collect_inline_runs_recursive(child, runs, bold, italic, code, strikethrough);
            }
            _ => {
                collect_inline_runs_recursive(child, runs, bold, italic, code, strikethrough);
            }
        }
    }
}

/// 递归处理列表（支持嵌套列表和任务列表）
fn process_list<'a>(node: &'a AstNode<'a>, docx: &mut Docx, is_ordered: bool, start: usize, depth: u32) {
    let mut index = start;
    let indent_twip = styles::chars_to_twip(styles::FIRST_LINE_INDENT) + (depth as i32) * styles::chars_to_twip(2);

    for item in node.children() {
        // 检查是否为任务列表项
        let task_info = match &item.data.borrow().value {
            NodeValue::TaskItem(t) => Some(t.symbol == Some('x') || t.symbol == Some('X')),
            _ => None,
        };

        let prefix = if let Some(checked) = task_info {
            if checked { "☑ ".to_string() } else { "☐ ".to_string() }
        } else if is_ordered {
            let s = format!("{}. ", index);
            index += 1;
            s
        } else {
            match depth {
                0 => "• ".to_string(),
                1 => "◦ ".to_string(),
                _ => "▪ ".to_string(),
            }
        };

        let mut para = Paragraph::new()
            .indent(Some(indent_twip), None, None, None)
            .line_spacing(
                LineSpacing::new()
                    .line_rule(LineSpacingType::Exact)
                    .line(styles::pt_to_twip(styles::LINE_SPACING_PT))
                    .before(0)
                    .after(0)
            );

        // 添加列表前缀
        let prefix_run = Run::new()
            .add_text(&prefix)
            .fonts(RunFonts::new().east_asia(styles::FONT_FANGSONG[0]).ascii(styles::FONT_WESTERN))
            .size(styles::pt_to_half_point(styles::FONT_SIZE_BODY));
        para = para.add_run(prefix_run);

        // 收集列表项内容，同时递归处理子列表
        for item_child in item.children() {
            match &item_child.data.borrow().value {
                NodeValue::Paragraph => {
                    let runs = collect_inline_runs(item_child);
                    for run in runs {
                        para = para.add_run(run);
                    }
                }
                NodeValue::List(sub_list) => {
                    // 先输出当前项的段落
                    *docx = std::mem::take(docx).add_paragraph(para);
                    // 递归处理子列表
                    process_list(item_child, docx, sub_list.list_type == ListType::Ordered, sub_list.start as usize, depth + 1);
                    // 创建新的空段落（后续不再添加 run）
                    para = Paragraph::new();
                    // 标记不需要再输出
                    continue;
                }
                _ => {}
            }
        }
        // 如果段落非空则输出（跳过子列表处理后的空段落）
        *docx = std::mem::take(docx).add_paragraph(para);
    }
}

/// 处理表格
fn process_table<'a>(node: &'a AstNode<'a>, docx: &mut Docx) {
    let mut rows: Vec<TableRow> = Vec::new();
    let mut is_header = true;

    for child in node.children() {
        match &child.data.borrow().value {
            NodeValue::TableRow(_) => {
                let mut cells: Vec<TableCell> = Vec::new();
                for cell_node in child.children() {
                    if let NodeValue::TableCell = &cell_node.data.borrow().value {
                        let mut para = Paragraph::new();
                        let inline_runs = collect_inline_runs(cell_node);
                        for mut run in inline_runs {
                            run = run.size(styles::pt_to_half_point(styles::FONT_SIZE_SMALL));
                            if is_header {
                                run = run.bold();
                            }
                            para = para.add_run(run);
                        }
                        let cell = TableCell::new().add_paragraph(para);
                        cells.push(cell);
                    }
                }
                let row = TableRow::new(cells);
                rows.push(row);
                is_header = false;
            }
            _ => {}
        }
    }

    if !rows.is_empty() {
        let table = Table::new(rows)
            .set_grid(vec![])
            .indent(0);
        *docx = std::mem::take(docx).add_table(table);
    }
}

/// 为标题 Run 设置公文标准字体样式
fn style_heading_run(run: Run, level: u8) -> Run {
    match level {
        1 => {
            // 文件标题: 2号宋体加粗居中
            run.fonts(RunFonts::new().east_asia(styles::FONT_SONGTI[0]).ascii(styles::FONT_WESTERN))
                .size(styles::pt_to_half_point(styles::FONT_SIZE_TITLE))
                .bold()
        }
        2 => {
            // 一级标题: 3号黑体
            run.fonts(RunFonts::new().east_asia(styles::FONT_HEITI[0]).ascii(styles::FONT_WESTERN))
                .size(styles::pt_to_half_point(styles::FONT_SIZE_BODY))
        }
        3 => {
            // 二级标题: 3号楷体
            run.fonts(RunFonts::new().east_asia(styles::FONT_KAITI[0]).ascii(styles::FONT_WESTERN))
                .size(styles::pt_to_half_point(styles::FONT_SIZE_BODY))
        }
        4 => {
            // 三级标题: 3号仿宋加粗
            run.fonts(RunFonts::new().east_asia(styles::FONT_FANGSONG[0]).ascii(styles::FONT_WESTERN))
                .size(styles::pt_to_half_point(styles::FONT_SIZE_BODY))
                .bold()
        }
        _ => {
            // 四级及以下: 3号仿宋
            run.fonts(RunFonts::new().east_asia(styles::FONT_FANGSONG[0]).ascii(styles::FONT_WESTERN))
                .size(styles::pt_to_half_point(styles::FONT_SIZE_BODY))
        }
    }
}
