/**
 * 写作统计工具函数
 */

export interface TextStats {
  totalChars: number;
  totalCharsNoSpaces: number;
  totalWords: number;
  paragraphs: number;
  sentences: number;
  readingTimeMinutes: number;
  avgSentenceLen: number;
  headings: number;
  links: number;
  images: number;
  codeBlocks: number;
  uniqueWords: number;
  vocabularyRichness: number;
  topWords: Array<{ word: string; count: number }>;
}

/**
 * 判断是否为中文字符
 */
function isCJK(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||   // CJK 统一汉字
    (code >= 0x3400 && code <= 0x4dbf) ||   // CJK 扩展 A
    (code >= 0xf900 && code <= 0xfaff) ||   // CJK 兼容汉字
    (code >= 0x3000 && code <= 0x303f) ||   // CJK 标点
    (code >= 0xff00 && code <= 0xffef)      // 全角字符
  );
}

/**
 * 统计中文字数（中文按字计数，英文按词计数）
 */
function countWords(text: string): number {
  let cjkCount = 0;
  for (const ch of text) {
    if (isCJK(ch)) cjkCount++;
  }
  // 英文单词
  const noCJK = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g, ' ');
  const englishWords = noCJK.split(/\s+/).filter(w => w.length > 0).length;
  return cjkCount + englishWords;
}

/**
 * 统计句子数
 */
function countSentences(text: string): number {
  // 中文句号、问号、叹号 + 英文句号、问号、叹号
  const matches = text.match(/[。！？.!?]+/g);
  return matches ? matches.length : (text.trim() ? 1 : 0);
}

/**
 * 提取高频词（排除停用词）
 */
function getTopWords(text: string, topN: number = 10): Array<{ word: string; count: number }> {
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '他', '她', '它', '们', '那', '被', '从', '把', '对', '与',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
    'she', 'her', 'it', 'its', 'they', 'them', 'their',
  ]);

  const freq = new Map<string, number>();

  // 中文：按字/词统计
  const cjkChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]{2,4}/g) || [];
  for (const w of cjkChars) {
    if (!stopWords.has(w)) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }

  // 英文：按词统计
  const engWords = text.toLowerCase().match(/[a-z]{2,}/g) || [];
  for (const w of engWords) {
    if (!stopWords.has(w)) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

/**
 * 计算文本统计数据
 */
export function analyzeText(text: string): TextStats {
  if (!text.trim()) {
    return {
      totalChars: 0, totalCharsNoSpaces: 0, totalWords: 0,
      paragraphs: 0, sentences: 0, readingTimeMinutes: 0,
      avgSentenceLen: 0, headings: 0, links: 0, images: 0,
      codeBlocks: 0, uniqueWords: 0, vocabularyRichness: 0,
      topWords: [],
    };
  }

  const totalChars = text.length;
  const totalCharsNoSpaces = text.replace(/\s/g, '').length;
  const totalWords = countWords(text);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length || 1;
  const sentences = countSentences(text);

  // 阅读时间：中文 400 字/分钟，英文 200 词/分钟，取平均
  const readingTimeMinutes = Math.max(1, Math.ceil(totalWords / 300));

  const avgSentenceLen = sentences > 0 ? Math.round(totalWords / sentences) : 0;

  // Markdown 结构统计
  const headings = (text.match(/^#{1,6}\s/gm) || []).length;
  const links = (text.match(/\[([^\]]*)\]\([^)]*\)/g) || []).length;
  const images = (text.match(/!\[([^\]]*)\]\([^)]*\)/g) || []).length;
  const codeBlocks = (text.match(/```/g) || []).length / 2;

  // 词汇丰富度
  const allWords = text.toLowerCase().match(/[\u4e00-\u9fff]|[a-z]{2,}/g) || [];
  const uniqueWords = new Set(allWords).size;
  const vocabularyRichness = allWords.length > 0 ? Math.round((uniqueWords / allWords.length) * 100) : 0;

  const topWords = getTopWords(text);

  return {
    totalChars, totalCharsNoSpaces, totalWords,
    paragraphs, sentences, readingTimeMinutes,
    avgSentenceLen, headings, links, images,
    codeBlocks: Math.floor(codeBlocks), uniqueWords, vocabularyRichness,
    topWords,
  };
}
