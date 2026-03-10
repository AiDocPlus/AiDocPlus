# Desktop Round86 计划

## 目标

- 收口 `useCodingStore.ts` 中 `favorites` 与 `settings` 的重复状态分发。
- 统一 `toggleFavorite` 与 `updateSettings` 的 `set(...)` 包装层。
- 保持收藏切换、设置合并和持久化触发时机不变。

## 执行步骤

1. 审计 `useCodingStore.ts` 中 `favorites` 与 `settings` 的单字段 patch 样板。
2. 在 store 内补局部 helper，统一这两类状态写入。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `toggleStringInList(...)` 的收藏切换语义。
- 不改 `settings` 的浅合并语义。
- 不改 `persistState()` 调用时机。
