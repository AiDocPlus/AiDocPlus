# AiDocPlus 项目长期记忆

## 项目概述
- Tauri 桌面应用，支持多种文档类型（日记、小说、论文、公文、读书笔记等）
- 前端：React + TypeScript + Tailwind CSS
- 后端：Rust (Tauri)
- UI 组件库：shadcn/ui（Button, DropdownMenu, Dialog 等）

## 关键目录
- `apps/desktop/src-ui/src/document-types/translation/` — 翻译文档类型所有组件（7个文件）
- `apps/desktop/src-ui/src/document-types/diary/` — 日记文档类型所有组件
- `apps/desktop/src-ui/src/document-types/calculator/` — 计算文档类型（27个文件，参照模板）
- `apps/desktop/src-ui/src/components/ui/` — 共享 UI 组件（shadcn/ui）
- `apps/desktop/src-ui/src/lib/i18n` — 国际化

## 数据库架构
- 三个独立 SQLite 数据库：versions.db（版本历史）、conversations.db（AI对话+消息）、search.db（FTS5搜索索引）
- conversations.messages 有 ON DELETE CASCADE 外键，删 conversation 自动删 messages
- versions 表通过 project_id 关联项目，conversations 表通过 document_id 关联文档

## 2026-03-30（续）
- 新建项目功能修复（3个文件）：
  - 交换入口行为：系统菜单 Cmd+Shift+N → 弹出 CreateProjectDialog（可选文档类型）；文件树工具栏 + 按钮 → 行内快速创建
  - CreateProjectDialog 从手写 fixed inset-0 bg-black/50 遮罩改为 shadcn/ui Dialog 组件（与 AboutDialog 等统一风格）
  - 行内创建后自动打开项目（openProject），保持体验一致
  - props 接口：onClose → onOpenChange（与 shadcn Dialog 对齐）
- CreateProjectDialog 体验优化：
  - 对话框自适应：max-h-[90vh] + 内容区 overflow-y-auto，小窗口可滚动；header/footer flex-shrink-0 固定
  - 文档类型选中高亮增强：ring-2 ring-primary/30 + bg-primary/10 + shadow-sm
  - 默认文档名从项目名改为文档类型名称（通过 t(typeDef.labelKey) 获取本地化名称）
- WelcomePage 改造：
  - 新增"新建项目"按钮（弹出 CreateProjectDialog）
  - 有项目时显示第一个项目名称 + 4个快速新建文档按钮（通用文档、日记、任务清单、大纲）
  - 点击快速按钮直接在第一个项目中创建对应类型文档并打开（复用 handleNewDocType 逻辑）
  - 英文翻译特殊处理：quickCreateIn/quickCreateSuffix 合并为 "Quick create in"
- 菜单"新建项目"修复（2个文件）：
  - useMenuEvents.ts：new_project 事件从 dispatch menu-new-project（不匹配）改为 dispatch create-project-dialog（与 MainLayout 监听对齐）
  - FileTree.tsx：删除 menu-new-project 事件监听器（系统菜单不再触发行内创建，统一由 MainLayout 弹出 CreateProjectDialog）
- 删除项目 SQLite 残留数据修复（3个文件）：
  - search_store.rs 新增 remove_project_index(db, project_id)——按项目ID批量删除搜索索引
  - conversation_store.rs 新增 delete_conversations_by_document_ids(db, doc_ids)——按文档ID列表删除对话（CASCADE删消息）
  - project.rs delete_project 补全：先收集文档ID列表，依次清理搜索索引→对话记录→版本历史，再删除项目文件
  - 清理操作失败时 eprintln 打印警告但不阻断删除流程

