# AiDocPlus 高端商业软件改进方向计划

> 基于对整个代码库的深入架构分析，按照高端商业软件标准，提出以下改进方向。
> 每项改进标注了 **重要性**（⭐~⭐⭐⭐）、**可行性**（🔧容易 / 🔧🔧中等 / 🔧🔧🔧复杂）和 **优先级**（P0~P3）。

### 最新状态（2026-02-27）

**✅ Monorepo 合并已完成**：6 个独立仓库（AiDocPlus-Main、AiDocPlus-Plugins、AiDocPlus-AIProviders、AiDocPlus-DocTemplates、AiDocPlus-PromptTemplates、AiDocPlus-ResourceManager）已合并为单一 `AiDocPlus` monorepo。

**当前项目规模**：
- Rust 后端：8,895 行（23 个源文件）
- TypeScript 前端：45,754 行（197 个源文件）
- 内置插件：27 个（含 `_framework/` SDK）
- AI 服务商：13 个
- 提示词模板：1,481 个（53 个分类）
- 文档模板：20 个（7 个分类）+ 8 个 PPT 主题
- Zustand Store：6 个（useAppStore 1,782 行）

**已完成的架构改进**：
- ✅ 资源管理器合并到主程序（Tauri 多窗口）
- ✅ 多仓库 → 单一 Monorepo（消除同步问题）
- ✅ 插件 `_framework/` 统一为唯一一份
- ✅ `build-resources.sh` 替代 `assemble.sh` + 各 `deploy.sh`
- ✅ CI 简化（从 checkout 6 仓库 → 1 仓库）
- ✅ Rust 编译优化（`codegen-units` 1→8）
- ✅ SQLite 资源引擎移除（回归 JSON 文件模式）
- ✅ 角色系统、项目模板功能完全移除
- ✅ 插件框架字体跨平台 fallback（7 处）

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

### 1.3 编辑器性能优化

- **现状**：`MarkdownEditor.tsx` 使用 CodeMirror 6，支持语法高亮、自动补全、lint 等。大文档时可能存在性能瓶颈。
- **建议**：
  - 实现**虚拟滚动 / 文档分片**，对超长文档（>10 万字）仅渲染可视区域。
  - 预览模式（`MarkdownPreview`）使用 `requestIdleCallback` 延迟渲染非可视区域。
  - 自动保存节流：当前 `EditorPanel` 使用 `useRef` + `setInterval`，建议改为 **debounce + 脏标记**，减少不必要的磁盘写入。
- ⭐⭐ | 🔧🔧 | **P1**

### 1.4 富文本 / 所见即所得（WYSIWYG）模式

