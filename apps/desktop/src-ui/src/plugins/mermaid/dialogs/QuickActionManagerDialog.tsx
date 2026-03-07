/**
 * Mermaid 插件 — 快捷按钮管理对话框
 * 树状分类 + 操作项编辑 + 新建/删除/排序/导入导出
 * 上下文模式适配为 code/structure/full/none
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
import type {
  QuickActionStore, QuickActionCategory, QuickActionItem,
} from '../quickActionDefs';
import {
  getDefaultStore, getBuiltinPrompt, getBuiltinCategoryLabel,
  genActionId, exportConfig, importConfig,
} from '../quickActionDefs';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

// Mermaid 插件的上下文模式
const CONTEXT_MODES = [
  { value: 'code', label: '图表代码' },
  { value: 'structure', label: '结构分析' },
  { value: 'full', label: '完整上下文' },
  { value: 'none', label: '无' },
];

// 常用 icon 列表（供用户选择）
const ICON_OPTIONS = [
  'Wand2', 'Sparkles', 'Paintbrush', 'ShieldCheck', 'GitBranch',
  'BarChart3', 'ArrowRightLeft', 'Minimize2', 'Maximize2', 'FileOutput',
  'FilePlus2', 'LayoutTemplate', 'Tag', 'Star', 'FileText',
  'Database', 'PieChart', 'Brain', 'Clock', 'Route',
  'Server', 'Workflow', 'Map', 'Rocket', 'CalendarDays',
  'MessageSquare', 'HelpCircle', 'Lightbulb', 'Wrench', 'Highlighter',
  'Palette', 'Shapes', 'StickyNote', 'Link', 'FileImage',
];

type SelectionType = 'category' | 'item' | null;
interface Selection {
  type: SelectionType;
  id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: QuickActionStore;
  onSave: (store: QuickActionStore) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function QuickActionManagerDialog({ open, onOpenChange, store: initialStore, onSave, t }: Props) {
  const [draft, setDraft] = useState<QuickActionStore>(() => JSON.parse(JSON.stringify(initialStore)));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(() => new Set(draft.categories.map(c => c.id)));
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [renamingCatId, setRenamingCatId] = useState<string | null>(null);
  const [renameCatValue, setRenameCatValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = useCallback((v: boolean) => {
    if (v) {
      setDraft(JSON.parse(JSON.stringify(initialStore)));
      setSelection(null);
      setExpandedCats(new Set(initialStore.categories.map(c => c.id)));
    }
    onOpenChange(v);
  }, [initialStore, onOpenChange]);

  // ── 分类操作 ──
  const sortedCategories = useMemo(() =>
    [...draft.categories].sort((a, b) => a.order - b.order),
  [draft.categories]);

  const getItemsForCategory = useCallback((catId: string) =>
    draft.items.filter(i => i.categoryId === catId && !i.hidden).sort((a, b) => a.order - b.order),
  [draft.items]);

  const getHiddenItemsForCategory = useCallback((catId: string) =>
    draft.items.filter(i => i.categoryId === catId && i.hidden).sort((a, b) => a.order - b.order),
  [draft.items]);

  const toggleExpand = useCallback((catId: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  }, []);

  const addCategory = useCallback(() => {
    const maxOrder = draft.categories.reduce((m, c) => Math.max(m, c.order), -1);
    const newCat: QuickActionCategory = {
      id: genActionId(),
      label: t('qam.newCategory', { defaultValue: '新分类' }),
      icon: 'FolderPlus',
      order: maxOrder + 1,
    };
    setDraft(prev => ({ ...prev, categories: [...prev.categories, newCat] }));
    setExpandedCats(prev => new Set([...prev, newCat.id]));
    setSelection({ type: 'category', id: newCat.id });
  }, [draft.categories, t]);

  const deleteCategory = useCallback((catId: string) => {
    const cat = draft.categories.find(c => c.id === catId);
    if (!cat || cat.builtin) return;
    const hasItems = draft.items.some(i => i.categoryId === catId);
    if (hasItems) return;
    setDraft(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== catId) }));
    if (selection?.id === catId) setSelection(null);
  }, [draft, selection]);

  const moveCategoryUp = useCallback((catId: string) => {
    const sorted = [...draft.categories].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(c => c.id === catId);
    if (idx <= 0) return;
    const temp = sorted[idx].order;
    sorted[idx].order = sorted[idx - 1].order;
    sorted[idx - 1].order = temp;
    setDraft(prev => ({ ...prev, categories: sorted }));
  }, [draft.categories]);

  const moveCategoryDown = useCallback((catId: string) => {
    const sorted = [...draft.categories].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(c => c.id === catId);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const temp = sorted[idx].order;
    sorted[idx].order = sorted[idx + 1].order;
    sorted[idx + 1].order = temp;
    setDraft(prev => ({ ...prev, categories: sorted }));
  }, [draft.categories]);

  // ── 操作项操作 ──
  const addItem = useCallback((catId: string) => {
    const siblings = draft.items.filter(i => i.categoryId === catId);
    const maxOrder = siblings.reduce((m, i) => Math.max(m, i.order), -1);
    const newItem: QuickActionItem = {
      id: genActionId(),
      categoryId: catId,
      label: t('qam.newAction', { defaultValue: '新操作' }),
      icon: 'Wand2',
      prompt: '',
      contextMode: 'code',
      order: maxOrder + 1,
    };
    setDraft(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setSelection({ type: 'item', id: newItem.id });
    setExpandedCats(prev => new Set([...prev, catId]));
  }, [draft.items, t]);

  const deleteItem = useCallback((itemId: string) => {
    const item = draft.items.find(i => i.id === itemId);
    if (!item) return;
    if (item.builtin) {
      setDraft(prev => ({ ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, hidden: true } : i) }));
    } else {
      setDraft(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
    }
    if (selection?.id === itemId) setSelection(null);
  }, [draft.items, selection]);

  const restoreItem = useCallback((itemId: string) => {
    setDraft(prev => ({ ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, hidden: false } : i) }));
  }, []);

  const duplicateItem = useCallback((itemId: string) => {
    const item = draft.items.find(i => i.id === itemId);
    if (!item) return;
    const newItem: QuickActionItem = {
      ...item,
      id: genActionId(),
      label: item.label + ' (副本)',
      builtin: false,
      order: item.order + 0.5,
    };
    setDraft(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setSelection({ type: 'item', id: newItem.id });
  }, [draft.items]);

  const moveItemUp = useCallback((itemId: string) => {
    const item = draft.items.find(i => i.id === itemId);
    if (!item) return;
    const siblings = draft.items.filter(i => i.categoryId === item.categoryId && !i.hidden).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex(i => i.id === itemId);
    if (idx <= 0) return;
    const temp = siblings[idx].order;
    siblings[idx].order = siblings[idx - 1].order;
    siblings[idx - 1].order = temp;
    setDraft(prev => ({ ...prev, items: [...prev.items] }));
  }, [draft.items]);

  const moveItemDown = useCallback((itemId: string) => {
    const item = draft.items.find(i => i.id === itemId);
    if (!item) return;
    const siblings = draft.items.filter(i => i.categoryId === item.categoryId && !i.hidden).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex(i => i.id === itemId);
    if (idx < 0 || idx >= siblings.length - 1) return;
    const temp = siblings[idx].order;
    siblings[idx].order = siblings[idx + 1].order;
    siblings[idx + 1].order = temp;
    setDraft(prev => ({ ...prev, items: [...prev.items] }));
  }, [draft.items]);

  // ── 编辑操作 ──
  const updateItem = useCallback((itemId: string, patch: Partial<QuickActionItem>) => {
    setDraft(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, ...patch } : i),
    }));
  }, []);

  const updateCategory = useCallback((catId: string, patch: Partial<QuickActionCategory>) => {
    setDraft(prev => ({
      ...prev,
      categories: prev.categories.map(c => c.id === catId ? { ...c, ...patch } : c),
    }));
  }, []);

  const resetItemToDefault = useCallback((itemId: string) => {
    const defaultPrompt = getBuiltinPrompt(itemId);
    if (defaultPrompt !== undefined) {
      updateItem(itemId, { prompt: defaultPrompt });
    }
  }, [updateItem]);

  // ── 全局操作 ──
  const handleResetAll = useCallback(() => {
    const defaults = getDefaultStore();
    setDraft(defaults);
    setSelection(null);
    setConfirmResetOpen(false);
  }, []);

  const handleExport = useCallback(() => {
    const json = exportConfig(draft);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mermaid-quick-actions-config.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [draft]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importConfig(reader.result as string);
      if (result) {
        setDraft(result);
        setSelection(null);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSave = useCallback(() => {
    const cats = [...draft.categories].sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }));
    const items = [...draft.items];
    for (const cat of cats) {
      const catItems = items.filter(i => i.categoryId === cat.id).sort((a, b) => a.order - b.order);
      catItems.forEach((item, idx) => { item.order = idx; });
    }
    const normalized: QuickActionStore = { categories: cats, items, version: draft.version };
    onSave(normalized);
    onOpenChange(false);
  }, [draft, onSave, onOpenChange]);

  const selectedItem = selection?.type === 'item' ? draft.items.find(i => i.id === selection.id) : null;
  const selectedCat = selection?.type === 'category' ? draft.categories.find(c => c.id === selection.id) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[80vh] flex flex-col p-0" style={DIALOG_STYLE}>
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle>{t('qam.title', { defaultValue: '快捷按钮管理' })}</DialogTitle>
          <DialogDescription>{t('qam.desc', { defaultValue: '管理图表 AI 助手的快捷操作按钮：新建、编辑、排序、删除' })}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* ── 左侧：树形列表 ── */}
          <div className="w-[220px] border-r flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {sortedCategories.map(cat => {
                const isExpanded = expandedCats.has(cat.id);
                const items = getItemsForCategory(cat.id);
                const hiddenItems = getHiddenItemsForCategory(cat.id);
                const isSelected = selection?.type === 'category' && selection.id === cat.id;
                return (
                  <div key={cat.id}>
                    <div
                      className={`flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer text-xs group transition-colors ${isSelected ? 'bg-green-500/10 text-green-700 dark:text-green-300' : 'hover:bg-accent'}`}
                      onClick={() => { toggleExpand(cat.id); setSelection({ type: 'category', id: cat.id }); }}
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                      {renamingCatId === cat.id ? (
                        <Input
                          className="h-5 text-xs px-1 flex-1"
                          value={renameCatValue}
                          onChange={e => setRenameCatValue(e.target.value)}
                          onBlur={() => { if (renameCatValue.trim()) updateCategory(cat.id, { label: renameCatValue.trim() }); setRenamingCatId(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') { if (renameCatValue.trim()) updateCategory(cat.id, { label: renameCatValue.trim() }); setRenamingCatId(null); } }}
                          autoFocus
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 truncate font-medium">{cat.label}</span>
                      )}
                      {cat.builtin && <Lock className="h-2.5 w-2.5 text-muted-foreground opacity-50" />}
                      <span className="text-[10px] text-muted-foreground">{items.length}</span>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button className="p-0.5 rounded hover:bg-accent" title={t('qam.addAction', { defaultValue: '新建操作' })} onClick={e => { e.stopPropagation(); addItem(cat.id); }}>
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="ml-3 space-y-0.5">
                        {items.map(item => {
                          const isItemSelected = selection?.type === 'item' && selection.id === item.id;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer text-xs group transition-colors ${isItemSelected ? 'bg-green-500/10 text-green-700 dark:text-green-300' : 'hover:bg-accent'}`}
                              onClick={() => setSelection({ type: 'item', id: item.id })}
                            >
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.builtin && <Lock className="h-2.5 w-2.5 text-muted-foreground opacity-40" />}
                              <div className="hidden group-hover:flex items-center gap-0.5">
                                <button className="p-0.5 rounded hover:bg-accent" title={t('qam.moveUp', { defaultValue: '上移' })} onClick={e => { e.stopPropagation(); moveItemUp(item.id); }}>
                                  <ArrowUp className="h-2.5 w-2.5" />
                                </button>
                                <button className="p-0.5 rounded hover:bg-accent" title={t('qam.moveDown', { defaultValue: '下移' })} onClick={e => { e.stopPropagation(); moveItemDown(item.id); }}>
                                  <ArrowDown className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {hiddenItems.length > 0 && (
                          <div className="pt-1 border-t border-dashed">
                            <span className="text-[10px] text-muted-foreground px-1.5">{t('qam.hidden', { defaultValue: '已隐藏' })} ({hiddenItems.length})</span>
                            {hiddenItems.map(item => (
                              <div key={item.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground opacity-60 group">
                                <EyeOff className="h-2.5 w-2.5" />
                                <span className="flex-1 truncate">{item.label}</span>
                                <button className="hidden group-hover:block p-0.5 rounded hover:bg-accent" title={t('qam.restore', { defaultValue: '恢复显示' })} onClick={() => restoreItem(item.id)}>
                                  <Eye className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground w-full transition-colors"
                          onClick={() => addItem(cat.id)}
                        >
                          <Plus className="h-3 w-3" />{t('qam.addAction', { defaultValue: '新建操作' })}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                className="flex items-center gap-1 px-1.5 py-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground w-full transition-colors mt-1"
                onClick={addCategory}
              >
                <FolderPlus className="h-3 w-3" />{t('qam.addCategory', { defaultValue: '新建分类' })}
              </button>
            </div>
          </div>

          {/* ── 右侧：编辑面板 ── */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {!selection && (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                {t('qam.selectHint', { defaultValue: '← 选择一个分类或操作项进行编辑' })}
              </div>
            )}

            {selectedCat && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium flex-1">{t('qam.editCategory', { defaultValue: '编辑分类' })}</h3>
                  {selectedCat.builtin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5">
                      <Lock className="h-2.5 w-2.5" />{t('qam.builtin', { defaultValue: '内置' })}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">{t('qam.categoryName', { defaultValue: '分类名称' })}</Label>
                    <Input className="h-8 text-xs mt-1" value={selectedCat.label} onChange={e => updateCategory(selectedCat.id, { label: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t('qam.icon', { defaultValue: '图标' })}</Label>
                    <Select value={selectedCat.icon} onValueChange={v => updateCategory(selectedCat.id, { icon: v })}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic} className="text-xs">{ic}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => moveCategoryUp(selectedCat.id)}>
                    <ArrowUp className="h-3 w-3" />{t('qam.moveUp', { defaultValue: '上移' })}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => moveCategoryDown(selectedCat.id)}>
                    <ArrowDown className="h-3 w-3" />{t('qam.moveDown', { defaultValue: '下移' })}
                  </Button>
                  <div className="flex-1" />
                  {!selectedCat.builtin && !draft.items.some(i => i.categoryId === selectedCat.id) && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => deleteCategory(selectedCat.id)}>
                      <Trash2 className="h-3 w-3" />{t('qam.delete', { defaultValue: '删除' })}
                    </Button>
                  )}
                  {selectedCat.builtin && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                      const defaultLabel = getBuiltinCategoryLabel(selectedCat.id);
                      if (defaultLabel) updateCategory(selectedCat.id, { label: defaultLabel });
                    }}>
                      <RotateCcw className="h-3 w-3" />{t('qam.resetDefault', { defaultValue: '恢复默认' })}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {selectedItem && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium flex-1">{t('qam.editAction', { defaultValue: '编辑操作' })}</h3>
                  {selectedItem.builtin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5">
                      <Lock className="h-2.5 w-2.5" />{t('qam.builtin', { defaultValue: '内置' })}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">{t('qam.editAction', { defaultValue: '名称' })}</Label>
                    <Input className="h-8 text-xs mt-1" value={selectedItem.label} onChange={e => updateItem(selectedItem.id, { label: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">{t('qam.icon', { defaultValue: '图标' })}</Label>
                      <Select value={selectedItem.icon} onValueChange={v => updateItem(selectedItem.id, { icon: v })}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ICON_OPTIONS.map(ic => <SelectItem key={ic} value={ic} className="text-xs">{ic}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t('qam.contextMode', { defaultValue: '上下文模式' })}</Label>
                      <Select value={selectedItem.contextMode || 'none'} onValueChange={v => updateItem(selectedItem.id, { contextMode: v as 'code' | 'structure' | 'full' | 'none' })}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONTEXT_MODES.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1" />
                    <Label className="text-xs text-muted-foreground">
                      {t('qam.category', { defaultValue: '所属分类' })}:
                    </Label>
                    <Select value={selectedItem.categoryId} onValueChange={v => updateItem(selectedItem.id, { categoryId: v })}>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sortedCategories.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{t('qam.prompt', { defaultValue: '提示词' })}</Label>
                    <Textarea
                      className="mt-1 text-xs min-h-[120px] resize-y"
                      value={selectedItem.prompt}
                      onChange={e => updateItem(selectedItem.id, { prompt: e.target.value })}
                      placeholder={t('qam.promptPlaceholder', { defaultValue: '输入发送给 AI 的提示词...' })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t('qam.promptHint', { defaultValue: '点击按钮时，此提示词将作为用户消息发送给 AI' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => moveItemUp(selectedItem.id)}>
                    <ArrowUp className="h-3 w-3" />{t('qam.moveUp', { defaultValue: '上移' })}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => moveItemDown(selectedItem.id)}>
                    <ArrowDown className="h-3 w-3" />{t('qam.moveDown', { defaultValue: '下移' })}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => duplicateItem(selectedItem.id)}>
                    <Copy className="h-3 w-3" />{t('qam.duplicate', { defaultValue: '复制' })}
                  </Button>
                  <div className="flex-1" />
                  {selectedItem.builtin && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => resetItemToDefault(selectedItem.id)}>
                      <RotateCcw className="h-3 w-3" />{t('qam.resetDefault', { defaultValue: '恢复默认' })}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => {
                    if (selectedItem.builtin) {
                      setConfirmDeleteOpen(true);
                    } else {
                      deleteItem(selectedItem.id);
                    }
                  }}>
                    {selectedItem.builtin ? <EyeOff className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                    {selectedItem.builtin ? t('qam.hide', { defaultValue: '隐藏' }) : t('qam.delete', { defaultValue: '删除' })}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 底部工具栏 ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t bg-muted/30">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}>
            <Download className="h-3 w-3" />{t('qam.export', { defaultValue: '导出配置' })}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3" />{t('qam.import', { defaultValue: '导入配置' })}
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setConfirmResetOpen(true)}>
            <RotateCcw className="h-3 w-3" />{t('qam.resetAll', { defaultValue: '全部恢复默认' })}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
            {t('qam.cancel', { defaultValue: '取消' })}
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
            {t('qam.save', { defaultValue: '保存' })}
          </Button>
        </div>

        {/* ── 确认恢复默认 ── */}
        <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
          <DialogContent className="sm:max-w-[360px]" style={DIALOG_STYLE}>
            <DialogHeader>
              <DialogTitle>{t('qam.resetAllTitle', { defaultValue: '恢复默认配置' })}</DialogTitle>
              <DialogDescription>{t('qam.resetAllDesc', { defaultValue: '确定要将所有快捷按钮恢复为默认配置？你的自定义修改将丢失。' })}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmResetOpen(false)}>{t('qam.cancel', { defaultValue: '取消' })}</Button>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleResetAll}>{t('qam.confirmReset', { defaultValue: '确认恢复' })}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── 确认隐藏内置项 ── */}
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <DialogContent className="sm:max-w-[360px]" style={DIALOG_STYLE}>
            <DialogHeader>
              <DialogTitle>{t('qam.hideTitle', { defaultValue: '隐藏内置操作' })}</DialogTitle>
              <DialogDescription>{t('qam.hideDesc', { defaultValue: '内置操作不能删除，但可以隐藏。隐藏后可随时在分类中恢复。' })}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmDeleteOpen(false)}>{t('qam.cancel', { defaultValue: '取消' })}</Button>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { if (selectedItem) deleteItem(selectedItem.id); setConfirmDeleteOpen(false); }}>{t('qam.confirmHide', { defaultValue: '确认隐藏' })}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
