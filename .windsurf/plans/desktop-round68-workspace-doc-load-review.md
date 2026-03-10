# Desktop Round68 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中 workspace 恢复时按项目加载文档的重复容错样板。
- 聚焦两处 `listDocumentsCommand` 的 `try/catch + console.error + [] 回退`。
- 抽成稳定 helper，保持工作区恢复与跨项目文档补载行为不变。

## 执行步骤

1. 阅读 `restoreWorkspace` 中两处分支和现有 commands/helper 文件。
2. 抽取 workspace 文档加载包装 helper。
3. 让 store 只保留分支判断与结果应用。
4. 执行前端构建验证。

## 约束

- 不改缺失项目的容错语义。
- 不改文档合并时机。
- 不改旧版 workspace fallback 逻辑。
