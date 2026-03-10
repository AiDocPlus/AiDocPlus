# Desktop Round71 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中 `aiMessagesByTab` 清理与更新的重复样板。
- 聚焦关闭标签页、删除消息或重建消息映射时的 map clone/delete 模式。
- 抽成稳定 helper，保持聊天与标签页行为不变。

## 执行步骤

1. 搜索 `aiMessagesByTab` 的 clone / delete / merge 模式。
2. 提炼公共 map 更新 helper。
3. 替换 store 中重复逻辑。
4. 执行前端构建验证。

## 约束

- 不改消息内容。
- 不改 tab 清理时机。
- 不改 streaming 与错误处理流程。
