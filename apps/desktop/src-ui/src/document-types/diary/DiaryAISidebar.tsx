/**
 * DiaryAISidebar — 日记专属 AI 助手面板（对照 NovelAISidebar 全面增强）
 *
 * - 多会话管理（新建/切换/删除，host.storage 持久化）
 * - 流式输出 + think 标签实时折叠 + Markdown 渲染
 * - 11 个日记快捷操作
 * - 上下文模式切换（当前/近7天/近30天）
 * - 消息操作（复制/重新生成/编辑用户消息/插入到日记）
 * - 系统提示词编辑面板
 * - 联网默认开启
 * - 心情预警
 * - AI 服务切换
 */
import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import {
  Send, Square, Trash2, Loader2, Copy, Check, ArrowDownToLine,
  ChevronDown, Globe, RefreshCw, Pencil,
  MessageSquarePlus, X, ScrollText, RotateCcw, BookHeart, Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { useTranslation } from '@/i18n';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, type AIProvider } from '@aidocplus/shared-types';
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
import { buildEmotionInsightPrompt } from './diaryAnalysis';
import { resolveTheme } from '@/components/chat/ChatMessage';
import { CollapsibleThinkingBlock } from '@/document-types/_shared/CollapsibleThinkingBlock';
import { DocTypeAIServiceMenu } from '@/document-types/_shared/DocTypeAIServiceMenu';
import { cn } from '@/lib/utils';
import {
  AI_OPTION_BTN_BASE, AI_OPTION_ACTIVE, AI_OPTION_THINKING_ACTIVE, AI_OPTION_INACTIVE,
  SIDEBAR_AI_HEADER_PANEL,
  SIDEBAR_AI_HEADER_ROW,
  SIDEBAR_AI_HEADER_SUBROW,
} from '@/document-types/_shared/styles';
import { genId } from './types';

// ═══════════════════════════════════════════════════════
// 消息 & 会话类型
// ═══════════════════════════════════════════════════════

interface DiaryAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
}

function genMsgId(): string {
  return genId('dmsg');
}

interface DiaryAISession {
  id: string;
  title: string;
  messages: DiaryAIMessage[];
  createdAt: number;
  updatedAt: number;
}

const SESSIONS_KEY = '_diary_ai_sessions';
const ACTIVE_SESSION_KEY = '_diary_ai_active_session';

function genSessionId(): string {
  return genId('dsess');
}

type StorageLike = { get<T>(key: string): T | null; set(key: string, value: unknown): void };

// ── 单条消息 memo 组件（避免长对话时全部重渲染） ──
interface DiaryMessageItemProps {
  msg: DiaryAIMessage;
  isEditing: boolean;
  editingContent: string;
  isCopied: boolean;
  theme: string;
  onCopyMsg: () => void;
  onStartEdit: () => void;
  onConfirmEdit: () => void;
  onRegenerate: () => void;
  onInsert: () => void;
  onSetEditingContent: (v: string) => void;
  onCancelEdit: () => void;
}

