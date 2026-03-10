# Desktop Round49 计划

## 目标

- 继续推进 Rust 阶段 4 清理，聚焦 `apps/desktop/src-tauri/src/commands/import.rs`。
- 审计文件级 `#![allow(unused_assignments, unused_variables)]` 的真实来源。
- 只收口编译器和调用链能明确证明安全的未使用样板。

## 执行步骤

1. 阅读 `import.rs`，定位未使用赋值与未使用变量来源。
2. 优先将文件级抑制缩到局部变量或局部代码块。
3. 保持导入命令对外协议与行为不变。
4. 执行 `cargo check` 验证。

## 约束

- 不改变导入结果。
- 不做行为性重构。
- 不凭猜测删除解析流程。
