/**
 * 思维导图插件专属 AI 助手面板
 *
 * 架构对标 TableAssistantPanel / DiagramAssistantPanel：
 * - mindmapContext.ts — 智能上下文引擎
 * - quickActionDefs.ts — 7 类 AI 快捷操作
 * - 本文件 — 主容器：布局 + 渲染 + 用户交互
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
  Zap, RefreshCw, Pencil, MessageSquarePlus,
  X, ScrollText, RotateCcw, Settings,
  FileDown, Replace, Wand2, ListTree,
  MessageSquareText, Eye, GitBranch,
} from 'lucide-react';
import { truncateContent } from '../_framework/pluginUtils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MindmapPluginData, MindmapContextMode } from './types';
import { markdownToMindMapData, mindMapDataToMarkdown, markdownToBranch } from './mindmapConverter';
import type { SMNode } from './mindmapConverter';
import {
  buildSmartSystemPrompt, getDefaultSystemPrompt, getContextSummary,
  detectMindmapPhase, buildContextForMode,
} from './mindmapContext';
import { loadQuickActions, saveQuickActions, recordRecentUsed } from './quickActionDefs';
import type { QuickActionStore, QuickActionItem } from './quickActionDefs';
import { QuickActionManagerDialog } from './dialogs/QuickActionManagerDialog';
import { QuickActionCommandPalette } from './QuickActionCommandPalette';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { getInputSuggestions, getPhaseIndicator, getInputPlaceholder, autoContextMode } from './assistantSuggestions';

// ── 会话管理 ──

interface AssistantSession {
  id: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: number;
  updatedAt: number;
}

const SESSIONS_KEY = '_mindmap_assistant_sessions';
const ACTIVE_SESSION_KEY = '_mindmap_assistant_active';

function genSessionId(): string {
  return `msess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

// ── AI 生成模式（从主面板移入） ──
const MINDMAP_MODES = [
  { key: 'ai',       label: 'AI 智能分析', prompt: '根据本文档的正文内容，生成结构化思维导图。' },
  { key: 'detail',   label: '详细展开',   prompt: '根据本文档的正文内容，生成详细的多层级思维导图，尽量展开所有要点。' },
  { key: 'summary',  label: '精简概括',   prompt: '根据本文档的正文内容，生成精简的思维导图，只保留核心要点，不超过3层。' },
  { key: 'swot',     label: 'SWOT 分析', prompt: '对本文档内容进行 SWOT 分析，生成思维导图。根节点为主题，四个一级分支分别为：优势(Strengths)、劣势(Weaknesses)、机会(Opportunities)、威胁(Threats)。每个分支下列出具体要点。' },
  { key: '5w1h',     label: '5W1H 分析', prompt: '按照 5W1H 框架分析本文档内容，生成思维导图。六个一级分支为：What（是什么）、Why（为什么）、Who（谁）、When（何时）、Where（何处）、How（如何）。' },
  { key: 'fishbone', label: '鱼骨图分析', prompt: '从本文档中识别核心问题，用鱼骨图思路生成思维导图。根节点为核心问题，一级分支为主要原因类别（人、机、料、法、环等），二级分支为具体原因。' },
  { key: 'knowledge',label: '知识图谱',   prompt: '从本文档中提取核心概念及其关系，生成知识图谱式思维导图。根节点为主题，一级分支为核心概念，二级分支为相关概念和关系说明。' },
  { key: 'process',  label: '流程梳理',   prompt: '从本文档中提取流程和步骤，生成流程式思维导图。根节点为流程名称，一级分支按顺序列出各阶段，二级分支为每个阶段的具体步骤和要点。' },
];

// ── 组件 ──
export function MindMapAssistantPanel({
  aiContent,
}: PluginAssistantPanelProps) {
  const host = usePluginHost();
  const thinkingContent = useThinkingContent();

  // ── AI 服务选择 ──
  const settingsStore = useSettingsStore();
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return host.storage.get<string>('_mindmap_assistant_service_id') || '';
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
    return host.storage.get<string>('_mindmap_assistant_prompt') || '';
  });
  const [promptDraft, setPromptDraft] = useState(customPrompt || defaultPrompt);
  const [qaManagerOpen, setQaManagerOpen] = useState(false);
  const [qaPaletteOpen, setQaPaletteOpen] = useState(false);

  // ── 快捷按钮 ──
  const [qaStore, setQaStore] = useState<QuickActionStore>(() => loadQuickActions(host.storage));

  // ── 思维导图数据 ──
  const mindmapData = useMemo((): MindmapPluginData => {
    const raw = host.docData?.getData?.() as MindmapPluginData | undefined;
    return raw || {};
  }, [host.docData]);

  const phase = useMemo(() => detectMindmapPhase(mindmapData), [mindmapData]);
  const contextSummary = useMemo(() => getContextSummary(mindmapData), [mindmapData]);
  const phaseIndicator = useMemo(() => getPhaseIndicator(mindmapData), [mindmapData]);
  const suggestions = useMemo(() => getInputSuggestions(mindmapData), [mindmapData]);
  const inputPlaceholder = useMemo(() => getInputPlaceholder(mindmapData), [mindmapData]);

  // ── 上下文模式（根据阶段自动选择） ──
  const [contextMode, setContextMode] = useState<MindmapContextMode>(() => autoContextMode(phase));
  useEffect(() => { setContextMode(autoContextMode(phase)); }, [phase]);

  // ── 持久化 ──
  const persistSessions = useCallback((updated: AssistantSession[]) => {
    setSessions(updated);
    saveSessions(host.storage, updated);
  }, [host.storage]);

  const updateActiveSession = useCallback((updater: (s: AssistantSession) => AssistantSession) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? updater(s) : s);
      saveSessions(host.storage, updated);
      return updated;
    });
  }, [activeSessionId, host.storage]);

  // ── 新建/切换/删除会话 ──
  const handleNewSession = useCallback(() => {
    const newSess = createSession();
    const updated = [...sessions, newSess];
    persistSessions(updated);
    setActiveId(newSess.id);
    setActiveSessionIdStorage(host.storage, newSess.id);
    setSessionMenuOpen(false);
  }, [sessions, persistSessions, host.storage]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveId(id);
    setActiveSessionIdStorage(host.storage, id);
    setSessionMenuOpen(false);
  }, [host.storage]);

  const handleDeleteSession = useCallback((id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    if (updated.length === 0) {
      const newSess = createSession();
      persistSessions([newSess]);
      setActiveId(newSess.id);
      setActiveSessionIdStorage(host.storage, newSess.id);
    } else {
      persistSessions(updated);
      if (id === activeSessionId) {
        setActiveId(updated[updated.length - 1].id);
        setActiveSessionIdStorage(host.storage, updated[updated.length - 1].id);
      }
    }
  }, [sessions, activeSessionId, persistSessions, host.storage]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming || !aiAvailable) return;

    const userMsg: AssistantMessage = { id: genMsgId(), role: 'user', content: text, timestamp: Date.now() };
    updateActiveSession(s => ({
      ...s,
      messages: [...s.messages, userMsg],
      updatedAt: Date.now(),
      title: s.messages.length === 0 ? text.slice(0, 30) : s.title,
    }));

    setInputValue('');
    setStreaming(true);
    setStreamingContent('');

    const systemPrompt = customPrompt || buildSmartSystemPrompt(mindmapData, aiContent);
    const contextStr = buildContextForMode(mindmapData, contextMode, aiContent);
    const fullSystem = systemPrompt + contextStr;

    const historyMessages = [...(activeSession?.messages || []), userMsg];
    const apiMessages = [
      { role: 'system' as const, content: fullSystem },
      ...historyMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      let fullContent = '';
      await host.ai.chatStream(apiMessages, (chunk: string) => {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }, {
        maxTokens: 4096,
        signal: abortController.signal,
        enableWebSearch,
        enableThinking,
        serviceId: selectedServiceId || undefined,
      });

      const assistantMsg: AssistantMessage = { id: genMsgId(), role: 'assistant', content: fullContent, timestamp: Date.now() };
      updateActiveSession(s => ({
        ...s,
        messages: [...s.messages, assistantMsg],
        updatedAt: Date.now(),
      }));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errMsg: AssistantMessage = {
          id: genMsgId(),
          role: 'assistant',
          content: `❌ 生成失败: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
          isError: true,
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
  }, [streaming, aiAvailable, customPrompt, mindmapData, aiContent, contextMode, activeSession, selectedServiceId, enableWebSearch, enableThinking, host.ai, updateActiveSession]);

  sendMessageRef.current = sendMessage;

  // ── 停止生成 ──
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── 复制消息 ──
  const handleCopyMsg = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ── 重新生成 ──
  const handleRegenerate = useCallback((msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx < 1) return;
    const userMsg = messages[idx - 1];
    if (userMsg.role !== 'user') return;
    updateActiveSession(s => ({
      ...s,
      messages: s.messages.slice(0, idx - 1),
      updatedAt: Date.now(),
    }));
    setTimeout(() => sendMessageRef.current(userMsg.content), 100);
  }, [messages, updateActiveSession]);

  // ── 编辑消息 ──
  const handleStartEdit = useCallback((msg: AssistantMessage) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (!editingMsgId || !editingContent.trim()) return;
    const idx = messages.findIndex(m => m.id === editingMsgId);
    if (idx < 0) return;
    updateActiveSession(s => ({
      ...s,
      messages: s.messages.slice(0, idx),
      updatedAt: Date.now(),
    }));
    setEditingMsgId(null);
    setTimeout(() => sendMessageRef.current(editingContent.trim()), 100);
  }, [editingMsgId, editingContent, messages, updateActiveSession]);

  // ── 快捷操作 ──
  const handleQuickAction = useCallback((item: QuickActionItem) => {
    const updated = recordRecentUsed(qaStore, item.id);
    setQaStore(updated);
    saveQuickActions(host.storage, updated);
    if (item.executionMode === 'direct') {
      window.dispatchEvent(new CustomEvent('mindmap-direct-action', { detail: { actionId: item.directAction || item.id } }));
      return;
    }
    sendMessageRef.current(item.prompt);
  }, [qaStore, host.storage]);

  const handleToggleFavorite = useCallback((itemId: string) => {
    const favs = new Set(qaStore.favorites || []);
    if (favs.has(itemId)) favs.delete(itemId); else favs.add(itemId);
    const updated = { ...qaStore, favorites: Array.from(favs) };
    setQaStore(updated);
    saveQuickActions(host.storage, updated);
  }, [qaStore, host.storage]);

  // Cmd/Ctrl+K 打开命令面板
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

  // ── 清空当前对话 ──
  const handleClear = useCallback(() => {
    updateActiveSession(s => ({ ...s, messages: [], updatedAt: Date.now() }));
  }, [updateActiveSession]);

  // ── 应用到导图 ──
  const containsMarkdownHeadings = useCallback((content: string): boolean => {
    return /^#{1,6}\s+.+/m.test(content);
  }, []);

  const extractMarkdownFromResponse = useCallback((content: string): string => {
    // 优先提取 ```markdown 代码块
    const fenceMatch = content.match(/```(?:markdown|md)?\n([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();
    // 否则提取所有以 # 开头的行及其后续内容
    const lines = content.split('\n');
    const mdLines: string[] = [];
    let inMd = false;
    for (const line of lines) {
      if (/^#{1,6}\s+/.test(line)) { inMd = true; }
      if (inMd) mdLines.push(line);
    }
    return mdLines.join('\n').trim();
  }, []);

  const handleApplyReplace = useCallback((content: string) => {
    const md = extractMarkdownFromResponse(content);
    if (!md) return;
    const jsonData = markdownToMindMapData(md);
    const markdownContent = mindMapDataToMarkdown(jsonData);
    const docData = host.docData;
    if (!docData) return;
    const current = (docData.getData?.() as MindmapPluginData) || {};
    docData.setData({ ...current, markdownContent, jsonData });
    docData.markDirty();
  }, [host.docData, extractMarkdownFromResponse]);

  const handleApplyAppend = useCallback((content: string) => {
    const md = extractMarkdownFromResponse(content);
    if (!md) return;
    const newBranches = markdownToBranch(md);
    if (newBranches.length === 0) return;
    const docData = host.docData;
    if (!docData) return;
    const current = (docData.getData?.() as MindmapPluginData) || {};
    const existingJson: SMNode = (current.jsonData as SMNode) || { data: { text: '思维导图' }, children: [] };
    const merged: SMNode = { ...existingJson, children: [...(existingJson.children || []), ...newBranches] };
    const markdownContent = mindMapDataToMarkdown(merged);
    docData.setData({ ...current, markdownContent, jsonData: merged });
    docData.markDirty();
  }, [host.docData, extractMarkdownFromResponse]);

  // ── 导出聊天 ──
  const handleExportChat = useCallback(() => {
    const md = exportChatAsMarkdown(messages, '思维导图助手');
    navigator.clipboard.writeText(md);
  }, [messages]);

  // ── AI 生成思维导图（从主面板移入） ──
  const [generating, setGenerating] = useState(false);

  const handleAiGenerate = useCallback(async (modeKey: string) => {
    const mode = MINDMAP_MODES.find(m => m.key === modeKey) || MINDMAP_MODES[0];
    const sourceContent = aiContent || '';
    if (!sourceContent.trim()) return;

    setGenerating(true);
    const userMsg: AssistantMessage = {
      id: genMsgId(), role: 'user',
      content: `🧠 AI 生成思维导图（${mode.label}）`,
      timestamp: Date.now(),
    };
    updateActiveSession(s => ({
      ...s,
      messages: [...s.messages, userMsg],
      updatedAt: Date.now(),
      title: s.messages.length === 0 ? `AI 生成：${mode.label}` : s.title,
    }));

    try {
      const systemPrompt = '你是一个专业的知识结构化专家。请将用户提供的文档内容分析后，生成一个 Markdown 格式的思维导图结构。使用 Markdown 标题层级（# ## ### ####）表示层级关系，每个节点一行。只输出 Markdown 标题结构，不要输出其他内容。根节点用 # 开头，子节点依次用 ## ### #### 等。每个节点文字简洁，不超过15字。';
      const userContent = `${mode.prompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}`;

      let fullContent = '';
      const abortController = new AbortController();
      abortRef.current = abortController;
      setStreaming(true);
      setStreamingContent('');

      await host.ai.chatStream([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ], (chunk: string) => {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }, {
        maxTokens: 4096,
        signal: abortController.signal,
        serviceId: selectedServiceId || undefined,
      });

      const assistantMsg: AssistantMessage = {
        id: genMsgId(), role: 'assistant', content: fullContent, timestamp: Date.now(),
      };
      updateActiveSession(s => ({
        ...s,
        messages: [...s.messages, assistantMsg],
        updatedAt: Date.now(),
      }));

      // 自动应用到导图
      const md = extractMarkdownFromResponse(fullContent);
      if (md) {
        const jsonData = markdownToMindMapData(md);
        const markdownContent = mindMapDataToMarkdown(jsonData);
        const docData = host.docData;
        if (docData) {
          const current = (docData.getData?.() as MindmapPluginData) || {};
          docData.setData({ ...current, markdownContent, jsonData });
          docData.markDirty();
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errMsg: AssistantMessage = {
          id: genMsgId(), role: 'assistant',
          content: `❌ 生成失败: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(), isError: true,
        };
        updateActiveSession(s => ({
          ...s,
          messages: [...s.messages, errMsg],
          updatedAt: Date.now(),
        }));
      }
    } finally {
      setGenerating(false);
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [aiContent, selectedServiceId, host.ai, host.docData, updateActiveSession, extractMarkdownFromResponse]);

  // ── 提取标题 ──
  const handleExtractHeadings = useCallback(() => {
    const sourceContent = aiContent || '';
    if (!sourceContent.trim()) return;

    const lines = sourceContent.split('\n');
    const headings: string[] = [`# 文档`];
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.*)/);
      if (match) headings.push(line);
    }

    if (headings.length <= 1) {
      const paragraphs = sourceContent.split(/\n\n+/).filter(p => p.trim()).slice(0, 20);
      for (const p of paragraphs) {
        const firstLine = p.split('\n')[0].trim().slice(0, 40);
        headings.push(`## ${firstLine}`);
      }
    }

    const md = headings.join('\n');
    const jsonData = markdownToMindMapData(md);
    const markdownContent = mindMapDataToMarkdown(jsonData);
    const docData = host.docData;
    if (docData) {
      const current = (docData.getData?.() as MindmapPluginData) || {};
      docData.setData({ ...current, markdownContent, jsonData });
      docData.markDirty();
    }

    const assistantMsg: AssistantMessage = {
      id: genMsgId(), role: 'assistant',
      content: `已从文档标题结构生成思维导图：\n\n\`\`\`markdown\n${md}\n\`\`\``,
      timestamp: Date.now(),
    };
    updateActiveSession(s => ({
      ...s,
      messages: [...s.messages, assistantMsg],
      updatedAt: Date.now(),
      title: s.messages.length === 0 ? '提取标题' : s.title,
    }));
  }, [aiContent, host.docData, updateActiveSession]);

  // ── 自动滚动 ──
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // ── 推荐快捷操作 ──
  const recommendedActions = useMemo(() => {
    const favIds = new Set(qaStore.favorites || []);
    const favorites = qaStore.items.filter(i => favIds.has(i.id) && !i.hidden);
    if (favorites.length > 0) return favorites.slice(0, 6);

    const recentIds = qaStore.recentUsed?.slice(0, 5) || [];
    const recents = recentIds.map(id => qaStore.items.find(i => i.id === id)).filter(Boolean) as QuickActionItem[];
    if (recents.length > 0) return recents.slice(0, 6);

    if (phase === 'blank') {
      return qaStore.items.filter(i => i.categoryId === 'create' && !i.hidden).slice(0, 6);
    }
    return qaStore.items.filter(i => ['expand', 'simplify', 'reorg', 'analyze'].includes(i.categoryId) && !i.hidden).slice(0, 6);
  }, [qaStore, phase]);

  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* ── 顶栏 ── */}
      <div className="flex-shrink-0 border-b">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Brain className="h-4 w-4 text-blue-500" />
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="text-base font-medium truncate max-w-[160px] hover:text-blue-600 transition-colors flex items-center gap-0.5"
                title="思维导图 AI 助手">
                {activeSession?.title || '导图助手'}
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
          <Popover open={promptOpen} onOpenChange={setPromptOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${promptOpen ? 'text-blue-500' : ''}`} title="系统提示词">
                <ScrollText className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">系统提示词</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setPromptDraft(defaultPrompt); }}>
                    <RotateCcw className="h-3 w-3 mr-1" />重置
                  </Button>
                </div>
                <textarea
                  className="w-full h-32 text-xs border rounded-md p-2 resize-none bg-background"
                  value={promptDraft}
                  onChange={e => setPromptDraft(e.target.value)}
                  title="系统提示词"
                  placeholder="输入自定义系统提示词..."
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                    setCustomPrompt(promptDraft);
                    host.storage.set('_mindmap_assistant_prompt', promptDraft);
                    setPromptOpen(false);
                  }}>保存</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setQaManagerOpen(true)} title="快捷操作管理">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClear} title="清除对话">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleExportChat} title="导出对话">
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── 快捷操作栏 ── */}
      <div className="flex items-center gap-1 px-2.5 py-1 border-b bg-muted/20 flex-shrink-0 overflow-x-auto">
        <Button variant="outline" size="sm" className="h-6 text-xs gap-1 shrink-0" onClick={() => setQaPaletteOpen(true)} title="快捷操作 (⌘K)">
          <Zap className="h-3 w-3" />快捷操作
        </Button>
        {/* 建议芯片（有消息且非流式时显示在顶部） */}
        {messages.length > 0 && suggestions.length > 0 && !streaming && (
          suggestions.slice(0, 4).map(chip => (
            <button key={chip.id} onClick={() => sendMessage(chip.prompt)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors hover:bg-accent shrink-0 ${
                chip.variant === 'warning' ? 'border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400'
                  : chip.variant === 'primary' ? 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400'
                  : 'border-border text-muted-foreground'
              }`}>
              {chip.label}
            </button>
          ))
        )}
        {recommendedActions.slice(0, 8).map(action => (
          <Button
            key={action.id}
            variant="ghost"
            size="sm"
            className="h-6 text-xs shrink-0"
            onClick={() => handleQuickAction(action)}
            disabled={streaming}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {/* ── 消息列表 ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <Brain className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">思维导图 AI 助手</p>
            </div>

            {/* AI 生成模式 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">AI 生成思维导图</p>
              <div className="grid grid-cols-2 gap-1.5">
                {MINDMAP_MODES.map(mode => (
                  <Button
                    key={mode.key}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs justify-start gap-1.5"
                    onClick={() => handleAiGenerate(mode.key)}
                    disabled={generating || streaming || !aiAvailable}
                  >
                    <Wand2 className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{mode.label}</span>
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs gap-1.5"
                onClick={handleExtractHeadings}
                disabled={generating || streaming}
              >
                <ListTree className="h-3 w-3" />提取文档标题结构
              </Button>
            </div>

            {/* 快捷操作 */}
            {recommendedActions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-1">快捷操作</p>
                <div className="flex flex-wrap gap-1.5">
                  {recommendedActions.map(action => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleQuickAction(action)}
                    >
                      <Zap className="h-3 w-3 mr-1" />
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
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              {editingMsgId === msg.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full min-h-[60px] text-sm border rounded p-2 bg-background text-foreground resize-none"
                    value={editingContent}
                    onChange={e => setEditingContent(e.target.value)}
                    title="编辑消息"
                    placeholder="编辑消息内容..."
                  />
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
                        <details className="group/think">
                          <summary className="flex items-center gap-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none">
                            <Brain className="h-3 w-3" />
                            <span>深度思考</span>
                            <ChevronDown className="h-3 w-3 transition-transform group-open/think:rotate-180" />
                          </summary>
                          <div className="mt-1 pl-4 border-l-2 border-muted-foreground/20 text-xs text-muted-foreground">
                            <MarkdownPreview content={parsed.thinking} className="text-xs opacity-80" />
                          </div>
                        </details>
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
                    {msg.role === 'assistant' && (
                      <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleRegenerate(msg.id)} title="重新生成">
                        <RefreshCw className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {msg.role === 'assistant' && !msg.isError && containsMarkdownHeadings(parsed?.content || msg.content) && (
                    <div className="flex gap-1 mt-1.5 pt-1.5 border-t border-border/50">
                      <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => handleApplyReplace(parsed?.content || msg.content)}>
                        <Replace className="h-3 w-3" />替换导图
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => handleApplyAppend(parsed?.content || msg.content)}>
                        <FileDown className="h-3 w-3" />追加到导图
                      </Button>
                    </div>
                  )}
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
                <details open className="group">
                  <summary className="flex items-center gap-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none">
                    <Brain className="h-3 w-3 animate-pulse" />
                    <span>思考中...</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-1 pl-4 border-l-2 border-muted-foreground/20 text-xs text-muted-foreground">
                    <MarkdownPreview content={streamParsed.thinking} className="text-xs opacity-80" />
                  </div>
                </details>
              )}
              {streamParsed.content && (
                <MarkdownPreview content={streamParsed.content} className="text-sm" />
              )}
            </div>
          </div>
          );
        })()}

        {streaming && thinkingContent && !streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted/50 border border-dashed text-xs text-muted-foreground">
              <Brain className="h-3 w-3 inline mr-1 animate-pulse" />思考中...
            </div>
          </div>
        )}

        {streaming && !streamingContent && !thinkingContent && (
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
            { key: 'none' as MindmapContextMode, icon: MessageSquareText, label: '随便聊聊' },
            { key: 'structure' as MindmapContextMode, icon: GitBranch, label: '导图结构' },
            { key: 'content' as MindmapContextMode, icon: Eye, label: '文档内容' },
            { key: 'full' as MindmapContextMode, icon: Brain, label: '完整上下文' },
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

        <textarea ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder={inputPlaceholder}
          className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden font-[SimSun,'宋体',sans-serif]"
          title="AI 对话输入" rows={2} disabled={streaming || !aiAvailable}
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
                {enabledServices.map(s => <DropdownMenuItem key={s.id} className="text-sm" onClick={() => { setSelectedServiceId(s.id); host.storage.set('_mindmap_assistant_service_id', s.id); }}>{s.name} {s.id === selectedServiceId && '✓'}</DropdownMenuItem>)}
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
      <QuickActionManagerDialog
        open={qaManagerOpen}
        onOpenChange={setQaManagerOpen}
        store={qaStore}
        onSave={(updated) => { setQaStore(updated); saveQuickActions(host.storage, updated); }}
      />
      <QuickActionCommandPalette
        open={qaPaletteOpen}
        onOpenChange={setQaPaletteOpen}
        store={qaStore}
        onAction={handleQuickAction}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
