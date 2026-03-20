/**
 * DiaryTimelineView — 纵向时间线浏览视图
 *
 * Day One 风格：按月份分组，纵向滚动
 * 每个条目卡片显示：日期、心情、标题、摘要、字数、标签
 * 点击卡片跳转到编辑模式
 */
import { useMemo } from 'react';
import { Star, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryEntry } from './types';
import { MOOD_EMOJI, MOOD_LABEL, WEATHER_EMOJI, WEATHER_LABEL, getEntryWordCount } from './types';

interface DiaryTimelineViewProps {
  entries: DiaryEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entryId: string) => void;
}

interface MonthGroup {
  month: string; // "YYYY-MM"
  label: string; // "2025年3月"
  entries: DiaryEntry[];
  totalWords: number;
}

export default function DiaryTimelineView({
  entries, selectedEntryId, onSelectEntry,
}: DiaryTimelineViewProps) {
  const { t } = useTranslation();

  const monthGroups = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const groups: MonthGroup[] = [];
    let currentMonth = '';
    for (const entry of sorted) {
      const month = entry.date.slice(0, 7);
      if (month !== currentMonth) {
        currentMonth = month;
        const [y, m] = month.split('-').map(Number);
        groups.push({
          month,
          label: `${y}年${m}月`,
          entries: [],
          totalWords: 0,
        });
      }
      const group = groups[groups.length - 1];
      group.entries.push(entry);
      group.totalWords += getEntryWordCount(entry);
    }
    return groups;
  }, [entries]);

  const getExcerpt = (content: string, maxLen = 120): string => {
    const text = content.replace(/^#+\s+/gm, '').replace(/\n/g, ' ').trim();
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        <p>{t('diary.noEntries', { defaultValue: '暂无日记条目' })}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {monthGroups.map(group => (
        <div key={group.month} className="relative">
          {/* 月份标题 */}
          <div className="sticky top-0 z-10 px-4 py-2 bg-card/95 backdrop-blur-sm border-b flex items-center justify-between">
            <span className="text-sm font-bold">{group.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {group.entries.length}{t('diary.entryCountUnit', { defaultValue: '条' })} · {group.totalWords}{t('diary.charUnit', { defaultValue: '字' })}
            </span>
          </div>

          {/* 时间线轴 */}
          <div className="relative pl-8 pr-3 py-2">
            {/* 纵向轴线 */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

            {group.entries.map((entry) => {
              const d = new Date(entry.date + 'T00:00:00');
              const dayLabel = `${d.getDate()}日 ${weekDays[d.getDay()]}`;
              const wc = getEntryWordCount(entry);
              const isSelected = selectedEntryId === entry.id;

              return (
                <div key={entry.id} className="relative mb-3">
                  {/* 时间轴圆点 */}
                  <div className={cn(
                    'absolute left-[-22px] top-3 w-3 h-3 rounded-full border-2 z-10',
                    entry.mood
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/40 bg-card',
                    isSelected && 'ring-2 ring-primary/50 scale-125',
                  )}>
                    {entry.mood && (
                      <span className="absolute -top-0.5 -left-0.5 text-[8px]">{MOOD_EMOJI[entry.mood]}</span>
                    )}
                  </div>

                  {/* 卡片 */}
                  <button
                    className={cn(
                      'w-full text-left rounded-lg border p-3 transition-all hover:shadow-sm',
                      isSelected
                        ? 'bg-primary/5 border-primary/30 shadow-sm'
                        : 'bg-card hover:bg-accent/50',
                    )}
                    onClick={() => onSelectEntry(entry.id)}
                  >
                    {/* 头部：日期+时间+收藏 */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">{dayLabel}</span>
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />{entry.time}
                      </span>
                      {entry.weather && (
                        <span className="text-[10px] text-muted-foreground/60" title={WEATHER_LABEL[entry.weather.type]}>
                          {WEATHER_EMOJI[entry.weather.type]}
                          {entry.weather.temperature !== undefined ? ` ${entry.weather.temperature}°` : ''}
                        </span>
                      )}
                      <div className="flex-1" />
                      {entry.starred && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                      <span className="text-[10px] text-muted-foreground tabular-nums">{wc}{t('diary.charUnit', { defaultValue: '字' })}</span>
                    </div>

                    {/* 标题 */}
                    {entry.title && (
                      <div className="text-sm font-medium mb-1 flex items-center gap-1.5">
                        {entry.mood && <span className="text-sm">{MOOD_EMOJI[entry.mood]}</span>}
                        {entry.title}
                      </div>
                    )}
                    {!entry.title && entry.mood && (
                      <div className="text-sm mb-1">
                        {MOOD_EMOJI[entry.mood]} {MOOD_LABEL[entry.mood]}
                      </div>
                    )}

                    {/* 摘要 */}
                    {entry.content && (
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {getExcerpt(entry.content)}
                      </div>
                    )}

                    {/* 标签 */}
                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {entry.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
