use crate::config::AppState;
use crate::error::Result;
use crate::project::{Project, ProjectSettings};
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct CreateProjectParams {
    pub name: String,
    pub description: Option<String>,
}

#[tauri::command]
pub fn create_project(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
) -> Result<Project> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    let project = Project {
        id: id.clone(),
        name: name.clone(),
        description,
        created_at: now,
        updated_at: now,
        settings: ProjectSettings::default(),
        path: state.config.projects_dir.join(format!("{}.json", id)),
    };

    // Create project directory
    let project_dir = state.config.projects_dir.join(&id);
    fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(project_dir.join("documents")).map_err(|e| e.to_string())?;
    fs::create_dir_all(project_dir.join("versions")).map_err(|e| e.to_string())?;

    // Save project metadata
    let project_json = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
    fs::write(&project.path, project_json).map_err(|e| e.to_string())?;

    Ok(project)
}

#[tauri::command]
pub fn open_project(state: State<'_, AppState>, project_id: String) -> Result<Project> {
    let project_path = state.get_project_path(&project_id);

    if !project_path.exists() {
        return Err(format!("Project not found: {}", project_id));
    }

    let json = fs::read_to_string(&project_path).map_err(|e| e.to_string())?;
    let project: Project = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    Ok(project)
}

#[tauri::command]
pub fn save_project(state: State<'_, AppState>, mut project: Project) -> Result<Project> {
    project.updated_at = chrono::Utc::now().timestamp();
    project.path = state.get_project_path(&project.id);

    let project_json = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
    fs::write(&project.path, project_json).map_err(|e| e.to_string())?;

    Ok(project)
}

#[tauri::command]
pub fn rename_project(state: State<'_, AppState>, project_id: String, new_name: String) -> Result<Project> {
    let project_path = state.get_project_path(&project_id);

    if !project_path.exists() {
        return Err(format!("Project not found: {}", project_id));
    }

    let json = fs::read_to_string(&project_path).map_err(|e| e.to_string())?;
    let mut project: Project = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    project.name = new_name;
    project.updated_at = chrono::Utc::now().timestamp();

    let project_json = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
    fs::write(&project_path, project_json).map_err(|e| e.to_string())?;

    Ok(project)
}

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, project_id: String) -> Result<()> {
    let project_path = state.get_project_path(&project_id);
    let project_dir = state.config.projects_dir.join(&project_id);

    // Remove project metadata file
    if project_path.exists() {
        fs::remove_file(&project_path).map_err(|e| e.to_string())?;
    }

    // Remove project directory
    if project_dir.exists() {
        fs::remove_dir_all(&project_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>> {
    let mut projects = Vec::new();

    let entries = fs::read_dir(&state.config.projects_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // Only process .json files (project metadata)
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(json) = fs::read_to_string(&path) {
                if let Ok(project) = serde_json::from_str::<Project>(&json) {
                    projects.push(project);
                }
            }
        }
    }

    // Sort by updated_at (most recent first)
    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(projects)
}
