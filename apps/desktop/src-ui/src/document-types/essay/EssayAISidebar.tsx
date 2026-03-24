/**
 * EssayAISidebar — 散文专属 AI 助手面板
 *
 * 对照 DiaryAISidebar 全面实现：
 * - 多会话管理（新建/切换/删除，host.storage 持久化）
 * - 流式输出 + think 标签实时折叠 + Markdown 渲染
 * - 22 个散文快捷操作（8大类）
 * - 上下文模式切换（全文/段落/素材）
 * - 消息操作（复制/重新生成/编辑用户消息/插入到编辑器）
 * - 系统提示词编辑面板
 * - 写作阶段指示器
 * - AI 服务切换
 */
import { useState, useCallback, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  Send, Square, Trash2, Loader2, Copy, Check, ArrowDownToLine,
  ChevronDown, Globe, Brain, RefreshCw, Pencil, Zap,
  MessageSquarePlus, X, ScrollText, RotateCcw, Feather,
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
import type { StorageLike } from './constants';
import { getProviderConfig, type AIProvider } from '@aidocplus/shared-types';
import { useShallow } from 'zustand/react/shallow';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { resolveTheme } from '@/components/chat/ChatMessage';
import { CollapsibleThinkingBlock } from '@/document-types/_shared/CollapsibleThinkingBlock';
import { formatBackendError } from '@/lib/backendError';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { EssayDocumentContent } from './types';
import {
  buildEssaySystemPrompt, getContextSummary,
  detectEssayPhase, getPhaseLabel, getPhaseColor,
  type EssayContextMode,
} from './essayContext';
import { ESSAY_QUICK_ACTIONS, getQuickActionsByCategory } from './essayQuickActions';

// ═══════════════════════════════════════════════════════
// 消息 & 会话类型
// ═══════════════════════════════════════════════════════

interface EssayAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
}

