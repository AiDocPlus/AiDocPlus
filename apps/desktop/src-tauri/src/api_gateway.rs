//! API Gateway — 统一命名空间路由 + 权限检查
//!
//! 所有外部 API 调用（HTTP / SDK / MCP）都通过此网关分发。
//! 请求格式（JSON-RPC 风格）：
//! ```json
//! { "method": "document.list", "params": { "projectId": "..." }, "id": "req_001" }
//! ```

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, Listener};
use tokio::sync::oneshot;
use uuid::Uuid;

use crate::config::AppState;

// ============================================================
// 请求 / 响应类型
// ============================================================

/// API 请求
#[derive(Debug, Clone, Deserialize)]
pub struct ApiRequest {
    /// 方法名，格式: "命名空间.操作"，如 "document.list"
    pub method: String,
    /// 参数（JSON 对象）
    #[serde(default)]
    pub params: Value,
    /// 请求 ID（用于客户端匹配响应）
    #[serde(default)]
    pub id: Option<String>,
}

/// API 响应
#[derive(Debug, Clone, Serialize)]
pub struct ApiResponse {
    /// 对应的请求 ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// 成功时的结果
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    /// 失败时的错误
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiError>,
}

/// API 错误
#[derive(Debug, Clone, Serialize)]
pub struct ApiError {
    pub code: i32,
    pub message: String,
}

impl ApiResponse {
    pub fn success(id: Option<String>, result: Value) -> Self {
        Self { id, result: Some(result), error: None }
    }

    pub fn error(id: Option<String>, code: i32, message: impl Into<String>) -> Self {
        Self { id, result: None, error: Some(ApiError { code, message: message.into() }) }
    }
}

// ============================================================
// 权限模型
// ============================================================

/// 调用者级别
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum CallerLevel {
    /// 内部调用（前端 WebView）— 全部权限
    Internal,
    /// 脚本调用（Python/JS SDK）— 读写，无删除项目/修改设置
    Script,
    /// 外部调用（HTTP API / MCP）— 白名单操作 + Token
    External,
}

/// 脚本级别禁止的方法
static SCRIPT_DENIED: OnceLock<HashSet<&'static str>> = OnceLock::new();

fn script_denied_methods() -> &'static HashSet<&'static str> {
    SCRIPT_DENIED.get_or_init(|| {
        let mut s = HashSet::new();
        s.insert("project.delete");
        s.insert("settings.save");
        s.insert("settings.saveUiPreferences");
        s
    })
}

/// 外部级别允许的方法（白名单）
static EXTERNAL_ALLOWED: OnceLock<HashSet<&'static str>> = OnceLock::new();

fn external_allowed_methods() -> &'static HashSet<&'static str> {
    EXTERNAL_ALLOWED.get_or_init(|| {
        let mut s = HashSet::new();
        // 只读操作
        s.insert("app.status");
        s.insert("app.getActiveDocument");
        s.insert("app.getSelectedText");
        s.insert("app.getActiveProjectId");
        s.insert("document.list");
        s.insert("document.get");
        s.insert("project.list");
        s.insert("search.documents");
        s.insert("template.list");
        s.insert("template.getContent");
        // 插件（只读）
        s.insert("plugin.list");
        s.insert("plugin.storage.get");
        // 受控写操作
        s.insert("document.create");
        s.insert("document.save");
        s.insert("ai.chat");
        s.insert("ai.generate");
        s.insert("export.markdown");
        s.insert("export.html");
        s.insert("export.docx");
        s.insert("export.pdf");
        s.insert("plugin.storage.set");
        s
    })
}

/// 检查权限
fn check_permission(method: &str, level: CallerLevel) -> Result<(), ApiResponse> {
    match level {
        CallerLevel::Internal => Ok(()),
        CallerLevel::Script => {
            if script_denied_methods().contains(method) {
                Err(ApiResponse::error(None, 403, format!("脚本级别不允许调用: {}", method)))
            } else {
                Ok(())
            }
        }
        CallerLevel::External => {
            if external_allowed_methods().contains(method) {
                Ok(())
            } else {
                Err(ApiResponse::error(None, 403, format!("外部级别不允许调用: {}", method)))
            }
        }
    }
}

// ============================================================
// 核心分发
// ============================================================

