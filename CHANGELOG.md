# 更新日志

所有重要变更记录在此文件中。

## [0.3.16] — 2026-05-11

### 安全
- **XSS 防护** — 所有邮件正文 HTML 渲染添加 DOMPurify 消毒，防止恶意脚本注入
- **Mutex 安全恢复** — database.rs 连接锁使用 `unwrap_or_else` 恢复 poisoned mutex，避免程序崩溃

### 稳定性
- **全局 ErrorBoundary** — 新增 React 错误边界，捕获组件渲染异常防止白屏
- **全局 Promise rejection 捕获** — 未处理的 Promise 错误不再静默丢失
- **Rust 测试修复** — tools.rs 中 2 个 async 测试补充 `.await`，94 个 Rust 测试全部通过

### 改进
- **防御性编程** — main.rs devtools 使用 `if let` 替代 `unwrap()`
- **代码规范** — 生产代码 `console.log` → `console.info`

## [0.3.13] — 2026-04-02

### 修复
- **SSE 解析兼容性** — 支持 `data:` 无空格变体（SSE 规范允许），修复部分 Provider 流式响应解析失败
- **OpenAI Responses API reasoning 标记** — `response.reasoning.delta` 事件添加 💭 标记，推理/正文切换时正确开关标记
- **非流式联网搜索 temperature** — `call_openai_responses` 和 `call_anthropic_with_search` 传递 temperature 参数
- **MiniMax 默认模型更新** — `MiniMax-M2.5` → `MiniMax-M2.7`
- **temperature 参数传递** — `chat_stream` 和 `generate_content_stream` 正确传递 temperature 到后端
- **web_search 参数防护** — 联网搜索开关关闭时不覆盖 tools 参数
- **reasoning 安全关闭** — 深度思考结束后确保关闭 💭 标记
- **Anthropic system 消息** — 非流式 Anthropic 调用正确提取 system 消息
- **代理配置** — AI 流式请求正确传递 proxy_url
- **Token 估算** — 图片 token 估算支持，滑动窗口截断计算图片 token

### 改进
- **SSE 解析重构** — `collect_stream_tool_calls` 重构为使用通用 `for_each_sse_event`，消除 ~160 行重复代码
- **Send 安全** — 所有 async 闭包使用 `AtomicBool`/`Mutex` 替代 `Cell`/`RefCell`，确保 Tauri 命令线程安全

## [0.3.10] — 2026-03-20

### 改进
- **日记本代码审查全面优化** — 修复 5 个 Bug、5 个性能问题、3 个 UI 缺陷、6 个 i18n 问题
- **右栏布局修复** — DiaryOnThisDay 组件现在正确显示在 AI 侧栏下方
- **AI 流式中断修复** — 用户中止 AI 回复时不再丢失已生成的内容
- **保存机制统一** — 消除元数据保存与自动保存的定时器竞态
- **版本历史功能** — 工具栏版本历史按钮现在正确打开条目信息面板的历史 Tab
- **AI 服务选择器** — 日记 AI 侧栏新增 AI 服务切换下拉菜单
- **AI 插入修复** — AI "插入到日记"后编辑器正确显示新内容
- **日历双击创建** — 双击日历日期可直接创建新日记条目
- **性能优化** — DiaryAISidebar 精确 selector、16 个回调减少重建、热力图算法 O(N+365)、标签计算缓存
- **每日写作提示** — 空日记本也能生成通用写作灵感
- **导出国际化** — 导出标签可配置，支持多语言

### 修复
- 修复 DiaryDashboard 标签频率区变量名遮蔽翻译函数导致潜在崩溃
- 修复 diaryContext 中 weekly/mood-review 快捷操作 emoji 编码异常
- 修复多处 i18n 硬编码中文（导入格式说明、回收站时间描述、导出预览提示、心情预警文案）

## [0.3.8] — 2026-03-17

