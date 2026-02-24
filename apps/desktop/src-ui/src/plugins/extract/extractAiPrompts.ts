import type { ExtractField, ExtractTemplate } from './types';

/**
 * 构造结构化数据提取的 system prompt
 */
export function buildExtractSystemPrompt(fields: ExtractField[]): string {
  const fieldDesc = fields.map(f => `"${f.key}": "${f.label}"`).join(', ');
  return `你是一个专业的信息提取专家。用户会给你一段文档内容和提取要求，你需要从中提取结构化信息。

请严格按照以下 JSON 格式输出，不要输出任何其他解释文字：

\`\`\`json
{
  "fields": [${fields.map(f => `{"key": "${f.key}", "label": "${f.label}"}`).join(', ')}],
  "rows": [
    {${fieldDesc}}
  ]
}
\`\`\`

要求：
1. fields 数组描述每列的 key 和 label
2. rows 数组中每个对象的 key 必须与 fields 中的 key 一一对应
3. 如果文档中找不到某个字段的信息，该字段值设为空字符串 ""
4. 尽可能完整地提取所有相关信息，不要遗漏
5. 每条信息独立成行，不要合并多条信息到一行
6. 只输出 JSON，不要输出其他任何文字`;
}

/**
 * 构造自定义提取的 system prompt（AI 自动构建字段）
 */
export function buildCustomExtractSystemPrompt(): string {
  return `你是一个专业的信息提取专家。用户会给你一段文档内容和提取需求描述，你需要：
1. 根据用户描述自动设计合适的字段（fields）
2. 从文档中提取对应的结构化信息

请严格按照以下 JSON 格式输出，不要输出任何其他解释文字：

\`\`\`json
{
  "fields": [{"key": "字段英文key", "label": "字段中文名"}, ...],
  "rows": [
    {"字段key1": "值1", "字段key2": "值2", ...}
  ]
}
\`\`\`

要求：
1. fields 数组中的 key 使用简短的英文标识符（如 name, date, amount）
2. label 使用中文描述
3. rows 中每个对象的 key 必须与 fields 中的 key 一一对应
4. 字段数量控制在 3-8 个，覆盖用户需求的关键信息
5. 如果文档中找不到某个字段的信息，该字段值设为空字符串 ""
6. 只输出 JSON，不要输出其他任何文字`;
}

/**
 * 构造用户 prompt
 */
export function buildExtractUserPrompt(
  content: string,
  template: ExtractTemplate,
  customDesc?: string
): string {
  const parts: string[] = [];

  if (template.key === 'custom' && customDesc) {
    parts.push(`请从以下文档中提取信息：${customDesc}`);
  } else {
    parts.push(`请从以下文档中提取「${template.label}」相关信息。`);
    if (template.fields.length > 0) {
      parts.push(`需要提取的字段：${template.fields.map(f => f.label).join('、')}`);
    }
  }

  parts.push('');
  parts.push('---');
  parts.push('文档内容：');
  parts.push(content);
  parts.push('---');

  return parts.join('\n');
}

/**
 * 解析 AI 返回的提取结果
 */
export function parseExtractFromAiResponse(text: string): {
  fields: ExtractField[];
  rows: Record<string, string>[];
} | null {
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

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  candidates.push(cleaned);

  for (const jsonStr of candidates) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object') continue;
      if (!Array.isArray(parsed.fields) || !Array.isArray(parsed.rows)) continue;

      const fields: ExtractField[] = parsed.fields.map((f: Record<string, unknown>) => ({
        key: String(f.key || ''),
        label: String(f.label || f.key || ''),
      })).filter((f: ExtractField) => f.key);

      const rows: Record<string, string>[] = parsed.rows.map((row: Record<string, unknown>) => {
        const r: Record<string, string> = {};
        for (const f of fields) {
          r[f.key] = String(row[f.key] ?? '');
        }
        return r;
      });

      if (fields.length > 0) {
        return { fields, rows };
      }
    } catch (e) {
      console.warn('[Extract] 解析候选失败:', e instanceof Error ? e.message : e);
    }
  }

  console.error('[Extract] 无法解析 AI 返回的提取数据');
  return null;
}
