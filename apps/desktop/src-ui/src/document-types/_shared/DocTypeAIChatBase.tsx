/**
 * DocTypeAIChatBase — 文档类型 AI 侧栏统一聊天基础组件
 *
 * 提供完整的聊天框架能力，各文档类型通过 props 注入专业功能：
 * - headerSlot：快捷操作区（各类型自定义）
 * - emptyStateSlot：空状态占位
 * - messageActions：每条 AI 消息的自定义操作按钮
 *
 * 内置能力：
 * - Markdown 渲染（AI 回复）
 * - 流式输出 + 停止按钮
 * - 联网搜索 / 深度思考开关（根据模型能力自动显示）
 * - 复制按钮（内置）
 * - 对话历史 + 清空
 * - 自动滚动
 */
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Send, Square, Eraser, Globe, Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { getAIInvokeParams, type AIInvokeParams } from '@/stores/useSettingsStore';
import { getProviderConfig, type AIProvider } from '@aidocplus/shared-types';
import type { DocTypeHostAPI, DocTypeToolScope } from '@/doctype-sdk/types';
import type { Document } from '@aidocplus/shared-types';
import { DocTypeChatMessage, type DocTypeChatMsg } from './DocTypeChatMessage';
import {
  INPUT_AREA_CLASS, TEXTAREA_CLASS, MSG_LIST_CLASS,
  AI_OPTION_BTN_BASE, AI_OPTION_ACTIVE, AI_OPTION_THINKING_ACTIVE, AI_OPTION_INACTIVE,
} from './styles';

export interface DocTypeAIChatBaseProps {
  host: DocTypeHostAPI;
  document: Document;
  /** 快捷操作/工具栏区（各类型自定义，渲染在消息列表上方） */
  headerSlot?: ReactNode;
  /** 空状态占位（无消息时显示） */
  emptyStateSlot?: ReactNode;
  /** 每条 AI 消息的自定义操作按钮 */
  messageActions?: (msg: DocTypeChatMsg) => ReactNode;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 自定义 AI 服务参数（如使用文档类型特定的服务选择） */
  aiParams?: AIInvokeParams;
  /** 保留多少条历史消息（默认 6） */
  historyLimit?: number;
  /** 是否显示联网/深度思考开关（默认 true） */
  showAIOptions?: boolean;
  /** 默认开启联网搜索（默认 false） */
  defaultWebSearch?: boolean;
  /** 默认开启深度思考（默认 false） */
  defaultThinking?: boolean;
  /** AI 回复完成后的回调 */
  onAIResponse?: (content: string) => void;
  /** 输入框占位符 */
  placeholder?: string;
  /** 启用工具调用（Function Calling） */
  enableTools?: boolean;
  /** 工具作用域，默认 'all' */
  toolScope?: DocTypeToolScope;
  /** 流式输出累积文本变化（用于股票研究进度等） */
  onAssistantStreamUpdate?: (accumulatedText: string) => void;
}

