import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { EditorView } from '@codemirror/view';

interface HeadingItem {
  level: number;
  text: string;
  from: number;
  endPos: number;    // 本节结束位置（下一个同级/更高级标题或文末）
  wordCount: number; // 本节字数（不含子章节）
}

interface DocumentOutlineProps {
  cmViewRef: React.RefObject<EditorView | null>;
  content: string;
  cursorPos?: number; // 当前光标位置，用于高亮当前标题
  className?: string;
}

export function parseHeadings(content: string): HeadingItem[] {
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
          endPos: 0,
          wordCount: 0,
        });
      }
    }
    pos += line.length + 1; // +1 for \n
  }

  // 计算每节的 endPos 和 wordCount
  const totalLen = content.length;
  for (let i = 0; i < headings.length; i++) {
    // endPos: 下一个同级或更高级标题的起始位置，或文末
    let end = totalLen;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= headings[i].level) {
        end = headings[j].from;
        break;
      }
    }
    headings[i].endPos = end;
    // wordCount: 本节内容字数（标题行之后到 endPos）
    const sectionContent = content.slice(headings[i].from, end);
    headings[i].wordCount = (sectionContent.match(/\S+/g) || []).length;
  }

  return headings;
}

// 根据光标位置找到当前所在的标题索引
function findActiveHeadingIndex(headings: HeadingItem[], cursorPos: number): number {
  let active = -1;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].from <= cursorPos) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}

// 根据光标位置获取面包屑路径（各级祖先标题）
export function getBreadcrumb(headings: HeadingItem[], cursorPos: number): HeadingItem[] {
  const activeIdx = findActiveHeadingIndex(headings, cursorPos);
  if (activeIdx < 0) return [];
  const breadcrumb: HeadingItem[] = [];
  let currentLevel = Infinity;
  // 从当前标题往前回溯，收集各级祖先
  for (let i = activeIdx; i >= 0; i--) {
    if (headings[i].level < currentLevel) {
      breadcrumb.unshift(headings[i]);
      currentLevel = headings[i].level;
      if (currentLevel === 1) break;
    }
  }
  return breadcrumb;
}

export function DocumentOutline({ cmViewRef, content, cursorPos, className }: DocumentOutlineProps) {
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
        effects: EditorView.scrollIntoView(pos, { y: 'start' }),
      });
      view.focus();
    } catch { /* view may be destroyed */ }
  }, [cmViewRef]);

  const minLevel = headings.length > 0 ? Math.min(...headings.map(h => h.level)) : 1;
  const activeIdx = useMemo(() => {
    if (cursorPos === undefined) return -1;
    return findActiveHeadingIndex(headings, cursorPos);
  }, [headings, cursorPos]);

  // 格式化字数显示
  const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className={cn('flex flex-col h-full w-52', className)}>
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
                'w-full text-left text-xs py-0.5 px-1 rounded hover:bg-accent truncate transition-colors flex items-center gap-1',
                i === activeIdx
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={{ paddingLeft: `${(h.level - minLevel) * 12 + 4}px` }}
              title={h.text}
            >
              <span className="text-muted-foreground/60 mr-0.5 shrink-0">{'#'.repeat(h.level)}</span>
              <span className="truncate">{h.text}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/50 shrink-0">{formatCount(h.wordCount)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
