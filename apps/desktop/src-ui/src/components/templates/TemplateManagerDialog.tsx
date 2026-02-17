import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, FileText, Trash2, Copy, Pencil, Check, X, Settings2, ArrowLeft, Plus, GripVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/stores/useAppStore';
import type { TemplateManifest, TemplateCategory } from '@aidocplus/shared-types';
import { getTemplateCategories } from './constants';

type ViewMode = 'templates' | 'categories';

interface TemplateManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateManagerDialog({ open, onOpenChange }: TemplateManagerDialogProps) {
  const {
    templates, templateCategories,
    deleteTemplate, duplicateTemplate, updateTemplate,
    createTemplateCategory, updateTemplateCategory, deleteTemplateCategory,
    reorderTemplateCategories,
  } = useAppStore();
  const { t } = useTranslation();
  const categories = getTemplateCategories(templateCategories);

  const [viewMode, setViewMode] = useState<ViewMode>('templates');

  // ── 模板视图状态 ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // ── 分类视图状态 ──
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatKey, setNewCatKey] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [editingCatKey, setEditingCatKey] = useState<string | null>(null);
  const [editCatLabel, setEditCatLabel] = useState('');
  const [confirmingDeleteCatKey, setConfirmingDeleteCatKey] = useState<string | null>(null);

  // ── 模板过滤 ──
  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (selectedCategory !== 'all') {
      list = list.filter(t => (t.category || 'general') === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag: string) => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [templates, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const t of templates) {
      const cat = t.category || 'general';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [templates]);

  const getCategoryLabel = (key: string) => {
    const cat = categories.find((c: { key: string; label: string }) => c.key === key);
    return cat?.label || key;
  };

  // ── 模板操作 ──
  const handleStartEdit = (template: TemplateManifest) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditDescription(template.description);
    setEditCategory(template.category || 'general');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await updateTemplate(editingId, {
        name: editName.trim(),
        description: editDescription.trim(),
        category: editCategory,
      });
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update template:', err);
    }
  };

  const handleCancelEdit = () => { setEditingId(null); };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate(templateId);
      setConfirmingDeleteId(null);
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const handleDuplicate = async (templateId: string, templateName: string) => {
    try {
      await duplicateTemplate(templateId, `${templateName} ${t('settings.templateManager.copySuffix', { defaultValue: '(副本)' })}`);
    } catch (err) {
      console.error('Failed to duplicate template:', err);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  };

  // ── 分类操作 ──
  const handleAddCategory = async () => {
    const key = newCatKey.trim();
    const label = newCatLabel.trim();
    if (!key || !label) return;
    try {
      await createTemplateCategory(key, label);
      setNewCatKey(''); setNewCatLabel(''); setIsAddingCat(false);
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  const handleSaveCatEdit = async () => {
    if (!editingCatKey) return;
    const label = editCatLabel.trim();
    if (!label) return;
    try {
      await updateTemplateCategory(editingCatKey, label);
      setEditingCatKey(null);
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  const handleDeleteCategory = async (key: string) => {
    try {
      await deleteTemplateCategory(key);
      setConfirmingDeleteCatKey(null);
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const handleMoveCat = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= templateCategories.length) return;
    const keys = templateCategories.map((c: TemplateCategory) => c.key);
    [keys[index], keys[newIndex]] = [keys[newIndex], keys[index]];
    try {
      await reorderTemplateCategories(keys);
    } catch (err) {
      console.error('Failed to reorder categories:', err);
    }
  };

  // ── 渲染 ──
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        {viewMode === 'templates' ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('settings.templateManager.title', { defaultValue: '管理模板' })}</DialogTitle>
            </DialogHeader>

            <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">
              {/* 左侧分类 */}
              <div className="w-40 flex-shrink-0 overflow-y-auto border-r pr-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${
                    selectedCategory === 'all' ? 'bg-blue-100 dark:bg-blue-900/30 font-medium' : 'hover:bg-muted'
                  }`}
                >
                  {t('settings.templateManager.all', { defaultValue: '全部' })}
                  <span className="ml-auto text-xs text-muted-foreground">{categoryCounts.all || 0}</span>
                </button>
                {categories.map((cat: { key: string; label: string }) => {
                  const count = categoryCounts[cat.key] || 0;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${
                        selectedCategory === cat.key ? 'bg-blue-100 dark:bg-blue-900/30 font-medium' : 'hover:bg-muted'
                      }`}
                    >
                      {cat.label}
                      <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
                <div className="mt-3 pt-3 border-t">
                  <button
                    onClick={() => setViewMode('categories')}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-muted text-muted-foreground"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {t('settings.templateManager.manageCategories', { defaultValue: '管理分类' })}
                  </button>
                </div>
              </div>

              {/* 右侧列表 */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('settings.templateManager.searchPlaceholder', { defaultValue: '搜索模板...' })}
                    className="pl-8 h-8 text-sm"
                  />
                </div>

                {filteredTemplates.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    {templates.length === 0 ? t('settings.templateManager.noTemplates', { defaultValue: '暂无模板' }) : t('settings.templateManager.noMatchingTemplates', { defaultValue: '没有匹配的模板' })}
                  </div>
                )}

                {filteredTemplates.map((template: TemplateManifest) => (
                  <div
                    key={template.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border mb-2 hover:border-muted-foreground/30 transition-colors"
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary flex-shrink-0 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>

                    {editingId === template.id ? (
                      <div className="flex-1 min-w-0 space-y-2">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t('settings.templateManager.templateNamePlaceholder', { defaultValue: '模板名称' })} className="h-7 text-sm" autoFocus />
                        <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder={t('settings.templateManager.descriptionPlaceholder', { defaultValue: '描述（可选）' })} className="h-7 text-sm" />
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm">
                          {categories.map((cat: { key: string; label: string }) => (
                            <option key={cat.key} value={cat.key}>{cat.label}</option>
                          ))}
                        </select>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSaveEdit}><Check className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCancelEdit}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{template.name}</div>
                          {template.description && <div className="text-xs text-muted-foreground truncate mt-0.5">{template.description}</div>}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{getCategoryLabel(template.category || 'general')}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${template.type === 'builtin' ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'}`}>
                              {template.type === 'builtin' ? t('settings.templateManager.builtin', { defaultValue: '内置' }) : t('settings.templateManager.custom', { defaultValue: '自定义' })}
                            </span>
                            {template.createdAt > 0 && <span className="text-xs text-muted-foreground">{formatDate(template.createdAt)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={t('settings.templateManager.edit', { defaultValue: '编辑' })} onClick={() => handleStartEdit(template)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={t('settings.templateManager.copy', { defaultValue: '复制' })} onClick={() => handleDuplicate(template.id, template.name)}><Copy className="h-3.5 w-3.5" /></Button>
                          {template.type !== 'builtin' && (
                            confirmingDeleteId === template.id ? (
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleDeleteTemplate(template.id)}>{t('settings.templateManager.confirmDelete', { defaultValue: '确认删除' })}</Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setConfirmingDeleteId(null)}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title={t('settings.templateManager.delete', { defaultValue: '删除' })} onClick={() => setConfirmingDeleteId(template.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            )
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* ═══════ 分类管理视图 ═══════ */
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setViewMode('templates')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <DialogTitle>{t('settings.templateManager.manageCategories', { defaultValue: '管理分类' })}</DialogTitle>
                  <DialogDescription>{t('settings.templateManager.manageCategoriesDesc', { defaultValue: '创建、编辑、排序或删除模板分类' })}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
              {templateCategories.map((cat: TemplateCategory, index: number) => (
                editingCatKey === cat.key ? (
                  <div key={cat.key} className="flex items-center gap-2 px-2 py-2 rounded-md border border-primary bg-primary/5">
                    <Input
                      value={editCatLabel}
                      onChange={(e) => setEditCatLabel(e.target.value)}
                      placeholder={t('settings.templateManager.categoryNamePlaceholder', { defaultValue: '分类名称' })}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCatEdit(); if (e.key === 'Escape') setEditingCatKey(null); }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveCatEdit}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingCatKey(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : confirmingDeleteCatKey === cat.key ? (
                  <div key={cat.key} className="flex items-center gap-2 px-2 py-2 rounded-md border border-destructive bg-destructive/5">
                    <span className="text-sm flex-1 truncate">{t('settings.templateManager.confirmDeleteCategory', { defaultValue: '确定删除 "{{name}}"？', name: cat.label })}</span>
                    <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleDeleteCategory(cat.key)}>{t('settings.templateManager.delete', { defaultValue: '删除' })}</Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setConfirmingDeleteCatKey(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <div key={cat.key} className="flex items-center gap-2 px-2 py-2 rounded-md border border-border bg-background hover:bg-muted/50 transition-colors">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{cat.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{cat.key}</div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                      cat.type === 'builtin' ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'
                    }`}>
                      {cat.type === 'builtin' ? t('settings.templateManager.builtin', { defaultValue: '内置' }) : t('settings.templateManager.custom', { defaultValue: '自定义' })}
                    </span>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={t('settings.templateManager.moveUp', { defaultValue: '上移' })} disabled={index === 0} onClick={() => handleMoveCat(index, 'up')}>↑</Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={t('settings.templateManager.moveDown', { defaultValue: '下移' })} disabled={index === templateCategories.length - 1} onClick={() => handleMoveCat(index, 'down')}>↓</Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={t('settings.templateManager.edit', { defaultValue: '编辑' })} onClick={() => { setEditingCatKey(cat.key); setEditCatLabel(cat.label); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title={t('settings.templateManager.delete', { defaultValue: '删除' })} onClick={() => setConfirmingDeleteCatKey(cat.key)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )
              ))}

              {templateCategories.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-6">{t('settings.templateManager.noCategories', { defaultValue: '暂无分类' })}</div>
              )}
            </div>

            {/* 添加新分类 */}
            {isAddingCat ? (
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={newCatKey} onChange={(e) => setNewCatKey(e.target.value)} placeholder={t('settings.templateManager.categoryKeyPlaceholder', { defaultValue: '分类标识（英文，如 proposal）' })} className="h-8 text-sm flex-1" autoFocus />
                  <Input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder={t('settings.templateManager.categoryLabelPlaceholder', { defaultValue: '显示名称（如 提案）' })} className="h-8 text-sm flex-1" onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setIsAddingCat(false); setNewCatKey(''); setNewCatLabel(''); }}>{t('settings.templateManager.cancel', { defaultValue: '取消' })}</Button>
                  <Button size="sm" onClick={handleAddCategory} disabled={!newCatKey.trim() || !newCatLabel.trim()}>{t('settings.templateManager.add', { defaultValue: '添加' })}</Button>
                </div>
              </div>
            ) : (
              <div className="border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => setIsAddingCat(true)} className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t('settings.templateManager.addCategory', { defaultValue: '添加分类' })}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
