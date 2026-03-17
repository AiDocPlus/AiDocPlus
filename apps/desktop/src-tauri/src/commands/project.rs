use crate::config::AppState;
use crate::error::{AppError, Result};
use crate::project::{Project, ProjectSettings};
use crate::security;
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
    security::validate_title(&name)?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    let project = Project {
        id: id.clone(),
        name: name.clone(),
        description,
        created_at: now,
        updated_at: now,
        settings: ProjectSettings::default(),
        path: state.config().projects_dir.join(format!("{}.json", id)),
    };

    // Create project directory
    let project_dir = state.config().projects_dir.join(&id);
    fs::create_dir_all(&project_dir)?;
    fs::create_dir_all(project_dir.join("documents"))?;
    fs::create_dir_all(project_dir.join("versions"))?;

    // Save project metadata
    let project_json = serde_json::to_string_pretty(&project)?;
    crate::config::atomic_write(&project.path, &project_json)?;

    Ok(project)
}

#[tauri::command]
pub fn open_project(state: State<'_, AppState>, project_id: String) -> Result<Project> {
    security::validate_id(&project_id, "project_id")?;
    let project_path = state.get_project_path(&project_id);

    if !project_path.exists() {
        return Err(AppError::ProjectNotFound(format!("项目未找到: {}", project_id)));
    }

    let json = fs::read_to_string(&project_path)?;
    let project: Project = serde_json::from_str(&json)?;

    Ok(project)
}

#[tauri::command]
pub fn save_project(state: State<'_, AppState>, mut project: Project) -> Result<Project> {
    security::validate_id(&project.id, "project.id")?;
    project.updated_at = chrono::Utc::now().timestamp();
    project.path = state.get_project_path(&project.id);

    let project_json = serde_json::to_string_pretty(&project)?;
    crate::config::atomic_write(&project.path, &project_json)?;

    Ok(project)
}

