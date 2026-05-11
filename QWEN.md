# QWEN.md — AiDocPlus 项目指南

**始终用中文与用户对话。界面文字、提示信息全部使用中文。**

---

## 项目概览

**AiDocPlus** 是一个跨平台 AI 文档桌面编辑器（官网：https://aidocplus.com）。基于 Tauri 2.x 构建，Rust 后端 + React 前端，采用 pnpm monorepo + Turborepo 管理。

当前版本：**0.3.15**

### 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri 2.x |
| 后端 | Rust（文件系统、AI 流式、导出、TTS、邮件、IMAP） |
| 前端 | React 19 + TypeScript 5.9 |
| 状态管理 | Zustand 5 |
| UI | Radix UI + Tailwind CSS 4 |
| 富文本编辑器 | TipTap 3.21 + CodeMirror 6 |
| 构建 | Vite 8 + Turborepo + pnpm 10 |
| 数据库 | SQLite（rusqlite bundled） |
| HTTP Server | Axum（内置 API server） |
| 国际化 | i18next（中文/英文） |

### 核心功能

- AI 内容生成与聊天（流式输出、联网搜索、多模态图片理解、深度思考 CoT）
- 多标签页编辑（五面板布局：生成区/内容区/合并区/功能区/编程区）
- 11 种文档类型（通用、学习体会、长篇小说、翻译、日记、散文、股票研究、仿写、计算文档、任务清单、大纲）
- 28 个内置插件（manifest 驱动、自注册、自动发现）
- 多格式导出（Markdown/HTML/DOCX/TXT/PDF，原生 + Pandoc）
- 版本控制（自动保存、预览恢复）
- 资源管理器（多窗口，提示词模板 + 文档模板 + AI 提供商）
- 编程区（多语言编辑执行、AI 辅助）
- 开放 API（HTTP JSON-RPC + MCP Server 72 工具 + Python/JS SDK）
- 邮件客户端（IMAP/SMTP，20 种服务商预设）
- 电子书阅读器（PDF/EPUB）
- IM Bot（飞书/钉钉/企微/QQ 桥接）

---

## 目录结构

```
AiDocPlus/
├── apps/
│   ├── desktop/                    # 主桌面应用
│   │   ├── src-tauri/              #   Rust 后端（Tauri v2）
│   │   │   ├── src/
│   │   │   │   ├── main.rs         #     入口 + 菜单
│   │   │   │   ├── commands/       #     30+ IPC 命令文件
│   │   │   │   ├── native_export/  #     原生导出（DOCX/HTML/PDF/TXT）
│   │   │   │   ├── sync/           #     同步模块
│   │   │   │   ├── ai.rs           #     AI HTTP + SSE 流式
│   │   │   │   ├── api_server.rs   #     Axum HTTP API server
│   │   │   │   ├── database.rs     #     SQLite 数据库
│   │   │   │   └── ...             #     document/template/plugin/config/security 等
│   │   │   └── bundled-resources/  #     构建产物（.gitignore）
│   │   └── src-ui/                 #   React 前端
│   │       ├── index.html          #     主窗口入口
│   │       ├── manager.html        #     资源管理器窗口
│   │       ├── help.html           #     帮助窗口
│   │       ├── reader.html         #     电子书阅读器窗口
│   │       ├── mail-client.html    #     邮件客户端窗口
│   │       ├── scratchpad.html     #     速记窗口
│   │       └── src/
│   │           ├── components/     #     UI 组件（chat/coding/editor/file-tree/tabs/settings...）
│   │           ├── plugins/        #     插件系统（28 插件 + _framework SDK）
│   │           ├── stores/         #     Zustand 状态管理（20+ 文件）
│   │           ├── doctype-sdk/    #     文档类型 SDK（registry/host/types/hooks）
│   │           ├── document-types/ #     11 种文档类型实现
│   │           ├── i18n/           #     国际化（zh/en）
│   │           ├── ai-engine/      #     AI 引擎（skills + prompt-store）
│   │           ├── reader/         #     电子书阅读器
│   │           ├── mail-client/    #     邮件客户端
│   │           └── ...             #     api/help/hooks/lib/utils/types...
│   └── im-bot/                     # IM Bot 桥接服务（飞书/钉钉/企微/QQ）
├── packages/
│   ├── shared-types/               # TypeScript 共享类型（1100+ 行核心类型定义）
│   ├── mcp-server/                 # MCP Server（72 工具，含 49 个 Tushare 股票接口）
│   ├── sdk-python/                 # Python SDK（pip install aidocplus）
│   ├── sdk-js/                     # JavaScript SDK
│   ├── manager-rust/               # 资源管理器 Rust crate（35+ Tauri 命令）
│   ├── manager-shared/             # 资源管理器共享 TypeScript 类型
│   ├── manager-ui/                 # 资源管理器 UI 组件（WIP）
│   ├── utils/                      # 通用工具函数（ID/日期/字符串/文件/异步）
│   ├── ai-engine/                  # AI 引擎（WIP）
│   ├── document-converter/         # 文档转换器（WIP）
│   ├── plugin-system/              # 插件系统占位（实际代码在 src-ui/src/plugins/）
│   ├── version-control/            # 版本控制（WIP）
│   └── ui/                         # UI 组件库（WIP）
├── resources/                      # 资源源数据
│   ├── ai-providers/               #   13 个 AI 提供商配置
│   ├── doc-templates/              #   8 类文档模板
│   └── prompt-templates/           #   1481 个提示词模板 / 53 分类
├── scripts/                        # 构建与发布脚本
├── docs/                           # GitHub Pages 官网（Jekyll）
├── tests/                          # E2E API 测试（Python）
└── update/                         # Tauri 自动更新配置
```

