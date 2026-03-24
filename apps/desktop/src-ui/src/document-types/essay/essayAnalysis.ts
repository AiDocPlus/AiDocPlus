/**
 * essayAnalysis.ts — 散文文学分析工具
 *
 * Phase 5: 高级文学分析
 * - 修辞检测（比喻/拟人/排比/对偶/夸张/反问/设问/引用/通感/顶真）
 * - 意象分析（视觉/听觉/嗅觉/触觉/味觉/抽象意象）
 * - 情感走势（按段落计算情感倾向）
 * - 文学评分（修辞密度/意象丰富度/情感深度/结构完整度/语言美感）
 * - 关键词提取与词频统计
 * - 段落复杂度分析
 */

import type { EssayDocumentContent, EssayParagraph } from './types';

// ═══════════════════════════════════════════════════════
// 修辞检测
// ═══════════════════════════════════════════════════════

export interface RhetoricDetection {
  type: string;
  label: string;
  matches: { start: number; end: number; text: string; description: string }[];
  count: number;
}

/** 比喻检测（像/如/仿佛/好似/如同/犹如/宛如/恰似/似/若） */
export function detectMetaphors(text: string): RhetoricDetection {
  const patterns = [
    { regex: /(.{0,30})(?:像|如|仿佛|好似|如同|犹如|宛如|恰似|似|若)(.{0,30})/g, desc: '明喻' },
    { regex: /(.{0,20})(?:就是|正是|乃是|便是|即是)(.{0,20})/g, desc: '暗喻' },
  ];
  const matches: RhetoricDetection['matches'] = [];
  patterns.forEach(p => {
    let m;
    while ((m = p.regex.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        description: p.desc,
      });
    }
  });
  return { type: 'metaphor', label: '比喻', matches, count: matches.length };
}

/** 拟人检测（赋予非人类事物人的行为/情感/语言） */
export function detectPersonification(text: string): RhetoricDetection {
  const patterns = [
    { regex: /(.{0,20})(?:笑|哭|唱|跳|舞|叫|喊|怒|喜|悲|愁|思|想|说)(.{0,20})/g, desc: '行为拟人' },
    { regex: /(.{0,20})(?:温柔|严厉|慈祥|冷漠|热情)(.{0,20})/g, desc: '情感拟人' },
  ];
  const matches: RhetoricDetection['matches'] = [];
  patterns.forEach(p => {
    let m;
    while ((m = p.regex.exec(text)) !== null) {
      // 简单判断：如果主语不是明显的人类词汇
      const subject = m[1];
      if (!/人|我|你|他|她|我们|你们|他们|她们/.test(subject)) {
        matches.push({
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
          description: p.desc,
        });
      }
    }
  });
  return { type: 'personification', label: '拟人', matches, count: matches.length };
}

/** 排比检测（三个及以上相似结构） */
export function detectParallelism(text: string): RhetoricDetection {
  // 检测重复的结构模式（简化版）
  const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 0);
  const matches: RhetoricDetection['matches'] = [];
  
  // 检测连续三个及以上以相同词开头的句子
  for (let i = 0; i <= sentences.length - 3; i++) {
    const s1 = sentences[i].trim();
    const s2 = sentences[i + 1].trim();
    const s3 = sentences[i + 2].trim();
    
    // 提取每句的前3个字符作为模式
    const pattern1 = s1.slice(0, 3);
    const pattern2 = s2.slice(0, 3);
    const pattern3 = s3.slice(0, 3);
    
    if (pattern1 === pattern2 && pattern2 === pattern3) {
      const fullText = `${s1}。${s2}。${s3}。`;
      const start = text.indexOf(fullText);
      if (start !== -1) {
        matches.push({
          start,
          end: start + fullText.length,
          text: fullText,
          description: '三句排比',
        });
      }
    }
  }
  
  return { type: 'parallelism', label: '排比', matches, count: matches.length };
}

