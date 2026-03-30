---
name: menu-full-audit-fix
overview: 全面修复菜单审查发现的 7 个问题：导入文件死事件、3 组快捷键冲突、新建专业文档无提示、工具菜单无处理、死代码清理。
todos:
  - id: fix-shortcuts
    content: 修改 main.rs 移除 select_line/line_join/find_replace 的快捷键解决 3 组冲突
    status: completed
  - id: fix-import-file
    content: 修改 useMenuEvents.ts 的 import_file case 直接调用 open+invoke 实现导入
    status: completed
  - id: add-import-listener
    content: 在 MarkdownEditor.tsx 添加 editor-import-content 事件监听器插入文本
    status: completed
  - id: fix-noproject-hint
    content: 修复 new_document_dialog 无项目时添加 message 提示
    status: completed
  - id: fix-tools-menu
    content: 添加 tools_quick_capture 和 tools_ebook_reader case 显示开发中提示
    status: completed
  - id: cleanup-dead-code
    content: 删除 handleProjectRename 和 handleDocRename 死代码函数
    status: completed
---

## 产品概述

修复菜单全面审查中发现的 7 个问题，涵盖死事件、快捷键冲突、无提示、无处理和死代码。

## 核心功能

- 修复"导入文件"菜单项死事件，使其正确打开文件选择并导入内容到编辑器
- 解决 3 组视图/编辑菜单快捷键冲突（⌘L、⌘J、⌘H）
- "新建专业文档"在无项目打开时给出提示，而非静默失败
- 工具菜单两个菜单项（速记窗口、电子书阅读器）添加处理分支
- 清理已不再被菜单入口调用的死代码函数

## 技术栈

- Rust (Tauri v2) 原生菜单定义
- TypeScript 前端事件处理

## 实现方案

### 问题 #1: import_file 死事件

**根因**: `useMenuEvents.ts` 分发 `menu-import-file` 事件，但无人监听。编辑器工具栏 `ImportButton` 有完整导入逻辑但绑定在组件内部。

**修复方案**: 在 `useMenuEvents.ts` 的 `import_file` case 中直接实现导入逻辑（与 EditorToolbar.tsx 中的 `handleImportFromFile` 对齐）：

1. 调用 `open()` 文件选择对话框
2. 调用 `invoke('import_file', { path })` 读取内容
3. 分发 `editor-menu-action` 事件，detail 为 `{ action: 'import-content', content }` 由 MarkdownEditor 处理插入
4. 检查当前项目是否存在，不存在时给出提示

由于 `insertText` 是 EditorToolbar 的局部函数无法直接复用，改用事件转发：分发一个带 content 的事件让编辑器接收。需要在 MarkdownEditor 中添加对应的 `editor-import-content` 事件监听器，调用编辑器的 `dispatch` 插入文本。

### 问题 #2-4: 快捷键冲突

**修复方案**: 编辑菜单中不常用的高级功能移除快捷键，保留视图菜单的快捷键（使用频率更高）：

- `select_line`: 移除 ⌘L（用户很少从菜单选择行）
- `line_join`: 移除 ⌘J（合并行可通过其他方式操作）
- `find_replace`: 移除 ⌘H（查找替换已有 Ctrl+Shift+F 等其他入口；⌘H 在 macOS 原生语义为"隐藏窗口"也不适合绑定给应用功能）

修改 `main.rs` 中对应 `MenuItem::with_id` 的快捷键参数为 `None`。

### 问题 #5: 新建专业文档无提示

**修复**: 在 `useMenuEvents.ts` 的 `new_document_dialog` case 中，无项目时添加 `message()` 提示，复用已有的 `i18n.t('menu.openProjectFirst')`。

### 问题 #6: 工具菜单无处理

**修复**: 在 `useMenuEvents.ts` 添加 `tools_quick_capture` 和 `tools_ebook_reader` case，显示"功能开发中"提示。

### 问题 #7: 死代码清理

**修复**: 删除 `useMenuEvents.ts` 中不再被调用的 `handleProjectRename` 和 `handleDocRename` 两个函数（第 301-367 行）。同时清理顶部不再需要的 `open` import（如 import_file 不再需要分发事件则不需要，但 #1 修复会用到 `open`）。

## 目录结构

```
apps/desktop/
├── src-tauri/src/
│   └── main.rs                  # [MODIFY] 移除 3 个编辑菜单快捷键
├── src-ui/src/
│   ├── hooks/
│   │   └── useMenuEvents.ts     # [MODIFY] 修复 #1 import_file、#5 无提示、#6 工具菜单、#7 死代码
│   └── components/editor/
│       └── MarkdownEditor.tsx   # [MODIFY] 新增 editor-import-content 事件监听器
```

## 实现说明

- 快捷键冲突修复优先保留视图菜单（用户更频繁使用），编辑菜单高级功能改为仅通过菜单点击访问
- `import_file` 修复通过新增 `editor-import-content` 事件通道实现，与编辑器解耦
- 删除死代码前确认没有其他调用入口（右键菜单等也使用 FileTree 行内重命名）