---

## 常用命令

### 首次初始化

```bash
bash scripts/build-resources.sh    # 生成 bundled-resources + shared-types/generated/
pnpm install
```

### 开发

```bash
cd apps/desktop && pnpm tauri dev   # 启动开发模式（Rust 热重编译 + Vite HMR）
```

### 编译检查

```bash
cd apps/desktop/src-ui && npx tsc --noEmit    # 前端类型检查
cd apps/desktop/src-tauri && cargo check       # Rust 编译检查
cd apps/desktop/src-tauri && cargo clippy      # Rust lint
```

### 测试

```bash
cd apps/desktop/src-ui && npx vitest           # 前端单元测试
cd apps/desktop/src-tauri && cargo test         # Rust 单元测试
pnpm test                                       # Turborepo 全量测试
```

### Lint

```bash
cd apps/desktop/src-ui && npx eslint src/       # 前端 lint
```

### 发布构建

```bash
# macOS Apple Silicon
cd apps/desktop && pnpm tauri build --target aarch64-apple-darwin

# Windows（CI 自动构建）
# 推送 v* tag 触发 GitHub Actions
```

### 常见问题

```bash
# 端口占用
lsof -ti:1420 | xargs kill -9

# 依赖问题
rm -rf node_modules && pnpm install

# Git 推送超时（代理）
git config --global http.proxy http://127.0.0.1:7890
```

---

## 开发规范

### 路径别名

前端代码使用 `@/` 作为 `src/` 的别名（Vite + tsconfig 配置）：
```typescript
import { useAppStore } from '@/stores/useAppStore';
import i18n from '@/i18n';
```

### 状态管理

- **主 Store**：`useAppStore`（应用状态，按功能拆分为 20+ helpers 文件）
- **设置**：`useSettingsStore`（持久化）
- **模板**：`useTemplatesStore`
- **编程区**：`useCodingStore`（手动 invoke 持久化，不用 Zustand persist）
- **插件存储**：`usePluginStorageStore`（按 pluginId 隔离）
- **对话**：`useConversationsStore`

跨项目操作始终使用数据对象自己的关联 ID，不用 `currentProject.id`。

### 国际化（i18n）

**所有用户界面文字必须通过 i18next 国际化，禁止硬编码。**

```tsx
// React 组件
const { t } = useTranslation();
<Button>{t('common.save', { defaultValue: '保存' })}</Button>

// 非组件（stores/hooks 等）
import i18n from '@/i18n';
i18n.t('store.exportFailed', { defaultValue: '导出失败' })
```

翻译文件：`src-ui/src/i18n/locales/{zh,en}/translation.json`

**新增 key 时必须同时更新 zh 和 en 两个文件，defaultValue 必填。**

### TypeScript 规范

- 严格模式（`strict: true`）
- `noUnusedLocals` + `noUnusedParameters`
- 目标 ES2022，模块解析 bundler
- 路径别名：`@/*` → `./src/*`

### 调试

