/**
 * Mermaid 插件专属 AI 助手面板
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { usePluginHost, useThinkingContent } from '../_framework/PluginHostAPI';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, getActiveService } from '@aidocplus/shared-types';
import type { PluginAssistantPanelProps } from '../types';
import {
  type AssistantMessage, genMsgId, exportChatAsMarkdown,
} from '../_framework/pluginAssistantAI';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import {
  Send, Square, Trash2, Loader2, Copy, Check, ArrowDownToLine,
  ChevronDown, Globe, Brain, Zap, RefreshCw, Pencil, MessageSquarePlus,
  X, ScrollText, RotateCcw, Settings, MessageSquareText, Code, Eye, GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MermaidPluginData, MermaidContextMode } from './types';
import { MERMAID_CONTEXT_MODE_LABELS } from './types';
import {
  buildSmartSystemPrompt, getDefaultSystemPrompt, getContextSummary,
  detectMermaidPhase, buildContextForMode, autoContextMode,
} from './mermaidContext';
import type { MermaidPhase } from './mermaidContext';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { loadQuickActions, saveQuickActions } from './quickActionDefs';
import type { QuickActionStore, QuickActionItem } from './quickActionDefs';
import { QuickActionManagerDialog } from './dialogs/QuickActionManagerDialog';
import { QuickActionCommandPalette } from './QuickActionCommandPalette';
import { MermaidCodeBlock, extractMermaidBlocks, looksLikeMermaidCode } from './MermaidMessageRenderer';
import { getInputSuggestions, getPhaseIndicator } from './assistantSuggestions';

// ── 会话管理 ──
interface AssistantSession {
  id: string; title: string; messages: AssistantMessage[]; createdAt: number; updatedAt: number;
}
const SESSIONS_KEY = '_mermaid_assistant_sessions';
const ACTIVE_SESSION_KEY = '_mermaid_assistant_active';
function genSessionId(): string { return `msess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }
interface StorageLike { get<T>(key: string): T | null | undefined; set(key: string, value: unknown): void; }
function loadSessions(s: StorageLike): AssistantSession[] { return s.get<AssistantSession[]>(SESSIONS_KEY) || []; }
function saveSessions(s: StorageLike, v: AssistantSession[]) { s.set(SESSIONS_KEY, v); }
function getActiveSessionId(s: StorageLike): string { return s.get<string>(ACTIVE_SESSION_KEY) || ''; }
function setActiveSessionIdStorage(s: StorageLike, id: string) { s.set(ACTIVE_SESSION_KEY, id); }
function createSession(): AssistantSession {
  const now = Date.now();
  return { id: genSessionId(), title: '新对话', messages: [], createdAt: now, updatedAt: now };
}
function getOrCreateActiveSession(s: StorageLike): AssistantSession {
  const sessions = loadSessions(s); const activeId = getActiveSessionId(s);
  const active = sessions.find(x => x.id === activeId);
  if (active) return active;
  const n = createSession(); saveSessions(s, [...sessions, n]); setActiveSessionIdStorage(s, n.id); return n;
}

function resolveTheme(): 'light' | 'dark' {
  const t = useSettingsStore.getState().ui?.theme;
  if (t === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return t === 'dark' ? 'dark' : 'light';
}

// ── 组件 ──
export function MermaidAssistantPanel({ aiContent }: PluginAssistantPanelProps) {
  const host = usePluginHost();
  const { t } = useTranslation('plugin-mermaid');
  const thinkingContent = useThinkingContent();

  // AI 服务
  const settingsStore = useSettingsStore();
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() =>
    host.storage.get<string>('_mermaid_assistant_service_id') || '');
  const effectiveService = selectedServiceId
    ? enabledServices.find(s => s.id === selectedServiceId) || getActiveService(settingsStore.ai)
    : getActiveService(settingsStore.ai);
  const aiParams = getAIInvokeParamsForService(selectedServiceId || undefined);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);
  const providerCaps = (() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  })();

  // 会话管理
  const [sessions, setSessions] = useState<AssistantSession[]>(() => loadSessions(host.storage));
  const [activeSessionId, setActiveId] = useState<string>(() => getOrCreateActiveSession(host.storage).id);
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId) || (sessions.length > 0 ? sessions[0] : null), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);

  // 对话状态
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [enableThinking, setEnableThinking] = useState(false);

  // 消息编辑
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // 提示词
  const [promptOpen, setPromptOpen] = useState(false);
  const defaultPrompt = useMemo(() => getDefaultSystemPrompt(), []);
  const [customPrompt, setCustomPrompt] = useState<string>(() => host.storage.get<string>('_mermaid_assistant_prompt') || '');
  const [promptDraft, setPromptDraft] = useState(customPrompt || defaultPrompt);

  // 快捷按钮
  const [qaStore, setQaStore] = useState<QuickActionStore>(() => loadQuickActions(host.storage));
  const [qaManagerOpen, setQaManagerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const handleQaSave = useCallback((newStore: QuickActionStore) => { saveQuickActions(host.storage, newStore); setQaStore(newStore); }, [host.storage]);
  const handleToggleFavorite = useCallback((itemId: string) => {
    setQaStore(prev => { const favs = new Set(prev.favorites || []); if (favs.has(itemId)) favs.delete(itemId); else favs.add(itemId); const next = { ...prev, favorites: [...favs] }; saveQuickActions(host.storage, next); return next; });
  }, [host.storage]);
  const recordRecentUsed = useCallback((itemId: string) => {
    setQaStore(prev => { const recent = (prev.recentUsed || []).filter(id => id !== itemId); recent.unshift(itemId); if (recent.length > 20) recent.length = 20; const next = { ...prev, recentUsed: recent }; saveQuickActions(host.storage, next); return next; });
  }, [host.storage]);

  // Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen(v => !v); } };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);

  // 更新消息
  const updateMessages = useCallback((newMessages: AssistantMessage[]) => {
    const cur = loadSessions(host.storage); const aid = getActiveSessionId(host.storage);
    const target = cur.find(s => s.id === aid); if (!target) return;
    const updated = { ...target, messages: newMessages, updatedAt: Date.now() };
    const newS = cur.map(s => s.id === updated.id ? updated : s); saveSessions(host.storage, newS); setSessions(newS);
  }, [host.storage]);
  const getLatestMessages = useCallback((): AssistantMessage[] => {
    const aid = getActiveSessionId(host.storage); if (!aid) return [];
    return loadSessions(host.storage).find(s => s.id === aid)?.messages || [];
  }, [host.storage]);
  const appendMessage = useCallback((msg: AssistantMessage) => { updateMessages([...getLatestMessages(), msg]); }, [getLatestMessages, updateMessages]);

  // 自动滚动
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, streamingContent]);
  // 输入框自适应高度
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.max(40, Math.min(el.scrollHeight, 140)) + 'px'; }, [inputValue]);

  // 读取 Mermaid 数据
  const getMermaidData = useCallback((): MermaidPluginData => {
    const raw = host.storage.get<Record<string, unknown>>('') as Record<string, unknown> | null;
    return (raw as MermaidPluginData) || {};
  }, [host.storage]);
  const [mermaidData, setMermaidData] = useState<MermaidPluginData>(() => getMermaidData());
  useEffect(() => { const tick = () => setMermaidData(getMermaidData()); tick(); const timer = setInterval(tick, 3000); return () => clearInterval(timer); }, [getMermaidData]);
  const mermaidPhase = useMemo(() => detectMermaidPhase(mermaidData), [mermaidData]);
  const contextSummary = useMemo(() => getContextSummary(mermaidData), [mermaidData]);
  const phaseIndicator = useMemo(() => getPhaseIndicator(mermaidData), [mermaidData]);
  const suggestions = useMemo(() => getInputSuggestions(mermaidData), [mermaidData]);

  // 上下文模式（根据阶段自动选择）
  const [contextMode, setContextMode] = useState<MermaidContextMode>(() => autoContextMode(mermaidPhase));
  useEffect(() => { setContextMode(autoContextMode(mermaidPhase)); }, [mermaidPhase]);

  // 应用代码到编辑器
  const applyCodeToEditor = useCallback((code: string) => {
    window.dispatchEvent(new CustomEvent('diagram-apply-code', { detail: { code } }));
  }, []);

  // 发送消息
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming || !aiAvailable) return;
    const userMsg: AssistantMessage = { id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now() };
    appendMessage(userMsg); setInputValue(''); setStreaming(true); setStreamingContent('');
    const abort = new AbortController(); abortRef.current = abort;
    let accumulated = '';
    try {
      const curData = getMermaidData();
      const docContent = aiContent || host.content.getDocumentContent();
      const sysContent = buildSmartSystemPrompt(curData, docContent || '', customPrompt?.trim() || undefined);
      const contextMsgs: Array<{ role: string; content: string }> = [{ role: 'system', content: sysContent }];
      if (contextMode !== 'none') {
        const modeContent = buildContextForMode(curData, contextMode, docContent || '');
        if (modeContent) {
          const modeLabel = MERMAID_CONTEXT_MODE_LABELS[contextMode];
          contextMsgs.push({ role: 'system', content: `以下是用户当前关注的「${modeLabel}」上下文：\n\n${modeContent}` });
        }
      }
      const recent = getLatestMessages().filter(m => m.role !== 'system').slice(-20);
      for (const msg of recent) contextMsgs.push({ role: msg.role, content: msg.content });
      await host.ai.chatStream(contextMsgs, (delta) => { accumulated += delta; setStreamingContent(accumulated); }, {
        signal: abort.signal, serviceId: selectedServiceId || undefined,
        enableWebSearch: enableWebSearch && providerCaps.webSearch ? true : undefined,
        enableThinking: enableThinking && providerCaps.thinking ? true : undefined,
      });
      appendMessage({ id: genMsgId(), role: 'assistant', content: accumulated, timestamp: Date.now() });
      // 自动命名会话：首次 AI 回复后用用户首条消息截取标题
      const curSessions = loadSessions(host.storage);
      const curActive = curSessions.find(s => s.id === activeSessionId);
      if (curActive && curActive.title === '新对话' && curActive.messages.length > 0) {
        const firstUser = curActive.messages.find(m => m.role === 'user');
        if (firstUser) {
          const title = firstUser.content.slice(0, 20).replace(/\n/g, ' ') + (firstUser.content.length > 20 ? '...' : '');
          const updatedSessions = curSessions.map(s => s.id === curActive.id ? { ...s, title } : s);
          saveSessions(host.storage, updatedSessions);
          setSessions(updatedSessions);
        }
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        appendMessage({ id: genMsgId(), role: 'assistant', content: `❌ ${err instanceof Error ? err.message : String(err)}`, timestamp: Date.now(), isError: true });
      }
    } finally { setStreaming(false); setStreamingContent(''); abortRef.current = null; }
  }, [streaming, aiAvailable, customPrompt, getMermaidData, aiContent, host, selectedServiceId, enableWebSearch, enableThinking, providerCaps, appendMessage, getLatestMessages, contextMode, activeSessionId]);
  sendMessageRef.current = sendMessage;

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (streamingContent) appendMessage({ id: genMsgId(), role: 'assistant', content: streamingContent + '\n\n_(已中断)_', timestamp: Date.now() });
    setStreaming(false); setStreamingContent('');
  }, [streamingContent, appendMessage]);

  // 会话操作
  const handleNewSession = useCallback(() => {
    const n = createSession(); const all = [...loadSessions(host.storage), n];
    saveSessions(host.storage, all); setActiveSessionIdStorage(host.storage, n.id); setActiveId(n.id); setSessions(all); setSessionMenuOpen(false);
  }, [host.storage]);
  const handleSwitchSession = useCallback((id: string) => { setActiveSessionIdStorage(host.storage, id); setActiveId(id); setSessionMenuOpen(false); }, [host.storage]);
  const handleDeleteSession = useCallback((id: string) => {
    const remaining = loadSessions(host.storage).filter(s => s.id !== id); saveSessions(host.storage, remaining); setSessions(remaining);
    if (id === activeSessionId) { if (remaining.length > 0) { setActiveSessionIdStorage(host.storage, remaining[0].id); setActiveId(remaining[0].id); } else handleNewSession(); }
  }, [host.storage, activeSessionId, handleNewSession]);
  const handleClear = useCallback(() => {
    if (messages.length === 0) return;
    if (!window.confirm('确定要清除当前对话的所有消息吗？')) return;
    updateMessages([]); setStreamingContent('');
  }, [messages.length, updateMessages]);
  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const md = exportChatAsMarkdown(messages, t('assistant.title', { defaultValue: 'Mermaid AI 助手' }));
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `MermaidAI对话_${new Date().toISOString().slice(0, 10)}.md`; a.click(); URL.revokeObjectURL(url);
  }, [messages, t]);
  const handleCopy = useCallback((text: string, blockId: string) => { navigator.clipboard.writeText(text); setCopiedId(blockId); setTimeout(() => setCopiedId(null), 2000); }, []);

  // 提示词
  const handlePromptSave = useCallback(() => {
    const trimmed = promptDraft.trim(); const isDefault = trimmed === defaultPrompt.trim(); const val = isDefault ? '' : trimmed;
    setCustomPrompt(val); host.storage.set('_mermaid_assistant_prompt', val);
  }, [promptDraft, defaultPrompt, host.storage]);
  const handlePromptReset = useCallback(() => { setPromptDraft(defaultPrompt); setCustomPrompt(''); host.storage.set('_mermaid_assistant_prompt', ''); }, [defaultPrompt, host.storage]);
  const handleServiceChange = useCallback((serviceId: string) => { setSelectedServiceId(serviceId); host.storage.set('_mermaid_assistant_service_id', serviceId); }, [host.storage]);

  // 消息重新生成 / 编辑
  const handleRegenerate = useCallback((msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId); if (idx < 0) return;
    let userIdx = idx - 1; while (userIdx >= 0 && messages[userIdx].role !== 'user') userIdx--;
    if (userIdx < 0) return; const userText = messages[userIdx].content;
    updateMessages(messages.slice(0, userIdx + 1)); setTimeout(() => sendMessageRef.current(userText), 100);
  }, [messages, updateMessages]);
  const handleConfirmEdit = useCallback(() => {
    if (!editingMsgId || !editingContent.trim()) return;
    const idx = messages.findIndex(m => m.id === editingMsgId); if (idx < 0) return;
    updateMessages(messages.slice(0, idx)); setEditingMsgId(null);
    setTimeout(() => sendMessageRef.current(editingContent.trim()), 100);
  }, [editingMsgId, editingContent, messages, updateMessages]);

  // 快捷操作处理
  const handleQuickActionItem = useCallback((item: QuickActionItem) => {
    if (!item.prompt && !item.directAction) return;
    recordRecentUsed(item.id);
    if (item.executionMode === 'direct' && item.directAction) {
      if (item.dangerous && !window.confirm(`确定要执行「${item.label}」吗？`)) return;
      window.dispatchEvent(new CustomEvent('mermaid-direct-action', { detail: { actionId: item.directAction } }));
      return;
    }
    if (item.contextMode === 'code') setContextMode('code');
    else if (item.contextMode === 'structure') setContextMode('structure');
    else if (item.contextMode === 'full') setContextMode('full');
    sendMessage(item.prompt);
  }, [sendMessage, recordRecentUsed]);

  const favoriteItems = useMemo(() => {
    const favSet = new Set(qaStore.favorites || []); return qaStore.items.filter(i => favSet.has(i.id) && !i.hidden);
  }, [qaStore.items, qaStore.favorites]);

  // 修复语法错误
  const handleFixError = useCallback((error: string) => {
    sendMessage(`请修复当前 Mermaid 代码中的语法错误。错误信息：${error}\n\n请输出修正后的完整 Mermaid 代码。`);
  }, [sendMessage]);

  // 渲染助手消息
  const renderAssistantContent = useCallback((rawContent: string, _msgId: string) => {
    const parsed = parseThinkTags(rawContent);
    const thinkingText = parsed.thinking;
    const cleanContent = parsed.content;
    const theme = resolveTheme();
    const mermaidBlocks = extractMermaidBlocks(cleanContent);

    // 如果整段内容看起来就是 Mermaid 代码（没有 fence）
    if (mermaidBlocks.length === 0 && looksLikeMermaidCode(cleanContent)) {
      return (
        <div className="space-y-1">
          {thinkingText && <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap">{thinkingText}</div>}
          <MermaidCodeBlock code={cleanContent.trim()} index={0} onApply={applyCodeToEditor} onFixError={handleFixError} t={t} />
        </div>
      );
    }

    // 按 Mermaid 代码块切分内容
    if (mermaidBlocks.length > 0) {
      const segments: Array<{ type: 'text' | 'mermaid'; content: string; index: number }> = [];
      let lastEnd = 0;
      mermaidBlocks.forEach((block, i) => {
        if (block.start > lastEnd) {
          const text = cleanContent.slice(lastEnd, block.start).trim();
          if (text) segments.push({ type: 'text', content: text, index: -1 });
        }
        segments.push({ type: 'mermaid', content: block.code, index: i });
        lastEnd = block.end;
      });
      if (lastEnd < cleanContent.length) {
        const text = cleanContent.slice(lastEnd).trim();
        if (text) segments.push({ type: 'text', content: text, index: -1 });
      }
      return (
        <div className="space-y-1">
          {thinkingText && <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap">{thinkingText}</div>}
          {segments.map((seg, i) => seg.type === 'mermaid'
            ? <MermaidCodeBlock key={i} code={seg.content} index={seg.index} onApply={applyCodeToEditor} onFixError={handleFixError} t={t} />
            : <div key={i} className="text-sm [&_.markdown-preview]:p-0"><MarkdownPreview content={seg.content} theme={theme} className="!p-0" fontSize={13} /></div>
          )}
        </div>
      );
    }

    // 普通文本
    return (
      <div className="space-y-1">
        {thinkingText && <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap">{thinkingText}</div>}
        <div className="text-sm [&_.markdown-preview]:p-0"><MarkdownPreview content={cleanContent} theme={theme} className="!p-0" fontSize={13} /></div>
      </div>
    );
  }, [applyCodeToEditor, handleFixError, t]);

  // 动态 placeholder
  const inputPlaceholder = useMemo(() => {
    const p: Record<MermaidPhase, string> = {
      blank: '描述你需要的图表，我来帮你创建...',
      has_code: '需要修改、优化还是转换图表？',
      rendered: '图表已渲染，需要调整样式或结构？',
      iterating: '继续迭代，或描述新的需求？',
    };
    return p[mermaidPhase] || p.blank;
  }, [mermaidPhase]);

  // ── 渲染 ──
  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* 顶部 */}
      <div className="flex-shrink-0 border-b">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <GitBranch className="h-4 w-4 text-blue-500" />
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="text-base font-medium truncate max-w-[160px] hover:text-blue-600 transition-colors flex items-center gap-0.5"
                title={t('assistant.title', { defaultValue: 'Mermaid AI 助手' })}>
                {activeSession?.title || t('assistant.title', { defaultValue: 'Mermaid AI 助手' })}
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {sessions.map(sess => (
                  <div key={sess.id} className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent ${sess.id === activeSessionId ? 'bg-accent font-medium' : ''}`}>
                    <button className="flex-1 text-left truncate" onClick={() => handleSwitchSession(sess.id)} title={sess.title}>
                      {sess.title} ({sess.messages.length})
                    </button>
                    {sessions.length > 1 && (
                      <button className="opacity-50 hover:opacity-100 hover:text-destructive" title={t('assistant.deleteSession', { defaultValue: '删除会话' })} onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id); }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t mt-1 pt-1">
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-sm gap-1" onClick={handleNewSession}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />{t('assistant.newSession', { defaultValue: '新建对话' })}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex-1" />
          <span className={`text-xs ${phaseIndicator.color}`}>
            {phaseIndicator.label}
            {contextSummary.lineCount > 0 && ` · ${contextSummary.lineCount}行`}
          </span>
          <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${promptOpen ? 'text-blue-500' : ''}`} onClick={() => setPromptOpen(v => !v)} title={t('assistant.systemPrompt', { defaultValue: '系统提示词' })}>
            <ScrollText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setQaManagerOpen(true)} title={t('assistant.manageQuickActions', { defaultValue: '管理快捷按钮' })}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClear} title={t('assistant.clearChat', { defaultValue: '清除对话' })}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleExport} title={t('assistant.exportChat', { defaultValue: '导出对话' })}>
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
        </div>

        {/* 快捷操作 */}
        <div className="flex items-center gap-1 px-2 pb-1.5 flex-wrap">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" disabled={streaming || !aiAvailable} onClick={() => setPaletteOpen(true)} title="快捷操作 (⌘K)">
            <Zap className="h-3 w-3" />快捷操作
          </Button>
          {favoriteItems.slice(0, 8).map(item => (
            <Button key={item.id} variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={streaming || !aiAvailable} onClick={() => handleQuickActionItem(item)} title={item.label}>
              {item.label}
            </Button>
          ))}
        </div>
        <QuickActionCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} store={qaStore} onAction={handleQuickActionItem} onToggleFavorite={handleToggleFavorite} />

        {/* 系统提示词 */}
        {promptOpen && (
          <div className="px-2 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('assistant.systemPromptLabel', { defaultValue: '系统提示词' })}</span>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-0.5" onClick={handlePromptReset}>
                <RotateCcw className="h-3 w-3" />{t('assistant.resetDefault', { defaultValue: '恢复默认' })}
              </Button>
            </div>
            <textarea value={promptDraft} onChange={e => setPromptDraft(e.target.value)} onBlur={handlePromptSave}
              className="w-full resize-y rounded-md border bg-muted/30 px-2 py-1.5 text-xs font-[SimSun,'宋体',sans-serif] focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] max-h-[200px]"
              rows={5} placeholder={defaultPrompt} title={t('assistant.systemPrompt', { defaultValue: '系统提示词' })} />
          </div>
        )}
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-2 space-y-3">
        {!aiAvailable && <div className="text-sm text-muted-foreground text-center py-4 border rounded">请先在设置中配置 AI 服务</div>}
        {messages.length === 0 && aiAvailable && !streaming && (
          <div className="text-sm text-muted-foreground text-center py-8">
            <GitBranch className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-base">Mermaid AI 助手</p>
            <p className="mt-1 opacity-70">流程图 · 时序图 · 类图 · 状态图 · ER图</p>
            {/* 建议 chip */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4 justify-start px-4">
                {suggestions.map(chip => (
                  <button key={chip.id} onClick={() => sendMessage(chip.prompt)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors hover:bg-accent ${
                      chip.variant === 'primary' ? 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400' : 'border-border text-muted-foreground'
                    }`}>
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`group ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%]">
                {editingMsgId === msg.id ? (
                  <div className="space-y-1">
                    <textarea className="w-full text-sm border rounded p-2 resize-none min-h-[48px] font-[SimSun,'宋体',sans-serif]"
                      value={editingContent} onChange={e => setEditingContent(e.target.value)} rows={3} title="编辑消息" placeholder="编辑消息内容..." />
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingMsgId(null)}>取消</Button>
                      <Button variant="default" size="sm" className="h-7 text-xs" onClick={handleConfirmEdit}>重新发送</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap">{msg.content}</div>
                    <div className="hidden group-hover:flex items-center gap-0.5 mt-0.5 justify-end">
                      <button className="p-0.5 rounded hover:bg-accent" title="编辑" onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content); }}><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                      <button className="p-0.5 rounded hover:bg-accent" title="复制" onClick={() => handleCopy(msg.content, msg.id)}>
                        {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className={`text-sm ${msg.isError ? 'text-destructive' : ''}`}>{renderAssistantContent(msg.content, msg.id)}</div>
                <div className="hidden group-hover:flex items-center gap-0.5 mt-0.5">
                  <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleCopy(msg.content, msg.id)} title="复制">
                    {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </button>
                  <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleRegenerate(msg.id)} title="重新生成"><RefreshCw className="h-3 w-3 text-muted-foreground" /></button>
                </div>
              </div>
            )}
          </div>
        ))}

        {streaming && (
          <div className="text-sm">
            {streamingContent ? renderAssistantContent(streamingContent, 'streaming') : (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">思考中...</span></div>
                {thinkingContent && <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 max-h-40 overflow-y-auto whitespace-pre-wrap">{thinkingContent}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="flex-shrink-0 border-t p-2 space-y-1.5">
        {/* 上下文模式 */}
        <div className="flex items-center gap-1 flex-wrap">
          {([
            { key: 'none' as MermaidContextMode, icon: MessageSquareText, label: t('context.none', { defaultValue: '随便聊聊' }) },
            { key: 'code' as MermaidContextMode, icon: Code, label: t('context.code', { defaultValue: '图表代码' }) },
            { key: 'structure' as MermaidContextMode, icon: Eye, label: t('context.structure', { defaultValue: '结构分析' }) },
            { key: 'full' as MermaidContextMode, icon: GitBranch, label: t('context.full', { defaultValue: '完整上下文' }) },
          ]).map(mode => (
            <button key={mode.key} onClick={() => setContextMode(mode.key)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors border ${
                contextMode === mode.key
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400 dark:border-blue-400/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
              }`}
              title={mode.key === 'none' ? '不附加特定上下文' : `将「${mode.label}」作为 AI 上下文`}>
              <mode.icon className="h-3 w-3" /><span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* 建议 chip（有代码时） */}
        {messages.length > 0 && suggestions.length > 0 && !streaming && (
          <div className="flex items-center gap-1 flex-wrap">
            {suggestions.slice(0, 4).map(chip => (
              <button key={chip.id} onClick={() => sendMessage(chip.prompt)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors hover:bg-accent ${
                  chip.variant === 'warning' ? 'border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400'
                    : chip.variant === 'primary' ? 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400'
                    : 'border-border text-muted-foreground'
                }`}>
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <textarea ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder={inputPlaceholder}
          className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden font-[SimSun,'宋体',sans-serif]"
          title={t('assistant.chatInput', { defaultValue: 'AI 对话输入' })} rows={2} disabled={streaming || !aiAvailable}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!streaming) sendMessage(inputValue); } }} />

        <div className="flex items-center gap-1.5">
          <span title={providerCaps.webSearch ? (enableWebSearch ? '联网搜索：已开启' : '联网搜索：已关闭') : '当前模型不支持联网'}>
            <Button variant="ghost" size="sm" className={`h-7 px-1.5 ${enableWebSearch && providerCaps.webSearch ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
              disabled={!providerCaps.webSearch} onClick={() => setEnableWebSearch(v => !v)}><Globe className="h-3.5 w-3.5" /></Button>
          </span>
          <span title={providerCaps.thinking ? (enableThinking ? '深度思考：已开启' : '深度思考：已关闭') : '当前模型不支持深度思考'}>
            <Button variant="ghost" size="sm" className={`h-7 px-1.5 ${enableThinking && providerCaps.thinking ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}
              disabled={!providerCaps.thinking} onClick={() => setEnableThinking(v => !v)}><Brain className="h-3.5 w-3.5" /></Button>
          </span>
          {enabledServices.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-xs text-muted-foreground hover:text-foreground truncate max-w-[90px] px-1" title="切换 AI 服务">{effectiveService?.name || 'AI'}</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
                {enabledServices.map(s => <DropdownMenuItem key={s.id} className="text-sm" onClick={() => handleServiceChange(s.id)}>{s.name} {s.id === selectedServiceId && '✓'}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="flex-1" />
          {streaming ? (
            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleStop} title="停止生成"><Square className="h-3.5 w-3.5" /></Button>
          ) : (
            <Button variant="default" size="icon" className="h-7 w-7 flex-shrink-0 bg-blue-600 hover:bg-blue-700" onClick={() => sendMessage(inputValue)} disabled={!inputValue.trim() || !aiAvailable} title="发送"><Send className="h-3.5 w-3.5" /></Button>
          )}
        </div>
      </div>

      <QuickActionManagerDialog open={qaManagerOpen} onOpenChange={setQaManagerOpen} store={qaStore} onSave={handleQaSave} t={t} />
    </div>
  );
}