export default function DocTypeAIChatBase({
  host,
  document: doc,
  headerSlot,
  emptyStateSlot,
  messageActions,
  systemPrompt,
  aiParams: aiParamsProp,
  historyLimit = 6,
  showAIOptions = true,
  defaultWebSearch = false,
  defaultThinking = false,
  onAIResponse,
  placeholder,
  enableTools = false,
  toolScope,
  onAssistantStreamUpdate,
}: DocTypeAIChatBaseProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<DocTypeChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');

  // AI 选项开关（支持默认值）
  const [enableWebSearch, setEnableWebSearch] = useState(defaultWebSearch);
  const [enableThinking, setEnableThinking] = useState(defaultThinking);

  // 当 props 变化时同步状态（用于文档切换时重置）
  useEffect(() => {
    setEnableWebSearch(defaultWebSearch);
    setEnableThinking(defaultThinking);
  }, [doc.id, defaultWebSearch, defaultThinking]);

  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRequestIdRef = useRef<string | null>(null);
  const userStoppedRef = useRef(false);

  // 检测当前模型能力（优先使用传入的 aiParams，否则回退到全局）
  const globalAiParams = getAIInvokeParams();
  const aiParams = aiParamsProp || globalAiParams;
  const providerConfig = aiParams.provider ? getProviderConfig(aiParams.provider as AIProvider) : null;
  const supportsWebSearch = providerConfig?.capabilities?.webSearch ?? false;
  const supportsThinking = providerConfig?.capabilities?.thinking ?? false;
  const supportsFunctionCalling = providerConfig?.capabilities?.functionCalling ?? false;

  // 自动滚动
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  // 文档切换时清空对话
  useEffect(() => {
    setMessages([]);
    setStreamContent('');
    setStreaming(false);
  }, [doc.id]);

  // AI 调用（流式）
  const callAI = useCallback(async (userPrompt: string, overrideSystemPrompt?: string, forceWebSearch?: boolean, overrideToolScope?: DocTypeToolScope) => {
    if (streaming) {
      return;
    }
    setStreaming(true);
    setStreamContent('');
    userStoppedRef.current = false;
    abortRef.current = new AbortController();
    streamRequestIdRef.current = null;

    try {
      const isAvailable = host.ai.isAvailable(aiParams.serviceId);

      if (!isAvailable) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: t('docTypeChat.noAIService', { defaultValue: '未配置 AI 服务，请先在设置中配置。' }),
        }]);
        window.dispatchEvent(new CustomEvent('doctype-ai-done', { detail: { documentId: doc.id, success: false } }));
        return;
      }

      const sys = overrideSystemPrompt || systemPrompt || '';
      const historyMsgs = messages.slice(-historyLimit).map(m => ({ role: m.role, content: m.content }));
      const allMsgs = [
        ...(sys ? [{ role: 'system' as const, content: sys }] : []),
        ...historyMsgs,
        { role: 'user' as const, content: userPrompt },
      ];

      // 如果强制联网搜索，优先使用；否则使用用户设置的开关
      const shouldUseWebSearch = forceWebSearch || (enableWebSearch && supportsWebSearch);

      const result = await host.ai.chatStream(allMsgs, (rawText) => {
        setStreamContent(rawText);
        onAssistantStreamUpdate?.(rawText);
      }, {
        serviceId: aiParams.serviceId,
        signal: abortRef.current.signal,
        enableWebSearch: shouldUseWebSearch ? true : undefined,
        enableThinking: enableThinking && supportsThinking ? true : undefined,
        enableTools: enableTools && supportsFunctionCalling ? true : undefined,
        toolScope: (overrideToolScope || toolScope) || undefined,
        onStreamRequestId: (id) => { streamRequestIdRef.current = id; },
      });
      setStreamContent('');
      if (!userStoppedRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', content: result }]);
      }
      userStoppedRef.current = false;
      onAIResponse?.(result);
      window.dispatchEvent(new CustomEvent('doctype-ai-done', { detail: { documentId: doc.id, success: true, result } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const aborted = msg === 'Request aborted';
      if (!aborted && !userStoppedRef.current) {
        console.error('[DocTypeAIChatBase] chatStream error:', err);
        const errorContent = streamContent || `${t('docTypeChat.error', { defaultValue: 'AI 调用失败' })}: ${msg}`;
        setMessages(prev => [...prev, { role: 'assistant', content: errorContent }]);
      }
      userStoppedRef.current = false;
      setStreamContent('');
      window.dispatchEvent(new CustomEvent('doctype-ai-done', { detail: { documentId: doc.id, success: false, error: err } }));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      streamRequestIdRef.current = null;
    }
  }, [streaming, messages, streamContent, host.ai, systemPrompt, historyLimit, enableWebSearch, enableThinking, supportsWebSearch, supportsThinking, onAIResponse, onAssistantStreamUpdate, t, aiParams, enableTools, supportsFunctionCalling, toolScope]);

  // 停止生成
  const handleStop = useCallback(() => {
    userStoppedRef.current = true;
    const rid = streamRequestIdRef.current;
    if (rid) {
      invoke('stop_ai_stream', { requestId: rid }).catch(() => {});
      streamRequestIdRef.current = null;
    }
    abortRef.current?.abort();
    if (streamContent) {
      setMessages(prev => [...prev, { role: 'assistant', content: streamContent }]);
      setStreamContent('');
    }
    setStreaming(false);
  }, [streamContent]);

  // 发送消息
  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    callAI(trimmed);
  }, [input, streaming, callAI]);

  // 清空对话
  const handleClear = useCallback(() => {
    setMessages([]);
    setStreamContent('');
  }, []);

  // 暴露 sendMessage 和 callAI 到外部（通过 ref 或 context）
  // 通过 window 事件让父组件可以触发发送
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId === doc.id && detail?.message) {
        const userMsg = detail.message as string;
        const label = detail.label as string | undefined;
        const forceWebSearch = detail.forceWebSearch as boolean | undefined;
        // 如果强制联网搜索，临时开启
        if (forceWebSearch && supportsWebSearch) {
          setEnableWebSearch(true);
        }
        
        const eventToolScope = detail.toolScope as DocTypeToolScope | undefined;
        setMessages(prev => [...prev, { role: 'user', content: label ? `[${label}]` : userMsg }]);
        callAI(detail.prompt || userMsg, detail.systemPrompt, forceWebSearch, eventToolScope);
      }
    };
    window.addEventListener('doctype-ai-send', handler);
    return () => window.removeEventListener('doctype-ai-send', handler);
  }, [doc.id, callAI, supportsWebSearch]);

  // 外部请求停止当前文档的 AI 流（如股票一键研究取消）
  useEffect(() => {
    const onStop = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId !== doc.id) return;
      if (!streaming) return;
      handleStop();
    };
    window.addEventListener('doctype-ai-stop', onStop);
    return () => window.removeEventListener('doctype-ai-stop', onStop);
  }, [doc.id, streaming, handleStop]);

  const defaultPlaceholder = placeholder || t('docTypeChat.placeholder', { defaultValue: '输入问题或指令...' });
  const toolsWantedButUnsupported = enableTools && !supportsFunctionCalling;

  return (
    <div className="h-full flex flex-col">
      {/* 快捷操作区（各类型自定义） */}
      {headerSlot}

      {toolsWantedButUnsupported && (
        <div className="mx-3 mt-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-100">
          {t('docTypeChat.toolsUnavailable', {
            defaultValue: '当前模型提供商标记为不支持函数调用，Tushare 等工具不会生效。请在设置中更换支持 Function Calling 的模型或服务。',
          })}
        </div>
      )}

      {/* 消息列表 */}
      <div className={cn('flex-1 overflow-auto p-3 min-h-0', MSG_LIST_CLASS)}>
        {messages.length === 0 && !streamContent && (
          emptyStateSlot || (
            <div className="text-center text-xs text-muted-foreground py-8">
              {t('docTypeChat.hint', { defaultValue: '输入问题或使用快捷操作，AI 为你服务' })}
            </div>
          )
        )}
        {messages.map((msg, i) => (
          <DocTypeChatMessage
            key={i}
            message={msg}
            actions={msg.role === 'assistant' ? messageActions?.(msg) : undefined}
          />
        ))}
        {streaming && !streamContent && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{t('docTypeChat.processing', { defaultValue: 'AI 正在处理...' })}</span>
          </div>
        )}
        {streamContent && (
          <DocTypeChatMessage
            message={{ role: 'assistant', content: streamContent }}
            isStreaming
          />
        )}
        <div ref={endRef} />
      </div>

      {/* 输入区 */}
      <div className={INPUT_AREA_CLASS}>
        <div className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (streaming) handleStop(); else handleSend();
              }
            }}
            placeholder={defaultPlaceholder}
            rows={2}
            className={TEXTAREA_CLASS}
            disabled={false}
          />
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={handleClear}
              disabled={messages.length === 0 && !streamContent}
              title={t('docTypeChat.clear', { defaultValue: '清空对话' })}
            >
              <Eraser className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon" className="h-7 w-7"
              onClick={streaming ? handleStop : handleSend}
              disabled={!streaming && !input.trim()}
              title={streaming ? t('docTypeChat.stop', { defaultValue: '停止生成' }) : t('docTypeChat.send', { defaultValue: '发送' })}
            >
              {streaming ? <Square className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* AI 选项开关 */}
        {showAIOptions && (supportsWebSearch || supportsThinking) && (
          <div className="flex items-center gap-1 flex-wrap">
            {supportsWebSearch && (
              <Button
                variant="ghost" size="sm"
                className={cn(AI_OPTION_BTN_BASE,
                  enableWebSearch ? AI_OPTION_ACTIVE : AI_OPTION_INACTIVE)}
                onClick={() => setEnableWebSearch(v => !v)}
                title={enableWebSearch
                  ? t('docTypeChat.webSearchOn', { defaultValue: '联网搜索：已开启' })
                  : t('docTypeChat.webSearchOff', { defaultValue: '联网搜索：已关闭' })}
              >
                <Globe className="h-3 w-3" />
                {t('chat.webSearch', { defaultValue: '联网' })}
              </Button>
            )}
            {supportsThinking && (
              <Button
                variant="ghost" size="sm"
                className={cn(AI_OPTION_BTN_BASE,
                  enableThinking ? AI_OPTION_THINKING_ACTIVE : AI_OPTION_INACTIVE)}
                onClick={() => setEnableThinking(v => !v)}
                title={enableThinking
                  ? t('docTypeChat.thinkingOn', { defaultValue: '深度思考：已开启' })
                  : t('docTypeChat.thinkingOff', { defaultValue: '深度思考：已关闭' })}
              >
                <Brain className="h-3 w-3" />
                {t('chat.thinking', { defaultValue: '深度思考' })}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 向 DocTypeAIChatBase 发送消息的辅助函数
 * 用于从编辑器或快捷操作按钮触发 AI 调用
 */
export function sendDocTypeAIMessage(opts: {
  documentId: string;
  message: string;
  prompt?: string;
  label?: string;
  systemPrompt?: string;
  forceWebSearch?: boolean;
  enableTools?: boolean;
  toolScope?: DocTypeToolScope;
}) {
  window.dispatchEvent(new CustomEvent('doctype-ai-send', { detail: opts }));
}
