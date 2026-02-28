/**
 * 插件 AI 助手聊天引擎
 *
 * 通过 PluginHostAPI.ai 实现流式对话，供 PluginAssistantPanel 使用。
 * 参照 CodingAssistantPanel 的 codingAI.ts 设计，但使用插件框架的 AI API。
 */

import type { PluginHostAPI } from './PluginHostAPI';
import type { PluginAssistantConfig, PluginQuickAction } from '../types';
import type { Document } from '@aidocplus/shared-types';

// ── 消息类型 ──

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

let _nextMsgId = 1;
export function genMsgId(): string {
  return `pamsg_${Date.now()}_${_nextMsgId++}`;
}

// ── 上下文构建 ──

/**
 * 构建发送给 AI 的完整消息列表
 */
export function buildAssistantMessages(
  history: AssistantMessage[],
  config: PluginAssistantConfig,
  context: {
    document: Document;
    pluginData: unknown;
    aiContent: string;
    customSystemPrompt?: string;
  },
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // 系统提示词
  let systemContent = (context.customSystemPrompt?.trim()) || config.defaultSystemPrompt;

  // 追加插件上下文
  if (config.buildContext) {
    const ctx = config.buildContext(context.document, context.pluginData, context.aiContent);
    if (ctx) {
      systemContent += '\n\n--- 当前上下文 ---\n' + ctx;
    }
  }

  messages.push({ role: 'system', content: systemContent });

  // 对话历史（最多保留最近 20 条）
  const recent = history.filter(m => m.role !== 'system').slice(-20);
  for (const msg of recent) {
    messages.push({ role: msg.role, content: msg.content });
  }

  return messages;
}

// ── 流式对话 ──

/**
 * 通过 PluginHostAPI.ai.chatStream 进行流式对话
 */
export async function chatWithPluginAssistant(
  host: PluginHostAPI,
  messages: Array<{ role: string; content: string }>,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
  serviceId?: string,
): Promise<string> {
  return host.ai.chatStream(messages, onChunk, { signal, serviceId });
}

// ── 导出对话为 Markdown ──

export function exportChatAsMarkdown(
  messages: AssistantMessage[],
  pluginName: string,
): string {
  const lines = messages.map(m => {
    const role = m.role === 'user' ? '👤 用户' : m.role === 'assistant' ? '🤖 助手' : '⚙ 系统';
    return `### ${role}\n\n${m.content}\n`;
  });
  return `# ${pluginName} - AI 对话记录\n\n${lines.join('\n---\n\n')}`;
}

// ── 快捷操作工具 ──

/** 获取默认快捷操作（当插件未定义时使用） */
export function getDefaultQuickActions(pluginName: string): PluginQuickAction[] {
  return [
    {
      id: 'help',
      icon: 'HelpCircle',
      label: '使用帮助',
      buildPrompt: () => `请介绍「${pluginName}」的主要功能和使用方法。`,
    },
    {
      id: 'optimize',
      icon: 'Sparkles',
      label: '优化建议',
      buildPrompt: ({ aiContent }) => {
        const content = aiContent ? `\n\n当前正文内容（截取前2000字）：\n${aiContent.slice(0, 2000)}` : '';
        return `请针对当前文档内容，给出与「${pluginName}」功能相关的优化建议。${content}`;
      },
    },
  ];
}
