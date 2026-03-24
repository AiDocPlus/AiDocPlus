/**
 * 散文 AI 上下文引擎
 *
 * - 写作阶段自动检测（空白/起草/修改/润色）
 * - 上下文模式（全文/段落/素材）
 * - 系统提示词生成
 */
import type { EssayDocumentContent } from './types';
import { getWordCount } from './types';
import { ESSAY_SUBTYPE_LABEL, MASTER_STYLE_LABEL, ESSAY_MOOD_LABEL } from './constants';

// ═══ 写作阶段 ═══

export type EssayPhase = 'blank' | 'drafting' | 'revising' | 'polishing';

export function detectEssayPhase(essay: EssayDocumentContent): EssayPhase {
  const wc = getWordCount(essay.content);
  if (wc === 0) return 'blank';
  const target = essay.settings.targetWordCount || 2000;
  if (wc < target * 0.3) return 'drafting';
  if (wc < target * 0.8) return 'revising';
  return 'polishing';
}

export function getPhaseLabel(phase: EssayPhase): string {
  switch (phase) {
    case 'blank': return '构思阶段';
    case 'drafting': return '起草阶段';
    case 'revising': return '修改阶段';
    case 'polishing': return '润色阶段';
  }
}

export function getPhaseColor(phase: EssayPhase): string {
  switch (phase) {
    case 'blank': return 'text-gray-500';
    case 'drafting': return 'text-blue-500';
    case 'revising': return 'text-amber-500';
    case 'polishing': return 'text-green-500';
  }
}

// ═══ 上下文模式 ═══

export type EssayContextMode = 'full' | 'paragraph' | 'material';

export function getContextModeLabel(mode: EssayContextMode): string {
  switch (mode) {
    case 'full': return '全文';
    case 'paragraph': return '段落';
    case 'material': return '素材';
  }
}

// ═══ 系统提示词构建 ═══

export function buildEssaySystemPrompt(
  essay: EssayDocumentContent,
  contextMode: EssayContextMode,
): string {
  const { settings } = essay;
  const phase = detectEssayPhase(essay);
  const wc = getWordCount(essay.content);

  const parts: string[] = [];

  // 基础角色
  parts.push('你是一位专业的散文写作顾问，精通各类散文的写作技法。');

  // 散文子类型特定指导
  const subtypeLabel = ESSAY_SUBTYPE_LABEL[settings.subtype] || '散文';
  parts.push(`当前创作类型：${subtypeLabel}。`);

  switch (settings.subtype) {
    case 'lyrical':
      parts.push('重点关注：情感抒发、意象营造、修辞运用、抒情节奏、情景交融。');
      break;
    case 'narrative':
      parts.push('重点关注：故事线索、人物刻画、细节描写、叙事视角、时空转换。');
      break;
    case 'argumentative':
      parts.push('重点关注：论点提炼、论据选择、逻辑推理、说服力、论证结构。');
      break;
    case 'travel':
      parts.push('重点关注：景物描写、文化底蕴、感官体验、行文节奏、人文感悟。');
      break;
    case 'philosophical':
      parts.push('重点关注：思辨深度、哲理提炼、意象象征、深层感悟、生命体验。');
      break;
  }

  // 目标风格
  if (settings.targetStyle !== 'free') {
    const styleName = MASTER_STYLE_LABEL[settings.targetStyle] || settings.targetStyle;
    parts.push(`目标写作风格：参考${styleName}的语言风格和表达方式。`);
  }

  // 情感基调
  if (settings.mood) {
    const moodLabel = ESSAY_MOOD_LABEL[settings.mood] || settings.mood;
    parts.push(`情感基调：${moodLabel}。`);
  }

  // 主题线索
  if (settings.theme) {
    parts.push(`主题/线索：${settings.theme}。`);
  }

  // 关键意象
  if (settings.keyImagery.length > 0) {
    parts.push(`核心意象：${settings.keyImagery.join('、')}。`);
  }

  // 写作阶段提示
  parts.push(`\n当前写作阶段：${getPhaseLabel(phase)}（已写${wc}字，目标${settings.targetWordCount}字）。`);
  switch (phase) {
    case 'blank':
      parts.push('帮助用户构思开头、确定写作方向和情感基调。');
      break;
    case 'drafting':
      parts.push('协助续写、扩展段落、丰富细节描写。');
      break;
    case 'revising':
      parts.push('帮助优化结构、增强修辞、强化意象和情感表达。');
      break;
    case 'polishing':
      parts.push('进行精细润色、检查修辞效果、提升文学性和感染力。');
      break;
  }

  // 上下文内容
  if (contextMode === 'full' && essay.content) {
    const truncated = essay.content.length > 3000 ? essay.content.slice(-3000) : essay.content;
    parts.push(`\n---\n散文正文（${contextMode === 'full' ? '全文' : '部分'}）：\n${truncated}`);
  }

  if (contextMode === 'material' && essay.materials.length > 0) {
    const matSummary = essay.materials.map(m => `[${m.type}] ${m.title}: ${m.content.slice(0, 100)}`).join('\n');
    parts.push(`\n---\n素材库：\n${matSummary}`);
  }

  parts.push('\n输出要求：直接输出内容，不要添加额外说明或开场白。保持文学性和散文特有的韵律美。');

  return parts.join('\n');
}

// ═══ 上下文摘要 ═══

export function getContextSummary(essay: EssayDocumentContent, mode: EssayContextMode): string {
  const wc = getWordCount(essay.content);
  const phase = detectEssayPhase(essay);
  const phaseLabel = getPhaseLabel(phase);
  switch (mode) {
    case 'full':
      return `${phaseLabel} · ${wc}字`;
    case 'paragraph':
      return `${phaseLabel} · 段落模式`;
    case 'material':
      return `${phaseLabel} · ${essay.materials.length}条素材`;
  }
}
