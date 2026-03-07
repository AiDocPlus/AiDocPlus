//! CLI 命令处理模块
//!
//! 在 Tauri Builder 启动之前拦截命令行参数，
//! 处理 --version、api status、api schema、api call 等命令后直接退出。
//! 无需启动 GUI 窗口。

use serde_json::{json, Value};
use std::path::PathBuf;

/// api.json 连接信息
struct ApiInfo {
    port: u16,
    token: String,
}

/// 在 Windows release 模式下附加到父进程的控制台，使 println! 可见
#[cfg(all(target_os = "windows", not(debug_assertions)))]
fn attach_console() {
    unsafe {
        // AttachConsole(ATTACH_PARENT_PROCESS)
        #[link(name = "kernel32")]
        extern "system" {
            fn AttachConsole(dwProcessId: u32) -> i32;
        }
        let _ = AttachConsole(0xFFFFFFFF); // ATTACH_PARENT_PROCESS
    }
}

#[cfg(any(not(target_os = "windows"), debug_assertions))]
fn attach_console() {}

/// 尝试处理 CLI 命令。如果是 CLI 命令则处理后退出进程；否则返回，继续启动 GUI。
pub fn try_handle_cli() {
    let args: Vec<String> = std::env::args().collect();

    // 无参数或只有程序名 → 启动 GUI
    if args.len() <= 1 {
        return;
    }

    // 解析参数
    let mut show_version = false;
    let mut api_cmd: Option<String> = None;
    let mut call_method: Option<String> = None;
    let mut call_params: Option<String> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--version" | "-v" | "-V" => {
                show_version = true;
            }
            "--help" | "-h" => {
                attach_console();
                print_help();
                std::process::exit(0);
            }
            "api" => {
                if i + 1 < args.len() {
                    api_cmd = Some(args[i + 1].clone());
                    i += 1;
                    // api call <method> [-p <params>]
                    if api_cmd.as_deref() == Some("call") {
                        if i + 1 < args.len() {
                            call_method = Some(args[i + 1].clone());
                            i += 1;
                        }
                        // 查找 -p / --params
                        let mut j = i + 1;
                        while j < args.len() {
                            if (args[j] == "-p" || args[j] == "--params") && j + 1 < args.len() {
                                call_params = Some(args[j + 1].clone());
                                break;
                            }
                            j += 1;
                        }
                    }
                } else {
                    attach_console();
                    print_api_help();
                    std::process::exit(0);
                }
            }
            _ => {
                // 未知参数，交给 Tauri 插件处理（如 deep-link URL）
                return;
            }
        }
        i += 1;
    }

    // 处理 --version
    if show_version {
        attach_console();
        println!("AiDocPlus v{}", env!("CARGO_PKG_VERSION"));
        std::process::exit(0);
    }

    // 处理 api 子命令
    if let Some(cmd) = api_cmd {
        attach_console();
        // 清除代理环境变量，本地 API 调用不走代理
        for var in &["ALL_PROXY", "all_proxy", "HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy"] {
            std::env::remove_var(var);
        }
        match cmd.as_str() {
            "status" => cmd_api_status(),
            "schema" => cmd_api_schema(),
            "call" => {
                if let Some(method) = call_method {
                    cmd_api_call(&method, call_params.as_deref());
                } else {
                    eprintln!("错误: api call 缺少方法名");
                    eprintln!("用法: aidocplus api call <method> [-p <json>]");
                    std::process::exit(1);
                }
            }
            _ => {
                eprintln!("未知 api 子命令: {}", cmd);
                print_api_help();
                std::process::exit(1);
            }
        }
        std::process::exit(0);
    }
}

// ── 帮助信息 ──────────────────────────────────────────────

fn print_help() {
    println!("AiDocPlus v{}", env!("CARGO_PKG_VERSION"));
    println!();
    println!("用法:");
    println!("  aidocplus                          启动图形界面");
    println!("  aidocplus --version                显示版本号");
    println!("  aidocplus --help                   显示帮助信息");
    println!("  aidocplus api <子命令>             API 相关操作");
    println!();
    println!("API 子命令:");
    println!("  aidocplus api status               查看 API Server 状态");
    println!("  aidocplus api schema               查看 API Schema");
    println!("  aidocplus api call <method> [-p <json>]  调用 API 方法");
    println!();
    println!("示例:");
    println!("  aidocplus api call project.list");
    println!("  aidocplus api call document.list -p '{{\"projectId\":\"xxx\"}}'");
}

fn print_api_help() {
    println!("AiDocPlus API 命令行工具");
    println!();
    println!("用法:");
    println!("  aidocplus api status               查看 API Server 状态");
    println!("  aidocplus api schema               查看 API Schema");
    println!("  aidocplus api call <method> [-p <json>]  调用 API 方法");
    println!();
    println!("示例:");
    println!("  aidocplus api status");
    println!("  aidocplus api schema");
    println!("  aidocplus api call project.list");
    println!("  aidocplus api call document.list -p '{{\"projectId\":\"abc\"}}'");
    println!("  aidocplus api call ai.generate -p '{{\"prompt\":\"你好\"}}'");
}

