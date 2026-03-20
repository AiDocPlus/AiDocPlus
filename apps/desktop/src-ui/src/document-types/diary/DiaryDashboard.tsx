/**
 * DiaryDashboard — 日记统计仪表盘弹窗
 *
 * 90vw × 85vh Dialog：
 * - 6格总览卡片
 * - 年度热力图（纯 SVG）
 * - 心情趋势（SVG 折线）
 * - 心情分布 / 标签频率 / 最长条目 / 写作时段
 */
import { useMemo, useState } from 'react';
import { BookOpen, PenLine, Flame, Trophy, Calendar, Hash } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { DiaryDocumentContent } from './types';
import { getTotalWordCount, getTodayWordCount, calculateStreak, MOOD_EMOJI, MOOD_LABEL } from './types';
import {
  getYearlyHeatmap, getMoodTrend, getMoodDistribution,
  getTagFrequency, getWritingHourDistribution, getLongestEntries, getMonthlyStats,
} from './diaryAnalysis';

const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

interface DiaryDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diary: DiaryDocumentContent;
}

export default function DiaryDashboard({ open, onOpenChange, diary }: DiaryDashboardProps) {
  const { t } = useTranslation();
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());

  const totalWords = getTotalWordCount(diary);
  const todayWords = getTodayWordCount(diary);
  const streak = calculateStreak(diary);
  const thisMonth = diary.entries.filter(e => e.date.startsWith(new Date().toISOString().slice(0, 7))).length;

  const heatmap = useMemo(() => getYearlyHeatmap(diary, heatmapYear), [diary, heatmapYear]);
  const moodTrend = useMemo(() => getMoodTrend(diary, 30), [diary]);
  const moodDist = useMemo(() => getMoodDistribution(diary), [diary]);
  const tagFreq = useMemo(() => getTagFrequency(diary), [diary]);
  const hourDist = useMemo(() => getWritingHourDistribution(diary), [diary]);
  const longest = useMemo(() => getLongestEntries(diary, 8), [diary]);
  const monthly = useMemo(() => getMonthlyStats(diary, 12), [diary]);

  const maxHeatWords = Math.max(1, ...heatmap.map(d => d.words));
  const maxMonthEntries = Math.max(1, ...monthly.map(m => m.entries));
  const maxHour = Math.max(1, ...hourDist);
  const totalMoodCount = moodDist.reduce((s, m) => s + m.count, 0);

  const heatColor = (words: number) => {
    if (words === 0) return '#e5e7eb';
    const ratio = words / maxHeatWords;
    if (ratio < 0.25) return '#bbf7d0';
    if (ratio < 0.5) return '#86efac';
    if (ratio < 0.75) return '#4ade80';
    return '#16a34a';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[5vh] !translate-y-0 w-[90vw] h-[85vh] max-w-[1400px] max-h-[85vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('diary.dashboard', { defaultValue: '仪表盘' })}</DialogTitle>

        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <BookOpen className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{t('diary.dashboardTitle', { defaultValue: '日记统计仪表盘' })}</span>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* 6格总览 */}
          <div className="grid grid-cols-6 gap-3">
            {[
              { icon: BookOpen, label: t('diary.totalEntries', { defaultValue: '条目总数' }), value: String(diary.entries.length), color: 'text-blue-500' },
              { icon: PenLine, label: t('diary.totalWords', { defaultValue: '总字数' }), value: totalWords > 9999 ? `${(totalWords / 10000).toFixed(1)}万` : String(totalWords), color: 'text-green-500' },
              { icon: Flame, label: t('diary.currentStreak', { defaultValue: '当前连续' }), value: `${streak.current}天`, color: 'text-orange-500' },
              { icon: Trophy, label: t('diary.longestStreakLabel', { defaultValue: '最长连续' }), value: `${streak.longest}天`, color: 'text-amber-500' },
              { icon: Calendar, label: t('diary.thisMonth', { defaultValue: '本月条目' }), value: String(thisMonth), color: 'text-purple-500' },
              { icon: Hash, label: t('diary.todayWordsLabel', { defaultValue: '今日字数' }), value: `+${todayWords}`, color: 'text-emerald-500' },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="rounded-lg border bg-card p-3 text-center">
                  <Icon className={cn('h-5 w-5 mx-auto mb-1', card.color)} />
                  <div className="text-lg font-bold">{card.value}</div>
                  <div className="text-[10px] text-muted-foreground">{card.label}</div>
                </div>
              );
            })}
          </div>

          {/* 年度热力图 */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">{t('diary.yearlyHeatmap', { defaultValue: '年度写作热力图' })}</span>
              <div className="flex gap-1">
                {[heatmapYear - 1, heatmapYear, heatmapYear + 1].filter(y => y <= new Date().getFullYear()).map(y => (
                  <button key={y} className={cn('text-[10px] px-1.5 py-0.5 rounded', y === heatmapYear ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
                    onClick={() => setHeatmapYear(y)}>{y}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <svg width={53 * 14 + 30} height={7 * 14 + 20} className="block">
                {heatmap.map((day, i) => {
                  const d = new Date(day.date);
                  const weekOfYear = Math.floor(i / 7);
                  const dayOfWeek = d.getDay();
                  return (
                    <rect key={day.date} x={weekOfYear * 14 + 20} y={dayOfWeek * 14} width={11} height={11} rx={2}
                      fill={heatColor(day.words)}
                      className="transition-colors">
                      <title>{day.date}: {day.count}条, {day.words}字</title>
                    </rect>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 心情趋势（30天） */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.moodTrend', { defaultValue: '近30天心情趋势' })}</span>
              {moodTrend.length > 1 ? (
                <svg viewBox="0 0 300 80" className="w-full h-20 mt-2">
                  <polyline
                    fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"
                    points={moodTrend.map((p, i) => `${(i / (moodTrend.length - 1)) * 290 + 5},${80 - (p.score / 5) * 70}`).join(' ')}
                  />
                  {moodTrend.map((p, i) => (
                    <circle key={i} cx={(i / (moodTrend.length - 1)) * 290 + 5} cy={80 - (p.score / 5) * 70} r="3"
                      className="fill-primary">
                      <title>{p.date}: {MOOD_EMOJI[p.mood]} {MOOD_LABEL[p.mood]}</title>
                    </circle>
                  ))}
                </svg>
              ) : (
                <div className="text-xs text-muted-foreground py-4 text-center">{t('diary.notEnoughData', { defaultValue: '数据不足' })}</div>
              )}
            </div>

            {/* 心情分布 */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.moodDistribution', { defaultValue: '心情分布' })}</span>
              <div className="space-y-1 mt-2">
                {moodDist.map(m => (
                  <div key={m.mood} className="flex items-center gap-2 text-xs">
                    <span className="w-6">{MOOD_EMOJI[m.mood]}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(m.count / totalMoodCount) * 100}%` }} />
                    </div>
                    <span className="text-muted-foreground w-8 text-right">{m.count}</span>
                  </div>
                ))}
                {moodDist.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">{t('diary.notEnoughData', { defaultValue: '数据不足' })}</div>}
              </div>
            </div>

            {/* 标签频率 */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.tagFrequency', { defaultValue: '标签使用频率' })}</span>
              <div className="flex flex-wrap gap-1 mt-2">
                {tagFreq.slice(0, 20).map(tf => (
                  <span key={tf.tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted" style={{ opacity: 0.5 + (tf.count / (tagFreq[0]?.count || 1)) * 0.5 }}>
                    {tf.tag} ({tf.count})
                  </span>
                ))}
                {tagFreq.length === 0 && <span className="text-xs text-muted-foreground">{t('diary.notEnoughData', { defaultValue: '数据不足' })}</span>}
              </div>
            </div>

            {/* 写作时段 */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.writingHours', { defaultValue: '写作时段分布' })}</span>
              <div className="flex items-end gap-[2px] h-16 mt-2">
                {hourDist.map((count, h) => (
                  <div key={h} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-primary/40 rounded-t" style={{ height: `${(count / maxHour) * 100}%`, minHeight: count > 0 ? '2px' : '0' }} title={`${h}时: ${count}条`} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
                <span>0时</span><span>6时</span><span>12时</span><span>18时</span><span>24时</span>
              </div>
            </div>

            {/* 月度频率 */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.monthlyFrequency', { defaultValue: '月度写作频率' })}</span>
              <div className="flex items-end gap-1 h-16 mt-2">
                {monthly.map(m => (
                  <div key={m.month} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-blue-400/60 rounded-t" style={{ height: `${(m.entries / maxMonthEntries) * 100}%`, minHeight: m.entries > 0 ? '2px' : '0' }}
                      title={`${m.month}: ${m.entries}条, ${m.words}字`} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
                {monthly.filter((_, i) => i % 3 === 0).map(m => <span key={m.month}>{m.month.slice(5)}</span>)}
              </div>
            </div>

            {/* 最长条目排行 */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.longestEntries', { defaultValue: '最长条目排行' })}</span>
              <div className="space-y-1 mt-2">
                {longest.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-14 flex-shrink-0">{e.date.slice(5)}</span>
                    <span className="flex-1 truncate">{e.title}</span>
                    <span className="text-muted-foreground tabular-nums">{e.words}字</span>
                  </div>
                ))}
                {longest.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">{t('diary.notEnoughData', { defaultValue: '数据不足' })}</div>}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
