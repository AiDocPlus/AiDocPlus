/**
 * 引用格式类型
 */
export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'gb' | 'ieee' | 'vancouver';

/**
 * 单条引用
 */
export interface Citation {
  id: string;
  index: number;
  authors: string[];
  title: string;
  source: string;
  year: string;
  doi?: string;
  url?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  type: 'journal' | 'book' | 'conference' | 'web' | 'thesis' | 'other';
  inTextRef?: string;
  valid: boolean;
  issues: string[];
}

/**
 * 引用管理数据
 */
export interface CitationData {
  citations: Citation[];
  style: CitationStyle;
  generatedAt: number;
  lastPrompt?: string;
}

/**
 * 引用格式标签
 */
export const CITATION_STYLE_LABELS: Record<CitationStyle, string> = {
  apa: 'APA (第7版)',
  mla: 'MLA (第9版)',
  chicago: 'Chicago',
  gb: 'GB/T 7714',
  ieee: 'IEEE',
  vancouver: 'Vancouver',
};

/**
 * 引用类型标签
 */
export const CITATION_TYPE_LABELS: Record<string, string> = {
  journal: '期刊论文',
  book: '图书',
  conference: '会议论文',
  web: '网页',
  thesis: '学位论文',
  other: '其他',
};

/**
 * 生成唯一 ID
 */
export function generateCitationId(): string {
  return `cite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
