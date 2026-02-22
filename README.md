<div align="center">

# AiDocPlus

**AI 驱动的跨平台文档桌面编辑器**

基于 Tauri 2 + React 19 构建，支持 macOS 和 Windows

[![Release](https://img.shields.io/github/v/release/AiDocPlus/AiDocPlus?style=flat-square)](https://github.com/AiDocPlus/AiDocPlus/releases)
[![License](https://img.shields.io/github/license/AiDocPlus/AiDocPlus?style=flat-square)](LICENSE)

[官网](https://aidocplus.github.io/AiDocPlus/) · [下载](https://github.com/AiDocPlus/AiDocPlus/releases) · [源码](https://github.com/AiDocPlus/AiDocPlus-Main)

</div>

---

## 功能概览

### AI 能力
- **AI 内容生成** — 流式生成，支持停止，附件参考，982 个提示词模板（46 个分类）
- **AI 聊天** — 流式对话，联网搜索，支持 OpenAI 兼容 API、智谱 GLM 等 13 个 AI 提供商
- **AI 插件** — 21 个外部插件，涵盖摘要、翻译、PPT、图表、测试题、教案、表格等

### 编辑器
- **Markdown 编辑** — CodeMirror 6，语法高亮、代码折叠、自动补全、实时预览
- **三面板布局** — 文件树 + 编辑器（原始/AI 双栏）+ AI 聊天面板
- **多标签页** — 同时编辑多个文档，每个标签页独立面板状态
- **版本控制** — 自动版本保存，版本预览和恢复

### 文档管理
- **多项目管理** — 项目 CRUD，文档标签与收藏
- **多格式导出** — Markdown、HTML、DOCX、TXT、PDF（原生 + Pandoc）
- **20 个内置项目模板** — 学术、商务、技术、创意、教育、政务、通用 7 大类
- **工作区自动保存** — 标签页、面板布局、项目状态持久化

### 插件系统

全外部插件架构，21 个插件通过自注册 + 自动发现机制加载：

| 类别 | 插件 |
|------|------|
| **内容生成类** | 摘要、PPT、测试题、思维导图、翻译、平行翻译、图表、统计、教案、表格、时间线、审阅、写作统计 |
| **功能执行类** | 邮件、文档对比、加密、水印、TTS 朗读、Office 预览、Pandoc 导出、发布 |

### 资源管理

6 个独立的资源管理器桌面应用，可视化管理所有内置资源：

- 角色管理器 · AI 服务商管理器 · 提示词模板管理器
- 项目模板管理器 · 文档模板管理器 · 插件管理器

---

## 下载安装

从 [GitHub Releases](https://github.com/AiDocPlus/AiDocPlus/releases) 下载最新版本：

| 平台 | 格式 | 架构 |
|------|------|------|
| macOS | `.dmg` | Apple Silicon (aarch64) |
| Windows | `.exe` (NSIS 安装包) | x64 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| **桌面框架** | Tauri 2.x |
| **前端** | React 19 + TypeScript 5.8+ |
| **状态管理** | Zustand |
| **UI** | Radix UI + Tailwind CSS 4 |
| **编辑器** | CodeMirror 6 |
| **构建** | Vite 7 + Turborepo + pnpm |
| **后端** | Rust（文件系统、AI 流式、导出、资源引擎） |
| **国际化** | i18next（中文/英文） |

---

## 多仓库架构

AiDocPlus 采用多仓库架构，资源数据外部化到独立仓库：

| 仓库 | 说明 |
|------|------|
| [AiDocPlus-Main](https://github.com/AiDocPlus/AiDocPlus-Main) | 主程序源码 |
| [AiDocPlus-Roles](https://github.com/AiDocPlus/AiDocPlus-Roles) | 10 个内置角色 |
| [AiDocPlus-PromptTemplates](https://github.com/AiDocPlus/AiDocPlus-PromptTemplates) | 982 个提示词模板（46 分类） |
| [AiDocPlus-AIProviders](https://github.com/AiDocPlus/AiDocPlus-AIProviders) | 13 个 AI 提供商 |
| [AiDocPlus-DocTemplates](https://github.com/AiDocPlus/AiDocPlus-DocTemplates) | PPT 主题 + 文档模板 |
| [AiDocPlus-ProjectTemplates](https://github.com/AiDocPlus/AiDocPlus-ProjectTemplates) | 20 个项目模板 |
| [AiDocPlus-Plugins](https://github.com/AiDocPlus/AiDocPlus-Plugins) | 21 个外部插件 |
| [AiDocPlus-ResourceManager](https://github.com/AiDocPlus/AiDocPlus-ResourceManager) | 6 个资源管理器 |

---

## 开发

```bash
# 克隆源码仓库
git clone https://github.com/AiDocPlus/AiDocPlus-Main.git

# 安装依赖
cd AiDocPlus-Main/apps/desktop
pnpm install

# 开发模式
pnpm tauri dev

# 构建
pnpm tauri build
```

详细开发文档请参考 [AiDocPlus-Main](https://github.com/AiDocPlus/AiDocPlus-Main)。

---

## 许可证

[MIT](LICENSE)
