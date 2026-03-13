use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// 工具定义（OpenAI Function Calling 格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: FunctionDefinition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

/// 工具调用请求（AI 返回的）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: Option<String>,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

/// 工具执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool_call_id: String,
    pub role: String,
    pub content: String,
}

/// 快捷创建工具定义
fn tool(name: &str, description: &str, parameters: Value) -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDefinition {
            name: name.to_string(),
            description: description.to_string(),
            parameters,
        },
    }
}

/// 获取所有内置工具的定义（OpenAI tools 格式）
pub fn get_builtin_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        // ── 文档搜索与读取 ──
        tool("search_documents", "搜索项目中的文档，返回匹配的文档标题和摘要", json!({
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "搜索关键词" }
            },
            "required": ["query"]
        })),
        tool("read_document", "读取指定文档的完整内容", json!({
            "type": "object",
            "properties": {
                "document_id": { "type": "string", "description": "文档 ID" }
            },
            "required": ["document_id"]
        })),
        tool("get_document_stats", "获取当前项目的文档统计信息，包括文档数量、总字数等", json!({
            "type": "object",
            "properties": {},
            "required": []
        })),

        // ── 文档编辑 ──
        tool("update_document", "更新指定文档的内容（全量替换）", json!({
            "type": "object",
            "properties": {
                "document_id": { "type": "string", "description": "文档 ID" },
                "content": { "type": "string", "description": "新的文档内容（Markdown 格式）" }
            },
            "required": ["document_id", "content"]
        })),
        tool("update_document_title", "修改文档标题", json!({
            "type": "object",
            "properties": {
                "document_id": { "type": "string", "description": "文档 ID" },
                "title": { "type": "string", "description": "新标题" }
            },
            "required": ["document_id", "title"]
        })),
        tool("append_to_document", "在文档末尾追加内容", json!({
            "type": "object",
            "properties": {
                "document_id": { "type": "string", "description": "文档 ID" },
                "content": { "type": "string", "description": "要追加的内容（Markdown 格式）" }
            },
            "required": ["document_id", "content"]
        })),
        tool("create_document", "在当前项目中创建新文档", json!({
            "type": "object",
            "properties": {
                "title": { "type": "string", "description": "文档标题" },
                "content": { "type": "string", "description": "文档初始内容（可选）" }
            },
            "required": ["title"]
        })),

        // ── 项目信息 ──
        tool("list_projects", "列出所有可用的项目", json!({
            "type": "object",
            "properties": {},
            "required": []
        })),
        tool("list_documents", "列出当前项目中的所有文档", json!({
            "type": "object",
            "properties": {},
            "required": []
        })),

        // ── 文档导出 ──
        tool("export_document", "将文档导出为指定格式", json!({
            "type": "object",
            "properties": {
                "document_id": { "type": "string", "description": "文档 ID" },
                "format": { "type": "string", "enum": ["markdown", "html", "txt"], "description": "导出格式" }
            },
            "required": ["document_id", "format"]
        })),

        // ── 模板 ──
        tool("list_templates", "列出可用的提示词模板", json!({
            "type": "object",
            "properties": {
                "category": { "type": "string", "description": "模板分类（可选，不填则列出所有分类）" }
            },
            "required": []
        })),
        tool("get_template_content", "获取指定模板的内容", json!({
            "type": "object",
            "properties": {
                "template_id": { "type": "string", "description": "模板 ID" }
            },
            "required": ["template_id"]
        })),

        // ── 文档分析 ──
        tool("get_document_outline", "获取文档的标题大纲结构", json!({
            "type": "object",
            "properties": {
                "document_id": { "type": "string", "description": "文档 ID" }
            },
            "required": ["document_id"]
        })),
        tool("count_words", "统计指定文档的字数、段落数、行数", json!({
            "type": "object",
            "properties": {
                "document_id": { "type": "string", "description": "文档 ID" }
            },
            "required": ["document_id"]
        })),
    ]
}

