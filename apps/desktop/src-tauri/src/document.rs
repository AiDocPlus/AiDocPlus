use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    #[serde(rename = "fileType")]
    pub file_type: String,
    #[serde(rename = "addedAt")]
    pub added_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub title: String,
    pub content: String,
    #[serde(rename = "authorNotes")]
    pub author_notes: String,
    #[serde(rename = "aiGeneratedContent")]
    pub ai_generated_content: String,
    #[serde(default, skip_serializing)]
    pub versions: Vec<DocumentVersion>,
    #[serde(rename = "currentVersionId")]
    pub current_version_id: String,
    pub metadata: DocumentMetadata,
    #[serde(default)]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "pluginData")]
    pub plugin_data: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "enabledPlugins")]
    pub enabled_plugins: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "composedContent")]
    pub composed_content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "aiServiceId")]
    pub ai_service_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub author: String,
    pub tags: Vec<String>,
    #[serde(rename = "wordCount")]
    pub word_count: usize,
    #[serde(rename = "characterCount")]
    pub character_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentVersion {
    pub id: String,
    #[serde(rename = "documentId")]
    pub document_id: String,
    pub content: String,
    #[serde(rename = "authorNotes")]
    pub author_notes: String,
    #[serde(rename = "aiGeneratedContent", default)]
    pub ai_generated_content: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "createdBy")]
    pub created_by: String,
    #[serde(rename = "changeDescription")]
    pub change_description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "pluginData")]
    pub plugin_data: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "enabledPlugins")]
    pub enabled_plugins: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "composedContent")]
    pub composed_content: Option<String>,
}

impl Document {
    pub fn new(project_id: String, title: String, author: String) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        let version_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();

        Self {
            id,
            project_id,
            title,
            content: String::new(),
            author_notes: String::new(),
            ai_generated_content: String::new(),
            versions: Vec::new(),
            current_version_id: version_id,
            metadata: DocumentMetadata {
                created_at: now,
                updated_at: now,
                author,
                tags: Vec::new(),
                word_count: 0,
                character_count: 0,
            },
            attachments: Vec::new(),
            plugin_data: None,
            enabled_plugins: None,
            composed_content: None,
            ai_service_id: None,
        }
    }

    /// 返回前端时剥离 versions 数据（惰性加载优化）
    /// 前端通过 list_versions 命令按需获取版本
    pub fn without_versions(mut self) -> Self {
        self.versions = Vec::new();
        self
    }

    /// 返回仅含元数据的轻量文档（不含 content / aiGeneratedContent / versions）
    /// 用于文档列表展示，减少内存占用
    pub fn metadata_only(mut self) -> Self {
        self.content = String::new();
        self.author_notes = String::new();
        self.ai_generated_content = String::new();
        self.versions = Vec::new();
        self.composed_content = None;
        self
    }

    pub fn save(&self, path: &PathBuf) -> std::result::Result<(), AppError> {
        let json = serde_json::to_string_pretty(self)?;
        crate::config::atomic_write(path, &json)
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        Ok(())
    }

    pub fn load(path: &PathBuf) -> std::result::Result<Self, AppError> {
        let json = fs::read_to_string(path)?;
        let doc: Self = serde_json::from_str(&json)?;
        Ok(doc)
    }

}
