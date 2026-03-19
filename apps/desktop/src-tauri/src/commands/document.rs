#![allow(non_snake_case)]

use crate::config::AppState;
use crate::document::{Attachment, Document};
use crate::error::{AppError, Result, ResultExt};
use crate::security;
use serde::Deserialize;
use tauri::State;

/// save_document 命令的载荷结构体（将原11个独立参数收敛为单一对象）
#[derive(Debug, Deserialize)]
#[allow(non_snake_case)]
pub struct SaveDocumentPayload {
    pub documentId: String,
    pub projectId: String,
    pub title: String,
    pub content: String,
    pub authorNotes: String,
    pub aiGeneratedContent: String,
    pub attachments: Option<Vec<Attachment>>,
    pub pluginData: Option<serde_json::Value>,
    pub enabledPlugins: Option<Vec<String>>,
    pub composedContent: Option<String>,
    pub aiServiceId: Option<String>,
    // 小说扩展字段
    pub parentId: Option<String>,
    pub sortOrder: Option<i32>,
    pub documentType: Option<String>,
    pub chapterOutline: Option<String>,
    pub chapterSummary: Option<String>,
}

#[tauri::command]
pub fn create_document(
    state: State<'_, AppState>,
    projectId: String,
    title: String,
    author: String,
) -> Result<Document> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_title(&title)?;
    let document = Document::new(projectId.clone(), title, author);
    let doc_path = state.get_document_path(&projectId, &document.id);

    document.save(&doc_path)?;

    // 更新搜索索引
    let _ = crate::search_store::upsert_document_index(
        &state.db, &document.id, &projectId, &document.title, &document.content, &document.author_notes,
    );

    Ok(document.without_versions())
}

#[tauri::command]
pub fn save_document(
    state: State<'_, AppState>,
    payload: SaveDocumentPayload,
) -> Result<Document> {
    let SaveDocumentPayload {
        documentId, projectId, title, content, authorNotes,
        aiGeneratedContent, attachments, pluginData,
        enabledPlugins, composedContent, aiServiceId,
        parentId, sortOrder, documentType, chapterOutline, chapterSummary,
    } = payload;

    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    security::validate_content_size(&content)?;
    security::validate_content_size(&aiGeneratedContent)?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    // Load existing document
    let mut document = Document::load(&doc_path)?;

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
    document.ai_service_id = aiServiceId;
    // 小说扩展字段（仅在传入时更新，避免普通保存覆盖）
    if parentId.is_some() { document.parent_id = parentId; }
    if sortOrder.is_some() { document.sort_order = sortOrder; }
    if documentType.is_some() { document.document_type = documentType; }
    if chapterOutline.is_some() { document.chapter_outline = chapterOutline; }
    if chapterSummary.is_some() { document.chapter_summary = chapterSummary; }

    // Update metadata
    document.metadata.updated_at = chrono::Utc::now().timestamp();
    document.metadata.word_count = content.split_whitespace().count();
    document.metadata.character_count = content.chars().count();

    // Update content last
    document.content = content;

    // Save document
    document.save(&doc_path)?;

    // 更新搜索索引
    let _ = crate::search_store::upsert_document_index(
        &state.db, &documentId, &projectId, &document.title, &document.content, &document.author_notes,
    );

    Ok(document.without_versions())
}

#[tauri::command]
pub fn delete_document(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
) -> Result<()> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    // Remove document file
    std::fs::remove_file(&doc_path)?;

    // 删除搜索索引
    let _ = crate::search_store::remove_document_index(&state.db, &documentId);

    Ok(())
}

