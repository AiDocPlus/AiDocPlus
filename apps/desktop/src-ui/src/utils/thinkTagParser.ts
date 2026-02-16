/**
 * 解析 AI 回复中的 <think> 标签，将思考内容与正文内容分离。
 *
 * 支持场景：
 * - 完整的 <think>...</think> 标签对
 * - 流式传输中尚未闭合的 <think> 标签（内容仍在思考中）
 * - 多个 <think> 块
 * - 嵌套或不规范的标签
 */

export interface ThinkParseResult {
  /** 正文内容（去除了 <think> 部分） */
  content: string;
  /** 思考内容（<think> 标签内的文本） */
  thinking: string;
  /** 是否正在思考中（流式场景：<think> 已打开但尚未关闭） */
  isThinking: boolean;
}

/**
 * 从完整文本中分离 <think> 标签内容。
 * 适用于非流式场景或流式完成后的最终处理。
 */
export function parseThinkTags(text: string): ThinkParseResult {
  if (!text) return { content: '', thinking: '', isThinking: false };

  const thinkParts: string[] = [];
  let content = text;
  let isThinking = false;

  // 匹配所有完整的 <think>...</think> 块（支持跨行，非贪婪）
  const completePattern = /<think>([\s\S]*?)<\/think>/gi;
  content = content.replace(completePattern, (_match, thinkContent: string) => {
    thinkParts.push(thinkContent.trim());
    return '';
  });

  // 检查是否有未闭合的 <think>（流式场景）
  const unclosedPattern = /<think>([\s\S]*)$/i;
  const unclosedMatch = content.match(unclosedPattern);
  if (unclosedMatch) {
    thinkParts.push(unclosedMatch[1].trim());
    content = content.replace(unclosedPattern, '');
    isThinking = true;
  }

  // 清理正文中可能残留的空行
  content = content.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n');

  return {
    content,
    thinking: thinkParts.join('\n\n'),
    isThinking,
  };
}

