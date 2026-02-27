use crate::config::AppState;
use crate::error::Result;
use crate::project::{Project, ProjectSettings};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
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

/// 将项目导出为 ZIP 压缩包（包含项目元数据 + 所有文档）
#[allow(non_snake_case)]
#[tauri::command]
pub fn export_project_zip(
    state: State<'_, AppState>,
    projectId: String,
    outputPath: String,
) -> Result<String> {
    let project_meta_path = state.get_project_path(&projectId);
    let project_dir = state.config.projects_dir.join(&projectId);

    if !project_meta_path.exists() {
        return Err(format!("项目未找到: {}", projectId));
    }

    let output = Path::new(&outputPath);
    let file = fs::File::create(output).map_err(|e| format!("创建 ZIP 文件失败: {}", e))?;
    let mut zip_writer = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 写入项目元数据
    let meta_json = fs::read_to_string(&project_meta_path)
        .map_err(|e| format!("读取项目元数据失败: {}", e))?;
    zip_writer
        .start_file("project.json", options)
        .map_err(|e| format!("ZIP 写入失败: {}", e))?;
    zip_writer
        .write_all(meta_json.as_bytes())
        .map_err(|e| format!("ZIP 写入失败: {}", e))?;

    // 写入所有文档
    let docs_dir = project_dir.join("documents");
    if docs_dir.exists() {
        let entries = fs::read_dir(&docs_dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let file_name = path.file_name().unwrap().to_string_lossy().to_string();
                let content = fs::read_to_string(&path)
                    .map_err(|e| format!("读取文档失败: {}", e))?;
                zip_writer
                    .start_file(format!("documents/{}", file_name), options)
                    .map_err(|e| format!("ZIP 写入失败: {}", e))?;
                zip_writer
                    .write_all(content.as_bytes())
                    .map_err(|e| format!("ZIP 写入失败: {}", e))?;
            }
        }
    }

    // 写入版本历史目录（如果存在）
    let versions_dir = project_dir.join("versions");
    if versions_dir.exists() {
        fn add_dir_to_zip(
            zip_writer: &mut zip::ZipWriter<fs::File>,
            dir: &Path,
            prefix: &str,
            options: zip::write::FileOptions,
        ) -> std::result::Result<(), String> {
            let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
            for entry in entries {
                let entry = entry.map_err(|e| e.to_string())?;
                let path = entry.path();
                let name = path.file_name().unwrap().to_string_lossy().to_string();
                let zip_path = format!("{}/{}", prefix, name);
                if path.is_dir() {
                    add_dir_to_zip(zip_writer, &path, &zip_path, options)?;
                } else {
                    let content = fs::read_to_string(&path)
                        .map_err(|e| format!("读取文件失败: {}", e))?;
                    zip_writer
                        .start_file(&zip_path, options)
                        .map_err(|e| format!("ZIP 写入失败: {}", e))?;
                    zip_writer
                        .write_all(content.as_bytes())
                        .map_err(|e| format!("ZIP 写入失败: {}", e))?;
                }
            }
            Ok(())
        }
        add_dir_to_zip(&mut zip_writer, &versions_dir, "versions", options)?;
    }

    zip_writer
        .finish()
        .map_err(|e| format!("ZIP 完成失败: {}", e))?;

    Ok(outputPath)
}

/// 从 ZIP 压缩包导入项目
#[allow(non_snake_case)]
#[tauri::command]
pub fn import_project_zip(
    state: State<'_, AppState>,
    zipPath: String,
) -> Result<Project> {
    let zip_file = fs::File::open(&zipPath)
        .map_err(|e| format!("打开 ZIP 文件失败: {}", e))?;
    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| format!("解析 ZIP 文件失败: {}", e))?;

    // 先读取项目元数据
    let mut meta_json = String::new();
    {
        let mut meta_file = archive
            .by_name("project.json")
            .map_err(|_| "ZIP 中未找到 project.json，不是有效的项目备份".to_string())?;
        meta_file
            .read_to_string(&mut meta_json)
            .map_err(|e| format!("读取项目元数据失败: {}", e))?;
    }

    let mut project: Project = serde_json::from_str(&meta_json)
        .map_err(|e| format!("解析项目元数据失败: {}", e))?;

    // 检查 ID 冲突，如果已存在则生成新 ID
    let existing_path = state.get_project_path(&project.id);
    let new_id = if existing_path.exists() {
        let id = Uuid::new_v4().to_string();
        project.name = format!("{} (导入)", project.name);
        id
    } else {
        project.id.clone()
    };

    let old_id = project.id.clone();
    project.id = new_id.clone();
    project.path = state.get_project_path(&new_id);
    project.updated_at = chrono::Utc::now().timestamp();

    // 创建项目目录
    let project_dir = state.config.projects_dir.join(&new_id);
    fs::create_dir_all(project_dir.join("documents")).map_err(|e| e.to_string())?;
    fs::create_dir_all(project_dir.join("versions")).map_err(|e| e.to_string())?;

    // 保存项目元数据
    let project_json = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
    fs::write(&project.path, &project_json).map_err(|e| e.to_string())?;

    // 解压文档和版本文件
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().to_string();

        if name == "project.json" {
            continue; // 已处理
        }

        let target_path = if name.starts_with("documents/") || name.starts_with("versions/") {
            project_dir.join(&name)
        } else {
            continue; // 跳过未知文件
        };

        // 确保父目录存在
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut content = String::new();
        file.read_to_string(&mut content)
            .map_err(|e| format!("读取 ZIP 内文件失败: {}", e))?;

        // 如果 ID 变了，需要更新文档中的 projectId
        if old_id != new_id && name.starts_with("documents/") {
            content = content.replace(
                &format!("\"projectId\":\"{}\"", old_id),
                &format!("\"projectId\":\"{}\"", new_id),
            );
            // 也处理带空格的 JSON 格式
            content = content.replace(
                &format!("\"projectId\": \"{}\"", old_id),
                &format!("\"projectId\": \"{}\"", new_id),
            );
        }

        fs::write(&target_path, content).map_err(|e| e.to_string())?;
    }

    Ok(project)
}
