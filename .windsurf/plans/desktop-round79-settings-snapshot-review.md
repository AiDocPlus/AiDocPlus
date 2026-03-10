# Desktop Round79 计划

## 目标

- 收口 `useSettingsStore.ts` 与 `useSettingsStore.helpers.ts` 中 `editor/ui/file/ai/email/shortcuts` 这组 settings 快照的重复字段挑选与合并样板。
- 统一 `updateSettings`、`mergeImportedSettings`、`exportSettings`、`partialize` 的快照处理边界。
- 保持设置更新、导入、导出和持久化字段语义不变。

## 执行步骤

1. 审计 settings 快照字段在 store 与 helper 中的重复列举点。
2. 在 helper 中补充通用的 settings snapshot pick/merge helper。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改导出 JSON 结构。
- 不改持久化包含的字段集合。
- 不改导入时 `error` 清空语义。
