import { generateCheckId } from './types';
import type { CheckItem, RuleSet } from './types';

/**
 * 构造合规检查的 system prompt
 */
export function buildComplianceSystemPrompt(ruleSet: RuleSet): string {
  const ruleDesc: Record<string, string> = {
    academic: `你是一个学术论文审稿专家。请按以下维度检查：
- 结构完整性（标题、摘要、引言、方法、结果、讨论、结论、参考文献）
- 摘要规范（是否包含目的、方法、结果、结论四要素）
- 引用格式（是否规范、是否有未标注引用）
- 学术用语（是否使用了口语化表达、是否有主观断言缺乏依据）
- 图表引用（正文是否引用了所有图表）
- 逻辑连贯性（论证是否严密）`,
    official: `你是一个公文写作审核专家。请按以下维度检查：
- 格式规范（标题、主送机关、正文、落款、日期）
- 公文用语（是否使用了规范的公文用语，避免口语化）
- 签发要素（是否包含必要的签发信息）
- 行文逻辑（是否条理清晰、层次分明）
- 数据准确性（引用的数据是否标注来源）
- 政策合规（是否与现行政策法规一致）`,
    technical: `你是一个技术文档审核专家。请按以下维度检查：
- 术语一致性（同一概念是否使用了不同名称）
- 版本信息（是否标注了版本号、更新日期）
- 代码示例（代码是否有语法错误、是否有注释）
- 文档完整性（是否缺少必要章节如安装、配置、API 说明）
- 链接有效性（是否有可能失效的链接）
- 可操作性（步骤说明是否清晰可执行）`,
    general: `你是一个文字校对和写作质量审核专家。请按以下维度检查：
- 错别字和错误用词
- 语法和语病
- 标点符号使用
- 逻辑一致性（前后矛盾）
- 可读性（句子是否过长、段落是否过大）
- 表述准确性（是否有歧义）`,
    custom: `你是一个专业的文档审核专家。请根据用户提供的自定义规则进行检查。`,
  };

  return `${ruleDesc[ruleSet.key] || ruleDesc.general}

请严格按照以下 JSON 格式输出检查结果，不要输出任何其他解释文字：

\`\`\`json
[
  {
    "level": "error",
    "category": "检查维度",
    "description": "问题描述",
    "suggestion": "修改建议",
    "location": "问题所在位置（如：第2段、标题部分、引言章节）"
  }
]
\`\`\`

要求：
1. level 只能是 "pass"（通过）、"warning"（警告）、"error"（错误）之一
2. 对于通过的维度，也要输出 level 为 "pass" 的条目，description 说明该维度检查通过
3. category 是检查维度名称
4. description 简洁描述问题
5. suggestion 给出具体的修改建议
6. location 标注问题在文档中的大致位置
7. 按严重程度排序：error → warning → pass
8. 只输出 JSON 数组，不要输出其他任何文字`;
}

/**
 * 构造用户 prompt
 */
export function buildComplianceUserPrompt(content: string, ruleSet: RuleSet, customRules?: string): string {
  const parts: string[] = [];

  if (ruleSet.key === 'custom' && customRules) {
    parts.push(`请按照以下自定义规则检查文档：`);
    parts.push(customRules);
  } else {
    parts.push(`请按照「${ruleSet.label}」规范检查以下文档。`);
  }

  parts.push('');
  parts.push('---');
  parts.push('文档内容：');
  parts.push(content);
  parts.push('---');

  return parts.join('\n');
}

/**
 * 解析 AI 返回的检查结果
 */
export function parseComplianceFromAiResponse(text: string): CheckItem[] | null {
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
      if (typeof parsed[0] !== 'object' || !parsed[0].level) continue;

      return parsed.map((item: Record<string, unknown>) => ({
        id: generateCheckId(),
        level: (['pass', 'warning', 'error'].includes(String(item.level)) ? String(item.level) : 'warning') as CheckItem['level'],
        category: String(item.category || ''),
        description: String(item.description || ''),
        suggestion: String(item.suggestion || ''),
        location: item.location ? String(item.location) : undefined,
      }));
    } catch (e) {
      console.warn('[Compliance] 解析候选失败:', e instanceof Error ? e.message : e);
    }
  }

  console.error('[Compliance] 无法解析 AI 返回的检查数据');
  return null;
}