/// 分发 API 请求到对应 handler
pub async fn dispatch(
    request: ApiRequest,
    level: CallerLevel,
    app_state: &AppState,
    app_handle: &AppHandle,
) -> ApiResponse {
    let req_id = request.id.clone();

    // 权限检查
    if let Err(mut resp) = check_permission(&request.method, level) {
        resp.id = req_id;
        return resp;
    }

    // 按命名空间路由
    let parts: Vec<&str> = request.method.splitn(2, '.').collect();
    if parts.len() != 2 {
        return ApiResponse::error(req_id, 400, format!("无效的方法名格式: {}（应为 namespace.action）", request.method));
    }

    let (namespace, action) = (parts[0], parts[1]);
    let params = request.params;

    let result = match namespace {
        "app" => handle_app(action, &params, app_handle).await,
        "document" => handle_document(action, &params, app_state).await,
        "project" => handle_project(action, &params, app_state).await,
        "search" => handle_search(action, &params, app_state).await,
        "template" => handle_template(action, &params).await,
        "export" => handle_export(action, &params, app_state).await,
        "plugin" => handle_plugin(action, &params).await,
        "email" => handle_email(action, &params).await,
        "ai" => handle_ai(action, &params, app_handle).await,
        "file" => handle_file(action, &params).await,
        "tts" => handle_tts(action, &params).await,
        "script" => handle_script(action, &params).await,
        _ => Err(format!("未知的命名空间: {}", namespace)),
    };

    match result {
        Ok(value) => ApiResponse::success(req_id, value),
        Err(msg) => ApiResponse::error(req_id, 500, msg),
    }
}

// ============================================================
// 各命名空间 handler（Phase 1 先实现核心子集，其余返回占位）
// ============================================================

type HandlerResult = Result<Value, String>;

/// app 命名空间 — 程序状态
async fn handle_app(action: &str, _params: &Value, app_handle: &AppHandle) -> HandlerResult {
    match action {
        "status" => Ok(json!({
            "running": true,
            "version": env!("CARGO_PKG_VERSION"),
            "apiVersion": 1
        })),
        "getActiveDocument" => {
            query_frontend_state(app_handle, "getActiveDocument").await
        }
        "getSelectedText" => {
            query_frontend_state(app_handle, "getSelectedText").await
        }
        "getActiveProjectId" => {
            query_frontend_state(app_handle, "getActiveProjectId").await
        }
        _ => Err(format!("app 命名空间未知操作: {}", action)),
    }
}

/// 通过 Tauri 事件查询前端 UI 状态
/// 发送 api-bridge:query 事件，等待前端通过 api-bridge:response 回复
async fn query_frontend_state(app_handle: &AppHandle, query_type: &str) -> HandlerResult {
    let query_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel::<Value>();

    // 监听前端响应
    let expected_id = query_id.clone();
    let tx = std::sync::Mutex::new(Some(tx));
    let listener_id = app_handle.listen("api-bridge:response", move |event| {
        if let Ok(payload) = serde_json::from_str::<Value>(event.payload()) {
            if payload.get("queryId").and_then(|v| v.as_str()) == Some(&expected_id) {
                let result = payload.get("result").cloned().unwrap_or(json!(null));
                if let Some(sender) = tx.lock().ok().and_then(|mut s| s.take()) {
                    let _ = sender.send(result);
                }
            }
        }
    });

    // 发送查询请求到前端
    let _ = app_handle.emit("api-bridge:query", json!({
        "queryType": query_type,
        "queryId": query_id,
    }));

    // 等待响应，超时 3 秒
    let result = tokio::time::timeout(std::time::Duration::from_secs(3), rx).await;
    app_handle.unlisten(listener_id);

    match result {
        Ok(Ok(value)) => Ok(value),
        Ok(Err(_)) => Err("前端状态查询通道已关闭".to_string()),
        Err(_) => Err("前端状态查询超时（3s）".to_string()),
    }
}

/// document 命名空间
async fn handle_document(action: &str, params: &Value, state: &AppState) -> HandlerResult {
    match action {
        "list" => {
            let project_id = params.get("projectId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 projectId".to_string())?;
            let docs_dir = state.config.projects_dir
                .join(project_id)
                .join("documents");
            if !docs_dir.exists() {
                return Ok(json!([]));
            }
            let mut docs = Vec::new();
            let entries = std::fs::read_dir(&docs_dir)
                .map_err(|e| format!("读取文档目录失败: {}", e))?;
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(doc) = serde_json::from_str::<Value>(&content) {
                            docs.push(json!({
                                "id": doc.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                                "title": doc.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                                "metadata": doc.get("metadata"),
                            }));
                        }
                    }
                }
            }
            Ok(Value::Array(docs))
        }
        "get" => {
            let project_id = params.get("projectId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 projectId".to_string())?;
            let document_id = params.get("documentId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 documentId".to_string())?;
            let doc_path = state.get_document_path(project_id, document_id);
            if !doc_path.exists() {
                return Err(format!("文档不存在: {}", document_id));
            }
            let content = std::fs::read_to_string(&doc_path)
                .map_err(|e| format!("读取文档失败: {}", e))?;
            let doc: Value = serde_json::from_str(&content)
                .map_err(|e| format!("解析文档 JSON 失败: {}", e))?;
            Ok(doc)
        }
        "create" => {
            let project_id = params.get("projectId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 projectId".to_string())?;
            let title = params.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("未命名文档");
            let author = params.get("author")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let doc = crate::document::Document::new(
                project_id.to_string(),
                title.to_string(),
                author.to_string(),
            );
            let doc_path = state.get_document_path(project_id, &doc.id);
            doc.save(&doc_path).map_err(|e| format!("保存文档失败: {}", e))?;
            let doc_json = serde_json::to_value(&doc)
                .map_err(|e| format!("序列化文档失败: {}", e))?;
            Ok(doc_json)
        }
        "save" => {
            let project_id = params.get("projectId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 projectId".to_string())?;
            let document_id = params.get("documentId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 documentId".to_string())?;
            let doc_path = state.get_document_path(project_id, document_id);
            if !doc_path.exists() {
                return Err(format!("文档不存在: {}", document_id));
            }
            let mut doc = crate::document::Document::load(&doc_path)
                .map_err(|e| format!("加载文档失败: {}", e))?;
            if let Some(title) = params.get("title").and_then(|v| v.as_str()) {
                doc.title = title.to_string();
            }
            if let Some(content) = params.get("content").and_then(|v| v.as_str()) {
                doc.content = content.to_string();
                doc.metadata.word_count = content.split_whitespace().count();
                doc.metadata.character_count = content.chars().count();
            }
            if let Some(ai_content) = params.get("aiGeneratedContent").and_then(|v| v.as_str()) {
                doc.ai_generated_content = ai_content.to_string();
            }
            doc.metadata.updated_at = chrono::Utc::now().timestamp();
            doc.save(&doc_path).map_err(|e| format!("保存文档失败: {}", e))?;
            let doc_json = serde_json::to_value(&doc)
                .map_err(|e| format!("序列化文档失败: {}", e))?;
            Ok(doc_json)
        }
        _ => Err(format!("document 命名空间未知操作: {}", action)),
    }
}

