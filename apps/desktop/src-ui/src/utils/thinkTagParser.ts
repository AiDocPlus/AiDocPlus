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

  const pushCompleteThink = (thinkContent: string) => {
    const t = thinkContent.trim();
    if (t) thinkParts.push(t);
  };

  // 匹配所有完整的 think 块（支持跨行，非贪婪）
  const completePattern = /<think>([\s\S]*?)<\/think>/gi;
  content = content.replace(completePattern, (_match, thinkContent: string) => {
    pushCompleteThink(thinkContent);
    return '';
  });

  // 兼容部分模型输出的 <thinking>...</thinking>（与 think 语义相同）
  const thinkingAliasPattern = new RegExp('\\u003Cthinking\\u003E([\\s\\S]*?)\\u003C\\/thinking\\u003E', 'gi');
  content = content.replace(thinkingAliasPattern, (_match, thinkContent: string) => {
    pushCompleteThink(thinkContent);
    return '';
  });

  // 检查是否有未闭合的 think（流式场景）
  const unclosedPattern = new RegExp('\\u003Cthink\\u003E([\\s\\S]*)$', 'i');
  const unclosedMatch = content.match(unclosedPattern);
  if (unclosedMatch) {
    thinkParts.push(unclosedMatch[1].trim());
    content = content.replace(unclosedPattern, '');
    isThinking = true;
  }

  // 未闭合的 thinking（流式）
  const unclosedThinkingPattern = new RegExp('\\u003Cthinking\\u003E([\\s\\S]*)$', 'i');
  const unclosedThinkingMatch = content.match(unclosedThinkingPattern);
  if (unclosedThinkingMatch) {
    thinkParts.push(unclosedThinkingMatch[1].trim());
    content = content.replace(unclosedThinkingPattern, '');
    isThinking = true;
  }

  // 过滤 AI 内部 XML 工具调用块，防止被 React/浏览器渲染为 HTML 标签
  // 1. minimax:tool_call 块（MiniMax 联网搜索内部格式）
  content = content.replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/gi, '');
  // 2. 未闭合的 minimax:tool_call（流式场景）
  content = content.replace(/<minimax:tool_call>[\s\S]*$/gi, '');
  // 3. invoke/parameter/tool_use 等 XML 工具调用块（Anthropic/Claude 格式泄漏）
  content = content.replace(/<invoke>[\s\S]*?<\/invoke>/gi, '');
  content = content.replace(/<parameter[\s\S]*?<\/parameter>/gi, '');
  content = content.replace(/<tool_use>[\s\S]*?<\/tool_use>/gi, '');
  // 4. 清理残留的孤立开/闭标签
  content = content.replace(/<\/?invoke>/gi, '');
  content = content.replace(/<\/?parameter[^>]*>/gi, '');

  // 清理正文中可能残留的空行
  content = content.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n');

  return {
    content,
    thinking: thinkParts.join('\n\n'),
    isThinking,
  };
}

/**
 * 将思考与正文按与 parseThinkTags 相同的标签格式写入 AIMessage.content，
 * 便于 ChatMessage 等统一解析并折叠展示（替代内联 Markdown 大段思考）。
 */
export function wrapThinkForChatMessage(
  thinking: string,
  body: string,
  isThinkingOpen: boolean,
): string {
  const t = thinking.trim();
  if (!t) return body;
  const open = '\u003Cthink\u003E';
  const close = '\u003C/think\u003E';
  if (isThinkingOpen) return `${open}${thinking}`;
  return `${open}${thinking}${close}\n\n${body}`;
}

