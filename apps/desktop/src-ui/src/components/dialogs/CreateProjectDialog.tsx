/**
 * 创建项目弹窗 — 项目是纯容器，可选同时创建第一个文档的类型
 */
import { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { listDocTypes } from '@/doctype-sdk/registry';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** name, description, 首个文档类型（空字符串表示不创建文档） */
  onCreate: (name: string, description: string, firstDocType?: string) => void;
}

export function CreateProjectDialog({ open, onOpenChange, onCreate }: CreateProjectDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<string>('normal');

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, description.trim(), selectedDocType || undefined);
    setName('');
    setDescription('');
    setSelectedDocType('normal');
    onOpenChange(false);
  }, [name, description, selectedDocType, onCreate, onOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  }, [handleCreate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{t('dialog.createProject', { defaultValue: '创建项目' })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 -mx-6 px-6">
          {/* 首个文档类型选择 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              {t('dialog.firstDocType', { defaultValue: '首个文档类型' })}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {listDocTypes().map(dt => {
                const Icon = dt.icon;
                const isSelected = selectedDocType === dt.id;
                return (
                  <button
                    key={dt.id}
                    type="button"
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-pointer text-left',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                    onClick={() => setSelectedDocType(dt.id)}
                  >
                    <Icon className={cn('h-5 w-5 flex-shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    <div className="min-w-0">
                      <div className={cn('text-xs font-medium', isSelected ? 'text-primary' : 'text-foreground')}>
                        {t(dt.labelKey, { defaultValue: dt.id })}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {t(dt.descriptionKey, { defaultValue: '' })}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 项目名称 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="project-name-input">
              {t('dialog.projectName', { defaultValue: '项目名称' })}
            </label>
            <input
              id="project-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('dialog.generalNamePlaceholder', { defaultValue: '例如：我的项目' })}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="project-desc-input">
              {t('dialog.projectDescription', { defaultValue: '项目描述（可选）' })}
            </label>
            <textarea
              id="project-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('dialog.descriptionPlaceholder', { defaultValue: '简要描述项目内容...' })}
              rows={2}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!name.trim()}>
            {t('dialog.create', { defaultValue: '创建' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
