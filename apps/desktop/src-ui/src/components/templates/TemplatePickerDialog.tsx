import { useState, useMemo } from 'react';
import { Search, FileText, FolderOpen, Puzzle, FilePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/stores/useAppStore';
import { useTranslation } from '@/i18n';
import type { TemplateManifest } from '@aidocplus/shared-types';
import { getTemplateCategories } from './constants';

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onCreated?: (documentId: string) => void;
}

export function TemplatePickerDialog({ open, onOpenChange, projectId, onCreated }: TemplatePickerDialogProps) {
  const { t } = useTranslation();
  const { templates, templateCategories, createDocumentFromTemplate, createDocument, openTab } = useAppStore();
  const categories = getTemplateCategories(templateCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateManifest | null>(null);
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 按分类分组模板
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, TemplateManifest[]> = {};
    for (const t of templates) {
      const cat = t.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }, [templates]);

  // 过滤模板
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
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [templates, selectedCategory, searchQuery]);

  // 分类计数
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const t of templates) {
      const cat = t.category || 'general';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [templates]);

  const handleCreateBlank = async () => {
    const docTitle = title.trim() || t('templates.untitledDocument', { defaultValue: '未命名文档' });
    setIsCreating(true);
    try {
      const doc = await createDocument(projectId, docTitle);
      if (doc) {
        await openTab(doc.id);
        onCreated?.(doc.id);
      }
      onOpenChange(false);
      resetState();
    } catch (err) {
      console.error('Failed to create blank document:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;
    const docTitle = title.trim() || selectedTemplate.name;
    setIsCreating(true);
    try {
      const doc = await createDocumentFromTemplate(projectId, selectedTemplate.id, docTitle);
      if (doc) {
        await openTab(doc.id);
        onCreated?.(doc.id);
      }
      onOpenChange(false);
      resetState();
    } catch (err) {
      console.error('Failed to create document from template:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const resetState = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedTemplate(null);
    setTitle('');
  };

  const getCategoryLabel = (key: string) => {
    const cat = categories.find(c => c.key === key);
    return cat?.label || key;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('templates.newFromTemplate', { defaultValue: '从模板新建文档' })}</DialogTitle>
        </DialogHeader>

        {/* 文档标题输入 */}
        <div className="flex items-center gap-2 px-1">
          <label className="text-sm font-medium whitespace-nowrap">{t('templates.docTitle', { defaultValue: '文档标题' })}</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('templates.docTitlePlaceholder', { defaultValue: '输入文档标题（留空使用模板名称）' })}
            className="flex-1"
          />
        </div>

        <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">
          {/* 左侧分类树 */}
          <div className="w-44 flex-shrink-0 overflow-y-auto border-r pr-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${
                selectedCategory === 'all' ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t('templates.all', { defaultValue: '全部' })}
              <span className="ml-auto text-xs text-muted-foreground">{categoryCounts.all || 0}</span>
            </button>

            {categories.map(cat => {
              const count = categoryCounts[cat.key] || 0;
              if (count === 0 && !groupedTemplates[cat.key]) return null;
              return (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors ${
                    selectedCategory === cat.key ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {cat.label}
                  <span className="ml-auto text-xs text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>

          {/* 右侧模板列表 */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* 搜索框 */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('templates.searchPlaceholder', { defaultValue: '搜索模板...' })}
                className="pl-8 h-8 text-sm"
              />
            </div>

            {/* 空白文档快捷入口 */}
            <button
              onClick={() => setSelectedTemplate(null)}
              className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-colors mb-2 ${
                selectedTemplate === null ? 'border-blue-300 bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30' : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                <FilePlus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{t('templates.blankDocument', { defaultValue: '空白文档' })}</div>
                <div className="text-xs text-muted-foreground">{t('templates.blankDocumentDesc', { defaultValue: '创建一个空白文档' })}</div>
              </div>
            </button>

            {/* 模板卡片列表 */}
            {filteredTemplates.length === 0 && templates.length > 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                {t('templates.noMatchingTemplates', { defaultValue: '没有匹配的模板' })}
              </div>
            )}

            {filteredTemplates.length === 0 && templates.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                {t('templates.noTemplatesHint', { defaultValue: '暂无模板，可通过“存为模板”创建' })}
              </div>
            )}

            {filteredTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-colors mb-2 ${
                  selectedTemplate?.id === template.id ? 'border-blue-300 bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30' : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium truncate">{template.name}</div>
                  {template.description && (
                    <div className="text-xs text-muted-foreground truncate">{template.description}</div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {getCategoryLabel(template.category || 'general')}
                    </span>
                    {template.enabledPlugins.length > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Puzzle className="h-3 w-3" />
                        {t('templates.pluginCount', { defaultValue: '{{count}} 个插件', count: template.enabledPlugins.length })}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }}>
            {t('templates.cancel', { defaultValue: '取消' })}
          </Button>
          {selectedTemplate ? (
            <Button onClick={handleCreateFromTemplate} disabled={isCreating}>
              {isCreating ? t('templates.creating', { defaultValue: '创建中...' }) : t('templates.createFromTemplate', { defaultValue: '从模板创建' })}
            </Button>
          ) : (
            <Button onClick={handleCreateBlank} disabled={isCreating}>
              {isCreating ? t('templates.creating', { defaultValue: '创建中...' }) : t('templates.createBlankDoc', { defaultValue: '创建空白文档' })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
