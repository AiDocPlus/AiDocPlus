/**
 * AI 思考内容统一折叠块：默认收起，点击摘要展开查看（各文档类型 / 聊天共用）
 *
 * 思考正文使用纯文本渲染（whitespace-pre-wrap），避免 MarkdownPreview + rehypeRaw
 * 将片段中的 <...> 当 HTML 吞掉导致「思考内容消失」（股票长回复、工具输出中尤甚）。
 */
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

export interface CollapsibleThinkingBlockProps {
  thinking: string;
  /** 流式未闭合 think 时可标为 true，摘要显示「正在思考」 */
  isThinking?: boolean;
  /** 保留供调用方 API 兼容，不参与渲染 */
  theme?: 'light' | 'dark';
  className?: string;
}

export function CollapsibleThinkingBlock({
  thinking,
  isThinking = false,
  className,
}: CollapsibleThinkingBlockProps) {
  const { t } = useTranslation();
  if (!thinking?.trim()) return null;

  return (
    <div
      className={cn(
        'mb-2 text-xs text-muted-foreground border-l-2 border-purple-300 dark:border-purple-600 pl-2 py-1',
        className,
      )}
    >
      <details className="group/think">
        <summary
          className={cn(
            'cursor-pointer font-medium list-none flex items-center gap-1 select-none',
            '[&::-webkit-details-marker]:hidden',
          )}
        >
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70 transition-transform group-open/think:rotate-180" />
          <span>
            {isThinking
              ? t('docTypeChat.thinking', { defaultValue: '💭 正在思考...' })
              : t('docTypeChat.thinkingDone', { defaultValue: '💭 思考过程' })}
          </span>
        </summary>
        <div className="mt-1 max-h-[min(40vh,320px)] overflow-y-auto border-l border-purple-200/60 dark:border-purple-800/50 ml-0.5 pl-2">
          <div className="whitespace-pre-wrap break-words text-[12px] leading-relaxed opacity-90">
            {thinking}
          </div>
        </div>
      </details>
    </div>
  );
}
