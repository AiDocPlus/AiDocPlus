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
use std::time::{Duration, Instant};
use rand::Rng;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use axum::http::HeaderValue;

use tauri::AppHandle;

use crate::api_gateway::{ApiRequest, ApiResponse, CallerLevel};
use crate::config::AppState;

// ============================================================
// Token 生命周期常量
// ============================================================

/// Token 有效期（1 小时）
const TOKEN_TTL: Duration = Duration::from_secs(3600);
/// 旧 Token 宽限期（5 分钟）— 过期后仍可认证和刷新
const TOKEN_GRACE_PERIOD: Duration = Duration::from_secs(300);
/// 自动轮换间隔（55 分钟）— 在 TTL 前 5 分钟轮换
const TOKEN_ROTATE_INTERVAL: Duration = Duration::from_secs(3300);

// ============================================================
// Server 状态
// ============================================================

/// Token 轮换状态
pub struct TokenState {
    /// 当前有效 Token
    pub current_token: String,
    /// 当前 Token 签发时间
    pub issued_at: Instant,
    /// 上一个 Token（宽限期内仍可用）
    pub prev_token: Option<String>,
    /// 上一个 Token 的失效时间（issued_at + TTL + GRACE）
    pub prev_expires_at: Option<Instant>,
    /// HTTP 端口号（轮换时需要更新 api.json）
    pub port: u16,
}

impl TokenState {
    /// 创建初始 Token 状态
    fn new(token: String, port: u16) -> Self {
        Self {
            current_token: token,
            issued_at: Instant::now(),
            prev_token: None,
            prev_expires_at: None,
            port,
        }
    }

    /// 验证 Token，返回验证结果
    pub fn validate(&self, bearer_token: &str) -> TokenValidation {
        if bearer_token == self.current_token {
            return TokenValidation::Valid;
        }
        if let Some(ref prev) = self.prev_token {
            if bearer_token == prev.as_str() {
                if let Some(expires_at) = self.prev_expires_at {
                    if Instant::now() < expires_at {
                        return TokenValidation::GracePeriod;
                    }
                }
            }
        }
        TokenValidation::Invalid
    }

    /// 轮换 Token：生成新 Token，将当前移入 prev
    pub fn rotate(&mut self) -> &str {
        let new_token = generate_token();
        self.prev_token = Some(std::mem::replace(&mut self.current_token, new_token));
        self.prev_expires_at = Some(Instant::now() + TOKEN_GRACE_PERIOD);
        self.issued_at = Instant::now();
        &self.current_token
    }

    /// 当前 Token 剩余有效期（秒）
    pub fn expires_in_secs(&self) -> u64 {
        let elapsed = self.issued_at.elapsed();
        if elapsed >= TOKEN_TTL {
            0
        } else {
            (TOKEN_TTL - elapsed).as_secs()
        }
    }

    /// 获取当前 Token 的前 n 个字符（用于编程区子进程身份验证）
    pub fn get_token_prefix(&self, n: usize) -> Option<String> {
        if self.current_token.len() >= n {
            Some(self.current_token[..n].to_string())
        } else {
            None
        }
    }
}

/// Token 验证结果
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenValidation {
    /// 当前有效 Token
    Valid,
    /// 上一个 Token，宽限期内
    GracePeriod,
    /// 无效 Token
    Invalid,
}

