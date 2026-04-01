/**
 * antiAIflavor.ts — 去 AI 味核心模块
 *
 * P2.3: 三层机制
 * - Layer A: 规则层（生成时约束）
 * - Layer B: 检测层（纯规则分析）
 * - Layer C: 修订层（AI 辅助）
 */

import type { NovelDocumentContent } from './types';

// ═══ Layer A: 规则层 ═══

/**
 * AI 味疲劳词黑名单
 * 这些词汇在 AI 生成文本中出现频率过高
 */
export const AI_FLAVOR_WORDS = {
  // 程度副词（过度使用）
  degree: ['非常', '极其', '十分', '格外', '异常', '相当', '特别', '尤其', '异常', '颇为'],
  // 方式副词（机械重复）
  manner: ['缓缓', '微微', '默默', '淡淡', '轻轻', '渐渐', '慢慢', '悄悄', '静静', '暗暗'],
  // 情感表达（公式化）
  emotion: ['不禁', '忍不住', '不由得', '情不自禁', '下意识', '本能地'],
  // 转折连接（模式化）
  transition: ['突然', '忽然', '猛然', '顿时', '刹那间', '一瞬间'],
  // 状态描述（泛泛而谈）
  state: ['仿佛', '似乎', '好像', '像是', '一般', '一样'],
};

/**
 * 禁用句式模式
 */
export const BANNED_PATTERNS = [
  /是.{0,20}的[。！？]/,           // "是...的" 句式
  /有着.{0,10}的感觉/,            // "有着...的感觉"
  /一种.{0,10}的感觉/,            // "一种...的感觉"
  /心中.{0,5}一股.{0,10}涌上/,    // "心中一股...涌上"
  /不.{0,5}但.{0,5}而且/,         // "不仅...而且" 滥用
  /既.{0,5}又.{0,5}还/,           // "既...又...还" 滥用
  /不仅.{0,10}更是/,              // "不仅...更是"
  /仿佛.{0,10}一般/,              // "仿佛...一般"
];

/**
 * 高频转折词（密度限制）
 */
export const TRANSITION_WORDS = {
  but: ['但是', '可是', '然而', '不过', '却'],
  so: ['所以', '因此', '于是', '故而', '因而'],
  then: ['然后', '接着', '随后', '于是', '之后'],
  because: ['因为', '由于', '既然'],
  although: ['虽然', '尽管', '即使', '纵然'],
};

// ═══ Layer B: 检测层 ═══

export interface AIFlavorDetectionResult {
  /** 检测到的 AI 味问题 */
  issues: AIFlavorIssue[];
  /** 总体 AI 味评分（0-100，越高越像 AI） */
  score: number;
  /** 分项评分 */
  scores: {
    vocabulary: number;   // 词汇疲劳度
    sentence: number;     // 句式模式化
    paragraph: number;    // 段落均匀度
    transition: number;   // 转折词密度
  };
  /** 建议 */
  suggestions: string[];
}

