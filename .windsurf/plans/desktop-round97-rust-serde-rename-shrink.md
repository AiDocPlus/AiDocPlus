# Desktop Round97 计划

## 目标

- 收口 Rust 侧一组重复的 `serde(rename = "...")` 样板。
- 目标聚焦在运行结果返回结构体：`PythonRunResult`、`NodeRunResult`、`ScriptFinishResult`。
- 通过 `#[serde(rename_all = "camelCase")]` 保持前端返回字段不变，同时减少逐字段标注。

## 执行步骤

1. 审计三组返回结构体的当前序列化字段名。
2. 对三组结构体改用 `#[serde(rename_all = "camelCase")]`。
3. 删除可被 `rename_all` 覆盖的逐字段 `serde(rename = ...)` 标注。
4. 运行 `cargo check` 验证。

## 约束

- 不改 Tauri command 名称与参数。
- 不改前端接收字段名（仍保持 `exitCode`、`timedOut`、`durationMs`）。
- 不改脚本执行、Node/Python 检测与返回语义。
