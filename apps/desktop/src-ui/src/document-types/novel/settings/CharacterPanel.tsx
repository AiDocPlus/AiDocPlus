/**
 * CharacterPanel — 人物管理面板（列表+详情双栏）
 * 左侧：搜索+筛选+角色卡片列表
 * 右侧：选中角色的多维度详情表单
 */
import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, User, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NovelDocumentContent, NovelCharacter } from '../types';
import { addCharacter, updateCharacter, deleteCharacter } from '../types';
import { scanCharacterAppearances } from '../novelAnalysis';

interface CharacterPanelProps {
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
}

const ROLE_OPTIONS: { value: NovelCharacter['role']; label: string; color: string }[] = [
  { value: 'protagonist', label: '主角', color: 'bg-amber-500' },
  { value: 'antagonist', label: '反派', color: 'bg-red-500' },
  { value: 'supporting', label: '配角', color: 'bg-blue-500' },
  { value: 'minor', label: '龙套', color: 'bg-gray-400' },
];

const LABEL = 'text-xs text-muted-foreground font-medium';
const INPUT = 'w-full text-sm border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring';
const TEXTAREA = 'w-full text-sm border rounded p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring';

export default function CharacterPanel({ novel, onNovelChange }: CharacterPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<NovelCharacter['role'] | 'all'>('all');

  const characters = novel.settings.characters;
  const factions = novel.settings.factions;

  const filtered = useMemo(() => {
    let list = characters;
    if (roleFilter !== 'all') list = list.filter(c => c.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.aliases?.some(a => a.toLowerCase().includes(q)) ||
        c.description.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [characters, search, roleFilter]);

  const selected = selectedId ? characters.find(c => c.id === selectedId) : null;

  const handleAdd = () => {
    const updated = addCharacter(novel, '新角色');
    const newChar = updated.settings.characters[updated.settings.characters.length - 1];
    onNovelChange(updated);
    setSelectedId(newChar.id);
  };

  const handleDelete = (id: string) => {
    onNovelChange(deleteCharacter(novel, id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleUpdate = (patch: Partial<NovelCharacter>) => {
    if (!selectedId) return;
    onNovelChange(updateCharacter(novel, selectedId, patch));
  };

  const roleInfo = ROLE_OPTIONS.find(r => r.value === selected?.role);

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* ── 左侧：角色列表 ── */}
      <div className="w-[220px] flex-shrink-0 border-r flex flex-col min-h-0">
        {/* 搜索 + 筛选 */}
        <div className="px-2 py-1.5 border-b space-y-1 flex-shrink-0">
          <div className="flex items-center gap-1 border rounded px-2 py-0.5 bg-background">
            <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <input className="flex-1 text-xs bg-transparent focus:outline-none" value={search}
              onChange={e => setSearch(e.target.value)} placeholder="搜索角色..." />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button className={cn('text-[10px] px-1.5 py-0.5 rounded', roleFilter === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setRoleFilter('all')}>全部</button>
            {ROLE_OPTIONS.map(r => (
              <button key={r.value} className={cn('text-[10px] px-1.5 py-0.5 rounded', roleFilter === r.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
                onClick={() => setRoleFilter(r.value)}>{r.label}</button>
            ))}
          </div>
        </div>

        {/* 角色列表 */}
        <div className="flex-1 overflow-auto p-1 space-y-0.5">
          {filtered.map(char => {
            const role = ROLE_OPTIONS.find(r => r.value === char.role);
            return (
              <div key={char.id}
                className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-sm',
                  selectedId === char.id ? 'bg-primary/10 font-medium' : 'hover:bg-accent'
                )}
                onClick={() => setSelectedId(char.id)}>
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] flex-shrink-0', role?.color || 'bg-gray-400')}
                  style={char.color ? { backgroundColor: char.color } : undefined}>
                  {char.name.charAt(0)}
                </div>
                <span className="flex-1 truncate">{char.name || '未命名'}</span>
                <span className="text-[10px] text-muted-foreground">{role?.label}</span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">
              <User className="h-6 w-6 mx-auto opacity-20 mb-1" />
              {characters.length === 0 ? '暂无角色' : '无匹配结果'}
            </div>
          )}
        </div>

        {/* 添加按钮 */}
        <div className="p-1.5 border-t flex-shrink-0">
          <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={handleAdd}>
            <Plus className="h-3 w-3" />添加角色
          </Button>
        </div>
        <div className="px-2 py-1 text-[10px] text-muted-foreground border-t flex-shrink-0">
          共 {characters.length} 个角色
        </div>
      </div>

      {/* ── 右侧：角色详情 ── */}
      <div className="flex-1 min-w-0 overflow-auto p-3">
        {selected ? (
          <div className="space-y-3">
            {/* 标题栏 */}
            <div className="flex items-center gap-2">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium', roleInfo?.color || 'bg-gray-400')}
                style={selected.color ? { backgroundColor: selected.color } : undefined}>
                {selected.name.charAt(0)}
              </div>
              <div className="flex-1">
                <input className="text-base font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-full"
                  value={selected.name} onChange={e => handleUpdate({ name: e.target.value })} placeholder="角色名" />
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => handleDelete(selected.id)} title="删除角色">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* 基本信息 */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className={LABEL}>别名</label>
                <input className={INPUT} value={selected.aliases?.join('、') || ''}
                  onChange={e => handleUpdate({ aliases: e.target.value.split('、').filter(Boolean) })} placeholder="顿号分隔" />
              </div>
              <div>
                <label className={LABEL}>性别</label>
                <input className={INPUT} value={selected.gender || ''} onChange={e => handleUpdate({ gender: e.target.value })} placeholder="男/女/其他" />
              </div>
              <div>
                <label className={LABEL}>年龄</label>
                <input className={INPUT} value={selected.age || ''} onChange={e => handleUpdate({ age: e.target.value })} placeholder="25岁/中年..." />
              </div>
              <div>
                <label className={LABEL}>代表色</label>
                <div className="flex items-center gap-1 mt-0.5">
                  <input type="color" className="w-6 h-6 rounded cursor-pointer border-0 p-0" value={selected.color || '#6366f1'}
                    onChange={e => handleUpdate({ color: e.target.value })} />
                  <input className={cn(INPUT, 'flex-1')} value={selected.color || ''} onChange={e => handleUpdate({ color: e.target.value })} placeholder="#hex" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>角色类型</label>
                <select className={INPUT} value={selected.role} onChange={e => handleUpdate({ role: e.target.value as NovelCharacter['role'] })}>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>所属阵营</label>
                <select className={INPUT} value={selected.factionId || ''} onChange={e => handleUpdate({ factionId: e.target.value || undefined })}>
                  <option value="">无</option>
                  {factions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>

            {/* 详细描写 */}
            <div>
              <label className={LABEL}>外貌</label>
              <textarea className={`${TEXTAREA} h-16`} value={selected.appearance || ''} onChange={e => handleUpdate({ appearance: e.target.value })}
                placeholder="身高、体型、面貌特征、穿着习惯..." />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>性格</label>
                <textarea className={`${TEXTAREA} h-16`} value={selected.personality || ''} onChange={e => handleUpdate({ personality: e.target.value })}
                  placeholder="性格特征、习惯、口头禅..." />
              </div>
              <div>
                <label className={LABEL}>对话风格</label>
                <textarea className={`${TEXTAREA} h-16`} value={selected.dialogueStyle || ''} onChange={e => handleUpdate({ dialogueStyle: e.target.value })}
                  placeholder="冷峻简短/文绉绉/市井粗犷..." />
              </div>
            </div>

            <div>
              <label className={LABEL}>背景故事</label>
              <textarea className={`${TEXTAREA} h-20`} value={selected.background || ''} onChange={e => handleUpdate({ background: e.target.value })}
                placeholder="出身、经历、关键事件..." />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>动机/目标</label>
                <textarea className={`${TEXTAREA} h-16`} value={selected.motivation || ''} onChange={e => handleUpdate({ motivation: e.target.value })}
                  placeholder="核心驱动力、追求的目标..." />
              </div>
              <div>
                <label className={LABEL}>人物弧光</label>
                <textarea className={`${TEXTAREA} h-16`} value={selected.arc || ''} onChange={e => handleUpdate({ arc: e.target.value })}
                  placeholder="成长轨迹、转变节点..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>优势/能力</label>
                <textarea className={`${TEXTAREA} h-14`} value={selected.strengths || ''} onChange={e => handleUpdate({ strengths: e.target.value })}
                  placeholder="技能、天赋、社会资源..." />
              </div>
              <div>
                <label className={LABEL}>弱点/缺陷</label>
                <textarea className={`${TEXTAREA} h-14`} value={selected.weaknesses || ''} onChange={e => handleUpdate({ weaknesses: e.target.value })}
                  placeholder="性格缺陷、致命弱点..." />
              </div>
            </div>

            <div>
              <label className={LABEL}>总体描述</label>
              <textarea className={`${TEXTAREA} h-16`} value={selected.description} onChange={e => handleUpdate({ description: e.target.value })}
                placeholder="综合描述..." />
            </div>

            {/* 标签 */}
            <div>
              <label className={LABEL}>标签</label>
              <input className={INPUT} value={selected.tags?.join('、') || ''}
                onChange={e => handleUpdate({ tags: e.target.value.split('、').filter(Boolean) })} placeholder="顿号分隔，如：剑客、复仇者" />
            </div>

            {/* Phase 7: 出场章节 */}
            <div>
              <label className={LABEL}>出场章节</label>
              {(() => {
                const appearances = scanCharacterAppearances(novel);
                const charApp = appearances.find(a => a.entityId === selected.id);
                if (!charApp || charApp.chapters.length === 0) return <div className="text-xs text-muted-foreground py-1">暂无出场记录</div>;
                return (
                  <div className="space-y-0.5 mt-1 max-h-[120px] overflow-y-auto">
                    {charApp.chapters.map(ch => (
                      <div key={ch.chapterId} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate">{ch.volumeTitle}/{ch.chapterTitle}</span>
                        <span className="ml-auto flex-shrink-0 tabular-nums">{ch.count}次</span>
                      </div>
                    ))}
                    <div className="text-[10px] text-muted-foreground/60 pt-0.5">共 {charApp.totalCount} 次出场</div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <div className="text-center space-y-2">
              <User className="h-10 w-10 mx-auto opacity-20" />
              <p>在左侧选择或创建一个角色</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
