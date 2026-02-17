import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/stores/useAppStore';
import { useTranslation } from '@/i18n';
import { getTemplateCategories } from './constants';

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  documentId: string;
  documentTitle: string;
}

export function SaveAsTemplateDialog({ open, onOpenChange, projectId, documentId, documentTitle }: SaveAsTemplateDialogProps) {
  const { t } = useTranslation();
  const { saveAsTemplate, templateCategories } = useAppStore();
  const categories = getTemplateCategories(templateCategories);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [includeContent, setIncludeContent] = useState(false);
  const [includeAiContent, setIncludeAiContent] = useState(false);
  const [includePluginData, setIncludePluginData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const templateName = name.trim() || documentTitle;
    setIsSaving(true);
    try {
      await saveAsTemplate(projectId, documentId, templateName, description.trim(), category, includeContent, includeAiContent, includePluginData);
      onOpenChange(false);
      resetState();
    } catch (err) {
      console.error('Failed to save as template:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const resetState = () => {
    setName('');
    setDescription('');
    setCategory('general');
    setIncludeContent(false);
    setIncludeAiContent(false);
    setIncludePluginData(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('templates.saveAsTemplate', { defaultValue: '存为模板' })}</DialogTitle>
          <DialogDescription>{t('templates.saveAsDescription', { defaultValue: '将当前文档保存为可复用的模板' })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 模板名称 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('templates.templateNameLabel', { defaultValue: '模板名称' })}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={documentTitle || t('templates.templateNamePlaceholder', { defaultValue: '输入模板名称' })}
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('templates.descriptionLabel', { defaultValue: '描述' })}</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('templates.descriptionPlaceholder', { defaultValue: '简要描述模板用途（可选）' })}
            />
          </div>

          {/* 分类 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('templates.categoryLabel', { defaultValue: '分类' })}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {categories.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* 保留选项 */}
          <div className="space-y-3 pt-2 border-t">
            <div className="text-sm font-medium">{t('templates.retainContent', { defaultValue: '保留内容' })}</div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">{t('templates.retainPrompt', { defaultValue: '提示词' })}</label>
              <Switch checked={true} disabled />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">{t('templates.retainPluginSettings', { defaultValue: '插件设置' })}</label>
              <Switch checked={true} disabled />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">{t('templates.retainMaterial', { defaultValue: '素材内容' })}</label>
              <Switch checked={includeContent} onCheckedChange={setIncludeContent} />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">{t('templates.retainMainContent', { defaultValue: '正文内容' })}</label>
              <Switch checked={includeAiContent} onCheckedChange={setIncludeAiContent} />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">{t('templates.retainPluginData', { defaultValue: '插件数据' })}</label>
              <Switch checked={includePluginData} onCheckedChange={setIncludePluginData} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }}>
            {t('templates.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('templates.saving', { defaultValue: '保存中...' }) : t('templates.saveTemplate', { defaultValue: '保存模板' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