/// 执行内置工具调用
pub fn execute_tool(tool_call: &ToolCall, project_documents: &[Value]) -> ToolResult {
    let args = &tool_call.function.arguments;
    let result_content = match tool_call.function.name.as_str() {
        "search_documents" => execute_search_documents(args, project_documents),
        "read_document" => execute_read_document(args, project_documents),
        "get_document_stats" => execute_get_document_stats(project_documents),
        "update_document" => execute_update_document(args, project_documents),
        "update_document_title" => execute_update_document_title(args, project_documents),
        "append_to_document" => execute_append_to_document(args, project_documents),
        "create_document" => execute_create_document(args),
        "list_projects" => execute_list_projects(),
        "list_documents" => execute_list_documents(project_documents),
        "export_document" => execute_export_document(args, project_documents),
        "list_templates" => execute_list_templates(args),
        "get_template_content" => execute_get_template_content(args),
        "get_document_outline" => execute_get_document_outline(args, project_documents),
        "count_words" => execute_count_words(args, project_documents),
        _ => json!({ "error": format!("未知工具: {}", tool_call.function.name) }).to_string(),
    };

    ToolResult {
        tool_call_id: tool_call.id.clone(),
        role: "tool".to_string(),
        content: result_content,
    }
}

fn execute_search_documents(arguments: &str, documents: &[Value]) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let query = args.get("query").and_then(|q| q.as_str()).unwrap_or("");

    if query.is_empty() {
        return json!({ "results": [], "message": "搜索关键词为空" }).to_string();
    }

    let query_lower = query.to_lowercase();
    let mut results: Vec<Value> = Vec::new();

    for doc in documents {
        let title = doc.get("title").and_then(|t| t.as_str()).unwrap_or("");
        let content = doc.get("content").and_then(|c| c.as_str()).unwrap_or("");
        let id = doc.get("id").and_then(|i| i.as_str()).unwrap_or("");

        if title.to_lowercase().contains(&query_lower) || content.to_lowercase().contains(&query_lower) {
            // 截取匹配位置附近的摘要（使用字符级操作，安全处理多字节字符）
            let snippet = {
                let content_chars: Vec<char> = content.chars().collect();
                let content_lower_chars: Vec<char> = content.to_lowercase().chars().collect();
                let query_chars: Vec<char> = query_lower.chars().collect();
                let char_pos = content_lower_chars.windows(query_chars.len())
                    .position(|w| w == query_chars.as_slice());
                if let Some(pos) = char_pos {
                    let start = pos.saturating_sub(50);
                    let end = (pos + query_chars.len() + 50).min(content_chars.len());
                    content_chars[start..end].iter().collect::<String>()
                } else {
                    content_chars.iter().take(100).collect::<String>()
                }
            };

            results.push(json!({
                "id": id,
                "title": title,
                "snippet": snippet
            }));

            if results.len() >= 10 {
                break;
            }
        }
    }

    json!({ "results": results, "total": results.len() }).to_string()
}

fn execute_read_document(arguments: &str, documents: &[Value]) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let doc_id = args.get("document_id").and_then(|d| d.as_str()).unwrap_or("");

    if doc_id.is_empty() {
        return json!({ "error": "文档 ID 为空" }).to_string();
    }

    for doc in documents {
        let id = doc.get("id").and_then(|i| i.as_str()).unwrap_or("");
        if id == doc_id {
            let title = doc.get("title").and_then(|t| t.as_str()).unwrap_or("");
            let content = doc.get("content").and_then(|c| c.as_str()).unwrap_or("");
            return json!({
                "id": id,
                "title": title,
                "content": content,
                "char_count": content.len()
            }).to_string();
        }
    }

    json!({ "error": format!("未找到文档: {}", doc_id) }).to_string()
}

