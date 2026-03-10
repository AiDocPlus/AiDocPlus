# Desktop Round75 计划

## 目标

- 收口 `useConversationsStore.ts` 中仅更新 `conversations` 字段的重复 patch 包装样板。
- 优先复用 `useConversationsStore.helpers.ts` 中的纯函数，避免 store 内重复手写 `set((state) => ({ conversations: ... }))`。
- 保持会话更新、消息追加、置顶切换与持久化行为不变。

## 执行步骤

1. 审计 `useConversationsStore.ts` 中仅更新 `conversations` 的重复调用点。
2. 在 helper 中补充统一的 `conversations` patch 构造函数。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改会话创建/删除与当前会话切换语义。
- 不改持久化字段与顺序。
