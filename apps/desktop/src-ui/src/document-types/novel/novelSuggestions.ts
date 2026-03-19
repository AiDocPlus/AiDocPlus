/**
 * 小说写作 AI 助手 - 输入建议与阶段指示器
 *
 * 参照 MindMap 插件的 assistantSuggestions.ts 架构：
 * 根据写作阶段（blank/drafting/revising/polishing）
 * 动态生成输入建议芯片和阶段指示标签。
 */

import type { NovelDocumentContent } from './types';
import { detectNovelPhase, type NovelPhase, type NovelContextMode } from './novelContext';

// ── 建议芯片 ──

export interface NovelSuggestionChip {
  id: string;
  label: string;
  prompt: string;
  variant: 'primary' | 'default' | 'warning';
}

export function getNovelSuggestions(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
): NovelSuggestionChip[] {
  const phase = detectNovelPhase(novel, activeChapterId);

  switch (phase) {
    case 'blank':
      return [
        { id: 'start-write', label: '开始写作', prompt: '请根据大纲和角色设定，为当前章节写一个引人入胜的开头。', variant: 'primary' },
        { id: 'start-scene', label: '设定场景', prompt: '请为当前章节设计一个具有画面感的开场场景。', variant: 'default' },
        { id: 'start-dialogue', label: '以对话开场', prompt: '请用一段引人入胜的角色对话作为本章开头。', variant: 'default' },
      ];
    case 'drafting':
      return [
        { id: 'continue', label: '续写下段', prompt: '请续写以下小说正文，保持文风和节奏一致。', variant: 'primary' },
        { id: 'switch-scene', label: '切换场景', prompt: '请写一段转场过渡，切换到新的场景或时间。', variant: 'default' },
        { id: 'add-dialogue', label: '加入对话', prompt: '请在当前情节中加入一段角色对话，推动情节发展。', variant: 'default' },
        { id: 'add-detail', label: '补充细节', prompt: '请为当前段落补充感官细节和环境描写。', variant: 'default' },
      ];
    case 'revising':
      return [
        { id: 'polish-text', label: '润色文字', prompt: '请对当前章节进行语言润色，提升文学性。', variant: 'primary' },
        { id: 'check-logic', label: '检查逻辑', prompt: '请检查当前章节的情节逻辑是否合理，有无漏洞。', variant: 'default' },
        { id: 'add-foreshadow', label: '补充伏笔', prompt: '请建议在当前章节中可以埋设的伏笔。', variant: 'default' },
      ];
    case 'polishing':
      return [
        { id: 'final-check', label: '最终校对', prompt: '请检查当前章节的语法、错别字和不通顺的句子。', variant: 'primary' },
        { id: 'unify-style', label: '统一文风', prompt: '请检查当前章节的文风是否统一，指出风格不一致的地方。', variant: 'default' },
        { id: 'gen-summary', label: '生成摘要', prompt: '请为当前章节生成200-400字的摘要。', variant: 'default' },
      ];
    default:
      return [];
  }
}

// ── 阶段指示器 ──

export interface NovelPhaseIndicator {
  label: string;
  color: string;
}

export function getNovelPhaseIndicator(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
): NovelPhaseIndicator {
  const phase = detectNovelPhase(novel, activeChapterId);
  const map: Record<NovelPhase, NovelPhaseIndicator> = {
    blank: { label: '空白', color: 'text-muted-foreground' },
    drafting: { label: '初稿', color: 'text-amber-600 dark:text-amber-400' },
    revising: { label: '修订', color: 'text-blue-600 dark:text-blue-400' },
    polishing: { label: '定稿', color: 'text-green-600 dark:text-green-400' },
  };
  return map[phase] || map.blank;
}

// ── 动态 placeholder ──

export function getNovelInputPlaceholder(
  novel: NovelDocumentContent,
  activeChapterId: string | null,
): string {
  const phase = detectNovelPhase(novel, activeChapterId);
  const map: Record<NovelPhase, string> = {
    blank: '描述你的想法，AI 帮你开始写作...',
    drafting: '续写、加对话、切换场景，或描述你的需求...',
    revising: '润色、检查逻辑、补充伏笔...',
    polishing: '最终润色、校对、生成摘要...',
  };
  return map[phase] || map.blank;
}

// ── 自动上下文模式 ──

export function autoNovelContextMode(phase: NovelPhase): NovelContextMode {
  switch (phase) {
    case 'blank': return 'settings';
    case 'drafting': return 'chapter';
    case 'revising': return 'volume';
    case 'polishing': return 'chapter';
    default: return 'chapter';
  }
}
