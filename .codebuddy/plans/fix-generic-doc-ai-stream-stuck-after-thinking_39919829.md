---
name: fix-generic-doc-ai-stream-stuck-after-thinking
overview: 修复通用文档中“生成AI内容”流式过程在思考结束后仍卡在“AI 正在回复...”且正文不输出的问题，重点排查并修正 SSE [DONE] 结束处理与前端流状态收敛。
todos:
  - id: trace-stream-chain
    content: 使用[subagent:code-explorer]复核SSE结束链路与调用点
    status: completed
  - id: fix-done-break
    content: 修改ai.rs使[DONE]后主动结束读取并返回
    status: completed
    dependencies:
      - trace-stream-chain
  - id: verify-finalize-path
    content: 校验Done与断流路径的思考闭合与正文flush
    status: completed
    dependencies:
      - fix-done-break
  - id: regression-generate-flow
    content: 回归生成AI内容，确认正文流式出现且提示消失
    status: completed
    dependencies:
      - verify-finalize-path
---

## User Requirements

用户反馈桌面端「通用文档 → 聊天面板 → 生成AI内容」路径存在流式生成异常：

- 思考过程折叠块已完整结束；  
- 但底部仍持续显示“AI 正在回复...”；  
- 正文内容没有继续流式输出或一直不出现。  

需要修复该卡住状态，确保生成流程能正确收敛，不再长时间停留在“回复中”。

## Product Overview

在现有生成流程中，保证“思考内容结束 → 正文输出/结束态收敛”连贯可见。
视觉效果上，用户应看到：思考区结束后，正文正常出现并持续更新；流结束后，加载提示消失。

## Core Features

- 修复流式结束判定，避免思考结束后连接仍挂起导致前端一直显示“AI 正在回复...”。
- 保证正文流式内容可正常到达并显示，不被异常结束流程阻断。
- 保证生成结束时状态正确回收（停止态、提示消失、消息最终落盘/显示一致）。

## Tech Stack Selection

- 前端：React + TypeScript + Zustand（`ChatPanel.tsx`、`useAppStore.ts`）
- 桌面桥接：Tauri `invoke/listen` 事件流（`ai:stream:chunk`）
- 后端：Rust + Tokio + reqwest SSE 解析（`apps/desktop/src-tauri/src/commands/ai.rs`）

## Implementation Approach

采用“后端流结束语义修正为主、前端状态回收校验为辅”的最小改动策略：
在 SSE 解析层收到 `[DONE]` 时主动结束读取流程并返回，而不是继续等待远端断链。这样 `generate_content_stream` 能及时返回，前端 `await` 解除后自然清理 streaming 状态。
该方案复用现有事件分发与状态机，不引入新架构，改动集中且回归面可控。

- 关键决策：优先修复 `for_each_sse_event` 的结束控制，避免在 UI 层增加复杂超时兜底逻辑。
- 复杂度：SSE 仍是 O(n) 单次流遍历；优化后减少无效等待，降低长连接悬挂带来的资源占用。

## Implementation Notes (Execution Details)

- 保持现有 `request_id` 过滤与 `streamStateByTab` 机制不变，避免影响并发标签页隔离。
- `[DONE]` 到达时应先触发现有 Done 分支收尾，再退出读取循环，确保思考块闭合与 pending 内容 flush 逻辑不丢失。
- 不做无关重构；仅调整结束条件与必要的收尾一致性，控制影响面在 AI 流式链路内。
- 若补充日志，仅沿用现有风格，避免输出大文本或敏感信息。

## Architecture Design

现有链路保持不变，仅修正结束控制点：

`ChatPanel.handleGenerate`
→ `useAppStore.generateContentStream`
→ `invoke('generate_content_stream')`
→ Rust `generate_content_stream -> chat_stream -> stream_sse_chat_completions -> for_each_sse_event`
→ `window.emit('ai:stream:chunk')` 回前端渲染

本次变更重点位于 `for_each_sse_event` 的 `[DONE]` 处理与下游收尾一致性。

## Directory Structure

## Directory Structure Summary

本次以单文件主修复为主，前端文件以回归验证为主，默认不改动。

```text
/Users/jdh/Code/AiDocPlus/
└── apps/
    └── desktop/
        └── src-tauri/
            └── src/
                └── commands/
                    └── ai.rs  # [MODIFY] SSE 通用解析器结束策略修复。收到 [DONE] 后主动终止读取并返回；保持现有 Done 收尾逻辑可执行，避免前端 streaming 状态无法收敛。
```

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 在实现前后快速复核 SSE 结束链路与调用影响点（含 `generate_content_stream/chat_stream` 相关调用）。
- Expected outcome: 确认改动边界准确、无遗漏调用点，并支撑回归范围最小化。