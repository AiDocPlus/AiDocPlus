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
import { getTotalWordCount, getTodayWordCount, calculateStreak, MOOD_EMOJI, MOOD_LABEL, getTodayDateStr, WEATHER_EMOJI, WEATHER_LABEL } from './types';
import { DIALOG_STYLE } from '../_shared/styles';
import {
  getYearlyHeatmap, getMoodTrend, getMoodDistribution,
  getTagFrequency, getWritingHourDistribution, getLongestEntries, getMonthlyStats,
  getMoodWeatherCorrelation, getMoodWeekdayCorrelation, getMoodTagCorrelation,
  getMoodHeatmap, detectPeriodicPatterns,
  WEEKDAY_KEYS, WEEKDAY_DEFAULTS, PERIOD_KEYS, PERIOD_DEFAULTS,
} from './diaryAnalysis';

interface DiaryDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diary: DiaryDocumentContent;
}

export default function DiaryDashboard({ open, onOpenChange, diary }: DiaryDashboardProps) {
  const { t } = useTranslation();
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());

  const totalWords = useMemo(() => getTotalWordCount(diary), [diary]);
  const todayWords = useMemo(() => getTodayWordCount(diary), [diary]);
  const streak = useMemo(() => calculateStreak(diary), [diary]);
  const thisMonth = useMemo(
    () => diary.entries.filter(e => !e.deletedAt && e.date.startsWith(getTodayDateStr().slice(0, 7))).length,
    [diary.entries],
  );

  const heatmap = useMemo(() => getYearlyHeatmap(diary, heatmapYear), [diary, heatmapYear]);
  const moodTrend = useMemo(() => getMoodTrend(diary, 30), [diary]);
  const moodDist = useMemo(() => getMoodDistribution(diary), [diary]);
  const tagFreq = useMemo(() => getTagFrequency(diary), [diary]);
  const hourDist = useMemo(() => getWritingHourDistribution(diary), [diary]);
  const longest = useMemo(() => getLongestEntries(diary, 8), [diary]);
  const monthly = useMemo(() => getMonthlyStats(diary, 12), [diary]);

  // 关联分析
  const moodWeatherCorr = useMemo(() => getMoodWeatherCorrelation(diary), [diary]);
  const moodWeekdayCorr = useMemo(() => getMoodWeekdayCorrelation(diary), [diary]);
  const moodTagCorr = useMemo(() => getMoodTagCorrelation(diary), [diary]);
  const moodHeatmap = useMemo(() => getMoodHeatmap(diary), [diary]);
  const patterns = useMemo(() => detectPeriodicPatterns(diary), [diary]);

  const maxHeatWords = Math.max(1, heatmap.reduce((m, d) => Math.max(m, d.words), 0));
  const maxMonthEntries = Math.max(1, monthly.reduce((m, d) => Math.max(m, d.entries), 0));
  const maxHour = Math.max(1, hourDist.reduce((m, v) => Math.max(m, v), 0));
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
              { icon: BookOpen, label: t('diary.totalEntries', { defaultValue: '条目总数' }), value: String(diary.entries.filter(e => !e.deletedAt).length), color: 'text-blue-500' },
              { icon: PenLine, label: t('diary.totalWords', { defaultValue: '总字数' }), value: totalWords > 9999 ? `${(totalWords / 10000).toFixed(1)}${t('diary.tenThousandUnit', { defaultValue: '万' })}` : String(totalWords), color: 'text-green-500' },
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
                  const rawDow = d.getDay(); // 0=Sun
                  const weekStartsOn = diary.settings.weekStartsOn ?? 0;
                  const adjustedDow = (rawDow - weekStartsOn + 7) % 7;
                  // 第一个日期之前的偏移天数
                  const firstDate = new Date(heatmap[0]?.date || `${heatmapYear}-01-01`);
                  const firstDayOfWeek = (firstDate.getDay() - weekStartsOn + 7) % 7;
                  const daysDiff = Math.round((d.getTime() - firstDate.getTime()) / 86400000);
                  const weekIdx = Math.floor((daysDiff + firstDayOfWeek) / 7);
                  return (
                    <rect key={day.date} x={weekIdx * 14 + 20} y={adjustedDow * 14} width={11} height={11} rx={2}
                      fill={heatColor(day.words)}
                      className="transition-colors">
                      <title>{day.date}: {day.count}{t('diary.entryCountUnit', { defaultValue: '条' })}, {day.words}{t('diary.charUnit', { defaultValue: '字' })}</title>
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
                <span>{t('diary.hour0', { defaultValue: '0时' })}</span><span>{t('diary.hour6', { defaultValue: '6时' })}</span><span>{t('diary.hour12', { defaultValue: '12时' })}</span><span>{t('diary.hour18', { defaultValue: '18时' })}</span><span>{t('diary.hour24', { defaultValue: '24时' })}</span>
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
                    <span className="text-muted-foreground tabular-nums">{e.words}{t('diary.charUnit', { defaultValue: '字' })}</span>
                  </div>
                ))}
                {longest.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">{t('diary.notEnoughData', { defaultValue: '数据不足' })}</div>}
              </div>
            </div>
          </div>

          {/* 心情深度分析 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 心情×天气关联 */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.moodWeatherCorr', { defaultValue: '心情与天气关联' })}</span>
              <div className="space-y-1.5 mt-2">
                {moodWeatherCorr.length > 0 ? moodWeatherCorr.map(w => (
                  <div key={w.weather} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-center">{WEATHER_EMOJI[w.weather as keyof typeof WEATHER_EMOJI] || ''}</span>
                    <span className="w-12">{WEATHER_LABEL[w.weather as keyof typeof WEATHER_LABEL] || w.weather}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', w.avgScore >= 3.5 ? 'bg-green-400' : w.avgScore >= 2.5 ? 'bg-yellow-400' : 'bg-red-400')}
                        style={{ width: `${(w.avgScore / 5) * 100}%` }} />
                    </div>
                    <span className="text-muted-foreground w-10 text-right tabular-nums">{w.avgScore}/5</span>
                    <span className="text-muted-foreground/60 w-8 text-right tabular-nums">({w.count})</span>
                  </div>
                )) : <div className="text-xs text-muted-foreground text-center py-2">{t('diary.notEnoughData', { defaultValue: '数据不足' })}</div>}
              </div>
            </div>

            {/* 心情×星期关联 */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.moodWeekdayCorr', { defaultValue: '心情与星期关联' })}</span>
              <div className="flex items-end gap-1 h-20 mt-2">
                {moodWeekdayCorr.filter(w => w.count > 0).map(w => (
                  <div key={w.weekday} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[8px] tabular-nums">{w.avgScore > 0 ? w.avgScore : ''}</span>
                    <div className="w-full rounded-t" style={{
                      height: w.avgScore > 0 ? `${(w.avgScore / 5) * 100}%` : '0',
                      minHeight: w.count > 0 ? '2px' : '0',
                      backgroundColor: w.avgScore >= 3.5 ? '#86efac' : w.avgScore >= 2.5 ? '#fbbf24' : '#f87171',
                    }} title={`${t(WEEKDAY_KEYS[w.weekday], { defaultValue: WEEKDAY_DEFAULTS[w.weekday] })}: ${w.avgScore}/5 (${w.count}次)`} />
                    <span className="text-[8px] text-muted-foreground">{t(WEEKDAY_KEYS[w.weekday], { defaultValue: WEEKDAY_DEFAULTS[w.weekday] })}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 心情×标签关联 */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.moodTagCorr', { defaultValue: '心情与标签关联' })}</span>
              <div className="space-y-1.5 mt-2">
                {moodTagCorr.length > 0 ? moodTagCorr.slice(0, 10).map(tc => (
                  <div key={tc.tag} className="flex items-center gap-2 text-xs">
                    <span className="w-16 truncate text-muted-foreground">#{tc.tag}</span>
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground/50 w-4">-1</span>
                      <div className="flex-1 relative h-3 bg-muted rounded-full overflow-hidden">
                        <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/20" />
                        <div className={cn('absolute top-0 bottom-0 rounded-full', tc.deviation > 0 ? 'bg-green-400' : 'bg-red-400')}
                          style={{
                            left: tc.deviation > 0 ? '50%' : `${50 + (tc.deviation / 2) * 50}%`,
                            right: tc.deviation < 0 ? '50%' : `${50 - (tc.deviation / 2) * 50}%`,
                          }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground/50 w-4">+1</span>
                    </div>
                    <span className={cn('w-8 text-right tabular-nums', tc.deviation > 0 ? 'text-green-600' : 'text-red-600')}>
                      {tc.deviation > 0 ? '+' : ''}{tc.deviation}
                    </span>
                  </div>
                )) : <div className="text-xs text-muted-foreground text-center py-2">{t('diary.notEnoughData', { defaultValue: '数据不足' })}</div>}
              </div>
            </div>

            {/* 心情热力图（星期×时段） */}
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.moodHeatmap', { defaultValue: '心情热力图（星期×时段）' })}</span>
              <div className="mt-2">
                <div className="grid gap-px" style={{ gridTemplateColumns: '32px repeat(4, 1fr)' }}>
                  <div /> {/* 空角 */}
                  {moodHeatmap.periodKeys.map((pk, i) => (
                    <div key={pk} className="text-[8px] text-muted-foreground text-center">{t(pk, { defaultValue: PERIOD_DEFAULTS[i] })}</div>
                  ))}
                  {Array.from({ length: 7 }).map((_, w) => (
                    <div key={w} className="contents">
                      <div className="text-[8px] text-muted-foreground flex items-center">{t(WEEKDAY_KEYS[w], { defaultValue: WEEKDAY_DEFAULTS[w] })}</div>
                      {moodHeatmap.cells.filter(c => c.weekday === w).map(cell => (
                        <div key={cell.period} className="aspect-square rounded-sm flex items-center justify-center text-[7px]"
                          title={`${t(WEEKDAY_KEYS[cell.weekday], { defaultValue: WEEKDAY_DEFAULTS[cell.weekday] })} ${t(moodHeatmap.periodKeys[cell.period], { defaultValue: PERIOD_DEFAULTS[cell.period] })}: ${cell.avgScore}/5 (${cell.count}次)`}
                          style={{
                            backgroundColor: cell.count > 0
                              ? cell.avgScore >= 4 ? '#bbf7d0' : cell.avgScore >= 3 ? '#fef08a' : cell.avgScore >= 2 ? '#fed7aa' : '#fecaca'
                              : 'var(--muted)',
                            opacity: cell.count > 0 ? 0.6 + cell.avgScore / 10 : 0.2,
                          }}>
                          {cell.count > 0 && cell.avgScore > 0 ? cell.avgScore.toFixed(1) : ''}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 周期性模式检测 */}
          {patterns.length > 0 && (
            <div className="rounded-lg border p-3">
              <span className="text-xs font-medium">{t('diary.periodicPatterns', { defaultValue: '检测到的周期性模式' })}</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {patterns.map((p, i) => (
                  <div key={i} className={cn('rounded-md px-3 py-2 text-xs border', p.type.includes('low') ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : 'border-green-200 bg-green-50/50 dark:bg-green-950/20')}>
                    <div className="font-medium">{t(p.labelKey, { defaultValue: p.labelDefault })}</div>
                    <div className="text-muted-foreground mt-0.5">{t(p.detailKey, { defaultValue: p.detailDefault, ...p.detailParams })}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
