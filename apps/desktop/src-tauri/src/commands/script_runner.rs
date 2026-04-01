use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// Global state: stores the currently running child process so it can be killed
pub struct RunningScriptState {
    pub child: Arc<Mutex<Option<tokio::process::Child>>>,
}

impl Default for RunningScriptState {
    fn default() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }
}

/// A single chunk of output emitted via Tauri event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputChunk {
    /// "stdout" or "stderr"
    pub stream: String,
    pub text: String,
}

/// Final result returned when the script finishes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptFinishResult {
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    #[serde(rename = "timedOut")]
    pub timed_out: bool,
    #[serde(rename = "killed")]
    pub killed: bool,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
}

/// Run a script with streaming output via Tauri events.
/// Events emitted:
///   - "coding:output:chunk" -> OutputChunk  (real-time stdout/stderr lines)
///   - "coding:output:done"  -> ScriptFinishResult (when process ends)
#[tauri::command]
pub async fn run_script_stream(
    app: AppHandle,
    state: tauri::State<'_, RunningScriptState>,
    interpreter: String,
    #[allow(non_snake_case)]
    scriptPath: String,
    args: Option<Vec<String>>,
    #[allow(non_snake_case)]
    envVars: Option<HashMap<String, String>>,
    #[allow(non_snake_case)]
    timeoutSecs: Option<u64>,
    cwd: Option<String>,
) -> crate::error::Result<()> {
    use crate::error::AppError;
    let timeout_secs = timeoutSecs.unwrap_or(30);
    let start = std::time::Instant::now();

    // 安全检查：验证解释器路径，只允许 Python 和 Node.js
    let interpreter_path = std::path::PathBuf::from(&interpreter);
    let canonical_interpreter = interpreter_path.canonicalize()
        .map_err(|e| AppError::ValidationError(format!("解释器路径无效: {}", e)))?;
    let is_allowed_interpreter = {
        let mut allowed = false;
        // 检查是否是系统检测到的 Python 解释器
        if let Some(py) = super::python::find_python(None) {
            if let Ok(py_path) = std::path::PathBuf::from(&py).canonicalize() {
                if canonical_interpreter == py_path { allowed = true; }
            }
        }
        // 检查是否是系统检测到的 Node.js 解释器
        if let Some(node) = super::nodejs::find_node(None) {
            if let Ok(node_path) = std::path::PathBuf::from(&node).canonicalize() {
                if canonical_interpreter == node_path { allowed = true; }
            }
        }
        // 严格匹配解释器文件名（不允许 python3-malicious 等变体）
        let exe_name = canonical_interpreter
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_lowercase();
        let allowed_names = [
            "python", "python3", "python3.10", "python3.11", "python3.12", "python3.13",
            "python3.14", "py", "node", "nodejs",
        ];
        if allowed_names.contains(&exe_name.as_str()) {
            allowed = true;
        }
        allowed
    };
    if !is_allowed_interpreter {
        return Err(AppError::SecurityError(format!(
            "安全限制：不允许使用此解释器 '{}'，仅支持 Python 和 Node.js", interpreter
        )));
    }

    // 使用规范化后的解释器路径（防止 PATH 劫持）
    let safe_interpreter = canonical_interpreter.to_string_lossy().to_string();

    // 安全检查：验证脚本路径在允许的目录内（防止任意文件执行）
    let safe_script_path = crate::security::validate_path_allowed(
        std::path::Path::new(&scriptPath), "scriptPath"
    )?;

    // 安全检查：验证 cwd 在允许的目录内
    if let Some(ref dir) = cwd {
        crate::security::validate_path_allowed(std::path::Path::new(dir), "cwd")?;
    }

    // Build the tokio async command
    let mut cmd = TokioCommand::new(&safe_interpreter);
    cmd.arg(&safe_script_path);

    if let Some(ref extra_args) = args {
        for a in extra_args {
            cmd.arg(a);
        }
    }

    // Set environment variables（过滤危险键）
    const DANGEROUS_ENV_KEYS: &[&str] = &[
        "LD_PRELOAD", "DYLD_INSERT_LIBRARIES", "DYLD_FRAMEWORK_PATH",
        "DYLD_LIBRARY_PATH", "NODE_OPTIONS", "ELECTRON_RUN_AS_NODE",
        "PYTHONSTARTUP", "PYTHONPATH", "NODE_PATH",
        "RUST_LOG", "RUST_BACKTRACE",
    ];
    if let Some(ref vars) = envVars {
        for (k, v) in vars {
            if DANGEROUS_ENV_KEYS.contains(&k.as_str()) {
                continue; // 跳过危险环境变量，防止代码注入和路径劫持
            }
            cmd.env(k, v);
        }
    }

    // 注入 API Server 连接参数（供 aidocplus SDK 使用）
    if let Some((port, token)) = crate::api_server::get_api_connection_info() {
        cmd.env("AIDOCPLUS_API_PORT", port.to_string());
        cmd.env("AIDOCPLUS_API_TOKEN", &token);
        // 注入 Script 级别身份签名（token 前 16 字符），用于 API Server 身份验证
        if token.len() >= 16 {
            cmd.env("AIDOCPLUS_SCRIPT_SIGNATURE", &token[..16]);
        }
        // 注入 SDK 路径到 PYTHONPATH，使 import aidocplus 可用
        if let Some(sdk_path) = crate::api_server::get_python_sdk_path() {
            let existing = std::env::var("PYTHONPATH").unwrap_or_default();
            let new_path = if existing.is_empty() {
                sdk_path
            } else {
                format!("{}:{}", sdk_path, existing)
            };
            cmd.env("PYTHONPATH", new_path);
        }
        // 注入 SDK 路径到 NODE_PATH，使 require('aidocplus') 可用
        if let Some(sdk_path) = crate::api_server::get_js_sdk_path() {
            let existing = std::env::var("NODE_PATH").unwrap_or_default();
            let new_path = if existing.is_empty() {
                sdk_path
            } else {
                format!("{}:{}", sdk_path, existing)
            };
            cmd.env("NODE_PATH", new_path);
        }
    }

    // Set working directory（使用 canonicalized 路径）
    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    } else {
        if let Some(parent) = safe_script_path.parent() {
            if parent.exists() {
                cmd.current_dir(parent);
            }
        }
    }

    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    // 在 Windows 上隐藏子进程控制台窗口
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    // Spawn
    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::ExternalToolError(format!("Failed to start process: {}", e)))?;

    // Take stdout and stderr handles
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Store child in state so it can be killed
    {
        let mut guard = state.child.lock().await;
        *guard = Some(child);
    }

    let child_arc = state.child.clone();
    let app_clone = app.clone();
    let app_clone2 = app.clone();

    // Spawn stdout reader
    let stdout_handle = tokio::spawn(async move {
        if let Some(out) = stdout {
            let reader = BufReader::new(out);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit("coding:output:chunk", OutputChunk {
                    stream: "stdout".to_string(),
                    text: line,
                });
            }
        }
    });

    // Spawn stderr reader
    let stderr_handle = tokio::spawn(async move {
        if let Some(err) = stderr {
            let reader = BufReader::new(err);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone2.emit("coding:output:chunk", OutputChunk {
                    stream: "stderr".to_string(),
                    text: line,
                });
            }
        }
    });

    // Spawn a task to wait for the process with timeout
    let wait_handle = tokio::spawn(async move {
        let timeout_dur = std::time::Duration::from_secs(timeout_secs);
        let mut timed_out = false;
        let mut killed = false;

        loop {
            // Try to get a lock on the child
            let mut guard = child_arc.lock().await;
            if let Some(ref mut c) = *guard {
                match c.try_wait() {
                    Ok(Some(status)) => {
                        // Process finished
                        let elapsed = start.elapsed();
                        // Wait for readers to finish
                        drop(guard);
                        let _ = stdout_handle.await;
                        let _ = stderr_handle.await;
                        let result = ScriptFinishResult {
                            exit_code: status.code(),
                            timed_out: false,
                            killed: false,
                            duration_ms: elapsed.as_millis() as u64,
                        };
                        let _ = app.emit("coding:output:done", result);
                        return;
                    }
                    Ok(None) => {
                        // Still running, check timeout
                        if start.elapsed() >= timeout_dur {
                            let _ = c.kill().await;
                            timed_out = true;
                            killed = true;
                            *guard = None;
                            drop(guard);
                            break;
                        }
                        drop(guard);
                        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                    }
                    Err(_) => {
                        *guard = None;
                        drop(guard);
                        break;
                    }
                }
            } else {
                // Child was killed externally
                killed = true;
                drop(guard);
                break;
            }
        }

        // Wait for readers
        let _ = stdout_handle.await;
        let _ = stderr_handle.await;

        let result = ScriptFinishResult {
            exit_code: None,
            timed_out,
            killed,
            duration_ms: start.elapsed().as_millis() as u64,
        };
        let _ = app.emit("coding:output:done", result);
    });

    // Don't await the wait_handle — let it run in the background
    // The command returns immediately so the frontend isn't blocked
    tokio::spawn(async move {
        let _ = wait_handle.await;
    });

    Ok(())
}

/// Kill the currently running script
#[tauri::command]
pub async fn kill_running_script(
    state: tauri::State<'_, RunningScriptState>,
) -> crate::error::Result<()> {
    let mut guard = state.child.lock().await;
    if let Some(ref mut child) = *guard {
        child.kill().await.map_err(|e| crate::error::AppError::Internal(format!("Failed to kill process: {}", e)))?;
        *guard = None;
        Ok(())
    } else {
        Ok(()) // No running process, silently succeed
    }
}
