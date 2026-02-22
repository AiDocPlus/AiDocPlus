import { useState, useEffect, useCallback, useMemo } from 'react';
import { Edit2, Trash2, FileText, Eye, Check, Search, Settings2, FolderOpen, X, Download, Upload } from 'lucide-react';
import { save, open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '@/i18n';
import { useTemplatesStore } from '@/stores/useTemplatesStore';
import type { PromptTemplate, PromptTemplateCategory } from '@aidocplus/shared-types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';

interface PromptTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: PromptTemplate) => void;
}

export function PromptTemplates({ open, onClose, onSelectTemplate }: PromptTemplatesProps) {
  const { t } = useTranslation();
  const {
    setSelectedTemplate,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getBuiltInTemplates,
    getCustomTemplates,
    getAllCategories
  } = useTemplatesStore();

  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PromptTemplateCategory | 'all'>('all');
  const [previewingTemplate, setPreviewingTemplate] = useState<PromptTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: 'content' as PromptTemplateCategory,
    content: '',
    description: ''
  });
  const [searchQuery, setSearchQuery] = useState('');

  // 对话框打开时从后端刷新提示词模板
  useEffect(() => {
    if (open) {
      useTemplatesStore.getState().loadBuiltInTemplates();
      useTemplatesStore.getState().loadBuiltInCategories();
    }
  }, [open]);

  // 窗口获得焦点时刷新（从管理器切回后自动更新）
  useEffect(() => {
    if (!open) return;
    const onFocus = () => {
      useTemplatesStore.getState().loadBuiltInTemplates();
      useTemplatesStore.getState().loadBuiltInCategories();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open]);

  // 键盘快捷键支持
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (view !== 'list') return;

    if (e.key === 'Escape') {
      if (previewingTemplate) {
        setPreviewingTemplate(null);
      } else {
        onClose();
      }
    } else if (e.key === 'Enter' && previewingTemplate && onSelectTemplate) {
      onSelectTemplate(previewingTemplate);
      onClose();
    }
  }, [view, previewingTemplate, onSelectTemplate, onClose]);

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const allCategories = getAllCategories();
  const builtInTemplates = getBuiltInTemplates();
  const customTemplates = getCustomTemplates();
  const allTemplates = useMemo(() => [...builtInTemplates, ...customTemplates], [builtInTemplates, customTemplates]);

  // 数据刷新后同步预览面板
  useEffect(() => {
    if (previewingTemplate) {
      const updated = allTemplates.find(t => t.id === previewingTemplate.id);
      if (updated && updated !== previewingTemplate) {
        setPreviewingTemplate(updated);
      } else if (!updated) {
        setPreviewingTemplate(null);
      }
    }
  }, [allTemplates]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allTemplates.length };
    for (const tmpl of allTemplates) {
      const cat = tmpl.category || 'general';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [allTemplates]);

  const filteredTemplates = useMemo(() => {
    let list = allTemplates;
    if (selectedCategory !== 'all') {
      list = list.filter(tmpl => tmpl.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(tmpl =>
        tmpl.name.toLowerCase().includes(q) ||
        (tmpl.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allTemplates, selectedCategory, searchQuery]);

  const handleOpenManager = () => {
    invoke('open_resource_manager', { managerName: '提示词模板管理器' }).catch(err => {
      console.error('Failed to open resource manager:', err);
    });
  };

  const handleExportTemplates = async () => {
    try {
      const outputPath = await save({
        title: t('templates.exportTitle', { defaultValue: '导出自定义模板' }),
        defaultPath: 'custom-prompt-templates.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!outputPath) return;
      const result = await invoke<string>('export_custom_prompt_templates', { outputPath });
      alert(result);
    } catch (e) {
      alert(t('templates.exportFailed', { defaultValue: '导出失败' }) + ': ' + e);
    }
  };

  const handleImportTemplates = async () => {
    try {
      const jsonPath = await openDialog({
        title: t('templates.importTitle', { defaultValue: '导入模板（JSON）' }),
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
      });
      if (!jsonPath) return;
      const result = await invoke<{ imported: number; skipped: number; total: number }>(
        'import_custom_prompt_templates', { jsonPath }
      );
      const msg = t('templates.importResult', {
        defaultValue: '导入完成：共 {{total}} 个模板，成功 {{imported}} 个，跳过 {{skipped}} 个（已存在）',
        total: result.total,
        imported: result.imported,
        skipped: result.skipped,
      });
      alert(msg);
      // 刷新模板列表
      useTemplatesStore.getState().loadBuiltInTemplates();
    } catch (e) {
      alert(t('templates.importFailed', { defaultValue: '导入失败' }) + ': ' + e);
    }
  };

  const handleCreateTemplate = () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) return;
    addTemplate({
      name: templateForm.name.trim(),
      category: templateForm.category,
      content: templateForm.content.trim(),
      description: templateForm.description.trim() || undefined
    });
    resetForm();
    setView('list');
  };

  const handleEditTemplate = () => {
    if (!editingTemplate || !templateForm.name.trim() || !templateForm.content.trim()) return;
    updateTemplate(editingTemplate.id, {
      name: templateForm.name.trim(),
      category: templateForm.category,
      content: templateForm.content.trim(),
      description: templateForm.description.trim() || undefined
    });
    resetForm();
    setView('list');
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm(t('templates.confirmDelete', { defaultValue: 'Are you sure you want to delete this template?' }))) {
      deleteTemplate(id);
    }
  };

  const resetForm = () => {
    setTemplateForm({ name: '', category: 'content', content: '', description: '' });
  };

  const startEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      category: template.category,
      content: template.content,
      description: template.description || ''
    });
    setView('edit');
  };

  // 点击模板时只预览，不直接使用
  const handleTemplateClick = (template: PromptTemplate) => {
    setSelectedTemplate(template.id);
    setPreviewingTemplate(template);
  };

  // 双击或点击"使用"按钮时才真正使用模板
  const handleUseTemplate = (template: PromptTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
      onClose();
    }
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[1100px] h-[640px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-3 shrink-0">
          <DialogTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('templates.title')}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleImportTemplates} title={t('templates.importTitle', { defaultValue: '导入模板（ZIP）' })}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {t('templates.import', { defaultValue: '导入' })}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportTemplates} title={t('templates.exportTitle', { defaultValue: '导出自定义模板' })}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t('templates.export', { defaultValue: '导出' })}
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenManager}>
              <Settings2 className="w-3.5 h-3.5 mr-1.5" />
              {t('templates.openManager', { defaultValue: '管理提示词模板' })}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {view === 'list' ? (
          <div className="flex-1 min-h-0 flex overflow-hidden border rounded-md">
            {/* ═══ 左栏：分类 ═══ */}
            <div className="w-[180px] flex-shrink-0 border-r overflow-y-auto">
                <div className="p-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={cn(
                      "flex items-center gap-2 w-full px-2.5 py-1.5 text-sm rounded-md transition-colors",
                      selectedCategory === 'all' ? "bg-blue-100 dark:bg-blue-900/30 font-medium" : "hover:bg-muted"
                    )}
                  >
                    <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{t('templates.allCategories', { defaultValue: '全部' })}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{categoryCounts.all || 0}</span>
                  </button>
                  {Object.entries(allCategories).map(([key, { name, icon }]) => {
                    const count = categoryCounts[key] || 0;
                    if (count === 0) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedCategory(key)}
                        className={cn(
                          "flex items-center gap-2 w-full px-2.5 py-1.5 text-sm rounded-md transition-colors",
                          selectedCategory === key ? "bg-blue-100 dark:bg-blue-900/30 font-medium" : "hover:bg-muted"
                        )}
                      >
                        <span className="flex-shrink-0 text-sm">{icon}</span>
                        <span className="truncate">{name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                      </button>
                    );
                  })}
                </div>
            </div>

            {/* ═══ 中栏：模板列表 ═══ */}
            <div className="flex-1 min-w-0 border-r flex flex-col overflow-hidden">
              <div className="p-2 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('templates.searchPlaceholder', { defaultValue: '搜索模板...' })}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-2 pb-2 space-y-0.5">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{searchQuery.trim() ? t('templates.noMatchingTemplates', { defaultValue: '没有匹配的模板' }) : t('templates.noCustomTemplates', { defaultValue: '暂无模板' })}</p>
                    </div>
                  ) : (
                    filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors",
                          previewingTemplate?.id === template.id
                            ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                            : "hover:bg-muted border border-transparent"
                        )}
                        onClick={() => handleTemplateClick(template)}
                        onDoubleClick={() => handleUseTemplate(template)}
                      >
                        <span className="flex-shrink-0 text-base">{allCategories[template.category]?.icon || '📄'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{template.name}</div>
                          {template.description && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">{template.description}</div>
                          )}
                        </div>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded flex-shrink-0",
                          template.isBuiltIn ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600"
                        )}>
                          {template.isBuiltIn ? t('templates.builtin', { defaultValue: '内置' }) : t('templates.custom', { defaultValue: '自定义' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ═══ 右栏：预览 ═══ */}
            <div className="w-[360px] flex-shrink-0 flex flex-col overflow-hidden">
              {!previewingTemplate ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Eye className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">{t('templates.clickToPreview', { defaultValue: '选择模板查看详情' })}</p>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{allCategories[previewingTemplate.category]?.icon || '📄'}</span>
                      <h3 className="font-semibold text-base truncate">{previewingTemplate.name}</h3>
                    </div>
                    {previewingTemplate.description && (
                      <p className="text-sm text-muted-foreground mb-2">{previewingTemplate.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {allCategories[previewingTemplate.category]?.name || previewingTemplate.category}
                      </span>
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        previewingTemplate.isBuiltIn ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600"
                      )}>
                        {previewingTemplate.isBuiltIn ? t('templates.builtin', { defaultValue: '内置' }) : t('templates.custom', { defaultValue: '自定义' })}
                      </span>
                    </div>
                  </div>

                  <div key={previewingTemplate.id} className="flex-1 min-h-0 overflow-y-auto">
                    <div className="p-4">
                      <pre className="text-xs whitespace-pre-wrap break-words font-mono bg-muted/50 p-3 rounded-md leading-relaxed">
                        {previewingTemplate.content}
                      </pre>
                    </div>
                  </div>

                  <div className="p-3 border-t flex-shrink-0 space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => handleUseTemplate(previewingTemplate)}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {t('templates.useTemplate', { defaultValue: '使用此模板' })}
                    </Button>
                    <div className="flex gap-2">
                      {!previewingTemplate.isBuiltIn && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => startEdit(previewingTemplate)}
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                            {t('common.edit', { defaultValue: '编辑' })}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteTemplate(previewingTemplate.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Create/Edit Form */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">{t('templates.templateName')}</Label>
                  <Input
                    id="template-name"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder={t('templates.templateName')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-category">{t('templates.templateCategory')}</Label>
                  <Select
                    value={templateForm.category}
                    onValueChange={(value) => setTemplateForm({ ...templateForm, category: value as PromptTemplateCategory })}
                  >
                    <SelectTrigger id="template-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(allCategories).map(([key, { name, icon }]) => (
                        <SelectItem key={key} value={key}>
                          {icon} {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-description">{t('fileTree.description', { defaultValue: 'Description' })}</Label>
                  <Input
                    id="template-description"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder={t('fileTree.description', { defaultValue: 'Description' })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-content">{t('templates.templateContent')}</Label>
                  <Textarea
                    id="template-content"
                    value={templateForm.content}
                    onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                    placeholder={t('templates.promptPlaceholder', { defaultValue: '输入提示词模板内容...' })}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { resetForm(); setView('list'); setEditingTemplate(null); }}>
                {t('common.cancel')}
              </Button>
              <Button onClick={view === 'create' ? handleCreateTemplate : handleEditTemplate}>
                {view === 'create' ? t('templates.createTemplate') : t('templates.editTemplate')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PromptTemplates;
