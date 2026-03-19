/**
 * ForeshadowingPanel — 增强版伏笔追踪面板
 * 支持状态筛选、角色/章节关联
 */
import { useState, useMemo } from 'react';
import { Plus, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NovelDocumentContent, NovelForeshadowing } from '../types';
import { addForeshadowing, updateForeshadowing, deleteForeshadowing, getChapterById } from '../types';

interface ForeshadowingPanelProps {
  novel: NovelDocumentContent;
  activeChapterId: string | null;
  onNovelChange: (novel: NovelDocumentContent) => void;
}

const STATUS_OPTIONS: { value: NovelForeshadowing['status']; label: string; color: string; dot: string }[] = [
  { value: 'open', label: '未解', color: 'text-amber-600', dot: 'bg-amber-400' },
  { value: 'resolved', label: '已解', color: 'text-green-600', dot: 'bg-green-400' },
  { value: 'abandoned', label: '放弃', color: 'text-gray-500', dot: 'bg-gray-400' },
];

export default function ForeshadowingPanel({ novel, activeChapterId, onNovelChange }: ForeshadowingPanelProps) {
  const [statusFilter, setStatusFilter] = useState<NovelForeshadowing['status'] | 'all'>('all');

  const foreshadowing = novel.settings.foreshadowing;

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return foreshadowing;
    return foreshadowing.filter(f => f.status === statusFilter);
  }, [foreshadowing, statusFilter]);

  const stats = useMemo(() => ({
    open: foreshadowing.filter(f => f.status === 'open').length,
    resolved: foreshadowing.filter(f => f.status === 'resolved').length,
    abandoned: foreshadowing.filter(f => f.status === 'abandoned').length,
    total: foreshadowing.length,
  }), [foreshadowing]);

  const getChapterName = (chId: string) => {
    const ch = getChapterById(novel, chId);
    return ch?.title || '未知章节';
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 顶部统计 + 筛选 */}
      <div className="flex items-center gap-3 px-3 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button key={opt.value}
              className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                statusFilter === opt.value ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setStatusFilter(statusFilter === opt.value ? 'all' : opt.value)}>
              <span className={cn('w-2 h-2 rounded-full', opt.dot)} />
              {opt.label}
              <span className="text-[10px]">({opt.value === 'open' ? stats.open : opt.value === 'resolved' ? stats.resolved : stats.abandoned})</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">共 {stats.total} 条</span>
        <Button variant="outline" size="sm" className="h-6 text-xs gap-1" disabled={!activeChapterId}
          onClick={() => { if (activeChapterId) onNovelChange(addForeshadowing(novel, activeChapterId, '')); }}
          title={!activeChapterId ? '请先在工作台选择一个章节' : '添加伏笔'}>
          <Plus className="h-3 w-3" />添加伏笔
        </Button>
      </div>

      {/* 伏笔列表 */}
      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            <Eye className="h-8 w-8 mx-auto opacity-20 mb-2" />
            <p>{foreshadowing.length === 0 ? '暂无伏笔' : '无匹配结果'}</p>
          </div>
        )}
        {filtered.map(fs => {
          const statusOpt = STATUS_OPTIONS.find(s => s.value === fs.status)!;
          return (
            <div key={fs.id} className="rounded border p-2.5 space-y-1.5 bg-background">
              <div className="flex items-center gap-2">
                <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', statusOpt.dot)} />
                <input className="flex-1 text-sm bg-transparent border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                  value={fs.content} onChange={e => onNovelChange(updateForeshadowing(novel, fs.id, { content: e.target.value }))} placeholder="伏笔内容..." />
                <select className="text-xs bg-background border rounded px-1.5 py-0.5" title="状态"
                  value={fs.status} onChange={e => onNovelChange(updateForeshadowing(novel, fs.id, { status: e.target.value as NovelForeshadowing['status'] }))}>
                  {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <button className="p-1 rounded hover:bg-destructive/10 text-destructive" title="删除"
                  onClick={() => onNovelChange(deleteForeshadowing(novel, fs.id))}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <button className="hover:text-primary hover:underline" onClick={() => { /* Phase 7.4: 跳转到章节 — 通过 window 事件通知父组件 */ window.dispatchEvent(new CustomEvent('novel-jump-to-chapter', { detail: fs.chapterId })); }} title="跳转到章节">
                  埋设于：{getChapterName(fs.chapterId)}
                </button>
                {fs.status === 'resolved' && fs.resolvedChapterId && (
                  <button className="hover:text-primary hover:underline" onClick={() => { window.dispatchEvent(new CustomEvent('novel-jump-to-chapter', { detail: fs.resolvedChapterId })); }} title="跳转到章节">
                    → 解于：{getChapterName(fs.resolvedChapterId)}
                  </button>
                )}
              </div>
              {fs.status === 'resolved' && (
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground">解决章节</label>
                  <select className="text-xs border rounded px-1.5 py-0.5 bg-background" title="解决章节"
                    value={fs.resolvedChapterId || ''} onChange={e => onNovelChange(updateForeshadowing(novel, fs.id, { resolvedChapterId: e.target.value || undefined }))}>
                    <option value="">未指定</option>
                    {novel.volumes.flatMap(v => v.chapters).map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <input className="w-full text-xs text-muted-foreground border rounded px-2 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={fs.note || ''} onChange={e => onNovelChange(updateForeshadowing(novel, fs.id, { note: e.target.value }))} placeholder="备注..." />
            </div>
          );
        })}
      </div>
    </div>
  );
}
