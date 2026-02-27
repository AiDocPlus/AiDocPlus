#![allow(non_snake_case)]

use crate::config::AppState;
use crate::error::Result;
use crate::native_export;
use tauri::State;

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
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("文档未找到: {}", documentId));
    }

    let document = crate::document::Document::load(&doc_path).map_err(|e| e.to_string())?;
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
    let doc_path = state.get_document_path(&projectId, &documentId);

    if !doc_path.exists() {
        return Err(format!("文档未找到: {}", documentId));
    }

    let document = crate::document::Document::load(&doc_path).map_err(|e| e.to_string())?;
    let title = &document.title;
    let export_content = contentOverride.as_deref().unwrap_or(&document.ai_generated_content);

    // 构建临时文件路径
    let temp_dir = std::env::temp_dir().join("aidocplus_export");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("创建临时目录失败: {}", e))?;

    let safe_title = title.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let output_path = temp_dir.join(format!("{}.{}", safe_title, format));
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
            Err(format!("无法使用 {} 打开文件: {}", app_desc, e))
        }
    }
}

/// 用默认程序打开文件
fn open_with_default(file_path: &str) -> std::result::Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(file_path)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", file_path])
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(file_path)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

/// 用指定程序打开文件（跨平台）
fn open_with_app(file_path: &str, app: &str) -> std::result::Result<(), String> {
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
        Err(format!("尝试了 {:?}，均未成功: {}", candidates, last_err))
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
                Err(format!("尝试了 {:?} 和 start 命令，均未成功: {}", exe_paths, last_err))
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new(app)
            .arg(file_path)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
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
    let result = match app_name.as_deref() {
        Some(app) => open_with_app(&path, app),
        None => open_with_default(&path),
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
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("创建临时目录失败: {}", e))?;
    Ok(temp_dir.to_string_lossy().to_string())
}

