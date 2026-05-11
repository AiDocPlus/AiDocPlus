/**
 * 仿写 AI 助手侧栏 — 全面升级版
 * - 多会话管理（host.storage 持久化）
 * - 流式输出 + think 标签折叠
 * - ⌘K 命令面板（30+ 快捷操作，含搜索/收藏/最近使用）
 * - 消息编辑 & 重新生成
 * - 动态建议芯片 + 写作阶段指示
 * - 自定义系统提示词 Popover
 * - 上下文模式图标按钮（原文/仿写/双文）
 * - AI 服务循环切换
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Send, Square, Loader2, Copy, Check, ArrowDownToLine,
  Globe, Brain, RefreshCw, Pencil,
  MessageSquarePlus, X, RotateCcw, ScrollText,
  BookOpen, PenTool, Layers, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { useTranslation } from '@/i18n';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, type AIProvider } from '@aidocplus/shared-types';
import { useShallow } from 'zustand/react/shallow';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { resolveTheme } from '@/components/chat/ChatMessage';
import { CollapsibleThinkingBlock } from '@/document-types/_shared/CollapsibleThinkingBlock';
import { formatBackendError } from '@/lib/backendError';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { ImitativeWritingContent, WritingNote, PatchImitativeDocFn } from './types';
import { createNote, countWords } from './types';
import { GENRE_OPTIONS } from './constants';
import {
  buildImitativeSystemPrompt, getContextSummary, getContextModeLabel,
  type ImitativeContextMode,
} from './imitativeContext';
import { IMITATIVE_QUICK_ACTIONS } from './imitativeQuickActions';
import type { ImitativeQuickAction } from './imitativeQuickActions';
import { AnalyzeTab } from './AnalyzeTab';
import { GuideTab } from './GuideTab';
import { CompareTab } from './CompareTab';
import { ImitativeCommandPalette } from './ImitativeCommandPalette';
import {
  getImitativeSuggestions, getImitativePhaseIndicator, getImitativeInputPlaceholder,
} from './imitativeSuggestions';
import { DocTypeAIServiceMenu } from '@/document-types/_shared/DocTypeAIServiceMenu';
import { cn } from '@/lib/utils';
import {
  AI_OPTION_BTN_BASE, AI_OPTION_ACTIVE, AI_OPTION_THINKING_ACTIVE, AI_OPTION_INACTIVE,
  SIDEBAR_AI_HEADER_PANEL,
  SIDEBAR_AI_HEADER_ROW,
  SIDEBAR_AI_HEADER_SUBROW_STACK,
} from '@/document-types/_shared/styles';

// ═══ 消息 & 会话 ═══

interface ImitativeAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
}

function genMsgId(): string {
  return `imsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface ImitativeAISession {
  id: string;
  title: string;
  messages: ImitativeAIMessage[];
  createdAt: number;
  updatedAt: number;
}

type StorageLike = DocTypeHostAPI['storage'];

function genSessionId(): string {
  return `isess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function loadSessions(storage: StorageLike, dk: string): ImitativeAISession[] {
  return storage.get<ImitativeAISession[]>(`${dk}_ai_sessions`) || [];
}

function saveSessions(storage: StorageLike, sessions: ImitativeAISession[], dk: string) {
  storage.set(`${dk}_ai_sessions`, sessions);
}

function createSession(): ImitativeAISession {
  const now = Date.now();
  return { id: genSessionId(), title: '新对话', messages: [], createdAt: now, updatedAt: now };
}

function getOrCreateActiveSession(storage: StorageLike, dk: string): ImitativeAISession {
  const sessions = loadSessions(storage, dk);
  const activeId = storage.get<string>(`${dk}_ai_active`) || '';
  const active = sessions.find(s => s.id === activeId);
  if (active) return active;
  const newSess = createSession();
  saveSessions(storage, [...sessions, newSess], dk);
  storage.set(`${dk}_ai_active`, newSess.id);
  return newSess;
}

// ═══ Props ═══

interface ImitativeWritingAISidebarProps {
  host: DocTypeHostAPI;
  docContent: ImitativeWritingContent;
  onInsertToImitation?: (text: string) => void;
  onSaveNote?: (note: WritingNote) => void;
  /** 侧栏回写文档（如分析 Tab 保存核心技法缓存） */
  onPatchDoc?: PatchImitativeDocFn;
}

