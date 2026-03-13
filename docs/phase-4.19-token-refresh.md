# Phase 4.19: API Server Token 过期 + 刷新机制

## 现状问题

- Token 在应用启动时生成一次，永不过期
- `~/.aidocplus/api.json` 中明文存储 Token
- 如果 Token 泄漏，攻击者可以在整个应用生命周期内使用

## 设计方案

### 核心机制

| 参数 | 值 | 说明 |
|------|-----|------|
| TOKEN_TTL | 1 小时 | Token 有效期 |
| GRACE_PERIOD | 5 分钟 | 旧 Token 过期后仍可用于认证的宽限期 |
| AUTO_ROTATE | 每 55 分钟 | 后台自动轮换（TTL - 5min） |

### 数据结构

```rust
struct TokenState {
    current_token: String,
    issued_at: Instant,
    prev_token: Option<String>,       // 上一个 Token
    prev_expired_at: Option<Instant>,  // 上一个 Token 的过期时间
}
```

### Token 验证逻辑

1. 匹配 `current_token` → 通过
2. 匹配 `prev_token` 且在 `GRACE_PERIOD` 内 → 通过（但返回 `X-Token-Expiring: true` 头）
3. 都不匹配 → 401

### 新增端点

- `GET /api/v1/refresh` — 用当前/宽限期 Token 换取最新 Token
  - 请求头: `Authorization: Bearer <token>`
  - 响应: `{ "token": "<new_token>", "expiresIn": 3600 }`

### 自动轮换

后台 tokio task 每 55 分钟执行：
1. 生成新 Token
2. 将当前 Token 移入 `prev_token`
3. 更新 `api.json`

### SDK 兼容性

SDK 收到 401 时：
1. 重新读取 `api.json` 获取最新 Token
2. 用新 Token 重试请求
3. 仍然 401 则报错

### 修改文件

- `src-tauri/src/api_server.rs` — TokenState、验证逻辑、refresh 端点、自动轮换 task
- `packages/sdk-python/` — 401 自动重试
- `packages/sdk-js/` — 401 自动重试
