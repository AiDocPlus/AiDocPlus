import { useState } from 'react';
import {
  Button, Input,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../_framework/ui';
import { ChevronDown, ChevronUp, Trash2, RotateCcw } from 'lucide-react';
import { useEmailContext } from '../EmailContext';
import type { EmailStorageData } from '../types';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResend?: (entry: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; accountId: string }) => void;
}

export function HistoryDialog({ open, onOpenChange, onResend }: HistoryDialogProps) {
  const { saveToStorage, t, host } = useEmailContext();

  const stored = host.storage.get<EmailStorageData>('emailData') || {};
  const sendHistory = stored.sendHistory || [];

  const [previewTimestamp, setPreviewTimestamp] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'normal' | 'bulk'>('all');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[80vh] overflow-hidden flex flex-col" style={DIALOG_STYLE}>
        <DialogHeader>
          <DialogTitle>{t('historyTitle')}</DialogTitle>
          <DialogDescription>{t('historyDesc', { count: sendHistory.length })}</DialogDescription>
        </DialogHeader>
        {sendHistory.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Input placeholder={t('historySearch')} value={searchText}
              onChange={e => { setSearchText(e.target.value); setPreviewTimestamp(null); }} className="h-8 text-sm flex-1" />
            <div className="flex gap-0.5 flex-shrink-0">
              {(['all', 'normal', 'bulk'] as const).map(f => (
                <Button key={f} variant={historyFilter === f ? 'secondary' : 'ghost'} size="sm"
                  className="h-7 text-[11px] px-2" onClick={() => { setHistoryFilter(f); setPreviewTimestamp(null); }}>
                  {t(`historyFilter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pt-1">
          {sendHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('historyEmpty')}</p>
          ) : (
            sendHistory.filter(item => {
              if (historyFilter === 'bulk' && !item.bulkJobId) return false;
              if (historyFilter === 'normal' && item.bulkJobId) return false;
              if (!searchText.trim()) return true;
              const q = searchText.toLowerCase();
              return (item.subject || '').toLowerCase().includes(q)
                || (item.to || []).some(a => a.toLowerCase().includes(q))
                || (item.cc || []).some(a => a.toLowerCase().includes(q))
                || (item.accountEmail || '').toLowerCase().includes(q)
                || (item.bulkJobName || '').toLowerCase().includes(q);
            }).map((item) => {
              const isExpanded = previewTimestamp === item.timestamp;
              const date = new Date(item.timestamp);
              const timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
              return (
                <div key={item.timestamp} className="border rounded-md overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                    onClick={() => setPreviewTimestamp(isExpanded ? null : item.timestamp)}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{item.subject || t('historyNoSubject')}</span>
                        {item.bulkJobName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
                            {t('historyBulkJob')}: {item.bulkJobName}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t('to')}: {item.to?.join(', ')}
                        {item.cc?.length ? ` | CC: ${item.cc.join(', ')}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{timeStr}</span>
                      <span className={`text-xs ${item.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {item.status === 'success' ? t('historySendSuccess') : t('historySendFailed')}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  </div>
                  {isExpanded && (
                    <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        {item.accountEmail && (
                          <><span className="text-muted-foreground">{t('historyFrom')}:</span><span className="font-mono">{item.accountEmail}</span></>
                        )}
                        <span className="text-muted-foreground">{t('to')}:</span><span className="font-mono">{item.to?.join(', ')}</span>
                        {item.cc?.length ? (<><span className="text-muted-foreground">CC:</span><span className="font-mono">{item.cc.join(', ')}</span></>) : null}
                        {item.bcc?.length ? (<><span className="text-muted-foreground">BCC:</span><span className="font-mono">{item.bcc.join(', ')}</span></>) : null}
                        {item.statusMsg && (
                          <><span className="text-muted-foreground">{t('historyResult')}:</span><span className={item.status === 'error' ? 'text-red-500' : ''}>{item.statusMsg}</span></>
                        )}
                      </div>
                      {item.body && (
                        <div className="border rounded bg-background p-2 max-h-[200px] overflow-y-auto">
                          <div className="prose prose-sm dark:prose-invert max-w-none text-xs" dangerouslySetInnerHTML={{ __html: item.body }} />
                        </div>
                      )}
                      {onResend && (
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" className="h-6 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); onResend({ to: item.to || [], cc: item.cc, bcc: item.bcc, subject: item.subject || '', body: item.body || '', accountId: item.accountId || '' }); onOpenChange(false); }}>
                            <RotateCcw className="h-3 w-3" />
                            {t('historyResend')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="flex justify-between pt-2 border-t">
          <Button variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => onOpenChange(false)}>
            {t('historyClose')}
          </Button>
          {sendHistory.length > 0 && (
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => { saveToStorage({ sendHistory: [] }); onOpenChange(false); }}>
              <Trash2 className="h-3 w-3 mr-1" />
              {t('historyClear')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
