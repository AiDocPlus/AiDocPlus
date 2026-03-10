# Desktop Round59 计划

## 目标

- 延续前一轮 storage/fallback 收口，聚焦 `apps/desktop/src-ui/src/stores/useConversationsStore.helpers.ts`。
- 复用已抽出的通用 Tauri/localStorage adapter 构造器。
- 保持对话持久化、localStorage 迁移与失败回退语义不变。

## 执行步骤

1. 阅读 conversations storage adapter 的现状。
2. 切换到通用 `createTauriBackedStorageAdapter`。
3. 保持其余对话 helper 不变。
4. 执行前端构建验证。

## 约束

- 不改 conversations 数据格式。
- 不改 localStorage 迁移策略。
- 不改 store 对外 API。
