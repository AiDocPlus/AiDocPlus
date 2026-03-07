/**
 * Mermaid AI 助手 — 智能上下文引擎
 *
 * 职责：
 * - 图表阶段自动检测（blank/has_code/rendered/iterating）
 * - 自动上下文模式选择（取代手动切换）
 * - 分层构建上下文（critical / important / supplementary）
 * - Token 预算管理
 * - Mermaid 结构分析
 * - 智能系统提示词生成
 */

import type { MermaidPluginData, MermaidContextMode } from './types';

// ── 图表阶段 ──

export type MermaidPhase = 'blank' | 'has_code' | 'rendered' | 'iterating';

export function detectMermaidPhase(data: MermaidPluginData | null | undefined): MermaidPhase {
  if (!data || !data.mermaidCode?.trim()) return 'blank';
  const hasHistory = (data.aiHistory?.length || 0) > 1;
  if (hasHistory) return 'iterating';
  if (data.lastRenderedAt) return 'rendered';
  return 'has_code';
}

// ── 自动上下文模式 ──

export function autoContextMode(phase: MermaidPhase): MermaidContextMode {
  switch (phase) {
    case 'blank': return 'none';
    case 'has_code': return 'code';
    case 'rendered': return 'structure';
    case 'iterating': return 'full';
  }
}

// ── Mermaid 结构分析 ──

export interface MermaidStructure {
  diagramType: string;
  nodeCount: number;
  edgeCount: number;
  hasSubgraph: boolean;
  hasStyle: boolean;
  hasNote: boolean;
  lineCount: number;
}

