# Desktop Round77 计划

## 目标

- 收口 `useSettingsStore.ts` 中 5 个 settings section 更新方法的重复包装样板。
- 复用已有 `mergeSettingsSectionState(...)`，避免在 store 中重复手写同构的 `set((state) => ...)`。
- 保持 editor/ui/file/ai/email 设置更新语义不变。

## 执行步骤

1. 审计 `updateEditorSettings`、`updateUISettings`、`updateFileSettings`、`updateAISettings`、`updateEmailSettings` 的重复调用。
2. 在 store 内补一个局部通用 section 更新函数，统一调用 `mergeSettingsSectionState(...)`。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改 `SettingsState` 外部 API。
- 不改持久化字段。
- 不改各 section 的合并顺序与覆盖语义。
