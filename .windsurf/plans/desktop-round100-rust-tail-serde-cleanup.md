# Desktop Round100 计划

## 目标

- 清理 `src-tauri` 中剩余最后一组可机械收口的 `serde(rename)` 尾项。
- 范围限定在 `commands/resource.rs` 与 `commands/email.rs` 的纯数据结构。
- 保持前端字段名兼容不变。

## 执行步骤

1. 对 `PromptTemplateInfo`、`PromptCategoryInfo`、`AttachmentInfo` 评估是否可改为 `#[serde(rename_all = "camelCase")]`。
2. 删除被 `rename_all` 覆盖的单字段 `rename`。
3. 保持 `default` 等行为不变。
4. 运行 `cargo check` 验证。

## 约束

- 不改命令参数与前端调用方式。
- 不改资源管理与邮件发送逻辑。
- 不改变外部序列化字段名。
