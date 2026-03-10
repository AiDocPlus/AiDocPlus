# Desktop Round61 计划

## 目标

- 继续收口 `apps/desktop/src-ui/src/stores/useConversationsStore.ts`。
- 聚焦 `createConversation` 与 `deleteConversation` 的状态转换样板。
- 抽成纯 helper，保持会话创建、删除与当前会话切换行为不变。

## 执行步骤

1. 在 conversations helper 中补齐创建/删除状态转换函数。
2. 让 store 只保留调用编排。
3. 不改 action 名称和返回值。
4. 执行前端构建验证。

## 约束

- 不改 conversation 数据结构。
- 不改 currentConversationId 的切换规则。
- 不改持久化数据形状。
