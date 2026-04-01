/**
 * Token 估算工具
 *
 * 基于字符的 token 估算（无需 tiktoken 等重量级库）。
 * 精度约 ±15%，足够用于滑动窗口截断和 UI 指示器。
 *
 * 估算规则：
 * - 英文/数字/标点：约 4 chars / token
 * - 中文/日文/韩文：约 1.5 chars / token
 * - 特殊 token（角色标记等）：每条消息额外 +4 tokens
 */

// ── 中日韩字符检测 ──

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\uff00-\uffef]/g;

/**
 * 估算单段文本的 token 数
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // 统计 CJK 字符数
  const cjkMatches = text.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const nonCjkCount = text.length - cjkCount;

  // CJK: ~1.5 chars/token, 非CJK: ~4 chars/token
  const cjkTokens = Math.ceil(cjkCount / 1.5);
  const nonCjkTokens = Math.ceil(nonCjkCount / 4);

  return cjkTokens + nonCjkTokens;
}

/**
 * 估算消息数组的总 token 数
 * 每条消息额外 +4 tokens（角色标记 + 格式开销）
 */
export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string; images?: { data: string; mimeType: string }[] }>
): number {
  const MESSAGE_OVERHEAD = 4; // 每条消息的固定开销
  const IMAGE_TOKEN_ESTIMATE = 170; // 保守估算每张图片的 token 开销（低分辨率~85，高分辨率~170-1105）
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content) + MESSAGE_OVERHEAD;
    if (msg.images && msg.images.length > 0) {
      total += msg.images.length * IMAGE_TOKEN_ESTIMATE;
    }
  }
  // 对话级开销（reply priming）
  total += 3;
  return total;
}

// ── 模型上下文窗口映射 ──

/**
 * 模型名 → 最大上下文 token 数
 * 模式匹配：精确匹配 > 前缀匹配 > provider 默认
 */
const MODEL_CONTEXT_MAP: Record<string, number> = {
  // OpenAI
  'gpt-4.1': 1048576,
  'gpt-4.1-mini': 1048576,
  'gpt-4.1-nano': 1048576,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'o1': 200000,
  'o1-mini': 128000,
  'o1-pro': 200000,
  'o3': 200000,
  'o3-mini': 200000,
  'o4-mini': 200000,

  // Anthropic
  'claude-opus-4-6': 200000,
  'claude-sonnet-4-6': 200000,
  'claude-3-7-sonnet': 200000,
  'claude-3-5-sonnet': 200000,
  'claude-3-5-haiku': 200000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,

  // Google Gemini
  'gemini-2.5-pro': 1048576,
  'gemini-2.5-flash': 1048576,
  'gemini-3-flash-preview': 1048576,
  'gemini-2.0-flash': 1048576,
  'gemini-1.5-pro': 2097152,
  'gemini-1.5-flash': 1048576,

  // xAI
  'grok-4-0709': 131072,
  'grok-3': 131072,
  'grok-3-mini': 131072,

  // DeepSeek
  'deepseek-chat': 65536,
  'deepseek-reasoner': 65536,

  // 通义千问
  'qwen3-max': 131072,
  'qwen3-plus': 131072,
  'qwen-max': 131072,
  'qwen-plus': 131072,
  'qwen-turbo': 131072,

  // 智谱 GLM
  'glm-5': 128000,
  'glm-4-plus': 128000,
  'glm-4': 128000,

  // MiniMax
  'MiniMax-M2.5': 1000000,
  'MiniMax-M1': 1000000,

  // Kimi（月之暗面）
  'kimi-k2.5': 131072,
  'moonshot-v1-128k': 131072,
  'moonshot-v1-32k': 32768,
  'moonshot-v1-8k': 8192,
  'kimi-for-coding': 131072,
};

/** Provider 级别的默认上下文窗口 */
const PROVIDER_CONTEXT_DEFAULTS: Record<string, number> = {
  openai: 128000,
  anthropic: 200000,
  gemini: 1048576,
  xai: 131072,
  deepseek: 65536,
  qwen: 131072,
  glm: 128000,
  'glm-code': 128000,
  minimax: 1000000,
  'minimax-code': 1000000,
  kimi: 131072,
  'kimi-code': 131072,
  litellm: 128000,
};

/** 全局回退值 */
const FALLBACK_CONTEXT_WINDOW = 128000;

/**
 * 获取模型的上下文窗口大小（token 数）
 *
 * @param model - 模型名称
 * @param provider - 提供商 ID（可选，用于回退）
 * @returns 最大上下文 token 数
 */
