# Oh My OpenCode (OmO) 完全指南

> 从安装到精通，全面掌握最强大的 OpenCode 扩展插件

---

## 目录

- [1. 简介](#1-简介)
- [2. 安装与配置](#2-安装与配置)
  - [2.1 安装 OpenCode](#21-安装-opencode)
  - [2.2 安装 Oh My OpenCode](#22-安装-oh-my-opencode)
  - [2.3 配置 AI 服务](#23-配置-ai-服务)
  - [2.4 离线安装](#24-离线安装)
  - [2.5 验证安装](#25-验证安装)
  - [2.6 卸载](#26-卸载)
- [3. 核心概念](#3-核心概念)
  - [3.1 架构总览](#31-架构总览)
  - [3.2 Sisyphus — 主编排 Agent](#32-sisyphus--主编排-agent)
  - [3.3 子 Agent 军团](#33-子-agent-军团)
  - [3.4 Agent 分类与任务委托](#34-agent-分类与任务委托)
  - [3.5 Skill 技能系统](#35-skill-技能系统)
  - [3.6 后台并行 Agent](#36-后台并行-agent)
  - [3.7 Hash-Anchored 编辑工具](#37-hash-anchored-编辑工具)
  - [3.8 内置 MCP 服务](#38-内置-mcp-服务)
- [4. 实际使用技巧](#4-实际使用技巧)
  - [4.1 ultrawork — 一键全自动](#41-ultrawork--一键全自动)
  - [4.2 计划模式 vs 构建模式](#42-计划模式-vs-构建模式)
  - [4.3 Prometheus 战略规划](#43-prometheus-战略规划)
  - [4.4 Ralph Loop / ulw-loop](#44-ralph-loop--ulw-loop)
  - [4.5 /init-deep 深度初始化](#45-init-deep-深度初始化)
  - [4.6 常用命令速查](#46-常用命令速查)
  - [4.7 与文件交互](#47-与文件交互)
  - [4.8 撤销与重做](#48-撤销与重做)
- [5. 自定义与扩展](#5-自定义与扩展)
  - [5.1 配置文件详解](#51-配置文件详解)
  - [5.2 自定义 Skill](#52-自定义-skill)
  - [5.3 自定义 Agent](#53-自定义-agent)
  - [5.4 Claude Code 兼容性](#54-claude-code-兼容性)
  - [5.5 MCP Server 接入](#55-mcp-server-接入)
  - [5.6 Hook 系统](#56-hook-系统)
  - [5.7 AGENTS.md 项目知识库](#57-agentsmd-项目知识库)
- [6. 常见问题与排查](#6-常见问题与排查)
- [7. 参考链接](#7-参考链接)

---

## 1. 简介

**Oh My OpenCode (OmO)** 是一个受 `oh-my-zsh` 启发的 OpenCode 扩展插件集合，由 [code-yeongyu](https://github.com/code-yeongyu) 开发和维护。

如果说 **OpenCode** 是开源世界中的 Claude Code 替代品，那么 **Oh My OpenCode** 就是让 OpenCode 如虎添翼的增强包。它提供了：

- **多 Agent 编排系统** — Sisyphus 作为主编排者，协调多个专业子 Agent 并行工作
- **预构建工具链** — LSP（语言服务器协议）、AST-Grep（语法感知搜索/替换）、Tmux（交互式终端）
- **内置 MCP 服务** — Exa（Web 搜索）、Context7（官方文档查询）、Grep.app（GitHub 代码搜索）
- **Skill 技能系统** — 可复用的领域知识模块，按需加载
- **Claude Code 完全兼容** — 你为 Claude Code 配置的 hooks、commands、skills、MCP、plugins 全部通用
- **ultrawork 模式** — 一条命令启动全自动开发循环

### OpenCode vs Oh My OpenCode

| 特性 | OpenCode（基础版） | Oh My OpenCode（增强版） |
|------|-------------------|----------------------|
| AI 编码对话 | ✅ | ✅ |
| 终端 TUI 界面 | ✅ | ✅ |
| 桌面应用 & IDE 扩展 | ✅ | ✅ |
| 多 Agent 编排 | ❌ | ✅ Sisyphus 军团 |
| 后台并行 Agent | ❌ | ✅ 5+ Agent 同时运行 |
| LSP 集成 | ❌ | ✅ 重命名、定义跳转、引用查找 |
| AST-Grep | ❌ | ✅ 25 种语言的语法感知搜索 |
| Hash-Anchored 编辑 | ❌ | ✅ 内容哈希校验零出错 |
| 内置 MCP 服务 | ❌ | ✅ Exa + Context7 + Grep.app |
| Skill 技能系统 | 基础 | ✅ 增强版（含嵌入式 MCP） |
| Claude Code 兼容 | 部分 | ✅ 完全兼容 |
| ultrawork 模式 | ❌ | ✅ 一键全自动 |
| Prometheus 规划器 | ❌ | ✅ 采访式战略规划 |

### 官方资源

- **GitHub 仓库**: [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)（原 oh-my-opencode）
- **OpenCode 官网**: [opencode.ai](https://opencode.ai)
- **OpenCode 中文站**: [opencodecn.com](https://opencodecn.com)
- **Discord 社区**: 详见 GitHub 仓库 README

---

## 2. 安装与配置

### 2.1 安装 OpenCode

Oh My OpenCode 是 OpenCode 的插件，需要先安装 OpenCode 基础环境。

#### 前提条件

- Node.js >= 22.0（推荐）
- 一款现代终端模拟器（WezTerm、Alacritty、Ghostty、Kitty 等）
- 至少一个 LLM 提供商的 API 密钥

#### 安装方式

**方式一：安装脚本（推荐）**

```bash
curl -fsSL https://opencode.ai/install | bash
```

**方式二：npm / pnpm / yarn**

```bash
npm install -g opencode-ai
```

**方式三：Homebrew（macOS / Linux）**

```bash
# 推荐 tap（更新更快）
brew install anomalyco/tap/opencode

# 或官方 formula（更新较慢）
brew install opencode
```

**方式四：Arch Linux**

```bash
sudo pacman -S opencode              # 稳定版
paru -S opencode-bin                 # AUR 最新版
```

**方式五：Windows**

```bash
# NPM
npm install -g opencode-ai

# Chocolatey / Scoop（请查看官方文档获取最新包名）
```

### 2.2 安装 Oh My OpenCode

#### 方式一：让 Agent 自动安装（推荐）

在 OpenCode 中输入：

```
Install and configure oh-my-opencode by following the instructions here:
https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/refs/heads/dev/docs/guide/installation.md
```

OpenCode 会自动检测并执行安装。

#### 方式二：手动安装

```bash
bunx oh-my-opencode install
```

安装完成后，插件会自动注册到 OpenCode 的配置中。

### 2.3 配置 AI 服务

安装完成后，需要在 OpenCode 中配置 AI 提供商的 API 密钥。

**方式一：OpenCode Zen（推荐新手）**

在 OpenCode TUI 中运行 `/connect` 命令，选择 `opencode`，按提示操作。

**方式二：手动配置 API 密钥**

编辑 `~/.config/opencode/opencode.json`，添加你的 API 密钥。

> **省钱方案**：Oh My OpenCode 可以混合使用不同模型。推荐组合：
> - 编排 Agent（Sisyphus）：GLM Coding Plan（$10/月）或 Kimi Code（$0.99/月）
> - 推理 Agent（Hephaestus）：ChatGPT 订阅（$20/月）
> - 日常编码：按 token 计费的 Kimi / Gemini

### 2.4 离线安装

如果你无法连接互联网，可以从源码构建：

```bash
# 1. 在有网络的环境下克隆并构建
git clone https://github.com/code-yeongyu/oh-my-openagent.git
cd oh-my-openagent
bun install
bun run build
# 构建产物：dist/index.js

# 2. 在目标机器上配置 OpenCode
# 编辑 ~/.config/opencode/opencode.json：
```

```json
{
  "plugin": [
    "file:///Users/你的用户名/path/to/oh-my-opencode/dist/index.js"
  ]
}
```

> **Windows 注意**：路径中的 `\` 需替换为 `/`，例如 `file:///E:/project/oh-my-opencode/dist/index.js`

### 2.5 验证安装

```bash
# 验证 OpenCode 版本
opencode --version

# 诊断 OmO 配置
bunx oh-my-opencode doctor

# 在 OpenCode TUI 中，输入以下命令测试：
# 输入 "ultrawork" 看是否能触发 Agent 军团
```

### 2.6 卸载

```bash
# 1. 移除插件配置
jq '.plugin = [.plugin[] | select(. != "oh-my-openagent" and . != "oh-my-opencode")]' \
    ~/.config/opencode/opencode.json > /tmp/oc.json && \
    mv /tmp/oc.json ~/.config/opencode/opencode.json

# 2. 删除配置文件（可选）
rm -f ~/.config/opencode/oh-my-openagent.jsonc ~/.config/opencode/oh-my-openagent.json \
      ~/.config/opencode/oh-my-opencode.jsonc ~/.config/opencode/oh-my-opencode.json

# 3. 验证
opencode --version
```

---

## 3. 核心概念

### 3.1 架构总览

Oh My OpenCode 的核心是一个**多 Agent 编排系统**，模拟真实开发团队的工作方式：

```
┌───────────────────────────────────────────────────────────┐
│                      用户（你）                            │
│                         │                                  │
│                    提问 / 下达任务                           │
│                         ▼                                  │
│ ┌─────────────────────────────────────────────────────┐   │
│ │              Sisyphus（主编排 Agent）                   │   │
│ │   理解意图 → 制定计划 → 分解任务 → 并行委托 → 验证结果    │   │
│ └────────┬──────────┬──────────┬──────────┬────────────┘   │
│          │          │          │          │                  │
│     ┌────▼───┐ ┌───▼────┐ ┌──▼───┐ ┌───▼────┐ ┌───────┐  │
│     │Explore │ │Librarian│ │Oracle│ │Prometheus│ │Hephaestus│
│     │(代码搜索)│ │(文档搜索)│ │(架构) │ │(规划)   │ │(深度执行) │
│     └────────┘ └────────┘ └──────┘ └────────┘ └─────────┘  │
│          │          │          │          │                  │
│     ┌────▼──────────▼──────────▼──────────▼──────────┐    │
│     │              工具层                               │    │
│     │  LSP · AST-Grep · Tmux · MCP · Git · 文件系统    │    │
│     └─────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

### 3.2 Sisyphus — 主编排 Agent

Sisyphus 是你的**项目经理**。它不直接写代码，而是：

1. **理解意图** — 分析你说的话，判断你的真实需求（而非字面意思）
2. **制定计划** — 将复杂任务分解为可执行的子任务
3. **分配工作** — 根据任务类型选择合适的子 Agent 或委托类别
4. **并行执行** — 同时启动多个 Agent 工作
5. **验证结果** — 检查每个 Agent 的产出，确保质量
6. **持续推进** — 不会半途而废，遇到问题自动修正

推荐模型：Claude Opus 4 / Kimi K2.5 / GLM-5

### 3.3 子 Agent 军团

每个子 Agent 都是某个领域的专家：

| Agent | 职责 | 推荐模型 | 使用方式 |
|-------|------|----------|----------|
| **Sisyphus** | 主编排，计划+委托+验证 | Opus / K2.5 / GLM-5 | 默认，直接对话 |
| **Hephaestus** | 自主深度执行，端到端完成复杂任务 | GPT-5.4 | 通过 category=`deep` 委托 |
| **Prometheus** | 战略规划，采访式需求分析 | Opus / K2.5 / GLM-5 | `/start-work` 命令 |
| **Oracle** | 只读顾问，架构决策 & 深度调试 | 高推理模型 | 复杂架构问题、2次修复失败后 |
| **Explore** | 代码库搜索（内部 grep） | 任意 | 搜索项目内代码模式 |
| **Librarian** | 文档/外部资源搜索（参考 grep） | 任意 | 查找外部库文档、最佳实践 |
| **Metis** | 预规划顾问，识别隐藏意图和歧义 | 高推理模型 | 复杂任务开工前的分析 |
| **Momus** | 方案审查，评估计划的清晰度和完整性 | 高推理模型 | 审查工作计划 |

### 3.4 Agent 分类与任务委托

当你给 Sisyphus 一个任务时，它不会指定具体的子 Agent，而是指定一个**任务类别（Category）**。系统自动将类别映射到最合适的模型：

| Category | 适用场景 | 说明 |
|----------|---------|------|
| `visual-engineering` | 前端、UI/UX、设计、样式、动画 | **视觉工作必须用此类别** |
| `ultrabrain` | 高难度逻辑、架构决策、算法 | 真正烧脑的任务才用 |
| `deep` | 自主研究+端到端执行 | 复杂问题，需要深入理解 |
| `artistry` | 创意性问题解决 | 非常规方法 |
| `quick` | 单文件修改、错别字、简单配置 | 小修小补 |
| `unspecified-low` | 不属于其他类别的低工作量任务 | |
| `unspecified-high` | 不属于其他类别的高工作量任务 | |
| `writing` | 文档、散文、技术写作 | |

**关键原则**：Sisyphus 说"做什么类型的工作"，系统自动选"用什么模型"。你不需要手动切换模型。

### 3.5 Skill 技能系统

Skill 是可复用的**领域知识模块**，Agent 在需要时按需加载，不会污染上下文窗口。

#### 内置 Skill

| Skill | 说明 |
|-------|------|
| `playwright` | 浏览器自动化 — 截图、验证、网页交互、测试 |
| `frontend-ui-ux` | 设计师级前端开发 — 无设计稿也能做出漂亮 UI |
| `git-master` | Git 专家 — 原子提交、rebase、历史搜索、blame |

#### Skill 的工作方式

1. Agent 检测到任务匹配某个 Skill 的描述
2. 调用 `skill(name="skill-name")` 加载该 Skill
3. Skill 注入**领域调优的系统指令** + **嵌入式 MCP 服务器**
4. Agent 在 Skill 指导下完成任务
5. 任务完成后 MCP 自动清理，上下文窗口恢复清洁

#### 自定义 Skill

在以下任一位置创建 `SKILL.md` 文件：

```
# 项目级别（仅当前项目）
.opencode/skills/my-skill/SKILL.md

# 全局级别（所有项目）
~/.config/opencode/skills/my-skill/SKILL.md

# Claude Code 兼容
.claude/skills/my-skill/SKILL.md
~/.claude/skills/my-skill/SKILL.md
```

`SKILL.md` 格式：

```markdown
---
name: my-skill
description: 描述这个 Skill 做什么，要足够具体以便 Agent 正确选择
---

## What I do
- 具体能力列表

## When to use me
- 使用场景描述

## Instructions
- Agent 执行时应遵循的详细步骤
```

### 3.6 后台并行 Agent

这是 Oh My OpenCode 最强大的特性之一。Sisyphus 可以同时启动 **5+ 个后台 Agent** 并行工作：

```
用户: "重构认证系统，添加 OAuth2 支持"

Sisyphus 同时启动:
  ┌─ Explore Agent #1 ─→ 搜索现有认证代码
  ├─ Explore Agent #2 ─→ 搜索 OAuth2 相关依赖
  ├─ Librarian Agent ──→ 查找 OAuth2 最佳实践
  ├─ Explore Agent #3 ─→ 搜索测试文件
  └─ Librarian Agent ──→ 查找库文档
  
  所有结果返回后 → 综合分析 → 制定方案 → 委托执行
```

**好处**：
- 探索速度提升 5 倍
- 上下文窗口保持精简（每个 Agent 只关注自己负责的部分）
- 完成通知自动触发下一步

**使用规则**：
- Explore / Librarian 始终用 `run_in_background=true`
- Oracle 需要在最终答案前收集结果
- 不需要轮询结果 — 系统会自动通知

### 3.7 Hash-Anchored 编辑工具

传统 Agent 编辑工具依赖"复述内容"来定位行，容易出错（尤其是空白符）。Oh My OpenCode 的 Hashline 方案：

```python
# 普通 Read 工具返回:
11: def hello():
12:     return "world"

# Hashline 返回:
11#VK| def hello():
22#XJ|     return "world"
```

Agent 通过 `LINE#ID`（如 `11#VK`）引用行。如果文件被修改导致哈希不匹配，编辑会被拒绝 — **零脏数据风险**。

实测数据：Grok Code Fast 成功率从 6.7% 提升到 68.3%，仅靠更换编辑工具。

### 3.8 内置 MCP 服务

MCP（Model Context Protocol）让 Agent 能调用外部工具。Oh My OpenCode 内置了三个高价值 MCP：

| MCP | 功能 | 使用场景 |
|-----|------|----------|
| **Exa** | Web 搜索 | 查找最新技术方案、API 文档 |
| **Context7** | 官方文档查询 | 查询任意库/框架的官方文档 |
| **Grep.app** | GitHub 代码搜索 | 在百万级开源仓库中查找真实用法 |

**Skill-Embedded MCP**：Skill 可以携带自己的 MCP 服务器，按需启动、任务完成后自动清理，不污染上下文。

---

## 4. 实际使用技巧

### 4.1 ultrawork — 一键全自动

这是 Oh My OpenCode 的杀手级功能。

**使用方法**：在 OpenCode 中输入：

```
ultrawork
```

或简写：

```
ulw
```

然后描述你的需求。ultrawork 会：
1. 激活所有 Agent
2. 自动规划、分解、并行执行
3. 持续工作直到任务 100% 完成
4. 遇到问题自动修复和重试

**示例**：

```
ulw 修复所有 ESLint 警告，保持原有功能不变
```

```
ulw 将现有的 REST API 改为 GraphQL
```

### 4.2 计划模式 vs 构建模式

OpenCode 有两种工作模式，通过 **Tab** 键切换（右下角会显示当前模式）：

| 模式 | 说明 | 用法 |
|------|------|------|
| **计划模式** | Agent 只分析不修改，输出方案 | 先规划，确认后再构建 |
| **构建模式** | Agent 直接执行修改 | 确认方案后实施 |

**推荐工作流**：

1. `Tab` → 切到计划模式 → 描述需求 → Agent 输出方案
2. 审查方案，提供反馈
3. `Tab` → 切回构建模式 → "按方案执行"

### 4.3 Prometheus 战略规划

对于复杂任务，使用 Prometheus 进行**采访式规划**：

```
/start-work
```

Prometheus 会像真实工程师一样：
1. **采访你** — 提出澄清问题，消除歧义
2. **识别范围** — 明确边界，防止范围蔓延
3. **发现风险** — 提前预警潜在问题
4. **输出详细计划** — 分步骤、可验证的工作分解

计划保存到 `.sisyphus/plans/*.md` 后，Sisyphus 按计划逐步执行。

### 4.4 Ralph Loop / ulw-loop

**Ralph Loop** 是自引用循环 — Agent 会持续工作直到任务完成：

```
/ralph-loop
```

或：

```
/ulw-loop
```

**与 ultrawork 的区别**：
- `ultrawork`：一次性全自动（适合明确任务）
- `ralph-loop`：持续循环直到完成（适合大型、可能需要多轮的任务）

**停止循环**：

```
/cancel-ralph
```

### 4.5 /init-deep 深度初始化

```
/init-deep
```

自动在你的项目中生成层级化的 `AGENTS.md` 文件：

```
project/
├── AGENTS.md              ← 项目级上下文（架构、技术栈、规范）
├── src/
│   ├── AGENTS.md          ← src 级上下文
│   └── components/
│       └── AGENTS.md      ← 组件级上下文
```

Agent 会自动读取当前目录的 AGENTS.md，获得**精确的上下文**，而不需要加载整个项目的信息。这对大型项目尤其重要 — 大幅减少 token 消耗，提升 Agent 表现。

### 4.6 常用命令速查

| 命令 | 说明 |
|------|------|
| `ultrawork` / `ulw` | 一键全自动模式 |
| `/ralph-loop` / `/ulw-loop` | 启动持续循环 |
| `/cancel-ralph` | 停止 Ralph Loop |
| `/start-work` | Prometheus 战略规划 |
| `/init-deep` | 深度初始化 AGENTS.md |
| `/connect` | 配置 AI 提供商 |
| `/undo` | 撤销上一次修改 |
| `/redo` | 重做上一次修改 |
| `/commit` | Git 提交（配合 git-master skill） |
| `/refactor` | 智能重构（含 LSP + AST-Grep） |
| `/handoff` | 生成交接文档（用于跨会话续接） |
| `/stop-continuation` | 停止所有自动续接机制 |

### 4.7 与文件交互

**@ 引用文件**：

```
解释 @src/components/auth.ts 中的认证逻辑
```

**拖放图片**：

将截图拖入终端窗口，Agent 会自动扫描图片内容并作为参考。

### 4.8 撤销与重做

如果 Agent 的修改不符合预期：

```
/undo    # 撤销，回到修改前
```

调整提示词后，可以重做：

```
/redo    # 重做修改
```

---

## 5. 自定义与扩展

### 5.1 配置文件详解

#### OpenCode 主配置

位置：`~/.config/opencode/opencode.json`（支持 `.jsonc` — JSON with Comments）

```jsonc
{
  // 插件列表
  "plugin": [
    "oh-my-openagent"  // OmO 插件（推荐使用新名称）
  ],

  // AI 提供商配置
  "provider": {
    // 根据你使用的提供商配置 API 密钥
  },

  // Agent 权限配置
  "permission": {
    "skill": {
      "*": "allow",           // 允许所有 Skill
      "experimental-*": "ask" // 实验性 Skill 需要确认
    }
  },

  // Agent 自定义配置
  "agent": {
    "plan": {
      "permission": {
        "skill": {
          "internal-*": "allow"
        }
      }
    }
  }
}
```

#### OmO 插件配置

位置：`~/.config/opencode/oh-my-openagent.jsonc`（也支持 `oh-my-opencode.jsonc`）

```jsonc
{
  // 自定义 Agent 模型
  "agents": {
    "sisyphus": {
      "model": "claude-opus-4-6",
      "temperature": 0.7
    },
    "hephaestus": {
      "model": "gpt-5.4"
    },
    "prometheus": {
      "model": "claude-opus-4-6"
    }
  },

  // 后台任务并发限制
  "background_tasks": {
    "max_concurrent": 5
  },

  // 禁用特定 Hook
  "disabled_hooks": [
    "comment-checker"
  ],

  // 模型回退
  "fallback_models": [
    "claude-opus-4-6",
    "kimi-k2.5",
    "glm-5"
  ]
}
```

### 5.2 自定义 Skill

#### 创建项目级 Skill

```bash
mkdir -p .opencode/skills/my-api-client
```

创建 `.opencode/skills/my-api-client/SKILL.md`：

```markdown
---
name: my-api-client
description: Generates type-safe API client code from OpenAPI specs
---

## What I do
- Parse OpenAPI/Swagger specifications
- Generate TypeScript client code with proper types
- Create endpoint functions with request/response types
- Add error handling and retry logic

## When to use me
- When the user wants to create or update an API client
- When working with OpenAPI spec files

## Instructions
1. Read the OpenAPI spec file
2. Identify all endpoints, request/response schemas
3. Generate TypeScript interfaces for all schemas
4. Create a client class with typed methods
5. Add proper error handling
```

#### 创建全局 Skill

```bash
mkdir -p ~/.config/opencode/skills/my-convention
```

全局 Skill 对所有项目生效，适合存放团队编码规范等通用知识。

#### Skill 权限控制

```jsonc
{
  "permission": {
    "skill": {
      "*": "allow",
      "pr-review": "allow",
      "internal-*": "deny",      // 禁止所有 internal-* 开头的 Skill
      "experimental-*": "ask"    // 实验性 Skill 需要用户确认
    }
  }
}
```

### 5.3 自定义 Agent

你可以在 `opencode.json` 中自定义 Agent，覆盖默认配置：

```jsonc
{
  "agent": {
    "my-specialist": {
      "model": "claude-opus-4-6",
      "temperature": 0.3,
      "tools": {
        "skill": true,
        "lsp_*": true,
        "ast_grep_*": true
      },
      "permission": {
        "skill": {
          "documents-*": "allow"
        }
      }
    }
  }
}
```

### 5.4 Claude Code 兼容性

Oh My OpenCode 完全兼容 Claude Code 的配置体系：

| Claude Code 功能 | OmO 兼容性 |
|-----------------|-----------|
| Hooks（钩子） | ✅ 完全兼容 |
| Commands（命令） | ✅ 完全兼容 |
| Skills（技能） | ✅ 完全兼容 |
| MCP Servers | ✅ 完全兼容 |
| Plugins（插件） | ✅ 完全兼容 |
| `.claude/` 目录 | ✅ 自动识别 |

这意味着你为 Claude Code 投入的所有配置工作，在 OmO 中**零成本迁移**。

### 5.5 MCP Server 接入

#### 使用内置 MCP

无需配置，以下 MCP 开箱即用：

- **Exa** — Web 搜索（通过 `websearch_web_search_exa` 工具）
- **Context7** — 官方文档查询（通过 `context7_resolve-library-id` + `context7_query-docs`）
- **Grep.app** — GitHub 代码搜索（通过 `grep_app_searchGitHub`）

#### 添加自定义 MCP

在 OpenCode 配置中添加 MCP server：

```jsonc
{
  "mcp": {
    "my-custom-server": {
      "command": "node",
      "args": ["/path/to/mcp-server.js"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

### 5.6 Hook 系统

Oh My OpenCode 内置了 25+ 个 Hook，覆盖各种自动化场景。你可以在配置中禁用不需要的 Hook：

```jsonc
{
  "disabled_hooks": [
    "comment-checker",    // 注释质量检查
    "todo-continuation"   // Todo 自动续接
  ]
}
```

### 5.7 AGENTS.md 项目知识库

`AGENTS.md` 是项目级别的 Agent 指导文件。Agent 打开项目时会自动读取。

#### 手动创建

在项目根目录创建 `AGENTS.md`：

```markdown
# Project: My App

## 技术栈
- Frontend: React 19 + TypeScript 5.9 + Tailwind CSS 4
- Backend: Rust (Tauri 2.x)
- State: Zustand

## 编码规范
- 所有 UI 文字必须通过 i18next 国际化
- 禁止使用 `as any`、`@ts-ignore`
- 组件使用函数式组件 + Hooks

## 项目结构
- `src/components/` — React 组件
- `src/stores/` — Zustand stores
- `src-tauri/src/` — Rust 后端
```

#### 自动生成

```
/init-deep
```

会自动分析项目结构，在关键目录生成层级化的 AGENTS.md。

---

## 6. 常见问题与排查

### Q: 安装后 Agent 没有响应 / 不工作

**A**: 运行诊断命令：

```bash
bunx oh-my-opencode doctor
```

检查项：插件注册、配置文件、模型配置、环境变量。

### Q: 如何切换 AI 模型？

**A**: 编辑 `~/.config/opencode/oh-my-openagent.jsonc`，修改对应 Agent 的 `model` 字段。或在 OpenCode TUI 中运行 `/connect` 重新配置。

### Q: ultrawork 卡住了怎么办？

**A**:
1. 先尝试 `/cancel-ralph` 停止循环
2. 检查是否有 API 配额限制
3. 尝试更具体的任务描述

### Q: 如何查看 Agent 在做什么？

**A**: OpenCode TUI 会实时显示 Agent 的思考和工具调用。后台 Agent 的结果会在完成时自动返回给 Sisyphus。

### Q: Skill 没有显示在可用列表中

**A**: 检查：
1. 文件名必须是 `SKILL.md`（全大写）
2. frontmatter 必须包含 `name` 和 `description`
3. 检查权限设置 — 设为 `deny` 的 Skill 会被隐藏

### Q: 编辑失败 "hash not found"

**A**: 这是 Hash-Anchored 的安全机制。文件在你上次读取后被修改了（可能是其他程序），Agent 会自动重新读取并重试。如果持续失败，手动检查是否有冲突。

### Q: 如何在不同项目间切换配置？

**A**:
- 全局配置：`~/.config/opencode/opencode.json`（所有项目共享）
- 项目配置：`.opencode/opencode.json`（仅当前项目，优先级更高）
- Skill 按项目/全局目录分别存放

### Q: Windows 上的路径问题

**A**:
- 配置文件中的路径使用 `/` 而不是 `\`
- `file://` 协议的路径格式：`file:///C:/Users/...`

---

## 7. 参考链接

| 资源 | 链接 |
|------|------|
| Oh My OpenCode GitHub | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) |
| OpenCode 官方文档 | [opencode.ai/docs](https://opencode.ai/docs/) |
| OpenCode 中文文档 | [opencodecn.com](https://opencodecn.com) |
| OpenCode GitHub | [anomalyco/opencode](https://github.com/anomalyco/opencode) |
| 安装指南 | [Installation Guide](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/installation.md) |
| Agent Skills 规范 | [opencode.ai/docs/skills](https://opencode.ai/docs/skills/) |
| 中文安装教程（知乎） | [知乎专栏](https://zhuanlan.zhihu.com/p/1994549093310154550) |
| 中文安装教程（博客园） | [cnblogs](https://www.cnblogs.com/misstaste/p/19491330) |
| 菜鸟教程 | [runoob.com](https://www.runoob.com/ai-agent/opencode-coding-agent.html) |

---

> **一句话总结**：安装 OmO → 输入 `ultrawork` → 描述需求 → 去喝杯咖啡 → 回来验收成果。

---

*本教程基于 Oh My OpenCode (oh-my-openagent) 最新版本编写。项目迭代迅速，建议定期查看 GitHub 仓库获取更新。*
