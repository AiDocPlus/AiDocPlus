# Desktop Round54 计划

## 目标

- 继续清理 `apps/desktop/src-tauri/src/api_server.rs`。
- 聚焦 `ApiResponse` 到 `StatusCode` 的映射逻辑，减少 `handle_call` 内联分支。
- 抽成纯 helper，保持 HTTP 返回码与错误语义不变。

## 执行步骤

1. 提取 `ApiResponse -> StatusCode` 映射逻辑。
2. 保持 400/401/403/404/500 与成功 200 的既有规则不变。
3. 不改错误文本与 JSON 结构。
4. 执行 `cargo check` 验证。

## 约束

- 不改 API 路径。
- 不改返回 JSON。
- 不改认证流程。
