# Desktop Round33 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/stores/useTemplatesStore.ts` 中模板加载、回退装载、列表更新与命令包装逻辑。
- 优先复用并补强现有 `useTemplatesStore.helpers.ts`，让 store 更偏向状态编排。
- 保持 `useTemplatesStore.ts` 外部 API 与行为不变。

## 执行步骤

1. 审查 store 中仍保留的 `invoke`、内置回退、导入导出、分类映射与列表更新逻辑。
2. 将稳定重复逻辑抽到 helper，避免改动调用方。
3. 将 store 接回 helper，清理失效本地逻辑与导入。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改 store 对外 API。
- 不改模板数据结构。
- 不做功能新增。
- 所有改动完成后立即验证。
