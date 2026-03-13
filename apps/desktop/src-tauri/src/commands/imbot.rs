use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager};

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

/// IM Bot 运行模式
enum ImBotMode {
    /// 开发模式：npx tsx src/index.ts，工作目录为 im-bot 源码目录
    Dev { imbot_dir: std::path::PathBuf },
    /// 生产模式：node imbot-bundle.mjs，bundle 文件在 bundled-resources 中
    Bundle { bundle_path: std::path::PathBuf },
}

/// 定位 IM Bot 并确定运行模式
fn find_imbot(app: &AppHandle) -> Option<ImBotMode> {
    // 1. 开发模式：从当前工作目录向上查找 apps/im-bot
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd.as_path();
        loop {
            let candidate = dir.join("apps").join("im-bot");
            if candidate.join("src").join("index.ts").exists() {
                return Some(ImBotMode::Dev { imbot_dir: candidate });
            }
            match dir.parent() {
                Some(p) => dir = p,
                None => break,
            }
        }
    }

    // 2. 生产模式：bundled resources 中的 imbot-bundle.mjs
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundle_path = resource_dir.join("bundled-resources").join("imbot-bundle.mjs");
        if bundle_path.exists() {
            return Some(ImBotMode::Bundle { bundle_path });
        }
    }

    // 3. 备用：~/.aidocplus/im-bot 源码目录
    if let Some(home) = dirs::home_dir() {
        let candidate = home.join(".aidocplus").join("im-bot");
        if candidate.join("src").join("index.ts").exists() {
            return Some(ImBotMode::Dev { imbot_dir: candidate });
        }
    }

    None
}

/// 查找可执行文件路径（node 或 npx）
fn find_executable(name: &str) -> String {
    // macOS / Linux：常见路径
    for prefix in &["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin"] {
        let p = format!("{}/{}", prefix, name);
        if std::path::Path::new(&p).exists() {
            return p;
        }
    }

    // 尝试从 PATH 环境变量查找
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in path_var.split(':') {
            let full = std::path::Path::new(dir).join(name);
            if full.exists() {
                return full.to_string_lossy().to_string();
            }
        }
    }

    // Windows
    #[cfg(target_os = "windows")]
    {
        let win_name = if name == "node" { "node.exe" } else { &format!("{}.cmd", name) };
        for prefix in &["C:\\Program Files\\nodejs", "C:\\Program Files (x86)\\nodejs"] {
            let p = format!("{}\\{}", prefix, win_name);
            if std::path::Path::new(&p).exists() {
                return p;
            }
        }
    }

    // 回退：依赖 PATH
    name.to_string()
}

/// 启动 IM Bot 子进程
#[tauri::command]
pub async fn start_imbot(
    app: AppHandle,
    state: tauri::State<'_, ImBotState>,
) -> crate::error::Result<ImBotStatus> {
    use crate::error::{AppError, ResultExt};
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

    let mode = find_imbot(&app)
        .ok_or_else(|| AppError::Internal("找不到 IM Bot。请确认 apps/im-bot 目录存在或应用已正确安装。".to_string()))?;

    let mut cmd = match &mode {
        ImBotMode::Dev { imbot_dir } => {
            let npx = find_executable("npx");
            println!("[IM Bot] 开发模式: {} tsx src/index.ts", npx);
            println!("[IM Bot] 工作目录: {:?}", imbot_dir);
            let mut c = tokio::process::Command::new(&npx);
            c.arg("tsx");
            c.arg("src/index.ts");
            c.current_dir(imbot_dir);
            c
        }
        ImBotMode::Bundle { bundle_path } => {
            let node = find_executable("node");
            println!("[IM Bot] 生产模式: {} {:?}", node, bundle_path);
            let mut c = tokio::process::Command::new(&node);
            c.arg(bundle_path);
            c
        }
    };

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
        .context("创建 IM Bot 日志文件失败")?;
    let stderr_file = stdout_file.try_clone()
        .context("克隆日志文件句柄失败")?;
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
