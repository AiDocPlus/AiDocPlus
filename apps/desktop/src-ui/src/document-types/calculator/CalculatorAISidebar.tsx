/**
 * CalculatorAISidebar — 计算文档 AI 侧栏
 * 布局与交互对齐长篇小说 NovelAISidebar：Popover 会话、快捷操作仅以下拉菜单展示（⌘K 仍可打开命令面板）、
 * 流式输出与停止、底部 AI 服务 / 联网 / 深度思考、统一消息组件。
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import {
  Calculator,
  Send,
  Loader2,
  Zap,
  X,
  Globe,
  Brain,
  Star,
  ChevronDown,
  Search,
  Trash2,
  MessageSquarePlus,
  Square,
  ScrollText,
  RotateCcw,
  Copy,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { cn } from '@/lib/utils';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, type AIProvider } from '@aidocplus/shared-types';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { formatBackendError } from '@/lib/backendError';
import {
  normalizeCalculatorVariables,
  type CalculatorDocumentContent,
  type CalculatorSheet,
} from './types';
import {
  SIDEBAR_AI_HEADER_PANEL,
  SIDEBAR_AI_HEADER_ROW,
  SIDEBAR_AI_HEADER_SUBROW,
  INPUT_AREA_CLASS,
  TEXTAREA_CLASS,
  AI_OPTION_BTN_BASE,
  AI_OPTION_ACTIVE,
  AI_OPTION_THINKING_ACTIVE,
  AI_OPTION_INACTIVE,
  MSG_ACTION_BTN,
} from '../_shared/styles';
import { DocTypeChatMessage } from '../_shared/DocTypeChatMessage';
import { DocTypeAIServiceMenu } from '../_shared/DocTypeAIServiceMenu';
import { CollapsibleThinkingBlock } from '../_shared/CollapsibleThinkingBlock';
import { DynamicIcon } from '../_shared/DynamicIcon';
import {
  loadQuickActions,
  saveQuickActions,
  recordRecentUsed,
  DEFAULT_CATEGORIES,
  type CalculatorQuickActionStore,
  type CalculatorQuickActionItem,
} from './calculatorQuickActions';
import { buildCalculatorSyntaxSummaryForAI } from './calculatorFunctionCatalog';
import { getCalculatorSystemPrompt } from './calculatorAiPromptShared';
import { buildSmartContext } from './calculatorContext';
import { CalculatorCommandPalette } from './CalculatorCommandPalette';

const CALC_SERVICE_STORAGE_KEY = (docId: string) => `calc_${docId}_assistant_service_id`;
const CALC_CUSTOM_SYSTEM_KEY = (docId: string) => `calc_${docId}_assistant_custom_system`;

function resolveTheme(): 'light' | 'dark' {
  const t = useSettingsStore.getState().ui?.theme;
  if (t === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return t === 'dark' ? 'dark' : 'light';
}

interface CalculatorAISidebarProps extends DocTypeAISidebarProps {
  calcDoc: CalculatorDocumentContent;
  activeSheet: CalculatorSheet;
  onInsertFormula?: (formula: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_TOTAL_CHARS = 10000;
const MAX_SINGLE_HISTORY_MSG_CHARS = 6000;
const MAX_SESSIONS_COUNT = 20;
const MAX_MESSAGES_PER_SESSION = 100;
const MAX_SESSIONS_STORAGE_CHARS = 200_000; // ~200KB，防止单文档 localStorage 膨胀

function sliceHistoryForApi(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const roleMsgs = messages.filter((m): m is ChatMessage & { role: 'user' | 'assistant' } =>
    m.role === 'user' || m.role === 'assistant',
  );
  const slice = roleMsgs.slice(-MAX_HISTORY_MESSAGES);
  let total = 0;
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let i = slice.length - 1; i >= 0; i--) {
    const m = slice[i];
    let content = m.content;
    if (content.length > MAX_SINGLE_HISTORY_MSG_CHARS) {
      content = `${content.slice(0, MAX_SINGLE_HISTORY_MSG_CHARS)}\n…(truncated)`;
    }
    if (total + content.length > MAX_HISTORY_TOTAL_CHARS) break;
    out.unshift({ role: m.role, content });
    total += content.length;
  }
  return out;
}

function sessionsStorageKey(documentId: string): string {
  return `_calc_sessions_${documentId}`;
}

/** 裁剪会话数据：限制会话数、每个会话消息数、总存储体积 */
function pruneSessions(sessions: ChatSession[]): ChatSession[] {
  // 1. 限制会话数量，保留最近活跃的
  let pruned = sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS_COUNT);

  // 2. 限制每个会话的消息数量，保留最近的消息
  pruned = pruned.map((s) => ({
    ...s,
    messages: s.messages.slice(-MAX_MESSAGES_PER_SESSION),
  }));

  // 3. 如果序列化后仍然过大，逐步裁剪最早会话的消息
  try {
    let json = JSON.stringify(pruned);
    while (json.length > MAX_SESSIONS_STORAGE_CHARS && pruned.length > 0) {
      // 找到最早更新的非活跃会话，删除其最早的一半消息
      const oldest = pruned[pruned.length - 1];
      if (oldest.messages.length > 2) {
        oldest.messages = oldest.messages.slice(-Math.ceil(oldest.messages.length / 2));
      } else {
        // 消息已经很少了，直接移除该会话（但至少保留 1 个）
        if (pruned.length > 1) {
          pruned = pruned.slice(0, -1);
        } else {
          break;
        }
      }
      json = JSON.stringify(pruned);
    }
  } catch {
    // 序列化失败时不裁剪，由写入时的 try-catch 兜底
  }

  return pruned;
}

