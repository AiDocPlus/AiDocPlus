/**
 * DiaryEntryList — 左栏条目列表
 *
 * 按日期倒序显示，每条目显示：标题/摘要、心情emoji、字数
 * 接入 DiaryFilterPanel 提供的筛选结果
 * 搜索关键词高亮显示
 */
import { useMemo } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryEntry } from './types';
import { MOOD_EMOJI, formatDateDisplay } from './types';

interface DiaryEntryListProps {
  entries: DiaryEntry[];
  selectedEntryId: string | null;
  highlightKeyword?: string;
  onSelectEntry: (entryId: string) => void;
  onContextMenu?: (e: React.MouseEvent, entry: DiaryEntry) => void;
}

function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  const idx = lower.indexOf(kw);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/60 rounded-sm px-0.5">{text.slice(idx, idx + kw.length)}</mark>
      {text.slice(idx + kw.length)}
    </>
  );
}

export default function DiaryEntryList({
  entries, selectedEntryId, highlightKeyword, onSelectEntry, onContextMenu,
}: DiaryEntryListProps) {
  const { t } = useTranslation();
  const kw = highlightKeyword?.trim() || '';

  // 按日期分组
  const grouped = useMemo(() => {
    const groups: { date: string; entries: DiaryEntry[] }[] = [];
    let currentDate = '';
    for (const entry of entries) {
      if (entry.date !== currentDate) {
        currentDate = entry.date;
        groups.push({ date: currentDate, entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    }
    return groups;
  }, [entries]);

  const getExcerpt = (content: string): string => {
    const text = content.replace(/^#+\s+/gm, '').replace(/\n/g, ' ').trim();
    return text.length > 60 ? text.slice(0, 60) + '...' : text;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 条目列表 */}
      <div className="flex-1 overflow-auto">
        {grouped.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            <p>{t('diary.noEntries', { defaultValue: '暂无日记条目' })}</p>
          </div>
        )}
        {grouped.map(group => (
          <div key={group.date}>
            {/* 日期分组标题 */}
            <div className="px-2 py-1.5 text-sm text-muted-foreground font-medium sticky top-0 bg-card/95 backdrop-blur-sm border-b text-center">
              {formatDateDisplay(group.date, t)}
            </div>
            {group.entries.map(entry => (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-start gap-1.5 px-2 py-1.5 cursor-pointer transition-colors text-sm border-b border-border/30',
                    selectedEntryId === entry.id
                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-accent',
                  )}
                  onClick={() => onSelectEntry(entry.id)}
                  onContextMenu={onContextMenu ? (e) => onContextMenu(e, entry) : undefined}
                >
                  {/* 颜色标签指示条 */}
                  {entry.colorLabel && (
                    <div
                      className="w-1 h-full min-h-[2rem] rounded-full flex-shrink-0 self-stretch"
                      style={{ backgroundColor: entry.colorLabel }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                  {/* 标题行 */}
                  <div className="flex items-center gap-1.5">
                    {entry.mood && <span className="text-sm flex-shrink-0">{MOOD_EMOJI[entry.mood]}</span>}
                    <span className="truncate font-medium text-sm">
                      <HighlightText text={entry.title || entry.time || t('diary.untitled', { defaultValue: '无标题' })} keyword={kw} />
                    </span>
                    {entry.starred && <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 fill-amber-500" />}
                  </div>
                  {/* 摘要 */}
                  {entry.content && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      <HighlightText text={getExcerpt(entry.content)} keyword={kw} />
                    </div>
                  )}
                  {/* 标签 */}
                  {entry.tags.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {entry.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          <HighlightText text={tag} keyword={kw} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* 右侧字数 */}
                <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 mt-0.5">
                  {entry.wordCount > 0 ? `${entry.wordCount}${t('diary.charUnit', { defaultValue: '字' })}` : ''}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
