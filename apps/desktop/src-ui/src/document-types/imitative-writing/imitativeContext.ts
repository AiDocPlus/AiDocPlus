/**
 * 仿写 AI 上下文引擎
 * - 上下文模式（原文/仿写/双文）
 * - 系统提示词生成
 * - 上下文摘要
 */
import type { ImitativeWritingContent } from './types';
import { countWords } from './types';
import { GENRE_OPTIONS, type GenreOption } from './constants';

// ═══ 上下文模式 ═══

export type ImitativeContextMode = 'source' | 'imitation' | 'both';

export function getContextModeLabel(mode: ImitativeContextMode): string {
  switch (mode) {
    case 'source': return '原文';
    case 'imitation': return '仿写';
    case 'both': return '双文';
  }
}

// ═══ 系统提示词构建 ═══

export function buildImitativeSystemPrompt(
  doc: ImitativeWritingContent,
  contextMode: ImitativeContextMode,
): string {
  const genreOption: GenreOption | undefined = GENRE_OPTIONS.find(g => g.value === doc.genre);
  const genreLabel = genreOption?.labelKey.split('.').pop() || doc.genre;

  const sourceWc = countWords(doc.source.text);
  const imitationWc = countWords(doc.imitation.text);

  const parts: string[] = [];

  parts.push('你是一位精通中国现当代文学的写作导师，专注于仿写训练与文学鉴赏。');
  parts.push(`当前仿写训练体裁：${genreLabel}。`);

  if (doc.settings.imitationMode) {
    const modeLabel: Record<string, string> = {
      full: '全文仿写（整体框架与细节全面模仿）',
      fragment: '片段仿写（选取精华段落深度模仿）',
      style: '风格仿写（保留自己内容，模仿表达风格）',
      structure: '结构仿写（模仿篇章结构与布局）',
    };
    parts.push(`仿写模式：${modeLabel[doc.settings.imitationMode] || doc.settings.imitationMode}。`);
  }

  if (doc.settings.focusAreas.length > 0) {
    const areaLabels: Record<string, string> = {
      rhetoric: '修辞手法', imagery: '意象营造', rhythm: '节奏韵律',
      narrative: '叙述视角', dialogue: '对话描写', description: '细节描写',
      emotion: '情感表达', structure: '篇章结构', opening: '开头技法',
      ending: '结尾技法', transition: '过渡衔接',
    };
    const areas = doc.settings.focusAreas.map(a => areaLabels[a] || a).join('、');
    parts.push(`重点训练方向：${areas}。`);
  }

  if (doc.source.title || doc.source.author) {
    const info = [doc.source.title, doc.source.author].filter(Boolean).join(' — ');
    parts.push(`原文信息：${info}。`);
  }

  if (doc.source.era?.trim()) {
    parts.push(`时代/背景：${doc.source.era.trim()}。`);
  }
  if (doc.source.style?.trim()) {
    parts.push(`原文标注风格：${doc.source.style.trim()}。`);
  }
  if (doc.subGenre?.trim()) {
    parts.push(`子类型/细分：${doc.subGenre.trim()}。`);
  }
  if (doc.settings.customRequirement?.trim()) {
    parts.push(`学习者自定义要求：${doc.settings.customRequirement.trim()}。`);
  }

  const cache = doc.analysisCache;
  if (cache?.keyTechniques?.length) {
    parts.push(`此前本地分析归纳的核心技法（可参考）：${cache.keyTechniques.slice(0, 12).join('、')}。`);
  }

  parts.push(`\n原文字数：${sourceWc} 字；仿写字数：${imitationWc} 字。`);

  const injectedSource = contextMode === 'source' || contextMode === 'both' ? doc.source.text : '';
  const injectedImitation = contextMode === 'imitation' || contextMode === 'both' ? doc.imitation.text : '';
  const approxChars = injectedSource.length + injectedImitation.length;
  if (approxChars > 12000) {
    parts.push('\n（正文较长：回答时可优先概括结构与技法，必要时再深入局部举例。）');
  }

  if (contextMode === 'source' || contextMode === 'both') {
    if (doc.source.text) {
      parts.push(`\n---\n【原文】\n${doc.source.text}`);
    }
  }

  if (contextMode === 'imitation' || contextMode === 'both') {
    if (doc.imitation.text) {
      parts.push(`\n---\n【仿写】\n${doc.imitation.text}`);
    }
  }

  parts.push('\n请用专业而亲切的语气给出建议，具体举例说明，帮助学习者真正理解并掌握写作技巧。');
  parts.push('若用户请求可执行的改写/续写，请直接给出改写后的段落，并简短说明修改要点。');

  return parts.join('\n');
}

// ═══ 上下文摘要 ═══

export function getContextSummary(
  doc: ImitativeWritingContent,
  mode: ImitativeContextMode,
): string {
  const sourceWc = countWords(doc.source.text);
  const imitationWc = countWords(doc.imitation.text);
  switch (mode) {
    case 'source': return `原文 ${sourceWc} 字`;
    case 'imitation': return `仿写 ${imitationWc} 字`;
    case 'both': return `原文 ${sourceWc} 字 · 仿写 ${imitationWc} 字`;
  }
}