function genMsgId(): string {
  return `emsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface EssayAISession {
  id: string;
  title: string;
  messages: EssayAIMessage[];
  createdAt: number;
  updatedAt: number;
}

const SESSIONS_KEY = '_essay_ai_sessions';
const ACTIVE_SESSION_KEY = '_essay_ai_active_session';

function genSessionId(): string {
  return `esess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function loadSessions(storage: StorageLike): EssayAISession[] {
  return storage.get<EssayAISession[]>(SESSIONS_KEY) || [];
}

function saveSessions(storage: StorageLike, sessions: EssayAISession[]) {
  storage.set(SESSIONS_KEY, sessions);
}

function createSession(): EssayAISession {
  const now = Date.now();
  return { id: genSessionId(), title: '新对话', messages: [], createdAt: now, updatedAt: now };
}

function getOrCreateActiveSession(storage: StorageLike): EssayAISession {
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

interface EssayAISidebarProps {
  host: DocTypeHostAPI;
  essay: EssayDocumentContent;
  editorContent: string;
  onInsertToDoc: (text: string) => void;
}

export interface EssayAISidebarRef {
  sendMessage: (text: string) => void;
}

// ═══════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════

const EssayAISidebar = forwardRef<EssayAISidebarRef, EssayAISidebarProps>(function EssayAISidebar({
  host, essay, editorContent, onInsertToDoc,
}, ref) {
  const { t } = useTranslation();

  // ── AI 服务 ──
  const { services, activeServiceId } = useSettingsStore(useShallow(s => ({
    services: s.ai.services,
    activeServiceId: s.ai.activeServiceId,
  })));
  const enabledServices = useMemo(() => services.filter(sv => sv.enabled), [services]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() =>
    host.storage.get<string>('_essay_ai_service_id') || ''
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
  const [sessions, setSessions] = useState<EssayAISession[]>(() => loadSessions(host.storage));
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
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [contextMode, setContextMode] = useState<EssayContextMode>('full');

  // ── 消息编辑 ──
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // ── 系统提示词编辑 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const defaultPrompt = useMemo(() => buildEssaySystemPrompt(essay, contextMode), [essay, contextMode]);
  const [customPrompt, setCustomPrompt] = useState<string>(() =>
    host.storage.get<string>('_essay_ai_prompt') || ''
  );
  const [promptDraft, setPromptDraft] = useState(customPrompt || defaultPrompt);

  // ── 写作阶段 ──
  const phase = useMemo(() => detectEssayPhase(essay), [essay]);
  const phaseLabel = getPhaseLabel(phase);
  const phaseColor = getPhaseColor(phase);
  const contextSummary = useMemo(() => getContextSummary(essay, contextMode), [essay, contextMode]);

  // ── 推荐操作 ──
  const recommendedActions = useMemo(() => {
    switch (phase) {
      case 'blank':
        return ESSAY_QUICK_ACTIONS.filter(a => ['opening', 'quote-suggest', 'imagery-bank'].includes(a.id)).slice(0, 4);
      case 'drafting':
        return ESSAY_QUICK_ACTIONS.filter(a => ['continue', 'expand', 'sensory', 'imagery-create'].includes(a.id)).slice(0, 4);
      case 'revising':
        return ESSAY_QUICK_ACTIONS.filter(a => ['rhetoric-suggest', 'structure-analyze', 'transition', 'style-match'].includes(a.id)).slice(0, 4);
      case 'polishing':
        return ESSAY_QUICK_ACTIONS.filter(a => ['polish', 'review', 'score', 'vocabulary'].includes(a.id)).slice(0, 4);
    }
  }, [phase]);

  // ── 分类操作 ──
  const categorizedActions = useMemo(() => getQuickActionsByCategory(), []);

  // ── 持久化 ──
  const persistSessions = useCallback((updated: EssayAISession[]) => {
    setSessions(updated);
    saveSessions(host.storage, updated);
  }, [host.storage]);

  const updateActiveSession = useCallback((updater: (s: EssayAISession) => EssayAISession) => {
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

    const userMsg: EssayAIMessage = { id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now() };
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

    const systemPrompt = customPrompt || buildEssaySystemPrompt(essay, contextMode);
    const historyMsgs = [...(activeSession?.messages || []), userMsg];
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...historyMsgs.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // DocTypeHost.chatStream：onChunk 为已累计全文，非增量
      const full = await host.ai.chatStream(apiMessages, (cumulative: string) => {
        streamingContentRef.current = cumulative;
        setStreamingContent(cumulative);
      }, {
        signal: controller.signal,
        enableWebSearch: enableWebSearch && providerCaps.webSearch ? true : undefined,
        enableThinking: enableThinking && providerCaps.thinking ? true : undefined,
        serviceId: selectedServiceId || undefined,
      });

      const assistantMsg: EssayAIMessage = { id: genMsgId(), role: 'assistant', content: full, timestamp: Date.now() };
      updateActiveSession(s => ({ ...s, messages: [...s.messages, assistantMsg], updatedAt: Date.now() }));
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        const partialContent = streamingContentRef.current;
        if (partialContent) {
          updateActiveSession(s => ({ ...s, messages: [...s.messages, { id: genMsgId(), role: 'assistant', content: partialContent, timestamp: Date.now() }], updatedAt: Date.now() }));
        }
      } else {
        const errContent = formatBackendError(err);
        updateActiveSession(s => ({ ...s, messages: [...s.messages, { id: genMsgId(), role: 'assistant', content: `❌ ${errContent}`, timestamp: Date.now(), isError: true }], updatedAt: Date.now() }));
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [streaming, aiAvailable, customPrompt, essay, contextMode, activeSession, enableWebSearch, enableThinking, providerCaps, host.ai, selectedServiceId, updateActiveSession]);

  sendMessageRef.current = sendMessage;

  useImperativeHandle(ref, () => ({ sendMessage }), [sendMessage]);

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

  const handleStartEdit = useCallback((msg: EssayAIMessage) => {
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
    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    onInsertToDoc(cleaned);
  }, [onInsertToDoc]);

  // ── 快捷操作 ──
  const handleQuickAction = useCallback((promptTemplate: string) => {
    const content = editorContent || '';
    const prompt = promptTemplate.replace('{{content}}', content);
    sendMessage(prompt);
  }, [editorContent, sendMessage]);

  // ── 自动滚动 ──
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingContent]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* ── 顶栏：会话管理 + 阶段指示器 + 提示词 ── */}
      <div className="flex-shrink-0 border-b">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Feather className="h-4 w-4 text-amber-600" />
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="text-sm font-medium truncate max-w-[140px] hover:text-amber-600 transition-colors flex items-center gap-0.5"
                title={t('essay.aiSwitchSession', { defaultValue: '切换对话' })}>
                {activeSession?.title || t('essay.aiHint', { defaultValue: '散文助手' })}
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-card" align="start">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {sessions.map(sess => (
                  <div key={sess.id} className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent ${sess.id === activeSessionId ? 'bg-accent font-medium' : ''}`}>
                    <button className="flex-1 text-left truncate" onClick={() => handleSwitchSession(sess.id)} title={sess.title}>
                      {sess.title} ({sess.messages.length})
                    </button>
                    {sessions.length > 1 && (
                      <button className="opacity-50 hover:opacity-100 hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id); }} title="删除对话">
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
          <span className={`text-[10px] font-medium ${phaseColor}`}>{phaseLabel}</span>
          <span className="text-[10px] text-muted-foreground">{contextSummary}</span>
          <Popover open={promptOpen} onOpenChange={setPromptOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${promptOpen ? 'text-amber-500' : ''}`}
                title="系统提示词">
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
                <textarea className="w-full h-32 text-xs border rounded-md p-2 resize-none bg-background"
                  value={promptDraft} onChange={e => setPromptDraft(e.target.value)}
                  placeholder="输入自定义系统提示词..." />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                    setCustomPrompt(promptDraft);
                    host.storage.set('_essay_ai_prompt', promptDraft);
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
      </div>

      {/* ── 快捷操作栏 ── */}
      <div className="flex items-center gap-1 px-2.5 py-1 border-b bg-muted/20 flex-shrink-0">
        {/* 上下文模式切换 */}
        {(['full', 'paragraph', 'material'] as EssayContextMode[]).map(mode => (
          <button key={mode}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors border shrink-0 ${
              contextMode === mode
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400 dark:border-amber-400/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
            }`}
            onClick={() => setContextMode(mode)}>
            {mode === 'full' ? '全文' : mode === 'paragraph' ? '段落' : '素材'}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
        {/* 快捷操作下拉菜单（分类） */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1 shrink-0" disabled={streaming || !aiAvailable}>
              <Zap className="h-3 w-3" />快捷操作
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[400px] overflow-auto bg-card w-48">
            {categorizedActions.map((cat, ci) => (
              <div key={cat.category}>
                {ci > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] text-muted-foreground">{cat.category}</DropdownMenuLabel>
                {cat.actions.map(action => (
                  <DropdownMenuItem key={action.id} className="text-xs gap-2 cursor-pointer"
                    onClick={() => handleQuickAction(action.promptTemplate)}>
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── 消息列表 ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <Feather className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">{t('essay.aiHint', { defaultValue: '散文写作 AI 助手' })}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t('essay.aiHintDesc', { defaultValue: '修辞分析、意象营造、结构梳理、文学性提升' })}</p>
            </div>
            {/* 建议操作（基于写作阶段） */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">
                <span className={phaseColor}>{phaseLabel}</span> — 推荐操作
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recommendedActions.map(action => (
                  <Button key={action.id} variant="outline" size="sm" className="h-7 text-xs justify-start gap-1"
                    onClick={() => handleQuickAction(action.promptTemplate)} disabled={streaming || !aiAvailable}>
                    <span>{action.icon}</span>
                    <span className="truncate">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map(msg => {
          const parsed = msg.role === 'assistant' ? parseThinkTags(msg.content) : null;
          return (
            <div key={msg.id} className={`group/msg flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              } ${msg.isError ? 'border border-red-300' : ''}`}>
                {editingMsgId === msg.id ? (
                  <div className="space-y-2">
                    <textarea className="w-full min-h-[60px] text-sm border rounded p-2 bg-background text-foreground resize-none"
                      value={editingContent} onChange={e => setEditingContent(e.target.value)}
                      placeholder="编辑消息内容..." />
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
                    {/* 消息操作（hover 显示） */}
                    <div className="hidden group-hover/msg:flex items-center gap-0.5 mt-1">
                      <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleCopyMsg(msg.id, parsed?.content || msg.content)} title="复制">
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
                          <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleInsert(parsed?.content || msg.content)} title="插入到编辑器">
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
        })}

        {/* 流式输出（含 think 标签实时折叠） */}
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
        <textarea ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder={t('essay.aiPlaceholder', { defaultValue: '输入散文写作相关问题...' })}
          className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden"
          rows={2} disabled={streaming || !aiAvailable}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!streaming) sendMessage(inputValue); } }} />

        <div className="flex items-center gap-1.5">
          {providerCaps.webSearch && (
            <Button variant="ghost" size="sm" className={`h-7 px-1.5 ${enableWebSearch ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
              onClick={() => setEnableWebSearch(v => !v)}
              title={enableWebSearch ? '联网搜索：已开启' : '联网搜索：已关闭'}>
              <Globe className="h-3.5 w-3.5" />
            </Button>
          )}
          {providerCaps.thinking && (
            <Button variant="ghost" size="sm" className={`h-7 px-1.5 ${enableThinking ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}
              onClick={() => setEnableThinking(v => !v)}
              title={enableThinking ? '深度思考：已开启' : '深度思考：已关闭'}>
              <Brain className="h-3.5 w-3.5" />
            </Button>
          )}
          {enabledServices.length >= 2 && (
            <select
              className="h-6 text-[11px] px-1 border rounded bg-background max-w-[100px] truncate"
              value={selectedServiceId || activeServiceId || ''}
              onChange={e => { setSelectedServiceId(e.target.value); host.storage.set('_essay_ai_service_id', e.target.value); }}
              title="选择 AI 服务"
            >
              {enabledServices.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <div className="flex-1" />
          {streaming ? (
            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleStop} title="停止生成">
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="default" size="icon" className="h-7 w-7 flex-shrink-0 bg-amber-600 hover:bg-amber-700"
              onClick={() => sendMessage(inputValue)} disabled={!inputValue.trim() || !aiAvailable}
              title="发送">
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

export default EssayAISidebar;
