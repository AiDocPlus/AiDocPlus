use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// ═══════════════════════════════════════════════════════════════
// 公开数据结构（前端交互用）
// ═══════════════════════════════════════════════════════════════

/// 文档模板 Manifest — 轻量元数据，用于列表展示
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocTemplateManifest {
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
    #[serde(rename = "isBuiltIn", default)]
    pub is_built_in: bool,
}

/// 文档模板内容 — 按需加载
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocTemplateContent {
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

// ═══════════════════════════════════════════════════════════════
// 内置模板 JSON 文件结构（bundled-resources/document-templates/*.json）
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Deserialize)]
struct CategoryJsonFile {
    key: String,
    name: String,
    #[serde(default)]
    icon: String,
    #[serde(default)]
    order: i32,
    #[serde(default)]
    templates: Vec<BuiltinJsonTemplate>,
}

#[derive(Debug, Clone, Deserialize)]
struct BuiltinJsonTemplate {
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    description: String,
    #[serde(rename = "authorNotes", default)]
    author_notes: String,
    #[serde(default)]
    content: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    order: i32,
}

// ═══════════════════════════════════════════════════════════════
// 自定义模板 JSON 文件结构（~/AiDocPlus/DocTemplates/custom.json）
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomDocTemplatesFile {
    #[serde(default)]
    templates: Vec<CustomDocTemplateEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CustomDocTemplateEntry {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    category: String,
    #[serde(rename = "authorNotes", default)]
    author_notes: String,
    #[serde(default)]
    content: String,
    #[serde(rename = "aiGeneratedContent", default)]
    ai_generated_content: String,
    #[serde(rename = "includeContent", default)]
    include_content: bool,
    #[serde(rename = "includeAiContent", default)]
    include_ai_content: bool,
    #[serde(rename = "enabledPlugins", default)]
    enabled_plugins: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "pluginData")]
    plugin_data: Option<serde_json::Value>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(rename = "createdAt", default)]
    created_at: i64,
    #[serde(rename = "updatedAt", default)]
    updated_at: i64,
}

// ═══════════════════════════════════════════════════════════════
// 路径工具
// ═══════════════════════════════════════════════════════════════

/// 用户自定义文档模板目录
pub fn get_doc_templates_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("AiDocPlus").join("DocTemplates")
}

/// 确保文档模板目录存在
pub fn ensure_doc_templates_dir() {
    let templates_dir = get_doc_templates_dir();
    if let Err(e) = fs::create_dir_all(&templates_dir) {
        eprintln!("Failed to create doc templates directory: {}", e);
    }
}

fn custom_templates_path() -> PathBuf {
    get_doc_templates_dir().join("custom.json")
}

// ═══════════════════════════════════════════════════════════════
// 内置模板加载（从 bundled-resources/document-templates/*.json）
// ═══════════════════════════════════════════════════════════════

fn find_bundled_dir() -> Option<PathBuf> {
    crate::paths::bundled_sub_dir("document-templates")
}

/// 从 bundled-resources 加载所有内置分类 JSON 文件
fn load_bundled_category_files() -> Vec<CategoryJsonFile> {
    let mut result = Vec::new();
    let dir = match find_bundled_dir() {
        Some(d) if d.exists() => d,
        _ => return result,
    };
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            // 跳过 _meta.json 文件（格式不同，不是分类文件）
            if path.file_name().and_then(|n| n.to_str()) == Some("_meta.json") {
                continue;
            }
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(json_str) = fs::read_to_string(&path) {
                match serde_json::from_str::<CategoryJsonFile>(&json_str) {
                    Ok(cat_file) => result.push(cat_file),
                    Err(e) => eprintln!("Failed to parse bundled doc template {:?}: {}", path, e),
                }
            }
        }
    }
    result.sort_by_key(|c| c.order);
    result
}

// ═══════════════════════════════════════════════════════════════
// 自定义模板读写（~/AiDocPlus/DocTemplates/custom.json）
// ═══════════════════════════════════════════════════════════════

