# Desktop Round98 计划

## 目标

- 对 `document.rs` 与 `project.rs` 中核心持久化模型的重复 `serde(rename = "...")` 样板做一次低风险收口。
- 用 `#[serde(rename_all = "camelCase")]` 保持 JSON 兼容性不变，减少逐字段标注。

## 执行步骤

1. 审计 `Attachment`、`Document`、`DocumentMetadata`、`DocumentVersion`、`Project`、`ProjectSettings` 的现有字段映射。
2. 对可整体适用 camelCase 的结构体添加 `#[serde(rename_all = "camelCase")]`。
3. 删除被覆盖的逐字段 `rename`，保留 `default`、`skip_serializing_if`、特殊字段（如 `type`）等必要属性。
4. 运行 `cargo check` 验证。

## 约束

- 不改变已有 JSON 字段名。
- 不改文档/项目的读写逻辑。
- 不改 Tauri command 参数形状。
