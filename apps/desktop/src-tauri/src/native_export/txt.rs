use comrak::{parse_document, Arena, Options};
use comrak::nodes::NodeValue;

/// 将 Markdown 转换为纯文本（去除所有格式标记）
pub fn export_to_txt(markdown: &str) -> Result<String, String> {
    let arena = Arena::new();
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.strikethrough = true;
    options.extension.tasklist = true;

    let root = parse_document(&arena, markdown, &options);
    let mut output = String::new();
    extract_text(root, &mut output);
    Ok(output.trim().to_string())
}

fn extract_text<'a>(node: &'a comrak::nodes::AstNode<'a>, output: &mut String) {
    match &node.data.borrow().value {
        NodeValue::Text(text) => {
            output.push_str(text);
        }
        NodeValue::SoftBreak | NodeValue::LineBreak => {
            output.push('\n');
        }
        NodeValue::Code(code) => {
            output.push_str(&code.literal);
        }
        NodeValue::CodeBlock(cb) => {
            output.push_str(&cb.literal);
            output.push('\n');
        }
        NodeValue::Paragraph => {
            // 段落前后加换行
            if !output.is_empty() && !output.ends_with('\n') {
                output.push('\n');
            }
        }
        NodeValue::Heading(_) => {
            if !output.is_empty() && !output.ends_with('\n') {
                output.push('\n');
            }
        }
        NodeValue::Item(_) => {
            if !output.is_empty() && !output.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("  ");
        }
        NodeValue::ThematicBreak => {
            output.push_str("\n---\n");
        }
        _ => {}
    }

    for child in node.children() {
        extract_text(child, output);
    }

    // 段落和标题结束后加换行
    match &node.data.borrow().value {
        NodeValue::Paragraph | NodeValue::Heading(_) => {
            if !output.ends_with('\n') {
                output.push('\n');
            }
        }
        _ => {}
    }
}
