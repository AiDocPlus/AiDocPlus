# Desktop Round80 计划

## 目标

- 收口 `useAppStore.ts` 中 `replaceProjectInState` / `removeProjectFromState` / `replaceDocumentInState` / `removeDocumentFromState` 的重复分发包装。
- 仅统一 `set((state) => ...)` 这一层，保持现有纯状态 helper 与业务调用顺序不变。
- 保持项目/文档更新、删除、版本恢复、标签更新等行为不变。

## 执行步骤

1. 审计 `useAppStore.ts` 中对上述 4 个 state helper 的重复 `set` 包装命中点。
2. 在 store 内补局部分发函数，分别统一 project/document 的 replace/remove 调用。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改项目/文档更新时机。
- 不改 `tabs/currentDocument/currentProject` 同步语义。
