# Desktop Round93 计划

## 目标

- 收口 Rust 侧一组最稳的 `dead_code` / `allow(dead_code)` 热点。
- 删除 `apps/desktop/src-tauri/src/ai.rs` 中未被引用的旧 AI 请求/响应类型。
- 删除 `apps/desktop/src-tauri/src/error.rs` 中未被构造的错误变体及未使用别名。

## 执行步骤

1. 对齐 `cargo check` 现状，确认告警已被 `allow` 压制而非真实零热点。
2. 清理 `ai.rs` 中仅定义未引用的旧类型，收缩对应 `allow(dead_code)`。
3. 清理 `error.rs` 中未被使用的错误变体与别名，收缩对应 `allow(dead_code)`。
4. 运行 `cargo check` 验证。

## 约束

- 不改 Tauri command 接口。
- 不改现有错误字符串与运行时错误路径。
- 不改 AI 请求/流式处理逻辑。
- 仅删除已确认无引用的类型、变体和别名。
