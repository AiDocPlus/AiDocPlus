/**
 * DiaryCalendar — 左栏月历组件
 *
 * 纯 CSS + date-fns 实现：
 * - 月份导航（上月/下月/今天）
 * - 日期格子：有条目显示圆点（按心情着色）
 * - 热力图色彩（按字数深浅）
 * - 点击选中/创建条目
 */
import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday,
  addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent, DiaryMood } from './types';
import { MOOD_EMOJI, getWordCountByDay, getMoodByDay } from './types';

interface DiaryCalendarProps {
  diary: DiaryDocumentContent;
  currentDate: Date;          // 当前查看月份的基准日期
  selectedDate: string | null; // "YYYY-MM-DD"
  onMonthChange: (date: Date) => void;
  onDateSelect: (dateStr: string) => void;
  onDateDoubleClick?: (dateStr: string) => void;
  weekStartsOn: 0 | 1;
}

const WEEKDAY_LABELS_MON = ['一', '二', '三', '四', '五', '六', '日'];
const WEEKDAY_LABELS_SUN = ['日', '一', '二', '三', '四', '五', '六'];

function getHeatColor(wordCount: number): string {
  if (wordCount === 0) return '';
  if (wordCount < 100) return 'bg-green-100 dark:bg-green-900/30';
  if (wordCount < 300) return 'bg-green-200 dark:bg-green-800/40';
  if (wordCount < 600) return 'bg-green-300 dark:bg-green-700/50';
  return 'bg-green-400 dark:bg-green-600/60';
}

function getMoodColor(mood: DiaryMood): string {
  switch (mood) {
    case 'great': return 'bg-yellow-400';
    case 'good': return 'bg-green-400';
    case 'okay': return 'bg-blue-400';
    case 'bad': return 'bg-orange-400';
    case 'terrible': return 'bg-red-400';
  }
}

export default function DiaryCalendar({
  diary, currentDate, selectedDate, onMonthChange, onDateSelect, onDateDoubleClick, weekStartsOn,
}: DiaryCalendarProps) {
  const { t } = useTranslation();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const weekLabels = weekStartsOn === 1 ? WEEKDAY_LABELS_MON : WEEKDAY_LABELS_SUN;

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate, weekStartsOn]);

  const wordCountMap = useMemo(() => getWordCountByDay(diary, year, month), [diary, year, month]);
  const moodMap = useMemo(() => getMoodByDay(diary, year, month), [diary, year, month]);

  return (
    <div className="flex flex-col px-1.5 py-1.5">
      {/* 月份导航 */}
      <div className="flex items-center justify-between px-1 pb-1.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMonthChange(subMonths(currentDate, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{year}年{month}月</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => { onMonthChange(new Date()); onDateSelect(format(new Date(), 'yyyy-MM-dd')); }}
            title={t('diary.today', { defaultValue: '今天' })}>
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMonthChange(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 text-center">
        {weekLabels.map(label => (
          <div key={label} className="text-xs text-muted-foreground py-0.5 font-medium">{label}</div>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDate === dateStr;
          const isCurrentDay = isToday(day);
          const dayNum = day.getDate();
          const wc = inMonth ? (wordCountMap.get(dayNum) || 0) : 0;
          const mood = inMonth ? moodMap.get(dayNum) : undefined;
          const heatClass = inMonth ? getHeatColor(wc) : '';

          return (
            <button
              key={dateStr}
              className={cn(
                'relative flex flex-col items-center justify-center h-8 rounded transition-colors text-sm',
                inMonth ? 'text-foreground' : 'text-muted-foreground/30',
                heatClass,
                isSelected && 'ring-1 ring-primary bg-primary/10',
                isCurrentDay && !isSelected && 'font-bold text-primary',
                inMonth && !isSelected && 'hover:bg-accent cursor-pointer',
              )}
              onClick={() => inMonth && onDateSelect(dateStr)}
              onDoubleClick={() => inMonth && onDateDoubleClick?.(dateStr)}
            >
              <span>{dayNum}</span>
              {/* 心情圆点 */}
              {mood && (
                <span className={cn('absolute bottom-0.5 w-2 h-2 rounded-full', getMoodColor(mood))}
                  title={MOOD_EMOJI[mood]} />
              )}
              {/* 无心情但有条目 */}
              {!mood && wc > 0 && (
                <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