fn execute_get_document_stats(documents: &[Value]) -> String {
    let total_docs = documents.len();
    let total_chars: usize = documents.iter()
        .filter_map(|d| d.get("content").and_then(|c| c.as_str()))
        .map(|c| c.len())
        .sum();

    let doc_list: Vec<Value> = documents.iter()
        .filter_map(|d| {
            let id = d.get("id").and_then(|i| i.as_str())?;
            let title = d.get("title").and_then(|t| t.as_str())?;
            let content = d.get("content").and_then(|c| c.as_str()).unwrap_or("");
            Some(json!({
                "id": id,
                "title": title,
                "char_count": content.len()
            }))
        })
        .collect();

    json!({
        "total_documents": total_docs,
        "total_characters": total_chars,
        "documents": doc_list
    }).to_string()
}

// ── 新增工具执行函数 ──

fn execute_update_document(arguments: &str, documents: &[Value]) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let doc_id = args.get("document_id").and_then(|d| d.as_str()).unwrap_or("");
    let new_content = args.get("content").and_then(|c| c.as_str()).unwrap_or("");

    if doc_id.is_empty() {
        return json!({ "error": "文档 ID 为空" }).to_string();
    }

    for doc in documents {
        let id = doc.get("id").and_then(|i| i.as_str()).unwrap_or("");
        if id == doc_id {
            let title = doc.get("title").and_then(|t| t.as_str()).unwrap_or("");
            return json!({
                "success": true,
                "document_id": doc_id,
                "title": title,
                "new_content_length": new_content.len(),
                "note": "内容已准备好，需要通过前端 ApiBridge 写入编辑器"
            }).to_string();
        }
    }

    json!({ "error": format!("未找到文档: {}", doc_id) }).to_string()
}

fn execute_update_document_title(arguments: &str, documents: &[Value]) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let doc_id = args.get("document_id").and_then(|d| d.as_str()).unwrap_or("");
    let new_title = args.get("title").and_then(|t| t.as_str()).unwrap_or("");

    if doc_id.is_empty() || new_title.is_empty() {
        return json!({ "error": "文档 ID 或新标题为空" }).to_string();
    }

    for doc in documents {
        let id = doc.get("id").and_then(|i| i.as_str()).unwrap_or("");
        if id == doc_id {
            return json!({
                "success": true,
                "document_id": doc_id,
                "new_title": new_title,
                "note": "标题更新需要通过前端 ApiBridge 执行"
            }).to_string();
        }
    }

    json!({ "error": format!("未找到文档: {}", doc_id) }).to_string()
}

fn execute_append_to_document(arguments: &str, documents: &[Value]) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let doc_id = args.get("document_id").and_then(|d| d.as_str()).unwrap_or("");
    let content = args.get("content").and_then(|c| c.as_str()).unwrap_or("");

    if doc_id.is_empty() {
        return json!({ "error": "文档 ID 为空" }).to_string();
    }

    for doc in documents {
        let id = doc.get("id").and_then(|i| i.as_str()).unwrap_or("");
        if id == doc_id {
            let existing = doc.get("content").and_then(|c| c.as_str()).unwrap_or("");
            return json!({
                "success": true,
                "document_id": doc_id,
                "original_length": existing.len(),
                "appended_length": content.len(),
                "note": "追加操作需要通过前端 ApiBridge 执行"
            }).to_string();
        }
    }

    json!({ "error": format!("未找到文档: {}", doc_id) }).to_string()
}

fn execute_create_document(arguments: &str) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let title = args.get("title").and_then(|t| t.as_str()).unwrap_or("未命名文档");
    let content = args.get("content").and_then(|c| c.as_str()).unwrap_or("");

    json!({
        "success": true,
        "title": title,
        "content_length": content.len(),
        "note": "创建操作需要通过前端 ApiBridge 执行"
    }).to_string()
}

