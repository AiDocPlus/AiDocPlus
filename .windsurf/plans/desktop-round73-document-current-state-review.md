# Desktop Round73 计划

## 目标

- 收口 `documents` 合并后再显式切换 `currentDocument` 的重复样板。
- 优先复用 `useAppStore.document.helpers.ts`，避免 store 中重复 `mergeDocumentsById + ensureDocumentConsistency` 组合。
- 保持当前文档选中语义与文档列表一致性不变。

## 执行步骤

1. 提炼一个“合并文档并指定当前文档”的纯 helper。
2. 替换 `setCurrentDocument` 的兜底分支。
3. 替换 `createDocument` 成功后的状态组装。
4. 执行前端构建验证。

## 约束

- 不改 `currentDocument` 的切换时机。
- 不改 documents 合并顺序与去重语义。
- 不改外部 store API。
