# CLAUDE.md

AI 编程助手指南，供 Claude / Windsurf 等工具在此仓库工作时参考。

**始终用中文与用户对话。界面文字、提示信息全部使用中文。字体为宋体，大小 16，跨平台兼容。**

---

## 项目概览

**AiDocPlus** — 跨平台 AI 文档桌面编辑器（官网：https://aidocplus.com）

| 层  | 技术                                                                 |
| --- | -------------------------------------------------------------------- |
| 后端 | Rust + Tauri 2.x                                                    |
| 前端 | React 19 + TypeScript 5.9 + Zustand + Radix UI + Tailwind CSS 4    |
| 编辑器 | CodeMirror 6                                                       |
| 构建 | Vite 8 + Turborepo + pnpm                                          |
| 国际化 | i18next                                                            |

当前版本：**0.3.16**

---

## 目录结构

```
AiDocPlus/
├── apps/desktop/
│   ├── src-tauri/                  # Rust 后端
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── commands/           # IPC 命令（32 个文件）
│   │   │   ├── ai.rs / api_gateway.rs / api_server.rs
│   │   │   ├── document.rs / template.rs / plugin.rs
│   │   │   └── native_export/ pandoc.rs ...
│   │   └── bundled-resources/      # 构建产物（.gitignore）
│   │       ├── ai-providers/
│   │       ├── document-templates/
│   │       └── prompt-templates/
│   └── src-ui/
│       ├── index.html / manager.html  # Vite 多入口
│       └── src/
│           ├── document-types/     # 11 种内置文档类型
│           ├── doctype-sdk/        # DocType SDK（registry/host/types/hooks）
│           ├── components/         # editor/ chat/ coding/ tabs/ ...
│           ├── plugins/            # 插件系统（28 个插件 + _framework/）
│           ├── stores/             # useAppStore useSettingsStore useTemplatesStore
│           ├── manager/            # 资源管理器前端
│           └── i18n/               # zh/en 翻译文件
├── packages/
│   ├── shared-types/               # 共享 TypeScript 类型
│   ├── manager-rust/               # 资源管理器 Rust crate（35+ 命令）
│   ├── manager-shared/             # 资源管理器共享类型
│   ├── manager-ui/                 # 资源管理器 React 组件库
│   ├── mcp-server/                 # MCP Server（23 个工具）
│   ├── sdk-python/                 # Python SDK
│   ├── sdk-js/                     # JS SDK
│   └── utils/
├── resources/                      # 资源源数据（prompt-templates/ ai-providers/ doc-templates/）
└── scripts/                        # build-resources.sh release.sh 等
```

---

## 常用命令

```bash
# 首次初始化
bash scripts/build-resources.sh   # 生成 bundled-resources + shared-types/generated/
pnpm install

# 开发
cd apps/desktop && pnpm tauri dev

# 编译检查
cd apps/desktop/src-ui && npx tsc --noEmit
cd apps/desktop/src-tauri && cargo check

# 发布构建（macOS）
cd apps/desktop && pnpm tauri build --target aarch64-apple-darwin

# 端口占用
lsof -ti:1420 | xargs kill -9
```

Tauri dev 模式：Rust 文件修改自动重编译重启，前端 Vite 热更新。

---

## 核心功能

- **多标签页编辑**：每个标签页独立面板状态（AI 消息、流式状态）
- **五大工作区**：生成区 / 内容区 / 合并区 / 功能区 / 编程区
- **AI 内容生成 & 聊天**：流式输出、停止控制、附件参考、联网搜索、深度思考（CoT）
- **多模态 AI**：聊天支持上传/粘贴图片（≤5 张，自动适配 OpenAI Vision / Anthropic）
- **文档级 AI 服务绑定**：每个文档可独立绑定不同 AI 服务，通过 `getAIInvokeParamsForService()` 解析
- **版本控制**：自动保存，预览恢复
- **多格式导出**：Markdown / HTML / DOCX / TXT（原生 + Pandoc）
- **附件系统**：参考文件，AI 生成时自动读取
- **插件系统**：28 个插件，自注册 + 自动发现 + manifest 驱动
- **编程区**：多语言代码编辑执行（Python/JS/TS/HTML 等），AI 自动化
- **开放 API**：HTTP JSON-RPC（11 命名空间 30+ 操作）+ MCP Server（23 工具）+ Python/JS SDK
- **文档标签与收藏**：标签筛选、`_starred` 内部标签
- **资源管理器**：多窗口（Tauri WebviewWindow），管理提示词模板、AI 提供商、文档模板
- **长篇小说**：设定集、章节层级、AI 四层记忆写作、伏笔追踪、全书导出+EPUB

