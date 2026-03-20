/**
 * DiaryOnThisDay — 右栏底部"历史上的今天"面板
 *
 * 显示往年同日的日记摘要，点击跳转
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { DiaryEntry } from './types';
import { MOOD_EMOJI } from './types';

interface DiaryOnThisDayProps {
  entries: DiaryEntry[];  // 已筛选的往年同日条目
  onSelectEntry: (entryId: string) => void;
}

export default function DiaryOnThisDay({ entries, onSelectEntry }: DiaryOnThisDayProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  if (entries.length === 0) return null;

  return (
    <div className="border-t flex-shrink-0 bg-card">
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <Calendar className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-sm font-medium text-muted-foreground">
          {t('diary.onThisDay', { defaultValue: '历史上的今天' })} ({entries.length})
        </span>
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-1 max-h-[200px] overflow-auto">
          {entries.map(entry => {
            const year = entry.date.slice(0, 4);
            const excerpt = entry.content.replace(/^#+\s+/gm, '').replace(/\n/g, ' ').trim();
            const displayExcerpt = excerpt.length > 50 ? excerpt.slice(0, 50) + '...' : excerpt;

            return (
              <button
                key={entry.id}
                className="w-full text-left px-2.5 py-1.5 rounded-md border hover:bg-accent transition-colors"
                onClick={() => onSelectEntry(entry.id)}
              >
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground font-medium">{year}年</span>
                  {entry.mood && <span>{MOOD_EMOJI[entry.mood]}</span>}
                  <span className="truncate font-medium">{entry.title || entry.time}</span>
                </div>
                {displayExcerpt && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{displayExcerpt}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
