# Desktop Round48 计划

## 目标

- 延续 Rust 阶段 4 清理，继续收缩命令层文件级 `non_snake_case`。
- 聚焦 `apps/desktop/src-tauri/src/commands/export.rs`。
- 保持前端 invoke 参数名与导出行为不变。

## 执行步骤

1. 审查 `export.rs` 中哪些命令真正依赖 camelCase 参数名。
2. 将文件级 `#![allow(non_snake_case)]` 收缩到函数级。
3. 不改参数名、不改命令名。
4. 执行 `cargo check` 验证。

## 约束

- 不改变导出协议。
- 不改前端参数结构。
- 不扩大到无关文件。