---

## 文档类型系统（11 种）

### SDK 架构

- **入口**：`src-ui/src/doctype-sdk/`（types.ts / registry.ts / host.ts / hooks.ts）
- **实现**：`src-ui/src/document-types/{type-id}/`
- **共享基础**：`src-ui/src/document-types/_shared/`

### 内置文档类型

| 类型 ID | 名称 | 布局 | 编辑器 / 工作区 |
|---|---|---|---|
| `normal` | 通用文档 | standard | EditorPanel + ChatPanel |
| `study-notes` | 学习体会 | standard | DocTypeEditorBase + StudyNotesAISidebar |
| `novel` | 长篇小说 | full | NovelDocWorkspace（三栏）+ NovelAISidebar |
| `translation` | 中英翻译 | standard | TranslationWorkspace（双栏）+ TranslationAISidebar |
| `diary` | 日记 | full | DiaryDocWorkspace + DiaryAISidebar |
| `essay` | 散文写作 | full | EssayDocWorkspace + EssayAISidebar |
| `stock-research` | 股票研究 | full | StockResearchWorkspace + StockResearchAISidebar |
| `imitative-writing` | 仿写练习 | full | ImitativeWritingWorkspace + ImitativeWritingAISidebar |
| `calculator` | 计算文档 | full | CalculatorWorkspace + CalculatorAISidebar |
| `task-list` | 任务清单 | full | TaskListWorkspace + TaskListAISidebar |
| `outline` | 大纲写作 | full | OutlineWorkspace + OutlineAISidebar |

> **规则**：所有文档类型（包括 full 布局）必须有右侧 AI 聊天面板。

### 共享基础组件

- `DocTypeAIChatBase` — 统一 AI 聊天框架（流式/联网/深度思考/消息操作）
- `DocTypeChatMessage` — 消息渲染（MarkdownPreview + think 标签 + 复制）
- `DocTypeEditorBase` — 编辑器包装（自动保存 + AI 插入监听）
- `styles.ts` — Design Tokens 常量

### Design Tokens（统一规范）

| 元素 | 类名 |
|---|---|
| 快捷按钮 | `h-7 text-xs px-2 gap-1` |
| 消息气泡 | `rounded-lg p-3 text-sm` |
| 用户消息 | `bg-primary/10 ml-8` |
| AI 消息 | `bg-muted mr-2` + MarkdownPreview |
| 状态栏 | `px-3 py-1 border-t text-xs text-muted-foreground bg-card` |
| 工具栏 | `px-3 py-1.5 border-b bg-card` |

### 新建文档类型流程

1. `document-types/{type-id}/definition.ts`（实现 `DocTypeDefinition`）
2. `{TypeName}Editor.tsx` / `{TypeName}AISidebar.tsx`
3. 在 `register.ts` 中注册
4. 添加 i18n 键

---

## 插件系统（28 个插件）

### 操作位置规则（强制）

| 场景 | 位置 |
|---|---|
| 创建/修改具体插件 | `src/plugins/{name}/`（外部开发者角色，只 import `_framework/`） |
| 修改插件 SDK/框架 | `src/plugins/_framework/`（主程序构建者角色） |
| 修改加载/注册机制 | `src/plugins/loader.ts` 等 |

**绝不混淆两种角色。** 插件代码禁止直接 import `@tauri-apps/*`、`@/stores/*`、`@/i18n`。

### 两大类别

| 类别 | majorCategory | 数据 |
|---|---|---|
| 内容生成类（10 个） | `content-generation` | `document.pluginData` |
| 功能执行类（18 个） | `functional` | `usePluginStorageStore`（按 pluginId 隔离） |

### 当前插件（28 个）

**内容生成类（10）**：表格 `table/`⭐、思维导图 `mindmap/`⭐、Mermaid `mermaid/`、翻译 `translation/`、平行翻译 `parallel-translation/`、海报 `poster/`、图片 `image/`、词汇表 `glossary/`、引用 `citation/`、内容提取 `extract/`