## 架构约定
- 工具栏使用 DropdownMenu 组件做下拉选择（天气、标签、模板、心情、颜色）
- 日记工具栏两行布局：第一行导航/文件操作，第二行条目元数据
- 无独立 CSS 文件，全部 Tailwind 内联样式
- 颜色/心情等数据常量定义在 `types.ts`
- **重要**：React state updater（`setState(prev => ...)`）内不能有副作用（如 `updateDocumentInMemory`、`debouncedSave`），否则会在渲染阶段触发其他组件重渲染（如 FileTree），导致 React 报错
- **重要**：当多个 MarkdownEditor 共存时（如翻译文档 source/target），必须用 `key` prop 区分。但 `updateInMemory` 应保持同步调用（不要用 queueMicrotask），否则 AI 翻译结果写入后 store 不同步，导致 UI 不刷新
- **重要**：Rust SSE 流式处理中 `pending_buf` 机制必须在 `for_each_sse_event` 返回后做安全 flush，因为某些 provider 的 SSE 流可能不发送 `[DONE]` 就断开连接

## 2026-03-27
- 翻译文档全方位提升（对照计算文档）：
  - layoutMode 从 standard 改为 full，自管理三栏布局（左主栏+ResizableHandle+AI侧栏220-500px可调宽）
  - 数据模型 V3：新增 settings（翻译风格/保留格式/自动保存/字体大小）、createdAt/updatedAt
  - 工具栏丰富化：保存/全部保存/版本历史/方向切换/交换/一键翻译+停止/清空/导出/设置/AI面板折叠
  - 新增 TranslationExportDialog（Markdown双语对照/纯译文/CSV段落级）
  - 新增 TranslationSettingsDialog（翻译风格/保留格式/自动保存/字体大小）
  - 新增 translationExporter.ts（导出逻辑）
  - 错误边界 TranslationWorkspaceErrorBoundary
  - 快捷键 Cmd+S/Cmd+Shift+S
  - 停止 AI 生成（AbortController + stop_ai_stream）
  - 文件：4→7（types.ts, definition.ts, TranslationWorkspace.tsx, TranslationAISidebar.tsx, translationExporter.ts, TranslationExportDialog.tsx, TranslationSettingsDialog.tsx）
  - Bug修复：一键翻译闭包陷阱（saveTrans/saveTrans内改用transRef.current替代闭包trans）+ 流式过程同步更新transRef
  - Bug修复：AI侧栏翻译按钮默认关闭深度思考（defaultThinking={false}），避免模型把译文放入think标签导致正文丢失
  - Bug修复：替换译文按钮增加parseThinkTags回退——当content为空时从thinking内容中提取实际译文
  - Bug修复：一键翻译增加extractEffectiveTranslation——推理模型（Qwen3/DeepSeek-R1）把翻译放入reasoning_content时，从thinking中智能提取最终输出段落
  - Bug修复：一键翻译无限循环（Maximum update depth exceeded）——流式回调中删除updateInMemory（仅在最终保存时保留），侧栏useEffect添加useRef内容去重保护
  - Bug修复：一键翻译思考内容显示在译文区——重构为事件驱动，通过sendDocTypeAIMessage发送到侧栏流式处理（CollapsibleThinkingBlock折叠思考），onAIResponse回调自动写入译文编辑区。删除extractEffectiveTranslation函数（约40行）、AbortController/streamRequestId直调逻辑
- 翻译AI输出修复（致命问题）：
  - 问题根因：TranslationAISidebar的onAIResponse写入store并派发translation-target-updated事件，但TranslationWorkspace无监听器，trans state不同步
  - 修复1：TranslationWorkspace添加translation-target-updated事件监听useEffect，收到后从host.doc.getDocument()读取最新content解析更新trans state
  - 修复2：DocTypeAIChatBase的onAIResponse签名扩展为(content, meta?: { label?: string })，新增currentLabelRef保存触发消息label
  - 修复3：TranslationAISidebar的onAIResponse根据meta.label是否包含"翻译"关键字判断是否自动写入译文（润色/替换方案/普通问答不写入）
- 日记工具栏改造：心情和颜色选择从平铺按钮改为下拉菜单，工具栏容器添加 overflow-x-auto 防溢出
- 计算文档工具栏（CalculatorWorkspace.tsx 第1164行）：单行约21个按钮平铺，添加 overflow-x-auto min-w-0 防溢出

