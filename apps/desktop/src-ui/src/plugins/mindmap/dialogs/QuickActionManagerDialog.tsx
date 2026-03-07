/**
 * 思维导图插件 — 快捷操作管理对话框
 * 树状分类 + 操作项编辑 + 新建/删除/排序/导入导出
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Button, Input, Label, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../_framework/ui';
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  RotateCcw, Download, Upload, Eye, EyeOff, Lock,
  ArrowUp, ArrowDown, FolderPlus, Copy,
} from 'lucide-react';
import type { QuickActionStore, QuickActionCategory, QuickActionItem } from '../quickActionDefs';
import { getDefaultStore, getBuiltinPrompt, genActionId, exportConfig, importConfig } from '../quickActionDefs';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };
const CONTEXT_MODES = [
  { value: 'structure', label: '导图结构' },
  { value: 'content', label: '文档内容' },
  { value: 'full', label: '完整上下文' },
  { value: 'none', label: '无' },
];
const ICON_OPTIONS = [
  'Wand2','Sparkles','Paintbrush','GitBranch','BarChart3','Minimize2','Maximize2',
  'FileOutput','FilePlus2','Star','FileText','Brain','Clock','HelpCircle','Lightbulb',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: QuickActionStore;
  onSave: (store: QuickActionStore) => void;
}

type Sel = { type: 'category' | 'item'; id: string } | null;

export function QuickActionManagerDialog({ open, onOpenChange, store: init, onSave }: Props) {
  const [draft, setDraft] = useState<QuickActionStore>(() => JSON.parse(JSON.stringify(init)));
  const [sel, setSel] = useState<Sel>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(draft.categories.map(c => c.id)));
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = useCallback((v: boolean) => {
    if (v) { setDraft(JSON.parse(JSON.stringify(init))); setSel(null); setExpanded(new Set(init.categories.map(c => c.id))); }
    onOpenChange(v);
  }, [init, onOpenChange]);

  const sortedCats = useMemo(() => [...draft.categories].sort((a, b) => a.order - b.order), [draft.categories]);
  const getItems = useCallback((cid: string) => draft.items.filter(i => i.categoryId === cid && !i.hidden).sort((a, b) => a.order - b.order), [draft.items]);
  const getHidden = useCallback((cid: string) => draft.items.filter(i => i.categoryId === cid && i.hidden), [draft.items]);

  const toggleExp = useCallback((cid: string) => setExpanded(p => { const n = new Set(p); n.has(cid) ? n.delete(cid) : n.add(cid); return n; }), []);

  const addCat = useCallback(() => {
    const o = draft.categories.reduce((m, c) => Math.max(m, c.order), -1);
    const nc: QuickActionCategory = { id: genActionId(), label: '新分类', icon: 'FolderPlus', order: o + 1 };
    setDraft(p => ({ ...p, categories: [...p.categories, nc] }));
    setExpanded(p => new Set([...p, nc.id]));
    setSel({ type: 'category', id: nc.id });
  }, [draft.categories]);

  const delCat = useCallback((cid: string) => {
    const c = draft.categories.find(x => x.id === cid);
    if (!c || c.builtin || draft.items.some(i => i.categoryId === cid)) return;
    setDraft(p => ({ ...p, categories: p.categories.filter(x => x.id !== cid) }));
    if (sel?.id === cid) setSel(null);
  }, [draft, sel]);

  const moveCat = useCallback((cid: string, dir: -1 | 1) => {
    const s = [...draft.categories].sort((a, b) => a.order - b.order);
    const i = s.findIndex(c => c.id === cid);
    const j = i + dir;
    if (j < 0 || j >= s.length) return;
    const t = s[i].order; s[i].order = s[j].order; s[j].order = t;
    setDraft(p => ({ ...p, categories: s }));
  }, [draft.categories]);

  const addItem = useCallback((cid: string) => {
    const o = draft.items.filter(i => i.categoryId === cid).reduce((m, i) => Math.max(m, i.order), -1);
    const ni: QuickActionItem = { id: genActionId(), categoryId: cid, label: '新操作', icon: 'Wand2', prompt: '', contextMode: 'structure', order: o + 1 };
    setDraft(p => ({ ...p, items: [...p.items, ni] }));
    setSel({ type: 'item', id: ni.id });
    setExpanded(p => new Set([...p, cid]));
  }, [draft.items]);

  const delItem = useCallback((iid: string) => {
    const it = draft.items.find(i => i.id === iid);
    if (!it) return;
    if (it.builtin) setDraft(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, hidden: true } : i) }));
    else setDraft(p => ({ ...p, items: p.items.filter(i => i.id !== iid) }));
    if (sel?.id === iid) setSel(null);
  }, [draft.items, sel]);

  const restoreItem = useCallback((iid: string) => setDraft(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, hidden: false } : i) })), []);

  const dupItem = useCallback((iid: string) => {
    const it = draft.items.find(i => i.id === iid);
    if (!it) return;
    const ni = { ...it, id: genActionId(), label: it.label + ' (副本)', builtin: false, order: it.order + 0.5 };
    setDraft(p => ({ ...p, items: [...p.items, ni] }));
    setSel({ type: 'item', id: ni.id });
  }, [draft.items]);

  const moveItem = useCallback((iid: string, dir: -1 | 1) => {
    const it = draft.items.find(i => i.id === iid);
    if (!it) return;
    const sibs = draft.items.filter(i => i.categoryId === it.categoryId && !i.hidden).sort((a, b) => a.order - b.order);
    const i = sibs.findIndex(x => x.id === iid);
    const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    const t = sibs[i].order; sibs[i].order = sibs[j].order; sibs[j].order = t;
    setDraft(p => ({ ...p, items: [...p.items] }));
  }, [draft.items]);

  const updItem = useCallback((iid: string, patch: Partial<QuickActionItem>) => setDraft(p => ({ ...p, items: p.items.map(i => i.id === iid ? { ...i, ...patch } : i) })), []);
  const updCat = useCallback((cid: string, patch: Partial<QuickActionCategory>) => setDraft(p => ({ ...p, categories: p.categories.map(c => c.id === cid ? { ...c, ...patch } : c) })), []);

  const handleResetAll = useCallback(() => { setDraft(getDefaultStore()); setSel(null); setConfirmReset(false); }, []);
  const handleExport = useCallback(() => {
    const b = new Blob([exportConfig(draft)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'mindmap-quick-actions.json'; a.click(); URL.revokeObjectURL(a.href);
  }, [draft]);
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const res = importConfig(r.result as string); if (res) { setDraft(res); setSel(null); } };
    r.readAsText(f); if (fileRef.current) fileRef.current.value = '';
  }, []);
  const handleSave = useCallback(() => {
    const cats = [...draft.categories].sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }));
    const items = [...draft.items];
    for (const cat of cats) { draft.items.filter(i => i.categoryId === cat.id).sort((a, b) => a.order - b.order).forEach((it, idx) => { it.order = idx; }); }
    onSave({ ...draft, categories: cats, items }); onOpenChange(false);
  }, [draft, onSave, onOpenChange]);

  const sItem = sel?.type === 'item' ? draft.items.find(i => i.id === sel.id) : null;
  const sCat = sel?.type === 'category' ? draft.categories.find(c => c.id === sel.id) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[80vh] flex flex-col p-0" style={DIALOG_STYLE}>
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle>快捷操作管理</DialogTitle>
          <DialogDescription>管理思维导图 AI 助手的快捷操作：新建、编辑、排序、删除</DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 min-h-0">
          {/* 左侧树 */}
          <div className="w-[220px] border-r flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {sortedCats.map(cat => {
                const isExp = expanded.has(cat.id);
                const items = getItems(cat.id);
                const hidden = getHidden(cat.id);
                const isSel = sel?.type === 'category' && sel.id === cat.id;
                return (
                  <div key={cat.id}>
                    <div className={`flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer text-xs group transition-colors ${isSel ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'hover:bg-accent'}`}
                      onClick={() => { toggleExp(cat.id); setSel({ type: 'category', id: cat.id }); }}>
                      {isExp ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                      <span className="flex-1 truncate font-medium">{cat.label}</span>
                      {cat.builtin && <Lock className="h-2.5 w-2.5 text-muted-foreground opacity-50" />}
                      <span className="text-[10px] text-muted-foreground">{items.length}</span>
                      <div className="hidden group-hover:flex items-center"><button className="p-0.5 rounded hover:bg-accent" title="新建操作" onClick={e => { e.stopPropagation(); addItem(cat.id); }}><Plus className="h-3 w-3" /></button></div>
                    </div>
                    {isExp && (
                      <div className="ml-3 space-y-0.5">
                        {items.map(it => (
                          <div key={it.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer text-xs group transition-colors ${sel?.type === 'item' && sel.id === it.id ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'hover:bg-accent'}`}
                            onClick={() => setSel({ type: 'item', id: it.id })}>
                            <span className="flex-1 truncate">{it.label}</span>
                            {it.builtin && <Lock className="h-2.5 w-2.5 text-muted-foreground opacity-40" />}
                            <div className="hidden group-hover:flex items-center gap-0.5">
                              <button className="p-0.5 rounded hover:bg-accent" title="上移" onClick={e => { e.stopPropagation(); moveItem(it.id, -1); }}><ArrowUp className="h-2.5 w-2.5" /></button>
                              <button className="p-0.5 rounded hover:bg-accent" title="下移" onClick={e => { e.stopPropagation(); moveItem(it.id, 1); }}><ArrowDown className="h-2.5 w-2.5" /></button>
                            </div>
                          </div>
                        ))}
                        {hidden.length > 0 && (
                          <div className="pt-1 border-t border-dashed">
                            <span className="text-[10px] text-muted-foreground px-1.5">已隐藏 ({hidden.length})</span>
                            {hidden.map(it => (
                              <div key={it.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground opacity-60 group">
                                <EyeOff className="h-2.5 w-2.5" /><span className="flex-1 truncate">{it.label}</span>
                                <button className="hidden group-hover:block p-0.5 rounded hover:bg-accent" title="恢复" onClick={() => restoreItem(it.id)}><Eye className="h-2.5 w-2.5" /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground w-full" onClick={() => addItem(cat.id)}><Plus className="h-3 w-3" />新建操作</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <button className="flex items-center gap-1 px-1.5 py-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground w-full mt-1" onClick={addCat}><FolderPlus className="h-3 w-3" />新建分类</button>
            </div>
          </div>
          {/* 右侧编辑 */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {!sel && <div className="flex items-center justify-center h-full text-sm text-muted-foreground">← 选择一个分类或操作项进行编辑</div>}
            {sCat && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">编辑分类{sCat.builtin ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"><Lock className="h-2.5 w-2.5 inline mr-0.5" />内置</span> : null}</h3>
                <div><Label className="text-xs">分类名称</Label><Input className="h-8 text-xs mt-1" value={sCat.label} onChange={e => updCat(sCat.id, { label: e.target.value })} /></div>
                <div><Label className="text-xs">图标</Label>
                  <Select value={sCat.icon} onValueChange={v => updCat(sCat.id, { icon: v })}><SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger><SelectContent>{ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic} className="text-xs">{ic}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => moveCat(sCat.id, -1)}><ArrowUp className="h-3 w-3" />上移</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => moveCat(sCat.id, 1)}><ArrowDown className="h-3 w-3" />下移</Button>
                  <div className="flex-1" />
                  {!sCat.builtin && !draft.items.some(i => i.categoryId === sCat.id) && <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive" onClick={() => delCat(sCat.id)}><Trash2 className="h-3 w-3" />删除</Button>}
                </div>
              </div>
            )}
            {sItem && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">编辑操作{sItem.builtin ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"><Lock className="h-2.5 w-2.5 inline mr-0.5" />内置</span> : null}</h3>
                <div><Label className="text-xs">操作名称</Label><Input className="h-8 text-xs mt-1" value={sItem.label} onChange={e => updItem(sItem.id, { label: e.target.value })} /></div>
                <div><Label className="text-xs">图标</Label>
                  <Select value={sItem.icon} onValueChange={v => updItem(sItem.id, { icon: v })}><SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger><SelectContent>{ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic} className="text-xs">{ic}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label className="text-xs">上下文模式</Label>
                  <Select value={sItem.contextMode || 'none'} onValueChange={v => updItem(sItem.id, { contextMode: v as QuickActionItem['contextMode'] })}><SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger><SelectContent>{CONTEXT_MODES.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><Label className="text-xs">提示词</Label>
                  <Textarea className="text-xs mt-1 min-h-[100px] resize-y" value={sItem.prompt} onChange={e => updItem(sItem.id, { prompt: e.target.value })} placeholder="输入 AI 提示词..." />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => moveItem(sItem.id, -1)}><ArrowUp className="h-3 w-3" />上移</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => moveItem(sItem.id, 1)}><ArrowDown className="h-3 w-3" />下移</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => dupItem(sItem.id)}><Copy className="h-3 w-3" />复制</Button>
                  {sItem.builtin && <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { const dp = getBuiltinPrompt(sItem.id); if (dp !== undefined) updItem(sItem.id, { prompt: dp }); }}><RotateCcw className="h-3 w-3" />恢复默认</Button>}
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive" onClick={() => delItem(sItem.id)}><Trash2 className="h-3 w-3" />{sItem.builtin ? '隐藏' : '删除'}</Button>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* 底部工具栏 */}
        <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setConfirmReset(true)}><RotateCcw className="h-3 w-3" />重置全部</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}><Download className="h-3 w-3" />导出</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => fileRef.current?.click()}><Upload className="h-3 w-3" />导入</Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} title="导入配置" />
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>取消</Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>保存</Button>
        </div>
      </DialogContent>
      {/* 重置确认 */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-sm" style={DIALOG_STYLE}>
          <DialogHeader><DialogTitle>确认重置</DialogTitle><DialogDescription>这将恢复所有快捷操作为默认设置，自定义内容将丢失。</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>取消</Button>
            <Button variant="destructive" size="sm" onClick={handleResetAll}>确认重置</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
