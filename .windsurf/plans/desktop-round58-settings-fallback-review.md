# Desktop Round58 计划

## 目标

- 继续推进总计划中“兼容迁移、fallback 路径偏多”的清理。
- 聚焦 `apps/desktop/src-ui/src/stores/useSettingsStore.ts` 与 `usePluginStorageStore.ts`。
- 识别可低风险收口的迁移逻辑、fallback 分支与订阅副作用样板。

## 执行步骤

1. 审计两个 store 中的 localStorage 迁移、fallback 与导出副作用。
2. 选择可证明安全的重复逻辑或兼容分支做最小收口。
3. 保持 persist 版本、状态形状与兼容行为不变。
4. 执行前端构建验证。

## 约束

- 不改持久化 schema。
- 不删仍可能命中的升级路径。
- 不改外部调用 API。
