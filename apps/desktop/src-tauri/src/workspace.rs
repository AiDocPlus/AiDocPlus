use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabPanelState {
    pub version_history_open: bool,
    pub chat_open: bool,
    pub right_sidebar_open: bool,
    #[serde(default)]
    pub layout_mode: Option<String>,
    #[serde(default)]
    pub split_ratio: Option<f64>,
    #[serde(default)]
    pub chat_panel_width: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTabState {
    pub id: String,
    pub document_id: String,
    pub panel_state: TabPanelState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceState {
    pub current_project_id: Option<String>,
    pub open_document_ids: Vec<String>,
    pub current_document_id: Option<String>,
    #[serde(default)]
    pub tabs: Vec<WorkspaceTabState>,
    #[serde(default)]
    pub active_tab_id: Option<String>,
    pub ui_state: UIState,
    pub last_saved_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UIState {
    pub sidebar_open: bool,
    pub chat_open: bool,
    #[serde(default)]
    pub sidebar_width: Option<f64>,
    #[serde(default)]
    pub window_width: Option<f64>,
    #[serde(default)]
    pub window_height: Option<f64>,
    #[serde(default)]
    pub window_x: Option<f64>,
    #[serde(default)]
    pub window_y: Option<f64>,
}

impl Default for WorkspaceState {
    fn default() -> Self {
        Self {
            current_project_id: None,
            open_document_ids: Vec::new(),
            current_document_id: None,
            tabs: Vec::new(),
            active_tab_id: None,
            ui_state: UIState {
                sidebar_open: true,
                chat_open: true,
                sidebar_width: None,
                window_width: None,
                window_height: None,
                window_x: None,
                window_y: None,
            },
            last_saved_at: chrono::Utc::now().timestamp(),
        }
    }
}

pub fn save_workspace_state(state: &WorkspaceState, path: &PathBuf) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize workspace state: {}", e))?;
    fs::write(path, json)
        .map_err(|e| format!("Failed to write workspace state: {}", e))?;
    Ok(())
}

pub fn load_workspace_state(path: &PathBuf) -> Result<Option<WorkspaceState>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let json = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read workspace state: {}", e))?;
    let state: WorkspaceState = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse workspace state: {}", e))?;
    Ok(Some(state))
}

pub fn clear_workspace_state(path: &PathBuf) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| format!("Failed to remove workspace state: {}", e))?;
    }
    Ok(())
}
