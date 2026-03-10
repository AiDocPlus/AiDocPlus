# Desktop Round39 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/components/coding/CodingPanel.tsx` 中剩余的运行时文案派生、设置面板 patch 构造与输出空态提示逻辑。
- 优先下沉纯函数：语言运行态判断衍生文案、底部运行时标签、输出空态提示、低风险设置 patch 生成。
- 保持 `CodingPanel.tsx` 外部 API 与交互行为不变。

## 执行步骤

1. 审查 `CodingPanel.tsx` 中 `pythonStatusEl`、`outputStatusEl`、底部状态栏与设置面板 `updateSettings` 片段。
2. 将稳定的纯派生与 patch 构造抽到 `CodingPanel.helpers.ts`。
3. 将 `CodingPanel.tsx` 接回 helper，并清理重复判断与失效导入。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改 props 与 store API。
- 不改交互时序与界面行为。
- 不新增功能。
- 所有改动完成后立即验证。
