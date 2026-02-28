//! 本地 HTTP API Server
//!
//! 程序启动时在 127.0.0.1 上开启 HTTP Server，
//! 端口和 Token 写入 ~/.aidocplus/api.json 供 SDK 读取。
//! 程序退出时自动清理 api.json。

use axum::{
    extract::State as AxumState,
    http::{HeaderMap, Method, StatusCode},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
    Json, Router,
};
use futures_util::stream::Stream;
use std::convert::Infallible;
use std::time::Duration;
use rand::Rng;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};

use tauri::AppHandle;

use crate::api_gateway::{ApiRequest, ApiResponse, CallerLevel};
use crate::config::AppState;

// ============================================================
// Server 状态
// ============================================================

/// HTTP Server 共享状态
pub struct ApiServerState {
    /// 认证 Token
    pub token: String,
    /// 应用状态（文件路径等）
    pub app_state: AppState,
    /// Tauri AppHandle（用于事件桥接前端状态）
    pub app_handle: AppHandle,
    /// SSE 事件广播器
    pub event_tx: tokio::sync::broadcast::Sender<SseEvent>,
}

/// SSE 事件结构
#[derive(Clone, Debug, serde::Serialize)]
pub struct SseEvent {
    pub event_type: String,
    pub data: serde_json::Value,
}

/// api.json 文件内容
#[derive(serde::Serialize)]
struct ApiJsonInfo {
    port: u16,
    token: String,
    pid: u32,
    version: String,
}

// ============================================================
// api.json 生命周期
// ============================================================

/// 获取 api.json 路径: ~/.aidocplus/api.json
fn api_json_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".aidocplus").join("api.json")
}

/// 写入 api.json
fn write_api_json(port: u16, token: &str) -> Result<(), String> {
    let path = api_json_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建 .aidocplus 目录失败: {}", e))?;
    }
    let info = ApiJsonInfo {
        port,
        token: token.to_string(),
        pid: std::process::id(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };
    let json = serde_json::to_string_pretty(&info)
        .map_err(|e| format!("序列化 api.json 失败: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("写入 api.json 失败: {}", e))?;

    // 仅当前用户可读写（Unix）
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

/// 清理 api.json
pub fn cleanup_api_json() {
    let path = api_json_path();
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }
}

/// 读取当前 API 连接信息（供脚本运行器注入环境变量）
/// 返回 (port, token)，如果 api.json 不存在则返回 None
pub fn get_api_connection_info() -> Option<(u16, String)> {
    let path = api_json_path();
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&path).ok()?;
    let info: serde_json::Value = serde_json::from_str(&content).ok()?;
    let port = info.get("port")?.as_u64()? as u16;
    let token = info.get("token")?.as_str()?.to_string();
    Some((port, token))
}

/// 获取 Python SDK 路径（bundled-resources 内或源码目录）
pub fn get_python_sdk_path() -> Option<String> {
    // 优先从 bundled-resources 中查找（打包后的路径）
    // 开发模式下从 packages/sdk-python 查找
    let home = dirs::home_dir()?;

    // 检查 bundled-resources/sdk/python（生产环境）
    // TODO: 通过 Tauri resource_dir 获取
    
    // 开发模式：直接指向 packages/sdk-python
    let dev_path = std::env::current_dir().ok()
        .and_then(|cwd| {
            // 从 src-tauri 向上找到仓库根目录
            let mut dir = cwd.as_path();
            loop {
                let sdk = dir.join("packages").join("sdk-python");
                if sdk.exists() {
                    return Some(sdk.to_string_lossy().to_string());
                }
                dir = dir.parent()?;
            }
        });
    if dev_path.is_some() {
        return dev_path;
    }

    // 备用：~/.aidocplus/sdk/python
    let user_sdk = home.join(".aidocplus").join("sdk").join("python");
    if user_sdk.exists() {
        return Some(user_sdk.to_string_lossy().to_string());
    }

    None
}

/// 获取 JavaScript SDK 路径（bundled-resources 内或源码目录）
/// 返回包含 aidocplus 包的父目录（即 packages/sdk-js），使 require('aidocplus') 可用
pub fn get_js_sdk_path() -> Option<String> {
    let home = dirs::home_dir()?;

    // 开发模式：直接指向 packages/sdk-js
    let dev_path = std::env::current_dir().ok()
        .and_then(|cwd| {
            let mut dir = cwd.as_path();
            loop {
                let sdk = dir.join("packages").join("sdk-js");
                if sdk.exists() {
                    return Some(sdk.to_string_lossy().to_string());
                }
                dir = dir.parent()?;
            }
        });
    if dev_path.is_some() {
        return dev_path;
    }

    // 备用：~/.aidocplus/sdk/js
    let user_sdk = home.join(".aidocplus").join("sdk").join("js");
    if user_sdk.exists() {
        return Some(user_sdk.to_string_lossy().to_string());
    }

    None
}

// ============================================================
// Token 生成
// ============================================================

/// 生成随机安全 Token（32 字节 hex）
fn generate_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

// ============================================================
// 路由 + Handlers
// ============================================================

/// 构建 axum Router
fn build_router(state: Arc<ApiServerState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        .route("/api/v1/status", get(handle_status))
        .route("/api/v1/schema", get(handle_schema))
        .route("/api/v1/call", post(handle_call))
        .route("/api/v1/events", get(handle_sse_events))
        .layer(cors)
        .with_state(state)
}

/// GET /api/v1/status — 无需认证，仅返回运行状态
async fn handle_status() -> Json<Value> {
    Json(json!({
        "running": true,
        "version": env!("CARGO_PKG_VERSION"),
        "apiVersion": 1
    }))
}

/// GET /api/v1/schema — 无需认证，返回 API 自描述
async fn handle_schema() -> Json<Value> {
    Json(crate::api_gateway::get_api_schema())
}

/// POST /api/v1/call — JSON-RPC 统一入口，需要 Token 认证
async fn handle_call(
    AxumState(state): AxumState<Arc<ApiServerState>>,
    headers: HeaderMap,
    Json(request): Json<ApiRequest>,
) -> (StatusCode, Json<ApiResponse>) {
    // Token 认证
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let caller_level = if auth == format!("Bearer {}", state.token) {
        // 有效 Token — 根据 X-Caller-Level 头判断调用者级别
        let level_header = headers
            .get("x-caller-level")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("external");
        match level_header {
            "script" => CallerLevel::Script,
            _ => CallerLevel::External,
        }
    } else {
        // 无效 Token
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse::error(
                request.id.clone(),
                401,
                "认证失败：缺少或无效的 Bearer Token",
            )),
        );
    };

    let response = crate::api_gateway::dispatch(request, caller_level, &state.app_state, &state.app_handle).await;

    let status = if response.error.is_some() {
        let code = response.error.as_ref().unwrap().code;
        match code {
            400 => StatusCode::BAD_REQUEST,
            401 => StatusCode::UNAUTHORIZED,
            403 => StatusCode::FORBIDDEN,
            404 => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    } else {
        StatusCode::OK
    };

    (status, Json(response))
}