- 生产代码不保留 `console.log` / `println!`，保留 `console.error` / `eprintln!`

### 对话框

- 对话框必须不透明，顶部和高度固定

### AI 服务选择器

- 使用 `<select>` 下拉菜单，不用循环切换按钮

### 导出功能

- 所有文档类型导出必须包含 DOCX 和 PDF 格式

### Vite 多入口

前端有 6 个 HTML 入口（main/manager/help/reader/mail-client/scratchpad），Vite 构建时通过 `rollupOptions.input` 配置。Bundle 分包策略在 `vite.config.ts` 的 `manualChunks` 中定义。

---

## Rust 后端规范

### 路径处理

1. 必须用 `PathBuf::join()`，禁止 `format!("{}/{}", ...)` 拼接路径
2. bundled-resources 查找：优先 `app.path().resource_dir()`
3. 平台差异用 `#[cfg(target_os = "...")]`

### 文档保存

- `save_document`：`Option` 字段（attachments/pluginData/enabledPlugins）**必须用 `if let Some` 保护**
- 禁止无条件赋值（前端传 `undefined` → Rust `None` → 清空磁盘数据）

### 线程安全

- 所有 async 闭包使用 `AtomicBool`/`Mutex` 替代 `Cell`/`RefCell`

### Cargo Profile

- `[profile.dev]`：`incremental=true`，`opt-level=0`
- `[profile.release]`：`lto="thin"`，`opt-level=2`，`strip=true`

---

## 插件系统

### 28 个内置插件

**内容生成类（10）**：table⭐、mindmap⭐、mermaid、translation、parallel-translation、poster、image、glossary、citation、extract

**功能执行类（18）**：email⭐、summary、ppt、quiz、lessonplan、timeline、review、writing-stats、analytics、flashcard、compliance、diff、encrypt、watermark、tts、officeviewer、pandoc、publish

### 操作位置规则

| 场景 | 位置 |
|---|---|
| 创建/修改具体插件 | `src/plugins/{name}/` |
| 修改插件 SDK/框架 | `src/plugins/_framework/` |
| 修改加载/注册机制 | `src/plugins/loader.ts` 等 |

插件代码禁止直接 import `@tauri-apps/*`、`@/stores/*`、`@/i18n`。

### PluginHostAPI

通过 React Context 注入，插件使用 `usePluginHost()` 获取。提供 `content`、`ai`、`storage`、`docData`、`ui`、`platform`、`events` 7 个命名空间。

### invoke 白名单

`platform.invoke()` 限于：`write_binary_file`、`read_file_base64`、`get_temp_dir`、`open_file_with_app`、`test_smtp_connection`、`send_email`、`check_pandoc`、`pandoc_export`、`list_versions`、`get_version`、`wechat_http_request`

### 新建插件流程

1. 创建 `plugins/{name}/manifest.json`（UUID、`majorCategory`、`subCategory`）
2. `index.ts`：定义 `DocumentPlugin`，调用 `registerPlugin()` 自注册
3. 实现面板组件（对照标杆插件 `table/` 或 `email/`）
4. `i18n/{zh,en}.json` 翻译

`loader.ts` 通过 `import.meta.glob` 自动发现，无需修改核心文件。

---

## 文档类型系统（11 种）

| 类型 ID | 名称 | 布局 | 编辑器 / 工作区 |
|---|---|---|---|
| `normal` | 通用文档 | standard | EditorPanel + ChatPanel |
| `study-notes` | 学习体会 | standard | DocTypeEditorBase + StudyNotesAISidebar |
| `novel` | 长篇小说 | full | NovelDocWorkspace（三栏）+ NovelAISidebar |
| `translation` | 中英翻译 | standard | TranslationWorkspace（双栏）+ TranslationAISidebar |
| `diary` | 日记 | full | DiaryDocWorkspace + DiaryAISidebar |
| `essay` | 散文写作 | full | EssayDocWorkspace + EssayAISidebar |
| `stock-research` | 股票研究 | full | StockResearchWorkspace + StockResearchAISidebar |
| `imitative-writing` | 仿写练习 | full | ImitativeWritingWorkspace |
| `calculator` | 计算文档 | full | CalculatorWorkspace |
| `task-list` | 任务清单 | full | TaskListWorkspace |
| `outline` | 大纲写作 | full | OutlineWorkspace |

