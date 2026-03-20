/**
 * DiaryAISidebar — 日记专属 AI 助手面板
 *
 * 参考 NovelAISidebar 架构：
 * - 会话管理（host.storage 持久化）
 * - 流式输出 + Markdown 渲染
 * - 8 个快捷操作
 * - 上下文模式切换
 * - "插入到日记"按钮
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Send, Square, Trash2, Copy, Check, ArrowDownToLine,
  Globe, Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { useTranslation } from '@/i18n';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig } from '@aidocplus/shared-types';
import { useShallow } from 'zustand/react/shallow';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { formatBackendError } from '@/lib/backendError';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { DiaryDocumentContent, DiaryEntry } from './types';
import {
  buildDiarySystemPrompt, getContextSummary,
  DIARY_QUICK_ACTIONS, detectMoodAlert,
  type DiaryContextMode,
} from './diaryContext';

// ── 消息类型 ──
interface DiaryAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
}

function genMsgId(): string {
  return `dmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Props ──
interface DiaryAISidebarProps {
  host: DocTypeHostAPI;
  diary: DiaryDocumentContent;
  activeEntry: DiaryEntry | null;
  onInsertToDoc: (text: string) => void;
}

export default function DiaryAISidebar({
  host, diary, activeEntry, onInsertToDoc,
}: DiaryAISidebarProps) {
  const { t } = useTranslation();

  // ── AI 服务 ──
  const { services, activeServiceId } = useSettingsStore(useShallow(s => ({
    services: s.ai.services,
    activeServiceId: s.ai.activeServiceId,
  })));
  const enabledServices = useMemo(() => services.filter(sv => sv.enabled), [services]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const effectiveServiceId = selectedServiceId || undefined;
  const aiParams = getAIInvokeParamsForService(effectiveServiceId);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);
  const providerCaps = (() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  })();

  // ── 对话状态（持久化） ──
  const STORAGE_KEY = '_diary_ai_messages';
  const [messages, setMessages] = useState<DiaryAIMessage[]>(() => {
    const saved = host.storage.get<DiaryAIMessage[]>(STORAGE_KEY);
    return Array.isArray(saved) ? saved.slice(-30) : []; // 最多恢30条
  });
  const moodAlert = useMemo(() => detectMoodAlert(diary), [diary]);
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [contextMode, setContextMode] = useState<DiaryContextMode>('current');

  // 消息持久化
  useEffect(() => {
    if (messages.length > 0) {
      host.storage.set(STORAGE_KEY, messages.slice(-30));
    }
  }, [messages, host.storage]);

  // 自动滚动
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming || !aiAvailable) return;

    const userMsg: DiaryAIMessage = { id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setStreaming(true);
    setStreamingContent('');

    const systemPrompt = buildDiarySystemPrompt(diary, activeEntry, contextMode);
    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userText.trim() },
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let full = '';
      streamingContentRef.current = '';
      await host.ai.chatStream(
        chatMessages,
        (chunk) => {
          full += chunk;
          streamingContentRef.current = full;
          setStreamingContent(full);
        },
        {
          signal: controller.signal,
          enableWebSearch,
          enableThinking,
          serviceId: selectedServiceId || undefined,
        },
      );

      const assistantMsg: DiaryAIMessage = { id: genMsgId(), role: 'assistant', content: full, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        const partialContent = streamingContentRef.current;
        if (partialContent) {
          setMessages(prev => [...prev, { id: genMsgId(), role: 'assistant', content: partialContent, timestamp: Date.now() }]);
        }
      } else {
        const errMsg = formatBackendError(err);
        setMessages(prev => [...prev, { id: genMsgId(), role: 'assistant', content: errMsg, timestamp: Date.now(), isError: true }]);
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [streaming, aiAvailable, diary, activeEntry, contextMode, messages, host.ai, enableWebSearch, enableThinking, selectedServiceId]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    host.storage.set(STORAGE_KEY, []);
  }, [host.storage]);

  const handleCopy = useCallback((id: string, content: string) => {
    host.ui.copyToClipboard(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, [host.ui]);

  const handleInsert = useCallback((content: string) => {
    // 去除 think 标签
    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    onInsertToDoc(cleaned);
  }, [onInsertToDoc]);

  // ── 快捷操作 ──
  const handleQuickAction = useCallback((promptTemplate: string) => {
    const content = activeEntry?.content || '';
    const prompt = promptTemplate.replace('{{content}}', content);
    sendMessage(prompt);
  }, [activeEntry, sendMessage]);

  const contextSummary = useMemo(() => getContextSummary(diary, contextMode), [diary, contextMode]);

  // ── 渲染消息 ──
  const renderMessage = (msg: DiaryAIMessage) => {
    if (msg.role === 'user') {
      return (
        <div key={msg.id} className="bg-primary/10 ml-8 rounded-lg p-3 text-sm">
          {msg.content}
        </div>
      );
    }

    const parsed = parseThinkTags(msg.content);
    return (
      <div key={msg.id} className={`bg-muted mr-2 rounded-lg p-3 text-sm ${msg.isError ? 'border border-red-300' : ''}`}>
        {parsed.thinking && (
          <details className="mb-2">
            <summary className="text-[11px] text-muted-foreground cursor-pointer">💭 {t('diary.aiThinking', { defaultValue: '思考过程' })}</summary>
            <div className="mt-1 text-xs text-muted-foreground/80 whitespace-pre-wrap">{parsed.thinking}</div>
          </details>
        )}
        <MarkdownPreview content={parsed.content || msg.content} />
        {/* 操作按钮 */}
        <div className="flex gap-2 mt-2 pt-1.5 border-t border-border/50">
          <button className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
            onClick={() => handleCopy(msg.id, parsed.content || msg.content)}>
            {copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedId === msg.id ? t('diary.copied', { defaultValue: '已复制' }) : t('diary.copy', { defaultValue: '复制' })}
          </button>
          <button className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
            onClick={() => handleInsert(msg.content)}>
            <ArrowDownToLine className="h-3 w-3" />
            {t('diary.insertToDiary', { defaultValue: '插入到日记' })}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* 头部：上下文模式 + 快捷操作 */}
      <div className="px-2 py-1.5 border-b flex-shrink-0 space-y-1">
        {/* 上下文模式切换 */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-muted-foreground">{t('diary.aiContext', { defaultValue: '上下文:' })}</span>
          {(['current', 'week', 'month'] as DiaryContextMode[]).map(mode => (
            <button key={mode}
              className={`px-1.5 py-0.5 rounded transition-colors ${contextMode === mode ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setContextMode(mode)}>
              {mode === 'current' ? t('diary.ctxCurrent', { defaultValue: '当前' })
                : mode === 'week' ? t('diary.ctxWeek', { defaultValue: '近7天' })
                : t('diary.ctxMonth', { defaultValue: '近30天' })}
            </button>
          ))}
          <span className="text-muted-foreground/50 ml-auto">{contextSummary}</span>
        </div>
        {/* 快捷操作 */}
        <div className="flex flex-wrap gap-1">
          {DIARY_QUICK_ACTIONS.map(action => (
            <button key={action.id}
              className="h-6 text-[11px] px-1.5 rounded border hover:bg-accent transition-colors flex items-center gap-0.5"
              onClick={() => handleQuickAction(action.promptTemplate)}
              disabled={streaming}
              title={action.label}>
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 心情预警 */}
      {moodAlert && (
        <div className="mx-2 mt-1 px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <span>💛</span>
          <span>{t('diary.moodAlertLow', { defaultValue: '近几天心情似乎不太好，需要和 AI 聊聊吗？' })}</span>
        </div>
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="text-center text-xs text-muted-foreground py-8 space-y-2">
            <span className="text-2xl">📖</span>
            <p>{t('diary.aiEmptyHint', { defaultValue: '使用上方快捷操作或输入问题' })}</p>
            <p className="text-muted-foreground/60">{t('diary.aiEmptyDesc', { defaultValue: 'AI 会根据你的日记内容提供个性化帮助' })}</p>
          </div>
        )}
        {messages.map(renderMessage)}
        {/* 流式输出 */}
        {streaming && streamingContent && (
          <div className="bg-muted mr-2 rounded-lg p-3 text-sm">
            <MarkdownPreview content={streamingContent} />
            <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5" />
          </div>
        )}
        {streaming && !streamingContent && (
          <div className="bg-muted mr-2 rounded-lg p-3 text-sm">
            <span className="text-muted-foreground animate-pulse">{t('diary.aiThinkingStatus', { defaultValue: '正在思考...' })}</span>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="flex-shrink-0 border-t p-2 space-y-1.5">
        {/* AI 选项 */}
        <div className="flex items-center gap-1">
          {/* AI 服务选择器（≥2 个启用服务时显示） */}
          {enabledServices.length >= 2 && (
            <select
              className="h-6 text-[11px] px-1 border rounded bg-background max-w-[100px] truncate"
              value={selectedServiceId || activeServiceId || ''}
              onChange={e => setSelectedServiceId(e.target.value)}
              title={t('diary.selectAiService', { defaultValue: '选择 AI 服务' })}
            >
              {enabledServices.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          {providerCaps.webSearch && (
            <button className={`h-6 px-1.5 text-[11px] gap-0.5 rounded flex items-center ${enableWebSearch ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
              onClick={() => setEnableWebSearch(!enableWebSearch)}>
              <Globe className="h-3 w-3" />
              {t('diary.webSearch', { defaultValue: '联网' })}
            </button>
          )}
          {providerCaps.thinking && (
            <button className={`h-6 px-1.5 text-[11px] gap-0.5 rounded flex items-center ${enableThinking ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}
              onClick={() => setEnableThinking(!enableThinking)}>
              <Brain className="h-3 w-3" />
              {t('diary.deepThink', { defaultValue: '深度思考' })}
            </button>
          )}
          <div className="flex-1" />
          <button className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            onClick={handleClear} disabled={messages.length === 0}>
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        {/* 输入框 */}
        <div className="flex items-end gap-1">
          <textarea
            ref={inputRef}
            className="flex-1 text-sm px-3 py-2 border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            rows={2}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputValue);
              }
            }}
            placeholder={t('diary.aiInputPlaceholder', { defaultValue: '输入问题或指令...' })}
            disabled={streaming}
          />
          {streaming ? (
            <Button variant="destructive" size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleStop}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="default" size="icon" className="h-9 w-9 flex-shrink-0"
              onClick={() => sendMessage(inputValue)} disabled={!inputValue.trim() || !aiAvailable}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
