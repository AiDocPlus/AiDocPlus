#![allow(non_snake_case)]

use crate::config::AppState;
use crate::document::{Attachment, Document};
use crate::error::Result;
use tauri::State;

#[tauri::command]
pub fn create_document(
    state: State<'_, AppState>,
    projectId: String,
    title: String,
    author: String,
) -> Result<Document> {
    let document = Document::new(projectId.clone(), title, author);
    let doc_path = state.get_document_path(&projectId, &document.id);

    document.save(&doc_path).map_err(|e| e.to_string())?;

    Ok(document)
}

#[tauri::command]
pub fn save_document(
    state: State<'_, AppState>,
    documentId: String,
    projectId: String,
    title: String,
    content: String,
    authorNotes: String,
    aiGeneratedContent: String,
    attachments: Option<Vec<Attachment>>,
    pluginData: Option<serde_json::Value>,
    enabledPlugins: Option<Vec<String>>,
    composedContent: Option<String>,
) -> Result<Document> {
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("Document not found: {}", documentId));
    }

    // Load existing document
    let mut document = Document::load(&doc_path).map_err(|e| e.to_string())?;

    // Update document fields
    document.title = title;
    document.author_notes = authorNotes;
    document.ai_generated_content = aiGeneratedContent;
    if let Some(atts) = attachments {
        document.attachments = atts;
    }
    if let Some(pd) = pluginData {
        document.plugin_data = Some(pd);
    }
    if let Some(ep) = enabledPlugins {
        document.enabled_plugins = Some(ep);
    }
    if let Some(cc) = composedContent {
        document.composed_content = Some(cc);
    }

    // Update metadata
    document.metadata.updated_at = chrono::Utc::now().timestamp();
    document.metadata.word_count = content.split_whitespace().count();
    document.metadata.character_count = content.chars().count();

    // Update content last
    document.content = content;

    // Save document
    document.save(&doc_path).map_err(|e| e.to_string())?;

    Ok(document)
}

#[tauri::command]
pub fn delete_document(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
) -> Result<()> {
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("Document not found: {}", documentId));
    }

    // Remove document file
    std::fs::remove_file(&doc_path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn rename_document(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
    newTitle: String,
) -> Result<Document> {
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("Document not found: {}", documentId));
    }

    // Validate new title
    let trimmed_title = newTitle.trim();
    if trimmed_title.is_empty() {
        return Err("Document title cannot be empty".to_string());
    }

    // Load existing document
    let mut document = Document::load(&doc_path).map_err(|e| e.to_string())?;

    // Check for duplicate titles in the same project
    let project_dir = state.config.projects_dir.join(&projectId);
    let docs_dir = project_dir.join("documents");

    if docs_dir.exists() {
        let entries = std::fs::read_dir(&docs_dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if path != doc_path {
                    if let Ok(other_doc) = Document::load(&path) {
                        if other_doc.title == trimmed_title {
                            return Err(format!("A document with title '{}' already exists", trimmed_title));
                        }
                    }
                }
            }
        }
    }

    // Update document title
    document.title = trimmed_title.to_string();
    document.metadata.updated_at = chrono::Utc::now().timestamp();

    // Save document
    document.save(&doc_path).map_err(|e| e.to_string())?;

    Ok(document)
}

#[tauri::command]
pub fn get_document(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
) -> Result<Document> {
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("Document not found: {}", documentId));
    }

    Document::load(&doc_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_documents(state: State<'_, AppState>, projectId: String) -> Result<Vec<Document>> {
    let project_dir = state.config.projects_dir.join(&projectId);
    let docs_dir = project_dir.join("documents");

    if !docs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut documents = Vec::new();

    let entries = std::fs::read_dir(&docs_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(document) = Document::load(&path) {
                documents.push(document);
            }
        }
    }

    // Sort by updated_at (most recent first)
    documents.sort_by(|a, b| b.metadata.updated_at.cmp(&a.metadata.updated_at));

    Ok(documents)
}