/// project 命名空间
async fn handle_project(action: &str, _params: &Value, state: &AppState) -> HandlerResult {
    match action {
        "list" => {
            let projects_dir = &state.config.projects_dir;
            if !projects_dir.exists() {
                return Ok(json!([]));
            }
            let mut projects = Vec::new();
            let entries = std::fs::read_dir(projects_dir)
                .map_err(|e| format!("读取项目目录失败: {}", e))?;
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(proj) = serde_json::from_str::<Value>(&content) {
                            projects.push(json!({
                                "id": proj.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                                "name": proj.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                                "metadata": proj.get("metadata"),
                            }));
                        }
                    }
                }
            }
            Ok(Value::Array(projects))
        }
        _ => Err(format!("project 命名空间未知操作: {}", action)),
    }
}

/// search 命名空间
async fn handle_search(action: &str, params: &Value, state: &AppState) -> HandlerResult {
    match action {
        "documents" => {
            let query = params.get("query")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 query".to_string())?;
            let project_id = params.get("projectId")
                .and_then(|v| v.as_str());
            // 简单搜索：遍历所有文档找关键词
            let projects_dir = &state.config.projects_dir;
            let mut results = Vec::new();
            let query_lower = query.to_lowercase();

            // 获取要搜索的项目列表
            let project_ids: Vec<String> = if let Some(pid) = project_id {
                vec![pid.to_string()]
            } else {
                std::fs::read_dir(projects_dir)
                    .map_err(|e| format!("读取目录失败: {}", e))?
                    .flatten()
                    .filter(|e| e.path().is_dir())
                    .filter_map(|e| e.file_name().into_string().ok())
                    .collect()
            };

            for pid in &project_ids {
                let docs_dir = projects_dir.join(pid).join("documents");
                if !docs_dir.exists() { continue; }
                let entries = std::fs::read_dir(&docs_dir).ok();
                if let Some(entries) = entries {
                    for entry in entries.flatten() {
                        if results.len() >= 20 { break; }
                        let path = entry.path();
                        if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            if let Ok(doc) = serde_json::from_str::<Value>(&content) {
                                let title = doc.get("title").and_then(|v| v.as_str()).unwrap_or("");
                                let body = doc.get("content").and_then(|v| v.as_str()).unwrap_or("");
                                if title.to_lowercase().contains(&query_lower) || body.to_lowercase().contains(&query_lower) {
                                    let snippet = if let Some(pos) = body.to_lowercase().find(&query_lower) {
                                        let start = pos.saturating_sub(40);
                                        let end = (pos + query.len() + 60).min(body.len());
                                        body.get(start..end).unwrap_or("").to_string()
                                    } else {
                                        body.chars().take(80).collect::<String>()
                                    };
                                    results.push(json!({
                                        "projectId": pid,
                                        "documentId": doc.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                                        "title": title,
                                        "snippet": snippet,
                                    }));
                                }
                            }
                        }
                    }
                }
            }
            Ok(json!({ "results": results, "total": results.len() }))
        }
        _ => Err(format!("search 命名空间未知操作: {}", action)),
    }
}

// ── 以下命名空间 Phase 1 先返回占位，后续逐步实现 ──

