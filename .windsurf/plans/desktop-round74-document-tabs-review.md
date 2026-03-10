# Desktop Round74 计划

## 目标

- 收口 `replaceProjectDocumentsInState(...)` / `replaceProjectsDocumentsInState(...)` 与 `finishLoadingState()` 组合的重复 patch 样板。
- 优先复用现有 async/document helper，避免在 `useAppStore.ts` 内反复手写对象展开。
- 保持项目文档列表刷新与 loading 结束语义不变。

## 执行步骤

1. 审计 `useAppStore.ts` 中“替换项目文档列表并结束 loading”的重复调用点。
2. 复用 `finishLoadingState(extra)`，将对象展开改成统一 helper 组合。
3. 仅替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改文档列表替换时机。
- 不改 loading 结束时机。
- 不改外部 store API。
