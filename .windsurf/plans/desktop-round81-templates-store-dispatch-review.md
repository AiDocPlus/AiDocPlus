# Desktop Round81 计划

## 目标

- 收口 `useTemplatesStore.ts` 中 `templates` 与 `customCategories` 的重复状态更新包装。
- 仅统一 `set({ ... })` 与 `set((state) => ({ ... }))` 这一层，不改模板与分类纯 helper 的行为。
- 保持模板导入、创建、更新、删除、分类更新以及后端同步时机不变。

## 执行步骤

1. 审计 `useTemplatesStore.ts` 中围绕 `templates` 与 `customCategories` 的重复状态包装。
2. 在 store 内补局部分发 helper，统一 `templates` 与 `customCategories` 的写入方式。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改模板 ID / 时间戳生成逻辑。
- 不改模板导入导出结构。
- 不改后端保存/删除调用时机。
