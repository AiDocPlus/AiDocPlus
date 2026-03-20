/**
 * NovelDashboard — 全书统计仪表盘
 *
 * 90vw × 85vh Dialog，包含：
 * - 6格总览卡片（全书字数/章节数/完成率/人物数/伏笔数/今日字数）
 * - 每日写作趋势（30天柱状图）
 * - 章节完成度矩阵
 * - 章节字数排行
 * - 人物出场频率
 * - 伏笔状态分布
 * - 写作速度分析
 * - 目标进度
 */
import { useMemo } from 'react';
import { BookOpen, Users, Eye, PenLine, BarChart3, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { NovelDocumentContent } from './types';
import { getTotalWordCount, getChapterWordCount, getTodayWordCount } from './types';
import { DIALOG_STYLE } from './constants';

interface NovelDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novel: NovelDocumentContent;
}

export default function NovelDashboard({ open, onOpenChange, novel }: NovelDashboardProps) {
  const { t } = useTranslation();

  const totalWords = getTotalWordCount(novel);
  const totalChapters = novel.volumes.reduce((s, v) => s + v.chapters.length, 0);
  const doneChapters = novel.volumes.flatMap(v => v.chapters).filter(c => c.status === 'done').length;
  const completionRate = totalChapters > 0 ? Math.round(doneChapters / totalChapters * 100) : 0;
  const characterCount = novel.settings.characters.length;
  const openForeshadowing = novel.settings.foreshadowing.filter(f => f.status === 'open').length;
  const totalForeshadowing = novel.settings.foreshadowing.length;
  const todayWords = getTodayWordCount(novel);

  // 每日写作趋势（最近30天）
  const dailyTrend = useMemo(() => {
    const stats = novel.metadata.dailyWordStats || [];
    const today = new Date();
    const days: { date: string; words: number; isToday: boolean }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entry = stats.find(s => s.date === dateStr);
      days.push({ date: dateStr, words: entry?.words || 0, isToday: i === 0 });
    }
    return days;
  }, [novel.metadata.dailyWordStats]);

  const maxDailyWords = Math.max(1, ...dailyTrend.map(d => d.words));

  // 章节字数排行
  const chapterRanking = useMemo(() => {
    return novel.volumes.flatMap(v => v.chapters.map(ch => ({
      title: ch.title,
      volTitle: v.title,
      words: getChapterWordCount(ch),
      status: ch.status,
    }))).sort((a, b) => b.words - a.words);
  }, [novel]);

  const maxChapterWords = Math.max(1, ...chapterRanking.map(c => c.words));
  const avgChapterWords = chapterRanking.length > 0 ? Math.round(chapterRanking.reduce((s, c) => s + c.words, 0) / chapterRanking.length) : 0;

  // 人物出场频率
  const characterAppearances = useMemo(() => {
    const allContent = novel.volumes.flatMap(v => v.chapters.map(ch => ch.content)).join('\n');
    return novel.settings.characters.map(c => {
      const names = [c.name, ...(c.aliases || [])];
      let count = 0;
      for (const name of names) {
        if (!name) continue;
        const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        count += (allContent.match(regex) || []).length;
      }
      return { name: c.name, role: c.role, count };
    }).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [novel]);

  const maxAppearance = Math.max(1, ...characterAppearances.map(c => c.count));

  // 伏笔状态分布
  const foreshadowingStats = useMemo(() => ({
    open: novel.settings.foreshadowing.filter(f => f.status === 'open').length,
    resolved: novel.settings.foreshadowing.filter(f => f.status === 'resolved').length,
    abandoned: novel.settings.foreshadowing.filter(f => f.status === 'abandoned').length,
  }), [novel.settings.foreshadowing]);

  // 写作速度分析
  const writingSpeed = useMemo(() => {
    const sessions = novel.metadata.writingSessions || [];
    if (sessions.length === 0) return null;
    const totalTime = sessions.reduce((s, sess) => s + (sess.endTime - sess.startTime), 0);
    const totalWordsWritten = sessions.reduce((s, sess) => s + sess.wordsWritten, 0);
    const avgTimeMin = Math.round(totalTime / sessions.length / 60000);
    const wordsPerHour = totalTime > 0 ? Math.round(totalWordsWritten / (totalTime / 3600000)) : 0;
    return { avgTimeMin, wordsPerHour, sessions: sessions.length };
  }, [novel.metadata.writingSessions]);

  // 连续写作天数
  const streak = useMemo(() => {
    const stats = novel.metadata.dailyWordStats || [];
    if (stats.length === 0) return 0;
    const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    const today = new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entry = sorted.find(s => s.date === dateStr);
      if (entry && entry.words > 0) count++;
      else if (i > 0) break; // 允许今天还没写
    }
    return count;
  }, [novel.metadata.dailyWordStats]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[5vh] !translate-y-0 w-[90vw] h-[85vh] max-w-[1400px] max-h-[85vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('novel.dashboard', { defaultValue: '仪表盘' })}</DialogTitle>

        {/* 标题栏 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <BarChart3 className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">{t('novel.dashboard', { defaultValue: '全书统计仪表盘' })}</span>
          {streak > 0 && (
            <span className="text-xs text-amber-500 ml-2">🔥 {t('novel.dashStreak', { defaultValue: '连续写作 {{count}} 天', count: streak })}</span>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* ── 总览卡片 ── */}
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: t('novel.dashTotalWords', { defaultValue: '全书字数' }), value: totalWords > 9999 ? `${(totalWords/10000).toFixed(1)}万` : String(totalWords), icon: BookOpen, color: 'text-blue-600' },
              { label: t('novel.dashChapters', { defaultValue: '章节' }), value: `${novel.volumes.length}${t('novel.volUnit', { defaultValue: '卷' })}${totalChapters}${t('novel.chapterUnit', { defaultValue: '章' })}`, icon: PenLine, color: 'text-purple-600' },
              { label: t('novel.dashCompletion', { defaultValue: '完成率' }), value: `${completionRate}%`, icon: BarChart3, color: completionRate > 70 ? 'text-green-600' : 'text-amber-600' },
              { label: t('novel.dashCharacters', { defaultValue: '人物' }), value: String(characterCount), icon: Users, color: 'text-cyan-600' },
              { label: t('novel.dashForeshadowing', { defaultValue: '伏笔' }), value: `${openForeshadowing}/${totalForeshadowing}`, icon: Eye, color: 'text-amber-600' },
              { label: t('novel.dashToday', { defaultValue: '今日字数' }), value: `+${todayWords}`, icon: Clock, color: 'text-green-600' },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="rounded-lg border bg-background p-3 text-center">
                  <Icon className={cn('h-5 w-5 mx-auto mb-1', card.color)} />
                  <div className="text-lg font-bold">{card.value}</div>
                  <div className="text-[10px] text-muted-foreground">{card.label}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* ── 每日写作趋势 ── */}
            <div className="rounded-lg border bg-background p-3">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('novel.dashDailyTrend', { defaultValue: '每日写作趋势（近30天）' })}</h3>
              <div className="flex items-end gap-[2px] h-[100px]">
                {dailyTrend.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center" title={`${day.date}: ${day.words}字`}>
                    <div className={cn('w-full rounded-t', day.isToday ? 'bg-amber-500' : day.words > 0 ? 'bg-blue-400' : 'bg-muted')}
                      style={{ height: `${Math.max(2, day.words / maxDailyWords * 90)}px` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>{dailyTrend[0]?.date.slice(5)}</span>
                <span>{t('novel.dashTodayLabel', { defaultValue: '今日' })}</span>
              </div>
            </div>

            {/* ── 章节完成度矩阵 ── */}
            <div className="rounded-lg border bg-background p-3">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('novel.dashChapterMatrix', { defaultValue: '章节完成度' })}</h3>
              <div className="space-y-2 max-h-[120px] overflow-y-auto">
                {novel.volumes.map(vol => (
                  <div key={vol.id}>
                    <div className="text-[10px] text-muted-foreground mb-0.5">{vol.title}</div>
                    <div className="flex flex-wrap gap-1">
                      {[...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder).map(ch => {
                        const wc = getChapterWordCount(ch);
                        const size = wc > 3000 ? 'w-5 h-5' : wc > 1000 ? 'w-4 h-4' : 'w-3 h-3';
                        const color = ch.status === 'done' ? 'bg-green-400' : ch.status === 'revised' ? 'bg-blue-400' : 'bg-yellow-400';
                        return (
                          <div key={ch.id} className={cn('rounded-sm', size, color)} title={`${ch.title}: ${wc}字 (${ch.status})`} />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* ── 章节字数排行 ── */}
            <div className="rounded-lg border bg-background p-3">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('novel.dashWordRanking', { defaultValue: '章节字数排行' })}</h3>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {chapterRanking.slice(0, 15).map((ch, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-16 truncate text-muted-foreground">{ch.title}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden relative">
                      <div className={cn('h-full rounded-full', ch.status === 'done' ? 'bg-green-400' : ch.status === 'revised' ? 'bg-blue-400' : 'bg-yellow-400')}
                        style={{ width: `${ch.words / maxChapterWords * 100}%` }} />
                      {/* 平均值参考线 */}
                      <div className="absolute top-0 bottom-0 w-px bg-red-400/50" style={{ left: `${avgChapterWords / maxChapterWords * 100}%` }} />
                    </div>
                    <span className="w-10 text-right tabular-nums">{ch.words > 999 ? `${(ch.words/1000).toFixed(1)}k` : ch.words}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 人物出场频率 ── */}
            <div className="rounded-lg border bg-background p-3">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('novel.dashCharAppearances', { defaultValue: '人物出场频率 Top 10' })}</h3>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {characterAppearances.map((ch, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-12 truncate">{ch.name}</span>
                    <span className="text-[9px] text-muted-foreground w-6">{ch.role === 'protagonist' ? '主' : ch.role === 'antagonist' ? '反' : ch.role === 'supporting' ? '配' : '龙'}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${ch.count / maxAppearance * 100}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums">{ch.count}</span>
                  </div>
                ))}
                {characterAppearances.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4">{t('novel.dashNoCharacters', { defaultValue: '暂无人物数据' })}</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* ── 伏笔状态分布 ── */}
            <div className="rounded-lg border bg-background p-3">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('novel.dashForeshadowingDetail', { defaultValue: '伏笔状态分布' })}</h3>
              {totalForeshadowing > 0 ? (
                <div className="flex items-center gap-3">
                  {/* 简易环形指示 */}
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden flex">
                    {foreshadowingStats.open > 0 && <div className="h-full bg-amber-400" style={{ width: `${foreshadowingStats.open / totalForeshadowing * 100}%` }} />}
                    {foreshadowingStats.resolved > 0 && <div className="h-full bg-green-400" style={{ width: `${foreshadowingStats.resolved / totalForeshadowing * 100}%` }} />}
                    {foreshadowingStats.abandoned > 0 && <div className="h-full bg-gray-400" style={{ width: `${foreshadowingStats.abandoned / totalForeshadowing * 100}%` }} />}
                  </div>
                  <div className="text-[10px] space-y-0.5">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{t('novel.foreshadowingOpen', { defaultValue: '未解' })} {foreshadowingStats.open}</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" />{t('novel.foreshadowingResolved', { defaultValue: '已解' })} {foreshadowingStats.resolved}</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />{t('novel.foreshadowingAbandoned', { defaultValue: '放弃' })} {foreshadowingStats.abandoned}</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-2">{t('novel.dashNoForeshadowing', { defaultValue: '暂无伏笔' })}</div>
              )}
            </div>

            {/* ── 写作速度分析 ── */}
            <div className="rounded-lg border bg-background p-3">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('novel.dashWritingSpeed', { defaultValue: '写作速度分析' })}</h3>
              {writingSpeed ? (
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('novel.dashAvgSession', { defaultValue: '平均会话时长' })}</span><span>{writingSpeed.avgTimeMin} {t('novel.dashMinutes', { defaultValue: '分钟' })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('novel.dashWordsPerHour', { defaultValue: '每小时字数' })}</span><span>{writingSpeed.wordsPerHour}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('novel.dashTotalSessions', { defaultValue: '写作会话数' })}</span><span>{writingSpeed.sessions}</span></div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-2">{t('novel.dashNoSessions', { defaultValue: '暂无写作会话数据' })}</div>
              )}
            </div>

            {/* ── 目标进度 ── */}
            <div className="rounded-lg border bg-background p-3">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('novel.dashGoalProgress', { defaultValue: '目标进度' })}</h3>
              <div className="text-xs space-y-2">
                {novel.metadata.totalGoal && novel.metadata.totalGoal > 0 ? (
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-muted-foreground">{t('novel.dashTotalGoal', { defaultValue: '全书目标' })}</span>
                      <span>{totalWords}/{novel.metadata.totalGoal} ({Math.round(totalWords / novel.metadata.totalGoal * 100)}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', totalWords / novel.metadata.totalGoal > 0.8 ? 'bg-green-400' : 'bg-blue-400')}
                        style={{ width: `${Math.min(100, totalWords / novel.metadata.totalGoal * 100)}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">{t('novel.dashNoTotalGoal', { defaultValue: '未设置全书目标' })}</div>
                )}
                {novel.metadata.dailyGoal && novel.metadata.dailyGoal > 0 ? (
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-muted-foreground">{t('novel.dashDailyGoal', { defaultValue: '每日目标' })}</span>
                      <span>{todayWords}/{novel.metadata.dailyGoal}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', todayWords >= novel.metadata.dailyGoal ? 'bg-green-400' : 'bg-amber-400')}
                        style={{ width: `${Math.min(100, todayWords / novel.metadata.dailyGoal * 100)}%` }} />
                    </div>
                  </div>
                ) : null}
                {novel.metadata.deadline && (
                  <div className="text-muted-foreground">
                    {(() => {
                      const daysLeft = Math.ceil((new Date(novel.metadata.deadline).getTime() - Date.now()) / 86400000);
                      const remaining = Math.max(0, (novel.metadata.totalGoal || 0) - totalWords);
                      const dailyNeeded = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0;
                      return daysLeft > 0
                        ? t('novel.dashDeadline', { defaultValue: '距截止 {{days}} 天 · 需每天写 {{words}} 字', days: daysLeft, words: dailyNeeded })
                        : t('novel.dashDeadlinePassed', { defaultValue: '截止日期已过' });
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
