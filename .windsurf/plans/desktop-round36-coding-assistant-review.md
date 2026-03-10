# Desktop Round36 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/components/coding/CodingAssistantPanel.tsx` 中消息更新、快捷动作与流式状态切换逻辑。
- 优先下沉的范围：消息创建/追加、assistant 占位消息更新、快捷动作 prompt 组装、代码块提取结果应用前的派生逻辑。
- 保持 `CodingAssistantPanel.tsx` 外部 API 与交互行为不变。

## 执行步骤

1. 审查 `CodingAssistantPanel.tsx` 中消息列表更新、流式请求状态切换、快捷动作与代码应用链路。
2. 抽取低风险 helper，避免改动 UI 交互。
3. 将 `CodingAssistantPanel.tsx` 接回 helper，并清理失效导入与本地重复逻辑。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改组件 props。
- 不改交互行为。
- 不做功能新增。
- 所有改动完成后立即验证。
