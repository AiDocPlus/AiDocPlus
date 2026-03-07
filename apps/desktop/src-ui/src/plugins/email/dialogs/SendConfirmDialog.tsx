import {
  Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../_framework/ui';
import { Send, Users, AlertTriangle } from 'lucide-react';
import { useEmailContext } from '../EmailContext';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

export type EmailPriority = 'high' | 'normal' | 'low';

interface SendConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: () => void;
  onBulkSend: () => void;
  /** 使用当前编辑器内容创建群发任务（走群发引擎） */
  onCreateBulkJobFromCurrent?: () => void;
}

export function SendConfirmDialog({
  open, onOpenChange,
  onSend, onBulkSend: _onBulkSend, onCreateBulkJobFromCurrent,
}: SendConfirmDialogProps) {
  void _onBulkSend;
  const { state, t } = useEmailContext();
  const { accounts, selectedAccountId, recipients, cc, bcc, replyTo, subject, emailBody, emailFormat, attachments } = state;

  const emptySubject = !subject.trim();
  const emptyBody = !emailBody.trim();
  // F2: 附件遗忘检测
  const attachmentMentioned = attachments.length === 0 && /附件|attach|附上|随附|enclos/i.test(emailBody + ' ' + subject);

  const toCount = recipients.split(',').map(s => s.trim()).filter(Boolean).length;
  // H2: 正文摘要
  const bodySnippet = (() => {
    const plain = emailBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.length > 80 ? plain.slice(0, 80) + '…' : plain;
  })();
  // H2: 附件总大小
  const totalAttSize = attachments.reduce((sum, a) => sum + (a.size || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" style={DIALOG_STYLE}>
        <DialogHeader>
          <DialogTitle>{t('sendConfirmTitle')}</DialogTitle>
          <DialogDescription>{t('sendConfirmDesc')}</DialogDescription>
        </DialogHeader>
        {/* F5 + F2: 空主题/正文/附件遗忘警告 */}
        {(emptySubject || emptyBody || attachmentMentioned) && (
          <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {emptySubject && <div>{t('emptySubjectWarning')}</div>}
              {emptyBody && <div>{t('emptyBodyWarning')}</div>}
              {attachmentMentioned && <div>{t('attachmentForgottenWarning')}</div>}
            </div>
          </div>
        )}
        <div className="space-y-1.5 text-sm rounded-md border bg-muted/30 p-3 overflow-hidden">
          <div className="flex gap-2 min-w-0">
            <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmFrom')}</span>
            <span className="font-mono truncate">{accounts.find(a => a.id === selectedAccountId)?.email || '-'}</span>
          </div>
          <div className="flex gap-2 min-w-0">
            <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmTo')}</span>
            <span className="font-mono truncate">
              {recipients || '-'}
              {toCount > 1 && <span className="ml-1 text-xs text-muted-foreground">({toCount})</span>}
            </span>
          </div>
          {cc.trim() && (
            <div className="flex gap-2 min-w-0">
              <span className="text-muted-foreground w-16 flex-shrink-0">{t('cc')}</span>
              <span className="font-mono truncate">{cc}</span>
            </div>
          )}
          {bcc.trim() && (
            <div className="flex gap-2 min-w-0">
              <span className="text-muted-foreground w-16 flex-shrink-0">{t('bcc')}</span>
              <span className="font-mono truncate">{bcc}</span>
            </div>
          )}
          {replyTo.trim() && (
            <div className="flex gap-2 min-w-0">
              <span className="text-muted-foreground w-16 flex-shrink-0">{t('replyToLabel')}</span>
              <span className="font-mono truncate">{replyTo}</span>
            </div>
          )}
          <div className="flex gap-2 min-w-0">
            <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmSubject')}</span>
            <span className="truncate font-medium">{subject || '-'}</span>
          </div>
          {bodySnippet && (
            <div className="flex gap-2 min-w-0">
              <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmBody')}</span>
              <span className="text-xs text-muted-foreground italic truncate">{bodySnippet}</span>
            </div>
          )}
          {attachments.length > 0 && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmAttachments')}</span>
              <span>{t('sendConfirmAttCount', { count: attachments.length })}{totalAttSize > 0 && ` (${(totalAttSize / 1024 / 1024).toFixed(1)}MB)`}</span>
            </div>
          )}
          <div className="flex gap-2 min-w-0">
            <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmFormat')}</span>
            <span className="text-xs">{emailFormat === 'html' ? 'HTML' : t('plaintext')}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          {toCount > 1 && onCreateBulkJobFromCurrent && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
              title={t('bulkCreateFromCurrentDesc')}
              onClick={() => { onOpenChange(false); onCreateBulkJobFromCurrent(); }}>
              <Users className="h-3 w-3" />
              {t('bulkCreateFromCurrent')}
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { onOpenChange(false); onSend(); }}>
            <Send className="h-3 w-3" />
            {t('sendConfirmBtn')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