async fn handle_template(action: &str, params: &Value) -> HandlerResult {
    match action {
        "list" => {
            let templates = crate::commands::resource::list_prompt_templates()
                .map_err(|e| format!("获取模板列表失败: {}", e))?;
            // 转换为简洁格式返回
            let list: Vec<Value> = templates.iter().map(|t| {
                json!({
                    "id": t.id,
                    "name": t.name,
                    "category": t.category,
                    "description": t.description,
                    "variables": t.variables,
                    "isBuiltIn": t.is_built_in
                })
            }).collect();
            Ok(json!({ "templates": list, "count": list.len() }))
        }
        "getContent" => {
            let template_id = params.get("templateId")
                .or_else(|| params.get("id"))
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 templateId".to_string())?;

            let templates = crate::commands::resource::list_prompt_templates()
                .map_err(|e| format!("获取模板列表失败: {}", e))?;
            let found = templates.iter().find(|t| t.id == template_id);
            match found {
                Some(t) => Ok(json!({
                    "id": t.id,
                    "name": t.name,
                    "category": t.category,
                    "content": t.content,
                    "description": t.description,
                    "variables": t.variables,
                    "isBuiltIn": t.is_built_in
                })),
                None => Err(format!("模板未找到: {}", template_id)),
            }
        }
        _ => Err(format!("template 命名空间未知操作: {}", action)),
    }
}

async fn handle_export(action: &str, params: &Value, state: &AppState) -> HandlerResult {
    let format = match action {
        "markdown" => "md",
        "html" => "html",
        "docx" => "docx",
        "pdf" => "pdf",
        "txt" => "txt",
        _ => return Err(format!("export 命名空间未知操作: {}", action)),
    };

    // 获取 Markdown 内容：优先使用 content 参数，其次从文档加载
    let (markdown, title) = if let Some(content) = params.get("content").and_then(|v| v.as_str()) {
        let t = params.get("title").and_then(|v| v.as_str()).unwrap_or("导出文档");
        (content.to_string(), t.to_string())
    } else if let (Some(project_id), Some(doc_id)) = (
        params.get("projectId").and_then(|v| v.as_str()),
        params.get("documentId").and_then(|v| v.as_str()),
    ) {
        let doc_path = state.get_document_path(project_id, doc_id);
        if !doc_path.exists() {
            return Err(format!("文档未找到: {}", doc_id));
        }
        let document = crate::document::Document::load(&doc_path)
            .map_err(|e| format!("加载文档失败: {}", e))?;
        // 优先使用 AI 生成内容，其次使用原始内容
        let content = if !document.ai_generated_content.is_empty() {
            document.ai_generated_content.clone()
        } else {
            document.content.clone()
        };
        (content, document.title.clone())
    } else {
        return Err("export 需要 content 参数或 projectId + documentId 参数".to_string());
    };

    // 确定输出路径
    let output_path = if let Some(path) = params.get("outputPath").and_then(|v| v.as_str()) {
        path.to_string()
    } else {
        // 默认导出到 ~/AiDocPlus/exports/
        let home = dirs::home_dir().ok_or("无法获取用户目录")?;
        let export_dir = home.join("AiDocPlus").join("exports");
        std::fs::create_dir_all(&export_dir)
            .map_err(|e| format!("创建导出目录失败: {}", e))?;
        let safe_title = title.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        export_dir.join(format!("{}_{}.{}", safe_title, timestamp, format))
            .to_string_lossy().to_string()
    };

    // 安全检查：输出路径必须在 ~/AiDocPlus/ 或临时目录下
    // 规范化路径以防止 ../ 遍历攻击
    let home = dirs::home_dir().ok_or("无法获取用户目录")?;
    let allowed_root = home.join("AiDocPlus").canonicalize()
        .unwrap_or_else(|_| home.join("AiDocPlus"));
    let temp_root = std::env::temp_dir().canonicalize()
        .unwrap_or_else(|_| std::env::temp_dir());
    let out = std::path::PathBuf::from(&output_path);
    // 先确保父目录存在以便 canonicalize
    if let Some(parent) = out.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let out_resolved = if let Ok(c) = out.canonicalize() {
        c
    } else if let Some(parent) = out.parent() {
        parent.canonicalize()
            .map(|p| p.join(out.file_name().unwrap_or_default()))
            .unwrap_or(out.clone())
    } else {
        out.clone()
    };
    if !out_resolved.starts_with(&allowed_root) && !out_resolved.starts_with(&temp_root) {
        return Err("安全限制：导出路径须在 ~/AiDocPlus/ 或临时目录下".to_string());
    }

    let result = crate::native_export::export_native(&markdown, &title, &output_path, format)
        .map_err(|e| format!("导出失败: {}", e))?;

    Ok(json!({
        "outputPath": result,
        "format": format,
        "title": title
    }))
}

