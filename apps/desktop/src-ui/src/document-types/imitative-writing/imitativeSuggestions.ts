/**
 * 仿写 AI 助手 — 动态建议芯片 + 写作阶段指示 + 动态 placeholder
 */
import type { TFunction } from 'i18next';
import type { ImitativeWritingContent } from './types';
import {
  detectWritingPhase, analyzeText,
  getWritingPhaseColor,
  getWritingPhaseLabel,
  getWritingPhaseLabelT,
  type WritingPhase,
} from './imitativeAnalysis';

export interface ImitativeSuggestionChip {
  id: string;
  label: string;
  prompt: string;
  variant: 'primary' | 'default' | 'warning';
}

function chip(
  t: TFunction,
  id: string,
  labelKey: string,
  defaultLabel: string,
  prompt: string,
  variant: ImitativeSuggestionChip['variant'],
): ImitativeSuggestionChip {
  return {
    id,
    label: t(labelKey, { defaultValue: defaultLabel }),
    prompt,
    variant,
  };
}

export function getImitativeSuggestions(
  docContent: ImitativeWritingContent,
  t: TFunction,
): ImitativeSuggestionChip[] {
  const sourceWc = analyzeText(docContent.source.text).wordCount;
  const imitWc = analyzeText(docContent.imitation.text).wordCount;
  const phase = detectWritingPhase(sourceWc, imitWc);

  switch (phase) {
    case 'not-started':
      return [
        chip(t, 'analyze-structure', 'imitativeWriting.chips.analyzeStructure', '分析原文结构',
          '请分析原文的篇章结构、段落布局和写作逻辑，梳理可仿写的骨架，并给出 3 条可操作的仿写切入点。',
          'primary'),
        chip(t, 'extract-techniques', 'imitativeWriting.chips.extractTechniques', '提取写法特点',
          '请从原文中提取最显著的语言特点、修辞手法和叙事技巧，用条目列出，并说明每条如何迁移到仿写中。',
          'default'),
        chip(t, 'start-imitation', 'imitativeWriting.chips.startImitation', '起草开头',
          '请根据原文的风格与节奏，为我的仿写起草 2～3 个不同风格的开头段落（每段 3～6 句），并说明各自侧重。',
          'default'),
        chip(t, 'reading-questions', 'imitativeWriting.chips.readingQuestions', '精读问题',
          '请基于原文出 5 个「精读问题」（结构、意象、人称、节奏、主题各一），帮助我读透文本再动笔。',
          'default'),
      ];

    case 'early':
      return [
        chip(t, 'continue-imitation', 'imitativeWriting.chips.continueImitation', '续写下一段',
          '请根据原文结构和我已写的仿写内容，续写下一个完整段落，保持人称、时态与语气一致，并简要说明衔接点。',
          'primary'),
        chip(t, 'imitate-rhetoric', 'imitativeWriting.chips.imitateRhetoric', '修辞对齐',
          '请对照原文我当前仿写段落附近的修辞密度与类型，指出我仿写中可加强的修辞，并给出改写示例句。',
          'default'),
        chip(t, 'compare-paragraph', 'imitativeWriting.chips.compareParagraph', '段落对照',
          '请将我仿写的最后一段与原文对应位置对照：相同点、差距、下一步最小改动建议（各不超过 3 条）。',
          'default'),
        chip(t, 'beat-outline', 'imitativeWriting.chips.beatOutline', '节拍提纲',
          '请用 8～12 个短句列出原文情节/情绪节拍，并标出我仿写已覆盖与尚未覆盖的节拍。',
          'default'),
      ];

    case 'mid':
      return [
        chip(t, 'continue-imitation', 'imitativeWriting.chips.continueImitation', '续写下一段',
          '请根据原文结构和我已写的仿写内容，续写下一个完整段落，保持风格一致，并标出与原文呼应的意象或句式。',
          'primary'),
        chip(t, 'check-style', 'imitativeWriting.chips.checkStyle', '风格检查',
          '请检查仿写与原文在语域、句式长短、意象偏好上的偏差，按「一致 / 可接受 / 需改」三档列出例证。',
          'default'),
        chip(t, 'add-detail', 'imitativeWriting.chips.addDetail', '补充感官细节',
          '请参照原文感官描写（视听嗅味触）的分布，为仿写标出 3 处最适合加细节的位置，并各写一句示例。',
          'default'),
        chip(t, 'tension-check', 'imitativeWriting.chips.tensionCheck', '张力检查',
          '请从冲突、悬念、信息释放节奏三方面评估仿写中段张力，给出 2 条加强张力的具体改法。',
          'default'),
      ];

    case 'late':
      return [
        chip(t, 'polish-text', 'imitativeWriting.chips.polishText', '收束润色',
          '请对仿写整体做语言润色：删冗余、统一语体、强化关键意象，并保留我的叙事走向。',
          'primary'),
        chip(t, 'check-style', 'imitativeWriting.chips.checkStyle', '风格检查',
          '请检查仿写与原文的风格贴合度，列出「已到位」与「最后一轮可打磨」各若干条。',
          'default'),
        chip(t, 'compare-paragraph', 'imitativeWriting.chips.compareParagraph', '高潮对照',
          '请将仿写的高潮/转折段与原文对应部分对照，分析力度与留白是否得当，给出删改建议。',
          'default'),
        chip(t, 'ending-options', 'imitativeWriting.chips.endingOptions', '结尾方案',
          '请提供 3 种不同收束方式的结尾草稿（余韵型、点题型、开放型各一），各不超过 120 字。',
          'default'),
      ];

    case 'done':
      return [
        chip(t, 'overall-evaluate', 'imitativeWriting.chips.overallEvaluate', '综合评估',
          '请从结构、语言、修辞、主题契合度四维度评估仿写，各维度 1～10 分并附一句理由，最后给总评。',
          'primary'),
        chip(t, 'final-compare', 'imitativeWriting.chips.finalCompare', '全文对照',
          '请对原文与仿写做全文级对照：最成功的 3 处模仿、最需警惕的 3 类偏差、下一轮练习建议。',
          'default'),
        chip(t, 'export-summary', 'imitativeWriting.chips.exportSummary', '学习小结',
          '请生成一份可保存的学习小结：技法清单、个人易错点、推荐复练篇目类型（各用条目列出）。',
          'default'),
        chip(t, 'revision-checklist', 'imitativeWriting.chips.revisionChecklist', '修改清单',
          '请输出一份按优先级排序的「修改清单」（P0/P1/P2），每条对应原文或仿写中的具体位置描述。',
          'default'),
      ];

    default:
      return [];
  }
}

