#![allow(non_snake_case)]

use crate::config::AppState;
use crate::error::{AppError, Result, ResultExt};
use crate::native_export;
use std::time::{Duration, SystemTime};
use tauri::State;

/// 临时文件最大保留时间（24 小时）
const TEMP_FILE_MAX_AGE: Duration = Duration::from_secs(24 * 60 * 60);

/// 清理指定临时目录中超过 max_age 的旧文件（静默忽略错误）
fn cleanup_old_temp_files(dir: &std::path::Path, max_age: Duration) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let Ok(metadata) = entry.metadata() else { continue };
        if !metadata.is_file() { continue; }
        let Ok(modified) = metadata.modified() else { continue };
        if let Ok(age) = now.duration_since(modified) {
            if age > max_age {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}

/// 原生导出（无需外部依赖，公文排版标准）
#[tauri::command]
pub fn export_document_native(
    state: State<'_, AppState>,
    documentId: String,
    projectId: String,
    format: String,
    outputPath: String,
    contentOverride: Option<String>,
) -> Result<String> {
    crate::security::validate_id(&projectId, "projectId")?;
    crate::security::validate_id(&documentId, "documentId")?;

    // 安全校验：format 只允许安全字符
    if format.contains('/') || format.contains('\\') || format.contains('\0')
        || format.contains("..") || format.trim().is_empty() {
        return Err(AppError::SecurityError("安全限制：导出格式参数包含非法字符".to_string()));
    }

    // 安全校验：输出路径必须在用户主目录或临时目录下
    let out_path = std::path::Path::new(&outputPath);
    let home = dirs::home_dir().unwrap_or_default();
    let home_canonical = home.canonicalize().unwrap_or(home);
    let temp_canonical = std::env::temp_dir().canonicalize().unwrap_or(std::env::temp_dir());
    let out_resolved = if out_path.exists() {
        out_path.canonicalize().unwrap_or_else(|_| out_path.to_path_buf())
    } else if let Some(parent) = out_path.parent() {
        if parent.exists() {
            parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf())
        } else {
            return Err(AppError::SecurityError("目标目录不存在".to_string()));
        }
    } else {
        out_path.to_path_buf()
    };
    if !out_resolved.starts_with(&home_canonical) && !out_resolved.starts_with(&temp_canonical) {
        return Err(AppError::SecurityError(
            "安全限制：只能导出到用户主目录或临时目录下".to_string(),
        ));
    }

    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    let document = crate::document::Document::load(&doc_path)?;
    let content = contentOverride.as_deref().unwrap_or(&document.ai_generated_content);
    let title = &document.title;

    native_export::export_native(content, title, &outputPath, &format)
}

/// 导出文档（原生格式）
#[tauri::command]
pub fn export_document(
    state: State<'_, AppState>,
    documentId: String,
    projectId: String,
    format: String,
    outputPath: String,
    contentOverride: Option<String>,
) -> Result<String> {
    export_document_native(state, documentId, projectId, format, outputPath, contentOverride)
}

/// 导出到临时文件并用指定程序打开
#[tauri::command]
pub fn export_and_open(
    state: State<'_, AppState>,
    documentId: String,
    projectId: String,
    format: String,
    appName: Option<String>,
    contentOverride: Option<String>,
) -> Result<String> {
    crate::security::validate_id(&projectId, "projectId")?;
    crate::security::validate_id(&documentId, "documentId")?;
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(AppError::DocumentNotFound(format!("文档未找到: {}", documentId)));
    }

    let document = crate::document::Document::load(&doc_path)?;
    let title = &document.title;
    let export_content = contentOverride.as_deref().unwrap_or(&document.ai_generated_content);

    // 构建临时文件路径（导出前清理旧临时文件）
    let temp_dir = std::env::temp_dir().join("aidocplus_export");
    std::fs::create_dir_all(&temp_dir).context("创建临时目录失败")?;
    cleanup_old_temp_files(&temp_dir, TEMP_FILE_MAX_AGE);

    let safe_title = crate::security::sanitize_filename(&title);
    // 安全校验：format 只允许安全字符，防止路径注入
    let safe_format = format.trim();
    if safe_format.contains('/') || safe_format.contains('\\') || safe_format.contains('\0')
        || safe_format.contains("..") || safe_format.is_empty() {
        return Err(AppError::SecurityError("安全限制：导出格式参数包含非法字符".to_string()));
    }
    let output_path = temp_dir.join(format!("{}.{}", safe_title, safe_format));
    let output_str = output_path.to_string_lossy().to_string();

    // 导出文件
    native_export::export_native(export_content, title, &output_str, &format)?;

    // 用指定程序或默认程序打开
    let open_result = match appName.as_deref() {
        Some(app) => open_with_app(&output_str, app),
        None => open_with_default(&output_str),
    };

    match open_result {
        Ok(_) => Ok(output_str),
        Err(e) => {
            let app_desc = appName.unwrap_or_else(|| "默认程序".to_string());
            Err(AppError::ExportFailed(format!("无法使用 {} 打开文件: {}", app_desc, e)))
        }
    }
}

