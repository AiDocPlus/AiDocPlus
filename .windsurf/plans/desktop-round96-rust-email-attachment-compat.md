# Desktop Round96 计划

## 目标

- 收口 `apps/desktop/src-tauri/src/commands/email.rs` 中 `AttachmentInfo` 的 `#[allow(non_snake_case)]`。
- 通过 `serde(rename)` 保持前端 `camelCase` 输入兼容，同时将 Rust 字段改为 `snake_case`。
- 不改 `send_email` command 的参数形状与行为。

## 执行步骤

1. 确认 `AttachmentInfo` 仅用于反序列化附件信息，不影响 Tauri command 参数名。
2. 将 `AttachmentInfo` 字段改为 `snake_case`，并为 `mimeType` 增加 `serde(rename = "mimeType")`。
3. 同步更新 `send_email` 内的字段访问。
4. 运行 `cargo check` 验证。

## 约束

- 不改前端 `attachments[].mimeType` 的传参键名。
- 不改附件发送逻辑。
- 不改 `send_email` / `test_smtp_connection` 等命令接口。