/** 对偶检测（对称结构） */
export function detectAntithesis(text: string): RhetoricDetection {
  // 简化检测：寻找长度相近、结构对称的句子对
  const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 5);
  const matches: RhetoricDetection['matches'] = [];
  
  for (let i = 0; i < sentences.length - 1; i++) {
    const s1 = sentences[i].trim();
    const s2 = sentences[i + 1].trim();
    
    // 长度相近（相差不超过3个字符）
    if (Math.abs(s1.length - s2.length) <= 3) {
      // 检测是否有反义词或对比词
      const contrastWords = ['是|非', '有|无', '来|去', '上|下', '大|小', '多|少', '黑|白', '美|丑', '善|恶', '爱|恨'];
      const hasContrast = contrastWords.some(pair => {
        const [word1, word2] = pair.split('|');
        return (s1.includes(word1) && s2.includes(word2)) || (s1.includes(word2) && s2.includes(word1));
      });
      
      if (hasContrast) {
        const fullText = `${s1}。${s2}。`;
        const start = text.indexOf(fullText);
        if (start !== -1) {
          matches.push({
            start,
            end: start + fullText.length,
            text: fullText,
            description: '对偶句',
          });
        }
      }
    }
  }
  
  return { type: 'antithesis', label: '对偶', matches, count: matches.length };
}

/** 夸张检测 */
export function detectHyperbole(text: string): RhetoricDetection {
  const patterns = [
    /千.{1,5}万.{1,5}/g,
    /.{1,3}得.{1,3}要命/g,
    /.{1,3}得.{1,3}不行/g,
    /.{1,3}死.{1,5}/g,
    /.{1,3}破.{1,5}/g,
  ];
  const matches: RhetoricDetection['matches'] = [];
  
  patterns.forEach(regex => {
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        description: '夸张表达',
      });
    }
  });
  
  return { type: 'hyperbole', label: '夸张', matches, count: matches.length };
}

/** 反问检测 */
export function detectRhetoricalQuestion(text: string): RhetoricDetection {
  const patterns = [
    /(.{0,30})难道(.{0,30})吗[？？]/g,
    /(.{0,30})怎么(.{0,30})呢[？？]/g,
    /(.{0,30})岂不(.{0,30})吗[？？]/g,
  ];
  const matches: RhetoricDetection['matches'] = [];
  
  patterns.forEach(regex => {
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        description: '反问句',
      });
    }
  });
  
  return { type: 'rhetoricalQuestion', label: '反问', matches, count: matches.length };
}

/** 设问检测 */
export function detectHypophora(text: string): RhetoricDetection {
  // 检测自问自答的模式
  const sentences = text.split(/[。！？]/);
  const matches: RhetoricDetection['matches'] = [];
  
  for (let i = 0; i < sentences.length - 1; i++) {
    const s1 = sentences[i].trim();
    const s2 = sentences[i + 1].trim();
    
    if (s1.includes('?') || s1.includes('？')) {
      // 如果前一句是问句，后一句是答句
      if (!s2.includes('?') && !s2.includes('？') && s2.length > 0) {
        const fullText = `${s1}？${s2}。`;
        const start = text.indexOf(fullText);
        if (start !== -1) {
          matches.push({
            start,
            end: start + fullText.length,
            text: fullText,
            description: '设问句',
          });
        }
      }
    }
  }
  
  return { type: 'hypophora', label: '设问', matches, count: matches.length };
}

/** 引用检测 */
export function detectQuotation(text: string): RhetoricDetection {
  const patterns = [
    /「([^」]{5,100})」/g,
    /"([^"]{5,100})"/g,
    /'([^']{5,100})'/g,
    /《([^》]{5,50})》/g,
  ];
  const matches: RhetoricDetection['matches'] = [];
  
  patterns.forEach(regex => {
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        description: '引用内容',
      });
    }
  });
  
  return { type: 'quotation', label: '引用', matches, count: matches.length };
}

/** 通感检测 */
export function detectSynesthesia(text: string): RhetoricDetection {
  const patterns = [
    /(.{0,20})(?:听|闻)(.{0,20})(?:颜色|色彩|光|暗|亮)/g,
    /(.{0,20})(?:看|见)(.{0,20})(?:声音|响声|寂静)/g,
    /(.{0,20})(?:甜|苦|酸|辣)(.{0,20})(?:声音|颜色)/g,
  ];
  const matches: RhetoricDetection['matches'] = [];
  
  patterns.forEach(regex => {
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        description: '通感修辞',
      });
    }
  });
  
  return { type: 'synesthesia', label: '通感', matches, count: matches.length };
}

/** 顶真检测 */
export function detectAnadiplosis(text: string): RhetoricDetection {
  const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 0);
  const matches: RhetoricDetection['matches'] = [];
  
  for (let i = 0; i < sentences.length - 1; i++) {
    const s1 = sentences[i].trim();
    const s2 = sentences[i + 1].trim();
    
    // 检测前一句的结尾词与后一句的开头词相同
    const lastChar = s1.slice(-1);
    const firstChar = s2.slice(0, 1);
    
    if (lastChar === firstChar && /[\u4e00-\u9fff]/.test(lastChar)) {
      const fullText = `${s1}。${s2}。`;
      const start = text.indexOf(fullText);
      if (start !== -1) {
        matches.push({
          start,
          end: start + fullText.length,
          text: fullText,
          description: '顶真修辞',
        });
      }
    }
  }
  
  return { type: 'anadiplosis', label: '顶真', matches, count: matches.length };
}

