# Desktop Round57 计划

## 目标

- 回到总计划阶段 2 的核心热点：`apps/desktop/src-ui/src/stores/useAppStore.ts`。
- 审计其中重复的调用编排、fallback 路径、诊断日志和可抽离的纯逻辑。
- 只做低风险收口，保持外部 API、状态结构与 UI 行为不变。

## 执行步骤

1. 阅读并定位 `useAppStore.ts` 中最重复、最稳定的逻辑块。
2. 选择一组纯 helper 或内部抽取点。
3. 保持 store 对外字段与 action 名称不变。
4. 执行前端构建验证。

## 约束

- 不改 Zustand state 形状。
- 不改持久化协议。
- 不改 Tauri 调用参数。