export function getModelContextWindow(model?: string, provider?: string): number {
  // 1. 精确匹配
  if (model && MODEL_CONTEXT_MAP[model]) {
    return MODEL_CONTEXT_MAP[model];
  }

  // 2. 前缀匹配（处理带日期后缀的模型名如 claude-3-5-sonnet-20241022）
  if (model) {
    for (const [key, value] of Object.entries(MODEL_CONTEXT_MAP)) {
      if (model.startsWith(key)) {
        return value;
      }
    }
  }

  // 3. Provider 默认
  if (provider && PROVIDER_CONTEXT_DEFAULTS[provider]) {
    return PROVIDER_CONTEXT_DEFAULTS[provider];
  }

  return FALLBACK_CONTEXT_WINDOW;
}

// ── 滑动窗口截断 ──

/** 预留给 AI 回复的 token 数 */
const RESERVE_FOR_RESPONSE = 4096;

export interface TruncationResult {
  /** 截断后的消息（用于发送给 AI） */
  messages: Array<{ role: string; content: string; images?: { data: string; mimeType: string }[] }>;
  /** 原始消息总 token 数 */
  totalTokens: number;
  /** 截断后实际使用的 token 数 */
  usedTokens: number;
  /** 模型上下文窗口大小 */
  contextWindow: number;
  /** 被截断（省略）的消息条数 */
  truncatedCount: number;
}

/**
 * 对消息数组进行滑动窗口截断
 *
 * 策略：
 * 1. system 消息始终保留（它们通常在最前面）
 * 2. 从最新消息往前保留，直到接近 token 上限
 * 3. 如果有消息被截断，在 system 消息和保留消息之间插入一条提示
 *
 * @param allMessages - 完整消息数组（含 system）
 * @param options - 配置项
 */
export function truncateMessages(
  allMessages: Array<{ role: string; content: string; images?: { data: string; mimeType: string }[] }>,
  options: {
    model?: string;
    provider?: string;
    maxContextTokens?: number; // 用户自定义上限（0=自动）
    maxContextMessages?: number; // 最大消息条数（0=不限）
    reserveForResponse?: number;
  } = {},
): TruncationResult {
  const contextWindow = options.maxContextTokens && options.maxContextTokens > 0
    ? options.maxContextTokens
    : getModelContextWindow(options.model, options.provider);

  const reserve = options.reserveForResponse ?? RESERVE_FOR_RESPONSE;
  const maxTokenBudget = contextWindow - reserve;
  const maxMessages = options.maxContextMessages && options.maxContextMessages > 0
    ? options.maxContextMessages
    : Infinity;

  const totalTokens = estimateMessagesTokens(allMessages);

  // 分离 system 消息和对话消息
  type Msg = { role: string; content: string; images?: { data: string; mimeType: string }[] };
  const systemMessages: Msg[] = [];
  const conversationMessages: Msg[] = [];

  for (const msg of allMessages) {
    if (msg.role === 'system') {
      systemMessages.push(msg);
    } else {
      conversationMessages.push(msg);
    }
  }

  // 计算 system 消息占用的 token
  const systemTokens = estimateMessagesTokens(systemMessages);
  const remainingBudget = Math.max(0, maxTokenBudget - systemTokens);

  // 从后往前保留消息，直到超出 token 预算或消息条数限制
  const IMAGE_TOKEN_ESTIMATE = 170;
  const keptMessages: Msg[] = [];
  let keptTokens = 0;
  let keptCount = 0;

  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    const imageTokens = (msg.images && msg.images.length > 0) ? msg.images.length * IMAGE_TOKEN_ESTIMATE : 0;
    const msgTokens = estimateTokens(msg.content) + 4 + imageTokens;

    if (keptTokens + msgTokens > remainingBudget) break;
    if (keptCount >= maxMessages) break;

    keptMessages.unshift(msg);
    keptTokens += msgTokens;
    keptCount++;
  }

  const truncatedCount = conversationMessages.length - keptMessages.length;

  // 组装最终消息
  const result: Array<{ role: string; content: string }> = [...systemMessages];

  if (truncatedCount > 0) {
    result.push({
      role: 'system',
      content: `[注意：为适应模型上下文窗口，前面 ${truncatedCount} 条对话消息已被省略。以下是最近的对话。]`,
    });
  }

  result.push(...keptMessages);

  const usedTokens = estimateMessagesTokens(result);

  return {
    messages: result,
    totalTokens,
    usedTokens,
    contextWindow,
    truncatedCount,
  };
}

/**
 * 格式化 token 数为人类可读字符串
 * 例如：1234 → "1.2K"，128000 → "128K"，1048576 → "1M"
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    const k = tokens / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return `${tokens}`;
}