fn execute_list_projects() -> String {
    let projects_dir = crate::config::current_data_root().join("Projects");

    if !projects_dir.exists() {
        return json!({ "projects": [], "total": 0 }).to_string();
    }

    let mut projects = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(proj) = serde_json::from_str::<Value>(&content) {
                        projects.push(json!({
                            "id": proj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                            "name": proj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                        }));
                    }
                }
            }
        }
    }

    json!({ "projects": projects, "total": projects.len() }).to_string()
}

fn execute_list_documents(documents: &[Value]) -> String {
    let doc_list: Vec<Value> = documents.iter()
        .filter_map(|d| {
            let id = d.get("id").and_then(|i| i.as_str())?;
            let title = d.get("title").and_then(|t| t.as_str())?;
            let content = d.get("content").and_then(|c| c.as_str()).unwrap_or("");
            Some(json!({
                "id": id,
                "title": title,
                "char_count": content.chars().count(),
                "word_count": content.split_whitespace().count()
            }))
        })
        .collect();

    json!({ "documents": doc_list, "total": doc_list.len() }).to_string()
}

fn execute_export_document(arguments: &str, documents: &[Value]) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let doc_id = args.get("document_id").and_then(|d| d.as_str()).unwrap_or("");
    let format = args.get("format").and_then(|f| f.as_str()).unwrap_or("markdown");

    if doc_id.is_empty() {
        return json!({ "error": "文档 ID 为空" }).to_string();
    }

    for doc in documents {
        let id = doc.get("id").and_then(|i| i.as_str()).unwrap_or("");
        if id == doc_id {
            let title = doc.get("title").and_then(|t| t.as_str()).unwrap_or("");
            let content = doc.get("content").and_then(|c| c.as_str()).unwrap_or("");

            let exported = match format {
                "html" => {
                    let html = comrak::markdown_to_html(content, &comrak::Options::default());
                    json!({
                        "format": "html",
                        "title": title,
                        "content": html
                    })
                }
                "txt" => {
                    json!({
                        "format": "txt",
                        "title": title,
                        "content": content
                    })
                }
                _ => {
                    json!({
                        "format": "markdown",
                        "title": title,
                        "content": content
                    })
                }
            };
            return exported.to_string();
        }
    }

    json!({ "error": format!("未找到文档: {}", doc_id) }).to_string()
}

fn execute_list_templates(arguments: &str) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let _category = args.get("category").and_then(|c| c.as_str());

    json!({
        "note": "模板列表功能将在后续阶段完善，需要通过 template 模块集成"
    }).to_string()
}

fn execute_get_template_content(arguments: &str) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let _template_id = args.get("template_id").and_then(|t| t.as_str()).unwrap_or("");

    json!({
        "note": "模板内容获取功能将在后续阶段完善，需要通过 template 模块集成"
    }).to_string()
}

fn execute_get_document_outline(arguments: &str, documents: &[Value]) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let doc_id = args.get("document_id").and_then(|d| d.as_str()).unwrap_or("");

    if doc_id.is_empty() {
        return json!({ "error": "文档 ID 为空" }).to_string();
    }

    for doc in documents {
        let id = doc.get("id").and_then(|i| i.as_str()).unwrap_or("");
        if id == doc_id {
            let content = doc.get("content").and_then(|c| c.as_str()).unwrap_or("");
            let title = doc.get("title").and_then(|t| t.as_str()).unwrap_or("");

            // 提取 Markdown 标题
            let mut headings: Vec<Value> = Vec::new();
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('#') {
                    let level = trimmed.chars().take_while(|&c| c == '#').count();
                    let text = trimmed[level..].trim().to_string();
                    if level >= 1 && level <= 6 && !text.is_empty() {
                        headings.push(json!({
                            "level": level,
                            "text": text
                        }));
                    }
                }
            }

            return json!({
                "document_id": doc_id,
                "title": title,
                "headings": headings,
                "heading_count": headings.len()
            }).to_string();
        }
    }

    json!({ "error": format!("未找到文档: {}", doc_id) }).to_string()
}

