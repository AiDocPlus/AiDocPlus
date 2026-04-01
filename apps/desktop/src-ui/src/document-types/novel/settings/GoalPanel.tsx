/**
 * GoalPanel — 写作目标管理面板
 *
 * Phase 10: 全书目标/每日目标/截止日期/卷目标/章节默认目标/里程碑
 */
import { useState } from 'react';
import { Plus, Trash2, Target, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { NovelDocumentContent, NovelMilestone } from '../types';
import { updateVolumeMeta, getChapterWordCount } from '../types';

const LABEL = 'text-xs text-muted-foreground font-medium';
const INPUT = 'w-full text-sm border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring';

interface GoalPanelProps {
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
}


export default function GoalPanel({ novel, onNovelChange }: GoalPanelProps) {
  const { t } = useTranslation();
  const meta = novel.metadata;
  const totalWords = novel.volumes.reduce((s, v) => s + v.chapters.reduce((s2, c) => s2 + getChapterWordCount(c), 0), 0);

  const [newMilestoneLabel, setNewMilestoneLabel] = useState('');
  const [newMilestoneWords, setNewMilestoneWords] = useState('');

  const milestones: NovelMilestone[] = meta.milestones || [];

  const updateMeta = (patch: Partial<NovelDocumentContent['metadata']>) => {
    onNovelChange({ ...novel, metadata: { ...novel.metadata, ...patch } });
  };

  const updateMilestones = (ms: NovelMilestone[]) => {
    onNovelChange({ ...novel, metadata: { ...novel.metadata, milestones: ms } });
  };

  const handleAddMilestone = () => {
    const label = newMilestoneLabel.trim();
    const words = parseInt(newMilestoneWords);
    if (!label || isNaN(words) || words <= 0) return;
    const ms: NovelMilestone = { id: `ms_${Date.now()}`, label, targetWords: words, reached: totalWords >= words };
    updateMilestones([...milestones, ms]);
    setNewMilestoneLabel('');
    setNewMilestoneWords('');
  };

  // 连续写作天数
  const streak = (() => {
    const stats = meta.dailyWordStats || [];
    if (stats.length === 0) return 0;
    const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    const today = new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      if (sorted.find(s => s.date === dateStr && s.words > 0)) count++;
      else if (i > 0) break;
    }
    return count;
  })();

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* 全书目标 */}
      <div className="rounded-lg border bg-background p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">{t('novel.goalTotal', { defaultValue: '全书目标' })}</span>
          {streak > 0 && <span className="text-xs text-amber-500 ml-auto">🔥 {t('novel.goalStreak', { defaultValue: '连续写作 {{count}} 天', count: streak })}</span>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={LABEL}>{t('novel.goalTotalWords', { defaultValue: '目标字数' })}</label>
            <input type="number" className={INPUT} value={meta.totalGoal || ''} placeholder="如 200000"
              onChange={e => updateMeta({ totalGoal: e.target.value ? parseInt(e.target.value) : undefined })} />
          </div>
          <div>
            <label className={LABEL}>{t('novel.goalDailyWords', { defaultValue: '每日目标' })}</label>
            <input type="number" className={INPUT} value={meta.dailyGoal || ''} placeholder="如 2000"
              onChange={e => updateMeta({ dailyGoal: e.target.value ? parseInt(e.target.value) : undefined })} />
          </div>
          <div>
            <label className={LABEL}>{t('novel.goalDeadline', { defaultValue: '截止日期' })}</label>
            <input type="date" className={INPUT} value={meta.deadline || ''}
              onChange={e => updateMeta({ deadline: e.target.value || undefined })} />
          </div>
        </div>
        <div>
          <label className={LABEL}>{t('novel.goalChapterDefault', { defaultValue: '章节默认目标字数' })}</label>
          <input type="number" className={INPUT} value={meta.chapterDefaultGoal || ''} placeholder="如 3000"
            onChange={e => updateMeta({ chapterDefaultGoal: e.target.value ? parseInt(e.target.value) : undefined })} />
        </div>
        {/* 截止日期倒计时 */}
        {meta.deadline && (() => {
          const daysLeft = Math.ceil((new Date(meta.deadline).getTime() - Date.now()) / 86400000);
          const remaining = Math.max(0, (meta.totalGoal || 0) - totalWords);
          const dailyNeeded = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0;
          return (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
              {daysLeft > 0
                ? t('novel.goalDeadlineInfo', { defaultValue: '距截止 {{days}} 天 · 还需 {{remaining}} 字 · 每天需写 {{daily}} 字', days: daysLeft, remaining, daily: dailyNeeded })
                : t('novel.goalDeadlinePassed', { defaultValue: '截止日期已过' })}
            </div>
          );
        })()}
      </div>

      {/* 卷目标 */}
      <div className="rounded-lg border bg-background p-3 space-y-2">
        <span className="text-sm font-medium">{t('novel.goalVolumes', { defaultValue: '卷目标' })}</span>
        <div className="space-y-1.5">
          {novel.volumes.map(vol => {
            const volWords = vol.chapters.reduce((s, c) => s + getChapterWordCount(c), 0);
            return (
              <div key={vol.id} className="flex items-center gap-2 text-xs">
                <span className="w-24 truncate">{vol.title}</span>
                <input type="number" className="w-20 text-xs border rounded px-1.5 py-0.5 bg-background"
                  value={vol.wordGoal || ''} placeholder="目标"
                  onChange={e => onNovelChange(updateVolumeMeta(novel, vol.id, { wordGoal: e.target.value ? parseInt(e.target.value) : undefined }))} />
                <span className="text-muted-foreground tabular-nums">{volWords}字</span>
                {vol.wordGoal && vol.wordGoal > 0 && (
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, volWords / vol.wordGoal * 100)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 里程碑 */}
      <div className="rounded-lg border bg-background p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">{t('novel.goalMilestones', { defaultValue: '里程碑' })}</span>
        </div>
        <div className="space-y-1">
          {milestones.map(ms => (
            <div key={ms.id} className="flex items-center gap-2 text-xs">
              <span className={totalWords >= ms.targetWords ? 'text-green-500' : 'text-muted-foreground'}>
                {totalWords >= ms.targetWords ? '✅' : '⬜'}
              </span>
              <span className="flex-1 truncate">{ms.label}</span>
              <span className="text-muted-foreground tabular-nums">{ms.targetWords > 9999 ? `${(ms.targetWords/10000).toFixed(1)}万` : ms.targetWords}字</span>
              <button className="text-destructive hover:text-destructive/80" onClick={() => updateMilestones(milestones.filter(m => m.id !== ms.id))}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input className="flex-1 text-xs border rounded px-2 py-1 bg-background" value={newMilestoneLabel}
            onChange={e => setNewMilestoneLabel(e.target.value)} placeholder={t('novel.goalMilestoneName', { defaultValue: '里程碑名称' })} />
          <input type="number" className="w-20 text-xs border rounded px-2 py-1 bg-background" value={newMilestoneWords}
            onChange={e => setNewMilestoneWords(e.target.value)} placeholder={t('novel.goalMilestoneWords', { defaultValue: '目标字数' })} />
          <Button variant="outline" size="sm" className="h-6 text-xs gap-0.5" onClick={handleAddMilestone}>
            <Plus className="h-3 w-3" />{t('novel.goalAddMilestone', { defaultValue: '添加' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
