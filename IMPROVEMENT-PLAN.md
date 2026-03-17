# AiDocPlus 高端商业软件改进方向计划

> 基于对整个代码库的深入架构分析，按照高端商业软件标准，提出以下改进方向。
> 每项改进标注了 **重要性**（⭐~⭐⭐⭐）、**可行性**（🔧容易 / 🔧🔧中等 / 🔧🔧🔧复杂）和 **优先级**（P0~P3）。

### 最新状态（2026-03-11 更新）

**✅ Monorepo 合并已完成**：6 个独立仓库已合并为单一 `AiDocPlus` monorepo。

**当前项目规模**：

- Rust 后端：12,137 行（43 个源文件）
- TypeScript 前端：~53,000 行
- IM Bot 服务：3,182 行（独立 Node.js 服务）
- 内置插件：29 个（含 `_framework/` SDK）
- AI 服务商：13 个
- 提示词模板：1,481 个（53 个分类）
- 文档模板：20 个（7 个分类）+ 8 个 PPT 主题
- Zustand Store：6 个主 Store + 16 个 helper 模块（useAppStore 已拆分）
- 当前版本：v0.3.5

**已完成的架构改进**：

*基础架构（2026-02-27 前完成）*：

- ✅ 资源管理器合并到主程序（Tauri 多窗口）
- ✅ 多仓库 → 单一 Monorepo（消除同步问题）
- ✅ 插件 `_framework/` 统一为唯一一份
- ✅ `build-resources.sh` 替代 `assemble.sh` + 各 `deploy.sh`
- ✅ CI 简化（从 checkout 6 仓库 → 1 仓库）
- ✅ Rust 编译优化（`codegen-units` 1→8）
- ✅ SQLite 资源引擎移除（回归 JSON 文件模式）
- ✅ 角色系统、项目模板功能完全移除
- ✅ 插件框架字体跨平台 fallback（7 处）

*2026-02-27 ~ 2026-03-11 新完成*：

- ✅ **自动更新**（`tauri-plugin-updater`）：GitHub Releases 检查 + 静默下载 + 提示安装（§10.3 + §16.4.1）
- ✅ **macOS 代码签名 + Apple 公证**：`release.sh` 一键签名发布（§16.7）
- ✅ **菜单国际化**：`menu_i18n.rs` 检测系统语言，动态构建中英文原生菜单（§9.2 部分）
- ✅ **CLI 命令行**：`cli.rs` 支持 `--version`、`api status/schema/call`，无需启动 GUI
- ✅ **Deep Link**：`tauri-plugin-deep-link`，`aidocplus://` URL Scheme
- ✅ **IM Bot 桥接服务**：`apps/im-bot/`，飞书/钉钉/企微/QQ 四渠道消息机器人
- ✅ **文档级 AI 服务切换**：每个文档可独立绑定不同 AI 服务（`document.aiServiceId`）
- ✅ **useShallow 精确订阅**：17 个组件优化，减少不必要的重渲染（§7.3 部分）
- ✅ **useAppStore 模块化拆分**：从单文件拆分为 16 个 helper 模块（§7.3 部分）
- ✅ **keyring 安全存储**：email 插件 SMTP 密码已迁移到系统密钥链（§8.1 部分）
- ✅ **文档外部变更通知**：`document:external-change` 事件驱动，IM Bot 创建文档后前端自动刷新
- ✅ **临时文件自动清理**：关闭标签释放文档内容，减少内存占用（§7.2 部分）
- ✅ **SSE 流式 API**：API Server 支持 SSE 流式返回
- ✅ **消息去重**：飞书长连接 SDK 重发消息去重（message_id + 5 分钟 TTL）

---

## 一、编辑器核心功能（EditorPanel / MarkdownEditor）

### 1.1 协同编辑基础：操作变换（OT）或 CRDT