// ── api.json 读取 ─────────────────────────────────────────

fn read_api_json() -> Result<ApiInfo, String> {
    let api_json_path = api_json_path();
    if !api_json_path.exists() {
        return Err(
            "AiDocPlus 未在运行（未找到 ~/.aidocplus/api.json）。\n\
             请先启动 AiDocPlus 桌面应用。"
                .into(),
        );
    }
    let content = std::fs::read_to_string(&api_json_path)
        .map_err(|e| format!("读取 api.json 失败: {}", e))?;
    let info: Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 api.json 失败: {}", e))?;

    let port = info["port"]
        .as_u64()
        .ok_or("api.json 缺少 port 字段")? as u16;
    let token = info["token"]
        .as_str()
        .ok_or("api.json 缺少 token 字段")?
        .to_string();

    Ok(ApiInfo { port, token })
}

fn api_json_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".aidocplus")
        .join("api.json")
}

// ── HTTP 请求工具 ─────────────────────────────────────────

fn http_get(url: &str, _token: Option<&str>) -> Result<Value, String> {
    let mut builder = ureq::get(url);
    if let Some(t) = _token {
        builder = builder.header("Authorization", &format!("Bearer {}", t));
    }
    let body: Value = builder
        .call()
        .map_err(|e| format!("请求失败: {}", e))?
        .into_body()
        .read_json()
        .map_err(|e| format!("解析响应失败: {}", e))?;
    Ok(body)
}

fn http_post(url: &str, token: &str, body: &Value) -> Result<Value, String> {
    let result: Value = ureq::post(url)
        .header("Authorization", &format!("Bearer {}", token))
        .header("X-Caller-Level", "script")
        .send_json(body)
        .map_err(|e| format!("请求失败: {}", e))?
        .into_body()
        .read_json()
        .map_err(|e| format!("解析响应失败: {}", e))?;
    Ok(result)
}

// ── 子命令实现 ────────────────────────────────────────────

fn cmd_api_status() {
    let info = match read_api_json() {
        Ok(i) => i,
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    };

    let url = format!("http://127.0.0.1:{}/api/v1/status", info.port);
    match http_get(&url, None) {
        Ok(status) => {
            println!("{}", serde_json::to_string_pretty(&status).unwrap());
        }
        Err(e) => {
            eprintln!("无法连接到 API Server (127.0.0.1:{}): {}", info.port, e);
            eprintln!("请确保 AiDocPlus 正在运行。");
            std::process::exit(1);
        }
    }
}

fn cmd_api_schema() {
    let info = match read_api_json() {
        Ok(i) => i,
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    };

    let url = format!("http://127.0.0.1:{}/api/v1/schema", info.port);
    match http_get(&url, None) {
        Ok(schema) => {
            println!("{}", serde_json::to_string_pretty(&schema).unwrap());
        }
        Err(e) => {
            eprintln!("获取 API Schema 失败: {}", e);
            std::process::exit(1);
        }
    }
}

fn cmd_api_call(method: &str, params_json: Option<&str>) {
    let info = match read_api_json() {
        Ok(i) => i,
        Err(e) => {
            eprintln!("{}", e);
            std::process::exit(1);
        }
    };

    // 解析参数 JSON
    let params: Value = if let Some(p) = params_json {
        serde_json::from_str(p).unwrap_or_else(|e| {
            eprintln!("参数 JSON 解析失败: {}", e);
            eprintln!("请确保参数是有效的 JSON 对象，如: '{{\"key\":\"value\"}}'");
            std::process::exit(1);
        })
    } else {
        json!({})
    };

    let url = format!("http://127.0.0.1:{}/api/v1/call", info.port);
    let body = json!({
        "method": method,
        "params": params,
        "id": "cli_1"
    });

    match http_post(&url, &info.token, &body) {
        Ok(response) => {
            // 检查是否有错误
            if let Some(err) = response.get("error") {
                if !err.is_null() {
                    let code = err.get("code").and_then(|c| c.as_i64()).unwrap_or(500);
                    let msg = err
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("未知错误");
                    eprintln!("API 错误 [{}]: {}", code, msg);
                    std::process::exit(1);
                }
            }
            // 输出 result
            if let Some(result) = response.get("result") {
                println!("{}", serde_json::to_string_pretty(result).unwrap());
            } else {
                println!("{}", serde_json::to_string_pretty(&response).unwrap());
            }
        }
        Err(e) => {
            eprintln!("API 调用失败: {}", e);
            std::process::exit(1);
        }
    }
}
