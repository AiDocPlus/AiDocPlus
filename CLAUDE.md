# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Language

**始终用中文与用户对话。** Always communicate with the user in Chinese.

## Project Overview

**AiDocPlus** 是一个基于 Tauri 2.x 和 React 19 构建的跨平台 AI 文档桌面编辑器。

官网：https://aidocplus.com

### 项目类型
- **桌面应用程序**（使用 Tauri 2.x）
- **全栈应用**（Rust 后端 + React 前端）
- **Monorepo**（使用 Turborepo 管理多个包）

### 技术栈

#### 后端（Rust）
- **框架**: Tauri 2.x
- **主要功能**:
  - 文件系统操作
  - 项目和文档管理
  - 版本控制
  - 导出功能（Markdown、HTML、DOCX、TXT，原生导出 + Pandoc）
  - AI 流式聊天和内容生成（支持 OpenAI 兼容 API、智谱 GLM 等）
  - 文件导入（txt、md、docx 等）

#### 前端（React）
- **框架**: React 19
- **语言**: TypeScript 5.8+
- **状态管理**: Zustand（持久化到 localStorage）
- **UI 框架**: Radix UI + Tailwind CSS 4
- **编辑器**: CodeMirror 6（Markdown 编辑器，支持语法高亮、代码折叠、自动补全等）
- **构建工具**: Vite 7
- **国际化**: i18next

#### 项目结构
```
AiDocPlus/
├── apps/
│   └── desktop/               # 桌面应用
│       ├── src-tauri/        # Rust 后端
│       │   ├── src/
│       │   │   ├── commands/ # IPC 命令处理（ai.rs, document.rs, export.rs, import.rs, workspace.rs, template.rs, resource.rs）
│       │   │   ├── main.rs  # 入口文件
│       │   │   ├── ai.rs    # AI HTTP 请求和流式处理
│       │   │   ├── document.rs # 文档数据模型
│       │   │   ├── template.rs # 文档模板管理（用户模板 + 内置模板加载）
│       │   │   ├── native_export/ # 原生导出模块
│       │   │   ├── pandoc.rs # Pandoc 导出
│       │   │   └── ...
│       │   ├── bundled-resources/  # 内置资源数据（由 scripts/build-resources.sh 生成，.gitignore 忽略）
│       │   │   ├── ai-providers/          # AI 提供商 manifest
│       │   │   ├── document-templates/    # 文档模板分类 + PPT 主题
│       │   │   └── prompt-templates/      # 提示词模板（每个分类一个 JSON 文件，运行时动态加载）
│       │   └── Cargo.toml
│       └── src-ui/          # React 前端
│           ├── manager.html # 资源管理器窗口入口（Vite 多入口构建）
│           ├── src/
│           │   ├── manager/     # 资源管理器前端（ManagerWindow, configs, panels）
│           │   ├── components/
│           │   │   ├── editor/    # 编辑器组件（EditorPanel, MarkdownEditor, EditorToolbar 等）
│           │   │   ├── chat/      # AI 聊天面板（ChatPanel）
│           │   │   ├── coding/   # 编程区（CodingPanel, CodingFileTree, CodingAssistantPanel, codingAI）
│           │   │   ├── file-tree/ # 文件树（FileTree）
│           │   │   ├── tabs/      # 标签页系统（TabBar, EditorWorkspace）
│           │   │   ├── version/   # 版本历史（VersionHistoryPanel）
│           │   │   ├── settings/  # 设置面板
│           │   │   ├── templates/ # 提示词模板
│           │   │   └── ui/        # 基础 UI 组件
│           │   ├── plugins/    # 插件系统（SDK + 框架 + 21 个内置插件）
│           │   │   ├── _framework/    # 插件框架 SDK（PluginHostAPI, 布局组件, UI 原语, i18n）
│           │   │   ├── types.ts       # 插件接口定义（DocumentPlugin, PluginPanelProps）
│           │   │   ├── constants.ts   # 默认启用插件列表 + 分类定义
│           │   │   ├── pluginStore.ts # 插件注册表底层存储（PLUGIN_MAP + registerPlugin）
│           │   │   ├── loader.ts      # 自动发现加载器（import.meta.glob + syncManifestsToBackend）
│           │   │   ├── registry.ts    # 插件注册表（buildPluginList, getPlugins 等查询 API）
│           │   │   ├── i18n-loader.ts # 插件 i18n 注册工具
│           │   │   ├── PluginToolArea.tsx    # 插件工具区（标签栏 + 面板）
│           │   │   ├── PluginManagerPanel.tsx # 插件管理面板
│           │   │   └── {name}/        # 各插件目录（直接在仓库中开发）
│           │   ├── stores/    # 状态管理（useAppStore, useSettingsStore, useTemplatesStore）
│           │   ├── hooks/     # 自定义 Hooks（useWorkspaceAutosave）
│           │   ├── lib/       # 工具函数
│           │   └── i18n/      # 国际化
│           └── package.json
├── packages/                 # 共享包
│   ├── shared-types/        # TypeScript 类型定义
│   │   └── src/
│   │       ├── index.ts     # 类型定义 + 外部化导入
│   │       └── generated/   # 自动生成文件（由 scripts/build-resources.sh 生成，.gitignore 忽略）
│   │           ├── prompt-templates.generated.ts
│   │           ├── template-categories.generated.ts
│   │           ├── ai-providers.generated.ts
│   │           ├── ppt-themes.generated.ts
│   │           └── doc-template-categories.generated.ts
│   ├── manager-rust/        # 资源管理器 Rust crate（35+ Tauri commands）
│   ├── manager-shared/      # 资源管理器共享 TypeScript 类型
│   ├── manager-ui/          # 资源管理器共享 React 组件库（ManagerApp 等）
│   └── utils/               # 工具函数
├── turbo.json
└── pnpm-workspace.yaml
```

### 核心功能
- **多标签页编辑**：支持同时打开多个文档，每个标签页独立的面板状态
- **五大工作区**：生成区（编辑器 + AI 侧边栏）、内容区（内容生成类插件）、合并区（多来源整合）、功能区（功能类插件）、编程区（代码编辑与执行）
- **项目和文档管理**：多项目支持，文档 CRUD
- **CodeMirror Markdown 编辑**：语法高亮、代码折叠、自动补全、Markdown 预览
- **AI 内容生成**：流式生成，支持停止，附件参考，提示词模板
- **AI 聊天**：流式对话，支持停止，联网搜索
- **版本控制**：自动版本保存，版本预览和恢复
- **多格式导出**：Markdown、HTML、DOCX、TXT（原生导出 + Pandoc）
- **工作区状态保存和恢复**：标签页、面板布局、项目状态持久化
- **附件系统**：支持添加参考文件，AI 生成时自动读取附件内容
- **插件系统**：21 个内置插件，自注册 + 自动发现 + manifest 驱动
- **资源数据**：提示词模板、AI 提供商、文档模板等资源数据在 `resources/` 目录，通过 `build-resources.sh` 生成 TypeScript 文件和 bundled-resources
- **文档标签与收藏**：文档可添加自定义标签，支持收藏（星标），文件树按标签筛选/按收藏筛选，编辑器工具栏内联标签编辑器（TagEditor）
- **编程区**：独立的多语言代码编辑与执行环境（Python/JavaScript/TypeScript/HTML 等），集成文件树、AI 助手、自动化运行、pip 包管理
- **功能区**：功能类插件工作区（格式转换、OCR、代码工具等），独立于内容生成类插件

### 运行命令

#### 首次设置
```bash
# 构建资源（生成 TypeScript 类型 + bundled-resources）
bash scripts/build-resources.sh

# 安装依赖
pnpm install
```

#### 开发模式
```bash
cd apps/desktop
pnpm tauri dev
```
Tauri dev 模式下修改 Rust 文件会自动重新编译并重启后端，前端由 Vite 热更新。

#### 发布构建
```bash
bash scripts/build-resources.sh
cd apps/desktop
pnpm tauri build
```