- **现状**：单用户编辑，文档以 JSON 文件存储在本地磁盘，无并发控制。`save_document` 是全量覆盖写入。
- **问题**：无法支持多设备同步或多人协作，高端写作工具的核心竞争力。
- **建议**：引入 CRDT 库（如 [yrs](https://github.com/y-crdt/y-crdt) —— Yjs 的 Rust 移植），在文档模型层实现增量同步。近期可先用于**多设备同步**（通过 WebSocket 中继服务器），远期支持**实时协作**。
- ⭐⭐⭐ | 🔧🔧🔧 | **P1**

### 1.2 结构化文档模型

- **现状**：`Document` 结构（`document.rs`）将 `content`、`author_notes`、`ai_generated_content` 存为平面字符串。版本管理也是全文快照（`DocumentVersion`）。
- **问题**：版本存储空间浪费（每版保存全文），diff/merge 困难，无法支持段落级引用或注释。
- **建议**：
  - 引入**增量版本**（diff-based），用 `similar` crate 存储差量而非全文。当前 `MAX_VERSIONS = 1000`，全文快照会消耗大量磁盘。
  - 将文档内容建模为**块结构**（block-based），类似 Notion/飞书，便于段落级 AI 操作、拖拽重排和精细化版本追踪。
- ⭐⭐ | 🔧🔧🔧 | **P2**

### 1.3 编辑器性能优化 ✅ 已完成

- **现状**：`MarkdownEditor.tsx` 使用 CodeMirror 6，支持语法高亮、自动补全、lint 等。大文档时可能存在性能瓶颈。
- **已实现**：
  - ✅ **大文档模式**（>10 万字符自动启用）：动态增加 debounce（300ms→800ms），自动禁用 Markdown lint 和选中匹配高亮，状态栏显示"大文档模式"提示
  - ✅ **统计计算 useMemo**：字符/词/行数统计用 `useMemo` 缓存，正则匹配替代 split+filter
  - ✅ **EditorStatusBar memo**：`React.memo()` 包裹，避免不必要的重渲染
  - ✅ **预览截断**：>80K 字符的文档预览自动截断，显示截断提示
  - ✅ **Mermaid 渲染缓存**：用哈希键缓存已渲染的 Mermaid SVG，避免重复渲染
  - ✅ **滚动同步 rAF 节流**：分屏滚动同步改为 requestAnimationFrame 节流，每帧最多同步一次
  - 📋 自动保存已用 `setInterval` + `ref` + `baseline` 比较优化，无需改为 debounce（当前方案已避免频繁写入）
  - 📋 CodeMirror 6 本身已实现虚拟滚动（仅渲染可视区域），无需额外实现
- ⭐⭐ | 🔧🔧 | **P1**

### 1.4 富文本 / 所见即所得（WYSIWYG）模式

- **现状**：纯 Markdown 编辑 + 分栏预览。
- **问题**：非技术用户（如公务员、律师、记者）不熟悉 Markdown 语法。
- **建议**：基于 [ProseMirror](https://prosemirror.net/) 或 [Tiptap](https://tiptap.dev/) 增加可选的所见即所得模式，底层仍存储 Markdown，编辑时提供富文本体验。可作为高级付费功能。
- ⭐⭐ | 🔧🔧🔧 | **P2**

### 1.5 文档大纲与导航增强 ✅ 已完成

- **现状**：`DocumentOutline` 组件已存在，但功能较基础。
- **已实现**：
  - ✅ **章节字数统计**：大纲中每个标题旁显示该节字数（含子节），>1000 显示为 1.0k 格式
  - ✅ **当前标题高亮**：根据光标位置实时高亮大纲中当前所在标题（bg-accent + font-medium）
  - ✅ **面包屑导航**：状态栏中间区域显示当前光标所在的章节路径（H1 › H2 › H3），点击可跳转
  - 📋 拖拽重排和编辑器内折叠复杂度较高，留待后续增强
- ⭐ | 🔧 | **P1**

---

## 二、AI 功能链路（ai.rs / commands/ai.rs / ChatPanel）

### 2.1 多模态支持（图像/文件理解） ✅ 已完成

- **现状**：`ChatMessage` 只有 `role` 和 `content`（字符串），不支持图片/文件附件。虽然 `Document` 有 `attachments` 字段，但 AI 链路不使用它们。
- **已实现**：
  - ✅ **数据模型扩展**：`ChatMessage`（Rust）和 `AIMessage`（TS）新增可选 `images` 字段（`ChatImage[]`，base64 + mimeType）
  - ✅ **多模态 API 适配**：Rust 后端 `message_to_json()` 自动将 images 转为 OpenAI `image_url` 格式或 Anthropic `source.base64` 格式
  - ✅ **图片上传 UI**：ChatPanel 输入框旁添加图片上传按钮（ImagePlus 图标），支持点击选择、Ctrl+V 粘贴图片
  - ✅ **图片预览条**：输入框上方显示待发送图片缩略图（56×56），悬停显示删除按钮，最多 5 张，单张最大 10MB
  - ✅ **消息图片展示**：用户消息气泡中以 64×64 缩略图展示已发送图片，点击可在新窗口查看原图
  - ✅ **全链路适配**：chat / chat_stream / Responses API / Anthropic API 所有路径均支持多模态
  - 📋 PDF/图片 OCR 注入上下文留待后续增强
- ⭐⭐⭐ | 🔧🔧 | **P0**

### 2.2 AI 服务提供商抽象层重构

- **现状**：`ai.rs` 中 `chat_stream` 函数内部包含大量 `if provider == "anthropic"` / `if provider == "openai"` 等分支。每个提供商的 SSE 解析逻辑独立实现（`stream_sse_chat_completions`、`stream_openai_responses`、`stream_anthropic_with_search`）。
- **问题**：添加新提供商需修改多处代码，违反开闭原则。Anthropic 的 `max_tokens` 硬编码为 `8192`。
- **建议**：
  - 定义 `trait AIProvider`，将请求构建、响应解析、流处理封装为接口。
  - 每个提供商实现为独立模块（`providers/openai.rs`、`providers/anthropic.rs` 等）。
  - 通过工厂模式根据 provider 名称创建实例。
  - 将 `max_tokens` 等参数提升为用户可配置。
- ⭐⭐⭐ | 🔧🔧 | **P0**

### 2.3 Tool Calling 能力扩展

- **现状**：`tools.rs` 定义了 3 个内置工具（`search_documents`、`read_document`、`get_document_stats`），仅在 `chat_stream` 中使用。
- **建议**：
  - 增加更多内置工具：**文件操作**（创建/修改文档）、**网络搜索**（已有但仅限特定 provider）、**代码执行**（连接编程区）、**知识库检索**。
  - 支持**插件注册自定义工具**，让插件可以向 AI 暴露能力。
  - 实现**工具调用确认机制**（高危操作需用户确认）。
  - 支持**并行工具调用**（当前是串行循环）。
- ⭐⭐ | 🔧🔧 | **P1**

### 2.4 对话上下文管理优化 ✅ 已完成

- **现状**：`useConversationsStore` 将对话持久化到 `~/AiDocPlus/conversations.json`（单文件）。所有对话消息全量序列化。
- **问题**：对话量增长后，单文件读写性能下降。消息历史无限增长会超出 AI 模型的 token 限制。
- **已实现**：
  - ✅ **Token 估算工具**（`src-ui/src/lib/tokenEstimator.ts`）：基于字符的 token 估算（中英文自动检测），模型上下文窗口映射表（覆盖 OpenAI/Anthropic/Gemini/xAI/DeepSeek/通义千问/GLM/MiniMax/Kimi 等主流模型）
  - ✅ **滑动窗口消息截断**：`truncateMessages()` 函数，在 `sendChatMessage` 发送前自动裁剪消息。保留 system 消息 + 最近对话，截断时插入提示。支持按 token 数和消息条数双重限制。
  - ✅ **Token 用量指示器**（`TokenUsageIndicator` 组件）：ChatPanel 输入框上方显示进度条 + 文字（`~1.2K / 128K tokens`），颜色分级（绿/黄/红）。
  - ✅ **设置项**：`maxContextMessages`（最大消息条数）、`maxContextTokens`（最大 token 数），0=自动按模型检测。
  - 📋 对话存储已在 §14 中迁移至 SQLite。对话摘要功能可后续作为增强项实现。
- ⭐⭐ | 🔧🔧 | **P1**

### 2.5 RAG（检索增强生成）系统

- **现状**：AI 只能访问当前文档内容。`search_documents` 工具可搜索项目内文档，但是基于关键词匹配。
- **建议**：
  - 集成向量嵌入（可用本地模型如 `all-MiniLM-L6-v2` 或调用 API），为文档内容建立向量索引。
  - 实现**语义搜索**，AI 可以根据语义相关性检索跨项目的文档片段。
  - 支持**知识库**功能：用户可导入参考资料（PDF、网页、书籍），AI 写作时自动引用。
- ⭐⭐⭐ | 🔧🔧🔧 | **P1**

### 2.6 AI 写作工作流（Agent）

- **现状**：AI 功能分为「聊天」和「内容生成」两种模式，但没有复杂的多步骤工作流。
- **建议**：
  - 实现**写作 Agent 系统**：用户可定义多步骤写作流程（如「调研 → 大纲 → 初稿 → 润色 → 排版」），每步骤可配置不同 AI 模型和提示词。
  - 支持**模板化工作流**，用户可保存和分享工作流模板。
  - AI 可自主决定是否需要搜索网络、查阅知识库、修改文档结构等。
- ⭐⭐ | 🔧🔧🔧 | **P2**

---

## 三、插件系统（PluginHostAPI / loader / types）

> **架构更新（2026-02-27）**：插件已从独立仓库（AiDocPlus-Plugins）合并到主仓库 `plugins/` 目录。`_framework/` 只有一份，消除了之前三份不同步的问题。当前共 27 个插件（含 `_framework/`）。

### 3.1 插件沙箱隔离

- **现状**：插件通过 `PluginHostAPI` 访问主程序能力，有命令白名单（`ALLOWED_PLUGIN_COMMANDS`），但插件代码**与主程序在同一 JS 上下文**中运行。
- **问题**：恶意插件可直接访问 `window`、`document`、`localStorage` 等，白名单防护可被绕过。
- **建议**：
  - 将插件运行在**独立 iframe + postMessage** 通信中，或使用 **Web Worker** 沙箱。
  - 建立插件**权限声明机制**（类似 Chrome 扩展的 `permissions`），安装时向用户明示。
  - 插件市场上架前进行代码安全审查。
- ⭐⭐⭐ | 🔧🔧🔧 | **P1**

### 3.2 插件市场与在线分发

- **现状**：插件通过编译时 `import.meta.glob` 发现，内嵌在应用中。用户无法动态安装/卸载第三方插件。
- **建议**：
  - 实现**插件包格式**（.adp 包，包含 manifest + 编译后 JS + 资源）。
  - 建立**插件市场**后端服务：上传、审核、分发、版本管理、评分评论。
  - 应用内**插件商店 UI**：浏览、搜索、一键安装、自动更新。
  - 支持**企业私有插件仓库**。
- ⭐⭐ | 🔧🔧🔧 | **P2**

### 3.3 插件 SDK 增强

- **现状**：`PluginHostAPI` 提供 `content`、`ai`、`storage`、`docData`、`ui`、`platform`、`events` 七大 API 模块，覆盖面已较好。
- **建议**：
  - 增加 **MenuAPI**：插件可注册菜单项、工具栏按钮、右键菜单。
  - 增加 **EditorAPI**：插件可操作编辑器（插入文本、添加装饰、注册快捷键）。
  - 增加 **NotificationAPI**：系统通知、进度条、toast 消息。
  - 提供 **CLI 脚手架工具**（`create-aidocplus-plugin`）自动生成插件项目。
  - 发布完善的 **SDK 文档网站**。
- ⭐⭐ | 🔧🔧 | **P1**

### 3.4 插件生命周期完善

- **现状**：`DocumentPlugin` 接口定义了 `onActivate`、`onDeactivate`、`onDocumentChange`、`onDestroy` 生命周期钩子，但标注为「预留」。
- **建议**：
  - 实现并调用所有生命周期钩子。
  - 增加 `onInstall`、`onUninstall`、`onUpgrade` 钩子。
  - 支持插件**配置迁移**（版本升级时自动迁移旧配置）。
- ⭐ | 🔧 | **P1**

---

## 四、编程区（CodingPanel / CodingAssistantPanel）

### 4.1 Language Server Protocol（LSP）集成

- **现状**：编程区使用 CodeMirror，有基本语法高亮，但无智能补全、跳转定义、悬停文档等高级功能。
- **建议**：
  - 集成 **LSP 客户端**（通过 Rust 启动 LSP 子进程，WebSocket/stdio 通信）。
  - 支持 Python（Pyright/Pylsp）和 JavaScript/TypeScript（tsserver）的智能补全。
  - 提供**错误诊断**（红色波浪线）和**快速修复建议**。
- ⭐⭐ | 🔧🔧🔧 | **P2**

### 4.2 终端集成

- **现状**：脚本通过 `run_python_script` / `run_nodejs_script` 等命令执行，输出显示在面板中。没有交互式终端。
- **建议**：
  - 集成 **PTY 终端**（使用 `portable-pty` crate），支持交互式 shell。
  - 支持通过终端执行任意命令，输出实时流式显示。
  - 支持**多终端标签**。
- ⭐⭐ | 🔧🔧🔧 | **P2**

### 4.3 AI 代码助手增强

- **现状**：`CodingAssistantPanel` 提供 AI 辅助编程聊天。
- **建议**：
  - 实现**行内代码补全**（类似 GitHub Copilot），在编辑器中直接显示 AI 建议。
  - 支持**代码解释**（选中代码后 AI 解释功能）。
  - 支持**代码重构**（AI 辅助重命名、提取函数等）。
  - 支持将**文档写作上下文**注入代码助手（例如"根据文档中描述的算法编写实现"）。
- ⭐⭐ | 🔧🔧 | **P2**

### 4.4 项目级代码管理

- **现状**：编程区以单文件标签页方式组织，有文件树但功能较基础。
- **建议**：
  - 支持**项目工作区**概念，关联文档项目。
  - 集成 **Git** 基础功能（状态显示、commit、diff 查看）。
  - 支持**多文件引用**（AI 可同时查看和修改多个文件）。
- ⭐ | 🔧🔧🔧 | **P3**

---

## 五、导出与发布系统（native_export）

### 5.1 导出质量提升

- **现状**：支持 md/html/docx/pdf/txt 导出。PDF 导出实际是生成 HTML 后让浏览器打印。DOCX 导出使用自研 Rust 模块。
- **问题**：DOCX 排版能力有限（`native_export/docx.rs`）。PDF 需要用户手动「打印为 PDF」，体验不佳。
- **建议**：
  - PDF 导出改用 **headless Chromium** 或 [typst](https://typst.app/) 直接生成高质量 PDF。
  - DOCX 导出支持更多格式特性：页眉页脚、目录、脚注、图表、自定义样式模板。
  - 支持**导出模板**（用户可自定义 DOCX/PDF 的排版样式）。
  - 增加 **PPTX 导出**（AI 根据文档内容自动生成演示文稿）。
- ⭐⭐⭐ | 🔧🔧 | **P0**

### 5.2 发布渠道集成

- **现状**：支持邮件发送和微信公众号发布（通过插件）。
- **建议**：
  - 增加更多发布渠道：**知乎**、**CSDN**、**头条号**、**WordPress**、**Ghost** 等。
  - 实现**一键多平台发布**功能。
  - 支持发布后的**数据回流**（阅读量、评论等）。
- ⭐⭐ | 🔧🔧 | **P2**

---

## 六、数据管理与持久化

### 6.1 数据库化存储 → 已更新为 §14「SQLite 精准引入策略」

- **原方案**：用 SQLite 全面替代 JSON 文件存储。
- **修订**：经过实践验证（上次 `resource_engine.rs` 引入后被移除），全面替换风险过高，与插件系统的开放设计冲突。
- **新方案**：详见 §14，仅在版本历史、对话记录、搜索索引三个场景精准引入 SQLite，文档内容和插件数据继续使用 JSON 文件。
- ⭐⭐⭐ | 🔧🔧 | **P1**

### 6.2 自动备份与恢复

- **现状**：有版本历史（`create_version`），有项目 ZIP 导出。但没有系统级自动备份。
- **建议**：
  - 实现**增量自动备份**（每天/每周），保存到指定目录或云端。
  - 支持**时间机器**功能：可浏览和恢复任意时间点的项目状态。
  - 崩溃恢复：写入前创建临时文件，写入成功后原子重命名（避免文件损坏）。
- ⭐⭐ | 🔧🔧 | **P1**

### 6.3 云同步 → 已更新为 §12「多设备同步：低成本实现路径」

- **原方案**：通用 WebDAV/S3/iCloud 集成。
- **新方案**：详见 §12，分三阶段实施——v0.4 自定义数据目录（零成本）→ v0.5 Cloudflare R2 云同步（专业版）→ v1.0+ WebSocket 实时协同。

---

## 七、性能优化

### 7.1 应用启动速度 ✅ 已完成

- **已完成**（2026-03-12）：
  - ✅ **manualChunks 拆分大型第三方库**：CodeMirror(1,703kB)、Markdown渲染(778kB)、React(194kB)、Icons(59kB) 从主 chunk 拆出
  - ✅ **React.lazy 拆分按需组件**：SettingsPanel、SearchPanel、ChatPanel、PluginAssistantPanel、PluginToolArea、6个Dialog 改为延迟加载
  - ✅ **延后非关键数据加载**：模板数据(docTemplates/categories/builtInTemplates)从启动关键路径移除，UI 可交互后异步加载
  - ✅ **Suspense fallback**：所有 lazy 组件添加 Suspense 包裹
  - **效果**：main.js 从 7,639kB 降至 5,991kB（**-21.6%**），gzip 从 2,205kB 降至 1,695kB（**-23.1%**）
- ⭐⭐ | 🔧🔧 | **P1**

### 7.2 内存管理 🟡 部分完成

- **现状**：`useAppStore` 在内存中保持所有文档的完整数据（包括 `content`、`ai_generated_content`、`versions` 数组）。
- **问题**：打开多个大文档时内存占用线性增长。`versions` 数组可包含上千个全文快照。
- **已完成**（2026-03-11）：
  - ✅ 关闭标签页时**释放文档内容**，仅保留元数据缓存。
  - ✅ 临时文件自动清理。
- **待完成**：
  - **按需加载文档内容**：`documents` 列表只保存元数据，内容在打开标签页时按需加载。
  - **版本惰性加载**：`versions` 不随文档一起加载，仅在查看版本历史时请求。
- ⭐⭐⭐ | 🔧🔧 | **P1**（原 P0，部分完成后降级）

### 7.3 前端渲染优化 🟡 部分完成

- **现状**：`useAppStore` 已从单文件拆分为 16 个 helper 模块，17 个组件已使用 `useShallow` 精确订阅。
- **已完成**（2026-03-11）：
  - ✅ `useAppStore` 拆分为 16 个 helper/commands 模块（`useAppStore.ai.helpers.ts`、`useAppStore.workspace.helpers.ts` 等）。
  - ✅ 17 个组件使用 `useShallow` 精确订阅（TabBar、FileTree、EditorPanel、SettingsPanel 等）。
  - ✅ 切换文档渲染减少 75%（v0.3.3 性能优化）。
- **待完成**：
  - 进一步拆分为完全独立的 store（`useProjectStore`、`useDocumentStore`、`useTabStore`、`useAIStore`）。
  - 对 `ChatPanel` 中的消息列表使用**虚拟化列表**（`react-window` 或 `@tanstack/react-virtual`）。
  - `EditorPanel` 的复杂 props 传递改为 **Context + Provider** 模式。
- ⭐⭐ | 🔧🔧 | **P1**

---

## 八、安全性

### 8.1 API Key 安全存储 🟡 部分完成

- **现状**：AI 服务 API Key 仍存储在 `settings.json` 中，明文保存在 `~/AiDocPlus/settings.json`。
- **问题**：任何能读取用户目录的程序都能获取 API Key。
- **已完成**（2026-03-11）：
  - ✅ `keyring` crate v3 已集成（`Cargo.toml`，支持 apple-native、windows-native、sync-secret-service）。
  - ✅ email 插件 SMTP 密码已迁移到系统密钥链（`commands/email.rs`）。
- **待完成**：
  - 将 AI 服务 API Key 从 `settings.json` 明文迁移到 `keyring`。
  - `settings.json` 中只保存 Key 的引用标识符，实际值从密钥链获取。
  - 向后兼容：首次运行时自动将旧明文 Key 迁移到密钥链。
- ⭐⭐⭐ | 🔧 | **P0**

### 8.2 文件系统安全

- **现状**：`import.rs` 有 ZIP 炸弹防护（`MAX_UNCOMPRESSED_SIZE`、`MAX_FILE_COUNT`）。`search.rs` 有 ReDoS 防护。
- **建议**：
  - 文件写入路径验证：防止路径遍历攻击（`../` 注入）。
  - 临时文件清理：`export_and_open` 使用 `std::env::temp_dir()` 但未清理旧临时文件。
  - 实现**文件大小限制**：单文档最大大小、项目最大大小。
  - 导入文件内容**消毒处理**（sanitize HTML、清理 DOCX 中的宏/脚本）。
- ⭐⭐ | 🔧 | **P1**

### 8.3 网络安全

- **现状**：AI 请求通过 `reqwest::Client` 发送，未配置超时、证书验证等。
- **建议**：
  - 为 AI 请求配置**超时**（连接超时 + 读取超时）。
  - 支持**代理设置**（HTTP/SOCKS5 代理，企业用户常需）。
  - 实现 **API 调用限速**（防止意外的大量请求造成费用爆炸）。
  - 添加 **SSL 证书固定**（可选，企业安全场景）。
- ⭐⭐ | 🔧 | **P0**

---

## 九、用户体验（UX）

### 9.1 快捷键体系完善

- **现状**：有部分快捷键（`Cmd+S`、`Cmd+J`、`Cmd+L` 等），存储在 `useSettingsStore.shortcuts` 中。
- **建议**：
  - 实现**快捷键自定义面板**（类似 VS Code 的快捷键编辑器）。
  - 添加**命令面板**（`Cmd+Shift+P`），可搜索执行所有命令。
  - 支持**Vim/Emacs 键绑定**（可选）。
- ⭐⭐ | 🔧🔧 | **P1**

### 9.2 国际化完善 🟡 部分完成

- **现状**：使用 `react-i18next`，前端全面国际化已完成（批次 1-4）。Rust 原生菜单已国际化。
- **已完成**（2026-03-11）：
  - ✅ 前端所有 UI 文字通过 i18next 处理。
  - ✅ Rust 原生菜单通过 `menu_i18n.rs` 实现动态中英文切换。
  - ✅ Rust 后端错误消息改为**结构化错误码**（`error.rs` ErrorCode 枚举），前端通过 `formatBackendError` + `errors.backend.*` i18n 键翻译显示（2026-03-11）。
  - ✅ 前端所有 `instanceof Error ? .message : String(...)` 模式统一替换为 `formatBackendError()`（2026-03-11）。
- **待完成**：
  - 增加更多语言支持（日语、韩语等亚洲语言优先）。
- ⭐⭐ | 🔧🔧 | **P1**

### 9.3 无障碍（Accessibility）

- **现状**：基于 shadcn/ui 组件，有基础的 ARIA 支持，但未进行系统性无障碍测试。
- **建议**：
  - 确保所有交互元素有正确的 `aria-label`。
  - 支持**屏幕阅读器**（VoiceOver / NVDA）。
  - 确保**键盘完全可操作**（Tab 导航、焦点管理）。
  - 支持**高对比度主题**。
- ⭐ | 🔧🔧 | **P2**

### 9.4 引导与帮助系统

- **现状**：首次运行创建示例项目和文档，有 "新手引导" 菜单项。
- **建议**：
  - 实现**交互式引导教程**（步骤式高亮 + 提示气泡）。
  - 内置**上下文帮助**（悬停在功能按钮上显示使用说明）。
  - AI 驱动的**智能帮助**：用户遇到问题时可询问 "如何使用某功能"。
- ⭐ | 🔧🔧 | **P2**

---

## 十、架构与工程化

### 10.1 错误处理体系化 ✅ 已完成

- **已完成**（2026-07-13）：
  - ✅ `error.rs` 定义结构化 `AppError` 枚举（`Internal`/`ValidationError`/`DocumentNotFound`/`ResourceError`/`SecurityError`/`ImportFailed`/`ExportFailed`/`ExternalToolError`）和 `ErrorCode` 枚举。
  - ✅ `AppError` 实现 `Serialize`，后端返回 `{ code: string, message: string }` 结构化 JSON。
  - ✅ 全局类型别名 `Result<T> = std::result::Result<T, AppError>`。
  - ✅ 所有 Tauri 命令、辅助函数、模块全部迁移到结构化 `AppError`，消除 `Result<T, String>` 和字符串错误。
  - ✅ 涉及文件：`error.rs`、`config.rs`、`plugin.rs`、`template.rs`、`workspace.rs`、`api_server.rs`、`api_gateway.rs`、`native_export/`、`commands/`（ai/coding/document/export/file_system/import/project/resource/settings/workspace）。
  - ✅ `cargo check` 零错误通过。
- ⭐⭐ | 🔧🔧 | **P1**

### 10.2 日志与遥测

- **现状**：使用 `console.error` / `eprintln!` 输出错误。无结构化日志，无性能监控。
- **建议**：
  - Rust 侧引入 `tracing` crate，实现结构化日志。
  - 前端实现 **Error Reporting** 服务（可选匿名崩溃报告）。
  - 性能指标收集：启动时间、AI 响应延迟、文档保存耗时。
  - 提供**日志查看器**（帮助菜单中可打开日志文件）。
- ⭐⭐ | 🔧🔧 | **P1**

### 10.3 自动更新 ✅ 已完成

- **已完成**（2026-03-11）：
  - ✅ `tauri-plugin-updater` 集成，检查 GitHub Releases `latest.json`。
  - ✅ `tauri.conf.json` 配置 updater pubkey + endpoint。
  - ✅ `UpdateChecker.tsx` 组件：检查更新 + 下载 + 提示安装。
  - ✅ 菜单「检查更新」菜单项（`check_update`）。
  - ✅ `scripts/release.sh` 一键发布脚本（构建 + 签名 + 公证 + 上传 + 创建 Release）。
  - ✅ `createUpdaterArtifacts: true`，构建自动生成更新 manifest。
  - ✅ 安装模式：`passive`（静默后台下载，提示安装）。
- **待优化**（P2）：
  - 增量更新（仅下载变更部分）。
  - 更新通道（稳定版 / 预览版 / 测试版）。
- ~~⭐⭐⭐ | 🔧🔧 | **P0**~~ → **已完成**

### 10.4 测试体系建设

- **现状**：未发现单元测试或集成测试文件。
- **建议**：
  - Rust 后端：为核心模块（`document.rs`、`search.rs`、`native_export`）编写**单元测试**。
  - 前端：为 Zustand stores 编写**单元测试**（使用 Vitest）。
  - E2E 测试：使用 **Playwright** 或 **Tauri Driver** 进行端到端测试。
  - CI 流水线中集成测试和代码质量检查。
- ⭐⭐ | 🔧🔧 | **P1**

---

## 十一、开源授权与商业化策略

### 11.1 授权协议：从 MIT 迁移到 BSL 1.1

- **现状**：主仓库 `LICENSE` 为 MIT 协议，允许任何人免费使用、修改、分发、商用，甚至可以闭源分发。
- **风险**：竞争对手可直接 fork 后改名发布商业版，无需任何回馈。Elasticsearch、Redis、MongoDB 均因此被迫更换协议。
- **建议**：采用 **BSL 1.1**（Business Source License），MariaDB、Sentry、HashiCorp (Terraform/Vault)、CockroachDB 均使用此协议：
  - ✅ 源代码完全公开，用户可查看、学习、审计、自用
  - ✅ 个人、教育和非商业使用完全免费
  - ❌ 禁止用于竞争性商业产品（不能直接卖竞品或作为 SaaS 提供）
  - ⏰ 时间锁：3~4 年后自动转为 Apache 2.0（`Change Date: 2030-03-01`）
- **资源数据**（`resources/` 目录中的提示词模板、文档模板）可考虑单独声明 **CC BY 4.0** 以鼓励社区贡献
- ⭐⭐⭐ | 🔧 | **P0**

### 11.2 商业化收费模式：Freemium + 开放核心

| 层级                     | 定价        | 内容                                                                                          |
| ------------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| **社区版**（免费） | ¥0         | 本地 AI 写作全功能（用户自带 API Key）、基础插件（~10 个）、3 个项目 / 每项目 50 文档、单设备 |
| **专业版**         | ¥99~199/年 | 无限项目和文档、全部 27 个插件、多设备同步、高级导出模板、RAG 知识库、优先邮件支持            |
| **企业版**         | 按需        | 私有化部署、SSO/LDAP、批量授权、定制开发、专属技术支持                                        |

#### 授权验证技术方案

- 用户注册 → 服务器颁发 license key（JWT 格式，含过期时间 + 功能列表）
- 客户端每 7 天向服务器验证有效性，离线宽限期 30 天
- 功能开关存储在前端 store，根据 license 动态启用/禁用
- 后端服务使用 **Cloudflare Workers**（免费 10 万请求/天）+ **Supabase**（免费 500MB PostgreSQL）

### 11.3 低成本后端服务架构

| 服务         | 推荐方案                        | 月成本（起步）     |
| ------------ | ------------------------------- | ------------------ |
| 授权验证 API | Cloudflare Workers              | **¥0**      |
| 用户数据库   | Supabase 免费层                 | **¥0**      |
| 文件同步存储 | Cloudflare R2 (10GB 免费)       | **¥0~20**   |
| 支付网关     | LemonSqueezy / 支付宝           | **按交易量** |
| 官网 + 文档  | GitHub Pages / Cloudflare Pages | **¥0**      |
| 自动更新分发 | GitHub Releases                 | **¥0**      |
| 错误监控     | Sentry 免费层 (5000 事件/月)    | **¥0**      |
| 社区论坛     | GitHub Discussions / Discord    | **¥0**      |

**起步阶段月成本可控制在 ¥0~50 之内。**

---

## 十二、多设备同步：低成本实现路径

### 12.1 起步方案：文件级云同步（零成本）⭐ 推荐

- **原理**：设置面板增加"自定义数据目录"选项，用户将 `~/AiDocPlus/` 指向 iCloud Drive / OneDrive / 坚果云 WebDAV / Dropbox 同步目录
- **技术要点**：
  - 文件写入改为**原子写入**（写临时文件 → rename）防止同步时读到半写文件
  - 增加**冲突检测**（比较 `last_modified` 时间戳）
  - 提供冲突解决 UI（选择保留哪个版本或合并）
- **优点**：零服务器成本、用户数据在自己手中、隐私友好
- **缺点**：依赖用户自己配置云盘、不支持实时协同
- **开发成本**：约 1~2 周
- ⭐⭐⭐ | 🔧 | **P1**

### 12.2 进阶方案：Cloudflare R2 + Workers 云同步

- 专业版功能，用户登录后数据自动同步到云端
- 使用 Cloudflare R2（10GB 免费）存储用户数据，Workers 做鉴权
- 增量同步（只上传变更的文件），压缩传输
- **月成本**：用户量 < 1000 时约 ¥0~50

### 12.3 远期方案：WebSocket 实时协同

- 仅在确实需要多人实时编辑时才考虑
- 可选托管方案：Cloudflare Durable Objects ($0.15/百万请求)、fly.io ($5/月起)、阿里云 ECS (~¥40/月)
- 需配合 CRDT（§1.1）一起实现

**建议路径**：v0.4 实现 12.1 → v0.5 实现 12.2 → v1.0+ 考虑 12.3

---

## 十三、帮助文档系统改进

### 13.1 现状问题

- 使用 Jekyll + `jekyll-theme-cayman` 主题，托管在 `aidocplus.com`（GitHub Pages）
- Cayman 是单页布局主题，**没有左侧目录导航栏**
- 每个页面底部只有 `← 返回文档首页` 链接，导航体验差
- 无全文搜索功能
- 文档内容已覆盖 12 个 md 文件（安装、快速开始、编辑器、AI 聊天、插件、编程区、导出等）

### 13.2 建议方案：迁移到 VitePress

**VitePress** 是最佳选择：

1. **技术栈一致**：项目前端用 Vite，文档也用 VitePress，零学习成本
2. **内置左侧目录 + 右侧 TOC**：正是所需的"左边目录、右边内容"格式
3. **全文搜索**：内置本地搜索（MiniSearch），无需后端
4. **零成本托管**：GitHub Pages / Cloudflare Pages
5. **Markdown 原生**：现有 .md 文件几乎不用改
6. **国际化 + 深色模式**：内置支持

**迁移工作量**：1~2 天，具体步骤：

1. 安装 VitePress（`pnpm add -D vitepress`）
2. 创建 `docs/.vitepress/config.ts`，配置侧边栏导航结构
3. 移除 Jekyll 配置（`_config.yml`、frontmatter 中的 `layout: default`）
4. 调整链接路径（VitePress 路由约定）
5. 配置 CNAME 和部署脚本

- ⭐⭐ | 🔧 | **P0**

### 13.3 方案对比

| 方案                   | 左侧目录 | 搜索        | 成本      | 技术栈一致      |
| ---------------------- | -------- | ----------- | --------- | --------------- |
| **VitePress** ⭐ | ✅ 内置  | ✅ 本地搜索 | 免费      | ✅ Vite 生态    |
| Docusaurus             | ✅ 内置  | ✅ Algolia  | 免费      | ❌ React 但较重 |
| Jekyll just-the-docs   | ✅ 内置  | ✅ 内置     | 免费      | ❌ Ruby 生态    |
| GitBook                | ✅ 内置  | ✅ 内置     | 付费/限制 | ❌              |

---

## 十四、SQLite 精准引入策略

### 14.1 历史回顾与教训

上次引入 `resource_engine.rs`（SQLite）在 2026-02-26 被**完全移除**，原因是：

- 试图用 SQLite 管理**资源模板**（提示词/文档模板），这些资源需要人类可读、git 管理、资源管理器 UI 编辑
- 把 JSON 文件模式和 SQLite 模式混用在同一数据类型上，导致两套代码路径难以维护
- 与插件系统的开放设计（插件通过 PluginHostAPI 直接读写 JSON）产生冲突

### 14.2 数据类型适合度分析

| 数据类型           | 当前存储                                | SQLite 适合？        | 理由                                    |
| ------------------ | --------------------------------------- | -------------------- | --------------------------------------- |
| 文档内容           | `Projects/{pid}/documents/{did}.json` | ❌                   | 插件 pluginData 灵活性、人类可读        |
| 插件存储           | `plugin-storage.json`                 | ❌                   | 按 pluginId 命名空间隔离，JSON 嵌套结构 |
| 设置/偏好          | `settings.json`                       | ❌                   | 小文件、低频写入                        |
| 工作区状态         | `workspace-state.json`                | ❌                   | 小文件                                  |
| **版本历史** | 内嵌在文档 JSON                         | ✅**非常适合** | 增长无限、全文快照膨胀                  |
| **对话记录** | `conversations.json`                  | ✅**适合**     | 单文件可能很大、频繁追加                |
| **搜索索引** | 无（每次遍历文件）                      | ✅**非常适合** | FTS5 性能远超文件遍历                   |

### 14.3 精准引入范围（仅 3 个 SQLite 数据库文件）

1. **`~/AiDocPlus/versions.db`** — 版本历史存储

   - 将 `Document.versions[]` 数组从文档 JSON 中移出
   - 表结构：`versions(id, document_id, content, created_at, description)`
   - 文档 JSON 中只保留 `currentVersionId`
2. **`~/AiDocPlus/conversations.db`** — 对话记录

   - 替代 `conversations.json` 单文件
   - 表结构：`conversations(id, title, created_at)` + `messages(id, conversation_id, role, content, timestamp)`
3. **`~/AiDocPlus/search.db`** — 全文搜索索引

   - 使用 SQLite FTS5 扩展
   - 文档保存时自动更新索引，搜索走 FTS5 而非文件遍历
   - 索引损坏可从 JSON 文件重建，不影响数据安全

### 14.4 接口隔离设计（关键）

```
┌─────────────────────────────────┐
│        前端 Zustand Stores       │
│  (不关心后端用 JSON 还是 SQLite)  │
└──────────┬──────────────────────┘
           │ invoke('save_document', ...)
           │ invoke('list_versions', ...)
           │ invoke('search_documents', ...)
           ▼
┌─────────────────────────────────┐
│     Tauri Commands（接口层）      │
│  参数和返回值结构不变             │
└──────────┬──────────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
 JSON 文件    SQLite DB
 (文档/设置)  (版本/对话/搜索)
```

**核心原则**：前端和插件完全不知道后端用了 SQLite。Tauri Command 的接口（参数类型、返回类型）保持不变。SQLite 是纯后端实现细节。

### 14.5 与插件系统的兼容性

这种设计**完全兼容插件系统**：

- 插件通过 `PluginHostAPI.docData` 读写 `Document.pluginData`（JSON 字段），仍在 JSON 文件中
- 插件通过 `PluginHostAPI.storage` 读写 `plugin-storage.json`，不受影响
- 插件通过 `PluginHostAPI.platform.invoke()` 调用后端命令，接口不变
- SQLite 只存储**插件不需要直接访问的数据**（版本快照、对话消息、搜索索引）
- ⭐⭐⭐ | 🔧🔧 | **P1**（更新原 §6.1 的方案）

---

## 十五、低成本资源利用策略

### 15.1 免费资源清单

| 需求       | 推荐方案                                  | 月成本   |
| ---------- | ----------------------------------------- | -------- |
| CI/CD      | GitHub Actions (2000 分钟/月)             | ¥0      |
| 官网托管   | Cloudflare Pages / GitHub Pages           | ¥0      |
| 文档站     | VitePress + GitHub Pages                  | ¥0      |
| 自动更新   | GitHub Releases +`tauri-plugin-updater` | ¥0      |
| 用户反馈   | GitHub Issues / Discussions               | ¥0      |
| 社区论坛   | Discord 或 GitHub Discussions             | ¥0      |
| 错误监控   | Sentry 免费层 (5000 事件/月)              | ¥0      |
| 授权验证   | Cloudflare Workers                        | ¥0      |
| 用户数据库 | Supabase 免费层 (500MB)                   | ¥0      |
| 文件存储   | Cloudflare R2 (10GB)                      | ¥0      |
| 支付       | LemonSqueezy                              | 按交易量 |
| 邮件服务   | Resend 免费层 (100 封/天)                 | ¥0      |
| 分析统计   | Cloudflare Analytics                      | ¥0      |

### 15.2 关键"白嫖"策略

1. **GitHub 生态**：Issues（工单）、Discussions（社区）、Actions（CI/CD）、Releases（分发）、Pages（官网）—— 全部免费
2. **Cloudflare 生态**：Pages（文档站）、Workers（授权 API）、R2（文件存储）、Analytics（统计）—— 免费层足够起步
3. **开源身份优势**（BSL 虽非严格开源，但可申请许多开源计划）：JetBrains 开源许可证、1Password Teams 免费、Notion 团队免费

---

## 十六、跨平台战略

### 16.1 当前平台支持矩阵

| 维度                 | macOS (Apple Silicon) | Windows x64             | Windows ARM64         | macOS Intel         |
| -------------------- | --------------------- | ----------------------- | --------------------- | ------------------- |
| **代码分支**   | ✅ 完整               | ✅ 完整                 | ✅ 完整               | ✅ 同 macOS         |
| **CI 构建**    | ✅`macos-latest`    | ✅`windows-latest`    | ❌ 无 CI runner       | ❌ 未配置           |
| **本地构建**   | ✅ 主力开发环境       | ✅ Parallels ARM64 脚本 | ✅ 同左               | —                  |
| **安装包格式** | `.dmg`              | NSIS `.exe`           | NSIS `.exe`（本地） | —                  |
| **WebView**    | WebKit (WKWebView)    | WebView2 (Chromium)     | WebView2              | WebKit              |
| **TTS**        | AVSpeechSynthesizer   | SAPI 5                  | SAPI 5                | AVSpeechSynthesizer |
| **自动更新**   | ❌                    | ❌                      | ❌                    | ❌                  |
| **发布状态**   | ✅ 已发布             | ✅ 已发布               | 仅本地构建            | ❌                  |

**总结**：macOS Apple Silicon 和 Windows x64 是已验证的双平台。macOS Intel 和 Windows ARM64 有潜在能力但未纳入 CI。

### 16.2 已有跨平台基础设施盘点

#### Rust 后端（6 个文件使用 `#[cfg(target_os)]`）

| 文件            | 平台分支内容                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `resource.rs` | 资源管理器启动：macOS `.app` + `open -a` / Windows `.exe` + `CREATE_NEW_PROCESS_GROUP` |
| `export.rs`   | 文件打开：`open` / `cmd /c start` / `xdg-open`；应用候选列表（WPS、Word、Chrome 等）                            |
| `python.rs`   | Python 发现：候选命令名（Windows:`py`）、常见路径（macOS: homebrew）、pyenv/conda              |
| `nodejs.rs`   | Node.js 路径查找：`where`（Windows） / `which`（Unix）                                                            |
| `pandoc.rs`   | Pandoc 路径查找：同上                                                                                                 |
| `pdf.rs`      | 浏览器打开：同 `export.rs`                                                                                          |

#### 前端 TypeScript

- **快捷键显示**：`navigator.platform?.includes('Mac')` 切换 `⌘` / `Ctrl`（5+ 处）
- **PlatformAPI**：插件通过 `PluginHostAPI.platform` 访问后端能力，不直接依赖 Tauri
- **字体 fallback**：插件框架 7 处已修复为跨平台链（`"Songti SC", "SimSun", "STSong", serif`）
- **全局 CSS**：`index.css` 使用 `-apple-system, BlinkMacSystemFont, 'Segoe UI'...` 系统字体栈

#### 构建与发布

- **`tauri.conf.json`** bundle targets: `["dmg", "nsis"]`（仅双平台）
- **`build.yml`**：GitHub Actions 构建 Windows x64，`tauri-apps/tauri-action` 自动构建+发布（Monorepo 后仅需 checkout 一个仓库）
- **`scripts/windows/`**：Parallels VM 本地 ARM64 构建的完整 PowerShell 脚本
- **`scripts/build-resources.sh`**：资源构建脚本（替代原 assemble.sh + 各 deploy.sh）
- **CLAUDE.md**：已有完整的代码跨平台规范和脚本兼容规范

### 16.3 短期目标：完善桌面双平台（P1）

#### 16.3.1 macOS Universal Binary

**当前状态**：仅构建 `aarch64-apple-darwin`（Apple Silicon），Intel Mac 用户无法使用。

**实施方案**：

- CI 中改用 `--target universal-apple-darwin`，Tauri 会自动构建 fat binary
- 需要安装两个 Rust target：`aarch64-apple-darwin` + `x86_64-apple-darwin`
- 安装包体积约增加 40~60%（两份二进制）
- **替代方案**：分开构建两个 `.dmg`，下载页按芯片类型提供
- **开发成本**：约 1 天（CI 配置修改）
- ⭐⭐ | 🔧 | **P1**

#### 16.3.3 Windows ARM64 CI

**当前状态**：有完整的 Parallels 本地构建脚本（`01-setup-env.ps1` + `02-build.ps1`），但 GitHub Actions 无 ARM64 Windows runner。

**可选方案**：

- **方案 A**：保持本地 Parallels 构建，手动上传到 Release（当前做法）
- **方案 B**：GitHub Actions `windows-latest` 上交叉编译 `aarch64-pc-windows-msvc`（需额外 Rust target，`ring` crate 需要 clang）
- **方案 C**：使用 Azure DevOps 的 ARM64 runner（付费）
- **推荐**：短期用方案 A（已验证），中期尝试方案 B
- ⭐ | 🔧🔧 | **P2**

### 16.4 中期目标：自动更新与分发渠道（P1~P2）

#### 16.4.1 tauri-plugin-updater 集成 ✅ 已完成

**已完成**（2026-03-11，与 §10.3 合并实施）：

- ✅ `tauri-plugin-updater` v2 集成（`Cargo.toml` + `main.rs`）
- ✅ `tauri.conf.json` 配置 pubkey + GitHub Releases `latest.json` endpoint
- ✅ `createUpdaterArtifacts: true`，构建自动生成更新 manifest
- ✅ `UpdateChecker.tsx` 前端组件 + `check_update` 菜单项
- ✅ 安装模式 `passive`（静默下载 + 提示安装）
- ✅ macOS 代码签名 + Apple 公证已配置（`release.sh`）

**待优化**（P2）：

- 更新通道（`stable` / `beta`）
- ~~⭐⭐⭐ | 🔧🔧 | **P0**~~ → **已完成**

#### 16.4.2 平台包管理器上架

| 平台    | 包管理器                 | 难度                   | 优先级 |
| ------- | ------------------------ | ---------------------- | ------ |
| macOS   | **Homebrew Cask**  | 🔧（提交 formula PR）  | P1     |
| Windows | **winget**         | 🔧（提交 manifest PR） | P1     |

- 提交到 Homebrew/winget 仓库只需写 manifest 文件指向 GitHub Release 下载链接

### 16.5 长期目标：移动端与 Web（P3）

#### 16.5.1 Tauri Mobile（Android/iOS）

**Tauri 2.x 已支持 Android 和 iOS**，但 AiDocPlus 迁移面临重大挑战：

| 挑战                  | 说明                             | 解决思路                                    |
| --------------------- | -------------------------------- | ------------------------------------------- |
| **UI 响应式**   | 五面板布局无法在手机上使用       | 重新设计移动端单面板 UI，仅保留编辑+AI 聊天 |
| **文件系统**    | 移动端无自由文件系统             | 改用应用沙箱目录 + 云同步（§12.2）         |
| **TTS**         | `tts` crate 不支持 Android/iOS | 使用系统原生 TTS API（需 Rust 桥接）        |
| **Python/Node** | 移动端无法运行                   | 编程区功能不可用，或使用 WebAssembly 替代   |
| **Pandoc**      | 移动端无法安装                   | 导出功能受限，仅支持 HTML/Markdown          |
| **插件**        | 当前插件 UI 假设桌面尺寸         | 需要响应式插件布局规范                      |

**建议**：移动端定位为**轻量级伴侣应用**，核心功能只保留：

- 文档查看和基本编辑
- AI 聊天
- 云同步读取桌面端创建的项目

**不建议移植到移动端的功能**：编程区、PPT 生成、资源管理器、Pandoc 导出

- ⭐⭐ | 🔧🔧🔧 | **P3**

#### 16.5.2 Web 版

**可行性分析**：AiDocPlus 深度依赖 Tauri 后端，直接移植为 Web 应用需要：

| 依赖     | 桌面实现                      | Web 替代方案                             |
| -------- | ----------------------------- | ---------------------------------------- |
| 文件系统 | Rust `std::fs`              | File System Access API 或云存储          |
| AI 请求  | Rust `reqwest`              | 需要代理服务器（API Key 不能暴露在前端） |
| TTS      | Rust `tts` crate            | Web Speech API                           |
| 进程执行 | Rust `Command`              | 不可用 / WebAssembly / 云端执行          |
| 原生导出 | Rust `docx-rs` / `comrak` | 可编译为 WASM 或使用 JS 库替代           |

**推荐路径**：不做全功能 Web 版，而是：

1. **文档预览 Web 服务**：生成只读分享链接（如 Notion 分享页面）
2. **PWA 轻量编辑器**：仅文档编辑 + AI 聊天，后端 API 化（Cloudflare Workers）
3. 桌面端仍为主力产品

- ⭐ | 🔧🔧🔧 | **P3**

### 16.6 跨平台技术债务清单

| #  | 问题                                                         | 严重度                                     | 当前状态                                    |
| -- | ------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------- |
| 1  | 无 macOS Intel 构建                                          | 中                                         | 仅 `aarch64-apple-darwin`                 |
| 2  | ~~无代码签名（macOS）~~                                     | ~~高~~                                    | ✅ 已解决：Apple Developer ID 签名 + 公证   |
| 3  | Windows 无代码签名                                           | 高                                         | SmartScreen 警告，用户可能放弃安装          |
| 4  | `discover_pythons` 中 conda/pyenv 路径检测无 Windows 版    | 低                                         | Windows 使用 `where` 但未检查 conda/pyenv |
| 5  | ✅ 已解决：菜单文本硬编码中文（`main.rs`）                 | ✅ 已解决：`menu_i18n.rs` 动态中英文菜单 |                                             |

### 16.7 代码签名战略 🟡 macOS 已完成

**已完成**（2026-03-11）：

- ✅ **macOS 代码签名 + Apple 公证**：`scripts/release.sh` 集成 Apple Developer ID 签名 + `xcrun notarytool` 公证。
- ✅ 签名配置已用于 `tauri-plugin-updater` 自动更新。

**待完成**：

- ❌ **Windows 代码签名**：SmartScreen 显示“未知发布者”警告，部分企业 IT 策略直接阻止。

**Windows 签名成本**：

| 方案                                       | 年费        |
| ------------------------------------------ | ----------- |
| EV Code Signing Certificate（如 DigiCert） | $400~600/年 |
| OV Code Signing（如 Certum）               | $60~100/年  |

**建议**：Windows 短期可用 OV 证书（约 ￥400/年），消除 SmartScreen 警告需要建立声誉（一定下载量后自动信任）。

- macOS：✅ **已完成**
- Windows：⭐⭐⭐ | 🔧 | **P0**（商业发布前置条件）

---

## 十七、IM Bot 桥接服务（2026-03-11 新增）

### 17.1 现状 ✅ 基础已实现

**架构**：独立 Node.js 服务（`/Users/jdh/Code/AiDocPlus/apps/im-bot/`），通过 HTTP API 连接主程序。

**已实现功能**：

- ✅ **四渠道消息接入**：飞书（长连接，已测试）、钉钉、企微、QQ（代码骨架已有）
- ✅ **命令路由**（`/Users/jdh/Code/AiDocPlus/apps/im-bot/src/router/command.ts`）：`/帮助`、`/项目列表`、`/AI写作 --save`、`/创建文档` 等
- ✅ **AI 自由对话路由**（`/Users/jdh/Code/AiDocPlus/apps/im-bot/src/router/ai.ts`）：非命令消息自动转 AI 对话
- ✅ **会话上下文管理**（`/Users/jdh/Code/AiDocPlus/apps/im-bot/src/session.ts`）：每用户独立会话，超时自动清理
- ✅ **写作工作流**（`/Users/jdh/Code/AiDocPlus/apps/im-bot/src/workflows/writing.ts`）：分步引导式 AI 写作
- ✅ **消息去重**：飞书长连接 SDK 重发消息 `message_id` 去重（5 分钟 TTL）
- ✅ **主程序集成**：设置面板启停控制（`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/imbot.rs`）、自动启动开关
- ✅ **文档外部变更通知**：IM Bot 创建/保存文档后，主程序前端自动刷新文档列表

**代码规模**：3,182 行 TypeScript

### 17.2 待完善

| 改进项                | 说明                                               | 优先级 |
| --------------------- | -------------------------------------------------- | ------ |
| 钉钉/企微/QQ 渠道测试 | 代码骨架已有，需实际测试和完善                     | P1     |
| 更多命令支持          | `/搜索`、`/导出`、`/版本列表`、`/模板列表` | P1     |
| 群聊权限控制          | 白名单用户、管理员权限分级                         | P1     |
| 消息队列和速率限制    | 防止消息风暴，保护 API 服务                        | P1     |
| 富文本卡片消息        | 飞书卡片消息、钉钉 ActionCard 等渠道特性           | P2     |
| 多实例管理            | 支持同时连接多个飞书/钉钉应用                      | P2     |
| Bot 管理 Web UI       | 独立的 Bot 配置和监控界面                          | P3     |

- ⭐⭐ | 🔧🔧 | **P1**

---

## 十八、CLI 与 Deep Link（2026-03-11 新增）

### 18.1 现状 ✅ 基础已实现

**CLI 命令行**（`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/cli.rs`）：

- ✅ `aidocplus --version`：打印版本号
- ✅ `aidocplus api status`：查询 API Server 运行状态
- ✅ `aidocplus api schema`：输出 API 自描述（所有命名空间和操作）
- ✅ `aidocplus api call <namespace.action> [--params JSON]`：直接调用 API
- ✅ Windows release 模式自动 `AttachConsole`（使 stdout 可见）
- ✅ CLI 命令在 Tauri 启动前处理，无需启动 GUI 窗口

**Deep Link**（`tauri-plugin-deep-link`）：

- ✅ `aidocplus://` URL Scheme 已注册
- ✅ 事件监听：`deep-link://new-url` → `deep-link:open` 转发到前端

### 18.2 待完善

| 改进项               | 说明                                                             | 优先级 |
| -------------------- | ---------------------------------------------------------------- | ------ |
| Deep Link 路由       | `aidocplus://open?project=xxx&doc=xxx` 打开指定文档            | P2     |
| CLI 更多子命令       | `aidocplus export`、`aidocplus create`、`aidocplus search` | P2     |
| CLI 交互模式         | `aidocplus shell` 进入交互式 REPL                              | P3     |
| Deep Link 第三方集成 | 从浏览器、其他应用打开 AiDocPlus 并执行操作                      | P3     |

- ⭐ | 🔧 | **P2**

---

## 实施优先级总览（2026-03-11 重排）

> 以下已移除已完成项（§10.3 自动更新、§16.4.1 updater 集成、§16.7 macOS 签名），并根据最新项目状态重新评估优先级。

### ✅ 已完成项（存档）

| 编号       | 改进项                                                                                                        | 完成日期   |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| 10.3       | 自动更新（tauri-plugin-updater）                                                                              | 2026-03-11 |
| 16.4.1     | tauri-plugin-updater 集成                                                                                     | 2026-03-11 |
| 16.7 macOS | macOS 代码签名 + Apple 公证                                                                                   | 2026-03-11 |
| 9.2 部分   | 菜单国际化（menu_i18n.rs）                                                                                    | 2026-03-11 |
| 7.2 部分   | 关闭标签释放内容 + 临时文件清理                                                                               | 2026-03-11 |
| 7.3 部分   | useShallow 精确订阅 + useAppStore 拆分                                                                        | 2026-03-11 |
| 8.1 部分   | keyring 集成（email SMTP）                                                                                    | 2026-03-11 |
| 新增       | IM Bot 桥接服务基础实现                                                                                       | 2026-03-11 |
| 新增       | CLI 命令行 + Deep Link                                                                                        | 2026-03-11 |
| 新增       | 文档级 AI 服务切换                                                                                            | 2026-03-11 |
| 8.1 余     | AI API Key 迁移到 keyring                                                                                     | 2026-03-11 |
| 2.2        | AI 提供商抽象层重构（Provider 注册表 + apply_auth）                                                           | 2026-03-11 |
| 5.1        | 导出质量提升（DOCX 嵌套列表/删除线/任务列表/代码块灰色背景 + PDF 应用内预览 + HTML CSS 增强 + 邮件 CSS 同步） | 2026-03-11 |
| 8.3        | 网络安全（代理/超时配置）                                                                                     | 2026-03-11 |
| 10.1       | 错误处理体系化（后端 AppError + 前端 formatBackendError 全量替换）                                            | 2026-03-11 |
| 9.2 余     | Rust 错误码国际化（ErrorCode → i18n errors.backend.* 中英文翻译）                                            | 2026-03-11 |

### P0 — 立即实施（1~2 个月）

| 编号     | 改进项                      | 重要性 | 复杂度 | 说明                         |
| -------- | --------------------------- | ------ | ------ | ---------------------------- |
| 16.7 Win | Windows 代码签名（OV 证书） | ⭐⭐⭐ | 🔧     | SmartScreen 警告影响用户安装 |
| 13.2     | 帮助文档迁移到 VitePress    | ⭐⭐   | 🔧     | 当前文档分散                 |

### P1 — 近期实施（2~4 个月）

| 编号    | 改进项                                          | 重要性 | 复杂度 | 说明                          |
| ------- | ----------------------------------------------- | ------ | ------ | ----------------------------- |
| 11.1    | BSL 1.1 授权协议                                | ⭐⭐⭐ | 🔧     | 原 P0，可在正式商业发布前迁移 |
| 2.1     | 多模态 AI 支持                                  | ⭐⭐⭐ | 🔧🔧   | ✅ 已完成                     |
| 7.2 余  | 内存管理（按需加载/版本惰性加载）               | ⭐⭐⭐ | 🔧🔧   | ✅ 已完成                     |
| 17.2    | IM Bot 完善（渠道测试/更多命令）                | ⭐⭐   | 🔧🔧   | 新增                          |
| 12.1    | 文件级云同步（自定义数据目录）                  | ⭐⭐⭐ | 🔧     | ✅ 已完成                     |
| 14      | SQLite 精准引入（版本/对话/搜索）               | ⭐⭐⭐ | 🔧🔧   | ✅ 已完成                     |
| 1.3     | 编辑器性能优化                                  | ⭐⭐   | 🔧🔧   | ✅ 已完成                     |
| 1.5     | 文档大纲增强                                    | ⭐     | 🔧     | ✅ 已完成                     |
| 2.3     | Tool Calling 扩展                               | ⭐⭐   | 🔧🔧   |                               |
| 2.4     | 对话上下文管理                                  | ⭐⭐   | 🔧🔧   | ✅ 已完成                     |
| 2.5     | RAG 系统                                        | ⭐⭐⭐ | 🔧🔧🔧 |                               |
| 3.1     | 插件沙箱隔离                                    | ⭐⭐⭐ | 🔧🔧🔧 |                               |
| 3.3     | 插件 SDK 增强                                   | ⭐⭐   | 🔧🔧   |                               |
| 3.4     | 插件生命周期完善                                | ⭐     | 🔧     |                               |
| 6.2     | 自动备份与恢复                                  | ⭐⭐   | 🔧🔧   |                               |
| 7.1     | 启动速度优化                                    | ⭐⭐   | 🔧🔧   | ✅ 已完成                     |
| 7.3 余  | 前端渲染优化（独立 store/虚拟列表）             | ⭐⭐   | 🔧🔧   | 部分完成                      |
| 8.2     | 文件系统安全                                    | ⭐⭐   | 🔧     | ✅ 已完成                     |
| 9.1     | 快捷键体系完善                                  | ⭐⭐   | 🔧🔧   |                               |
| 9.2 余  | 国际化完善（Rust 错误码）                       | ⭐⭐   | 🔧🔧   | ✅ 已完成                     |
| 10.1    | 错误处理体系化（后端+前端）                     | ⭐⭐   | 🔧🔧   | ✅ 已完成                     |
| 10.2    | 日志与遥测                                      | ⭐⭐   | 🔧🔧   |                               |
| 10.4    | 测试体系建设                                    | ⭐⭐   | 🔧🔧   |                               |
| 16.3.1  | macOS Universal Binary（Intel + Apple Silicon） | ⭐⭐   | 🔧     |                               |
| 16.4.2a | Homebrew Cask + winget 上架                     | ⭐⭐   | 🔧     |                               |

### P2 — 中期实施（4~8 个月）

| 编号    | 改进项                                   | 重要性 | 复杂度 | 说明 |
| ------- | ---------------------------------------- | ------ | ------ | ---- |
| 11.2    | 授权验证服务 + 功能分层（社区版/专业版） | ⭐⭐⭐ | 🔧🔧   |      |
| 12.2    | Cloudflare R2 + Workers 云同步（专业版） | ⭐⭐   | 🔧🔧   |      |
| 1.2     | 结构化文档模型                           | ⭐⭐   | 🔧🔧🔧 |      |
| 1.4     | 所见即所得模式                           | ⭐⭐   | 🔧🔧🔧 |      |
| 2.6     | AI 写作 Agent                            | ⭐⭐   | 🔧🔧🔧 |      |
| 3.2     | 插件市场                                 | ⭐⭐   | 🔧🔧🔧 |      |
| 4.1     | LSP 集成                                 | ⭐⭐   | 🔧🔧🔧 |      |
| 4.2     | 终端集成                                 | ⭐⭐   | 🔧🔧🔧 |      |
| 4.3     | AI 代码助手增强                          | ⭐⭐   | 🔧🔧   |      |
| 5.2     | 发布渠道集成                             | ⭐⭐   | 🔧🔧   |      |
| 9.3     | 无障碍                                   | ⭐     | 🔧🔧   |      |
| 9.4     | 引导与帮助系统                           | ⭐     | 🔧🔧   |      |
| 18.2    | CLI/Deep Link 完善                       | ⭐     | 🔧     | 新增 |
| 16.3.3  | Windows ARM64 CI 交叉编译                | ⭐     | 🔧🔧   |      |

### P3 — 远期规划（8+ 个月）

| 编号   | 改进项                                   | 重要性 | 复杂度 |
| ------ | ---------------------------------------- | ------ | ------ |
| 1.1    | 协同编辑基础（CRDT）                     | ⭐⭐⭐ | 🔧🔧🔧 |
| 12.3   | WebSocket 实时协同                       | ⭐⭐   | 🔧🔧🔧 |
| 16.5.1 | Tauri Mobile 轻量伴侣应用（Android/iOS） | ⭐⭐   | 🔧🔧🔧 |
| 16.5.2 | Web 版（文档预览分享 + PWA 轻量编辑）    | ⭐     | 🔧🔧🔧 |
| 4.4    | 项目级代码管理                           | ⭐     | 🔧🔧🔧 |

> **注**：§1.1 CRDT 协同编辑从 P1 降至 P3。短期内 AiDocPlus 定位为单用户桌面应用，多人协作需求优先级较低。远期可通过 §12 多设备同步逐步推进。

---

## 附录：关键架构发现

### A. 当前架构优势

1. **Tauri 2 + React + Rust** 技术栈选型优秀，兼顾性能与开发效率。
2. **Monorepo 统一架构**：源码、插件、资源数据在同一仓库，`build-resources.sh` 一键构建，消除多仓库同步问题。
3. **插件系统设计成熟**：29 个内置插件，两角色原则、自注册机制、Host API 隔离、统一 `_framework/`。
4. **安全意识良好**：ZIP 炸弹防护、ReDoS 防护、命令白名单、keyring 密钥链（email）。
5. **工作区持久化**完整：标签页状态、面板布局、侧边栏宽度等均可恢复。
6. **资源管理器已合并到主程序**：Tauri 多窗口机制，无需独立构建和部署。
7. **完整的自动更新链路**：签名 → 公证 → 构建 → 上传 → updater manifest → 客户端检查 + 安装。
8. **开放 API 生态**：HTTP API + CLI + Deep Link + MCP Server + IM Bot，外部工具可全面接入。
9. **文档级 AI 服务隔离**：每个文档可绑定不同 AI 服务，灵活性高。
10. **前端性能优化基础**：useShallow 精确订阅 + useAppStore 模块化拆分。

### B. 当前架构风险（2026-03-11 更新）

1. ~~**单一大 Store**（`useAppStore` ~1800 行）~~ → 🟡 已拆分为 16 个 helper 模块，但仍为单一 store 入口。
2. **JSON 文件存储**：无事务保证、无并发控制、查询效率低。
3. **AI 提供商硬编码**：添加新提供商需修改核心逻辑，耦合度高。
4. **插件无沙箱**：在同一 JS 上下文运行，安全边界仅靠白名单。
5. **AI API Key 明文存储**：keyring 已集成但 AI Key 尚未迁移。
6. ~~**无自动更新**~~ → ✅ 已解决。
7. **无测试覆盖**：重构时缺乏安全网。
8. **Windows 无代码签名**：SmartScreen 警告影响安装体验。
9. **IM Bot 钉钉/企微/QQ 渠道未实测**：代码骨架已有但可能存在兼容性问题。

---

*文档生成日期：基于对 AiDocPlus 代码库的深入分析*
*分析范围：前端（src-ui）、后端（src-tauri）、共享类型、插件框架、资源管理器、资源数据、IM Bot*
*§11~§15 战略讨论补充日期：2026-02-27*
*§16 跨平台战略补充日期：2026-02-27*
*Monorepo 合并 + 状态更新日期：2026-02-27*
*§17~§18 新增 + 全面状态更新 + 优先级重排日期：2026-03-11*
