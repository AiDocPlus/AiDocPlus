use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::AppHandle;

/// IM Bot 子进程全局状态
pub struct ImBotState {
    pub child: Arc<Mutex<Option<tokio::process::Child>>>,
}

impl Default for ImBotState {
    fn default() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImBotStatus {
    pub running: bool,
}

/// 定位 im-bot 项目目录
/// 开发模式：从源码目录向上查找 apps/im-bot
/// 生产模式：~/.aidocplus/im-bot（需用户部署）
fn find_imbot_dir() -> Option<std::path::PathBuf> {
    // 开发模式：从当前工作目录向上查找 apps/im-bot
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd.as_path();
        loop {
            let candidate = dir.join("apps").join("im-bot");
            if candidate.join("src").join("index.ts").exists() {
                return Some(candidate);
            }
            match dir.parent() {
                Some(p) => dir = p,
                None => break,
            }
        }
    }

    // 生产模式：~/.aidocplus/im-bot
    if let Some(home) = dirs::home_dir() {
        let candidate = home.join(".aidocplus").join("im-bot");
        if candidate.join("src").join("index.ts").exists() {
            return Some(candidate);
        }
    }

    None
}

/// 查找 npx 可执行文件路径
fn find_npx() -> String {
    // macOS / Linux：常见路径
    for path in &[
        "/usr/local/bin/npx",
        "/opt/homebrew/bin/npx",
        "/usr/bin/npx",
    ] {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }

    // 尝试从 PATH 环境变量查找
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in path_var.split(':') {
            let npx_path = std::path::Path::new(dir).join("npx");
            if npx_path.exists() {
                return npx_path.to_string_lossy().to_string();
            }
        }
    }

    // Windows
    #[cfg(target_os = "windows")]
    {
        for path in &[
            "C:\\Program Files\\nodejs\\npx.cmd",
            "C:\\Program Files (x86)\\nodejs\\npx.cmd",
        ] {
            if std::path::Path::new(path).exists() {
                return path.to_string();
            }
        }
    }

    // 回退：依赖 PATH
    "npx".to_string()
}

/// 启动 IM Bot 子进程
#[tauri::command]
pub async fn start_imbot(
    _app: AppHandle,
    state: tauri::State<'_, ImBotState>,
) -> crate::error::Result<ImBotStatus> {
    use crate::error::AppError;
    // 检查是否已在运行
    {
        let guard = state.child.lock().await;
        if let Some(ref child) = *guard {
            // 检查进程是否还活着
            let pid = child.id();
            if pid.is_some() {
                return Ok(ImBotStatus { running: true });
            }
        }
    }

    let imbot_dir = find_imbot_dir()
        .ok_or_else(|| AppError::Internal("找不到 IM Bot 目录。请确认 apps/im-bot 目录存在。".to_string()))?;

    let npx = find_npx();

    println!("[IM Bot] 启动 IM Bot: {} tsx src/index.ts", npx);
    println!("[IM Bot] 工作目录: {:?}", imbot_dir);

    let mut cmd = tokio::process::Command::new(&npx);
    cmd.arg("tsx");
    cmd.arg("src/index.ts");
    cmd.current_dir(&imbot_dir);

    // 注入 API 连接信息
    if let Some((port, token)) = crate::api_server::get_api_connection_info() {
        cmd.env("AIDOCPLUS_API_PORT", port.to_string());
        cmd.env("AIDOCPLUS_API_TOKEN", &token);
    }

    // 继承 PATH 以便子进程能找到 node 等
    if let Ok(path) = std::env::var("PATH") {
        // 确保常见路径在 PATH 中
        let extra_paths = "/usr/local/bin:/opt/homebrew/bin";
        let combined = format!("{}:{}", extra_paths, path);
        cmd.env("PATH", combined);
    }

    cmd.stdin(std::process::Stdio::null());

    // 将 stdout/stderr 重定向到日志文件，避免 pipe 缓冲区满导致进程阻塞
    let log_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(".aidocplus");
    let _ = std::fs::create_dir_all(&log_dir);
    let log_path = log_dir.join("imbot.log");
    let stdout_file = std::fs::File::create(&log_path)
        .map_err(|e| AppError::Internal(format!("创建 IM Bot 日志文件失败: {}", e)))?;
    let stderr_file = stdout_file.try_clone()
        .map_err(|e| AppError::Internal(format!("克隆日志文件句柄失败: {}", e)))?;
    cmd.stdout(std::process::Stdio::from(stdout_file));
    cmd.stderr(std::process::Stdio::from(stderr_file));
    println!("[IM Bot] 日志文件: {:?}", log_path);

    // Windows 隐藏控制台窗口
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let child = cmd
        .spawn()
        .map_err(|e| AppError::ExternalToolError(format!("启动 IM Bot 失败: {}", e)))?;

    println!("[IM Bot] ✅ 子进程已启动, PID={:?}", child.id());

    {
        let mut guard = state.child.lock().await;
        *guard = Some(child);
    }

    Ok(ImBotStatus { running: true })
}

/// 停止 IM Bot 子进程
#[tauri::command]
pub async fn stop_imbot(
    state: tauri::State<'_, ImBotState>,
) -> crate::error::Result<ImBotStatus> {
    let mut guard = state.child.lock().await;
    if let Some(ref mut child) = *guard {
        child.kill().await.map_err(|e| crate::error::AppError::Internal(format!("停止 IM Bot 失败: {}", e)))?;
        println!("[IM Bot] 子进程已停止");
        *guard = None;
    }
    Ok(ImBotStatus { running: false })
}

/// 获取 IM Bot 运行状态
#[tauri::command]
pub async fn get_imbot_status(
    state: tauri::State<'_, ImBotState>,
) -> crate::error::Result<ImBotStatus> {
    let mut guard = state.child.lock().await;
    if let Some(ref mut child) = *guard {
        // 使用 try_wait 检测进程是否还在运行
        match child.try_wait() {
            Ok(Some(_status)) => {
                // 进程已退出
                *guard = None;
                Ok(ImBotStatus { running: false })
            }
            Ok(None) => {
                // 进程仍在运行
                Ok(ImBotStatus { running: true })
            }
            Err(_) => {
                *guard = None;
                Ok(ImBotStatus { running: false })
            }
        }
    } else {
        Ok(ImBotStatus { running: false })
    }
}
