#[tauri::command]
pub fn open_resource_manager(
    app_handle: tauri::AppHandle,
    managerName: String,
) -> Result<(), String> {
    use tauri::Manager;
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    // 管理器名称 → 资源类型标识映射
    let resource_type = match managerName.as_str() {
        "提示词模板管理器" => "prompt-templates",
        "文档模板管理器" => "doc-templates",
        _ => return Err(format!("未知管理器: {}", managerName)),
    };

    // 计算数据目录（find_prompt_templates_dir 已处理 dev/release 模式切换）
    let data_dir = match resource_type {
        "prompt-templates" => find_prompt_templates_dir(),
        "doc-templates" => {
            if cfg!(debug_assertions) {
                let src_repo = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent().and_then(|p| p.parent()).and_then(|p| p.parent())
                    .map(|workspace_root| workspace_root.parent().unwrap_or(workspace_root).to_path_buf())
                    .map(|parent| parent.join("AiDocPlus-DocTemplates").join("dist").join("json"));
                src_repo.filter(|p| p.exists())
                    .or_else(|| crate::paths::bundled_sub_dir("document-templates"))
            } else {
                crate::paths::bundled_sub_dir("document-templates")
            }
        }
        _ => None,
    };

    eprintln!("[DEBUG] open_resource_manager (multi-window): resource_type={}, data_dir={:?}", resource_type, data_dir);

    let window_label = "resource-manager";

    // 如果窗口已存在，聚焦并返回
    if let Some(existing) = app_handle.get_webview_window(window_label) {
        let _ = existing.set_focus();
        return Ok(());
    }

    // 构建 URL：开发模式用 dev server，发布模式用构建产物
    let mut url_str = if cfg!(debug_assertions) {
        format!("http://localhost:5173/manager.html?resource-type={}", resource_type)
    } else {
        format!("manager.html?resource-type={}", resource_type)
    };
    if let Some(ref dir) = data_dir {
        let encoded = dir.to_string_lossy().to_string()
            .replace('%', "%25")
            .replace(' ', "%20")
            .replace('#', "%23");
        url_str.push_str(&format!("&data-dir={}", encoded));
    }

    let url = if cfg!(debug_assertions) {
        WebviewUrl::External(url_str.parse().map_err(|e| format!("URL 解析失败: {}", e))?)
    } else {
        WebviewUrl::App(url_str.into())
    };

    WebviewWindowBuilder::new(&app_handle, window_label, url)
        .title("资源管理器")
        .inner_size(1100.0, 750.0)
        .min_inner_size(800.0, 500.0)
        .resizable(true)
        .build()
        .map_err(|e| format!("创建管理器窗口失败: {}", e))?;

    Ok(())
}

// ═══════════════════════════════════════════════════════════════
// 提示词模板（简化版：每个分类一个 JSON 文件 + 用户自定义 custom.json）
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PromptTemplateInfo {
    pub id: String,
    pub name: String,
    pub category: String,
    pub content: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub variables: Vec<String>,
    #[serde(rename = "isBuiltIn", default)]
    pub is_built_in: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PromptCategoryInfo {
    pub key: String,
    pub name: String,
    #[serde(default)]
    pub icon: String,
    #[serde(rename = "isBuiltIn", default)]
    pub is_built_in: bool,
}

/// 分类 JSON 文件结构
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct CategoryJsonFile {
    key: String,
    name: String,
    #[serde(default)]
    icon: String,
    #[serde(default)]
    order: i32,
    #[serde(default)]
    templates: Vec<CategoryJsonTemplate>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct CategoryJsonTemplate {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    content: String,
    #[serde(default)]
    variables: Vec<String>,
    #[serde(default)]
    order: i32,
}

/// 用户自定义模板 JSON 文件结构（~/AiDocPlus/PromptTemplates/custom.json）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct CustomTemplatesFile {
    #[serde(default)]
    templates: Vec<CustomTemplateEntry>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct CustomTemplateEntry {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    content: String,
    #[serde(default)]
    variables: Vec<String>,
}

/// 查找提示词模板数据目录：
/// - 开发模式：优先使用源仓库 AiDocPlus-PromptTemplates/data/
/// - 发布模式：使用 bundled-resources/prompt-templates/
fn find_prompt_templates_dir() -> Option<std::path::PathBuf> {
    if cfg!(debug_assertions) {
        let src_repo = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent().and_then(|p| p.parent()).and_then(|p| p.parent())
            .map(|workspace_root| workspace_root.parent().unwrap_or(workspace_root).to_path_buf())
            .map(|parent| parent.join("AiDocPlus-PromptTemplates").join("data"));
        if let Some(ref path) = src_repo {
            if path.exists() {
                return src_repo;
            }
        }
    }
    crate::paths::bundled_sub_dir("prompt-templates")
}

/// 获取用户自定义模板文件路径：~/AiDocPlus/PromptTemplates/custom.json
fn get_custom_templates_path() -> std::path::PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join("AiDocPlus").join("PromptTemplates").join("custom.json")
}

/// 读取用户自定义模板文件
fn read_custom_templates() -> CustomTemplatesFile {
    let path = get_custom_templates_path();
    if !path.exists() {
        return CustomTemplatesFile { templates: Vec::new() };
    }
    match std::fs::read_to_string(&path) {
        Ok(json_str) => serde_json::from_str(&json_str).unwrap_or(CustomTemplatesFile { templates: Vec::new() }),
        Err(_) => CustomTemplatesFile { templates: Vec::new() },
    }
}

/// 写入用户自定义模板文件
fn write_custom_templates(data: &CustomTemplatesFile) -> Result<(), String> {
    let path = get_custom_templates_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let json_str = serde_json::to_string_pretty(data)
        .map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&path, json_str)
        .map_err(|e| format!("写入 custom.json 失败: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn list_prompt_templates() -> Result<Vec<PromptTemplateInfo>, String> {
    let mut templates = Vec::new();

    // 1. 从 bundled-resources/prompt-templates/*.json 加载内置模板
    if let Some(templates_dir) = find_prompt_templates_dir() {
        if let Ok(entries) = std::fs::read_dir(&templates_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                if let Ok(json_str) = std::fs::read_to_string(&path) {
                    if let Ok(cat_file) = serde_json::from_str::<CategoryJsonFile>(&json_str) {
                        for tmpl in &cat_file.templates {
                            templates.push(PromptTemplateInfo {
                                id: tmpl.id.clone(),
                                name: tmpl.name.clone(),
                                category: cat_file.key.clone(),
                                content: tmpl.content.clone(),
                                description: if tmpl.description.is_empty() { None } else { Some(tmpl.description.clone()) },
                                variables: tmpl.variables.clone(),
                                is_built_in: true,
                            });
                        }
                    }
                }
            }
        }
    }

    // 2. 从 ~/AiDocPlus/PromptTemplates/custom.json 加载用户自定义模板
    let custom = read_custom_templates();
    for tmpl in &custom.templates {
        templates.push(PromptTemplateInfo {
            id: tmpl.id.clone(),
            name: tmpl.name.clone(),
            category: tmpl.category.clone(),
            content: tmpl.content.clone(),
            description: if tmpl.description.is_empty() { None } else { Some(tmpl.description.clone()) },
            variables: tmpl.variables.clone(),
            is_built_in: false,
        });
    }

    Ok(templates)
}

#[tauri::command]
pub fn list_prompt_template_categories() -> Result<Vec<PromptCategoryInfo>, String> {
    let templates_dir = find_prompt_templates_dir()
        .ok_or_else(|| "未找到 bundled-resources/prompt-templates 目录".to_string())?;

    let mut items: Vec<(i32, PromptCategoryInfo)> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&templates_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(json_str) = std::fs::read_to_string(&path) {
                if let Ok(cat_file) = serde_json::from_str::<CategoryJsonFile>(&json_str) {
                    items.push((cat_file.order, PromptCategoryInfo {
                        key: cat_file.key,
                        name: cat_file.name,
                        icon: if cat_file.icon.is_empty() { "📋".to_string() } else { cat_file.icon },
                        is_built_in: true,
                    }));
                }
            }
        }
    }

    // 按 order 排序
    items.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.key.cmp(&b.1.key)));
    let result: Vec<PromptCategoryInfo> = items.into_iter().map(|(_, info)| info).collect();

    Ok(result)
}

