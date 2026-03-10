# Desktop Round72 计划

## 目标

- 收口 `apps/desktop/src-ui/src/stores/useAppStore.ts` 中 `error` / `isLoading` / 异步结束状态 patch 的重复样板。
- 优先复用已有 `useAppStore.asyncState.helpers.ts`，避免在 store 内部散落重复 `set(...)`。
- 保持加载、报错和返回行为不变。

## 执行步骤

1. 搜索 `set({ error:`、`set(beginLoadingState())`、`set(finishLoadingState())`、`set(finishWithErrorState(...))` 附近的重复模式。
2. 确认是否可在现有 async helper 上补一层稳定包装。
3. 替换最小一组重复点。
4. 执行前端构建验证。

## 约束

- 不改错误文案。
- 不改异常抛出时机。
- 不改 loading 开关语义。
