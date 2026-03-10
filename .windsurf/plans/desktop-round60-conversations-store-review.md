# Desktop Round60 计划

## 目标

- 继续总计划中的前端状态层清理，聚焦 `apps/desktop/src-ui/src/stores/useConversationsStore.ts`。
- 审计会话列表更新、标题生成、分组与持久化编排的重复样板。
- 只做低风险 helper 收口，保持对外 API、分组结果与持久化行为不变。

## 执行步骤

1. 阅读 `useConversationsStore.ts` 与现有 helper 的职责边界。
2. 找出最重复、最稳定的一组列表更新或派生逻辑。
3. 抽成 helper 或复用现有 helper。
4. 执行前端构建验证。

## 约束

- 不改 conversation 数据结构。
- 不改分组规则。
- 不改 store action 名称。
