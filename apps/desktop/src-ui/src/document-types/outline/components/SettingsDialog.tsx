/**
 * 设置对话框
 *
 * 配置大纲编辑器的显示和行为选项
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Settings, RotateCcw } from 'lucide-react';

import type { OutlineSettings } from '../types';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: OutlineSettings;
  onSettingsChange: (settings: OutlineSettings) => void;
}

const DEFAULT_SETTINGS: OutlineSettings = {
  fontSize: 14,
  lineSpacing: 'normal',
  showGuideLines: true,
  showNotes: 'all',
  autoSave: true,
  showWordCount: true,
  showProgress: true,
};

export function SettingsDialog({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: SettingsDialogProps) {
  const { t } = useTranslation();
  const [localSettings, setLocalSettings] = useState<OutlineSettings>(settings);

  // 重置为默认设置
  const handleReset = useCallback(() => {
    setLocalSettings(DEFAULT_SETTINGS);
  }, []);

  // 保存设置
  const handleSave = useCallback(() => {
    onSettingsChange(localSettings);
    onClose();
  }, [localSettings, onSettingsChange, onClose]);

  // 更新单个设置
  const updateSetting = useCallback(<K extends keyof OutlineSettings>(
    key: K,
    value: OutlineSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('outline.settings.title', { defaultValue: '大纲设置' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 字体大小 */}
          <div className="space-y-2">
            <Label>
              {t('outline.settings.fontSize', { defaultValue: '字体大小' })}: {localSettings.fontSize}px
            </Label>
            <Slider
              value={[localSettings.fontSize]}
              onValueChange={([value]) => updateSetting('fontSize', value)}
              min={12}
              max={24}
              step={1}
            />
          </div>

          {/* 行间距 */}
          <div className="space-y-2">
            <Label>
              {t('outline.settings.lineSpacing', { defaultValue: '行间距' })}
            </Label>
            <RadioGroup
              value={localSettings.lineSpacing}
              onValueChange={(value) =>
                updateSetting('lineSpacing', value as 'compact' | 'normal' | 'loose')
              }
              className="flex gap-4"
            >
              <Label
                htmlFor="spacing-compact"
                className="flex items-center gap-2 cursor-pointer"
              >
                <RadioGroupItem value="compact" id="spacing-compact" />
                {t('outline.settings.compact', { defaultValue: '紧凑' })}
              </Label>
              <Label
                htmlFor="spacing-normal"
                className="flex items-center gap-2 cursor-pointer"
              >
                <RadioGroupItem value="normal" id="spacing-normal" />
                {t('outline.settings.normal', { defaultValue: '标准' })}
              </Label>
              <Label
                htmlFor="spacing-loose"
                className="flex items-center gap-2 cursor-pointer"
              >
                <RadioGroupItem value="loose" id="spacing-loose" />
                {t('outline.settings.loose', { defaultValue: '宽松' })}
              </Label>
            </RadioGroup>
          </div>

          <Separator />

          {/* 引导线 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="guide-lines">
              {t('outline.settings.showGuideLines', { defaultValue: '显示层级引导线' })}
            </Label>
            <Switch
              id="guide-lines"
              checked={localSettings.showGuideLines}
              onCheckedChange={(checked) => updateSetting('showGuideLines', checked)}
            />
          </div>

          {/* 备注显示 */}
          <div className="space-y-2">
            <Label>
              {t('outline.settings.showNotes', { defaultValue: '备注显示' })}
            </Label>
            <Select
              value={localSettings.showNotes}
              onValueChange={(value) =>
                updateSetting('showNotes', value as 'all' | 'hover' | 'active')
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('outline.settings.showNotesAll', { defaultValue: '始终显示' })}
                </SelectItem>
                <SelectItem value="hover">
                  {t('outline.settings.showNotesHover', { defaultValue: '悬浮时显示' })}
                </SelectItem>
                <SelectItem value="active">
                  {t('outline.settings.showNotesActive', { defaultValue: '激活时显示' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* 自动保存 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-save">
              {t('outline.settings.autoSave', { defaultValue: '自动保存' })}
            </Label>
            <Switch
              id="auto-save"
              checked={localSettings.autoSave}
              onCheckedChange={(checked) => updateSetting('autoSave', checked)}
            />
          </div>

          {/* 字数统计 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="word-count">
              {t('outline.settings.showWordCount', { defaultValue: '显示字数统计' })}
            </Label>
            <Switch
              id="word-count"
              checked={localSettings.showWordCount}
              onCheckedChange={(checked) => updateSetting('showWordCount', checked)}
            />
          </div>

          {/* 进度显示 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="show-progress">
              {t('outline.settings.showProgress', { defaultValue: '显示完成进度' })}
            </Label>
            <Switch
              id="show-progress"
              checked={localSettings.showProgress}
              onCheckedChange={(checked) => updateSetting('showProgress', checked)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('outline.settings.reset', { defaultValue: '恢复默认' })}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={handleSave}>
            {t('common.save', { defaultValue: '保存' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
