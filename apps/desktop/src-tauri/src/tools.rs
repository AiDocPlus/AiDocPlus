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

/// 获取所有内置工具的定义（OpenAI tools 格式）
pub fn get_builtin_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: "search_documents".to_string(),
                description: "搜索项目中的文档，返回匹配的文档标题和摘要".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "搜索关键词"
                        }
                    },
                    "required": ["query"]
                }),
            },
        },
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: "read_document".to_string(),
                description: "读取指定文档的完整内容".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "document_id": {
                            "type": "string",
                            "description": "文档 ID"
                        }
                    },
                    "required": ["document_id"]
                }),
            },
        },
        ToolDefinition {
            tool_type: "function".to_string(),
            function: FunctionDefinition {
                name: "get_document_stats".to_string(),
                description: "获取当前项目的文档统计信息，包括文档数量、总字数等".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {},
                    "required": []
                }),
            },
        },
    ]
}

/// 执行内置工具调用
pub fn execute_tool(tool_call: &ToolCall, project_documents: &[Value]) -> ToolResult {
    let result_content = match tool_call.function.name.as_str() {
        "search_documents" => execute_search_documents(&tool_call.function.arguments, project_documents),
        "read_document" => execute_read_document(&tool_call.function.arguments, project_documents),
        "get_document_stats" => execute_get_document_stats(project_documents),
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
            // 截取匹配位置附近的摘要
            let snippet = if let Some(pos) = content.to_lowercase().find(&query_lower) {
                let start = pos.saturating_sub(50);
                let end = (pos + query.len() + 50).min(content.len());
                // 确保在字符边界上截取
                let start = content[..start].rfind(char::is_whitespace).map(|p| p + 1).unwrap_or(start);
                let snippet = &content[start..end.min(content.len())];
                snippet.to_string()
            } else {
                content.chars().take(100).collect::<String>()
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
