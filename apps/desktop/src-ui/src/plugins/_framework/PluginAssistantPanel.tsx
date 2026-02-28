/**
 * 插件通用 AI 助手面板
 *
 * 参照 CodingAssistantPanel 设计，但通用于所有插件。
 * 支持：流式对话、快捷操作、系统提示词编辑、聊天历史持久化、AI 服务选择。
 *
 * 优先级：插件自定义 AssistantPanelComponent > assistantConfig + 本面板 > 默认配置
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { usePluginHost } from './PluginHostAPI';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { getProviderConfig, getActiveService } from '@aidocplus/shared-types';
import type { Document } from '@aidocplus/shared-types';
import type { PluginAssistantConfig, PluginQuickAction } from '../types';
import { createDefaultAssistantConfig } from '../types';
import {
  type AssistantMessage,
  genMsgId,
  buildAssistantMessages,
  chatWithPluginAssistant,
  exportChatAsMarkdown,
  getDefaultQuickActions,
} from './pluginAssistantAI';
import {
  Send, Square, Trash2, Loader2, Copy, Check, ArrowDownToLine,
  Sparkles, Bot, ScrollText, RotateCcw, ChevronDown,
  HelpCircle, Brain, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ── 图标映射 ──
const ICON_MAP: Record<string, React.ElementType> = {
  HelpCircle, Sparkles, Wand2: Sparkles, Brain, ScrollText,
};

function getIconComponent(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Sparkles;
}

// ── Props ──

export interface PluginAssistantPanelProps {
  /** 插件 ID */
  pluginId: string;
  /** 插件名称 */
  pluginName: string;
  /** 插件描述 */
  pluginDesc?: string;
  /** AI 助手配置 */
  assistantConfig?: PluginAssistantConfig;
  /** 当前文档 */
  document: Document;
  /** 插件数据 */
  pluginData: unknown;
  /** AI 正文内容 */
  aiContent: string;
  /** 标签页 ID */
  tabId: string;
  /** 关闭面板回调 */
  onClose?: () => void;
}

const STORAGE_KEY = '_assistant_messages';