// ═══════════════════════════════════════════════════════════════
// 用户自定义提示词模板 CRUD（存储在 ~/AiDocPlus/PromptTemplates/custom.json）
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SaveCustomPromptTemplateRequest {
    pub id: String,
    pub name: String,
    pub category: String,
    pub content: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub variables: Vec<String>,
}

#[tauri::command]
pub fn save_custom_prompt_template(template: SaveCustomPromptTemplateRequest) -> Result<(), String> {
    let mut custom = read_custom_templates();

    let entry = CustomTemplateEntry {
        id: template.id.clone(),
        name: template.name,
        category: template.category,
        description: template.description.unwrap_or_default(),
        content: template.content,
        variables: template.variables,
    };

    // 更新或追加
    if let Some(existing) = custom.templates.iter_mut().find(|t| t.id == template.id) {
        *existing = entry;
    } else {
        custom.templates.push(entry);
    }

    write_custom_templates(&custom)
}

#[tauri::command]
pub fn delete_custom_prompt_template(id: String) -> Result<(), String> {
    let mut custom = read_custom_templates();
    let before = custom.templates.len();
    custom.templates.retain(|t| t.id != id);
    if custom.templates.len() < before {
        write_custom_templates(&custom)?;
    }
    Ok(())
}

// ═══════════════════════════════════════════════════════════════
// 批量导入/导出自定义提示词模板（JSON 格式）
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, serde::Serialize)]
pub struct PromptTemplateImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub total: usize,
}

/// 导出所有自定义提示词模板为 JSON 文件
#[tauri::command]
pub fn export_custom_prompt_templates(output_path: String) -> Result<String, String> {
    let custom = read_custom_templates();
    if custom.templates.is_empty() {
        return Err("没有自定义模板可导出".to_string());
    }

    let json_str = serde_json::to_string_pretty(&custom)
        .map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&output_path, json_str)
        .map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(format!("已导出 {} 个自定义模板", custom.templates.len()))
}

/// 从 JSON 文件批量导入自定义提示词模板
#[tauri::command]
pub fn import_custom_prompt_templates(json_path: String) -> Result<PromptTemplateImportResult, String> {
    let json_str = std::fs::read_to_string(&json_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    let imported_file: CustomTemplatesFile = serde_json::from_str(&json_str)
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;

    let total = imported_file.templates.len();
    let mut custom = read_custom_templates();
    let existing_ids: std::collections::HashSet<String> = custom.templates.iter().map(|t| t.id.clone()).collect();

    let mut imported = 0usize;
    let mut skipped = 0usize;

    for tmpl in imported_file.templates {
        if existing_ids.contains(&tmpl.id) {
            skipped += 1;
        } else {
            custom.templates.push(tmpl);
            imported += 1;
        }
    }

    write_custom_templates(&custom)?;

    Ok(PromptTemplateImportResult {
        imported,
        skipped,
        total,
    })
}
