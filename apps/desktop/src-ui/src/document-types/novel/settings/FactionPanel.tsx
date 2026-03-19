/**
 * FactionPanel — 阵营/势力管理（列表+详情双栏）
 * 支持成员管理、首领指定、目标、势力间关系
 */
import { useState, useMemo } from 'react';
import { Plus, Trash2, Shield, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NovelDocumentContent, NovelFaction } from '../types';
import { addFaction, updateFaction, deleteFaction, addFactionMember, removeFactionMember } from '../types';

interface FactionPanelProps {
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
}

const FACTION_TYPES = ['国家', '组织', '家族', '宗派', '军队', '商会', '江湖门派', '其他'];

const LABEL = 'text-xs text-muted-foreground font-medium';
const INPUT = 'w-full text-sm border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring';
const TEXTAREA = 'w-full text-sm border rounded p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring';

export default function FactionPanel({ novel, onNovelChange }: FactionPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const factions = novel.settings.factions;
  const characters = novel.settings.characters;

  const filtered = useMemo(() => {
    if (!search.trim()) return [...factions].sort((a, b) => a.sortOrder - b.sortOrder);
    const q = search.toLowerCase();
    return factions.filter(f => f.name.toLowerCase().includes(q)).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [factions, search]);

  const selected = selectedId ? factions.find(f => f.id === selectedId) : null;

  const members = useMemo(() => {
    if (!selected) return [];
    return characters.filter(c => selected.memberIds.includes(c.id));
  }, [selected, characters]);

  const nonMembers = useMemo(() => {
    if (!selected) return [];
    return characters.filter(c => !selected.memberIds.includes(c.id));
  }, [selected, characters]);

  const handleAdd = () => {
    const updated = addFaction(novel, '新阵营');
    const newF = updated.settings.factions[updated.settings.factions.length - 1];
    onNovelChange(updated);
    setSelectedId(newF.id);
  };

  const handleDelete = (id: string) => {
    onNovelChange(deleteFaction(novel, id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleUpdate = (patch: Partial<NovelFaction>) => {
    if (!selectedId) return;
    onNovelChange(updateFaction(novel, selectedId, patch));
  };

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* ── 左侧列表 ── */}
      <div className="w-[200px] flex-shrink-0 border-r flex flex-col min-h-0">
        <div className="px-2 py-1.5 border-b flex-shrink-0">
          <div className="flex items-center gap-1 border rounded px-2 py-0.5 bg-background">
            <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <input className="flex-1 text-xs bg-transparent focus:outline-none" value={search}
              onChange={e => setSearch(e.target.value)} placeholder="搜索阵营..." />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-1 space-y-0.5">
          {filtered.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">
              <Shield className="h-6 w-6 mx-auto opacity-20 mb-1" />
              暂无阵营
            </div>
          )}
          {filtered.map(faction => (
            <div key={faction.id}
              className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-sm',
                selectedId === faction.id ? 'bg-primary/10 font-medium' : 'hover:bg-accent'
              )}
              onClick={() => setSelectedId(faction.id)}>
              <div className="w-4 h-4 rounded flex items-center justify-center text-white text-[9px] flex-shrink-0"
                style={{ backgroundColor: faction.color || '#6366f1' }}>
                {faction.name.charAt(0)}
              </div>
              <span className="flex-1 truncate">{faction.name || '未命名'}</span>
              <span className="text-[10px] text-muted-foreground">{faction.memberIds.length}</span>
            </div>
          ))}
        </div>
        <div className="p-1.5 border-t flex-shrink-0">
          <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={handleAdd}>
            <Plus className="h-3 w-3" />添加阵营
          </Button>
        </div>
      </div>

      {/* ── 右侧详情 ── */}
      <div className="flex-1 min-w-0 overflow-auto p-3">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: selected.color || '#6366f1' }}>
                {selected.name.charAt(0)}
              </div>
              <input className="text-base font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none flex-1"
                value={selected.name} onChange={e => handleUpdate({ name: e.target.value })} placeholder="阵营名称" />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => handleDelete(selected.id)} title="删除阵营">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={LABEL}>类型</label>
                <select className={INPUT} title="阵营类型" value={selected.type || ''} onChange={e => handleUpdate({ type: e.target.value || undefined })}>
                  <option value="">未分类</option>
                  {FACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>首领</label>
                <select className={INPUT} title="首领" value={selected.leader || ''} onChange={e => handleUpdate({ leader: e.target.value || undefined })}>
                  <option value="">无</option>
                  {members.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>代表色</label>
                <div className="flex items-center gap-1">
                  <input type="color" className="w-6 h-6 rounded cursor-pointer border-0 p-0" title="代表色"
                    value={selected.color || '#6366f1'} onChange={e => handleUpdate({ color: e.target.value })} />
                  <input className={cn(INPUT, 'flex-1')} value={selected.color || ''} onChange={e => handleUpdate({ color: e.target.value })} placeholder="#hex" />
                </div>
              </div>
            </div>

            <div>
              <label className={LABEL}>描述</label>
              <textarea className={`${TEXTAREA} h-20`} value={selected.description} onChange={e => handleUpdate({ description: e.target.value })}
                placeholder="阵营背景、组织结构..." />
            </div>
            <div>
              <label className={LABEL}>目标/宗旨</label>
              <textarea className={`${TEXTAREA} h-16`} value={selected.goal || ''} onChange={e => handleUpdate({ goal: e.target.value })}
                placeholder="核心目标、长期计划..." />
            </div>
            <div>
              <label className={LABEL}>与其他势力的关系</label>
              <textarea className={`${TEXTAREA} h-16`} value={selected.relationships || ''} onChange={e => handleUpdate({ relationships: e.target.value })}
                placeholder="盟友、敌对势力、中立关系..." />
            </div>

            {/* 成员管理 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={LABEL}>成员（{members.length}）</label>
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1"
                  onClick={() => setAddingMember(!addingMember)} disabled={nonMembers.length === 0}>
                  <UserPlus className="h-3 w-3" />{addingMember ? '完成' : '添加成员'}
                </Button>
              </div>
              {addingMember && nonMembers.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2 p-2 bg-muted/30 rounded border border-dashed">
                  {nonMembers.map(c => (
                    <button key={c.id} className="text-xs px-2 py-0.5 rounded-full border hover:bg-accent"
                      onClick={() => onNovelChange(addFactionMember(novel, selected.id, c.id))}>
                      + {c.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {members.map(c => (
                  <div key={c.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-background">
                    <span>{c.name}</span>
                    <button className="hover:text-destructive" onClick={() => onNovelChange(removeFactionMember(novel, selected.id, c.id))} title="移除">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {members.length === 0 && <span className="text-xs text-muted-foreground">暂无成员</span>}
              </div>
            </div>

            <div>
              <label className={LABEL}>标签</label>
              <input className={INPUT} value={selected.tags?.join('、') || ''}
                onChange={e => handleUpdate({ tags: e.target.value.split('、').filter(Boolean) })} placeholder="顿号分隔" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <div className="text-center space-y-2">
              <Shield className="h-10 w-10 mx-auto opacity-20" />
              <p>在左侧选择或创建一个阵营</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
