use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub projects_dir: PathBuf,
    pub autosave_interval: u64,
    pub max_versions: usize,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        Self {
            projects_dir: home.join("AiDocPlus").join("Projects"),
            autosave_interval: 30,
            max_versions: 50,
        }
    }
}

pub struct AppState {
    pub config: AppConfig,
}

impl AppState {
    pub fn new() -> Self {
        let config = AppConfig::default();

        // Ensure projects directory exists
        if let Err(e) = std::fs::create_dir_all(&config.projects_dir) {
            eprintln!("Failed to create projects directory: {}", e);
        }

        Self { config }
    }

    pub fn get_project_path(&self, project_id: &str) -> PathBuf {
        self.config.projects_dir.join(format!("{}.json", project_id))
    }

    pub fn get_document_path(&self, project_id: &str, document_id: &str) -> PathBuf {
        self.config.projects_dir
            .join(project_id)
            .join("documents")
            .join(format!("{}.json", document_id))
    }

    #[allow(dead_code)]
    pub fn get_versions_path(&self, project_id: &str, document_id: &str) -> PathBuf {
        self.config.projects_dir
            .join(project_id)
            .join("versions")
            .join(document_id)
    }
}

// Helper to get config directory
pub fn get_config_dir(handle: &AppHandle) -> PathBuf {
    handle
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

// Helper to get data directory
#[allow(dead_code)]
pub fn get_data_dir(handle: &AppHandle) -> PathBuf {
    handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

// Re-export dirs
pub use dirs;

// Helper to get workspace state path
pub fn get_workspace_state_path(handle: &AppHandle) -> PathBuf {
    get_config_dir(handle).join("workspace-state.json")
}
