import { useState } from 'react';
import {
  Button, ScrollArea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../_framework/ui';
import { Play, Pause, RotateCcw, Trash2, X, ChevronDown, ChevronUp, Plus, Loader2 } from 'lucide-react';
import type { BulkSendJob, BulkRecipient } from '../types';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

type JobStatus = BulkSendJob['status'];

const STATUS_ORDER: Record<JobStatus, number> = {
  sending: 0,
  paused: 1,
  draft: 2,
  completed: 3,
  cancelled: 4,
};

interface BulkJobManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: BulkSendJob[];
  activeJobId?: string;
  onStart: (job: BulkSendJob) => void;
  onPause: (jobId: string) => void;
  onResume: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onRetryFailed: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onNewJob: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function statusColor(status: JobStatus): string {
  switch (status) {
    case 'sending': return 'text-blue-600 dark:text-blue-400';
    case 'paused': return 'text-amber-600 dark:text-amber-400';
    case 'draft': return 'text-muted-foreground';
    case 'completed': return 'text-green-600 dark:text-green-400';
    case 'cancelled': return 'text-red-500';
    default: return '';
  }
}

function statusBgColor(status: JobStatus): string {
  switch (status) {
    case 'sending': return 'bg-blue-500';
    case 'paused': return 'bg-amber-500';
    case 'completed': return 'bg-green-500';
    case 'cancelled': return 'bg-red-500';
    default: return 'bg-muted-foreground';
  }
}

function recipientStatusIcon(status: BulkRecipient['status']): string {
  switch (status) {
    case 'sent': return '✓';
    case 'failed': return '✗';
    case 'queued': return '⏳';
    case 'skipped': return '—';
    default: return '○';
  }
}

function recipientStatusColor(status: BulkRecipient['status']): string {
  switch (status) {
    case 'sent': return 'text-green-600 dark:text-green-400';
    case 'failed': return 'text-red-500';
    case 'queued': return 'text-blue-500';
    case 'skipped': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
}

export function BulkJobManagerDialog({
  open, onOpenChange, jobs, activeJobId,
  onStart, onPause, onResume, onCancel, onRetryFailed, onDelete,
  onNewJob, t,
}: BulkJobManagerDialogProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'cancel' | 'delete'; jobId: string } | null>(null);

  const sortedJobs = [...jobs].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt - a.createdAt);

  const handleAction = (type: 'cancel' | 'delete', jobId: string) => {
    setConfirmAction({ type, jobId });
  };

  const confirmAndExecute = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'cancel') onCancel(confirmAction.jobId);
    else onDelete(confirmAction.jobId);
    setConfirmAction(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[80vh] overflow-hidden flex flex-col" style={DIALOG_STYLE}>
        <DialogHeader>
          <DialogTitle>{t('bulkManagerTitle')}</DialogTitle>
          <DialogDescription>{t('bulkManagerDesc', { count: jobs.length })}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { onNewJob(); onOpenChange(false); }}>
            <Plus className="h-3 w-3" />
            {t('bulkNewJob')}
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {sortedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('bulkNoJobs')}</p>
          ) : (
            <div className="space-y-2 pr-2">
              {sortedJobs.map(job => {
                const isExpanded = expandedJobId === job.id;
                const progress = job.progress || { total: job.recipients.length, sent: 0, failed: 0 };
                const pct = progress.total > 0 ? Math.round((progress.sent / progress.total) * 100) : 0;
                const hasFailed = progress.failed > 0;
                const isActive = job.id === activeJobId;

                return (
                  <div key={job.id} className={`border rounded-md overflow-hidden ${isActive ? 'ring-1 ring-blue-500/50' : ''}`}>
                    {/* 任务卡片头部 */}
                    <div className="px-3 py-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {/* 状态点 */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusBgColor(job.status)} ${job.status === 'sending' ? 'animate-pulse' : ''}`} />
                        {/* 名称 */}
                        <span className="text-sm font-medium truncate flex-1">{job.name}</span>
                        {/* 状态文字 */}
                        <span className={`text-xs font-medium ${statusColor(job.status)}`}>
                          {job.status === 'sending' && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
                          {t(`bulkStatus${job.status.charAt(0).toUpperCase() + job.status.slice(1)}`)}
                        </span>
                      </div>

                      {/* 进度条 */}
                      {(job.status === 'sending' || job.status === 'paused' || job.status === 'completed') && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full flex">
                              <div className="bg-green-500 transition-all" style={{ width: `${progress.total > 0 ? (progress.sent / progress.total) * 100 : 0}%` }} />
                              <div className="bg-red-500 transition-all" style={{ width: `${progress.total > 0 ? (progress.failed / progress.total) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                        </div>
                      )}

                      {/* 统计行 */}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{t('bulkProgress', { sent: progress.sent, total: progress.total })}</span>
                        {hasFailed && <span className="text-red-500">{t('bulkProgressFailed', { failed: progress.failed })}</span>}
                        <span className="flex-1" />
                        <span>{t('bulkCreatedAt', { time: formatTime(job.createdAt) })}</span>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1 pt-0.5">
                        {job.status === 'draft' && (
                          <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => onStart(job)}>
                            <Play className="h-3 w-3" />{t('bulkStartBtn')}
                          </Button>
                        )}
                        {job.status === 'sending' && (
                          <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => onPause(job.id)}>
                            <Pause className="h-3 w-3" />{t('bulkPauseBtn')}
                          </Button>
                        )}
                        {job.status === 'paused' && (
                          <>
                            <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => onResume(job.id)}>
                              <Play className="h-3 w-3" />{t('bulkResumeBtn')}
                            </Button>
                            <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1 text-red-500 hover:text-red-600"
                              onClick={() => handleAction('cancel', job.id)}>
                              <X className="h-3 w-3" />{t('bulkCancelBtn')}
                            </Button>
                          </>
                        )}
                        {hasFailed && (job.status === 'completed' || job.status === 'paused') && (
                          <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => onRetryFailed(job.id)}>
                            <RotateCcw className="h-3 w-3" />{t('bulkRetryFailed')}
                          </Button>
                        )}
                        {(job.status === 'completed' || job.status === 'cancelled' || job.status === 'draft') && (
                          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-destructive hover:text-destructive"
                            onClick={() => handleAction('delete', job.id)}>
                            <Trash2 className="h-3 w-3" />{t('bulkDeleteJob')}
                          </Button>
                        )}
                        <span className="flex-1" />
                        {/* 展开/收起收件人 */}
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-muted-foreground"
                          onClick={() => setExpandedJobId(isExpanded ? null : job.id)}>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isExpanded ? t('bulkCollapseRecipients') : t('bulkExpandRecipients')}
                        </Button>
                      </div>
                    </div>

                    {/* 收件人详情 */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20 max-h-[200px] overflow-y-auto">
                        <div className="divide-y">
                          {job.recipients.map((r, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1 text-xs">
                              <span className={`w-4 text-center ${recipientStatusColor(r.status)}`}>
                                {recipientStatusIcon(r.status)}
                              </span>
                              <span className="truncate flex-1 font-mono">{r.email}</span>
                              {r.name && <span className="text-muted-foreground truncate max-w-[100px]">{r.name}</span>}
                              <span className={`text-[10px] ${recipientStatusColor(r.status)}`}>
                                {t(`bulkRecipient${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`)}
                              </span>
                              {r.error && <span className="text-[10px] text-red-500 truncate max-w-[150px]" title={r.error}>{r.error}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* 确认对话框 */}
        {confirmAction && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs">
            <span className="flex-1">
              {confirmAction.type === 'cancel' ? t('bulkConfirmCancel') : t('bulkConfirmDelete')}
            </span>
            <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => setConfirmAction(null)}>
              {t('bulkSendCancel')}
            </Button>
            <Button variant="destructive" size="sm" className="h-6 text-[11px]" onClick={confirmAndExecute}>
              {confirmAction.type === 'cancel' ? t('bulkCancelBtn') : t('bulkDeleteJob')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
