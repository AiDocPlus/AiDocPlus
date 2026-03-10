# Desktop Round53 计划

## 目标

- 继续清理 `apps/desktop/src-tauri/src/api_server.rs`。
- 聚焦 `/api/v1/call` 与 `/api/v1/events` 中重复的 Bearer Token 认证与调用者级别解析逻辑。
- 抽成纯 helper，保持 HTTP API 返回码与行为不变。

## 执行步骤

1. 找出重复的 Authorization 头读取与 Bearer Token 校验逻辑。
2. 抽离为小型纯 helper。
3. 保持 `CallerLevel` 判定规则不变。
4. 执行 `cargo check` 验证。

## 约束

- 不改接口路径。
- 不改错误码与错误文本。
- 不改 SSE 行为。
