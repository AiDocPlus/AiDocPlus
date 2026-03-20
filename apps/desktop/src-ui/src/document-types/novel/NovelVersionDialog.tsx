/**
 * NovelVersionDialog — 章节版本历史对话框
 *
 * Phase 11: 快照列表、diff 对比、恢复、标记重要版本
 */
import { useState, useMemo } from 'react';
import { History, Star, RotateCcw, GitCompare, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { loadSnapshots, toggleSnapshotLabel, diffTexts, type DiffLine } from './novelVersions';
import { DIALOG_STYLE, type StorageLike } from './constants';

interface NovelVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string | null;
  chapterTitle: string;
  currentContent: string;
  storage: StorageLike;
  onRestore: (content: string) => void;
  onManualSave?: () => void;
}

export default function NovelVersionDialog({
  open, onOpenChange, chapterId, chapterTitle, currentContent: _currentContent, storage, onRestore, onManualSave,
}: NovelVersionDialogProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'diff'>('view');
  const [refreshKey, setRefreshKey] = useState(0);

  const snapshots = useMemo(() => {
    if (!chapterId) return [];
    return loadSnapshots(storage, chapterId);
  }, [chapterId, storage, open, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = snapshots.find(s => s.id === selectedId);
  const compareSnap = snapshots.find(s => s.id === compareId);

  const diffResult = useMemo<DiffLine[]>(() => {
    if (mode !== 'diff' || !selected || !compareSnap) return [];
    return diffTexts(selected.content, compareSnap.content);
  }, [mode, selected, compareSnap]);

  const handleToggleLabel = (snapId: string) => {
    if (!chapterId) return;
    toggleSnapshotLabel(storage, chapterId, snapId);
    setRefreshKey(prev => prev + 1);
  };

  const handleRestore = () => {
    if (!selected) return;
    onRestore(selected.content);
    onOpenChange(false);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (!chapterId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[8vh] !translate-y-0 w-[75vw] h-[70vh] max-w-[1000px] max-h-[70vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('novel.versionHistory', { defaultValue: '版本历史' })}</DialogTitle>

        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <History className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">{t('novel.versionHistory', { defaultValue: '版本历史' })} — {chapterTitle}</span>
          <div className="flex-1" />
          {onManualSave && (
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={onManualSave}>
              <Save className="h-3 w-3" />{t('novel.versionSaveNow', { defaultValue: '保存当前版本' })}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">{snapshots.length}/100 {t('novel.versionSnapshots', { defaultValue: '个快照' })}（滚动保存）</span>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧：快照列表 */}
          <div className="w-[220px] flex-shrink-0 border-r flex flex-col min-h-0">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b flex-shrink-0">
              <button className={cn('text-xs px-2 py-0.5 rounded', mode === 'view' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
                onClick={() => setMode('view')}>{t('novel.versionView', { defaultValue: '查看' })}</button>
              <button className={cn('text-xs px-2 py-0.5 rounded', mode === 'diff' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
                onClick={() => setMode('diff')}><GitCompare className="h-3 w-3 inline mr-0.5" />{t('novel.versionDiff', { defaultValue: '对比' })}</button>
            </div>
            <div className="flex-1 overflow-auto p-1 space-y-0.5">
              {snapshots.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-8">{t('novel.versionNoSnapshots', { defaultValue: '暂无快照' })}</div>
              )}
              {[...snapshots].reverse().map(snap => (
                <div key={snap.id}
                  className={cn('flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors',
                    selectedId === snap.id ? 'bg-primary/10 text-primary font-medium' :
                    compareId === snap.id ? 'bg-blue-500/10 text-blue-600' : 'hover:bg-accent'
                  )}
                  onClick={() => {
                    if (mode === 'diff' && selectedId && selectedId !== snap.id) {
                      setCompareId(snap.id);
                    } else {
                      setSelectedId(snap.id);
                      setCompareId(null);
                    }
                  }}>
                  <button className="flex-shrink-0 p-0.5" onClick={(e) => { e.stopPropagation(); handleToggleLabel(snap.id); }}
                    title={snap.label ? t('novel.versionUnmark', { defaultValue: '取消标记' }) : t('novel.versionMark', { defaultValue: '标记重要' })}>
                    <Star className={cn('h-3 w-3', snap.label ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30')} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{snap.label || formatTime(snap.timestamp)}</div>
                    <div className="text-[10px] text-muted-foreground">{snap.wordCount}{t('novel.charUnit', { defaultValue: '字' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：内容/对比 */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {mode === 'view' && selected && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{formatTime(selected.timestamp)} · {selected.wordCount}{t('novel.charUnit', { defaultValue: '字' })}</span>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={handleRestore}>
                    <RotateCcw className="h-3 w-3" />{t('novel.versionRestore', { defaultValue: '恢复到此版本' })}
                  </Button>
                </div>
                <div className="flex-1 overflow-auto p-3">
                  <pre className="text-xs whitespace-pre-wrap text-foreground/80 leading-relaxed">{selected.content}</pre>
                </div>
              </>
            )}
            {mode === 'diff' && diffResult.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0 text-xs text-muted-foreground">
                  <span className="text-red-500">— {selected ? formatTime(selected.timestamp) : ''}</span>
                  <span className="text-green-500">+ {compareSnap ? formatTime(compareSnap.timestamp) : ''}</span>
                </div>
                <div className="flex-1 overflow-auto p-3">
                  {diffResult.map((line, i) => (
                    <div key={i} className={cn('text-xs font-mono whitespace-pre-wrap',
                      line.type === 'add' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                      line.type === 'remove' ? 'bg-red-500/10 text-red-700 dark:text-red-400 line-through' :
                      'text-foreground/60'
                    )}>
                      {line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '}{line.content}
                    </div>
                  ))}
                </div>
              </>
            )}
            {!selected && mode === 'view' && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {t('novel.versionSelectHint', { defaultValue: '选择一个快照查看内容' })}
              </div>
            )}
            {mode === 'diff' && diffResult.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {t('novel.versionDiffHint', { defaultValue: '先选择一个快照，再点击另一个进行对比' })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