fn read_custom_templates() -> CustomDocTemplatesFile {
    let path = custom_templates_path();
    if path.exists() {
        if let Ok(json_str) = fs::read_to_string(&path) {
            if let Ok(file) = serde_json::from_str::<CustomDocTemplatesFile>(&json_str) {
                return file;
            }
        }
    }
    CustomDocTemplatesFile { templates: Vec::new() }
}

fn write_custom_templates(file: &CustomDocTemplatesFile) -> Result<(), String> {
    ensure_doc_templates_dir();
    let json = serde_json::to_string_pretty(file)
        .map_err(|e| format!("Failed to serialize custom templates: {}", e))?;
    fs::write(custom_templates_path(), json)
        .map_err(|e| format!("Failed to write custom.json: {}", e))?;
    Ok(())
}

// ═══════════════════════════════════════════════════════════════
// 公开 API：模板列表 / 内容读取
// ═══════════════════════════════════════════════════════════════

/// 列出所有文档模板（内置 + 自定义）
pub fn list_doc_templates() -> Vec<DocTemplateManifest> {
    let mut templates = Vec::new();

    // 1. 加载内置模板
    for cat_file in load_bundled_category_files() {
        for tmpl in &cat_file.templates {
            templates.push(DocTemplateManifest {
                id: tmpl.id.clone(),
                name: tmpl.name.clone(),
                description: tmpl.description.clone(),
                icon: String::new(),
                author: "AiDocPlus".to_string(),
                template_type: "builtin".to_string(),
                category: cat_file.key.clone(),
                tags: tmpl.tags.clone(),
                created_at: 0,
                updated_at: 0,
                include_content: true,
                include_ai_content: false,
                enabled_plugins: Vec::new(),
                plugin_data: None,
                min_app_version: None,
                is_built_in: true,
            });
        }
    }

    // 2. 加载自定义模板
    let custom = read_custom_templates();
    for entry in &custom.templates {
        templates.push(DocTemplateManifest {
            id: entry.id.clone(),
            name: entry.name.clone(),
            description: entry.description.clone(),
            icon: String::new(),
            author: String::new(),
            template_type: "custom".to_string(),
            category: entry.category.clone(),
            tags: entry.tags.clone(),
            created_at: entry.created_at,
            updated_at: entry.updated_at,
            include_content: entry.include_content,
            include_ai_content: entry.include_ai_content,
            enabled_plugins: entry.enabled_plugins.clone(),
            plugin_data: entry.plugin_data.clone(),
            min_app_version: None,
            is_built_in: false,
        });
    }

    templates
}

/// 读取指定文档模板的内容
pub fn get_doc_template_content(template_id: &str) -> Result<DocTemplateContent, String> {
    // 1. 先在内置模板中查找
    for cat_file in load_bundled_category_files() {
        if let Some(tmpl) = cat_file.templates.iter().find(|t| t.id == template_id) {
            return Ok(DocTemplateContent {
                author_notes: tmpl.author_notes.clone(),
                ai_generated_content: String::new(),
                content: tmpl.content.clone(),
                plugin_data: None,
            });
        }
    }

    // 2. 在自定义模板中查找
    let custom = read_custom_templates();
    if let Some(entry) = custom.templates.iter().find(|t| t.id == template_id) {
        return Ok(DocTemplateContent {
            author_notes: entry.author_notes.clone(),
            ai_generated_content: entry.ai_generated_content.clone(),
            content: entry.content.clone(),
            plugin_data: entry.plugin_data.clone(),
        });
    }

    Err(format!("Doc template content not found: {}", template_id))
}

// ═══════════════════════════════════════════════════════════════
// 公开 API：自定义模板 CRUD
// ═══════════════════════════════════════════════════════════════

