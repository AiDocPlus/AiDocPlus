import { generateCitationId } from './types';
import type { Citation, CitationStyle } from './types';
import { CITATION_STYLE_LABELS } from './types';

/**
 * 构造引用提取的 system prompt
 */
export function buildCitationSystemPrompt(style: CitationStyle): string {
  return `你是一个专业的学术引用分析专家。用户会给你一段文档内容，你需要：
1. 识别文档中所有的引用和参考文献
2. 提取每条引用的结构化信息
3. 检查引用的完整性和格式问题

目标引用格式：${CITATION_STYLE_LABELS[style]}

请严格按照以下 JSON 格式输出，不要输出任何其他解释文字：

\`\`\`json
[
  {
    "authors": ["作者1", "作者2"],
    "title": "文献标题",
    "source": "期刊名/出版社/网站名",
    "year": "2024",
    "doi": "10.xxxx/xxxxx",
    "url": "https://...",
    "volume": "卷号",
    "issue": "期号",
    "pages": "页码范围",
    "publisher": "出版社",
    "type": "journal",
    "inTextRef": "[1] 或 (Author, 2024)",
    "valid": true,
    "issues": ["缺少DOI", "作者格式不规范"]
  }
]
\`\`\`

要求：
1. authors 是作者数组，每个作者一个字符串
2. type 只能是 "journal"、"book"、"conference"、"web"、"thesis"、"other" 之一
3. inTextRef 是该引用在正文中的引用标记（如 [1]、(Smith, 2024) 等）
4. valid 为 true 表示引用信息完整且格式正确，false 表示有问题
5. issues 数组列出该引用存在的问题（如缺少字段、格式不规范等），无问题则为空数组 []
6. 如果某个字段在文档中找不到，设为空字符串 ""
7. 按引用在文档中出现的顺序排列
8. 只输出 JSON 数组，不要输出其他任何文字`;
}

/**
 * 构造用户 prompt
 */
export function buildCitationUserPrompt(content: string, style: CitationStyle, customPrompt?: string): string {
  const parts: string[] = [];

  if (customPrompt && customPrompt.trim()) {
    parts.push(customPrompt);
  } else {
    parts.push(`请从以下文档中识别并提取所有引用和参考文献，按 ${CITATION_STYLE_LABELS[style]} 格式进行分析和检查。`);
  }

  parts.push('');
  parts.push('---');
  parts.push('文档内容：');
  parts.push(content);
  parts.push('---');

  return parts.join('\n');
}

/**
 * 解析 AI 返回的引用数据
 */
export function parseCitationsFromAiResponse(text: string): Citation[] | null {
  let cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/[\x00-\x08\x0B\u000B\u000C\x0E-\x1F]/g, '')
    .trim();

  const candidates: string[] = [];

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    candidates.push(codeBlockMatch[1].trim());
  }

  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(cleaned.slice(firstBracket, lastBracket + 1));
  }

  candidates.push(cleaned);

  for (const jsonStr of candidates) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed) || parsed.length === 0) continue;
      if (typeof parsed[0] !== 'object' || !parsed[0].title) continue;

      return parsed.map((item: Record<string, unknown>, idx: number) => ({
        id: generateCitationId(),
        index: idx + 1,
        authors: Array.isArray(item.authors) ? item.authors.map(String) : [],
        title: String(item.title || ''),
        source: String(item.source || ''),
        year: String(item.year || ''),
        doi: item.doi ? String(item.doi) : undefined,
        url: item.url ? String(item.url) : undefined,
        volume: item.volume ? String(item.volume) : undefined,
        issue: item.issue ? String(item.issue) : undefined,
        pages: item.pages ? String(item.pages) : undefined,
        publisher: item.publisher ? String(item.publisher) : undefined,
        type: (['journal', 'book', 'conference', 'web', 'thesis', 'other'].includes(String(item.type))
          ? String(item.type) : 'other') as Citation['type'],
        inTextRef: item.inTextRef ? String(item.inTextRef) : undefined,
        valid: item.valid !== false,
        issues: Array.isArray(item.issues) ? item.issues.map(String) : [],
      }));
    } catch (e) {
      console.warn('[Citation] 解析候选失败:', e instanceof Error ? e.message : e);
    }
  }

  console.error('[Citation] 无法解析 AI 返回的引用数据');
  return null;
}
