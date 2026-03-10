# Desktop Round41 计划

## 目标

- 对照 `/Users/jdh/.windsurf/plans/codebase-cleanup-plan-7d0c55.md` 的阶段 2，继续推进前端状态层清理。
- 聚焦 `apps/desktop/src-ui/src/stores/useTemplatesStore.ts`，审计并收口模板加载、分类回退、列表更新等稳定重复逻辑。
- 保持 `useTemplatesStore.ts` 外部 API 与行为不变。

## 执行步骤

1. 审查 `useTemplatesStore.ts` 的加载链、fallback 分支、set 状态样板与重复命令包装。
2. 将可纯化的派生/更新逻辑提取到 helper。
3. 回接 store，保留现有 action 名称、参数与时序。
4. 执行前端构建验证。

## 约束

- 不修改 store 对外接口。
- 不改变 fallback 语义。
- 不新增功能。
