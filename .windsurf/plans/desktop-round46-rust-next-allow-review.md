# Desktop Round46 计划

## 目标

- 继续执行 `/Users/jdh/.windsurf/plans/codebase-cleanup-plan-7d0c55.md` 的阶段 4。
- 重新扫描 `apps/desktop/src-tauri/src` 中剩余的 `allow(dead_code)` / `unused_*` 抑制点，选择下一组最低风险目标。
- 保持运行时行为不变，以 `cargo check` 为验证基线。

## 执行步骤

1. 重新搜索 Rust 源码中的 `allow(dead_code)` 与 `allow(unused_*)`。
2. 根据调用链和编译反馈筛选下一组可安全收口的目标。
3. 做一轮最小范围修改。
4. 执行 `cargo check` 验证。

## 约束

- 不做无法证明安全的删除。
- 不扩大改动面。
- 不改变命令接口。
