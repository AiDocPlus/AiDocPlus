/**
 * TaskListSettingsDialog — 默认优先级、已完成显示、保留天数、排序偏好
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Hash } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TaskListSettings } from './types';
import { DEFAULT_TASKLIST_SETTINGS } from './types';

interface TaskListSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: TaskListSettings;
  onSettingsChange: (settings: TaskListSettings) => void;
}

export function TaskListSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: TaskListSettingsDialogProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<TaskListSettings>(() => ({
    ...DEFAULT_TASKLIST_SETTINGS,
    ...settings,
  }));

  useEffect(() => {
    setLocal({ ...DEFAULT_TASKLIST_SETTINGS, ...settings });
  }, [settings, open]);

  const handleSave = () => {
    onSettingsChange(local);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('taskList.settingsTitle', { defaultValue: '任务清单设置' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('taskList.defaultPriority', { defaultValue: '新建任务默认优先级' })}</Label>
            <Select
              value={local.defaultPriority}
              onValueChange={(v) =>
                setLocal((s) => ({ ...s, defaultPriority: v as TaskListSettings['defaultPriority'] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">{t('taskList.priorityHigh', { defaultValue: '高' })}</SelectItem>
                <SelectItem value="medium">{t('taskList.priorityMedium', { defaultValue: '中' })}</SelectItem>
                <SelectItem value="low">{t('taskList.priorityLow', { defaultValue: '低' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>{t('taskList.showCompleted', { defaultValue: '显示已完成任务区' })}</Label>
              <p className="text-xs text-muted-foreground">
                {t('taskList.showCompletedHint', { defaultValue: '关闭后列表中不再展示已完成区块' })}
              </p>
            </div>
            <Switch
              checked={local.showCompleted}
              onCheckedChange={(v) => setLocal((s) => ({ ...s, showCompleted: v }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" />
              {t('taskList.completedRetentionDays', { defaultValue: '已完成任务保留天数' })}
            </Label>
            <Input
              type="number"
              min={0}
              max={3650}
              value={local.completedRetentionDays}
              onChange={(e) =>
                setLocal((s) => ({
                  ...s,
                  completedRetentionDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('taskList.completedRetentionHint', { defaultValue: '0 表示不自动按天数清理（仍可在解析时归一化）' })}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('taskList.defaultSort', { defaultValue: '默认排序方式' })}</Label>
            <Select
              value={local.sortBy}
              onValueChange={(v) =>
                setLocal((s) => ({ ...s, sortBy: v as TaskListSettings['sortBy'] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sortOrder">{t('taskList.sortByManual', { defaultValue: '按手动顺序' })}</SelectItem>
                <SelectItem value="priority">{t('taskList.sortByPriority', { defaultValue: '按优先级' })}</SelectItem>
                <SelectItem value="createdAt">{t('taskList.sortByCreated', { defaultValue: '按创建时间' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('taskList.sortOrderLabel', { defaultValue: '排序方向' })}</Label>
            <Select
              value={local.sortOrder}
              onValueChange={(v) => setLocal((s) => ({ ...s, sortOrder: v as 'asc' | 'desc' }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">{t('taskList.sortAsc', { defaultValue: '升序' })}</SelectItem>
                <SelectItem value="desc">{t('taskList.sortDesc', { defaultValue: '降序' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={handleSave}>{t('common.save', { defaultValue: '保存' })}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
