/**
 * 帮助中心 - AI 智能问答面板
 *
 * 基于当前浏览的帮助文档作为上下文，让 AI 回答用户问题。
 * 复用主程序的 chat_stream Tauri 命令。
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Send, Square, Trash2, Loader2, Bot, Sparkles, AlertCircle } from 'lucide-react';
import type { HelpDoc } from './helpDocs';
import { generateDocIndex } from './helpDocs';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { markdownToHtml } from './HelpContent';
import { CollapsibleThinkingBlock } from '@/document-types/_shared/CollapsibleThinkingBlock';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface HelpAIChatProps {
  currentDoc: HelpDoc | null;
}

/** 渲染 AI 消息内容：解析 think 标签默认折叠 + Markdown 渲染 */
function AIMessageContent({ content }: { content: string }) {
  const parsed = parseThinkTags(content);
  const mainContent = parsed.content;
  const thinking = parsed.thinking;

  return (
    <>
      {thinking && (
        <CollapsibleThinkingBlock
          thinking={thinking}
          isThinking={parsed.isThinking}
          theme="light"
          className="mb-2"
        />
      )}
      {mainContent && (
        <div
          className="help-markdown text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(mainContent) }}
        />
      )}
    </>
  );
}

/** 帮助助手系统提示词 */
function buildSystemPrompt(currentDoc: HelpDoc | null): string {
  const docIndex = generateDocIndex();
  const currentDocContent = currentDoc
    ? `\n\n--- 用户当前正在浏览的文档 ---\n\n${currentDoc.content}`
    : '';

  return `你是 AiDocPlus 的帮助助手，负责回答用户关于 AiDocPlus 软件使用方面的问题。

请根据以下帮助文档内容来回答用户的问题。回答要准确、简洁、友好。
如果问题超出了文档范围，请如实告知用户你不确定，并建议他们查阅官网或联系支持。

回答中可以引用具体的操作步骤和快捷键。
回答语言：中文。

--- 帮助文档目录 ---

${docIndex}${currentDocContent}`;
}

let _msgIdCounter = 0;
function genId(): string {
  return `help_msg_${Date.now()}_${++_msgIdCounter}`;
}

