use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::{Duration, Instant};

/// 在 Windows 上隐藏子进程控制台窗口
#[cfg(target_os = "windows")]
fn hide_console_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
}

#[cfg(not(target_os = "windows"))]
fn hide_console_window(_cmd: &mut Command) {}

/// Python 检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonCheckResult {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// Python 脚本执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonRunResult {
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "exitCode")]
    pub exit_code: Option<i32>,
    #[serde(rename = "timedOut")]
    pub timed_out: bool,
    #[serde(rename = "durationMs")]
    pub duration_ms: u64,
}

/// 获取 Python 可执行文件名候选列表（跨平台）
fn python_candidates() -> Vec<&'static str> {
    #[cfg(target_os = "windows")]
    {
        vec!["python", "python3", "py"]
    }
    #[cfg(not(target_os = "windows"))]
    {
        vec!["python3", "python"]
    }
}

/// 查找可用的 Python 可执行文件
pub fn find_python(custom_path: Option<&str>) -> Option<String> {
    if let Some(path) = custom_path {
        if !path.is_empty() {
            // 验证自定义路径是否可用
            let mut cmd = Command::new(path);
            cmd.arg("--version");
            hide_console_window(&mut cmd);
            if cmd.output()
                .map(|o| o.status.success())
                .unwrap_or(false)
            {
                return Some(path.to_string());
            }
        }
    }
    for candidate in python_candidates() {
        let mut cmd = Command::new(candidate);
        cmd.arg("--version");
        hide_console_window(&mut cmd);
        if cmd.output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Some(candidate.to_string());
        }
    }
    None
}

/// 检测系统 Python 是否可用（同步内部实现）
fn check_python_sync(custom_path: Option<String>) -> PythonCheckResult {
    let python = find_python(custom_path.as_deref());
    match python {
        Some(py) => {
            let mut cmd = Command::new(&py);
            cmd.arg("--version");
            hide_console_window(&mut cmd);
            match cmd.output() {
                Ok(output) => {
                    let version_str = String::from_utf8_lossy(&output.stdout).to_string();
                    let version = version_str
                        .trim()
                        .strip_prefix("Python ")
                        .unwrap_or(version_str.trim())
                        .to_string();

                    // 获取完整路径
                    let full_path = get_python_path(&py);

                    PythonCheckResult {
                        available: true,
                        version: Some(version),
                        path: full_path.or(Some(py)),
                        error: None,
                    }
                }
                Err(e) => PythonCheckResult {
                    available: false,
                    version: None,
                    path: None,
                    error: Some(format!("执行 Python 失败: {}", e)),
                },
            }
        }
        None => PythonCheckResult {
            available: false,
            version: None,
            path: None,
            error: Some("未找到 Python，请安装 Python 3 或在设置中指定路径".to_string()),
        },
    }
}

/// 检测系统 Python 是否可用（异步，不阻塞主线程）
#[tauri::command]
pub async fn check_python(
    #[allow(non_snake_case)]
    customPath: Option<String>,
) -> PythonCheckResult {
    tokio::task::spawn_blocking(move || check_python_sync(customPath))
        .await
        .unwrap_or_else(|_| PythonCheckResult {
            available: false,
            version: None,
            path: None,
            error: Some("检测任务失败".to_string()),
        })
}

/// 获取 Python 可执行文件的完整路径
fn get_python_path(python: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("where");
        cmd.arg(python);
        hide_console_window(&mut cmd);
        cmd.output()
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
            .arg(python)
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

/// 发现的 Python 解释器信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonInterpreter {
    pub path: String,
    pub version: String,
    pub label: String,
}

