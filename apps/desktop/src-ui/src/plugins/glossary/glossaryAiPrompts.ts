import { generateTermId } from './types';
import type { GlossaryTerm } from './types';

/**
 * 构造术语表生成的 system prompt
 */
export function buildGlossarySystemPrompt(): string {
  return `你是一个专业的术语分析专家。用户会给你一段文档内容，你需要识别其中的专业术语、缩写和关键概念，并为每个术语提供准确的定义。

请严格按照以下 JSON 格式输出，不要输出任何其他解释文字：

\`\`\`json
[
  {
    "term": "术语名称",
    "definition": "术语的准确定义和解释",
    "aliases": ["别名1", "缩写"],
    "frequency": 3,
    "translation": "English Translation"
  }
]
\`\`\`

要求：
1. term 是术语的标准名称
2. definition 是简洁准确的定义（1-3 句话）
3. aliases 是该术语的别名、缩写或同义词（数组，可为空 []）
4. frequency 是该术语在文档中大致出现的次数（整数）
5. translation 是术语的英文翻译（如果原文是中文）或中文翻译（如果原文是英文），没有则为空字符串
6. 按术语重要性从高到低排序
7. 提取 15-30 个最重要的术语
8. 只提取真正的专业术语和关键概念，不要提取普通词汇
9. 只输出 JSON 数组，不要输出其他任何文字`;
}

/**
 * 构造用户 prompt
 */
export function buildGlossaryUserPrompt(content: string, customPrompt?: string): string {
  const parts: string[] = [];

  if (customPrompt && customPrompt.trim()) {
    parts.push(customPrompt);
  } else {
    parts.push('请从以下文档中识别并提取专业术语，生成术语表。');
  }

  parts.push('');
  parts.push('---');
  parts.push('文档内容：');
  parts.push(content);
  parts.push('---');

  return parts.join('\n');
}

/**
 * 解析 AI 返回的术语表数据
 */
export function parseGlossaryFromAiResponse(text: string): GlossaryTerm[] | null {
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
      if (typeof parsed[0] !== 'object' || !parsed[0].term) continue;

      return parsed.map((item: Record<string, unknown>) => ({
        id: generateTermId(),
        term: String(item.term || ''),
        definition: String(item.definition || ''),
        aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
        frequency: typeof item.frequency === 'number' ? item.frequency : 1,
        translation: item.translation ? String(item.translation) : undefined,
      }));
    } catch (e) {
      console.warn('[Glossary] 解析候选失败:', e instanceof Error ? e.message : e);
    }
  }

  console.error('[Glossary] 无法解析 AI 返回的术语表数据');
  return null;
}
