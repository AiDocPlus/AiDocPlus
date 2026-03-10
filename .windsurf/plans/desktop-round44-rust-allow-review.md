# Desktop Round44 计划

## 目标

- 对照 `/Users/jdh/.windsurf/plans/codebase-cleanup-plan-7d0c55.md` 的阶段 4，开始推进 Rust 侧死代码与宽泛 `allow` 收缩。
- 聚焦 `apps/desktop/src-tauri/src`，先筛出一组最稳、最小范围的 `dead_code` / `unused_*` 抑制点。
- 保持现有运行行为不变，以 `cargo check` 为验收基线。

## 执行步骤

1. 审查 `src-tauri/src` 中的 `#[allow(dead_code)]`、`#![allow(unused_*]` 与明显未使用项。
2. 选择一组调用链清晰、风险最低的目标做收缩。
3. 保持接口与行为不变，只缩小抑制范围或删除明确未使用项。
4. 执行 `cargo check` 验证。

## 约束

- 不做跨模块大改。
- 不删除无法证明无调用的结构。
- 不改变 Tauri 命令对外接口。
