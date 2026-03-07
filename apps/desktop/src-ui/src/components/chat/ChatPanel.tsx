import React, { useState, useRef, useEffect, memo } from 'react';
import { Send, Sparkles, X, ChevronDown, ChevronUp, FileText, BookOpen, Square, Eraser, Trash2, Copy, Check, ArrowUpToLine, MessageSquareText, PenLine, Wand2, Brain, ListChecks } from 'lucide-react';
import { Button } from '../ui/button';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { PromptTemplates } from '../templates/PromptTemplates';
import { invoke } from '@tauri-apps/api/core';
import { timestampToDate, getProviderConfig, getActiveService } from '@aidocplus/shared-types';
import type { PromptTemplate, Attachment, ChatContextMode } from '@aidocplus/shared-types';
import { useTemplatesStore } from '@/stores/useTemplatesStore';
import { useTranslation } from '@/i18n';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { MarkdownPreview } from '../editor/MarkdownPreview';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';

function resolveTheme(): 'light' | 'dark' {
  const t = useSettingsStore.getState().ui?.theme;
  if (t === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return t === 'dark' ? 'dark' : 'light';
}

const CONTEXT_MODE_ICONS: Record<ChatContextMode, React.ReactNode> = {
  none: <MessageSquareText className="h-3.5 w-3.5" />,
  material: <FileText className="h-3.5 w-3.5" />,
  prompt: <PenLine className="h-3.5 w-3.5" />,
  generated: <Wand2 className="h-3.5 w-3.5" />,
};

function getContextModes(t: (key: string, opts?: Record<string, unknown>) => string) {
  return [
    { key: 'none' as ChatContextMode,      label: t('chat.contextNone', { defaultValue: '随便聊聊' }),  icon: CONTEXT_MODE_ICONS.none },
    { key: 'material' as ChatContextMode,   label: t('chat.contextMaterial', { defaultValue: '素材' }),  icon: CONTEXT_MODE_ICONS.material },
    { key: 'prompt' as ChatContextMode,     label: t('chat.contextPrompt', { defaultValue: '提示词' }),  icon: CONTEXT_MODE_ICONS.prompt },
    { key: 'generated' as ChatContextMode,  label: t('chat.contextGenerated', { defaultValue: '正文' }),  icon: CONTEXT_MODE_ICONS.generated },
  ];
}

function getContextModeLabels(t: (key: string, opts?: Record<string, unknown>) => string): Record<string, string> {
  return {
    material: t('chat.labelMaterial', { defaultValue: '素材内容' }),
    prompt: t('chat.labelPrompt', { defaultValue: '提示词' }),
    generated: t('chat.labelGenerated', { defaultValue: '正文内容' }),
  };
}

/**
 * 上下文模式 AI 回复：可编辑文本框 + 应用/复制按钮
 */
function ContextReplyBox({
  content,
  contextMode,
  timestamp,
  onApply,
}: {
  content: string;
  contextMode: ChatContextMode;
  timestamp?: number;
  onApply: (editedContent: string) => void;
}) {
  const { t } = useTranslation();
  const [editedContent, setEditedContent] = useState(content);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const [editing, setEditing] = useState(false);

  // 流式更新时同步内容
  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    onApply(editedContent);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const CONTEXT_MODE_LABELS = getContextModeLabels(t);
  const label = CONTEXT_MODE_LABELS[contextMode] || t('chat.labelDocument', { defaultValue: '文档内容' });
  const currentTheme = resolveTheme();

  return (
    <div className="w-full rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
        <Wand2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">
          {t('chat.aiReply', { defaultValue: 'AI 回复（针对：{{label}}）', label })}
        </span>
        {timestamp && (
          <span className="text-xs text-muted-foreground/60 ml-auto">
            {timestampToDate(timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>
      {/* 预览/编辑切换 */}
      {editing ? (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full min-h-[120px] max-h-[300px] p-3 bg-background text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring border-0"
          spellCheck={false}
        />
      ) : (
        <div className="min-h-[80px] max-h-[300px] overflow-y-auto p-3 bg-background text-sm">
          <MarkdownPreview content={editedContent} theme={currentTheme} className="!p-0" fontSize={13} />
        </div>
      )}
      {/* 操作按钮 */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t bg-muted/30">
        <Button
          variant={applied ? 'default' : 'outline'}
          size="sm"
          onClick={handleApply}
          className="gap-1"
          disabled={!editedContent.trim()}
        >
          {applied ? <Check className="h-3.5 w-3.5" /> : <ArrowUpToLine className="h-3.5 w-3.5" />}
          {applied ? t('chat.applied', { defaultValue: '已应用' }) : t('chat.applyTo', { defaultValue: '应用到{{label}}', label })}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? t('chat.copied', { defaultValue: '已复制' }) : t('chat.copy', { defaultValue: '复制' })}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)} className="gap-1 ml-auto">
          <PenLine className="h-3.5 w-3.5" />
          {editing ? t('chat.previewMode', { defaultValue: '预览' }) : t('chat.editMode', { defaultValue: '编辑' })}
        </Button>
      </div>
    </div>
  );
}

/**
 * Memo 化的单条聊天消息，避免流式更新时所有历史消息重渲染
 */
interface ChatMessageProps {
  message: { role: string; content: string; timestamp?: number; contextMode?: ChatContextMode };
  turnNumber: number;
  totalMessages: number;
  enableThinking: boolean;
  onApplyToDocument?: (editedContent: string, mode: ChatContextMode) => void;
}

const ChatMessage = memo(function ChatMessage({
  message, turnNumber, totalMessages, enableThinking, onApplyToDocument,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const isUserTurn = message.role === 'user';
  const hasContextMode = !isUserTurn && message.contextMode && message.contextMode !== 'none';

  if (hasContextMode) {
    const parsed = parseThinkTags(message.content);
    return (
      <div className="w-full space-y-2">
        {parsed.thinking && (
          <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
            <div className="text-xs font-medium opacity-70 mb-1">{t('chat.ai', { defaultValue: 'AI' })}</div>
            <div className="text-sm [&_.markdown-preview]:p-0 [&_.markdown-preview]:text-inherit">
              <MarkdownPreview
                content={enableThinking
                  ? `> 💭 **思考过程：**\n>\n> ${parsed.thinking.replace(/\n/g, '\n> ')}`
                  : `<details>\n<summary>${t('chat.thinkingCollapsed', { defaultValue: '💭 查看 AI 思考过程' })}</summary>\n\n${parsed.thinking}\n\n</details>`}
                theme={resolveTheme()}
                className="!p-0"
                fontSize={13}
              />
            </div>
          </div>
        )}
        <ContextReplyBox
          content={parsed.content}
          contextMode={message.contextMode!}
          timestamp={message.timestamp}
          onApply={(editedContent) => onApplyToDocument?.(editedContent, message.contextMode!)}
        />
      </div>
    );
  }

  return (
    <div
      className={`max-w-[80%] rounded-lg px-4 py-2 ${
        isUserTurn ? 'bg-primary text-primary-foreground' : 'bg-muted'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium opacity-70">
              {isUserTurn ? t('chat.you', { defaultValue: '你' }) : t('chat.ai', { defaultValue: 'AI' })}
            </span>
            {totalMessages > 2 && (
              <span className="text-xs opacity-50">
                {t('chat.turnNumber', { defaultValue: '第 {{num}} 轮', num: turnNumber })}
              </span>
            )}
          </div>
          {isUserTurn ? (
            <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <div className="text-sm [&_.markdown-preview]:p-0 [&_.markdown-preview]:text-inherit">
              <MarkdownPreview content={(() => {
                const parsed = parseThinkTags(message.content);
                if (!parsed.thinking) return parsed.content;
                if (enableThinking) {
                  return `> 💭 **思考过程：**\n>\n> ${parsed.thinking.replace(/\n/g, '\n> ')}\n\n${parsed.content}`;
                }
                return `<details>\n<summary>${t('chat.thinkingCollapsed', { defaultValue: '💭 查看 AI 思考过程' })}</summary>\n\n${parsed.thinking}\n\n</details>\n\n${parsed.content}`;
              })()} theme={resolveTheme()} className="!p-0" fontSize={13} />
            </div>
          )}
        </div>
      </div>
      {message.timestamp && (
        <div className="text-xs opacity-70 mt-1">
          {timestampToDate(message.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
});

interface ChatPanelProps {
  tabId?: string;
  onClose?: () => void;
  simpleMode?: boolean;
}

export function ChatPanel({ tabId, onClose, simpleMode }: ChatPanelProps) {
  const { t } = useTranslation();
  const CONTEXT_MODES = getContextModes(t);
  const CONTEXT_MODE_LABELS = getContextModeLabels(t);
  const tabs = useAppStore(s => s.tabs);
  const aiMessagesByTab = useAppStore(s => s.aiMessagesByTab);
  const aiStreamingTabId = useAppStore(s => s.aiStreamingTabId);
  const sendChatMessage = useAppStore(s => s.sendChatMessage);
  const generateContent = useAppStore(s => s.generateContent);
  const generateContentStream = useAppStore(s => s.generateContentStream);
  const stopAiStreaming = useAppStore(s => s.stopAiStreaming);
  const setAiStreaming = useAppStore(s => s.setAiStreaming);
  const saveDocument = useAppStore(s => s.saveDocument);
  const clearAiMessages = useAppStore(s => s.clearAiMessages);
  const createVersion = useAppStore(s => s.createVersion);
  const updateDocumentInMemory = useAppStore(s => s.updateDocumentInMemory);

  const effectiveTabId = tabId || '';
  const aiMessages = aiMessagesByTab[effectiveTabId] || [];
  // 仅当前标签页正在流式生成时才显示生成状态
  const isCurrentTabStreaming = aiStreamingTabId === effectiveTabId;

  const settingsStore = useSettingsStore();

  // 获取当前标签对应的文档
  const currentTab = tabs.find(tab => tab.id === tabId);
  const currentDocument = currentTab
    ? useAppStore.getState().documents.find(d => d.id === currentTab.documentId)
    : null;

  // 获取当前 provider 的能力声明（优先使用文档绑定的服务）
  const enabledServices = settingsStore.ai.services.filter(s => s.enabled);
  const docBoundService = currentDocument?.aiServiceId
    ? enabledServices.find(s => s.id === currentDocument.aiServiceId)
    : null;
  const effectiveService = docBoundService || getActiveService(settingsStore.ai);
  const providerConfig = effectiveService ? getProviderConfig(effectiveService.provider) : undefined;
  const supportsWebSearch = providerConfig?.capabilities?.webSearch ?? false;
  const supportsFunctionCalling = providerConfig?.capabilities?.functionCalling ?? false;
  const supportsThinking = providerConfig?.capabilities?.thinking ?? false;

  const [input, setInput] = useState('');
  const [showAuthorNotes, setShowAuthorNotes] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);
  const [webSearch, setWebSearch] = useState(true);
  const [useTools, setUseTools] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [authorNotesInput, setAuthorNotesInput] = useState('');
  const [contextMode, _setContextMode] = useState<ChatContextMode>('none');
  // simpleMode 时强制为 none
  const effectiveContextMode = simpleMode ? 'none' : contextMode;
  const setContextMode = (m: ChatContextMode) => { if (!simpleMode) _setContextMode(m); };
  const { getBuiltInTemplates } = useTemplatesStore();
  // 标记是否已完成初始化赋值（来自 currentDocument 的 authorNotes）
  const authorNotesReadyRef = useRef(false);

  // 提示词变化时同步到 store，使 EditorPanel 保存时能获取最新值
  // 只在用户真正编辑后才同步，避免初始化赋值覆盖 store 中的真实值
  useEffect(() => {
    if (!currentTab?.documentId || !authorNotesReadyRef.current) return;
    updateDocumentInMemory(currentTab.documentId, { authorNotes: authorNotesInput });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorNotesInput]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userMsgRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const newCount = aiMessages.length;
    prevMessageCountRef.current = newCount;

    if (newCount > prevCount) {
      const lastMsg = aiMessages[newCount - 1];
      if (lastMsg?.role === 'user') {
        // 用户消息：滚到底部，看到自己的消息和 typing indicator
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        // AI 新消息：滚到用户发送的那条消息，同时看到问题和回答
        userMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (newCount === prevCount && newCount > 0) {
      // 流式更新（消息数量不变但内容变化）：节流滚动，~200ms 一次
      if (!scrollThrottleRef.current) {
        scrollThrottleRef.current = setTimeout(() => {
          scrollThrottleRef.current = null;
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 200);
      }
    }
  }, [aiMessages]);

  // 清理 scrollThrottle 定时器
  useEffect(() => {
    return () => {
      if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current);
    };
  }, []);

  // AI 生成完成后自动切换聊天上下文到「正文」模式
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (isCurrentTabStreaming) {
      wasStreamingRef.current = true;
    } else if (wasStreamingRef.current) {
      // 从 streaming → 非 streaming：生成刚完成
      wasStreamingRef.current = false;
      if (!simpleMode) {
        const doc = currentTab
          ? useAppStore.getState().documents.find(d => d.id === currentTab.documentId)
          : null;
        if (doc?.aiGeneratedContent?.trim()) {
          _setContextMode('generated');
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrentTabStreaming]);

  // Initialize author notes input from current document (only on document switch)
  useEffect(() => {
    authorNotesReadyRef.current = false;
    if (currentDocument) {
      setAuthorNotesInput(currentDocument.authorNotes || '');
    }
    // 延迟启用同步，确保初始化赋值的 effect 链完成后再允许写回 store
    const timer = setTimeout(() => { authorNotesReadyRef.current = true; }, 100);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab?.documentId]);

  // 将附件转换为文本，拼接到消息前面
  const buildAttachmentText = async (attachments: Attachment[]): Promise<string> => {
    if (!attachments || attachments.length === 0) return '';
    const parts: string[] = [];
    for (const att of attachments) {
      try {
        const content = await invoke<string>('import_file', { path: att.filePath });
        parts.push(`${t('chat.attachmentLabel', { defaultValue: '[附件: {{name}}]', name: att.fileName })}\n${content}`);
      } catch (err) {
        parts.push(t('chat.attachmentError', { defaultValue: '[附件: {{name}}]\n(无法读取: {{error}})', name: att.fileName, error: String(err) }));
      }
    }
    return parts.join('\n\n');
  };

  // 获取当前上下文模式对应的文档内容
  const getContextContent = (): string => {
    if (!currentDocument) return '';
    switch (effectiveContextMode) {
      case 'material': return currentDocument.content || '';
      case 'prompt': return currentDocument.authorNotes || '';
      case 'generated': return currentDocument.aiGeneratedContent || '';
      default: return '';
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isCurrentTabStreaming) return;
    const messageContent = input;
    setInput('');
    try {
      const ctxInfo = effectiveContextMode !== 'none'
        ? { mode: effectiveContextMode, content: getContextContent() }
        : undefined;
      await sendChatMessage(effectiveTabId, messageContent, webSearch && supportsWebSearch, ctxInfo, useTools && supportsFunctionCalling, { enableThinking: enableThinking && supportsThinking, planMode });
    } catch (error) {
      console.error('Failed to send message:', error);
      const errMsg = typeof error === 'string' ? error : (error instanceof Error ? error.message : JSON.stringify(error));
      useAppStore.getState().addAiMessage(effectiveTabId, {
        role: 'assistant',
        content: t('chat.sendFailed', { defaultValue: '发送失败：{{error}}', error: errMsg }),
        timestamp: Date.now() / 1000
      });
    }
  };

  // "应用到文档"：将 AI 回复内容写回对应的文档字段
  const handleApplyToDocument = (editedContent: string, mode: ChatContextMode) => {
    if (!currentDocument || !currentTab) return;
    const fieldMap: Record<string, string> = {
      material: 'content',
      prompt: 'authorNotes',
      generated: 'aiGeneratedContent',
    };
    const field = fieldMap[mode];
    if (!field) return;
    // 更新 store
    updateDocumentInMemory(currentTab.documentId, { [field]: editedContent });
    // 如果是提示词，同步更新本地 authorNotesInput
    if (mode === 'prompt') {
      setAuthorNotesInput(editedContent);
    }
    // 通知 EditorWorkspace 同步本地 state（避免 store→local 循环）
    window.dispatchEvent(new CustomEvent('chat-apply-to-document', {
      detail: { documentId: currentTab.documentId, field, value: editedContent },
    }));
    // 标记文档为脏（需要保存）
    useAppStore.getState().markTabAsDirty(currentTab.id);
    useAppStore.getState().addAiMessage(effectiveTabId, {
      role: 'assistant',
      content: t('chat.contentApplied', { defaultValue: '✅ 已将内容应用到「{{label}}」', label: CONTEXT_MODE_LABELS[mode] }),
      timestamp: Date.now() / 1000,
    });
  };

  const handleGenerate = async () => {
    if (!currentDocument) {
      return;
    }

    const notesToUse = authorNotesInput.trim();
    if (!notesToUse) {
      return;
    }

    // 自动收起提示词区域
    setShowAuthorNotes(false);

    // Check if API key is configured
    const aiSettings = useSettingsStore.getState().ai;
    const activeService = aiSettings.services.find(s => s.id === aiSettings.activeServiceId && s.enabled);
    if (!activeService?.apiKey) {
      const errorMessage = {
        role: 'assistant' as const,
        content: t('chat.configureApiKeyMsg', { defaultValue: '请先配置 API Key 才能使用 AI 生成功能。\n\n请点击聊天面板下方的“设置”按钮，在设置面板的 AI 标签页中配置您的 API Key。' }),
        timestamp: Date.now() / 1000
      };
      useAppStore.getState().addAiMessage(effectiveTabId, errorMessage);
      return;
    }

    // 提升到 try 外层，以便 catch 块中能保留已生成的部分内容
    let accumulatedContent = '';
    let docId = currentDocument.id;

    try {
      // 生成前先自动保存当前文档（含最新提示词），确保磁盘数据是最新的
      await saveDocument({
        ...currentDocument,
        authorNotes: notesToUse
      });

      // Get the latest document from store after saving
      const latestDoc = useAppStore.getState().documents.find(d => d.id === currentDocument.id);
      if (!latestDoc) {
        throw new Error('Document not found');
      }

      // 如果有附件，将附件内容追加到 currentContent 中供 AI 参考
      let contentForAI = latestDoc.content;
      const docAttachments = latestDoc.attachments || [];
      if (docAttachments.length > 0) {
        const attachmentText = await buildAttachmentText(docAttachments);
        if (attachmentText) {
          contentForAI = `${latestDoc.content}\n\n---\n${t('chat.attachmentRef', { defaultValue: '附件参考资料' })}：\n\n${attachmentText}`;
        }
      }

      // 生成前：如果已有 AI 内容，先保存历史版本，然后清空 AI 内容编辑器
      if (latestDoc.aiGeneratedContent && latestDoc.aiGeneratedContent.trim()) {
        try {
          await createVersion(
            latestDoc.projectId,
            latestDoc.id,
            latestDoc.content,
            latestDoc.authorNotes || '',
            latestDoc.aiGeneratedContent,
            'ai',
            t('chat.aiGenerateTitle', { defaultValue: 'AI 生成内容（生成前自动保存）' }),
            latestDoc.pluginData,
            latestDoc.enabledPlugins
          );
        } catch (versionError) {
          console.error('Failed to create pre-generation version:', versionError);
        }
      }
      // 清空 AI 内容编辑器
      useAppStore.getState().updateDocumentInMemory(latestDoc.id, { aiGeneratedContent: '' });

      docId = latestDoc.id;

      // 设置当前标签页为流式生成状态（标签页隔离）
      setAiStreaming(true, effectiveTabId);

      if (useStreaming) {
        // Streaming mode
        const assistantMessage = {
          role: 'assistant' as const,
          content: t('chat.generating', { defaultValue: '正在生成内容...\n\n(流式生成中，内容将逐步显示)' }),
          timestamp: Date.now() / 1000
        };
        useAppStore.getState().addAiMessage(effectiveTabId, assistantMessage);
        let lastUpdateTime = 0;
        let throttleTimer: ReturnType<typeof setTimeout> | null = null;

        // 统一节流刷新：thinking 状态 + 编辑器内容
        const flushGenChunk = () => {
          throttleTimer = null;
          lastUpdateTime = Date.now();
          const parsed = parseThinkTags(accumulatedContent);
          // 更新编辑器
          useAppStore.getState().updateDocumentInMemory(docId, { aiGeneratedContent: parsed.content });
          // 更新聊天区 thinking 状态
          if (parsed.thinking) {
            const thinkMsg = parsed.isThinking
              ? t('chat.aiThinking', { defaultValue: '💭 **AI 正在思考...**\n\n{{thinking}}', thinking: parsed.thinking })
              : t('chat.aiThinkingDone', { defaultValue: '💭 **AI 思考过程：**\n\n{{thinking}}', thinking: parsed.thinking });
            const messages = useAppStore.getState().getAiMessages(effectiveTabId);
            if (messages.length > 0) {
              const lastMsg = messages[messages.length - 1];
              if (lastMsg.role === 'assistant' && (lastMsg.content.includes('正在生成') || lastMsg.content.startsWith('💭') || lastMsg.content.includes('Generating'))) {
                useAppStore.getState().updateLastAiMessage(effectiveTabId, { content: thinkMsg });
              }
            }
          }
        };

        await generateContentStream(
          notesToUse,
          contentForAI,
          (chunk) => {
            accumulatedContent += chunk;
            // 节流：~300ms 批量刷新一次
            const now = Date.now();
            if (now - lastUpdateTime > 300) {
              if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
              flushGenChunk();
            } else if (!throttleTimer) {
              throttleTimer = setTimeout(flushGenChunk, 300);
            }
          },
          [],  // 内容生成与聊天独立，不传聊天历史
          webSearch
        );

        // 清除可能残留的定时器
        if (throttleTimer) clearTimeout(throttleTimer);

        // 最终解析：分离思考内容和正文
        const finalParsed = parseThinkTags(accumulatedContent);
        const finalContent = finalParsed.content;

        // 确保最终正文内容更新到编辑器
        useAppStore.getState().updateDocumentInMemory(docId, { aiGeneratedContent: finalContent });

        // 流式完成后保存到磁盘（只保存正文内容）
        await saveDocument({ ...latestDoc, authorNotes: notesToUse, aiGeneratedContent: finalContent });

        // Replace the streaming message with completion message（包含思考内容）
        let completionContent = t('chat.generationComplete', { defaultValue: '已根据您的提示词生成内容。\n\n生成的内容已自动更新到编辑器的 AI 内容栏。' });
        if (finalParsed.thinking) {
          completionContent = `${t('chat.aiThinkingDone', { defaultValue: '💭 **AI 思考过程：**\n\n{{thinking}}', thinking: finalParsed.thinking })}\n\n---\n\n${completionContent}`;
        }
        const completionMessage = {
          role: 'assistant' as const,
          content: completionContent,
          timestamp: Date.now() / 1000
        };
        useAppStore.getState().addAiMessage(effectiveTabId, completionMessage);

        // Auto-create version after generation（使用过滤后的正文内容）
        if (latestDoc && finalContent) {
          try {
            await createVersion(
              latestDoc.projectId,
              latestDoc.id,
              latestDoc.content,
              notesToUse,
              finalContent,
              'ai',
              t('chat.aiGenerateContent', { defaultValue: 'AI 生成内容' }),
              latestDoc.pluginData,
              latestDoc.enabledPlugins
            );
          } catch (versionError) {
            console.error('Failed to create version:', versionError);
          }
        }
      } else {
        // Non-streaming mode
        const rawGenerated = await generateContent(
          notesToUse,
          contentForAI
        );

        // 解析 <think> 标签：分离思考内容和正文内容
        const parsed = parseThinkTags(rawGenerated);
        const generated = parsed.content;

        // 更新 AI 内容到 store 和磁盘（只保存正文内容）
        useAppStore.getState().updateDocumentInMemory(latestDoc.id, { aiGeneratedContent: generated });
        await saveDocument({ ...latestDoc, authorNotes: notesToUse, aiGeneratedContent: generated });

        // Add confirmation message to chat（包含思考内容）
        let msgContent = t('chat.generationComplete', { defaultValue: '已根据您的提示词生成内容。\n\n生成的内容已自动更新到编辑器的 AI 内容栏。' });
        if (parsed.thinking) {
          msgContent = `${t('chat.aiThinkingDone', { defaultValue: '💭 **AI 思考过程：**\n\n{{thinking}}', thinking: parsed.thinking })}\n\n---\n\n${msgContent}`;
        }
        const assistantMessage = {
          role: 'assistant' as const,
          content: msgContent,
          timestamp: Date.now() / 1000
        };

        useAppStore.getState().addAiMessage(effectiveTabId, assistantMessage);

        // 非流式生成完成后自动切换聊天上下文到「正文」
        _setContextMode('generated');

        // Auto-create version after generation（使用过滤后的正文内容）
        if (latestDoc && generated) {
          try {
            await createVersion(
              latestDoc.projectId,
              latestDoc.id,
              latestDoc.content,
              notesToUse,
              generated,
              'ai',
              t('chat.aiGenerateContent', { defaultValue: 'AI 生成内容' }),
              latestDoc.pluginData,
              latestDoc.enabledPlugins
            );
          } catch (versionError) {
            console.error('Failed to create version:', versionError);
          }
        }
      }
    } catch (error) {
      // Enhanced error logging
      console.error('Failed to generate content. Full error:', error);
      console.error('Error type:', typeof error);
      console.error('Error keys:', error ? Object.keys(error) : 'no error object');
      console.error('Error stringified:', JSON.stringify(error, null, 2));

      // Provide helpful error message
      let errorMsg = t('chat.unknownError', { defaultValue: '未知错误' });
      if (error instanceof Error) {
        errorMsg = error.message;
        // Check for common error patterns
        if (errorMsg.includes('connect') || errorMsg.includes('timeout')) {
          errorMsg = t('chat.networkError', { defaultValue: '网络连接失败：{{error}}\n\n请检查网络连接或稍后重试。', error: errorMsg });
        } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('API key')) {
          errorMsg = t('chat.apiKeyError', { defaultValue: 'API Key 无效或未配置。\n\n请点击聊天面板下方的"设置"按钮，在设置面板的 AI 标签页中配置您的 API Key。' });
        } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          errorMsg = t('chat.rateLimitError', { defaultValue: 'API 请求频率超限，请稍后重试。' });
        }
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else if (error && typeof error === 'object') {
        // Handle Tauri error responses or other object errors
        errorMsg = (error as any).message || (error as any).error || JSON.stringify(error);
      }

      // Add error message to chat
      const errorMessage = {
        role: 'assistant' as const,
        content: t('chat.generateFailed', { defaultValue: '生成失败：{{error}}', error: errorMsg }),
        timestamp: Date.now() / 1000
      };

      useAppStore.getState().addAiMessage(effectiveTabId, errorMessage);

      // 停止生成时保留已累积的内容，不让它消失
      if (accumulatedContent) {
        useAppStore.getState().updateDocumentInMemory(docId, { aiGeneratedContent: accumulatedContent });
        try {
          const doc = useAppStore.getState().documents.find(d => d.id === docId);
          if (doc) {
            await saveDocument({ ...doc, aiGeneratedContent: accumulatedContent });
          }
        } catch (saveErr) {
          console.error('Failed to save partial content after stop:', saveErr);
        }
      }
    }
  };

  const handleSelectTemplate = (template: PromptTemplate) => {
    setAuthorNotesInput(template.content);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 border-l">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{simpleMode ? t('chat.chatTitle', { defaultValue: '随便聊聊' }) : t('chat.aiAssistant', { defaultValue: 'AI' })}</h2>
          {/* 文档级 AI 服务选择器（≥2 个已启用服务时显示） */}
          {!simpleMode && currentDocument && enabledServices.length >= 2 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 max-w-[120px]"
                  title={t('chat.switchAiService', { defaultValue: '切换 AI 服务' })}
                >
                  <span className="truncate">
                    {docBoundService ? docBoundService.name : t('chat.globalDefault', { defaultValue: '全局默认' })}
                  </span>
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                <DropdownMenuLabel className="text-xs">{t('chat.docAiService', { defaultValue: '文档 AI 服务' })}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (currentDocument) {
                      updateDocumentInMemory(currentDocument.id, { aiServiceId: undefined });
                    }
                  }}
                  className="text-xs"
                >
                  <span className="flex items-center gap-2">
                    {!currentDocument?.aiServiceId && <Check className="h-3 w-3" />}
                    {!currentDocument?.aiServiceId ? <span className="font-medium">{t('chat.useGlobalService', { defaultValue: '使用全局服务' })}</span> : <span className="ml-5">{t('chat.useGlobalService', { defaultValue: '使用全局服务' })}</span>}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {enabledServices.map(svc => {
                  const isSelected = currentDocument?.aiServiceId === svc.id;
                  return (
                    <DropdownMenuItem
                      key={svc.id}
                      onClick={() => {
                        if (currentDocument) {
                          updateDocumentInMemory(currentDocument.id, { aiServiceId: svc.id });
                        }
                      }}
                      className="text-xs"
                    >
                      <span className="flex items-center gap-2">
                        {isSelected && <Check className="h-3 w-3" />}
                        {isSelected ? <span className="font-medium">{svc.name}</span> : <span className="ml-5">{svc.name}</span>}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            title={t('common.close')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Author Notes Section - Collapsible（simpleMode 时隐藏） */}
      {!simpleMode && currentDocument && (
        <div className="border-b bg-background flex-shrink-0">
          <button
            onClick={() => setShowAuthorNotes(!showAuthorNotes)}
            className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-accent transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              {t('chat.promptLabel', { defaultValue: '提示词' })}
            </span>
            {showAuthorNotes ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showAuthorNotes && (
            <div className="px-4 pb-4 space-y-3">
              <textarea
                value={authorNotesInput}
                onChange={(e) => setAuthorNotesInput(e.target.value)}
                placeholder={t('chat.promptPlaceholder', { defaultValue: '输入提示词，告诉 AI 如何扩展或改进你的内容...\n\n例如：\n- 请将这段散文扩展为更详细的描述\n- 保持原有的文学风格，增加更多细节\n- 重新组织段落结构，使逻辑更清晰' })}
                className="w-full h-[240px] min-h-[80px] max-h-[400px] p-3 border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
              />

              {/* 模板管理 / 快捷模板 / 清空 */}
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowTemplates(true)}
                  title={t('chat.templateManage', { defaultValue: '模板管理' })}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-7 w-7" title={t('chat.quickTemplate', { defaultValue: '快捷模板' })}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-[400px] overflow-y-auto">
                    {Object.entries(useTemplatesStore.getState().getAllCategories()).map(([cat, catInfo], catIdx) => {
                      const templates = getBuiltInTemplates().filter(t => t.category === cat);
                      if (templates.length === 0) return null;
                      return (
                        <div key={cat}>
                          {catIdx > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuLabel className="text-xs">
                            {catInfo.icon} {catInfo.name}
                          </DropdownMenuLabel>
                          {templates.map(tmpl => (
                            <DropdownMenuItem
                              key={tmpl.id}
                              onClick={() => setAuthorNotesInput(tmpl.content)}
                              className="flex flex-col items-start gap-0.5"
                            >
                              <span className="text-sm">{tmpl.name}</span>
                              {tmpl.description && (
                                <span className="text-xs text-muted-foreground">{tmpl.description}</span>
                              )}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setAuthorNotesInput('')}
                  disabled={!authorNotesInput.trim()}
                  title={t('chat.clearPrompt', { defaultValue: '清空提示词' })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {t('chat.charCount', { defaultValue: '{{count}} 字符', count: authorNotesInput.length })}
                </span>
              </div>

              {/* Generate section */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="streaming-mode"
                      checked={useStreaming}
                      onChange={(e) => setUseStreaming(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="streaming-mode" className="text-sm">
                      {t('chat.streamingEnabled')}
                    </label>
                  </div>
                  <div className="flex items-center gap-2" title={supportsWebSearch ? '' : t('chat.webSearchUnsupported', { defaultValue: '当前模型不支持联网搜索' })}>
                    <input
                      type="checkbox"
                      id="web-search-mode"
                      checked={webSearch && supportsWebSearch}
                      onChange={(e) => setWebSearch(e.target.checked)}
                      disabled={!supportsWebSearch}
                      className="w-4 h-4"
                    />
                    <label htmlFor="web-search-mode" className={`text-sm ${!supportsWebSearch ? 'opacity-50' : ''}`}>
                      {t('chat.webSearch', { defaultValue: '联网搜索' })}
                    </label>
                  </div>
                  <div className="flex items-center gap-2" title={supportsFunctionCalling ? t('chat.toolsHint', { defaultValue: '启用后 AI 可调用内置工具（搜索文档等）' }) : t('chat.toolsUnsupported', { defaultValue: '当前模型不支持工具调用' })}>
                    <input
                      type="checkbox"
                      id="tools-mode"
                      checked={useTools && supportsFunctionCalling}
                      onChange={(e) => setUseTools(e.target.checked)}
                      disabled={!supportsFunctionCalling}
                      className="w-4 h-4"
                    />
                    <label htmlFor="tools-mode" className={`text-sm ${!supportsFunctionCalling ? 'opacity-50' : ''}`}>
                      {t('chat.tools', { defaultValue: '工具调用' })}
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleGenerate}
                    disabled={isCurrentTabStreaming || !authorNotesInput.trim()}
                    title={t('chat.generateHint', { defaultValue: '根据提示词生成内容，自动更新到 AI 内容栏' })}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isCurrentTabStreaming ? `${t('chat.streamingStatus')}` : t('chat.generate')}
                  </Button>
                  {isCurrentTabStreaming && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={stopAiStreaming}
                      title={t('ai.stopGeneration')}
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {!settingsStore.ai.services.some(s => s.id === settingsStore.ai.activeServiceId && s.enabled && s.apiKey) && (
                  <div className="text-xs text-amber-500 dark:text-amber-400">{t('chat.configureApiWarning', { defaultValue: '⚠️ 请先配置 API 服务' })}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Messages header - fixed at top */}
        {aiMessages.length > 0 && (
          <div className="px-4 py-1.5 border-b flex-shrink-0 bg-background">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {t('chat.chatHistory', { defaultValue: '对话记录 ({{count}})', count: aiMessages.length })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={() => clearAiMessages(effectiveTabId)}
                disabled={isCurrentTabStreaming}
                title={t('chat.clearChat', { defaultValue: '清空对话' })}
              >
                <Eraser className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        <div className="overflow-y-auto flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {aiMessages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">{t('chat.startChat', { defaultValue: '与 AI 助手开始对话' })}</p>
              {!settingsStore.ai.services.some(s => s.id === settingsStore.ai.activeServiceId && s.enabled && s.apiKey) && (
                <p className="text-xs mt-2 text-amber-500 dark:text-amber-400">{t('chat.configureApiFirst', { defaultValue: '请先在设置中配置 API 服务' })}</p>
              )}
            </div>
          ) : (
            aiMessages.map((message, index) => {
            const isUserTurn = message.role === 'user';

            return (
              <div
                key={index}
                ref={
                  (aiMessages.length >= 2
                    && aiMessages[aiMessages.length - 1]?.role === 'assistant'
                    && index === aiMessages.length - 2
                    && isUserTurn)
                    ? userMsgRef
                    : (index === aiMessages.length - 1 && isUserTurn)
                      ? userMsgRef
                      : undefined
                }
                className={`flex ${isUserTurn ? 'justify-end' : 'justify-start'}`}
              >
                <ChatMessage
                  message={message}
                  turnNumber={Math.floor(index / 2) + 1}
                  totalMessages={aiMessages.length}
                  enableThinking={settingsStore.ai.enableThinking}
                  onApplyToDocument={handleApplyToDocument}
                />
              </div>
              );
            })
          )}

          {isCurrentTabStreaming && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0.1s]" />
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('chat.aiReplying', { defaultValue: 'AI 正在回复...' })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>

      {/* 聊天输入 */}
      <div className="px-4 pt-2 pb-4 border-t flex-shrink-0 space-y-2">
        {/* 上下文模式切换（simpleMode 时隐藏） */}
        {!simpleMode && (
        <div className="flex items-center gap-1">
          {CONTEXT_MODES.map(mode => (
            <button
              key={mode.key}
              onClick={() => setContextMode(mode.key)}
              className={`
                flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border
                ${effectiveContextMode === mode.key
                  ? 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400 dark:border-red-400/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                }
              `}
              title={mode.key === 'none' ? t('chat.contextHintNone', { defaultValue: '不附加文档内容' }) : t('chat.contextHintWith', { defaultValue: '将「{{label}}」作为 AI 上下文', label: CONTEXT_MODE_LABELS[mode.key] })}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
        )}
        {/* 输入框 + 发送 */}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), isCurrentTabStreaming ? stopAiStreaming() : handleSend())}
            placeholder={effectiveContextMode !== 'none' ? t('chat.chatPlaceholderContext', { defaultValue: '针对「{{label}}」聊聊...', label: CONTEXT_MODE_LABELS[effectiveContextMode] }) : t('chat.chatPlaceholderNone', { defaultValue: '随便聊聊...' })}
            disabled={false}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            rows={3}
            className="flex-1 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-sm resize-none min-h-[60px]"
          />
          {isCurrentTabStreaming ? (
            <Button
              onClick={stopAiStreaming}
              size="icon"
              variant="destructive"
              title={t('chat.stopGeneration', { defaultValue: '停止生成' })}
              className="self-end"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              size="icon"
              title={t('common.send')}
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        {/* AI 模式切换按钮 */}
        {!simpleMode && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm"
            className={`h-7 px-2 text-xs gap-1 ${enableThinking && supportsThinking ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}
            disabled={!supportsThinking}
            onClick={() => setEnableThinking(v => !v)}
            title={supportsThinking ? (enableThinking ? t('chat.thinkingOn', { defaultValue: '深度思考：已开启' }) : t('chat.thinkingOff', { defaultValue: '深度思考：已关闭' })) : t('chat.thinkingUnsupported', { defaultValue: '当前模型不支持深度思考' })}>
            <Brain className="h-3.5 w-3.5" />
            {t('chat.thinking', { defaultValue: '深度思考' })}
          </Button>
          <Button variant="ghost" size="sm"
            className={`h-7 px-2 text-xs gap-1 ${planMode ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}
            onClick={() => setPlanMode(v => !v)}
            title={planMode ? t('chat.planModeOn', { defaultValue: '计划模式：已开启（AI 将先给出规划而非直接生成内容）' }) : t('chat.planModeOff', { defaultValue: '计划模式：已关闭' })}>
            <ListChecks className="h-3.5 w-3.5" />
            {t('chat.planMode', { defaultValue: '计划模式' })}
          </Button>
        </div>
        )}
      </div>

      {/* Prompt Templates Panel（simpleMode 时隐藏） */}
      {!simpleMode && (
      <PromptTemplates
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={handleSelectTemplate}
      />
      )}
    </div>
  );
}
