# Desktop Round29 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/stores/useSettingsStore.ts` 中稳定重复逻辑。
- 优先下沉到 helper 的范围：Tauri 设置存储适配、插件分类树更新、设置默认值合并、重置/导入导出相关纯逻辑。
- 保持 `useSettingsStore.ts` 外部 API 与行为不变。

## 执行步骤

1. 完整审查 `useSettingsStore.ts`，标出存储适配、深度合并、插件分类变更、局部设置更新的重复模式。
2. 提取低风险 helper，避免触碰业务语义和持久化键结构。
3. 将 `useSettingsStore.ts` 接回 helper，并清理失效的本地重复函数。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改外部 store API。
- 不改持久化结构与 key。
- 不做功能新增。
- 所有改动完成后立即验证。
