/**
 * NovelAISidebar — 小说写作专属 AI 助手面板
 *
 * 参照 MindMap 插件的 MindMapAssistantPanel.tsx 架构，完全重新设计：
 * - novelContext.ts — 智能上下文引擎（阶段检测 + 分层上下文）
 * - novelQuickActions.ts — 8 类 ~40 个 AI 快捷操作
 * - novelSuggestions.ts — 动态建议芯片 + 阶段指示
 * - NovelCommandPalette.tsx — ⌘K 命令面板
 * - 本文件 — 主容器：会话管理 + 消息渲染 + 用户交互
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Send, Square, Trash2, Loader2, Copy, Check, ArrowDownToLine,
  ChevronDown, Globe, Brain, RefreshCw, Pencil,
  MessageSquarePlus, X, ScrollText, RotateCcw,
  BookOpen, Eye, GitBranch, MessageSquareText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { useTranslation } from '@/i18n';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, type AIProvider } from '@aidocplus/shared-types';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { resolveTheme } from '@/components/chat/ChatMessage';
import { CollapsibleThinkingBlock } from '@/document-types/_shared/CollapsibleThinkingBlock';
import { formatBackendError } from '@/lib/backendError';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { NovelDocumentContent } from './types';
import {
  detectNovelPhase, buildSmartSystemPrompt,
  getContextSummary, autoContextMode, type NovelContextMode,
  buildContextWithBudget, getContextTokenInfo, estimateTokens,
  DEFAULT_TOKEN_BUDGET, TOKEN_BUDGETS, type TokenBudgetLevel,
} from './novelContext';
import {
  loadQuickActions, saveQuickActions, recordRecentUsed,
  type NovelQuickActionStore, type NovelQuickActionItem,
} from './novelQuickActions';
import {
  getNovelSuggestions, getNovelPhaseIndicator, getNovelInputPlaceholder,
} from './novelSuggestions';
import { NovelCommandPalette } from './NovelCommandPalette';
import { buildStyleAnalysisPrompt } from './novelStyleAnalysis';
import type { StorageLike } from './constants';
import { DocTypeAIServiceMenu } from '@/document-types/_shared/DocTypeAIServiceMenu';
import { cn } from '@/lib/utils';
import {
  AI_OPTION_BTN_BASE, AI_OPTION_ACTIVE, AI_OPTION_THINKING_ACTIVE, AI_OPTION_INACTIVE,
  SIDEBAR_AI_HEADER_PANEL,
  SIDEBAR_AI_HEADER_ROW,
  SIDEBAR_AI_HEADER_SUBROW,
} from '@/document-types/_shared/styles';

// ── 消息类型 ──

interface NovelAIMessage {

  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
}

function genMsgId(): string {
  return `nmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── 会话管理 ──

interface NovelAISession {
  id: string;
  title: string;
  messages: NovelAIMessage[];
  createdAt: number;
  updatedAt: number;
}

function genSessionId(): string {
  return `nsess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function loadSessions(storage: StorageLike, dk: string): NovelAISession[] {
  return storage.get<NovelAISession[]>(`${dk}_assistant_sessions`) || [];
}

function saveSessions(storage: StorageLike, sessions: NovelAISession[], dk: string) {
  storage.set(`${dk}_assistant_sessions`, sessions);
}

function getActiveSessionId(storage: StorageLike, dk: string): string {
  return storage.get<string>(`${dk}_assistant_active`) || '';
}

function setActiveSessionIdStorage(storage: StorageLike, id: string, dk: string) {
  storage.set(`${dk}_assistant_active`, id);
}

function createSession(): NovelAISession {
  const now = Date.now();
  return { id: genSessionId(), title: '新对话', messages: [], createdAt: now, updatedAt: now };
}

function getOrCreateActiveSession(storage: StorageLike, dk: string): NovelAISession {
  const sessions = loadSessions(storage, dk);
  const activeId = getActiveSessionId(storage, dk);
  const active = sessions.find(s => s.id === activeId);
  if (active) return active;
  const newSess = createSession();
  saveSessions(storage, [...sessions, newSess], dk);
  setActiveSessionIdStorage(storage, newSess.id, dk);
  return newSess;
}

// ── Props ──

export interface NovelAISidebarProps {
  host: DocTypeHostAPI;
  novel: NovelDocumentContent;
  activeChapterId: string | null;
  activeSceneId?: string | null;
  onInsertToDoc: (text: string) => void;
  onInsertAtCursor?: (text: string) => void;
}

// ── 组件 ──

export default function NovelAISidebar({
  host, novel, activeChapterId, activeSceneId, onInsertToDoc, onInsertAtCursor,
}: NovelAISidebarProps) {
  const { t } = useTranslation();
  const dk = useMemo(() => `novel_${host.documentId}_`, [host.documentId]);

  // ── AI 服务选择 ──
  const settingsStore = useSettingsStore();
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return host.storage.get<string>(`${dk}_assistant_service_id`) || '';
  });
  const aiParams = getAIInvokeParamsForService(selectedServiceId || undefined);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);
  const providerCaps = (() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider as AIProvider);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  })();

  // ── 会话管理 ──
  const [sessions, setSessions] = useState<NovelAISession[]>(() => loadSessions(host.storage, dk));
  const [activeSessionId, setActiveId] = useState<string>(() => {
    const session = getOrCreateActiveSession(host.storage, dk);
    return session.id;
  });
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || (sessions.length > 0 ? sessions[0] : null);
  }, [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);

  // ── 对话状态 ──
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [enableThinking, setEnableThinking] = useState(true);

  // ── Phase 8: 教练模式 ──
  const [coachMode, setCoachMode] = useState(false);

  // ── 消息编辑 ──
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // ── 提示词 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const defaultPrompt = useMemo(() => buildSmartSystemPrompt(novel, activeChapterId), [novel, activeChapterId]);
  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    return host.storage.get<string>(`${dk}_assistant_prompt`) || '';
  });
  const [promptDraft, setPromptDraft] = useState(customPrompt || defaultPrompt);

  // ── 快捷操作 ──
  const [qaStore, setQaStore] = useState<NovelQuickActionStore>(() => loadQuickActions(host.storage));
  const [qaPaletteOpen, setQaPaletteOpen] = useState(false);

  // ── 小说上下文 ──
  const phase = useMemo(() => detectNovelPhase(novel, activeChapterId), [novel, activeChapterId]);
  const contextSummary = useMemo(() => getContextSummary(novel, activeChapterId), [novel, activeChapterId]);
  const phaseIndicator = useMemo(() => getNovelPhaseIndicator(novel, activeChapterId), [novel, activeChapterId]);
  const suggestions = useMemo(() => getNovelSuggestions(novel, activeChapterId), [novel, activeChapterId]);
  const inputPlaceholder = useMemo(() => getNovelInputPlaceholder(novel, activeChapterId), [novel, activeChapterId]);

  // ── 上下文模式 ──
  const [contextMode, setContextMode] = useState<NovelContextMode>(() => autoContextMode(phase));
  useEffect(() => { setContextMode(autoContextMode(phase)); }, [phase]);

  // ── Token 预算 ──
  const [tokenBudget, setTokenBudget] = useState<TokenBudgetLevel>(() => {
    return (host.storage.get<string>(`${dk}_token_budget`) as TokenBudgetLevel) || DEFAULT_TOKEN_BUDGET;
  });
  const tokenInfo = useMemo(() =>
    getContextTokenInfo(novel, activeChapterId, contextMode, tokenBudget, customPrompt || undefined, activeSceneId),
  [novel, activeChapterId, contextMode, tokenBudget, customPrompt, activeSceneId]);

  // ── 持久化 ──
  const persistSessions = useCallback((updated: NovelAISession[]) => {
    setSessions(updated);
    saveSessions(host.storage, updated, dk);
  }, [host.storage, dk]);

  const updateActiveSession = useCallback((updater: (s: NovelAISession) => NovelAISession) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? updater(s) : s);
      saveSessions(host.storage, updated, dk);
      return updated;
    });
  }, [activeSessionId, host.storage, dk]);

  // ── 新建/切换/删除会话 ──
  const handleNewSession = useCallback(() => {
    const newSess = createSession();
    persistSessions([...sessions, newSess]);
    setActiveId(newSess.id);
    setActiveSessionIdStorage(host.storage, newSess.id, dk);
    setSessionMenuOpen(false);
  }, [sessions, persistSessions, host.storage, dk]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveId(id);
    setActiveSessionIdStorage(host.storage, id, dk);
    setSessionMenuOpen(false);
  }, [host.storage, dk]);

  const handleDeleteSession = useCallback((id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    if (updated.length === 0) {
      const newSess = createSession();
      persistSessions([newSess]);
      setActiveId(newSess.id);
      setActiveSessionIdStorage(host.storage, newSess.id, dk);
    } else {
      persistSessions(updated);
      if (id === activeSessionId) {
        setActiveId(updated[updated.length - 1].id);
        setActiveSessionIdStorage(host.storage, updated[updated.length - 1].id, dk);
      }
    }
  }, [sessions, activeSessionId, persistSessions, host.storage, dk]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming || !aiAvailable) return;

    const userMsg: NovelAIMessage = { id: genMsgId(), role: 'user', content: text, timestamp: Date.now() };
    updateActiveSession(s => ({
      ...s,
      messages: [...s.messages, userMsg],
      updatedAt: Date.now(),
      title: s.messages.length === 0 ? text.slice(0, 30) : s.title,
    }));

    setInputValue('');
    setStreaming(true);
    setStreamingContent('');

    const systemPrompt = customPrompt || buildSmartSystemPrompt(novel, activeChapterId, { coachMode, activeSceneId });
    // N1.3: 使用 Token 预算感知的上下文构建
    const historyMessages = [...(activeSession?.messages || []), userMsg];
    const recentHistory = historyMessages.slice(-8);
    const historyTokens = recentHistory.reduce((s, m) => s + estimateTokens(m.content), 0);
    const contextStr = buildContextWithBudget(novel, activeChapterId, contextMode, tokenBudget, historyTokens);
    const fullSystem = systemPrompt + contextStr;

    const apiMessages = [
      { role: 'system' as const, content: fullSystem },
      ...recentHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // DocTypeHost.chatStream：onChunk 为已累计全文，非增量
      const fullContent = await host.ai.chatStream(apiMessages, (cumulative: string) => {
        setStreamingContent(cumulative);
      }, {
        signal: abortController.signal,
        enableWebSearch: enableWebSearch && providerCaps.webSearch ? true : undefined,
        enableThinking: enableThinking && providerCaps.thinking ? true : undefined,
      });

      const assistantMsg: NovelAIMessage = { id: genMsgId(), role: 'assistant', content: fullContent, timestamp: Date.now() };
      updateActiveSession(s => ({
        ...s,
        messages: [...s.messages, assistantMsg],
        updatedAt: Date.now(),
      }));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errMsg: NovelAIMessage = {
          id: genMsgId(), role: 'assistant',
          content: `❌ 生成失败: ${formatBackendError(err)}`,
          timestamp: Date.now(), isError: true,
        };
        updateActiveSession(s => ({
          ...s,
          messages: [...s.messages, errMsg],
          updatedAt: Date.now(),
        }));
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [streaming, aiAvailable, customPrompt, novel, activeChapterId, contextMode, activeSession, enableWebSearch, enableThinking, providerCaps, host.ai, updateActiveSession, tokenBudget, coachMode, activeSceneId]);

  sendMessageRef.current = sendMessage;

  // ── 停止 / 复制 / 重新生成 / 编辑 ──
  const handleStop = useCallback(() => { abortRef.current?.abort(); }, []);

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

  const handleStartEdit = useCallback((msg: NovelAIMessage) => {
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

  // ── 快捷操作 ──
  const handleQuickAction = useCallback((item: NovelQuickActionItem) => {
    const updated = recordRecentUsed(qaStore, item.id);
    setQaStore(updated);
    saveQuickActions(host.storage, updated);
    // 替换模板变量
    let prompt = item.prompt;
    const ch = activeChapterId ? (() => {
      for (const v of novel.volumes) {
        const found = v.chapters.find(c => c.id === activeChapterId);
        if (found) return found;
      }
      return null;
    })() : null;
    if (ch) {
      prompt = prompt.replace(/\{\{chapterTail\}\}/g, ch.content.slice(-2000));
      prompt = prompt.replace(/\{\{outline\}\}/g, ch.outline || '（无大纲）');
      prompt = prompt.replace(/\{\{style\}\}/g, novel.settings.style || '（未设定）');
      prompt = prompt.replace(/\{\{mood\}\}/g, '');
    }
    // N3.4: 风格分析模板变量
    if (prompt.includes('{{styleAnalysis}}')) {
      prompt = buildStyleAnalysisPrompt(novel);
    }
    sendMessageRef.current(prompt);
  }, [qaStore, host.storage, activeChapterId, novel]);

  const handleToggleFavorite = useCallback((itemId: string) => {
    const favs = new Set(qaStore.favorites || []);
    if (favs.has(itemId)) favs.delete(itemId); else favs.add(itemId);
    const updated = { ...qaStore, favorites: Array.from(favs) };
    setQaStore(updated);
    saveQuickActions(host.storage, updated);
  }, [qaStore, host.storage]);

  // ── ⌘K 命令面板 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQaPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── 清空 ──
  const handleClear = useCallback(() => {
    updateActiveSession(s => ({ ...s, messages: [], updatedAt: Date.now() }));
  }, [updateActiveSession]);

  // ── 自动滚动 ──
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingContent]);

  // ── 推荐操作 ──
  const recommendedActions = useMemo(() => {
    const favIds = new Set(qaStore.favorites || []);
    const favorites = qaStore.items.filter(i => favIds.has(i.id) && !i.hidden);
    if (favorites.length > 0) return favorites.slice(0, 6);

    const recentIds = qaStore.recentUsed?.slice(0, 5) || [];
    const recents = recentIds.map(id => qaStore.items.find(i => i.id === id)).filter(Boolean) as NovelQuickActionItem[];
    if (recents.length > 0) return recents.slice(0, 6);

    if (phase === 'blank') return qaStore.items.filter(i => i.categoryId === 'continue' && !i.hidden).slice(0, 6);
    if (phase === 'drafting') return qaStore.items.filter(i => ['continue', 'expand', 'character'].includes(i.categoryId) && !i.hidden).slice(0, 6);
    return qaStore.items.filter(i => ['polish', 'analyze', 'scene'].includes(i.categoryId) && !i.hidden).slice(0, 6);
  }, [qaStore, phase]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className={SIDEBAR_AI_HEADER_PANEL}>
        <div className={cn(SIDEBAR_AI_HEADER_ROW, 'gap-1.5')}>
          <BookOpen className="h-4 w-4 text-amber-500" />
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="text-sm font-medium truncate max-w-[140px] hover:text-amber-600 transition-colors flex items-center gap-0.5" title={t('novel.aiSwitchSession', { defaultValue: '切换对话' })}>
                {activeSession?.title || '写作助手'}
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
                      <button className="opacity-50 hover:opacity-100 hover:text-destructive" title="删除会话" onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id); }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t mt-1 pt-1">
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-sm gap-1" onClick={handleNewSession}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />新建对话
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex-1" />
          <span className={`text-xs ${phaseIndicator.color}`}>
            {phaseIndicator.label}
            {contextSummary ? ` · ${contextSummary}` : ''}
          </span>
          {/* N1.3: Token 用量指示 */}
          <span className={`text-[10px] tabular-nums ${tokenInfo.overBudget ? 'text-red-500' : tokenInfo.usage > 0.8 ? 'text-amber-500' : 'text-muted-foreground/60'}`}
            title={`系统提示 ${tokenInfo.systemPromptTokens} + 上下文 ${tokenInfo.contextTokens} = ${tokenInfo.totalTokens} / ${tokenInfo.budgetTokens} tokens`}>
            {tokenInfo.totalTokens > 999 ? `${(tokenInfo.totalTokens / 1000).toFixed(1)}k` : tokenInfo.totalTokens}/{tokenBudget}
          </span>
          <Popover open={promptOpen} onOpenChange={setPromptOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${promptOpen ? 'text-amber-500' : ''}`} title={t('novel.aiSystemPrompt', { defaultValue: '系统提示词' })}>
                <ScrollText className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-card" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">系统提示词</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPromptDraft(defaultPrompt)}>
                    <RotateCcw className="h-3 w-3 mr-1" />重置
                  </Button>
                </div>
                <textarea
                  className="w-full h-32 text-xs border rounded-md p-2 resize-none bg-background"
                  value={promptDraft}
                  onChange={e => setPromptDraft(e.target.value)}
                  placeholder="输入自定义系统提示词..."
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                    setCustomPrompt(promptDraft);
                    host.storage.set(`${dk}_assistant_prompt`, promptDraft);
                    setPromptOpen(false);
                  }}>保存</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClear} title="清除对话">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className={SIDEBAR_AI_HEADER_SUBROW}>
        <Button variant="outline" size="sm" className="h-6 text-xs gap-1 shrink-0" onClick={() => setQaPaletteOpen(true)} title="快捷操作 (⌘K)">
          快捷操作
        </Button>
        {messages.length > 0 && suggestions.length > 0 && !streaming && (
          suggestions.slice(0, 3).map(chip => (
            <button key={chip.id} onClick={() => sendMessage(chip.prompt)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors hover:bg-accent shrink-0 ${
                chip.variant === 'primary' ? 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400'
                  : 'border-border text-muted-foreground'
              }`}>
              {chip.label}
            </button>
          ))
        )}
        {recommendedActions.slice(0, 6).map(action => (
          <Button key={action.id} variant="ghost" size="sm" className="h-6 text-xs shrink-0"
            onClick={() => handleQuickAction(action)} disabled={streaming}>
            {action.label}
          </Button>
        ))}
        </div>
      </div>

      {/* ── 消息列表 ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">{t('novel.aiHint', { defaultValue: 'AI 小说写作助手' })}</p>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-1">{t('novel.suggestedActions', { defaultValue: '建议操作' })}</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map(chip => (
                    <Button key={chip.id} variant="outline" size="sm" className="h-8 text-xs justify-start"
                      onClick={() => sendMessage(chip.prompt)} disabled={streaming || !aiAvailable}>
                      <span className="truncate">{chip.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {recommendedActions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-1">{t('novel.quickActions', { defaultValue: '快捷操作' })}</p>
                <div className="flex flex-wrap gap-1.5">
                  {recommendedActions.map(action => (
                    <Button key={action.id} variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => handleQuickAction(action)}>
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map(msg => {
          const parsed = msg.role === 'assistant' ? parseThinkTags(msg.content) : null;
          return (
            <div key={msg.id} className={`group/msg flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                {editingMsgId === msg.id ? (
                  <div className="space-y-2">
                    <textarea className="w-full min-h-[60px] text-sm border rounded p-2 bg-background text-foreground resize-none"
                      value={editingContent} onChange={e => setEditingContent(e.target.value)} placeholder="编辑消息内容..." />
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" className="h-6 text-xs" onClick={handleConfirmEdit}>发送</Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingMsgId(null)}>取消</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.role === 'assistant' && parsed ? (
                      <div className="space-y-2">
                        {parsed.thinking && (
                          <CollapsibleThinkingBlock
                            thinking={parsed.thinking}
                            isThinking={false}
                            theme={resolveTheme()}
                          />
                        )}
                        <MarkdownPreview content={parsed.content || msg.content} className="text-sm" />
                      </div>
                    ) : msg.role === 'assistant' ? (
                      <MarkdownPreview content={msg.content} className="text-sm" />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                    <div className="hidden group-hover/msg:flex items-center gap-0.5 mt-0.5">
                      <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleCopyMsg(msg.id, msg.content)} title="复制">
                        {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                      </button>
                      {msg.role === 'user' && (
                        <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleStartEdit(msg)} title="编辑并重新发送">
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                      {msg.role === 'assistant' && !msg.isError && (
                        <>
                          <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleRegenerate(msg.id)} title="重新生成">
                            <RefreshCw className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button className="p-0.5 rounded hover:bg-accent" onClick={() => onInsertToDoc(parsed?.content || msg.content)} title="插入到末尾">
                            <ArrowDownToLine className="h-3 w-3 text-muted-foreground" />
                          </button>
                          {onInsertAtCursor && (
                            <button className="p-0.5 rounded hover:bg-accent" onClick={() => onInsertAtCursor(parsed?.content || msg.content)} title="插入到光标">
                              <ArrowDownToLine className="h-3 w-3 text-blue-500" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {streaming && streamingContent && (() => {
          const streamParsed = parseThinkTags(streamingContent);
          return (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted text-sm space-y-2">
                {streamParsed.thinking && (
                  <CollapsibleThinkingBlock
                    thinking={streamParsed.thinking}
                    isThinking={streamParsed.isThinking}
                    theme={resolveTheme()}
                  />
                )}
                {streamParsed.content && <MarkdownPreview content={streamParsed.content} className="text-sm" />}
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
        {/* 上下文模式 */}
        <div className="flex items-center gap-1 flex-wrap">
          {([
            { key: 'chapter' as NovelContextMode, icon: MessageSquareText, label: '当前章节' },
            { key: 'volume' as NovelContextMode, icon: GitBranch, label: '当前卷' },
            { key: 'settings' as NovelContextMode, icon: Eye, label: '设定集' },
            { key: 'full' as NovelContextMode, icon: Brain, label: '全书' },
          ]).map(mode => (
            <button key={mode.key} onClick={() => setContextMode(mode.key)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors border ${
                contextMode === mode.key
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400 dark:border-amber-400/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
              }`}
              title={`AI 上下文：${mode.label}`}>
              <mode.icon className="h-3 w-3" /><span>{mode.label}</span>
            </button>
          ))}
          {/* N1.3: Token 预算选择 */}
          <select
            className="h-5 text-[10px] bg-transparent border rounded px-1 text-muted-foreground cursor-pointer focus:outline-none"
            value={tokenBudget}
            onChange={e => {
              const v = e.target.value as TokenBudgetLevel;
              setTokenBudget(v);
              host.storage.set(`${dk}_token_budget`, v);
            }}
            title="Token 预算">
            {Object.keys(TOKEN_BUDGETS).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        <textarea ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder={inputPlaceholder}
          className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden"
          rows={2} disabled={streaming || !aiAvailable}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!streaming) sendMessage(inputValue); } }} />

        <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-1.5">
          <DocTypeAIServiceMenu
            enabledServices={enabledServices}
            value={aiParams.serviceId ?? ''}
            onChange={(id) => {
              setSelectedServiceId(id);
              host.storage.set(`${dk}_assistant_service_id`, id);
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
              title={enableWebSearch ? '联网搜索：已开启' : '联网搜索：已关闭'}
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
              title={enableThinking ? '深度思考：已开启' : '深度思考：已关闭'}
            >
              <Brain className="h-3 w-3" />
              {t('chat.thinking', { defaultValue: '深度思考' })}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Phase 8: 教练模式开关 */}
          <Button variant="ghost" size="sm" className={`h-7 px-1.5 ${coachMode ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
            onClick={() => setCoachMode(v => !v)} title={coachMode ? '教练模式：已开启（AI 不写正文，通过提问引导）' : '教练模式：已关闭'}>
            🎓
          </Button>
          <div className="flex-1" />
          {streaming ? (
            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleStop} title={t('novel.aiStop', { defaultValue: '停止生成' })}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="default" size="icon" className="h-7 w-7 flex-shrink-0 bg-amber-600 hover:bg-amber-700"
              onClick={() => sendMessage(inputValue)} disabled={!inputValue.trim() || !aiAvailable} title={t('novel.aiSend', { defaultValue: '发送' })}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <NovelCommandPalette
        open={qaPaletteOpen}
        onOpenChange={setQaPaletteOpen}
        store={qaStore}
        onAction={handleQuickAction}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
