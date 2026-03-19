/**
 * DocTypeChatMessage — 文档类型 AI 侧栏统一消息渲染组件
 *
 * 功能：
 * - 用户消息：纯文本显示
 * - AI 消息：MarkdownPreview 渲染 + think 标签解析 + 复制按钮 + 自定义操作
 * - 统一气泡样式（Design Tokens）
 */
import { memo, useState, useCallback, type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { useTranslation } from '@/i18n';
import {
  MSG_USER_CLASS, MSG_AI_CLASS, MSG_ACTION_BTN, MSG_ACTION_AREA,
  MSG_STREAMING_CURSOR,
} from './styles';

export interface DocTypeChatMsg {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

function resolveTheme(): 'light' | 'dark' {
  const t = useSettingsStore.getState().ui?.theme;
  if (t === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return t === 'dark' ? 'dark' : 'light';
}

interface DocTypeChatMessageProps {
  message: DocTypeChatMsg;
  /** 是否正在流式输出（仅最后一条 AI 消息） */
  isStreaming?: boolean;
  /** 自定义操作按钮（如"插入到正文"、"替换译文"等） */
  actions?: ReactNode;
}

export const DocTypeChatMessage = memo(function DocTypeChatMessage({
  message,
  isStreaming,
  actions,
}: DocTypeChatMessageProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = useCallback(async () => {
    const parsed = parseThinkTags(message.content);
    await navigator.clipboard.writeText(parsed.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  if (isUser) {
    return (
      <div className={MSG_USER_CLASS}>
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    );
  }

  // AI 消息
  const parsed = parseThinkTags(message.content);
  const theme = resolveTheme();

  return (
    <div className={MSG_AI_CLASS}>
      {/* 思考过程 */}
      {parsed.thinking && (
        <div className="mb-2 text-xs text-muted-foreground border-l-2 border-purple-300 dark:border-purple-600 pl-2 py-1">
          <details open={parsed.isThinking}>
            <summary className="cursor-pointer font-medium">
              {parsed.isThinking
                ? t('docTypeChat.thinking', { defaultValue: '💭 正在思考...' })
                : t('docTypeChat.thinkingDone', { defaultValue: '💭 思考过程' })}
            </summary>
            <div className="mt-1 whitespace-pre-wrap">{parsed.thinking}</div>
          </details>
        </div>
      )}

      {/* 正文内容 — Markdown 渲染 */}
      {parsed.content && (
        <div className="[&_.markdown-preview]:p-0 [&_.markdown-preview]:text-inherit">
          <MarkdownPreview
            content={parsed.content}
            theme={theme}
            className="!p-0"
            fontSize={14}
          />
        </div>
      )}

      {/* 流式光标 */}
      {isStreaming && <span className={MSG_STREAMING_CURSOR} />}

      {/* 操作区 */}
      {!isStreaming && parsed.content.length > 5 && (
        <div className={MSG_ACTION_AREA}>
          <button className={MSG_ACTION_BTN} onClick={handleCopy}>
            {copied
              ? <><Check className="h-3 w-3" />{t('common.copied', { defaultValue: '已复制' })}</>
              : <><Copy className="h-3 w-3" />{t('common.copy', { defaultValue: '复制' })}</>}
          </button>
          {actions}
        </div>
      )}
    </div>
  );
});
