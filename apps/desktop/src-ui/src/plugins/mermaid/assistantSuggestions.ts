/**
 * Mermaid AI 助手 — 智能建议引擎
 *
 * 根据当前图表阶段、代码状态、最后 AI 回复内容，
 * 动态生成建议 chip 列表，显示在输入框上方。
 */

import type { MermaidPluginData } from './types';
import { detectMermaidPhase, analyzeMermaidStructure, type MermaidPhase } from './mermaidContext';

// ── 建议项类型 ──

export interface SuggestionChip {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'warning';
}

// ── 阶段指示器 ──

export interface PhaseIndicator {
  phase: MermaidPhase;
  label: string;
  color: string;
}

export function getPhaseIndicator(data: MermaidPluginData | null | undefined): PhaseIndicator {
  const phase = detectMermaidPhase(data);
  switch (phase) {
    case 'blank':
      return { phase, label: '空白', color: 'text-muted-foreground bg-muted' };
    case 'has_code':
      return { phase, label: '已有代码', color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950' };
    case 'rendered':
      return { phase, label: '已渲染', color: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950' };
    case 'iterating':
      return { phase, label: '迭代中', color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950' };
  }
}

// ── 上方建议（输入框上方的 chip 列表） ──

export function getInputSuggestions(
  data: MermaidPluginData | null | undefined,
  hasRenderError?: boolean,
): SuggestionChip[] {
  const phase = detectMermaidPhase(data);
  const code = data?.mermaidCode?.trim() || '';
  const chips: SuggestionChip[] = [];

  if (phase === 'blank') {
    // 空白阶段：引导创建
    chips.push(
      { id: 's_flowchart', label: '创建流程图', icon: 'GitBranch', prompt: '帮我创建一个流程图', variant: 'primary' },
      { id: 's_sequence', label: '创建时序图', icon: 'ArrowDownUp', prompt: '帮我创建一个时序图' },
      { id: 's_class', label: '创建类图', icon: 'Box', prompt: '帮我创建一个类图' },
      { id: 's_mindmap', label: '创建思维导图', icon: 'Brain', prompt: '帮我创建一个 Mermaid 思维导图' },
    );
    return chips;
  }

  // 有代码的阶段
  if (hasRenderError) {
    chips.push(
      { id: 's_fix', label: '修复语法', icon: 'Wrench', prompt: '请检查并修复当前 Mermaid 代码的语法错误，只输出修正后的代码', variant: 'warning' },
      { id: 's_check', label: '检查代码', icon: 'ShieldCheck', prompt: '请详细检查当前代码有什么问题，给出具体的错误位置和修复建议' },
    );
    return chips;
  }

  if (code) {
    const struct = analyzeMermaidStructure(code);

    // 通用建议
    chips.push(
      { id: 's_optimize', label: '优化布局', icon: 'Sparkles', prompt: '请优化当前图表的布局和结构，使其更清晰易读。只输出 Mermaid 代码。' },
    );

    if (!struct.hasStyle) {
      chips.push(
        { id: 's_style', label: '添加样式', icon: 'Paintbrush', prompt: '为当前图表添加样式（颜色、形状），使关键节点更突出。只输出 Mermaid 代码。' },
      );
    }

    if (struct.lineCount < 15) {
      chips.push(
        { id: 's_enrich', label: '丰富细节', icon: 'Maximize2', prompt: '丰富当前图表的细节，添加更多节点和连线。只输出 Mermaid 代码。' },
      );
    } else if (struct.lineCount > 40) {
      chips.push(
        { id: 's_simplify', label: '简化结构', icon: 'Minimize2', prompt: '简化当前图表，合并冗余节点，保持核心逻辑。只输出 Mermaid 代码。' },
      );
    }

    if (!struct.hasSubgraph && struct.nodeCount > 5 && struct.diagramType === 'flowchart') {
      chips.push(
        { id: 's_subgraph', label: '添加子图', icon: 'LayoutDashboard', prompt: '将逻辑相关的节点用 subgraph 分组。只输出 Mermaid 代码。' },
      );
    }

    chips.push(
      { id: 's_explain', label: '解释图表', icon: 'HelpCircle', prompt: '请详细解释当前图表的含义和结构' },
    );

    if (struct.diagramType === 'flowchart') {
      chips.push(
        { id: 's_convert_seq', label: '转换类型', icon: 'ArrowRightLeft', prompt: '将当前流程图转换为时序图格式。只输出 Mermaid 代码。' },
      );
    }
  }

  return chips.slice(0, 5);
}

// ── AI 回复后的跟进建议 ──

export function getFollowUpSuggestions(
  _lastAiMessage: string,
  _data: MermaidPluginData | null | undefined,
  hasMermaidCode: boolean,
): SuggestionChip[] {
  const chips: SuggestionChip[] = [];

  if (hasMermaidCode) {
    // AI 回复包含代码
    chips.push(
      { id: 'f_apply', label: '应用并预览', icon: 'Play', prompt: '', variant: 'primary' },
      { id: 'f_continue', label: '继续修改', icon: 'Pencil', prompt: '在此基础上继续修改：' },
      { id: 'f_regen', label: '重新生成', icon: 'RefreshCw', prompt: '请重新生成，要求不同的风格或结构' },
    );
  } else {
    // AI 回复是分析/解释
    chips.push(
      { id: 'f_follow', label: '根据建议修改', icon: 'Wand2', prompt: '请根据你刚才的分析和建议，直接修改图表代码。只输出 Mermaid 代码。', variant: 'primary' },
      { id: 'f_detail', label: '追问细节', icon: 'MessageSquare', prompt: '请更详细地解释：' },
    );
  }

  return chips;
}
