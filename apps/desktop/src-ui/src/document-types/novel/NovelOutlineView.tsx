/**
 * NovelOutlineView — 大纲表格视图
 *
 * 可排序表格，一行一章节/场景，列：标题/状态/字数/POV/场景类型/摘要
 * 所有列可行内编辑，列头可排序
 */
import { useState, useMemo, useCallback } from 'react';
import { Circle, CheckCircle2, PenLine, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { NovelDocumentContent, NovelChapter, NovelCharacter, NovelLocation } from './types';
import {
  updateChapterMeta, updateChapterSummary, renameChapter, updateChapterStatus,
  getChapterWordCount, getSceneWordCount, renameScene, updateSceneMeta,
} from './types';

type SortKey = 'title' | 'status' | 'words' | 'pov' | 'sceneType';
type SortDir = 'asc' | 'desc';

interface NovelOutlineViewProps {
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
  onSelectChapter: (chapterId: string) => void;
  onSelectScene?: (chapterId: string, sceneId: string) => void;
  characters: NovelCharacter[];
  locations: NovelLocation[];
}

interface OutlineRow {
  type: 'volume' | 'chapter' | 'scene';
  id: string;
  volumeId: string;
  chapterId?: string;
  title: string;
  status?: 'draft' | 'revised' | 'done';
  words: number;
  wordGoal?: number;
  povCharacterId?: string;
  sceneType?: string;
  synopsis?: string;
  depth: number;
}

const STATUS_OPTIONS: { value: NovelChapter['status']; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'revised', label: '修订' },
  { value: 'done', label: '完成' },
];

const SCENE_TYPES = [
  { value: 'action', label: '动作' }, { value: 'dialogue', label: '对话' },
  { value: 'description', label: '描写' }, { value: 'transition', label: '过渡' },
  { value: 'flashback', label: '闪回' },
];

const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

