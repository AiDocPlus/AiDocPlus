/**
 * TranslationSettingsDialog — 翻译文档设置对话框
 * 配置默认翻译风格、保留格式、自动保存、字体大小
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Languages, Type, Zap, AlignLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TranslationSettings } from './types';
import { DEFAULT_TRANSLATION_SETTINGS, TRANSLATION_STYLES } from './types';

interface TranslationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: TranslationSettings;
  onSettingsChange: (settings: TranslationSettings) => void;
}

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中（默认）' },
  { value: 'large', label: '大' },
];

export function TranslationSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: TranslationSettingsDialogProps) {
  const { t } = useTranslation();
  const [localSettings, setLocalSettings] = useState<TranslationSettings>(
    () => ({ ...DEFAULT_TRANSLATION_SETTINGS, ...settings }),
  );

  useEffect(() => {
    setLocalSettings({ ...DEFAULT_TRANSLATION_SETTINGS, ...settings });
  }, [settings, open]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalSettings({ ...DEFAULT_TRANSLATION_SETTINGS });
  };

  const updateSetting = <K extends keyof TranslationSettings>(
    key: K,
    value: TranslationSettings[K],
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('translation.settingsTitle', { defaultValue: '翻译设置' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 默认翻译风格 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Languages className="h-3.5 w-3.5 text-muted-foreground" />
              {t('translation.defaultStyle', { defaultValue: '默认翻译风格' })}
            </Label>
            <Select
              value={localSettings.defaultStyle}
              onValueChange={(v) => updateSetting('defaultStyle', v as TranslationSettings['defaultStyle'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_STYLES.map(style => (
                  <SelectItem key={style.value} value={style.value}>
                    {t(style.labelKey, { defaultValue: style.defaultLabel })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('translation.defaultStyleHint', { defaultValue: '一键翻译时将使用此风格。AI 侧栏可单独选择场景。' })}
            </p>
          </div>

          {/* 保留格式 */}
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
              {t('translation.preserveFormatting', { defaultValue: '保留原文格式' })}
            </Label>
            <Switch
              checked={localSettings.preserveFormatting}
              onCheckedChange={(checked) => updateSetting('preserveFormatting', checked)}
            />
          </div>
          <p className="text-xs text-muted-foreground -mt-4">
            {t('translation.preserveFormattingHint', { defaultValue: '翻译时尝试保持原文的段落结构和标记格式' })}
          </p>

          {/* 自动保存 */}
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              {t('translation.autoSave', { defaultValue: '自动保存' })}
            </Label>
            <Switch
              checked={localSettings.autoSave}
              onCheckedChange={(checked) => updateSetting('autoSave', checked)}
            />
          </div>
          <p className="text-xs text-muted-foreground -mt-4">
            {t('translation.autoSaveHint', { defaultValue: '编辑后自动保存（3 秒延迟）' })}
          </p>

          {/* 字体大小 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Type className="h-3.5 w-3.5 text-muted-foreground" />
              {t('translation.fontSize', { defaultValue: '编辑器字体大小' })}
            </Label>
            <Select
              value={localSettings.fontSize}
              onValueChange={(v) => updateSetting('fontSize', v as TranslationSettings['fontSize'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            {t('common.reset', { defaultValue: '重置' })}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel', { defaultValue: '取消' })}
            </Button>
            <Button size="sm" onClick={handleSave}>
              {t('common.save', { defaultValue: '保存' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TranslationSettingsDialog;
