use crate::types::{CategoryDefinition, ResourceSummary};
use serde::{Deserialize, Serialize};
use serde_json;
use std::fs;
use std::path::Path;

// ============================================================
// JSON 文件模式的数据结构
// ============================================================

/// 分类 JSON 文件结构（如 academic.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryJsonFile {
    pub key: String,
    pub name: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub order: i32,
    #[serde(default)]
    pub templates: Vec<JsonTemplateEntry>,
}

/// JSON 文件中的单个模板条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonTemplateEntry {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub variables: Vec<String>,
    #[serde(default)]
    pub order: i32,
    #[serde(default, rename = "authorNotes")]
    pub author_notes: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, rename = "aiGeneratedContent")]
    pub ai_generated_content: String,
    #[serde(default, rename = "enabledPlugins")]
    pub enabled_plugins: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "pluginData")]
    pub plugin_data: Option<serde_json::Value>,
    #[serde(default, rename = "includeContent")]
    pub include_content: bool,
    #[serde(default, rename = "includeAiContent")]
    pub include_ai_content: bool,
}

/// 管理器前端需要的完整模板数据（含 manifest + content）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonResourceDetail {
    pub id: String,
    pub name: String,
    pub description: String,
    pub content: String,
    #[serde(default)]
    pub variables: Vec<String>,
    pub order: i32,
    #[serde(rename = "categoryKey")]
    pub category_key: String,
    #[serde(rename = "categoryName")]
    pub category_name: String,
    #[serde(default, rename = "authorNotes")]
    pub author_notes: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, rename = "aiGeneratedContent")]
    pub ai_generated_content: String,
    #[serde(default, rename = "enabledPlugins")]
    pub enabled_plugins: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "pluginData")]
    pub plugin_data: Option<serde_json::Value>,
    #[serde(default, rename = "includeContent")]
    pub include_content: bool,
    #[serde(default, rename = "includeAiContent")]
    pub include_ai_content: bool,
}

// ============================================================
// 读取操作
// ============================================================

/// 读取单个分类 JSON 文件
fn read_category_file(path: &Path) -> Result<CategoryJsonFile, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("读取文件失败 {}: {}", path.display(), e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析 JSON 失败 {}: {}", path.display(), e))
}

/// 写入分类 JSON 文件
fn write_category_file(path: &Path, data: &CategoryJsonFile) -> Result<(), String> {
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(path, content)
        .map_err(|e| format!("写入文件失败 {}: {}", path.display(), e))
}

/// 扫描 data_dir 下所有 *.json 文件，返回资源摘要列表
pub fn scan_json_resources(data_dir: &str) -> Result<Vec<ResourceSummary>, String> {
    let data_path = Path::new(data_dir);
    if !data_path.exists() {
        return Ok(Vec::new());
    }

    let mut resources = Vec::new();
    let entries = fs::read_dir(data_path)
        .map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let cat_file = match read_category_file(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };

        for tmpl in &cat_file.templates {
            resources.push(ResourceSummary {
                id: tmpl.id.clone(),
                name: tmpl.name.clone(),
                description: tmpl.description.clone(),
                icon: cat_file.icon.clone(),
                major_category: cat_file.key.clone(),
                sub_category: String::new(),
                tags: Vec::new(),
                order: tmpl.order,
                enabled: true,
                source: "builtin".to_string(),
                path: format!("{}::{}", cat_file.key, tmpl.id),
            });
        }
    }

    resources.sort_by(|a, b| {
        a.major_category.cmp(&b.major_category)
            .then(a.order.cmp(&b.order))
            .then(a.name.cmp(&b.name))
    });
    Ok(resources)
}

/// 从分类 JSON 文件中读取分类列表
pub fn read_json_categories(data_dir: &str) -> Result<Vec<CategoryDefinition>, String> {
    let data_path = Path::new(data_dir);
    if !data_path.exists() {
        return Ok(Vec::new());
    }

    let mut categories = Vec::new();
    let entries = fs::read_dir(data_path)
        .map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        if let Ok(cat_file) = read_category_file(&path) {
            categories.push(CategoryDefinition {
                key: cat_file.key,
                name: cat_file.name,
                icon: Some(if cat_file.icon.is_empty() { "📋".to_string() } else { cat_file.icon }),
                order: cat_file.order,
                sub_categories: Vec::new(),
            });
        }
    }

    categories.sort_by(|a, b| a.order.cmp(&b.order));
    Ok(categories)
}

