/**
 * DiaryTrashPanel — 回收站弹窗
 *
 * 显示已软删除的条目，支持恢复和永久删除
 * 超过30天的自动清理
 */
import { useMemo, useCallback } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent } from './types';
import { getDeletedEntries, restoreEntry, permanentDeleteEntry, cleanupDeletedEntries, MOOD_EMOJI } from './types';
import { DIALOG_STYLE } from '../_shared/styles';

interface DiaryTrashPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diary: DiaryDocumentContent;
  onDiaryChange: (updated: DiaryDocumentContent) => void;
  onSelectEntry?: (entryId: string) => void;
}

export default function DiaryTrashPanel({
  open, onOpenChange, diary, onDiaryChange, onSelectEntry,
}: DiaryTrashPanelProps) {
  const { t } = useTranslation();
  const deletedEntries = useMemo(() => getDeletedEntries(diary), [diary]);

  const handleRestore = useCallback((entryId: string) => {
    const updated = restoreEntry(diary, entryId);
    onDiaryChange(updated);
  }, [diary, onDiaryChange]);

  const handlePermanentDelete = useCallback((entryId: string) => {
    if (!window.confirm(t('diary.confirmPermanentDelete', { defaultValue: '确定要永久删除这条日记吗？此操作不可撤销。' }))) return;
    const updated = permanentDeleteEntry(diary, entryId);
    onDiaryChange(updated);
  }, [diary, onDiaryChange, t]);

  const handleCleanup = useCallback(() => {
    if (!window.confirm(t('diary.confirmCleanupOld', { defaultValue: '确定要清理超过30天的已删除条目吗？此操作不可撤销。' }))) return;
    const updated = cleanupDeletedEntries(diary);
    onDiaryChange(updated);
  }, [diary, onDiaryChange, t]);

  const handleEmptyTrash = useCallback(() => {
    if (!window.confirm(t('diary.confirmEmptyTrash', { defaultValue: '确定要清空回收站吗？{{count}} 条记录将被永久删除，此操作不可撤销。', count: deletedEntries.length }))) return;
    const deletedIds = new Set(deletedEntries.map(e => e.id));
    const updated = { ...diary, entries: diary.entries.filter(e => !deletedIds.has(e.id)) };
    onDiaryChange(updated);
  }, [diary, deletedEntries, onDiaryChange, t]);

function formatDeletedTime(ts: number, t: (key: string, options?: Record<string, unknown>) => string) {
  const d = new Date(ts);
  const diffDays = Math.floor((Date.now() - ts) / 86400000);
  if (diffDays === 0) return t('diary.timeToday', { defaultValue: '今天' });
  if (diffDays === 1) return t('diary.timeYesterday', { defaultValue: '昨天' });
  if (diffDays < 7) return t('diary.timeDaysAgo', { defaultValue: '{{count}}天前', count: diffDays });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[10vh] !translate-y-0 w-[60vw] h-[60vh] max-w-[750px] max-h-[60vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('diary.trash', { defaultValue: '回收站' })}</DialogTitle>

        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium">{t('diary.trash', { defaultValue: '回收站' })}</span>
          <span className="text-[10px] text-muted-foreground">({deletedEntries.length})</span>
          <div className="flex-1" />
          {deletedEntries.length > 0 && (
            <>
              <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={handleCleanup}>
                {t('diary.cleanupOld', { defaultValue: '清理30天前' })}
              </Button>
              <Button variant="destructive" size="sm" className="h-6 text-[10px]" onClick={handleEmptyTrash}>
                {t('diary.emptyTrash', { defaultValue: '清空回收站' })}
              </Button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {deletedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2">
              <Trash2 className="h-8 w-8 text-muted-foreground/20" />
              <p>{t('diary.trashEmpty', { defaultValue: '回收站为空' })}</p>
              <p className="text-[10px]">{t('diary.trashHint', { defaultValue: '删除的日记条目会在这里保留30天' })}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {deletedEntries.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 px-3 py-2 border rounded hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      {entry.mood && <span>{MOOD_EMOJI[entry.mood]}</span>}
                      <span className="font-medium truncate">
                        {entry.title || (entry.content || '').slice(0, 30).replace(/\n/g, ' ') || t('diary.untitled', { defaultValue: '无标题' })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{entry.date}</span>
                      <span>{entry.wordCount}{t('diary.charUnit', { defaultValue: '字' })}</span>
                      {entry.deletedAt && (
                        <span className="flex items-center gap-0.5 text-red-500/70">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {t('diary.deletedAt', { defaultValue: '删除于 {{time}}', time: formatDeletedTime(entry.deletedAt, t) })}
                        </span>
                      )}
                    </div>
                    {(entry.content || '') && (
                      <div className="text-xs text-muted-foreground/60 mt-0.5 truncate">
                        {(entry.content || '').replace(/\n/g, ' ').slice(0, 80)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="outline" size="sm" className="h-6 text-[10px] gap-0.5"
                      onClick={() => {
                        handleRestore(entry.id);
                        if (onSelectEntry) onSelectEntry(entry.id);
                      }}>
                      <RotateCcw className="h-3 w-3" />
                      {t('diary.restore', { defaultValue: '恢复' })}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500 hover:text-red-600"
                      onClick={() => handlePermanentDelete(entry.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