### 改进
- **前端性能优化** — bundle 分包策略优化，主包从 5.7MB 降至 148KB
- **帮助文档丰富** — 批量扩充 20+ 插件文档（思维导图、Mermaid、表格、时间线、海报、引用、词汇表、闪卡、教案、测验、审阅、写作统计、图片、邮件、加密、Pandoc、水印、语音、对比、提取、合规、Office、发布、数据分析）
- **帮助窗口侧边栏** — 选中项高亮改为蓝色背景
- **ESLint 强化** — 新增 no-unused-vars、no-console、prefer-const、no-var 规则
- **CI 优化** — 测试流水线改为仅 PR 触发，节省 CI 费用
- **Gitee 镜像分发** — 自动更新 fallback 到 Gitee，新增发版脚本

### 清理
- 彻底移除角色系统（代码、UI、文档、资源 manifest、构建脚本）
- 彻底移除 Linux 平台支持（代码、文档、CI 配置、安装指引、i18n）

### 修复
- 修复自动更新签名验证失败
- 修复更新窗口不透明背景
- 修复 Rust 跨平台编译错误（python.rs、file_system.rs、export.rs）

### 测试
- 新增 121 个单元测试（conversations 37 + coding 29 + templates 30 + workspace 20 + utils 5），总数达 234 个

## [0.3.6] — 2026-03-11

### 新增
- **多模态 AI 聊天** — 支持在聊天中上传/粘贴图片（最多 5 张，单张最大 10MB），AI 可分析图片内容
  - 自动适配 OpenAI Vision（image_url 格式）和 Anthropic（base64 source 格式）
  - 输入框旁图片上传按钮 + Ctrl+V 粘贴图片
  - 图片预览条（缩略图 + 删除按钮）
  - 消息气泡中显示图片缩略图，点击可查看原图
- **文档大纲增强** — 章节字数统计、当前标题高亮、面包屑导航
- **编辑器性能优化** — 大文档检测、防抖优化、Mermaid 缓存、预览截断

### 改进
- 全链路多模态支持：chat / chat_stream / Responses API / Anthropic API 均已适配
- Rust 后端 `ChatMessage` 新增可选 `images` 字段，向后兼容
- 新增 i18n 翻译键（中英文）：uploadImage、removeImage、imagePreview、addMoreImages、imageAttachment

## [0.3.0] — 2026-02-26

### 新增
- **编程区** — 集成多语言代码编辑器和运行环境，支持 AI 辅助编程
- **五大工作区** — 生成区、内容区、合并区、功能区、编程区
- **首次运行引导** — 4 步交互式新手引导
- **帮助菜单增强** — 官网、文档、反馈入口
- **关于对话框升级** — 动态版本号、多链接入口、版权信息
- **官方网站** — GitHub Pages 托管 AiDocPlus.com
- **帮助文档** — 11 篇完整用户文档

### 改进
- 版本号统一为 0.3.0
- AiDocPlus.com 域名充分体现在程序各处
- README 重新整理（开发者版 + 用户版）
- 国际化覆盖所有新增 UI 文案（中文/英文）
- 移除已废弃的角色系统和项目模板功能
- 资源管理器精简为统一管理器（提示词模板 + 文档模板）

## [0.2.6] — 2026-02-xx

### 新增
- 文档标签与收藏系统
- 工作区持久化（标签页、面板布局、项目状态）
- 项目导入/导出（ZIP 格式）
- 项目备份（带时间戳）

## [0.2.0] — 2026-01-xx

### 新增
- 插件系统（28 个内置插件）
- 多格式导出（Markdown、HTML、DOCX、PDF、TXT）
- AI 流式对话和内容生成
- 提示词模板系统（982 个模板，46 个分类）
- 13 个 AI 服务商支持
- 资源管理器（独立 Tauri 桌面应用）
- 文档模板和 PPT 主题

## [0.1.0] — 2025-xx-xx

### 初始版本
- Markdown 编辑器（CodeMirror 6）
- 项目和文档管理
- 基础 AI 对话
- 中英文国际化
