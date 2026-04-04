/**
 * TaskListImportDialog — 从文本导入任务
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TaskItem, TaskPriority } from './types';
import { createEmptyTask } from './types';

interface TaskListImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (tasks: TaskItem[]) => void;
  defaultPriority: TaskPriority;
}

/** 解析文本行为 TaskItem[]，自动识别优先级前缀和完成标记 */
function parseTextToTasks(text: string, defaultPriority: TaskPriority): TaskItem[] {
  const lines = text.split('\n');
  const tasks: TaskItem[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    let priority = defaultPriority;
    let status: 'pending' | 'completed' = 'pending';
    let content = line;

    // 去除常见列表前缀
    // - [高] / [中] / [低] / [High] / [Medium] / [Low]
    const prioMatch = content.match(/^[\-\*]\s*\[(高|中|低|High|Medium|Low)\]\s*/i);
    if (prioMatch) {
      const label = prioMatch[1].toLowerCase();
      if (label === '高' || label === 'high') priority = 'high';
      else if (label === '低' || label === 'low') priority = 'low';
      else priority = 'medium';
      content = content.slice(prioMatch[0].length).trim();
    }

    // - [x] / - [ ] 标记完成
    const checkMatch = content.match(/^[\-\*]\s*\[(x|X| )\]\s*/);
    if (checkMatch) {
      const marker = checkMatch[1].trim().toLowerCase();
      status = marker === 'x' ? 'completed' : 'pending';
      content = content.slice(checkMatch[0].length).trim();
    } else {
      // - 或 * 前缀
      content = content.replace(/^[\-\*]\s+/, '');
    }

    if (!content) continue;

    tasks.push({
      ...createEmptyTask(priority),
      content,
      status,
    });
  }

  return tasks;
}

export function TaskListImportDialog({
  open,
  onOpenChange,
  onImport,
  defaultPriority,
}: TaskListImportDialogProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(defaultPriority);
  const [importing, setImporting] = useState(false);

  const parsedTasks = useMemo(() => parseTextToTasks(text, priority), [text, priority]);
  const taskCount = parsedTasks.length;

  const handleImport = useCallback(async () => {
    if (taskCount === 0) return;
    setImporting(true);
    try {
      onImport(parsedTasks);
      setText('');
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  }, [taskCount, parsedTasks, onImport, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[75vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('taskList.importTitle', { defaultValue: '导入任务' })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 flex-1 min-h-0">
          <Textarea
            className="min-h-[160px] text-sm resize-none font-mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('taskList.importPlaceholder', {
              defaultValue: '每行一个任务，粘贴多行文本…',
            })}
          />

          <p className="text-xs text-muted-foreground">
            {t('taskList.importHint', {
              defaultValue:
                '支持自动识别：以 [高]/[中]/[低] 开头设置优先级，以 - [x] 开头标记为已完成',
            })}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {t('taskList.importPriority', { defaultValue: '默认优先级' })}
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
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
            <div className="flex items-end">
              <div className="text-sm tabular-nums">
                {taskCount > 0
                  ? t('taskList.importCount', { count: taskCount, defaultValue: `将导入 ${taskCount} 条任务` })
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={() => void handleImport()} disabled={taskCount === 0 || importing}>
            {importing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {t('taskList.importButton', { defaultValue: '导入' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