async fn handle_plugin(action: &str, params: &Value) -> HandlerResult {
    match action {
        "list" => {
            // 列出已安装的插件（从 bundled-resources 读取 manifest）
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()));
            let mut plugins = Vec::new();

            if let Some(dir) = exe_dir {
                // Tauri 打包后插件 manifest 位于 bundled-resources 或 resources 目录
                let resources_dir = dir.join("resources");
                let plugins_dir = if resources_dir.exists() { resources_dir } else { dir.clone() };
                // 尝试从 plugins 子目录列出
                let scan_dir = plugins_dir.join("plugins");
                if scan_dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(&scan_dir) {
                        for entry in entries.flatten() {
                            let manifest_path = entry.path().join("manifest.json");
                            if manifest_path.exists() {
                                if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                                    if let Ok(m) = serde_json::from_str::<Value>(&content) {
                                        plugins.push(json!({
                                            "id": m.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                                            "name": m.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                                            "version": m.get("version").and_then(|v| v.as_str()).unwrap_or("1.0.0"),
                                            "type": m.get("type").and_then(|v| v.as_str()).unwrap_or(""),
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Ok(json!({ "plugins": plugins, "total": plugins.len() }))
        }
        "storage.get" => {
            let plugin_id = params.get("pluginId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 pluginId".to_string())?;
            let key = params.get("key").and_then(|v| v.as_str());

            let storage_path = dirs::home_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("AiDocPlus")
                .join("plugin-storage.json");

            if !storage_path.exists() {
                return Ok(json!({ "data": null }));
            }

            let content = std::fs::read_to_string(&storage_path)
                .map_err(|e| format!("读取插件存储失败: {}", e))?;
            let storage: Value = serde_json::from_str(&content)
                .map_err(|e| format!("解析插件存储失败: {}", e))?;

            // plugin-storage.json 结构: { "pluginId": { "key": value, ... }, ... }
            let plugin_data = storage.get(plugin_id).cloned().unwrap_or(json!(null));
            if let Some(k) = key {
                Ok(json!({ "data": plugin_data.get(k).cloned().unwrap_or(json!(null)) }))
            } else {
                Ok(json!({ "data": plugin_data }))
            }
        }
        "storage.set" => {
            let plugin_id = params.get("pluginId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 pluginId".to_string())?;
            let key = params.get("key")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "缺少参数 key".to_string())?;
            let value = params.get("value").cloned().unwrap_or(json!(null));

            let storage_path = dirs::home_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("AiDocPlus")
                .join("plugin-storage.json");

            let mut storage: Value = if storage_path.exists() {
                let content = std::fs::read_to_string(&storage_path)
                    .map_err(|e| format!("读取插件存储失败: {}", e))?;
                serde_json::from_str(&content).unwrap_or(json!({}))
            } else {
                json!({})
            };

            // 确保 plugin_id 下是一个对象
            if !storage.get(plugin_id).map_or(false, |v| v.is_object()) {
                storage[plugin_id] = json!({});
            }
            storage[plugin_id][key] = value.clone();

            if let Some(parent) = storage_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
            let json_str = serde_json::to_string_pretty(&storage)
                .map_err(|e| format!("序列化失败: {}", e))?;
            std::fs::write(&storage_path, json_str)
                .map_err(|e| format!("写入插件存储失败: {}", e))?;

            Ok(json!({ "success": true }))
        }
        _ => Err(format!("plugin 命名空间未知操作: {}", action)),
    }
}

async fn handle_email(action: &str, _params: &Value) -> HandlerResult {
    match action {
        "send" | "testConnection" => {
            Ok(json!({ "note": format!("email.{} 将在后续阶段实现", action) }))
        }
        _ => Err(format!("email 命名空间未知操作: {}", action)),
    }
}

async fn handle_ai(action: &str, params: &Value, app_handle: &AppHandle) -> HandlerResult {
    match action {
        "chat" | "generate" => {
            // 从前端获取 AI 配置
            let ai_config = query_frontend_state(app_handle, "getAiConfig").await
                .map_err(|e| format!("获取 AI 配置失败: {}", e))?;

            let provider = ai_config.get("provider").and_then(|v| v.as_str()).unwrap_or("openai");
            let api_key = ai_config.get("apiKey").and_then(|v| v.as_str());
            let model = ai_config.get("model").and_then(|v| v.as_str());
            let base_url = ai_config.get("baseUrl").and_then(|v| v.as_str());

            if api_key.is_none() || api_key == Some("") {
                return Err("未配置 AI API Key，请在设置中配置 AI 服务".to_string());
            }

            // 构建 Chat Completions 请求
            let mut messages = if action == "generate" {
                let prompt = params.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
                if prompt.is_empty() {
                    return Err("generate 需要 prompt 参数".to_string());
                }
                vec![json!({"role": "user", "content": prompt})]
            } else {
                // chat: 需要 messages 数组
                match params.get("messages").and_then(|v| v.as_array()) {
                    Some(msgs) => msgs.clone(),
                    None => return Err("chat 需要 messages 参数（数组）".to_string()),
                }
            };

            // 支持 system_prompt 参数：注入到 messages 最前面
            if let Some(sys) = params.get("system_prompt").or_else(|| params.get("systemPrompt")) {
                if let Some(sys_str) = sys.as_str() {
                    if !sys_str.is_empty() {
                        messages.insert(0, json!({"role": "system", "content": sys_str}));
                    }
                }
            }

            let default_model = match provider {
                "openai" => "gpt-4.1",
                "anthropic" => "claude-sonnet-4-20250514",
                "gemini" => "gemini-2.5-flash-preview-05-20",
                "xai" => "grok-3-mini",
                "deepseek" => "deepseek-chat",
                "qwen" => "qwen-plus",
                "glm" | "glm-code" => "glm-4-flash",
                "minimax" | "minimax-code" => "MiniMax-Text-01",
                "kimi" => "moonshot-v1-auto",
                "kimi-code" => "kimi-latest",
                _ => "gpt-4.1",
            };

            let temperature = params.get("temperature")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.7);
            let max_tokens_val = params.get("max_tokens")
                .or_else(|| params.get("maxTokens"))
                .and_then(|v| v.as_u64());

            let the_model = model.unwrap_or(default_model);
            let client = reqwest::Client::new();

            // Anthropic Messages API 格式与 OpenAI 不同，需要单独处理
            let is_anthropic = provider == "anthropic";

            let (response_body, is_anthropic_resp) = if is_anthropic {
                let default_base = "https://api.anthropic.com";
                let base = base_url.unwrap_or(default_base);
                let url = format!("{}/v1/messages", base.trim_end_matches('/'));

                // Anthropic: system 是顶层字段，不在 messages 中
                let mut api_messages = Vec::new();
                let mut system_text = String::new();
                for msg in &messages {
                    let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user");
                    if role == "system" {
                        if let Some(c) = msg.get("content").and_then(|c| c.as_str()) {
                            if !system_text.is_empty() { system_text.push('\n'); }
                            system_text.push_str(c);
                        }
                    } else {
                        api_messages.push(msg.clone());
                    }
                }

                let mut body = json!({
                    "model": the_model,
                    "messages": api_messages,
                    "max_tokens": max_tokens_val.unwrap_or(4096),
                    "temperature": temperature,
                    "stream": false
                });
                if !system_text.is_empty() {
                    body["system"] = json!(system_text);
                }

                let resp = client.post(&url)
                    .header("Content-Type", "application/json")
                    .header("x-api-key", api_key.unwrap_or(""))
                    .header("anthropic-version", "2023-06-01")
                    .json(&body)
                    .timeout(std::time::Duration::from_secs(120))
                    .send()
                    .await
                    .map_err(|e| format!("Anthropic 服务连接失败: {}", e))?;

                if !resp.status().is_success() {
                    let status = resp.status();
                    let error_text = resp.text().await.unwrap_or_else(|_| "未知错误".to_string());
                    return Err(format!("Anthropic API 错误 ({}): {}", status, error_text));
                }

                let b: Value = resp.json().await
                    .map_err(|e| format!("解析 Anthropic 响应失败: {}", e))?;
                (b, true)
            } else {
                // OpenAI 兼容格式（含 DeepSeek/Qwen/GLM/MiniMax/Kimi/xAI/Gemini 等）
                let default_base = match provider {
                    "openai" => "https://api.openai.com/v1",
                    "gemini" => "https://generativelanguage.googleapis.com/v1beta/openai",
                    "xai" => "https://api.x.ai/v1",
                    "deepseek" => "https://api.deepseek.com",
                    "qwen" => "https://dashscope.aliyuncs.com/compatible-mode/v1",
                    "glm" | "glm-code" => "https://open.bigmodel.cn/api/paas/v4",
                    "minimax" | "minimax-code" => "https://api.minimaxi.com/v1",
                    "kimi" => "https://api.moonshot.cn/v1",
                    "kimi-code" => "https://api.kimi.com/coding/v1",
                    _ => "https://api.openai.com/v1",
                };
                let base = base_url.unwrap_or(default_base);
                let url = format!("{}/chat/completions", base.trim_end_matches('/'));

                let mut body = json!({
                    "messages": messages,
                    "model": the_model,
                    "temperature": temperature,
                    "stream": false
                });
                if let Some(mt) = max_tokens_val {
                    body["max_tokens"] = json!(mt);
                }

                let resp = client.post(&url)
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", api_key.unwrap_or("")))
                    .json(&body)
                    .timeout(std::time::Duration::from_secs(120))
                    .send()
                    .await
                    .map_err(|e| format!("AI 服务连接失败: {}", e))?;

                if !resp.status().is_success() {
                    let status = resp.status();
                    let error_text = resp.text().await.unwrap_or_else(|_| "未知错误".to_string());
                    return Err(format!("AI API 错误 ({}): {}", status, error_text));
                }

                let b: Value = resp.json().await
                    .map_err(|e| format!("解析 AI 响应失败: {}", e))?;
                (b, false)
            };

            // 按不同格式提取回复内容
            let (content, resp_model) = if is_anthropic_resp {
                // Anthropic 响应: { "content": [{"type":"text","text":"..."}], "model": "...", "usage": {...} }
                let text = response_body.get("content")
                    .and_then(|c| c.as_array())
                    .and_then(|arr| arr.iter().find(|b| b.get("type").and_then(|t| t.as_str()) == Some("text")))
                    .and_then(|b| b.get("text"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("");
                let m = response_body.get("model").and_then(|m| m.as_str()).unwrap_or("");
                (text.to_string(), m.to_string())
            } else {
                // OpenAI 响应: { "choices": [{"message":{"content":"..."}}], "model": "...", "usage": {...} }
                let text = response_body.get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("message"))
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                    .unwrap_or("");
                let m = response_body.get("model").and_then(|m| m.as_str()).unwrap_or("");
                (text.to_string(), m.to_string())
            };

            let usage = response_body.get("usage");

            Ok(json!({
                "content": content,
                "model": resp_model,
                "usage": usage
            }))
        }
        "chatStream" => {
            // 流式暂不通过 API Gateway 支持（HTTP 不适合 SSE 转发）
            Err("ai.chatStream 暂不支持通过 API 调用，请使用 ai.chat 代替".to_string())
        }
        _ => Err(format!("ai 命名空间未知操作: {}", action)),
    }
}

async fn handle_file(action: &str, params: &Value) -> HandlerResult {
    // 安全检查：只允许访问 ~/AiDocPlus/ 下的文件
    let validate_path = |p: &str| -> Result<std::path::PathBuf, String> {
        let home = dirs::home_dir().ok_or("无法获取用户目录")?;
        let allowed_root = home.join("AiDocPlus");
        let resolved = if p.starts_with('~') {
            home.join(p.strip_prefix("~/").unwrap_or(p))
        } else {
            std::path::PathBuf::from(p)
        };
        let canonical = resolved.canonicalize()
            .or_else(|_| {
                // 文件可能不存在（write 场景），检查父目录
                if let Some(parent) = resolved.parent() {
                    parent.canonicalize().map(|p| p.join(resolved.file_name().unwrap_or_default()))
                } else {
                    Err(std::io::Error::new(std::io::ErrorKind::NotFound, "路径无效"))
                }
            })
            .map_err(|e| format!("路径无效: {}", e))?;
        if !canonical.starts_with(&allowed_root) {
            return Err(format!("安全限制：只允许访问 ~/AiDocPlus/ 下的文件，当前路径: {}", p));
        }
        Ok(canonical)
    };

    match action {
        "read" => {
            let path_str = params.get("path").and_then(|v| v.as_str())
                .ok_or("read 需要 path 参数")?;
            let path = validate_path(path_str)?;
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("读取文件失败: {}", e))?;
            Ok(json!({ "content": content, "path": path.to_string_lossy() }))
        }
        "write" => {
            let path_str = params.get("path").and_then(|v| v.as_str())
                .ok_or("write 需要 path 参数")?;
            let content = params.get("content").and_then(|v| v.as_str())
                .ok_or("write 需要 content 参数")?;
            let path = validate_path(path_str)?;
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("创建目录失败: {}", e))?;
            }
            std::fs::write(&path, content)
                .map_err(|e| format!("写入文件失败: {}", e))?;
            Ok(json!({ "success": true, "path": path.to_string_lossy() }))
        }
        "metadata" => {
            let path_str = params.get("path").and_then(|v| v.as_str())
                .ok_or("metadata 需要 path 参数")?;
            let path = validate_path(path_str)?;
            let meta = std::fs::metadata(&path)
                .map_err(|e| format!("获取元数据失败: {}", e))?;
            Ok(json!({
                "path": path.to_string_lossy(),
                "size": meta.len(),
                "isFile": meta.is_file(),
                "isDir": meta.is_dir(),
                "modified": meta.modified().ok().map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()
                })
            }))
        }
        _ => Err(format!("file 命名空间未知操作: {}", action)),
    }
}

