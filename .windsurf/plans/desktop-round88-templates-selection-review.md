# Desktop Round88 计划

## 目标

- 收口 `useTemplatesStore.ts` 中 `builtInCategories` 与 `selectedTemplateId` 的剩余状态分发。
- 统一 `loadBuiltInCategories`、`setSelectedTemplate` 与 `deleteTemplate` 中相关状态写入的包装层。
- 保持模板分类加载、选中模板切换与删除后的选中态回退语义不变。

## 执行步骤

1. 审计 `useTemplatesStore.ts` 中 `builtInCategories` / `selectedTemplateId` 的剩余写入点。
2. 在 store 内补局部 helper，统一这两类状态分发。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `removePromptTemplateState(...)` 的删除与选中态回退语义。
- 不改 `loadBuiltInCategories` 的 fallback 行为。
- 不改模板后端删除时机。