export interface ImitativePhaseIndicator {
  label: string;
  color: string;
}

export function getImitativePhaseIndicator(
  docContent: ImitativeWritingContent,
  t: TFunction,
): ImitativePhaseIndicator {
  const sourceWc = analyzeText(docContent.source.text).wordCount;
  const imitWc = analyzeText(docContent.imitation.text).wordCount;
  const phase = detectWritingPhase(sourceWc, imitWc);
  return {
    label: getWritingPhaseLabelT(phase, t),
    color: getWritingPhaseColor(phase),
  };
}

const PLACEHOLDER_KEYS: Record<WritingPhase, { key: string; defaultText: string }> = {
  'not-started': {
    key: 'imitativeWriting.inputHint.notStarted',
    defaultText: '还没开始仿写？先分析结构、提取技法，或直接提问…',
  },
  early: {
    key: 'imitativeWriting.inputHint.early',
    defaultText: '可请求续写、修辞对齐、段落对照或节拍提纲…',
  },
  mid: {
    key: 'imitativeWriting.inputHint.mid',
    defaultText: '可续写、检查风格、补细节或加强张力…',
  },
  late: {
    key: 'imitativeWriting.inputHint.late',
    defaultText: '可润色收束、对照高潮、尝试不同结尾…',
  },
  done: {
    key: 'imitativeWriting.inputHint.done',
    defaultText: '可做综合评估、全文对照或导出学习小结…',
  },
};

export function getImitativeInputPlaceholder(
  docContent: ImitativeWritingContent,
  t: TFunction,
): string {
  const sourceWc = analyzeText(docContent.source.text).wordCount;
  const imitWc = analyzeText(docContent.imitation.text).wordCount;
  const phase = detectWritingPhase(sourceWc, imitWc);
  const { key, defaultText } = PLACEHOLDER_KEYS[phase];
  return t(key, { defaultValue: defaultText });
}

export type { WritingPhase };
export { detectWritingPhase, getWritingPhaseLabel, getWritingPhaseColor, getWritingPhaseLabelT };