async fn handle_tts(action: &str, _params: &Value) -> HandlerResult {
    match action {
        "speak" | "stop" | "listVoices" => {
            Ok(json!({ "note": format!("tts.{} 将在后续阶段实现", action) }))
        }
        _ => Err(format!("tts 命名空间未知操作: {}", action)),
    }
}

async fn handle_script(action: &str, _params: &Value) -> HandlerResult {
    match action {
        "listFiles" => {
            let home = dirs::home_dir().ok_or("无法获取用户目录")?;
            let dir = home.join("AiDocPlus").join("CodingScripts");
            if !dir.exists() {
                return Ok(json!({ "files": [] }));
            }
            let mut files = Vec::new();
            let entries = std::fs::read_dir(&dir)
                .map_err(|e| format!("读取脚本目录失败: {}", e))?;
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with('.') { continue; }
                        let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                        files.push(json!({
                            "name": name,
                            "path": path.to_string_lossy(),
                            "size": size
                        }));
                    }
                }
            }
            Ok(json!({ "files": files }))
        }
        "run" | "kill" => {
            // 脚本运行/终止需要通过前端 CodingPanel 触发，API 暂不直接支持
            Err(format!("script.{} 暂不支持通过 API 直接调用，请在编程区中操作", action))
        }
        _ => Err(format!("script 命名空间未知操作: {}", action)),
    }
}

