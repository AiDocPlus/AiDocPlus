# Desktop Round70 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中 tabs-only 状态 patch 的重复包装。
- 聚焦 `moveTab`、`setTabPanelState`、`markTabAsDirty`、`markTabAsClean` 里重复的 `{ tabs: ... }`。
- 抽成稳定 helper，保持标签页行为不变。

## 执行步骤

1. 阅读 tabs helper 与 store 中 tabs-only 更新点。
2. 提炼公共 tabs patch helper。
3. 替换 store 中重复 `set((state) => ({ tabs: ... }))`。
4. 执行前端构建验证。

## 约束

- 不改 tabs 数组顺序语义。
- 不改 dirty 状态语义。
- 不改 panelState 更新行为。
