# Desktop Round47 计划

## 目标

- 延续阶段 4 的 Rust 清理，继续收缩命令层的文件级 `non_snake_case`。
- 聚焦 `apps/desktop/src-tauri/src/commands/plugin.rs` 与 `apps/desktop/src-tauri/src/commands/document.rs`。
- 保持 Tauri 命令参数名与前端调用协议不变。

## 执行步骤

1. 审查两个文件中哪些命令真正依赖 camelCase 参数名。
2. 将文件级 `#![allow(non_snake_case)]` 收缩到函数级。
3. 不改命令名、不改参数名。
4. 执行 `cargo check` 验证。

## 约束

- 不更改前端 invoke 参数协议。
- 不改命令导出名。
- 不扩大到无关模块。
