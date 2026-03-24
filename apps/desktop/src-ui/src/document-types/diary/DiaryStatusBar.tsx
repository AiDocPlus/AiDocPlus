/**
 * DiaryStatusBar — 日记编辑器状态栏
 *
 * 显示：字数、今日目标进度、连续天数、保存状态
 * 注意：心情和天气已在工具栏显示，此处不再重复
 */
import { Flame, Target, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryEntry } from './types';

interface DiaryStatusBarProps {
  entry: DiaryEntry | null;
  todayWordCount: number;
  dailyGoal: number;
  streak: number;
  sessionTime?: number; // 写作时长（秒）
  saveStatus: 'saved' | 'saving' | 'unsaved';
}

export default function DiaryStatusBar({
  entry,
  todayWordCount,
  dailyGoal,
  streak,
  sessionTime,
  saveStatus,
}: DiaryStatusBarProps) {
  const { t } = useTranslation();

  const formatSessionTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // 计算目标进度
  const goalProgress = dailyGoal > 0 ? Math.min(100, Math.round((todayWordCount / dailyGoal) * 100)) : 0;
  const goalReached = dailyGoal > 0 && todayWordCount >= dailyGoal;

  return (
    <div className="flex items-center gap-3 px-3 py-1 text-xs text-muted-foreground border-t bg-card/50">
      {/* 字数 */}
      <div className="flex items-center gap-1">
        <span className="font-medium tabular-nums">{entry?.wordCount || 0}</span>
        <span>{t('diary.charUnit', { defaultValue: '字' })}</span>
      </div>

      {/* 分隔符 */}
      <div className="w-px h-3 bg-border" />

      {/* 今日目标进度 */}
      {dailyGoal > 0 && (
        <div className="flex items-center gap-1">
          {goalReached ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Target className="h-3.5 w-3.5" />
          )}
          <div className="flex items-center gap-1">
            <span className={cn(goalReached && 'text-green-600 font-medium')}>
              {todayWordCount}
            </span>
            <span>/</span>
            <span>{dailyGoal}</span>
          </div>
          {/* 进度条 */}
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all rounded-full',
                goalReached ? 'bg-green-500' : 'bg-primary'
              )}
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          {goalReached && (
            <span className="text-green-600 font-medium">
              {t('diary.dailyGoalReached', { defaultValue: '达成!' })}
            </span>
          )}
        </div>
      )}

      {/* 分隔符 */}
      {dailyGoal > 0 && <div className="w-px h-3 bg-border" />}

      {/* 连续天数 */}
      {streak > 0 && (
        <div className="flex items-center gap-0.5">
          <Flame className="h-3.5 w-3.5 text-orange-500" />
          <span className="font-medium tabular-nums">{streak}</span>
          <span>{t('diary.streak', { defaultValue: '天' }).replace(/{{count}}/g, '')}</span>
        </div>
      )}

      {/* 写作时长 */}
      {sessionTime && sessionTime > 0 && (
        <>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-0.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums">{formatSessionTime(sessionTime)}</span>
          </div>
        </>
      )}

      {/* 弹性空间 */}
      <div className="flex-1" />

      {/* 保存状态 */}
      <div className={cn(
        'flex items-center gap-0.5',
        saveStatus === 'saved' && 'text-green-600',
        saveStatus === 'saving' && 'text-amber-600',
        saveStatus === 'unsaved' && 'text-muted-foreground',
      )}>
        <div className={cn(
          'w-1.5 h-1.5 rounded-full',
          saveStatus === 'saved' && 'bg-green-500',
          saveStatus === 'saving' && 'bg-amber-500 animate-pulse',
          saveStatus === 'unsaved' && 'bg-muted-foreground/50',
        )} />
        <span>
          {saveStatus === 'saved' && t('diary.statusSaved', { defaultValue: '已保存' })}
          {saveStatus === 'saving' && t('diary.statusSaving', { defaultValue: '保存中...' })}
          {saveStatus === 'unsaved' && t('diary.statusUnsaved', { defaultValue: '未保存' })}
        </span>
      </div>
    </div>
  );
}