const DiaryMessageItem = memo(function DiaryMessageItem({
  msg, isEditing, editingContent, isCopied, theme,
  onCopyMsg, onStartEdit, onConfirmEdit, onRegenerate, onInsert, onSetEditingContent, onCancelEdit,
}: DiaryMessageItemProps) {
  const { t } = useTranslation();
  const parsed = msg.role === 'assistant' ? parseThinkTags(msg.content) : null;

  return (
    <div className={`group/msg flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
        msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
      } ${msg.isError ? 'border border-red-300' : ''}`}>
        {isEditing ? (
          <div className="space-y-2">
            <textarea className="w-full min-h-[60px] text-sm border rounded p-2 bg-background text-foreground resize-none"
              value={editingContent} onChange={e => onSetEditingContent(e.target.value)}
              placeholder={t('diary.aiEditPlaceholder', { defaultValue: '编辑消息内容...' })} />
            <div className="flex gap-1 justify-end">
              <Button size="sm" className="h-6 text-xs" onClick={onConfirmEdit}>{t('diary.aiSend', { defaultValue: '发送' })}</Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancelEdit}>{t('diary.aiCancel', { defaultValue: '取消' })}</Button>
            </div>
          </div>
        ) : (
          <>
            {msg.role === 'assistant' && parsed ? (
              <div className="space-y-2">
                {parsed.thinking && (
                  <CollapsibleThinkingBlock thinking={parsed.thinking} isThinking={false} theme={theme} />
                )}
                <MarkdownPreview content={parsed.content || msg.content} className="text-sm" />
              </div>
            ) : msg.role === 'assistant' ? (
              <MarkdownPreview content={msg.content} className="text-sm" />
            ) : (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            )}
            <div className="hidden group-hover/msg:flex items-center gap-0.5 mt-1">
              <button className="p-0.5 rounded hover:bg-accent" onClick={onCopyMsg}
                title={t('diary.copy', { defaultValue: '复制' })}>
                {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
              </button>
              {msg.role === 'user' && (
                <button className="p-0.5 rounded hover:bg-accent" onClick={onStartEdit}
                  title={t('diary.aiEditResend', { defaultValue: '编辑并重新发送' })}>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
              {msg.role === 'assistant' && !msg.isError && (
                <>
                  <button className="p-0.5 rounded hover:bg-accent" onClick={onRegenerate}
                    title={t('diary.aiRegenerate', { defaultValue: '重新生成' })}>
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button className="p-0.5 rounded hover:bg-accent" onClick={onInsert}
                    title={t('diary.insertToDiary', { defaultValue: '插入到日记' })}>
                    <ArrowDownToLine className="h-3 w-3 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

function loadSessions(storage: StorageLike): DiaryAISession[] {
  return storage.get<DiaryAISession[]>(SESSIONS_KEY) || [];
}

function saveSessions(storage: StorageLike, sessions: DiaryAISession[]) {
  storage.set(SESSIONS_KEY, sessions);
}

function createSession(): DiaryAISession {
  const now = Date.now();
  return { id: genSessionId(), title: '新对话', messages: [], createdAt: now, updatedAt: now };
}

function getOrCreateActiveSession(storage: StorageLike): DiaryAISession {
  const sessions = loadSessions(storage);
  const activeId = storage.get<string>(ACTIVE_SESSION_KEY) || '';
  const active = sessions.find(s => s.id === activeId);
  if (active) return active;
  const newSess = createSession();
  saveSessions(storage, [...sessions, newSess]);
  storage.set(ACTIVE_SESSION_KEY, newSess.id);
  return newSess;
}

// ═══════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════

interface DiaryAISidebarProps {
  host: DocTypeHostAPI;
  diary: DiaryDocumentContent;
  activeEntry: DiaryEntry | null;
  onInsertToDoc: (text: string) => void;
}

// ═══════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════

export default function DiaryAISidebar({
  host, diary, activeEntry, onInsertToDoc,
}: DiaryAISidebarProps) {
  const { t } = useTranslation();

  // ── AI 服务 ──
  const { services } = useSettingsStore(useShallow(s => ({
    services: s.ai.services,
  })));
  const enabledServices = useMemo(() => services.filter(sv => sv.enabled), [services]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() =>
    host.storage.get<string>('_diary_ai_service_id') || ''
  );
  const effectiveServiceId = selectedServiceId || undefined;
  const aiParams = getAIInvokeParamsForService(effectiveServiceId);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);
  const providerCaps = useMemo(() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider as AIProvider);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  }, [aiParams.provider]);

  // ── 会话管理 ──
  const [sessions, setSessions] = useState<DiaryAISession[]>(() => loadSessions(host.storage));
  const [activeSessionId, setActiveSessionId] = useState<string>(() => getOrCreateActiveSession(host.storage).id);
  const activeSession = useMemo(() =>
    sessions.find(s => s.id === activeSessionId) || (sessions.length > 0 ? sessions[0] : null),
  [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);

  // ── 对话状态 ──
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef('');
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(true); // 联网默认开启
  const [enableThinking, setEnableThinking] = useState(true);
  const [contextMode, setContextMode] = useState<DiaryContextMode>('current');

  // ── 消息编辑 ──
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // ── 系统提示词编辑 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const defaultPrompt = useMemo(() => buildDiarySystemPrompt(diary, activeEntry, contextMode), [diary, activeEntry, contextMode]);
  const [customPrompt, setCustomPrompt] = useState<string>(() =>
    host.storage.get<string>('_diary_ai_prompt') || ''
  );
  const [promptDraft, setPromptDraft] = useState(customPrompt || defaultPrompt);

  // ── 心情预警 ──
  const moodAlert = useMemo(() => detectMoodAlert(diary), [diary]);
  const contextSummary = useMemo(() => getContextSummary(diary, contextMode), [diary, contextMode]);

  // ── 持久化 ──
  const persistSessions = useCallback((updated: DiaryAISession[]) => {
    setSessions(updated);
    saveSessions(host.storage, updated);
  }, [host.storage]);

  const updateActiveSession = useCallback((updater: (s: DiaryAISession) => DiaryAISession) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? updater(s) : s);
      saveSessions(host.storage, updated);
      return updated;
    });
  }, [activeSessionId, host.storage]);

  // ── 新建/切换/删除会话 ──
  const handleNewSession = useCallback(() => {
    const newSess = createSession();
    persistSessions([...sessions, newSess]);
    setActiveSessionId(newSess.id);
    host.storage.set(ACTIVE_SESSION_KEY, newSess.id);
    setSessionMenuOpen(false);
  }, [sessions, persistSessions, host.storage]);

  const handleSwitchSession = useCallback((id: string) => {
    // 切换会话时中断正在进行的流式请求，避免消息写入错误的会话
    abortRef.current?.abort();
    setActiveSessionId(id);
    host.storage.set(ACTIVE_SESSION_KEY, id);
    setSessionMenuOpen(false);
  }, [host.storage]);

  const handleDeleteSession = useCallback((id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    if (updated.length === 0) {
      const newSess = createSession();
      persistSessions([newSess]);
      setActiveSessionId(newSess.id);
      host.storage.set(ACTIVE_SESSION_KEY, newSess.id);
    } else {
      persistSessions(updated);
      if (id === activeSessionId) {
        setActiveSessionId(updated[updated.length - 1].id);
        host.storage.set(ACTIVE_SESSION_KEY, updated[updated.length - 1].id);
      }
    }
  }, [sessions, activeSessionId, persistSessions, host.storage]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming || !aiAvailable) return;

    const userMsg: DiaryAIMessage = { id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now() };
    updateActiveSession(s => ({
      ...s,
      messages: [...s.messages, userMsg],
      updatedAt: Date.now(),
      title: s.messages.length === 0 ? userText.trim().slice(0, 30) : s.title,
    }));

    setInputValue('');
    setStreaming(true);
    setStreamingContent('');
    streamingContentRef.current = '';

    const systemPrompt = customPrompt || buildDiarySystemPrompt(diary, activeEntry, contextMode);
    const historyMsgs = [...messages, userMsg];
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...historyMsgs.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const controller = new AbortController();
    abortRef.current = controller;
    const sendingSessionId = activeSessionId;

    try {
      // DocTypeHost.chatStream 的 onChunk 参数为已累计的**全文**，非增量，禁止 += 拼接
      const full = await host.ai.chatStream(apiMessages, (cumulative: string) => {
        streamingContentRef.current = cumulative;
        setStreamingContent(cumulative);
      }, {
        signal: controller.signal,
        enableWebSearch: enableWebSearch && providerCaps.webSearch ? true : undefined,
        enableThinking: enableThinking && providerCaps.thinking ? true : undefined,
        serviceId: selectedServiceId || undefined,
      });

      const assistantMsg: DiaryAIMessage = { id: genMsgId(), role: 'assistant', content: full, timestamp: Date.now() };
      // 使用 saved sendingSessionId 确保即使中途切换了会话，消息仍写入正确的会话
      const finalSessionId = sendingSessionId;
      setSessions(prev => {
        const updated = prev.map(s => s.id === finalSessionId
          ? { ...s, messages: [...s.messages, assistantMsg], updatedAt: Date.now() }
          : s);
        saveSessions(host.storage, updated);
        return updated;
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        const partialContent = streamingContentRef.current;
        if (partialContent) {
          const finalSessionId = sendingSessionId;
          setSessions(prev => {
            const updated = prev.map(s => s.id === finalSessionId
              ? { ...s, messages: [...s.messages, { id: genMsgId(), role: 'assistant', content: partialContent, timestamp: Date.now() }], updatedAt: Date.now() }
              : s);
            saveSessions(host.storage, updated);
            return updated;
          });
        }
      } else {
        const errContent = formatBackendError(err);
        const finalSessionId = sendingSessionId;
        setSessions(prev => {
          const updated = prev.map(s => s.id === finalSessionId
            ? { ...s, messages: [...s.messages, { id: genMsgId(), role: 'assistant', content: `❌ ${errContent}`, timestamp: Date.now(), isError: true }], updatedAt: Date.now() }
            : s);
          saveSessions(host.storage, updated);
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [streaming, aiAvailable, customPrompt, diary, activeEntry, contextMode, messages, activeSessionId, enableWebSearch, enableThinking, providerCaps, host.ai, host.storage, selectedServiceId]);

  // 在 commit 阶段后更新 ref，确保 setTimeout 调用时拿到最新闭包
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // ── 停止 / 清空 ──
  const handleStop = useCallback(() => { abortRef.current?.abort(); }, []);
  const handleClear = useCallback(() => {
    updateActiveSession(s => ({ ...s, messages: [], updatedAt: Date.now() }));
  }, [updateActiveSession]);

  // ── 复制 / 重新生成 / 编辑 ──
  const handleCopyMsg = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleRegenerate = useCallback((msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx < 1) return;
    const userMsg = messages[idx - 1];
    if (userMsg.role !== 'user') return;
    updateActiveSession(s => ({ ...s, messages: s.messages.slice(0, idx - 1), updatedAt: Date.now() }));
    setTimeout(() => sendMessageRef.current(userMsg.content), 100);
  }, [messages, updateActiveSession]);

  const handleStartEdit = useCallback((msg: DiaryAIMessage) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (!editingMsgId || !editingContent.trim()) return;
    const idx = messages.findIndex(m => m.id === editingMsgId);
    if (idx < 0) return;
    updateActiveSession(s => ({ ...s, messages: s.messages.slice(0, idx), updatedAt: Date.now() }));
    setEditingMsgId(null);
    setTimeout(() => sendMessageRef.current(editingContent.trim()), 100);
  }, [editingMsgId, editingContent, messages, updateActiveSession]);

  const handleInsert = useCallback((content: string) => {
    const cleaned = content.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
    onInsertToDoc(cleaned);
  }, [onInsertToDoc]);

  // ── 快捷操作 ──
  const handleQuickAction = useCallback((promptTemplate: string) => {
    const content = activeEntry?.content || '';
    let prompt = promptTemplate.replace('{{content}}', content);
    // D1.2: 情绪洞察模板变量
    if (prompt.includes('{{emotionInsight}}')) {
      prompt = buildEmotionInsightPrompt(diary);
    }
    sendMessage(prompt);
  }, [activeEntry, diary, sendMessage]);

  // ── 智能滚动：检测用户是否手动上滚 ──
  const userScrolledUpRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
      userScrolledUpRef.current = !atBottom;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (scrollRef.current && !userScrolledUpRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // ── 推荐快捷操作（基于日记阶段） ──
  const recommendedActions = useMemo(() => {
    if (!activeEntry || !activeEntry.content) {
      // 空内容时不推荐续写，改为推荐写法灵感、提示和感恩
      return DIARY_QUICK_ACTIONS.filter(a => ['prompt', 'gratitude', 'reflect', 'insight'].includes(a.id)).slice(0, 4);
    }
    if (activeEntry.content.length < 100) {
      return DIARY_QUICK_ACTIONS.filter(a => ['continue', 'prompt', 'reflect'].includes(a.id)).slice(0, 4);
    }
    return DIARY_QUICK_ACTIONS.filter(a => ['reflect', 'polish', 'style', 'mood-review'].includes(a.id)).slice(0, 4);
  }, [activeEntry]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className={SIDEBAR_AI_HEADER_PANEL}>
        <div className={cn(SIDEBAR_AI_HEADER_ROW, 'gap-1.5')}>
          <BookHeart className="h-4 w-4 text-blue-500" />
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="text-sm font-medium truncate max-w-[140px] hover:text-blue-600 transition-colors flex items-center gap-0.5"
                title={t('diary.aiSwitchSession', { defaultValue: '切换对话' })}>
                {activeSession?.title || t('diary.aiTitle', { defaultValue: 'AI 日记助手' })}
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-card" align="start">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {sessions.map(sess => (
                  <div key={sess.id} className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent ${sess.id === activeSessionId ? 'bg-accent font-medium' : ''}`}>
                    <button className="flex-1 text-left truncate" onClick={() => handleSwitchSession(sess.id)}>
                      {sess.title} ({sess.messages.length})
                    </button>
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        className="opacity-50 hover:opacity-100 hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id); }}
                        title={t('common.delete', { defaultValue: '删除' })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t mt-1 pt-1">
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-sm gap-1" onClick={handleNewSession}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />{t('diary.aiNewSession', { defaultValue: '新建对话' })}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground">{contextSummary}</span>
          <Popover open={promptOpen} onOpenChange={setPromptOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${promptOpen ? 'text-blue-500' : ''}`}
                title={t('diary.aiSystemPrompt', { defaultValue: '系统提示词' })}>
                <ScrollText className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-card" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('diary.aiSystemPrompt', { defaultValue: '系统提示词' })}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPromptDraft(defaultPrompt)}>
                    <RotateCcw className="h-3 w-3 mr-1" />{t('diary.aiReset', { defaultValue: '重置' })}
                  </Button>
                </div>
                <textarea className="w-full h-32 text-xs border rounded-md p-2 resize-none bg-background"
                  value={promptDraft} onChange={e => setPromptDraft(e.target.value)}
                  placeholder={t('diary.aiPromptPlaceholder', { defaultValue: '输入自定义系统提示词...' })} />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                    setCustomPrompt(promptDraft);
                    host.storage.set('_diary_ai_prompt', promptDraft);
                    setPromptOpen(false);
                  }}>{t('diary.aiSave', { defaultValue: '保存' })}</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClear}
            title={t('diary.aiClearChat', { defaultValue: '清除对话' })}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className={SIDEBAR_AI_HEADER_SUBROW}>
        {/* 上下文模式切换 */}
        {(['current', 'week', 'month'] as DiaryContextMode[]).map(mode => (
          <button key={mode}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors border shrink-0 ${
              contextMode === mode
                ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400 dark:border-blue-400/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
            }`}
            onClick={() => setContextMode(mode)}>
            {mode === 'current' ? t('diary.ctxCurrent', { defaultValue: '当前' })
              : mode === 'week' ? t('diary.ctxWeek', { defaultValue: '近7天' })
              : t('diary.ctxMonth', { defaultValue: '近30天' })}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
        {/* 快捷操作下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1 shrink-0" disabled={streaming || !aiAvailable}>
              {t('diary.aiQuickActions', { defaultValue: '快捷操作' })}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[300px] overflow-auto bg-card">
            {DIARY_QUICK_ACTIONS.map(action => (
              <DropdownMenuItem key={action.id} className="text-xs cursor-pointer"
                onClick={() => handleQuickAction(action.promptTemplate)}>
                {t(action.labelKey, { defaultValue: action.labelDefault })}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* ── 心情预警 ── */}
      {moodAlert && (
        <div className="mx-2 mt-1 px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <span>💛</span>
          <span>{t('diary.moodAlertLow', { defaultValue: '近几天心情似乎不太好，需要和 AI 聊聊吗？' })}</span>
        </div>
      )}

      {/* ── 消息列表 ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <BookHeart className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">{t('diary.aiTitle', { defaultValue: 'AI 日记助手' })}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t('diary.aiEmptyDesc', { defaultValue: 'AI 会根据你的日记内容提供个性化帮助' })}</p>
            </div>
            {/* 建议操作 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">{t('diary.aiSuggestedActions', { defaultValue: '试试这些操作' })}</p>
              <div className="flex flex-wrap gap-1.5">
                {recommendedActions.map(action => (
                  <Button key={action.id} variant="outline" size="sm" className="h-7 text-xs justify-start"
                    onClick={() => handleQuickAction(action.promptTemplate)} disabled={streaming || !aiAvailable}>
                    <span className="truncate">{t(action.labelKey, { defaultValue: action.labelDefault })}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <DiaryMessageItem
            key={msg.id}
            msg={msg}
            isEditing={editingMsgId === msg.id}
            editingContent={editingContent}
            isCopied={copiedId === msg.id}
            theme={resolveTheme()}
            onCopyMsg={handleCopyMsg}
            onStartEdit={handleStartEdit}
            onConfirmEdit={handleConfirmEdit}
            onRegenerate={handleRegenerate}
            onInsert={handleInsert}
            onSetEditingContent={setEditingContent}
            onCancelEdit={() => setEditingMsgId(null)}
          />
        ))}

        {/* 流式输出（含 think 标签实时折叠） */}
        {streaming && streamingContent && (() => {
          const streamParsed = parseThinkTags(streamingContent);
          const hasThinking = !!streamParsed.thinking;
          const streamContent = streamParsed.content || streamingContent;
          return (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted text-sm space-y-2">
                {hasThinking && (
                  <CollapsibleThinkingBlock
                    thinking={streamParsed!.thinking}
                    isThinking={streamParsed!.isThinking}
                    theme={resolveTheme()}
                  />
                )}
                <MarkdownPreview content={streamContent} className="text-sm" />
              </div>
            </div>
          );
        })()}

        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-muted text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* ── 输入区 ── */}
      <div className="flex-shrink-0 border-t p-2 space-y-1.5">
        <textarea ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder={activeEntry
            ? t('diary.aiInputWithEntry', { defaultValue: '关于这篇日记问点什么...' })
            : t('diary.aiInputPlaceholder', { defaultValue: '输入问题或指令...' })}
          className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden"
          rows={2} disabled={streaming || !aiAvailable}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!streaming) sendMessage(inputValue); } }} />

        <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-1.5">
          <DocTypeAIServiceMenu
            enabledServices={enabledServices}
            value={aiParams.serviceId ?? ''}
            onChange={(id) => {
              setSelectedServiceId(id);
              host.storage.set('_diary_ai_service_id', id);
            }}
            disabled={streaming}
          />
          {providerCaps.webSearch && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                AI_OPTION_BTN_BASE,
                enableWebSearch ? AI_OPTION_ACTIVE : AI_OPTION_INACTIVE,
              )}
              onClick={() => setEnableWebSearch(v => !v)}
              disabled={streaming}
              title={enableWebSearch ? t('diary.webSearchOn', { defaultValue: '联网搜索：已开启' }) : t('diary.webSearchOff', { defaultValue: '联网搜索：已关闭' })}
            >
              <Globe className="h-3 w-3" />
              {t('chat.webSearch', { defaultValue: '联网' })}
            </Button>
          )}
          {providerCaps.thinking && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                AI_OPTION_BTN_BASE,
                enableThinking ? AI_OPTION_THINKING_ACTIVE : AI_OPTION_INACTIVE,
              )}
              onClick={() => setEnableThinking(v => !v)}
              disabled={streaming}
              title={enableThinking ? t('diary.deepThinkOn', { defaultValue: '深度思考：已开启' }) : t('diary.deepThinkOff', { defaultValue: '深度思考：已关闭' })}
            >
              <Brain className="h-3 w-3" />
              {t('chat.thinking', { defaultValue: '深度思考' })}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex-1" />
          {streaming ? (
            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleStop}
              title={t('diary.aiStop', { defaultValue: '停止生成' })}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="default" size="icon" className="h-7 w-7 flex-shrink-0 bg-blue-600 hover:bg-blue-700"
              onClick={() => sendMessage(inputValue)} disabled={!inputValue.trim() || !aiAvailable}
              title={t('diary.aiSend', { defaultValue: '发送' })}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
