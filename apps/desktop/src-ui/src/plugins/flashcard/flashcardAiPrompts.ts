import { generateCardId } from './types';
import type { Flashcard } from './types';

/**
 * 构造闪卡生成的 system prompt
 */
export function buildFlashcardSystemPrompt(): string {
  return `你是一个专业的教育专家，擅长从文档中提取关键知识点并制作记忆卡片。

请严格按照以下 JSON 格式输出，不要输出任何其他解释文字：

\`\`\`json
[
  {
    "type": "concept",
    "front": "概念/术语名称",
    "back": "详细定义和解释"
  },
  {
    "type": "qa",
    "front": "问题",
    "back": "答案"
  },
  {
    "type": "fill",
    "front": "_____ 是指某某概念（填空题，用下划线标记空白处）",
    "back": "正确答案"
  },
  {
    "type": "keyword",
    "front": "关键词/术语",
    "back": "简要解释和在文档中的意义"
  }
]
\`\`\`

要求：
1. type 只能是 "concept"（概念定义）、"qa"（问答对）、"fill"（填空题）、"keyword"（关键词）之一
2. front 是卡片正面（问题/概念/填空），back 是卡片背面（答案/定义/解释）
3. 每张卡片的 front 和 back 都要简洁明了，便于记忆
4. 卡片内容要紧扣文档核心知识点，覆盖重要概念
5. 混合使用不同类型的卡片，增加学习趣味性
6. 生成 15-25 张卡片，确保覆盖文档主要知识点
7. 只输出 JSON 数组，不要输出其他任何文字`;
}

/**
 * 构造用户 prompt
 */
export function buildFlashcardUserPrompt(content: string, customPrompt?: string): string {
  const parts: string[] = [];

  if (customPrompt && customPrompt.trim()) {
    parts.push(customPrompt);
    parts.push('');
  } else {
    parts.push('请从以下文档中提取关键知识点，生成记忆卡片。');
    parts.push('');
  }

  parts.push('---');
  parts.push('文档内容：');
  parts.push(content);
  parts.push('---');

  return parts.join('\n');
}

/**
 * 解析 AI 返回的闪卡数据
 */
export function parseFlashcardsFromAiResponse(text: string): Flashcard[] | null {
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
      if (typeof parsed[0] !== 'object' || !parsed[0].front) continue;

      return parsed.map((c: Record<string, unknown>) => ({
        id: generateCardId(),
        type: (['concept', 'qa', 'fill', 'keyword'].includes(String(c.type)) ? String(c.type) : 'qa') as Flashcard['type'],
        front: String(c.front || ''),
        back: String(c.back || ''),
        mastered: false,
      }));
    } catch (e) {
      console.warn('[Flashcard] 解析候选失败:', e instanceof Error ? e.message : e);
    }
  }

  console.error('[Flashcard] 无法解析 AI 返回的闪卡数据');
  return null;
}
