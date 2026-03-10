# Desktop Round76 计划

## 目标

- 收口 `useAppStore.ts` 中 `streamStateByTab` 的重复 patch 包装样板。
- 优先复用 `useAppStore.ai.helpers.ts` 中现有的流状态纯函数，补齐统一的 patch 构造函数。
- 保持 AI 流开始、停止、监听器绑定与清理行为不变。

## 执行步骤

1. 审计 `useAppStore.ts` 中直接写入 `streamStateByTab` 的调用点。
2. 在 AI helper 中补充统一的 `streamStateByTab` patch helper。
3. 替换最小一组重复点，并让已有流状态 helper 复用该包装。
4. 执行前端构建验证。

## 约束

- 不改 requestId / sessionId 生成逻辑。
- 不改流监听器绑定、停止、清理时机。
- 不改外部 store API。
