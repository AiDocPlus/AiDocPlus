# Desktop Round43 计划

## 目标

- 对照 `/Users/jdh/.windsurf/plans/codebase-cleanup-plan-7d0c55.md` 的阶段 3，继续推进插件框架去副作用化。
- 聚焦 `apps/desktop/src-ui/src/plugins/_framework/PluginHostAPI.ts`，审计并收口能力声明、白名单判断、桥接样板与稳定纯逻辑。
- 保持 `PluginHostAPI.ts` 对外 API 与插件运行行为不变。

## 执行步骤

1. 审查 `PluginHostAPI.ts` 的白名单命令、provider 能力派生、AI/平台桥接重复样板。
2. 将可纯化的派生与集合判断收口为 helper 或局部纯函数。
3. 保持 host API 形状不变，只减少重复与隐式逻辑。
4. 执行前端构建验证。

## 约束

- 不修改插件对外 host API 形状。
- 不改变权限判断语义。
- 不新增功能。
