import { createContext, useContext } from 'react';
import type { Document } from '@aidocplus/shared-types';
import { getActiveRole } from '@aidocplus/shared-types';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save, open } from '@tauri-apps/plugin-dialog';
import { getAIInvokeParams, useSettingsStore } from '@/stores/useSettingsStore';
import { usePluginStorageStore } from '@/stores/usePluginStorageStore';
import { getFragmentsGroupedByPlugin } from '../fragments';
import { parseThinkTags } from '@/utils/thinkTagParser';
import i18next from 'i18next';

/** 为插件 AI 调用注入角色 system prompt */
function injectRolePrompt(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  const roleSettings = useSettingsStore.getState().role;
  const activeRole = getActiveRole(roleSettings);
  const rolePrompt = activeRole?.systemPrompt?.trim();
  if (!rolePrompt) return messages;
  // 如果第一条已经是 system 消息，将角色 prompt 拼在前面
  if (messages.length > 0 && messages[0].role === 'system') {
    return [
      { role: 'system', content: rolePrompt + '\n\n' + messages[0].content },
      ...messages.slice(1),
    ];
  }
  // 否则在最前面插入角色 system 消息
  return [{ role: 'system', content: rolePrompt }, ...messages];
}

// ============================================================
// SDK 版本号
// ============================================================

/** SDK 版本号，用于插件兼容性检查 */
export const SDK_VERSION = 1;

// ============================================================
// 命令权限白名单
// ============================================================

/**
 * 插件允许调用的后端命令白名单
 * 出于安全考虑，插件只能调用这些预先批准的命令
 */
const ALLOWED_PLUGIN_COMMANDS = new Set([
  // 文件操作（导出功能）
  'write_binary_file',      // 写入二进制文件
  'read_file_base64',       // 读取文件为 base64（附件处理）
  'get_temp_dir',           // 获取临时目录
  'open_file_with_app',     // 用系统应用打开文件（预览）

  // 邮件功能
  'test_smtp_connection',   // 测试 SMTP 连接
  'send_email',             // 发送邮件

  // Pandoc 导出功能
  'check_pandoc',           // 检测 Pandoc 是否安装及版本
  'pandoc_export',          // 调用 Pandoc 导出文档

  // 版本管理（版本时间线插件）
  'list_versions',          // 列出文档版本
  'get_version',            // 获取指定版本详情
]);

/**
 * 检查命令是否在白名单中
 */
function isCommandAllowed(command: string): boolean {
  return ALLOWED_PLUGIN_COMMANDS.has(command);
}

// ============================================================
// API 接口类型定义
// ============================================================

/** 内容访问 API */
export interface ContentAPI {
  /** 获取文档 Markdown 正文 */
  getDocumentContent(): string;
  /** 获取 AI 助手生成的内容 */
  getAIContent(): string;
  /** 获取合并区内容 */
  getComposedContent(): string;
  /** 获取其他插件的内容片段（按插件分组） */
  getPluginFragments(): Map<string, {
    pluginName: string;
    pluginIcon?: React.ComponentType<{ className?: string }>;
    fragments: Array<{ id: string; title: string; markdown: string }>;
  }>;
  /** 获取文档元信息（只读） */
  getDocumentMeta(): { id: string; title: string; projectId: string };
}

/** AI 服务 API */
export interface AIAPI {
  /** 单次 AI 对话（非流式），自动过滤 <think> 标签 */
  chat(messages: Array<{ role: string; content: string }>, options?: { maxTokens?: number }): Promise<string>;
  /**
   * 流式 AI 对话，自动过滤 <think> 标签
   * @param messages 消息列表
   * @param onChunk 每次收到正文内容块时的回调（不含 think 内容）
   * @param options 选项（支持 signal 用于取消）
   * @returns 完整的累积正文内容（不含 think 内容）
   */
  chatStream(
    messages: Array<{ role: string; content: string }>,
    onChunk: (text: string) => void,
    options?: { maxTokens?: number; signal?: AbortSignal }
  ): Promise<string>;
  /** AI 服务是否可用 */
  isAvailable(): boolean;
  /** 按用户设置截断内容 */
  truncateContent(text: string): string;
  /** 获取最近一次 AI 调用中的思考内容（<think> 标签内文本） */
  getLastThinking(): string;
}

