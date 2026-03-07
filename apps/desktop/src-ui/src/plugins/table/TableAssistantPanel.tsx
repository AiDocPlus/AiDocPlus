/**
 * 表格插件专属 AI 助手面板
 *
 * 架构：
 * - tableContext.ts — 智能上下文引擎（分层、token 预算、阶段检测）
 * - quickActionDefs.ts — 12 类 AI 快捷操作
 * - 本文件 — 主容器：布局 + 渲染 + 用户交互
 *
 * 核心能力：
 * - 复用 MarkdownPreview 富文本渲染
 * - 结构化动作按钮（生成表格、追加行、分析报告等）
 * - 多会话管理 + 消息重新生成/编辑
 * - 联网搜索/深度思考
 * - 上下文模式切换（数据/统计/结构）
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { usePluginHost, useThinkingContent } from '../_framework/PluginHostAPI';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, getActiveService } from '@aidocplus/shared-types';
import type { PluginAssistantPanelProps } from '../types';
import {
  type AssistantMessage,
  genMsgId,
  exportChatAsMarkdown,
} from '../_framework/pluginAssistantAI';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import {
  Send, Square, Trash2, Loader2, Copy, Check, ArrowDownToLine,
  ChevronDown, Globe, Brain,
  Table2, Plus, Zap, Highlighter, ArrowRightLeft, Filter,
  RefreshCw, Pencil, MessageSquarePlus,
  X, ScrollText, RotateCcw, Settings,
  MessageSquareText, BarChart3, FileSpreadsheet, Columns3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TablePluginData } from './types';
import {
  buildSmartSystemPrompt, getDefaultSystemPrompt, getContextSummary,
  detectTablePhase, buildContextForMode, TABLE_CONTEXT_MODE_LABELS,
} from './tableContext';
import type { TablePhase, TableContextMode } from './tableContext';
import { fortuneToTableSheets } from './tableDataBridge';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { loadQuickActions, saveQuickActions } from './quickActionDefs';
import type { QuickActionStore, QuickActionItem } from './quickActionDefs';
import { QuickActionManagerDialog } from './dialogs/QuickActionManagerDialog';
import { QuickActionCommandPalette } from './QuickActionCommandPalette';

// ── 会话管理（简化版，使用 storage 直接管理） ──

interface AssistantSession {
  id: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: number;
  updatedAt: number;
}

const SESSIONS_KEY = '_table_assistant_sessions';
const ACTIVE_SESSION_KEY = '_table_assistant_active';

function genSessionId(): string {
  return `tsess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface StorageLike {
  get<T>(key: string): T | null | undefined;
  set(key: string, value: unknown): void;
}

function loadSessions(storage: StorageLike): AssistantSession[] {
  return storage.get<AssistantSession[]>(SESSIONS_KEY) || [];
}

function saveSessions(storage: StorageLike, sessions: AssistantSession[]) {
  storage.set(SESSIONS_KEY, sessions);
}

function getActiveSessionId(storage: StorageLike): string {
  return storage.get<string>(ACTIVE_SESSION_KEY) || '';
}

function setActiveSessionIdStorage(storage: StorageLike, id: string) {
  storage.set(ACTIVE_SESSION_KEY, id);
}

function createSession(): AssistantSession {
  const now = Date.now();
  return { id: genSessionId(), title: '新对话', messages: [], createdAt: now, updatedAt: now };
}

function getOrCreateActiveSession(storage: StorageLike): AssistantSession {
  const sessions = loadSessions(storage);
  const activeId = getActiveSessionId(storage);
  const active = sessions.find(s => s.id === activeId);
  if (active) return active;
  const newSess = createSession();
  saveSessions(storage, [...sessions, newSess]);
  setActiveSessionIdStorage(storage, newSess.id);
  return newSess;
}

// ── 主题解析 ──
function resolveTheme(): 'light' | 'dark' {
  const t = useSettingsStore.getState().ui?.theme;
  if (t === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return t === 'dark' ? 'dark' : 'light';
}

// ── 阶段标签 ──
const PHASE_LABELS: Record<TablePhase, string> = {
  blank: '空白',
  editing: '编辑中',
  data_ready: '数据就绪',
  analyzing: '分析中',
};
const PHASE_COLORS: Record<TablePhase, string> = {
  blank: 'text-muted-foreground',
  editing: 'text-amber-600 dark:text-amber-400',
  data_ready: 'text-green-600 dark:text-green-400',
  analyzing: 'text-blue-600 dark:text-blue-400',
};

// ── 结构化动作解析 ──
interface ParsedAction {
  type: string;
  data: Record<string, unknown>;
}

// ── 组件 ──
export function TableAssistantPanel({
  aiContent,
}: PluginAssistantPanelProps) {
  const host = usePluginHost();
  const { t } = useTranslation('plugin-table');
  const thinkingContent = useThinkingContent();

  // ── AI 服务选择 ──
  const settingsStore = useSettingsStore();
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return host.storage.get<string>('_table_assistant_service_id') || '';
  });

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

  // ── 会话管理 ──
  const [sessions, setSessions] = useState<AssistantSession[]>(() => loadSessions(host.storage));
  const [activeSessionId, setActiveId] = useState<string>(() => {
    const session = getOrCreateActiveSession(host.storage);
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
  const [enableThinking, setEnableThinking] = useState(false);

  // ── 消息编辑 ──
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // ── 提示词 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const defaultPrompt = useMemo(() => getDefaultSystemPrompt(), []);
  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    return host.storage.get<string>('_table_assistant_prompt') || '';
  });
  const [promptDraft, setPromptDraft] = useState(customPrompt || defaultPrompt);

  // ── 上下文模式 ──
  const [contextMode, setContextMode] = useState<TableContextMode>('none');

  // ── 快捷按钮 ──
  const [qaStore, setQaStore] = useState<QuickActionStore>(() => loadQuickActions(host.storage));
  const [qaManagerOpen, setQaManagerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const handleQaSave = useCallback((newStore: QuickActionStore) => {
    saveQuickActions(host.storage, newStore);
    setQaStore(newStore);
  }, [host.storage]);

  // 收藏切换
  const handleToggleFavorite = useCallback((itemId: string) => {
    setQaStore(prev => {
      const favs = new Set(prev.favorites || []);
      if (favs.has(itemId)) favs.delete(itemId); else favs.add(itemId);
      const next = { ...prev, favorites: [...favs] };
      saveQuickActions(host.storage, next);
      return next;
    });
  }, [host.storage]);

  // 记录最近使用
  const recordRecentUsed = useCallback((itemId: string) => {
    setQaStore(prev => {
      const recent = (prev.recentUsed || []).filter(id => id !== itemId);
      recent.unshift(itemId);
      if (recent.length > 20) recent.length = 20;
      const next = { ...prev, recentUsed: recent };
      saveQuickActions(host.storage, next);
      return next;
    });
  }, [host.storage]);

  // Cmd/Ctrl+K 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── 更新消息 ──
  const updateMessages = useCallback((newMessages: AssistantMessage[]) => {
    const currentSessions = loadSessions(host.storage);
    const currentActiveId = getActiveSessionId(host.storage);
    const target = currentSessions.find(s => s.id === currentActiveId);
    if (!target) return;
    const updated = { ...target, messages: newMessages, updatedAt: Date.now() };
    const newSessions = currentSessions.map(s => s.id === updated.id ? updated : s);
    saveSessions(host.storage, newSessions);
    setSessions(newSessions);
  }, [host.storage]);

  const getLatestMessages = useCallback((): AssistantMessage[] => {
    const activeId = getActiveSessionId(host.storage);
    if (!activeId) return [];
    const sess = loadSessions(host.storage).find(s => s.id === activeId);
    return sess?.messages || [];
  }, [host.storage]);

  const appendMessage = useCallback((msg: AssistantMessage) => {
    const latest = getLatestMessages();
    updateMessages([...latest, msg]);
  }, [getLatestMessages, updateMessages]);

  // 监听直接执行结果，在聊天中插入反馈消息
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ ok: boolean; message: string; actionId: string }>).detail;
      if (!detail) return;
      const prefix = detail.ok ? '✅' : '❌';
      appendMessage({
        id: genMsgId(),
        role: 'assistant',
        content: `${prefix} **直接执行** — ${detail.message}`,
        timestamp: Date.now(),
      });
    };
    window.addEventListener('table-direct-action-result', handler);
    return () => window.removeEventListener('table-direct-action-result', handler);
  }, [appendMessage]);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // 输入框自动扩展
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minH = 60; // 3行最小高度
    const maxH = 160;
    el.style.height = Math.max(minH, Math.min(el.scrollHeight, maxH)) + 'px';
  }, [inputValue]);

  // ── 读取表格上下文 ──
  const getTableData = useCallback((): TablePluginData => {
    const raw = host.storage.get<Record<string, unknown>>('') as Record<string, unknown> | null;
    if (!raw) return {};
    // 从 fortuneSheets 转换为 TableSheet 供上下文使用
    if (raw.fortuneSheets && Array.isArray(raw.fortuneSheets)) {
      return {
        sheets: fortuneToTableSheets(raw.fortuneSheets as any[]),
        fortuneSheets: raw.fortuneSheets as any[],
      };
    }
    return raw as TablePluginData;
  }, [host.storage]);

  // ── 定时刷新上下文 ──
  const [tableData, setTableData] = useState<TablePluginData>(() => getTableData());
  useEffect(() => {
    const tick = () => setTableData(getTableData());
    tick();
    const timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
  }, [getTableData]);
  const tablePhase = useMemo(() => detectTablePhase(tableData), [tableData]);
  const contextSummary = useMemo(() => getContextSummary(tableData), [tableData]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return;
    if (!aiAvailable) return;

    const userMsg: AssistantMessage = {
      id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now(),
    };
    appendMessage(userMsg);
    setInputValue('');
    setStreaming(true);
    setStreamingContent('');

    const abort = new AbortController();
    abortRef.current = abort;

    let accumulated = '';
    try {
      const currentTableData = getTableData();
      const docContent = aiContent || host.content.getDocumentContent();
      const sysContent = buildSmartSystemPrompt(currentTableData, docContent || '', customPrompt?.trim() || undefined);

      const latestMsgs = getLatestMessages();
      const contextMsgs: Array<{ role: string; content: string }> = [
        { role: 'system', content: sysContent },
      ];

      // 注入上下文模式
      if (contextMode !== 'none') {
        const modeContent = buildContextForMode(currentTableData, contextMode);
        if (modeContent) {
          const modeLabel = TABLE_CONTEXT_MODE_LABELS[contextMode];
          contextMsgs.push({
            role: 'system',
            content: `以下是用户当前关注的「${modeLabel}」上下文：\n\n${modeContent}`,
          });
        }
      }

      const recent = latestMsgs.filter(m => m.role !== 'system').slice(-20);
      for (const msg of recent) {
        contextMsgs.push({ role: msg.role, content: msg.content });
      }

      await host.ai.chatStream(contextMsgs, (delta) => {
        accumulated += delta;
        setStreamingContent(accumulated);
      }, {
        signal: abort.signal,
        serviceId: selectedServiceId || undefined,
        enableWebSearch: enableWebSearch && providerCaps.webSearch ? true : undefined,
        enableThinking: enableThinking && providerCaps.thinking ? true : undefined,
      });

      const assistantMsg: AssistantMessage = {
        id: genMsgId(), role: 'assistant', content: accumulated, timestamp: Date.now(),
      };
      appendMessage(assistantMsg);
    } catch (err) {
      if (!abort.signal.aborted) {
        const errMsg: AssistantMessage = {
          id: genMsgId(), role: 'assistant',
          content: `❌ ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
          isError: true,
        };
        appendMessage(errMsg);
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [streaming, aiAvailable, customPrompt, getTableData, aiContent, host, selectedServiceId, enableWebSearch, enableThinking, providerCaps, appendMessage, getLatestMessages, contextMode]);
  sendMessageRef.current = sendMessage;

  // ── 停止生成 ──
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (streamingContent) {
      const stoppedMsg: AssistantMessage = {
        id: genMsgId(), role: 'assistant',
        content: streamingContent + '\n\n_(已中断)_',
        timestamp: Date.now(),
      };
      appendMessage(stoppedMsg);
    }
    setStreaming(false);
    setStreamingContent('');
  }, [streamingContent, appendMessage]);

  // ── 会话操作 ──
  const handleNewSession = useCallback(() => {
    const newSess = createSession();
    const all = [...loadSessions(host.storage), newSess];
    saveSessions(host.storage, all);
    setActiveSessionIdStorage(host.storage, newSess.id);
    setActiveId(newSess.id);
    setSessions(all);
    setSessionMenuOpen(false);
  }, [host.storage]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveSessionIdStorage(host.storage, id);
    setActiveId(id);
    setSessionMenuOpen(false);
  }, [host.storage]);

  const handleDeleteSession = useCallback((id: string) => {
    const remaining = loadSessions(host.storage).filter(s => s.id !== id);
    saveSessions(host.storage, remaining);
    setSessions(remaining);
    if (id === activeSessionId) {
      if (remaining.length > 0) {
        setActiveSessionIdStorage(host.storage, remaining[0].id);
        setActiveId(remaining[0].id);
      } else {
        handleNewSession();
      }
    }
  }, [host.storage, activeSessionId, handleNewSession]);

  // ── 清除当前对话 ──
  const handleClear = useCallback(() => {
    updateMessages([]);
    setStreamingContent('');
  }, [updateMessages]);

  // ── 导出 ──
  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const md = exportChatAsMarkdown(messages, t('assistantTitle', { defaultValue: '表格 AI 助手' }));
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `表格AI对话_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, t]);

  // ── 复制 ──
  const handleCopy = useCallback((text: string, blockId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(blockId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ── 提示词编辑 ──
  const handlePromptSave = useCallback(() => {
    const trimmed = promptDraft.trim();
    const isDefault = trimmed === defaultPrompt.trim();
    const val = isDefault ? '' : trimmed;
    setCustomPrompt(val);
    host.storage.set('_table_assistant_prompt', val);
  }, [promptDraft, defaultPrompt, host.storage]);

  const handlePromptReset = useCallback(() => {
    setPromptDraft(defaultPrompt);
    setCustomPrompt('');
    host.storage.set('_table_assistant_prompt', '');
  }, [defaultPrompt, host.storage]);

  // ── AI 服务切换 ──
  const handleServiceChange = useCallback((serviceId: string) => {
    setSelectedServiceId(serviceId);
    host.storage.set('_table_assistant_service_id', serviceId);
  }, [host.storage]);

  // ── 应用表格数据到 FortuneSheet ──
  const applyTableAction = useCallback((action: ParsedAction) => {
    window.dispatchEvent(new CustomEvent('table-ai-apply', { detail: action }));
  }, []);

  // ── 消息重新生成 ──
  const handleRegenerate = useCallback((msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx < 0) return;
    let userIdx = idx - 1;
    while (userIdx >= 0 && messages[userIdx].role !== 'user') userIdx--;
    if (userIdx < 0) return;
    const userText = messages[userIdx].content;
    updateMessages(messages.slice(0, userIdx + 1));
    setTimeout(() => sendMessageRef.current(userText), 100);
  }, [messages, updateMessages]);

  // ── 消息编辑确认 ──
  const handleConfirmEdit = useCallback(() => {
    if (!editingMsgId || !editingContent.trim()) return;
    const idx = messages.findIndex(m => m.id === editingMsgId);
    if (idx < 0) return;
    updateMessages(messages.slice(0, idx));
    setEditingMsgId(null);
    setTimeout(() => sendMessageRef.current(editingContent.trim()), 100);
  }, [editingMsgId, editingContent, messages, updateMessages]);

  // ── 快捷操作处理 ──
  const handleQuickActionItem = useCallback((item: QuickActionItem) => {
    if (!item.prompt && !item.directAction) return;

    // 记录最近使用
    recordRecentUsed(item.id);

    // direct 模式：通过事件直接执行，不走 AI
    if (item.executionMode === 'direct' && item.directAction) {
      // 危险操作需要确认
      if (item.dangerous && !window.confirm(`确定要执行「${item.label}」吗？此操作可能修改或删除数据。`)) {
        return;
      }
      window.dispatchEvent(new CustomEvent('table-direct-action', {
        detail: { actionId: item.directAction },
      }));
      return;
    }

    // AI / hybrid 模式：发送 prompt 给 AI
    if (item.contextMode === 'data') setContextMode('data');
    else if (item.contextMode === 'stats') setContextMode('stats');
    else if (item.contextMode === 'structure') setContextMode('structure');

    sendMessage(item.prompt);
  }, [sendMessage, recordRecentUsed]);

  // 收藏的操作项（用于收藏栏快捷按钮）
  const favoriteItems = useMemo(() => {
    const favSet = new Set(qaStore.favorites || []);
    return qaStore.items.filter(i => favSet.has(i.id) && !i.hidden);
  }, [qaStore.items, qaStore.favorites]);

  // ── 渲染动作按钮 ──
  const renderActionBlock = useCallback((action: ParsedAction, idx: number) => {
    if (action.type === 'generate_table') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)}>
          <Table2 className="h-3 w-3" />应用到表格
        </Button>
      );
    }
    if (action.type === 'append_rows') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)}>
          <Plus className="h-3 w-3" />追加行数据
        </Button>
      );
    }
    if (action.type === 'add_column') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)}>
          <Plus className="h-3 w-3" />添加列
        </Button>
      );
    }
    if (action.type === 'analysis_report') {
      const findings = (action.data.findings as string[]) || [];
      const suggestions = (action.data.suggestions as string[]) || [];
      return (
        <div key={idx} className="my-2 rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b">
            <span className="text-xs font-medium">{(action.data.title as string) || '分析报告'}</span>
          </div>
          <div className="p-2 space-y-1 text-xs">
            {findings.length > 0 && (
              <div>
                <p className="font-medium text-muted-foreground">关键发现：</p>
                {findings.map((f, i) => <p key={i} className="ml-2">• {f}</p>)}
              </div>
            )}
            {suggestions.length > 0 && (
              <div>
                <p className="font-medium text-muted-foreground mt-1">建议：</p>
                {suggestions.map((s, i) => <p key={i} className="ml-2 text-blue-600 dark:text-blue-400">→ {s}</p>)}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (action.type === 'formula_suggestion') {
      return (
        <div key={idx} className="my-1 flex items-center gap-2 text-xs border rounded px-2 py-1">
          <span className="font-mono text-blue-600">{action.data.cell as string}: {action.data.formula as string}</span>
          <span className="text-muted-foreground flex-1">{action.data.description as string}</span>
          <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-0.5"
            onClick={() => applyTableAction(action)} title={t('applyFormula', { defaultValue: '应用公式' })}>
            <Plus className="h-2.5 w-2.5" />{t('applyFormula', { defaultValue: '应用公式' })}
          </Button>
        </div>
      );
    }
    if (action.type === 'update_cells') {
      const count = (action.data.updates as unknown[])?.length || 0;
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)} title={t('updateCells', { defaultValue: '修改单元格' })}>
          <Pencil className="h-3 w-3" />{t('updateCells', { defaultValue: '修改单元格' })} ({count})
        </Button>
      );
    }
    if (action.type === 'delete_rows') {
      const count = (action.data.rows as unknown[])?.length || 0;
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => applyTableAction(action)} title={t('deleteRows', { defaultValue: '删除行' })}>
          <Trash2 className="h-3 w-3" />{t('deleteRows', { defaultValue: '删除行' })} ({count})
        </Button>
      );
    }
    if (action.type === 'delete_columns') {
      const cols = (action.data.columns as string[])?.join(', ') || '';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => applyTableAction(action)} title={t('deleteColumns', { defaultValue: '删除列' })}>
          <Trash2 className="h-3 w-3" />{t('deleteColumns', { defaultValue: '删除列' })} ({cols})
        </Button>
      );
    }
    if (action.type === 'insert_rows') {
      const count = (action.data.rows as unknown[])?.length || 0;
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)} title={t('insertRows', { defaultValue: '插入行' })}>
          <Plus className="h-3 w-3" />{t('insertRows', { defaultValue: '插入行' })} ({count})
        </Button>
      );
    }
    if (action.type === 'replace_sheet') {
      const rowCount = (action.data.rows as unknown[])?.length || 0;
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20"
          onClick={() => { if (window.confirm(t('confirmReplace', { defaultValue: '确定要替换当前表格数据吗？此操作不可撤销。' }))) applyTableAction(action); }}
          title={t('replaceSheet', { defaultValue: '替换当前表格' })}>
          <RefreshCw className="h-3 w-3" />{t('replaceSheet', { defaultValue: '替换表格' })} ({rowCount}{t('rows', { defaultValue: '行' })})
        </Button>
      );
    }
    if (action.type === 'sort_data') {
      const col = action.data.column as string || '';
      const order = action.data.order as string || 'asc';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)} title={t('sortData', { defaultValue: '排序' })}>
          <BarChart3 className="h-3 w-3" />{t('sortData', { defaultValue: '排序' })} {col} {order === 'asc' ? '↑' : '↓'}
        </Button>
      );
    }
    if (action.type === 'set_format') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)} title={t('setFormat', { defaultValue: '应用格式' })}>
          <FileSpreadsheet className="h-3 w-3" />{t('setFormat', { defaultValue: '应用格式' })}
        </Button>
      );
    }
    if (action.type === 'clear_range') {
      const range = action.data.range as string || '';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => applyTableAction(action)} title={t('clearRange', { defaultValue: '清除区域' })}>
          <Trash2 className="h-3 w-3" />{t('clearRange', { defaultValue: '清除' })} {range}
        </Button>
      );
    }
    if (action.type === 'rename_column') {
      const oldName = action.data.oldName as string || '';
      const newName = action.data.newName as string || '';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)} title="重命名列">
          <Pencil className="h-3 w-3" />重命名「{oldName}」→「{newName}」
        </Button>
      );
    }
    if (action.type === 'filter_rows') {
      const condition = action.data.condition as string || '';
      const keep = action.data.keepMatched !== false;
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)} title="筛选行">
          <Filter className="h-3 w-3" />{keep ? '保留' : '删除'}匹配「{condition}」的行
        </Button>
      );
    }
    if (action.type === 'reorder_columns') {
      const order = action.data.order as string[] || [];
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)} title="调整列顺序">
          <ArrowRightLeft className="h-3 w-3" />调整列顺序 ({order.length} 列)
        </Button>
      );
    }
    if (action.type === 'highlight_cells') {
      const count = (action.data.cells as string[])?.length || 0;
      const reason = action.data.reason as string || '';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyTableAction(action)} title={reason || '高亮标记'}>
          <Highlighter className="h-3 w-3" />高亮 {count} 个单元格{reason ? `（${reason}）` : ''}
        </Button>
      );
    }
    return null;
  }, [applyTableAction]);

  // ── 内容分段解析 ──
  const parseContentSegments = useCallback((text: string, _msgId: string) => {
    type Segment =
      | { type: 'text'; content: string }
      | { type: 'action'; action: ParsedAction };
    const segments: Segment[] = [];
    const blockRe = /```json\s*\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = blockRe.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const t = text.slice(lastIndex, match.index).replace(/\n{3,}/g, '\n\n').trim();
        if (t) segments.push({ type: 'text', content: t });
      }
      const code = match[1].trim();
      try {
        const obj = JSON.parse(code);
        if (obj && typeof obj === 'object' && obj.action) {
          segments.push({ type: 'action', action: { type: obj.action, data: obj } });
        }
      } catch { /* 非法 JSON 静默忽略 */ }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      const t = text.slice(lastIndex).replace(/\n{3,}/g, '\n\n').trim();
      if (t) segments.push({ type: 'text', content: t });
    }
    return segments;
  }, []);

  // ── 渲染助手消息内容 ──
  const renderAssistantContent = useCallback((rawContent: string, msgId: string) => {
    const parsed = parseThinkTags(rawContent);
    const thinkingText = parsed.thinking;
    const cleanContent = parsed.content;
    const theme = resolveTheme();
    const segments = parseContentSegments(cleanContent, msgId);

    return (
      <div className="space-y-1">
        {thinkingText && (
          <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap">
            {thinkingText}
          </div>
        )}
        {segments.map((seg, i) => {
          if (seg.type === 'text') {
            return (
              <div key={i} className="text-sm [&_.markdown-preview]:p-0 [&_.markdown-preview]:text-inherit">
                <MarkdownPreview content={seg.content} theme={theme} className="!p-0" fontSize={13} />
              </div>
            );
          }
          if (seg.type === 'action') {
            return (
              <div key={i} className="flex flex-wrap gap-1">
                {renderActionBlock(seg.action, i)}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }, [parseContentSegments, renderActionBlock]);

  // ── 动态 placeholder ──
  const inputPlaceholder = useMemo(() => {
    const placeholders: Record<TablePhase, string> = {
      blank: '描述你需要的表格数据，我来帮你创建...',
      editing: '需要补充数据、设计列结构？',
      data_ready: '需要分析数据、清洗还是添加公式？',
      analyzing: '继续深入分析，或尝试其他角度？',
    };
    return placeholders[tablePhase] || placeholders.blank;
  }, [tablePhase]);

  // ── 渲染 ──
  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* ═══ 顶部 ═══ */}
      <div className="flex-shrink-0 border-b">
        {/* 标题栏 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Table2 className="h-4 w-4 text-green-500" />

          {/* 会话管理 */}
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="text-base font-medium truncate max-w-[160px] hover:text-green-600 transition-colors flex items-center gap-0.5"
                title={t('assistantTitle', { defaultValue: '表格 AI 助手' })}>
                {activeSession?.title || t('assistantTitle', { defaultValue: '表格 AI 助手' })}
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {sessions.map(sess => (
                  <div key={sess.id} className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent ${sess.id === activeSessionId ? 'bg-accent font-medium' : ''}`}>
                    <button className="flex-1 text-left truncate" onClick={() => handleSwitchSession(sess.id)}
                      title={sess.title}>
                      {sess.title} ({sess.messages.length})
                    </button>
                    {sessions.length > 1 && (
                      <button className="opacity-50 hover:opacity-100 hover:text-destructive" title={t('deleteSession', { defaultValue: '删除会话' })} onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id); }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t mt-1 pt-1">
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-sm gap-1" onClick={handleNewSession}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />{t('newSession', { defaultValue: '新建对话' })}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex-1" />

          {/* 阶段指示器 */}
          <span className={`text-xs ${PHASE_COLORS[tablePhase]}`}>
            {PHASE_LABELS[tablePhase]}
            {contextSummary.sheetCount > 0 && ` · ${contextSummary.sheetCount}${t('sheet', { defaultValue: '表' })} ${contextSummary.totalRows}${t('rows', { defaultValue: '行' })}`}
          </span>

          {/* 工具按钮 */}
          <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${promptOpen ? 'text-green-500' : ''}`}
            onClick={() => setPromptOpen(v => !v)}
            title={t('assistantSystemPrompt', { defaultValue: '系统提示词' })}>
            <ScrollText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setQaManagerOpen(true)}
            title={t('manageQuickActions', { defaultValue: '管理快捷按钮' })}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClear} title={t('clearChat', { defaultValue: '清除对话' })}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleExport} title={t('exportChat', { defaultValue: '导出对话' })}>
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
        </div>

        {/* 快捷操作：收藏栏 + 命令面板按钮 */}
        <div className="flex items-center gap-1 px-2 pb-1.5 flex-wrap">
          {/* 命令面板按钮 */}
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
            disabled={streaming || !aiAvailable}
            onClick={() => setPaletteOpen(true)}
            title="快捷操作 (⌘K)">
            <Zap className="h-3 w-3" />快捷操作
          </Button>

          {/* 收藏栏 */}
          {favoriteItems.length > 0 ? (
            favoriteItems.slice(0, 8).map(item => (
              <Button key={item.id} variant="ghost" size="sm" className="h-7 px-2 text-xs"
                disabled={streaming || !aiAvailable}
                onClick={() => handleQuickActionItem(item)}
                title={item.label}>
                {item.label}
              </Button>
            ))
          ) : (
            <span className="text-[10px] text-muted-foreground ml-1">点击 ⭐ 收藏常用操作</span>
          )}
        </div>

        {/* 命令面板 */}
        <QuickActionCommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          store={qaStore}
          onAction={handleQuickActionItem}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* 系统提示词编辑区（可折叠） */}
        {promptOpen && (
          <div className="px-2 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('assistantSystemPromptLabel', { defaultValue: '系统提示词' })}</span>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-0.5" onClick={handlePromptReset}>
                <RotateCcw className="h-3 w-3" />{t('assistantResetDefault', { defaultValue: '恢复默认' })}
              </Button>
            </div>
            <textarea value={promptDraft} onChange={e => setPromptDraft(e.target.value)} onBlur={handlePromptSave}
              className="w-full resize-y rounded-md border bg-muted/30 px-2 py-1.5 text-xs font-[SimSun,'宋体',sans-serif] focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] max-h-[200px]"
              rows={5} placeholder={defaultPrompt} title={t('systemPrompt', { defaultValue: '系统提示词' })} />
          </div>
        )}
      </div>

      {/* ═══ 消息列表 ═══ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-2 space-y-3">
        {!aiAvailable && (
          <div className="text-sm text-muted-foreground text-center py-4 border rounded">
            请先在设置中配置 AI 服务
          </div>
        )}

        {messages.length === 0 && aiAvailable && !streaming && (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Table2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-base">表格 AI 助手</p>
            <p className="mt-1 opacity-70">数据分析 · 表格生成 · 公式建议 · 数据清洗</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`group ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="relative max-w-[85%]">
                {editingMsgId === msg.id ? (
                  <div className="space-y-1">
                    <textarea className="w-full text-sm border rounded p-2 resize-none min-h-[48px] font-[SimSun,'宋体',sans-serif]"
                      value={editingContent} onChange={e => setEditingContent(e.target.value)} rows={3} title="编辑消息" placeholder="编辑消息内容..." />
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-sm" onClick={() => setEditingMsgId(null)}>取消</Button>
                      <Button variant="default" size="sm" className="h-7 text-sm" onClick={handleConfirmEdit}>重新发送</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-green-500/10 border border-green-200 dark:border-green-800 rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    <div className="absolute -left-16 top-0 hidden group-hover:flex items-center gap-0.5">
                      <button className="p-0.5 rounded hover:bg-accent" onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content); }}>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleCopy(msg.content, msg.id)}>
                        {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className={`text-sm ${msg.isError ? 'text-destructive' : ''}`}>
                  {renderAssistantContent(msg.content, msg.id)}
                </div>
                <div className="hidden group-hover:flex items-center gap-0.5 mt-0.5">
                  <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleCopy(msg.content, msg.id)}>
                    {copiedId === msg.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </button>
                  <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleRegenerate(msg.id)} title="重新生成">
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 流式输出 */}
        {streaming && (
          <div className="text-sm">
            {streamingContent ? (
              renderAssistantContent(streamingContent, 'streaming')
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">思考中...</span>
                </div>
                {thinkingContent && (
                  <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {thinkingContent}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ 输入区 ═══ */}
      <div className="flex-shrink-0 border-t p-2 space-y-1.5">
        {/* 行1: 上下文模式选择器 */}
        <div className="flex items-center gap-1 flex-wrap">
          {([
            { key: 'none' as TableContextMode, icon: MessageSquareText, label: t('ctxModeNone', { defaultValue: '随便聊聊' }) },
            { key: 'data' as TableContextMode, icon: FileSpreadsheet, label: t('ctxModeData', { defaultValue: '表格数据' }) },
            { key: 'stats' as TableContextMode, icon: BarChart3, label: t('ctxModeStats', { defaultValue: '统计分析' }) },
            { key: 'structure' as TableContextMode, icon: Columns3, label: t('ctxModeStructure', { defaultValue: '表结构' }) },
          ]).map(mode => (
            <button key={mode.key}
              onClick={() => setContextMode(mode.key)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors border ${
                contextMode === mode.key
                  ? 'bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400 dark:border-green-400/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
              }`}
              title={mode.key === 'none'
                ? t('ctxHintNone', { defaultValue: '不附加特定上下文' })
                : t('ctxHintWith', { defaultValue: '将「{{label}}」作为 AI 上下文', label: mode.label })}
            >
              <mode.icon className="h-3.5 w-3.5" />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* 行2: 输入框 */}
        <textarea ref={inputRef} value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={inputPlaceholder}
          className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden font-[SimSun,'宋体',sans-serif]"
          title={t('chatInput', { defaultValue: 'AI 对话输入' })}
          rows={3} disabled={streaming || !aiAvailable}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (streaming) return;
              sendMessage(inputValue);
            }
          }}
        />

        {/* 行3: 工具按钮 + 发送 */}
        <div className="flex items-center gap-1.5">
          {/* 联网搜索 */}
          <span title={providerCaps.webSearch ? (enableWebSearch ? t('assistantWebSearchOn', { defaultValue: '联网搜索：已开启' }) : t('assistantWebSearchOff', { defaultValue: '联网搜索：已关闭' })) : t('assistantWebSearchUnavailable', { defaultValue: '当前模型不支持联网' })}>
            <Button variant="ghost" size="sm"
              className={`h-7 px-1.5 ${enableWebSearch && providerCaps.webSearch ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
              disabled={!providerCaps.webSearch}
              onClick={() => setEnableWebSearch(v => !v)}>
              <Globe className="h-3.5 w-3.5" />
            </Button>
          </span>

          {/* 深度思考 */}
          <span title={providerCaps.thinking ? (enableThinking ? t('assistantThinkingOn', { defaultValue: '深度思考：已开启' }) : t('assistantThinkingOff', { defaultValue: '深度思考：已关闭' })) : t('assistantThinkingUnavailable', { defaultValue: '当前模型不支持深度思考' })}>
            <Button variant="ghost" size="sm"
              className={`h-7 px-1.5 ${enableThinking && providerCaps.thinking ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}
              disabled={!providerCaps.thinking}
              onClick={() => setEnableThinking(v => !v)}>
              <Brain className="h-3.5 w-3.5" />
            </Button>
          </span>

          {/* AI 服务选择 */}
          {enabledServices.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-xs text-muted-foreground hover:text-foreground truncate max-w-[90px] px-1"
                  title={t('switchAiService', { defaultValue: '切换 AI 服务' })}>
                  {effectiveService?.name || 'AI'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
                {enabledServices.map(s => (
                  <DropdownMenuItem key={s.id} className="text-sm" onClick={() => handleServiceChange(s.id)}>
                    {s.name} {s.id === selectedServiceId && '✓'}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex-1" />

          {/* 发送/停止 */}
          {streaming ? (
            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleStop}
              title={t('assistantStop', { defaultValue: '停止生成' })}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="default" size="icon"
              className="h-7 w-7 flex-shrink-0 bg-green-600 hover:bg-green-700"
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || !aiAvailable}
              title={t('assistantSend', { defaultValue: '发送' })}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ═══ 快捷按钮管理对话框 ═══ */}
      <QuickActionManagerDialog
        open={qaManagerOpen}
        onOpenChange={setQaManagerOpen}
        store={qaStore}
        onSave={handleQaSave}
        t={t}
      />
    </div>
  );
}
