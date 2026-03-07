import {
  Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../_framework/ui';
import { Loader2, Trash2, Clock } from 'lucide-react';
import { useEmailContext } from '../EmailContext';
import type { SendQueueItem } from '../sendQueue';
import { translateSmtpResult } from '../utils';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

interface QueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: SendQueueItem[];
  stats: { total: number; delayed: number; pending: number; sending: number; success: number; error: number };
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onCancelDelayed?: (id: string) => void;
}

export function QueueDialog({ open, onOpenChange, queue, stats, onRetry, onRemove, onClearCompleted, onCancelDelayed }: QueueDialogProps) {
  const { t } = useEmailContext();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col" style={DIALOG_STYLE}>
        <DialogHeader>
          <DialogTitle>{t('queueTitle')}</DialogTitle>
          <DialogDescription>
            {t('queueDesc', { total: queue.length, pending: stats.pending, sending: stats.sending, success: stats.success, error: stats.error })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {queue.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">{t('queueEmpty')}</div>
          ) : queue.map(item => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group">
              <div className="flex-shrink-0">
                {item.status === 'delayed' && <Clock className="h-3 w-3 text-orange-400" />}
                {item.status === 'pending' && <div className="h-2 w-2 rounded-full bg-yellow-400" />}
                {item.status === 'sending' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                {item.status === 'success' && <div className="h-2 w-2 rounded-full bg-green-500" />}
                {item.status === 'error' && <div className="h-2 w-2 rounded-full bg-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{item.to.join(', ')}</div>
                <div className="text-xs text-muted-foreground truncate">{item.subject}</div>
                {item.status === 'error' && item.errorMsg && (
                  <div className="text-xs text-destructive truncate">{translateSmtpResult(item.errorMsg, t)}</div>
                )}
                {item.retryCount > 0 && item.status !== 'error' && (
                  <div className="text-xs text-muted-foreground">{t('queueRetrying', { count: item.retryCount })}</div>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
                {item.status === 'delayed' && onCancelDelayed && (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-orange-500 hover:text-orange-600" onClick={() => onCancelDelayed(item.id)}>
                    {t('sendCancel')}
                  </Button>
                )}
                {item.status === 'error' && (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => onRetry(item.id)}>
                    {t('queueRetry')}
                  </Button>
                )}
                {(item.status === 'error' || item.status === 'success') && (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => onRemove(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        {(stats.success > 0 || stats.error > 0) && (
          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClearCompleted}>
              {t('queueClearCompleted')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
