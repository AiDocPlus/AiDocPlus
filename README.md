# AiDocPlus-Main

**AiDocPlus 主程序源码仓库** — AI 驱动的跨平台文档桌面编辑器

> 🌐 官网：[AiDocPlus.com](https://AiDocPlus.com) · 📦 下载：[Releases](https://github.com/AiDocPlus/AiDocPlus/releases) · 📖 文档：[AiDocPlus.com/docs](https://AiDocPlus.com/docs)

## 项目结构

```
AiDocPlus-Main/
├── apps/desktop/
│   ├── src-tauri/                  # Rust 后端
│   │   ├── src/
│   │   │   ├── main.rs            # 入口 + 菜单
│   │   │   ├── commands/          # IPC 命令（ai, document, export, resource, template, plugin, workspace...）
│   │   │   ├── ai.rs              # AI HTTP 请求 + SSE 流式
│   │   │   ├── template.rs        # 文档模板管理
│   │   │   ├── native_export/     # 原生导出（HTML, DOCX）
│   │   │   └── plugin.rs          # 插件 manifest 同步
│   │   └── bundled-resources/     # 内置资源（由资源仓库 deploy.sh 部署）
│   └── src-ui/                    # React 前端
│       └── src/
│           ├── components/        # UI 组件（editor, chat, file-tree, tabs, settings, templates, coding）
│           ├── plugins/           # 插件系统（SDK + 21 个外部插件）
│           │   ├── _framework/    # 插件 SDK（PluginHostAPI, 布局组件, UI 原语）
│           │   └── {name}/        # 各插件目录（由 AiDocPlus-Plugins 部署）
│           ├── stores/            # Zustand 状态管理
│           ├── hooks/             # 自定义 Hooks
│           └── i18n/              # 国际化（中文/英文）
├── packages/
│   ├── shared-types/              # TypeScript 类型 + generated 文件
│   └── utils/                     # 工具函数
├── scripts/
│   ├── assemble.sh                # 一键总装所有资源仓库
│   └── deploy.sh                  # 部署源码到构建目标
└── turbo.json
```

## 核心功能

- **AI 内容生成** — 流式生成，附件参考，982 个提示词模板（46 分类）
- **AI 聊天** — 流式对话，联网搜索，13 个 AI 提供商
- **Markdown 编辑** — CodeMirror 6，语法高亮、折叠、自动补全
- **五面板布局** — 生成区（编辑器 + AI 侧边栏）、内容区、合并区、功能区、编程区
- **多标签页编辑** — 独立面板状态
- **版本控制** — 自动保存，预览和恢复
- **多格式导出** — Markdown、HTML、DOCX、TXT、PDF（原生 + Pandoc）
- **插件系统** — 21 个外部插件，自注册 + 自动发现 + manifest 驱动
- **资源管理器** — 统一 Tauri 桌面管理器（提示词模板 + 文档模板）
- **编程区** — 独立多语言代码编辑与执行环境，集成 AI 助手
- **文档标签与收藏** — 自定义标签，星标收藏，按标签筛选
- **工作区持久化** — 标签页、面板布局、项目状态自动保存恢复

## 技术栈

| 层 | 技术 |
|----|------|
| **桌面框架** | Tauri 2.x |
| **前端** | React 19 + TypeScript 5.9+ |
| **状态管理** | Zustand |
| **UI** | Radix UI + Tailwind CSS 4 |
| **编辑器** | CodeMirror 6 |
| **构建** | Vite 7 + Turborepo + pnpm |
| **后端** | Rust（文件系统、AI 流式、导出、TTS） |
| **国际化** | i18next（中文/英文） |

## 多仓库架构

| 仓库 | 说明 | 数量 |
|------|------|------|
| **AiDocPlus-Main**（本仓库） | 主程序源码 | — |
| [AiDocPlus-PromptTemplates](https://github.com/AiDocPlus/AiDocPlus-PromptTemplates) | 提示词模板（JSON 文件模式） | 982（46 分类） |
| [AiDocPlus-AIProviders](https://github.com/AiDocPlus/AiDocPlus-AIProviders) | AI 提供商配置 | 13 |
| [AiDocPlus-DocTemplates](https://github.com/AiDocPlus/AiDocPlus-DocTemplates) | PPT 主题 + 文档模板 | 8 + 8 |
| [AiDocPlus-Plugins](https://github.com/AiDocPlus/AiDocPlus-Plugins) | 外部插件 | 21 |
| [AiDocPlus-ResourceManager](https://github.com/AiDocPlus/AiDocPlus-ResourceManager) | 统一资源管理器 | 1 |
| [AiDocPlus](https://github.com/AiDocPlus/AiDocPlus) | 构建目标 + 发布 | — |

每个资源仓库包含 `scripts/build.py`（生成 TypeScript）和 `scripts/deploy.sh`（部署到构建目标）。

## 开发

### 前置要求

- Node.js >= 18
- pnpm >= 9
- Rust stable

### 开发模式

```bash
# 直接在源码目录运行（推荐，利用增量编译缓存）
cd apps/desktop
pnpm tauri dev
```

首次运行需创建符号链接引用外部资源：
```bash
# generated TS 文件
ln -s /path/to/AiDocPlus/packages/shared-types/src/generated \
      /path/to/AiDocPlus-Main/packages/shared-types/src/generated

# bundled-resources
ln -s /path/to/AiDocPlus/apps/desktop/src-tauri/bundled-resources \
      /path/to/AiDocPlus-Main/apps/desktop/src-tauri/bundled-resources
```

### 总装与构建

```bash
# 一键总装所有资源仓库到构建目标
bash scripts/assemble.sh

# 在构建目标验证完整构建
cd /path/to/AiDocPlus/apps/desktop
pnpm tauri build
```

### 发布流程

```bash
# 1. 总装
bash scripts/assemble.sh

# 2. 本地构建 macOS
cd AiDocPlus/apps/desktop && pnpm tauri build --target aarch64-apple-darwin

# 3. 推送 tag 触发 Windows CI 构建
cd AiDocPlus && git tag v0.3.0 && git push origin main v0.3.0

# 4. Draft Release 自动创建，手动发布
```

## 许可证

[MIT](LICENSE)