/// 用默认程序打开文件
fn open_with_default(file_path: &str) -> crate::error::Result<()> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(file_path)
            .spawn()
            .map(|_| ())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", file_path])
            .spawn()
            .map(|_| ())?;
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = file_path;
    }
    Ok(())
}

/// 用指定程序打开文件（跨平台）
fn open_with_app(file_path: &str, app: &str) -> crate::error::Result<()> {
    #[cfg(target_os = "macos")]
    {
        // macOS: 先尝试 open -a "app"，失败则尝试备选名称
        let candidates = get_mac_app_candidates(app);
        let mut last_err = String::new();
        for candidate in &candidates {
            let result = std::process::Command::new("open")
                .arg("-a")
                .arg(candidate)
                .arg(file_path)
                .output();
            match result {
                Ok(output) if output.status.success() => return Ok(()),
                Ok(output) => {
                    last_err = String::from_utf8_lossy(&output.stderr).to_string();
                }
                Err(e) => {
                    last_err = e.to_string();
                }
            }
        }
        Err(AppError::ExternalToolError(format!("尝试了 {:?}，均未成功: {}", candidates, last_err)))
    }
    #[cfg(target_os = "windows")]
    {
        // Windows: 查找已知程序的可执行文件路径
        let exe_paths = get_windows_exe_paths(app);
        let mut last_err = String::new();
        for exe in &exe_paths {
            let path = std::path::Path::new(exe);
            if path.exists() {
                match std::process::Command::new(exe).arg(file_path).spawn() {
                    Ok(_) => return Ok(()),
                    Err(e) => { last_err = e.to_string(); }
                }
            }
        }
        // 回退：尝试 cmd /c start
        match std::process::Command::new("cmd")
            .args(["/c", "start", "", app, file_path])
            .spawn()
        {
            Ok(_) => Ok(()),
            Err(e) => {
                if last_err.is_empty() { last_err = e.to_string(); }
                Err(AppError::ExternalToolError(format!("尝试了 {:?} 和 start 命令，均未成功: {}", exe_paths, last_err)))
            }
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (file_path, app);
        Ok(())
    }
}

/// macOS: 返回应用名称的候选列表
#[cfg(target_os = "macos")]
fn get_mac_app_candidates(app: &str) -> Vec<String> {
    match app {
        "WPS Office" | "wps" | "WPS" => vec![
            "wpsoffice".to_string(),
            "WPS Office".to_string(),
            "com.kingsoft.wpsoffice.mac".to_string(),
        ],
        "Microsoft Word" | "Word" => vec![
            "Microsoft Word".to_string(),
        ],
        "Microsoft PowerPoint" | "PowerPoint" => vec![
            "Microsoft PowerPoint".to_string(),
        ],
        "Keynote" => vec![
            "Keynote".to_string(),
        ],
        "Microsoft Edge" | "Edge" => vec![
            "Microsoft Edge".to_string(),
        ],
        "Google Chrome" | "Chrome" => vec![
            "Google Chrome".to_string(),
        ],
        "Safari" => vec![
            "Safari".to_string(),
        ],
        other => vec![other.to_string()],
    }
}

/// Windows: 返回已知程序的可执行文件路径候选列表
#[cfg(target_os = "windows")]
fn get_windows_exe_paths(app: &str) -> Vec<String> {
    let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let program_files_x86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "".to_string());

    match app {
        "WPS Office" | "wps" | "WPS" => vec![
            format!("{}\\Kingsoft\\WPS Office\\ksolaunch.exe", program_files),
            format!("{}\\Kingsoft\\WPS Office\\ksolaunch.exe", program_files_x86),
            format!("{}\\kingsoft\\WPS Office\\ksolaunch.exe", local_app_data),
        ],
        "Microsoft Word" | "Word" => vec![
            format!("{}\\Microsoft Office\\root\\Office16\\WINWORD.EXE", program_files),
            format!("{}\\Microsoft Office\\root\\Office16\\WINWORD.EXE", program_files_x86),
        ],
        "Microsoft PowerPoint" | "PowerPoint" => vec![
            format!("{}\\Microsoft Office\\root\\Office16\\POWERPNT.EXE", program_files),
            format!("{}\\Microsoft Office\\root\\Office16\\POWERPNT.EXE", program_files_x86),
        ],
        "Microsoft Edge" | "Edge" => vec![
            format!("{}\\Microsoft\\Edge\\Application\\msedge.exe", program_files),
            format!("{}\\Microsoft\\Edge\\Application\\msedge.exe", program_files_x86),
        ],
        "Google Chrome" | "Chrome" => vec![
            format!("{}\\Google\\Chrome\\Application\\chrome.exe", program_files),
            format!("{}\\Google\\Chrome\\Application\\chrome.exe", program_files_x86),
        ],
        other => vec![other.to_string()],
    }
}