/** 综合修辞检测 */
export function detectAllRhetoric(text: string): RhetoricDetection[] {
  return [
    detectMetaphors(text),
    detectPersonification(text),
    detectParallelism(text),
    detectAntithesis(text),
    detectHyperbole(text),
    detectRhetoricalQuestion(text),
    detectHypophora(text),
    detectQuotation(text),
    detectSynesthesia(text),
    detectAnadiplosis(text),
  ].filter(r => r.count > 0);
}

// ═══════════════════════════════════════════════════════
// 意象分析
// ═══════════════════════════════════════════════════════

export interface ImageryDetection {
  type: 'visual' | 'auditory' | 'olfactory' | 'tactile' | 'gustatory' | 'abstract';
  label: string;
  keywords: string[];
  matches: { start: number; end: number; text: string; keyword: string }[];
  count: number;
}

export const IMAGERY_KEYWORDS: Record<string, string[]> = {
  visual: ['红', '黄', '蓝', '绿', '白', '黑', '亮', '暗', '光', '影', '色', '彩', '景', '画', '图', '貌', '样', '形'],
  auditory: ['声', '音', '响', '鸣', '唱', '歌', '乐', '琴', '笛', '鼓', '静', '噪', '听', '闻', '耳'],
  olfactory: ['香', '臭', '味', '气', '芳', '馨', '腥', '膻', '鼻', '嗅'],
  tactile: ['冷', '热', '温', '凉', '软', '硬', '滑', '粗', '湿', '干', '痛', '痒', '触', '摸'],
  gustatory: ['甜', '苦', '酸', '辣', '咸', '淡', '鲜', '香', '口', '舌', '尝', '味'],
  abstract: ['爱', '恨', '愁', '喜', '悲', '怒', '乐', '思', '念', '梦', '魂', '心', '情', '意'],
};

const IMAGERY_LABELS = {
  visual: '视觉意象',
  auditory: '听觉意象',
  olfactory: '嗅觉意象',
  tactile: '触觉意象',
  gustatory: '味觉意象',
  abstract: '抽象意象',
};

export function detectImagery(text: string): ImageryDetection[] {
  const results: ImageryDetection[] = [];
  
  for (const [type, keywords] of Object.entries(IMAGERY_KEYWORDS)) {
    const matches: ImageryDetection['matches'] = [];
    
    keywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'g');
      let m;
      while ((m = regex.exec(text)) !== null) {
        matches.push({
          start: m.index,
          end: m.index + keyword.length,
          text: keyword,
          keyword,
        });
      }
    });
    
    if (matches.length > 0) {
      results.push({
        type: type as ImageryDetection['type'],
        label: IMAGERY_LABELS[type as keyof typeof IMAGERY_LABELS],
        keywords,
        matches,
        count: matches.length,
      });
    }
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════
// 情感走势分析
// ═══════════════════════════════════════════════════════

export interface EmotionPoint {
  paragraphIndex: number;
  score: number; // -1 到 1
  dominant: string; // 主导情感
  confidence: number; // 置信度 0-1
}

const EMOTION_KEYWORDS = {
  positive: ['美', '好', '喜', '乐', '爱', '温暖', '明亮', '希望', '幸福', '快乐', '欢', '悦', '兴', '愉快'],
  negative: ['悲', '哀', '愁', '苦', '痛', '伤', '恨', '怒', '恶', '怕', '惧', '忧', '凄', '惨', '暗'],
  neutral: ['平', '静', '淡', '然', '常', '普', '通', '一', '般', '中'],
};

