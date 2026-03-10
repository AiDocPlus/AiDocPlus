# Desktop Round42 计划

## 目标

- 对照 `/Users/jdh/.windsurf/plans/codebase-cleanup-plan-7d0c55.md` 的阶段 3，开始推进插件框架去副作用化。
- 聚焦 `apps/desktop/src-ui/src/plugins/registry.ts` 与 `apps/desktop/src-ui/src/plugins/loader.ts`，优先收口重复 getter、插件列表构造与低风险副作用样板。
- 保持插件系统对外 API 与运行行为不变。

## 执行步骤

1. 审查 `registry.ts` 与 `loader.ts` 中的重复访问入口、全局状态写入点与副作用注册依赖。
2. 将稳定纯逻辑抽为 helper 或统一访问入口。
3. 尽量减少语义重复与无效样板，但不改变现有初始化时机。
4. 执行前端构建验证。

## 约束

- 不改变插件注册时序。
- 不删除真实调用入口。
- 不新增功能。