/// 读取单个模板的完整数据
pub fn read_json_template(data_dir: &str, category_key: &str, template_id: &str) -> Result<JsonResourceDetail, String> {
    let json_path = Path::new(data_dir).join(format!("{}.json", category_key));
    let cat_file = read_category_file(&json_path)?;

    let tmpl = cat_file.templates.iter()
        .find(|t| t.id == template_id)
        .ok_or_else(|| format!("模板 {} 未找到", template_id))?;

    Ok(JsonResourceDetail {
        id: tmpl.id.clone(),
        name: tmpl.name.clone(),
        description: tmpl.description.clone(),
        content: tmpl.content.clone(),
        variables: tmpl.variables.clone(),
        order: tmpl.order,
        category_key: cat_file.key.clone(),
        category_name: cat_file.name.clone(),
        author_notes: tmpl.author_notes.clone(),
        tags: tmpl.tags.clone(),
        ai_generated_content: tmpl.ai_generated_content.clone(),
        enabled_plugins: tmpl.enabled_plugins.clone(),
        plugin_data: tmpl.plugin_data.clone(),
        include_content: tmpl.include_content,
        include_ai_content: tmpl.include_ai_content,
    })
}

// ============================================================
// 写入操作
// ============================================================

/// 保存模板（更新已有模板）
pub fn save_json_template(
    data_dir: &str,
    category_key: &str,
    template_id: &str,
    name: &str,
    description: &str,
    content: &str,
    variables: Vec<String>,
    author_notes: Option<String>,
    ai_generated_content: Option<String>,
    enabled_plugins: Option<Vec<String>>,
    plugin_data: Option<serde_json::Value>,
    include_content: Option<bool>,
    include_ai_content: Option<bool>,
) -> Result<(), String> {
    let json_path = Path::new(data_dir).join(format!("{}.json", category_key));
    let mut cat_file = read_category_file(&json_path)?;

    let tmpl = cat_file.templates.iter_mut()
        .find(|t| t.id == template_id)
        .ok_or_else(|| format!("模板 {} 未找到", template_id))?;

    tmpl.name = name.to_string();
    tmpl.description = description.to_string();
    tmpl.content = content.to_string();
    tmpl.variables = variables;
    if let Some(notes) = author_notes {
        tmpl.author_notes = notes;
    }
    if let Some(ai) = ai_generated_content {
        tmpl.ai_generated_content = ai;
    }
    if let Some(plugins) = enabled_plugins {
        tmpl.enabled_plugins = plugins;
    }
    if let Some(pd) = plugin_data {
        tmpl.plugin_data = Some(pd);
    }
    if let Some(ic) = include_content {
        tmpl.include_content = ic;
    }
    if let Some(iac) = include_ai_content {
        tmpl.include_ai_content = iac;
    }

    write_category_file(&json_path, &cat_file)
}

/// 创建新模板
pub fn create_json_template(
    data_dir: &str,
    category_key: &str,
    id: &str,
    name: &str,
    description: &str,
    content: &str,
    variables: Vec<String>,
    author_notes: Option<String>,
    ai_generated_content: Option<String>,
    enabled_plugins: Option<Vec<String>>,
    plugin_data: Option<serde_json::Value>,
    include_content: Option<bool>,
    include_ai_content: Option<bool>,
) -> Result<String, String> {
    let json_path = Path::new(data_dir).join(format!("{}.json", category_key));

    let mut cat_file = if json_path.exists() {
        read_category_file(&json_path)?
    } else {
        CategoryJsonFile {
            key: category_key.to_string(),
            name: category_key.to_string(),
            icon: "📋".to_string(),
            order: 999,
            templates: Vec::new(),
        }
    };

    // 检查 ID 是否已存在
    if cat_file.templates.iter().any(|t| t.id == id) {
        return Err(format!("模板 ID {} 已存在", id));
    }

    // 计算 order
    let max_order = cat_file.templates.iter().map(|t| t.order).max().unwrap_or(-1);

    cat_file.templates.push(JsonTemplateEntry {
        id: id.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        content: content.to_string(),
        variables,
        order: max_order + 1,
        author_notes: author_notes.unwrap_or_default(),
        tags: Vec::new(),
        ai_generated_content: ai_generated_content.unwrap_or_default(),
        enabled_plugins: enabled_plugins.unwrap_or_default(),
        plugin_data,
        include_content: include_content.unwrap_or(false),
        include_ai_content: include_ai_content.unwrap_or(false),
    });

    write_category_file(&json_path, &cat_file)?;
    Ok(format!("{}::{}", category_key, id))
}

