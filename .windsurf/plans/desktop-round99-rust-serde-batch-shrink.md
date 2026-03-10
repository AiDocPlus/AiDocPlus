# Desktop Round99 计划

## 目标

- 继续压缩 Rust 侧重复的 `serde(rename = "...")` 样板。
- 范围限定在 `template.rs`、`plugin.rs`、`commands/coding.rs` 中可机械收口的结构体。
- 保持现有 JSON / 前端字段兼容不变。

## 执行步骤

1. 审计 `DocTemplateManifest`、`DocTemplateContent`、`BuiltinJsonTemplate`、`CustomDocTemplateEntry`、`PluginManifest`、`ScriptFileInfo`、`FileTreeNode`、`SearchResult` 是否可使用 `rename_all = "camelCase"`。
2. 对适用结构体添加 `#[serde(rename_all = "camelCase")]`。
3. 删除被覆盖的逐字段 `rename`，保留 `type`、`default`、`skip_serializing_if` 等必要特殊标注。
4. 运行 `cargo check` 验证。

## 约束

- 不改命令参数形状。
- 不改模板、插件、编程区功能语义。
- 不改任何序列化后的外部字段名。