/** 插件独立存储 API（按 pluginId 命名空间隔离） */
export interface StorageAPI {
  /** 读取插件数据 */
  get<T = unknown>(key: string): T | null;
  /** 写入插件数据 */
  set(key: string, value: unknown): void;
  /** 删除指定 key */
  remove(key: string): void;
  /** 清空该插件的所有存储 */
  clear(): void;
}

/** 文档数据 API（仅内容生成类插件使用） */
export interface DocDataAPI {
  /** 获取当前插件在文档中的数据 */
  getData(): unknown;
  /** 更新插件在文档中的数据 */
  setData(data: unknown): void;
  /** 标记文档为脏 */
  markDirty(): void;
  /** 请求立即保存文档 */
  requestSave(): void;
}

/** UI API */
export interface UIAPI {
  /** 显示状态消息 */
  showStatus(msg: string, isError?: boolean): void;
  /** 复制文本到剪贴板 */
  copyToClipboard(text: string): Promise<void>;
  /** 打开文件保存对话框 */
  showSaveDialog(opts: { defaultName: string; extensions: string[] }): Promise<string | null>;
  /** 打开文件选择对话框 */
  showOpenDialog(opts: { filters: Array<{ name: string; extensions: string[] }> }): Promise<string | null>;
  /** 获取当前语言 */
  getLocale(): string;
  /** 获取当前主题 */
  getTheme(): 'light' | 'dark';
}

// ============================================================
// 事件系统
// ============================================================

/**
 * 插件可监听的主程序事件类型
 */
export type PluginEvent =
  | 'document:saved'         // 文档已保存
  | 'document:changed'       // 文档内容变化
  | 'document:switched'      // 切换到不同文档
  | 'theme:changed'          // 主题切换
  | 'locale:changed'         // 语言切换
  | 'ai:generation-started'  // AI 开始生成
  | 'ai:generation-completed' // AI 生成完成
  | 'plugin:activated'       // 插件被激活
  | 'plugin:deactivated';    // 插件被停用

/** 事件数据类型映射 */
export interface PluginEventDataMap {
  'document:saved': { documentId: string };
  'document:changed': { documentId: string; content: string };
  'document:switched': { previousId: string | null; currentId: string };
  'theme:changed': { theme: 'light' | 'dark' };
  'locale:changed': { locale: string };
  'ai:generation-started': { documentId: string; type: 'chat' | 'content' };
  'ai:generation-completed': { documentId: string; type: 'chat' | 'content' };
  'plugin:activated': { pluginId: string };
  'plugin:deactivated': { pluginId: string };
}

/** 事件回调函数类型 */
export type PluginEventCallback<E extends PluginEvent> = (data: PluginEventDataMap[E]) => void;

/**
 * 事件订阅 API
 * 允许插件监听主程序事件
 */
export interface EventsAPI {
  /**
   * 订阅事件
   * @param event 事件名称
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  on<E extends PluginEvent>(event: E, callback: PluginEventCallback<E>): () => void;
  /**
   * 取消订阅
   * @param event 事件名称
   * @param callback 回调函数
   */
  off<E extends PluginEvent>(event: E, callback: PluginEventCallback<E>): void;
}

/**
 * 平台 API — 插件与主程序平台能力的桥梁
 * 插件不应直接 import @tauri-apps 或 @/stores，而是通过此 API 访问
 */
export interface PlatformAPI {
  /**
   * 调用后端命令（Tauri invoke 代理）
   * 插件不应直接 import { invoke } from '@tauri-apps/api/core'
   */
  invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
  /**
   * 查询主程序配置（只读快照）
   * 可用 section: 'email' | 'ai' | 'editor' | 'general'
   * 返回对应配置的只读副本，不存在时返回 null
   */
  getConfig<T = unknown>(section: string): T | null;
  /**
   * i18n 翻译函数
   * 插件不应直接 import { useTranslation } from '@/i18n'
   * @param key 翻译 key（支持命名空间前缀如 'plugin-email:title'）
   * @param params 插值参数
   */
  t(key: string, params?: Record<string, string | number>): string;
}

