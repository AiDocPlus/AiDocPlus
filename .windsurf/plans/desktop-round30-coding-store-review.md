# Desktop Round30 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/stores/useCodingStore.ts` 中稳定重复逻辑。
- 优先下沉的范围：持久化快照构造、恢复状态解析、运行时探测结果回写、tab/favorites/recentFiles 纯状态变换，以及低风险命令包装。
- 保持 `useCodingStore.ts` 对外 API 与行为不变。

## 执行步骤

1. 审查 `useCodingStore.ts` 的 `invoke` 调用、状态恢复、持久化、tab 变换和列表去重逻辑。
2. 抽取低风险 helper/command，避免触碰 UI 行为和业务语义。
3. 将 store 接回 helper，并清理失效的本地重复逻辑。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改外部 store API。
- 不改持久化字段结构。
- 不做功能新增。
- 所有改动完成后立即验证。