#### 其他命令
```bash
pnpm lint       # 代码检查
pnpm clean      # 清理构建缓存
```

### 前置要求
- Node.js >= 18.0.0
- pnpm >= 9.0.0
- Rust（用于构建 Tauri 后端）

## 资源构建架构

### 资源目录结构

资源数据在仓库的 `resources/` 目录中，通过 `scripts/build-resources.sh` 构建。

| 资源目录 | 说明 | 数量 |
|------|------|----------|
| `resources/prompt-templates/` | 提示词模板（JSON 文件模式） | 982 个模板（46 分类） |
| `resources/ai-providers/` | AI 服务提供商配置 | 13 个提供商 |
| `resources/doc-templates/` | PPT 主题 + 文档模板分类 | 8 主题 + 8 分类 |

> **注**：资源管理器已合并到主程序，通过 Tauri 多窗口机制在独立窗口中运行。`manager-rust`、`manager-shared`、`manager-ui` 三个包在 `packages/` 目录。

每个资源目录的结构：
```
resources/{resource}/
├── data/                    # 资源数据
│   ├── _meta.json           # 分类定义
│   └── {category}/{id}/     # 每个资源一个目录
│       ├── manifest.json
│       └── content.md / content.json
├── scripts/
│   ├── build.sh             # 构建入口（调用 build.py）
│   └── build.py             # 扫描 data/ 生成 dist/*.generated.ts
├── dist/                    # 构建产物（.gitignore 忽略）
└── .gitignore
```

**例外：AiDocPlus-PromptTemplates 使用 JSON 文件模式**（非目录模式）：
```
AiDocPlus-PromptTemplates/
├── data/                    # 每个分类一个 JSON 文件
│   ├── academic.json        # {key, name, icon, order, templates: [{id, name, description, content, variables, order}]}
│   ├── business.json
│   └── ...                  # 共 46 个分类 JSON 文件（982 个模板）
├── scripts/
│   ├── build.py             # 读取 data/*.json 生成 dist/*.generated.ts
│   └── deploy.sh            # 复制 JSON 到 bundled-resources + generated TS 到 shared-types
└── dist/
```

### 构建流水线

**总装脚本**：`AiDocPlus-Main/scripts/assemble.sh`

按顺序执行所有仓库的 build + deploy：
```
Main → PromptTemplates → DocTemplates → AIProviders → Plugins
```

每个资源仓库的构建流程：
1. **build.py** — 扫描 `data/` 目录，生成 `dist/*.generated.ts`
2. **deploy.sh** — 将 generated TS 复制到 `AiDocPlus/packages/shared-types/src/generated/`，资源数据复制到 `AiDocPlus/apps/desktop/src-tauri/bundled-resources/`

**关键保护机制**：`AiDocPlus-Main/scripts/deploy.sh` 使用 `rsync --delete`，但排除以下路径防止其他仓库的部署产物被删除：
- `packages/shared-types/src/generated/*.generated.ts`
- `apps/desktop/src-tauri/bundled-resources`
- `apps/desktop/src-ui/src/plugins/*/`

**插件双目标部署**：`AiDocPlus-Plugins/scripts/deploy.sh` 同时部署到两个目标：
- `AiDocPlus/apps/desktop/src-ui/src/plugins/` — 构建目标（用于 `tauri build`）
- `AiDocPlus-Main/apps/desktop/src-ui/src/plugins/` — 开发目录（用于 `tauri dev`）

SDK 文件（`_framework/`、`types.ts` 等）不会被插件 deploy.sh 部署，它们由主程序维护。

### index.ts 外部化映射

`packages/shared-types/src/index.ts` 从 17,349 行精简到 928 行（-95%），大量硬编码数组替换为 generated 导入：

| 原始常量 | 生成文件 | 来源仓库 |
|----------|----------|----------|
| `BUILT_IN_TEMPLATES` | `prompt-templates.generated.ts` | AiDocPlus-PromptTemplates |
| `TEMPLATE_CATEGORIES` | `template-categories.generated.ts` | AiDocPlus-PromptTemplates |
| `AI_PROVIDERS` + `getProviderConfig` | `ai-providers.generated.ts` | AiDocPlus-AIProviders |
| `BUILT_IN_PPT_THEMES` + `DEFAULT_PPT_THEME` | `ppt-themes.generated.ts` | AiDocPlus-DocTemplates |

### Rust 端资源加载

- **template.rs**：
  - `list_templates()` — 合并用户模板（`~/AiDocPlus/Templates/`）+ bundled-resources 内置模板，用户优先、ID 去重
  - `get_template_content()` — 先查用户目录，再查 bundled-resources
  - `default_categories()` — 优先从 `bundled-resources/document-templates/_meta.json` 读取，硬编码作为 fallback
- **commands/resource.rs**：
  - `list_prompt_templates()` — 读取 `bundled-resources/prompt-templates/*.json`（分类 JSON 文件）+ `~/AiDocPlus/PromptTemplates/custom.json`（用户自定义），返回合并的 `PromptTemplateInfo` 列表
  - `list_prompt_template_categories()` — 从各分类 JSON 文件中提取分类信息（key, name, icon），按 `order` 字段排序
  - `save_custom_prompt_template()` / `delete_custom_prompt_template()` — 用户自定义模板 CRUD（操作 `~/AiDocPlus/PromptTemplates/custom.json`）
  - `export_custom_prompt_templates()` / `import_custom_prompt_templates()` — JSON 格式导入导出
  - `open_resource_manager(managerName)` — 通过 Tauri 多窗口打开资源管理器（创建新 WebviewWindow 加载 `manager.html`，通过 URL query params 传递 `resource-type` 和 `data-dir`，窗口已存在时聚焦）
  - `find_prompt_templates_dir()` — 兼容 dev/release 模式的路径查找

### 添加新资源

#### 添加新 AI 提供商
1. 在 `AiDocPlus-AIProviders/data/{category}/{id}/` 下创建 `manifest.json`
2. 运行 `bash scripts/build.sh && bash scripts/deploy.sh`

#### 添加新 PPT 主题
1. 在 `AiDocPlus-DocTemplates/data/ppt-theme/{id}/` 下创建 `manifest.json`
2. 运行 `bash scripts/build.sh && bash scripts/deploy.sh`

#### 总装验证
```bash
# 一键构建和部署所有仓库
bash AiDocPlus-Main/scripts/assemble.sh

# 验证编译
cd apps/desktop/src-ui && npx tsc --noEmit
cd apps/desktop/src-tauri && cargo check
```

## 资源管理器（多窗口模式）

### 概述

资源管理器已从独立应用（AiDocPlus-ResourceManager）**合并到主程序**，通过 Tauri 2 多窗口机制在独立窗口中运行。用户点击「打开管理器」时，主程序创建新的 WebviewWindow 加载 `manager.html`，而非启动独立进程。

### 合并后的包结构

```
AiDocPlus-Main/
├── packages/
│   ├── manager-shared/     # 共享 TypeScript 类型定义
│   ├── manager-rust/       # 共享 Rust crate（35+ Tauri commands）
│   └── manager-ui/         # 共享 React 组件库（ManagerApp 等）
├── apps/desktop/
│   ├── src-tauri/          # Rust 后端（注册 manager-rust 所有命令）
│   └── src-ui/
│       ├── index.html      # 主程序入口
│       ├── manager.html    # 管理器入口（Vite 多入口构建）
│       └── src/manager/    # 管理器前端代码
│           ├── ManagerWindow.tsx  # 管理器窗口组件
│           ├── configs.ts        # 资源类型配置
│           └── panels/           # 自定义编辑面板
```

### 工作原理

1. 用户点击「打开管理器」→ 前端调用 `invoke('open_resource_manager', { managerName })`
2. Rust `open_resource_manager` 创建 WebviewWindow，URL 为 `manager.html?resource-type=xxx&data-dir=xxx`
3. 管理器前端 `ManagerWindow.tsx` 从 URL query params 读取配置，渲染 `ManagerApp`
4. 窗口已存在时自动聚焦，不重复创建

### 资源类型

