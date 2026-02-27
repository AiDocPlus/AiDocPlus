use crate::config::get_workspace_state_path;
use crate::workspace::{clear_workspace_state, load_workspace_state, save_workspace_state, WorkspaceState, WorkspaceTabState, UIState};
use tauri::AppHandle;

#[tauri::command]
pub fn save_workspace(
    handle: AppHandle,
    current_project_id: Option<String>,
    open_document_ids: Vec<String>,
    current_document_id: Option<String>,
    tabs: Vec<WorkspaceTabState>,
    active_tab_id: Option<String>,
    ui_state: UIState,
) -> Result<(), String> {
    let workspace_state = WorkspaceState {
        current_project_id,
        open_document_ids,
        current_document_id,
        tabs,
        active_tab_id,
        ui_state,
        last_saved_at: chrono::Utc::now().timestamp(),
    };

    let path = get_workspace_state_path(&handle);
    save_workspace_state(&workspace_state, &path)?;
    Ok(())
}

#[tauri::command]
pub fn load_workspace(handle: AppHandle) -> Result<Option<WorkspaceState>, String> {
    let path = get_workspace_state_path(&handle);
    load_workspace_state(&path)
}

#[tauri::command]
pub fn clear_workspace(handle: AppHandle) -> Result<(), String> {
    let path = get_workspace_state_path(&handle);
    clear_workspace_state(&path)
}