/// HTTP Server 共享状态
pub struct ApiServerState {
    /// Token 轮换状态（读写锁保护）
    pub token_state: RwLock<TokenState>,
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
fn write_api_json(port: u16, token: &str) -> crate::error::Result<()> {
    use crate::error::ResultExt;
    let path = api_json_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .context("创建 .aidocplus 目录失败")?;
    }
    let info = ApiJsonInfo {
        port,
        token: token.to_string(),
        pid: std::process::id(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };
    let json = serde_json::to_string_pretty(&info)
        .context("序列化 api.json 失败")?;
    crate::config::atomic_write(&path, &json)?;

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
        .allow_origin(AllowOrigin::list([
            "http://localhost".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1".parse::<HeaderValue>().unwrap(),
            "http://localhost:5173".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:5173".parse::<HeaderValue>().unwrap(),
            "tauri://localhost".parse::<HeaderValue>().unwrap(),
            "https://tauri.localhost".parse::<HeaderValue>().unwrap(),
        ]))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        .route("/api/v1/status", get(handle_status))
        .route("/api/v1/schema", get(handle_schema))
        .route("/api/v1/call", post(handle_call))
        .route("/api/v1/refresh", get(handle_refresh))
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

/// 从 Authorization 头提取 Bearer Token
fn extract_bearer_token(headers: &HeaderMap) -> &str {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .unwrap_or("")
}

/// POST /api/v1/call — JSON-RPC 统一入口，需要 Token 认证
async fn handle_call(
    AxumState(state): AxumState<Arc<ApiServerState>>,
    headers: HeaderMap,
    Json(request): Json<ApiRequest>,
) -> (StatusCode, Json<ApiResponse>) {
    // Token 认证
    let bearer = extract_bearer_token(&headers);
    let validation = state.token_state.read().await.validate(bearer);

    let caller_level = match validation {
        TokenValidation::Valid | TokenValidation::GracePeriod => {
            // Script 级别需要同时满足：
            // 1. 非浏览器请求（无 Origin header）
            // 2. 携带 x-script-signature header（由编程区子进程注入，值为 API token 的前 16 字符）
            // 这防止了外部调用者仅通过设置 x-caller-level: script 即可提权
            let is_browser_request = headers.get("origin").is_some();
            let level_header = headers
                .get("x-caller-level")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("external");
            let script_signature = headers
                .get("x-script-signature")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            // 验证 script signature：必须是有效 token 的前 16 字符
            let expected_sig = state.token_state.read().await.get_token_prefix(16);
            let signature_valid = !script_signature.is_empty()
                && expected_sig.as_ref().map(|s| s == script_signature).unwrap_or(false);
            if !is_browser_request && level_header == "script" && signature_valid {
                CallerLevel::Script
            } else {
                CallerLevel::External
            }
        }
        TokenValidation::Invalid => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ApiResponse::error(
                    request.id.clone(),
                    401,
                    "认证失败：Token 无效或已过期，请重新读取 api.json 或调用 /api/v1/refresh",
                )),
            );
        }
    };

    let response = crate::api_gateway::dispatch(request, caller_level, &state.app_state, &state.app_handle).await;

    let status = if let Some(error) = &response.error {
        match error.code {
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

/// GET /api/v1/refresh — 用当前/宽限期 Token 换取最新 Token
async fn handle_refresh(
    AxumState(state): AxumState<Arc<ApiServerState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<Value>) {
    let bearer = extract_bearer_token(&headers);
    let validation = state.token_state.read().await.validate(bearer);

    match validation {
        TokenValidation::Valid | TokenValidation::GracePeriod => {
            let ts = state.token_state.read().await;
            (StatusCode::OK, Json(json!({
                "token": ts.current_token,
                "expiresIn": ts.expires_in_secs(),
            })))
        }
        TokenValidation::Invalid => {
            (StatusCode::UNAUTHORIZED, Json(json!({
                "error": "Token 无效或已超过宽限期，请重新读取 api.json"
            })))
        }
    }
}

/// GET /api/v1/events — SSE 事件流，需要 Token 认证
async fn handle_sse_events(
    AxumState(state): AxumState<Arc<ApiServerState>>,
    headers: HeaderMap,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    let bearer = extract_bearer_token(&headers);
    let validation = state.token_state.read().await.validate(bearer);

    if validation == TokenValidation::Invalid {
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
#[allow(dead_code)]
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
pub async fn start_api_server(app_handle: AppHandle) -> crate::error::Result<(u16, String)> {
    let token = generate_token();
    let app_state = AppState::new();

    // SSE 广播通道（容量 100 条）
    let (event_tx, _) = tokio::sync::broadcast::channel::<SseEvent>(100);

    // 绑定到 127.0.0.1 的随机可用端口
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("绑定端口失败: {}", e)))?;

    let addr: SocketAddr = listener
        .local_addr()
        .map_err(|e| crate::error::AppError::Internal(format!("获取端口失败: {}", e)))?;

    let port = addr.port();

    let state = Arc::new(ApiServerState {
        token_state: RwLock::new(TokenState::new(token.clone(), port)),
        app_state,
        app_handle,
        event_tx,
    });

    let router = build_router(Arc::clone(&state));

    // 写入 api.json
    write_api_json(port, &token)?;

    println!("[API Server] 启动于 http://127.0.0.1:{}", port);
    println!("[API Server] api.json 已写入: {:?}", api_json_path());
    println!("[API Server] Token 有效期: {}s，自动轮换间隔: {}s", TOKEN_TTL.as_secs(), TOKEN_ROTATE_INTERVAL.as_secs());

    // 后台 task: 自动轮换 Token
    let rotate_state = Arc::clone(&state);
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(TOKEN_ROTATE_INTERVAL).await;

            let mut ts = rotate_state.token_state.write().await;
            let token_for_write = ts.rotate().to_string();
            let port = ts.port;
            drop(ts); // 释放写锁

            // 更新 api.json
            if let Err(e) = write_api_json(port, &token_for_write) {
                eprintln!("[API Server] Token 轮换写入 api.json 失败: {}", e);
            } else {
                println!("[API Server] Token 已自动轮换，api.json 已更新");
            }
        }
    });

    // 在后台 task 中运行 server
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, router).await {
            eprintln!("[API Server] 运行错误: {}", e);
        }
    });

    Ok((port, token))
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── TokenState::new ──

    #[test]
    fn new_token_state_has_no_prev() {
        let ts = TokenState::new("abc123".into(), 8080);
        assert_eq!(ts.current_token, "abc123");
        assert_eq!(ts.port, 8080);
        assert!(ts.prev_token.is_none());
        assert!(ts.prev_expires_at.is_none());
    }

    // ── TokenState::validate ──

    #[test]
    fn validate_current_token_returns_valid() {
        let ts = TokenState::new("token_a".into(), 8080);
        assert_eq!(ts.validate("token_a"), TokenValidation::Valid);
    }

    #[test]
    fn validate_wrong_token_returns_invalid() {
        let ts = TokenState::new("token_a".into(), 8080);
        assert_eq!(ts.validate("wrong"), TokenValidation::Invalid);
    }

    #[test]
    fn validate_empty_token_returns_invalid() {
        let ts = TokenState::new("token_a".into(), 8080);
        assert_eq!(ts.validate(""), TokenValidation::Invalid);
    }

    #[test]
    fn validate_prev_token_in_grace_period() {
        let mut ts = TokenState::new("token_a".into(), 8080);
        // 手动设置 prev_token（模拟轮换后）
        ts.prev_token = Some("old_token".into());
        ts.prev_expires_at = Some(Instant::now() + Duration::from_secs(60));
        assert_eq!(ts.validate("old_token"), TokenValidation::GracePeriod);
    }

    #[test]
    fn validate_prev_token_expired_returns_invalid() {
        let mut ts = TokenState::new("token_a".into(), 8080);
        ts.prev_token = Some("old_token".into());
        // 设置为已过期
        ts.prev_expires_at = Some(Instant::now() - Duration::from_secs(1));
        assert_eq!(ts.validate("old_token"), TokenValidation::Invalid);
    }

    // ── TokenState::rotate ──

    #[test]
    fn rotate_generates_new_token() {
        let mut ts = TokenState::new("original".into(), 8080);
        let new = ts.rotate().to_string();
        assert_ne!(new, "original");
        assert_eq!(ts.current_token, new);
        assert_eq!(ts.prev_token, Some("original".into()));
        assert!(ts.prev_expires_at.is_some());
    }

    #[test]
    fn rotate_old_token_still_valid_in_grace() {
        let mut ts = TokenState::new("first".into(), 8080);
        ts.rotate();
        // first 现在是 prev_token，应在宽限期内有效
        assert_eq!(ts.validate("first"), TokenValidation::GracePeriod);
        // 新 token 有效
        assert_eq!(ts.validate(&ts.current_token.clone()), TokenValidation::Valid);
    }

    #[test]
    fn double_rotate_evicts_oldest_token() {
        let mut ts = TokenState::new("v1".into(), 8080);
        ts.rotate(); // v1 -> prev, v2 -> current
        let v2 = ts.current_token.clone();
        ts.rotate(); // v2 -> prev, v3 -> current
        // v1 不再有效
        assert_eq!(ts.validate("v1"), TokenValidation::Invalid);
        // v2 在宽限期内
        assert_eq!(ts.validate(&v2), TokenValidation::GracePeriod);
    }

    // ── TokenState::expires_in_secs ──

    #[test]
    fn expires_in_secs_is_near_ttl_initially() {
        let ts = TokenState::new("t".into(), 8080);
        let secs = ts.expires_in_secs();
        // 刚创建的 token，剩余时间应接近 TTL（允许 2 秒误差）
        assert!(secs >= TOKEN_TTL.as_secs() - 2);
    }

    // ── generate_token ──

    #[test]
    fn generate_token_is_64_hex_chars() {
        let t = generate_token();
        assert_eq!(t.len(), 64);
        assert!(t.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn generate_token_is_unique() {
        let t1 = generate_token();
        let t2 = generate_token();
        assert_ne!(t1, t2);
    }

    // ── extract_bearer_token ──

    #[test]
    fn extract_bearer_from_valid_header() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", "Bearer my_secret_token".parse().unwrap());
        assert_eq!(extract_bearer_token(&headers), "my_secret_token");
    }

    #[test]
    fn extract_bearer_from_missing_header() {
        let headers = HeaderMap::new();
        assert_eq!(extract_bearer_token(&headers), "");
    }

    #[test]
    fn extract_bearer_from_wrong_scheme() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", "Basic abc123".parse().unwrap());
        assert_eq!(extract_bearer_token(&headers), "");
    }
}
