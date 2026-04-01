// ── 阅读统计面板 ──

import { useMemo } from 'react';
import { useReaderStore } from '../../useReaderStore';
import { useTranslation } from '@/i18n';
import { BookOpen, Clock, TrendingUp, Calendar } from 'lucide-react';

export function ReadingStatsPanel() {
  const { t } = useTranslation();
  const readingStats = useReaderStore(s => s.readingStats);

  const totalMinutes = Math.round(readingStats.totalReadingSeconds / 60);
  const totalHours = (readingStats.totalReadingSeconds / 3600).toFixed(1);

  // 最近 7 天的阅读热力图
  const last7Days = useMemo(() => {
    const days: { date: string; minutes: number; label: string }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const seconds = readingStats.dailySeconds[dateStr] ?? 0;
      const dayKeys = ['reader.day0', 'reader.day1', 'reader.day2', 'reader.day3', 'reader.day4', 'reader.day5', 'reader.day6'];
      days.push({
        date: dateStr,
        minutes: Math.round(seconds / 60),
        label: t(dayKeys[d.getDay()], { defaultValue: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] }),
      });
    }
    return days;
  }, [readingStats.dailySeconds]);

  const maxMinutes = Math.max(...last7Days.map(d => d.minutes), 1);

  return (
    <div className="space-y-4">
      {/* 概览卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          value={totalMinutes >= 60 ? `${totalHours}h` : `${totalMinutes}m`}
          label={t('reader.totalReading', { defaultValue: '总阅读时长' })}
        />
        <StatCard
          icon={<BookOpen className="h-4 w-4 text-green-500" />}
          value={String(readingStats.totalBooksOpened)}
          label={t('reader.booksOpened', { defaultValue: '打开书籍' })}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-orange-500" />}
          value={String(readingStats.completedBooks)}
          label={t('reader.booksCompleted', { defaultValue: '已读完' })}
        />
      </div>

      {/* 最近 7 天柱状图 */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {t('reader.last7days', { defaultValue: '近 7 天阅读' })}
          </span>
        </div>
        <div className="flex items-end gap-2 h-16">
          {last7Days.map(day => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-sm bg-primary/60 transition-all"
                style={{ height: `${Math.max((day.minutes / maxMinutes) * 100, 2)}%` }}
                title={`${day.date}: ${day.minutes}m`}
              />
              <span className="text-[9px] text-muted-foreground">{day.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 bg-muted/30 rounded-lg">
      {icon}
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
