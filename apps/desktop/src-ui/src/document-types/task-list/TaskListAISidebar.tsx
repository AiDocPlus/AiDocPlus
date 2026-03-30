/**
 * TaskListAISidebar — 任务清单 AI 侧栏
 * 对齐 CalculatorAISidebar 的布局结构
 */
import { useState, useCallback, useMemo, useRef, useEffect, type ComponentType, type ReactNode } from 'react';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import appI18n, { useTranslation } from '@/i18n';
import {
  CheckSquare,
  Send,
  Loader2,
  Zap,
  X,
  Globe,
  Brain,
  Star,
  ChevronDown,
  MessageSquarePlus,
  Square,
  ScrollText,
  RotateCcw,
  Search,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { cn } from '@/lib/utils';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, type AIProvider } from '@aidocplus/shared-types';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { formatBackendError } from '@/lib/backendError';
import { DocTypeChatMessage } from '../_shared/DocTypeChatMessage';
import { DocTypeAIServiceMenu } from '../_shared/DocTypeAIServiceMenu';
import { CollapsibleThinkingBlock } from '../_shared/CollapsibleThinkingBlock';
import {
  SIDEBAR_AI_HEADER_PANEL,
  SIDEBAR_AI_HEADER_ROW,
  SIDEBAR_AI_HEADER_SUBROW,
  INPUT_AREA_CLASS,
  TEXTAREA_CLASS,
  AI_OPTION_BTN_BASE,
  AI_OPTION_ACTIVE,
  AI_OPTION_INACTIVE,
  AI_OPTION_THINKING_ACTIVE,
  MSG_ACTION_BTN,
} from '../_shared/styles';
import {
  type TaskListDocumentContent,
  type TaskList,
  type TaskItem,
  type TaskPriority,
  createEmptyTask,
} from './types';
import {
  DEFAULT_CATEGORIES,
  loadQuickActions,
  saveQuickActions,
  recordRecentUsed,
  type TaskListQuickActionStore,
  type TaskListQuickActionItem,
} from './taskListQuickActions';
import { TASKLIST_AI_SYSTEM_BASE } from './taskListAiPromptShared';
import { TASKLIST_AI_SERVICE_STORAGE_KEY } from './taskListStorageKeys';
import {
  buildSmartContext,
  getCurrentTaskSummary,
  getAllTasksSummary,
} from './taskListContext';
import { TaskListCommandPalette } from './TaskListCommandPalette';

const TASKLIST_CUSTOM_SYSTEM_KEY = '_tasklist_custom_system';
const TASKLIST_AI_WEB_KEY = '_tasklist_ai_web';
const TASKLIST_AI_THINK_KEY = '_tasklist_ai_think';

const MAX_SINGLE_HISTORY_MSG_CHARS = 6000;

// ============================================================
// Props
// ============================================================

interface TaskListAISidebarProps extends DocTypeAISidebarProps {
  taskDoc: TaskListDocumentContent;
  activeList: TaskList | undefined;
  onAddTasks: (tasks: TaskItem[]) => void;
}

// ============================================================
// 会话管理
// ============================================================

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

function taskListSessionsKey(documentId: string): string {
  return `_tasklist_sessions_${documentId}`;
}

function substituteTaskListPrompt(
  prompt: string,
  list: TaskList | undefined,
  userInputFallback: string,
): string {
  if (!list) return prompt;
  let p = prompt;
  p = p.replace(/\{\{currentTask\}\}/g, getCurrentTaskSummary(list));
  p = p.replace(/\{\{allTasks\}\}/g, getAllTasksSummary(list));
  p = p.replace(/\{\{userInput\}\}/g, userInputFallback);
  return p;
}

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (LucideIcons as unknown as Record<string, ComponentType<{ className?: string; iconNode?: any }>>)[name];
  if (!IconComponent) return <CheckSquare className={className} />;
  return <IconComponent className={className} />;
}

