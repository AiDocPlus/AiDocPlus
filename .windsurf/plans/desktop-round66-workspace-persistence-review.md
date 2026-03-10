# Desktop Round66 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中 workspace 保存/加载的 Tauri 容错编排样板。
- 聚焦 `saveWorkspaceState` 与 `loadWorkspaceState` 的 `isTauri` 检查、命令调用与错误日志。
- 抽成稳定 helper，保持工作区保存、加载与恢复行为不变。

## 执行步骤

1. 阅读 workspace 相关 store 代码与现有 helper 边界。
2. 抽取保存/加载 workspace 的 Tauri 包装 helper。
3. 让 store 保留最小编排逻辑。
4. 执行前端构建验证。

## 约束

- 不改 workspace state 数据结构。
- 不改无项目时跳过保存的语义。
- 不改失败时返回 `null` 的行为。
