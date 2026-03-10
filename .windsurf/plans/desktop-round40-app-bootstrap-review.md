# Desktop Round40 计划

## 目标

- 对照 `/Users/jdh/.windsurf/plans/codebase-cleanup-plan-7d0c55.md` 的阶段 2，继续推进桌面端启动链拆分。
- 聚焦 `apps/desktop/src-ui/src/App.tsx`，收口应用初始化编排、前端状态提供者构造、主题派生逻辑。
- 保持 `App.tsx` 外部行为、启动时序与现有 store API 不变。

## 执行步骤

1. 审查 `App.tsx` 中启动 `useEffect`、`registerFrontendStateProvider` 配置与主题应用逻辑。
2. 将稳定纯逻辑与启动编排提取到独立 helper。
3. 让 `App.tsx` 回归为轻量入口层，只保留 hook 装配与渲染。
4. 执行前端构建验证，确保无回归。

## 约束

- 不修改 `useAppStore`、`useTemplatesStore`、`useSettingsStore` 的外部 API。
- 不改变初始化顺序、错误回退与 UI 表现。
- 不新增功能。