export function analyzeEmotionFlow(paragraphs: EssayParagraph[], content: string): EmotionPoint[] {
  return paragraphs.map((para, index) => {
    const text = content.slice(para.startOffset, para.endOffset);
    let positiveScore = 0;
    let negativeScore = 0;
    let totalWords = 0;
    
    // 简单情感词频统计
    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      keywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'g');
        const matches = text.match(regex);
        if (matches) {
          const count = matches.length;
          totalWords += count;
          if (emotion === 'positive') positiveScore += count;
          else if (emotion === 'negative') negativeScore += count;
        }
      });
    }
    
    // 计算情感分数
    let score = 0;
    let dominant = '中性';
    if (totalWords > 0) {
      score = (positiveScore - negativeScore) / Math.max(totalWords, 1);
      if (score > 0.1) dominant = '积极';
      else if (score < -0.1) dominant = '消极';
    }
    
    // 置信度基于情感词密度
    const confidence = Math.min(totalWords / 10, 1);
    
    return {
      paragraphIndex: index,
      score: Math.max(-1, Math.min(1, score)),
      dominant,
      confidence,
    };
  });
}

// ═══════════════════════════════════════════════════════
// 文学评分
// ═══════════════════════════════════════════════════════

export interface LiteraryScore {
  overall: number; // 总分 0-100
  dimensions: {
    rhetoric: { score: number; weight: number; description: string };
    imagery: { score: number; weight: number; description: string };
    emotion: { score: number; weight: number; description: string };
    structure: { score: number; weight: number; description: string };
    language: { score: number; weight: number; description: string };
  };
  suggestions: string[];
}

export function calculateLiteraryScore(essay: EssayDocumentContent): LiteraryScore {
  const content = essay.content;
  const paragraphs = essay.paragraphs;
  const wordCount = content.length;
  
  // 修辞密度评分
  const rhetoricDetections = detectAllRhetoric(content);
  const rhetoricCount = rhetoricDetections.reduce((sum, r) => sum + r.count, 0);
  const rhetoricDensity = wordCount > 0 ? rhetoricCount / (wordCount / 100) : 0; // 每100字修辞数
  const rhetoricScore = Math.min(100, rhetoricDensity * 20); // 每100字5个修辞为满分
  
  // 意象丰富度评分
  const imageryDetections = detectImagery(content);
  const imageryCount = imageryDetections.reduce((sum, i) => sum + i.count, 0);
  const imageryDensity = wordCount > 0 ? imageryCount / (wordCount / 100) : 0;
  const imageryScore = Math.min(100, imageryDensity * 15); // 每100字6.7个意象为满分
  
  // 情感深度评分
  const emotionFlow = analyzeEmotionFlow(paragraphs, content);
  const avgEmotionIntensity = emotionFlow.reduce((sum, e) => sum + Math.abs(e.score) * e.confidence, 0) / Math.max(paragraphs.length, 1);
  const emotionScore = avgEmotionIntensity * 100;
  
  // 结构完整度评分
  let structureScore = paragraphs.length >= 3 ? 80 : paragraphs.length * 25; // 至少3段
  if (paragraphs.length > 0) {
    const avgParaLength = paragraphs.reduce((sum, p) => sum + (p.endOffset - p.startOffset), 0) / paragraphs.length;
    if (avgParaLength > 50 && avgParaLength < 500) structureScore += 20; // 段落长度适中
  }
  
  // 语言美感评分（基于句式变化）
  const sentences = content.split(/[。！？]/).filter((s: string) => s.trim().length > 0);
  const sentenceLengths = sentences.map((s: string) => s.length);
  const avgLength = sentenceLengths.reduce((sum, l) => sum + l, 0) / Math.max(sentences.length, 1);
  const lengthVariance = sentenceLengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / Math.max(sentences.length, 1);
  const languageScore = Math.min(100, (lengthVariance / avgLength) * 50 + 50); // 句式变化丰富
  
  // 计算总分
  const dimensions = {
    rhetoric: { score: rhetoricScore, weight: 0.25, description: '修辞运用' },
    imagery: { score: imageryScore, weight: 0.2, description: '意象营造' },
    emotion: { score: emotionScore, weight: 0.25, description: '情感表达' },
    structure: { score: structureScore, weight: 0.15, description: '结构布局' },
    language: { score: languageScore, weight: 0.15, description: '语言美感' },
  };
  
  const overall = Object.entries(dimensions).reduce(
    (sum, [, dim]) => sum + dim.score * dim.weight,
    0
  );
  
  // 生成建议
  const suggestions: string[] = [];
  if (rhetoricScore < 60) suggestions.push('适当增加修辞手法，如比喻、拟人等，增强表达效果');
  if (imageryScore < 60) suggestions.push('丰富感官意象描写，调动读者的视觉、听觉等感受');
  if (emotionScore < 60) suggestions.push('加强情感表达，让读者更能感受到文字背后的情绪');
  if (structureScore < 60) suggestions.push('优化段落结构，确保起承转合清晰自然');
  if (languageScore < 60) suggestions.push('注意句式变化，避免单调重复');
  
  return {
    overall: Math.round(overall),
    dimensions,
    suggestions,
  };
}

