/**
 * 批量删除选中任务 — 确认对话框
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TaskListBulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
}

export function TaskListBulkDeleteDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: TaskListBulkDeleteDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {t('taskList.bulkDeleteConfirmTitle', { defaultValue: '删除选中任务？' })}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {t('taskList.bulkDeleteConfirmBody', {
            count,
            defaultValue:
              '将永久删除已选中的 {{count}} 条任务，可通过撤销立即恢复。',
          })}
        </DialogDescription>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={count < 1}
            onClick={() => {
              if (count < 1) return;
              onConfirm();
              onOpenChange(false);
            }}
          >
            {t('taskList.bulkDeleteConfirmAction', { defaultValue: '删除' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
