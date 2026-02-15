import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, ChevronDown, ChevronUp, FileText, BookOpen, Square, Eraser, Trash2, Copy, Check, ArrowUpToLine, MessageSquareText, PenLine, Wand2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { PromptTemplates } from '../templates/PromptTemplates';
import { invoke } from '@tauri-apps/api/core';
import { timestampToDate } from '@aidocplus/shared-types';
import type { PromptTemplate, Attachment, ChatContextMode } from '@aidocplus/shared-types';
import { useTemplatesStore } from '@/stores/useTemplatesStore';
import { useTranslation } from '@/i18n';
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

const CONTEXT_MODES: { key: ChatContextMode; label: string; icon: React.ReactNode }[] = [
  { key: 'none',      label: '随便聊聊',  icon: <MessageSquareText className="h-3.5 w-3.5" /> },
  { key: 'material',  label: '素材',      icon: <FileText className="h-3.5 w-3.5" /> },
  { key: 'prompt',    label: '提示词',    icon: <PenLine className="h-3.5 w-3.5" /> },
  { key: 'generated', label: '正文',      icon: <Wand2 className="h-3.5 w-3.5" /> },
];

const CONTEXT_MODE_LABELS: Record<string, string> = {
  material: '素材内容',
  prompt: '提示词',
  generated: '正文内容',
};

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

  const label = CONTEXT_MODE_LABELS[contextMode] || '文档内容';
  const currentTheme = resolveTheme();

  return (
    <div className="w-full rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
        <Wand2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">
          AI 回复（针对：{label}）
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
          {applied ? '已应用' : `应用到${label}`}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)} className="gap-1 ml-auto">
          <PenLine className="h-3.5 w-3.5" />
          {editing ? '预览' : '编辑'}
        </Button>
      </div>
    </div>
  );
}

interface ChatPanelProps {
  tabId?: string;
  onClose?: () => void;
  simpleMode?: boolean;
}