function resolveTheme(): 'light' | 'dark' {
  const th = useSettingsStore.getState().ui?.theme;
  if (th === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return th === 'dark' ? 'dark' : 'light';
}

// ============================================================
// 主组件
// ============================================================

export default function TaskListAISidebar({
  document,
  taskDoc,
  activeList,
  onAddTasks,
  host,
  onClose,
}: TaskListAISidebarProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language.startsWith('en');

  const sessionsKey = useMemo(() => taskListSessionsKey(document.id), [document.id]);

  const hostRef = useRef(host);
  hostRef.current = host;

  const aiServices = useSettingsStore((s) => s.ai.services);
  const enabledServices = useMemo(() => aiServices.filter((x) => x.enabled), [aiServices]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() =>
    host.storage.get<string>(TASKLIST_AI_SERVICE_STORAGE_KEY),
  );
  const [webSearchEnabled, setWebSearchEnabled] = useState(
    () => host.storage.get<boolean>(TASKLIST_AI_WEB_KEY) ?? true,
  );
  const [deepThinkEnabled, setDeepThinkEnabled] = useState(
    () => host.storage.get<boolean>(TASKLIST_AI_THINK_KEY) ?? true,
  );

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = host.storage.get<ChatSession[]>(taskListSessionsKey(document.id));
    return saved && saved.length > 0
      ? saved
      : [
          {
            id: 'default',
            title: t('taskList.newSession', { defaultValue: '新对话' }),
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = host.storage.get<ChatSession[]>(taskListSessionsKey(document.id));
    if (saved && saved.length > 0) return saved[0].id;
    return 'default';
  });

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId],
  );
  const messages = activeSession?.messages ?? [];

  // 快捷操作
  const [actionStore, setActionStore] = useState<TaskListQuickActionStore>(() =>
    loadQuickActions(host.storage),
  );

  // 流式输出
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const userStoppedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamRequestIdRef = useRef<string | null>(null);
  const streamAccumRef = useRef('');
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  // UI 状态
  const [inputValue, setInputValue] = useState('');
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [qaPaletteOpen, setQaPaletteOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const [customSystemPrompt, setCustomSystemPrompt] = useState(
    () => host.storage.get<string>(TASKLIST_CUSTOM_SYSTEM_KEY) || '',
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // AI 可用性
  const aiParams = getAIInvokeParamsForService(selectedServiceId || undefined);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);

  const providerCaps = useMemo(() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider as AIProvider);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  }, [aiParams.provider]);

  // 切换文档时重新加载会话（仅依赖 sessionsKey；host/t 放入 deps 易每帧变化导致 setState 死循环）
  useEffect(() => {
    const saved = hostRef.current.storage.get<ChatSession[]>(sessionsKey);
    if (saved && saved.length > 0) {
      setSessions(saved);
      setActiveSessionId(saved[0].id);
    } else {
      setSessions([
        {
          id: 'default',
          title: appI18n.t('taskList.newSession', { defaultValue: '新对话' }),
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      setActiveSessionId('default');
    }
  }, [sessionsKey]);

  // 保存会话
  useEffect(() => {
    hostRef.current.storage.set(sessionsKey, sessions);
  }, [sessions, sessionsKey]);

  // 滚动到底部
  useEffect(() => {
    scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight);
  }, [messages, streamingContent, streaming]);

  // 更新会话
  const updateActiveSession = useCallback(
    (updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? updater(s) : s)));
    },
    [activeSessionId],
  );

  // 构建上下文（字符串，供 system 注入）
  const buildContextString = useCallback(() => {
    if (!activeList) return t('taskList.noListForContext', { defaultValue: '暂无任务列表' });
    return buildSmartContext(activeList, taskDoc.settings);
  }, [activeList, taskDoc.settings, t]);

  const contextHint = useMemo(() => {
    if (!activeList) return '';
    const n = activeList.tasks.filter((x) => x.status === 'pending').length;
    const name = activeList.name?.slice(0, 10) || '';
    return `${name}${name ? ' · ' : ''}${n}${t('taskList.contextHintPending', { defaultValue: ' 待办' })}`;
  }, [activeList, t]);

  const streamChatCompletionInternal = useCallback(
    async (userContent: string, historyBeforeUser: ChatMessage[]) => {
      const messageContent = userContent.trim();
      if (!messageContent || !aiAvailable) return;

      setStreaming(true);
      setStreamingContent('');
      userStoppedRef.current = false;

      const historyPayload = sliceHistoryForApi(historyBeforeUser);
      const context = buildContextString();
      let systemPrompt = `${TASKLIST_AI_SYSTEM_BASE}\n\n${context}`;

      const userSys = customSystemPrompt.trim();
      if (userSys) {
        systemPrompt += `\n\n【${t('taskList.aiSystemPromptUserBlock', { defaultValue: '用户自定义系统提示' })}】\n${userSys}`;
      }

      if (deepThinkEnabled && providerCaps.thinking) {
        systemPrompt += `\n\n${t('taskList.deepThinkSystemHint', { defaultValue: '请进行深度思考，给出详细的推导过程。' })}`;
      }
      if (webSearchEnabled && providerCaps.webSearch) {
        systemPrompt += `\n\n${t('taskList.webSearchSystemHint', { defaultValue: '如需最新信息，请提醒用户数据可能需要手动核实。' })}`;
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
          const assistantMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now(),
          };
          updateActiveSession((s) => ({
            ...s,
            messages: [...s.messages, assistantMessage],
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
                  id: `msg-${Date.now()}`,
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
                id: `msg-${Date.now()}`,
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
      aiAvailable,
      buildContextString,
      updateActiveSession,
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

  const streamChatCompletionInternalRef = useRef(streamChatCompletionInternal);
  streamChatCompletionInternalRef.current = streamChatCompletionInternal;

  const sendMessage = useCallback(
    async (text: string) => {
      const messageContent = text.trim();
      if (!messageContent || streaming || !aiAvailable) return;

      const historyBeforeUser = messages;

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
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
      await streamChatCompletionInternal(messageContent, historyBeforeUser);
    },
    [streaming, aiAvailable, messages, updateActiveSession, streamChatCompletionInternal],
  );

  const handleRegenerateLast = useCallback(() => {
    if (streaming || !aiAvailable) return;
    if (messages.length < 2) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'assistant') return;
    const prevUser = messages[messages.length - 2];
    if (prevUser.role !== 'user') return;

    const userContent = prevUser.content;
    const historyBeforeUser = messages.slice(0, -2);

    updateActiveSession((s) => ({
      ...s,
      messages: s.messages.slice(0, -1),
      updatedAt: Date.now(),
    }));

    queueMicrotask(() => {
      void streamChatCompletionInternalRef.current(userContent, historyBeforeUser);
    });
  }, [streaming, aiAvailable, messages, updateActiveSession]);

  sendMessageRef.current = sendMessage;

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

  const handleClear = useCallback(() => {
    updateActiveSession((s) => ({ ...s, messages: [], updatedAt: Date.now() }));
  }, [updateActiveSession]);

  // 停止生成
  const handleStop = useCallback(() => {
    userStoppedRef.current = true;
    const rid = streamRequestIdRef.current;
    if (rid) {
      void invoke('stop_ai_stream', { requestId: rid });
      streamRequestIdRef.current = null;
    }
    abortRef.current?.abort();
  }, []);

  // 快捷操作
  const handleQuickAction = useCallback(
    (item: TaskListQuickActionItem) => {
      setActionStore((prev) => {
        const next = recordRecentUsed(prev, item.id);
        saveQuickActions(host.storage, next);
        return next;
      });
      const prompt = substituteTaskListPrompt(item.prompt, activeList, inputValue.trim());
      sendMessageRef.current(prompt);
    },
    [activeList, host.storage, inputValue],
  );

  const handlePaletteSelect = useCallback(
    (item: TaskListQuickActionItem) => {
      setActionStore((prev) => {
        const next = recordRecentUsed(prev, item.id);
        saveQuickActions(host.storage, next);
        return next;
      });
      const prompt = substituteTaskListPrompt(item.prompt, activeList, inputValue.trim());
      sendMessageRef.current(prompt);
    },
    [activeList, host.storage, inputValue],
  );

  // 创建新会话
  const handleNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: t('taskList.newSession', { defaultValue: '新对话' }),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setSessionMenuOpen(false);
  }, [t]);

  // 删除会话
  const handleDeleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s.id !== sessionId);
      setActiveSessionId((aid) => (aid === sessionId ? next[0]?.id ?? 'default' : aid));
      return next;
    });
  }, []);

  // 解析并插入任务
  const extractAndInsertTasks = useCallback(
    (content: string) => {
      const taskMatch = content.match(/```tasks\n([\s\S]*?)\n```/);
      if (!taskMatch) return;

      const taskText = taskMatch[1];
      const lines = taskText.split('\n');
      const newTasks: TaskItem[] = [];

      let currentTask: TaskItem | null = null;
      let currentContent: string[] = [];

      for (const line of lines) {
        const match = line.match(/^- \[(高|中|低|High|Medium|Low)\]\s*(.+)/);
        if (match) {
          if (currentTask) {
            currentTask.content = currentContent.join('\n').trim();
            newTasks.push(currentTask);
          }
          const priorityLabel = match[1];
          let priority: TaskPriority = 'medium';
          if (priorityLabel === '高' || priorityLabel === 'High') priority = 'high';
          else if (priorityLabel === '低' || priorityLabel === 'Low') priority = 'low';

          currentTask = createEmptyTask(priority);
          currentContent = [match[2].trim()];
        } else if (currentTask && line.trim()) {
          currentContent.push(line.trim());
        }
      }

      if (currentTask) {
        currentTask.content = currentContent.join('\n').trim();
        newTasks.push(currentTask);
      }

      if (newTasks.length > 0) {
        onAddTasks(newTasks);
      }
    },
    [onAddTasks],
  );

  const inputPlaceholder = t('taskList.inputPlaceholder', {
    defaultValue: '输入任务或问题，按 Enter 发送...',
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className={SIDEBAR_AI_HEADER_PANEL}>
        <div className={cn(SIDEBAR_AI_HEADER_ROW, 'gap-1.5')}>
          <CheckSquare className="h-4 w-4 text-sky-500 shrink-0" />
          <Popover open={sessionMenuOpen} onOpenChange={setSessionMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-sm font-medium truncate max-w-[140px] hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-0.5 text-left"
                title={t('calculator.switchSession', { defaultValue: '切换对话' })}
              >
                {activeSession?.title || t('taskList.aiAssistant', { defaultValue: 'AI 助手' })}
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-card" align="start">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent',
                      s.id === activeSessionId && 'bg-accent font-medium',
                    )}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left truncate"
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setSessionMenuOpen(false);
                      }}
                    >
                      {s.title} ({s.messages.length})
                    </button>
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        className="opacity-50 hover:opacity-100 hover:text-destructive p-0.5"
                        title={t('common.delete', { defaultValue: '删除' })}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(s.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t mt-1 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-sm gap-1"
                  onClick={handleNewSession}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  {t('taskList.newSession', { defaultValue: '新对话' })}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex-1 min-w-0" />
          <span
            className="text-[10px] text-muted-foreground tabular-nums truncate max-w-[88px]"
            title={contextHint}
          >
            {contextHint}
          </span>
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
                  <span className="text-sm font-medium">
                    {t('taskList.aiSystemPrompt', { defaultValue: '附加系统说明' })}
                  </span>
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
                  placeholder={t('taskList.aiSystemPromptPlaceholder', {
                    defaultValue: '附加在默认系统提示之后的说明（可选）…',
                  })}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const next = promptDraft.trim();
                      setCustomSystemPrompt(next);
                      host.storage.set(TASKLIST_CUSTOM_SYSTEM_KEY, next);
                      setPromptOpen(false);
                    }}
                  >
                    {t('calculator.aiSystemPromptSave', { defaultValue: '保存' })}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={handleClear}
            title={t('calculator.clearSession', { defaultValue: '清空对话' })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={onClose}
            title={t('calculator.hideAI', { defaultValue: '关闭 AI' })}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className={SIDEBAR_AI_HEADER_SUBROW}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs gap-1 shrink-0"
                title={t('taskList.quickActionsButton', { defaultValue: '快捷操作' })}
              >
                <Zap className="h-3.5 w-3.5" />
                {t('taskList.quickActionsButton', { defaultValue: '快捷操作' })}
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
                      <DynamicIcon name={cat.icon} className="h-3.5 w-3.5 shrink-0" />
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
                          <DynamicIcon name={item.icon} className="h-3 w-3 shrink-0" />
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
                {t('taskList.searchAllActions', { defaultValue: '搜索全部… (⌘K)' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!aiAvailable && (
        <div className="mx-3 mt-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900 dark:text-amber-100/95">
          {t('taskList.aiUnavailableHint', {
            defaultValue: '请先在设置中配置可用的 AI 服务、API Key 与模型后再使用侧栏对话。',
          })}
        </div>
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.length === 0 && !streaming && (
          <div className="py-4 space-y-4">
            <div className="text-center">
              <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                {t('taskList.aiHint', { defaultValue: '任务管理 AI 助手' })}
              </p>
              <p className="text-xs text-muted-foreground/80 mt-1 px-2">
                {t('taskList.aiHintDesc', { defaultValue: '使用快捷操作或输入问题' })}
              </p>
            </div>
            {aiAvailable && (
              <div className="flex flex-col gap-2 px-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t('taskList.aiEmptySuggestTitle', { defaultValue: '试试' })}
                </p>
                <div className="flex flex-col gap-1.5">
                  {[
                    {
                      label: t('taskList.emptySuggest1', { defaultValue: '整理今日待办' }),
                      prompt: t('taskList.emptySuggest1Prompt', {
                        defaultValue: '根据当前列表，帮我梳理今日最优先的 3 件事，并说明理由。',
                      }),
                    },
                    {
                      label: t('taskList.emptySuggest2', { defaultValue: '拆解复杂任务' }),
                      prompt: t('taskList.emptySuggest2Prompt', {
                        defaultValue: '选一个待办，把它拆成可执行的子步骤，并估计每一步大概耗时。',
                      }),
                    },
                    {
                      label: t('taskList.emptySuggest3', { defaultValue: '生成 tasks 示例' }),
                      prompt: t('taskList.emptySuggest3Prompt', {
                        defaultValue:
                          '请用 ```tasks 代码块给出 2 条示例任务（含优先级标记），便于我了解格式。',
                      }),
                    },
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      disabled={streaming}
                      className="text-left text-xs rounded-md border border-border/80 bg-muted/40 px-2.5 py-1.5 text-foreground/90 hover:bg-muted/70 transition-colors disabled:opacity-50"
                      onClick={() => void sendMessage(s.prompt)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((msg, idx) => {
          const isLastAssistant = msg.role === 'assistant' && idx === messages.length - 1 && !streaming;
          const hasTasksBlock = msg.role === 'assistant' && msg.content.includes('```tasks');
          let assistantActions: ReactNode;
          if (msg.role === 'assistant' && (hasTasksBlock || isLastAssistant)) {
            assistantActions = (
              <div className="flex flex-wrap items-center gap-2 gap-y-1">
                {hasTasksBlock && (
                  <button
                    type="button"
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    onClick={() => extractAndInsertTasks(msg.content)}
                  >
                    <Zap className="h-3 w-3" />
                    {t('taskList.insertTasks', { defaultValue: '插入任务' })}
                  </button>
                )}
                {isLastAssistant && (
                  <button
                    type="button"
                    className={cn(MSG_ACTION_BTN, 'px-0')}
                    onClick={handleRegenerateLast}
                    title={t('taskList.regenerate', { defaultValue: '重新生成' })}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t('taskList.regenerate', { defaultValue: '重新生成' })}
                  </button>
                )}
              </div>
            );
          }
          return (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={msg.role === 'user' ? 'max-w-[85%]' : 'max-w-[85%] w-full min-w-0'}>
                <DocTypeChatMessage message={{ role: msg.role, content: msg.content }} actions={assistantActions} />
              </div>
            </div>
          );
        })}

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

      {/* 输入区（与 CalculatorAISidebar 一致） */}
      <div className={cn(INPUT_AREA_CLASS, 'bg-card')}>
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={inputPlaceholder}
            className={cn(TEXTAREA_CLASS, 'flex-1 min-h-[52px] min-w-0')}
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
            value={selectedServiceId ?? ''}
            onChange={(id) => {
              setSelectedServiceId(id);
              host.storage.set(TASKLIST_AI_SERVICE_STORAGE_KEY, id);
            }}
            disabled={streaming}
          />
          {providerCaps.webSearch && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(AI_OPTION_BTN_BASE, webSearchEnabled ? AI_OPTION_ACTIVE : AI_OPTION_INACTIVE)}
              onClick={() => {
                setWebSearchEnabled((v) => {
                  const next = !v;
                  host.storage.set(TASKLIST_AI_WEB_KEY, next);
                  return next;
                });
              }}
              disabled={streaming}
              title={webSearchEnabled ? t('taskList.webSearchOn', { defaultValue: '联网：开' }) : t('taskList.webSearchOff', { defaultValue: '联网：关' })}
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
              onClick={() => {
                setDeepThinkEnabled((v) => {
                  const next = !v;
                  host.storage.set(TASKLIST_AI_THINK_KEY, next);
                  return next;
                });
              }}
              disabled={streaming}
              title={
                deepThinkEnabled
                  ? t('taskList.deepThinkOn', { defaultValue: '深度思考：开' })
                  : t('taskList.deepThinkOff', { defaultValue: '深度思考：关' })
              }
            >
              <Brain className="h-3 w-3" />
              <span className="hidden sm:inline">{t('chat.thinking', { defaultValue: '深度思考' })}</span>
            </Button>
          )}
        </div>
      </div>

      <TaskListCommandPalette
        open={qaPaletteOpen}
        onClose={closePalette}
        onSelectAction={handlePaletteSelect}
        storage={host.storage}
      />
    </div>
  );
}
