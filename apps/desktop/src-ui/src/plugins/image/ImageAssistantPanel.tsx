/**
 * 图片插件专属 AI 助手面板
 *
 * 架构：
 * - imageContext.ts — 智能上下文引擎（分层、token 预算、阶段检测）
 * - imageActionBridge.ts — AI 动作桥接引擎
 * - 本文件 — 主容器：布局 + 渲染 + 用户交互
 *
 * 核心能力：
 * - 复用 MarkdownPreview 富文本渲染
 * - 结构化动作按钮（添加形状、加载 SVG、修改对象等）
 * - 多会话管理 + 消息重新生成/编辑
 * - 联网搜索/深度思考
 * - 上下文模式切换（对象列表/布局/色彩）
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
  Image, RefreshCw, Pencil, MessageSquarePlus,
  X, ScrollText, RotateCcw,
  MessageSquareText, Layers, Palette, Layout,
  Shapes, Type, ImagePlus, Code2, Move, Group,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ImagePluginData } from './types';
import type { ImageAiAction } from './types';
import {
  buildSmartSystemPrompt, getDefaultSystemPrompt, getContextSummary,
  detectImagePhase, buildContextForMode, IMAGE_CONTEXT_MODE_LABELS,
} from './imageContext';
import type { ImageContextMode } from './imageContext';
import type { ImagePhase } from './types';
import { dispatchImageAction } from './imageActionBridge';
import { parseThinkTags } from '@/utils/thinkTagParser';

// ── 会话管理 ──

interface AssistantSession {
  id: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: number;
  updatedAt: number;
}

const SESSIONS_KEY = '_image_assistant_sessions';
const ACTIVE_SESSION_KEY = '_image_assistant_active';

function genSessionId(): string {
  return `isess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
const PHASE_LABELS: Record<ImagePhase, string> = {
  blank: '空白',
  sketching: '构思中',
  composing: '组合中',
  polishing: '精修中',
};
const PHASE_COLORS: Record<ImagePhase, string> = {
  blank: 'text-muted-foreground',
  sketching: 'text-amber-600 dark:text-amber-400',
  composing: 'text-green-600 dark:text-green-400',
  polishing: 'text-blue-600 dark:text-blue-400',
};

// ── 结构化动作解析 ──
interface ParsedAction {
  type: string;
  data: Record<string, unknown>;
}

// ── 上下文模式按钮定义 ──
const CONTEXT_MODES: Array<{ key: ImageContextMode; icon: typeof MessageSquareText; label: string }> = [
  { key: 'none', icon: MessageSquareText, label: '随便聊聊' },
  { key: 'objects', icon: Layers, label: '对象列表' },
  { key: 'layout', icon: Layout, label: '布局分析' },
  { key: 'colors', icon: Palette, label: '色彩搭配' },
];

// ── 组件 ──
export function ImageAssistantPanel({
  aiContent,
}: PluginAssistantPanelProps) {
  const host = usePluginHost();
  const { t } = useTranslation('plugin-image');
  const thinkingContent = useThinkingContent();

  // ── AI 服务选择 ──
  const settingsStore = useSettingsStore();
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return host.storage.get<string>('_image_assistant_service_id') || '';
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
    return host.storage.get<string>('_image_assistant_prompt') || '';
  });
  const [promptDraft, setPromptDraft] = useState(customPrompt || defaultPrompt);

  // ── 上下文模式 ──
  const [contextMode, setContextMode] = useState<ImageContextMode>('none');

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

  // 监听动作执行结果
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ ok: boolean; message: string; actionType?: string }>).detail;
      if (!detail) return;
      const prefix = detail.ok ? '✅' : '❌';
      appendMessage({
        id: genMsgId(),
        role: 'assistant',
        content: `${prefix} **执行结果** — ${detail.message}`,
        timestamp: Date.now(),
      });
    };
    window.addEventListener('image-ai-apply-result', handler);
    return () => window.removeEventListener('image-ai-apply-result', handler);
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
    const minH = 60;
    const maxH = 160;
    el.style.height = Math.max(minH, Math.min(el.scrollHeight, maxH)) + 'px';
  }, [inputValue]);

  // ── 读取图片插件上下文 ──
  const getImageData = useCallback((): ImagePluginData => {
    const raw = host.storage.get<Record<string, unknown>>('');
    if (!raw) return { canvases: [], activeCanvasId: '', version: 1 };
    return raw as unknown as ImagePluginData;
  }, [host.storage]);

  // ── 定时刷新上下文 ──
  const [imageData, setImageData] = useState<ImagePluginData>(() => getImageData());
  useEffect(() => {
    const tick = () => setImageData(getImageData());
    tick();
    const timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
  }, [getImageData]);
  const imagePhase = useMemo(() => detectImagePhase(imageData), [imageData]);
  const contextSummary = useMemo(() => getContextSummary(imageData), [imageData]);

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
      const currentImageData = getImageData();
      const docContent = aiContent || host.content.getDocumentContent();
      const sysContent = buildSmartSystemPrompt(currentImageData, docContent || '', customPrompt?.trim() || undefined);

      const latestMsgs = getLatestMessages();
      const contextMsgs: Array<{ role: string; content: string }> = [
        { role: 'system', content: sysContent },
      ];

      // 注入上下文模式
      if (contextMode !== 'none') {
        const modeContent = buildContextForMode(currentImageData, contextMode);
        if (modeContent) {
          const modeLabel = IMAGE_CONTEXT_MODE_LABELS[contextMode];
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
  }, [streaming, aiAvailable, customPrompt, getImageData, aiContent, host, selectedServiceId, enableWebSearch, enableThinking, providerCaps, appendMessage, getLatestMessages, contextMode]);
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
    const md = exportChatAsMarkdown(messages, t('assistantTitle', { defaultValue: '图片 AI 助手' }));
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `图片AI对话_${new Date().toISOString().slice(0, 10)}.md`;
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
    host.storage.set('_image_assistant_prompt', val);
  }, [promptDraft, defaultPrompt, host.storage]);

  const handlePromptReset = useCallback(() => {
    setPromptDraft(defaultPrompt);
    setCustomPrompt('');
    host.storage.set('_image_assistant_prompt', '');
  }, [defaultPrompt, host.storage]);

  // ── AI 服务切换 ──
  const handleServiceChange = useCallback((serviceId: string) => {
    setSelectedServiceId(serviceId);
    host.storage.set('_image_assistant_service_id', serviceId);
  }, [host.storage]);

  // ── 应用画布动作 ──
  const applyImageAction = useCallback((action: ParsedAction) => {
    dispatchImageAction({ action: action.type as ImageAiAction['action'], ...action.data });
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

  // ── 渲染动作按钮 ──
  const renderActionBlock = useCallback((action: ParsedAction, idx: number) => {
    if (action.type === 'add_shape') {
      const shapeType = (action.data.shapeType as string) || 'rect';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyImageAction(action)}>
          <Shapes className="h-3 w-3" />添加{shapeType}
        </Button>
      );
    }
    if (action.type === 'add_text') {
      const text = (action.data.text as string) || '文本';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyImageAction(action)}>
          <Type className="h-3 w-3" />添加文本「{text.slice(0, 10)}」
        </Button>
      );
    }
    if (action.type === 'add_image') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyImageAction(action)}>
          <ImagePlus className="h-3 w-3" />添加图片
        </Button>
      );
    }
    if (action.type === 'load_svg' || action.type === 'generate_diagram') {
      const desc = (action.data.description as string) || 'SVG 图形';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyImageAction(action)}>
          <Code2 className="h-3 w-3" />加载到画布{action.type === 'generate_diagram' ? `：${desc.slice(0, 15)}` : ''}
        </Button>
      );
    }
    if (action.type === 'modify_object') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyImageAction(action)}>
          <Pencil className="h-3 w-3" />修改选中对象
        </Button>
      );
    }
    if (action.type === 'delete_objects') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => applyImageAction(action)}>
          <Trash2 className="h-3 w-3" />删除选中对象
        </Button>
      );
    }
    if (action.type === 'set_canvas_bg') {
      const color = (action.data.color as string) || '#fff';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyImageAction(action)}>
          <Palette className="h-3 w-3" />设置背景色 {color}
        </Button>
      );
    }
    if (action.type === 'align_objects') {
      const alignment = (action.data.alignment as string) || 'left';
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyImageAction(action)}>
          <Move className="h-3 w-3" />对齐（{alignment}）
        </Button>
      );
    }
    if (action.type === 'group_objects') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyImageAction(action)}>
          <Group className="h-3 w-3" />组合选中对象
        </Button>
      );
    }
    return null;
  }, [applyImageAction]);

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
        } else {
          // 不是动作 JSON，保留为文本
          segments.push({ type: 'text', content: '```json\n' + code + '\n```' });
        }
      } catch {
        segments.push({ type: 'text', content: '```json\n' + code + '\n```' });
      }
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
    const placeholders: Record<ImagePhase, string> = {
      blank: '描述你需要的图形，我来帮你绘制...',
      sketching: '继续添加元素？或需要调整现有对象？',
      composing: '需要对齐排版、调整布局或配色？',
      polishing: '需要微调细节，还是导出最终作品？',
    };
    return placeholders[imagePhase] || placeholders.blank;
  }, [imagePhase]);

  // ── 渲染 ──
  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* ═══ 顶部 ═══ */}
      <div className="flex-shrink-0 border-b">
        {/* 标题栏 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Image className="h-4 w-4 text-blue-500" />

          {/* 会话管理 */}
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="text-base font-medium truncate max-w-[160px] hover:text-blue-600 transition-colors flex items-center gap-0.5"
                title={t('assistantTitle', { defaultValue: '图片 AI 助手' })}>
                {activeSession?.title || t('assistantTitle', { defaultValue: '图片 AI 助手' })}
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
                      <button className="opacity-50 hover:opacity-100 hover:text-destructive" title="删除会话" aria-label="删除会话" onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id); }}>
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

          {/* 阶段指示器 */}
          <span className={`text-xs ${PHASE_COLORS[imagePhase]}`}>
            {PHASE_LABELS[imagePhase]}
            {contextSummary.objectCount > 0 && ` · ${contextSummary.objectCount}个对象`}
          </span>

          {/* 工具按钮 */}
          <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${promptOpen ? 'text-blue-500' : ''}`}
            onClick={() => setPromptOpen(v => !v)}
            title="系统提示词">
            <ScrollText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClear} title="清除对话">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleExport} title="导出对话">
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
        </div>

        {/* 系统提示词编辑区（可折叠） */}
        {promptOpen && (
          <div className="px-2 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">系统提示词</span>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-0.5" onClick={handlePromptReset}>
                <RotateCcw className="h-3 w-3" />恢复默认
              </Button>
            </div>
            <textarea value={promptDraft} onChange={e => setPromptDraft(e.target.value)} onBlur={handlePromptSave}
              className="w-full resize-y rounded-md border bg-muted/30 px-2 py-1.5 text-xs font-[SimSun,'宋体',sans-serif] focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] max-h-[200px]"
              rows={5} placeholder={defaultPrompt} title="系统提示词" />
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
            <Image className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-base">图片 AI 助手</p>
            <p className="mt-1 opacity-70">图形绘制 · SVG 生成 · 布局优化 · 配色建议</p>
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
                    <div className="bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    <div className="absolute -left-16 top-0 hidden group-hover:flex items-center gap-0.5">
                      <button className="p-0.5 rounded hover:bg-accent" title="编辑消息" onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content); }}>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button className="p-0.5 rounded hover:bg-accent" title="复制" onClick={() => handleCopy(msg.content, msg.id)}>
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
          {CONTEXT_MODES.map(mode => (
            <button key={mode.key}
              onClick={() => setContextMode(mode.key)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors border ${
                contextMode === mode.key
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400 dark:border-blue-400/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
              }`}
              title={mode.key === 'none'
                ? '不附加特定上下文'
                : `将「${mode.label}」作为 AI 上下文`}
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
          title="AI 对话输入"
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
          <span title={providerCaps.webSearch ? (enableWebSearch ? '联网搜索：已开启' : '联网搜索：已关闭') : '当前模型不支持联网'}>
            <Button variant="ghost" size="sm"
              className={`h-7 px-1.5 ${enableWebSearch && providerCaps.webSearch ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
              disabled={!providerCaps.webSearch}
              onClick={() => setEnableWebSearch(v => !v)}>
              <Globe className="h-3.5 w-3.5" />
            </Button>
          </span>

          {/* 深度思考 */}
          <span title={providerCaps.thinking ? (enableThinking ? '深度思考：已开启' : '深度思考：已关闭') : '当前模型不支持深度思考'}>
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
                  title="切换 AI 服务">
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
              title="停止生成">
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="default" size="icon"
              className="h-7 w-7 flex-shrink-0 bg-blue-600 hover:bg-blue-700"
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || !aiAvailable}
              title="发送">
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
