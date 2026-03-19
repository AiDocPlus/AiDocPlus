/**
 * DocTypeHostAPI 工厂 — 为文档类型编辑器构建平台宿主 API 实例
 */
import type { Document } from '@aidocplus/shared-types';
import type { DocTypeHostAPI, ChatMessage, AIOptions, AIStreamOptions } from './types';
import { DOCTYPE_SDK_VERSION } from './types';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore, getAIInvokeParams } from '@/stores/useSettingsStore';
import { useAppStore } from '@/stores/useAppStore';
import { parseThinkTags } from '@/utils/thinkTagParser';
import i18n from '@/i18n';

export interface CreateDocTypeHostOptions {
  docTypeId: string;
  documentId: string;
  tabId: string;
  /** 获取文档最新状态的引用函数 */
  getDocument: () => Document;
}

/**
 * 创建 DocTypeHostAPI 实例
 */
export function createDocTypeHost(opts: CreateDocTypeHostOptions): DocTypeHostAPI {
  const { docTypeId, documentId, tabId, getDocument } = opts;

  // ── 文档操作 ──
  const doc: DocTypeHostAPI['doc'] = {
    getDocument,
    updateInMemory(patch) {
      useAppStore.getState().updateDocumentInMemory(documentId, patch);
    },
    async save() {
      const latest = useAppStore.getState().documents.find(d => d.id === documentId);
      if (latest) {
        await useAppStore.getState().saveDocument(latest);
        useAppStore.getState().markTabAsClean(tabId);
      }
    },
    markDirty() {
      useAppStore.getState().markTabAsDirty(tabId);
    },
    markClean() {
      useAppStore.getState().markTabAsClean(tabId);
    },
    async createVersion(label) {
      const d = getDocument();
      await useAppStore.getState().createVersion(
        d.projectId, d.id, d.content || '', d.authorNotes || '',
        d.aiGeneratedContent || '', 'user', label || undefined,
        d.pluginData, d.enabledPlugins, d.composedContent,
      );
    },
  };

  // ── AI 服务 ──
  let lastThinking = '';

  const ai: DocTypeHostAPI['ai'] = {
    async chat(messages: ChatMessage[], options?: AIOptions) {
      const aiParams = getAIInvokeParams();
      if (!aiParams.provider) throw new Error('AI 服务未配置');
      const aiGlobal = useSettingsStore.getState().ai;
      const result = await invoke<string>('chat', {
        messages,
        ...aiParams,
        maxTokens: options?.maxTokens ?? aiGlobal.maxTokens ?? 4096,
      });
      const parsed = parseThinkTags(result);
      lastThinking = parsed.thinking;
      return parsed.content;
    },

    async chatStream(messages: ChatMessage[], onChunk: (text: string) => void, options?: AIStreamOptions) {
      const aiParams = getAIInvokeParams();
      if (!aiParams.provider) throw new Error('AI 服务未配置');
      const requestId = `doctype_${docTypeId}_${Date.now()}`;

      let rawAccumulated = '';
      let prevContentLen = 0;
      let unlisten: (() => void) | null = null;

      try {
        unlisten = await listen<{ request_id: string; content: string }>('ai:stream:chunk', (event) => {
          if (options?.signal?.aborted) return;
          if (event.payload.request_id !== requestId) return;
          rawAccumulated += event.payload.content;
          const parsed = parseThinkTags(rawAccumulated);
          if (parsed.thinking !== lastThinking) {
            lastThinking = parsed.thinking;
          }
          const currentLen = parsed.content.length;
          if (currentLen > prevContentLen) {
            onChunk(parsed.content.slice(prevContentLen));
            prevContentLen = currentLen;
          }
        });

        if (options?.signal?.aborted) throw new Error('Request aborted');

        // 直接调用 Rust chat_stream 命令，与主程序 sendChatMessage 一致
        await invoke<string>('chat_stream', {
          messages,
          provider: aiParams.provider,
          apiKey: aiParams.apiKey,
          model: aiParams.model,
          baseUrl: aiParams.baseUrl,
          serviceId: aiParams.serviceId,
          proxyUrl: aiParams.proxyUrl,
          connectTimeoutSecs: aiParams.connectTimeoutSecs,
          requestTimeoutSecs: aiParams.requestTimeoutSecs,
          enableWebSearch: options?.enableWebSearch || undefined,
          enableThinking: options?.enableThinking || undefined,
          requestId,
        });

        const finalParsed = parseThinkTags(rawAccumulated);
        lastThinking = finalParsed.thinking;
        return finalParsed.content;
      } finally {
        if (unlisten) unlisten();
      }
    },

    isAvailable() {
      const p = getAIInvokeParams();
      return !!(p.provider && p.apiKey && p.model);
    },
  };

  // ── UI 能力 ──
  const ui: DocTypeHostAPI['ui'] = {
    getTheme() {
      const theme = useSettingsStore.getState().ui?.theme || 'dark';
      if (theme === 'auto') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return theme as 'light' | 'dark';
    },
    getLocale() {
      return useSettingsStore.getState().ui?.language || 'zh';
    },
    t(key, params) {
      return i18n.t(key, params as Record<string, string>) as string;
    },
    async copyToClipboard(text) {
      await navigator.clipboard.writeText(text);
    },
    showNotification(msg, type) {
      // 简单实现：通过 console + 未来可扩展为 toast
      if (type === 'error') {
        console.error(`[${docTypeId}] ${msg}`);
      } else {
        console.log(`[${docTypeId}] ${msg}`);
      }
    },
  };

  // ── 存储 ──
  const storage: DocTypeHostAPI['storage'] = {
    get<T = unknown>(key: string): T | null {
      try {
        const raw = localStorage.getItem(`doctype:${docTypeId}:${key}`);
        return raw ? JSON.parse(raw) as T : null;
      } catch { return null; }
    },
    set(key, value) {
      localStorage.setItem(`doctype:${docTypeId}:${key}`, JSON.stringify(value));
    },
  };

  // ── 平台命令 ──
  const platform: DocTypeHostAPI['platform'] = {
    async invoke<T = unknown>(command: string, args?: Record<string, unknown>) {
      return invoke<T>(command, args);
    },
    on(event, callback) {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        callback(detail);
      };
      window.addEventListener(event, handler);
      return () => window.removeEventListener(event, handler);
    },
  };

  return {
    sdkVersion: DOCTYPE_SDK_VERSION,
    docTypeId,
    doc,
    ai,
    ui,
    storage,
    platform,
  };
}
