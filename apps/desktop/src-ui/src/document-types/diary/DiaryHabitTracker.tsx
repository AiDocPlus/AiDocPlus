/**
 * DiaryHabitTracker — 习惯追踪组件
 *
 * 嵌入 DiaryEntryInfo 的 tab，支持：
 * - 查看当日所有习惯及其完成状态
 * - boolean 类型：点击打勾/取消
 * - number 类型：输入数值
 * - 近7天完成率小圆点
 */
import { useMemo } from 'react';
import { Check, Minus, Plus, X, Flame, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent, DiaryEntry, DiaryHabit, DiaryHabitRecord } from './types';
import { calculateHabitStreak, toLocalDateStr, getTodayDateStr } from './types';

interface DiaryHabitTrackerProps {
  entry: DiaryEntry;
  diary: DiaryDocumentContent;
  onToggleHabit: (habitId: string) => void;
  onSetHabitValue: (habitId: string, value: number) => void;
}

export default function DiaryHabitTracker({
  entry, diary, onToggleHabit, onSetHabitValue,
}: DiaryHabitTrackerProps) {
  const { t } = useTranslation();
  const habits = useMemo(() => (diary.metadata.habits || []).filter(h => !h.archived), [diary.metadata.habits]);

  if (habits.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        <Target className="h-6 w-6 mx-auto mb-1 text-muted-foreground/30" />
        <p>{t('diary.noHabits', { defaultValue: '尚未设置习惯' })}</p>
        <p className="text-[10px] mt-0.5">{t('diary.noHabitsHint', { defaultValue: '在设置中添加要追踪的每日习惯' })}</p>
      </div>
    );
  }

  // 收集近7天的完成情况（用于小圆点显示）
  // 依赖当前日期，确保跨天时重新计算
  const todayStr = getTodayDateStr();
  const recentDays = useMemo(() => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(toLocalDateStr(d));
    }
    return days;
  }, [todayStr]);

  // 预计算近7天所有习惯完成状态：Map<"habitId:date", boolean>
  const habitDoneMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const e of diary.entries) {
      if (e.deletedAt || !recentDays.includes(e.date)) continue;
      for (const r of (e.habitRecords || [])) {
        const done = !!(r.done || (r.value !== undefined && r.value > 0));
        if (done) map.set(`${r.habitId}:${e.date}`, true);
      }
    }
    return map;
  }, [diary.entries, recentDays]);

  const getRecordForEntry = (habitId: string): DiaryHabitRecord | undefined => {
    return (entry.habitRecords || []).find(r => r.habitId === habitId);
  };

  // 预计算所有习惯的 streak（避免在 map 循环中重复遍历）
  const streakMap = useMemo(() => {
    const map = new Map<string, { current: number; longest: number }>();
    for (const habit of habits) {
      map.set(habit.id, calculateHabitStreak(diary, habit.id));
    }
    return map;
  }, [diary, habits]);

  return (
    <div className="space-y-2">
      {habits.map(habit => {
        const record = getRecordForEntry(habit.id);
        const isDone = record && (record.done || (record.value !== undefined && record.value > 0));
        const streak = streakMap.get(habit.id)!;

        return (
          <div key={habit.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/30 transition-colors group">
            {/* 颜色标记 */}
            <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: habit.color }} />

            {/* 图标 + 名称 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-xs">
                <span>{habit.icon}</span>
                <span className="font-medium truncate">{habit.name}</span>
                {streak.current > 0 && (
                  <span className="flex items-center gap-0.5 text-orange-500 text-[10px]">
                    <Flame className="h-2.5 w-2.5" />
                    {streak.current}
                  </span>
                )}
              </div>

              {/* 近7天小圆点 */}
              <div className="flex items-center gap-0.5 mt-0.5">
                {recentDays.map((day, i) => {
                  const done = habitDoneMap.has(`${habit.id}:${day}`);
                  const isToday = day === todayStr;
                  return (
                    <div key={day} className={cn(
                      'w-2 h-2 rounded-full transition-colors',
                      done ? 'bg-primary' : 'bg-muted',
                      isToday && 'ring-1 ring-primary/30',
                    )}
                      title={day}
                    />
                  );
                })}
              </div>
            </div>

            {/* 操作区 */}
            {habit.type === 'boolean' ? (
              <button
                className={cn(
                  'h-6 w-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary/50',
                )}
                onClick={() => onToggleHabit(habit.id)}
                title={isDone ? t('diary.habitUncheck', { defaultValue: '取消完成' }) : t('diary.habitCheck', { defaultValue: '标记完成' })}
              >
                {isDone && <Check className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => onSetHabitValue(habit.id, Math.max(0, (record?.value || 0) - (habit.step || 1)))}>
                  <Minus className="h-3 w-3" />
                </button>
                <div className="w-12 text-center">
                  <input
                    type="number"
                    className="w-full px-1 py-0.5 text-xs text-center border rounded bg-background"
                    value={record?.value ?? 0}
                    onChange={e => onSetHabitValue(habit.id, Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
                <button className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => onSetHabitValue(habit.id, (record?.value || 0) + (habit.step || 1))}>
                  <Plus className="h-3 w-3" />
                </button>
                {habit.target && (
                  <span className="text-[10px] text-muted-foreground">/{habit.target}{habit.unit || ''}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