| 资源类型 | 数据目录 | 数据模式 |
|----------|---------|----------|
| 提示词模板 | `bundled-resources/prompt-templates/` | JSON 文件模式 |
| 文档模板 | `bundled-resources/document-templates/` | JSON 文件模式 |

## Architecture Notes

### AI 流式生成机制

- 前端生成唯一 `requestId`，传给后端 `chat_stream` / `generate_content_stream`
- 后端在每个 SSE chunk 事件中携带 `request_id`，前端据此过滤旧流的残留事件
- 前端使用 `streamSessionId`（模块级变量）+ `streamAborted` 标志双重保护
- `stopAiStreaming()` 同时：递增 sessionId、移除事件监听、通知后端中断 HTTP 流
- 聊天和内容生成共用同一套流式机制和停止逻辑

### 提示词模板架构（JSON 文件模式）

提示词模板采用 **JSON 文件模式**，每个分类一个 JSON 文件，替代了旧的目录结构（`_meta.json` + `{category}/{id}/manifest.json + content.md`）。

#### 数据格式

- **内置模板**：`bundled-resources/prompt-templates/*.json`，每个文件格式：
  ```json
  {"key": "academic", "name": "学术写作", "icon": "🎓", "order": 7, "templates": [{"id": "...", "name": "...", "description": "...", "content": "...", "variables": [], "order": 0}]}
  ```
- **用户自定义模板**：`~/AiDocPlus/PromptTemplates/custom.json`，格式：
  ```json
  {"templates": [{"id": "...", "name": "...", "category": "...", "description": "...", "content": "...", "variables": []}]}
  ```

#### 数据流

```
编译时（fallback）：build.py 读取 data/*.json → prompt-templates.generated.ts + template-categories.generated.ts
运行时（优先）：    Rust list_prompt_templates() → 读取 bundled-resources/*.json + custom.json → invoke → useTemplatesStore
```

#### 关键文件

| 文件 | 作用 |
|------|------|
| `src-tauri/src/commands/resource.rs` | `list_prompt_templates()` 读取分类 JSON + custom.json；`list_prompt_template_categories()` 按 order 排序；自定义模板 CRUD |
| `src-ui/src/stores/useTemplatesStore.ts` | `loadBuiltInTemplates()` + `loadBuiltInCategories()` 运行时加载；自定义模板异步保存到 Rust 后端 |
| `src-ui/src/components/templates/PromptTemplates.tsx` | 对话框打开时刷新；窗口获得焦点时自动重新加载（管理器修改后切回即时生效）；预览面板随 `allTemplates` 变化自动同步 |

#### 加载优先级

1. **运行时加载**（Rust 读取 JSON 文件）— 优先使用，确保管理器修改实时生效
2. **静态 fallback**（`BUILT_IN_TEMPLATES`）— Rust 加载失败时回退到编译时常量
3. **用户自定义模板**（Rust 后端 `custom.json`）— 始终合并

#### useTemplatesStore 数据合并策略

- `templates` = 运行时内置模板（`isBuiltIn: true`）+ 用户自定义模板（`isBuiltIn: false`，存储在 `~/AiDocPlus/PromptTemplates/custom.json`）
- `builtInCategories` = 运行时加载的分类（优先）；为空时回退到 `TEMPLATE_CATEGORIES` 静态常量
- `getAllCategories()` = `builtInCategories`（或 fallback）+ `customCategories`

### 提示词模板选择对话框（PromptTemplates.tsx）

三栏布局：分类栏 | 模板列表 | 预览区，支持搜索、分类筛选、键盘快捷键（Escape 关闭、Enter 选择）。
窗口获得焦点时自动刷新数据（从管理器切回后即时生效），预览面板通过 `useEffect([allTemplates])` 自动同步最新内容。

### 插件体系操作规范（强制）