// ============================================================
// SSE 事件订阅
// ============================================================

/// GET /api/v1/events — SSE 事件流，需要 Token 认证（query 参数 token）
async fn handle_sse_events(
    AxumState(state): AxumState<Arc<ApiServerState>>,
    headers: HeaderMap,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    // Token 认证：从 Authorization 头获取
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if auth != format!("Bearer {}", state.token) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let mut rx = state.event_tx.subscribe();

    let stream = async_stream::stream! {
        // 发送连接确认事件
        yield Ok(Event::default()
            .event("connected")
            .data(serde_json::json!({"status": "connected"}).to_string()));

        // 持续监听广播事件
        loop {
            match rx.recv().await {
                Ok(sse_event) => {
                    yield Ok(Event::default()
                        .event(&sse_event.event_type)
                        .data(sse_event.data.to_string()));
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    yield Ok(Event::default()
                        .event("warning")
                        .data(format!("{{\"lagged\": {}}}", n)));
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    break;
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(30))
            .text("ping"),
    ))
}

/// 向所有 SSE 客户端广播事件（供其他模块调用）
pub fn broadcast_event(state: &ApiServerState, event_type: &str, data: serde_json::Value) {
    let _ = state.event_tx.send(SseEvent {
        event_type: event_type.to_string(),
        data,
    });
}

// ============================================================
// 启动 Server
// ============================================================

/// 启动 HTTP API Server（在后台 tokio task 中运行）
/// 返回 (端口号, Token)
pub async fn start_api_server(app_handle: AppHandle) -> Result<(u16, String), String> {
    let token = generate_token();
    let app_state = AppState::new();

    // SSE 广播通道（容量 100 条）
    let (event_tx, _) = tokio::sync::broadcast::channel::<SseEvent>(100);

    let state = Arc::new(ApiServerState {
        token: token.clone(),
        app_state,
        app_handle,
        event_tx,
    });

    let router = build_router(state);

    // 绑定到 127.0.0.1 的随机可用端口
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("绑定端口失败: {}", e))?;

    let addr: SocketAddr = listener
        .local_addr()
        .map_err(|e| format!("获取端口失败: {}", e))?;

    let port = addr.port();

    // 写入 api.json
    write_api_json(port, &token)?;

    println!("[API Server] 启动于 http://127.0.0.1:{}", port);
    println!("[API Server] api.json 已写入: {:?}", api_json_path());

    // 在后台 task 中运行 server
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, router).await {
            eprintln!("[API Server] 运行错误: {}", e);
        }
    });

    Ok((port, token))
}
