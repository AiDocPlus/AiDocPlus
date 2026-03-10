# Desktop Round83 计划

## 目标

- 收口 `usePluginStorageStore.ts` 中 `data` 写入相关的重复状态包装。
- 统一 `setPluginData`、`removePluginData`、`clearPluginData` 的 `set((state) => ({ data: ... }))` 分发层。
- 保持插件存储命名空间隔离、删除语义与持久化行为不变。

## 执行步骤

1. 审计 `usePluginStorageStore.ts` 中围绕 `data` 的 3 处同构写入逻辑。
2. 在 store 内补一个局部 `updateData` 分发函数。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `data` 的结构定义。
- 不改 `pluginId/key` 的命名空间语义。
- 不改删除空对象后的当前行为。