/// 创建文档模板（保存到 custom.json）
pub fn create_doc_template(manifest: DocTemplateManifest, content: DocTemplateContent) -> Result<DocTemplateManifest, String> {
    let mut custom = read_custom_templates();
    let now = chrono::Utc::now().timestamp();

    let entry = CustomDocTemplateEntry {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        description: manifest.description.clone(),
        category: manifest.category.clone(),
        author_notes: content.author_notes,
        content: content.content,
        ai_generated_content: content.ai_generated_content,
        include_content: manifest.include_content,
        include_ai_content: manifest.include_ai_content,
        enabled_plugins: manifest.enabled_plugins.clone(),
        plugin_data: content.plugin_data.or(manifest.plugin_data.clone()),
        tags: manifest.tags.clone(),
        created_at: if manifest.created_at == 0 { now } else { manifest.created_at },
        updated_at: now,
    };

    custom.templates.push(entry);
    write_custom_templates(&custom)?;

    let mut result = manifest;
    if result.created_at == 0 {
        result.created_at = now;
    }
    result.updated_at = now;
    result.is_built_in = false;
    Ok(result)
}

/// 更新文档模板（仅自定义模板）
pub fn update_doc_template(
    template_id: &str,
    name: Option<String>,
    description: Option<String>,
    category: Option<String>,
    icon: Option<String>,
    tags: Option<Vec<String>>,
    content: Option<DocTemplateContent>,
) -> Result<DocTemplateManifest, String> {
    let mut custom = read_custom_templates();
    let entry = custom.templates.iter_mut().find(|t| t.id == template_id)
        .ok_or_else(|| format!("自定义模板未找到: {}", template_id))?;

    if let Some(n) = name { entry.name = n; }
    if let Some(d) = description { entry.description = d; }
    if let Some(c) = category { entry.category = c; }
    if let Some(t) = tags { entry.tags = t; }
    if let Some(c) = content {
        entry.author_notes = c.author_notes;
        entry.content = c.content;
        entry.ai_generated_content = c.ai_generated_content;
        entry.plugin_data = c.plugin_data;
    }
    entry.updated_at = chrono::Utc::now().timestamp();

    let result = DocTemplateManifest {
        id: entry.id.clone(),
        name: entry.name.clone(),
        description: entry.description.clone(),
        icon: icon.unwrap_or_default(),
        author: String::new(),
        template_type: "custom".to_string(),
        category: entry.category.clone(),
        tags: entry.tags.clone(),
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        include_content: entry.include_content,
        include_ai_content: entry.include_ai_content,
        enabled_plugins: entry.enabled_plugins.clone(),
        plugin_data: entry.plugin_data.clone(),
        min_app_version: None,
        is_built_in: false,
    };

    write_custom_templates(&custom)?;
    Ok(result)
}

/// 删除文档模板（仅自定义模板）
pub fn delete_doc_template(template_id: &str) -> Result<(), String> {
    let mut custom = read_custom_templates();
    let before = custom.templates.len();
    custom.templates.retain(|t| t.id != template_id);
    if custom.templates.len() == before {
        return Err(format!("自定义模板未找到: {}", template_id));
    }
    write_custom_templates(&custom)?;
    Ok(())
}

/// 复制文档模板（内置或自定义 → 新的自定义模板）
pub fn duplicate_doc_template(template_id: &str, new_name: &str) -> Result<DocTemplateManifest, String> {
    // 读取源模板内容
    let source_content = get_doc_template_content(template_id)?;

    // 读取源 manifest 信息
    let all = list_doc_templates();
    let source = all.iter().find(|t| t.id == template_id)
        .ok_or_else(|| format!("模板未找到: {}", template_id))?;

    let new_id = uuid::Uuid::new_v4().to_string();
    let new_manifest = DocTemplateManifest {
        id: new_id,
        name: new_name.to_string(),
        template_type: "custom".to_string(),
        created_at: 0,
        updated_at: 0,
        is_built_in: false,
        ..source.clone()
    };

    create_doc_template(new_manifest, source_content)
}

// ═══════════════════════════════════════════════════════════════
// 文档模板分类管理
// ═══════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocTemplateCategory {
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

