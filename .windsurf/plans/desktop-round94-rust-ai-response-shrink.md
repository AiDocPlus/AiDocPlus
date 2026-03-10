# Desktop Round94 计划

## 目标

- 收口 `apps/desktop/src-tauri/src/ai.rs` 中剩余的 `allow(dead_code)`。
- 通过瘦身 OpenAI 兼容响应结构体，仅保留当前运行时实际读取的字段。
- 保持现有非流式 AI 响应解析和异常路径不变。

## 执行步骤

1. 确认 `OpenAIResponse` 分支中真正读取的字段范围。
2. 缩减 `OpenAIChatResponse`、`Choice`、`OpenAIStreamChunk` 等结构体字段，只保留当前使用字段。
3. 删除已不再需要的 `Delta`、`OpenAIUsage` 及对应 `allow(dead_code)`。
4. 运行 `cargo check` 验证。

## 约束

- 不改 Tauri command 接口。
- 不改 `chat()` 的返回行为与错误语义。
- 不改流式解析逻辑。
- 仅删除未被读取且可由 serde 忽略的冗余字段/类型。
