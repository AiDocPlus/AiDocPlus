# Desktop Round89 计划

## 目标

- 收口 `useSettingsStore.ts` 中 `shortcuts` 与导入失败 `error` 的简单状态分发。
- 统一 `updateShortcut` 与 `importSettings` 中失败分支的 `set(...)` 包装层。
- 保持设置导入、错误抛出时机和快捷键更新行为不变。

## 执行步骤

1. 审计 `useSettingsStore.ts` 中 `shortcuts` 与 `error` 的剩余写入点。
2. 在 store 内补局部 helper，统一这两类简单状态分发。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `importSettings` 成功/失败的异常语义。
- 不改错误消息内容。
- 不改 `shortcuts` 的浅合并语义。
