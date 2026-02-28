use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::{Duration, Instant};

/// Node.js 检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeCheckResult {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// Node.js 脚本执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeRunResult {
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    #[serde(rename = "timedOut")]
    pub timed_out: bool,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
}

/// 查找可用的 Node.js 可执行文件
pub fn find_node(custom_path: Option<&str>) -> Option<String> {
    if let Some(path) = custom_path {
        if !path.is_empty() {
            if Command::new(path)
                .arg("--version")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
            {
                return Some(path.to_string());
            }
        }
    }
    // 候选命令名
    let candidates = vec!["node"];
    for candidate in candidates {
        if Command::new(candidate)
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Some(candidate.to_string());
        }
    }
    None
}

/// 获取 Node.js 可执行文件的完整路径
fn get_node_path(node: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("where")
            .arg(node)
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    Some(
                        String::from_utf8_lossy(&o.stdout)
                            .lines()
                            .next()
                            .unwrap_or("")
                            .trim()
                            .to_string(),
                    )
                } else {
                    None
                }
            })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("which")
            .arg(node)
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else {
                    None
                }
            })
    }
}

/// 检测系统 Node.js 是否可用（同步内部实现）
fn check_nodejs_sync(custom_path: Option<String>) -> NodeCheckResult {
    let node = find_node(custom_path.as_deref());
    match node {
        Some(n) => {
            match Command::new(&n).arg("--version").output() {
                Ok(output) => {
                    let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    let version = version_str.strip_prefix('v').unwrap_or(&version_str).to_string();
                    let full_path = get_node_path(&n);

                    NodeCheckResult {
                        available: true,
                        version: Some(version),
                        path: full_path.or(Some(n)),
                        error: None,
                    }
                }
                Err(e) => NodeCheckResult {
                    available: false,
                    version: None,
                    path: None,
                    error: Some(format!("执行 Node.js 失败: {}", e)),
                },
            }
        }
        None => NodeCheckResult {
            available: false,
            version: None,
            path: None,
            error: Some("未找到 Node.js，请安装 Node.js 或在设置中指定路径".to_string()),
        },
    }
}

/// 检测系统 Node.js 是否可用（异步，不阻塞主线程）
#[tauri::command]
pub async fn check_nodejs(
    #[allow(non_snake_case)]
    customPath: Option<String>,
) -> NodeCheckResult {
    tokio::task::spawn_blocking(move || check_nodejs_sync(customPath))
        .await
        .unwrap_or_else(|_| NodeCheckResult {
            available: false,
            version: None,
            path: None,
            error: Some("检测任务失败".to_string()),
        })
}

/// 执行 JavaScript/TypeScript 脚本
#[tauri::command]
pub fn run_node_script(
    #[allow(non_snake_case)]
    scriptPath: String,
    #[allow(non_snake_case)]
    timeoutSecs: Option<u64>,
    #[allow(non_snake_case)]
    customNodePath: Option<String>,
) -> Result<NodeRunResult, String> {
    let start = Instant::now();
    let timeout = Duration::from_secs(timeoutSecs.unwrap_or(30));

    let node = find_node(customNodePath.as_deref())
        .ok_or_else(|| "未找到 Node.js，请安装 Node.js 或在设置中指定路径".to_string())?;

    let script = std::path::PathBuf::from(&scriptPath);
    if !script.exists() {
        return Err(format!("脚本文件不存在: {}", scriptPath));
    }

    let mut cmd = Command::new(&node);
    cmd.arg(&script);

    // 注入 API Server 连接参数（供 SDK 使用）
    if let Some((port, token)) = crate::api_server::get_api_connection_info() {
        cmd.env("AIDOCPLUS_API_PORT", port.to_string());
        cmd.env("AIDOCPLUS_API_TOKEN", &token);
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

    // 设置工作目录
    if let Some(parent) = script.parent() {
        cmd.current_dir(parent);
    }

    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn()
        .map_err(|e| format!("启动 Node.js 进程失败: {}", e))?;

    // 等待完成（带超时）
    let result = loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let elapsed = start.elapsed();
                let stdout = child.stdout.take()
                    .map(|mut s| {
                        let mut buf = Vec::new();
                        std::io::Read::read_to_end(&mut s, &mut buf).ok();
                        if buf.len() > 1_048_576 { buf.truncate(1_048_576); }
                        String::from_utf8_lossy(&buf).to_string()
                    })
                    .unwrap_or_default();
                let stderr = child.stderr.take()
                    .map(|mut s| {
                        let mut buf = Vec::new();
                        std::io::Read::read_to_end(&mut s, &mut buf).ok();
                        if buf.len() > 1_048_576 { buf.truncate(1_048_576); }
                        String::from_utf8_lossy(&buf).to_string()
                    })
                    .unwrap_or_default();

                break NodeRunResult {
                    stdout,
                    stderr,
                    exit_code: status.code(),
                    timed_out: false,
                    duration_ms: elapsed.as_millis() as u64,
                };
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    break NodeRunResult {
                        stdout: String::new(),
                        stderr: format!("执行超时（{}秒）", timeout.as_secs()),
                        exit_code: None,
                        timed_out: true,
                        duration_ms: start.elapsed().as_millis() as u64,
                    };
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                break NodeRunResult {
                    stdout: String::new(),
                    stderr: format!("等待进程失败: {}", e),
                    exit_code: None,
                    timed_out: false,
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }
        }
    };

    Ok(result)
}
