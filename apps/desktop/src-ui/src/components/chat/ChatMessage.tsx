import React, { useState, useEffect, memo } from 'react';
import { Wand2, Copy, Check, ArrowUpToLine, PenLine, FileText, MessageSquareText } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { timestampToDate } from '@aidocplus/shared-types';
import type { ChatContextMode } from '@aidocplus/shared-types';
import { useTranslation } from '@/i18n';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { MarkdownPreview } from '../editor/MarkdownPreview';

export function resolveTheme(): 'light' | 'dark' {
  const t = useSettingsStore.getState().ui?.theme;
  if (t === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return t === 'dark' ? 'dark' : 'light';
}

export const CONTEXT_MODE_ICONS: Record<ChatContextMode, React.ReactNode> = {
  none: <MessageSquareText className="h-3.5 w-3.5" />,
  material: <FileText className="h-3.5 w-3.5" />,
  prompt: <PenLine className="h-3.5 w-3.5" />,
  generated: <Wand2 className="h-3.5 w-3.5" />,
};

export function getContextModes(t: (key: string, opts?: Record<string, unknown>) => string) {
  return [
    { key: 'none' as ChatContextMode,      label: t('chat.contextNone', { defaultValue: '聊聊' }),  icon: CONTEXT_MODE_ICONS.none },
    { key: 'material' as ChatContextMode,   label: t('chat.contextMaterial', { defaultValue: '素材' }),  icon: CONTEXT_MODE_ICONS.material },
    { key: 'prompt' as ChatContextMode,     label: t('chat.contextPrompt', { defaultValue: '提示词' }),  icon: CONTEXT_MODE_ICONS.prompt },
    { key: 'generated' as ChatContextMode,  label: t('chat.contextGenerated', { defaultValue: '正文' }),  icon: CONTEXT_MODE_ICONS.generated },
  ];
}

export function getContextModeLabels(t: (key: string, opts?: Record<string, unknown>) => string): Record<string, string> {
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
export interface ChatMessageProps {
  message: { role: string; content: string; timestamp?: number; contextMode?: ChatContextMode; images?: { data: string; mimeType: string }[] };
  turnNumber: number;
  totalMessages: number;
  enableThinking: boolean;
  onApplyToDocument?: (editedContent: string, mode: ChatContextMode) => void;
}

export const ChatMessage = memo(function ChatMessage({
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
            <div>
              {message.content && <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>}
              {message.images && message.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {message.images.map((img, i) => (
                    <img
                      key={i}
                      src={`data:${img.mimeType};base64,${img.data}`}
                      alt={`${t('chat.imageAttachment', { defaultValue: '图片附件' })} ${i + 1}`}
                      className="h-16 w-16 object-cover rounded border border-primary-foreground/20 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(`data:${img.mimeType};base64,${img.data}`, '_blank')}
                    />
                  ))}
                </div>
              )}
            </div>
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
