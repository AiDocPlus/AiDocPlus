# Desktop Round38 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/components/coding/CodingPanel.tsx` 中工具栏状态派生、环境变量编辑与设置面板更新逻辑。
- 优先下沉的范围：按钮可用性派生、状态文案派生、环境变量增删改的纯更新逻辑。
- 保持 `CodingPanel.tsx` 外部 API 与交互行为不变。

## 执行步骤

1. 审查 `CodingPanel.tsx` 中 toolbar/status 相关 `useMemo` 与 envVars 编辑器的更新逻辑。
2. 抽取低风险 helper，避免影响交互时序。
3. 将 `CodingPanel.tsx` 接回 helper，并清理失效逻辑与导入。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改 props 与 store API。
- 不改设置面板交互。
- 不做功能新增。
- 所有改动完成后立即验证。