/// 从 bundled JSON 文件提取内置分类
fn builtin_categories_from_json() -> Vec<DocTemplateCategory> {
    let mut cats = Vec::new();
    for cat_file in load_bundled_category_files() {
        cats.push(DocTemplateCategory {
            key: cat_file.key,
            label: cat_file.name,
            order: cat_file.order,
            category_type: "builtin".to_string(),
        });
    }
    cats
}

/// 内置默认分类（从 bundled JSON 文件提取，fallback 到硬编码）
fn default_categories() -> Vec<DocTemplateCategory> {
    let cats = builtin_categories_from_json();
    if !cats.is_empty() {
        return cats;
    }
    // Fallback: 硬编码默认分类
    vec![
        DocTemplateCategory { key: "report".into(),      label: "报告".into(),     order: 0, category_type: "builtin".into() },
        DocTemplateCategory { key: "article".into(),      label: "文章".into(),     order: 1, category_type: "builtin".into() },
        DocTemplateCategory { key: "email-draft".into(),  label: "邮件草稿".into(), order: 2, category_type: "builtin".into() },
        DocTemplateCategory { key: "meeting".into(),      label: "会议纪要".into(), order: 3, category_type: "builtin".into() },
        DocTemplateCategory { key: "creative".into(),     label: "创意写作".into(), order: 4, category_type: "builtin".into() },
        DocTemplateCategory { key: "technical".into(),    label: "技术文档".into(), order: 5, category_type: "builtin".into() },
        DocTemplateCategory { key: "general".into(),      label: "通用".into(),     order: 6, category_type: "builtin".into() },
    ]
}

fn categories_path() -> PathBuf {
    get_doc_templates_dir().join("categories.json")
}

/// 读取文档模板分类列表（不存在则初始化默认分类）
pub fn list_doc_template_categories() -> Vec<DocTemplateCategory> {
    let path = categories_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(json) => match serde_json::from_str::<Vec<DocTemplateCategory>>(&json) {
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

fn save_categories(cats: &[DocTemplateCategory]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(cats)
        .map_err(|e| format!("Failed to serialize categories: {}", e))?;
    ensure_doc_templates_dir();
    fs::write(categories_path(), json)
        .map_err(|e| format!("Failed to write categories.json: {}", e))?;
    Ok(())
}

/// 创建文档模板分类
pub fn create_doc_template_category(key: &str, label: &str) -> Result<Vec<DocTemplateCategory>, String> {
    let mut cats = list_doc_template_categories();
    if cats.iter().any(|c| c.key == key) {
        return Err(format!("Category key already exists: {}", key));
    }
    let max_order = cats.iter().map(|c| c.order).max().unwrap_or(-1);
    cats.push(DocTemplateCategory {
        key: key.to_string(),
        label: label.to_string(),
        order: max_order + 1,
        category_type: "custom".to_string(),
    });
    save_categories(&cats)?;
    Ok(cats)
}

/// 更新文档模板分类
pub fn update_doc_template_category(key: &str, label: Option<String>, new_key: Option<String>) -> Result<Vec<DocTemplateCategory>, String> {
    let mut cats = list_doc_template_categories();

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

/// 删除文档模板分类
pub fn delete_doc_template_category(key: &str) -> Result<Vec<DocTemplateCategory>, String> {
    let mut cats = list_doc_template_categories();
    let len_before = cats.len();
    cats.retain(|c| c.key != key);
    if cats.len() == len_before {
        return Err(format!("Category not found: {}", key));
    }
    save_categories(&cats)?;
    Ok(cats)
}

/// 重新排序文档模板分类（接收有序的 key 列表）
pub fn reorder_doc_template_categories(ordered_keys: &[String]) -> Result<Vec<DocTemplateCategory>, String> {
    let mut cats = list_doc_template_categories();
    for (i, key) in ordered_keys.iter().enumerate() {
        if let Some(cat) = cats.iter_mut().find(|c| &c.key == key) {
            cat.order = i as i32;
        }
    }
    cats.sort_by_key(|c| c.order);
    save_categories(&cats)?;
    Ok(cats)
}