> **规则**：所有文档类型（包括 full 布局）必须有右侧 AI 聊天面板。

### 新建文档类型流程

1. `document-types/{type-id}/definition.ts`（实现 `DocTypeDefinition`）
2. `{TypeName}Editor.tsx` / `{TypeName}AISidebar.tsx`
3. 在 `register.ts` 中注册
4. 添加 i18n 键

---

## AI 流式生成机制

- 前端生成唯一 `requestId`（`req_${Date.now()}_${sessionId}`），传给后端
- 后端每个 SSE chunk 携带 `request_id`，前端据此过滤旧流残留事件
- `generateContentStream` 第 7 参数 `tabId` 必须显式传入（`effectiveTabId`），避免竞态导致 chunk 被丢弃
- `stopAiStreaming()` 同时：递增 sessionId、移除监听器、通知后端中断 HTTP 流

---

## 资源构建

`bash scripts/build-resources.sh` 一键完成：

1. `resources/ai-providers/` → `shared-types/generated/ai-providers.generated.ts` + `bundled-resources/ai-providers/`
2. `resources/prompt-templates/` → `shared-types/generated/prompt-templates.generated.ts` + `bundled-resources/prompt-templates/`
3. `resources/doc-templates/` → `shared-types/generated/doc-templates.generated.ts` + `bundled-resources/document-templates/`

生成的文件在 `.gitignore` 中，每次构建时重新生成。

---

## 开放 API

程序启动时在 `127.0.0.1` 随机端口开启 Axum HTTP Server，连接信息写入 `~/.aidocplus/api.json`（权限 0600）。

- **HTTP API**：JSON-RPC 风格，11 个命名空间 30+ 操作
- **MCP Server**：72 个工具（含 49 个 Tushare 股票数据工具）
- **SDK**：Python（`pip install aidocplus`）+ JS（`require('aidocplus')`）
- **编程区自动注入**：`AIDOCPLUS_API_PORT` / `AIDOCPLUS_API_TOKEN` / `PYTHONPATH` / `NODE_PATH`

---

## 构建与发布

### 平台策略

| 平台 | 方式 | 产物 |
|---|---|---|
| macOS Apple Silicon | 本地构建 | `.dmg` |
| Windows x64 | GitHub Actions CI | `.exe` (NSIS) |

### 版本号更新（3 个文件）

1. `apps/desktop/package.json`
2. `apps/desktop/src-tauri/tauri.conf.json`
3. `apps/desktop/src-tauri/Cargo.toml`

### CI 工作流

| 工作流 | 触发条件 | 说明 |
|---|---|---|
| `build.yml` | 推送 `v*` tag 或手动触发 | Windows x64 构建 |
| `test.yml` | PR 到 main 或手动触发 | 前端 tsc + ESLint + Vitest / Rust cargo check + clippy + test |
| `pages.yml` | 推送 `docs/**` 变更到 main | GitHub Pages 文档部署 |

### Gitee 镜像

- `.git/config` origin 配置双 pushurl（GitHub + Gitee）
- `tauri.conf.json` endpoints：Gitee 优先，GitHub fallback
- 一键发布：`bash scripts/release.sh`

---

## 跨平台规范

### 字体 fallback

- 宋体：`"Songti SC", "SimSun", "STSong", serif`
- 黑体：`"PingFang SC", "Microsoft YaHeHei", "Noto Sans SC", sans-serif`

### 构建脚本

- 禁止 emoji（Windows CI cp1252 报错），用 `[ok]` `[done]` 等文本标签
- 禁止 `rsync`（Windows 无），改用 `find + cp`
- 禁止 `python3 -c` 内联处理路径（Git Bash 路径格式问题）

### TypeScript 路径

- 禁止硬编码 `/` 作为路径分隔符，正则需同时匹配 `/` 和 `\`
- 复杂路径逻辑放 Rust 后端

---

## Known Issues & Solutions

| 问题 | 解决方案 |
|---|---|
| 导出使用错误的 projectId | 始终用 `document.projectId`，不用 `currentProject.id` |
| `openProject` 替换文档列表 | 合并而非替换 `documents` 数组 |
| DropdownMenu 透明 | `index.css` 中用 `!important` 强制不透明背景 |
| AI 生成内容显示"生成中"但无内容 | `generateContentStream` 必须传入显式 `tabId`（第 7 参数） |
