---
name: fix-translation-ai-output
overview: 修复翻译文档类型中"一键翻译"和"翻译按钮"无法正常输出AI内容的核心问题：TranslationWorkspace 没有监听 translation-target-updated 事件，导致 AI 翻译结果写入 store 后界面不更新；同时 onAIResponse 对所有 AI 回复无条件写入译文，会覆盖非翻译操作的结果。
todos:
  - id: fix-event-listener
    content: 在TranslationWorkspace.tsx添加translation-target-updated事件监听，同步trans state
    status: completed
  - id: extend-onairesponse
    content: 扩展DocTypeAIChatBase的onAIResponse回调签名，传递触发消息的label作为meta
    status: completed
    dependencies:
      - fix-event-listener
  - id: filter-translate-ops
    content: TranslationAISidebar的onAIResponse根据meta.label判断操作类型，仅翻译操作写入译文
    status: completed
    dependencies:
      - extend-onairesponse
---

## 问题概述

翻译文档类型的"一键翻译"和侧栏"翻译"按钮无法正常输出AI内容到译文编辑区。事件通信链存在断裂：侧栏AI完成后通过`translation-target-updated`事件通知Workspace，但Workspace没有监听该事件，导致`trans` state不同步，译文编辑区不显示AI翻译结果。

## 核心问题

1. **事件链断裂（致命）**：`TranslationAISidebar`的`onAIResponse`回调和`handleInsertToTarget`都派发`translation-target-updated`事件，但`TranslationWorkspace`没有监听此事件。AI结果已通过`host.doc.updateInMemory`写入store，但Workspace的`trans` state不更新，编辑器界面不显示译文
2. **onAIResponse无操作类型区分（重要）**：每次AI回复完成都触发`onAIResponse`，不论用户问的是翻译问题还是普通问题，结果都会被无条件写入译文target字段
3. **doc.content变化未同步（次要）**：`TranslationAISidebar`监听了`doc.content`变化来更新侧栏统计，但`TranslationWorkspace`仅在`doc.id`变化时重新加载，不响应content变化

## 技术方案

- 现有技术栈：React + TypeScript + Tauri + Zustand
- 修复方式：在已有事件通信架构基础上补齐断裂的事件链，不引入新通信机制

## 实现方案

### 修复1：TranslationWorkspace监听translation-target-updated事件（核心修复）

在`TranslationWorkspace.tsx`中添加useEffect监听`translation-target-updated`事件，收到事件后重新从`host.doc.getDocument()`读取最新content，解析后更新`trans` state：

```
TranslationAISidebar.onAIResponse 
  → host.doc.updateInMemory (更新store) 
  → dispatchEvent('translation-target-updated') 
  → TranslationWorkspace useEffect (监听事件) 
  → setTrans(parsed) (更新本地state) 
  → 编辑器界面显示译文
```

### 修复2：onAIResponse根据label区分操作类型

`sendDocTypeAIMessage`已支持`label`字段，一键翻译传入`label: '一键翻译 中文→英文'`，侧栏翻译传入`label: '翻译 中文→英文'`。`DocTypeAIChatBase`中`doctype-ai-send`事件处理将label存入消息：`[一键翻译 中文→英文]`。

方案：将`onAIResponse`回调签名扩展为`onAIResponse?(content: string, meta?: { label?: string })`，在`callAI`完成时传入触发消息的label。TranslationAISidebar中判断label是否包含"翻译"关键字再决定是否写入译文。

### 修复3：DocTypeAIChatBase传递meta信息

在`doctype-ai-send`事件处理中，将label存入ref；在`callAI`完成调用`onAIResponse`时传入label作为meta参数。

## 实现注意事项

- 修复1是最小且最安全的改动，只需添加一个useEffect（约10行）
- 修复2需要对`DocTypeAIChatBase`的`onAIResponse`签名做向后兼容修改（新增可选meta参数）
- `host.doc.updateInMemory`调用useAppStore的`updateDocumentInMemory`，会更新文档对象的content字段，getDocument()能拿到最新值
- 使用`parseTranslationContent(host.doc.getDocument().content || '')`重新解析是安全的，因为此时content已被侧栏更新

## 目录结构

```
apps/desktop/src-ui/src/document-types/translation/
├── TranslationWorkspace.tsx    # [MODIFY] 添加 translation-target-updated 事件监听
└── TranslationAISidebar.tsx    # [MODIFY] onAIResponse 增加 label 判断，非翻译操作不写入译文

apps/desktop/src-ui/src/document-types/_shared/
├── DocTypeAIChatBase.tsx       # [MODIFY] onAIResponse 签名扩展，callAI 传递 meta 信息
```

## Agent Extensions

- **code-explorer**
- Purpose: 深入探索翻译文档类型AI功能的完整代码链路，定位事件通信断裂点
- Expected outcome: 确认3个关键问题的根本原因，提供精确的代码行号和修复位置