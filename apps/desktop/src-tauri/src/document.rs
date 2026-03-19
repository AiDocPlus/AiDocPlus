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
    // ── 小说扩展字段 ──
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "parentId")]
    pub parent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "sortOrder")]
    pub sort_order: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "documentType")]
    pub document_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "chapterOutline")]
    pub chapter_outline: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "chapterSummary")]
    pub chapter_summary: Option<String>,
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
            parent_id: None,
            sort_order: None,
            document_type: None,
            chapter_outline: None,
            chapter_summary: None,
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
        self.chapter_outline = None;
        self.chapter_summary = None;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_doc() -> Document {
        Document::new("proj-1".into(), "测试文档".into(), "author".into())
    }

    // ── 序列化 ──

    #[test]
    fn serialize_uses_camel_case_keys() {
        let doc = make_test_doc();
        let json = serde_json::to_string(&doc).unwrap();
        assert!(json.contains("\"projectId\""));
        assert!(json.contains("\"authorNotes\""));
        assert!(json.contains("\"aiGeneratedContent\""));
        assert!(json.contains("\"currentVersionId\""));
        assert!(json.contains("\"createdAt\""));
        assert!(json.contains("\"updatedAt\""));
        assert!(json.contains("\"wordCount\""));
        assert!(json.contains("\"characterCount\""));
        // snake_case 不应出现
        assert!(!json.contains("\"project_id\""));
        assert!(!json.contains("\"author_notes\""));
    }

    #[test]
    fn optional_none_fields_omitted() {
        let doc = make_test_doc();
        let json = serde_json::to_string(&doc).unwrap();
        // pluginData / enabledPlugins / composedContent / aiServiceId 为 None 时不序列化
        assert!(!json.contains("\"pluginData\""));
        assert!(!json.contains("\"enabledPlugins\""));
        assert!(!json.contains("\"composedContent\""));
        assert!(!json.contains("\"aiServiceId\""));
    }

    #[test]
    fn optional_some_fields_included() {
        let mut doc = make_test_doc();
        doc.plugin_data = Some(serde_json::json!({"key": "val"}));
        doc.enabled_plugins = Some(vec!["p1".into()]);
        doc.composed_content = Some("composed".into());
        doc.ai_service_id = Some("svc-1".into());
        let json = serde_json::to_string(&doc).unwrap();
        assert!(json.contains("\"pluginData\""));
        assert!(json.contains("\"enabledPlugins\""));
        assert!(json.contains("\"composedContent\""));
        assert!(json.contains("\"aiServiceId\""));
    }

    // ── 反序列化 ──

    #[test]
    fn deserialize_minimal_json() {
        let json = r#"{
            "id": "d1",
            "projectId": "p1",
            "title": "T",
            "content": "C",
            "authorNotes": "N",
            "aiGeneratedContent": "G",
            "currentVersionId": "v1",
            "metadata": {
                "createdAt": 1000,
                "updatedAt": 2000,
                "author": "A",
                "tags": [],
                "wordCount": 5,
                "characterCount": 10
            }
        }"#;
        let doc: Document = serde_json::from_str(json).unwrap();
        assert_eq!(doc.id, "d1");
        assert_eq!(doc.project_id, "p1");
        assert_eq!(doc.title, "T");
        assert!(doc.attachments.is_empty());
        assert!(doc.plugin_data.is_none());
        assert!(doc.enabled_plugins.is_none());
        assert!(doc.composed_content.is_none());
        assert!(doc.ai_service_id.is_none());
    }

    #[test]
    fn roundtrip_serialize_deserialize() {
        let mut doc = make_test_doc();
        doc.content = "Hello World".into();
        doc.author_notes = "Notes".into();
        doc.ai_generated_content = "AI content".into();
        doc.plugin_data = Some(serde_json::json!({"x": 1}));
        doc.enabled_plugins = Some(vec!["email".into()]);
        doc.ai_service_id = Some("openai-1".into());

        let json = serde_json::to_string_pretty(&doc).unwrap();
        let restored: Document = serde_json::from_str(&json).unwrap();

        assert_eq!(restored.id, doc.id);
        assert_eq!(restored.project_id, doc.project_id);
        assert_eq!(restored.title, doc.title);
        assert_eq!(restored.content, doc.content);
        assert_eq!(restored.author_notes, doc.author_notes);
        assert_eq!(restored.ai_generated_content, doc.ai_generated_content);
        assert_eq!(restored.ai_service_id, doc.ai_service_id);
        assert_eq!(restored.enabled_plugins, doc.enabled_plugins);
    }

    // ── save / load 往返 ──

    #[test]
    fn save_and_load_roundtrip() {
        let dir = std::env::temp_dir().join("aidocplus_test_doc_roundtrip");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("test_doc.json");

        let mut doc = make_test_doc();
        doc.content = "测试内容".into();
        doc.save(&path).unwrap();

        let loaded = Document::load(&path).unwrap();
        assert_eq!(loaded.id, doc.id);
        assert_eq!(loaded.content, "测试内容");

        // 清理
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir(&dir);
    }

    // ── without_versions / metadata_only ──

    #[test]
    fn without_versions_clears_versions() {
        let mut doc = make_test_doc();
        doc.versions.push(DocumentVersion {
            id: "v1".into(),
            document_id: doc.id.clone(),
            content: "old".into(),
            author_notes: String::new(),
            ai_generated_content: String::new(),
            created_at: 0,
            created_by: "sys".into(),
            change_description: None,
            plugin_data: None,
            enabled_plugins: None,
            composed_content: None,
        });
        assert_eq!(doc.versions.len(), 1);
        let doc = doc.without_versions();
        assert!(doc.versions.is_empty());
    }

    #[test]
    fn metadata_only_clears_content_fields() {
        let mut doc = make_test_doc();
        doc.content = "big content".into();
        doc.author_notes = "notes".into();
        doc.ai_generated_content = "ai".into();
        doc.composed_content = Some("composed".into());
        let doc = doc.metadata_only();
        assert!(doc.content.is_empty());
        assert!(doc.author_notes.is_empty());
        assert!(doc.ai_generated_content.is_empty());
        assert!(doc.composed_content.is_none());
        // title 和 metadata 保留
        assert_eq!(doc.title, "测试文档");
        assert_eq!(doc.metadata.author, "author");
    }
}