// ═══ 主组件 ═══

export function ImitativeWritingAISidebar({
  host,
  docContent,
  onInsertToImitation,
  onSaveNote,
  onPatchDoc,
}: ImitativeWritingAISidebarProps) {
  const { t } = useTranslation();
  const dk = useMemo(() => `imitative_${host.documentId}_`, [host.documentId]);

  // ── AI 服务 ──
  const { services } = useSettingsStore(useShallow(s => ({ services: s.ai.services })));
  const enabledServices = useMemo(() => services.filter(sv => sv.enabled), [services]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() =>
    host.storage.get<string>(`${dk}_ai_service_id`) || ''
  );
  const effectiveServiceId = selectedServiceId || undefined;
  const aiParams = getAIInvokeParamsForService(effectiveServiceId);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);
  const providerCaps = useMemo(() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider as AIProvider);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  }, [aiParams.provider]);
  // ── Tab ──
  const [activeTab, setActiveTab] = useState<'chat' | 'analyze' | 'guide' | 'compare' | 'quick'>('chat');

  // ── 上下文模式 ──
  const [contextMode, setContextMode] = useState<ImitativeContextMode>('both');

  // ── 联网/深度思考 ──
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [enableThinking, setEnableThinking] = useState(true);

  // ── 会话管理 ──
  const [sessions, setSessions] = useState<ImitativeAISession[]>(() => loadSessions(host.storage, dk));
  const [activeSessionId, setActiveSessionId] = useState<string>(() =>
    getOrCreateActiveSession(host.storage, dk).id
  );
  const activeSession = useMemo(() =>
    sessions.find(s => s.id === activeSessionId) || (sessions.length > 0 ? sessions[0] : null),
  [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];

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

  // ── 消息编辑 ──
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // ── 自定义提示词 ──
  const defaultPrompt = useMemo(() =>
    buildImitativeSystemPrompt(docContent, contextMode),
  [docContent, contextMode]);
  const [customPrompt, setCustomPrompt] = useState<string>(() =>
    host.storage.get<string>(`${dk}_ai_prompt`) || ''
  );
  const [promptDraft, setPromptDraft] = useState(customPrompt || '');
  const [promptOpen, setPromptOpen] = useState(false);
  const systemPrompt = customPrompt || defaultPrompt;

  // ── 命令面板 ──
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() =>
    host.storage.get<string[]>(`${dk}_ai_favorites`) || []
  );
  const [recentUsed, setRecentUsed] = useState<string[]>(() =>
    host.storage.get<string[]>(`${dk}_ai_recent`) || []
  );

  // ── 动态建议 ──
  const suggestions = useMemo(() => getImitativeSuggestions(docContent, t), [docContent, t]);
  const phaseIndicator = useMemo(() => getImitativePhaseIndicator(docContent, t), [docContent, t]);
  const inputPlaceholder = useMemo(() => getImitativeInputPlaceholder(docContent, t), [docContent, t]);

  const genreLabelShort = useMemo(() => {
    const opt = GENRE_OPTIONS.find(g => g.value === docContent.genre);
    return opt ? t(opt.labelKey, { defaultValue: docContent.genre }) : docContent.genre;
  }, [docContent.genre, t]);

  const sourceWcDisplay = useMemo(() => countWords(docContent.source.text), [docContent.source.text]);
  const imitationWcDisplay = useMemo(() => countWords(docContent.imitation.text), [docContent.imitation.text]);

  // ── 上下文摘要 ──
  const contextSummary = useMemo(() =>
    getContextSummary(docContent, contextMode),
  [docContent, contextMode]);

  // ── 自动滚动 ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent]);

  // ── ⌘K 快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && activeTab === 'chat') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab]);

  // ── 持久化 ──
  const persistSessions = useCallback((updated: ImitativeAISession[]) => {
    setSessions(updated);
    saveSessions(host.storage, updated, dk);
  }, [host.storage, dk]);

  const updateActiveSession = useCallback((updater: (s: ImitativeAISession) => ImitativeAISession) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? updater(s) : s);
      saveSessions(host.storage, updated, dk);
      return updated;
    });
  }, [activeSessionId, host.storage, dk]);

  // ── 会话操作 ──
  const handleNewSession = useCallback(() => {
    const newSess = createSession();
    persistSessions([...sessions, newSess]);
    setActiveSessionId(newSess.id);
    host.storage.set(`${dk}_ai_active`, newSess.id);
  }, [sessions, persistSessions, host.storage]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    host.storage.set(`${dk}_ai_active`, id);
  }, [host.storage]);

  const handleDeleteSession = useCallback((id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    if (updated.length === 0) {
      const newSess = createSession();
      persistSessions([newSess]);
      setActiveSessionId(newSess.id);
      host.storage.set(`${dk}_ai_active`, newSess.id);
    } else {
      persistSessions(updated);
      if (id === activeSessionId) {
        setActiveSessionId(updated[updated.length - 1].id);
        host.storage.set(`${dk}_ai_active`, updated[updated.length - 1].id);
      }
    }
  }, [sessions, activeSessionId, persistSessions, host.storage]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming || !aiAvailable) return;

    const userMsg: ImitativeAIMessage = {
      id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now(),
    };
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

    const historyMsgs = [...(activeSession?.messages || []), userMsg];
    const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...historyMsgs.slice(-14).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const full = await host.ai.chatStream(apiMessages, (cumulative: string) => {
        streamingContentRef.current = cumulative;
        setStreamingContent(cumulative);
      }, {
        signal: controller.signal,
        enableWebSearch: enableWebSearch && providerCaps.webSearch ? true : undefined,
        enableThinking: enableThinking && providerCaps.thinking ? true : undefined,
        serviceId: effectiveServiceId,
      });

      const assistantMsg: ImitativeAIMessage = {
        id: genMsgId(), role: 'assistant', content: full, timestamp: Date.now(),
      };
      updateActiveSession(s => ({ ...s, messages: [...s.messages, assistantMsg], updatedAt: Date.now() }));
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        const partial = streamingContentRef.current;
        if (partial) {
          updateActiveSession(s => ({
            ...s,
            messages: [...s.messages, { id: genMsgId(), role: 'assistant', content: partial, timestamp: Date.now() }],
            updatedAt: Date.now(),
          }));
        }
      } else {
        const errMsg = formatBackendError(err);
        updateActiveSession(s => ({
          ...s,
          messages: [...s.messages, { id: genMsgId(), role: 'assistant', content: errMsg, timestamp: Date.now(), isError: true }],
          updatedAt: Date.now(),
        }));
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      streamingContentRef.current = '';
    }
  }, [streaming, aiAvailable, activeSession, systemPrompt, updateActiveSession,
    enableWebSearch, enableThinking, providerCaps, effectiveServiceId, host.ai]);

  // sendMessageRef 同步
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── 快捷操作 ──
  const handleQuickAction = useCallback((action: ImitativeQuickAction) => {
    const prompt = action.promptTemplate
      .replace(/\{\{source\}\}/g, docContent.source.text)
      .replace(/\{\{imitation\}\}/g, docContent.imitation.text)
      .replace(/\{\{content\}\}/g, docContent.imitation.text)
      .replace(/\{\{contextSummary\}\}/g, contextSummary);

    // 记录最近使用
    const newRecent = [action.id, ...recentUsed.filter(id => id !== action.id)].slice(0, 20);
    setRecentUsed(newRecent);
    host.storage.set(`${dk}_ai_recent`, newRecent);

    setActiveTab('chat');
    sendMessageRef.current(prompt);
  }, [docContent, contextSummary, recentUsed, host.storage]);

  // ── 收藏切换 ──
  const handleToggleFavorite = useCallback((actionId: string) => {
    setFavorites(prev => {
      const next = prev.includes(actionId)
        ? prev.filter(id => id !== actionId)
        : [...prev, actionId];
      host.storage.set(`${dk}_ai_favorites`, next);
      return next;
    });
  }, [host.storage]);

  // ── 消息编辑 ──
  const handleStartEdit = useCallback((msg: ImitativeAIMessage) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (!editingMsgId || !editingContent.trim()) return;
    updateActiveSession(s => {
      const idx = s.messages.findIndex(m => m.id === editingMsgId);
      if (idx === -1) return s;
      const msgs = s.messages.slice(0, idx);
      return { ...s, messages: msgs, updatedAt: Date.now() };
    });
    setEditingMsgId(null);
    const text = editingContent.trim();
    setEditingContent('');
    setTimeout(() => sendMessageRef.current(text), 50);
  }, [editingMsgId, editingContent, updateActiveSession]);

  // ── 重新生成 ──
  const handleRegenerate = useCallback((msgId: string) => {
    updateActiveSession(s => {
      const idx = s.messages.findIndex(m => m.id === msgId);
      if (idx === -1) return s;
      const msgs = s.messages.slice(0, idx);
      return { ...s, messages: msgs, updatedAt: Date.now() };
    });
    const lastUserMsg = [...(activeSession?.messages || [])]
      .slice(0, activeSession?.messages.findIndex(m => m.id === msgId))
      .reverse()
      .find(m => m.role === 'user');
    if (lastUserMsg) {
      setTimeout(() => sendMessageRef.current(lastUserMsg.content), 50);
    }
  }, [activeSession, updateActiveSession]);

  // ── 复制 ──
  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  // ── 保存为笔记 ──
  const handleSaveNote = useCallback((content: string) => {
    if (!onSaveNote) return;
    onSaveNote(createNote({
      title: content.slice(0, 20).replace(/\n/g, ' ') + '…',
      content,
      category: 'analysis',
      source: 'ai',
    }));
  }, [onSaveNote]);

  // ── 提示词 Popover ──
  const handlePromptSave = useCallback(() => {
    setCustomPrompt(promptDraft);
    host.storage.set(`${dk}_ai_prompt`, promptDraft);
    setPromptOpen(false);
  }, [promptDraft, host.storage]);

  const handlePromptReset = useCallback(() => {
    setPromptDraft(defaultPrompt);
  }, [defaultPrompt]);

  const theme = resolveTheme();

  // ─── 渲染 ───

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-card/30">

      {/* 顶栏：Tab + 会话/建议 合并为一块 */}
      <div className={cn(SIDEBAR_AI_HEADER_PANEL, 'shrink-0')}>
        <div className="flex items-center gap-0.5 px-1 py-0.5 border-b border-border/40">
          {(['chat', 'analyze', 'guide', 'compare', 'quick'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                activeTab === tab
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
              title={getTabLabelT(tab, t)}
            >
              {getTabLabelT(tab, t)}
            </button>
          ))}
        </div>

      {/* ─── 对话 Tab ─── */}
      {activeTab === 'chat' && (
        <>
          <div className={SIDEBAR_AI_HEADER_ROW}>
            {/* 会话下拉 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5 flex-1 min-w-0 justify-start">
                  <span className="truncate max-w-[80px]">{activeSession?.title || '新对话'}</span>
                  <ChevronDown className="h-2 w-2 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-[10px]">
                  {t('imitativeWriting.ai.sessions', { defaultValue: '对话历史' })}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sessions.map(sess => (
                  <DropdownMenuItem key={sess.id} className="flex items-center gap-1 text-xs"
                    onClick={() => handleSwitchSession(sess.id)}>
                    <span className={`flex-1 truncate ${sess.id === activeSessionId ? 'font-semibold' : ''}`}>
                      {sess.title}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteSession(sess.id); }}
                      className="shrink-0 text-muted-foreground/40 hover:text-destructive"
                      title="删除对话"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleNewSession} className="text-xs gap-1">
                  <MessageSquarePlus className="h-3 w-3" />
                  {t('imitativeWriting.ai.newSession', { defaultValue: '新建对话' })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 上下文模式图标按钮 */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {([
                { mode: 'source' as ImitativeContextMode, icon: BookOpen,
                  title: t('imitativeWriting.ai.contextSource', { defaultValue: '仅原文' }) },
                { mode: 'imitation' as ImitativeContextMode, icon: PenTool,
                  title: t('imitativeWriting.ai.contextImitation', { defaultValue: '仅仿写' }) },
                { mode: 'both' as ImitativeContextMode, icon: Layers,
                  title: t('imitativeWriting.ai.contextBoth', { defaultValue: '双文' }) },
              ]).map(({ mode, icon: Icon, title }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setContextMode(mode)}
                  title={title}
                  className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${
                    contextMode === mode
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                </button>
              ))}
            </div>

            {/* 自定义提示词 */}
            <Popover open={promptOpen} onOpenChange={setPromptOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                  title={t('imitativeWriting.ai.customPrompt', { defaultValue: '自定义系统提示词' })}>
                  <ScrollText className={`h-3 w-3 ${customPrompt ? 'text-amber-500' : ''}`} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">
                      {t('imitativeWriting.ai.customPrompt', { defaultValue: '系统提示词' })}
                    </p>
                    <button
                      onClick={handlePromptReset}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      title={t('imitativeWriting.ai.resetPrompt', { defaultValue: '恢复默认' })}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
                  <textarea
                    value={promptDraft}
                    onChange={e => setPromptDraft(e.target.value)}
                    placeholder={defaultPrompt.slice(0, 80) + '...'}
                    rows={8}
                    className="w-full text-xs border rounded p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                    aria-label="系统提示词"
                    title="系统提示词"
                  />
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" className="h-6 text-xs" onClick={handlePromptSave}>保存</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs"
                      onClick={() => { setCustomPrompt(''); host.storage.set(`${dk}_ai_prompt`, ''); setPromptOpen(false); }}>
                      清除
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* 清空当前对话 */}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
              onClick={() => updateActiveSession(s => ({ ...s, messages: [], updatedAt: Date.now() }))}
              title={t('imitativeWriting.ai.clearChat', { defaultValue: '清空对话' })}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>

          <div className={SIDEBAR_AI_HEADER_SUBROW_STACK}>
            {suggestions.length > 0 && !streaming && (
              <div className="flex gap-1 flex-wrap">
                {suggestions.map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => sendMessageRef.current(chip.prompt)}
                    disabled={!aiAvailable}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                      chip.variant === 'primary'
                        ? 'border-primary/40 text-primary bg-primary/5 hover:bg-primary/15'
                        : 'border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    title={chip.prompt.slice(0, 60)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={() => setPaletteOpen(true)}
                disabled={!aiAvailable}
                title={t('imitativeWriting.ai.commandPalette', { defaultValue: '快捷操作 (⌘K)' })}
              >
                {t('imitativeWriting.ai.commandPaletteShort', { defaultValue: '快捷' })}
                <kbd className="text-[9px] font-sans opacity-70 ml-0.5">⌘K</kbd>
              </Button>
              <span className={`text-[10px] ml-auto truncate max-w-[120px] ${phaseIndicator.color}`}>
                {phaseIndicator.label}
              </span>
            </div>
            <div
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground border-t border-border/30 pt-1"
              title={t('imitativeWriting.ai.docContextHint', { defaultValue: '当前文档与字数（用于对齐 AI 建议）' })}
            >
              <span className="font-medium text-foreground/80 truncate max-w-[7rem]">{genreLabelShort}</span>
              <span className="text-border/80">·</span>
              <span>
                {t('imitativeWriting.ai.statsSource', { defaultValue: '原' })}
                {sourceWcDisplay}
              </span>
              <span>
                {t('imitativeWriting.ai.statsImitation', { defaultValue: '仿' })}
                {imitationWcDisplay}
              </span>
              <span className="text-border/80">·</span>
              <span className="truncate max-w-[5rem]">{getContextModeLabel(contextMode)}</span>
            </div>
          </div>
        </>
      )}
      </div>

      {activeTab === 'chat' && (
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* 消息列表 */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-3">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground/50 px-2">
                <p className="text-xs">
                  {!aiAvailable
                    ? t('imitativeWriting.ai.notConfigured', { defaultValue: '请先在设置中配置 AI 服务' })
                    : t('imitativeWriting.ai.emptyHint', { defaultValue: '输入问题或使用快捷操作开始分析' })
                  }
                </p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] ${msg.role === 'user' ? '' : 'w-full'}`}>
                  {msg.role === 'user' ? (
                    <>
                      {editingMsgId === msg.id ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={editingContent}
                            onChange={e => setEditingContent(e.target.value)}
                            className="w-full min-h-[60px] text-xs border rounded px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                            placeholder="编辑消息..."
                            title="编辑消息"
                            aria-label="编辑消息"
                          />
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" className="h-5 text-[10px]" onClick={handleConfirmEdit}>
                              {t('imitativeWriting.ai.sendEdit', { defaultValue: '发送' })}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-5 text-[10px]"
                              onClick={() => setEditingMsgId(null)}>取消</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="bg-primary/10 rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words">
                            {msg.content}
                          </div>
                          <div className="hidden group-hover:flex items-center gap-0.5 mt-0.5 justify-end">
                            <button className="p-0.5 rounded hover:bg-muted"
                              onClick={() => handleCopy(msg.id, msg.content)}
                              title={t('common.copy', { defaultValue: '复制' })}>
                              {copiedId === msg.id
                                ? <Check className="h-2.5 w-2.5 text-green-500" />
                                : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
                            </button>
                            <button className="p-0.5 rounded hover:bg-muted"
                              onClick={() => handleStartEdit(msg)}
                              title={t('imitativeWriting.ai.editMessage', { defaultValue: '编辑并重发' })}>
                              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <MessageBubble
                      msg={msg}
                      theme={theme}
                      copiedId={copiedId}
                      onCopy={handleCopy}
                      onRegenerate={handleRegenerate}
                      onInsert={onInsertToImitation}
                      onSaveNote={onSaveNote ? handleSaveNote : undefined}
                      t={t}
                    />
                  )}
                </div>
              </div>
            ))}

            {streaming && (
              <div className="flex justify-start">
                <div className="w-full">
                  {streamingContent ? (
                    <StreamingBubble content={streamingContent} theme={theme} />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="flex-shrink-0 border-t bg-card/50 px-2 py-1.5 space-y-1.5">
            {/* 输入框行 */}
            <div className="flex items-end gap-1">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                title={t('imitativeWriting.ai.inputPlaceholder', { defaultValue: '输入问题...' })}
                aria-label={t('imitativeWriting.ai.inputPlaceholder', { defaultValue: '输入问题...' })}
                rows={3}
                className="flex-1 text-xs resize-none border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 bg-background min-h-[4.5rem]"
                disabled={streaming || !aiAvailable}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (!streaming) sendMessageRef.current(inputValue);
                  }
                }}
              />
              {streaming ? (
                <Button variant="destructive" size="sm" className="h-auto self-stretch px-2"
                  onClick={handleStop}
                  title={t('common.stop', { defaultValue: '停止' })}>
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button variant="default" size="sm" className="h-auto self-stretch px-2"
                  onClick={() => sendMessageRef.current(inputValue)}
                  disabled={!inputValue.trim() || !aiAvailable}
                  title={t('common.send', { defaultValue: '发送' })}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-1.5">
              <DocTypeAIServiceMenu
                enabledServices={enabledServices}
                value={aiParams.serviceId ?? ''}
                onChange={(id) => {
                  setSelectedServiceId(id);
                  host.storage.set(`${dk}_ai_service_id`, id);
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
                  disabled={streaming || !aiAvailable}
                  title={enableWebSearch
                    ? t('docTypeChat.webSearchOn', { defaultValue: '联网搜索：已开启' })
                    : t('docTypeChat.webSearchOff', { defaultValue: '联网搜索：已关闭' })}
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
                  disabled={streaming || !aiAvailable}
                  title={enableThinking
                    ? t('docTypeChat.thinkingOn', { defaultValue: '深度思考：已开启' })
                    : t('docTypeChat.thinkingOff', { defaultValue: '深度思考：已关闭' })}
                >
                  <Brain className="h-3 w-3" />
                  {t('chat.thinking', { defaultValue: '深度思考' })}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 分析 Tab ─── */}
      {activeTab === 'analyze' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <AnalyzeTab
            docContent={docContent}
            onSendMessage={(prompt) => { setActiveTab('chat'); sendMessageRef.current(prompt); }}
            streaming={streaming}
            onPatchDoc={onPatchDoc}
          />
        </div>
      )}

      {/* ─── 指导 Tab ─── */}
      {activeTab === 'guide' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <GuideTab
            docContent={docContent}
            onSendMessage={(prompt) => { setActiveTab('chat'); sendMessageRef.current(prompt); }}
            streaming={streaming}
          />
        </div>
      )}

      {/* ─── 对比 Tab ─── */}
      {activeTab === 'compare' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <CompareTab
            docContent={docContent}
            onSendMessage={(prompt) => { setActiveTab('chat'); sendMessageRef.current(prompt); }}
            streaming={streaming}
          />
        </div>
      )}

      {/* ─── 快捷操作 Tab ─── */}
      {activeTab === 'quick' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b shrink-0">
            <Button variant="outline" size="sm" className="w-full text-xs"
              onClick={() => { setActiveTab('chat'); setPaletteOpen(true); }}>
              {t('imitativeWriting.quickTab.openPalette', { defaultValue: '打开快捷操作面板' })}
              <kbd className="text-[10px] bg-muted px-1 rounded ml-1">⌘K</kbd>
            </Button>
          </div>
          {recentUsed.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <p className="text-[10px] text-muted-foreground px-3 pt-2 pb-1">
                {t('imitativeWriting.quickTab.recentUsed', { defaultValue: '最近使用' })}
              </p>
              {recentUsed.slice(0, 10).map(id => {
                const action = IMITATIVE_QUICK_ACTIONS.find(a => a.id === id);
                if (!action) return null;
                return (
                  <button
                    key={id}
                    onClick={() => { handleQuickAction(action); }}
                    disabled={streaming || !aiAvailable}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-muted/30 transition-colors disabled:opacity-50"
                    title={action.label}
                  >
                    <span className="flex-1 truncate">{action.label}</span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">{action.category}</span>
                  </button>
                );
              })}
            </div>
          )}
          {recentUsed.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/50 p-4 text-center">
              {t('imitativeWriting.quickTab.emptyRecent', {
                defaultValue: '使用 ⌘K 打开命令面板，执行操作后会显示在这里',
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 命令面板 ── */}
      <ImitativeCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={IMITATIVE_QUICK_ACTIONS}
        favorites={favorites}
        recentUsed={recentUsed}
        onAction={handleQuickAction}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}

// ── Tab 标签 ──
type ImitativeAiTab = 'chat' | 'analyze' | 'guide' | 'compare' | 'quick';

function getTabLabelT(tab: ImitativeAiTab, t: (key: string, opts: { defaultValue: string }) => string): string {
  switch (tab) {
    case 'chat':
      return t('imitativeWriting.ai.tabChat', { defaultValue: '对话' });
    case 'analyze':
      return t('imitativeWriting.ai.tabAnalyze', { defaultValue: '分析' });
    case 'guide':
      return t('imitativeWriting.ai.tabGuide', { defaultValue: '指导' });
    case 'compare':
      return t('imitativeWriting.ai.tabCompare', { defaultValue: '对比' });
    case 'quick':
      return t('imitativeWriting.ai.tabQuick', { defaultValue: '快捷' });
    default:
      return tab;
  }
}

// ── 消息气泡 ──
interface MessageBubbleProps {
  msg: ImitativeAIMessage;
  theme: 'light' | 'dark';
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
  onRegenerate: (msgId: string) => void;
  onInsert?: (content: string) => void;
  onSaveNote?: (content: string) => void;
  t: (key: string, opts: { defaultValue: string }) => string;
}

function MessageBubble({ msg, theme, copiedId, onCopy, onRegenerate, onInsert, onSaveNote, t }: MessageBubbleProps) {
  const parsed = parseThinkTags(msg.content);
  const mainContent = parsed.content;

  return (
    <div className={`group flex flex-col gap-0.5 ${msg.isError ? 'text-destructive' : ''}`}>
      {parsed.thinking && (
        <CollapsibleThinkingBlock thinking={parsed.thinking} isThinking={false} theme={theme} />
      )}
      <div className="text-xs leading-relaxed break-words">
        {msg.isError ? (
          <p>{mainContent}</p>
        ) : (
          <MarkdownPreview content={mainContent} theme={theme} className="!p-0" fontSize={12} />
        )}
      </div>
      {!msg.isError && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-0.5 rounded hover:bg-muted"
            onClick={() => onCopy(msg.id, mainContent)}
            title={t('common.copy', { defaultValue: '复制' })}>
            {copiedId === msg.id
              ? <Check className="h-2.5 w-2.5 text-green-500" />
              : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
          </button>
          <button className="p-0.5 rounded hover:bg-muted"
            onClick={() => onRegenerate(msg.id)}
            title={t('imitativeWriting.ai.regenerate', { defaultValue: '重新生成' })}>
            <RefreshCw className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
          {onInsert && (
            <button className="p-0.5 rounded hover:bg-muted"
              onClick={() => onInsert(mainContent)}
              title={t('imitativeWriting.ai.insertToImitation', { defaultValue: '插入到仿写' })}>
              <ArrowDownToLine className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )}
          {onSaveNote && (
            <button className="p-0.5 rounded hover:bg-muted px-1"
              onClick={() => onSaveNote(mainContent)}
              title={t('imitativeWriting.ai.saveAsNote', { defaultValue: '保存为笔记' })}>
              <span className="text-[9px] text-muted-foreground">
                {t('imitativeWriting.ai.saveNote', { defaultValue: '存笔记' })}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 流式气泡 ──
function StreamingBubble({ content, theme }: { content: string; theme: 'light' | 'dark' }) {
  const parsed = parseThinkTags(content);
  return (
    <div className="flex flex-col gap-0.5">
      {parsed.thinking && (
        <CollapsibleThinkingBlock thinking={parsed.thinking} isThinking={true} theme={theme} />
      )}
      <div className="text-xs leading-relaxed break-words">
        <MarkdownPreview content={parsed.content} theme={theme} className="!p-0" fontSize={12} />
      </div>
    </div>
  );
}
