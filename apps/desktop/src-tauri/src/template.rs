use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 模板 Manifest — 轻量元数据，用于列表展示
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateManifest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub author: String,
    #[serde(rename = "type", default = "default_template_type")]
    pub template_type: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(rename = "createdAt", default)]
    pub created_at: i64,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: i64,
    #[serde(rename = "includeContent", default)]
    pub include_content: bool,
    #[serde(rename = "includeAiContent", default)]
    pub include_ai_content: bool,
    #[serde(rename = "enabledPlugins", default)]
    pub enabled_plugins: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "pluginData")]
    pub plugin_data: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "minAppVersion")]
    pub min_app_version: Option<String>,
}

/// 模板内容 — 按需加载
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateContent {
    #[serde(rename = "authorNotes", default)]
    pub author_notes: String,
    #[serde(rename = "aiGeneratedContent", default)]
    pub ai_generated_content: String,
    #[serde(default)]
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "pluginData")]
    pub plugin_data: Option<serde_json::Value>,
}

fn default_template_type() -> String {
    "custom".to_string()
}

/// 获取模板目录路径
pub fn get_templates_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("AiDocPlus").join("Templates")
}

/// 确保模板目录存在（应用启动时调用）
pub fn ensure_templates_dir() {
    let templates_dir = get_templates_dir();
    if let Err(e) = fs::create_dir_all(&templates_dir) {
        eprintln!("Failed to create templates directory: {}", e);
    }
}

/// 扫描模板目录，返回所有 manifest（内置 + 用户自定义）
pub fn list_templates() -> Vec<TemplateManifest> {
    let mut templates = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    // 1. 先加载用户自定义模板（优先级高，可覆盖内置）
    let templates_dir = get_templates_dir();
    if templates_dir.exists() {
        if let Ok(entries) = fs::read_dir(&templates_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let manifest_path = path.join("template.json");
                if !manifest_path.exists() {
                    continue;
                }
                match fs::read_to_string(&manifest_path) {
                    Ok(json) => match serde_json::from_str::<TemplateManifest>(&json) {
                        Ok(manifest) => {
                            seen_ids.insert(manifest.id.clone());
                            templates.push(manifest);
                        }
                        Err(e) => eprintln!("Failed to parse template manifest {:?}: {}", manifest_path, e),
                    },
                    Err(e) => eprintln!("Failed to read template manifest {:?}: {}", manifest_path, e),
                }
            }
        }
    }

    // 2. 加载内置项目模板（bundled-resources/project-templates/）
    if let Some(builtin) = load_builtin_templates() {
        for manifest in builtin {
            if !seen_ids.contains(&manifest.id) {
                seen_ids.insert(manifest.id.clone());
                templates.push(manifest);
            }
        }
    }

    templates
}

/// 从 bundled-resources/project-templates 递归加载内置模板 manifest
fn load_builtin_templates() -> Option<Vec<TemplateManifest>> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let bundled_dir = exe_dir.join("bundled-resources").join("project-templates");
    if !bundled_dir.exists() {
        return None;
    }
    let mut templates = Vec::new();
    scan_manifests_recursive(&bundled_dir, &mut templates);
    Some(templates)
}

/// 递归扫描目录中的 manifest.json 文件
fn scan_manifests_recursive(dir: &std::path::Path, templates: &mut Vec<TemplateManifest>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // 检查该目录是否包含 manifest.json
            let manifest_path = path.join("manifest.json");
            if manifest_path.exists() {
                if let Ok(json) = fs::read_to_string(&manifest_path) {
                    // 内置模板的 manifest.json 字段名与 template.json 略有不同，需要适配
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json) {
                        let manifest = TemplateManifest {
                            id: value.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            name: value.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            description: value.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            icon: value.get("icon").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            author: value.get("author").and_then(|v| v.as_str()).unwrap_or("AiDocPlus").to_string(),
                            template_type: "builtin".to_string(),
                            category: value.get("majorCategory").and_then(|v| v.as_str()).unwrap_or("general").to_string(),
                            tags: value.get("tags")
                                .and_then(|v| v.as_array())
                                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                                .unwrap_or_default(),
                            created_at: 0,
                            updated_at: 0,
                            include_content: true,
                            include_ai_content: false,
                            enabled_plugins: Vec::new(),
                            plugin_data: None,
                            min_app_version: None,
                        };
                        if !manifest.id.is_empty() {
                            templates.push(manifest);
                        }
                    }
                }
            }
            // 继续递归子目录
            scan_manifests_recursive(&path, templates);
        }
    }
}

