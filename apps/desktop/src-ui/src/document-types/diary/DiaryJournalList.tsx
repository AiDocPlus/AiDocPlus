/**
 * DiaryJournalList — 左栏日记本分组筛选组件
 *
 * 显示"全部"+ 各日记本，点击切换筛选
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent } from './types';

interface DiaryJournalListProps {
  diary: DiaryDocumentContent;
  filterJournalId: string | null;
  onFilterChange: (journalId: string | null) => void;
}

export default function DiaryJournalList({
  diary, filterJournalId, onFilterChange,
}: DiaryJournalListProps) {
  const { t } = useTranslation();

  const journalEntryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of diary.entries) {
      counts[e.journalId] = (counts[e.journalId] || 0) + 1;
    }
    return counts;
  }, [diary.entries]);

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-t border-b overflow-x-auto flex-shrink-0">
      <button
        className={cn('text-sm px-2 py-1 rounded whitespace-nowrap transition-colors',
          filterJournalId === null ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onFilterChange(null)}
      >
        {t('diary.allJournals', { defaultValue: '全部' })} ({diary.entries.length})
      </button>
      {diary.journals.map(j => (
        <button
          key={j.id}
          className={cn('text-sm px-2 py-1 rounded whitespace-nowrap transition-colors',
            filterJournalId === j.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => onFilterChange(filterJournalId === j.id ? null : j.id)}
        >
          {j.icon} {j.name} ({journalEntryCounts[j.id] || 0})
        </button>
      ))}
    </div>
  );
}