export interface AIFlavorIssue {
  type: 'vocabulary' | 'sentence' | 'paragraph' | 'transition';
  word?: string;
  pattern?: string;
  count: number;
  positions: number[];
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

/**
 * 检测文本中的 AI 味
 */
export function detectAIFlavor(text: string): AIFlavorDetectionResult {
  const issues: AIFlavorIssue[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  // 1. 词汇疲劳检测
  const vocabularyIssues = detectVocabularyFatigue(text);
  issues.push(...vocabularyIssues);

  // 2. 句式模式检测
  const sentenceIssues = detectSentencePatterns(text);
  issues.push(...sentenceIssues);

  // 3. 段落均匀度检测
  const paragraphIssues = detectParagraphUniformity(paragraphs);
  issues.push(...paragraphIssues);

  // 4. 转折词密度检测
  const transitionIssues = detectTransitionDensity(text);
  issues.push(...transitionIssues);

  // 计算评分
  const scores = {
    vocabulary: calculateVocabularyScore(vocabularyIssues),
    sentence: calculateSentenceScore(sentenceIssues),
    paragraph: calculateParagraphScore(paragraphIssues),
    transition: calculateTransitionScore(transitionIssues),
  };

  const score = Math.round(
    scores.vocabulary * 0.3 +
    scores.sentence * 0.3 +
    scores.paragraph * 0.2 +
    scores.transition * 0.2
  );

  // 生成建议
  const suggestions = generateSuggestions(issues);

  return { issues, score, scores, suggestions };
}

/**
 * 词汇疲劳检测
 */
function detectVocabularyFatigue(text: string): AIFlavorIssue[] {
  const issues: AIFlavorIssue[] = [];
  const allBannedWords = [
    ...AI_FLAVOR_WORDS.degree,
    ...AI_FLAVOR_WORDS.manner,
    ...AI_FLAVOR_WORDS.emotion,
    ...AI_FLAVOR_WORDS.transition,
    ...AI_FLAVOR_WORDS.state,
  ];

  for (const word of allBannedWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = [...text.matchAll(regex)];
    if (matches.length >= 3) {
      const positions = matches.map(m => m.index || 0);
      issues.push({
        type: 'vocabulary',
        word,
        count: matches.length,
        positions,
        severity: matches.length >= 5 ? 'high' : matches.length >= 3 ? 'medium' : 'low',
        suggestion: `"${word}" 出现 ${matches.length} 次，建议用具体描写替代`,
      });
    }
  }

  return issues;
}

/**
 * 句式模式检测
 */
function detectSentencePatterns(text: string): AIFlavorIssue[] {
  const issues: AIFlavorIssue[] = [];

  for (const pattern of BANNED_PATTERNS) {
    const matches = [...text.matchAll(new RegExp(pattern.source, 'g'))];
    if (matches.length >= 2) {
      const positions = matches.map(m => m.index || 0);
      issues.push({
        type: 'sentence',
        pattern: pattern.source,
        count: matches.length,
        positions,
        severity: matches.length >= 4 ? 'high' : 'medium',
        suggestion: `检测到 ${matches.length} 处公式化句式，建议变换表达方式`,
      });
    }
  }

  return issues;
}

/**
 * 段落均匀度检测（CV 值）
 */
function detectParagraphUniformity(paragraphs: string[]): AIFlavorIssue[] {
  const issues: AIFlavorIssue[] = [];

  if (paragraphs.length < 3) return issues;

  const lengths = paragraphs.map(p => p.replace(/\s/g, '').length);
  const avg = lengths.reduce((s, l) => s + l, 0) / lengths.length;
  const variance = lengths.reduce((s, l) => s + (l - avg) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? stdDev / avg : 0;

  // CV 值过低（< 0.3）说明段落长度过于均匀，像 AI 生成
  if (cv < 0.3) {
    issues.push({
      type: 'paragraph',
      count: paragraphs.length,
      positions: [],
      severity: cv < 0.2 ? 'high' : 'medium',
      suggestion: `段落长度过于均匀（CV=${cv.toFixed(2)}），建议增加长短变化`,
    });
  }

  return issues;
}

/**
 * 转折词密度检测
 */
function detectTransitionDensity(text: string): AIFlavorIssue[] {
  const issues: AIFlavorIssue[] = [];
  const sentences = text.split(/[。！？…]+/).filter(s => s.trim().length > 0);

  if (sentences.length < 5) return issues;

  for (const words of Object.values(TRANSITION_WORDS)) {
    let totalCount = 0;
    for (const word of words) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      const matches = text.match(regex);
      if (matches) {
        totalCount += matches.length;
      }
    }

    const density = totalCount / sentences.length;
    if (density > 0.15) {
      issues.push({
        type: 'transition',
        word: words.join('/'),
        count: totalCount,
        positions: [],
        severity: density > 0.25 ? 'high' : 'medium',
        suggestion: `"${words[0]}"类转折词密度过高（${(density * 100).toFixed(1)}%），建议减少使用`,
      });
    }
  }

  return issues;
}

// 评分计算函数
function calculateVocabularyScore(issues: AIFlavorIssue[]): number {
  if (issues.length === 0) return 0;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const medCount = issues.filter(i => i.severity === 'medium').length;
  return Math.min(100, highCount * 25 + medCount * 10 + issues.length * 5);
}

function calculateSentenceScore(issues: AIFlavorIssue[]): number {
  if (issues.length === 0) return 0;
  return Math.min(100, issues.reduce((s, i) => s + (i.severity === 'high' ? 30 : 15), 0));
}

function calculateParagraphScore(issues: AIFlavorIssue[]): number {
  if (issues.length === 0) return 0;
  return issues[0].severity === 'high' ? 40 : 20;
}

function calculateTransitionScore(issues: AIFlavorIssue[]): number {
  if (issues.length === 0) return 0;
  return Math.min(100, issues.length * 20);
}

/**
 * 生成改进建议
 */
function generateSuggestions(issues: AIFlavorIssue[]): string[] {
  const suggestions: string[] = [];

  const vocabIssues = issues.filter(i => i.type === 'vocabulary');
  if (vocabIssues.length > 0) {
    suggestions.push('🔧 疲劳词替换：用具体动作/表情替代"微微""不禁"等词');
  }

  const sentenceIssues = issues.filter(i => i.type === 'sentence');
  if (sentenceIssues.length > 0) {
    suggestions.push('📝 句式变化：避免"是...的""有着...的感觉"等公式化表达');
  }

  const paragraphIssues = issues.filter(i => i.type === 'paragraph');
  if (paragraphIssues.length > 0) {
    suggestions.push('📐 段落节奏：交替使用长段（描写）和短段（对话/动作）');
  }

  const transitionIssues = issues.filter(i => i.type === 'transition');
  if (transitionIssues.length > 0) {
    suggestions.push('🔗 转折词：减少"但是""然后"的重复使用，尝试直接描述');
  }

  return suggestions;
}

// ═══ Layer C: 修订层 ═══

/**
 * 疲劳词替换建议
 */
export const WORD_REPLACEMENTS: Record<string, string[]> = {
  '微微': ['嘴角轻扬', '眉梢一动', '眼波流转', '呼吸一滞'],
  '缓缓': ['一步一顿', '慢慢吞吞', '一步三摇', '徐徐'],
  '默默': ['一言不发', '不做声', '没有说话', '抿着嘴'],
  '淡淡': ['漫不经心', '不以为意', '随口', '轻描淡写'],
  '不禁': ['忍不住', '下意识', '脱口而出', '没忍住'],
  '突然': ['猛地', '冷不丁', '毫无征兆地', '毫无防备地'],
  '非常': ['格外', '异常', '尤其', '分外'],
};

/**
 * 生成 AI 修订提示词
 */
export function buildAntiAIFlavorPrompt(
  text: string,
  detection: AIFlavorDetectionResult,
): string {
  const parts: string[] = [];

  parts.push('请对以下文本进行"去 AI 味"改写，使其更加自然、有人味。');
  parts.push('');
  parts.push('【AI 味检测结果】');
  parts.push(`- AI 味评分：${detection.score}/100`);
  parts.push(`- 词汇疲劳：${detection.scores.vocabulary}/100`);
  parts.push(`- 句式模式：${detection.scores.sentence}/100`);
  parts.push(`- 段落均匀：${detection.scores.paragraph}/100`);
  parts.push(`- 转折密度：${detection.scores.transition}/100`);
  parts.push('');

  if (detection.issues.length > 0) {
    parts.push('【具体问题】');
    for (const issue of detection.issues.slice(0, 5)) {
      if (issue.word) {
        parts.push(`- "${issue.word}" 出现 ${issue.count} 次 → ${issue.suggestion}`);
      } else if (issue.pattern) {
        parts.push(`- 句式模式 ${issue.count} 处 → ${issue.suggestion}`);
      } else {
        parts.push(`- ${issue.suggestion}`);
      }
    }
    parts.push('');
  }

  parts.push('【改写原则】');
  parts.push('1. 用具体动作、表情替代"微微""不禁"等泛泛之词');
  parts.push('2. 变换句式，避免"是...的""有着...的感觉"等公式化表达');
  parts.push('3. 段落长短交替，形成节奏感');
  parts.push('4. 减少转折词（但是、然后）的重复使用');
  parts.push('5. 增加感官细节（视觉、听觉、触觉）和独特比喻');
  parts.push('');

  parts.push('【原文】');
  parts.push(text.slice(0, 3000));
  parts.push('');

  parts.push('请输出改写后的文本，保持原有情节和人物不变。');

  return parts.join('\n');
}

/**
 * 快速去 AI 味（本地规则替换，不调用 AI）
 */
export function quickAntiAIFlavor(text: string): string {
  let result = text;

  // 简单替换疲劳词
  for (const [word, replacements] of Object.entries(WORD_REPLACEMENTS)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    let count = 0;
    result = result.replace(regex, (match) => {
      count++;
      // 每隔一次用不同的替换词
      if (count > 1) {
        return replacements[count % replacements.length];
      }
      return match;
    });
  }

  return result;
}

/**
 * 分析整个小说的 AI 味分布
 */
export function analyzeNovelAIFlavor(
  novel: NovelDocumentContent,
): {
  globalScore: number;
  chapterScores: { chapterId: string; chapterTitle: string; score: number; issues: AIFlavorIssue[] }[];
  hotspots: string[];
} {
  const chapterScores: { chapterId: string; chapterTitle: string; score: number; issues: AIFlavorIssue[] }[] = [];
  let totalScore = 0;
  let chapterCount = 0;

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      const content = ch.content || ch.scenes?.map(s => s.content).join('\n\n') || '';
      if (content.trim().length < 500) continue;

      const detection = detectAIFlavor(content);
      chapterScores.push({
        chapterId: ch.id,
        chapterTitle: ch.title,
        score: detection.score,
        issues: detection.issues,
      });

      totalScore += detection.score;
      chapterCount++;
    }
  }

  // 找出 AI 味最重的章节（hotspots）
  const hotspots = chapterScores
    .filter(c => c.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(c => `${c.chapterTitle}（${c.score}分）`);

  return {
    globalScore: chapterCount > 0 ? Math.round(totalScore / chapterCount) : 0,
    chapterScores,
    hotspots,
  };
}
