# Desktop Round84 计划

## 目标

- 收口 `useCodingStore.ts` 中围绕 `tabs` / `activeTabId` 的重复状态包装。
- 统一 `addTab`、`removeTab`、`updateTab`、`saveFile`、`reorderTabs` 的 `set(...)` 分发层。
- 保持标签页增删改、活跃标签切换与持久化触发时机不变。

## 执行步骤

1. 审计 `useCodingStore.ts` 中 `tabs` 与 `activeTabId` 的重复状态更新包装。
2. 在 store 内补局部标签页分发 helper，统一 `tabs` 与 `activeTabId` 写入方式。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `removeItemWithActiveFallback(...)` 的回退语义。
- 不改 `persistState()` 的调用时机。
- 不改 `saveFile` 成功后 dirty 标记的切换语义。
