import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { EditorView } from '@codemirror/view';

interface HeadingItem {
  level: number;
  text: string;
  from: number;
}

interface DocumentOutlineProps {
  cmViewRef: React.RefObject<EditorView | null>;
  content: string;
  className?: string;
}

function parseHeadings(content: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const lines = content.split('\n');
  let pos = 0;
  let inCodeBlock = false;

  for (const line of lines) {
    // 跟踪代码块状态
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    if (!inCodeBlock) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].replace(/\s*#+\s*$/, ''), // 去掉尾部的 # 标记
          from: pos,
        });
      }
    }
    pos += line.length + 1; // +1 for \n
  }
  return headings;
}

export function DocumentOutline({ cmViewRef, content, className }: DocumentOutlineProps) {
  const { t } = useTranslation();
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  useEffect(() => {
    setHeadings(parseHeadings(content));
  }, [content]);

  const handleClick = useCallback((heading: HeadingItem) => {
    const view = cmViewRef.current;
    if (!view) return;
    try {
      const pos = Math.min(heading.from, view.state.doc.length);
      view.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      });
      view.focus();
    } catch { /* view may be destroyed */ }
  }, [cmViewRef]);

  const minLevel = headings.length > 0 ? Math.min(...headings.map(h => h.level)) : 1;

  return (
    <div className={cn('flex flex-col h-full w-48', className)}>
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground shrink-0 border-b">
        {t('editor.outline.titleCount', { defaultValue: '大纲 ({{count}})', count: headings.length })}
      </div>
      <div className="overflow-y-auto flex-1 space-y-0.5 px-1 py-1">
        {headings.length === 0 ? (
          <div className="text-xs text-muted-foreground p-2 text-center">{t('editor.outline.noHeadings', { defaultValue: '暂无标题' })}</div>
        ) : (
          headings.map((h, i) => (
            <button
              key={`${h.from}-${i}`}
              type="button"
              onClick={() => handleClick(h)}
              className={cn(
                'w-full text-left text-xs py-0.5 px-1 rounded hover:bg-accent truncate transition-colors',
                'text-muted-foreground hover:text-foreground'
              )}
              style={{ paddingLeft: `${(h.level - minLevel) * 12 + 4}px` }}
              title={h.text}
            >
              <span className="text-muted-foreground/60 mr-1">{'#'.repeat(h.level)}</span>
              {h.text}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