#[tauri::command]
pub fn create_version(
    state: State<'_, AppState>,
    documentId: String,
    projectId: String,
    content: String,
    authorNotes: String,
    aiGeneratedContent: String,
    createdBy: String,
    changeDescription: Option<String>,
    pluginData: Option<serde_json::Value>,
    enabledPlugins: Option<Vec<String>>,
    composedContent: Option<String>,
) -> Result<String> {
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("Document not found: {}", documentId));
    }

    let mut document = Document::load(&doc_path).map_err(|e| e.to_string())?;
    document.create_version(content, authorNotes, aiGeneratedContent, createdBy, changeDescription, pluginData, enabledPlugins, composedContent);

    // Save document with new version
    document.save(&doc_path).map_err(|e| e.to_string())?;

    // Return the new version ID
    if let Some(version) = document.versions.last() {
        Ok(version.id.clone())
    } else {
        Err("Failed to create version".to_string())
    }
}

#[tauri::command]
pub fn list_versions(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
) -> Result<Vec<crate::document::DocumentVersion>> {
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("Document not found: {}", documentId));
    }

    let document = Document::load(&doc_path).map_err(|e| e.to_string())?;
    Ok(document.versions)
}

#[tauri::command]
pub fn get_version(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
    versionId: String,
) -> Result<crate::document::DocumentVersion> {
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("Document not found: {}", documentId));
    }

    let document = Document::load(&doc_path).map_err(|e| e.to_string())?;

    document
        .versions
        .into_iter()
        .find(|v| v.id == versionId)
        .ok_or_else(|| format!("Version not found: {}", versionId))
}

#[tauri::command]
pub fn restore_version(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
    versionId: String,
    createBackup: bool,
) -> Result<Document> {
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("Document not found: {}", documentId));
    }

    let mut document = Document::load(&doc_path).map_err(|e| e.to_string())?;

    // Create backup of current version if requested
    if createBackup {
        let backup_version = crate::document::DocumentVersion {
            id: format!("backup-{}", chrono::Utc::now().timestamp()),
            document_id: documentId.clone(),
            content: document.content.clone(),
            author_notes: document.author_notes.clone(),
            ai_generated_content: document.ai_generated_content.clone(),
            created_at: chrono::Utc::now().timestamp(),
            created_by: "system".to_string(),
            change_description: Some("Backup before restore".to_string()),
            plugin_data: document.plugin_data.clone(),
            enabled_plugins: document.enabled_plugins.clone(),
            composed_content: document.composed_content.clone(),
        };

        document.versions.push(backup_version);
    }

    // Find the version to restore and clone its content
    let (content, author_notes, ai_generated_content, plugin_data, enabled_plugins, composed_content) = {
        let version_to_restore = document
            .versions
            .iter()
            .find(|v| v.id == versionId)
            .ok_or_else(|| format!("Version not found: {}", versionId))?;
        (
            version_to_restore.content.clone(),
            version_to_restore.author_notes.clone(),
            version_to_restore.ai_generated_content.clone(),
            version_to_restore.plugin_data.clone(),
            version_to_restore.enabled_plugins.clone(),
            version_to_restore.composed_content.clone(),
        )
    };

    // Create a new version with the restored content
    let new_version_id = uuid::Uuid::new_v4().to_string();
    let restored_version = crate::document::DocumentVersion {
        id: new_version_id.clone(),
        document_id: documentId.clone(),
        content: content.clone(),
        author_notes: author_notes.clone(),
        ai_generated_content: ai_generated_content.clone(),
        created_at: chrono::Utc::now().timestamp(),
        created_by: "system".to_string(),
        change_description: Some(format!("Restored from version {}", versionId)),
        plugin_data: plugin_data.clone(),
        enabled_plugins: enabled_plugins.clone(),
        composed_content: composed_content.clone(),
    };

    // Add the new version and set it as current
    document.versions.push(restored_version);
    document.current_version_id = new_version_id;

    // Update document content from the restored version
    document.content = content;
    document.author_notes = author_notes;
    document.ai_generated_content = ai_generated_content;
    document.plugin_data = plugin_data;
    document.enabled_plugins = enabled_plugins;
    document.composed_content = composed_content;
    document.metadata.updated_at = chrono::Utc::now().timestamp();
    document.metadata.word_count = document.content.split_whitespace().count();
    document.metadata.character_count = document.content.chars().count();

    // Save the restored document
    document.save(&doc_path).map_err(|e| e.to_string())?;

    Ok(document)
}

