# Desktop Round78 计划

## 目标

- 收口 `useSettingsStore.ts` 中 7 处插件设置更新的重复 `buildPluginsPatchState(...)` 包装。
- 保持插件启用、使用计数、分类增删改排、插件顺序更新行为不变。
- 优先在 store 内补局部通用分发函数，避免改动现有纯状态 helper 签名。

## 执行步骤

1. 审计 `setPluginEnabled`、`incrementPluginUsage`、`addCategory`、`renameCategory`、`deleteCategory`、`reorderCategories`、`setPluginOrder` 的重复包装。
2. 在 `useSettingsStore.ts` 内补一个局部插件 patch 分发函数，统一调用 `buildPluginsPatchState(...)`。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `PluginsSettings` 数据结构。
- 不改分类与排序更新的时机和语义。
