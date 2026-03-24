import type { AIMessage, ChatContextMode, Document, EditorTab } from '@aidocplus/shared-types';
import type { DocTypeToolScope } from '@/doctype-sdk/types';
import { getAIInvokeParamsForService } from './useSettingsStore';

export interface ChatContextInfo {
  mode: ChatContextMode;
  content: string;
}

/** sendChatMessage 的选项参数（将原7+参数收敛为对象） */
export interface ChatMessageOptions {
  tabId: string;
  content: string;
  enableWebSearch?: boolean;
  contextInfo?: ChatContextInfo;
  enableTools?: boolean;
  /** 工具作用域，默认 'all' */
  toolScope?: DocTypeToolScope;
  enableThinking?: boolean;
  planMode?: boolean;
  images?: import('@aidocplus/shared-types').ChatImage[];
}

export interface AiSettingsPromptInput {
  systemPrompt?: string;
  markdownMode?: boolean;
  enableThinking?: boolean;
}

export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function resolveAiParamsForTab(
  tabs: EditorTab[],
  documents: Document[],
  tabId: string | null | undefined,
) {
  const currentTab = tabId ? tabs.find(tab => tab.id === tabId) : undefined;
  const currentDoc = currentTab ? documents.find(doc => doc.id === currentTab.documentId) : undefined;
  return getAIInvokeParamsForService(currentDoc?.aiServiceId);
}

export function buildCombinedSystemPrompt(parts: Array<string | null | undefined>): string | undefined {
  const combined = parts.map(part => part?.trim()).filter(Boolean).join('\n\n');
  return combined || undefined;
}

export function buildChatMessages(args: {
  tabMessages: AIMessage[];
  aiSettings: AiSettingsPromptInput;
  markdownModePrompt: string;
  planMode?: boolean;
  contextInfo?: ChatContextInfo;
  t: TranslateFn;
}): {
  assistantContextMode: ChatContextMode | undefined;
  messages: { role: string; content: string }[];
} {
  const { tabMessages, aiSettings, markdownModePrompt, planMode, contextInfo, t } = args;
  const messages: { role: string; content: string }[] = [];

  const userSystemPrompt = aiSettings.systemPrompt?.trim() || '';
  const mdPrompt = aiSettings.markdownMode ? markdownModePrompt : '';
  const planPrompt = planMode
    ? '\n\n【计划模式】\n- 将任务分解为清晰的编号步骤（1. 2. 3. ...）\n- 每步说明目标和预期结果\n- 给出整体思路和建议\n- 不要直接给最终内容，先给出规划'
    : '';
  const combinedSystemPrompt = buildCombinedSystemPrompt([userSystemPrompt, mdPrompt, planPrompt]);

  if (combinedSystemPrompt) {
    messages.push({ role: 'system', content: combinedSystemPrompt });
  }

  if (contextInfo && contextInfo.mode !== 'none' && contextInfo.content?.trim()) {
    const contextLabels: Record<string, string> = {
      material: t('store.contextMaterial'),
      prompt: t('store.contextPrompt'),
      generated: t('store.contextGenerated'),
    };
    const label = contextLabels[contextInfo.mode] || t('store.contextDefault');
    messages.push({
      role: 'system',
      content: t('store.contextUserLabel', { label }) + `\n\n${contextInfo.content}`,
    });
  }

  messages.push(...tabMessages.map(message => ({
    role: message.role,
    content: message.content,
  })));

  return {
    assistantContextMode: contextInfo?.mode && contextInfo.mode !== 'none' ? contextInfo.mode : undefined,
    messages,
  };
}

export function toBackendConversationHistory(conversationHistory?: AIMessage[]) {
  return conversationHistory?.map(message => ({
    role: message.role,
    content: message.content,
  }));
}
