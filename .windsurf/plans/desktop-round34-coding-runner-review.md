# Desktop Round34 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/components/coding/CodingPanel.tsx` 中 `run_script_stream`、停止运行、输出事件监听装配相关逻辑。
- 优先下沉的范围：运行参数构造、输出头部行构造、chunk/done 事件筛选、运行结束结果整理、停止命令包装。
- 保持 `CodingPanel.tsx` 外部 API 与交互行为不变。

## 执行步骤

1. 审查 `handleRun` 与 `handleKillScript` 里的命令调用、事件监听装配、tab 输出回写模式。
2. 抽取低风险 helper/command，避免修改组件交互时序。
3. 将 `CodingPanel.tsx` 接回 helper，并清理失效导入与本地重复逻辑。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改现有运行交互和输出展示。
- 不改组件 props 与 store API。
- 不做功能新增。
- 所有改动完成后立即验证。