/// 读取指定模板的内容（先查用户目录，再查 bundled-resources）
pub fn get_template_content(template_id: &str) -> Result<TemplateContent, String> {
    // 1. 先查用户自定义模板目录
    let templates_dir = get_templates_dir();
    let content_path = templates_dir.join(template_id).join("content.json");
    if content_path.exists() {
        let json = fs::read_to_string(&content_path)
            .map_err(|e| format!("Failed to read template content: {}", e))?;
        let content: TemplateContent = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse template content: {}", e))?;
        return Ok(content);
    }

    // 2. 查 bundled-resources/project-templates 中的内置模板
    if let Some(content) = find_builtin_template_content(template_id) {
        return Ok(content);
    }

    Err(format!("Template content not found: {}", template_id))
}

/// 在 bundled-resources/project-templates 中递归查找指定 ID 的 content.json
fn find_builtin_template_content(template_id: &str) -> Option<TemplateContent> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let bundled_dir = exe_dir.join("bundled-resources").join("project-templates");
    find_content_recursive(&bundled_dir, template_id)
}

fn find_content_recursive(dir: &std::path::Path, template_id: &str) -> Option<TemplateContent> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // 检查 manifest.json 的 id 是否匹配
            let manifest_path = path.join("manifest.json");
            if manifest_path.exists() {
                if let Ok(json) = fs::read_to_string(&manifest_path) {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json) {
                        if value.get("id").and_then(|v| v.as_str()) == Some(template_id) {
                            // 找到匹配的模板，读取 content.json
                            let content_path = path.join("content.json");
                            if content_path.exists() {
                                if let Ok(cjson) = fs::read_to_string(&content_path) {
                                    if let Ok(content) = serde_json::from_str::<TemplateContent>(&cjson) {
                                        return Some(content);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // 递归子目录
            if let Some(content) = find_content_recursive(&path, template_id) {
                return Some(content);
            }
        }
    }
    None
}

/// 创建模板（写入 manifest 和 content）
pub fn create_template(manifest: TemplateManifest, content: TemplateContent) -> Result<TemplateManifest, String> {
    let templates_dir = get_templates_dir();
    let template_dir = templates_dir.join(&manifest.id);
    fs::create_dir_all(&template_dir)
        .map_err(|e| format!("Failed to create template dir: {}", e))?;

    let mut manifest = manifest;
    let now = chrono::Utc::now().timestamp();
    if manifest.created_at == 0 {
        manifest.created_at = now;
    }
    manifest.updated_at = now;

    // 写入 manifest
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize template manifest: {}", e))?;
    fs::write(template_dir.join("template.json"), manifest_json)
        .map_err(|e| format!("Failed to write template manifest: {}", e))?;

    // 写入 content
    let content_json = serde_json::to_string_pretty(&content)
        .map_err(|e| format!("Failed to serialize template content: {}", e))?;
    fs::write(template_dir.join("content.json"), content_json)
        .map_err(|e| format!("Failed to write template content: {}", e))?;

    Ok(manifest)
}

/// 更新模板 manifest（可选更新 content）
pub fn update_template(
    template_id: &str,
    name: Option<String>,
    description: Option<String>,
    category: Option<String>,
    icon: Option<String>,
    tags: Option<Vec<String>>,
    content: Option<TemplateContent>,
) -> Result<TemplateManifest, String> {
    let templates_dir = get_templates_dir();
    let template_dir = templates_dir.join(template_id);
    let manifest_path = template_dir.join("template.json");

    if !manifest_path.exists() {
        return Err(format!("Template not found: {}", template_id));
    }

    let json = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read template manifest: {}", e))?;
    let mut manifest: TemplateManifest = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse template manifest: {}", e))?;

    if let Some(n) = name { manifest.name = n; }
    if let Some(d) = description { manifest.description = d; }
    if let Some(c) = category { manifest.category = c; }
    if let Some(i) = icon { manifest.icon = i; }
    if let Some(t) = tags { manifest.tags = t; }
    manifest.updated_at = chrono::Utc::now().timestamp();

    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize template manifest: {}", e))?;
    fs::write(&manifest_path, manifest_json)
        .map_err(|e| format!("Failed to write template manifest: {}", e))?;

    // 可选更新 content
    if let Some(c) = content {
        let content_json = serde_json::to_string_pretty(&c)
            .map_err(|e| format!("Failed to serialize template content: {}", e))?;
        fs::write(template_dir.join("content.json"), content_json)
            .map_err(|e| format!("Failed to write template content: {}", e))?;
    }

    Ok(manifest)
}

/// 删除模板
pub fn delete_template(template_id: &str) -> Result<(), String> {
    let templates_dir = get_templates_dir();
    let template_dir = templates_dir.join(template_id);

    if !template_dir.exists() {
        return Err(format!("Template not found: {}", template_id));
    }

    fs::remove_dir_all(&template_dir)
        .map_err(|e| format!("Failed to delete template: {}", e))?;

    Ok(())
}

/// 复制模板
pub fn duplicate_template(template_id: &str, new_name: &str) -> Result<TemplateManifest, String> {
    let templates_dir = get_templates_dir();
    let source_dir = templates_dir.join(template_id);

    if !source_dir.exists() {
        return Err(format!("Template not found: {}", template_id));
    }

    // 读取源 manifest
    let manifest_json = fs::read_to_string(source_dir.join("template.json"))
        .map_err(|e| format!("Failed to read source manifest: {}", e))?;
    let source_manifest: TemplateManifest = serde_json::from_str(&manifest_json)
        .map_err(|e| format!("Failed to parse source manifest: {}", e))?;

    // 读取源 content
    let content = if source_dir.join("content.json").exists() {
        let content_json = fs::read_to_string(source_dir.join("content.json"))
            .map_err(|e| format!("Failed to read source content: {}", e))?;
        serde_json::from_str::<TemplateContent>(&content_json)
            .map_err(|e| format!("Failed to parse source content: {}", e))?
    } else {
        TemplateContent {
            author_notes: String::new(),
            ai_generated_content: String::new(),
            content: String::new(),
            plugin_data: None,
        }
    };

    // 创建新模板
    let new_id = uuid::Uuid::new_v4().to_string();
    let new_manifest = TemplateManifest {
        id: new_id,
        name: new_name.to_string(),
        template_type: "custom".to_string(),
        created_at: 0, // will be set by create_template
        updated_at: 0,
        ..source_manifest
    };

    create_template(new_manifest, content)
}

// ═══════════════════════════════════════════════════════════════
// 模板分类管理（持久化到 ~/AiDocPlus/Templates/categories.json）
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateCategory {
    pub key: String,
    pub label: String,
    #[serde(default)]
    pub order: i32,
    #[serde(rename = "type", default = "default_category_type")]
    pub category_type: String,
}

fn default_category_type() -> String {
    "custom".to_string()
}

/// 内置默认分类（优先从 bundled-resources 读取，fallback 到硬编码）
fn default_categories() -> Vec<TemplateCategory> {
    // 尝试从 bundled-resources/document-templates/_meta.json 读取
    if let Some(cats) = load_categories_from_bundled() {
        if !cats.is_empty() {
            return cats;
        }
    }
    // Fallback: 硬编码默认分类
    vec![
        TemplateCategory { key: "report".into(),      label: "报告".into(),     order: 0, category_type: "builtin".into() },
        TemplateCategory { key: "article".into(),      label: "文章".into(),     order: 1, category_type: "builtin".into() },
        TemplateCategory { key: "email-draft".into(),  label: "邮件草稿".into(), order: 2, category_type: "builtin".into() },
        TemplateCategory { key: "meeting".into(),      label: "会议纪要".into(), order: 3, category_type: "builtin".into() },
        TemplateCategory { key: "creative".into(),     label: "创意写作".into(), order: 4, category_type: "builtin".into() },
        TemplateCategory { key: "technical".into(),    label: "技术文档".into(), order: 5, category_type: "builtin".into() },
        TemplateCategory { key: "general".into(),      label: "通用".into(),     order: 6, category_type: "builtin".into() },
    ]
}

/// 从 bundled-resources 加载分类定义
fn load_categories_from_bundled() -> Option<Vec<TemplateCategory>> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let meta_path = exe_dir.join("bundled-resources").join("document-templates").join("_meta.json");
    if !meta_path.exists() {
        return None;
    }
    let content = fs::read_to_string(&meta_path).ok()?;
    let meta: serde_json::Value = serde_json::from_str(&content).ok()?;
    let categories = meta.get("categories")?.as_array()?;
    let mut result = Vec::new();
    for cat in categories {
        let key = cat.get("key")?.as_str()?.to_string();
        let name = cat.get("name")?.as_str()?.to_string();
        let order = cat.get("order").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        result.push(TemplateCategory {
            key,
            label: name,
            order,
            category_type: "builtin".to_string(),
        });
    }
    Some(result)
}

fn categories_path() -> PathBuf {
    get_templates_dir().join("categories.json")
}

/// 读取分类列表（不存在则初始化默认分类）
pub fn list_template_categories() -> Vec<TemplateCategory> {
    let path = categories_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(json) => match serde_json::from_str::<Vec<TemplateCategory>>(&json) {
                Ok(mut cats) => {
                    cats.sort_by_key(|c| c.order);
                    return cats;
                }
                Err(e) => eprintln!("Failed to parse categories.json: {}", e),
            },
            Err(e) => eprintln!("Failed to read categories.json: {}", e),
        }
    }
    // 首次使用，写入默认分类
    let cats = default_categories();
    let _ = save_categories(&cats);
    cats
}

