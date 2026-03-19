/**
 * MaterialPanel — 增强版素材库面板
 * 搜索+分类筛选+标签
 */
import { useState, useMemo } from 'react';
import { Plus, Trash2, Lightbulb, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NovelDocumentContent, NovelMaterialCategory } from '../types';
import { addMaterial, updateMaterial, deleteMaterial } from '../types';

interface MaterialPanelProps {
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
}

const CATEGORIES: { key: NovelMaterialCategory; label: string }[] = [
  { key: 'inspiration', label: '灵感' },
  { key: 'scene', label: '场景' },
  { key: 'dialogue', label: '对话' },
  { key: 'plot', label: '情节' },
  { key: 'other', label: '其他' },
];

export default function MaterialPanel({ novel, onNovelChange }: MaterialPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<NovelMaterialCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const materials = novel.settings.materials;

  const filtered = useMemo(() => {
    let list = materials;
    if (categoryFilter !== 'all') list = list.filter(m => m.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q));
    }
    return list;
  }, [materials, categoryFilter, search]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-1 border rounded px-2 py-0.5 bg-background flex-1 max-w-[200px]">
          <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <input className="flex-1 text-xs bg-transparent focus:outline-none" value={search}
            onChange={e => setSearch(e.target.value)} placeholder="搜索素材..." />
        </div>
        <div className="flex items-center gap-1">
          <button className={cn('text-xs px-1.5 py-0.5 rounded', categoryFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => setCategoryFilter('all')}>全部</button>
          {CATEGORIES.map(c => (
            <button key={c.key} className={cn('text-xs px-1.5 py-0.5 rounded', categoryFilter === c.key ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setCategoryFilter(c.key)}>{c.label}</button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{filtered.length}/{materials.length} 条</span>
        <Button variant="outline" size="sm" className="h-6 text-xs gap-1"
          onClick={() => onNovelChange(addMaterial(novel, '新素材', 'inspiration', ''))}>
          <Plus className="h-3 w-3" />添加
        </Button>
      </div>

      {/* 素材列表 */}
      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            <Lightbulb className="h-8 w-8 mx-auto opacity-20 mb-2" />
            <p>{materials.length === 0 ? '暂无素材' : '无匹配结果'}</p>
          </div>
        )}
        {filtered.map(mat => (
          <div key={mat.id} className="rounded border p-2.5 space-y-1.5 bg-background">
            <div className="flex items-center gap-2">
              <input className="flex-1 text-sm border rounded px-2 py-0.5 bg-background font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                value={mat.title} onChange={e => onNovelChange(updateMaterial(novel, mat.id, { title: e.target.value }))} placeholder="标题" />
              <select className="text-xs border rounded px-1.5 py-0.5 bg-background" title="分类"
                value={mat.category} onChange={e => onNovelChange(updateMaterial(novel, mat.id, { category: e.target.value as NovelMaterialCategory }))}>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <button className="p-1 rounded hover:bg-destructive/10 text-destructive" title="删除"
                onClick={() => onNovelChange(deleteMaterial(novel, mat.id))}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <textarea className="w-full h-16 text-xs border rounded p-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              value={mat.content} onChange={e => onNovelChange(updateMaterial(novel, mat.id, { content: e.target.value }))}
              placeholder="素材内容..." />
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
              {mat.chapterId && <span>关联章节</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