/** 主程序向插件提供的完整 API */
export interface PluginHostAPI {
  /** API 版本号 */
  apiVersion: 1;
  /** 当前插件 ID */
  pluginId: string;
  /** 内容访问 */
  content: ContentAPI;
  /** AI 服务 */
  ai: AIAPI;
  /** 插件独立持久化存储 */
  storage: StorageAPI;
  /** 文档数据（仅内容生成类，功能执行类为 null） */
  docData: DocDataAPI | null;
  /** UI 能力 */
  ui: UIAPI;
  /** 平台能力（invoke 代理、配置查询、i18n） */
  platform: PlatformAPI;
  /** 事件订阅 */
  events: EventsAPI;
}

// ============================================================
// React Context + Hook
// ============================================================

export const PluginHostContext = createContext<PluginHostAPI | null>(null);

/**
 * 思考内容 Context
 * 由 PluginHostProvider 提供，布局组件通过 useThinkingContent() 获取
 */
export const ThinkingContext = createContext<string>('');

/**
 * 获取当前 AI 思考内容
 * 布局组件（PluginPanelLayout / ToolPluginLayout）内部使用
 */
export function useThinkingContent(): string {
  return useContext(ThinkingContext);
}

/**
 * 插件内使用的 hook，获取主程序公共 API
 */
export function usePluginHost(): PluginHostAPI {
  const ctx = useContext(PluginHostContext);
  if (!ctx) {
    throw new Error('usePluginHost must be used within a PluginHostContext.Provider');
  }
  return ctx;
}

// ============================================================
// 工厂函数：由 PluginToolArea 调用，为每个插件构造 API 实例
// ============================================================

/**
 * 事件总线接口
 * 简单的发布/订阅模式实现
 */
export interface PluginEventBus {
  emit<E extends PluginEvent>(event: E, data: PluginEventDataMap[E]): void;
  on<E extends PluginEvent>(event: E, callback: PluginEventCallback<E>): () => void;
  off<E extends PluginEvent>(event: E, callback: PluginEventCallback<E>): void;
}

/**
 * 创建事件总线实例
 */
export function createPluginEventBus(): PluginEventBus {
  const listeners = new Map<PluginEvent, Set<Function>>();

  return {
    emit: (event, data) => {
      const callbacks = listeners.get(event);
      if (callbacks) {
        callbacks.forEach(cb => {
          try {
            cb(data);
          } catch (e) {
            console.error(`[PluginEventBus] Error in listener for "${event}":`, e);
          }
        });
      }
    },
    on: (event, callback) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
      // 返回取消订阅函数
      return () => {
        listeners.get(event)?.delete(callback);
      };
    },
    off: (event, callback) => {
      listeners.get(event)?.delete(callback);
    },
  };
}

export interface CreatePluginHostAPIOptions {
  pluginId: string;
  /** 当前文档（引用，由调用方保持最新） */
  getDocument: () => Document;
  /** AI 内容（content prop） */
  getAIContent: () => string;
  /** 合并区内容 */
  getComposedContent: () => string;
  /** 文档数据相关回调（仅内容生成类） */
  docDataCallbacks?: {
    getPluginData: () => unknown;
    setPluginData: (data: unknown) => void;
    markDirty: () => void;
    requestSave: () => void;
  };
  /** 状态消息回调 */
  showStatus: (msg: string, isError?: boolean) => void;
  /** 当前语言 */
  getLocale: () => string;
  /** 当前主题 */
  getTheme: () => 'light' | 'dark';
  /** i18n 命名空间（如 'plugin-email'） */
  i18nNamespace?: string;
  /** 事件总线实例（可选，用于插件间通信） */
  eventBus?: PluginEventBus;
  /** AI 思考内容更新回调（SDK 自动调用，宿主通过此回调更新 ThinkingContext） */
  onThinkingUpdate?: (thinking: string) => void;
}