export function PluginAssistantPanel({
  pluginId,
  pluginName,
  pluginDesc,
  assistantConfig: externalConfig,
  document: doc,
  pluginData,
  aiContent,
}: PluginAssistantPanelProps) {
  const host = usePluginHost();
  const { t } = useTranslation();

  // 有效配置：外部 > 默认
  const config = useMemo(() => {
    return externalConfig || createDefaultAssistantConfig(pluginName, pluginDesc || '');
  }, [externalConfig, pluginName, pluginDesc]);

  const quickActions: PluginQuickAction[] = useMemo(() => {
    return config.quickActions || getDefaultQuickActions(pluginName);
  }, [config.quickActions, pluginName]);

  // ── 对话状态 ──
  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    const saved = host.storage.get<AssistantMessage[]>(STORAGE_KEY);
    return saved || [];
  });
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── 提示词编辑 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState(config.defaultSystemPrompt);
  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    return host.storage.get<string>('_assistant_prompt') || '';
  });

  // ── AI 服务选择 ──
  const settingsStore = useSettingsStore();
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => {
    return host.storage.get<string>('_assistant_service_id') || '';
  });

  const effectiveService = selectedServiceId
    ? enabledServices.find(s => s.id === selectedServiceId) || getActiveService(settingsStore.ai)
    : getActiveService(settingsStore.ai);

  // AI 可用性
  const aiParams = getAIInvokeParamsForService(selectedServiceId || undefined);
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);
  const providerCaps = (() => {
    if (!aiParams.provider) return { webSearch: false, thinking: false };
    const cfg = getProviderConfig(aiParams.provider as any);
    return cfg?.capabilities || { webSearch: false, thinking: false };
  })();
  const [enableWebSearch, setEnableWebSearch] = useState(false);

  // 持久化消息
  useEffect(() => {
    host.storage.set(STORAGE_KEY, messages);
  }, [messages, host.storage]);

  // 插件切换时重新加载消息
  useEffect(() => {
    const saved = host.storage.get<AssistantMessage[]>(STORAGE_KEY);
    setMessages(saved || []);
    const savedPrompt = host.storage.get<string>('_assistant_prompt') || '';
    setCustomPrompt(savedPrompt);
    setPromptDraft(savedPrompt || config.defaultSystemPrompt);
  }, [pluginId]);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // ── 发送消息 ──
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return;
    if (!aiAvailable) return;

    const userMsg: AssistantMessage = {
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
      const contextMsgs = buildAssistantMessages(updatedHistory, config, {
        document: doc,
        pluginData,
        aiContent,
        customSystemPrompt: customPrompt || undefined,
      });

      await chatWithPluginAssistant(host, contextMsgs, (delta) => {
        accumulated += delta;
        setStreamingContent(accumulated);
      }, abort.signal, selectedServiceId || undefined);

      const assistantMsg: AssistantMessage = {
        id: genMsgId(), role: 'assistant', content: accumulated, timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      if (!abort.signal.aborted) {
        const errMsg: AssistantMessage = {
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
  }, [messages, streaming, doc, pluginData, aiContent, aiAvailable, config, customPrompt, host, selectedServiceId]);

  // ── 停止生成 ──
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (streamingContent) {
      setMessages(prev => [...prev, {
        id: genMsgId(), role: 'assistant', content: streamingContent + '\n\n' + t('pluginAssistant.interrupted', { defaultValue: '_(已中断)_' }),
        timestamp: Date.now(),
      }]);
    }
    setStreaming(false);
    setStreamingContent('');
  }, [streamingContent]);

  // ── 快捷操作 ──
  const handleQuickAction = useCallback((action: PluginQuickAction) => {
    const prompt = action.buildPrompt({ document: doc, pluginData, aiContent });
    sendMessage(prompt);
  }, [doc, pluginData, aiContent, sendMessage]);

  // ── 清除对话 ──
  const handleClear = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
  }, []);

  // ── 导出对话 ──
  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const md = exportChatAsMarkdown(messages, pluginName);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pluginName}_chat_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, pluginName]);

  // ── 复制 ──
  const handleCopy = useCallback((text: string, blockId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(blockId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ── 提示词编辑 ──
  const handlePromptSave = useCallback(() => {
    const trimmed = promptDraft.trim();
    const isDefault = trimmed === config.defaultSystemPrompt.trim();
    const val = isDefault ? '' : trimmed;
    setCustomPrompt(val);
    host.storage.set('_assistant_prompt', val);
  }, [promptDraft, config.defaultSystemPrompt, host.storage]);

  const handlePromptReset = useCallback(() => {
    setPromptDraft(config.defaultSystemPrompt);
    setCustomPrompt('');
    host.storage.set('_assistant_prompt', '');
  }, [config.defaultSystemPrompt, host.storage]);

  // ── AI 服务切换 ──
  const handleServiceChange = useCallback((serviceId: string) => {
    setSelectedServiceId(serviceId);
    host.storage.set('_assistant_service_id', serviceId);
  }, [host.storage]);

  // ── 渲染消息内容 ──
  const renderContent = useCallback((content: string, msgId: string) => {
    // 简易 Markdown 渲染：代码块高亮 + 纯文本
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
      const codeLang = match[1] || 'code';
      const code = match[2].trim();
      const blockId = `${msgId}_b${blockIdx}`;
      parts.push(
        <div key={blockId} className="my-1.5 rounded border bg-muted/40 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-0.5 bg-muted/60 border-b">
            <span className="text-sm text-muted-foreground font-mono">{codeLang}</span>
            <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5"
              onClick={() => handleCopy(code, blockId)}>
              {copiedId === blockId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedId === blockId ? t('pluginAssistant.copied', { defaultValue: '已复制' }) : t('pluginAssistant.copy', { defaultValue: '复制' })}
            </Button>
          </div>
          <pre className="p-2 text-sm font-mono overflow-x-auto overflow-y-auto max-h-60 whitespace-pre select-text">{code}</pre>
        </div>
      );
      lastIdx = match.index + match[0].length;
      blockIdx++;
    }

    if (lastIdx < content.length) {
      const remaining = content.slice(lastIdx);
      // 未闭合代码块（流式生成中）
      const unclosedMatch = remaining.match(/```([a-zA-Z]*)\s*\n([\s\S]*)$/);
      if (unclosedMatch) {
        const beforeCode = remaining.slice(0, unclosedMatch.index);
        if (beforeCode) {
          parts.push(<span key={`t${lastIdx}`} className="whitespace-pre-wrap">{beforeCode}</span>);
        }
        const unclosedLang = unclosedMatch[1] || 'code';
        const unclosedCode = unclosedMatch[2];
        parts.push(
          <div key={`unc_${lastIdx}`} className="my-1.5 rounded border bg-muted/40 overflow-hidden">
            <div className="flex items-center justify-between px-2 py-0.5 bg-muted/60 border-b">
              <span className="text-sm text-muted-foreground font-mono">{unclosedLang}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" />{t('pluginAssistant.generating', { defaultValue: '生成中...' })}</span>
            </div>
            <pre className="p-2 text-sm font-mono overflow-x-auto overflow-y-auto max-h-60 whitespace-pre select-text">{unclosedCode}</pre>
          </div>
        );
      } else {
        parts.push(<span key={`t${lastIdx}`} className="whitespace-pre-wrap">{remaining}</span>);
      }
    }
    return parts;
  }, [copiedId, handleCopy]);

  return (
    <div className="flex flex-col h-full min-h-0 border-l bg-background">
      {/* ═══ 顶部：标题 + 操作 ═══ */}
      <div className="flex-shrink-0 border-b">
        {/* 标题栏 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <Bot className="h-4 w-4 text-blue-500" />
          <span className="text-base font-medium truncate">{t('pluginAssistant.title', { defaultValue: '{{name}} AI', name: pluginName })}</span>
          {/* AI 服务选择器 */}
          {enabledServices.length >= 2 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 max-w-[120px]"
                  title={t('pluginAssistant.switchService', { defaultValue: '切换 AI 服务' })}>
                  <span className="truncate">
                    {effectiveService ? effectiveService.name : t('pluginAssistant.globalDefault', { defaultValue: '全局默认' })}
                  </span>
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="bottom" className="w-48 p-1">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">{t('pluginAssistant.selectService', { defaultValue: '选择 AI 服务' })}</p>
                <button
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
                    !selectedServiceId ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                  onClick={() => handleServiceChange('')}>
                  {!selectedServiceId && <Check className="h-3 w-3 flex-shrink-0" />}
                  <span className={!selectedServiceId ? '' : 'ml-[18px]'}>{t('pluginAssistant.globalDefault', { defaultValue: '全局默认' })}</span>
                </button>
                {enabledServices.map(svc => {
                  const isSelected = selectedServiceId === svc.id;
                  return (
                    <button key={svc.id}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
                        isSelected ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                      onClick={() => handleServiceChange(svc.id)}>
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
            title={t('pluginAssistant.systemPrompt', { defaultValue: '系统提示词' })}>
            <ScrollText className="h-3 w-3" />{t('pluginAssistant.promptBtn', { defaultValue: '提示词' })}
          </Button>
          {messages.length > 0 && (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5"
                onClick={handleExport} disabled={streaming}
                title={t('pluginAssistant.exportChat', { defaultValue: '导出对话' })}>
                <ArrowDownToLine className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5"
                onClick={handleClear} disabled={streaming}>
                <Trash2 className="h-3 w-3" />{t('pluginAssistant.clear', { defaultValue: '清除' })}
              </Button>
            </>
          )}
        </div>

        {/* 系统提示词编辑区（折叠） */}
        {promptOpen && (
          <div className="px-2 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('pluginAssistant.systemPrompt', { defaultValue: '系统提示词' })}</span>
              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-sm gap-0.5"
                onClick={handlePromptReset} title="恢复默认">
                <RotateCcw className="h-3 w-3" />{t('pluginAssistant.resetDefault', { defaultValue: '恢复默认' })}
              </Button>
            </div>
            <textarea
              value={promptDraft}
              onChange={e => setPromptDraft(e.target.value)}
              onBlur={handlePromptSave}
              className="w-full resize-y rounded-md border bg-muted/30 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] max-h-[200px]"
              rows={5}
              placeholder={config.defaultSystemPrompt}
            />
          </div>
        )}

        {/* 快捷操作按钮 */}
        <div className="flex items-center gap-1 px-2 pb-1.5 flex-wrap">
          {quickActions.map(action => {
            const Icon = getIconComponent(action.icon);
            return (
              <Button key={action.id} variant="outline" size="sm"
                className="h-7 px-2 text-sm gap-0.5"
                disabled={streaming || !aiAvailable}
                onClick={() => handleQuickAction(action)}
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
            <p className="text-base">{t('pluginAssistant.emptyTitle', { defaultValue: '{{name}} AI 助手', name: pluginName })}</p>
            <p className="text-sm">{t('pluginAssistant.emptyHint', { defaultValue: '描述你的需求，或使用上方快捷操作' })}</p>
            {!aiAvailable && (
              <p className="text-sm text-destructive">{t('pluginAssistant.noAiService', { defaultValue: '请先在设置中配置 AI 服务' })}</p>
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
                    title={t('pluginAssistant.copyMsg', { defaultValue: '复制' })}>
                    {copiedId === `user_${msg.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {renderContent(msg.content, msg.id)}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 流式响应 */}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[95%] rounded-lg px-2.5 py-1.5 text-base bg-muted/50 text-foreground">
              {streamingContent ? (
                <div className="space-y-0.5">
                  {renderContent(streamingContent, '_streaming_')}
                </div>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground text-base">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('pluginAssistant.thinking', { defaultValue: '思考中...' })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ 输入区 ═══ */}
      <div className="flex-shrink-0 border-t p-2 space-y-1.5">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={t('pluginAssistant.inputPlaceholder', { defaultValue: '输入你的问题或需求...' })}
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
        <div className="flex items-center gap-1.5">
          {/* 联网搜索 */}
          <Button variant="ghost" size="sm"
            className={`h-7 px-1.5 text-sm gap-0.5 ${enableWebSearch && providerCaps.webSearch ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
            disabled={!providerCaps.webSearch}
            onClick={() => setEnableWebSearch(v => !v)}
            title={providerCaps.webSearch ? t('pluginAssistant.webSearch', { defaultValue: '联网搜索' }) : t('pluginAssistant.webSearchUnavailable', { defaultValue: '当前模型不支持联网' })}>
            <Globe className="h-3 w-3" />
          </Button>

          {/* 深度思考 */}
          <Button variant="ghost" size="sm"
            className="h-7 px-1.5 text-sm gap-0.5 text-muted-foreground"
            disabled={!providerCaps.thinking}
            title={providerCaps.thinking ? t('pluginAssistant.deepThink', { defaultValue: '深度思考' }) : t('pluginAssistant.deepThinkUnavailable', { defaultValue: '当前模型不支持深度思考' })}>
            <Brain className="h-3 w-3" />
          </Button>

          {/* 上下文指示 */}
          <div className="flex-1 flex items-center gap-1 text-sm text-muted-foreground truncate">
            <span className="truncate max-w-[120px]">{pluginName}</span>
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
