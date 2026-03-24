# Tushare 工具调用分析报告

## 一、完整调用链路

```
StockResearchAISidebar (enableTools: true)
  → sendDocTypeAIMessage() 自定义事件
    → DocTypeAIChatBase 捕获事件
      → 检查 enableTools && supportsFunctionCalling
        → host.ai.chatStream → sendChatMessage (useAppStore)
          → invoke('chat_stream', { enableTools: true })
            → Rust chat_stream:
              1. 非流式请求 + tools 定义 → AI Provider
              2. AI 返回 tool_calls → 执行工具 → 结果加入对话
              3. 循环最多5轮
              4. 最终流式输出给用户
```

### 关键文件

| 文件 | 作用 |
|------|------|
| `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchAISidebar.tsx` | 发起 AI 请求，设置 `enableTools: true` |
| `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/_shared/DocTypeAIChatBase.tsx` | 中转层，检查 provider 是否支持 functionCalling |
| `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/stores/useAppStore.ts` | 调用 Tauri `chat_stream` 命令 |
| `/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/ai.rs` | 后端 Function Calling 循环核心逻辑 (L279-L368) |
| `/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/tools.rs` | 工具定义 + 执行分发（通用文档工具） |
| `/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/stock.rs` | 股票工具定义 (L1154-L1486) + 执行 (L1500-L1787) |

---

## 二、发现的问题

### 问题 1：⚠️ 工具定义过多（53+ 个）

`get_builtin_tool_definitions()` 返回的工具列表 = 通用文档工具 (15个) + 股票工具 (38个) = **53+ 个工具**。

**影响**：
- 大量工具定义占用 token，压缩了实际对话内容的空间
- 模型在 50+ 工具中选择正确的工具变得困难
- 文档工具（`search_documents`、`read_document` 等）在股票研究场景中完全无用，但仍被传给 AI

**位置**：`/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/tools.rs` L55-L170

### 问题 2：🔴 联网搜索与 Function Calling 互斥

后端代码明确注释（`ai.rs` L294-L296）：

> Function Calling 模式下不注入 provider 专有的 web_search 参数：
> 混用 web_search tool 与 Function Calling tools 会导致部分 provider（如 GLM）返回 401/400

但 `handleOneClickResearch` 同时设置了 `forceWebSearch: true` 和 `enableTools: true`。

**实际行为**：
- 工具调用阶段（非流式）：❌ 无联网搜索
- 最终输出阶段（流式）：✅ 有联网搜索

**影响**：一键研究 Prompt 的第7步要求"联网搜索最新新闻"，但此时处于工具调用阶段，联网搜索不可用。模型无法在工具调用过程中获取新闻数据。

**位置**：
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/ai.rs` L279-L296
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchAISidebar.tsx` L212-L219

### 问题 3：⚠️ System Prompt 重复描述工具

System Prompt（`StockResearchAISidebar.tsx` L555-L572）用自然语言列出了工具名和参数格式（如 `stock_search(keyword)`），而 AI 请求的 `tools` 参数也包含了完整的 OpenAI Function Calling 格式的工具定义。

**影响**：
- 双重描述浪费 token
- 两者的工具名/参数描述可能不一致，导致 AI 困惑
- AI 可能在回复文本中"假装调用工具"而非使用真正的 Function Calling 机制

### 问题 4：⚠️ 最多5轮限制可能不够

```rust
let max_rounds = 5;  // ai.rs L281
```

一键研究需要依次调用：`stock_search` → `stock_basic_info` → `stock_daily` → `stock_indicator` → `stock_income` → `stock_moneyflow` = **6个工具**。

如果 AI 每轮只调用1个工具，5轮不够完成完整研究。虽然某些 AI 模型支持单轮并行调用多个工具，但并非所有模型都如此。

### 问题 5：⚠️ 工具调用过程无反馈

工具调用阶段使用非流式请求（`stream: false`），用户只能看到一个 `> 🔧 正在调用工具...` 提示，无法知道：
- 正在调用哪个工具
- 调用了什么参数
- 返回了什么结果
- 当前处于第几轮

对于可能耗时数十秒的多轮工具调用，用户体验很差。

### 问题 6：⚠️ 一键研究 Prompt 过于刚性

`DEFAULT_ONE_CLICK_PROMPT`（`constants.ts` L167-L197）要求 AI "严格按顺序执行"8个步骤，并输出固定 JSON 格式。

**影响**：
- 与 Function Calling 的设计理念冲突（应让模型自主决定何时调用什么工具）
- JSON 输出格式在 Function Calling 上下文中容易被模型误解为工具调用参数
- 步骤中混合了工具调用（步骤1-6）和联网搜索（步骤7），但两者不能同时使用

---

## 三、改进建议

### 建议 1：按场景过滤工具

根据调用来源传递不同的工具集合：
- 股票研究场景：只传股票相关工具（~38个）
- 通用聊天场景：只传文档工具（~15个）

可在 `chat_stream` 添加 `tool_scope` 参数（如 `"stock"` / `"document"` / `"all"`），在 `get_builtin_tool_definitions()` 中按 scope 过滤。

### 建议 2：解决联网搜索与工具调用冲突

**方案 A**：两阶段执行
1. 先执行 Function Calling 获取结构化数据
2. 再执行联网搜索获取新闻/动态
3. 最后将两者合并为最终回复

**方案 B**：移除 Prompt 中的联网搜索步骤
让 AI 在工具调用结束后的流式输出阶段（此时联网搜索可用）自动进行搜索。

### 建议 3：简化 System Prompt 中的工具描述

当 `enableTools: true` 时，移除 System Prompt 中手写的工具列表（L555-L572）。OpenAI 格式的 `tools` 参数已经包含完整定义，无需重复。

保留的内容应聚焦于**使用策略**：
- 何时应该调用工具
- 数据获取的优先级
- 如何处理工具返回的空数据

### 建议 4：增加工具调用轮次并改善反馈

- `max_rounds` 从 5 提升到 8-10
- 每次调用工具时，通过 `ai:stream:chunk` 事件发送详细信息：
  ```
  > 🔧 正在调用 stock_search(keyword="贵州茅台")...
  > ✅ 找到 600519.SH 贵州茅台
  > 🔧 正在调用 stock_basic_info(ts_code="600519.SH")...
  ```

### 建议 5：优化一键研究 Prompt

将刚性的步骤序列改为目标描述：
- 告诉 AI 需要获取哪些数据维度（基本面、技术面、资金面）
- 让 AI 自主决定调用顺序和工具组合
- 分离工具调用需求与联网搜索需求

---

## 四、优先级排序

| 优先级 | 问题 | 预估影响 |
|--------|------|----------|
| P0 | 联网搜索与 Function Calling 互斥 | 导致无法在工具调用中获取新闻 |
| P1 | 工具定义过多（53+个） | 显著影响模型选择准确度 |
| P1 | System Prompt 重复描述工具 | 浪费 token + 潜在混淆 |
| P2 | 一键研究 Prompt 过于刚性 | 与 Function Calling 理念冲突 |
| P2 | 工具调用过程无反馈 | 用户体验差 |
| P3 | 5轮限制可能不够 | 某些模型无法完成完整研究 |
