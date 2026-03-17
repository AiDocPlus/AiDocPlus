/**
 * 帮助文档全文搜索
 */

import type { HelpDoc } from './helpDocs';
import { getAllDocs } from './helpDocs';

export interface SearchResult {
  doc: HelpDoc;
  /** 匹配分数（越高越相关） */
  score: number;
  /** 匹配的上下文片段 */
  snippet: string;
}

/** 简单的全文搜索 */
export function searchDocs(query: string): SearchResult[] {
  if (!query.trim()) return [];

  const docs = getAllDocs();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const doc of docs) {
    let score = 0;
    const lowerTitle = doc.title.toLowerCase();
    const lowerContent = doc.content.toLowerCase();
    const lowerKeywords = doc.keywords.map(k => k.toLowerCase());

    for (const term of terms) {
      // 标题匹配（权重最高）
      if (lowerTitle.includes(term)) score += 10;
      // 关键词匹配
      if (lowerKeywords.some(k => k.includes(term))) score += 5;
      // 内容匹配
      const contentMatches = lowerContent.split(term).length - 1;
      score += Math.min(contentMatches, 5); // 最多 5 分
    }

    if (score > 0) {
      results.push({
        doc,
        score,
        snippet: extractSnippet(doc.content, terms[0]),
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/** 提取匹配上下文片段 */
function extractSnippet(content: string, term: string): string {
  // 去掉 Markdown 标记
  const plain = content
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/---+/g, '')
    .trim();

  const lowerPlain = plain.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const idx = lowerPlain.indexOf(lowerTerm);

  if (idx === -1) {
    return plain.slice(0, 100) + '...';
  }

  const start = Math.max(0, idx - 40);
  const end = Math.min(plain.length, idx + term.length + 60);
  let snippet = plain.slice(start, end).trim();

  if (start > 0) snippet = '...' + snippet;
  if (end < plain.length) snippet = snippet + '...';

  return snippet;
}
