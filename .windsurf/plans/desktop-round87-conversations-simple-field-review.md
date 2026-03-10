# Desktop Round87 计划

## 目标

- 收口 `useConversationsStore.ts` 中 `currentConversationId` 与 `searchQuery` 的简单字段分发。
- 统一 `setCurrentConversation`、`setSearchQuery` 以及 `createConversation` 里相关状态写入的包装层。
- 保持当前会话切换、搜索词更新、会话创建时的行为不变。

## 执行步骤

1. 审计 `useConversationsStore.ts` 中 `currentConversationId` / `searchQuery` 的单字段 patch 与会话创建写入点。
2. 在 store 内补局部 helper，统一这两类字段的状态分发。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `createConversationState(...)` 的返回语义。
- 不改 `currentConversationId` 切换时机。
- 不改搜索过滤行为。
