import { useState } from 'react';
import {
  Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../../_framework/ui';
import { EMAIL_PROVIDER_PRESETS } from '@aidocplus/shared-types';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { AccountForm } from '../AccountForm';
import { useEmailContext } from '../EmailContext';
import type { EmailAccount, EmailStorageData } from '../types';
import { newBlankAccount } from '../utils';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAccount: (acct: EmailAccount) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
}

export function AccountDialog({ open, onOpenChange, onSaveAccount, onDeleteAccount }: AccountDialogProps) {
  const { state, t, host } = useEmailContext();
  const { accounts } = state;

  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setEditingAccount(null); }}>
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto" style={DIALOG_STYLE}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{t('accountManage')}</DialogTitle>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                onClick={() => setEditingAccount(newBlankAccount())}>
                <Plus className="h-3 w-3" />
                {t('addAccount')}
              </Button>
            </div>
            <DialogDescription>{t('accountManageDesc')}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-1 border-b pb-2 mb-2">
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" title={t('exportSettings')}
              onClick={() => {
                const data = host.storage.get<EmailStorageData>('emailData') || {};
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `email-settings-${new Date().toISOString().slice(0, 10)}.json`;
                a.click(); URL.revokeObjectURL(url);
              }}>
              <Download className="h-3 w-3" />
              {t('exportSettings')}
            </Button>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" title={t('importSettings')}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = '.json';
                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const imported = JSON.parse(text) as EmailStorageData;
                    if (!imported || typeof imported !== 'object') throw new Error('Invalid');
                    host.storage.set('emailData', imported);
                    host.ui.showStatus(t('importSuccess'));
                    // 刷新需要重新加载插件
                    onOpenChange(false);
                  } catch { host.ui.showStatus(t('importFailed'), true); }
                };
                input.click();
              }}>
              <Upload className="h-3 w-3" />
              {t('importSettings')}
            </Button>
          </div>
          <div className="space-y-3">
            {accounts.length > 0 && (
              <div className="space-y-1">
                {accounts.map(acct => {
                  const preset = EMAIL_PROVIDER_PRESETS.find(p => p.id === acct.provider);
                  return (
                    <div key={acct.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
                      <span className="truncate flex-1">
                        <span className="font-medium">{acct.name || acct.email}</span>
                        {preset && <span className="text-muted-foreground ml-1">({preset.name})</span>}
                      </span>
                      <div className="flex gap-1 ml-2">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                          onClick={() => setEditingAccount({ ...acct })}>
                          {t('edit')}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteId(acct.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {accounts.length === 0 && !editingAccount && (
              <p className="text-xs text-muted-foreground text-center py-4">{t('noAccountYet')}</p>
            )}

            {editingAccount && (
              <AccountForm
                account={editingAccount}
                t={t}
                onSave={async (acct) => { await onSaveAccount(acct); setEditingAccount(null); }}
                onCancel={() => setEditingAccount(null)}
                onTestConnection={async (acct) => {
                  await host.platform.invoke<string>('test_smtp_connection', {
                    smtpHost: acct.smtpHost,
                    smtpPort: acct.smtpPort,
                    encryption: acct.encryption,
                    email: acct.email,
                    password: acct.password || undefined,
                    accountId: (!acct.password && acct.hasKeyringPassword) ? acct.id : undefined,
                  });
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除账户确认弹窗 */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(v) => { if (!v) setConfirmDeleteId(null); }}>
        <DialogContent className="sm:max-w-[360px]" style={DIALOG_STYLE}>
          <DialogHeader>
            <DialogTitle>{t('confirmDeleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('confirmDeleteDesc', { name: accounts.find(a => a.id === confirmDeleteId)?.name || accounts.find(a => a.id === confirmDeleteId)?.email || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>
              {t('cancel')}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => { if (confirmDeleteId) { onDeleteAccount(confirmDeleteId); setConfirmDeleteId(null); } }}>
              <Trash2 className="h-3 w-3 mr-1" />
              {t('confirmDelete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
