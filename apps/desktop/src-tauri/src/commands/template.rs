#![allow(non_snake_case)]

use crate::config::AppState;
use crate::document::Document;
use crate::template::{self, TemplateManifest, TemplateContent, TemplateCategory};
use crate::error::Result;
use tauri::State;

#[tauri::command]
pub fn list_templates() -> Result<Vec<TemplateManifest>> {
    Ok(template::list_templates())
}

#[tauri::command]
pub fn get_template_content(templateId: String) -> Result<TemplateContent> {
    template::get_template_content(&templateId)
}

#[tauri::command]
pub fn create_template(manifest: TemplateManifest, content: TemplateContent) -> Result<TemplateManifest> {
    template::create_template(manifest, content)
}

#[tauri::command]
pub fn update_template(
    templateId: String,
    name: Option<String>,
    description: Option<String>,
    category: Option<String>,
    icon: Option<String>,
    tags: Option<Vec<String>>,
    content: Option<TemplateContent>,
) -> Result<TemplateManifest> {
    template::update_template(&templateId, name, description, category, icon, tags, content)
}

#[tauri::command]
pub fn delete_template(templateId: String) -> Result<()> {
    template::delete_template(&templateId)
}

#[tauri::command]
pub fn duplicate_template(templateId: String, newName: String) -> Result<TemplateManifest> {
    template::duplicate_template(&templateId, &newName)
}

/// 从现有文档创建模板
#[tauri::command]
pub fn save_template_from_document(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
    templateName: String,
    templateDescription: String,
    templateCategory: String,
    includeContent: bool,
    includeAiContent: bool,
    includePluginData: bool,
) -> Result<TemplateManifest> {
    // 加载文档
    let doc_path = state.get_document_path(&projectId, &documentId);
    if !doc_path.exists() {
        return Err(format!("Document not found: {}", documentId));
    }
    let document = Document::load(&doc_path).map_err(|e| e.to_string())?;

    let template_id = uuid::Uuid::new_v4().to_string();

    let manifest = TemplateManifest {
        id: template_id,
        name: templateName,
        description: templateDescription,
        icon: String::new(),
        author: document.metadata.author.clone(),
        template_type: "custom".to_string(),
        category: templateCategory,
        tags: document.metadata.tags.clone(),
        created_at: 0,
        updated_at: 0,
        include_content: includeContent,
        include_ai_content: includeAiContent,
        enabled_plugins: document.enabled_plugins.clone().unwrap_or_default(),
        plugin_data: if includePluginData { document.plugin_data.clone() } else { None },
        min_app_version: None,
    };

    let content = TemplateContent {
        author_notes: document.author_notes.clone(), // 提示词始终保留
        ai_generated_content: if includeAiContent { document.ai_generated_content.clone() } else { String::new() },
        content: if includeContent { document.content.clone() } else { String::new() },
        plugin_data: if includePluginData { document.plugin_data.clone() } else { None },
    };

    template::create_template(manifest, content)
}

/// 从模板创建新文档
#[tauri::command]
pub fn create_document_from_template(
    state: State<'_, AppState>,
    projectId: String,
    templateId: String,
    title: String,
    author: String,
) -> Result<Document> {
    // 读取模板
    let templates_dir = template::get_templates_dir();
    let manifest_path = templates_dir.join(&templateId).join("template.json");
    if !manifest_path.exists() {
        return Err(format!("Template not found: {}", templateId));
    }

    let manifest_json = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read template manifest: {}", e))?;
    let manifest: TemplateManifest = serde_json::from_str(&manifest_json)
        .map_err(|e| format!("Failed to parse template manifest: {}", e))?;

    // 读取模板内容
    let template_content = template::get_template_content(&templateId)?;

    // 创建新文档
    let mut document = Document::new(projectId.clone(), title, author);

    // 提示词始终继承
    document.author_notes = template_content.author_notes;

    // 素材内容按选项继承
    if manifest.include_content {
        document.content = template_content.content;
    }
    if manifest.include_ai_content {
        document.ai_generated_content = template_content.ai_generated_content;
    }

    // 应用插件设置
    if !manifest.enabled_plugins.is_empty() {
        document.enabled_plugins = Some(manifest.enabled_plugins);
    }
    if template_content.plugin_data.is_some() {
        document.plugin_data = template_content.plugin_data;
    }

    // 保存文档
    let doc_path = state.get_document_path(&projectId, &document.id);
    document.save(&doc_path).map_err(|e| e.to_string())?;

    Ok(document)
}

// ── 模板分类命令 ──

#[tauri::command]
pub fn list_template_categories() -> Result<Vec<TemplateCategory>> {
    Ok(template::list_template_categories())
}

#[tauri::command]
pub fn create_template_category(key: String, label: String) -> Result<Vec<TemplateCategory>> {
    template::create_template_category(&key, &label)
}

#[tauri::command]
pub fn update_template_category(key: String, label: Option<String>, newKey: Option<String>) -> Result<Vec<TemplateCategory>> {
    template::update_template_category(&key, label, newKey)
}

#[tauri::command]
pub fn delete_template_category(key: String) -> Result<Vec<TemplateCategory>> {
    template::delete_template_category(&key)
}

#[tauri::command]
pub fn reorder_template_categories(orderedKeys: Vec<String>) -> Result<Vec<TemplateCategory>> {
    template::reorder_template_categories(&orderedKeys)
}
