use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 版本数量限制，防止存储耗尽
const MAX_VERSIONS: usize = 1000;

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

        let initial_version = DocumentVersion {
            id: version_id.clone(),
            document_id: id.clone(),
            content: String::new(),
            author_notes: String::new(),
            ai_generated_content: String::new(),
            created_at: now,
            created_by: "user".to_string(),
            change_description: Some("Initial version".to_string()),
            plugin_data: None,
            enabled_plugins: None,
            composed_content: None,
        };

        Self {
            id,
            project_id,
            title,
            content: String::new(),
            author_notes: String::new(),
            ai_generated_content: String::new(),
            versions: vec![initial_version],
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
        }
    }

    pub fn save(&self, path: &PathBuf) -> std::result::Result<(), AppError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self)?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn load(path: &PathBuf) -> std::result::Result<Self, AppError> {
        let json = fs::read_to_string(path)?;
        let doc: Self = serde_json::from_str(&json)?;
        Ok(doc)
    }

    pub fn create_version(
        &mut self,
        content: String,
        author_notes: String,
        ai_generated_content: String,
        created_by: String,
        change_description: Option<String>,
        plugin_data: Option<serde_json::Value>,
        enabled_plugins: Option<Vec<String>>,
        composed_content: Option<String>,
    ) {
        let version_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();

        let version = DocumentVersion {
            id: version_id.clone(),
            document_id: self.id.clone(),
            content,
            author_notes,
            ai_generated_content,
            created_at: now,
            created_by,
            change_description,
            plugin_data,
            enabled_plugins,
            composed_content,
        };

        self.versions.push(version);

        // 版本数量限制：超过限制时删除最旧的非当前版本
        while self.versions.len() > MAX_VERSIONS {
            // 找到最旧的非当前版本并删除
            if let Some(oldest_idx) = self.versions.iter().enumerate()
                .filter(|(_, v)| v.id != self.current_version_id)
                .min_by_key(|(_, v)| v.created_at)
                .map(|(idx, _)| idx)
            {
                self.versions.remove(oldest_idx);
            } else {
                // 如果所有版本都是当前版本（不太可能），删除第一个
                self.versions.remove(0);
            }
        }

        self.current_version_id = version_id;
        self.metadata.updated_at = now;
    }
}
