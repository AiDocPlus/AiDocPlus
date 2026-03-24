---
name: fix-codemirror-crash-diary
overview: 修复日记编辑器首次输入时 CodeMirror 崩溃的问题。根因是 MarkdownEditor 的 lastEmittedRef 在切换条目时没有正确重置，导致文档状态与编辑器内部状态不同步。
todos:
  - id: simplify-diary-editor
    content: 简化 DiaryEditor，移除 useState(content) 和 initialContent 状态包装
    status: completed
  - id: enhance-mdeditor-sync
    content: 增强 MarkdownEditor 的 lastEmittedRef 同步，在编辑器创建后立即同步
    status: completed
---

## 问题描述

日记编辑器首次输入时崩溃：`RangeError: Position 465 is out of range for changeset of length 464`

## 问题根因

1. `DiaryEditor` 中使用 `useState(content)` 创建了 `initialContent` 状态，这个状态只在组件首次挂载时初始化
2. 当切换日记条目时，虽然 `key` 变化会触发组件重新挂载，但状态同步可能存在问题
3. `MarkdownEditor` 的 `lastEmittedRef` 与实际文档内容之间存在不一致

## 修复目标

确保日记编辑器在切换条目后首次输入时不会出现 Position 越界错误。

## 技术方案

### 修复1：简化 DiaryEditor（移除不必要的状态包装）

**文件**：`apps/desktop/src-ui/src/document-types/diary/DiaryEditor.tsx`

**问题**：`useState(content)` 创建了 `initialContent`，这个状态在组件首次挂载时设置，后续不会更新。虽然 key 变化会导致重新挂载，但这种间接传递方式增加了不确定性。

**方案**：移除 `initialContent` 状态，直接将 `content` prop 传递给 MarkdownEditor。

### 修复2：增强 MarkdownEditor 的 lastEmittedRef 同步

**文件**：`apps/desktop/src-ui/src/components/editor/MarkdownEditor.tsx`

**问题**：`lastEmittedRef` 在 useRef 初始化时设置为 value，但编辑器初始化 effect 使用空依赖 `[]`，此时 value 已经是正确的初始值。理论上应该没问题，但某些边缘情况可能导致不同步。

**方案**：在编辑器创建后，同步 effect 中增加防御性检查，确保 `lastEmittedRef` 与编辑器实际内容一致。

## 修改文件清单

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `apps/desktop/src-ui/src/document-types/diary/DiaryEditor.tsx` | 修改 | 移除 initialContent 状态包装 |
| `apps/desktop/src-ui/src/components/editor/MarkdownEditor.tsx` | 修改 | 增强 lastEmittedRef 同步逻辑 |


# Agent Extensions

无