export function HelpAIChat({ currentDoc }: HelpAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setError(null);
    abortRef.current = false;

    const userMsg: ChatMessage = { id: genId(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);
    setStreamingContent('');

    try {
      // 构建消息列表
      const systemPrompt = buildSystemPrompt(currentDoc);
      const chatMessages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      // 加入最近的对话历史（最多 10 条）
      const recentMsgs = [...messages, userMsg].slice(-10);
      for (const msg of recentMsgs) {
        chatMessages.push({ role: msg.role, content: msg.content });
      }

      // 通过 Tauri 后端读取 AI 配置（帮助窗口的 localStorage 与主窗口隔离）
      const settingsRaw = await invoke<string | Record<string, unknown> | null>('load_settings');
      if (!settingsRaw) {
        throw new Error('未配置 AI 服务。请在主程序中配置 AI 服务后再使用帮助 AI 助手。');
      }
      // 兼容字符串和对象两种返回形式
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settings: any = typeof settingsRaw === 'string' ? JSON.parse(settingsRaw) : settingsRaw;
      const aiConfig = settings?.state?.ai;
      if (!aiConfig?.services?.length) {
        throw new Error('未配置 AI 服务。请在主程序中配置 AI 服务后再使用帮助 AI 助手。');
      }

      // 找到激活的服务：优先 activeServiceId，否则第一个启用的
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let activeService = aiConfig.activeServiceId
        ? aiConfig.services.find((s: any) => s.id === aiConfig.activeServiceId && s.enabled)
        : null;
      if (!activeService) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeService = aiConfig.services.find((s: any) => s.enabled);
      }
      if (!activeService) {
        throw new Error('没有启用的 AI 服务。请在主程序设置中启用至少一个 AI 服务。');
      }

      const requestId = `help_${Date.now()}`;
      let accumulated = '';

      // 监听流式 chunk
      const unlisten = await listen<{ request_id: string; content: string }>('ai:stream:chunk', (event) => {
        if (abortRef.current) return;
        if (event.payload.request_id !== requestId) return;
        accumulated += event.payload.content;
        setStreamingContent(accumulated);
      });

      try {
        if (abortRef.current) throw new Error('已取消');

        // 参数名必须与主程序 getAIInvokeParamsForService 一致（camelCase → Tauri 自动转 snake_case）
        await invoke('chat_stream', {
          messages: chatMessages,
          provider: activeService.provider || undefined,
          apiKey: activeService.apiKey || undefined,
          model: activeService.model || undefined,
          baseUrl: activeService.baseUrl || undefined,
          serviceId: activeService.id || undefined,
          requestId,
          proxyUrl: aiConfig.proxyUrl || undefined,
          connectTimeoutSecs: aiConfig.connectTimeoutSecs || undefined,
          requestTimeoutSecs: aiConfig.requestTimeoutSecs || undefined,
          maxTokens: typeof aiConfig.maxTokens === 'number' ? aiConfig.maxTokens : 4096,
        });

        // 流式完成
        const assistantMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: accumulated || '（无响应内容）',
        };
        setMessages(prev => [...prev, assistantMsg]);
      } finally {
        unlisten();
      }
    } catch (err: unknown) {
      // Tauri 命令错误为 { code, message } 对象；JS Error 有 .message；其他用 String()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errObj = err as any;
      const errMsg = errObj?.message ?? (err instanceof Error ? err.message : String(err));
      if (!abortRef.current) {
        setError(errMsg);
        // 添加错误消息
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'assistant',
          content: `⚠️ ${errMsg}`,
        }]);
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
    }
  }, [input, streaming, currentDoc, messages]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    setStreaming(false);
    if (streamingContent) {
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'assistant',
        content: streamingContent + '\n\n（已中断）',
      }]);
      setStreamingContent('');
    }
  }, [streamingContent]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 快捷问题
  const quickQuestions = [
    { label: '如何配置 AI？', prompt: '如何在 AiDocPlus 中配置 AI 服务？请详细说明步骤。' },
    { label: '快捷键大全', prompt: '请列出 AiDocPlus 的所有快捷键。' },
    { label: '这个功能怎么用？', prompt: currentDoc ? `请详细解释「${currentDoc.title}」的使用方法和注意事项。` : '请介绍 AiDocPlus 的主要功能。' },
  ];

  return (
    <div className="flex flex-col h-full w-[360px] shrink-0 border-l bg-card">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-4 h-10 border-b shrink-0">
        <div className="flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">AI 帮助助手</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="清除对话"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto help-scroll p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium mb-1">AI 帮助助手</p>
            <p className="text-xs text-muted-foreground mb-5">
              有任何关于 AiDocPlus 的问题，都可以问我！
            </p>
            {/* 快捷问题按钮 */}
            <div className="space-y-2 w-full">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(q.prompt);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm rounded-lg border hover:bg-accent hover:border-accent-foreground/20 transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={msg.role === 'user' ? 'help-ai-msg-user' : 'help-ai-msg-assistant'}>
              {msg.role === 'assistant' ? (
                <AIMessageContent content={msg.content} />
              ) : (
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {msg.content}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 流式输出中 */}
        {streaming && streamingContent && (
          <div className="flex justify-start">
            <div className="help-ai-msg-assistant">
              <AIMessageContent content={streamingContent} />
            </div>
          </div>
        )}

        {/* 加载指示器 */}
        {streaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="help-ai-msg-assistant flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm">思考中...</span>
            </div>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && !streaming && (
        <div className="mx-3 mb-1 px-3 py-2 bg-destructive/10 text-destructive text-xs flex items-center gap-1.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="line-clamp-2">{error}</span>
        </div>
      )}

      {/* 输入区域 */}
      <div className="p-4 border-t">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            rows={2}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
            disabled={streaming}
          />
          {streaming ? (
            <button
              onClick={handleStop}
              className="shrink-0 p-2.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              title="停止生成"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              title="发送"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          基于帮助文档回答 · Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}