#[tauri::command]
pub fn rename_document(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
    newTitle: String,
) -> Result<Document> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    security::validate_title(&newTitle)?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    // Validate new title
    let trimmed_title = newTitle.trim();
    if trimmed_title.is_empty() {
        return Err(AppError::ValidationError("文档标题不能为空".to_string()));
    }

    // Load existing document
    let mut document = Document::load(&doc_path)?;

    // Check for duplicate titles in the same project
    let project_dir = state.config().projects_dir.join(&projectId);
    let docs_dir = project_dir.join("documents");

    if docs_dir.exists() {
        let entries = std::fs::read_dir(&docs_dir)?;
        for entry in entries {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if path != doc_path {
                    if let Ok(other_doc) = Document::load(&path) {
                        if other_doc.title == trimmed_title {
                            return Err(AppError::ValidationError(format!("同名文档已存在: '{}'", trimmed_title)));
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
    document.save(&doc_path)?;

    Ok(document.without_versions())
}

#[tauri::command]
pub fn get_document(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
) -> Result<Document> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    Document::load(&doc_path).map(|d| d.without_versions())
}

#[tauri::command]
pub fn list_documents(state: State<'_, AppState>, projectId: String) -> Result<Vec<Document>> {
    security::validate_id(&projectId, "projectId")?;
    let project_dir = state.config().projects_dir.join(&projectId);
    let docs_dir = project_dir.join("documents");

    if !docs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut documents = Vec::new();

    let entries = std::fs::read_dir(&docs_dir)?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(document) = Document::load(&path) {
                documents.push(document.metadata_only());
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
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    security::validate_content_size(&content)?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    let version_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    let version = crate::document::DocumentVersion {
        id: version_id.clone(),
        document_id: documentId.clone(),
        content,
        author_notes: authorNotes,
        ai_generated_content: aiGeneratedContent,
        created_at: now,
        created_by: createdBy,
        change_description: changeDescription,
        plugin_data: pluginData,
        enabled_plugins: enabledPlugins,
        composed_content: composedContent,
    };

    crate::version_store::insert_version(&state.db, &projectId, &version)?;

    // 更新文档的 currentVersionId 和 updatedAt
    let mut document = Document::load(&doc_path)?;
    document.current_version_id = version_id.clone();
    document.metadata.updated_at = now;
    document.save(&doc_path)?;

    Ok(version_id)
}

#[tauri::command]
pub fn list_versions(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
) -> Result<Vec<crate::document::DocumentVersion>> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;

    crate::version_store::list_versions(&state.db, &documentId)
}

#[tauri::command]
pub fn get_version(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
    versionId: String,
) -> Result<crate::document::DocumentVersion> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    security::validate_id(&versionId, "versionId")?;

    crate::version_store::get_version(&state.db, &documentId, &versionId)
}

#[tauri::command]
pub fn restore_version(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
    versionId: String,
    createBackup: bool,
) -> Result<Document> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    security::validate_id(&versionId, "versionId")?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    let mut document = Document::load(&doc_path)?;

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

        crate::version_store::insert_version(&state.db, &projectId, &backup_version)?;
    }

    // 从 SQLite 获取要恢复的版本
    let version_to_restore = crate::version_store::get_version(&state.db, &documentId, &versionId)?;

    // Create a new version with the restored content
    let new_version_id = uuid::Uuid::new_v4().to_string();
    let restored_version = crate::document::DocumentVersion {
        id: new_version_id.clone(),
        document_id: documentId.clone(),
        content: version_to_restore.content.clone(),
        author_notes: version_to_restore.author_notes.clone(),
        ai_generated_content: version_to_restore.ai_generated_content.clone(),
        created_at: chrono::Utc::now().timestamp(),
        created_by: "system".to_string(),
        change_description: Some(format!("Restored from version {}", versionId)),
        plugin_data: version_to_restore.plugin_data.clone(),
        enabled_plugins: version_to_restore.enabled_plugins.clone(),
        composed_content: version_to_restore.composed_content.clone(),
    };

    crate::version_store::insert_version(&state.db, &projectId, &restored_version)?;

    // Update document content from the restored version
    document.current_version_id = new_version_id;
    document.content = version_to_restore.content;
    document.author_notes = version_to_restore.author_notes;
    document.ai_generated_content = version_to_restore.ai_generated_content;
    document.plugin_data = version_to_restore.plugin_data;
    document.enabled_plugins = version_to_restore.enabled_plugins;
    document.composed_content = version_to_restore.composed_content;
    document.metadata.updated_at = chrono::Utc::now().timestamp();
    document.metadata.word_count = document.content.split_whitespace().count();
    document.metadata.character_count = document.content.chars().count();

    // Save the restored document
    document.save(&doc_path)?;

    Ok(document.without_versions())
}

