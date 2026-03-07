/**
 * 思维导图 AI 助手 - 输入建议与阶段指示器
 *
 * 根据导图阶段（blank / has_content / detailed / iterating）
 * 动态生成输入建议芯片和阶段指示标签。
 */

import type { MindmapPluginData } from './types';
import { detectMindmapPhase } from './mindmapContext';
import type { MindmapPhase } from './mindmapContext';

// ── 建议芯片 ──

export interface SuggestionChip {
  id: string;
  label: string;
  prompt: string;
  variant: 'primary' | 'default' | 'warning';
}

export function getInputSuggestions(data: MindmapPluginData): SuggestionChip[] {
  const phase = detectMindmapPhase(data);

  switch (phase) {
    case 'blank':
      return [
        { id: 'create-ai', label: 'AI 智能生成', prompt: '根据本文档的正文内容，生成结构化思维导图。', variant: 'primary' },
        { id: 'create-detail', label: '详细展开', prompt: '根据本文档的正文内容，生成详细的多层级思维导图，尽量展开所有要点。', variant: 'default' },
        { id: 'create-summary', label: '精简概括', prompt: '根据本文档的正文内容，生成精简的思维导图，只保留核心要点，不超过3层。', variant: 'default' },
        { id: 'create-swot', label: 'SWOT 分析', prompt: '对本文档内容进行 SWOT 分析，生成思维导图。', variant: 'default' },
      ];
    case 'has_content':
      return [
        { id: 'expand', label: '扩展子节点', prompt: '请对当前思维导图的各个要点进行展开，补充更多细节和子节点。', variant: 'primary' },
        { id: 'deepen', label: '深化内容', prompt: '请深化当前思维导图的内容，为每个分支添加更多层级的详细信息。', variant: 'default' },
        { id: 'balance', label: '平衡结构', prompt: '请分析当前思维导图的结构，补充不够完整的分支，使整体结构更加均衡。', variant: 'default' },
      ];
    case 'detailed':
      return [
        { id: 'simplify', label: '精简优化', prompt: '请精简当前思维导图，去除冗余内容，保留核心要点。', variant: 'primary' },
        { id: 'restructure', label: '重新组织', prompt: '请重新组织当前思维导图的结构，使逻辑更加清晰。', variant: 'default' },
        { id: 'summarize', label: '生成总结', prompt: '请基于当前思维导图的内容，生成一段简洁的文字总结。', variant: 'default' },
      ];
    case 'iterating':
      return [
        { id: 'continue', label: '继续完善', prompt: '请继续完善当前思维导图，补充遗漏的要点。', variant: 'primary' },
        { id: 'review', label: '审查建议', prompt: '请审查当前思维导图，指出可以改进的地方并给出建议。', variant: 'default' },
        { id: 'translate', label: '翻译', prompt: '请将当前思维导图的所有节点翻译为英文，保持结构不变。', variant: 'default' },
      ];
    default:
      return [];
  }
}

// ── 阶段指示器 ──

export interface PhaseIndicator {
  label: string;
  color: string;
}

export function getPhaseIndicator(data: MindmapPluginData): PhaseIndicator {
  const phase = detectMindmapPhase(data);
  const map: Record<MindmapPhase, PhaseIndicator> = {
    blank: { label: '空白', color: 'text-muted-foreground' },
    has_content: { label: '已有内容', color: 'text-amber-600 dark:text-amber-400' },
    detailed: { label: '详细结构', color: 'text-green-600 dark:text-green-400' },
    iterating: { label: '迭代中', color: 'text-blue-600 dark:text-blue-400' },
  };
  return map[phase] || map.blank;
}

// ── 动态 placeholder ──

export function getInputPlaceholder(data: MindmapPluginData): string {
  const phase = detectMindmapPhase(data);
  const map: Record<MindmapPhase, string> = {
    blank: '描述你的主题，AI 帮你生成思维导图...',
    has_content: '需要扩展、深化还是调整结构？',
    detailed: '思维导图已很详细，需要精简或重组？',
    iterating: '继续迭代，或描述新的需求...',
  };
  return map[phase] || map.blank;
}

// ── 自动上下文模式 ──

import type { MindmapContextMode } from './types';

export function autoContextMode(phase: MindmapPhase): MindmapContextMode {
  switch (phase) {
    case 'blank': return 'none';
    case 'has_content': return 'structure';
    case 'detailed': return 'full';
    case 'iterating': return 'full';
    default: return 'none';
  }
}
