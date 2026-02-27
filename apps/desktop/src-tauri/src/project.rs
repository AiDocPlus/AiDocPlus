use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub settings: ProjectSettings,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    #[serde(rename = "aiProvider")]
    pub ai_provider: String,
    #[serde(rename = "defaultExportFormat")]
    pub default_export_format: String,
    #[serde(rename = "autoSaveInterval")]
    pub autosave_interval: u64,
    #[serde(rename = "versionHistoryLimit")]
    pub version_history_limit: usize,
    pub theme: String,
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            ai_provider: "openai".to_string(),
            default_export_format: "md".to_string(),
            autosave_interval: 30,
            version_history_limit: 50,
            theme: "dark".to_string(),
        }
    }
}
