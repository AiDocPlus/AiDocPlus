# Desktop Round45 计划

## 目标

- 延续 `/Users/jdh/.windsurf/plans/codebase-cleanup-plan-7d0c55.md` 的阶段 4，继续收缩 Rust 侧宽泛 `allow`。
- 聚焦 `apps/desktop/src-tauri/src/error.rs`，核对 `AppError` 变体的真实调用，再决定是否缩小 `dead_code` 抑制范围。
- 保持错误类型对外行为与序列化结果不变。

## 执行步骤

1. 搜索 `AppError` 各变体的真实调用路径。
2. 仅在有调用证据或编译反馈支撑时收缩 `allow(dead_code)`。
3. 不改变 `AppError` 的错误消息与 `Serialize` 行为。
4. 执行 `cargo check` 验证。

## 约束

- 不做猜测性删除。
- 不改变 `Result<T>` 类型别名行为。
- 不改错误文本。