export function createPluginHostAPI(opts: CreatePluginHostAPIOptions): PluginHostAPI {
  const { pluginId } = opts;

  // ── Content API ──
  const content: ContentAPI = {
    getDocumentContent: () => {
      const doc = opts.getDocument();
      return doc.content || '';
    },
    getAIContent: () => opts.getAIContent(),
    getComposedContent: () => opts.getComposedContent(),
    getPluginFragments: () => {
      const doc = opts.getDocument();
      return getFragmentsGroupedByPlugin(doc);
    },
    getDocumentMeta: () => {
      const doc = opts.getDocument();
      return { id: doc.id, title: doc.title, projectId: doc.projectId || '' };
    },
  };

  // ── AI API ──
  let lastThinking = '';

  const ai: AIAPI = {
    chat: async (messages, options) => {
      const aiParams = getAIInvokeParams();
      // 通知宿主：开始新的 AI 调用，清空思考内容
      lastThinking = '';
      opts.onThinkingUpdate?.('');

      const rawResult = await invoke<string>('chat', {
        messages: injectRolePrompt(messages),
        ...aiParams,
        maxTokens: options?.maxTokens ?? 4096,
      });

      // 自动过滤 <think> 标签
      const parsed = parseThinkTags(rawResult);
      lastThinking = parsed.thinking;
      if (parsed.thinking) {
        opts.onThinkingUpdate?.(parsed.thinking);
      }
      return parsed.content;
    },
    chatStream: async (messages, onChunk, options) => {
      const aiParams = getAIInvokeParams();
      const requestId = `plugin_${pluginId}_${Date.now()}`;

      // 通知宿主：开始新的 AI 调用，清空思考内容
      lastThinking = '';
      opts.onThinkingUpdate?.('');

      // 检查是否已取消
      if (options?.signal?.aborted) {
        throw new Error('Request aborted');
      }

      // 累积流式原始内容（含 think 标签）
      let rawAccumulated = '';
      // 上一次解析后的正文长度，用于计算增量
      let prevContentLen = 0;
      let unlisten: (() => void) | null = null;

      try {
        // 设置流式事件监听
        unlisten = await listen<{ request_id: string; content: string }>('ai:stream:chunk', (event) => {
          // 检查是否已取消
          if (options?.signal?.aborted) return;
          // 只处理当前请求的事件
          if (event.payload.request_id !== requestId) return;

          const chunk = event.payload.content;
          rawAccumulated += chunk;

          // 实时解析 <think> 标签
          const parsed = parseThinkTags(rawAccumulated);

          // 更新思考内容
          if (parsed.thinking !== lastThinking) {
            lastThinking = parsed.thinking;
            opts.onThinkingUpdate?.(parsed.thinking);
          }

          // 只将正文增量传给插件的 onChunk
          const currentContentLen = parsed.content.length;
          if (currentContentLen > prevContentLen) {
            const contentDelta = parsed.content.slice(prevContentLen);
            prevContentLen = currentContentLen;
            onChunk(contentDelta);
          }
        });

        // 如果在设置监听期间已取消
        if (options?.signal?.aborted) {
          throw new Error('Request aborted');
        }

        // 调用后端流式接口
        await invoke<string>('chat_stream', {
          messages: injectRolePrompt(messages),
          ...aiParams,
          maxTokens: options?.maxTokens ?? 4096,
          requestId,
        });

        // 最终解析
        const finalParsed = parseThinkTags(rawAccumulated);
        lastThinking = finalParsed.thinking;
        if (finalParsed.thinking) {
          opts.onThinkingUpdate?.(finalParsed.thinking);
        }
        return finalParsed.content;
      } finally {
        if (unlisten) {
          unlisten();
        }
      }
    },
    isAvailable: () => {
      const aiParams = getAIInvokeParams();
      return !!(aiParams.provider && aiParams.apiKey && aiParams.model);
    },
    truncateContent: (text: string) => {
      const maxLen = useSettingsStore.getState().ai?.maxContentLength || 0;
      if (maxLen > 0 && text.length > maxLen) {
        return text.slice(0, maxLen) + '\n\n[内容已截断]';
      }
      return text;
    },
    getLastThinking: () => lastThinking,
  };

  // ── Storage API ──
  const storage: StorageAPI = {
    get: <T = unknown>(key: string): T | null => {
      return usePluginStorageStore.getState().getPluginData<T>(pluginId, key);
    },
    set: (key: string, value: unknown) => {
      usePluginStorageStore.getState().setPluginData(pluginId, key, value);
    },
    remove: (key: string) => {
      usePluginStorageStore.getState().removePluginData(pluginId, key);
    },
    clear: () => {
      usePluginStorageStore.getState().clearPluginData(pluginId);
    },
  };

  // ── DocData API ──
  const docData: DocDataAPI | null = opts.docDataCallbacks
    ? {
        getData: opts.docDataCallbacks.getPluginData,
        setData: opts.docDataCallbacks.setPluginData,
        markDirty: opts.docDataCallbacks.markDirty,
        requestSave: opts.docDataCallbacks.requestSave,
      }
    : null;

  // ── UI API ──
  const ui: UIAPI = {
    showStatus: opts.showStatus,
    copyToClipboard: async (text: string) => {
      await navigator.clipboard.writeText(text);
    },
    showSaveDialog: async (dialogOpts) => {
      const result = await save({
        defaultPath: dialogOpts.defaultName,
        filters: [{ name: '文件', extensions: dialogOpts.extensions }],
      });
      return result || null;
    },
    showOpenDialog: async (dialogOpts) => {
      const result = await open({
        multiple: false,
        filters: dialogOpts.filters,
      });
      if (!result || typeof result !== 'string') return null;
      return result;
    },
    getLocale: opts.getLocale,
    getTheme: opts.getTheme,
  };

  // ── Platform API ──
  const platform: PlatformAPI = {
    invoke: async <T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> => {
      // 安全校验：只允许调用白名单内的命令
      if (!isCommandAllowed(command)) {
        throw new Error(
          `Plugin "${pluginId}" is not allowed to invoke command "${command}". ` +
          `Allowed commands: ${Array.from(ALLOWED_PLUGIN_COMMANDS).join(', ')}`
        );
      }
      return invoke<T>(command, args);
    },
    getConfig: <T = unknown>(section: string): T | null => {
      const settings = useSettingsStore.getState();
      const sectionData = (settings as unknown as Record<string, unknown>)[section];
      if (sectionData == null) return null;
      // 返回深拷贝（只读快照）
      try {
        return JSON.parse(JSON.stringify(sectionData)) as T;
      } catch {
        return sectionData as T;
      }
    },
    t: (key: string, params?: Record<string, string | number>): string => {
      // 支持带命名空间前缀的 key（如 'plugin-email:title'）
      let result: string;
      if (key.includes(':')) {
        const [ns, ...rest] = key.split(':');
        const actualKey = rest.join(':');
        result = String(i18next.t(actualKey, { ns, ...params }));
      } else if (opts.i18nNamespace) {
        // 不带前缀的 key，自动使用插件的命名空间
        result = String(i18next.t(key, { ns: opts.i18nNamespace, ...params }));
      } else {
        result = String(i18next.t(key, params as Record<string, string>));
      }
      return result;
    },
  };

  // ── Events API ──
  // 如果提供了 eventBus，使用它；否则创建一个空实现
  const eventBus = opts.eventBus;
  const events: EventsAPI = eventBus
    ? {
        on: (event, callback) => eventBus.on(event, callback),
        off: (event, callback) => eventBus.off(event, callback),
      }
    : {
        // 无事件总线时的空实现
        on: () => () => { },
        off: () => { },
      };

  return {
    apiVersion: 1,
    pluginId,
    content,
    ai,
    storage,
    docData,
    ui,
    platform,
    events,
  };
}

// 导出白名单供测试和调试使用
export { ALLOWED_PLUGIN_COMMANDS, isCommandAllowed };
