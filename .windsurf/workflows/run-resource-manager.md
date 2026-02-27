---
description: 启动资源管理器（提示词模板、文档模板）
---

## 启动资源管理器

资源管理器已合并到主程序，通过 Tauri 多窗口机制在独立窗口中运行。无需独立启动。

### 1. 启动主程序（包含资源管理器）

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-Main/apps/desktop && pnpm tauri dev
```

### 2. 打开资源管理器窗口

在主程序中通过以下方式打开：
- 设置面板 →「打开模板管理器」
- 提示词模板对话框 →「管理模板」
- 文档模板选择器 →「管理模板」

资源管理器会在新窗口中打开（`manager.html`），通过 URL query params 传递 `resource-type` 和 `data-dir`。

### 3. 验证编译

// turbo
```bash
cd /Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-tauri && cargo check 2>&1 | tail -5
```

### 相关代码位置

- **Rust 命令**: `src-tauri/src/commands/resource.rs` → `open_resource_manager()` 创建 WebviewWindow
- **前端入口**: `src-ui/manager.html` + `src-ui/src/manager-main.tsx`
- **窗口组件**: `src-ui/src/manager/ManagerWindow.tsx`
- **资源配置**: `src-ui/src/manager/configs.ts`
- **编辑面板**: `src-ui/src/manager/panels/`
- **共享包**: `packages/manager-rust/`、`packages/manager-shared/`、`packages/manager-ui/`

### 注意事项

- 管理器作为主程序的第二个窗口运行，共享同一个 Tauri 后端进程
- Vite 多入口构建（`index.html` + `manager.html`），开发模式下 dev server 同时服务两个入口
- 管理器窗口已存在时会自动聚焦，不重复创建
- **提示词模板**和**文档模板**均使用 JSON 文件模式（`dataMode: 'json-file'`）