export function CalculatorAISidebar({
  document: doc,
  host,
  activeSheet,
  calcDoc,
  onClose,
  onInsertFormula,
}: CalculatorAISidebarProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const sessionsKey = sessionsStorageKey(doc.id);
  const msgIdRef = useRef(0);
  const nextMsgId = () => `msg-${Date.now()}-${++msgIdRef.current}`;

  const aiServices = useSettingsStore((s) => s.ai.services);
  const enabledServices = useMemo(() => aiServices.filter((x) => x.enabled), [aiServices]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() =>
    host.storage.get<string>(CALC_SERVICE_STORAGE_KEY(doc.id)) || '',
  );
  const aiParams = getAIInvokeParamsForService(selectedServiceId || undefined);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);
  const providerCaps = useMemo(() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider as AIProvider);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  }, [aiParams.provider]);

  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(true);
  const [promptOpen, setPromptOpen] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState(() => host.storage.get<string>(CALC_CUSTOM_SYSTEM_KEY(doc.id)) || '');
  const [promptDraft, setPromptDraft] = useState(() => host.storage.get<string>(CALC_CUSTOM_SYSTEM_KEY(doc.id)) || '');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRequestIdRef = useRef<string | null>(null);
  const streamAccumRef = useRef('');
  const userStoppedRef = useRef(false);
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const [actionStore, setActionStore] = useState<CalculatorQuickActionStore>(() => loadQuickActions(host.storage));
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [contextScope, setContextScope] = useState<'segment' | 'sheet' | 'all'>('sheet');
  const [qaPaletteOpen, setQaPaletteOpen] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = host.storage.get<ChatSession[]>(sessionsKey);
    if (saved && saved.length > 0) return saved;
    return [
      {
        id: 'default',
        title: i18n.t('calculator.newSession', { defaultValue: '新对话' }),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = host.storage.get<ChatSession[]>(sessionsKey);
    if (saved && saved.length > 0) return saved[0].id;
    return 'default';
  });

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId],
  );
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight);
  }, [messages, streamingContent, streaming]);

  useEffect(() => {
    try {
      const toSave = pruneSessions(sessions);
      host.storage.set(sessionsKey, toSave);
    } catch {
      // localStorage 满或序列化失败，静默忽略
      // 裁剪逻辑已在 pruneSessions 中处理，此处为最终兜底
    }
  }, [sessions, sessionsKey, host]);

  const updateActiveSession = useCallback(
    (updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? updater(s) : s)));
    },
    [activeSessionId],
  );

  // 使用分层上下文引擎构建智能上下文
  const buildContext = useCallback(() => {
    let sheet = activeSheet;
    if (contextScope === 'segment') {
      // 仅当前段（从最近的 heading/subtotal 向上到上一个 heading）
      const lines = activeSheet.lines;
      let segStart = lines.length;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].lineRole === 'heading' || lines[i].lineRole === 'subtotal') {
          if (i < lines.length - 1) { segStart = i + 1; break; }
        }
      }
      sheet = { ...activeSheet, lines: lines.slice(segStart) };
    } else if (contextScope === 'all') {
      // 所有 Sheet（合并前 100 行）
      const allLines = calcDoc.sheets.flatMap(s => s.lines).slice(0, 100);
      sheet = { ...activeSheet, lines: allLines };
    }
    return buildSmartContext(sheet, { isEn: i18n.language.startsWith('en') });
  }, [activeSheet, contextScope, calcDoc.sheets, i18n.language]);

  const extractAndInsertFormula = useCallback(
    (content: string) => {
      const formulaMatch = content.match(/```formula\n([\s\S]*?)\n```/);
      if (formulaMatch && onInsertFormula) {
        onInsertFormula(formulaMatch[1].trim());
      }
    },
    [onInsertFormula],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const messageContent = text.trim();
      if (!messageContent || streaming || !aiAvailable) return;

      const userMessage: ChatMessage = {
        id: nextMsgId(),
        role: 'user',
        content: messageContent,
        timestamp: Date.now(),
      };

      updateActiveSession((s) => ({
        ...s,
        messages: [...s.messages, userMessage],
        updatedAt: Date.now(),
        title: s.messages.length === 0 ? messageContent.slice(0, 28) : s.title,
      }));

      setInputValue('');
      setStreaming(true);
      setStreamingContent('');
      userStoppedRef.current = false;

      const historyPayload = sliceHistoryForApi(messages);

      const context = buildContext();
      const syntaxSummary = buildCalculatorSyntaxSummaryForAI(2600);
      const extraRules = t('calculator.aiSystemPromptExtra', {
        defaultValue:
          '【回答约束】仅使用摘要中的函数与语法；金融符号见摘要「易错」；展示单位用双引号；可粘贴公式用 ```formula 每行一条。',
      });
      let systemPrompt = `${getCalculatorSystemPrompt(isEn)}

${context}

${syntaxSummary}

${extraRules}

请用简洁清晰的语言回答用户问题。如果建议公式，请用 \`\`\`formula 代码块包裹公式；块内只放本计算器可执行的表达式或单行，不要编造未在能力摘要中列出的函数名。`;

      const userSys = customSystemPrompt.trim();
      if (userSys) {
        systemPrompt += `\n\n【${t('calculator.aiSystemPromptUserBlock', { defaultValue: '用户自定义系统提示' })}】\n${userSys}`;
      }

      if (deepThinkEnabled) {
        systemPrompt += `\n\n请进行深度思考，给出详细的推导过程和原理解释。`;
      }
      if (webSearchEnabled) {
        systemPrompt += `\n\n如果需要最新信息（如汇率、利率等），请提醒用户数据可能需要手动更新。`;
      }

      const abortController = new AbortController();
      abortRef.current = abortController;
      streamRequestIdRef.current = null;
      streamAccumRef.current = '';

      try {
        const fullContent = await host.ai.chatStream(
          [
            { role: 'system', content: systemPrompt },
            ...historyPayload,
            { role: 'user', content: messageContent },
          ],
          (cumulative) => {
            streamAccumRef.current = cumulative;
            setStreamingContent(cumulative);
          },
          {
            signal: abortController.signal,
            serviceId: selectedServiceId || undefined,
            enableWebSearch: webSearchEnabled && providerCaps.webSearch ? true : undefined,
            enableThinking: deepThinkEnabled && providerCaps.thinking ? true : undefined,
            onStreamRequestId: (id) => {
              streamRequestIdRef.current = id;
            },
          },
        );

        if (!userStoppedRef.current) {
          const assistantMsg: ChatMessage = {
            id: nextMsgId(),
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now(),
          };
          updateActiveSession((s) => ({
            ...s,
            messages: [...s.messages, assistantMsg],
            updatedAt: Date.now(),
          }));
        }
      } catch (err) {
        const partial = streamAccumRef.current.trim();
        if ((err as Error).name === 'AbortError' || userStoppedRef.current) {
          if (partial) {
            updateActiveSession((s) => ({
              ...s,
              messages: [
                ...s.messages,
                {
                  id: nextMsgId(),
                  role: 'assistant',
                  content: partial,
                  timestamp: Date.now(),
                },
              ],
              updatedAt: Date.now(),
            }));
          }
        } else {
          updateActiveSession((s) => ({
            ...s,
            messages: [
              ...s.messages,
              {
                id: nextMsgId(),
                role: 'assistant',
                content: `❌ ${formatBackendError(err)}`,
                timestamp: Date.now(),
              },
            ],
            updatedAt: Date.now(),
          }));
        }
      } finally {
        streamAccumRef.current = '';
        setStreaming(false);
        setStreamingContent('');
        abortRef.current = null;
        streamRequestIdRef.current = null;
        userStoppedRef.current = false;
      }
    },
    [
      streaming,
      aiAvailable,
      messages,
      updateActiveSession,
      buildContext,
      host.ai,
      deepThinkEnabled,
      webSearchEnabled,
      providerCaps.webSearch,
      providerCaps.thinking,
      selectedServiceId,
      t,
      customSystemPrompt,
    ],
  );

  sendMessageRef.current = sendMessage;

  const handleStop = useCallback(() => {
    userStoppedRef.current = true;
    const rid = streamRequestIdRef.current;
    if (rid) {
      void invoke('stop_ai_stream', { requestId: rid });
      streamRequestIdRef.current = null;
    }
    abortRef.current?.abort();
  }, []);

  const handleQuickAction = useCallback(
    (item: CalculatorQuickActionItem) => {
      setActionStore((prev) => {
        const next = recordRecentUsed(prev, item.id);
        saveQuickActions(host.storage, next);
        return next;
      });
      sendMessageRef.current(item.prompt);
      setQaPaletteOpen(false);
    },
    [host.storage],
  );

  const handleNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: t('calculator.newSession', { defaultValue: '新对话' }),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSession.id);
    setSessionMenuOpen(false);
  }, [t]);

  const handleSwitchSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setSessionMenuOpen(false);
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      let targetSessionId: string | null = null;
      setSessions((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((s) => s.id !== id);
        if (id === activeSessionId) {
          targetSessionId = next[next.length - 1].id;
        }
        return next;
      });
      // 在 updater 外部执行副作用，保证 updater 是纯函数
      if (targetSessionId) {
        setActiveSessionId(targetSessionId);
      }
    },
    [activeSessionId],
  );

  const handleRenameSession = useCallback((id: string) => {
    const sess = sessions.find(s => s.id === id);
    if (!sess) return;
    setRenamingSessionId(id);
    setRenameValue(sess.title);
    setTimeout(() => renameInputRef.current?.select(), 50);
  }, [sessions]);

  const handleRenameSubmit = useCallback(() => {
    if (!renamingSessionId || !renameValue.trim()) {
      setRenamingSessionId(null);
      return;
    }
    setSessions(prev => prev.map(s =>
      s.id === renamingSessionId ? { ...s, title: renameValue.trim() } : s,
    ));
    setRenamingSessionId(null);
  }, [renamingSessionId, renameValue]);

  const handleClear = useCallback(() => {
    const messages = sessions.find(s => s.id === activeSessionId)?.messages;
    if (messages && messages.length > 0) {
      const confirmed = window.confirm(
        isEn ? 'Clear all messages in this conversation?' : '确定清空当前对话的所有消息？',
      );
      if (!confirmed) return;
    }
    updateActiveSession((s) => ({ ...s, messages: [], updatedAt: Date.now() }));
  }, [updateActiveSession, sessions, activeSessionId, isEn]);

  const handleDeleteMessage = useCallback((msgId: string) => {
    updateActiveSession((s) => ({
      ...s,
      messages: s.messages.filter((m) => m.id !== msgId),
      updatedAt: Date.now(),
    }));
  }, [updateActiveSession]);

  const handleRegenerateMessage = useCallback((msgId: string) => {
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    const msgIndex = session.messages.findIndex(m => m.id === msgId);
    if (msgIndex < 0) return;
    // 删除该消息及之后的所有消息，重新发送
    const trimmedMessages = session.messages.slice(0, msgIndex);
    updateActiveSession((s) => ({
      ...s,
      messages: trimmedMessages,
      updatedAt: Date.now(),
    }));
    // 获取被删除消息之前的最后一条用户消息
    const lastUserMsg = [...trimmedMessages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      setTimeout(() => sendMessageRef.current(lastUserMsg.content), 100);
    }
  }, [sessions, activeSessionId, updateActiveSession]);

  const contextHint = useMemo(() => {
    const err = activeSheet.lines.filter((l) => l.result.type === 'error').length;
    const v = Object.keys(
      normalizeCalculatorVariables(activeSheet.variables as Record<string, unknown>),
    ).length;
    const n = activeSheet.lines.length;
    const sn = activeSheet.name?.slice(0, 8) || '';
    return t('calculator.aiContextHint', {
      defaultValue: '{{sheet}}{{sep}}{{lines}}{{linesLabel}} {{vars}}{{varsLabel}}{{errors}}',
      sheet: sn,
      sep: sn ? ' · ' : '',
      lines: n,
      linesLabel: t('calculator.contextLines', { defaultValue: '行' }),
      vars: v,
      varsLabel: t('calculator.contextVars', { defaultValue: '变量' }),
      errors: err
        ? ` ${err}${t('calculator.contextErrors', { defaultValue: '错' })}`
        : '',
    });
  }, [activeSheet, t]);

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

  const closePalette = useCallback(() => {
    setQaPaletteOpen(false);
    setActionStore(loadQuickActions(host.storage));
  }, [host.storage]);

  const inputPlaceholder = t('calculator.inputPlaceholder', {
    defaultValue: '输入问题…（Enter 发送，Shift+Enter 换行）',
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className={SIDEBAR_AI_HEADER_PANEL}>
        <div className={cn(SIDEBAR_AI_HEADER_ROW, 'gap-1.5')}>
          <Calculator className="h-4 w-4 text-sky-500 shrink-0" />
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-sm font-medium truncate max-w-[140px] hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-0.5 text-left"
                title={t('calculator.switchSession', { defaultValue: '切换对话' })}
              >
                {activeSession?.title || t('calculator.aiAssistant', { defaultValue: 'AI 助手' })}
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-card" align="start">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent',
                      sess.id === activeSessionId && 'bg-accent font-medium',
                    )}
                  >
                    {renamingSessionId === sess.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenamingSessionId(null); }}
                        className="flex-1 text-sm bg-transparent border-b border-primary outline-none min-w-0 px-0"
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        className="flex-1 text-left truncate"
                        onClick={() => handleSwitchSession(sess.id)}
                      >
                        {sess.title} ({sess.messages.length})
                      </button>
                    )}
                    {renamingSessionId !== sess.id && (
                      <button
                        type="button"
                        className="opacity-50 hover:opacity-100 p-0.5"
                        title={t('calculator.renameSession', { defaultValue: '重命名' })}
                        onClick={(e) => { e.stopPropagation(); handleRenameSession(sess.id); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        className="opacity-50 hover:opacity-100 hover:text-destructive p-0.5"
                        title={t('common.delete', { defaultValue: '删除' })}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(sess.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t mt-1 pt-1">
                <Button variant="ghost" size="sm" className="w-full justify-start h-8 text-sm gap-1" onClick={handleNewSession}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  {t('calculator.newSession', { defaultValue: '新对话' })}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex-1 min-w-0" />
          <span className="text-[10px] text-muted-foreground tabular-nums truncate max-w-[88px]" title={contextHint}>
            {contextHint}
          </span>
          <div className="flex items-center gap-0.5 ml-1">
            <button
              type="button"
              className={cn('text-[10px] px-1 py-0.5 rounded', contextScope === 'segment' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setContextScope('segment')}
              title={t('calculator.contextSegment', { defaultValue: '当前段' })}
            >
              {t('calculator.contextSegmentShort', { defaultValue: '段' })}
            </button>
            <button
              type="button"
              className={cn('text-[10px] px-1 py-0.5 rounded', contextScope === 'sheet' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setContextScope('sheet')}
              title={t('calculator.contextSheet', { defaultValue: '当前 Sheet' })}
            >
              {t('calculator.contextSheetShort', { defaultValue: 'Sheet' })}
            </button>
            <button
              type="button"
              className={cn('text-[10px] px-1 py-0.5 rounded', contextScope === 'all' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setContextScope('all')}
              title={t('calculator.contextAll', { defaultValue: '全文档' })}
            >
              {t('calculator.contextAllShort', { defaultValue: '全部' })}
            </button>
          </div>
          <Popover
            open={promptOpen}
            onOpenChange={(open) => {
              setPromptOpen(open);
              if (open) setPromptDraft(customSystemPrompt);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-7 w-7 p-0 shrink-0', promptOpen && 'text-amber-600 dark:text-amber-400')}
                title={t('calculator.aiSystemPrompt', { defaultValue: '系统提示词' })}
              >
                <ScrollText className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-card" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{t('calculator.aiSystemPrompt', { defaultValue: '系统提示词' })}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => setPromptDraft('')}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {t('calculator.aiSystemPromptReset', { defaultValue: '清空' })}
                  </Button>
                </div>
                <textarea
                  className="w-full h-32 text-xs border rounded-md p-2 resize-none bg-background"
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  placeholder={t('calculator.aiSystemPromptPlaceholder', {
                    defaultValue: '附加在默认系统提示之后的自定义说明（可选）…',
                  })}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const next = promptDraft.trim();
                      setCustomSystemPrompt(next);
                      host.storage.set(CALC_CUSTOM_SYSTEM_KEY(doc.id), next);
                      setPromptOpen(false);
                    }}
                  >
                    {t('calculator.aiSystemPromptSave', { defaultValue: '保存' })}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={handleClear} title={t('calculator.clearSession', { defaultValue: '清空对话' })}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onClose} title={t('calculator.hideAI', { defaultValue: '关闭 AI' })}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className={SIDEBAR_AI_HEADER_SUBROW}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-xs gap-1 shrink-0" title={t('calculator.quickActionsMenu', { defaultValue: '快捷操作' })}>
                <Zap className="h-3.5 w-3.5" />
                {t('calculator.quickActionsMenu', { defaultValue: '快捷操作' })}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-[min(60vh,420px)] overflow-y-auto" align="start">
              {DEFAULT_CATEGORIES.map((cat) => {
                const catItems = actionStore.items
                  .filter((i) => i.categoryId === cat.id && !i.hidden)
                  .sort((a, b) => {
                    const af = actionStore.favorites?.includes(a.id) ? 0 : 1;
                    const bf = actionStore.favorites?.includes(b.id) ? 0 : 1;
                    if (af !== bf) return af - bf;
                    return a.order - b.order;
                  });
                if (catItems.length === 0) return null;
                return (
                  <DropdownMenuSub key={cat.id}>
                    <DropdownMenuSubTrigger className="text-xs gap-2">
                      <DynamicIcon name={cat.icon} className="h-3.5 w-3.5 shrink-0" fallback={Calculator} />
                      {isEn ? cat.labelEn : cat.label}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-56 overflow-y-auto">
                      {catItems.map((item) => (
                        <DropdownMenuItem
                          key={item.id}
                          className="text-xs gap-2 cursor-pointer"
                          onClick={() => handleQuickAction(item)}
                          disabled={streaming || !aiAvailable}
                        >
                          <DynamicIcon name={item.icon} className="h-3 w-3 shrink-0" fallback={Calculator} />
                          <span className="flex-1 truncate">{isEn ? item.labelEn : item.label}</span>
                          {actionStore.favorites?.includes(item.id) && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs gap-2" onClick={() => setQaPaletteOpen(true)}>
                <Search className="h-3.5 w-3.5" />
                {t('calculator.searchAllActions', { defaultValue: '搜索全部… (⌘K)' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.length === 0 && !streaming && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <Calculator className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">{t('calculator.aiHint', { defaultValue: '计算 AI 助手' })}</p>
              <p className="text-xs text-muted-foreground/80 mt-1 px-2">{t('calculator.aiHintDesc', { defaultValue: '使用快捷操作或输入问题' })}</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start group/msg'}>
            <div className={msg.role === 'user' ? 'max-w-[85%]' : 'max-w-[85%] w-full min-w-0'}>
              <DocTypeChatMessage
                message={{ role: msg.role, content: msg.content }}
                actions={
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className={MSG_ACTION_BTN}
                      onClick={() => { navigator.clipboard.writeText(msg.content).catch(() => {}); }}
                      title={t('calculator.copyMessage', { defaultValue: '复制' })}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {msg.role === 'assistant' && onInsertFormula && msg.content.includes('```formula') && (
                      <button
                        type="button"
                        className={MSG_ACTION_BTN}
                        onClick={() => extractAndInsertFormula(msg.content)}
                      >
                        <Zap className="h-3 w-3" />
                        {t('calculator.insertFormula', { defaultValue: '插入公式' })}
                      </button>
                    )}
                    {msg.role === 'assistant' && !streaming && (
                      <button
                        type="button"
                        className={MSG_ACTION_BTN}
                        onClick={() => handleRegenerateMessage(msg.id)}
                        title={t('calculator.regenerate', { defaultValue: '重新生成' })}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      className={MSG_ACTION_BTN}
                      onClick={() => handleDeleteMessage(msg.id)}
                      title={t('calculator.deleteMessage', { defaultValue: '删除' })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                }
              />
            </div>
          </div>
        ))}

        {streaming && streamingContent && (() => {
          const streamParsed = parseThinkTags(streamingContent);
          const theme = resolveTheme();
          return (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted text-sm space-y-2">
                {streamParsed.thinking && (
                  <CollapsibleThinkingBlock thinking={streamParsed.thinking} isThinking={streamParsed.isThinking} theme={theme} />
                )}
                {streamParsed.content && (
                  <div className="[&_.markdown-preview]:p-0 [&_.markdown-preview]:text-inherit">
                    <MarkdownPreview content={streamParsed.content} theme={theme} className="!p-0" fontSize={14} />
                  </div>
                )}
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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

      <div className={INPUT_AREA_CLASS}>
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder}
            className={cn(TEXTAREA_CLASS, 'min-h-[52px] min-w-0')}
            rows={2}
            disabled={streaming || !aiAvailable}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!streaming) void sendMessage(inputValue);
              }
            }}
          />
          <div className="flex flex-col gap-1 shrink-0 pb-0.5">
            {streaming ? (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleStop}
                title={t('chat.stopGenerating', { defaultValue: '停止生成' })}
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                variant="default"
                size="icon"
                className="h-8 w-8 bg-sky-600 hover:bg-sky-700"
                onClick={() => void sendMessage(inputValue)}
                disabled={!inputValue.trim() || !aiAvailable}
                title={t('chat.send', { defaultValue: '发送' })}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-border/60 pt-1.5">
          <DocTypeAIServiceMenu
            enabledServices={enabledServices}
            value={selectedServiceId}
            onChange={(id) => {
              setSelectedServiceId(id);
              host.storage.set(CALC_SERVICE_STORAGE_KEY(doc.id), id);
            }}
            disabled={streaming}
          />
          {providerCaps.webSearch && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(AI_OPTION_BTN_BASE, webSearchEnabled ? AI_OPTION_ACTIVE : AI_OPTION_INACTIVE)}
              onClick={() => setWebSearchEnabled((v) => !v)}
              disabled={streaming}
              title={webSearchEnabled ? t('calculator.webSearchOn', { defaultValue: '联网：开' }) : t('calculator.webSearchOff', { defaultValue: '联网：关' })}
            >
              <Globe className="h-3 w-3" />
              <span className="hidden sm:inline">{t('chat.webSearch', { defaultValue: '联网' })}</span>
            </Button>
          )}
          {providerCaps.thinking && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                AI_OPTION_BTN_BASE,
                deepThinkEnabled ? AI_OPTION_THINKING_ACTIVE : AI_OPTION_INACTIVE,
              )}
              onClick={() => setDeepThinkEnabled((v) => !v)}
              disabled={streaming}
              title={
                deepThinkEnabled
                  ? t('calculator.deepThinkOn', { defaultValue: '深度思考：开' })
                  : t('calculator.deepThinkOff', { defaultValue: '深度思考：关' })
              }
            >
              <Brain className="h-3 w-3" />
              <span className="hidden sm:inline">{t('chat.thinking', { defaultValue: '深度思考' })}</span>
            </Button>
          )}
        </div>
      </div>

      <CalculatorCommandPalette open={qaPaletteOpen} onClose={closePalette} onSelectAction={handleQuickAction} storage={host.storage} />
    </div>
  );
}
