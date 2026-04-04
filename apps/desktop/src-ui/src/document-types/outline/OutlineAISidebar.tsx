/**
 * OutlineAISidebar — 大纲专属 AI 助手面板（全面自建）
 *
 * 参照 DiaryAISidebar / EssayAISidebar 架构，完整自建：
 * - 多会话管理（新建/切换/删除，host.storage 持久化）
 * - 流式输出 + think 标签实时折叠 + Markdown 渲染
 * - 10 分类 40+ 快捷操作
 * - 上下文模式切换（当前节点 / 当前分支 / 全大纲）
 * - 消息操作（复制/重新生成/编辑用户消息/插入到正文/应用到大纲）
 * - 系统提示词编辑面板
 * - 联网/深度思考开关
 * - AI 服务切换
 * - 阶段感知推荐操作
 * - ⌘K 命令面板
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Send, Square, Trash2, Loader2, Copy, Check, ArrowDownToLine,
  ChevronDown, Globe, RefreshCw, Pencil,
  MessageSquarePlus, X, ScrollText, RotateCcw, ListTree, Brain,
  Sparkles, Command,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { useTranslation } from '@/i18n';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, type AIProvider } from '@aidocplus/shared-types';
import { useShallow } from 'zustand/react/shallow';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { formatBackendError } from '@/lib/backendError';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import { resolveTheme } from '@/components/chat/ChatMessage';
import { CollapsibleThinkingBlock } from '@/document-types/_shared/CollapsibleThinkingBlock';
import { DocTypeAIServiceMenu } from '@/document-types/_shared/DocTypeAIServiceMenu';
import { DynamicIcon } from '@/document-types/_shared/DynamicIcon';
import { cn } from '@/lib/utils';
import {
  AI_OPTION_BTN_BASE, AI_OPTION_ACTIVE, AI_OPTION_THINKING_ACTIVE, AI_OPTION_INACTIVE,
  SIDEBAR_AI_HEADER_PANEL,
  SIDEBAR_AI_HEADER_ROW,
  SIDEBAR_AI_HEADER_SUBROW,
  MSG_ACTION_BTN,
} from '@/document-types/_shared/styles';

import { OUTLINE_AI_SYSTEM_BASE } from './ai-prompts';
import type { OutlineNode, Outline } from './types';
import { parseOutlineContent } from './types';
import { outlineToMarkdown } from './converters';
import {
  buildLayeredOutlineContext,
  buildOutlineSystemPrompt,
  buildOutlineContextByMode,
  type OutlineContextMode,
} from './outlineContext';
import { parseAIResponseToNodes, validateAIResponse } from './converters/aiResponseParser';
import {
  loadQuickActions,
  saveQuickActions,
  recordRecentUsed,
  DEFAULT_CATEGORIES,
  type OutlineQuickActionStore,
  type OutlineQuickActionItem,
} from './outlineQuickActions';
import { OutlineCommandPalette } from './components/OutlineCommandPalette';

// ═══════════════════════════════════════════════════════════════════════════
// 消息 & 会话类型
// ═══════════════════════════════════════════════════════════════════════════

interface OutlineAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
}

function genMsgId(): string {
  return `omsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface OutlineAISession {
  id: string;
  title: string;
  messages: OutlineAIMessage[];
  createdAt: number;
  updatedAt: number;
}

const SESSIONS_KEY = '_outline_ai_sessions';
const ACTIVE_SESSION_KEY = '_outline_ai_active_session';

function genSessionId(): string {
  return `osess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

type StorageLike = { get<T>(key: string): T | null; set(key: string, value: unknown): void };

function loadSessions(storage: StorageLike): OutlineAISession[] {
  return storage.get<OutlineAISession[]>(SESSIONS_KEY) || [];
}

function saveSessions(storage: StorageLike, sessions: OutlineAISession[]) {
  storage.set(SESSIONS_KEY, sessions);
}

function createSession(): OutlineAISession {
  const now = Date.now();
  return { id: genSessionId(), title: '新对话', messages: [], createdAt: now, updatedAt: now };
}

function getOrCreateActiveSession(storage: StorageLike): OutlineAISession {
  const sessions = loadSessions(storage);
  const activeId = storage.get<string>(ACTIVE_SESSION_KEY) || '';
  const active = sessions.find(s => s.id === activeId);
  if (active) return active;
  const newSess = createSession();
  saveSessions(storage, [...sessions, newSess]);
  storage.set(ACTIVE_SESSION_KEY, newSess.id);
  return newSess;
}

// ═══════════════════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════════════════

export type OutlineAIApplyStrategy = 'append-root' | 'replace-outline' | 'insert-children';

interface OutlineAISidebarProps {
  host: DocTypeHostAPI;
  document: { id: string; title?: string; content?: string };
  activeNodeId?: string | null;
  activeOutline?: Outline | null;
  selectedNodeIds?: string[];
  onApplyNodes?: (nodes: OutlineNode[], strategy: OutlineAIApplyStrategy) => void;
  onClose?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════════════════════════════════════

export default function OutlineAISidebar({
  host,
  document: doc,
  activeNodeId,
  activeOutline,
  onApplyNodes,
  onClose,
}: OutlineAISidebarProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  // ── AI 服务 ──
  const { services } = useSettingsStore(useShallow(s => ({
    services: s.ai.services,
  })));
  const enabledServices = useMemo(() => services.filter(sv => sv.enabled), [services]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() =>
    host.storage.get<string>('_outline_ai_service_id') || ''
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
  const [sessions, setSessions] = useState<OutlineAISession[]>(() => loadSessions(host.storage));
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
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [enableThinking, setEnableThinking] = useState(true);

  // ── 上下文模式 ──
  const [contextMode, setContextMode] = useState<OutlineContextMode>('activeNode');

  // ── 消息编辑 ──
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // ── 系统提示词编辑 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>(() =>
    host.storage.get<string>('_outline_ai_prompt') || ''
  );
  const [promptDraft, setPromptDraft] = useState(customPrompt);

  // ── 应用到大纲 Dialog ──
  const [applyOpen, setApplyOpen] = useState(false);
  const [applySourceText, setApplySourceText] = useState('');
  const [applyStrategy, setApplyStrategy] = useState<OutlineAIApplyStrategy>('append-root');
  const [applyParseError, setApplyParseError] = useState<string | null>(null);

  // ── 命令面板 ──
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // ── 快捷操作存储 ──
  const stableStorage = useMemo(() => host.storage, [host.storage]);
  const [actionStore, setActionStore] = useState<OutlineQuickActionStore>(() =>
    loadQuickActions(stableStorage),
  );

  // ── 大纲数据 ──
  const getOutlineData = useCallback(() => {
    if (activeOutline) {
      return { outlines: [activeOutline], activeOutlineId: activeOutline.id };
    }
    const latest = host.doc.getDocument();
    return parseOutlineContent(latest.content || '');
  }, [host.doc, activeOutline]);

  const getActiveOutline = useCallback((): Outline | null => {
    const data = getOutlineData();
    return data.outlines.find(o => o.id === data.activeOutlineId) || data.outlines[0] || null;
  }, [getOutlineData]);

  // ── 分层上下文 ──
  const layeredContext = useMemo(() => {
    return buildLayeredOutlineContext(getActiveOutline(), activeNodeId || undefined);
  }, [getActiveOutline, activeNodeId]);

  const phase = useMemo(() => layeredContext.phase, [layeredContext]);

  // ── 系统提示词 ──
  const defaultPrompt = useMemo(() =>
    OUTLINE_AI_SYSTEM_BASE + '\n\n' + buildOutlineSystemPrompt(phase, layeredContext),
  [phase, layeredContext]);

  useEffect(() => {
    setPromptDraft(customPrompt || defaultPrompt);
  }, [customPrompt, defaultPrompt]);

  // ── 持久化会话 ──
  const persistSessions = useCallback((updated: OutlineAISession[]) => {
    setSessions(updated);
    saveSessions(host.storage, updated);
  }, [host.storage]);

  const updateActiveSession = useCallback((updater: (s: OutlineAISession) => OutlineAISession) => {
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

    const userMsg: OutlineAIMessage = { id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now() };
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

    const systemPrompt = customPrompt || defaultPrompt;
    const historyMsgs = [...(activeSession?.messages || []), userMsg];
    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...historyMsgs.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
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
        serviceId: selectedServiceId || undefined,
      });

      const assistantMsg: OutlineAIMessage = { id: genMsgId(), role: 'assistant', content: full, timestamp: Date.now() };
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
  }, [streaming, aiAvailable, customPrompt, defaultPrompt, activeSession, enableWebSearch, enableThinking, providerCaps, host.ai, selectedServiceId, updateActiveSession]);

  sendMessageRef.current = sendMessage;

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

  const handleStartEdit = useCallback((msg: OutlineAIMessage) => {
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

  // ── 插入到正文 / 应用到大纲 ──
  const handleInsert = useCallback((content: string) => {
    const cleaned = content.replace(/<think[\s\S]*?<\/think>/g, '').trim();
    window.dispatchEvent(new CustomEvent('doctype-insert-text', { detail: { documentId: doc.id, text: cleaned } }));
  }, [doc.id]);

  const handleOpenApply = useCallback((text: string) => {
    setApplySourceText(text);
    setApplyParseError(null);
    setApplyOpen(true);
  }, []);

  const parsedNodes = useMemo(() => {
    const v = validateAIResponse(applySourceText || '');
    if (!v.valid) return [];
    return parseAIResponseToNodes(applySourceText);
  }, [applySourceText]);

  // ── 快捷操作 ──
  const getOutlineMarkdown = useCallback(() => {
    const active = getActiveOutline();
    if (!active) return '';
    return outlineToMarkdown(active, { maxDepth: 4, includeNotes: true });
  }, [getActiveOutline]);

  const smartContextText = useMemo(() => {
    return buildOutlineContextByMode(getActiveOutline(), activeNodeId || null, contextMode);
  }, [getActiveOutline, activeNodeId, contextMode]);

  const fire = useCallback((_label: string, prompt: string) => {
    const md = getOutlineMarkdown();
    if (!md.trim() && !smartContextText.trim()) {
      sendMessage(t('outline.ai.emptyOutlineHint', {
        defaultValue: '当前大纲为空，请先添加一些节点，或直接输入你想生成的大纲主题。',
      }));
      return;
    }

    let finalPrompt = prompt
      .replace(/\{\{outlineContent\}\}/g, smartContextText.slice(-8000))
      .replace(/\{\{title\}\}/g, doc.title || t('outline.title', { defaultValue: '大纲' }))
      .replace(/\{\{activeNode\}\}/g, layeredContext.critical.activeNodeContent || '')
      .replace(/\{\{topic\}\}/g, doc.title || '')
      .replace(/\{\{textInput\}\}/g, '');

    sendMessage(finalPrompt);
  }, [doc.title, doc.id, getOutlineMarkdown, smartContextText, t, layeredContext, sendMessage]);

  const handleExecuteAction = useCallback((item: OutlineQuickActionItem) => {
    setActionStore(prev => {
      const next = recordRecentUsed(prev, item.id);
      saveQuickActions(stableStorage, next);
      return next;
    });
    fire(isEn ? item.labelEn : item.label, item.prompt);
  }, [fire, isEn, stableStorage]);

  // ── 自动滚动 ──
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingContent]);

  // ── ⌘K 快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── 命令面板事件 ──
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ item?: OutlineQuickActionItem }>;
      const item = custom.detail?.item;
      if (!item) return;
      handleExecuteAction(item);
    };
    window.addEventListener('outline-ai-run-action', handler as EventListener);
    return () => window.removeEventListener('outline-ai-run-action', handler as EventListener);
  }, [handleExecuteAction]);

  // ── 按分类分组快捷操作 ──
  const categorizedActions = useMemo(() => {
    return DEFAULT_CATEGORIES
      .filter(cat => !cat.hidden)
      .map(cat => ({
        ...cat,
        items: actionStore.items.filter(i => i.categoryId === cat.id && !i.hidden && (!i.requiresActiveNode || !!activeNodeId)),
      }))
      .filter(cat => cat.items.length > 0);
  }, [actionStore, activeNodeId]);

  // ── 阶段提示文案 ──
  const phaseHint = useMemo(() => {
    switch (phase) {
      case 'blank': return isEn ? 'Start by adding your first topic' : '开始添加第一个主题';
      case 'drafting': return isEn ? 'Expand your outline structure' : '扩展大纲结构';
      case 'structured': return isEn ? 'Refine and complete details' : '完善和补充细节';
      case 'completed': return isEn ? 'Review and finalize' : '审阅和定稿';
      default: return '';
    }
  }, [phase, isEn]);

  // ── 推荐快捷操作（基于阶段） ──
  const recommendedActionIds = useMemo(() => {
    switch (phase) {
      case 'blank':
        return ['generate-outline-template', 'brainstorm', 'generate-example'];
      case 'drafting':
        return ['expand-node', 'generate-children', 'continue-content'];
      case 'structured':
        return ['polish-text', 'simplify-expression', 'extract-key-points'];
      case 'completed':
        return ['summarize-all', 'generate-toc', 'quality-assess'];
      default:
        return ['expand-node', 'polish-text'];
    }
  }, [phase]);

  const recommendedActions = useMemo(() => {
    return actionStore.items
      .filter(i => recommendedActionIds.includes(i.id) && (!i.requiresActiveNode || !!activeNodeId))
      .slice(0, 4);
  }, [actionStore, recommendedActionIds, activeNodeId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* ── 头部 ── */}
      <div className={SIDEBAR_AI_HEADER_PANEL}>
        <div className={cn(SIDEBAR_AI_HEADER_ROW, 'gap-1.5')}>
          <ListTree className="h-4 w-4 text-blue-500" />
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="text-sm font-medium truncate max-w-[140px] hover:text-blue-600 transition-colors flex items-center gap-0.5"
                title={t('outline.ai.switchSession', { defaultValue: '切换对话' })}>
                {activeSession?.title || t('outline.ai.title', { defaultValue: '大纲 AI 助手' })}
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
                      <button type="button" className="opacity-50 hover:opacity-100 hover:text-destructive"
                        onClick={e => { e.stopPropagation(); handleDeleteSession(sess.id); }}
                        title={t('common.delete', { defaultValue: '删除' })}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t mt-1 pt-1">
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-sm gap-1" onClick={handleNewSession}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />{t('outline.ai.newSession', { defaultValue: '新建对话' })}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* 阶段指示 */}
          <span className="text-[10px] text-muted-foreground">
            {isEn ? 'Phase:' : '阶段:'} {phase} · {phaseHint}
          </span>

          <div className="flex-1" />

          {/* 系统提示词 */}
          <Popover open={promptOpen} onOpenChange={setPromptOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${promptOpen ? 'text-blue-500' : ''}`}
                title={t('outline.ai.customSystemPrompt', { defaultValue: '系统提示词' })}>
                <ScrollText className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-card" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('outline.ai.customSystemPrompt', { defaultValue: '系统提示词' })}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPromptDraft(defaultPrompt)}>
                    <RotateCcw className="h-3 w-3 mr-1" />{t('outline.ai.resetPrompt', { defaultValue: '重置' })}
                  </Button>
                </div>
                <textarea className="w-full h-32 text-xs border rounded-md p-2 resize-none bg-background"
                  value={promptDraft} onChange={e => setPromptDraft(e.target.value)}
                  placeholder={t('outline.ai.promptPlaceholder', { defaultValue: '输入自定义系统提示词...' })} />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                    setCustomPrompt(promptDraft);
                    host.storage.set('_outline_ai_prompt', promptDraft);
                    setPromptOpen(false);
                  }}>{t('common.save', { defaultValue: '保存' })}</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 清除 */}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClear}
            title={t('outline.ai.clearChat', { defaultValue: '清除对话' })}>
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* 关闭 */}
          {onClose && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}
              title={t('common.hideAI', { defaultValue: '关闭 AI' })}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className={SIDEBAR_AI_HEADER_SUBROW}>
          {/* 上下文模式切换 */}
          {(['activeNode', 'branch', 'full'] as OutlineContextMode[]).map(mode => (
            <button key={mode}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors border shrink-0 ${
                contextMode === mode
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400 dark:border-blue-400/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
              }`}
              onClick={() => setContextMode(mode)}>
              {mode === 'activeNode' ? t('outline.ai.contextMode.activeNode', { defaultValue: '当前节点' })
                : mode === 'branch' ? t('outline.ai.contextMode.branch', { defaultValue: '当前分支' })
                : t('outline.ai.contextMode.full', { defaultValue: '全大纲' })}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
          {/* 快捷操作下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1 shrink-0" disabled={streaming || !aiAvailable}>
                <Sparkles className="h-3.5 w-3.5" />
                {isEn ? 'Actions' : '快捷操作'}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
              {categorizedActions.map(cat => (
                <DropdownMenuSub key={cat.id}>
                  <DropdownMenuSubTrigger className="gap-2">
                    <DynamicIcon name={cat.icon} className="h-4 w-4" fallback={Sparkles} />
                    {isEn ? cat.labelEn : cat.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {cat.items.slice(0, 8).map(item => (
                      <DropdownMenuItem key={item.id} onClick={() => handleExecuteAction(item)} className="gap-2">
                        <DynamicIcon name={item.icon} className="h-4 w-4" fallback={Sparkles} />
                        {isEn ? item.labelEn : item.label}
                      </DropdownMenuItem>
                    ))}
                    {cat.items.length > 8 && (
                      <DropdownMenuItem disabled className="text-xs text-muted-foreground justify-center">
                        {isEn ? `+${cat.items.length - 8} more` : `还有 ${cat.items.length - 8} 项`}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCommandPaletteOpen(true)}>
                <Command className="h-4 w-4 mr-2" />
                {isEn ? 'Open command palette...' : '打开命令面板...'}
                <span className="ml-auto text-xs text-muted-foreground">⌘K</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── 消息列表 ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <ListTree className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">{t('outline.ai.title', { defaultValue: '大纲 AI 助手' })}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {t('outline.ai.hintDesc', { defaultValue: '生成结构、润色表达、续写扩展、提炼总结' })}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {isEn ? 'Press ⌘K to search actions' : '按 ⌘K 搜索快捷操作'}
              </p>
            </div>
            {/* 推荐操作 */}
            {recommendedActions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-1">
                  {t('outline.ai.recommendedActions', { defaultValue: '试试这些操作' })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recommendedActions.map(action => (
                    <Button key={action.id} variant="outline" size="sm" className="h-7 text-xs justify-start"
                      onClick={() => handleExecuteAction(action)} disabled={streaming || !aiAvailable}>
                      <DynamicIcon name={action.icon} className="h-3.5 w-3.5 mr-1" fallback={Sparkles} />
                      <span className="truncate">{isEn ? action.labelEn : action.label}</span>
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
              } ${msg.isError ? 'border border-red-300' : ''}`}>
                {editingMsgId === msg.id ? (
                  <div className="space-y-2">
                    <textarea className="w-full min-h-[60px] text-sm border rounded p-2 bg-background text-foreground resize-none"
                      value={editingContent} onChange={e => setEditingContent(e.target.value)}
                      placeholder={t('outline.ai.editPlaceholder', { defaultValue: '编辑消息内容...' })} />
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" className="h-6 text-xs" onClick={handleConfirmEdit}>{t('common.save', { defaultValue: '发送' })}</Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingMsgId(null)}>{t('common.cancel', { defaultValue: '取消' })}</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.role === 'assistant' && parsed ? (
                      <div className="space-y-2">
                        {parsed.thinking && (
                          <CollapsibleThinkingBlock thinking={parsed.thinking} isThinking={false} theme={resolveTheme()} />
                        )}
                        <MarkdownPreview content={parsed.content || msg.content} className="text-sm" />
                      </div>
                    ) : msg.role === 'assistant' ? (
                      <MarkdownPreview content={msg.content} className="text-sm" />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                    {/* 消息操作（hover 显示） */}
                    <div className="hidden group-hover/msg:flex items-center gap-0.5 mt-1 flex-wrap">
                      <button className={MSG_ACTION_BTN} onClick={() => handleCopyMsg(msg.id, parsed?.content || msg.content)}
                        title={t('common.copy', { defaultValue: '复制' })}>
                        {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                      {msg.role === 'user' && (
                        <button className={MSG_ACTION_BTN} onClick={() => handleStartEdit(msg)}
                          title={t('outline.ai.editResend', { defaultValue: '编辑并重新发送' })}>
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      {msg.role === 'assistant' && !msg.isError && (
                        <>
                          <button className={MSG_ACTION_BTN} onClick={() => handleRegenerate(msg.id)}
                            title={t('outline.ai.regenerate', { defaultValue: '重新生成' })}>
                            <RefreshCw className="h-3 w-3" />
                          </button>
                          <button className={MSG_ACTION_BTN} onClick={() => handleInsert(parsed?.content || msg.content)}
                            title={t('outline.ai.insertToDoc', { defaultValue: '插入到正文' })}>
                            <ArrowDownToLine className="h-3 w-3" />
                          </button>
                          <button className={MSG_ACTION_BTN} onClick={() => handleOpenApply(parsed?.content || msg.content)}
                            title={t('outline.ai.apply.title', { defaultValue: '应用到大纲' })}>
                            <ListTree className="h-3 w-3" />
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
                  <CollapsibleThinkingBlock thinking={streamParsed.thinking} isThinking={streamParsed.isThinking} theme={resolveTheme()} />
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
          placeholder={t('outline.ai.inputPlaceholder', { defaultValue: '输入指令，或按 ⌘K 搜索操作...' })}
          className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden"
          rows={2} disabled={streaming || !aiAvailable}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!streaming) sendMessage(inputValue); } }} />

        <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-1.5">
          <DocTypeAIServiceMenu
            enabledServices={enabledServices}
            value={aiParams.serviceId ?? ''}
            onChange={id => {
              setSelectedServiceId(id);
              host.storage.set('_outline_ai_service_id', id);
            }}
            disabled={streaming}
          />
          {providerCaps.webSearch && (
            <Button variant="ghost" size="sm"
              className={cn(AI_OPTION_BTN_BASE, enableWebSearch ? AI_OPTION_ACTIVE : AI_OPTION_INACTIVE)}
              onClick={() => setEnableWebSearch(v => !v)} disabled={streaming}
              title={enableWebSearch ? t('chat.webSearchOn', { defaultValue: '联网搜索：已开启' }) : t('chat.webSearchOff', { defaultValue: '联网搜索：已关闭' })}>
              <Globe className="h-3 w-3" />
              {t('chat.webSearch', { defaultValue: '联网' })}
            </Button>
          )}
          {providerCaps.thinking && (
            <Button variant="ghost" size="sm"
              className={cn(AI_OPTION_BTN_BASE, enableThinking ? AI_OPTION_THINKING_ACTIVE : AI_OPTION_INACTIVE)}
              onClick={() => setEnableThinking(v => !v)} disabled={streaming}
              title={enableThinking ? t('chat.deepThinkOn', { defaultValue: '深度思考：已开启' }) : t('chat.deepThinkOff', { defaultValue: '深度思考：已关闭' })}>
              <Brain className="h-3 w-3" />
              {t('chat.thinking', { defaultValue: '深度思考' })}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex-1" />
          {streaming ? (
            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleStop}
              title={t('outline.ai.stop', { defaultValue: '停止生成' })}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="default" size="icon" className="h-7 w-7 flex-shrink-0 bg-blue-600 hover:bg-blue-700"
              onClick={() => sendMessage(inputValue)} disabled={!inputValue.trim() || !aiAvailable}
              title={t('outline.ai.send', { defaultValue: '发送' })}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── 命令面板 ── */}
      <OutlineCommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectAction={handleExecuteAction}
        storage={stableStorage}
        hasActiveNode={!!activeNodeId}
      />

      {/* ── 应用到大纲 Dialog ── */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('outline.ai.apply.title', { defaultValue: '应用到大纲' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground whitespace-pre-wrap border rounded p-2 bg-muted/20">
              {t('outline.ai.apply.contextHint', { defaultValue: '将把下方 AI 输出解析为大纲节点，并按所选方式写入当前大纲。' })}
            </div>
            <div className="space-y-1">
              <Label>{t('outline.ai.apply.strategy', { defaultValue: '应用方式' })}</Label>
              <RadioGroup value={applyStrategy} onValueChange={v => setApplyStrategy(v as OutlineAIApplyStrategy)} className="grid grid-cols-3 gap-2">
                <Label htmlFor="outline-ai-apply-append" className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has(:checked)]:bg-accent">
                  <RadioGroupItem value="append-root" id="outline-ai-apply-append" />
                  <span className="text-sm">{t('outline.ai.apply.append', { defaultValue: '追加到根节点' })}</span>
                </Label>
                <Label htmlFor="outline-ai-apply-replace" className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has(:checked)]:bg-accent">
                  <RadioGroupItem value="replace-outline" id="outline-ai-apply-replace" />
                  <span className="text-sm">{t('outline.ai.apply.replace', { defaultValue: '替换当前大纲' })}</span>
                </Label>
                <Label htmlFor="outline-ai-apply-insert" className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has(:checked)]:bg-accent',
                  !activeNodeId && 'opacity-50 cursor-not-allowed'
                )}>
                  <RadioGroupItem value="insert-children" id="outline-ai-apply-insert" disabled={!activeNodeId} />
                  <span className="text-sm">{t('outline.ai.apply.insert', { defaultValue: '插入为当前节点子节点' })}</span>
                </Label>
              </RadioGroup>
            </div>
            <div className="space-y-1">
              <Label>{t('outline.ai.apply.source', { defaultValue: 'AI 输出' })}</Label>
              <Textarea value={applySourceText} onChange={e => setApplySourceText(e.target.value)} className="min-h-[180px] font-mono text-xs" />
            </div>
            {applyParseError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{applyParseError}</div>
            )}
            <div className="text-xs text-muted-foreground">
              {t('outline.ai.apply.parsedCount', { defaultValue: '已解析 {{count}} 个节点', count: parsedNodes.length })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              {t('common.cancel', { defaultValue: '取消' })}
            </Button>
            <Button onClick={() => {
              if (!parsedNodes.length) {
                setApplyParseError(t('outline.ai.apply.noNodes', { defaultValue: '未能从文本解析出节点，请让 AI 输出 Markdown 列表或标题结构。' }));
                return;
              }
              if (applyStrategy === 'insert-children' && !activeNodeId) {
                setApplyParseError(t('outline.ai.apply.needActiveNode', { defaultValue: '「插入为当前节点子节点」需要先激活一个节点' }));
                return;
              }
              onApplyNodes?.(parsedNodes, applyStrategy);
              setApplyOpen(false);
            }}>
              {t('outline.ai.apply.confirm', { defaultValue: '确认应用' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════════════
