/**
 * 仿写本地文本分析工具
 * - 字数统计、段落分析、相似度计算、修辞密度估计
 */
import type { TFunction } from 'i18next';

// ═══ 字数 & 段落 ═══

export interface TextStats {
  charCount: number;
  wordCount: number;
  lineCount: number;
  paragraphCount: number;
  avgParagraphLength: number;
  longestParagraph: number;
  shortestParagraph: number;
}

export function analyzeText(text: string): TextStats {
  if (!text.trim()) {
    return { charCount: 0, wordCount: 0, lineCount: 0, paragraphCount: 0, avgParagraphLength: 0, longestParagraph: 0, shortestParagraph: 0 };
  }
  const charCount = text.replace(/\s/g, '').length;
  const wordCount = (text.match(/[\u4e00-\u9fa5]|[a-zA-Z]+/g) || []).length;
  const lines = text.split('\n');
  const lineCount = lines.length;
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const paragraphCount = paragraphs.length;
  const pLengths = paragraphs.map(p => p.replace(/\s/g, '').length);
  const avgParagraphLength = paragraphCount > 0
    ? Math.round(pLengths.reduce((a, b) => a + b, 0) / paragraphCount)
    : 0;
  const longestParagraph = paragraphCount > 0 ? Math.max(...pLengths) : 0;
  const shortestParagraph = paragraphCount > 0 ? Math.min(...pLengths) : 0;
  return { charCount, wordCount, lineCount, paragraphCount, avgParagraphLength, longestParagraph, shortestParagraph };
}

// ═══ 相似度（粗略字符级 Jaccard） ═══

export function estimateSimilarity(a: string, b: string): number {
  if (!a.trim() || !b.trim()) return 0;
  const setA = new Set(a.replace(/\s/g, '').split(''));
  const setB = new Set(b.replace(/\s/g, '').split(''));
  const intersection = [...setA].filter(c => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

// ═══ 修辞手法检测（关键词扫描） ═══

export interface RhetoricHit {
  type: string;
  description: string;
  count: number;
}

const RHETORIC_PATTERNS: { type: string; description: string; patterns: RegExp[] }[] = [
  {
    type: '比喻',
    description: '用已知事物来比拟不知事物',
    patterns: [/像.{1,10}一样/, /如.{1,8}般/, /仿佛/, /好比/, /犹如/, /宛如/],
  },
  {
    type: '排比',
    description: '三个以上结构相似的句子',
    patterns: [/[。！，]\s*(?:[\u4e00-\u9fa5]{2,8}的){2}/, /(?:不是.{2,8}[，,]){2}/, /(?:是.{2,8}[，,]){2}/],
  },
  {
    type: '拟人',
    description: '把非人的事物写成有人的动作',
    patterns: [/(?:花|草|树|风|云|雨|月|星).{0,5}(?:说|笑|哭|走|跑|跳|唱|舞)/, /(?:大地|山|河).{0,5}(?:微笑|哭泣|沉默|歌唱)/],
  },
  {
    type: '对偶',
    description: '字数相等、结构相同的两句',
    patterns: [/[\u4e00-\u9fa5]{4,8}[，,][\u4e00-\u9fa5]{4,8}[。！]/, /(?:有.{2,6}[，,]有.{2,6})/],
  },
  {
    type: '反问',
    description: '以疑问形式表达肯定含义',
    patterns: [/难道.{2,20}[？?]/, /怎能.{2,20}[？?]/, /岂.{2,20}[？?]/],
  },
  {
    type: '设问',
    description: '自问自答',
    patterns: [/[？?]\s*[\u4e00-\u9fa5]{2,10}[，。]/],
  },
];

export function detectRhetoric(text: string): RhetoricHit[] {
  return RHETORIC_PATTERNS
    .map(({ type, description, patterns }) => {
      const count = patterns.reduce((sum, p) => {
        const matches = text.match(new RegExp(p.source, 'g'));
        return sum + (matches?.length || 0);
      }, 0);
      return { type, description, count };
    })
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ═══ 段落对比（按段拆分后逐段匹配） ═══

export interface ParagraphCompare {
  index: number;
  source: string;
  imitation: string;
  similarity: number;
}

export function compareParagraphs(sourceText: string, imitationText: string): ParagraphCompare[] {
  const sourceParagraphs = sourceText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const imitationParagraphs = imitationText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const maxLen = Math.max(sourceParagraphs.length, imitationParagraphs.length);
  const result: ParagraphCompare[] = [];
  for (let i = 0; i < maxLen; i++) {
    const src = sourceParagraphs[i] || '';
    const imi = imitationParagraphs[i] || '';
    result.push({ index: i + 1, source: src, imitation: imi, similarity: estimateSimilarity(src, imi) });
  }
  return result;
}

// ═══ 写作进度阶段 ═══

export type WritingPhase = 'not-started' | 'early' | 'mid' | 'late' | 'done';

export function detectWritingPhase(
  sourceWordCount: number,
  imitationWordCount: number,
): WritingPhase {
  if (imitationWordCount === 0) return 'not-started';
  if (sourceWordCount === 0) return 'early';
  const ratio = imitationWordCount / sourceWordCount;
  if (ratio < 0.3) return 'early';
  if (ratio < 0.7) return 'mid';
  if (ratio < 1.0) return 'late';
  return 'done';
}

export function getWritingPhaseLabel(phase: WritingPhase): string {
  switch (phase) {
    case 'not-started': return '未开始';
    case 'early': return '起步阶段';
    case 'mid': return '进行中';
    case 'late': return '接近完成';
    case 'done': return '已完成';
  }
}

const PHASE_LABEL_KEYS: Record<WritingPhase, string> = {
  'not-started': 'imitativeWriting.phase.notStarted',
  early: 'imitativeWriting.phase.early',
  mid: 'imitativeWriting.phase.mid',
  late: 'imitativeWriting.phase.late',
  done: 'imitativeWriting.phase.done',
};

export function getWritingPhaseLabelT(phase: WritingPhase, t: TFunction): string {
  return t(PHASE_LABEL_KEYS[phase], { defaultValue: getWritingPhaseLabel(phase) });
}

export function getWritingPhaseColor(phase: WritingPhase): string {
  switch (phase) {
    case 'not-started': return 'text-muted-foreground';
    case 'early': return 'text-blue-500';
    case 'mid': return 'text-amber-500';
    case 'late': return 'text-orange-500';
    case 'done': return 'text-green-500';
  }
}
