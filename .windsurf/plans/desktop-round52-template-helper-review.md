# Desktop Round52 计划

## 目标

- 继续按总计划推进 `apps/desktop/src-tauri/src/template.rs` 的低风险收口。
- 聚焦内置模板 / 自定义模板在 manifest 与 content 构造上的重复样板。
- 抽取纯 helper，保持模板列表、内容读取、更新结果与分类行为不变。

## 执行步骤

1. 识别 `template.rs` 中重复的 manifest/content 映射逻辑。
2. 抽成纯 helper，避免重复拼装结构。
3. 保持所有 Tauri 命令与序列化字段不变。
4. 执行 `cargo check` 验证。

## 约束

- 不改模板 JSON 格式。
- 不改前端字段名。
- 不改模板分类 fallback 行为。
