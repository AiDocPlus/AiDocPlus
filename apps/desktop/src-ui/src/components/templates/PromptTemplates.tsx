import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Download, Upload, FileText, Eye, Check } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useTemplatesStore } from '@/stores/useTemplatesStore';
import type { PromptTemplate, PromptTemplateCategory } from '@aidocplus/shared-types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

interface PromptTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: PromptTemplate) => void;
}

export function PromptTemplates({ open, onClose, onSelectTemplate }: PromptTemplatesProps) {
  const { t } = useTranslation();
  const {
    selectedTemplateId,
    setSelectedTemplate,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    importTemplates,
    exportTemplates,
    getBuiltInTemplates,
    getCustomTemplates,
    addCategory,
    updateCategory,
    deleteCategory,
    getAllCategories
  } = useTemplatesStore();

  const [view, setView] = useState<'list' | 'create' | 'edit' | 'category'>('list');
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PromptTemplateCategory | 'all'>('all');
  const [previewingTemplate, setPreviewingTemplate] = useState<PromptTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: 'content' as PromptTemplateCategory,
    content: '',
    description: ''
  });
  const [categoryForm, setCategoryForm] = useState({ key: '', name: '', icon: '' });
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);

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

  const handleExport = () => {
    try {
      const json = exportTemplates();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prompt-templates-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export templates:', error);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            importTemplates(content);
          } catch (error) {
            console.error('Failed to import templates:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const getCategoryIcon = (category: PromptTemplateCategory) => {
    const cat = allCategories[category];
    return cat ? <span className="text-sm">{cat.icon}</span> : <FileText className="w-4 h-4" />;
  };

  const renderTemplateCard = (template: PromptTemplate) => (
    <div
      key={template.id}
      className={cn(
        "p-3 border rounded-lg hover:bg-accent transition-colors group cursor-pointer",
        selectedTemplateId === template.id && "border-primary bg-accent",
        previewingTemplate?.id === template.id && "ring-2 ring-primary"
      )}
      onClick={() => handleTemplateClick(template)}
      onDoubleClick={() => handleUseTemplate(template)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {getCategoryIcon(template.category)}
            <h4 className="font-medium text-sm truncate">{template.name}</h4>
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
          )}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); startEdit(template); }}
            title={t('common.edit', { defaultValue: 'Edit' })}
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
            title={t('common.delete', { defaultValue: 'Delete' })}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  // 渲染预览区域
  const renderPreviewPanel = () => {
    if (!previewingTemplate) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Eye className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm">{t('templates.clickToPreview', { defaultValue: '点击模板查看预览' })}</p>
        </div>
      );
    }

    const categoryName = allCategories[previewingTemplate.category]?.name || previewingTemplate.category;
    const categoryIcon = allCategories[previewingTemplate.category]?.icon || '📄';

    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b shrink-0">
          <h3 className="font-semibold text-base mb-2">{previewingTemplate.name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{categoryIcon}</span>
            <span>{t('templates.templateCategory', { defaultValue: 'Category' })}: {categoryName}</span>
          </div>
          {previewingTemplate.description && (
            <p className="text-sm text-muted-foreground mt-2">{previewingTemplate.description}</p>
          )}
        </div>

        <ScrollArea key={previewingTemplate.id} className="flex-1 min-h-0">
          <div className="p-4">
            <pre className="text-sm whitespace-pre-wrap break-words font-mono bg-muted/50 p-3 rounded-md">
              {previewingTemplate.content}
            </pre>
          </div>
        </ScrollArea>

        <div className="p-4 border-t shrink-0 flex gap-2">
          <Button
            className="flex-1"
            onClick={() => handleUseTemplate(previewingTemplate)}
          >
            <Check className="w-4 h-4 mr-2" />
            {t('templates.useTemplate', { defaultValue: '使用此模板' })}
          </Button>
          <Button
            variant="outline"
            onClick={() => setPreviewingTemplate(null)}
          >
            {t('common.close', { defaultValue: 'Close' })}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[900px] h-[600px] max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('templates.title')}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              {t('templates.exportTemplate')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="w-4 h-4 mr-2" />
              {t('templates.importTemplate')}
            </Button>
            <Button variant="default" size="sm" onClick={() => { resetForm(); setView('create'); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('templates.createTemplate')}
            </Button>
          </div>
        </DialogHeader>

        {view === 'list' ? (
          <>
            {/* Category Filter - 横向可滚动 */}
            <div className="flex items-center gap-2 pb-4 border-b shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto flex-1 pb-1" style={{ scrollbarWidth: 'thin' }}>
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    "shrink-0",
                    selectedCategory === 'all' && "bg-red-500 hover:bg-red-600 text-white"
                  )}
                  onClick={() => setSelectedCategory('all')}
                >
                  {t('templates.allCategories', { defaultValue: '全部' })}
                </Button>
                {Object.entries(allCategories).map(([key, { name, icon }]) => (
                  <Button
                    key={key}
                    variant={selectedCategory === key ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "shrink-0",
                      selectedCategory === key && "bg-red-500 hover:bg-red-600 text-white"
                    )}
                    onClick={() => setSelectedCategory(key)}
                  >
                    {icon} {name}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setView('category')}
                title={t('templates.manageCategories', { defaultValue: '管理分类' })}
              >
                ⚙ {t('templates.category', { defaultValue: '分类' })}
              </Button>
            </div>

            {/* 左右分栏布局 */}
            <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
              {/* 左侧：模板列表 */}
              <div className="w-[60%] min-w-0 flex flex-col">
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 space-y-4">
                    {/* 内置模板 */}
                    {(() => {
                      const filtered = builtInTemplates.filter(t =>
                        selectedCategory === 'all' || t.category === selectedCategory
                      );
                      if (filtered.length === 0) return null;
                      return (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">
                            {t('templates.builtin', { defaultValue: '内置模板' })}
                          </h3>
                          <div className="grid grid-cols-1 gap-2">
                            {filtered.map((template) => renderTemplateCard(template))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 自定义模板 */}
                    {(() => {
                      const filtered = customTemplates.filter(t =>
                        selectedCategory === 'all' || t.category === selectedCategory
                      );
                      return (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">
                            {t('templates.custom', { defaultValue: '自定义模板' })}
                          </h3>
                          {filtered.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">
                              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">{t('templates.noCustomTemplates', { defaultValue: '暂无自定义模板' })}</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-2">
                              {filtered.map((template) => renderTemplateCard(template))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </ScrollArea>
              </div>

              {/* 右侧：预览区域 */}
              <div className="w-[40%] min-w-0 border-l pl-4">
                {renderPreviewPanel()}
              </div>
            </div>
          </>
        ) : view === 'category' ? (
          /* 分类管理 */
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h3 className="font-medium text-base mb-3">{t('templates.manageCategories', { defaultValue: '分类管理' })}</h3>

              {/* 新增/编辑分类表单 */}
              <div className="flex items-end gap-2 pb-4 border-b">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">{t('templates.categoryKey', { defaultValue: '分类标识（英文）' })}</Label>
                  <Input
                    value={categoryForm.key}
                    onChange={(e) => setCategoryForm({ ...categoryForm, key: e.target.value })}
                    placeholder="tech"
                    disabled={!!editingCategoryKey}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">{t('templates.categoryDisplayName', { defaultValue: '显示名称' })}</Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder={t('templates.categoryDisplayName', { defaultValue: '显示名称' })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 w-20">
                  <Label className="text-xs">{t('templates.categoryIcon', { defaultValue: '图标' })}</Label>
                  <Input
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                    placeholder="🔬"
                    className="h-8 text-sm text-center"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8"
                  disabled={!categoryForm.key.trim() || !categoryForm.name.trim() || !categoryForm.icon.trim()}
                  onClick={() => {
                    if (editingCategoryKey) {
                      updateCategory(editingCategoryKey, { name: categoryForm.name.trim(), icon: categoryForm.icon.trim() });
                      setEditingCategoryKey(null);
                    } else {
                      addCategory(categoryForm.key.trim(), { name: categoryForm.name.trim(), icon: categoryForm.icon.trim() });
                    }
                    setCategoryForm({ key: '', name: '', icon: '' });
                  }}
                >
                  {editingCategoryKey ? t('common.save', { defaultValue: '保存' }) : t('common.create', { defaultValue: '添加' })}
                </Button>
                {editingCategoryKey && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => { setEditingCategoryKey(null); setCategoryForm({ key: '', name: '', icon: '' }); }}
                  >
                    {t('common.cancel', { defaultValue: '取消' })}
                  </Button>
                )}
              </div>

              {/* 分类列表 */}
              <div className="space-y-2">
                {Object.entries(allCategories).map(([key, info]) => (
                  <div key={key} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent group">
                    <span className="text-lg w-8 text-center">{info.icon}</span>
                    <span className="font-medium text-sm flex-1">{info.name}</span>
                    <span className="text-xs text-muted-foreground">{key}</span>
                    {info.isBuiltIn ? (
                      <span className="text-xs text-muted-foreground">{t('templates.builtin', { defaultValue: '内置' })}</span>
                    ) : (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingCategoryKey(key);
                            setCategoryForm({ key, name: info.name, icon: info.icon });
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            if (confirm(t('templates.confirmDeleteCategory', { defaultValue: `确定删除分类"${info.name}"？该分类下的模板不会被删除。` }))) {
                              deleteCategory(key);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t p-4 flex justify-end">
              <Button variant="outline" onClick={() => setView('list')}>
                {t('common.back', { defaultValue: '返回' })}
              </Button>
            </div>
          </>
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