#[tauri::command]
pub fn delete_version(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
    versionId: String,
) -> Result<()> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    security::validate_id(&versionId, "versionId")?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    let document = Document::load(&doc_path)?;

    // 不允许删除当前版本
    if document.current_version_id == versionId {
        return Err(AppError::ValidationError("不能删除当前活动版本".to_string()));
    }

    let deleted = crate::version_store::delete_version(&state.db, &documentId, &versionId)?;
    if !deleted {
        return Err(AppError::VersionNotFound(format!("版本未找到: {}", versionId)));
    }

    Ok(())
}

#[tauri::command]
pub fn delete_all_versions(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
) -> Result<()> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    let document = Document::load(&doc_path)?;
    let current_id = document.current_version_id.clone();

    // 从 SQLite 删除该文档所有版本，再把当前版本重新插入
    // 先获取当前版本（如果存在于 SQLite 中）
    let current_version = crate::version_store::get_version(&state.db, &documentId, &current_id).ok();

    crate::version_store::delete_all_versions(&state.db, &documentId)?;

    // 重新插入当前版本
    if let Some(cv) = current_version {
        crate::version_store::insert_version(&state.db, &projectId, &cv)?;
    }

    Ok(())
}

#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<()> {
    use std::path::Path;

    let file_path = Path::new(&path);

    // 获取允许的目录列表
    let mut allowed_dirs: Vec<std::path::PathBuf> = Vec::new();

    if let Some(home) = dirs::home_dir() {
        // 应用数据目录
        allowed_dirs.push(crate::config::current_data_root());
        // 常用用户目录（桌面、下载、文档）
        allowed_dirs.push(home.join("Desktop"));
        allowed_dirs.push(home.join("Downloads"));
        allowed_dirs.push(home.join("Documents"));
        // 用户主目录（兜底）
        allowed_dirs.push(home.clone());
    }

    // 系统标准目录
    if let Some(d) = dirs::desktop_dir() { allowed_dirs.push(d); }
    if let Some(d) = dirs::download_dir() { allowed_dirs.push(d); }
    if let Some(d) = dirs::document_dir() { allowed_dirs.push(d); }
    if let Some(d) = dirs::picture_dir() { allowed_dirs.push(d); }

    // 临时目录
    allowed_dirs.push(std::env::temp_dir());

    // 确保父目录存在（必须在 canonicalize 之前，否则目录不存在会报错）
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).context("创建目录失败")?;
    }

    // 验证路径：对父目录做 canonicalize（文件本身可能尚不存在）
    let canonical_parent = file_path.parent()
        .ok_or_else(|| AppError::ValidationError("路径无效: 无法获取父目录".to_string()))?
        .canonicalize()
        .map_err(|e| AppError::ValidationError(format!("路径无效: {}", e)))?;

    let is_allowed = allowed_dirs.iter().any(|dir| {
        dir.canonicalize().map(|d| canonical_parent.starts_with(&d)).unwrap_or(false)
    });

    if !is_allowed {
        return Err(AppError::SecurityError("路径不在允许的目录内".to_string()));
    }

    std::fs::write(file_path, &data).context("写入文件失败")?;
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
    security::validate_id(&documentId, "documentId")?;
    security::validate_id(&fromProjectId, "fromProjectId")?;
    security::validate_id(&toProjectId, "toProjectId")?;
    let src_path = state.get_document_path(&fromProjectId, &documentId);
    if !src_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    // 确保目标项目存在
    let to_project_path = state.get_project_path(&toProjectId);
    if !to_project_path.exists() {
        return Err(AppError::ProjectNotFound(format!("目标项目未找到: {}", toProjectId)));
    }

    // 确保目标 documents 目录存在
    let to_docs_dir = state.config().projects_dir.join(&toProjectId).join("documents");
    std::fs::create_dir_all(&to_docs_dir)?;

    // 加载文档并更新 projectId
    let mut document = Document::load(&src_path)?;
    document.project_id = toProjectId.clone();
    document.metadata.updated_at = chrono::Utc::now().timestamp();

    // 保存到目标位置
    let dst_path = state.get_document_path(&toProjectId, &documentId);
    document.save(&dst_path)?;

    // 删除源文件
    std::fs::remove_file(&src_path)?;

    Ok(document.without_versions())
}