/// 发现系统中所有可用的 Python 解释器（同步内部实现）
fn discover_pythons_sync() -> Vec<PythonInterpreter> {
    let mut found: Vec<PythonInterpreter> = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    // 候选命令名
    let candidates: Vec<&str> = {
        #[cfg(target_os = "windows")]
        { vec!["python", "python3", "py"] }
        #[cfg(not(target_os = "windows"))]
        { vec!["python3", "python"] }
    };

    // 通过命令名查找
    for cmd in &candidates {
        if let Some(info) = probe_python(cmd) {
            if seen_paths.insert(info.path.clone()) {
                found.push(info);
            }
        }
    }

    // 检查常见路径
    let extra_paths: Vec<&str> = {
        #[cfg(target_os = "macos")]
        {
            vec![
                "/usr/bin/python3",
                "/usr/local/bin/python3",
                "/opt/homebrew/bin/python3",
                "/Library/Frameworks/Python.framework/Versions/Current/bin/python3",
            ]
        }
        #[cfg(target_os = "linux")]
        {
            vec![
                "/usr/bin/python3",
                "/usr/local/bin/python3",
                "/usr/bin/python",
            ]
        }
        #[cfg(target_os = "windows")]
        { vec![] }
    };

    for p in extra_paths {
        if std::path::Path::new(p).exists() {
            if let Some(info) = probe_python(p) {
                if seen_paths.insert(info.path.clone()) {
                    found.push(info);
                }
            }
        }
    }

    // 检查 pyenv
    if let Ok(home) = std::env::var("HOME") {
        let pyenv_dir = std::path::PathBuf::from(&home).join(".pyenv/versions");
        if pyenv_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&pyenv_dir) {
                for entry in entries.flatten() {
                    let bin = entry.path().join("bin/python3");
                    if bin.exists() {
                        if let Some(info) = probe_python(bin.to_string_lossy().as_ref()) {
                            if seen_paths.insert(info.path.clone()) {
                                found.push(info);
                            }
                        }
                    }
                }
            }
        }
    }

    // 检查 conda envs（$HOME 和 /opt 下）
    let conda_names = &["miniconda3", "anaconda3", "miniforge3"];
    let mut conda_roots: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        for name in conda_names {
            conda_roots.push(std::path::PathBuf::from(&home).join(name));
        }
    }
    // /opt 下常见安装位置
    for name in conda_names {
        conda_roots.push(std::path::PathBuf::from("/opt").join(name));
    }

    for conda_dir in &conda_roots {
        if !conda_dir.is_dir() { continue; }
        // base env
        let base_bin = conda_dir.join("bin/python3");
        if base_bin.exists() {
            if let Some(info) = probe_python(base_bin.to_string_lossy().as_ref()) {
                if seen_paths.insert(info.path.clone()) {
                    found.push(info);
                }
            }
        }
        // sub envs
        let envs_dir = conda_dir.join("envs");
        if envs_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&envs_dir) {
                for entry in entries.flatten() {
                    let bin = entry.path().join("bin/python3");
                    if bin.exists() {
                        if let Some(info) = probe_python(bin.to_string_lossy().as_ref()) {
                            if seen_paths.insert(info.path.clone()) {
                                found.push(info);
                            }
                        }
                    }
                }
            }
        }
    }

    found
}

/// 发现系统中所有可用的 Python 解释器（异步，不阻塞主线程）
#[tauri::command]
pub async fn discover_pythons() -> Vec<PythonInterpreter> {
    tokio::task::spawn_blocking(discover_pythons_sync)
        .await
        .unwrap_or_default()
}

/// 探测单个 Python 路径，返回其信息
fn probe_python(cmd: &str) -> Option<PythonInterpreter> {
    let mut proc = Command::new(cmd);
    proc.arg("--version");
    hide_console_window(&mut proc);
    let output = proc.output().ok()?;
    if !output.status.success() { return None; }
    let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let version = version_str.strip_prefix("Python ").unwrap_or(&version_str).to_string();

    // 获取完整路径
    let full_path = get_python_path(cmd).unwrap_or_else(|| cmd.to_string());

    // 生成标签
    let label = format!("Python {} ({})", version, full_path);

    Some(PythonInterpreter { path: full_path, version, label })
}