#[tauri::command]
pub fn rename_project(state: State<'_, AppState>, project_id: String, new_name: String) -> Result<Project> {
    security::validate_id(&project_id, "project_id")?;
    security::validate_title(&new_name)?;
    let project_path = state.get_project_path(&project_id);

    if !project_path.exists() {
        return Err(AppError::ProjectNotFound(format!("项目未找到: {}", project_id)));
    }

    let json = fs::read_to_string(&project_path)?;
    let mut project: Project = serde_json::from_str(&json)?;

    project.name = new_name;
    project.updated_at = chrono::Utc::now().timestamp();

    let project_json = serde_json::to_string_pretty(&project)?;
    crate::config::atomic_write(&project_path, &project_json)?;

    Ok(project)
}

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, project_id: String) -> Result<()> {
    security::validate_id(&project_id, "project_id")?;
    let project_path = state.get_project_path(&project_id);
    let project_dir = state.config().projects_dir.join(&project_id);

    // Remove project metadata file
    if project_path.exists() {
        fs::remove_file(&project_path)?;
    }

    // Remove project directory
    if project_dir.exists() {
        fs::remove_dir_all(&project_dir)?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>> {
    let mut projects = Vec::new();

    let entries = fs::read_dir(&state.config().projects_dir)?;

    for entry in entries {
        let entry = entry?;
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
    security::validate_id(&projectId, "projectId")?;
    let project_meta_path = state.get_project_path(&projectId);
    let project_dir = state.config().projects_dir.join(&projectId);

    if !project_meta_path.exists() {
        return Err(AppError::ProjectNotFound(format!("项目未找到: {}", projectId)));
    }

    let output = Path::new(&outputPath);
    let file = fs::File::create(output).map_err(|e| AppError::ExportFailed(format!("创建 ZIP 文件失败: {}", e)))?;
    let mut zip_writer = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 写入项目元数据
    let meta_json = fs::read_to_string(&project_meta_path)
        .map_err(|e| AppError::ExportFailed(format!("读取项目元数据失败: {}", e)))?;
    zip_writer
        .start_file("project.json", options)
        .map_err(|e| AppError::ExportFailed(format!("ZIP 写入失败: {}", e)))?;
    zip_writer
        .write_all(meta_json.as_bytes())
        .map_err(|e| AppError::ExportFailed(format!("ZIP 写入失败: {}", e)))?;

    // 写入所有文档
    let docs_dir = project_dir.join("documents");
    if docs_dir.exists() {
        let entries = fs::read_dir(&docs_dir)?;
        for entry in entries {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let file_name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                let content = fs::read_to_string(&path)
                    .map_err(|e| AppError::ExportFailed(format!("读取文档失败: {}", e)))?;
                zip_writer
                    .start_file(format!("documents/{}", file_name), options)
                    .map_err(|e| AppError::ExportFailed(format!("ZIP 写入失败: {}", e)))?;
                zip_writer
                    .write_all(content.as_bytes())
                    .map_err(|e| AppError::ExportFailed(format!("ZIP 写入失败: {}", e)))?;
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
            options: zip::write::SimpleFileOptions,
        ) -> crate::error::Result<()> {
            let entries = fs::read_dir(dir)?;
            for entry in entries {
                let entry = entry?;
                let path = entry.path();
                let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                let zip_path = format!("{}/{}", prefix, name);
                if path.is_dir() {
                    add_dir_to_zip(zip_writer, &path, &zip_path, options)?;
                } else {
                    let content = fs::read_to_string(&path)
                        .map_err(|e| AppError::ExportFailed(format!("读取文件失败: {}", e)))?;
                    zip_writer
                        .start_file(&zip_path, options)
                        .map_err(|e| AppError::ExportFailed(format!("ZIP 写入失败: {}", e)))?;
                    zip_writer
                        .write_all(content.as_bytes())
                        .map_err(|e| AppError::ExportFailed(format!("ZIP 写入失败: {}", e)))?;
                }
            }
            Ok(())
        }
        add_dir_to_zip(&mut zip_writer, &versions_dir, "versions", options)?;
    }

    zip_writer
        .finish()
        .map_err(|e| AppError::ExportFailed(format!("ZIP 完成失败: {}", e)))?;

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
        .map_err(|e| AppError::ImportFailed(format!("打开 ZIP 文件失败: {}", e)))?;
    let mut archive = zip::ZipArchive::new(zip_file)
        .map_err(|e| AppError::ImportFailed(format!("解析 ZIP 文件失败: {}", e)))?;

    // ZIP 安全检查：文件数量限制
    if archive.len() > 1000 {
        return Err(AppError::SecurityError(format!("ZIP 文件包含过多条目 ({} > 1000)，可能不安全", archive.len())));
    }

    // 先读取项目元数据
    let mut meta_json = String::new();
    {
        let mut meta_file = archive
            .by_name("project.json")
            .map_err(|_| AppError::ImportFailed("ZIP 中未找到 project.json，不是有效的项目备份".to_string()))?;
        // 元数据文件大小限制 (1 MB)
        if meta_file.size() > 1024 * 1024 {
            return Err(AppError::SecurityError("project.json 过大，可能不是有效的项目备份".to_string()));
        }
        meta_file
            .read_to_string(&mut meta_json)
            .map_err(|e| AppError::ImportFailed(format!("读取项目元数据失败: {}", e)))?;
    }

    let mut project: Project = serde_json::from_str(&meta_json)
        .map_err(|e| AppError::ImportFailed(format!("解析项目元数据失败: {}", e)))?;

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
    let project_dir = state.config().projects_dir.join(&new_id);
    fs::create_dir_all(project_dir.join("documents"))?;
    fs::create_dir_all(project_dir.join("versions"))?;

    // 保存项目元数据
    let project_json = serde_json::to_string_pretty(&project)?;
    crate::config::atomic_write(&project.path, &project_json)?;

    // 解压文档和版本文件
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| AppError::ImportFailed(format!("读取 ZIP 条目失败: {}", e)))?;
        let name = file.name().to_string();

        if name == "project.json" {
            continue; // 已处理
        }

        let target_path = if name.starts_with("documents/") || name.starts_with("versions/") {
            let joined = project_dir.join(&name);
            // 路径遍历防护：确保解压目标在 project_dir 内
            let canonical_project = project_dir.canonicalize().unwrap_or_else(|_| project_dir.clone());
            if let Some(parent) = joined.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let canonical_target = joined.canonicalize().unwrap_or_else(|_| joined.clone());
            if !canonical_target.starts_with(&canonical_project) {
                return Err(AppError::SecurityError(format!("ZIP 路径遍历攻击: {}", name)));
            }
            joined
        } else {
            continue; // 跳过未知文件
        };

        // 单文件大小限制 (50 MB)
        if file.size() > 50 * 1024 * 1024 {
            return Err(AppError::SecurityError(format!("ZIP 内文件过大: {} ({} 字节)", name, file.size())));
        }

        // 确保父目录存在
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut content = String::new();
        file.read_to_string(&mut content)
            .map_err(|e| AppError::ImportFailed(format!("读取 ZIP 内文件失败: {}", e)))?;

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

        fs::write(&target_path, content)?;
    }

    Ok(project)
}