/// 更新文档标签
#[tauri::command]
pub fn update_document_tags(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
    tags: Vec<String>,
) -> Result<Document> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    let mut document = Document::load(&doc_path)?;

    // 去重、去空、trim
    let clean_tags: Vec<String> = tags
        .into_iter()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    document.metadata.tags = clean_tags;
    document.metadata.updated_at = chrono::Utc::now().timestamp();

    document.save(&doc_path)?;

    Ok(document.without_versions())
}

/// 获取项目内所有已使用的标签（去重）
#[tauri::command]
pub fn list_all_tags(
    state: State<'_, AppState>,
    projectId: Option<String>,
) -> Result<Vec<String>> {
    if let Some(ref pid) = projectId {
        security::validate_id(pid, "projectId")?;
    }
    let mut all_tags = std::collections::HashSet::new();

    let projects_dir = &state.config().projects_dir;

    let project_ids: Vec<String> = if let Some(pid) = projectId {
        vec![pid]
    } else {
        // 遍历所有项目
        match std::fs::read_dir(projects_dir) {
            Ok(entries) => entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .filter_map(|e| e.file_name().into_string().ok())
                .collect(),
            Err(_) => Vec::new(),
        }
    };

    for pid in project_ids {
        let docs_dir = projects_dir.join(&pid).join("documents");
        if !docs_dir.exists() {
            continue;
        }

        if let Ok(entries) = std::fs::read_dir(&docs_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(doc) = Document::load(&path) {
                        for tag in &doc.metadata.tags {
                            all_tags.insert(tag.clone());
                        }
                    }
                }
            }
        }
    }

    let mut sorted: Vec<String> = all_tags.into_iter().collect();
    sorted.sort();
    Ok(sorted)
}

/// 切换文档收藏状态（通过特殊标签 _starred 实现）
#[tauri::command]
pub fn toggle_document_starred(
    state: State<'_, AppState>,
    projectId: String,
    documentId: String,
) -> Result<Document> {
    security::validate_id(&projectId, "projectId")?;
    security::validate_id(&documentId, "documentId")?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    let mut document = Document::load(&doc_path)?;

    let starred_tag = "_starred".to_string();
    if document.metadata.tags.contains(&starred_tag) {
        document.metadata.tags.retain(|t| t != &starred_tag);
    } else {
        document.metadata.tags.push(starred_tag);
    }
    document.metadata.updated_at = chrono::Utc::now().timestamp();

    document.save(&doc_path)?;

    Ok(document.without_versions())
}

/// 将文档复制到另一个项目（生成新 ID）
#[tauri::command]
pub fn copy_document(
    state: State<'_, AppState>,
    documentId: String,
    fromProjectId: String,
    toProjectId: String,
) -> Result<Document> {
    security::validate_id(&documentId, "documentId")?;
    security::validate_id(&fromProjectId, "fromProjectId")?;
    security::validate_id(&toProjectId, "toProjectId")?;
    let src_path = state.get_document_path(&fromProjectId, &documentId);
    if !src_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    // 确保目标项目存在
    let to_project_path = state.get_project_path(&toProjectId);
    if !to_project_path.exists() {
        return Err(AppError::ProjectNotFound(format!("目标项目未找到: {}", toProjectId)));
    }

    // 确保目标 documents 目录存在
    let to_docs_dir = state.config().projects_dir.join(&toProjectId).join("documents");
    std::fs::create_dir_all(&to_docs_dir)?;

    // 加载源文档
    let src_doc = Document::load(&src_path)?;

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
    new_doc.save(&dst_path)?;

    Ok(new_doc.without_versions())
}
