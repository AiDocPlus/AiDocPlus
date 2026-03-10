import { invoke } from '@tauri-apps/api/core';

export async function stopAiStreamCommand(requestId?: string | null): Promise<void> {
  if (requestId) {
    await invoke('stop_ai_stream', { requestId });
    return;
  }
  await invoke('stop_ai_stream');
}

export async function chatStreamCommand(args: {
  messages: { role: string; content: string }[];
  model?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  enableWebSearch?: boolean;
  enableThinking?: boolean;
  enableTools?: boolean;
  requestId: string;
}): Promise<string> {
  return invoke<string>('chat_stream', args);
}

export async function generateContentCommand(args: {
  authorNotes: string;
  currentContent: string;
  model?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  return invoke<string>('generate_content', args);
}

export async function generateContentStreamCommand(args: {
  authorNotes: string;
  currentContent: string;
  model?: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  conversationHistory?: { role: string; content: string }[];
  systemPrompt?: string;
  enableWebSearch?: boolean;
  enableThinking?: boolean;
  requestId: string;
}): Promise<string> {
  return invoke<string>('generate_content_stream', args);
}
