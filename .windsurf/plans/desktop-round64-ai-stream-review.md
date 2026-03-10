# Desktop Round64 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中 AI 流式编排的重复样板。
- 聚焦 `sendChatMessage` 与 `generateContentStream` 的监听器注册、流状态绑定、结束清理。
- 抽成稳定 helper，保持聊天、生成、停止流与错误处理行为不变。

## 执行步骤

1. 阅读 `useAppStore.ts` 与 `useAppStore.ai.helpers.ts` 的流式辅助逻辑。
2. 抽取一组最稳定的公共状态更新 helper。
3. 让 store 保持编排，避免修改命令调用参数。
4. 执行前端构建验证。

## 约束

- 不改 requestId/sessionId 规则。
- 不改中断判断逻辑。
- 不改 AI 消息和错误处理语义。
