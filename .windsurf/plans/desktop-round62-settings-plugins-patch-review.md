# Desktop Round62 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useSettingsStore.ts` 中插件设置更新的重复 patch 包装样板。
- 聚焦 `setPluginEnabled`、`incrementPluginUsage`、分类增删改排、`setPluginOrder`。
- 抽成小型 helper，保持设置 API、persist 结构和兼容行为不变。

## 执行步骤

1. 在 settings helper 中补齐插件 patch 包装函数。
2. 让 store action 复用该 helper。
3. 不改 action 名称与参数。
4. 执行前端构建验证。

## 约束

- 不改持久化结构。
- 不改插件默认启用语义。
- 不改分类返回逻辑。
