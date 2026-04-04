/**
 * TaskListHelpDialog — 快捷键与使用说明
 */
import { useTranslation } from 'react-i18next';
import { HelpCircle, Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TaskListHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskListHelpDialog({ open, onOpenChange }: TaskListHelpDialogProps) {
  const { t } = useTranslation();

  const rows: { keys: string; desc: string }[] = [
    {
      keys: '⌘/Ctrl + S',
      desc: t('taskList.helpSave', { defaultValue: '保存当前文档' }),
    },
    {
      keys: '⇧ + ⌘/Ctrl + S',
      desc: t('taskList.helpSaveAll', { defaultValue: '保存全部已修改标签页' }),
    },
    {
      keys: '⌘/Ctrl + K',
      desc: t('taskList.helpCommandPalette', { defaultValue: '打开快捷操作搜索（AI 侧栏中）' }),
    },
    {
      keys: 'Escape',
      desc: t('taskList.helpEscape', {
        defaultValue: '取消多选（非编辑/输入状态时）',
      }),
    },
    {
      keys: '⌘/Ctrl + F',
      desc: t('taskList.helpSearchFocus', {
        defaultValue: '聚焦工具栏任务搜索框',
      }),
    },
    {
      keys: 'Enter',
      desc: t('taskList.helpNewTask', { defaultValue: '在列表末尾添加新任务' }),
    },
    {
      keys: '⌘/Ctrl + A',
      desc: t('taskList.helpSelectAll', { defaultValue: '全选可见任务' }),
    },
    {
      keys: 'Space',
      desc: t('taskList.helpToggleComplete', {
        defaultValue: '切换已选任务完成状态',
      }),
    },
    {
      keys: '1 / 2 / 3',
      desc: t('taskList.helpPriorityKeys', {
        defaultValue: '设置已选任务优先级（高/中/低）',
      }),
    },
    {
      keys: 'Backspace',
      desc: t('taskList.helpDeleteEmpty', {
        defaultValue: '删除内容为空的任务（编辑时）',
      }),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            {t('taskList.helpTitle', { defaultValue: '任务清单帮助' })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {t('taskList.helpIntro', {
              defaultValue: '支持多列表、拖拽排序、优先级与筛选；AI 侧栏可解析 ```tasks``` 代码块并一键插入任务。',
            })}
          </p>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Keyboard className="h-4 w-4" />
            {t('taskList.helpShortcuts', { defaultValue: '快捷键' })}
          </div>
          <ul className="space-y-2 border rounded-md divide-y">
            {rows.map((r) => (
              <li key={r.keys} className="flex flex-col sm:flex-row sm:items-center gap-1 px-3 py-2">
                <kbd className="shrink-0 text-xs font-mono bg-muted px-2 py-0.5 rounded">{r.keys}</kbd>
                <span className="text-muted-foreground">{r.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
