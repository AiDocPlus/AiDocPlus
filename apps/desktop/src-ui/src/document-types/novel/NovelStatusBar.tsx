/**
 * NovelStatusBar — 编辑器底部状态栏
 *
 * 从 NovelDocWorkspace 提取的独立组件。
 * 显示：保存状态/章节字数/段落数/阅读时间/状态/POV/场景类型/番茄钟/今日字数/截止日期
 */
import type { RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { NovelDocumentContent, NovelChapter } from './types';
import { getTodayWordCount } from './types';
import { SCENE_TYPE_LABELS } from './constants';

type SaveStatus = 'saved' | 'saving' | 'unsaved';
type PomodoroState = 'idle' | 'working' | 'resting';

interface NovelStatusBarProps {
  saveStatus: SaveStatus;
  activeChapter: NovelChapter | null;
  chapterWords: number;
  paragraphCount: number;
  readingTimeMin: number;
  novel: NovelDocumentContent;
  totalWords: number;
  totalChapters: number;
  cmEditorRef: RefObject<EditorView | null>;
  pomodoroState: PomodoroState;
  pomodoroRemaining: number;
  onPomodoroToggle: () => void;
  dailyGoalReached: boolean;
}

function formatPomodoro(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NovelStatusBar({
  saveStatus, activeChapter, chapterWords, paragraphCount, readingTimeMin,
  novel, totalWords, totalChapters, cmEditorRef,
  pomodoroState, pomodoroRemaining, onPomodoroToggle, dailyGoalReached,
}: NovelStatusBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-3 py-0.5 border-t text-[10px] text-muted-foreground flex-shrink-0 bg-card">
      {/* 保存状态指示 */}
      <span className={cn('flex items-center gap-0.5', saveStatus === 'unsaved' ? 'text-amber-500' : saveStatus === 'saving' ? 'text-blue-500' : 'text-green-500')}>
        {saveStatus === 'saved' ? '✅' : saveStatus === 'saving' ? '⏳' : '⚠️'}
        {saveStatus === 'saved' ? t('novel.statusSaved', { defaultValue: '已保存' }) : saveStatus === 'saving' ? t('novel.statusSaving', { defaultValue: '保存中...' }) : t('novel.statusUnsaved', { defaultValue: '未保存' })}
      </span>
      <span className="w-px h-3 bg-border" />
      {activeChapter ? (
        <>
          <span className="tabular-nums">
            {chapterWords}{activeChapter.wordGoal ? `/${activeChapter.wordGoal}` : ''}{t('novel.charUnit', { defaultValue: '字' })}
            {activeChapter.wordGoal ? ` (${Math.round(chapterWords / activeChapter.wordGoal * 100)}%)` : ''}
            {(() => { const v = cmEditorRef.current; if (!v) return null; try { const { from, to } = v.state.selection.main; const sel = to - from; return sel > 0 ? ` · ${t('novel.selectedChars', { defaultValue: '选中{{count}}', count: sel })}` : null; } catch { return null; } })()}
          </span>
          <span className="w-px h-3 bg-border" />
          <span>{paragraphCount}{t('novel.paragraphUnit', { defaultValue: '段' })}</span>
          <span className="w-px h-3 bg-border" />
          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{t('novel.readingTime', { defaultValue: '约{{min}}分钟', min: readingTimeMin })}</span>
          <span className="w-px h-3 bg-border" />
          <span>{activeChapter.status === 'done' ? '✅' : activeChapter.status === 'revised' ? '🔵' : '🟡'}{activeChapter.status === 'done' ? t('novel.statusDone', { defaultValue: '完成' }) : activeChapter.status === 'revised' ? t('novel.statusRevised', { defaultValue: '修订' }) : t('novel.statusDraft', { defaultValue: '草稿' })}</span>
          {activeChapter.povCharacterId && (() => {
            const pov = novel.settings.characters.find(c => c.id === activeChapter.povCharacterId);
            return pov ? <><span className="w-px h-3 bg-border" /><span>POV:{pov.name}</span></> : null;
          })()}
          {activeChapter.sceneType && (
            <><span className="w-px h-3 bg-border" /><span>{SCENE_TYPE_LABELS[activeChapter.sceneType] || activeChapter.sceneType}</span></>
          )}
        </>
      ) : null}
      <div className="flex-1" />
      {/* 番茄钟 */}
      <button onClick={onPomodoroToggle} className={cn('flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-accent transition-colors',
        pomodoroState === 'working' ? 'text-red-500' : pomodoroState === 'resting' ? 'text-green-500' : 'text-muted-foreground'
      )} title={pomodoroState === 'idle' ? t('novel.pomodoroStart', { defaultValue: '开始番茄钟 (25分钟)' }) : t('novel.pomodoroReset', { defaultValue: '重置番茄钟' })}>
        🍅
        {pomodoroState !== 'idle' && <span className="tabular-nums">{formatPomodoro(pomodoroRemaining)}</span>}
        {pomodoroState === 'resting' && <span>{t('novel.pomodoroRest', { defaultValue: '休息' })}</span>}
      </button>
      <span className="w-px h-3 bg-border" />
      {/* 每日目标达成提醒 */}
      {dailyGoalReached && (
        <span className="text-amber-500 animate-pulse">🎉 {t('novel.dailyGoalReached', { defaultValue: '今日目标达成！' })}</span>
      )}
      {/* 截止日期倒计时 */}
      {novel.metadata.deadline && (() => {
        const daysLeft = Math.ceil((new Date(novel.metadata.deadline).getTime() - Date.now()) / 86400000);
        const remaining = Math.max(0, (novel.metadata.totalGoal || 0) - totalWords);
        const dailyNeeded = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0;
        return daysLeft > 0 ? (
          <span className="text-xs">{t('novel.deadlineCountdown', { defaultValue: '截止{{days}}天·日需{{words}}字', days: daysLeft, words: dailyNeeded })}</span>
        ) : null;
      })()}
      <span>{totalWords > 9999 ? `${(totalWords/10000).toFixed(1)}万` : totalWords}{t('novel.charUnit', { defaultValue: '字' })} · {novel.volumes.length}{t('novel.volUnit', { defaultValue: '卷' })}{totalChapters}{t('novel.chapterUnit', { defaultValue: '章' })}</span>
      <span className="text-green-600 dark:text-green-400">{t('novel.todayWords', { defaultValue: '今日+{{count}}', count: getTodayWordCount(novel) })}</span>
    </div>
  );
}