/// 执行 Python 脚本
#[tauri::command]
pub fn run_python_script(
    #[allow(non_snake_case)]
    scriptPath: Option<String>,
    code: Option<String>,
    #[allow(non_snake_case)]
    inputContent: Option<String>,
    #[allow(non_snake_case)]
    outputPath: Option<String>,
    args: Option<Vec<String>>,
    #[allow(non_snake_case)]
    timeoutSecs: Option<u64>,
    #[allow(non_snake_case)]
    customPythonPath: Option<String>,
) -> Result<PythonRunResult, String> {
    let start = Instant::now();
    let timeout = Duration::from_secs(timeoutSecs.unwrap_or(30));

    // 查找 Python
    let python = find_python(customPythonPath.as_deref())
        .ok_or_else(|| "未找到 Python，请安装 Python 3 或在设置中指定路径".to_string())?;

    // 准备临时目录
    let temp_dir = std::env::temp_dir().join("aidocplus_python");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("创建临时目录失败: {}", e))?;

    // 确定脚本路径
    let (script_file, is_temp_script) = if let Some(ref path) = scriptPath {
        // 脚本文件模式
        let p = std::path::PathBuf::from(path);
        if !p.exists() {
            return Err(format!("脚本文件不存在: {}", path));
        }
        (p, false)
    } else if let Some(ref code_str) = code {
        // 内联代码模式：写入临时文件
        let tmp = temp_dir.join("_aidocplus_inline.py");
        std::fs::write(&tmp, code_str)
            .map_err(|e| format!("写入临时脚本失败: {}", e))?;
        (tmp, true)
    } else {
        return Err("必须提供 scriptPath 或 code 参数".to_string());
    };

    // 写入文档内容到临时文件（可选）
    let input_file = if let Some(ref content) = inputContent {
        let input_path = temp_dir.join("_aidocplus_input.md");
        std::fs::write(&input_path, content)
            .map_err(|e| format!("写入输入文件失败: {}", e))?;
        Some(input_path)
    } else {
        None
    };

    // 构建命令
    let mut cmd = Command::new(&python);
    cmd.arg(&script_file);
    hide_console_window(&mut cmd);

    // 添加额外参数
    if let Some(ref extra_args) = args {
        for arg in extra_args {
            cmd.arg(arg);
        }
    }

    // 设置环境变量
    if let Some(ref input_path) = input_file {
        cmd.env("AIDOCPLUS_INPUT_FILE", input_path);
    }
    if let Some(ref out_path) = outputPath {
        cmd.env("AIDOCPLUS_OUTPUT_FILE", out_path);
    }

    // 注入 API Server 连接参数（供 aidocplus SDK 使用）
    if let Some((port, token)) = crate::api_server::get_api_connection_info() {
        cmd.env("AIDOCPLUS_API_PORT", port.to_string());
        cmd.env("AIDOCPLUS_API_TOKEN", &token);
        if let Some(sdk_path) = crate::api_server::get_python_sdk_path() {
            let existing = std::env::var("PYTHONPATH").unwrap_or_default();
            let new_path = if existing.is_empty() {
                sdk_path
            } else {
                format!("{}:{}", sdk_path, existing)
            };
            cmd.env("PYTHONPATH", new_path);
        }
    }

    // 设置工作目录
    if !is_temp_script {
        if let Some(parent) = script_file.parent() {
            cmd.current_dir(parent);
        }
    } else {
        cmd.current_dir(&temp_dir);
    }

    // 设置 stdin/stdout/stderr
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    // 启动子进程
    let mut child = cmd.spawn()
        .map_err(|e| format!("启动 Python 进程失败: {}", e))?;

    // 等待完成（带超时）
    let result = loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                // 进程已结束
                let elapsed = start.elapsed();
                let stdout = child.stdout.take()
                    .map(|mut s| {
                        let mut buf = Vec::new();
                        std::io::Read::read_to_end(&mut s, &mut buf).ok();
                        // 限制输出大小（最多 1MB）
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

                break PythonRunResult {
                    stdout,
                    stderr,
                    exit_code: status.code(),
                    timed_out: false,
                    duration_ms: elapsed.as_millis() as u64,
                };
            }
            Ok(None) => {
                // 还在运行，检查超时
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    break PythonRunResult {
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
                break PythonRunResult {
                    stdout: String::new(),
                    stderr: format!("等待进程失败: {}", e),
                    exit_code: None,
                    timed_out: false,
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }
        }
    };

    // 清理临时脚本文件
    if is_temp_script {
        let _ = std::fs::remove_file(&script_file);
    }
    // 清理输入文件
    if let Some(ref input_path) = input_file {
        let _ = std::fs::remove_file(input_path);
    }

    Ok(result)
}
