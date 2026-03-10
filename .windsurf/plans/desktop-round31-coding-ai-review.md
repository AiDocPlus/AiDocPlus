# Desktop Round31 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/components/coding/codingAI.ts` 中 AI 调用、流式监听、结果清洗与重试逻辑。
- 优先下沉的范围：AI 调用命令包装、流式监听 requestId 管理、think 标签解析增量处理、代码块清洗、重试判定等纯逻辑。
- 保持 `codingAI.ts` 外部 API 与行为不变。

## 执行步骤

1. 审查 `codingAI.ts` 中的 `invoke/listen`、requestId 生命周期、重试与错误处理、代码清洗逻辑。
2. 抽取低风险 helper/command，避免修改现有调用方式。
3. 将 `codingAI.ts` 接回 helper，并清理失效的本地重复逻辑。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改外部函数签名。
- 不改编程区现有交互行为。
- 不做功能新增。
- 所有改动完成后立即验证。