**功能执行类（18）**：邮件 `email/`⭐、摘要 `summary/`、PPT `ppt/`、测验 `quiz/`、教案 `lessonplan/`、时间线 `timeline/`、审阅 `review/`、写作统计 `writing-stats/`、文档统计 `analytics/`、闪卡 `flashcard/`、合规检查 `compliance/`、对比 `diff/`、加密 `encrypt/`、水印 `watermark/`、TTS `tts/`、Office 预览 `officeviewer/`、Pandoc `pandoc/`、发布 `publish/`

⭐ = 标杆插件

### PluginHostAPI

通过 React Context 注入，插件使用 `usePluginHost()` 获取：

```typescript
interface PluginHostAPI {
  apiVersion: 1;
  pluginId: string;
  content: ContentAPI;       // 文档正文/AI 内容/合并区/插件片段
  ai: AIAPI;                // chat / chatStream / isAvailable / truncateContent
  storage: StorageAPI;       // 按 pluginId 隔离的持久化存储
  docData: DocDataAPI | null; // 仅内容生成类非 null
  ui: UIAPI;                // 状态消息/剪贴板/文件对话框/主题
  platform: PlatformAPI;    // invoke 代理（白名单）/getConfig/i18n.t
  events: EventsAPI;        // on/off 事件订阅
}
```

### invoke 白名单

`platform.invoke()` 限于：`write_binary_file`, `read_file_base64`, `get_temp_dir`, `open_file_with_app`, `test_smtp_connection`, `send_email`, `check_pandoc`, `pandoc_export`, `list_versions`, `get_version`, `wechat_http_request`

### 事件系统

`document:saved` / `document:changed` / `document:switched` / `theme:changed` / `locale:changed` / `ai:generation-started` / `ai:generation-completed` / `plugin:activated` / `plugin:deactivated`

### 布局模板

- `PluginPanelLayout`（内容生成类）：生成区 → 工具栏 → 内容区 → 状态栏
- `ToolPluginLayout`（功能执行类）：工具栏 → 功能区 → 状态栏

### 新建插件（零改动核心）

1. 创建 `plugins/{name}/manifest.json`（UUID、`majorCategory`、`subCategory`）
2. `index.ts`：定义 `DocumentPlugin`，调用 `registerPlugin()` 自注册
3. 实现面板组件（对照标杆插件）
4. `i18n/{zh,en}.json` 翻译

`loader.ts` 通过 `import.meta.glob` 自动发现，无需修改 `registry.ts` / `constants.ts` / `plugin.rs`。

### 标杆插件文件结构

**内容生成类（对照 `table/` / `mindmap/`）**：
```
{name}/
├── manifest.json / index.ts
├── {Name}PluginPanel.tsx      # 主面板
├── {Name}AssistantPanel.tsx   # 自定义 AI 助手（多会话/联网/深度思考）
├── {name}Context.ts           # 智能上下文引擎（分层/阶段检测/token预算）
├── quickActionDefs.ts         # 快捷操作定义（可配置/持久化）
├── types.ts                   # 领域类型
├── dialogs/ i18n/
```

**功能执行类（对照 `email/`）**：
```
{name}/
├── manifest.json / index.ts
├── {Name}PluginPanel.tsx / {Name}AssistantPanel.tsx
├── {name}Reducer.ts           # useReducer 状态集中管理
├── utils.ts / types.ts
├── dialogs/index.ts           # barrel export
├── i18n/
```

---

## AI 流式生成机制

- 前端生成唯一 `requestId`（`req_${Date.now()}_${sessionId}`），传给后端
- 后端每个 SSE chunk 携带 `request_id`，前端据此过滤旧流残留事件
- `generateContentStream(authorNotes, content, onChunk, history, webSearch, thinking, **tabId**)` — 第 7 参数 `tabId` 必须显式传入（`effectiveTabId`），避免竞态导致 chunk 被丢弃
- `stopAiStreaming()` 同时：递增 sessionId、移除监听器、通知后端中断 HTTP 流
- AI 服务选择器使用 `<select>` 下拉菜单（不用循环切换按钮）

---

## 资源构建架构

### 资源目录

