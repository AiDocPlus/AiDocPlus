# Desktop Round67 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中 workspace 恢复后的 tabs/currentDocument 状态 patch 样板。
- 聚焦多标签恢复和单标签恢复两条分支里的 `set({ tabs, activeTabId, currentDocument })`。
- 抽成稳定 helper，保持工作区恢复行为不变。

## 执行步骤

1. 阅读 `restoreWorkspace` 与 `useAppStore.workspace.helpers.ts` 现有辅助函数。
2. 抽取恢复后的 tab/document 状态构造 helper。
3. 让 store 只负责分支编排与 side effect。
4. 执行前端构建验证。

## 约束

- 不改 tab 恢复顺序。
- 不改 activeTab 选择逻辑。
- 不改 currentDocument 恢复语义。
