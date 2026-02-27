/**
 * 编程区专属 AI 助手面板
 *
 * 独立于主程序的 ChatPanel，专为编程场景设计：
 * - 快捷操作按钮（修正、解释、优化、安装依赖、生成文档、测试、一键生成运行）
 * - 上下文感知对话（自动注入当前代码 + 运行输出 + 错误）
 * - AI 回复中的代码块支持「应用到编辑器」
 * - 流式响应（实时解析代码块）
 * - 系统提示词可见可编辑
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useCodingStore, getDefaultSystemPrompt } from '@/stores/useCodingStore';
import type { AssistantMode } from '@/stores/useCodingStore';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, getActiveService } from '@aidocplus/shared-types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  chatWithAssistant,
  buildContextMessages,
  extractCodeBlocks,
  computeLineDiff,
  QUICK_ACTIONS,
} from './codingAI';
import type { ChatMessage, QuickActionId, AIChatOptions } from './codingAI';
import {
  Wrench, BookOpen, Zap, Package, FileText, FlaskConical,
  Send, Square, Trash2, Loader2, Copy, Check, ArrowDownToLine,
  Sparkles, Bot, ScrollText, RotateCcw, ChevronDown,
  Play, Globe, Brain, MessageSquare, Code, ListChecks, GitCompareArrows,
} from 'lucide-react';

// ── 图标映射 ──
const ICON_MAP: Record<string, React.ElementType> = {
  Wrench, BookOpen, Zap, Package, FileText, FlaskConical,
};

// ── Props ──
interface CodingAssistantPanelProps {
  currentCode: string;
  lastOutput: string;
  lastError: string;
  fileName: string;
  language?: string;
  onApplyCode: (code: string) => void;
  onApplyAndRun?: (code: string) => void;
  selectedCode?: string;
  activeTabId?: string;
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

let nextMsgId = 1;
function genMsgId() { return `msg_${Date.now()}_${nextMsgId++}`; }

export function CodingAssistantPanel({
  currentCode, lastOutput, lastError, fileName, language, onApplyCode, onApplyAndRun,
  selectedCode, activeTabId, initialMessages, onMessagesChange,
}: CodingAssistantPanelProps) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useCodingStore();

  // ── 对话状态（支持外部持久化） ──
  const [messages, setMessagesLocal] = useState<ChatMessage[]>(initialMessages || []);
  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessagesLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onMessagesChange?.(next);
      return next;
    });
  }, [onMessagesChange]);

  // 当 activeTabId 变化时同步初始消息
  useEffect(() => {
    setMessagesLocal(initialMessages || []);
  }, [activeTabId]);
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [diffOpenId, setDiffOpenId] = useState<string | null>(null);

  // ── 提示词编辑状态 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化提示词草稿
  useEffect(() => {
    setPromptDraft(settings.systemPrompt || getDefaultSystemPrompt(language));
  }, [settings.systemPrompt, language]);

  // ── AI 服务选择 ──
  const settingsStore = useSettingsStore();
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const codingServiceId = settings.codingServiceId || '';
  const effectiveService = codingServiceId
    ? enabledServices.find(s => s.id === codingServiceId) || getActiveService(settingsStore.ai)
    : getActiveService(settingsStore.ai);

  // ── AI 可用性 + 能力检测（响应式） ──
  const aiParams = getAIInvokeParamsForService(codingServiceId || undefined);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);
  const providerCaps = (() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider as any);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  })();

  // ── 模式切换状态 ──
  const [modePopoverOpen, setModePopoverOpen] = useState(false);
  const mode: AssistantMode = settings.assistantMode || 'chat';

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // ── 获取有效的系统提示词 ──
  const getEffectivePrompt = useCallback(() => {
    return (settings.systemPrompt && settings.systemPrompt.trim()) || undefined;
  }, [settings.systemPrompt]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return;
    if (!aiAvailable) return;

    const userMsg: ChatMessage = {
      id: genMsgId(), role: 'user', content: userText.trim(), timestamp: Date.now(),
    };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputValue('');
    setStreaming(true);
    setStreamingContent('');

    const abort = new AbortController();
    abortRef.current = abort;

    let accumulated = '';
    try {
      const contextMsgs = buildContextMessages(updatedHistory, {
        currentCode, selectedCode, lastOutput, lastError, fileName,
        customSystemPrompt: getEffectivePrompt(),
        mode, language,
      });

      const chatOptions: AIChatOptions = {
        enableWebSearch: settings.enableWebSearch && providerCaps.webSearch ? true : undefined,
        enableThinking: settings.enableThinking && providerCaps.thinking ? true : undefined,
        serviceId: codingServiceId || undefined,
      };

      await chatWithAssistant(contextMsgs, (delta) => {
        accumulated += delta;
        setStreamingContent(accumulated);
      }, abort.signal, chatOptions);

      const codeBlocks = extractCodeBlocks(accumulated);
      const assistantMsg: ChatMessage = {
        id: genMsgId(), role: 'assistant', content: accumulated,
        timestamp: Date.now(), codeBlocks,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      if (!abort.signal.aborted) {
        const errMsg: ChatMessage = {
          id: genMsgId(), role: 'assistant',
          content: `❌ ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [messages, streaming, currentCode, lastOutput, lastError, fileName, aiAvailable, getEffectivePrompt]);

  // ── 停止生成 ──
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (streamingContent) {
      const codeBlocks = extractCodeBlocks(streamingContent);
      setMessages(prev => [...prev, {
        id: genMsgId(), role: 'assistant', content: streamingContent + '\n\n_(已中断)_',
        timestamp: Date.now(), codeBlocks,
      }]);
    }
    setStreaming(false);
    setStreamingContent('');
  }, [streamingContent]);

  // ── 快捷操作 ──
  const handleQuickAction = useCallback((actionId: QuickActionId) => {
    const action = QUICK_ACTIONS.find(a => a.id === actionId);
    if (!action) return;
    if (action.needsError && !lastError) return;

    const prompt = action.buildPrompt({ code: currentCode, error: lastError }, language);
    sendMessage(prompt);
  }, [currentCode, lastError, language, sendMessage]);

  // ── 清除对话 ──
  const handleClear = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
  }, []);

  // ── 导出对话 ──
  const handleExportChat = useCallback(() => {
    if (messages.length === 0) return;
    const lines = messages.map(m => {
      const role = m.role === 'user' ? '👤 用户' : m.role === 'assistant' ? '🤖 助手' : '⚙ 系统';
      return `### ${role}\n\n${m.content}\n`;
    });
    const md = `# ${fileName || '对话记录'}\n\n${lines.join('\n---\n\n')}`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(fileName || 'chat').replace(/\.[^.]+$/, '')}_chat_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, fileName]);

  // ── 复制代码 ──
  const handleCopy = useCallback((text: string, blockId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(blockId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ── 提示词编辑 ──
  const handlePromptChange = useCallback((value: string) => {
    setPromptDraft(value);
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    promptTimerRef.current = setTimeout(() => {
      updateSettings({ systemPrompt: value.trim() === getDefaultSystemPrompt(language).trim() ? '' : value });
    }, 800);
  }, [updateSettings, language]);

  const handleResetPrompt = useCallback(() => {
    setPromptDraft(getDefaultSystemPrompt(language));
    updateSettings({ systemPrompt: '' });
  }, [updateSettings, language]);

  // ── Plan 模式：同意方案后自动切换到 Code 执行 ──
  const handleApprovePlan = useCallback((planContent: string) => {
    updateSettings({ assistantMode: 'code' });
    // 下一个 tick 发送，确保 mode 已切换
    setTimeout(() => {
      sendMessage(`请根据以下计划，直接生成完整可运行的 Python 代码：\n\n${planContent}`);
    }, 0);
  }, [updateSettings, sendMessage]);

  // ── 有无错误（控制修正按钮） ──
  const hasError = !!lastError;

  // ── 渲染消息内容（简易 Markdown，代码块可操作） ──
  const renderContentFromText = useCallback((content: string, msgId: string) => {
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    const re = /```([a-zA-Z]*)\s*\n([\s\S]*?)```/g;
    let match;
    let blockIdx = 0;

    while ((match = re.exec(content)) !== null) {
      if (match.index > lastIdx) {
        parts.push(
          <span key={`t${lastIdx}`} className="whitespace-pre-wrap">{content.slice(lastIdx, match.index)}</span>
        );
      }
      const codeLang = match[1] || language || 'code';
      const code = match[2].trim();
      const blockId = `${msgId}_b${blockIdx}`;
      parts.push(
        <div key={blockId} className="my-1.5 rounded border bg-muted/40 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-0.5 bg-muted/60 border-b">
            <span className="text-sm text-muted-foreground font-mono">{codeLang}</span>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5"
                onClick={() => handleCopy(code, blockId)}>
                {copiedId === blockId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedId === blockId ? '已复制' : '复制'}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5 text-blue-600 dark:text-blue-400"
                onClick={() => onApplyCode(code)}>
                <ArrowDownToLine className="h-3 w-3" />{t('coding.applyCode', { defaultValue: '应用' })}
              </Button>
              {onApplyAndRun && (
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5 text-green-600 dark:text-green-400"
                  onClick={() => onApplyAndRun(code)}>
                  <Play className="h-3 w-3" />{t('coding.applyAndRun', { defaultValue: '应用并运行' })}
                </Button>
              )}
              <Button variant="ghost" size="sm" className={`h-7 px-1.5 text-sm gap-0.5 ${diffOpenId === blockId ? 'text-orange-500' : ''}`}
                onClick={() => setDiffOpenId(diffOpenId === blockId ? null : blockId)}
                title={t('coding.diffPreview', { defaultValue: '差异预览' })}>
                <GitCompareArrows className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {diffOpenId === blockId ? (
            <pre className="p-2 text-xs font-mono overflow-x-auto overflow-y-auto max-h-60 whitespace-pre select-text">
              {computeLineDiff(currentCode, code).map((dl, di) => (
                <div key={di} className={
                  dl.type === 'add' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                  dl.type === 'del' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through' : 'text-muted-foreground'
                }>{dl.type === 'add' ? '+ ' : dl.type === 'del' ? '- ' : '  '}{dl.text}</div>
              ))}
            </pre>
          ) : (
            <pre className="p-2 text-sm font-mono overflow-x-auto overflow-y-auto max-h-60 whitespace-pre select-text">{code}</pre>
          )}
        </div>
      );
      lastIdx = match.index + match[0].length;
      blockIdx++;
    }
    if (lastIdx < content.length) {
      const remaining = content.slice(lastIdx);
      // 检测未闭合的代码块（流式生成中 ``` 还没闭合）
      const unclosedMatch = remaining.match(/```([a-zA-Z]*)\s*\n([\s\S]*)$/);
      if (unclosedMatch) {
        const beforeCode = remaining.slice(0, unclosedMatch.index);
        if (beforeCode) {
          parts.push(
            <span key={`t${lastIdx}`} className="whitespace-pre-wrap">{beforeCode}</span>
          );
        }
        const unclosedLang = unclosedMatch[1] || language || 'code';
        const unclosedCode = unclosedMatch[2];
        parts.push(
          <div key={`unc_${lastIdx}`} className="my-1.5 rounded border bg-muted/40 overflow-hidden">
            <div className="flex items-center justify-between px-2 py-0.5 bg-muted/60 border-b">
              <span className="text-sm text-muted-foreground font-mono">{unclosedLang}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" />生成中...</span>
            </div>
            <pre className="p-2 text-sm font-mono overflow-x-auto overflow-y-auto max-h-60 whitespace-pre select-text">{unclosedCode}</pre>
          </div>
        );
      } else {
        parts.push(
          <span key={`t${lastIdx}`} className="whitespace-pre-wrap">{remaining}</span>
        );
      }
    }
    return parts;
  }, [copiedId, handleCopy, onApplyCode, language]);

  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* ═══ 顶部：标题 + 快捷操作 ═══ */}
      <div className="flex-shrink-0 border-b">
        {/* 标题栏 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Bot className="h-4 w-4 text-blue-500" />
          <span className="text-base font-medium">{t('coding.aiAssistant', { defaultValue: 'AI 编程助手' })}</span>
          {/* AI 服务选择器（≥2 个已启用服务时显示） */}
          {enabledServices.length >= 2 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 max-w-[120px]"
                  title={t('coding.switchAiService', { defaultValue: '切换 AI 服务' })}>
                  <span className="truncate">
                    {effectiveService ? effectiveService.name : t('coding.globalDefault', { defaultValue: '全局默认' })}
                  </span>
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="bottom" className="w-48 p-1">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">{t('coding.selectAiService', { defaultValue: '选择 AI 服务' })}</p>
                <button
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
                    !codingServiceId ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                  onClick={() => updateSettings({ codingServiceId: '' })}>
                  {!codingServiceId && <Check className="h-3 w-3 flex-shrink-0" />}
                  <span className={!codingServiceId ? '' : 'ml-[18px]'}>{t('coding.globalDefault', { defaultValue: '全局默认' })}</span>
                </button>
                {enabledServices.map(svc => {
                  const isSelected = codingServiceId === svc.id;
                  return (
                    <button key={svc.id}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
                        isSelected ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                      onClick={() => updateSettings({ codingServiceId: svc.id })}>
                      {isSelected && <Check className="h-3 w-3 flex-shrink-0" />}
                      <span className={isSelected ? '' : 'ml-[18px]'}>{svc.name}</span>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className={`h-7 px-1.5 text-sm gap-0.5 ${promptOpen ? 'text-blue-500' : ''}`}
            onClick={() => setPromptOpen(v => !v)}
            title={t('coding.systemPrompt', { defaultValue: '系统提示词' })}>
            <ScrollText className="h-3 w-3" />{t('coding.systemPrompt', { defaultValue: '提示词' })}
          </Button>
          {/* 运行/保存按钮已移至主工具栏，避免重复 */}
          {messages.length > 0 && (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5"
                onClick={handleExportChat} disabled={streaming}
                title={t('coding.exportChat', { defaultValue: '导出对话' })}>
                <ArrowDownToLine className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5"
                onClick={handleClear} disabled={streaming}>
                <Trash2 className="h-3 w-3" />{t('coding.clearChat', { defaultValue: '清除' })}
              </Button>
            </>
          )}
        </div>

        {/* 系统提示词编辑区（折叠） */}
        {promptOpen && (
          <div className="px-2 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('coding.systemPromptLabel', { defaultValue: '系统提示词' })}
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">{(language || 'python').toUpperCase()}</span>
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5"
                onClick={handleResetPrompt}
                title={t('coding.resetPrompt', { defaultValue: '恢复默认' })}>
                <RotateCcw className="h-3 w-3" />{t('coding.resetPrompt', { defaultValue: '恢复默认' })}
              </Button>
            </div>
            <textarea
              value={promptDraft}
              onChange={e => handlePromptChange(e.target.value)}
              className="w-full resize-y rounded-md border bg-muted/30 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] max-h-[200px]"
              rows={5}
              placeholder={getDefaultSystemPrompt(language)}
            />
          </div>
        )}

        {/* 快捷操作按钮 */}
        <div className="flex items-center gap-1 px-2 pb-1.5 flex-wrap">
          {QUICK_ACTIONS.map(action => {
            const Icon = ICON_MAP[action.icon] || Sparkles;
            const disabled = streaming || !aiAvailable || (action.needsError && !hasError);
            return (
              <Button key={action.id} variant="outline" size="sm"
                className="h-7 px-2 text-sm gap-0.5"
                disabled={disabled}
                onClick={() => handleQuickAction(action.id)}
                title={action.label}>
                <Icon className="h-2.5 w-2.5" />{action.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ═══ 对话区 ═══ */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 text-center px-4 gap-2">
            <Sparkles className="h-8 w-8" />
            <p className="text-base">{t('coding.aiWelcome', { defaultValue: '我是你的 AI 编程助手\n描述你的需求，或使用上方快捷操作' })}</p>
            {!aiAvailable && (
              <p className="text-sm text-destructive">{t('coding.aiNotConfigured', { defaultValue: '请先在设置中配置 AI 服务' })}</p>
            )}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`group/msg flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[95%] rounded-lg px-2.5 py-1.5 relative ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white text-base'
                : 'bg-muted/50 text-foreground text-base'
            }`}>
              {msg.role === 'user' ? (
                <div className="flex items-start gap-1">
                  <span className="whitespace-pre-wrap flex-1">{msg.content}</span>
                  <button
                    className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex-shrink-0 mt-0.5 p-0.5 rounded hover:bg-white/20"
                    onClick={() => handleCopy(msg.content, `user_${msg.id}`)}
                    title="复制">
                    {copiedId === `user_${msg.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {renderContentFromText(msg.content, msg.id)}
                  {/* Plan 模式下：AI 回复底部显示"同意并执行"按钮 */}
                  {mode === 'plan' && !streaming && !msg.content.startsWith('❌') && (
                    <div className="pt-2 border-t border-border/40 mt-2">
                      <Button variant="outline" size="sm" className="h-7 text-sm gap-1 text-green-600 dark:text-green-400"
                        onClick={() => handleApprovePlan(msg.content)}>
                        <Play className="h-3 w-3" />
                        {t('coding.approvePlan', { defaultValue: '同意方案，生成代码' })}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 流式响应（实时解析代码块） */}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[95%] rounded-lg px-2.5 py-1.5 text-base bg-muted/50 text-foreground">
              {streamingContent ? (
                <div className="space-y-0.5">
                  {renderContentFromText(streamingContent, '_streaming_')}
                </div>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground text-base">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('coding.aiThinking', { defaultValue: '思考中...' })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ 输入区 ═══ */}
      <div className="flex-shrink-0 border-t p-2 space-y-1.5">
        {/* 输入框（固定3行） */}
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={t('coding.aiInputPlaceholder', { defaultValue: '输入你的问题或需求...' })}
          className="w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-ring"
          rows={3}
          disabled={streaming}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(inputValue);
            }
          }}
        />
        {/* 底部状态行：模式选择 + 能力 toggle + 发送 */}
        <div className="flex items-center gap-1.5">
          {/* 模式 Popover 菜单 */}
          <Popover open={modePopoverOpen} onOpenChange={setModePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"
                className={`h-7 px-2 text-sm gap-1 ${mode === 'plan' ? 'text-amber-700 dark:text-amber-300' : 'text-blue-600 dark:text-blue-400'}`}>
                {mode === 'chat' && <><MessageSquare className="h-3 w-3" />{t('coding.modeChat', { defaultValue: '对话' })}</>}
                {mode === 'code' && <><Code className="h-3 w-3" />{t('coding.modeCode', { defaultValue: '代码' })}</>}
                {mode === 'plan' && <><ListChecks className="h-3 w-3" />{t('coding.modePlan', { defaultValue: '计划' })}</>}
                <ChevronDown className="h-2 w-2 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="start" side="top">
              {([
                { id: 'chat' as AssistantMode, icon: MessageSquare, label: t('coding.modeChat', { defaultValue: '对话' }), desc: t('coding.modeChatDesc', { defaultValue: '通用问答与调试' }) },
                { id: 'code' as AssistantMode, icon: Code, label: t('coding.modeCode', { defaultValue: '代码' }), desc: t('coding.modeCodeDesc', { defaultValue: '直接生成可运行代码' }) },
                { id: 'plan' as AssistantMode, icon: ListChecks, label: t('coding.modePlan', { defaultValue: '计划' }), desc: t('coding.modePlanDesc', { defaultValue: '分步规划复杂任务' }) },
              ]).map(item => (
                <button key={item.id}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-base transition-colors ${
                    mode === item.id
                      ? (item.id === 'plan' ? 'bg-amber-50 dark:bg-amber-800/20 text-amber-700 dark:text-amber-300' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium')
                      : 'hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                  onClick={() => { updateSettings({ assistantMode: item.id }); setModePopoverOpen(false); }}>
                  <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${mode === item.id && item.id === 'plan' ? 'text-amber-600 dark:text-amber-400' : mode === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
                  <div className="min-w-0">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.desc}</div>
                  </div>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* 联网搜索 toggle */}
          <Button variant="ghost" size="sm"
            className={`h-7 px-1.5 text-sm gap-0.5 ${settings.enableWebSearch && providerCaps.webSearch ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
            disabled={!providerCaps.webSearch}
            onClick={() => updateSettings({ enableWebSearch: !settings.enableWebSearch })}
            title={providerCaps.webSearch ? t('coding.webSearch', { defaultValue: '联网搜索' }) : t('coding.webSearchUnsupported', { defaultValue: '当前模型不支持联网' })}>
            <Globe className="h-3 w-3" />
          </Button>

          {/* 深度思考 toggle */}
          <Button variant="ghost" size="sm"
            className={`h-7 px-1.5 text-sm gap-0.5 ${settings.enableThinking && providerCaps.thinking ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
            disabled={!providerCaps.thinking}
            onClick={() => updateSettings({ enableThinking: !settings.enableThinking })}
            title={providerCaps.thinking ? t('coding.thinking', { defaultValue: '深度思考' }) : t('coding.thinkingUnsupported', { defaultValue: '当前模型不支持深度思考' })}>
            <Brain className="h-3 w-3" />
          </Button>

          {/* 上下文指示 */}
          <div className="flex-1 flex items-center gap-1 text-sm text-muted-foreground truncate">
            <span className="truncate max-w-[100px]">{fileName}</span>
            {lastError && <span className="text-destructive">·错误</span>}
          </div>

          {/* 发送/停止 */}
          {streaming ? (
            <Button variant="outline" size="icon" className="h-6 w-6 flex-shrink-0" onClick={handleStop}>
              <Square className="h-3 w-3" />
            </Button>
          ) : (
            <Button variant="default" size="icon"
              className="h-6 w-6 flex-shrink-0 bg-blue-600 hover:bg-blue-700"
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || !aiAvailable}>
              <Send className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
