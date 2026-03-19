/**
 * LocationPanel — 地点管理面板（列表+详情双栏）
 * 支持层级（parentId）、类型、氛围、故事意义
 */
import { useState, useMemo } from 'react';
import { Plus, Trash2, MapPin, Search, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NovelDocumentContent, NovelLocation } from '../types';
import { addLocation, updateLocation, deleteLocation } from '../types';
import { scanLocationAppearances } from '../novelAnalysis';

interface LocationPanelProps {
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
}

const LOCATION_TYPES = ['城市', '村庄', '建筑', '自然', '战场', '秘境', '虚空', '其他'];

const LABEL = 'text-xs text-muted-foreground font-medium';
const INPUT = 'w-full text-sm border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring';
const TEXTAREA = 'w-full text-sm border rounded p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring';

export default function LocationPanel({ novel, onNovelChange }: LocationPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const locations = novel.settings.locations;

  const filtered = useMemo(() => {
    if (!search.trim()) return [...locations].sort((a, b) => a.sortOrder - b.sortOrder);
    const q = search.toLowerCase();
    return locations.filter(l => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [locations, search]);

  const selected = selectedId ? locations.find(l => l.id === selectedId) : null;

  const handleAdd = () => {
    const updated = addLocation(novel, '新地点');
    const newLoc = updated.settings.locations[updated.settings.locations.length - 1];
    onNovelChange(updated);
    setSelectedId(newLoc.id);
  };

  const handleDelete = (id: string) => {
    onNovelChange(deleteLocation(novel, id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleUpdate = (patch: Partial<NovelLocation>) => {
    if (!selectedId) return;
    onNovelChange(updateLocation(novel, selectedId, patch));
  };

  // 构建层级树
  const getChildren = (parentId?: string) => {
    return filtered.filter(l => (l.parentId || undefined) === parentId);
  };

  const renderTree = (parentId?: string, depth = 0): React.ReactNode => {
    const children = getChildren(parentId);
    return children.map(loc => (
      <div key={loc.id}>
        <div
          className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-sm',
            selectedId === loc.id ? 'bg-primary/10 font-medium' : 'hover:bg-accent'
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => setSelectedId(loc.id)}>
          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 truncate">{loc.name || '未命名'}</span>
          {loc.type && <span className="text-[10px] text-muted-foreground">{loc.type}</span>}
        </div>
        {renderTree(loc.id, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* ── 左侧列表 ── */}
      <div className="w-[200px] flex-shrink-0 border-r flex flex-col min-h-0">
        <div className="px-2 py-1.5 border-b flex-shrink-0">
          <div className="flex items-center gap-1 border rounded px-2 py-0.5 bg-background">
            <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <input className="flex-1 text-xs bg-transparent focus:outline-none" value={search}
              onChange={e => setSearch(e.target.value)} placeholder="搜索地点..." />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-1 space-y-0.5">
          {filtered.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">
              <MapPin className="h-6 w-6 mx-auto opacity-20 mb-1" />
              暂无地点
            </div>
          )}
          {search ? filtered.map(loc => (
            <div key={loc.id}
              className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-sm',
                selectedId === loc.id ? 'bg-primary/10 font-medium' : 'hover:bg-accent'
              )}
              onClick={() => setSelectedId(loc.id)}>
              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 truncate">{loc.name}</span>
            </div>
          )) : renderTree(undefined)}
        </div>
        <div className="p-1.5 border-t flex-shrink-0">
          <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={handleAdd}>
            <Plus className="h-3 w-3" />添加地点
          </Button>
        </div>
        <div className="px-2 py-1 text-[10px] text-muted-foreground border-t flex-shrink-0">
          共 {locations.length} 个地点
        </div>
      </div>

      {/* ── 右侧详情 ── */}
      <div className="flex-1 min-w-0 overflow-auto p-3">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <input className="text-base font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none flex-1"
                value={selected.name} onChange={e => handleUpdate({ name: e.target.value })} placeholder="地点名称" />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => handleDelete(selected.id)} title="删除地点">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>类型</label>
                <select className={INPUT} title="地点类型" value={selected.type || ''} onChange={e => handleUpdate({ type: e.target.value || undefined })}>
                  <option value="">未分类</option>
                  {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>上级地点</label>
                <select className={INPUT} title="上级地点" value={selected.parentId || ''} onChange={e => handleUpdate({ parentId: e.target.value || undefined })}>
                  <option value="">无（顶级）</option>
                  {locations.filter(l => l.id !== selected.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL}>环境描述</label>
              <textarea className={`${TEXTAREA} h-24`} value={selected.description} onChange={e => handleUpdate({ description: e.target.value })}
                placeholder="地形、建筑、自然景观..." />
            </div>
            <div>
              <label className={LABEL}>氛围描写</label>
              <textarea className={`${TEXTAREA} h-20`} value={selected.atmosphere || ''} onChange={e => handleUpdate({ atmosphere: e.target.value })}
                placeholder="声音、气味、光线、温度..." />
            </div>
            <div>
              <label className={LABEL}>故事意义</label>
              <textarea className={`${TEXTAREA} h-16`} value={selected.significance || ''} onChange={e => handleUpdate({ significance: e.target.value })}
                placeholder="在故事中的作用、象征意义..." />
            </div>
            <div>
              <label className={LABEL}>标签</label>
              <input className={INPUT} value={selected.tags?.join('、') || ''}
                onChange={e => handleUpdate({ tags: e.target.value.split('、').filter(Boolean) })} placeholder="顿号分隔" />
            </div>

            {/* Phase 7: 相关章节 */}
            <div>
              <label className={LABEL}>相关章节</label>
              {(() => {
                const appearances = scanLocationAppearances(novel);
                const locApp = appearances.find(a => a.entityId === selected.id);
                if (!locApp || locApp.chapters.length === 0) return <div className="text-xs text-muted-foreground py-1">暂无出现记录</div>;
                return (
                  <div className="space-y-0.5 mt-1 max-h-[100px] overflow-y-auto">
                    {locApp.chapters.map(ch => (
                      <div key={ch.chapterId} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate">{ch.volumeTitle}/{ch.chapterTitle}</span>
                        <span className="ml-auto flex-shrink-0 tabular-nums">{ch.count}次</span>
                      </div>
                    ))}
                    <div className="text-[10px] text-muted-foreground/60 pt-0.5">共 {locApp.totalCount} 次出现</div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <div className="text-center space-y-2">
              <MapPin className="h-10 w-10 mx-auto opacity-20" />
              <p>在左侧选择或创建一个地点</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