- **现状**：纯 Markdown 编辑 + 分栏预览。
- **问题**：非技术用户（如公务员、律师、记者）不熟悉 Markdown 语法。
- **建议**：基于 [ProseMirror](https://prosemirror.net/) 或 [Tiptap](https://tiptap.dev/) 增加可选的所见即所得模式，底层仍存储 Markdown，编辑时提供富文本体验。可作为高级付费功能。
- ⭐⭐ | 🔧🔧🔧 | **P2**

### 1.5 文档大纲与导航增强

- **现状**：`DocumentOutline` 组件已存在，但功能较基础。
- **建议**：
  - 支持**拖拽重排**章节（移动标题及其下属内容）。
  - 显示每章节的字数统计。
  - 支持**折叠/展开**编辑器中的章节。
  - 增加**面包屑导航**，显示当前光标所在章节路径。
- ⭐ | 🔧 | **P1**

---

## 二、AI 功能链路（ai.rs / commands/ai.rs / ChatPanel）

### 2.1 多模态支持（图像/文件理解）

- **现状**：`ChatMessage` 只有 `role` 和 `content`（字符串），不支持图片/文件附件。虽然 `Document` 有 `attachments` 字段，但 AI 链路不使用它们。
- **建议**：
  - 扩展 `ChatMessage` 支持多模态内容（`content` 改为 `Vec<ContentPart>`，包含 text/image_url/file 类型）。
  - 支持将文档附件（图片）发送给 Vision 模型进行分析。
  - 支持 PDF/图片 OCR 后注入 AI 上下文。
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

### 2.4 对话上下文管理优化

- **现状**：`useConversationsStore` 将对话持久化到 `~/AiDocPlus/conversations.json`（单文件）。所有对话消息全量序列化。
- **问题**：对话量增长后，单文件读写性能下降。消息历史无限增长会超出 AI 模型的 token 限制。
- **建议**：
  - 实现**滑动窗口 + 摘要**策略：当消息数超过阈值时，自动用 AI 总结早期对话，保留摘要。
  - 对话存储改为**按对话 ID 分文件**或使用嵌入式数据库（如 SQLite）。
  - 支持**对话分支**（从某条消息重新开始不同方向的对话）。
  - 显示**当前 token 使用量**指示器。
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

### 7.1 应用启动速度

- **现状**：`App.tsx` 启动时并行加载插件、文档模板、提示词模板、分类，然后恢复工作区。
- **建议**：
  - 实现**渐进式加载**：先显示上次的工作区快照（缓存的 UI 状态），后台加载数据。
  - **延迟初始化**非当前可见的面板（编程区、功能区等仅在首次切换时初始化）。
  - 使用 **React.lazy + Suspense** 拆分代码，减小首屏 JS 包大小。
  - Rust 侧：将 `AppState::new()` 中的目录创建改为异步。
- ⭐⭐ | 🔧🔧 | **P1**

### 7.2 内存管理

- **现状**：`useAppStore` 在内存中保持所有文档的完整数据（包括 `content`、`ai_generated_content`、`versions` 数组）。
- **问题**：打开多个大文档时内存占用线性增长。`versions` 数组可包含上千个全文快照。
- **建议**：
  - **按需加载文档内容**：`documents` 列表只保存元数据，内容在打开标签页时按需加载。
  - **版本惰性加载**：`versions` 不随文档一起加载，仅在查看版本历史时请求。
  - 关闭标签页时**释放文档内容**，仅保留元数据缓存。
- ⭐⭐⭐ | 🔧🔧 | **P0**

### 7.3 前端渲染优化

- **现状**：`useAppStore` 是一个大型 Zustand store，包含 ~1800 行代码和几十个 action。所有组件从同一 store 读取状态。
- **问题**：任何状态变化都可能触发大量不必要的重渲染。
- **建议**：
  - 将 `useAppStore` **拆分为多个独立 store**：`useProjectStore`、`useDocumentStore`、`useTabStore`、`useAIStore`。
  - 使用 Zustand 的 **selector** 精确订阅，避免不相关状态变化触发重渲染。
  - 对 `ChatPanel` 中的消息列表使用**虚拟化列表**（`react-window` 或 `@tanstack/react-virtual`）。
  - `EditorPanel` 的复杂 props 传递改为 **Context + Provider** 模式。
- ⭐⭐ | 🔧🔧 | **P1**

---

## 八、安全性

### 8.1 API Key 安全存储

- **现状**：AI 服务 API Key 存储在 `settings.json` 中，明文保存在 `~/AiDocPlus/settings.json`。
- **问题**：任何能读取用户目录的程序都能获取 API Key。
- **建议**：
  - 使用**操作系统密钥链**存储敏感信息：macOS Keychain、Windows Credential Manager、Linux Secret Service。
  - Tauri 2 提供 `tauri-plugin-keyring` 可直接使用。
  - `settings.json` 中只保存 Key 的引用标识符，实际值从密钥链获取。
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

### 9.2 国际化完善

- **现状**：使用 `react-i18next`，有中英文支持。但 Rust 后端的错误消息和菜单文本是硬编码中文。
- **问题**：`main.rs` 菜单文本如 "文件"、"编辑"、"视图" 等为硬编码中文，无法切换语言。后端错误消息如 "文档未找到"、"读取文件失败" 也是硬编码中文。
- **建议**：
  - Rust 后端错误消息改为**错误码**，前端根据错误码翻译显示。
  - 系统菜单根据当前语言设置**动态构建**。
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

### 10.1 错误处理体系化

- **现状**：`error.rs` 定义了 `AppError` 枚举，但 `Result<T>` 被重定义为 `Result<T, String>`，大量命令直接返回 `String` 错误。
- **问题**：错误信息丢失了结构化类型，前端无法区分错误类别进行不同处理。
- **建议**：
  - 定义**结构化错误码**体系（类似 HTTP 状态码）。
  - 后端返回 `{ code: string, message: string, details?: object }` 格式。
  - 前端根据错误码显示对应的用户友好消息和可选的操作建议。
  - 实现**全局错误边界**（React Error Boundary）和崩溃报告。
- ⭐⭐ | 🔧🔧 | **P1**

### 10.2 日志与遥测

- **现状**：使用 `console.error` / `eprintln!` 输出错误。无结构化日志，无性能监控。
- **建议**：
  - Rust 侧引入 `tracing` crate，实现结构化日志。
  - 前端实现 **Error Reporting** 服务（可选匿名崩溃报告）。
  - 性能指标收集：启动时间、AI 响应延迟、文档保存耗时。
  - 提供**日志查看器**（帮助菜单中可打开日志文件）。
- ⭐⭐ | 🔧🔧 | **P1**

### 10.3 自动更新

- **现状**：未实现自动更新机制。
- **建议**：
  - 使用 Tauri 2 的 `tauri-plugin-updater` 实现**自动检查更新**。
  - 支持**静默后台下载 + 提示安装**。
  - 实现**增量更新**（仅下载变更部分）。
  - 支持**更新通道**（稳定版 / 预览版 / 测试版）。
- ⭐⭐⭐ | 🔧🔧 | **P0**

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

| 层级 | 定价 | 内容 |
|------|------|------|
| **社区版**（免费） | ¥0 | 本地 AI 写作全功能（用户自带 API Key）、基础插件（~10 个）、3 个项目 / 每项目 50 文档、单设备 |
| **专业版** | ¥99~199/年 | 无限项目和文档、全部 27 个插件、多设备同步、高级导出模板、RAG 知识库、优先邮件支持 |
| **企业版** | 按需 | 私有化部署、SSO/LDAP、批量授权、定制开发、专属技术支持 |

#### 授权验证技术方案
- 用户注册 → 服务器颁发 license key（JWT 格式，含过期时间 + 功能列表）
- 客户端每 7 天向服务器验证有效性，离线宽限期 30 天
- 功能开关存储在前端 store，根据 license 动态启用/禁用
- 后端服务使用 **Cloudflare Workers**（免费 10 万请求/天）+ **Supabase**（免费 500MB PostgreSQL）

### 11.3 低成本后端服务架构

| 服务 | 推荐方案 | 月成本（起步） |
|------|----------|---------------|
| 授权验证 API | Cloudflare Workers | **¥0** |
| 用户数据库 | Supabase 免费层 | **¥0** |
| 文件同步存储 | Cloudflare R2 (10GB 免费) | **¥0~20** |
| 支付网关 | LemonSqueezy / 支付宝 | **按交易量** |
| 官网 + 文档 | GitHub Pages / Cloudflare Pages | **¥0** |
| 自动更新分发 | GitHub Releases | **¥0** |
| 错误监控 | Sentry 免费层 (5000 事件/月) | **¥0** |
| 社区论坛 | GitHub Discussions / Discord | **¥0** |

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

| 方案 | 左侧目录 | 搜索 | 成本 | 技术栈一致 |
|------|----------|------|------|----------|
| **VitePress** ⭐ | ✅ 内置 | ✅ 本地搜索 | 免费 | ✅ Vite 生态 |
| Docusaurus | ✅ 内置 | ✅ Algolia | 免费 | ❌ React 但较重 |
| Jekyll just-the-docs | ✅ 内置 | ✅ 内置 | 免费 | ❌ Ruby 生态 |
| GitBook | ✅ 内置 | ✅ 内置 | 付费/限制 | ❌ |

---

## 十四、SQLite 精准引入策略

### 14.1 历史回顾与教训

上次引入 `resource_engine.rs`（SQLite）在 2026-02-26 被**完全移除**，原因是：
- 试图用 SQLite 管理**资源模板**（提示词/文档模板），这些资源需要人类可读、git 管理、资源管理器 UI 编辑
- 把 JSON 文件模式和 SQLite 模式混用在同一数据类型上，导致两套代码路径难以维护
- 与插件系统的开放设计（插件通过 PluginHostAPI 直接读写 JSON）产生冲突

### 14.2 数据类型适合度分析

| 数据类型 | 当前存储 | SQLite 适合？ | 理由 |
|----------|----------|-------------|------|
| 文档内容 | `Projects/{pid}/documents/{did}.json` | ❌ | 插件 pluginData 灵活性、人类可读 |
| 插件存储 | `plugin-storage.json` | ❌ | 按 pluginId 命名空间隔离，JSON 嵌套结构 |
| 设置/偏好 | `settings.json` | ❌ | 小文件、低频写入 |
| 工作区状态 | `workspace-state.json` | ❌ | 小文件 |
| **版本历史** | 内嵌在文档 JSON | ✅ **非常适合** | 增长无限、全文快照膨胀 |
| **对话记录** | `conversations.json` | ✅ **适合** | 单文件可能很大、频繁追加 |
| **搜索索引** | 无（每次遍历文件） | ✅ **非常适合** | FTS5 性能远超文件遍历 |

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

| 需求 | 推荐方案 | 月成本 |
|------|----------|--------|
| CI/CD | GitHub Actions (2000 分钟/月) | ¥0 |
| 官网托管 | Cloudflare Pages / GitHub Pages | ¥0 |
| 文档站 | VitePress + GitHub Pages | ¥0 |
| 自动更新 | GitHub Releases + `tauri-plugin-updater` | ¥0 |
| 用户反馈 | GitHub Issues / Discussions | ¥0 |
| 社区论坛 | Discord 或 GitHub Discussions | ¥0 |
| 错误监控 | Sentry 免费层 (5000 事件/月) | ¥0 |
| 授权验证 | Cloudflare Workers | ¥0 |
| 用户数据库 | Supabase 免费层 (500MB) | ¥0 |
| 文件存储 | Cloudflare R2 (10GB) | ¥0 |
| 支付 | LemonSqueezy | 按交易量 |
| 邮件服务 | Resend 免费层 (100 封/天) | ¥0 |
| 分析统计 | Cloudflare Analytics | ¥0 |

### 15.2 关键"白嫖"策略

1. **GitHub 生态**：Issues（工单）、Discussions（社区）、Actions（CI/CD）、Releases（分发）、Pages（官网）—— 全部免费
2. **Cloudflare 生态**：Pages（文档站）、Workers（授权 API）、R2（文件存储）、Analytics（统计）—— 免费层足够起步
3. **开源身份优势**（BSL 虽非严格开源，但可申请许多开源计划）：JetBrains 开源许可证、1Password Teams 免费、Notion 团队免费

---

## 十六、跨平台战略

### 16.1 当前平台支持矩阵

| 维度 | macOS (Apple Silicon) | Windows x64 | Windows ARM64 | macOS Intel | Linux |
|------|-----------------------|-------------|---------------|-------------|-------|
| **代码分支** | ✅ 完整 | ✅ 完整 | ✅ 完整 | ✅ 同 macOS | ✅ `#[cfg]` 已有 |
| **CI 构建** | ✅ `macos-latest` | ✅ `windows-latest` | ❌ 无 CI runner | ❌ 未配置 | ❌ 无 |
| **本地构建** | ✅ 主力开发环境 | ✅ Parallels ARM64 脚本 | ✅ 同左 | — | ❌ 未测试 |
| **安装包格式** | `.dmg` | NSIS `.exe` | NSIS `.exe`（本地） | — | ❌ 无（缺 `deb`/`AppImage`） |
| **WebView** | WebKit (WKWebView) | WebView2 (Chromium) | WebView2 | WebKit | WebKitGTK（需安装） |
| **TTS** | AVSpeechSynthesizer | SAPI 5 | SAPI 5 | AVSpeechSynthesizer | speech-dispatcher（需安装） |
| **自动更新** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **发布状态** | ✅ 已发布 | ✅ 已发布 | 仅本地构建 | ❌ | ❌ |

**总结**：macOS Apple Silicon 和 Windows x64 是已验证的双平台。Linux 有代码基础但零构建零测试。macOS Intel 和 Windows ARM64 有潜在能力但未纳入 CI。

### 16.2 已有跨平台基础设施盘点

#### Rust 后端（6 个文件使用 `#[cfg(target_os)]`）

| 文件 | 平台分支内容 |
|------|------------|
| `resource.rs` | 资源管理器启动：macOS `.app` + `open -a` / Windows `.exe` + `CREATE_NEW_PROCESS_GROUP` / Linux 二进制直接启动 |
| `export.rs` | 文件打开：`open` / `cmd /c start` / `xdg-open`；应用候选列表（WPS、Word、Chrome 等） |
| `python.rs` | Python 发现：候选命令名（Windows: `py`）、常见路径（macOS: homebrew、Linux: `/usr/bin`）、pyenv/conda |
| `nodejs.rs` | Node.js 路径查找：`where`（Windows） / `which`（Unix） |
| `pandoc.rs` | Pandoc 路径查找：同上 |
| `pdf.rs` | 浏览器打开：同 `export.rs` |

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

### 16.3 短期目标：完善桌面三平台（P1）

#### 16.3.1 Linux 支持

**当前状态**：Rust 后端所有平台分支已包含 `#[cfg(target_os = "linux")]`，但从未构建或测试。

**实施步骤**：

1. **`tauri.conf.json`** 添加 bundle targets：
   ```json
   "targets": ["dmg", "nsis", "deb", "appimage"]
   ```
   Tauri 会根据构建平台自动选择适用的 target。

2. **CI 矩阵扩展**：`build.yml` 添加 `ubuntu-22.04` 平台
   ```yaml
   - platform: ubuntu-22.04
     args: --target x86_64-unknown-linux-gnu
     target: x86_64-unknown-linux-gnu
     artifact: deb
   ```

3. **Linux 系统依赖**文档化（Tauri 2 在 Linux 需要）：
   - 构建依赖：`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
   - 运行依赖：`libwebkit2gtk-4.1-0`, `libayatana-appindicator3-1`
   - TTS：`speech-dispatcher`（`tts` crate 在 Linux 使用此后端）

4. **测试 Linux TTS**：`tts` crate v0.26 支持 speech-dispatcher，但中文语音质量可能差异大，需标注为"实验性"

5. **资源管理器**：已合并到主程序，Linux 构建时自动包含

- **开发成本**：约 3~5 天
- **预期用户**：开发者、教育机构（Linux 桌面用户）
- ⭐⭐ | 🔧🔧 | **P1**

#### 16.3.2 macOS Universal Binary

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

#### 16.4.1 tauri-plugin-updater 集成

**当前状态**：IMPROVEMENT-PLAN §10.3 已列为 P0，但未实现。

**技术方案**：
- 安装 `tauri-plugin-updater`，配置检查 GitHub Releases 的 `latest.json`
- `tauri-apps/tauri-action` 会自动生成更新 manifest
- 支持**静默后台下载 + 提示安装**
- 实现**更新通道**：
  - `stable`：正式版（GitHub Release `latest`）
  - `beta`：预览版（GitHub Release `prerelease`）

**关键考虑**：
- macOS 更新需要代码签名（当前 `signingIdentity: "-"` 是自签名，需申请 Apple Developer ID）
- Windows 更新无签名要求但会触发 SmartScreen 警告
- Linux `AppImage` 支持 `tauri-plugin-updater`，`deb` 不支持（需用系统包管理器）

- ⭐⭐⭐ | 🔧🔧 | **P0**（与 §10.3 合并）

#### 16.4.2 平台包管理器上架

| 平台 | 包管理器 | 难度 | 优先级 |
|------|----------|------|--------|
| macOS | **Homebrew Cask** | 🔧（提交 formula PR） | P1 |
| Windows | **winget** | 🔧（提交 manifest PR） | P1 |
| Linux | **Flatpak** / Snap | 🔧🔧（需打包配置） | P2 |
| Linux | **AUR** (Arch) | 🔧（社区可维护） | P3 |

- 提交到 Homebrew/winget 仓库只需写 manifest 文件指向 GitHub Release 下载链接
- Flatpak 需编写 `.flatpak.yml` manifest，处理沙箱权限

### 16.5 长期目标：移动端与 Web（P3）

#### 16.5.1 Tauri Mobile（Android/iOS）

**Tauri 2.x 已支持 Android 和 iOS**，但 AiDocPlus 迁移面临重大挑战：

| 挑战 | 说明 | 解决思路 |
|------|------|----------|
| **UI 响应式** | 五面板布局无法在手机上使用 | 重新设计移动端单面板 UI，仅保留编辑+AI 聊天 |
| **文件系统** | 移动端无自由文件系统 | 改用应用沙箱目录 + 云同步（§12.2） |
| **TTS** | `tts` crate 不支持 Android/iOS | 使用系统原生 TTS API（需 Rust 桥接） |
| **Python/Node** | 移动端无法运行 | 编程区功能不可用，或使用 WebAssembly 替代 |
| **Pandoc** | 移动端无法安装 | 导出功能受限，仅支持 HTML/Markdown |
| **插件** | 当前插件 UI 假设桌面尺寸 | 需要响应式插件布局规范 |

**建议**：移动端定位为**轻量级伴侣应用**，核心功能只保留：
- 文档查看和基本编辑
- AI 聊天
- 云同步读取桌面端创建的项目

**不建议移植到移动端的功能**：编程区、PPT 生成、资源管理器、Pandoc 导出

- ⭐⭐ | 🔧🔧🔧 | **P3**

#### 16.5.2 Web 版

**可行性分析**：AiDocPlus 深度依赖 Tauri 后端，直接移植为 Web 应用需要：

| 依赖 | 桌面实现 | Web 替代方案 |
|------|----------|-------------|
| 文件系统 | Rust `std::fs` | File System Access API 或云存储 |
| AI 请求 | Rust `reqwest` | 需要代理服务器（API Key 不能暴露在前端） |
| TTS | Rust `tts` crate | Web Speech API |
| 进程执行 | Rust `Command` | 不可用 / WebAssembly / 云端执行 |
| 原生导出 | Rust `docx-rs` / `comrak` | 可编译为 WASM 或使用 JS 库替代 |

**推荐路径**：不做全功能 Web 版，而是：
1. **文档预览 Web 服务**：生成只读分享链接（如 Notion 分享页面）
2. **PWA 轻量编辑器**：仅文档编辑 + AI 聊天，后端 API 化（Cloudflare Workers）
3. 桌面端仍为主力产品

- ⭐ | 🔧🔧🔧 | **P3**

### 16.6 跨平台技术债务清单

| # | 问题 | 严重度 | 当前状态 |
|---|------|--------|---------|
| 1 | `tauri.conf.json` bundle targets 缺少 `deb`/`appimage` | 中 | 仅 `["dmg", "nsis"]` |
| 2 | CI 无 Linux / macOS 构建矩阵 | 中 | `build.yml` 仅 Windows x64 |
| 3 | 无 macOS Intel 构建 | 中 | 仅 `aarch64-apple-darwin` |
| 4 | 无代码签名（macOS `signingIdentity: "-"`） | 高 | 安装时会触发 Gatekeeper 警告 |
| 5 | Windows 无代码签名 | 高 | SmartScreen 警告，用户可能放弃安装 |
| 6 | Linux TTS（speech-dispatcher）中文语音未验证 | 低 | `tts` crate 理论支持 |
| 7 | Linux WebKitGTK 渲染差异未测试 | 中 | WebKitGTK 版本可能落后于 Safari |
| 8 | `index.css` 全局字体栈未包含 Linux 中文字体 | 低 | 缺少 `"Noto Sans SC"` 等 |
| 9 | `discover_pythons` 中 conda/pyenv 路径检测无 Windows 版 | 低 | Windows 使用 `where` 但未检查 conda/pyenv |
| 10 | 菜单文本硬编码中文（`main.rs`） | 中 | §9.2 已列入改进 |

### 16.7 代码签名战略（关键商业化前置条件）

**不签名的后果**：
- macOS：Gatekeeper 阻止运行，用户需右键"打开"绕过，体验极差
- Windows：SmartScreen 显示"未知发布者"警告，部分企业 IT 策略直接阻止

**签名成本**：

| 平台 | 方案 | 年费 |
|------|------|------|
| macOS | Apple Developer ID（需 Apple Developer Program） | $99/年 |
| Windows | EV Code Signing Certificate（如 DigiCert） | $400~600/年 |
| Windows（低成本） | OV Code Signing（如 Certum） | $60~100/年 |

**建议**：
- **macOS 签名是商业发布的硬性要求**，Apple Developer Program $99/年性价比极高
- Windows 签名短期可用 OV 证书（约 ¥400/年），消除 SmartScreen 警告需要建立声誉（一定下载量后自动信任）
- 签名后才能正常使用 `tauri-plugin-updater` 的自动更新功能

- ⭐⭐⭐ | 🔧 | **P0**（商业发布前置条件）

---

## 实施优先级总览

### P0 — 立即实施（1~2 个月）
| 编号 | 改进项 | 重要性 | 复杂度 |
|------|--------|--------|--------|
| 11.1 | 授权协议从 MIT 迁移到 BSL 1.1 | ⭐⭐⭐ | 🔧 |
| 13.2 | 帮助文档迁移到 VitePress | ⭐⭐ | 🔧 |
| 2.1 | 多模态 AI 支持 | ⭐⭐⭐ | 🔧🔧 |
| 2.2 | AI 提供商抽象层 | ⭐⭐⭐ | 🔧🔧 |
| 5.1 | 导出质量提升 | ⭐⭐⭐ | 🔧🔧 |
| 7.2 | 内存管理优化 | ⭐⭐⭐ | 🔧🔧 |
| 8.1 | API Key 安全存储 | ⭐⭐⭐ | 🔧 |
| 8.3 | 网络安全（超时/代理/限速） | ⭐⭐ | 🔧 |
| 10.3 | 自动更新 + tauri-plugin-updater（含 §16.4.1） | ⭐⭐⭐ | 🔧🔧 |
| 16.7 | 代码签名（macOS Developer ID + Windows OV 证书） | ⭐⭐⭐ | 🔧 |

### P1 — 近期实施（2~4 个月）
| 编号 | 改进项 | 重要性 | 复杂度 |
|------|--------|--------|--------|
| 12.1 | 文件级云同步（自定义数据目录） | ⭐⭐⭐ | 🔧 |
| 14 | SQLite 精准引入（版本/对话/搜索） | ⭐⭐⭐ | 🔧🔧 |
| 1.1 | 协同编辑基础（CRDT） | ⭐⭐⭐ | 🔧🔧🔧 |
| 1.3 | 编辑器性能优化 | ⭐⭐ | 🔧🔧 |
| 1.5 | 文档大纲增强 | ⭐ | 🔧 |
| 2.3 | Tool Calling 扩展 | ⭐⭐ | 🔧🔧 |
| 2.4 | 对话上下文管理 | ⭐⭐ | 🔧🔧 |
| 2.5 | RAG 系统 | ⭐⭐⭐ | 🔧🔧🔧 |
| 3.1 | 插件沙箱隔离 | ⭐⭐⭐ | 🔧🔧🔧 |
| 3.3 | 插件 SDK 增强 | ⭐⭐ | 🔧🔧 |
| 3.4 | 插件生命周期完善 | ⭐ | 🔧 |
| 6.2 | 自动备份与恢复 | ⭐⭐ | 🔧🔧 |
| 7.1 | 启动速度优化 | ⭐⭐ | 🔧🔧 |
| 7.3 | 前端渲染优化 | ⭐⭐ | 🔧🔧 |
| 8.2 | 文件系统安全 | ⭐⭐ | 🔧 |
| 9.1 | 快捷键体系完善 | ⭐⭐ | 🔧🔧 |
| 9.2 | 国际化完善 | ⭐⭐ | 🔧🔧 |
| 10.1 | 错误处理体系化 | ⭐⭐ | 🔧🔧 |
| 10.2 | 日志与遥测 | ⭐⭐ | 🔧🔧 |
| 10.4 | 测试体系建设 | ⭐⭐ | 🔧🔧 |
| 16.3.1 | Linux 支持（deb + AppImage + CI 矩阵） | ⭐⭐ | 🔧🔧 |
| 16.3.2 | macOS Universal Binary（Intel + Apple Silicon） | ⭐⭐ | 🔧 |
| 16.4.2a | Homebrew Cask + winget 上架 | ⭐⭐ | 🔧 |

### P2 — 中期实施（4~8 个月）
| 编号 | 改进项 | 重要性 | 复杂度 |
|------|--------|--------|--------|
| 11.2 | 授权验证服务 + 功能分层（社区版/专业版） | ⭐⭐⭐ | 🔧🔧 |
| 12.2 | Cloudflare R2 + Workers 云同步（专业版） | ⭐⭐ | 🔧🔧 |
| 1.2 | 结构化文档模型 | ⭐⭐ | 🔧🔧🔧 |
| 1.4 | 所见即所得模式 | ⭐⭐ | 🔧🔧🔧 |
| 2.6 | AI 写作 Agent | ⭐⭐ | 🔧🔧🔧 |
| 3.2 | 插件市场 | ⭐⭐ | 🔧🔧🔧 |
| 4.1 | LSP 集成 | ⭐⭐ | 🔧🔧🔧 |
| 4.2 | 终端集成 | ⭐⭐ | 🔧🔧🔧 |
| 4.3 | AI 代码助手增强 | ⭐⭐ | 🔧🔧 |
| 5.2 | 发布渠道集成 | ⭐⭐ | 🔧🔧 |
| 9.3 | 无障碍 | ⭐ | 🔧🔧 |
| 9.4 | 引导与帮助系统 | ⭐ | 🔧🔧 |
| 16.3.3 | Windows ARM64 CI 交叉编译 | ⭐ | 🔧🔧 |
| 16.4.2b | Flatpak / Snap 上架 | ⭐ | 🔧🔧 |

### P3 — 远期规划（8+ 个月）
| 编号 | 改进项 | 重要性 | 复杂度 |
|------|--------|--------|--------|
| 12.3 | WebSocket 实时协同 | ⭐⭐ | 🔧🔧🔧 |
| 16.5.1 | Tauri Mobile 轻量伴侣应用（Android/iOS） | ⭐⭐ | 🔧🔧🔧 |
| 16.5.2 | Web 版（文档预览分享 + PWA 轻量编辑） | ⭐ | 🔧🔧🔧 |
| 4.4 | 项目级代码管理 | ⭐ | 🔧🔧🔧 |

---

## 附录：关键架构发现

### A. 当前架构优势
1. **Tauri 2 + React + Rust** 技术栈选型优秀，兼顾性能与开发效率。
2. **Monorepo 统一架构**：源码、插件、资源数据在同一仓库，`build-resources.sh` 一键构建，消除多仓库同步问题。
3. **插件系统设计成熟**：27 个内置插件，两角色原则、自注册机制、Host API 隔离、统一 `_framework/`。
4. **安全意识良好**：ZIP 炸弹防护、ReDoS 防护、命令白名单。
5. **工作区持久化**完整：标签页状态、面板布局、侧边栏宽度等均可恢复。
6. **资源管理器已合并到主程序**：Tauri 多窗口机制，无需独立构建和部署。

### B. 当前架构风险
1. **单一大 Store**（`useAppStore` ~1800 行）：状态耦合度高，所有写操作都可能触发全局重渲染。
2. **JSON 文件存储**：无事务保证、无并发控制、查询效率低。
3. **AI 提供商硬编码**：添加新提供商需修改核心逻辑，耦合度高。
4. **插件无沙箱**：在同一 JS 上下文运行，安全边界仅靠白名单。
5. **API Key 明文存储**：安全隐患。
6. **无自动更新**：用户需手动下载新版本，影响持续交付。
7. **无测试覆盖**：重构时缺乏安全网。

---

*文档生成日期：基于对 AiDocPlus 代码库的深入分析*
*分析范围：前端（src-ui）、后端（src-tauri）、共享类型、插件框架、资源管理器、资源数据*
*§11~§15 战略讨论补充日期：2026-02-27*
*§16 跨平台战略补充日期：2026-02-27*
*Monorepo 合并 + 状态更新日期：2026-02-27*
