# Desktop Round69 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中标签页打开分支的状态组装样板。
- 聚焦 `openTab` 及相邻分支里 `createEditorTab`、`appendActiveTab`、`activeTabId/currentDocument` 的重复模式。
- 抽成稳定 helper，保持标签页行为不变。

## 执行步骤

1. 阅读 `openTab` 及相邻标签页相关 action。
2. 抽取标签页打开后的公共状态构造 helper。
3. 让 store 只保留文档查找与调用编排。
4. 执行前端构建验证。

## 约束

- 不改标签顺序。
- 不改 active tab 选择语义。
- 不改 currentDocument 更新语义。
