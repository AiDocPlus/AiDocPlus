/**
 * TimelinePanel — 时间线面板
 * 垂直时间线布局，事件卡片，支持角色/章节关联
 */
import { useState, useMemo } from 'react';
import { Plus, Trash2, Calendar, Clock, Star, Circle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NovelDocumentContent, NovelTimelineEvent, NovelTimelineImportance } from '../types';
import { addTimelineEvent, updateTimelineEvent, deleteTimelineEvent } from '../types';

interface TimelinePanelProps {
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
}

const IMPORTANCE_OPTIONS: { value: NovelTimelineImportance; label: string; icon: typeof Star; color: string; lineColor: string }[] = [
  { value: 'turning-point', label: '转折点', icon: Zap, color: 'text-red-500', lineColor: 'border-red-400' },
  { value: 'major', label: '重要', icon: Star, color: 'text-amber-500', lineColor: 'border-amber-400' },
  { value: 'minor', label: '普通', icon: Circle, color: 'text-gray-400', lineColor: 'border-gray-300' },
];

const INPUT = 'w-full text-sm border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring';
const TEXTAREA = 'w-full text-sm border rounded p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring';

export default function TimelinePanel({ novel, onNovelChange }: TimelinePanelProps) {
  const [importanceFilter, setImportanceFilter] = useState<NovelTimelineImportance | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const timeline = novel.settings.timeline;
  const characters = novel.settings.characters;

  const sorted = useMemo(() => {
    let list = [...timeline].sort((a, b) => a.sortOrder - b.sortOrder);
    if (importanceFilter !== 'all') list = list.filter(e => e.importance === importanceFilter);
    return list;
  }, [timeline, importanceFilter]);

  const allChapters = useMemo(() => {
    return novel.volumes.flatMap(v => v.chapters.map(ch => ({ id: ch.id, title: ch.title, volTitle: v.title })));
  }, [novel.volumes]);

  const handleAdd = () => {
    const updated = addTimelineEvent(novel, '新事件');
    onNovelChange(updated);
    const newEvent = updated.settings.timeline[updated.settings.timeline.length - 1];
    setExpandedId(newEvent.id);
  };

  const handleUpdate = (eventId: string, patch: Partial<NovelTimelineEvent>) => {
    onNovelChange(updateTimelineEvent(novel, eventId, patch));
  };

  const handleDelete = (eventId: string) => {
    onNovelChange(deleteTimelineEvent(novel, eventId));
    if (expandedId === eventId) setExpandedId(null);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-1">
          {IMPORTANCE_OPTIONS.map(opt => (
            <button key={opt.value}
              className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                importanceFilter === opt.value ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setImportanceFilter(importanceFilter === opt.value ? 'all' : opt.value)}>
              <opt.icon className={cn('h-3 w-3', opt.color)} />
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{sorted.length}/{timeline.length} 个事件</span>
        <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={handleAdd}>
          <Plus className="h-3 w-3" />添加事件
        </Button>
      </div>

      {/* 时间线 */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {sorted.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            <Calendar className="h-8 w-8 mx-auto opacity-20 mb-2" />
            <p>暂无时间线事件</p>
          </div>
        )}

        <div className="relative">
          {/* 左侧竖线 */}
          {sorted.length > 0 && (
            <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
          )}

          {sorted.map((event) => {
            const imp = IMPORTANCE_OPTIONS.find(o => o.value === event.importance) || IMPORTANCE_OPTIONS[2];
            const ImpIcon = imp.icon;
            const isExpanded = expandedId === event.id;

            return (
              <div key={event.id} className="relative pl-10 pb-4">
                {/* 时间线节点 */}
                <div className={cn('absolute left-1.5 w-3.5 h-3.5 rounded-full border-2 bg-card flex items-center justify-center', imp.lineColor)}
                  style={{ top: '6px' }}>
                  <ImpIcon className={cn('h-2 w-2', imp.color)} />
                </div>

                {/* 事件卡片 */}
                <div className={cn('rounded border p-2.5 bg-background cursor-pointer transition-colors', isExpanded && 'ring-1 ring-primary/30')}
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}>
                  <div className="flex items-center gap-2">
                    {event.date && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />{event.date}
                      </span>
                    )}
                    <input className="flex-1 text-sm font-medium bg-transparent focus:outline-none"
                      value={event.title} onClick={e => e.stopPropagation()}
                      onChange={e => handleUpdate(event.id, { title: e.target.value })} placeholder="事件标题" />
                    <select className="text-[10px] border rounded px-1 py-0.5 bg-background" title="重要度"
                      value={event.importance} onClick={e => e.stopPropagation()}
                      onChange={e => handleUpdate(event.id, { importance: e.target.value as NovelTimelineImportance })}>
                      {IMPORTANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button className="p-1 rounded hover:bg-destructive/10 text-destructive flex-shrink-0" title="删除"
                      onClick={e => { e.stopPropagation(); handleDelete(event.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {/* 关联角色标签 */}
                  {event.characterIds && event.characterIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {event.characterIds.map(cId => {
                        const ch = characters.find(c => c.id === cId);
                        return ch ? (
                          <span key={cId} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted">{ch.name}</span>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="mt-2 space-y-2 border-t pt-2" onClick={e => e.stopPropagation()}>
                      <div>
                        <label className="text-xs text-muted-foreground">故事内时间</label>
                        <input className={INPUT} value={event.date || ''} onChange={e => handleUpdate(event.id, { date: e.target.value })}
                          placeholder="如：第三纪元2941年春" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">描述</label>
                        <textarea className={`${TEXTAREA} h-16`} value={event.description || ''} onChange={e => handleUpdate(event.id, { description: e.target.value })}
                          placeholder="事件详情..." />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">关联角色</label>
                        <select className={INPUT} title="添加关联角色" value="" onChange={e => {
                          if (!e.target.value) return;
                          const ids = [...(event.characterIds || []), e.target.value];
                          handleUpdate(event.id, { characterIds: [...new Set(ids)] });
                        }}>
                          <option value="">+ 添加角色</option>
                          {characters.filter(c => !event.characterIds?.includes(c.id)).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {event.characterIds && event.characterIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {event.characterIds.map(cId => {
                              const ch = characters.find(c => c.id === cId);
                              return ch ? (
                                <span key={cId} className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-muted">
                                  {ch.name}
                                  <button className="hover:text-destructive" onClick={() => {
                                    handleUpdate(event.id, { characterIds: event.characterIds!.filter(id => id !== cId) });
                                  }}>&times;</button>
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">关联章节</label>
                        <select className={INPUT} title="添加关联章节" value="" onChange={e => {
                          if (!e.target.value) return;
                          const ids = [...(event.chapterIds || []), e.target.value];
                          handleUpdate(event.id, { chapterIds: [...new Set(ids)] });
                        }}>
                          <option value="">+ 添加章节</option>
                          {allChapters.filter(c => !event.chapterIds?.includes(c.id)).map(c => (
                            <option key={c.id} value={c.id}>{c.volTitle} / {c.title}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">标签</label>
                        <input className={INPUT} value={event.tags?.join('、') || ''}
                          onChange={e => handleUpdate(event.id, { tags: e.target.value.split('、').filter(Boolean) })} placeholder="顿号分隔" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