#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<()> {
    use std::path::Path;

    let file_path = Path::new(&path);

    // 获取允许的目录列表
    let mut allowed_dirs: Vec<std::path::PathBuf> = Vec::new();

    // 应用项目目录
    if let Some(home) = dirs::home_dir() {
        allowed_dirs.push(home.join("AiDocPlus"));
    }

    // 临时目录
    allowed_dirs.push(std::env::temp_dir());

    // 确保父目录存在（必须在 canonicalize 之前，否则目录不存在会报错）
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    // 验证路径：对父目录做 canonicalize（文件本身可能尚不存在）
    let canonical_parent = file_path.parent()
        .ok_or_else(|| "路径无效: 无法获取父目录".to_string())?
        .canonicalize()
        .map_err(|e| format!("路径无效: {}", e))?;

    let is_allowed = allowed_dirs.iter().any(|dir| {
        dir.canonicalize().map(|d| canonical_parent.starts_with(&d)).unwrap_or(false)
    });

    if !is_allowed {
        return Err("路径不在允许的目录内".to_string());
    }

    std::fs::write(file_path, &data).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(())
}

/// 将文档移动到另一个项目
#[tauri::command]
pub fn move_document(
    state: State<'_, AppState>,
    documentId: String,
    fromProjectId: String,
    toProjectId: String,
) -> Result<Document> {
    let src_path = state.get_document_path(&fromProjectId, &documentId);
    if !src_path.exists() {
        return Err(format!("文档未找到: {}", documentId));
    }

    // 确保目标项目存在
    let to_project_path = state.get_project_path(&toProjectId);
    if !to_project_path.exists() {
        return Err(format!("目标项目未找到: {}", toProjectId));
    }

    // 确保目标 documents 目录存在
    let to_docs_dir = state.config.projects_dir.join(&toProjectId).join("documents");
    std::fs::create_dir_all(&to_docs_dir).map_err(|e| e.to_string())?;

    // 加载文档并更新 projectId
    let mut document = Document::load(&src_path).map_err(|e| e.to_string())?;
    document.project_id = toProjectId.clone();
    document.metadata.updated_at = chrono::Utc::now().timestamp();

    // 保存到目标位置
    let dst_path = state.get_document_path(&toProjectId, &documentId);
    document.save(&dst_path).map_err(|e| e.to_string())?;

    // 删除源文件
    std::fs::remove_file(&src_path).map_err(|e| e.to_string())?;

    Ok(document)
}

/// 将文档复制到另一个项目（生成新 ID）
#[tauri::command]
pub fn copy_document(
    state: State<'_, AppState>,
    documentId: String,
    fromProjectId: String,
    toProjectId: String,
) -> Result<Document> {
    let src_path = state.get_document_path(&fromProjectId, &documentId);
    if !src_path.exists() {
        return Err(format!("文档未找到: {}", documentId));
    }

    // 确保目标项目存在
    let to_project_path = state.get_project_path(&toProjectId);
    if !to_project_path.exists() {
        return Err(format!("目标项目未找到: {}", toProjectId));
    }

    // 确保目标 documents 目录存在
    let to_docs_dir = state.config.projects_dir.join(&toProjectId).join("documents");
    std::fs::create_dir_all(&to_docs_dir).map_err(|e| e.to_string())?;

    // 加载源文档
    let src_doc = Document::load(&src_path).map_err(|e| e.to_string())?;

    // 创建新文档（新 ID）
    let new_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let mut new_doc = src_doc;
    new_doc.id = new_id.clone();
    new_doc.project_id = toProjectId.clone();
    new_doc.title = format!("{} (副本)", new_doc.title);
    new_doc.metadata.created_at = now;
    new_doc.metadata.updated_at = now;
    new_doc.versions = Vec::new(); // 不复制版本历史
    new_doc.current_version_id = String::new();

    // 保存到目标位置
    let dst_path = state.get_document_path(&toProjectId, &new_id);
    new_doc.save(&dst_path).map_err(|e| e.to_string())?;

    Ok(new_doc)
}
