/**
 * DocTypeHostAPI 工厂 — 为文档类型编辑器构建平台宿主 API 实例
 */
import type { Document } from '@aidocplus/shared-types';
import type { DocTypeHostAPI, ChatMessage, AIOptions, AIStreamOptions } from './types';
import { DOCTYPE_SDK_VERSION } from './types';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore, getAIInvokeParams, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { useAppStore } from '@/stores/useAppStore';
import { parseThinkTags } from '@/utils/thinkTagParser';
import i18n from '@/i18n';

/** 设置里 maxTokens=0 表示未配置；前端不透传，Rust 端按 provider 默认值注入。 */
function pickInvokeMaxTokens(explicit?: number, global?: number): number | undefined {
  const v = explicit ?? global;
  return typeof v === 'number' && v > 0 ? v : undefined;
}

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
    async saveAllDirtyTabs() {
      const tabsSnapshot = useAppStore.getState().tabs;
      for (const tab of tabsSnapshot) {
        if (!tab.isDirty) continue;
        const d = useAppStore.getState().documents.find(dd => dd.id === tab.documentId);
        if (d) {
          await useAppStore.getState().saveDocument(d);
          useAppStore.getState().markTabAsClean(tab.id);
        }
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
  const ai: DocTypeHostAPI['ai'] = {
    async chat(messages: ChatMessage[], options?: AIOptions) {
      const aiParams = options?.serviceId
        ? getAIInvokeParamsForService(options.serviceId)
        : getAIInvokeParams();
      if (!aiParams.provider) throw new Error('AI 服务未配置');
      const aiGlobal = useSettingsStore.getState().ai;
      const maxTok = pickInvokeMaxTokens(options?.maxTokens, aiGlobal.maxTokens);
      const result = await invoke<string>('chat', {
        messages,
        ...aiParams,
        ...(maxTok != null ? { maxTokens: maxTok } : {}),
      });
      const parsed = parseThinkTags(result);
      return parsed.content;
    },

    /**
     * 流式对话（SSE）。`onChunk` 每次传入的是**截至当前的完整累积字符串**（已拼接所有已收 chunk），
     * 不是单次事件的增量。调用方应 `setState(text)` 或直接赋值，禁止用 `acc += text`。
     */
    async chatStream(messages: ChatMessage[], onChunk: (text: string) => void, options?: AIStreamOptions) {
      const aiParams = options?.serviceId
        ? getAIInvokeParamsForService(options.serviceId)
        : getAIInvokeParams();
      if (!aiParams.provider) throw new Error('AI 服务未配置');
      const requestId = `doctype_${docTypeId}_${Date.now()}`;
      options?.onStreamRequestId?.(requestId);

      let rawAccumulated = '';
      let unlisten: (() => void) | null = null;

      try {
        unlisten = await listen<{ request_id: string; content: string }>('ai:stream:chunk', (event) => {
          if (options?.signal?.aborted) return;
          if (event.payload.request_id !== requestId) return;
          rawAccumulated += event.payload.content;
          // 回传原始累积文本（含 think 标签），让前端自己解析
          onChunk(rawAccumulated);
        });

        if (options?.signal?.aborted) throw new Error('Request aborted');

        // 直接调用 Rust chat_stream 命令，与主程序 sendChatMessage 一致
        const aiGlobal = useSettingsStore.getState().ai;
        const maxTok = pickInvokeMaxTokens(options?.maxTokens, aiGlobal.maxTokens);
        const serverFull = await invoke<string>('chat_stream', {
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
          enableTools: options?.enableTools || undefined,
          toolScope: options?.toolScope || undefined,
          ...(maxTok != null ? { maxTokens: maxTok } : {}),
          requestId,
        });

        // 优先使用服务端完整累积结果，防止 unlisten 时机导致最后 chunk 丢失
        // （深度思考场景下正文只有最后几个 chunk，JS 端 SSE 可能因 unlisten 漏收）
        const finalRaw = serverFull || rawAccumulated;

        // 返回原始文本，让调用方自己解析 think 标签
        return finalRaw;
      } catch (err) {
        console.error('[DocTypeHost] chat_stream error:', err);
        throw err;
      } finally {
        if (unlisten) unlisten();
      }
    },

    isAvailable(serviceId?: string) {
      const p = serviceId
        ? getAIInvokeParamsForService(serviceId)
        : getAIInvokeParams();
      return !!(p.provider && p.apiKey && p.model);
    },
  };

  // ── UI 能力 ──
  const ui: DocTypeHostAPI['ui'] = {
    getTheme() {
      const theme = useSettingsStore.getState().ui?.theme || 'light';
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
      if (type === 'error') {
        console.error(`[${docTypeId}] ${msg}`);
      }
      // info/success：预留 toast，避免生产环境 console.log
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
