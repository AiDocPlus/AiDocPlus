/**
 * DiaryJournalList — 左栏日记本分组筛选组件
 *
 * 显示"全部"+ 各日记本，点击切换筛选
 */
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

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-t border-b overflow-x-auto scrollbar-hide flex-shrink-0">
      <button
        className={cn('text-sm px-2 py-1 rounded whitespace-nowrap transition-colors',
          filterJournalId === null ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onFilterChange(null)}
      >
        {t('diary.allJournals', { defaultValue: '全部' })}
      </button>
      {diary.journals.map(j => (
        <button
          key={j.id}
          className={cn('text-sm px-2 py-1 rounded whitespace-nowrap transition-colors',
            filterJournalId === j.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => onFilterChange(filterJournalId === j.id ? null : j.id)}
        >
          {j.icon} {j.name}
        </button>
      ))}
    </div>
  );
}
