# useAppStore Round26-27 计划

## 目标

- A 线：继续清理 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中重复的 `isLoading` / `error` 状态样板，保持外部 API 与行为不变。
- B 线：在桌面前端中审计下一块高复杂度 store / panel，选择最稳的一组重复逻辑继续下沉。

## 执行步骤

1. 审计 `useAppStore.ts` 中 `set({ isLoading: true, error: null })`、常见错误回写、成功/失败收尾模式，确认能否抽成纯 helper 或轻量包装。
2. 选择收益最高、风险最低的方式收口这些样板，并保持所有现有 action 的语义不变。
3. 审计桌面前端其余高复杂度 store / panel，优先选择重复命令包装、重复状态合并、重复监听器装配这类稳定模式。
4. 对选中的模块做一轮低风险重构，并完成 `pnpm build` 与 `cargo check` 验证。
5. 继续审计 `apps/desktop/src-ui/src/stores/useConversationsStore.ts`，优先抽离存储适配、分组/过滤纯函数、会话更新的稳定重复逻辑。

## 约束

- 不做功能变更。
- 不改变 `useAppStore.ts` 外部 API。
- 不做大范围无验证删除。
- 所有改动完成后立即做构建验证。
