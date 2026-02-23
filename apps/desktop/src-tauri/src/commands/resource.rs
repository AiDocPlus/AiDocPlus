use tauri::State;
use crate::resource_engine::{ResourceEngineState, ResourceFilter, ResourceSummary, ResourceStats, CategoryInfo};

#[tauri::command]
pub fn resource_list(
    state: State<'_, ResourceEngineState>,
    resource_type: Option<String>,
    major_category: Option<String>,
    sub_category: Option<String>,
    source: Option<String>,
    enabled: Option<bool>,
    limit: Option<u32>,
    offset: Option<u32>,
    sort_by: Option<String>,
    sort_order: Option<String>,
) -> Result<Vec<ResourceSummary>, String> {
    let filter = ResourceFilter {
        resource_type,
        major_category,
        sub_category,
        source,
        enabled,
        query: None,
        limit,
        offset,
        sort_by,
        sort_order,
    };
    state.with_engine(|engine| engine.list(&filter))
}

#[tauri::command]
pub fn resource_search(
    state: State<'_, ResourceEngineState>,
    query: String,
    resource_type: Option<String>,
    source: Option<String>,
    enabled: Option<bool>,
) -> Result<Vec<ResourceSummary>, String> {
    let filter = ResourceFilter {
        resource_type,
        major_category: None,
        sub_category: None,
        source,
        enabled,
        query: Some(query.clone()),
        limit: Some(100),
        offset: None,
        sort_by: None,
        sort_order: None,
    };
    state.with_engine(|engine| engine.search(&query, &filter))
}

#[tauri::command]
pub fn resource_get(
    state: State<'_, ResourceEngineState>,
    id: String,
) -> Result<Option<String>, String> {
    state.with_engine(|engine| engine.get(&id))
}

#[tauri::command]
pub fn resource_set_enabled(
    state: State<'_, ResourceEngineState>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    state.with_engine(|engine| engine.set_enabled(&id, enabled))
}

#[tauri::command]
pub fn resource_stats(
    state: State<'_, ResourceEngineState>,
) -> Result<ResourceStats, String> {
    state.with_engine(|engine| engine.get_stats())
}

#[tauri::command]
pub fn resource_categories(
    state: State<'_, ResourceEngineState>,
    resource_type: String,
) -> Result<Vec<CategoryInfo>, String> {
    state.with_engine(|engine| engine.list_categories(&resource_type))
}

/// Copy-on-Write 保存资源：builtin 资源首次修改时自动复制到用户目录
#[tauri::command]
pub fn resource_save(
    state: State<'_, ResourceEngineState>,
    id: String,
    manifest_json: String,
    content_files: Vec<(String, String)>,
) -> Result<(), String> {
    state.with_engine(|engine| engine.save_resource_cow(&id, &manifest_json, &content_files))
}

#[tauri::command]
pub fn resource_rebuild_index(
    state: State<'_, ResourceEngineState>,
) -> Result<(), String> {
    state.with_engine(|engine| {
        engine.rebuild_index_from_local()?;
        Ok(())
    })
}

#[tauri::command]
pub fn open_resource_manager(managerName: String) -> Result<(), String> {
    // 通过集中式路径模块查找 managers 目录（跨平台兼容）
    let managers_dir = crate::paths::bundled_sub_dir("managers")
        .ok_or_else(|| "未找到 bundled-resources/managers 目录".to_string())?;

    // 管理器名称 → 资源类型标识映射（统一管理器使用 --resource-type 参数）
    let resource_type = match managerName.as_str() {
        "提示词模板管理器" => "prompt-templates",
        "文档模板管理器" => "doc-templates",
        _ => return Err(format!("未知管理器: {}", managerName)),
    };

    // 计算数据目录：均从 bundled-resources 中查找
    let data_dir = match resource_type {
        "prompt-templates" => find_prompt_templates_dir(),
        "doc-templates" => crate::paths::bundled_sub_dir("document-templates"),
        _ => None,
    };

    // DEBUG: 输出启动信息
    eprintln!("[DEBUG] open_resource_manager: managerName={}, resource_type={}, data_dir={:?}", managerName, resource_type, data_dir);

    #[cfg(target_os = "macos")]
    {
        let app_path = managers_dir.join("资源管理器.app");
        if !app_path.exists() {
            return Err(format!("管理器未找到: {}", app_path.display()));
        }
        let mut cmd = std::process::Command::new("open");
        cmd.arg("-a").arg(&app_path)
            .arg("--args")
            .arg("--resource-type").arg(resource_type);
        if let Some(ref dir) = data_dir {
            cmd.arg("--data-dir").arg(dir);
        }
        cmd.spawn()
            .map_err(|e| format!("启动管理器失败: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

        let exe_path = managers_dir.join("resource-manager.exe");
        if !exe_path.exists() {
            return Err(format!("管理器未找到: {}", exe_path.display()));
        }
        let mut cmd = std::process::Command::new(&exe_path);
        cmd.arg("--resource-type").arg(resource_type);
        if let Some(ref dir) = data_dir {
            cmd.arg("--data-dir").arg(dir);
        }
        // 为资源管理器指定独立的 WebView2 用户数据目录，避免与主程序冲突
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let webview2_dir = std::path::PathBuf::from(local_app_data)
                .join("com.aidocplus.resource-manager")
                .join("EBWebView");
            cmd.env("WEBVIEW2_USER_DATA_FOLDER", &webview2_dir);
        }
        // CREATE_NEW_PROCESS_GROUP: 让子进程独立运行，不随父进程退出
        cmd.creation_flags(CREATE_NEW_PROCESS_GROUP);
        cmd.spawn()
            .map_err(|e| format!("启动管理器失败: {} (路径: {})", e, exe_path.display()))?;
    }

    #[cfg(target_os = "linux")]
    {
        let exe_path = managers_dir.join("resource-manager");
        if !exe_path.exists() {
            return Err(format!("管理器未找到: {}", exe_path.display()));
        }
        let mut cmd = std::process::Command::new(&exe_path);
        cmd.arg("--resource-type").arg(resource_type);
        if let Some(ref dir) = data_dir {
            cmd.arg("--data-dir").arg(dir);
        }
        cmd.spawn()
            .map_err(|e| format!("启动管理器失败: {}", e))?;
    }

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

/// 查找 bundled-resources/prompt-templates 目录（通过集中式路径模块，跨平台兼容）
fn find_prompt_templates_dir() -> Option<std::path::PathBuf> {
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