| 目录 | 说明 | 规模 |
|---|---|---|
| `resources/prompt-templates/` | 提示词模板（JSON 文件模式） | 1481 个模板 / 53 分类 |
| `resources/ai-providers/` | AI 提供商配置 | 13 个 |
| `resources/doc-templates/` | 文档模板分类 | 8 分类 |

### 构建流水线

`bash scripts/build-resources.sh` 一键完成：
1. `build.py` 扫描 `resources/` → 生成 `dist/*.generated.ts`
2. 复制到 `packages/shared-types/src/generated/`
3. 复制到 `apps/desktop/src-tauri/bundled-resources/`

### 提示词模板数据格式

```json
// bundled-resources/prompt-templates/{category}.json
{"key": "academic", "name": "学术写作", "icon": "🎓", "order": 7,
 "templates": [{"id": "...", "name": "...", "content": "...", "variables": [], "order": 0}]}

// ~/AiDocPlus/PromptTemplates/custom.json（用户自定义）
{"templates": [{"id": "...", "name": "...", "category": "...", "content": "..."}]}
```

加载优先级：运行时 Rust 读取 JSON → 静态 fallback（编译时常量）→ 合并用户自定义

---

## 资源管理器（多窗口）

主程序通过 `invoke('open_resource_manager')` 创建 `WebviewWindow` 加载 `manager.html`，不启动独立进程。窗口已存在时自动聚焦。

相关包：`packages/manager-rust/`（35+ 命令）、`manager-shared/`、`manager-ui/`

---

## 编程区（CodingPanel）

| 文件 | 说明 |
|---|---|
| `components/coding/CodingPanel.tsx` | 主面板（~1900 行）：标签、编辑器、输出、设置、命令面板 |
| `components/coding/CodingFileTree.tsx` | 文件树（递归/收藏/右键菜单/全局搜索/3秒轮询） |
| `components/coding/CodingAssistantPanel.tsx` | AI 助手（快捷操作/上下文对话/代码 Diff 应用） |
| `components/coding/codingAI.ts` | AI 自动化引擎（生成→运行→pip install→AI 修正，最多 3 次） |
| `stores/useCodingStore.ts` | 状态管理（不用 Zustand persist，手动 invoke 持久化） |
| `commands/coding.rs` | Rust 后端（文件 CRUD/递归树/全局搜索/pip/状态持久化） |

运行时环境检测（Python/Node.js）：Rust 端 `spawn_blocking` 异步，前端 Store 缓存，零冷启动延迟。

AI 服务：独立 `codingServiceId`，可与主编辑器使用不同服务。

---

## 开放 API

程序启动时在 `127.0.0.1` 随机端口开启 HTTP Server，连接信息写入 `~/.aidocplus/api.json`（权限 0600）。

| 端点 | 说明 |
|---|---|
| `GET /api/v1/status` | 运行状态（无需认证） |
| `GET /api/v1/schema` | API 自描述（无需认证） |
| `POST /api/v1/call` | JSON-RPC 统一入口（Bearer Token） |

**命名空间**：`app` / `document` / `project` / `search` / `ai` / `export` / `template` / `plugin` / `file` / `script` / `tts` / `email`

**SDK**：Python（`packages/sdk-python/`）、JS（`packages/sdk-js/`），Proxy 自动代理，`api.document.list()` 即用。

**MCP Server**（`packages/mcp-server/`）：23 个工具，供 Claude Desktop / Cursor 等调用，工具名 `aidocplus_` 前缀。

**编程区自动注入**：`AIDOCPLUS_API_PORT` / `AIDOCPLUS_API_TOKEN` / `PYTHONPATH` / `NODE_PATH`，脚本零配置调用 API。

---

## 文档保存规范

- `saveDocument` 将 `attachments`、`pluginData`、`enabledPlugins` 一并保存
- 后端 `save_document`：`Option` 字段（attachments/pluginData/enabledPlugins）**必须用 `if let Some` 保护**，禁止无条件赋值（前端传 `undefined` → Rust `None` → 清空磁盘数据）
- AI 生成前自动保存文档并创建版本
- 插件数据：AI 生成完成后通过 `onRequestSave?.()` 触发即时保存；提示词编辑仅 `markTabAsDirty`

---

## 构建与发布

### 平台策略