export default function NovelOutlineView({ novel, onNovelChange, onSelectChapter, onSelectScene, characters }: NovelOutlineViewProps) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [collapsedVolumes, setCollapsedVolumes] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'title' | 'synopsis'>('title');
  const [editValue, setEditValue] = useState('');

  const rows = useMemo(() => {
    const result: OutlineRow[] = [];
    for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const volWords = vol.chapters.reduce((s, c) => s + getChapterWordCount(c), 0);
      result.push({ type: 'volume', id: vol.id, volumeId: vol.id, title: vol.title, words: volWords, wordGoal: vol.wordGoal, depth: 0 });
      if (collapsedVolumes.has(vol.id)) continue;
      for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
        result.push({
          type: 'chapter', id: ch.id, volumeId: vol.id, title: ch.title, status: ch.status,
          words: getChapterWordCount(ch), wordGoal: ch.wordGoal, povCharacterId: ch.povCharacterId,
          sceneType: ch.sceneType, synopsis: ch.summary, depth: 1,
        });
        if (ch.scenes && ch.scenes.length > 0) {
          for (const sc of [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder)) {
            result.push({
              type: 'scene', id: sc.id, volumeId: vol.id, chapterId: ch.id, title: sc.title,
              status: sc.status, words: getSceneWordCount(sc), wordGoal: sc.wordGoal,
              povCharacterId: sc.povCharacterId, sceneType: sc.sceneType, synopsis: sc.synopsis, depth: 2,
            });
          }
        }
      }
    }
    return result;
  }, [novel, collapsedVolumes]);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }, [sortKey]);

  const handleRowClick = useCallback((row: OutlineRow) => {
    if (row.type === 'volume') {
      setCollapsedVolumes(prev => {
        const next = new Set(prev);
        if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
        return next;
      });
    } else if (row.type === 'scene' && row.chapterId && onSelectScene) {
      onSelectScene(row.chapterId, row.id);
    } else if (row.type === 'chapter') {
      onSelectChapter(row.id);
    }
  }, [onSelectChapter, onSelectScene]);

  const handleDoubleClick = useCallback((row: OutlineRow, field: 'title' | 'synopsis') => {
    if (row.type === 'volume') return;
    setEditingId(row.id);
    setEditField(field);
    setEditValue(field === 'title' ? row.title : (row.synopsis || ''));
  }, []);

  const handleEditConfirm = useCallback(() => {
    if (!editingId) return;
    const row = rows.find(r => r.id === editingId);
    if (!row) { setEditingId(null); return; }
    let updated = novel;
    if (editField === 'title') {
      if (row.type === 'chapter') updated = renameChapter(updated, row.id, editValue);
      else if (row.type === 'scene' && row.chapterId) updated = renameScene(updated, row.chapterId, row.id, editValue);
    } else if (editField === 'synopsis') {
      if (row.type === 'chapter') updated = updateChapterSummary(updated, row.id, editValue);
      else if (row.type === 'scene' && row.chapterId) updated = updateSceneMeta(updated, row.chapterId, row.id, { synopsis: editValue });
    }
    onNovelChange(updated);
    setEditingId(null);
  }, [editingId, editField, editValue, rows, novel, onNovelChange]);

  const handleStatusChange = useCallback((row: OutlineRow, status: NovelChapter['status']) => {
    let updated = novel;
    if (row.type === 'chapter') updated = updateChapterStatus(updated, row.id, status);
    else if (row.type === 'scene' && row.chapterId) updated = updateSceneMeta(updated, row.chapterId, row.id, { status });
    onNovelChange(updated);
  }, [novel, onNovelChange]);

  const handlePovChange = useCallback((row: OutlineRow, povId: string) => {
    let updated = novel;
    if (row.type === 'chapter') updated = updateChapterMeta(updated, row.id, { povCharacterId: povId || undefined });
    else if (row.type === 'scene' && row.chapterId) updated = updateSceneMeta(updated, row.chapterId, row.id, { povCharacterId: povId || undefined });
    onNovelChange(updated);
  }, [novel, onNovelChange]);

  const handleSceneTypeChange = useCallback((row: OutlineRow, sceneType: string) => {
    let updated = novel;
    if (row.type === 'chapter') updated = updateChapterMeta(updated, row.id, { sceneType: (sceneType || undefined) as NovelChapter['sceneType'] });
    else if (row.type === 'scene' && row.chapterId) updated = updateSceneMeta(updated, row.chapterId, row.id, { sceneType: (sceneType || undefined) as NovelChapter['sceneType'] });
    onNovelChange(updated);
  }, [novel, onNovelChange]);

  const statusIcon = (s?: string) => {
    if (s === 'done') return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    if (s === 'revised') return <PenLine className="h-3 w-3 text-blue-500" />;
    return <Circle className="h-3 w-3 text-yellow-500" />;
  };

  const colHeaderClass = 'px-2 py-1.5 text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none border-b bg-muted/30';

  return (
    <div className="h-full overflow-auto" style={DIALOG_STYLE}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className={cn(colHeaderClass, 'text-left min-w-[200px]')} onClick={() => handleSort('title')}>
              {t('novel.outlineTitle', { defaultValue: '标题' })} {sortKey === 'title' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th className={cn(colHeaderClass, 'w-[60px] text-center')} onClick={() => handleSort('status')}>
              {t('novel.outlineStatus', { defaultValue: '状态' })}
            </th>
            <th className={cn(colHeaderClass, 'w-[80px] text-right')} onClick={() => handleSort('words')}>
              {t('novel.outlineWords', { defaultValue: '字数' })}
            </th>
            <th className={cn(colHeaderClass, 'w-[80px] text-center')} onClick={() => handleSort('pov')}>POV</th>
            <th className={cn(colHeaderClass, 'w-[70px] text-center')} onClick={() => handleSort('sceneType')}>
              {t('novel.outlineSceneType', { defaultValue: '类型' })}
            </th>
            <th className={cn(colHeaderClass, 'text-left min-w-[150px]')}>
              {t('novel.outlineSynopsis', { defaultValue: '摘要' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}
              className={cn('border-b border-border/50 hover:bg-accent/30 cursor-pointer transition-colors',
                row.type === 'volume' && 'bg-muted/20 font-medium',
              )}
              onClick={() => handleRowClick(row)}>
              {/* 标题 */}
              <td className="px-2 py-1" style={{ paddingLeft: `${8 + row.depth * 20}px` }}>
                <div className="flex items-center gap-1">
                  {row.type === 'volume' && (collapsedVolumes.has(row.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  {row.type !== 'volume' && statusIcon(row.status)}
                  {editingId === row.id && editField === 'title' ? (
                    <input className="flex-1 text-sm border rounded px-1 py-0.5 bg-background" autoFocus
                      value={editValue} onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditConfirm(); if (e.key === 'Escape') setEditingId(null); }}
                      onBlur={handleEditConfirm} onClick={e => e.stopPropagation()} />
                  ) : (
                    <span className="truncate" onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(row, 'title'); }}>
                      {row.title}
                    </span>
                  )}
                </div>
              </td>
              {/* 状态 */}
              <td className="px-1 py-1 text-center" onClick={e => e.stopPropagation()}>
                {row.type !== 'volume' && (
                  <select className="text-[11px] bg-transparent border-0 cursor-pointer" title="状态"
                    value={row.status || 'draft'} onChange={e => handleStatusChange(row, e.target.value as NovelChapter['status'])}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </td>
              {/* 字数 */}
              <td className="px-2 py-1 text-right text-xs tabular-nums text-muted-foreground">
                {row.words > 999 ? `${(row.words / 1000).toFixed(1)}k` : row.words}
                {row.wordGoal ? <span className="text-[9px]">/{row.wordGoal > 999 ? `${(row.wordGoal / 1000).toFixed(1)}k` : row.wordGoal}</span> : null}
              </td>
              {/* POV */}
              <td className="px-1 py-1 text-center" onClick={e => e.stopPropagation()}>
                {row.type !== 'volume' && (
                  <select className="text-[11px] bg-transparent border-0 cursor-pointer max-w-[70px]" title="POV"
                    value={row.povCharacterId || ''} onChange={e => handlePovChange(row, e.target.value)}>
                    <option value="">—</option>
                    {characters.map(c => <option key={c.id} value={c.id}>{c.name.slice(0, 3)}</option>)}
                  </select>
                )}
              </td>
              {/* 场景类型 */}
              <td className="px-1 py-1 text-center" onClick={e => e.stopPropagation()}>
                {row.type !== 'volume' && (
                  <select className="text-[11px] bg-transparent border-0 cursor-pointer" title="场景类型"
                    value={row.sceneType || ''} onChange={e => handleSceneTypeChange(row, e.target.value)}>
                    <option value="">—</option>
                    {SCENE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                )}
              </td>
              {/* 摘要 */}
              <td className="px-2 py-1 text-xs text-muted-foreground">
                {editingId === row.id && editField === 'synopsis' ? (
                  <input className="w-full text-xs border rounded px-1 py-0.5 bg-background" autoFocus
                    value={editValue} onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEditConfirm(); if (e.key === 'Escape') setEditingId(null); }}
                    onBlur={handleEditConfirm} onClick={e => e.stopPropagation()} />
                ) : (
                  <span className="truncate block max-w-[300px]"
                    onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(row, 'synopsis'); }}>
                    {row.synopsis?.slice(0, 60) || ''}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
