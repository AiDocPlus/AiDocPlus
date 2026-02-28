# AiDocPlus

**AI 驱动的跨平台文档桌面编辑器**

> 🌐 官网：[AiDocPlus.com](https://AiDocPlus.com) · 📦 下载：[Releases](https://github.com/AiDocPlus/AiDocPlus/releases) · 📖 文档：[AiDocPlus.com/docs](https://AiDocPlus.com/docs)

## 项目结构

```
AiDocPlus/
├── apps/desktop/
│   ├── src-tauri/                  # Rust 后端
│   │   ├── src/
│   │   │   ├── main.rs            # 入口 + 菜单
│   │   │   ├── commands/          # IPC 命令（ai, document, export, resource, template, plugin, workspace...）
│   │   │   ├── ai.rs              # AI HTTP 请求 + SSE 流式
│   │   │   ├── template.rs        # 文档模板管理
│   │   │   ├── native_export/     # 原生导出（HTML, DOCX）
│   │   │   └── plugin.rs          # 插件 manifest 同步
│   │   └── bundled-resources/     # 内置资源（由 build-resources.sh 生成）
│   └── src-ui/                    # React 前端
│       └── src/
│           ├── components/        # UI 组件（editor, chat, file-tree, tabs, settings, templates, coding）
│           ├── plugins/           # 插件系统（SDK + 27 个插件）
│           │   ├── _framework/    # 插件 SDK（PluginHostAPI, 布局组件, UI 原语）
│           │   └── {name}/        # 各插件目录
│           ├── stores/            # Zustand 状态管理
│           ├── hooks/             # 自定义 Hooks
│           └── i18n/              # 国际化（中文/英文/日文）
├── resources/                     # 资源数据（提示词模板、文档模板、AI 服务商）
│   ├── ai-providers/
│   ├── doc-templates/
│   └── prompt-templates/
├── packages/
│   ├── shared-types/              # TypeScript 类型 + generated 文件
│   ├── mcp-server/                # MCP Server（23 个工具）
│   ├── sdk-python/                # Python SDK
│   ├── sdk-js/                    # JavaScript SDK
│   ├── manager-rust/              # 资源管理器 Rust crate
│   ├── manager-shared/            # 资源管理器共享类型
│   ├── manager-ui/                # 资源管理器 React 组件
│   └── utils/                     # 工具函数
├── scripts/
│   └── build-resources.sh         # 构建资源 → bundled-resources + generated TS
├── docs/                          # GitHub Pages 官网（aidocplus.com）
└── turbo.json
```

## 核心功能

- **AI 内容生成** — 流式生成，附件参考，1481 个提示词模板（53 分类）
- **AI 聊天** — 流式对话，联网搜索，13 个 AI 提供商，文档级 AI 服务切换
- **Markdown 编辑** — CodeMirror 6，语法高亮、折叠、自动补全
- **五面板布局** — 生成区（编辑器 + AI 侧边栏）、内容区、合并区、功能区、编程区
- **多标签页编辑** — 独立面板状态
- **版本控制** — 自动保存，预览和恢复
- **多格式导出** — Markdown、HTML、DOCX、TXT、PDF（原生 + Pandoc）
- **插件系统** — 27 个插件，自注册 + 自动发现 + manifest 驱动
- **资源管理器** — 多窗口模式（提示词模板 + 文档模板）
- **编程区** — 独立多语言代码编辑与执行环境，集成 AI 助手
- **开放 API** — HTTP API + MCP Server + Python/JS SDK，23 个工具，脚本自动化
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
| **国际化** | i18next（中文/英文/日文） |

## 开发

### 前置要求

- Node.js >= 18
- pnpm >= 9
- Rust stable
- Python 3（资源构建）

### 首次设置

```bash
# 构建资源（生成 TypeScript 类型 + bundled-resources）
bash scripts/build-resources.sh

# 安装依赖
pnpm install
```

### 开发模式

```bash
cd apps/desktop
pnpm tauri dev
```

### 发布构建

```bash
# 构建资源
bash scripts/build-resources.sh

# 构建应用
cd apps/desktop
pnpm tauri build
```

### 发布流程

```bash
# 推送 tag 触发 CI 构建
git tag v0.3.0
git push origin main v0.3.0
# Draft Release 自动创建，手动发布
```

## 开放 API 与自动化

AiDocPlus 提供完整的开放 API 系统，支持外部程序和脚本调用全部功能。

- **HTTP API** — 本地 HTTP Server（`127.0.0.1`），JSON-RPC 风格，11 个命名空间 30+ 操作
- **MCP Server** — [Model Context Protocol](https://modelcontextprotocol.io/) 服务器，23 个工具，可被 Claude Desktop / Cursor 等 AI 工具直接调用
- **Python SDK** — `pip install aidocplus`，Proxy 自动代理，零配置调用
- **JavaScript SDK** — `require('aidocplus')`，同样的 Proxy 自动代理机制
- **编程区自动化** — 编程区运行脚本时自动注入 API 连接参数，无需手动配置

```python
# Python 示例
from aidocplus import AiDocPlus
api = AiDocPlus()

docs = api.document.list(projectId="my-project")
result = api.ai.chat(
    messages=[{"role": "user", "content": "帮我润色这段文字"}],
    system_prompt="你是一位资深的中文编辑"
)
```

详见 [Python SDK](packages/sdk-python/README.md) · [JS SDK](packages/sdk-js/README.md) · [MCP Server](packages/mcp-server/README.md)

## 许可证

[MIT](LICENSE)