/// 打开指定文件（可选指定程序）
#[tauri::command]
pub fn open_file_with_app(path: String, app_name: Option<String>) -> Result<()> {
    use crate::error::AppError;

    // 路径安全：验证文件在允许的目录内
    let safe_path = crate::security::validate_path_allowed(
        std::path::Path::new(&path), "打开文件路径"
    )?;

    // 安全校验：app_name 只允许字母数字和常见符号，防止命令注入
    if let Some(ref app) = app_name {
        if app.contains('/') || app.contains('\\') || app.contains('\0')
            || app.contains("..") || app.contains('"') || app.contains('\'') {
            return Err(AppError::SecurityError(
                "安全限制：应用程序名称包含非法字符".to_string()
            ));
        }
    }

    let result = match app_name.as_deref() {
        Some(app) => open_with_app(&safe_path.to_string_lossy(), app),
        None => open_with_default(&safe_path.to_string_lossy()),
    };
    result.map_err(|e| {
        let app_desc = app_name.unwrap_or_else(|| "默认程序".to_string());
        format!("无法使用 {} 打开文件: {}", app_desc, e)
    })?;
    Ok(())
}

/// 获取临时导出目录路径
#[tauri::command]
pub fn get_temp_dir() -> Result<String> {
    let temp_dir = std::env::temp_dir().join("aidocplus_export");
    std::fs::create_dir_all(&temp_dir).context("创建临时目录失败")?;
    Ok(temp_dir.to_string_lossy().to_string())
}

/// 清理所有 AiDocPlus 临时目录中的旧文件（启动时调用）
#[tauri::command]
pub fn cleanup_temp_files() -> Result<()> {
    let base = std::env::temp_dir();
    for subdir in ["aidocplus_export", "aidocplus_pandoc"] {
        let dir = base.join(subdir);
        if dir.exists() {
            cleanup_old_temp_files(&dir, TEMP_FILE_MAX_AGE);
        }
    }
    Ok(())
}

/// 在应用内打开 PDF 预览窗口（加载本地 HTML 文件）
#[tauri::command]
pub fn open_pdf_preview(
    app_handle: tauri::AppHandle,
    htmlPath: String,
    title: Option<String>,
) -> Result<()> {
    use tauri::Manager;
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    // 安全限制：htmlPath 必须在临时目录下
    let path = std::path::Path::new(&htmlPath);
    let canonical = path.canonicalize().context("路径无效")?;
    let temp_dir = std::env::temp_dir().canonicalize().unwrap_or_else(|_| std::env::temp_dir());
    if !canonical.starts_with(&temp_dir) {
        return Err(AppError::SecurityError(format!(
            "安全限制：只能预览临时目录中的文件"
        )));
    }

    let window_label = "pdf-preview";

    // 如果预览窗口已存在，先关闭旧窗口
    if let Some(existing) = app_handle.get_webview_window(window_label) {
        let _ = existing.destroy();
    }

    // 将本地文件路径转换为 file:// URL
    let file_url = if htmlPath.starts_with("file://") {
        htmlPath.clone()
    } else {
        format!("file://{}", htmlPath.replace('\\', "/"))
    };

    let url = WebviewUrl::External(
        file_url.parse().context("URL 解析失败")?
    );

    let win_title = title.unwrap_or_else(|| "PDF 预览 - 打印 / 另存为 PDF".to_string());

    WebviewWindowBuilder::new(&app_handle, window_label, url)
        .title(&win_title)
        .inner_size(900.0, 700.0)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .build()
        .context("创建预览窗口失败")?;

    Ok(())
}

