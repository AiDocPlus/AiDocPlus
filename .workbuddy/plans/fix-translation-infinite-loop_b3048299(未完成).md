---
name: fix-translation-infinite-loop
overview: 修复一键翻译点击后出现的无限 setState 循环。根因：流式回调中 `host.doc.updateInMemory` 更新了文档内容（含变化的 updatedAt 时间戳），触发 TranslationAISidebar 的 useEffect([doc.content])，其中的 setState 又触发重渲染，形成死循环。需要将流式过程中频繁的 updateInMemory 改为只在 trans state 中更新，不写入 store。
todos:
  - id: fix-streaming-loop
    content: 删除 TranslationWorkspace.tsx 流式回调中的 updateInMemory 调用
    status: pending
  - id: fix-sidebar-effect
    content: TranslationAISidebar.tsx useEffect 添加内容去重保护
    status: pending
---

## 用户需求

点击一键翻译后出现 `Maximum update depth exceeded` 无限循环错误，导致组件崩溃被错误边界捕获。

## 错误分析

错误栈指向 `TranslationWorkspace.tsx:374`（`setTrans`）和 `host.ts:113`（`onChunk`），在 `<TranslationAISidebar>` 组件中触发。

死循环链条：

1. 流式 `onChunk` 回调中每次 chunk 都调用 `setTrans` + `host.doc.updateInMemory`
2. `updateInMemory` 更新 zustand store 中的 `doc.content`（每次 `updatedAt` 时间戳不同，必定触发更新）
3. `DocumentWorkspace` 传递新的 `document` prop 给 `TranslationAISidebar`
4. `TranslationAISidebar` 的 `useEffect([doc.content])` 监听到变化，调用 `setSourceCount`/`setTargetCount`/`setDirection`
5. 组件重渲染 → 可能再次触发 `updateInMemory` → 无限循环

## 核心修复

1. 流式回调中删除 `host.doc.updateInMemory`，只在最终保存时同步（第398行已有）
2. 侧栏 `useEffect` 添加内容去重，避免相同内容重复 setState

## 修复方案

### 修复点 1：TranslationWorkspace.tsx 流式回调

- **位置**：第 363-378 行，`onChunk` 回调函数体
- **改动**：删除第 376-377 行的 `host.doc.updateInMemory(...)` 调用
- **理由**：流式过程中只需更新 React 状态（`setTrans` + `transRef.current`），不需要同步到 zustand store。最终保存时（第 396-400 行）已有 `updateInMemory` + `markDirty` + `save` 的完整持久化逻辑。流式过程中频繁调用 `updateInMemory` 导致 store 更新 → prop 变化 → 子组件 useEffect → 无限循环。

### 修复点 2：TranslationAISidebar.tsx useEffect 去重

- **位置**：第 54-61 行，`useEffect([doc.content])`
- **改动**：在 setState 前检查解析后的值是否与当前状态相同，相同则跳过
- **理由**：即使流式回调不再调用 `updateInMemory`，其他场景（如侧栏"替换译文"按钮的 `handleInsertToTarget`）也会调用 `updateInMemory`，添加去重是防御性措施，防止类似的死循环问题。