// ═══════════════════════════════════════════════════════
// 关键词提取与词频统计
// ═══════════════════════════════════════════════════════

export interface KeywordFrequency {
  word: string;
  count: number;
  weight: number; // TF-IDF 简化版
}

export function extractKeywords(text: string, limit: number = 20): KeywordFrequency[] {
  // 简单分词（基于常见分隔符）
  const words = text
    .replace(/[，。！？；：""''（）【】《》、]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && /[\u4e00-\u9fff]/.test(w));
  
  // 词频统计
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // 计算权重（简化 TF-IDF）
  const totalWords = words.length;
  const result: KeywordFrequency[] = Object.entries(frequency)
    .map(([word, count]) => ({
      word,
      count,
      weight: (count / totalWords) * Math.log(totalWords / count),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
  
  return result;
}

// ═══════════════════════════════════════════════════════
// 段落复杂度分析
// ═══════════════════════════════════════════════════════

export interface ParagraphComplexity {
  index: number;
  length: number;
  sentenceCount: number;
  avgSentenceLength: number;
  complexity: 'simple' | 'moderate' | 'complex';
  rhetoricCount: number;
  imageryCount: number;
}

export function analyzeParagraphComplexity(paragraphs: EssayParagraph[], fullContent: string): ParagraphComplexity[] {
  return paragraphs.map((para, index) => {
    const content = fullContent.slice(para.startOffset, para.endOffset);
    const sentences = content.split(/[。！？]/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    const avgSentenceLength = sentenceCount > 0 ? content.length / sentenceCount : 0;
    
    // 复杂度判断
    let complexity: ParagraphComplexity['complexity'] = 'simple';
    if (sentenceCount >= 4 || avgSentenceLength > 40) complexity = 'complex';
    else if (sentenceCount >= 2 || avgSentenceLength > 20) complexity = 'moderate';
    
    // 修辞和意象数量
    const rhetoricCount = detectAllRhetoric(content).reduce((sum, r) => sum + r.count, 0);
    const imageryCount = detectImagery(content).reduce((sum, i) => sum + i.count, 0);
    
    return {
      index,
      length: content.length,
      sentenceCount,
      avgSentenceLength: Math.round(avgSentenceLength),
      complexity,
      rhetoricCount,
      imageryCount,
    };
  });
}

// ═══════════════════════════════════════════════════════
// 综合分析报告
// ═══════════════════════════════════════════════════════

export interface EssayAnalysisReport {
  rhetoric: RhetoricDetection[];
  imagery: ImageryDetection[];
  emotionFlow: EmotionPoint[];
  literaryScore: LiteraryScore;
  keywords: KeywordFrequency[];
  paragraphComplexity: ParagraphComplexity[];
  summary: {
    wordCount: number;
    paragraphCount: number;
    rhetoricDensity: number;
    imageryDensity: number;
    avgEmotionIntensity: number;
  };
}

export function generateEssayAnalysisReport(essay: EssayDocumentContent): EssayAnalysisReport {
  const rhetoric = detectAllRhetoric(essay.content);
  const imagery = detectImagery(essay.content);
  const emotionFlow = analyzeEmotionFlow(essay.paragraphs, essay.content);
  const literaryScore = calculateLiteraryScore(essay);
  const keywords = extractKeywords(essay.content);
  const paragraphComplexity = analyzeParagraphComplexity(essay.paragraphs, essay.content);
  
  const wordCount = essay.content.length;
  const paragraphCount = essay.paragraphs.length;
  const rhetoricDensity = wordCount > 0 ? rhetoric.reduce((sum, r) => sum + r.count, 0) / (wordCount / 100) : 0;
  const imageryDensity = wordCount > 0 ? imagery.reduce((sum, i) => sum + i.count, 0) / (wordCount / 100) : 0;
  const avgEmotionIntensity = emotionFlow.reduce((sum, e) => sum + Math.abs(e.score) * e.confidence, 0) / Math.max(paragraphCount, 1);
  
  return {
    rhetoric,
    imagery,
    emotionFlow,
    literaryScore,
    keywords,
    paragraphComplexity,
    summary: {
      wordCount,
      paragraphCount,
      rhetoricDensity,
      imageryDensity,
      avgEmotionIntensity,
    },
  };
}