export function ChatPanel({ tabId, onClose, simpleMode }: ChatPanelProps) {
  const { t } = useTranslation();
  const {
    tabs,
    aiMessagesByTab,
    aiStreamingTabId,
    sendChatMessage,
    generateContent,
    generateContentStream,
    stopAiStreaming,
    setAiStreaming,
    saveDocument,
    clearAiMessages,
    createVersion,
    updateDocumentInMemory
  } = useAppStore();

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

  const [input, setInput] = useState('');
  const [showAuthorNotes, setShowAuthorNotes] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);
  const [webSearch, setWebSearch] = useState(true);
  const [authorNotesInput, setAuthorNotesInput] = useState('');
  const [contextMode, _setContextMode] = useState<ChatContextMode>('none');
  // simpleMode 时强制为 none
  const effectiveContextMode = simpleMode ? 'none' : contextMode;
  const setContextMode = (m: ChatContextMode) => { if (!simpleMode) _setContextMode(m); };
  const { getBuiltInTemplates } = useTemplatesStore();
  const authorNotesInitRef = useRef(false);

  // 提示词变化时同步到 store，使 EditorPanel 保存时能获取最新值
  // 跳过初始渲染，避免用空字符串覆盖 store 中的真实值
  useEffect(() => {
    if (!authorNotesInitRef.current) {
      authorNotesInitRef.current = true;
      return;
    }
    if (currentTab?.documentId) {
      updateDocumentInMemory(currentTab.documentId, { authorNotes: authorNotesInput });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorNotesInput]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userMsgRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

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
      // 流式更新（消息数量不变但内容变化）：滚到底部看最新内容
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [aiMessages]);

  // Initialize author notes input from current document (only on document switch)
  useEffect(() => {
    if (currentDocument) {
      setAuthorNotesInput(currentDocument.authorNotes || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab?.documentId]);

  // 将附件转换为文本，拼接到消息前面
  const buildAttachmentText = async (attachments: Attachment[]): Promise<string> => {
    if (!attachments || attachments.length === 0) return '';
    const parts: string[] = [];
    for (const att of attachments) {
      try {
        const content = await invoke<string>('import_file', { path: att.filePath });
        parts.push(`[附件: ${att.fileName}]\n${content}`);
      } catch (err) {
        parts.push(`[附件: ${att.fileName}]\n(无法读取: ${err})`);
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
      await sendChatMessage(effectiveTabId, messageContent, webSearch, ctxInfo);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errMsg = typeof error === 'string' ? error : (error instanceof Error ? error.message : JSON.stringify(error));
      useAppStore.getState().addAiMessage(effectiveTabId, {
        role: 'assistant',
        content: `发送失败：${errMsg}`,
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
      content: `✅ 已将内容应用到「${CONTEXT_MODE_LABELS[mode]}」`,
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

    // Check if API key is configured
    const aiSettings = useSettingsStore.getState().ai;
    const activeService = aiSettings.services.find(s => s.id === aiSettings.activeServiceId && s.enabled);
    if (!activeService?.apiKey) {
      const errorMessage = {
        role: 'assistant' as const,
        content: '请先配置 API Key 才能使用 AI 生成功能。\n\n请点击聊天面板下方的"设置"按钮，在设置面板的 AI 标签页中配置您的 API Key。',
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
          contentForAI = `${latestDoc.content}\n\n---\n附件参考资料：\n\n${attachmentText}`;
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
            'AI 生成内容（生成前自动保存）',
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
          content: '正在生成内容...\n\n(流式生成中，内容将逐步显示)',
          timestamp: Date.now() / 1000
        };
        useAppStore.getState().addAiMessage(effectiveTabId, assistantMessage);
        let lastUpdateTime = 0;
        let throttleTimer: ReturnType<typeof setTimeout> | null = null;

        await generateContentStream(
          notesToUse,
          contentForAI,
          (chunk) => {
            accumulatedContent += chunk;
            // 节流更新编辑器：每 300ms 最多更新一次，避免 TipTap 频繁重建文档树导致卡顿
            const now = Date.now();
            if (now - lastUpdateTime > 300) {
              lastUpdateTime = now;
              if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
              useAppStore.getState().updateDocumentInMemory(docId, { aiGeneratedContent: accumulatedContent });
            } else if (!throttleTimer) {
              throttleTimer = setTimeout(() => {
                throttleTimer = null;
                lastUpdateTime = Date.now();
                useAppStore.getState().updateDocumentInMemory(docId, { aiGeneratedContent: accumulatedContent });
              }, 300);
            }
          },
          [],  // 内容生成与聊天独立，不传聊天历史
          webSearch
        );

        // 清除可能残留的定时器，确保最终内容更新到编辑器
        if (throttleTimer) clearTimeout(throttleTimer);
        useAppStore.getState().updateDocumentInMemory(docId, { aiGeneratedContent: accumulatedContent });

        // 流式完成后保存到磁盘
        await saveDocument({ ...latestDoc, authorNotes: notesToUse, aiGeneratedContent: accumulatedContent });

        // Replace the streaming message with completion message
        const completionMessage = {
          role: 'assistant' as const,
          content: `已根据您的提示词生成内容。\n\n生成的内容已自动更新到编辑器的 AI 内容栏。`,
          timestamp: Date.now() / 1000
        };
        useAppStore.getState().addAiMessage(effectiveTabId, completionMessage);

        // Auto-create version after generation
        if (latestDoc && accumulatedContent) {
          try {
            await createVersion(
              latestDoc.projectId,
              latestDoc.id,
              latestDoc.content,
              notesToUse,
              accumulatedContent,
              'ai',
              'AI 生成内容',
              latestDoc.pluginData,
              latestDoc.enabledPlugins
            );
          } catch (versionError) {
            console.error('Failed to create version:', versionError);
          }
        }
      } else {
        // Non-streaming mode
        const generated = await generateContent(
          notesToUse,
          contentForAI
        );

        // 更新 AI 内容到 store 和磁盘
        useAppStore.getState().updateDocumentInMemory(latestDoc.id, { aiGeneratedContent: generated });
        await saveDocument({ ...latestDoc, authorNotes: notesToUse, aiGeneratedContent: generated });

        // Add confirmation message to chat
        const assistantMessage = {
          role: 'assistant' as const,
          content: `已根据您的提示词生成内容。\n\n生成的内容已自动更新到编辑器的${generated.length > 100 ? 'AI 内容栏' : 'AI 内容栏'}。`,
          timestamp: Date.now() / 1000
        };

        useAppStore.getState().addAiMessage(effectiveTabId, assistantMessage);

        // Auto-create version after generation
        if (latestDoc && generated) {
          try {
            await createVersion(
              latestDoc.projectId,
              latestDoc.id,
              latestDoc.content,
              notesToUse,
              generated,
              'ai',
              'AI 生成内容',
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
      let errorMsg = '未知错误';
      if (error instanceof Error) {
        errorMsg = error.message;
        // Check for common error patterns
        if (errorMsg.includes('connect') || errorMsg.includes('timeout')) {
          errorMsg = `网络连接失败：${errorMsg}\n\n请检查网络连接或稍后重试。`;
        } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('API key')) {
          errorMsg = `API Key 无效或未配置。\n\n请点击聊天面板下方的"设置"按钮，在设置面板的 AI 标签页中配置您的 API Key。`;
        } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          errorMsg = `API 请求频率超限，请稍后重试。`;
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
        content: `生成失败：${errorMsg}`,
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
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background flex-shrink-0">
        <h2 className="font-semibold">{simpleMode ? '随便聊聊' : 'AI 助手'}</h2>
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
              提示词
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
                placeholder="输入提示词，告诉 AI 如何扩展或改进你的内容...&#10;&#10;例如：&#10;- 请将这段散文扩展为更详细的描述&#10;- 保持原有的文学风格，增加更多细节&#10;- 重新组织段落结构，使逻辑更清晰"
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
                  title="模板管理"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-7 w-7" title="快捷模板">
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
                  title="清空提示词"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {authorNotesInput.length} 字符
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
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="web-search-mode"
                      checked={webSearch}
                      onChange={(e) => setWebSearch(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="web-search-mode" className="text-sm">
                      联网搜索
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleGenerate}
                    disabled={isCurrentTabStreaming || !authorNotesInput.trim()}
                    title="根据提示词生成内容，自动更新到 AI 内容栏"
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
                  <div className="text-xs text-amber-500 dark:text-amber-400">⚠️ 请先配置 API 服务</div>
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
                对话记录 ({aiMessages.length})
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={() => clearAiMessages(effectiveTabId)}
                disabled={isCurrentTabStreaming}
                title="清空对话"
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
              <p className="text-sm">与 AI 助手开始对话</p>
              {!settingsStore.ai.services.some(s => s.id === settingsStore.ai.activeServiceId && s.enabled && s.apiKey) && (
                <p className="text-xs mt-2 text-amber-500 dark:text-amber-400">请先在设置中配置 API 服务</p>
              )}
            </div>
          ) : (
            aiMessages.map((message, index) => {
            const turnNumber = Math.floor(index / 2) + 1;
            const isUserTurn = message.role === 'user';
            const hasContextMode = !isUserTurn && message.contextMode && message.contextMode !== 'none';

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
                {hasContextMode ? (
                  /* 上下文模式 AI 回复：可编辑文本框 */
                  <ContextReplyBox
                    content={message.content}
                    contextMode={message.contextMode!}
                    timestamp={message.timestamp}
                    onApply={(editedContent) => handleApplyToDocument(editedContent, message.contextMode!)}
                  />
                ) : (
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    isUserTurn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium opacity-70">
                          {isUserTurn ? '你' : 'AI'}
                        </span>
                        {aiMessages.length > 2 && (
                          <span className="text-xs opacity-50">
                            第 {turnNumber} 轮
                          </span>
                        )}
                      </div>
                      {isUserTurn ? (
                        <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
                      ) : (
                        <div className="text-sm [&_.markdown-preview]:p-0 [&_.markdown-preview]:text-inherit">
                          <MarkdownPreview content={message.content} theme={resolveTheme()} className="!p-0" fontSize={13} />
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
                )}
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
                    AI 正在回复...
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
              title={mode.key === 'none' ? '不附加文档内容' : `将「${CONTEXT_MODE_LABELS[mode.key]}」作为 AI 上下文`}
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
            placeholder={effectiveContextMode !== 'none' ? `针对「${CONTEXT_MODE_LABELS[effectiveContextMode]}」聊聊...` : '随便聊聊...'}
            disabled={false}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            rows={simpleMode ? 3 : 1}
            className={`flex-1 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-sm resize-none ${simpleMode ? 'min-h-[72px]' : 'min-h-0'}`}
          />
          {isCurrentTabStreaming ? (
            <Button
              onClick={stopAiStreaming}
              size="icon"
              variant="destructive"
              title="停止生成"
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
