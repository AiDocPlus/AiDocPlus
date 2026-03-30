---
name: fix-create-project-dialog
overview: 交换新建项目的两个入口行为（系统菜单→弹对话框，工具栏按钮→直接创建），并将 CreateProjectDialog 从手写遮罩改为使用 shadcn/ui Dialog 组件，统一对话框样式。
todos:
  - id: swap-entry-behaviors
    content: 交换 FileTree.tsx 中系统菜单和工具栏按钮的新建项目触发逻辑
    status: completed
  - id: auto-open-project
    content: FileTree.tsx 行内创建项目后自动打开该项目
    status: completed
    dependencies:
      - swap-entry-behaviors
  - id: fix-dialog-style
    content: 将 CreateProjectDialog.tsx 改用 shadcn/ui Dialog 组件，修复遮罩样式
    status: completed
---

## 产品概述

修复"新建项目"功能的两个问题：(1) 入口行为反了——系统菜单应弹出对话框，工具栏按钮应直接创建；(2) CreateProjectDialog 使用手写遮罩导致样式混乱，需统一为项目标准的 shadcn/ui Dialog 组件。

## 核心功能

- **交换入口行为**：系统菜单 `Cmd+Shift+N` → 弹出 CreateProjectDialog；文件树工具栏 `+` 按钮 → 直接在文件树顶部展开行内输入框快速创建
- **修复对话框样式**：将 CreateProjectDialog 从手写 `fixed inset-0 bg-black/50` 遮罩改为使用项目标准的 shadcn/ui `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` 组件（与 AboutDialog、ShortcutsDialog 等保持一致）
- **补充直接创建后的自动打开项目**：行内创建项目后自动打开该项目，保持与对话框创建的行为一致性

## 技术栈

- 前端框架：React + TypeScript + Tailwind CSS
- UI 组件库：shadcn/ui（基于 Radix UI）
- 状态管理：Zustand（useAppStore）
- 桌面框架：Tauri（系统菜单事件）

## 实现方案

### 问题 1：交换入口行为（FileTree.tsx）

**修改逻辑**：

- **第 395 行**（`menu-new-project` 事件监听）：将 `setIsCreating(true)` 改为 `window.dispatchEvent(new CustomEvent('create-project-dialog'))`，使系统菜单触发弹出对话框
- **第 688 行**（工具栏 `+` 按钮 onClick）：将 `window.dispatchEvent(new CustomEvent('create-project-dialog'))` 改为 `setIsCreating(true)`，使工具栏按钮触发行内直接创建

事件流变化：

```
系统菜单 → menu-new-project → create-project-dialog → MainLayout setCreateProjectOpen(true) → 弹出对话框
工具栏按钮 → setIsCreating(true) → 行内输入框直接创建
```

### 问题 2：修复对话框样式（CreateProjectDialog.tsx）

当前实现使用手写 `fixed inset-0 z-50 bg-black/50` 作为遮罩层（第 46 行），`DialogPrimitive.Overlay` 的 Portal 机制缺失导致遮罩可能与应用层级冲突。

**修改方案**：参照 AboutDialog.tsx、ShortcutsDialog.tsx 等已有对话框的标准写法，改用 shadcn/ui Dialog 组件：

- 引入 `Dialog, DialogContent, DialogHeader, DialogTitle` 替代手写遮罩
- 使用 `<Dialog open={open} onOpenChange={...}>` + `<DialogContent>` + `<DialogHeader>` + `<DialogTitle>` 结构
- 移除手写的遮罩层、标题栏的关闭按钮（DialogContent 内置）、手动 stopPropagation 阻止冒泡逻辑
- 移除 `X` 图标的 import（DialogContent 内置关闭按钮）
- 保留所有业务内容不变（文档类型选择、项目名称、项目描述、底部按钮）

### 问题 3：行内创建后自动打开项目（FileTree.tsx）

当前 `handleCreateProject`（第 208-222 行）仅调用 `createProject()` 但不打开项目。需要在创建成功后自动调用 `openProject(project.id)`，保持与对话框创建的行为一致性。

### MainLayout.tsx onCreate 回调

MainLayout.tsx 第 292-318 行的 `onCreate` 回调无需修改，因为对话框创建已经具备自动打开项目 + 自动创建首个文档的能力，这部分逻辑完整正确。

## 实现注意事项

- CreateProjectDialog 改用 shadcn Dialog 后，`onOpenChange` 会处理 Escape 键关闭和点击遮罩关闭，无需手动 `handleKeyDown` 中的 Escape 分支和遮罩层 onClick
- DialogContent 通过 Portal 渲染，确保不会被父组件的 CSS 层级影响
- `handleCreateProject` 中需要 await `openProject()` 的结果，确保项目切换完成

## 目录结构

```
apps/desktop/src-ui/src/components/
├── dialogs/
│   ├── CreateProjectDialog.tsx  # [MODIFY] 改用 shadcn Dialog 组件，修复遮罩样式
│   └── ui/dialog.tsx            # [参考] shadcn Dialog 组件定义（无需修改）
├── file-tree/
│   └── FileTree.tsx             # [MODIFY] 交换入口行为 + 补充自动打开项目
└── layout/
    └── MainLayout.tsx           # [无需修改] CreateProjectDialog 的使用方式和 onCreate 回调保持不变
```