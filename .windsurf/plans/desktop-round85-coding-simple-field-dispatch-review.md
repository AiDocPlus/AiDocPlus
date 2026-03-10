# Desktop Round85 计划

## 目标

- 收口 `useCodingStore.ts` 中 `activeTabId`、`runHistory`、`recentFiles` 的重复状态分发。
- 统一 `setActiveTab`、`addRunHistory`、`clearRunHistory`、`addRecentFile`、`clearRecentFiles` 的 `set(...)` 包装层。
- 保持持久化触发时机与现有数据结构不变。

## 执行步骤

1. 审计 `useCodingStore.ts` 中单字段 patch 的重复样板。
2. 在 store 内补局部 helper，统一 `activeTabId`、`runHistory`、`recentFiles` 的写入方式。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `prependLimitedEntry(...)` 与 `prependRecentFile(...)` 的行为。
- 不改 `persistState()` 调用时机。
- 不改 `activeTabId` 切换语义。
