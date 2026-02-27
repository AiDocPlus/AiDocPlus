import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AIServiceConfig } from '@aidocplus/manager-shared';

/**
 * 加载 AI 配置
 */
export async function loadAIConfig(): Promise<AIServiceConfig> {
  return await invoke<AIServiceConfig>('cmd_load_ai_config');
}

/**
 * 保存 AI 配置
 */
export async function saveAIConfig(config: AIServiceConfig): Promise<void> {
  await invoke('cmd_save_ai_config', { config });
}

/**
 * AI 生成资源（非流式）
 */
export async function aiGenerate(
  config: AIServiceConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return await invoke<string>('cmd_ai_generate', {
    config,
    systemPrompt,
    userPrompt,
  });
}

/**
 * AI 生成资源（流式）
 */
export async function aiGenerateStream(
  config: AIServiceConfig,
  systemPrompt: string,
  userPrompt: string,
  onDelta: (delta: string) => void,
  onDone: (fullContent: string) => void,
  onError?: (error: string) => void
): Promise<() => void> {
  // 监听流式事件
  const unlisten = await listen<{ type: string; content: string }>(
    'ai-generate-stream',
    (event) => {
      if (event.payload.type === 'delta') {
        onDelta(event.payload.content);
      } else if (event.payload.type === 'done') {
        onDone(event.payload.content);
      }
    }
  );

  // 触发生成
  invoke('cmd_ai_generate_stream', {
    config,
    systemPrompt,
    userPrompt,
  }).catch((e) => {
    console.error('AI 流式生成失败:', e);
    onError?.(String(e));
  });

  return unlisten;
}
