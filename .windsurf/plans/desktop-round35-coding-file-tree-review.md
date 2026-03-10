# Desktop Round35 计划

## 目标

- 审计并收口 `apps/desktop/src-ui/src/components/coding/CodingFileTree.tsx` 中目录树构建、排序过滤与 UI 状态派生逻辑。
- 优先下沉的范围：树节点构建、展开状态默认值、搜索过滤、收藏标记与排序等纯逻辑。
- 保持 `CodingFileTree.tsx` 外部 API 与交互行为不变。

## 执行步骤

1. 审查 `CodingFileTree.tsx` 中树结构转换、过滤、排序、展开逻辑。
2. 抽取低风险 helper，避免改动组件交互。
3. 将 `CodingFileTree.tsx` 接回 helper，并清理失效导入与本地重复逻辑。
4. 执行 `pnpm build` 与 `cargo check` 验证。

## 约束

- 不改组件 props。
- 不改文件树交互行为。
- 不做功能新增。
- 所有改动完成后立即验证。
