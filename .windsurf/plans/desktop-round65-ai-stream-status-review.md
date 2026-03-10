# Desktop Round65 计划

## 目标

- 继续收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中 AI 流相关状态 patch 样板。
- 聚焦 `isAiStreaming`、`aiStreamingTabId`、`error` 的开始/结束状态设置。
- 抽成稳定 helper，保持聊天、生成和停止流行为不变。

## 执行步骤

1. 提炼开始流、结束流的公共 patch helper。
2. 替换 `sendChatMessage`、`generateContent`、`generateContentStream`、`stopAiStream` 中重复 set。
3. 不改错误处理和 request 逻辑。
4. 执行前端构建验证。

## 约束

- 不改 `aborted` 判断。
- 不改 `requestId/sessionId` 规则。
- 不改 store 对外 API。