fn save_categories(cats: &[TemplateCategory]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(cats)
        .map_err(|e| format!("Failed to serialize categories: {}", e))?;
    ensure_templates_dir();
    fs::write(categories_path(), json)
        .map_err(|e| format!("Failed to write categories.json: {}", e))?;
    Ok(())
}

/// 创建分类
pub fn create_template_category(key: &str, label: &str) -> Result<Vec<TemplateCategory>, String> {
    let mut cats = list_template_categories();
    if cats.iter().any(|c| c.key == key) {
        return Err(format!("Category key already exists: {}", key));
    }
    let max_order = cats.iter().map(|c| c.order).max().unwrap_or(-1);
    cats.push(TemplateCategory {
        key: key.to_string(),
        label: label.to_string(),
        order: max_order + 1,
        category_type: "custom".to_string(),
    });
    save_categories(&cats)?;
    Ok(cats)
}

/// 更新分类
pub fn update_template_category(key: &str, label: Option<String>, new_key: Option<String>) -> Result<Vec<TemplateCategory>, String> {
    let mut cats = list_template_categories();

    // 先检查 new_key 冲突（不可变借用）
    if let Some(ref nk) = new_key {
        if nk != key && cats.iter().any(|c| c.key == *nk) {
            return Err(format!("Category key already exists: {}", nk));
        }
    }

    // 再查找并修改（可变借用）
    let cat = cats.iter_mut().find(|c| c.key == key)
        .ok_or_else(|| format!("Category not found: {}", key))?;

    if let Some(l) = label {
        cat.label = l;
    }
    if let Some(nk) = new_key {
        cat.key = nk;
    }
    save_categories(&cats)?;
    Ok(cats)
}

/// 删除分类
pub fn delete_template_category(key: &str) -> Result<Vec<TemplateCategory>, String> {
    let mut cats = list_template_categories();
    let len_before = cats.len();
    cats.retain(|c| c.key != key);
    if cats.len() == len_before {
        return Err(format!("Category not found: {}", key));
    }
    save_categories(&cats)?;
    Ok(cats)
}

/// 重新排序分类（接收有序的 key 列表）
pub fn reorder_template_categories(ordered_keys: &[String]) -> Result<Vec<TemplateCategory>, String> {
    let mut cats = list_template_categories();
    for (i, key) in ordered_keys.iter().enumerate() {
        if let Some(cat) = cats.iter_mut().find(|c| &c.key == key) {
            cat.order = i as i32;
        }
    }
    cats.sort_by_key(|c| c.order);
    save_categories(&cats)?;
    Ok(cats)
}