/// 删除模板
pub fn delete_json_template(data_dir: &str, category_key: &str, template_id: &str) -> Result<(), String> {
    let json_path = Path::new(data_dir).join(format!("{}.json", category_key));
    let mut cat_file = read_category_file(&json_path)?;

    let before = cat_file.templates.len();
    cat_file.templates.retain(|t| t.id != template_id);
    if cat_file.templates.len() == before {
        return Err(format!("模板 {} 未找到", template_id));
    }

    write_category_file(&json_path, &cat_file)
}

/// 批量删除模板（path 格式为 "category_key::template_id"）
pub fn batch_delete_json_templates(data_dir: &str, paths: &[String]) -> Result<u32, String> {
    let mut count = 0u32;
    // 按分类分组
    let mut grouped: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for path in paths {
        if let Some((cat, tmpl)) = path.split_once("::") {
            grouped.entry(cat.to_string()).or_default().push(tmpl.to_string());
        }
    }

    for (cat_key, tmpl_ids) in &grouped {
        let json_path = Path::new(data_dir).join(format!("{}.json", cat_key));
        if let Ok(mut cat_file) = read_category_file(&json_path) {
            let before = cat_file.templates.len();
            cat_file.templates.retain(|t| !tmpl_ids.contains(&t.id));
            let deleted = before - cat_file.templates.len();
            if deleted > 0 {
                write_category_file(&json_path, &cat_file)?;
                count += deleted as u32;
            }
        }
    }
    Ok(count)
}

/// 重排序模板（pairs: [(path, new_order)]，path 格式为 "category_key::template_id"）
pub fn reorder_json_templates(pairs: Vec<(String, i32)>) -> Result<(), String> {
    // 按分类分组
    let mut grouped: std::collections::HashMap<String, Vec<(String, i32)>> = std::collections::HashMap::new();
    for (path, order) in pairs {
        if let Some((cat, tmpl)) = path.split_once("::") {
            // 从 path 中提取 data_dir（不适用，需要 data_dir 参数）
            grouped.entry(cat.to_string()).or_default().push((tmpl.to_string(), order));
        }
    }
    // 注意：此函数需要 data_dir，但当前签名不含。调用方需要处理。
    Ok(())
}

/// 重排序模板（带 data_dir）
pub fn reorder_json_templates_in_category(
    data_dir: &str,
    category_key: &str,
    id_order_pairs: &[(String, i32)],
) -> Result<(), String> {
    let json_path = Path::new(data_dir).join(format!("{}.json", category_key));
    let mut cat_file = read_category_file(&json_path)?;

    for (id, new_order) in id_order_pairs {
        if let Some(tmpl) = cat_file.templates.iter_mut().find(|t| t.id == *id) {
            tmpl.order = *new_order;
        }
    }

    write_category_file(&json_path, &cat_file)
}

/// 移动模板到另一个分类
pub fn move_json_template(
    data_dir: &str,
    from_category: &str,
    template_id: &str,
    to_category: &str,
) -> Result<(), String> {
    // 从源分类读取并移除
    let from_path = Path::new(data_dir).join(format!("{}.json", from_category));
    let mut from_file = read_category_file(&from_path)?;

    let tmpl_idx = from_file.templates.iter().position(|t| t.id == template_id)
        .ok_or_else(|| format!("模板 {} 未找到", template_id))?;
    let tmpl = from_file.templates.remove(tmpl_idx);

    // 写回源分类
    write_category_file(&from_path, &from_file)?;

    // 添加到目标分类
    let to_path = Path::new(data_dir).join(format!("{}.json", to_category));
    let mut to_file = if to_path.exists() {
        read_category_file(&to_path)?
    } else {
        CategoryJsonFile {
            key: to_category.to_string(),
            name: to_category.to_string(),
            icon: "📋".to_string(),
            order: 999,
            templates: Vec::new(),
        }
    };

    let max_order = to_file.templates.iter().map(|t| t.order).max().unwrap_or(-1);
    let mut moved_tmpl = tmpl;
    moved_tmpl.order = max_order + 1;
    to_file.templates.push(moved_tmpl);

    write_category_file(&to_path, &to_file)
}

/// 保存分类元信息（修改分类名称、图标等）
pub fn save_json_category(
    data_dir: &str,
    category_key: &str,
    name: &str,
    icon: &str,
    order: i32,
) -> Result<(), String> {
    let json_path = Path::new(data_dir).join(format!("{}.json", category_key));
    let mut cat_file = if json_path.exists() {
        read_category_file(&json_path)?
    } else {
        CategoryJsonFile {
            key: category_key.to_string(),
            name: name.to_string(),
            icon: icon.to_string(),
            order,
            templates: Vec::new(),
        }
    };

    cat_file.name = name.to_string();
    cat_file.icon = icon.to_string();
    cat_file.order = order;

    write_category_file(&json_path, &cat_file)
}
