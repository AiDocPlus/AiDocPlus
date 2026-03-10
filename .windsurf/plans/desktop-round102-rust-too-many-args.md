# Desktop Round102 计划

## 目标

- 审计 `cargo clippy` 剩余的 `clippy::too_many_arguments` 命中。
- 区分哪些是 Tauri/外部接口形状约束，哪些属于内部实现可继续低风险收口。
- 在不改变前端调用契约的前提下，优先做最小、可验证的修复。

## 执行步骤

1. 逐个检查 `too_many_arguments` 命中的函数归属与调用方式。
2. 对外部接口约束型函数，优先考虑窄范围 `#[allow(clippy::too_many_arguments)]`。
3. 对内部函数，仅在不影响调用方的前提下做最小收口；若风险偏高则保留不动。
4. 运行 `cargo clippy` 与 `cargo check` 复验。

## 约束

- 不改前端 `invoke` 参数形状。
- 不改变 Tauri command 暴露方式。
- 不做跨层大重构。
