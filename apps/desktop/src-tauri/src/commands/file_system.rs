use crate::error::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSystemEntry {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub is_file: bool,
    pub children: Option<Vec<FileSystemEntry>>,
}

/// 验证路径是否在允许的基础目录内，防止路径遍历攻击
fn validate_path_in_allowed_dir(path: &Path, allowed_dirs: &[PathBuf]) -> Result<PathBuf> {
    // 规范化路径（解析 ..、. 和符号链接）
    let canonical = path.canonicalize()
        .map_err(|e| format!("路径无效或不存在: {}", e))?;

    // 检查路径是否在任一允许的目录内
    for allowed_dir in allowed_dirs {
        if let Ok(allowed_canonical) = allowed_dir.canonicalize() {
            if canonical.starts_with(&allowed_canonical) {
                return Ok(canonical);
            }
        }
    }

    Err("路径遍历尝试被检测到：路径不在允许的目录内".to_string())
}

/// 获取允许的目录列表（应用数据目录 + 用户主目录）
fn get_allowed_directories() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // 应用项目目录
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join("AiDocPlus"));
    }

    // 用户主目录（用于导入文件）
    if let Some(home) = dirs::home_dir() {
        dirs.push(home);
    }

    // 临时目录
    dirs.push(std::env::temp_dir());

    dirs
}

#[tauri::command]
pub fn read_directory(path: String) -> Result<FileSystemEntry> {
    let path_obj = Path::new(&path);

    if !path_obj.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let name = path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    if path_obj.is_file() {
        return Ok(FileSystemEntry {
            path,
            name,
            is_directory: false,
            is_file: true,
            children: None,
        });
    }

    let entries = fs::read_dir(&path)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            // Filter hidden files
            entry
                .file_name()
                .to_str()
                .map(|n| !n.starts_with('.'))
                .unwrap_or(false)
        })
        .map(|entry| {
            let entry_path = entry.path();
            let entry_name = entry
                .file_name()
                .to_str()
                .unwrap_or("")
                .to_string();

            Ok(FileSystemEntry {
                path: entry_path.to_string_lossy().to_string(),
                name: entry_name,
                is_directory: entry_path.is_dir(),
                is_file: entry_path.is_file(),
                children: None,
            })
        })
        .collect::<Result<Vec<_>>>()?;

    Ok(FileSystemEntry {
        path,
        name,
        is_directory: true,
        is_file: false,
        children: Some(entries),
    })
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String> {
    if !Path::new(&path).exists() {
        return Err(format!("File not found: {}", path));
    }
    Ok(fs::read_to_string(&path).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<()> {
    let path = Path::new(&path);
    // 写操作需要严格的路径验证
    let allowed_dirs = get_allowed_directories();
    validate_path_in_allowed_dir(path, &allowed_dirs)
        .map_err(|e| format!("写入文件失败: {}", e))?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(fs::write(path, content).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<()> {
    let path = Path::new(&path);
    // 删除操作需要严格的路径验证
    let allowed_dirs = get_allowed_directories();
    validate_path_in_allowed_dir(path, &allowed_dirs)
        .map_err(|e| format!("删除文件失败: {}", e))?;

    Ok(fs::remove_file(path).map_err(|e| e.to_string())?)
}

/// 读取文件并返回 base64 data URI（如 data:image/png;base64,...）
#[tauri::command]
#[allow(non_snake_case)]
pub fn read_file_base64(path: String) -> Result<String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    let bytes = fs::read(file_path).map_err(|e| format!("读取文件失败: {}", e))?;

    let mime = match file_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    };

    let b64 = STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<()> {
    let path = Path::new(&path);
    // 创建目录操作需要严格的路径验证
    let allowed_dirs = get_allowed_directories();
    validate_path_in_allowed_dir(path, &allowed_dirs)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    Ok(fs::create_dir_all(path).map_err(|e| e.to_string())?)
}
