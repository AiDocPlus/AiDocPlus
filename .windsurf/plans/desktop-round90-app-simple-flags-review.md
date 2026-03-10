# Desktop Round90 计划

## 目标

- 收口 `useAppStore.ts` 中剩余的简单 UI / 运行时标志状态分发。
- 统一 `sidebar/chat/theme/loading/error/documentFilterTag/isGeneratingContent/isAiStreaming` 相关 setter 的 `set(...)` 包装层。
- 保持现有 UI 切换、错误设置与 AI 标志行为不变。

## 执行步骤

1. 审计 `useAppStore.ts` 中剩余单字段与少数字段组合 patch 的命中点。
2. 在 store 内补局部 helper，统一这些简单状态字段的分发。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 `setAiStreaming` 对 `aiStreamingTabId` 的现有联动语义。
- 不改 `toggleSidebar` / `toggleChat` 的切换语义。
- 不改错误消息与 loading 切换时机。
