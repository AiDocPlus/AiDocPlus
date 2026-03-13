import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, Power, Mail, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../../i18n';
import { EMAIL_PROVIDER_PRESETS, getEmailPreset } from '@aidocplus/shared-types';
import type { EmailAccountConfig } from '@aidocplus/shared-types';
import { formatBackendError } from '@/lib/backendError';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';

export interface EmailTempSettings {
  accounts: EmailAccountConfig[];
  activeAccountId: string;
}

interface EmailSettingsTabProps {
  tempEmail: EmailTempSettings;
  updateTempEmail: (newSettings: Partial<EmailTempSettings>) => void;
}

export function EmailSettingsTab({ tempEmail, updateTempEmail }: EmailSettingsTabProps) {
  const { t } = useTranslation();

  const [editingEmailAccount, setEditingEmailAccount] = useState<EmailAccountConfig | null>(null);
  const [isCreatingEmailAccount, setIsCreatingEmailAccount] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleCreateEmailAccount = () => {
    const defaultPreset = EMAIL_PROVIDER_PRESETS[0];
    setEditingEmailAccount({
      id: `email_${Date.now()}`,
      name: '',
      provider: defaultPreset.id,
      smtpHost: defaultPreset.smtpHost,
      smtpPort: defaultPreset.smtpPort,
      encryption: defaultPreset.encryption,
      email: '',
      password: '',
      displayName: '',
      enabled: true,
    });
    setIsCreatingEmailAccount(true);
    setSmtpTestResult(null);
  };

  const handleEditEmailAccount = (acct: EmailAccountConfig) => {
    setEditingEmailAccount({ ...acct });
    setIsCreatingEmailAccount(false);
    setSmtpTestResult(null);
  };

  const handleSaveEmailAccount = () => {
    if (!editingEmailAccount) return;
    const preset = getEmailPreset(editingEmailAccount.provider);
    const acctName = editingEmailAccount.name.trim() || preset?.name || editingEmailAccount.email;
    const acct = { ...editingEmailAccount, name: acctName };

    const accounts = [...tempEmail.accounts];
    const idx = accounts.findIndex(a => a.id === acct.id);
    if (idx >= 0) { accounts[idx] = acct; } else { accounts.push(acct); }
    const activeId = tempEmail.activeAccountId || acct.id;
    updateTempEmail({ accounts, activeAccountId: activeId });
    setEditingEmailAccount(null);
  };

  const handleDeleteEmailAccount = (id: string) => {
    const accounts = tempEmail.accounts.filter(a => a.id !== id);
    let activeId = tempEmail.activeAccountId;
    if (activeId === id) { activeId = accounts.find(a => a.enabled)?.id || ''; }
    updateTempEmail({ accounts, activeAccountId: activeId });
  };

  const handleToggleEmailAccount = (id: string) => {
    const accounts = tempEmail.accounts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    updateTempEmail({ accounts });
  };

  const handleActivateEmailAccount = (id: string) => {
    updateTempEmail({ activeAccountId: id });
  };

  const handleEmailProviderChange = (newProvider: string) => {
    if (!editingEmailAccount) return;
    const preset = getEmailPreset(newProvider);
    setEditingEmailAccount({
      ...editingEmailAccount,
      provider: newProvider,
      smtpHost: preset?.smtpHost || '',
      smtpPort: preset?.smtpPort || 465,
      encryption: preset?.encryption || 'tls',
    });
  };

  const handleTestSmtpConnection = async () => {
    if (!editingEmailAccount) return;
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const result = await invoke<string>('test_smtp_connection', {
        smtpHost: editingEmailAccount.smtpHost,
        smtpPort: editingEmailAccount.smtpPort,
        encryption: editingEmailAccount.encryption,
        email: editingEmailAccount.email,
        password: editingEmailAccount.password,
      });
      setSmtpTestResult({ ok: true, msg: result });
      setEditingEmailAccount(prev => prev ? { ...prev, lastTestOk: true } : prev);
    } catch (err: any) {
      setSmtpTestResult({ ok: false, msg: formatBackendError(err) });
      setEditingEmailAccount(prev => prev ? { ...prev, lastTestOk: false } : prev);
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('settings.emailAccountConfig', { defaultValue: '邮箱账户配置' })}</h3>
          <Button variant="outline" size="sm" onClick={handleCreateEmailAccount}>
            <Plus className="h-4 w-4 mr-1" />{t('settings.addEmailAccount', { defaultValue: '添加邮箱账户' })}
          </Button>
        </div>

        {tempEmail.accounts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('settings.noEmailAccounts', { defaultValue: '还没有配置任何邮箱账户' })}</p>
            <p className="text-xs mt-1">{t('settings.noEmailAccountsHint', { defaultValue: '点击上方「添加邮箱账户」按钮添加一个' })}</p>
            <p className="text-xs mt-3 text-muted-foreground/70">{t('settings.emailProviderSupport', { defaultValue: '支持网易 163、126、移动 139、QQ 邮箱、Gmail、Outlook 等' })}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tempEmail.accounts.map(acct => {
              const isActive = acct.id === tempEmail.activeAccountId;
              const preset = getEmailPreset(acct.provider);
              return (
                <div
                  key={acct.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'border-primary bg-primary/10'
                      : acct.enabled
                        ? 'border-transparent bg-muted/30 hover:bg-muted/50'
                        : 'border-transparent bg-muted/10 opacity-50'
                  }`}
                  onClick={() => acct.enabled && handleActivateEmailAccount(acct.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{acct.name}</span>
                      <span className="text-xs text-muted-foreground">{preset?.name || t('settings.customProvider', { defaultValue: '自定义' })}</span>
                      {isActive && (
                        <span className="text-xs font-semibold text-primary bg-primary/15 px-1.5 py-0.5 rounded">{t('settings.inUse', { defaultValue: '使用中' })}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {acct.email || t('settings.noEmailConfigured', { defaultValue: '未配置邮箱地址' })} {acct.password ? '' : `• ${t('settings.noAuthCodeWarning', { defaultValue: '⚠️ 未配置授权码' })}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleEmailAccount(acct.id)} title={acct.enabled ? t('settings.disable', { defaultValue: '禁用' }) : t('settings.enable', { defaultValue: '启用' })}>
                      <Power className={`h-3.5 w-3.5 ${!acct.enabled ? 'text-muted-foreground' : !acct.password ? 'text-red-500' : acct.lastTestOk === true ? 'text-green-500' : acct.lastTestOk === false ? 'text-red-500' : 'text-orange-500'}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditEmailAccount(acct)} title={t('settings.edit', { defaultValue: '编辑' })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteEmailAccount(acct.id)} title={t('settings.delete', { defaultValue: '删除' })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Separator className="my-4" />

        <div>
          <h4 className="text-sm font-semibold mb-2">{t('settings.emailUsageTitle', { defaultValue: '使用说明' })}</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{t('settings.emailUsageStep1', { defaultValue: '1. 选择邮箱服务商后，SMTP 服务器地址和端口会自动填充' })}</p>
            <p>{t('settings.emailUsageStep2', { defaultValue: '2. 大多数邮箱需要开启 SMTP 服务并获取授权码（非登录密码）' })}</p>
            <p>{t('settings.emailUsageStep3', { defaultValue: '3. 配置完成后可点击「测试连接」验证设置是否正确' })}</p>
            <p>{t('settings.emailUsageStep4', { defaultValue: '4. 在邮件发送插件中可直接选择已配置的账户发送邮件' })}</p>
          </div>
        </div>
      </div>

      {/* 邮箱账户编辑弹窗 */}
      <Dialog open={!!editingEmailAccount} onOpenChange={(open) => { if (!open) setEditingEmailAccount(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isCreatingEmailAccount ? t('settings.addEmailAccountTitle', { defaultValue: '添加邮箱账户' }) : t('settings.editEmailAccountTitle', { defaultValue: '编辑邮箱账户' })}</DialogTitle>
          </DialogHeader>
          {editingEmailAccount && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('settings.accountNameLabel', { defaultValue: '账户名称' })} <span className="text-xs text-muted-foreground">{t('settings.accountNameOptional', { defaultValue: '(可选，留空自动命名)' })}</span></Label>
                <Input
                  value={editingEmailAccount.name}
                  onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, name: e.target.value })}
                  placeholder={t('settings.accountNamePlaceholder', { defaultValue: '例如：我的工作邮箱' })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('settings.emailProviderLabel', { defaultValue: '邮箱服务商' })}</Label>
                <Select
                  value={editingEmailAccount.provider}
                  onValueChange={handleEmailProviderChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_PROVIDER_PRESETS.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-red-500">{t('settings.emailAddressLabel', { defaultValue: '邮箱地址' })} <span className="text-xs text-red-500">{t('settings.emailAddressRequired', { defaultValue: '*必填' })}</span></Label>
                <Input
                  value={editingEmailAccount.email}
                  onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, email: e.target.value })}
                  placeholder="your@example.com"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-red-500">{t('settings.smtpAuthCodeLabel', { defaultValue: 'SMTP 授权码' })} <span className="text-xs text-red-500">{t('settings.smtpAuthCodeRequired', { defaultValue: '*必填' })}</span></Label>
                <Input
                  type="password"
                  value={editingEmailAccount.password}
                  onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, password: e.target.value })}
                  placeholder={t('settings.smtpAuthCodePlaceholder', { defaultValue: 'SMTP 授权码（非登录密码）' })}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('settings.senderNameLabel', { defaultValue: '发件人显示名称' })} <span className="text-xs text-muted-foreground">{t('settings.senderNameOptional', { defaultValue: '(可选)' })}</span></Label>
                <Input
                  value={editingEmailAccount.displayName || ''}
                  onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, displayName: e.target.value })}
                  placeholder={t('settings.senderNamePlaceholder', { defaultValue: '收件人看到的发件人名称' })}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('settings.smtpServerSettings', { defaultValue: 'SMTP 服务器设置（选择服务商后自动填充，也可手动修改）' })}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.smtpAddress', { defaultValue: 'SMTP 地址' })}</Label>
                    <Input
                      value={editingEmailAccount.smtpHost}
                      onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, smtpHost: e.target.value })}
                      placeholder="smtp.example.com"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('settings.smtpPort', { defaultValue: '端口' })}</Label>
                    <Input
                      type="number"
                      value={editingEmailAccount.smtpPort}
                      onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, smtpPort: parseInt(e.target.value) || 465 })}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('settings.smtpEncryption', { defaultValue: '加密方式' })}</Label>
                  <Select
                    value={editingEmailAccount.encryption}
                    onValueChange={(v) => setEditingEmailAccount({ ...editingEmailAccount, encryption: v as 'tls' | 'starttls' | 'none' })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS (SSL)</SelectItem>
                      <SelectItem value="starttls">STARTTLS</SelectItem>
                      <SelectItem value="none">{t('settings.noEncryption', { defaultValue: '无加密' })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleTestSmtpConnection}
                  disabled={testingSmtp || !editingEmailAccount.email || !editingEmailAccount.password || !editingEmailAccount.smtpHost}
                  className="w-full"
                >
                  {testingSmtp ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('settings.testing', { defaultValue: '测试中...' })}</>
                  ) : (
                    t('settings.testConnection', { defaultValue: '测试连接' })
                  )}
                </Button>
                {smtpTestResult && (
                  <p className={`text-sm px-3 py-2 rounded-md ${smtpTestResult.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                    {smtpTestResult.msg}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingEmailAccount(null)}>{t('settings.cancel', { defaultValue: '取消' })}</Button>
                <Button className="flex-1" onClick={handleSaveEmailAccount} disabled={!editingEmailAccount.email || !editingEmailAccount.password}>
                  <Check className="h-4 w-4 mr-1" />{t('settings.save', { defaultValue: '保存' })}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