| 平台 | 方式 | 产物 |
|---|---|---|
| macOS Apple Silicon | 本地构建 | `.dmg` |
| Windows x64 | GitHub Actions CI | `.exe` (NSIS) |

### macOS 发布流程

```bash
# 1. 构建
cd apps/desktop && pnpm tauri build --target aarch64-apple-darwin

# 2. 公证（需走 ClashX 代理，Tauri 内置公证经常超时）
ditto -c -k --keepParent .../AiDocPlus.app /tmp/AiDocPlus_notarize.zip
https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 \
  xcrun notarytool submit /tmp/AiDocPlus_notarize.zip \
  --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD" --wait
xcrun stapler staple .../AiDocPlus.app

# 3. 生成 DMG
hdiutil create -volname "AiDocPlus" -srcfolder .../AiDocPlus.app -ov -format UDZO .../AiDocPlus_x.y.z_aarch64.dmg
```

### 版本号更新（3 个文件）

- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`

### CI（`.github/workflows/build.yml`）

触发条件：推送 `v*` tag 或手动触发。流程：安装工具链 → `build-resources.sh` → `pnpm install` → `tauri-action` 构建 Windows x64 → 上传到 Draft Release。

### 总装流程

1. 本地总装验证（构建 `.app`、测试功能）
2. 用户确认后再提交到 GitHub（**不自动推送**）

### Gitee 镜像

- `.git/config` origin 配置两个 pushurl（GitHub + Gitee），`git push` 双推
- `tauri.conf.json` endpoints：Gitee 优先，GitHub fallback
- `update/latest.json` 中 url 指向 Gitee Release 附件
- 一键发布：`bash scripts/release.sh`

### Cargo Profile

- `[profile.dev]`：`incremental=true`，`opt-level=0`
- `[profile.release]`：`lto="thin"`，`opt-level=2`，`strip=true`

---

## 跨平台规范

### Rust 路径

1. 必须用 `PathBuf::join()`，禁止 `format!("{}/{}", ...)` 拼接路径
2. bundled-resources 查找：优先 `app.path().resource_dir()`
3. 平台差异用 `#[cfg(target_os = "...")]`

### TypeScript 路径

1. 禁止硬编码 `/` 作为路径分隔符，正则需同时匹配 `/` 和 `\`
2. 复杂路径逻辑放 Rust 后端

### 字体

中文必须提供跨平台 fallback：
- 宋体：`"Songti SC", "SimSun", "STSong", serif`
- 黑体：`"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`

### 构建脚本

- 禁止 emoji（Windows CI cp1252 报错），用 `[ok]` `[done]` 等文本标签
- 禁止 `rsync`（Windows 无），改用 `find + cp`
- 禁止 `python3 -c` 内联处理路径（Git Bash 路径格式问题）

---

## 国际化（i18n）

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

命名空间：`common` / `menu` / `editor` / `fileTree` / `chat` / `settings` / `store` / `tabs` / `version` / `templates` / `coding`

---

## 开发规范

### 状态管理

- 主 store：`useAppStore`（应用状态）/ `useSettingsStore`（设置，持久化）/ `useTemplatesStore`
- 跨项目操作始终使用数据对象自己的关联 ID（不用 `currentProject.id`）

### 调试

- 生产代码不保留 `console.log` / `println!`，保留 `console.error` / `eprintln!`

### 对话框

- 对话框必须不透明，顶部和高度固定

### AI 服务选择器

- 使用 `<select>` 下拉菜单，不用循环切换按钮

### 导出功能

- 所有文档类型导出必须包含 DOCX 和 PDF 格式

### 常见问题

```bash
# 端口占用
lsof -ti:1420 | xargs kill -9
# 依赖问题
rm -rf node_modules && pnpm install
# Git 推送超时（ClashX 代理）
git config --global http.proxy http://127.0.0.1:7890
```

---

## Known Issues & Solutions

| 问题 | 解决方案 |
|---|---|
| 导出使用错误的 projectId | 始终用 `document.projectId`，不用 `currentProject.id` |
| `openProject` 替换文档列表 | 合并而非替换 `documents` 数组 |
| DropdownMenu 透明 | `index.css` 中用 `!important` 强制不透明背景 |
| AI 生成内容显示"生成中"但无内容 | `generateContentStream` 必须传入显式 `tabId`（第 7 参数），避免竞态 |
