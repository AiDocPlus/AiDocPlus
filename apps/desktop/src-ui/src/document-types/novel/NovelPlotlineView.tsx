/**
 * NovelPlotlineView — 可视化情节线弹窗（Plottr 风格）
 *
 * X轴=章节/场景，Y轴=情节线，交叉单元格显示场景卡
 * 左侧情节线管理（增删改+颜色）
 */
import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, GitBranch, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { NovelDocumentContent } from './types';
import { addPlotline, updatePlotline, deletePlotline, getChapterWordCount, getSceneWordCount } from './types';

const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };
const PLOTLINE_COLORS = ['#3b82f6', '#ec4899', '#8b5cf6', '#22c55e', '#f97316', '#ef4444', '#06b6d4', '#eab308'];

interface NovelPlotlineViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
  onJumpToScene?: (chapterId: string, sceneId?: string) => void;
}

interface GridScene {
  id: string;
  title: string;
  chapterId: string;
  chapterTitle: string;
  status: string;
  words: number;
  plotlineIds: string[];
}

export default function NovelPlotlineView({ open, onOpenChange, novel, onNovelChange, onJumpToScene }: NovelPlotlineViewProps) {
  const { t } = useTranslation();
  const plotlines = novel.settings.plotlines;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newPlotlineTitle, setNewPlotlineTitle] = useState('');

  // 收集所有场景（含无场景的章节）
  const allScenes = useMemo((): GridScene[] => {
    const result: GridScene[] = [];
    for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
      for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
        if (ch.scenes && ch.scenes.length > 0) {
          for (const sc of [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder)) {
            result.push({
              id: sc.id, title: sc.title, chapterId: ch.id, chapterTitle: ch.title,
              status: sc.status, words: getSceneWordCount(sc), plotlineIds: sc.plotlineIds || [],
            });
          }
        } else {
          result.push({
            id: ch.id, title: ch.title, chapterId: ch.id, chapterTitle: ch.title,
            status: ch.status, words: getChapterWordCount(ch), plotlineIds: [],
          });
        }
      }
    }
    return result;
  }, [novel]);

  const handleAddPlotline = useCallback(() => {
    const title = newPlotlineTitle.trim() || '新情节线';
    const usedColors = new Set(plotlines.map(p => p.color));
    const color = PLOTLINE_COLORS.find(c => !usedColors.has(c)) || PLOTLINE_COLORS[plotlines.length % PLOTLINE_COLORS.length];
    onNovelChange(addPlotline(novel, title, color));
    setNewPlotlineTitle('');
  }, [novel, onNovelChange, newPlotlineTitle, plotlines]);

  const handleDeletePlotline = useCallback((id: string) => {
    onNovelChange(deletePlotline(novel, id));
  }, [novel, onNovelChange]);

  const handleRenamePlotline = useCallback((id: string) => {
    if (!editValue.trim()) { setEditingId(null); return; }
    onNovelChange(updatePlotline(novel, id, { title: editValue.trim() }));
    setEditingId(null);
  }, [novel, onNovelChange, editValue]);

  const handleColorChange = useCallback((id: string, color: string) => {
    onNovelChange(updatePlotline(novel, id, { color }));
  }, [novel, onNovelChange]);

  const handleCellClick = useCallback((scene: GridScene) => {
    if (onJumpToScene) {
      const isScene = scene.id !== scene.chapterId;
      onJumpToScene(scene.chapterId, isScene ? scene.id : undefined);
      onOpenChange(false);
    }
  }, [onJumpToScene, onOpenChange]);

  const sortedPlotlines = useMemo(() => [...plotlines].sort((a, b) => a.sortOrder - b.sortOrder), [plotlines]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[5vh] !translate-y-0 w-[90vw] h-[85vh] max-w-[1400px] max-h-[85vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('novel.plotlineView', { defaultValue: '情节线时间线' })}</DialogTitle>

        {/* 标题栏 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <GitBranch className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">{t('novel.plotlineView', { defaultValue: '情节线时间线' })}</span>
          <span className="text-xs text-muted-foreground ml-2">{sortedPlotlines.length} 条情节线 · {allScenes.length} 个场景</span>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧：情节线管理 */}
          <div className="w-[160px] flex-shrink-0 border-r flex flex-col min-h-0">
            <div className="px-2 py-1.5 border-b flex-shrink-0">
              <div className="flex items-center gap-1">
                <input className="flex-1 text-xs border rounded px-1.5 py-0.5 bg-background" placeholder="新情节线..."
                  value={newPlotlineTitle} onChange={e => setNewPlotlineTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddPlotline(); }} />
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleAddPlotline}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-1 space-y-0.5">
              {sortedPlotlines.map(pl => (
                <div key={pl.id} className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-accent text-xs">
                  {/* 颜色选择 */}
                  <div className="relative group">
                    <div className="w-3 h-3 rounded-full cursor-pointer border" style={{ backgroundColor: pl.color }} />
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:flex gap-0.5 bg-card border rounded p-1 shadow-lg z-50">
                      {PLOTLINE_COLORS.map(c => (
                        <button key={c} className="w-4 h-4 rounded-full border hover:scale-110" style={{ backgroundColor: c }}
                          onClick={() => handleColorChange(pl.id, c)} />
                      ))}
                    </div>
                  </div>
                  {editingId === pl.id ? (
                    <input className="flex-1 text-xs border rounded px-1 py-0.5 bg-background" autoFocus
                      value={editValue} onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenamePlotline(pl.id); if (e.key === 'Escape') setEditingId(null); }}
                      onBlur={() => handleRenamePlotline(pl.id)} />
                  ) : (
                    <span className="flex-1 truncate cursor-pointer" onDoubleClick={() => { setEditingId(pl.id); setEditValue(pl.title); }}>
                      {pl.title}
                    </span>
                  )}
                  <button className="text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100" onClick={() => { setEditingId(pl.id); setEditValue(pl.title); }}>
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                  <button className="text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDeletePlotline(pl.id)}>
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {sortedPlotlines.length === 0 && (
                <div className="text-center text-[10px] text-muted-foreground py-4">点击上方 + 添加情节线</div>
              )}
            </div>
          </div>

          {/* 主体：时间线网格 */}
          <div className="flex-1 min-w-0 overflow-auto">
            {sortedPlotlines.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {t('novel.plotlineEmpty', { defaultValue: '添加情节线后，这里将显示章节×情节线的可视化矩阵' })}
              </div>
            ) : (
              <table className="border-collapse min-w-full">
                {/* X轴：场景标题 */}
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="w-[100px] bg-muted/30 border-b border-r px-1 py-1 text-[10px] text-muted-foreground font-normal sticky left-0 z-20 bg-card">
                      情节线 ＼ 章节
                    </th>
                    {allScenes.map(sc => (
                      <th key={sc.id} className="bg-muted/30 border-b border-r px-1 py-1 text-[10px] text-muted-foreground font-normal min-w-[80px] max-w-[120px]">
                        <div className="truncate" title={`${sc.chapterTitle} ${sc.title !== sc.chapterTitle ? '› ' + sc.title : ''}`}>
                          {sc.title.length > 6 ? sc.title.slice(0, 6) + '…' : sc.title}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlotlines.map(pl => (
                    <tr key={pl.id}>
                      {/* Y轴：情节线名 */}
                      <td className="border-b border-r px-2 py-1 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pl.color }} />
                          <span className="truncate">{pl.title}</span>
                        </div>
                      </td>
                      {/* 单元格 */}
                      {allScenes.map(sc => {
                        const isLinked = sc.plotlineIds.includes(pl.id);
                        return (
                          <td key={sc.id}
                            className={cn('border-b border-r px-0.5 py-0.5 text-center cursor-pointer hover:bg-accent/30 transition-colors',
                              isLinked && 'bg-opacity-10'
                            )}
                            style={isLinked ? { backgroundColor: pl.color + '15' } : undefined}
                            onClick={() => handleCellClick(sc)}>
                            {isLinked && (
                              <div className="text-[9px] leading-tight px-0.5">
                                <div className="w-2 h-2 rounded-full mx-auto mb-0.5" style={{ backgroundColor: pl.color }} />
                                <div className="truncate text-muted-foreground">{sc.words > 0 ? `${sc.words}字` : ''}</div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
