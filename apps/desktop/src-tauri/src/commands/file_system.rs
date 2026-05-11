use crate::error::{AppError, Result, ResultExt};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSystemEntry {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub is_file: bool,
    pub children: Option<Vec<FileSystemEntry>>,
}


#[tauri::command]
pub fn read_directory(path: String) -> Result<FileSystemEntry> {
    let path_obj = Path::new(&path);

    // 读取操作也需要路径验证（安全限制）
    crate::security::validate_path_allowed(path_obj, "读取目录")
        .context("读取目录失败")?;

    if !path_obj.exists() {
        return Err(AppError::Internal(format!("Path does not exist: {}", path)));
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

    let entries = fs::read_dir(&path)?
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
    // 读取操作也需要路径验证（安全限制）
    let path_obj = Path::new(&path);
    crate::security::validate_path_allowed(path_obj, "读取文件")
        .context("读取文件失败")?;

    if !path_obj.exists() {
        return Err(AppError::Internal(format!("File not found: {}", path)));
    }
    Ok(fs::read_to_string(&path)?)
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<()> {
    let path = Path::new(&path);
    // 写操作需要严格的路径验证
    crate::security::validate_path_allowed(path, "写入文件路径")
        .context("写入文件失败")?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(fs::write(path, content)?)
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<()> {
    let path = Path::new(&path);
    // 删除操作需要严格的路径验证
    crate::security::validate_path_allowed(path, "删除文件路径")
        .context("删除文件失败")?;

    Ok(fs::remove_file(path)?)
}

/// 读取文件并返回 base64 data URI（如 data:image/png;base64,...）
#[tauri::command]
#[allow(non_snake_case)]
pub fn read_file_base64(path: String) -> Result<String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let file_path = Path::new(&path);
    // 安全验证：限制在允许的目录下
    crate::security::validate_path_allowed(file_path, "读取文件")
        .context("读取文件失败：路径不在允许的目录下")?;

    if !file_path.exists() {
        return Err(AppError::Internal(format!("文件不存在: {}", path)));
    }

    // 文件大小检查：超过 50MB 拒绝
    const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB
    let metadata = fs::metadata(file_path).context("获取文件信息失败")?;
    if metadata.len() > MAX_FILE_SIZE {
        return Err(AppError::ValidationError(format!(
            "文件过大（{} MB），最大允许 {} MB",
            metadata.len() / 1024 / 1024,
            MAX_FILE_SIZE / 1024 / 1024
        )));
    }

    let bytes = fs::read(file_path).context("读取文件失败")?;

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

/// 读取文本文件内容（自动检测编码，支持 UTF-8/GBK/GB2312 等）
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String> {
    let file_path = Path::new(&path);
    // 安全验证：限制在允许的目录下
    crate::security::validate_path_allowed(file_path, "读取文本文件")
        .context("读取文件失败：路径不在允许的目录下")?;
    if !file_path.exists() {
        return Err(AppError::Internal(format!("文件不存在: {}", path)));
    }

    // 文件大小检查：超过 50MB 拒绝
    const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB
    let metadata = fs::metadata(file_path).context("获取文件信息失败")?;
    if metadata.len() > MAX_FILE_SIZE {
        return Err(AppError::ValidationError(format!(
            "文件过大（{} MB），最大允许 {} MB",
            metadata.len() / 1024 / 1024,
            MAX_FILE_SIZE / 1024 / 1024
        )));
    }

    let bytes = fs::read(file_path).context("读取文件失败")?;

    // 先尝试 UTF-8
    if let Ok(s) = std::str::from_utf8(&bytes) {
        return Ok(s.to_string());
    }

    // UTF-8 失败，使用 chardetng 检测编码
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(&bytes, true);
    let encoding = detector.guess(None, true);
    let (decoded, _, had_errors) = encoding.decode(&bytes);
    if had_errors {
        // 回退：强制用 GBK 解码
        let (decoded_gbk, _, _) = encoding_rs::GBK.decode(&bytes);
        Ok(decoded_gbk.into_owned())
    } else {
        Ok(decoded.into_owned())
    }
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<()> {
    let path = Path::new(&path);
    // 创建目录操作需要严格的路径验证
    crate::security::validate_path_allowed(path, "创建目录")
        .context("创建目录失败")?;

    Ok(fs::create_dir_all(path)?)
}

/// 获取文件元数据（大小等），供插件查询附件大小
#[tauri::command]
pub fn get_file_metadata(path: String) -> Result<serde_json::Value> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(AppError::Internal(format!("文件不存在: {}", path)));
    }
    // 安全校验：路径必须在允许的目录内（文件已存在，canonicalize 可正常执行）
    crate::security::validate_path_allowed(file_path, "文件路径")
        .context("获取文件信息失败：路径不在允许的目录下")?;
    let metadata = fs::metadata(file_path).context("获取文件信息失败")?;
    Ok(serde_json::json!({
        "size": metadata.len(),
        "isFile": metadata.is_file(),
        "isDir": metadata.is_dir(),
    }))
}

/// 获取用户主目录路径
#[tauri::command]
pub fn get_home_dir() -> Result<String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| AppError::Internal("无法获取用户主目录".to_string()))
}

/// 获取文档在磁盘上的文件路径（跨平台安全拼接）
#[tauri::command]
pub fn get_document_file_path(project_id: String, document_id: String) -> Result<String> {
    crate::security::validate_id(&project_id, "projectId")?;
    crate::security::validate_id(&document_id, "documentId")?;
    let doc_path = crate::config::current_data_root()
        .join("Projects")
        .join(&project_id)
        .join("documents")
        .join(format!("{}.json", document_id));
    Ok(doc_path.to_string_lossy().to_string())
}

/// 在操作系统文件管理器中显示文件（macOS Finder / Windows Explorer）
#[tauri::command]
pub fn show_in_folder(path: String) -> Result<()> {
    let path_obj = Path::new(&path);

    // 如果文件存在，打开其所在目录并选中文件
    // 如果不存在，尝试打开其父目录
    let target = if path_obj.exists() {
        path_obj.to_path_buf()
    } else if let Some(parent) = path_obj.parent() {
        if parent.exists() {
            parent.to_path_buf()
        } else {
            return Err(AppError::Internal(format!("路径不存在: {}", path)));
        }
    } else {
        return Err(AppError::Internal(format!("路径不存在: {}", path)));
    };

    // 安全校验：目标路径必须在允许的目录内
    crate::security::validate_path_allowed(&target, "显示文件路径")
        .context("路径不在允许的目录内")?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &target.to_string_lossy()])
            .spawn()
            .context("打开 Finder 失败")?;
    }

    #[cfg(target_os = "windows")]
    {
        // Windows explorer 要求 /select, 后紧跟路径（合并为一个参数），路径使用反斜杠
        let win_path = target.to_string_lossy().replace('/', "\\");
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", win_path))
            .spawn()
            .context("打开资源管理器失败")?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = &target;
    }

    Ok(())
}