fn execute_count_words(arguments: &str, documents: &[Value]) -> String {
    let args: Value = serde_json::from_str(arguments).unwrap_or(json!({}));
    let doc_id = args.get("document_id").and_then(|d| d.as_str()).unwrap_or("");

    if doc_id.is_empty() {
        return json!({ "error": "文档 ID 为空" }).to_string();
    }

    for doc in documents {
        let id = doc.get("id").and_then(|i| i.as_str()).unwrap_or("");
        if id == doc_id {
            let content = doc.get("content").and_then(|c| c.as_str()).unwrap_or("");
            let title = doc.get("title").and_then(|t| t.as_str()).unwrap_or("");

            let chars = content.chars().count();
            let chars_no_space = content.chars().filter(|c| !c.is_whitespace()).count();
            let words = content.split_whitespace().count();
            let lines = content.lines().count();
            let paragraphs = content.split("\n\n").filter(|p| !p.trim().is_empty()).count();

            return json!({
                "document_id": doc_id,
                "title": title,
                "characters": chars,
                "characters_no_spaces": chars_no_space,
                "words": words,
                "lines": lines,
                "paragraphs": paragraphs
            }).to_string();
        }
    }

    json!({ "error": format!("未找到文档: {}", doc_id) }).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_docs() -> Vec<Value> {
        vec![
            json!({ "id": "doc1", "title": "项目说明", "content": "这是一个示例项目的说明文档。\n\n包含多个段落。\n\n第三段内容。" }),
            json!({ "id": "doc2", "title": "API 设计", "content": "# API 概述\n\n## 认证\n\nBearer Token 认证\n\n## 端点\n\n### GET /users\n\n获取用户列表" }),
            json!({ "id": "doc3", "title": "English Doc", "content": "Hello world, this is a test document with some content." }),
        ]
    }

    #[test]
    fn builtin_tools_not_empty() {
        let tools = get_builtin_tool_definitions();
        assert!(!tools.is_empty());
        assert!(tools.len() >= 10);
    }

    #[test]
    fn tool_definitions_have_correct_type() {
        for t in get_builtin_tool_definitions() {
            assert_eq!(t.tool_type, "function");
            assert!(!t.function.name.is_empty());
            assert!(!t.function.description.is_empty());
        }
    }

    #[test]
    fn search_finds_matching_document() {
        let docs = sample_docs();
        let result = execute_search_documents(r#"{"query":"示例"}"#, &docs);
        let parsed: Value = serde_json::from_str(&result).unwrap();
        let results = parsed["results"].as_array().unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0]["id"], "doc1");
    }

    #[test]
    fn search_empty_query_returns_empty() {
        let result = execute_search_documents(r#"{"query":""}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["results"].as_array().unwrap().is_empty());
    }

    #[test]
    fn search_no_match_returns_empty() {
        let result = execute_search_documents(r#"{"query":"zzzznotfound"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["results"].as_array().unwrap().is_empty());
    }

    #[test]
    fn search_is_case_insensitive() {
        let result = execute_search_documents(r#"{"query":"hello"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(!parsed["results"].as_array().unwrap().is_empty());
    }

    #[test]
    fn read_existing_document_returns_content() {
        let result = execute_read_document(r#"{"document_id":"doc2"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["title"], "API 设计");
        assert!(parsed["content"].as_str().unwrap().contains("API 概述"));
    }

    #[test]
    fn read_nonexistent_document_returns_error() {
        let result = execute_read_document(r#"{"document_id":"nonexist"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["error"].as_str().is_some());
    }

    #[test]
    fn read_empty_id_returns_error() {
        let result = execute_read_document(r#"{"document_id":""}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["error"].as_str().unwrap().contains("为空"));
    }

    #[test]
    fn stats_correct_count() {
        let result = execute_get_document_stats(&sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["total_documents"], 3);
        assert!(parsed["total_characters"].as_u64().unwrap() > 0);
    }

    #[test]
    fn stats_empty_docs() {
        let result = execute_get_document_stats(&[]);
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["total_documents"], 0);
        assert_eq!(parsed["total_characters"], 0);
    }

    #[test]
    fn outline_extracts_headings() {
        let result = execute_get_document_outline(r#"{"document_id":"doc2"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        let headings = parsed["headings"].as_array().unwrap();
        assert!(headings.len() >= 3);
        assert_eq!(headings[0]["level"], 1);
        assert_eq!(headings[0]["text"], "API 概述");
    }

    #[test]
    fn outline_nonexistent_doc_returns_error() {
        let result = execute_get_document_outline(r#"{"document_id":"nope"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["error"].as_str().is_some());
    }

    #[test]
    fn count_words_english_doc() {
        let result = execute_count_words(r#"{"document_id":"doc3"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["characters"].as_u64().unwrap() > 0);
        assert!(parsed["words"].as_u64().unwrap() > 0);
        assert!(parsed["lines"].as_u64().unwrap() > 0);
    }

    #[test]
    fn count_words_chinese_doc_paragraphs() {
        let result = execute_count_words(r#"{"document_id":"doc1"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["characters"].as_u64().unwrap() > 0);
        assert!(parsed["paragraphs"].as_u64().unwrap() >= 2);
    }

    #[test]
    fn export_markdown_format() {
        let result = execute_export_document(r#"{"document_id":"doc2","format":"markdown"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["format"], "markdown");
        assert!(parsed["content"].as_str().unwrap().contains("# API 概述"));
    }

    #[test]
    fn export_html_format() {
        let result = execute_export_document(r#"{"document_id":"doc2","format":"html"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["format"], "html");
        assert!(parsed["content"].as_str().unwrap().contains("<h1>"));
    }

    #[test]
    fn export_txt_format() {
        let result = execute_export_document(r#"{"document_id":"doc1","format":"txt"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["format"], "txt");
    }

    #[test]
    fn export_nonexistent_returns_error() {
        let result = execute_export_document(r#"{"document_id":"nope","format":"html"}"#, &sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(parsed["error"].as_str().is_some());
    }

    #[test]
    fn execute_tool_routes_to_read() {
        let tc = ToolCall {
            id: "call_1".into(),
            call_type: Some("function".into()),
            function: FunctionCall {
                name: "read_document".into(),
                arguments: r#"{"document_id":"doc1"}"#.into(),
            },
        };
        let result = execute_tool(&tc, &sample_docs());
        assert_eq!(result.tool_call_id, "call_1");
        assert_eq!(result.role, "tool");
        let parsed: Value = serde_json::from_str(&result.content).unwrap();
        assert_eq!(parsed["title"], "项目说明");
    }

    #[test]
    fn execute_tool_unknown_returns_error() {
        let tc = ToolCall {
            id: "call_2".into(),
            call_type: None,
            function: FunctionCall {
                name: "nonexistent_tool".into(),
                arguments: "{}".into(),
            },
        };
        let result = execute_tool(&tc, &[]);
        assert!(result.content.contains("未知工具"));
    }

    #[test]
    fn list_documents_returns_all() {
        let result = execute_list_documents(&sample_docs());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["total"], 3);
        assert_eq!(parsed["documents"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn list_documents_empty_returns_zero() {
        let result = execute_list_documents(&[]);
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["total"], 0);
    }

    #[test]
    fn create_document_with_title_and_content() {
        let result = execute_create_document(r#"{"title":"新文档","content":"内容"}"#);
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["success"], true);
        assert_eq!(parsed["title"], "新文档");
    }

    #[test]
    fn create_document_no_content_defaults_empty() {
        let result = execute_create_document(r#"{"title":"空文档"}"#);
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["success"], true);
        assert_eq!(parsed["content_length"], 0);
    }
}
