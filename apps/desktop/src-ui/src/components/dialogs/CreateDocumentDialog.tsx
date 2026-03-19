/**
 * 新建文档对话框 — 左边树状分类 + 右侧选择面板 + 搜索
 * 支持上千种文档类型的高效浏览
 */
import { useState, useCallback, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { listDocTypes } from '@/doctype-sdk/registry';
import type { DocTypeCategory } from '@/doctype-sdk/types';

interface CreateDocumentDialogProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreate: (projectId: string, title: string, docType: string) => void;
}

const CATEGORY_ORDER: { key: DocTypeCategory | 'all'; labelKey: string; defaultLabel: string }[] = [
  { key: 'all', labelKey: 'dialog.categoryAll', defaultLabel: '全部' },
  { key: 'writing', labelKey: 'dialog.categoryWriting', defaultLabel: '写作' },
  { key: 'creative', labelKey: 'dialog.categoryCreative', defaultLabel: '创作' },
  { key: 'business', labelKey: 'dialog.categoryBusiness', defaultLabel: '商务' },
  { key: 'academic', labelKey: 'dialog.categoryAcademic', defaultLabel: '学术' },
  { key: 'other', labelKey: 'dialog.categoryOther', defaultLabel: '其他' },
];

export function CreateDocumentDialog({ open, projectId, onClose, onCreate }: CreateDocumentDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState('normal');
  const [selectedCategory, setSelectedCategory] = useState<DocTypeCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allDocTypes = listDocTypes();

  // 按分类和搜索过滤
  const filteredDocTypes = useMemo(() => {
    let list = selectedCategory === 'all' ? allDocTypes : allDocTypes.filter(dt => dt.category === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(dt =>
        t(dt.labelKey, { defaultValue: dt.id }).toLowerCase().includes(q) ||
        t(dt.descriptionKey, { defaultValue: '' }).toLowerCase().includes(q) ||
        dt.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allDocTypes, selectedCategory, searchQuery, t]);

  // 每个分类的数量（用于树节点显示）
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allDocTypes.length };
    for (const dt of allDocTypes) {
      counts[dt.category] = (counts[dt.category] || 0) + 1;
    }
    return counts;
  }, [allDocTypes]);

  // 选中类型时设置默认文档名
  const handleSelectType = useCallback((typeId: string) => {
    setSelectedType(typeId);
    const dt = allDocTypes.find(d => d.id === typeId);
    if (dt) {
      const typeName = t(dt.labelKey, { defaultValue: dt.id });
      setTitle(typeName);
    }
  }, [allDocTypes, t]);

  const handleCreate = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(projectId, trimmed, selectedType);
    setTitle('');
    setSelectedType('normal');
    setSearchQuery('');
    setSelectedCategory('all');
    onClose();
  }, [title, selectedType, projectId, onCreate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="border rounded-lg shadow-xl w-[680px] max-w-[95vw] h-[520px] max-h-[85vh] flex flex-col"
        style={{ backgroundColor: 'hsl(var(--card))', opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
          <h2 className="text-base font-semibold">
            {t('dialog.newDocument', { defaultValue: '新建文档' })}
          </h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 主内容区：左侧分类树 + 右侧选择面板 */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 左侧：分类树 */}
          <div className="w-[150px] border-r flex-shrink-0 overflow-auto py-2">
            {CATEGORY_ORDER.map(cat => {
              const count = categoryCounts[cat.key] || 0;
              if (cat.key !== 'all' && count === 0) return null;
              return (
                <button
                  key={cat.key}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm transition-colors',
                    selectedCategory === cat.key
                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium'
                      : 'hover:bg-muted text-muted-foreground'
                  )}
                  onClick={() => setSelectedCategory(cat.key)}
                >
                  <span>{t(cat.labelKey, { defaultValue: cat.defaultLabel })}</span>
                  <span className="ml-1 text-xs opacity-50">({count})</span>
                </button>
              );
            })}
          </div>

          {/* 右侧：搜索 + 类型网格 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 搜索栏 */}
            <div className="px-3 py-2 border-b flex-shrink-0">
              <div className="flex items-center gap-2 px-2.5 py-1.5 border rounded-md bg-background">
                <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('dialog.searchDocType', { defaultValue: '搜索文档类型...' })}
                  className="flex-1 text-sm bg-transparent border-none outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 类型列表 */}
            <div className="flex-1 overflow-auto p-3">
              {filteredDocTypes.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  {t('dialog.noMatchingTypes', { defaultValue: '没有匹配的文档类型' })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredDocTypes.map(dt => {
                    const Icon = dt.icon;
                    const isSelected = selectedType === dt.id;
                    return (
                      <button
                        key={dt.id}
                        type="button"
                        className={cn(
                          'flex items-center gap-2.5 p-3 rounded-lg border transition-all cursor-pointer text-left',
                          isSelected
                            ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/30'
                            : 'border-border hover:border-blue-300 hover:bg-blue-500/5'
                        )}
                        onClick={() => handleSelectType(dt.id)}
                        onDoubleClick={() => { handleSelectType(dt.id); handleCreate(); }}
                      >
                        <Icon className={cn('h-6 w-6 flex-shrink-0', isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground')} />
                        <div className="min-w-0 flex-1">
                          <div className={cn('text-sm font-medium', isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-foreground')}>
                            {t(dt.labelKey, { defaultValue: dt.id })}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {t(dt.descriptionKey, { defaultValue: '' })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部：文档标题 + 按钮 */}
        <div className="flex items-center gap-3 px-5 py-3 border-t flex-shrink-0">
          <label className="text-sm text-muted-foreground flex-shrink-0" htmlFor="doc-title-input">
            {t('dialog.docTitle', { defaultValue: '标题' })}
          </label>
          <input
            id="doc-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }}
            placeholder={t('dialog.docTitlePlaceholder', { defaultValue: '输入文档标题...' })}
            className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!title.trim()}>
            {t('dialog.create', { defaultValue: '创建' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
