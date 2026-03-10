# Desktop Round32 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/components/coding/CodingPanel.tsx` 中读文件、构造标签页、打开文件与导入脚本流程的重复逻辑。
- 优先下沉的范围：读取脚本内容、构造 `CodingTab`、打开已存在 tab、默认新建文件名/模板解析等稳定纯逻辑。
- 保持 `CodingPanel.tsx` 外部 API 与交互行为不变。

## 执行步骤

1. 审查 `CodingPanel.tsx` 中多处 `read_coding_script + addTab`、新建默认 tab、导入外部文件的重复模式。
2. 抽取低风险 helper，避免触碰布局、UI 状态和交互时序。
3. 将 `CodingPanel.tsx` 接回 helper，并清理失效的本地重复逻辑。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改现有交互行为。
- 不改现有组件 props 与 store API。
- 不做功能新增。
- 所有改动完成后立即验证。