> **⚠️ 最高优先级规则：所有 21 个插件都是外部插件，代码存放在独立项目 [AiDocPlus-Plugins](https://github.com/AiDocPlus/AiDocPlus-Plugins)（本地路径 `/Users/jdh/Code/AiDocPlus-Plugins`）。**
>
> **当用户要求创建、修改、调试任何具体插件时，必须在 AiDocPlus-Plugins 项目中操作，绝不在主程序的 `src/plugins/` 目录下直接修改插件代码。** 主程序 `src/plugins/` 下的插件目录会被 `deploy.sh` 部署覆盖，任何直接修改都会丢失。

#### 操作位置判断（强制）

| 用户需求 | 操作位置 | 说明 |
|----------|----------|------|
| 创建新插件 | `AiDocPlus-Plugins/plugins/{name}/` | 在插件项目中创建 |
| 修改某个插件功能/UI/bug | `AiDocPlus-Plugins/plugins/{name}/` | 在插件项目中修改 |
| 修改插件 SDK/框架 | 主程序 `src/plugins/_framework/` | 主程序构建者角色 |
| 修改插件加载/注册机制 | 主程序 `src/plugins/loader.ts` 等 | 主程序构建者角色 |
| 修改 PluginHostAPI | 主程序 `src/plugins/_framework/PluginHostAPI.ts` | 主程序构建者角色 |

#### 双角色原则（强制）

- **主程序构建者**：完善插件机制（`PluginHostAPI`、`PluginToolArea`、`_framework/` 等 SDK 基础设施）时，可以访问一切主程序内部实现（stores、Tauri API、i18n 等）。
- **外部插件开发者**：创建或修改具体插件（如 `email/`、`summary/` 等 `plugins/{name}/` 目录下的代码）时，**只能依据 SDK 文件**（`_framework/` 目录导出的接口），不得访问任何主程序内部模块。

**判断标准**：如果你正在编辑的文件路径在 `plugins/{name}/` 下（非 `_framework/`），你就是外部开发者角色，所有 import 必须来自 SDK 层。如果你正在编辑 `_framework/`、`PluginToolArea.tsx`、`registry.ts` 等框架文件，你是主程序构建者角色。

**绝不混淆这两种角色。**

#### 主程序 `src/plugins/` 目录说明

主程序 `src/plugins/` 只保留以下 SDK/框架文件（受 Git 版本控制）：
- `_framework/` — 插件框架 SDK
- `types.ts`、`pluginStore.ts`、`i18n-loader.ts`、`constants.ts`、`loader.ts`、`registry.ts`、`fragments.ts`
- `PluginToolArea.tsx`、`PluginManagerPanel.tsx`、`PluginMenu.tsx`

所有 `plugins/*/` 插件目录被 `.gitignore` 忽略，由 `AiDocPlus-Plugins` 项目的 `deploy.sh` 部署而来。

### 插件架构（v3 — 全外部插件体系）

应用采用**全外部插件架构**，不存在任何内部/内置插件。所有 21 个插件都是独立的外部插件，通过自注册 + 自动发现机制加载。插件分为「内容生成类」和「功能执行类」两大类，通过三层解耦设计实现松耦合。

#### 核心机制

- **自注册**：每个插件的 `index.ts` 在 import 时自动调用 `registerPlugin()` 注册到 `PLUGIN_MAP`
- **自动发现**：`loader.ts` 使用 `import.meta.glob` 自动发现所有插件目录
- **Manifest 驱动**：每个插件自带 `manifest.json`，包含 UUID、名称、分类等元数据
- **前后端同步**：前端发现的 manifest 通过 `sync_plugin_manifests` 命令幂等同步到后端磁盘

#### 两大类别

| 大类 | majorCategory | 说明 | 数据特征 |
|------|--------------|------|----------|
| **内容生成类** | `content-generation` | 基于文档内容 AI 生成新内容 | 生成结果保存在 `document.pluginData`，设置独立存储 |
| **功能执行类** | `functional` | 独立于文档的工具功能 | 所有数据独立存储（`usePluginStorageStore`），不写入文档 |

**自描述文档**：`enabledPlugins` 包含两类插件（文档声明需要哪些插件），`pluginData` 仅含生成类输出。

#### 三层解耦架构

```
┌─────────────────────────────────────────┐
│            插件代码 (Plugin)              │
│  只 import 自 Plugin SDK                 │
├─────────────────────────────────────────┤
│         Plugin SDK（公共接口层）           │  ← 稳定的 API 边界
│  usePluginHost()  布局组件  UI 原语  类型  │
├─────────────────────────────────────────┤
│         Host Implementation（主程序）      │
│  Stores / Tauri / i18n / 平台 API        │
└─────────────────────────────────────────┘
```

**Plugin SDK** = `plugins/_framework/` 目录，是插件与主程序之间的唯一接口层。新插件必须只从 `_framework/` import，禁止直接 import stores/tauri/i18n。

#### PluginHostAPI（主程序公共 API）

通过 React Context 注入（`PluginToolArea.tsx` 中的 `PluginHostProvider`），插件通过 `usePluginHost()` hook 获取：

```typescript
interface PluginHostAPI {
  apiVersion: 1;
  pluginId: string;
  content: ContentAPI;       // 内容访问（文档正文、AI 内容、合并区、插件片段）
  ai: AIAPI;                // AI 服务（chat、chatStream、isAvailable、truncateContent）
  storage: StorageAPI;       // 插件独立持久化存储（按 pluginId 隔离）
  docData: DocDataAPI | null; // 文档数据（仅内容生成类，功能类为 null）
  ui: UIAPI;                // UI 能力（状态消息、剪贴板、文件对话框、语言、主题）
  platform: PlatformAPI;    // 平台能力（invoke 代理、配置查询、i18n）
  events: EventsAPI;        // 事件订阅（文档保存、主题变化等）
}

interface AIAPI {
  chat(messages, options?): Promise<string>;     // 非流式对话
  chatStream(messages, onChunk, options?): Promise<string>;  // 流式对话（支持 AbortSignal）
  isAvailable(): boolean;
  truncateContent(text): string;
}

interface EventsAPI {
  on<E extends PluginEvent>(event: E, callback: (data: PluginEventDataMap[E]) => void): () => void;
  off<E extends PluginEvent>(event: E, callback: Function): void;
}

interface PlatformAPI {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;  // Tauri invoke 代理（白名单限制）
  getConfig<T>(section: string): T | null;  // 主程序配置只读快照（'email'|'ai'|'editor'|'general'）
  t(key: string, params?: Record<string, string | number>): string;  // i18n 翻译（自动加命名空间前缀）
}
```

插件通过 `host.platform` 访问主程序平台能力，**禁止直接 import** `@tauri-apps/*`、`@/stores/*`、`@/i18n`。

#### 命令权限白名单

`platform.invoke()` 只能调用白名单内的命令，非白名单命令会抛出错误：

```typescript
const ALLOWED_PLUGIN_COMMANDS = new Set([
  'write_binary_file',      // 写入二进制文件（导出）
  'read_file_base64',       // 读取文件为 base64（附件）
  'get_temp_dir',           // 获取临时目录
  'open_file_with_app',     // 用系统应用打开文件
  'test_smtp_connection',   // 测试 SMTP 连接
  'send_email',             // 发送邮件
  'check_pandoc',           // 检测 Pandoc 是否安装及版本
  'pandoc_export',          // 调用 Pandoc 导出文档
  'list_versions',          // 列出文档版本
  'get_version',            // 获取指定版本详情
  'wechat_http_request',    // 微信公众号通用 HTTP 请求
]);
```

#### 事件系统

插件可通过 `host.events.on()` 监听主程序事件：

| 事件 | 数据 |
|------|------|
| `document:saved` | `{ documentId: string }` |
| `document:changed` | `{ documentId: string, content: string }` |
| `document:switched` | `{ previousId: string \| null, currentId: string }` |
| `theme:changed` | `{ theme: 'light' \| 'dark' }` |
| `locale:changed` | `{ locale: string }` |
| `ai:generation-started` | `{ documentId: string, type: 'chat' \| 'content' }` |
| `ai:generation-completed` | `{ documentId: string, type: 'chat' \| 'content' }` |
| `plugin:activated` | `{ pluginId: string }` |
| `plugin:deactivated` | `{ pluginId: string }` |

#### 生命周期 Hook

插件可定义生命周期回调（在 `DocumentPlugin` 接口中）：

```typescript
interface DocumentPlugin {
  // ...
  onActivate?: () => void;        // 插件面板挂载时
  onDeactivate?: () => void;      // 插件面板卸载时
  onDocumentChange?: () => void;  // 文档切换时
}
```

#### 类型守卫

`types.ts` 提供类型守卫函数用于区分插件类别：

```typescript
import { isContentGenerationPlugin, isFunctionalPlugin } from '@/plugins/types';

if (isContentGenerationPlugin(plugin)) {
  // plugin.docData 保证非 null
}
if (isFunctionalPlugin(plugin)) {
  // plugin.hasData 始终返回 false
}
```

#### 核心设计
- **Manifest 驱动**：每个插件自带 `manifest.json`，前端通过 `sync_plugin_manifests` 同步到后端 `~/AiDocPlus/Plugins/{uuid}/manifest.json`
- **Manifest 字段**：`id`（UUID）、`name`、`version`、`description`、`icon`、`majorCategory`、`subCategory`、`tags` 等
- **自注册**：`pluginStore.ts` 提供 `registerPlugin()` API，各插件 `index.ts` 在 import 时调用
- **自动发现**：`loader.ts` 使用 `import.meta.glob` 发现所有 `plugins/*/index.ts` 和 `plugins/*/manifest.json`
- **通用数据存储**：内容生成类使用 `document.pluginData`，功能执行类使用 `usePluginStorageStore`
- **分类常量**：`PLUGIN_MAJOR_CATEGORIES`（大类）和 `PLUGIN_SUB_CATEGORIES`（子类），定义在 `plugins/constants.ts`

#### 插件接口（`plugins/types.ts`）
```typescript
interface DocumentPlugin {
  id: string;                    // 唯一标识（UUID）
  name: string;                  // 显示名称
  icon: React.ComponentType<{ className?: string }>;  // 图标组件
  description?: string;          // 描述
  majorCategory?: string;        // 大类：'content-generation' | 'functional'
  subCategory?: string;          // 子类：'ai-text' | 'visualization' | 'communication' 等
  PanelComponent: React.ComponentType<PluginPanelProps>; // 面板组件
  hasData: (doc: Document) => boolean;  // 判断文档中是否有该插件的数据
}
```

#### 后端插件管理
- **`src-tauri/src/plugin.rs`**：`PluginManifest` 结构体（含 `major_category`/`sub_category`）、manifest 同步、列表查询、启用/禁用
- **IPC 命令**：`list_plugins`（返回 manifest 列表）、`set_plugin_enabled`（切换启用状态）、`sync_plugin_manifests`（前端 manifest 同步到磁盘）
- 应用启动时调用 `ensure_plugins_dir()` 确保插件目录存在（不再硬编码任何插件）

#### 前端插件注册
- **`pluginStore.ts`**：`PLUGIN_MAP`（Map 实例）+ `registerPlugin()` API，零依赖底层模块
- **`loader.ts`**：`import.meta.glob` 自动发现所有插件 `index.ts` 和 `manifest.json`，提供 `syncManifestsToBackend()`
- **`registry.ts`**：导入 `loader`（触发自注册），提供 `buildPluginList(manifests)`、`getPlugins()`、`getPluginById(id)` 等查询 API
- 每个插件的 `index.ts` 从 `pluginStore` 导入 `registerPlugin`，在模块加载时自动注册

#### Store 集成
- **`stores/useAppStore.ts`**：`pluginManifests`、`loadPlugins()`、`updatePluginData()`
- **`stores/usePluginStorageStore.ts`**：插件独立持久化存储（Zustand persist → localStorage），按 pluginId 命名空间隔离，所有插件均可使用

#### UI 工作流程
1. 工具栏 🧩 插件按钮（toggle）→ 切换编辑器/插件视图（互斥显示）
2. 插件区域顶部为标签栏，列出所有已启用插件（两类都显示），点击切换
3. `PluginToolArea` 中的 `PluginHostProvider` 为每个插件注入 `PluginHostAPI` Context
4. 文档含插件数据时，🧩 按钮蓝色呼吸灯闪烁提示
5. **插件管理面板**：树状结构（大类 → 子类 → 插件），支持展开/折叠和搜索

#### 添加新插件

> **⚠️ 重要：插件开发已迁移到独立项目 [AiDocPlus-Plugins](https://github.com/AiDocPlus/AiDocPlus-Plugins)。**
> 创建新插件请在插件项目中操作，参考插件项目的 `CLAUDE.md` 和 `.windsurf/workflows/create-plugin.md`。
> 插件开发完成后，通过 `scripts/deploy.sh` 部署到本项目的 `src/plugins/` 目录。

简要步骤（在插件项目中操作，零改动主程序核心代码）：
1. 在插件项目 `plugins/{name}/` 下创建插件目录
2. 创建 `manifest.json`（包含 UUID、名称、分类等元数据）
3. 创建 `index.ts`：定义 `DocumentPlugin` 对象，从 `manifest.json` 读取 UUID，调用 `registerPlugin()` 自注册
4. 实现 `{Name}PluginPanel.tsx` 面板组件
5. 创建 `i18n/{zh,en}.json` 翻译文件
6. 运行 `pnpm typecheck` 验证类型
7. 运行 `pnpm deploy` 部署到主程序

> **注意**：无需修改主程序的 `registry.ts`、`constants.ts`、`plugin.rs` 或 `main.rs`。`loader.ts` 会自动发现新插件。

#### 内容生成类插件布局（PluginPanelLayout）

使用 `PluginPanelLayout` 组件（`plugins/_framework/PluginPanelLayout.tsx`），四区域布局：

```
┌──────────────────────────────────────────────────┐
│ ① 生成区（提示词框 + 构造器/生成/清空/源码编辑按钮）  │
├──────────────────────────────────────────────────┤
│ ② 工具栏区（仅放插件内容操作按钮）                  │
├──────────────────────────────────────────────────┤
│ ③ 内容区                                         │
├──────────────────────────────────────────────────┤
│ ④ 状态栏                                         │
└──────────────────────────────────────────────────┘
```

**关键规范**：提示词构造器只填充提示词不触发生成；生成完成后自动收起；状态信息在底部状态栏显示；按钮统一 `variant="outline"`；正文截断用 `truncateContent()`。

#### 功能执行类插件布局（ToolPluginLayout）

使用 `ToolPluginLayout` 组件（`plugins/_framework/ToolPluginLayout.tsx`），三区域布局：

```
┌──────────────────────────────────────────────────┐
│ ① 工具栏（标准导入按钮 + 插件自定义按钮）            │
├──────────────────────────────────────────────────┤
│ ② 功能区（children，插件完全自定义）                 │
├──────────────────────────────────────────────────┤
│ ③ 状态栏                                         │
└──────────────────────────────────────────────────┘
```

- 工具栏的「导入正文/插件/合并区」按钮由 Layout 统一实现
- AI 功能通过 `AIContentDialog` 弹窗（`_framework/AIContentDialog.tsx`）实现
- 数据通过 `usePluginHost().storage` 独立持久化，不使用 `onPluginDataChange`

#### 框架组件位置（`plugins/_framework/`）
- `PluginPanelLayout.tsx` — 内容生成类统一布局模板
- `ToolPluginLayout.tsx` — 功能执行类统一布局
- `PluginHostAPI.ts` — PluginHostAPI 类型 + Context + `usePluginHost()` hook + 工厂函数
- `AIContentDialog.tsx` — 通用 AI 内容生成弹窗
- `PluginPromptBuilderDialog.tsx` — 提示词构造器弹窗壳
- `ui.ts` — UI 原语 re-export 层（插件从此处 import UI 组件）
- `pluginUtils.ts` — 工具函数（truncateContent 等）
- `i18n/{zh,en}.json` — 框架层翻译

#### 插件 i18n

每个插件自带翻译文件（`{plugin}/i18n/{zh,en}.json`），通过 `registerPluginI18n` 注册到 i18next 命名空间（如 `plugin-summary`）。框架层翻译在 `plugins/_framework/i18n/` 中，命名空间为 `plugin-framework`。

#### 当前插件（21 个，全部为外部插件）

**内容生成类**（使用 `PluginPanelLayout`）：
- **摘要插件**（`plugins/summary/`）：AI 多风格文档摘要 — **新内容生成类插件首选参考**
- **PPT 插件**（`plugins/ppt/`）：AI 生成演示文稿，支持编辑、预览、全屏播放、PPTX 导出
- **测试题插件**（`plugins/quiz/`）：AI 生成单选、多选、判断题，支持 HTML 预览和导出
- **思维导图插件**（`plugins/mindmap/`）：AI 生成 Markdown 格式思维导图
- **翻译插件**（`plugins/translation/`）：AI 多语言翻译
- **平行翻译插件**（`plugins/parallel-translation/`）：AI 双语对照翻译
- **图表插件**（`plugins/diagram/`）：AI 生成 Mermaid 图表，支持 SVG 导出
- **统计插件**（`plugins/analytics/`）：纯前端文档统计分析（非 AI 插件）
- **教案插件**（`plugins/lessonplan/`）：AI 生成结构化教案
- **表格插件**（`plugins/table/`）：AI 生成表格，支持 Excel/CSV/JSON 导出
- **时间线插件**（`plugins/timeline/`）：AI 生成时间线
- **审阅插件**（`plugins/review/`）：AI 文档审阅和批注
- **写作统计插件**（`plugins/writing-stats/`）：写作数据统计分析

**功能执行类**（使用 `ToolPluginLayout` + `usePluginHost()`）：
- **邮件插件**（`plugins/email/`）：AI 辅助撰写邮件 + SMTP 发送 — **新功能执行类插件首选参考**
- **文档对比插件**（`plugins/diff/`）：文档版本对比
- **加密插件**（`plugins/encrypt/`）：文档加密保护
- **水印插件**（`plugins/watermark/`）：文档水印添加
- **TTS 插件**（`plugins/tts/`）：文档朗读（文字转语音）
- **Office 预览器**（`plugins/officeviewer/`）：预览 PDF/DOCX/XLSX/PPTX 文件
- **Pandoc 导出**（`plugins/pandoc/`）：通过 Pandoc 导出多种格式
- **发布插件**（`plugins/publish/`）：文档发布到外部平台

### 编程区（CodingPanel）

独立的多语言代码编辑与执行环境，与主编辑器（EditorPanel）并行的完整功能模块。

#### 文件结构

| 文件 | 作用 |
|------|------|
| `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-ui/src/components/coding/CodingPanel.tsx` | 主面板（~1900 行）：工具栏、标签栏（DnD 拖拽排序）、CodeMirror 编辑器、输出区、设置面板、命令面板、面包屑导航、运行历史 |
| `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-ui/src/components/coding/CodingFileTree.tsx` | 文件树侧边栏（~416 行）：递归树形展示、收藏标记、文件大小显示、右键菜单（新建/重命名/删除/收藏）、全局内容搜索、3 秒轮询刷新 |
| `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-ui/src/components/coding/CodingAssistantPanel.tsx` | AI 助手面板（~635 行）：快捷操作（修正/解释/优化/安装依赖/生成文档/测试）、上下文感知对话、代码块应用、Diff 预览、系统提示词编辑 |
| `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-ui/src/components/coding/codingAI.ts` | AI 自动化引擎（~549 行）：自动运行循环（生成→运行→检测→pip install→AI 修正→重试）、流式对话、代码块提取、LCS Diff |
| `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-ui/src/stores/useCodingStore.ts` | 状态管理（~448 行）：标签页、收藏、设置、运行历史、最近文件，Zustand 手动持久化（debounce 500ms → Rust `save_coding_state`） |
| `/Users/jdh/Code/AiDocPlus-Main/apps/desktop/src-tauri/src/commands/coding.rs` | Rust 后端（~428 行）：文件 CRUD、递归文件树、全局搜索、外部文件读取、pip 包管理、状态持久化 |

#### UI 布局

```
┌─────────────────────────────────────────────────────────────────┐
│ 工具栏（运行/新建/打开/保存/撤销/重做/自动换行/搜索/设置/历史/AI助手）│
├──────┬──────────────────────────────────────────┬───────────────┤
│      │ 运行历史面板（可折叠）                       │               │
│      ├──────────────────────────────────────────┤               │
│      │ 标签栏（DnD 可拖拽排序 + 右键菜单）         │               │
│ 文件 ├──────────────────────────────────────────┤  AI 助手面板   │
│  树  │ 面包屑导航                                │ （可拖拽宽度） │
│（可  ├──────────────────────────────────────────┤               │
│ 拖拽 │ CodeMirror 编辑器                         │  快捷操作按钮  │
│ 宽度）│ （多语言语法高亮 + 动态主题）               │  上下文对话    │
│      ├──────────────────────────────────────────┤  代码块应用    │
│      │ 输出区（ANSI 彩色 + Markdown 预览 + 图片） │  Diff 预览    │
├──────┴──────────────────────────────────────────┴───────────────┤
│ 状态栏（语言/行列/字符数/收藏状态）                                │
└─────────────────────────────────────────────────────────────────┘
```

#### Rust 后端命令（`commands/coding.rs`）

| 命令 | 功能 |
|------|------|
| `get_coding_scripts_dir` | 获取脚本目录 `~/AiDocPlus/CodingScripts/` |
| `list_coding_scripts` | 列出根目录下所有支持格式的脚本文件 |
| `list_coding_file_tree` | 递归列出文件树（目录在前、文件在后，按名称排序） |
| `read_coding_script` | 读取文件（支持相对路径和绝对路径） |
| `save_coding_script` | 保存文件（自动创建父目录） |
| `delete_coding_script` | 删除文件 |
| `rename_coding_script` | 重命名文件 |
| `create_coding_folder` | 创建子文件夹 |
| `delete_coding_folder` | 删除文件夹（递归） |
| `move_coding_item` | 移动/重命名文件或文件夹 |
| `search_coding_files` | 全局内容搜索（递归、不区分大小写、最多 200 条） |
| `read_external_file` | 读取外部绝对路径文件（拖放打开用） |
| `load_coding_state` / `save_coding_state` | 状态持久化（`~/AiDocPlus/CodingScripts/.coding-state.json`） |
| `pip_install` | 使用 pip 安装 Python 包 |
| `pip_list` | 列出已安装的 pip 包 |

支持的文件格式：`py, html, htm, js, jsx, ts, tsx, json, md, css, txt, xml, yaml, yml, toml, sh, sql`

#### 状态管理（`useCodingStore`）

- **不使用 Zustand persist**，通过 `invoke('save_coding_state')` 手动持久化到 Rust 端文件
- **持久化内容**：打开的标签页（id + filePath + chatMessages）、activeTabId、favorites、settings、recentFiles、pythonInfo、nodeInfo（运行时环境检测缓存）
- **debounce 500ms**：避免频繁写入
- **初始化**：`init()` 从 Rust 读取状态 → 恢复标签页（逐个 `read_coding_script` 加载代码）→ 至少保持一个默认 Python 标签页
- **设置项**（`CodingSettings`）：timeout、customPythonPath、customNodePath、fontSize、editorTheme、布局记忆（outputHeight、assistantWidth、fileTreeWidth 等）
- **运行时环境缓存**（`RuntimeCheckResult`）：`pythonInfo`、`nodeInfo`，通过 `detectPython()` / `detectNode()` action 异步检测并缓存，支持 `force` 参数强制重新检测
- **运行历史**（`RunHistoryEntry`）：最多 50 条，包含 fileName、language、exitCode、durationMs、timestamp
- **最近文件**（`recentFiles`）：最多 20 条，欢迎页显示

#### Python / Node.js 运行时检测架构

**问题**：编程区打开时需检测 Python/Node.js 解释器，同步调用子进程会阻塞 UI，尤其在 Windows 上非常慢。

**三层解决方案**：

1. **Rust 端 — async + `spawn_blocking`**：
   - `check_python` / `discover_pythons`（`commands/python.rs`）— 同步逻辑提取为 `_sync` 内部函数，Tauri 命令改为 `async`，通过 `tokio::task::spawn_blocking` 调用
   - `check_nodejs`（`commands/nodejs.rs`）— 同上
   - 效果：子进程执行在 tokio 阻塞线程池，不占用 Tauri 异步线程，UI 不卡顿

2. **前端 Store — 缓存 + 持久化**：
   - `useCodingStore` 新增 `pythonInfo` / `nodeInfo`（`RuntimeCheckResult | null`）、`pythonDetecting` / `nodeDetecting` 状态
   - `detectPython(force?)` / `detectNode(force?)` action：无缓存时异步检测，检测结果写入 Store 并持久化到磁盘
   - `init()` 从持久化状态恢复缓存，后续打开编程区时直接读取缓存，零延迟

3. **前端 CodingPanel — 缓存读取 + 懒加载**：
   - `pythonInfo` / `nodeInfo` 从 Store 读取（不再用 `useState`）
   - 组件挂载时调用 `store.detectPython()` / `store.detectNode()`，有缓存时直接跳过
   - 用户修改 `customPythonPath` / `customNodePath` 时强制重新检测
   - `discover_pythons` 懒加载：仅在用户打开 Python 解释器选择器弹窗时才触发，加载中显示 spinner

#### AI 自动化引擎（`codingAI.ts`）

**自动运行循环**（`aiAutoRun`）：
1. AI 生成代码（流式，使用 `chat_stream` 命令）
2. 保存到文件 → 运行脚本（`run_python_script` / `run_node_script`）
3. 成功 → 结束；超时 → 报错结束
4. Python `ModuleNotFoundError` → 自动 `pip_install` → 重试
5. 其他错误 → AI 自动修正代码 → 重试
6. 最多重试 3 次

**对话式 AI 助手**：
- `chatWithAssistant()` — 流式对话，供 `CodingAssistantPanel` 调用
- `buildContextMessages()` — 构建上下文感知消息（注入当前代码、运行输出、错误、选中片段）
- 三种模式：`chat`（对话）、`code`（直接输出代码）、`plan`（分步计划）
- 按语言生成不同的系统提示词（Python/JavaScript/TypeScript/HTML/Markdown/JSON）
- `QUICK_ACTIONS` — 6 个快捷操作：修正错误、解释代码、优化代码、安装依赖、生成文档、添加测试

**AI 服务**：独立使用 `codingServiceId`（可与主编辑器使用不同 AI 服务），通过 `getAIInvokeParamsForService()` 解析

#### CodingPanel 主要功能

- **多标签页**：DnD 拖拽排序（`@dnd-kit`）、右键菜单（关闭/关闭其他/关闭右侧/复制路径/重命名）
- **CodeMirror 编辑器**：`lazy` 加载、动态语言扩展（Python/JavaScript/TypeScript/HTML/CSS/JSON/Markdown/XML/SQL/Shell/YAML/TOML）、动态主题（auto/light/dark + 12 种主题）、撤销/重做
- **脚本执行**：通过 `run_python_script` / `run_node_script` 命令运行，支持传入文档内容（`AIDOCPLUS_INPUT_FILE` 环境变量）和指定输出文件
- **输出区**：ANSI 彩色终端输出、Markdown 预览切换、图片路径自动渲染（Tauri `asset.localhost` 协议）、可拖拽调整高度
- **命令面板**：`Ctrl+Shift+P` 快捷键，搜索并执行命令
- **文件操作**：新建、打开（文件对话框）、保存、另存为、拖放外部文件（Tauri `tauri://drag-drop` 事件）
- **面包屑导航**：标签栏下方显示当前文件路径段
- **运行历史**：记录每次执行结果（成功/失败、耗时、时间戳）
- **欢迎页**：无打开文件时显示快捷操作和最近文件列表
- **设置面板**：超时时间、Python/Node 路径、编辑器主题、字体大小、AI 配置等
- **面板布局记忆**：文件树宽度、输出区高度、AI 助手宽度、面板开关状态，debounce 持久化

#### CodingFileTree 功能

- **递归文件树**：调用 `list_coding_file_tree` 命令，目录在前、文件在后
- **收藏标记**：文件节点显示金色星标（`Star` 图标），右键菜单收藏/取消收藏
- **文件大小**：每个文件节点右侧显示大小（`K` / `B`）
- **右键菜单**：新建文件、新建文件夹、收藏、重命名、删除
- **全局内容搜索**：调用 `search_coding_files` 命令，debounce 300ms，显示行级匹配结果
- **3 秒轮询刷新**：自动检测文件变更
- **语言图标颜色**：根据文件扩展名显示不同颜色

#### i18n 命名空间

编程区的翻译键使用 `coding.` 前缀，已添加到 `zh/translation.json` 和 `en/translation.json`。

### 标签页隔离

- AI 流式状态通过 `aiStreamingTabId` 跟踪，确保只在对应标签页显示生成状态
- 每个标签页有独立的聊天消息（`aiMessagesByTab`）和面板状态

### 文档标签与收藏

- **数据模型**：`DocumentMetadata.tags: string[]`，标签存储在文档 metadata 中
- **内部标签**：以 `_` 开头的标签为内部标签（如 `_starred` 表示收藏），UI 中自动过滤不显示
- **Rust 后端命令**（`commands/document.rs`）：
  - `update_document_tags(projectId, documentId, tags)` — 更新文档标签
  - `list_all_tags(projectId)` — 获取项目内所有已使用标签（去重）
  - `toggle_document_starred(projectId, documentId)` — 切换收藏状态（添加/移除 `_starred` 标签）
- **前端 Store**（`useAppStore`）：`updateDocumentTags`、`loadAllTags`、`toggleDocumentStarred`、`allTags`、`documentFilterTag`、`setDocumentFilterTag`
- **UI 组件**：
  - `FileTree.tsx`：标签筛选下拉菜单（Filter 图标）、收藏星标显示、收藏切换按钮
  - `TagEditor.tsx`：内联标签编辑器（添加/删除标签，自动补全已有标签），集成在 `EditorPanel` 工具栏

### 文档保存

- `saveDocument` 会将 `attachments` 和 `pluginData` 一并传给后端保存
- 生成 AI 内容前自动保存当前文档并创建版本
- 停止生成时保留已累积的部分内容
- **插件数据保存策略**：
  - AI 生成完成后，插件通过 `onRequestSave?.()` 回调触发即时磁盘保存（`await saveDocument` + `markTabAsClean`）
  - 提示词编辑仅更新内存（`onPluginDataChange` + `markTabAsDirty`），不触发即时保存
  - 全局自动保存定时器同时检测 `tab.isDirty`，作为插件数据变更的兜底保存
- **版本历史包含 pluginData 和 enabledPlugins**，创建和恢复版本时完整保存/还原插件数据
- 生成完成后，`PluginPanelLayout` 自动收起提示词区域
- **后端 `save_document` Option 字段保护规则**：`attachments`、`pluginData`、`enabledPlugins` 等 `Option` 类型字段必须用 `if let Some` 保护，禁止无条件直接赋值（`document.field = value`），否则前端传 `undefined`（Rust 侧 `None`）时会清空磁盘上已有的数据

## Known Issues & Solutions

### 导出功能 - 始终使用文档自己的 projectId

跨项目操作时，始终使用 `document.projectId`，而不是 `currentProject.id`。

### 侧边栏文档显示 - 合并而非替换

`openProject` 加载文档时应合并到现有列表，而不是替换整个 `documents` 数组。

### DropdownMenu 透明度

Radix UI Portal 渲染的菜单需要在 `index.css` 中用 `!important` 强制不透明背景。

## Development Guidelines

### 状态管理

- 使用 Zustand，主要 store：`useAppStore`（应用状态）、`useSettingsStore`（设置，持久化）、`useTemplatesStore`（提示词模板）
- 跨项目操作时，始终使用数据对象自己的关联 ID
- 状态更新时要考虑多个项目的数据共存

### Tauri IPC

前端通过 `invoke` 调用后端命令，后端命令定义在 `src-tauri/src/commands/` 目录下。
流式事件通过 `window.emit` / `listen` 机制传递。

### 编辑器（CodeMirror 6）

- 编辑器组件：`src-ui/src/components/editor/MarkdownEditor.tsx`
- 使用 Compartment 动态切换配置（主题、拼写检查、行号等）
- 编辑器设置存储在 `useSettingsStore` 的 `editor` 分类中
- 拼写检查默认关闭（`spellCheck: false`），全局通过 `main.tsx` 中的 MutationObserver 禁用

### 样式规范

- Tailwind CSS 4 + Radix UI 组件
- 全局样式：`src-ui/src/index.css`
- CSS 变量定义主题色

### 国际化（i18n）

**重要：这是一个多语言应用程序，所有用户界面文字必须通过 i18next 进行国际化处理。**

#### 基本原则

- **禁止硬编码文字**：所有显示给用户的文字（按钮、标签、提示、错误消息、对话框标题/内容、placeholder、aria-label、title 属性等）必须使用 `t()` 或 `i18n.t()` 调用
- **翻译文件位置**：`src-ui/src/i18n/locales/{zh,en}/translation.json`
- **defaultValue 是必需的**：作为翻译 key 不存在时的回退显示
- **新增翻译 key 时**：必须同时在中文（zh）和英文（en）翻译文件中添加对应的翻译

#### React 组件中使用 `useTranslation` hook

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  // 正确 ✅
  <Button>{t('common.save', { defaultValue: '保存' })}</Button>
  <Input placeholder={t('editor.searchPlaceholder', { defaultValue: '搜索...' })} />

  // 带插值 ✅
  <span>{t('fileTree.documentCount', { defaultValue: '{{count}} 个文档', count: 5 })}</span>

  // 错误 ❌
  <Button>保存</Button>
}
```

#### 非 React 上下文中使用 `i18n.t()`

在 hooks、stores、CodeMirror 扩展、工具函数等非组件代码中，直接导入 i18n 实例：

```typescript
import i18n from '@/i18n';

// 在 Tauri 对话框中
await message(i18n.t('menu.exportSuccess'), { title: i18n.t('menu.exportProject') });

// 在 store 错误处理中
set({ error: error instanceof Error ? error.message : i18n.t('store.exportProjectFailed') });

// 在 CodeMirror 扩展中
message: i18n.t('editor.lint.emptyLinkUrl', { defaultValue: '空链接：URL 为空' }),
```

#### 翻译 key 命名空间约定

| 命名空间 | 用途 | 示例 |
|----------|------|------|
| `common` | 通用文字（保存、取消、删除等） | `common.save`, `common.loading` |
| `menu` | 菜单和对话框操作 | `menu.exportProject`, `menu.deleteConfirm` |
| `editor` | 编辑器相关 | `editor.lint.emptyLinkUrl`, `editor.clickToOpen` |
| `fileTree` | 文件树 | `fileTree.newProject`, `fileTree.noDocuments` |
| `chat` | AI 聊天面板 | `chat.send`, `chat.stopGenerating` |
| `settings` | 设置面板 | `settings.general`, `settings.templateManager.title` |
| `store` | Store 错误消息和内部标签 | `store.exportProjectFailed` |
| `tabs` | 标签页 | `tabs.close`, `tabs.closeOthers` |
| `version` | 版本历史 | `version.create`, `version.restoreToThis` |
| `templates` | 模板分类 | `templates.categoryReport` |

#### 不需要国际化的内容

- **代码注释**
- **Markdown snippet 模板**（`markdownCompletions.ts` 中的代码片段示例）
- **用户创建的文档内容**（如欢迎文档的 Markdown 正文）
- **Mermaid 图表内容**
- **console.log / console.error 调试信息**

#### 验证方法

```bash
# TypeScript 编译检查
cd apps/desktop/src-ui && npx tsc --noEmit

# 扫描残留的硬编码中文（排除注释、console、defaultValue）
python3 -c "
import re, os
cjk = re.compile(r'[\u4e00-\u9fff]')
# ... 扫描脚本
"
```

### 调试

- 生产代码中不应保留 `console.log` / `println!` 调试语句
- 保留 `console.error` / `eprintln!` 用于真正的错误处理

### 常见问题排查

1. **端口占用**：`lsof -ti:5173 | xargs kill -9`
2. **依赖问题**：删除 `node_modules` 和 `pnpm-lock.yaml`，重新 `pnpm install`
3. **构建失败**：运行 `pnpm clean` 清理缓存后重新构建
4. **Git 推送超时（使用 ClashX 代理）**：
   ```bash
   # 配置 git 使用本地代理（ClashX 默认端口 7890）
   git config --global http.proxy http://127.0.0.1:7890
   git config --global https.proxy http://127.0.0.1:7890

   # 取消代理配置
   git config --global --unset http.proxy
   git config --global --unset https.proxy
   ```

## 构建与发布

### 构建策略

**核心规则：先构建本地 macOS 版本，成功后再上传并构建 Windows 版本。**

| 平台 | 构建方式 | 目标 | 产物 |
|------|----------|------|------|
| macOS (Apple Silicon) | **本地构建** | `aarch64-apple-darwin` | `.dmg` |
| Windows x64 | **GitHub Actions 远端构建** | `x86_64-pc-windows-msvc` | `.exe` (NSIS) |

### Cargo Profile 优化

`Cargo.toml` 配置了两套 profile：

- **`[profile.dev]`**：本地测试用，`incremental = true`，`opt-level = 0`，依赖库 `opt-level = 1`（避免运行太慢）
- **`[profile.release]`**：发布用，`lto = "thin"`，`opt-level = 2`，`strip = true`，`codegen-units = 1`

**注意**：ResourceManager 的 release profile 必须与主程序保持一致（`lto = "thin"`），否则共享 target 目录时会因 LTO 配置不同导致重新编译。

本地测试构建用 `--debug` 加速：
```bash
cd apps/desktop && pnpm tauri build --debug --target aarch64-apple-darwin
```

正式发布构建（release profile）：
```bash
cd apps/desktop && pnpm tauri build --target aarch64-apple-darwin
```

### 发布新版本流程

```bash
# 1. 总装最新代码
bash AiDocPlus-Main/scripts/assemble.sh

# 2. 本地构建 macOS 版本（必须先成功）
cd AiDocPlus/apps/desktop && pnpm tauri build --target aarch64-apple-darwin

# 3. 提交推送所有仓库的修改
# （各资源仓库 + AiDocPlus 主仓库）

# 4. 触发远端 Windows 构建
gh workflow run build.yml --ref main
# 或通过 tag 触发：
git tag -f vx.x.x && git push origin vx.x.x --force

# 5. 等待构建完成后发布
gh run list --workflow=build.yml --limit 1
# Draft Release 自动创建，手动设为 Latest 发布
```

### GitHub Actions CI/CD

#### 工作流配置（`.github/workflows/build.yml`）

**仅构建 Windows x64**，macOS 由本地构建。

**触发条件**：
- 推送 `v*` 格式的 tag
- 手动触发（`workflow_dispatch`）

**CI 构建流程**：
1. Checkout 5 个仓库（AiDocPlus、Main、PromptTemplates、DocTemplates、AIProviders、Plugins）到同级目录
2. 安装工具链（Python 3、Node.js 20、pnpm 10、Rust stable）
3. 总装：AiDocPlus-Main 用纯 bash `find + cp` 替代 `rsync`（Windows 无 rsync），其余资源仓库运行各自的 `build.sh` + `deploy.sh`
4. `pnpm install` + `tauri-apps/tauri-action` 构建主程序 `x86_64-pc-windows-msvc`（资源管理器已合并，无需单独构建）
5. 自动创建 Draft Release 并上传安装包

**环境变量**：
```yaml
env:
  PYTHONIOENCODING: utf-8
  PYTHONUTF8: '1'
  CARGO_TARGET_DIR: ${{ github.workspace }}/rust-target  # 共享 Rust 编译缓存
```

**所有仓库已公开**，无需 `REPO_PAT`，使用默认 `GITHUB_TOKEN`。

### 脚本跨平台兼容性规范

所有 `build.py` 和 `deploy.sh` 脚本必须遵守以下规范，确保在 Windows CI（Git Bash）上正常运行：

1. **禁止 emoji**：Python `print()` 和 bash `echo` 中不得使用 emoji 字符（Windows `cp1252` 编码会报 `UnicodeEncodeError`），使用 `[build]`、`[ok]`、`[done]`、`[warn]`、`[skip]` 等文本标签替代
2. **禁止 `python3 -c` 内联脚本处理文件路径**：Git Bash 路径格式（`/d/a/...`）Python 无法识别，改用 `grep` + `sed` 等纯 bash 工具
3. **禁止 `rsync`**：Windows 无 rsync，CI 中 AiDocPlus-Main 部署使用 `find + cp` 替代
4. **`deploy.sh` 中的箭头符号**：使用 `->` 替代 `→`（Unicode 箭头）

### 代码跨平台规范

所有 Rust 后端和 TypeScript 前端代码必须遵守以下规范，确保在 macOS、Windows、Linux 上正确运行：

#### Rust 路径处理
1. **必须使用 `PathBuf::join()`**：禁止用 `format!("{}/{}", dir, name)` 拼接文件路径，`join()` 会自动使用平台正确的分隔符
2. **bundled-resources 查找**：优先使用 Tauri `app.path().resource_dir()`（跨平台正确解析），回退到 exe 向上遍历
3. **平台分支**：使用 `#[cfg(target_os = "...")]` 处理平台差异（如进程启动、文件打开方式）
4. **路径转字符串**：使用 `path.display()` 用于日志，`path.to_string_lossy()` 用于传递给前端

#### TypeScript 路径处理
1. **禁止硬编码 `/` 作为路径分隔符**：Windows 路径使用 `\`，正则表达式必须同时匹配 `/` 和 `\`
   - 错误：`path.replace(/\/[^/]+\/?$/, '')`
   - 正确：`path.replace(/[/\\][^/\\]+[/\\]?$/, '')`
2. **路径拼接**：检测原始路径的分隔符后拼接，或使用 Tauri 后端命令处理路径
   - 正确：`const sep = path.includes('\\') ? '\\' : '/'; \`${parentDir}${sep}${subDir}\``
3. **前端尽量不做路径操作**：复杂路径逻辑应放在 Rust 后端，前端只传递和显示路径字符串

#### 字体
1. **中文字体必须提供跨平台 fallback 链**：
   - 宋体：`"Songti SC", "SimSun", "STSong", serif`（macOS → Windows → 备选）
   - 黑体：`"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`
   - 楷体：`"Kaiti SC", "STKaiti", "KaiTi", serif`
2. **禁止单独使用中文字体名**（如 `'宋体'`），必须包含 fallback

#### 资源管理器
- 资源管理器已合并到主程序，通过 Tauri 多窗口机制在独立窗口中运行
- 不再需要独立的平台特定启动逻辑（无 `.app`、`.exe` 子进程）
- `open_resource_manager` 命令创建 WebviewWindow 加载 `manager.html`

### 重要经验教训

1. **pnpm 版本**：GitHub Actions 中使用 `pnpm/action-setup@v4` 并指定 `version: 10`
2. **重复的工作流运行**：确保 `.github/workflows/` 目录下只有一个工作流文件监听相同事件
3. **权限**：需要 `permissions: contents: write` 才能创建 Release
4. **AiDocPlus-Main deploy.sh**：`rsync --delete` 必须排除 `.github` 目录，防止 `build.yml` 被覆盖
5. **Draft Release 发布**：通过 API 从 Draft 转正式发布时，需手动设置 `make_latest=true`，否则不会标记为 Latest
