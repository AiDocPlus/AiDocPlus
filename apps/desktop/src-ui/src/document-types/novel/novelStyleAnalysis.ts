/**
 * novelStyleAnalysis.ts — 小说语言风格本地分析
 *
 * N3.4: 纯前端计算，不依赖 AI。提供：
 * - 可读性评分（句长、段长、词汇丰富度）
 * - 对话/叙述比例
 * - 高频词统计
 * - 被动语态/冗余词检测
 * - 章节间风格一致性
 */

import type { NovelDocumentContent } from './types';
import { getEffectiveContent } from './types';

// ═══ 基础文本统计 ═══

export interface TextStats {
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgSentenceLength: number;
  avgParagraphLength: number;
  maxSentenceLength: number;
  dialogueRatio: number;       // 对话占比 (0-1)
  narrationRatio: number;      // 叙述占比 (0-1)
  uniqueCharRatio: number;     // 不重复字/总字数（词汇丰富度）
}

/** 计算文本基础统计 */
export function analyzeText(text: string): TextStats {
  if (!text || text.trim().length === 0) {
    return { charCount: 0, wordCount: 0, sentenceCount: 0, paragraphCount: 0, avgSentenceLength: 0, avgParagraphLength: 0, maxSentenceLength: 0, dialogueRatio: 0, narrationRatio: 1, uniqueCharRatio: 0 };
  }

  const charCount = text.replace(/\s/g, '').length;
  const wordCount = charCount; // 中文以字为单位

  // 句子分割（中文句号/问号/感叹号/省略号）
  const sentences = text.split(/[。！？…]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const sentenceLengths = sentences.map(s => s.replace(/\s/g, '').length);
  const avgSentenceLength = sentenceLengths.reduce((s, v) => s + v, 0) / sentenceCount;
  const maxSentenceLength = Math.max(0, ...sentenceLengths);

  // 段落
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const paragraphCount = Math.max(1, paragraphs.length);
  const avgParagraphLength = charCount / paragraphCount;

  // 对话/叙述比例（检测「」""的内容）
  const dialogueMatches = text.match(/[「""][^「""」]*[」""]/g) || [];
  const dialogueChars = dialogueMatches.reduce((s, m) => s + m.replace(/\s/g, '').length, 0);
  const dialogueRatio = charCount > 0 ? dialogueChars / charCount : 0;
  const narrationRatio = 1 - dialogueRatio;

  // 词汇丰富度（不重复汉字/总汉字）
  const hanzi = text.replace(/[^\u4e00-\u9fff]/g, '');
  const uniqueHanzi = new Set(hanzi);
  const uniqueCharRatio = hanzi.length > 0 ? uniqueHanzi.size / hanzi.length : 0;

  return {
    charCount, wordCount, sentenceCount, paragraphCount,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgParagraphLength: Math.round(avgParagraphLength * 10) / 10,
    maxSentenceLength,
    dialogueRatio: Math.round(dialogueRatio * 100) / 100,
    narrationRatio: Math.round(narrationRatio * 100) / 100,
    uniqueCharRatio: Math.round(uniqueCharRatio * 1000) / 1000,
  };
}

// ═══ 高频词分析 ═══

export interface WordFrequency {
  word: string;
  count: number;
  ratio: number; // 出现频率
}

/** 提取高频二字词（简易分词） */
export function getHighFrequencyWords(text: string, topN: number = 20): WordFrequency[] {
  const hanzi = text.replace(/[^\u4e00-\u9fff]/g, '');
  if (hanzi.length < 4) return [];

  // 二元组频率
  const bigramCounts = new Map<string, number>();
  for (let i = 0; i < hanzi.length - 1; i++) {
    const bigram = hanzi.slice(i, i + 2);
    bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
  }

  // 过滤：至少出现 3 次，排除常见虚词
  const STOPWORDS = new Set(['的是', '是的', '了的', '的了', '不是', '在了', '了一', '一个', '他的', '她的', '我的', '你的', '这个', '那个', '什么', '没有', '不了', '也是', '就是', '还是', '可以', '已经', '因为', '所以', '但是', '而且', '或者', '虽然', '如果']);
  const totalBigrams = hanzi.length - 1;

  return Array.from(bigramCounts.entries())
    .filter(([word, count]) => count >= 3 && !STOPWORDS.has(word))
    .map(([word, count]) => ({ word, count, ratio: Math.round(count / totalBigrams * 10000) / 10000 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// ═══ 冗余词检测 ═══

const REDUNDANT_PATTERNS: { pattern: RegExp; label: string; suggestion: string }[] = [
  { pattern: /非常非常/g, label: '重复程度副词', suggestion: '用更具体的描写替代' },
  { pattern: /然后.*然后.*然后/g, label: '过多"然后"', suggestion: '变换连接词或改用独立句' },
  { pattern: /突然间?/g, label: '"突然"过多', suggestion: '用具体动作描写替代' },
  { pattern: /不禁/g, label: '"不禁"过多', suggestion: '直接描写反应动作' },
  { pattern: /忍不住/g, label: '"忍不住"过多', suggestion: '用具体行为描写' },
  { pattern: /微微/g, label: '"微微"过多', suggestion: '精确描写程度' },
  { pattern: /缓缓/g, label: '"缓缓"过多', suggestion: '用具体动作速度描写' },
  { pattern: /默默/g, label: '"默默"过多', suggestion: '描写具体的沉默表现' },
  { pattern: /淡淡/g, label: '"淡淡"过多', suggestion: '用具体的表情/语气描写' },
];

export interface RedundancyIssue {
  label: string;
  count: number;
  suggestion: string;
}

/** 检测冗余用词 */
export function detectRedundancy(text: string): RedundancyIssue[] {
  const issues: RedundancyIssue[] = [];
  for (const { pattern, label, suggestion } of REDUNDANT_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length >= 3) {
      issues.push({ label, count: matches.length, suggestion });
    }
  }
  return issues.sort((a, b) => b.count - a.count);
}

// ═══ 可读性评分 ═══

export interface ReadabilityScore {
  score: number;        // 0-100
  level: string;        // 描述
  details: { metric: string; value: string; status: 'good' | 'warning' | 'bad' }[];
}

/** 计算可读性评分（综合多项指标） */
export function calculateReadability(stats: TextStats): ReadabilityScore {
  let score = 100;
  const details: ReadabilityScore['details'] = [];

  // 平均句长（理想 15-30 字）
  if (stats.avgSentenceLength < 10) {
    score -= 10;
    details.push({ metric: '平均句长', value: `${stats.avgSentenceLength}字`, status: 'warning' });
  } else if (stats.avgSentenceLength > 40) {
    score -= 15;
    details.push({ metric: '平均句长', value: `${stats.avgSentenceLength}字（偏长）`, status: 'bad' });
  } else if (stats.avgSentenceLength > 30) {
    score -= 5;
    details.push({ metric: '平均句长', value: `${stats.avgSentenceLength}字`, status: 'warning' });
  } else {
    details.push({ metric: '平均句长', value: `${stats.avgSentenceLength}字`, status: 'good' });
  }

  // 最长句子（> 80 字扣分）
  if (stats.maxSentenceLength > 100) {
    score -= 10;
    details.push({ metric: '最长句子', value: `${stats.maxSentenceLength}字`, status: 'bad' });
  } else if (stats.maxSentenceLength > 80) {
    score -= 5;
    details.push({ metric: '最长句子', value: `${stats.maxSentenceLength}字`, status: 'warning' });
  } else {
    details.push({ metric: '最长句子', value: `${stats.maxSentenceLength}字`, status: 'good' });
  }

  // 段落长度（理想 100-300 字）
  if (stats.avgParagraphLength > 500) {
    score -= 10;
    details.push({ metric: '段落均长', value: `${Math.round(stats.avgParagraphLength)}字（偏长）`, status: 'bad' });
  } else if (stats.avgParagraphLength > 300) {
    score -= 5;
    details.push({ metric: '段落均长', value: `${Math.round(stats.avgParagraphLength)}字`, status: 'warning' });
  } else {
    details.push({ metric: '段落均长', value: `${Math.round(stats.avgParagraphLength)}字`, status: 'good' });
  }

  // 对话比例（小说理想 20%-60%）
  const dlgPct = Math.round(stats.dialogueRatio * 100);
  if (dlgPct < 10) {
    score -= 5;
    details.push({ metric: '对话比例', value: `${dlgPct}%（偏少）`, status: 'warning' });
  } else if (dlgPct > 70) {
    score -= 5;
    details.push({ metric: '对话比例', value: `${dlgPct}%（偏多）`, status: 'warning' });
  } else {
    details.push({ metric: '对话比例', value: `${dlgPct}%`, status: 'good' });
  }

  // 词汇丰富度（理想 > 0.3）
  if (stats.uniqueCharRatio < 0.2) {
    score -= 15;
    details.push({ metric: '词汇丰富度', value: `${Math.round(stats.uniqueCharRatio * 100)}%（偏低）`, status: 'bad' });
  } else if (stats.uniqueCharRatio < 0.3) {
    score -= 5;
    details.push({ metric: '词汇丰富度', value: `${Math.round(stats.uniqueCharRatio * 100)}%`, status: 'warning' });
  } else {
    details.push({ metric: '词汇丰富度', value: `${Math.round(stats.uniqueCharRatio * 100)}%`, status: 'good' });
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 80 ? '优秀' : score >= 60 ? '良好' : score >= 40 ? '一般' : '需改进';

  return { score, level, details };
}

// ═══ 全书风格一致性分析 ═══

export interface ChapterStyleProfile {
  chapterId: string;
  chapterTitle: string;
  volumeTitle: string;
  avgSentenceLength: number;
  dialogueRatio: number;
  uniqueCharRatio: number;
  readabilityScore: number;
}

/** 分析全书各章节的风格指标（用于检测风格不一致） */
export function analyzeNovelStyle(novel: NovelDocumentContent): {
  profiles: ChapterStyleProfile[];
  globalStats: TextStats;
  globalReadability: ReadabilityScore;
  inconsistencies: { chapterId: string; chapterTitle: string; issue: string }[];
} {
  const profiles: ChapterStyleProfile[] = [];
  const allContent: string[] = [];

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      const content = getEffectiveContent(ch);
      if (content.replace(/\s/g, '').length < 100) continue;
      allContent.push(content);
      const stats = analyzeText(content);
      const readability = calculateReadability(stats);
      profiles.push({
        chapterId: ch.id,
        chapterTitle: ch.title,
        volumeTitle: vol.title,
        avgSentenceLength: stats.avgSentenceLength,
        dialogueRatio: stats.dialogueRatio,
        uniqueCharRatio: stats.uniqueCharRatio,
        readabilityScore: readability.score,
      });
    }
  }

  const fullText = allContent.join('\n\n');
  const globalStats = analyzeText(fullText);
  const globalReadability = calculateReadability(globalStats);

  // 检测风格不一致的章节（与全书均值偏差超过 2 倍标准差）
  const inconsistencies: { chapterId: string; chapterTitle: string; issue: string }[] = [];

  if (profiles.length >= 3) {
    const avgSL = profiles.reduce((s, p) => s + p.avgSentenceLength, 0) / profiles.length;
    const stdSL = Math.sqrt(profiles.reduce((s, p) => s + (p.avgSentenceLength - avgSL) ** 2, 0) / profiles.length);

    const avgDR = profiles.reduce((s, p) => s + p.dialogueRatio, 0) / profiles.length;
    const stdDR = Math.sqrt(profiles.reduce((s, p) => s + (p.dialogueRatio - avgDR) ** 2, 0) / profiles.length);

    for (const p of profiles) {
      if (stdSL > 0 && Math.abs(p.avgSentenceLength - avgSL) > stdSL * 2) {
        const dir = p.avgSentenceLength > avgSL ? '偏长' : '偏短';
        inconsistencies.push({
          chapterId: p.chapterId,
          chapterTitle: p.chapterTitle,
          issue: `句长${dir}（${p.avgSentenceLength}字 vs 均值${Math.round(avgSL)}字）`,
        });
      }
      if (stdDR > 0 && Math.abs(p.dialogueRatio - avgDR) > stdDR * 2) {
        const dir = p.dialogueRatio > avgDR ? '偏多' : '偏少';
        inconsistencies.push({
          chapterId: p.chapterId,
          chapterTitle: p.chapterTitle,
          issue: `对话${dir}（${Math.round(p.dialogueRatio * 100)}% vs 均值${Math.round(avgDR * 100)}%）`,
        });
      }
    }
  }

  return { profiles, globalStats, globalReadability, inconsistencies };
}

/** 为 AI 构建风格分析提示词 */
export function buildStyleAnalysisPrompt(novel: NovelDocumentContent): string {
  const { profiles, globalStats, globalReadability, inconsistencies } = analyzeNovelStyle(novel);
  const parts: string[] = [];

  parts.push('请基于以下自动分析数据，为我的小说提供深度语言风格分析和建议：\n');

  parts.push('【全书统计】');
  parts.push(`总字数：${globalStats.charCount}字`);
  parts.push(`总句数：${globalStats.sentenceCount}句`);
  parts.push(`平均句长：${globalStats.avgSentenceLength}字`);
  parts.push(`对话比例：${Math.round(globalStats.dialogueRatio * 100)}%`);
  parts.push(`词汇丰富度：${Math.round(globalStats.uniqueCharRatio * 100)}%`);
  parts.push(`可读性评分：${globalReadability.score}/100（${globalReadability.level}）`);

  if (profiles.length > 0) {
    parts.push('\n【各章节风格指标】');
    for (const p of profiles.slice(0, 15)) {
      parts.push(`  ${p.chapterTitle}：句长${p.avgSentenceLength} | 对话${Math.round(p.dialogueRatio * 100)}% | 词汇${Math.round(p.uniqueCharRatio * 100)}% | 评分${p.readabilityScore}`);
    }
  }

  if (inconsistencies.length > 0) {
    parts.push('\n【风格不一致警告】');
    for (const issue of inconsistencies) {
      parts.push(`  ⚠ ${issue.chapterTitle}：${issue.issue}`);
    }
  }

  const redundancy = detectRedundancy(novel.volumes.flatMap(v => v.chapters.map(c => c.content)).join('\n'));
  if (redundancy.length > 0) {
    parts.push('\n【冗余用词警告】');
    for (const r of redundancy.slice(0, 8)) {
      parts.push(`  "${r.label}"出现 ${r.count} 次 — ${r.suggestion}`);
    }
  }

  parts.push('\n请给出：');
  parts.push('1. 文风总评（整体风格特点、优势和不足）');
  parts.push('2. 具体改进建议（按优先级排列）');
  parts.push('3. 风格不一致的章节如何调整');
  parts.push('4. 冗余用词的具体替换方案');

  return parts.join('\n');
}
