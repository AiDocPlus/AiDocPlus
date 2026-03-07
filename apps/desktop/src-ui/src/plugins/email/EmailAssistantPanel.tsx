/**
 * 邮件插件专属 AI 助手面板（大师级重构版）
 *
 * 架构：
 * - assistantContext.ts — 智能上下文引擎（分层、token 预算、阶段检测）
 * - assistantActions.ts — 结构化动作协议引擎（10 种动作）
 * - assistantSessions.ts — 多会话管理
 * - 本文件 — 主容器：布局 + 渲染 + 用户交互
 *
 * 核心能力：
 * - 复用 MarkdownPreview 富文本渲染（GFM + 代码高亮 + 数学公式）
 * - 复用 parseThinkTags 思考内容显示（折叠面板）
 * - HTML 邮件内联预览（iframe sandbox）
 * - 结构化动作按钮（预检报告卡片、主题候选列表等）
 * - 多会话管理 + 消息重新生成/编辑
 * - 联网搜索/深度思考真正接入 API
 * - 上下文可视化面板 + 应用后可撤销
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
  Sparkles, ScrollText, RotateCcw, ChevronDown, Globe, Brain,
  Wand2, ShieldCheck, Mail, PenLine, Plus,
  ArrowRight, UserPlus, ListCollapse, Lightbulb,
  RefreshCw, Pencil, Eye, Code2, MessageSquarePlus,
  X, Info, FileText, Users, Settings, LayoutTemplate, MessageSquareText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { EmailStorageData } from './types';
import { buildSmartSystemPrompt, getDefaultSystemPrompt, getContextSummary, detectEmailPhase, buildContextForMode, EMAIL_CONTEXT_MODE_LABELS } from './assistantContext';
import type { EmailPhase, EmailContextMode } from './assistantContext';
import { parseThinkTags } from '@/utils/thinkTagParser';
import {
  extractPrecheckReport, extractSubjectOptions,
  PRECHECK_CATEGORY_LABELS, PRECHECK_STATUS_ICON,
} from './assistantActions';
import type { ParsedAction } from './assistantActions';
import {
  loadSessions, getActiveSessionId, setActiveSessionId,
  saveSession, createSession, deleteSession, renameSession, findSession,
  getOrCreateActiveSession, migrateOldMessages,
} from './assistantSessions';
import type { AssistantSession } from './assistantSessions';
import { loadQuickActions, saveQuickActions } from './quickActionDefs';
import type { QuickActionStore } from './quickActionDefs';
import { QuickActionManagerDialog } from './dialogs/QuickActionManagerDialog';

// ── 主题解析 ──
function resolveTheme(): 'light' | 'dark' {
  const t = useSettingsStore.getState().ui?.theme;
  if (t === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return t === 'dark' ? 'dark' : 'light';
}

// ── 邮件阶段标签 ──
const PHASE_LABELS: Record<EmailPhase, string> = {
  blank: '空白',
  drafting: '草拟中',
  reviewing: '审阅中',
  ready: '就绪',
};
const PHASE_COLORS: Record<EmailPhase, string> = {
  blank: 'text-muted-foreground',
  drafting: 'text-amber-600 dark:text-amber-400',
  reviewing: 'text-blue-600 dark:text-blue-400',
  ready: 'text-green-600 dark:text-green-400',
};

// ── 组件 ──
export function EmailAssistantPanel({
  aiContent,
}: PluginAssistantPanelProps) {
  const host = usePluginHost();
  const { t } = useTranslation('plugin-email');
  const thinkingContent = useThinkingContent();

  // ── AI 服务选择 ──
  const settingsStore = useSettingsStore();
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return host.storage.get<string>('_assistant_service_id') || '';
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
  const [sessions, setSessions] = useState<AssistantSession[]>(() => {
    migrateOldMessages(host.storage);
    return loadSessions(host.storage);
  });
  const [activeSessionId, setActiveId] = useState<string>(() => {
    const session = getOrCreateActiveSession(host.storage);
    return session.id;
  });
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || (sessions.length > 0 ? sessions[0] : null);
  }, [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];

  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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

  // ── HTML 预览切换 ──
  const [htmlPreviewMode, setHtmlPreviewMode] = useState<Record<string, boolean>>({});

  // ── 提示词 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const defaultPrompt = useMemo(() => getDefaultSystemPrompt(), []);
  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    return host.storage.get<string>('_assistant_prompt') || '';
  });
  const [promptDraft, setPromptDraft] = useState(customPrompt || defaultPrompt);

  // ── 上下文面板 ──
  const [contextPanelOpen, setContextPanelOpen] = useState(false);

  // ── 上下文模式 ──
  const [emailContextMode, setEmailContextMode] = useState<EmailContextMode>('none');

  // ── 快捷按钮管理器 ──
  const [qaStore, setQaStore] = useState<QuickActionStore>(() => loadQuickActions(host.storage));
  const [qaManagerOpen, setQaManagerOpen] = useState(false);
  const handleQaSave = useCallback((newStore: QuickActionStore) => {
    saveQuickActions(host.storage, newStore);
    setQaStore(newStore);
  }, [host.storage]);

  // ── 更新消息到会话（直接从 storage 读取最新 session，避免闭包竞态） ──
  const updateMessages = useCallback((newMessages: AssistantMessage[]) => {
    const currentSessions = loadSessions(host.storage);
    const currentActiveId = getActiveSessionId(host.storage);
    const target = currentSessions.find(s => s.id === currentActiveId);
    if (!target) return;
    const updated = { ...target, messages: newMessages, updatedAt: Date.now() };
    saveSession(host.storage, updated);
    setSessions(loadSessions(host.storage));
  }, [host.storage]);

  /** 从 storage 读取当前会话的最新消息（避免闭包中 messages 过期） */
  const getLatestMessages = useCallback((): AssistantMessage[] => {
    const activeId = getActiveSessionId(host.storage);
    if (!activeId) return [];
    const sess = findSession(host.storage, activeId);
    return sess?.messages || [];
  }, [host.storage]);

  /** 追加单条消息到当前会话（从 storage 读取最新再追加，彻底避免闭包竞态） */
  const appendMessage = useCallback((msg: AssistantMessage) => {
    const latest = getLatestMessages();
    updateMessages([...latest, msg]);
  }, [getLatestMessages, updateMessages]);

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
    const maxH = 160;
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
  }, [inputValue]);

  // ── 读取邮件上下文 ──
  const getEmailData = useCallback((): EmailStorageData => {
    return host.storage.get<EmailStorageData>('emailData') || {};
  }, [host.storage]);

  // ── 邮件阶段 & 上下文摘要（定时刷新） ──
  const [emailData, setEmailData] = useState<EmailStorageData>(() => getEmailData());
  useEffect(() => {
    const tick = () => setEmailData(getEmailData());
    tick();
    const timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
  }, [getEmailData]);
  const emailPhase = useMemo(() => detectEmailPhase(emailData), [emailData]);
  const contextSummary = useMemo(() => getContextSummary(emailData), [emailData]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return;
    if (!aiAvailable) return;

    const userMsg: AssistantMessage = {
      id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now(),
    };
    // 用 appendMessage 追加用户消息（从 storage 读最新，避免闭包竞态）
    appendMessage(userMsg);
    setInputValue('');
    setStreaming(true);
    setStreamingContent('');

    const abort = new AbortController();
    abortRef.current = abort;

    let accumulated = '';
    try {
      const currentEmailData = getEmailData();
      const docContent = aiContent || host.content.getDocumentContent();
      const sysContent = buildSmartSystemPrompt(currentEmailData, docContent || '', customPrompt?.trim() || undefined);

      // 从 storage 读取最新消息构建上下文（包含刚追加的 userMsg）
      const latestMsgs = getLatestMessages();
      const contextMsgs: Array<{ role: string; content: string }> = [
        { role: 'system', content: sysContent },
      ];

      // 注入上下文模式对应的内容（作为额外 system message）
      if (emailContextMode !== 'none') {
        const modeContent = buildContextForMode(currentEmailData, emailContextMode);
        if (modeContent) {
          const modeLabel = EMAIL_CONTEXT_MODE_LABELS[emailContextMode];
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

      // 流式完成：从 storage 读最新消息再追加助手回复（彻底避免闭包竞态）
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
  }, [streaming, aiAvailable, customPrompt, getEmailData, aiContent, host, selectedServiceId, enableWebSearch, enableThinking, providerCaps, appendMessage, getLatestMessages, emailContextMode]);
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
    saveSession(host.storage, newSess);
    setActiveSessionId(host.storage, newSess.id);
    setActiveId(newSess.id);
    setSessions(loadSessions(host.storage));
    setSessionMenuOpen(false);
  }, [host.storage]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveSessionId(host.storage, id);
    setActiveId(id);
    setSessionMenuOpen(false);
  }, [host.storage]);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(host.storage, id);
    const remaining = loadSessions(host.storage);
    setSessions(remaining);
    if (id === activeSessionId) {
      if (remaining.length > 0) {
        setActiveSessionId(host.storage, remaining[0].id);
        setActiveId(remaining[0].id);
      } else {
        handleNewSession();
      }
    }
  }, [host.storage, activeSessionId, handleNewSession]);

  const handleRenameSession = useCallback((id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    renameSession(host.storage, id, renameValue);
    setSessions(loadSessions(host.storage));
    setRenamingId(null);
    setRenameValue('');
  }, [host.storage, renameValue]);

  // ── 清除当前对话 ──
  const handleClear = useCallback(() => {
    updateMessages([]);
    setStreamingContent('');
  }, [updateMessages]);

  // ── 导出 ──
  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const md = exportChatAsMarkdown(messages, t('assistantTitle', { defaultValue: '邮件 AI 助手' }));
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `邮件AI对话_${new Date().toISOString().slice(0, 10)}.md`;
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
    host.storage.set('_assistant_prompt', val);
  }, [promptDraft, defaultPrompt, host.storage]);

  const handlePromptReset = useCallback(() => {
    setPromptDraft(defaultPrompt);
    setCustomPrompt('');
    host.storage.set('_assistant_prompt', '');
  }, [defaultPrompt, host.storage]);

  // ── AI 服务切换 ──
  const handleServiceChange = useCallback((serviceId: string) => {
    setSelectedServiceId(serviceId);
    host.storage.set('_assistant_service_id', serviceId);
  }, [host.storage]);

  // ── 应用到邮件 ──
  const applyToEmail = useCallback((field: 'body' | 'subject', value: string, mode: 'replace' | 'append' | 'insert' = 'replace') => {
    window.dispatchEvent(new CustomEvent('email-ai-apply', { detail: { field, value, mode } }));
  }, []);

  // ── 添加账户 ──
  const addAccount = useCallback((accountData: Record<string, unknown>) => {
    const id = `acct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const account = { id, ...accountData };
    window.dispatchEvent(new CustomEvent('email-ai-add-account', { detail: { account } }));
  }, []);

  // ── 添加签名 ──
  const addSignature = useCallback((name: string, content: string) => {
    window.dispatchEvent(new CustomEvent('email-ai-add-signature', { detail: { signature: { name, content } } }));
  }, []);

  // ── 添加收件人 ──
  const addRecipient = useCallback((field: string, email: string) => {
    window.dispatchEvent(new CustomEvent('email-ai-add-recipient', { detail: { field, email } }));
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
    const truncated = messages.slice(0, idx);
    updateMessages(truncated);
    setEditingMsgId(null);
    setTimeout(() => sendMessageRef.current(editingContent.trim()), 100);
  }, [editingMsgId, editingContent, messages, updateMessages]);

  // ── 快捷操作处理（基于管理器 store） ──
  const handleQuickAction = useCallback((itemId: string) => {
    const item = qaStore.items.find(i => i.id === itemId);
    if (!item || !item.prompt) return;

    const data = getEmailData();
    const body = data.emailBody || '';
    const bodyText = body.replace(/<[^>]*>/g, '').trim();

    // 根据 contextMode 自动切换上下文
    if (item.contextMode === 'body') setEmailContextMode('body');
    else if (item.contextMode === 'account') setEmailContextMode('account');
    else if (item.contextMode === 'recipients') setEmailContextMode('recipients');
    else if (item.contextMode === 'template') setEmailContextMode('template');

    // 需要正文但正文为空时提示
    if (item.requiresBody && !bodyText) {
      sendMessage(t('assistantBodyEmpty', { defaultValue: '当前邮件正文为空，请先撰写邮件正文。' }));
      return;
    }

    sendMessage(item.prompt);
  }, [qaStore, getEmailData, sendMessage, t, setEmailContextMode]);

  // ── 排序后的分类和项（用于渲染） ──
  const sortedQaCategories = useMemo(() =>
    [...qaStore.categories].sort((a, b) => a.order - b.order),
  [qaStore.categories]);

  const getQaItemsForCategory = useCallback((catId: string) =>
    qaStore.items.filter(i => i.categoryId === catId && !i.hidden).sort((a, b) => a.order - b.order),
  [qaStore.items]);

  // ── 渲染动作按钮 ──
  const renderActionBlock = useCallback((action: ParsedAction, idx: number) => {
    if (action.type === 'add_account') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => { const { action: _a, ...rest } = action.data; addAccount(rest); }}>
          <UserPlus className="h-3 w-3" />{t('assistantAddAccount', { defaultValue: '添加此账户' })}
        </Button>
      );
    }
    if (action.type === 'add_signature') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => addSignature(action.data.name as string, action.data.content as string)}>
          <PenLine className="h-3 w-3" />{t('assistantAddSignature', { defaultValue: '添加此签名' })}
        </Button>
      );
    }
    if (action.type === 'apply_subject') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => applyToEmail('subject', action.data.value as string)}>
          <Lightbulb className="h-3 w-3" />{t('assistantApplyToSubject', { defaultValue: '设置为主题' })}
        </Button>
      );
    }
    if (action.type === 'add_recipient') {
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={() => addRecipient(action.data.field as string, action.data.email as string)}>
          <UserPlus className="h-3 w-3" />{t('assistantAddRecipient', { defaultValue: '添加收件人' })}：{action.data.email as string}
        </Button>
      );
    }
    if (action.type === 'apply_body') {
      const htmlValue = action.data.value as string;
      const mode = (action.data.mode as string) || 'replace';
      const modeLabel = mode === 'append' ? t('aiApplyAppend', { defaultValue: '追加到末尾' })
        : mode === 'insert' ? t('aiApplyInsert', { defaultValue: '插入到开头' })
        : t('aiApplyReplace', { defaultValue: '替换正文' });
      return (
        <Button key={idx} variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 border-blue-300 text-blue-600 hover:bg-blue-500/10"
          onClick={() => applyToEmail('body', htmlValue, mode as 'replace' | 'append' | 'insert')}>
          <ArrowRight className="h-3 w-3" />{modeLabel}
        </Button>
      );
    }
    if (action.type === 'subject_options') {
      const options = extractSubjectOptions(action.data);
      if (options.length === 0) return null;
      return (
        <div key={idx} className="my-2 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{t('assistantSubjectOptions', { defaultValue: '主题候选（点击应用）' })}</p>
          {options.map((opt, i) => (
            <button key={i} className="w-full text-left px-2.5 py-1.5 rounded border text-xs hover:bg-accent hover:border-blue-300 transition-colors"
              onClick={() => applyToEmail('subject', opt)}>
              {opt}
            </button>
          ))}
        </div>
      );
    }
    if (action.type === 'precheck_report') {
      const report = extractPrecheckReport(action.data);
      if (!report) return null;
      return (
        <div key={idx} className="my-2 rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b">
            <span className="text-xs font-medium">{t('assistantPrecheckReport', { defaultValue: '发送前检查报告' })}</span>
            <span className={`text-xs font-bold ${report.score >= 8 ? 'text-green-600' : report.score >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
              {report.score}/10
            </span>
          </div>
          <div className="p-2 space-y-1">
            {report.checks.map((check, ci) => (
              <div key={ci} className="flex items-start gap-1.5 text-xs">
                <span className="flex-shrink-0">{PRECHECK_STATUS_ICON[check.status] || '?'}</span>
                <div className="flex-1">
                  <span className="font-medium">{PRECHECK_CATEGORY_LABELS[check.category] || check.category}</span>
                  <span className="text-muted-foreground ml-1">{check.detail}</span>
                  {check.suggestion && (
                    <p className="text-blue-600 dark:text-blue-400 mt-0.5">{t('assistantSuggestion', { defaultValue: '建议' })}：{check.suggestion}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  }, [t, addAccount, addSignature, applyToEmail, addRecipient]);

  // ── 内容分段解析：按出现顺序拆分为 text/html/action 段 ──
  const parseContentSegments = useCallback((text: string, msgId: string) => {
    type Segment =
      | { type: 'text'; content: string }
      | { type: 'html'; code: string; blockId: string }
      | { type: 'action'; action: ParsedAction };
    const segments: Segment[] = [];
    // 匹配 ```html 和 ```json 代码块
    const blockRe = /```(html|json)\s*\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let htmlIdx = 0;
    while ((match = blockRe.exec(text)) !== null) {
      // 前方文本段
      if (match.index > lastIndex) {
        const t = text.slice(lastIndex, match.index).replace(/\n{3,}/g, '\n\n').trim();
        if (t) segments.push({ type: 'text', content: t });
      }
      const lang = match[1];
      const code = match[2].trim();
      if (lang === 'html') {
        segments.push({ type: 'html', code, blockId: `${msgId}_html_${htmlIdx++}` });
      } else if (lang === 'json') {
        // 尝试解析为结构化动作
        try {
          const obj = JSON.parse(code);
          if (obj && typeof obj === 'object' && obj.action) {
            segments.push({ type: 'action', action: { type: obj.action, data: obj, raw: code } });
          }
          // 不识别的 JSON 静默忽略（不显示原始代码）
        } catch {
          // 非法 JSON 静默忽略
        }
      }
      lastIndex = match.index + match[0].length;
    }
    // 尾部文本段
    if (lastIndex < text.length) {
      const t = text.slice(lastIndex).replace(/\n{3,}/g, '\n\n').trim();
      if (t) segments.push({ type: 'text', content: t });
    }
    return segments;
  }, []);

  // ── 渲染单个 HTML 预览块 ──
  const renderHtmlPreviewBlock = useCallback((code: string, blockId: string) => {
    const isPreview = htmlPreviewMode[blockId] !== false;
    return (
      <div key={blockId} className="my-1.5 rounded border bg-muted/40 overflow-hidden">
        <div className="flex items-center justify-between px-2 py-0.5 bg-muted/60 border-b gap-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground font-mono">html</span>
            <button className={`text-xs px-1.5 py-0.5 rounded ${isPreview ? 'bg-blue-500/10 text-blue-600' : 'hover:bg-accent'}`}
              onClick={() => setHtmlPreviewMode(prev => ({ ...prev, [blockId]: true }))}>
              <Eye className="h-3 w-3 inline mr-0.5" />{t('assistantPreview', { defaultValue: '预览' })}
            </button>
            <button className={`text-xs px-1.5 py-0.5 rounded ${!isPreview ? 'bg-blue-500/10 text-blue-600' : 'hover:bg-accent'}`}
              onClick={() => setHtmlPreviewMode(prev => ({ ...prev, [blockId]: false }))}>
              <Code2 className="h-3 w-3 inline mr-0.5" />{t('assistantSource', { defaultValue: '源码' })}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
                  <ArrowRight className="h-3 w-3" />{t('assistantApplyToBody', { defaultValue: '应用到正文' })}
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1" align="end">
                <Button variant="ghost" size="sm" className="w-full justify-start h-7 px-2 text-xs"
                  onClick={() => applyToEmail('body', code, 'replace')}>{t('aiApplyReplace', { defaultValue: '替换正文' })}</Button>
                <Button variant="ghost" size="sm" className="w-full justify-start h-7 px-2 text-xs"
                  onClick={() => applyToEmail('body', code, 'append')}>{t('aiApplyAppend', { defaultValue: '追加到末尾' })}</Button>
                <Button variant="ghost" size="sm" className="w-full justify-start h-7 px-2 text-xs"
                  onClick={() => applyToEmail('body', code, 'insert')}>{t('aiApplyInsert', { defaultValue: '插入到开头' })}</Button>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => handleCopy(code, blockId)}>
              {copiedId === blockId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        {isPreview ? (
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:SimSun,'宋体',sans-serif;font-size:14px;padding:8px;margin:0;color:#333;}</style></head><body>${code}</body></html>`}
            sandbox="allow-same-origin"
            className="w-full border-0 min-h-[60px] max-h-[300px] bg-white"
            onLoad={(e) => {
              const iframe = e.target as HTMLIFrameElement;
              if (iframe.contentDocument) {
                iframe.style.height = Math.min(iframe.contentDocument.body.scrollHeight + 16, 300) + 'px';
              }
            }}
          />
        ) : (
          <pre className="p-2 text-xs font-mono overflow-x-auto overflow-y-auto max-h-60 whitespace-pre select-text">{code}</pre>
        )}
      </div>
    );
  }, [t, copiedId, handleCopy, applyToEmail, htmlPreviewMode]);

  // ── 渲染助手消息内容（按出现顺序：text → html 预览框 → text → ...） ──
  const renderAssistantContent = useCallback((rawContent: string, msgId: string) => {
    // 防御性解析 think 标签（chatStream 通常已去除，但保存的消息可能残留）
    const parsed = parseThinkTags(rawContent);
    const thinkingText = parsed.thinking;
    const cleanContent = parsed.content;
    const theme = resolveTheme();

    const segments = parseContentSegments(cleanContent, msgId);

    return (
      <div className="space-y-1">
        {/* 思考内容（直接显示，不折叠） */}
        {thinkingText && (
          <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap">
            {thinkingText}
          </div>
        )}
        {/* 按出现顺序渲染各段 */}
        {segments.map((seg, i) => {
          if (seg.type === 'text') {
            return (
              <div key={i} className="text-sm [&_.markdown-preview]:p-0 [&_.markdown-preview]:text-inherit">
                <MarkdownPreview content={seg.content} theme={theme} className="!p-0" fontSize={13} />
              </div>
            );
          }
          if (seg.type === 'html') {
            return renderHtmlPreviewBlock(seg.code, seg.blockId);
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
  }, [parseContentSegments, renderHtmlPreviewBlock, renderActionBlock]);

  // ── 动态 placeholder ──
  const inputPlaceholder = useMemo(() => {
    const placeholders: Record<EmailPhase, string> = {
      blank: t('placeholderBlank', { defaultValue: '描述你要发什么邮件，我来帮你撰写...' }),
      drafting: t('placeholderDrafting', { defaultValue: '补充邮件信息，或让我帮你撰写正文...' }),
      reviewing: t('placeholderReviewing', { defaultValue: '需要润色、翻译、还是检查？' }),
      ready: t('placeholderReady', { defaultValue: '还需要什么调整？或直接发送' }),
    };
    return placeholders[emailPhase] || placeholders.blank;
  }, [emailPhase, t]);

  // ── 渲染 ──
  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* ═══ 顶部 ═══ */}
      <div className="flex-shrink-0 border-b">
        {/* 标题栏 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Mail className="h-4 w-4 text-blue-500" />

          {/* 会话管理 */}
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="text-sm font-medium truncate max-w-[140px] hover:text-blue-600 transition-colors flex items-center gap-0.5">
                {activeSession?.title || t('assistantTitle', { defaultValue: '邮件 AI 助手' })}
                <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="bottom" className="w-56 p-1">
              <Button variant="ghost" size="sm" className="w-full justify-start h-8 px-2 text-xs gap-1.5 mb-1"
                onClick={handleNewSession}>
                <Plus className="h-3 w-3" />{t('assistantNewSession', { defaultValue: '新建对话' })}
              </Button>
              <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                {sessions.map(sess => (
                  <div key={sess.id} className={`group flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                    sess.id === activeSessionId ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'hover:bg-accent'
                  }`}>
                    {renamingId === sess.id ? (
                      <input className="flex-1 text-xs border rounded px-1 py-0.5 bg-transparent"
                        value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameSession(sess.id)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameSession(sess.id); if (e.key === 'Escape') setRenamingId(null); }}
                        autoFocus />
                    ) : (
                      <>
                        <button className="flex-1 text-left truncate" onClick={() => handleSwitchSession(sess.id)}
                          onDoubleClick={() => { setRenamingId(sess.id); setRenameValue(sess.title); }}>
                          <MessageSquarePlus className="h-3 w-3 inline mr-1 opacity-40" />{sess.title}
                        </button>
                        <button className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded"
                          onClick={(e) => { e.stopPropagation(); handleDeleteSession(sess.id); }}
                          title={t('assistantDeleteSession', { defaultValue: '删除' })}>
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {sessions.length > 1 && (
                <p className="text-xs text-muted-foreground px-2 py-1 border-t mt-1">{sessions.length} 个对话</p>
              )}
            </PopoverContent>
          </Popover>

          {/* AI 服务选择器 */}
          {enabledServices.length >= 2 && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button"
                  className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 max-w-[120px]"
                  title={t('assistantSwitchService', { defaultValue: '切换 AI 服务' })}>
                  <span className="truncate">{effectiveService ? effectiveService.name : t('assistantGlobalDefault', { defaultValue: '全局默认' })}</span>
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="bottom" className="w-52 p-1 max-h-[300px] overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">{t('assistantSelectService', { defaultValue: '选择 AI 服务' })}</p>
                <button className={`w-full text-left px-2 py-1.5 rounded text-sm cursor-pointer transition-colors flex items-center gap-1.5 ${!selectedServiceId ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-accent'}`}
                  onClick={() => handleServiceChange('')}>
                  {!selectedServiceId && <Check className="h-3 w-3 flex-shrink-0" />}
                  <span className={!selectedServiceId ? '' : 'ml-[18px]'}>{t('assistantGlobalDefault', { defaultValue: '全局默认' })}</span>
                </button>
                {/* 按提供商分组 */}
                {(() => {
                  const groups = new Map<string, typeof enabledServices>();
                  for (const svc of enabledServices) {
                    const cfg = getProviderConfig(svc.provider);
                    const groupName = cfg?.name || svc.provider;
                    if (!groups.has(groupName)) groups.set(groupName, []);
                    groups.get(groupName)!.push(svc);
                  }
                  return Array.from(groups.entries()).map(([groupName, svcs]) => (
                    <div key={groupName}>
                      {groups.size > 1 && (
                        <p className="text-[10px] font-medium text-muted-foreground/60 px-2 pt-1.5 pb-0.5 uppercase tracking-wider">{groupName}</p>
                      )}
                      {svcs.map(svc => {
                        const isSelected = selectedServiceId === svc.id;
                        return (
                          <button key={svc.id} className={`w-full text-left px-2 py-1.5 rounded text-sm cursor-pointer transition-colors flex items-center gap-1.5 ${isSelected ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-accent'}`}
                            onClick={() => handleServiceChange(svc.id)}>
                            {isSelected && <Check className="h-3 w-3 flex-shrink-0" />}
                            <span className={isSelected ? '' : 'ml-[18px]'}>{svc.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ));
                })()}
              </PopoverContent>
            </Popover>
          )}

          <div className="flex-1" />

          {/* 上下文可视化 */}
          <Button variant="ghost" size="sm" className={`h-7 px-1.5 text-xs gap-0.5 ${contextPanelOpen ? 'text-blue-500' : ''}`}
            onClick={() => setContextPanelOpen(v => !v)}
            title={t('assistantContextPanel', { defaultValue: '邮件上下文' })}>
            <Info className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className={`h-7 px-1.5 text-xs gap-0.5 ${promptOpen ? 'text-blue-500' : ''}`}
            onClick={() => setPromptOpen(v => !v)}
            title={t('assistantSystemPrompt', { defaultValue: '系统提示词' })}>
            <ScrollText className="h-3 w-3" />
          </Button>
          {messages.length > 0 && (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-0.5"
                onClick={handleExport} disabled={streaming}
                title={t('assistantExport', { defaultValue: '导出对话' })}>
                <ArrowDownToLine className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-0.5"
                onClick={handleClear} disabled={streaming}
                title={t('assistantClear', { defaultValue: '清除对话' })}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>

        {/* 上下文可视化面板 */}
        {contextPanelOpen && (
          <div className="px-2 pb-2">
            <div className="rounded border bg-muted/30 p-2 text-xs space-y-1.5">
              {/* 阶段进度条 */}
              <div className="flex items-center gap-1">
                {(['blank', 'drafting', 'reviewing', 'ready'] as EmailPhase[]).map((phase, i) => (
                  <div key={phase} className="flex items-center gap-1 flex-1">
                    <div className={`h-1.5 flex-1 rounded-full ${
                      (['blank', 'drafting', 'reviewing', 'ready'].indexOf(emailPhase) >= i)
                        ? 'bg-blue-500' : 'bg-muted-foreground/20'
                    }`} />
                    {i < 3 && <div className="w-0.5" />}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">{t('assistantEmailContext', { defaultValue: '邮件上下文' })}</span>
                <span className={`font-medium ${PHASE_COLORS[emailPhase]}`}>{PHASE_LABELS[emailPhase]}</span>
              </div>
              {/* 上下文详情 + 缺失项标红 */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                <span className={!contextSummary.hasSubject ? 'text-red-500' : ''}>
                  {t('assistantCtxSubject', { defaultValue: '主题' })}：{contextSummary.subjectPreview || t('assistantCtxNotFilled', { defaultValue: '未填写' })}
                </span>
                <span className={contextSummary.recipientCount === 0 ? 'text-red-500' : ''}>
                  {t('assistantCtxRecipients', { defaultValue: '收件人' })}：{contextSummary.recipientCount || t('assistantCtxNotFilled', { defaultValue: '未填写' })}
                </span>
                <span className={contextSummary.bodyLength === 0 ? 'text-red-500' : ''}>
                  {t('assistantCtxBody', { defaultValue: '正文' })}：{contextSummary.bodyLength > 0 ? `${contextSummary.bodyLength}字` : t('assistantCtxEmpty', { defaultValue: '空' })}
                </span>
                <span>{t('assistantCtxAttachments', { defaultValue: '附件' })}：{contextSummary.attachmentCount || '0'}</span>
                <span className={!contextSummary.accountEmail ? 'text-red-500' : ''}>
                  {t('assistantCtxAccount', { defaultValue: '账户' })}：{contextSummary.accountEmail || t('assistantCtxNotConfigured', { defaultValue: '未配置' })}
                </span>
                <span>{t('assistantCtxFormat', { defaultValue: '格式' })}：{contextSummary.format}</span>
              </div>
              {/* 快捷修复按钮 */}
              {(emailPhase === 'blank' || emailPhase === 'drafting') && (
                <div className="flex items-center gap-1 pt-0.5">
                  {!contextSummary.hasSubject && (
                    <button className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors cursor-pointer"
                      onClick={() => handleQuickAction('subject')}>
                      💡 {t('assistantSuggestSubject', { defaultValue: '建议主题' })}
                    </button>
                  )}
                  {!contextSummary.accountEmail && (
                    <button className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors cursor-pointer"
                      onClick={() => handleQuickAction('addAccount')}>
                      ⚙️ {t('assistantConfigAccount', { defaultValue: '配置邮箱' })}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 系统提示词编辑区 */}
        {promptOpen && (
          <div className="px-2 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('assistantSystemPromptLabel', { defaultValue: '系统提示词' })}</span>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-0.5" onClick={handlePromptReset}>
                <RotateCcw className="h-3 w-3" />{t('assistantResetDefault', { defaultValue: '恢复默认' })}
              </Button>
            </div>
            <textarea value={promptDraft} onChange={e => setPromptDraft(e.target.value)} onBlur={handlePromptSave}
              className="w-full resize-y rounded-md border bg-muted/30 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] max-h-[200px]"
              rows={5} placeholder={defaultPrompt} />
          </div>
        )}

        {/* 快捷操作按钮（按分类下拉菜单） */}
        <div className="flex items-center gap-1 px-2 pb-1.5 flex-wrap">
          {sortedQaCategories.map(cat => {
            const items = getQaItemsForCategory(cat.id);
            if (items.length === 0) return null;
            return (
              <DropdownMenu key={cat.id}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-0.5" disabled={streaming || !aiAvailable}>
                    {cat.label}<ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[140px]">
                  {items.map(item => (
                    <DropdownMenuItem key={item.id} className="text-xs cursor-pointer" onClick={() => handleQuickAction(item.id)}>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-muted-foreground" title={t('qamTitle', { defaultValue: '快捷按钮管理' })} onClick={() => setQaManagerOpen(true)}>
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* 快捷按钮管理对话框 */}
        <QuickActionManagerDialog open={qaManagerOpen} onOpenChange={setQaManagerOpen} store={qaStore} onSave={handleQaSave} t={t} />
      </div>

      {/* ═══ 对话区 ═══ */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 text-center px-4 gap-3">
            <Mail className="h-8 w-8" />
            <p className="text-base font-medium">{t('assistantTitle', { defaultValue: '邮件 AI 助手' })}</p>
            {!aiAvailable ? (
              <p className="text-xs text-destructive">{t('assistantNoAI', { defaultValue: '请先在设置中配置 AI 服务' })}</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 w-full max-w-[280px]">
                {emailPhase === 'blank' || emailPhase === 'drafting' ? (
                  <>
                    <button className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border bg-background hover:bg-accent text-xs text-left cursor-pointer transition-colors"
                      onClick={() => handleQuickAction('compose_formal')}>
                      <Wand2 className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-foreground/80">{t('guideCompose', { defaultValue: '撰写商务邮件' })}</span>
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border bg-background hover:bg-accent text-xs text-left cursor-pointer transition-colors"
                      onClick={() => handleQuickAction('tools_add_account')}>
                      <UserPlus className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-foreground/80">{t('guideAccount', { defaultValue: '配置邮箱账户' })}</span>
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border bg-background hover:bg-accent text-xs text-left cursor-pointer transition-colors"
                      onClick={() => handleQuickAction('tools_gen_signature')}>
                      <PenLine className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                      <span className="text-foreground/80">{t('guideSignature', { defaultValue: '生成专业签名' })}</span>
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border bg-background hover:bg-accent text-xs text-left cursor-pointer transition-colors"
                      onClick={() => handleQuickAction('compose_thanks')}>
                      <Sparkles className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-foreground/80">{t('guideThanks', { defaultValue: '撰写感谢邮件' })}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border bg-background hover:bg-accent text-xs text-left cursor-pointer transition-colors"
                      onClick={() => handleQuickAction('enhance_polish')}>
                      <Sparkles className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-foreground/80">{t('guidePolish', { defaultValue: '润色优化正文' })}</span>
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border bg-background hover:bg-accent text-xs text-left cursor-pointer transition-colors"
                      onClick={() => handleQuickAction('check_precheck')}>
                      <ShieldCheck className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-foreground/80">{t('guidePrecheck', { defaultValue: '发送前检查' })}</span>
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border bg-background hover:bg-accent text-xs text-left cursor-pointer transition-colors"
                      onClick={() => handleQuickAction('check_summarize')}>
                      <ListCollapse className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                      <span className="text-foreground/80">{t('guideSummarize', { defaultValue: '生成邮件摘要' })}</span>
                    </button>
                    <button className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border bg-background hover:bg-accent text-xs text-left cursor-pointer transition-colors"
                      onClick={() => handleQuickAction('enhance_continue')}>
                      <ArrowRight className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-foreground/80">{t('guideContinue', { defaultValue: '续写邮件正文' })}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`group/msg flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[95%] rounded-lg px-2.5 py-1.5 relative ${
              msg.role === 'user' ? 'bg-blue-600 text-white text-sm' : 'bg-muted/50 text-foreground text-sm'
            }`}>
              {msg.role === 'user' ? (
                editingMsgId === msg.id ? (
                  <div className="space-y-1">
                    <textarea value={editingContent} onChange={e => setEditingContent(e.target.value)}
                      className="w-full text-sm bg-white/10 rounded px-1.5 py-1 resize-none focus:outline-none min-h-[40px]"
                      rows={3} autoFocus />
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-white/80 hover:text-white hover:bg-white/10"
                        onClick={() => setEditingMsgId(null)}>{t('assistantCancel', { defaultValue: '取消' })}</Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-white hover:bg-white/20"
                        onClick={handleConfirmEdit}>{t('assistantSendEdit', { defaultValue: '重新发送' })}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <span className="whitespace-pre-wrap flex-1">{msg.content}</span>
                    <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex-shrink-0 flex items-center gap-0.5 mt-0.5">
                      <button className="p-0.5 rounded hover:bg-white/20"
                        onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content); }}
                        title={t('assistantEditMsg', { defaultValue: '编辑' })}>
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button className="p-0.5 rounded hover:bg-white/20"
                        onClick={() => handleCopy(msg.content, `user_${msg.id}`)}>
                        {copiedId === `user_${msg.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-0.5">
                  {renderAssistantContent(msg.content, msg.id)}
                  {/* 错误消息：显示重试按钮 */}
                  {msg.isError ? (
                    <div className="flex items-center gap-1 pt-1">
                      <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => handleRegenerate(msg.id)} disabled={streaming}>
                        <RefreshCw className="h-3 w-3" />{t('assistantRetry', { defaultValue: '重试' })}
                      </Button>
                    </div>
                  ) : (
                    /* 助手消息操作栏 */
                    <div className="flex items-center gap-1 pt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                      <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleCopy(msg.content, `asst_${msg.id}`)}
                        title={t('assistantCopy', { defaultValue: '复制' })}>
                        {copiedId === `asst_${msg.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                      </button>
                      <button className="p-0.5 rounded hover:bg-accent" onClick={() => handleRegenerate(msg.id)}
                        title={t('assistantRegenerate', { defaultValue: '重新生成' })}>
                        <RefreshCw className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 流式响应 */}
        {streaming && (() => {
          // 实时解析流式内容：分离 HTML 块（含未闭合）、JSON 块、普通文本
          const htmlOpenIdx = streamingContent.indexOf('```html\n');
          const htmlOpenIdx2 = htmlOpenIdx === -1 ? streamingContent.indexOf('```html\r\n') : htmlOpenIdx;
          let beforeHtml = '';
          let streamHtmlCode = '';
          let afterHtml = '';
          let htmlClosed = false;
          if (htmlOpenIdx2 !== -1) {
            beforeHtml = streamingContent.slice(0, htmlOpenIdx2).trim();
            const bodyStart = streamingContent.indexOf('\n', htmlOpenIdx2) + 1;
            const closeIdx = streamingContent.indexOf('\n```', bodyStart);
            if (closeIdx !== -1) {
              streamHtmlCode = streamingContent.slice(bodyStart, closeIdx);
              htmlClosed = true;
              afterHtml = streamingContent.slice(closeIdx + 4);
            } else {
              streamHtmlCode = streamingContent.slice(bodyStart);
            }
          }
          // 移除 JSON 块（已闭合 + 未闭合）的辅助函数
          const stripJsonBlocks = (s: string) => {
            // 先移除已闭合的 ```json...```
            let result = s.replace(/```json\s*\n[\s\S]*?```/g, '');
            // 再截断未闭合的 ```json（流式阶段正在输出 JSON）
            const unclosedIdx = result.indexOf('```json');
            if (unclosedIdx !== -1) result = result.slice(0, unclosedIdx);
            return result.replace(/\n{3,}/g, '\n\n').trim();
          };
          // 从 afterHtml 中移除 JSON 块（动作协议，不显示）
          const visibleAfter = stripJsonBlocks(afterHtml);
          // 如果没有 HTML 块，从整个内容中移除 JSON 块后显示
          const plainContent = htmlOpenIdx2 === -1 ? stripJsonBlocks(streamingContent) : '';

          return (
            <div className="flex justify-start">
              <div className="max-w-[95%] rounded-lg px-2.5 py-1.5 text-sm bg-muted/50 text-foreground space-y-1">
                {/* 实时思考内容（直接显示，不折叠） */}
                {thinkingContent && (
                  <div className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-1 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {thinkingContent}
                  </div>
                )}
                {/* 无 HTML 块时：显示纯文本（去掉 JSON 块） */}
                {htmlOpenIdx2 === -1 && (plainContent ? (
                  <span className="whitespace-pre-wrap">{plainContent}</span>
                ) : !thinkingContent ? (
                  <span className="flex items-center gap-1 text-muted-foreground text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('assistantThinking', { defaultValue: '思考中...' })}
                  </span>
                ) : null)}
                {/* 有 HTML 块时：先显示前置文本 */}
                {htmlOpenIdx2 !== -1 && beforeHtml && (
                  <span className="whitespace-pre-wrap">{beforeHtml}</span>
                )}
                {/* HTML 实时预览框 */}
                {htmlOpenIdx2 !== -1 && (
                  <div className="my-1 rounded border bg-muted/40 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-muted/60 border-b">
                      <span className="text-xs text-muted-foreground font-mono">html</span>
                      {!htmlClosed && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />{t('assistantGenerating', { defaultValue: '生成中...' })}
                        </span>
                      )}
                    </div>
                    <iframe
                      title="HTML Preview"
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:SimSun,'宋体',sans-serif;font-size:14px;padding:8px;margin:0;color:#333;}</style></head><body>${streamHtmlCode}</body></html>`}
                      sandbox="allow-same-origin"
                      className="w-full border-0 min-h-[60px] max-h-[300px] bg-white"
                      onLoad={(e) => {
                        const iframe = e.target as HTMLIFrameElement;
                        if (iframe.contentDocument) {
                          iframe.style.height = Math.min(iframe.contentDocument.body.scrollHeight + 16, 300) + 'px';
                        }
                      }}
                    />
                  </div>
                )}
                {/* HTML 块闭合后的文本（总结等，去掉 JSON 块） */}
                {htmlClosed && visibleAfter && (
                  <span className="whitespace-pre-wrap">{visibleAfter}</span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ═══ 输入区 ═══ */}
      <div className="flex-shrink-0 border-t p-2 space-y-1.5">
        {/* 上下文模式选择器 */}
        <div className="flex items-center gap-1 flex-wrap">
          {([
            { key: 'none' as EmailContextMode, icon: MessageSquareText, label: t('ctxModeNone', { defaultValue: '随便聊聊' }) },
            { key: 'body' as EmailContextMode, icon: FileText, label: t('ctxModeBody', { defaultValue: '正文' }) },
            { key: 'recipients' as EmailContextMode, icon: Users, label: t('ctxModeRecipients', { defaultValue: '收件人' }) },
            { key: 'account' as EmailContextMode, icon: Settings, label: t('ctxModeAccount', { defaultValue: '账户' }) },
            { key: 'template' as EmailContextMode, icon: LayoutTemplate, label: t('ctxModeTemplate', { defaultValue: '模板' }) },
          ]).map(mode => (
            <button key={mode.key}
              onClick={() => setEmailContextMode(mode.key)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors border ${
                emailContextMode === mode.key
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400 dark:border-blue-400/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
              }`}
              title={mode.key === 'none'
                ? t('ctxHintNone', { defaultValue: '不附加特定上下文' })
                : t('ctxHintWith', { defaultValue: '将「{{label}}」作为 AI 上下文', label: mode.label })}
            >
              <mode.icon className="h-3 w-3" />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
        <textarea ref={inputRef} value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={inputPlaceholder}
          className="w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring overflow-hidden"
          rows={1} disabled={streaming}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(inputValue);
            }
          }}
        />
        <div className="flex items-center gap-1.5">
          {/* 联网搜索 */}
          <span title={providerCaps.webSearch ? (enableWebSearch ? t('assistantWebSearchOn', { defaultValue: '联网搜索：已开启' }) : t('assistantWebSearchOff', { defaultValue: '联网搜索：已关闭' })) : t('assistantWebSearchUnavailable', { defaultValue: '当前模型不支持联网' })}>
            <Button variant="ghost" size="sm"
              className={`h-7 px-1.5 text-xs gap-0.5 ${enableWebSearch && providerCaps.webSearch ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
              disabled={!providerCaps.webSearch}
              onClick={() => setEnableWebSearch(v => !v)}>
              <Globe className="h-3 w-3" />
            </Button>
          </span>

          {/* 深度思考 */}
          <span title={providerCaps.thinking ? (enableThinking ? t('assistantThinkingOn', { defaultValue: '深度思考：已开启' }) : t('assistantThinkingOff', { defaultValue: '深度思考：已关闭' })) : t('assistantThinkingUnavailable', { defaultValue: '当前模型不支持深度思考' })}>
            <Button variant="ghost" size="sm"
              className={`h-7 px-1.5 text-xs gap-0.5 ${enableThinking && providerCaps.thinking ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}
              disabled={!providerCaps.thinking}
              onClick={() => setEnableThinking(v => !v)}>
              <Brain className="h-3 w-3" />
            </Button>
          </span>

          <div className="flex-1" />

          {/* 发送/停止 */}
          {streaming ? (
            <Button variant="outline" size="icon" className="h-6 w-6 flex-shrink-0" onClick={handleStop}
              title={t('assistantStop', { defaultValue: '停止生成' })}>
              <Square className="h-3 w-3" />
            </Button>
          ) : (
            <Button variant="default" size="icon"
              className="h-6 w-6 flex-shrink-0 bg-blue-600 hover:bg-blue-700"
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || !aiAvailable}
              title={t('assistantSend', { defaultValue: '发送' })}>
              <Send className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