// ============================================================
// API Schema（自描述）
// ============================================================

/// 返回所有可用 API 的 schema（供客户端 / SDK 自动发现）
pub fn get_api_schema() -> Value {
    json!({
        "version": 1,
        "namespaces": {
            "app": {
                "actions": {
                    "status": { "description": "获取程序运行状态", "params": {} },
                    "getActiveDocument": { "description": "获取当前打开的文档（id, title, projectId, content）", "params": {} },
                    "getSelectedText": { "description": "获取编辑器中选中的文本", "params": {} },
                    "getActiveProjectId": { "description": "获取当前活跃项目的 ID", "params": {} }
                }
            },
            "document": {
                "actions": {
                    "list": { "description": "列出项目中的文档", "params": { "projectId": "string (必填)" } },
                    "get": { "description": "获取文档详情", "params": { "projectId": "string", "documentId": "string" } },
                    "create": { "description": "创建新文档", "params": { "projectId": "string", "title?": "string", "author?": "string" } },
                    "save": { "description": "保存文档", "params": { "projectId": "string", "documentId": "string", "title?": "string", "content?": "string" } }
                }
            },
            "project": {
                "actions": {
                    "list": { "description": "列出所有项目", "params": {} }
                }
            },
            "search": {
                "actions": {
                    "documents": { "description": "搜索文档", "params": { "query": "string", "projectId?": "string" } }
                }
            },
            "ai": {
                "actions": {
                    "chat": { "description": "AI 对话（使用用户配置的 AI 服务）", "params": { "messages": "array[{role,content}] (必填)", "system_prompt?": "string (系统提示，自动注入到 messages 最前)", "temperature?": "number (0-2, 默认0.7)", "max_tokens?": "number" } },
                    "generate": { "description": "AI 内容生成（快捷方式，自动构建 user 消息）", "params": { "prompt": "string (必填)", "system_prompt?": "string (系统提示)", "temperature?": "number", "max_tokens?": "number" } }
                }
            },
            "export": {
                "actions": {
                    "markdown": { "description": "导出为 Markdown 文件", "params": { "content|projectId+documentId": "二选一", "title?": "string", "outputPath?": "string (默认 ~/AiDocPlus/exports/)" } },
                    "html": { "description": "导出为 HTML（公文排版）", "params": { "content|projectId+documentId": "二选一", "title?": "string", "outputPath?": "string" } },
                    "docx": { "description": "导出为 Word（公文排版）", "params": { "content|projectId+documentId": "二选一", "title?": "string", "outputPath?": "string" } },
                    "pdf": { "description": "导出为 PDF（浏览器打印）", "params": { "content|projectId+documentId": "二选一", "title?": "string", "outputPath?": "string" } },
                    "txt": { "description": "导出为纯文本", "params": { "content|projectId+documentId": "二选一", "title?": "string", "outputPath?": "string" } }
                }
            },
            "email": {
                "actions": {
                    "send": { "description": "发送邮件" },
                    "testConnection": { "description": "测试 SMTP 连接" }
                }
            },
            "template": {
                "actions": {
                    "list": { "description": "列出所有提示词模板（内置 + 自定义）", "params": {} },
                    "getContent": { "description": "获取指定模板的完整内容", "params": { "templateId": "string (必填)" } }
                }
            },
            "plugin": {
                "actions": {
                    "list": { "description": "列出已安装的插件", "params": {} },
                    "storage.get": { "description": "读取插件存储数据", "params": { "pluginId": "string (必填)", "key?": "string (可选，不传返回整个存储)" } },
                    "storage.set": { "description": "写入插件存储数据", "params": { "pluginId": "string (必填)", "key": "string (必填)", "value": "any (必填)" } }
                }
            },
            "tts": {
                "actions": {
                    "speak": { "description": "朗读文本" },
                    "stop": { "description": "停止朗读" },
                    "listVoices": { "description": "列出可用语音" }
                }
            },
            "file": {
                "actions": {
                    "read": { "description": "读取文件（限 ~/AiDocPlus/ 下）", "params": { "path": "string (必填)" } },
                    "write": { "description": "写入文件（限 ~/AiDocPlus/ 下）", "params": { "path": "string (必填)", "content": "string (必填)" } },
                    "metadata": { "description": "获取文件元数据（限 ~/AiDocPlus/ 下）", "params": { "path": "string (必填)" } }
                }
            },
            "script": {
                "actions": {
                    "listFiles": { "description": "列出 ~/AiDocPlus/CodingScripts/ 下的脚本文件", "params": {} }
                }
            }
        }
    })
}
