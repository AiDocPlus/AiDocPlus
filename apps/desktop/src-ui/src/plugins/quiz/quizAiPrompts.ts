import type { QuizConfig } from './types';

/**
 * 构造 AI 生成测试题的 system prompt
 */
export function buildQuizSystemPrompt(): string {
  return `你是一个专业的出题专家。用户会给你一段文档内容和出题要求，你需要根据内容生成高质量的测试题。

请严格按照以下 JSON 格式输出，不要输出任何其他解释文字：

\`\`\`json
[
  {
    "type": "single",
    "question": "题目内容",
    "options": ["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"],
    "answer": ["A"],
    "explanation": "答案解析：解释为什么选A..."
  },
  {
    "type": "multiple",
    "question": "题目内容（多选）",
    "options": ["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"],
    "answer": ["A", "C"],
    "explanation": "答案解析：解释为什么选AC..."
  },
  {
    "type": "truefalse",
    "question": "判断题题目内容",
    "options": ["A. 正确", "B. 错误"],
    "answer": ["A"],
    "explanation": "答案解析：解释为什么正确..."
  }
]
\`\`\`

要求：
1. type 字段只能是 "single"（单选）、"multiple"（多选）、"truefalse"（判断）之一
2. 单选题和多选题必须有 4 个选项（A/B/C/D），判断题固定为 ["A. 正确", "B. 错误"]
3. answer 是数组，单选和判断题为单元素数组如 ["A"]，多选题为多元素数组如 ["A", "C"]
4. 多选题的正确答案至少有 2 个
5. 每道题必须有详细的答案解析
6. 题目内容要紧扣文档内容，考察关键知识点
7. 题目难度适中，选项设计要有一定干扰性
8. 只输出 JSON 数组，不要输出其他任何文字`;
}

/**
 * 构造用户 prompt
 */
export function buildQuizUserPrompt(content: string, config: QuizConfig): string {
  const parts: string[] = [];

  parts.push(`根据本文档的正文内容，生成测试题：`);
  parts.push('');
  parts.push('---');
  parts.push('本文档的正文内容如下：');
  parts.push(content);
  parts.push('---');
  parts.push('');
  parts.push(`出题要求：`);

  if (config.singleCount > 0) {
    parts.push(`- 单选题 ${config.singleCount} 道`);
  }
  if (config.multipleCount > 0) {
    parts.push(`- 多选题 ${config.multipleCount} 道`);
  }
  if (config.trueFalseCount > 0) {
    parts.push(`- 判断题 ${config.trueFalseCount} 道`);
  }

  parts.push('');
  parts.push(`请按照 单选题 → 多选题 → 判断题 的顺序输出。`);

  return parts.join('\n');
}

/**
 * 解析 AI 返回的测试题 JSON
 */
export function parseQuizFromAiResponse(text: string): Array<{
  type: string;
  question: string;
  options: string[];
  answer: string[];
  explanation: string;
}> | null {
  // 清理不可见字符
  let cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/[\x00-\x08\x0B\u000B\u000C\x0E-\x1F]/g, '')
    .trim();

  const candidates: string[] = [];

  // 尝试从 code block 提取
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    candidates.push(codeBlockMatch[1].trim());
  }

  // 尝试从 [ ... ] 提取
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
      if (typeof parsed[0] !== 'object' || !parsed[0].question) continue;

      return parsed.map((q: Record<string, unknown>) => ({
        type: String(q.type || 'single'),
        question: String(q.question || ''),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        answer: Array.isArray(q.answer) ? q.answer.map(String) : [String(q.answer || '')],
        explanation: String(q.explanation || ''),
      }));
    } catch (e) {
      console.warn('[Quiz] 解析候选失败:', e instanceof Error ? e.message : e);
    }
  }

  console.error('[Quiz] 无法解析 AI 返回的测试题数据');
  return null;
}