export function analyzeMermaidStructure(code: string): MermaidStructure {
  const lines = code.trim().split('\n');
  const firstLine = lines[0]?.trim().toLowerCase() || '';

  let diagramType = 'unknown';
  if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) diagramType = 'flowchart';
  else if (firstLine.startsWith('sequencediagram')) diagramType = 'sequence';
  else if (firstLine.startsWith('classdiagram')) diagramType = 'class';
  else if (firstLine.startsWith('statediagram')) diagramType = 'state';
  else if (firstLine.startsWith('erdiagram')) diagramType = 'er';
  else if (firstLine.startsWith('gantt')) diagramType = 'gantt';
  else if (firstLine.startsWith('pie')) diagramType = 'pie';
  else if (firstLine.startsWith('mindmap')) diagramType = 'mindmap';
  else if (firstLine.startsWith('timeline')) diagramType = 'timeline';
  else if (firstLine.startsWith('journey')) diagramType = 'journey';
  else if (firstLine.startsWith('gitgraph')) diagramType = 'git';

  let nodeCount = 0;
  let edgeCount = 0;
  let hasSubgraph = false;
  let hasStyle = false;
  let hasNote = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('subgraph')) hasSubgraph = true;
    if (trimmed.startsWith('style') || trimmed.startsWith('classDef')) hasStyle = true;
    if (trimmed.startsWith('note') || trimmed.includes('Note ')) hasNote = true;
    // 简单计数：含 --> ---> -.-> ==> 的行视为边
    if (/-->|---->|-.->|==>|->|--\|/.test(trimmed)) edgeCount++;
    // 含 [ ] 或 { } 或 ( ) 的标识行视为节点定义
    if (/\w+[\[({]/.test(trimmed) || /\w+\s*-->/.test(trimmed)) nodeCount++;
  }

  return {
    diagramType,
    nodeCount: Math.max(nodeCount, 1),
    edgeCount,
    hasSubgraph,
    hasStyle,
    hasNote,
    lineCount: lines.length,
  };
}

// ── 上下文摘要 ──

export interface ContextSummaryInfo {
  lineCount: number;
  diagramType: string;
  nodeCount: number;
  edgeCount: number;
  text: string;
}

export function getContextSummary(
  data: MermaidPluginData | null | undefined,
): ContextSummaryInfo {
  const code = data?.mermaidCode?.trim() || '';
  const phase = detectMermaidPhase(data);

  if (!code) {
    return { lineCount: 0, diagramType: '', nodeCount: 0, edgeCount: 0, text: `阶段: ${phase}` };
  }

  const struct = analyzeMermaidStructure(code);
  const parts: string[] = [];
  parts.push(`阶段: ${phase}`);
  parts.push(`类型: ${struct.diagramType}`);
  parts.push(`节点: ~${struct.nodeCount}, 边: ~${struct.edgeCount}`);
  parts.push(`行数: ${struct.lineCount}`);
  if (struct.hasSubgraph) parts.push('含子图');
  if (struct.hasStyle) parts.push('含样式');

  return {
    lineCount: struct.lineCount,
    diagramType: struct.diagramType,
    nodeCount: struct.nodeCount,
    edgeCount: struct.edgeCount,
    text: parts.join(' | '),
  };
}

// ── 估算 token 数 ──

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

// ── 构建上下文 ──

export function buildContextForMode(
  data: MermaidPluginData | null | undefined,
  mode: MermaidContextMode,
  docContent?: string,
  tokenBudget = 4000,
): string {
  const code = data?.mermaidCode?.trim() || '';

  if (mode === 'none') {
    // 空白阶段：只附带文档摘要帮助 AI 理解需求
    if (!docContent) return '';
    const summary = docContent.slice(0, tokenBudget * 2);
    return `\n\n--- 文档正文摘要 ---\n${summary}\n--- 摘要结束 ---`;
  }

  if (mode === 'code') {
    // 有代码：附带完整代码
    let ctx = '';
    if (code) {
      ctx += `\n\n--- 当前 Mermaid 代码 ---\n${code}\n--- 代码结束 ---`;
    }
    const remaining = tokenBudget - estimateTokens(ctx);
    if (remaining > 200 && docContent) {
      const docSlice = docContent.slice(0, remaining * 2);
      ctx += `\n\n--- 文档正文摘要 ---\n${docSlice}\n--- 摘要结束 ---`;
    }
    return ctx;
  }

  if (mode === 'structure') {
    // 结构分析：代码 + 结构摘要
    let ctx = '';
    if (code) {
      const struct = analyzeMermaidStructure(code);
      ctx += `\n\n--- 图表结构分析 ---\n`;
      ctx += `类型: ${struct.diagramType}\n`;
      ctx += `节点数: ~${struct.nodeCount}, 边数: ~${struct.edgeCount}\n`;
      ctx += `行数: ${struct.lineCount}\n`;
      if (struct.hasSubgraph) ctx += `包含子图分组\n`;
      if (struct.hasStyle) ctx += `包含样式定义\n`;
      if (struct.hasNote) ctx += `包含注释\n`;
      ctx += `--- 分析结束 ---`;
      ctx += `\n\n--- 当前 Mermaid 代码 ---\n${code}\n--- 代码结束 ---`;
    }
    return ctx;
  }

  // full：完整上下文
  let ctx = '';
  if (code) {
    const struct = analyzeMermaidStructure(code);
    ctx += `\n\n--- 图表结构分析 ---\n`;
    ctx += `类型: ${struct.diagramType}, 节点: ~${struct.nodeCount}, 边: ~${struct.edgeCount}\n`;
    ctx += `--- 分析结束 ---`;
    ctx += `\n\n--- 当前 Mermaid 代码 ---\n${code}\n--- 代码结束 ---`;
  }
  // AI 生成历史
  const history = data?.aiHistory;
  if (history && history.length > 0) {
    const recent = history.slice(-3);
    ctx += `\n\n--- 最近修改历史 ---\n`;
    for (const h of recent) {
      ctx += `[${new Date(h.timestamp).toLocaleTimeString()}] ${h.prompt.slice(0, 100)}\n`;
    }
    ctx += `--- 历史结束 ---`;
  }
  const remaining = tokenBudget - estimateTokens(ctx);
  if (remaining > 200 && docContent) {
    const docSlice = docContent.slice(0, remaining * 2);
    ctx += `\n\n--- 文档正文 ---\n${docSlice}\n--- 正文结束 ---`;
  }
  return ctx;
}

// ── 估算上下文 token 数（供 UI 显示） ──

export function estimateContextTokens(
  data: MermaidPluginData | null | undefined,
  mode: MermaidContextMode,
  docContent?: string,
): number {
  const ctx = buildContextForMode(data, mode, docContent);
  return estimateTokens(ctx);
}

// ── 默认系统提示词 ──

export function getDefaultSystemPrompt(): string {
  return `你是一个专业的 Mermaid 图表助手。你擅长：
1. 根据用户描述创建各种 Mermaid 图表（流程图、时序图、类图、状态图、ER图、甘特图、饼图、思维导图等）
2. 分析和优化现有图表的结构、样式和可读性
3. 修复 Mermaid 语法错误
4. 解释图表含义

规则：
- 当用户要求生成或修改图表时，只输出 Mermaid 代码，不要包含 \`\`\`mermaid 标记
- 当用户要求分析或解释时，用中文详细回答
- 始终确保生成的代码语法正确
- 优先使用简洁清晰的图表结构`;
}

// ── 智能系统提示词 ──

export function buildSmartSystemPrompt(
  data: MermaidPluginData | null | undefined,
  docContent?: string,
  customPrompt?: string,
): string {
  const base = customPrompt || getDefaultSystemPrompt();
  const phase = detectMermaidPhase(data);
  const code = data?.mermaidCode?.trim();

  let phaseHint = '';
  switch (phase) {
    case 'blank':
      phaseHint = '\n\n当前状态：用户尚未创建图表。优先引导用户描述需求，然后生成合适的图表。';
      break;
    case 'has_code':
      phaseHint = '\n\n当前状态：用户已有 Mermaid 代码。可以帮助优化、修改或解释。';
      break;
    case 'rendered':
      phaseHint = '\n\n当前状态：图表已渲染。可以帮助调整样式、添加注释或进一步优化。';
      break;
    case 'iterating':
      phaseHint = '\n\n当前状态：用户正在迭代优化图表。注意保持之前的修改，在此基础上改进。';
      break;
  }

  if (code) {
    const struct = analyzeMermaidStructure(code);
    phaseHint += `\n图表类型: ${struct.diagramType}，约 ${struct.nodeCount} 个节点、${struct.edgeCount} 条边。`;
  }

  // 注入文档正文摘要，让 AI 感知文档内容
  if (docContent?.trim()) {
    const maxLen = 6000;
    const trimmedDoc = docContent.trim().length > maxLen ? docContent.trim().slice(0, maxLen) + '\n...(已截断)' : docContent.trim();
    phaseHint += `\n\n--- 用户文档正文 ---\n${trimmedDoc}\n--- 文档正文结束 ---`;
    phaseHint += `\n\n重要：当用户提到"文档"、"正文"、"内容"时，请基于上面的文档正文来生成图表。`;
  }

  return base + phaseHint;
}