## 2026-03-28
- 翻译一键翻译"始终停留在翻译中"修复（两个Bug）：
  - Bug1：DocTypeAIChatBase callAI 的 streaming 守卫（if streaming return）静默失败，不dispatch doctype-ai-done事件，导致TranslationWorkspace的isTranslating永远无法重置。修复：在守卫处dispatch doctype-ai-done(success:false, error:'already streaming')
  - Bug2：host.ts chatStream 丢弃 invoke 返回值（Rust端完整累积），只返回JS端SSE累积rawAccumulated。深度思考场景下正文只有最后几个chunk，unlisten时机可能导致正文完全丢失。修复：优先使用serverFull（invoke返回值），回退到rawAccumulated
- maxTokens 修复（第二轮）——深度思考模型只输出思考过程、无正文：
  - 根因：上轮将 default_max_tokens 全部改为 0（不注入 max_tokens），深度思考模型（Qwen3-max/GLM-5/DeepSeek-R1）不设上限时思考过程消耗全部输出预算，正文 content 为空
  - 中间状态：有人将 default_max_tokens 改回 4096/8192，但对深度思考模型仍不够（思考可能消耗 4000+ tokens）
  - 最终修复：Rust ai.rs 所有 14 个 provider + fallback 的 default_max_tokens 统一设为 16384（≈1万字中文）
  - PluginHostAPI.ts 已修复（使用 pickInvokeMaxTokens，0 不传给后端）
  - 所有前端路径已验证：host.ts/useAppStore.ts/HelpAIChat/EditorSelectionToolbar/codingAI 均正确过滤 <=0
  - resolve_max_tokens 注释已更新
- 翻译一键翻译"停在思考完成不产生结果"修复（第三轮）：
  - 根因：DocTypeAIChatBase.callAI 的 useCallback 依赖包含 onAIResponse（inline 箭头函数每次重建），导致 callAI 频繁重建 → doctype-ai-send listener 反复解绑/重绑，流式过程中 ref 可能已失效
  - Fix1：DocTypeAIChatBase 新增 onAIResponseRef/onAssistantStreamUpdateRef（useRef），callAI 内部通过 ref.current 调用，从 useCallback 依赖数组移除 onAIResponse 和 onAssistantStreamUpdate
  - Fix2：TranslationWorkspace doctype-ai-done handler 简化为只重置 isTranslating + 显示错误，不再写入 target（消除双路径竞争，翻译结果写入单一路径由 TranslationAISidebar.onAIResponse 负责）
  - Fix3：TranslationAISidebar 的 onAIResponse 从内联箭头函数改为 useCallback（handleAIResponse），移除 parseThinkTags 不必要的导入（TranslationWorkspace 中）
- 翻译流式输出到译文编辑区：
  - 根因：TranslationAISidebar 没有传 onAssistantStreamUpdate 给 DocTypeAIChatBase，流式过程中译文编辑区完全收不到更新
  - Fix1：TranslationAISidebar 新增 handleStreamUpdate（300ms节流），对累积文本 parseThinkTags 提取正文，通过 translation-stream-update 事件通知
  - Fix2：TranslationWorkspace 新增 isTranslatingRef + translation-stream-update 事件监听，实时更新 trans.target
  - 流式完成后仍由 handleAIResponse 通过 translation-target-updated 做最终确认写入

## 2026-03-30
- 新建项目功能修复（3个文件）：
  - 交换入口行为：系统菜单 Cmd+Shift+N → 弹出 CreateProjectDialog（可选文档类型）；文件树工具栏 + 按钮 → 行内快速创建
  - CreateProjectDialog 从手写 fixed inset-0 bg-black/50 遮罩改为 shadcn/ui Dialog 组件（与 AboutDialog 等统一风格）
  - 行内创建后自动打开项目（openProject），保持体验一致
  - props 接口：onClose → onOpenChange（与 shadcn Dialog 对齐）
- CreateProjectDialog 体验优化：
  - 对话框自适应：max-h-[90vh] + 内容区 overflow-y-auto，小窗口可滚动；header/footer flex-shrink-0 固定
  - 文档类型选中高亮增强：ring-2 ring-primary/30 + bg-primary/10 + shadow-sm
  - 默认文档名从项目名改为文档类型名称（通过 t(typeDef.labelKey) 获取本地化名称）
