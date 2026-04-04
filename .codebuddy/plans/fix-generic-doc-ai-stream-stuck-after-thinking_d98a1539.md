---
name: fix-generic-doc-ai-stream-stuck-after-thinking
overview: 定位并修复“思考结束后卡在 AI 正在回复”问题：完善后端流取消与空闲收敛机制，并确保 think/正文分离在流式与收尾路径一致。
todos:
  - id: audit-stream-state-machine
    content: 使用[subagent:code-explorer]复核流式结束与取消状态机链路
    status: completed
  - id: fix-tauri-sse-cancel
    content: 修正ai.rs读取循环可取消性与完成判定优先级
    status: completed
    dependencies:
      - audit-stream-state-machine
  - id: normalize-think-protocol
    content: 统一后端think标签输出并补齐异常断流闭合
    status: completed
    dependencies:
      - fix-tauri-sse-cancel
  - id: stabilize-frontend-streaming
    content: 调整useAppStore空闲回收为仅stop不抛超时失败
    status: completed
    dependencies:
      - fix-tauri-sse-cancel
  - id: harden-think-parser
    content: 增强thinkTagParser兼容并验证正文提取不含思考
    status: completed
    dependencies:
      - normalize-think-protocol
  - id: regression-verify-generic-doc
    content: 执行通用文档端到端回归并记录卡住与正文分离结果
    status: completed
    dependencies:
      - stabilize-frontend-streaming
      - harden-think-parser
---

## User Requirements

- 修复通用文档“生成AI内容”流式场景：思考过程结束后不再长期停留“AI 正在回复...”。
- 保证 `&lt;think&gt;...&lt;/think&gt;` 与正文严格分离：`&lt;/think&gt;` 之后正文应持续进入正文编辑区，思考内容不得写入正文区。
- 避免误报失败：不能再因前端激进空闲策略导致“AI stream idle timeout”打断正常流程。
- 在“仅思考、正文很晚到达或无正文”情况下也要可收敛、可结束、状态正确回收。

## Product Overview

- 现有聊天面板保留思考折叠显示与正文编辑联动。
- 流式过程中应持续更新：思考块用于展示推理，正文区仅显示可应用文本。
- 流结束后必须稳定收敛：停止动画、保留可用结果、无卡死体验。

## Core Features

- 流式生命周期收敛：开始、分片、结束、取消、异常断流的统一状态机。
- 思考/正文通道隔离：后端输出规范化标签，前端解析一致落盘。
- 低误杀兜底：超时仅用于安全回收，不破坏正常慢流与延迟首包场景。

## Tech Stack Selection

- 复用现有桌面架构：Tauri Rust 命令层 + React/TypeScript Zustand 状态层。
- 仅在既有链路改造，不引入新框架或新通信机制。

## Implementation Approach

- 采用“后端流结束可判定 + 前端状态机可回收”的双层策略：
1) 后端 SSE 读取循环增加可中断与完成判定（`[DONE]`、`finish_reason`、`response.completed`、取消信号）。
2) 前端仅做非侵入回收（停止请求与清理状态），不主动抛超时失败。
3) `think` 标签协议统一为 `&lt;think&gt;...&lt;/think&gt;`，解析器兼容历史标记，确保正文提取稳定。
- 关键权衡：优先保证“不卡死、不错杀”；宁可延迟结束，也不提前报错中断有效流。
- 性能：解析保持单次线性扫描，事件处理 O(n)；避免多余重渲染，沿用现有节流更新策略。

## Implementation Notes (Execution Details)

- 保持现有事件名 `ai:stream:chunk` 与 `request_id` 过滤规则，避免跨标签串流污染。
- `stop_ai_stream` 后端仅置取消标记时，需在读取循环中加入周期性取消检查/超时唤醒，避免 `stream.next().await` 长阻塞。
- 禁止将思考兜底闭合替换为普通换行；异常结束必须补 `&lt;/think&gt;`。
- 前端空闲监控可保留“发 stop”动作，但不再直接 reject 业务 Promise。
- 仅改动相关文件，避免扩散到无关 AI 功能模块。

## Architecture Design

- 数据流：`ChatPanel.handleGenerate` → `useAppStore.generateContentStream` → `invoke(generate_content_stream)` → `chat_stream` → `for_each_sse_event` → `ai:stream:chunk` 回流。
- 分层职责：
- Rust 命令层：SSE 解析、结束判定、取消响应、think 包装。
- Store 层：请求生命周期、监听器管理、流状态回收。
- UI 层：基于 `parseThinkTags` 分离显示与正文落盘。

## Directory Structure Summary

本次为现有链路修复，涉及 3 个核心文件：

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/ai.rs`  [MODIFY]  
目的：修复 SSE 结束/取消收敛与 think 输出协议。
要点：完善 `for_each_sse_event` 终止条件与可取消性；统一 Responses/ChatCompletions 的 think 开闭标签；确保异常断流 flush 正确。

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/stores/useAppStore.ts`  [MODIFY]  
目的：修复生成流状态卡死与误超时失败。
要点：保留空闲 stop 保护但不主动 reject；确保 finally 统一清理 `unlisten/requestId/streaming state`。

- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/utils/thinkTagParser.ts`  [MODIFY]  
目的：保证思考与正文分离稳定。
要点：优先解析标准 `&lt;think&gt;`；兼容历史 `💭` 标记；避免将思考残留误入正文。

## Agent Extensions

- **code-explorer**
- Purpose: 复核跨文件调用链与回归影响面（ChatPanel、Store、Tauri 命令层）。
- Expected outcome: 输出完整调用与状态收敛链路，确保修复不遗漏分支。