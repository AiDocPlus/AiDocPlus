# Desktop Round82 计划

## 目标

- 收口 `useCodingStore.ts` 中 `detectPython` / `detectNode` 的运行时检测状态包装。
- 统一检测开始、成功、失败时的 `set(...)` 状态分发，保持检测与持久化行为不变。
- 优先做局部 helper 收口，不改现有运行时检查命令与失败结果构造函数。

## 执行步骤

1. 审计 `detectPython` / `detectNode` 中检测状态切换与结果写入的重复样板。
2. 在 `useCodingStore.ts` 内补一个局部运行时检测分发 helper。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改外部 store API。
- 不改 Python/Node 检测触发条件。
- 不改 `persistState()` 触发时机。
- 不改 `createRuntimeCheckFailure(...)` 语义。
