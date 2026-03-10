# Desktop Round63 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中文档模板分类操作的重复命令编排。
- 聚焦 `createDocTemplateCategory`、`updateDocTemplateCategory`、`deleteDocTemplateCategory`、`reorderDocTemplateCategories`。
- 抽成稳定 helper，保持分类 API、返回值与状态更新行为不变。

## 执行步骤

1. 阅读分类相关 action 与现有 docTemplates helper。
2. 抽取“执行命令并返回最新分类列表”的公共 helper。
3. 让 store 只保留 `set({ docTemplateCategories })` 编排。
4. 执行前端构建验证。

## 约束

- 不改分类数据结构。
- 不改 action 名称与参数。
- 不改返回值语义。
