/**
 * DiaryStatusBar — 日记编辑器状态栏
 *
 * 显示：保存状态、字数、段落、阅读时间、今日目标进度、连续天数、今日字数
 * 支持专注模式（最小化显示）
 */
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryEntry } from './types';
import { STATUS_BAR_CLASS } from '../_shared/styles';

interface DiaryStatusBarProps {
  entry: DiaryEntry | null;
  todayWordCount: number;
  dailyGoal: number;
  streak: number;
  chapterWords: number;
  paragraphCount: number;
  readingTimeMin: number;
  writingTime?: number; // 写作计时器秒数
  focusMode?: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved';
}

export default function DiaryStatusBar({
  entry,
  todayWordCount,
  dailyGoal,
  streak,
  chapterWords,
  paragraphCount,
  readingTimeMin,
  writingTime = 0,
  focusMode = false,
  saveStatus,
}: DiaryStatusBarProps) {
  const { t } = useTranslation();

  const goalProgress = dailyGoal > 0 ? Math.min(100, Math.round((todayWordCount / dailyGoal) * 100)) : 0;
  const goalReached = dailyGoal > 0 && todayWordCount >= dailyGoal;

  // 专注模式：最小状态栏
  if (focusMode) {
    return (
      <div className={cn(STATUS_BAR_CLASS, 'text-[10px] bg-card/80')}>
        <span className={cn('flex items-center gap-0.5',
          saveStatus === 'unsaved' ? 'text-amber-500' : saveStatus === 'saving' ? 'text-blue-500' : 'text-green-500')}>
          {saveStatus === 'saved' ? '✅' : saveStatus === 'saving' ? '⏳' : '⚠️'}
        </span>
        <span className="tabular-nums">{chapterWords}{t('diary.charUnit', { defaultValue: '字' })}</span>
        {dailyGoal > 0 && (
          <>
            <span className="w-px h-3 bg-border" />
            <span className={cn('tabular-nums', todayWordCount >= dailyGoal ? 'text-green-600 dark:text-green-400' : '')}>
              {todayWordCount}/{dailyGoal}
            </span>
          </>
        )}
        <div className="flex-1" />
        <span className="text-muted-foreground/50">{t('diary.pressEscToExit', { defaultValue: '按 Esc 退出专注' })}</span>
      </div>
    );
  }

  return (
    <div className={cn(STATUS_BAR_CLASS, 'text-[10px]')}>
      {/* 保存状态 */}
      <span className={cn('flex items-center gap-0.5',
        saveStatus === 'unsaved' ? 'text-amber-500' : saveStatus === 'saving' ? 'text-blue-500' : 'text-green-500')}>
        {saveStatus === 'saved' ? '✅' : saveStatus === 'saving' ? '⏳' : '⚠️'}
        {saveStatus === 'saved' ? t('diary.statusSaved', { defaultValue: '已保存' })
          : saveStatus === 'saving' ? t('diary.statusSaving', { defaultValue: '保存中...' })
          : t('diary.statusUnsaved', { defaultValue: '未保存' })}
      </span>
      <span className="w-px h-3 bg-border" />
      <span className="tabular-nums">{chapterWords}{t('diary.charUnit', { defaultValue: '字' })}</span>
      <span className="w-px h-3 bg-border" />
      <span>{paragraphCount}{t('diary.paragraphUnit', { defaultValue: '段' })}</span>
      <span className="w-px h-3 bg-border" />
      <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{t('diary.readingTime', { defaultValue: '约{{min}}分钟', min: readingTimeMin })}</span>
      {/* 每日字数目标进度 */}
      {writingTime > 0 && (
        <>
          <span className="w-px h-3 bg-border" />
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <span>{writingTime < 60 ? `${writingTime}s` : `${Math.floor(writingTime / 60)}:${String(writingTime % 60).padStart(2, '0')}`}</span>
          </span>
        </>
      )}
      {dailyGoal > 0 && (
        <>
          <span className="w-px h-3 bg-border" />
          <span className="flex items-center gap-1">
            <span className={cn('tabular-nums', goalReached ? 'text-green-600 dark:text-green-400 font-medium' : '')}>
              {goalReached ? '✅' : '🎯'} {todayWordCount}/{dailyGoal}
            </span>
            <span className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <span className={cn('block h-full rounded-full transition-all',
                goalReached ? 'bg-green-500' : todayWordCount >= dailyGoal * 0.7 ? 'bg-yellow-500' : 'bg-primary/60',
              )} style={{ width: `${goalProgress}%` }} />
            </span>
          </span>
        </>
      )}
      <div className="flex-1" />
      <span>🔥 {t('diary.streak', { defaultValue: '连续{{count}}天', count: streak })}</span>
      <span className="text-green-600 dark:text-green-400">{t('diary.todayWords', { defaultValue: '今日+{{count}}', count: todayWordCount })}</span>
    </div>
  );
}
