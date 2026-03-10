# Desktop Round91 计划

## 目标

- 收口 `useAppStore.ts` 中 `projects`、`currentProject`、`currentDocument` 的简单状态分发边界。
- 统一相关 setter 与少量直接 `set({ ... })` 写入点的包装层。
- 保持项目列表加载、当前项目切换和当前文档设置语义不变。

## 执行步骤

1. 审计 `useAppStore.ts` 中 `projects/currentProject/currentDocument` 的简单写入点。
2. 在 store 内补局部 helper，统一这几类字段的简单状态分发。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `setDocuments` / `setCurrentDocument` 的一致性检查逻辑。
- 不改 `loadProjects` 的非 Tauri 分支与加载顺序。
- 不改项目/文档切换时机。
