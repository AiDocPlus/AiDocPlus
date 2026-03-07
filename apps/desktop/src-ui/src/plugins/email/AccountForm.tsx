import { useState } from 'react';
import {
  Button, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../_framework/ui';
import { EMAIL_PROVIDER_PRESETS } from '@aidocplus/shared-types';
import type { EmailAccount } from './types';
import { isValidEmail } from './utils';

export function AccountForm({ account, t, onSave, onCancel, onTestConnection }: {
  account: EmailAccount;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSave: (acct: EmailAccount) => void;
  onCancel: () => void;
  onTestConnection?: (acct: EmailAccount) => Promise<void>;
}) {
  const [form, setForm] = useState<EmailAccount>({ ...account });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleProviderChange = (providerId: string) => {
    const preset = EMAIL_PROVIDER_PRESETS.find(p => p.id === providerId);
    setForm(prev => ({
      ...prev,
      provider: providerId,
      smtpHost: preset?.smtpHost || prev.smtpHost,
      smtpPort: preset?.smtpPort || prev.smtpPort,
      encryption: preset?.encryption || prev.encryption,
    }));
  };

  const handleSave = () => {
    if (!form.email.trim()) return;
    if (!form.smtpHost.trim()) return;
    onSave({ ...form, name: form.name || form.email });
  };

  return (
    <div className="border rounded-md p-3 space-y-2.5 bg-background">
      <div className="space-y-1.5">
        <Label className="text-xs">{t('provider')}</Label>
        <Select value={form.provider} onValueChange={handleProviderChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_PROVIDER_PRESETS.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('accountName')}</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={t('accountNamePlaceholder')} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('displayName')}</Label>
          <Input value={form.displayName || ''} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
            placeholder={t('displayNamePlaceholder')} className="h-8 text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('emailAddress')}</Label>
          <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="user@example.com" className="h-8 text-xs font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('password')}</Label>
          <Input type="password" value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder={form.hasKeyringPassword ? t('passwordKeychainPlaceholder') : t('passwordPlaceholder')} className="h-8 text-xs font-mono" />
          {form.hasKeyringPassword && !form.password && (
            <p className="text-[10px] text-muted-foreground">{t('passwordKeychainHint')}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">SMTP {t('host')}</Label>
          <Input value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))}
            placeholder="smtp.example.com" className="h-8 text-xs font-mono"
            readOnly={form.provider !== 'custom'} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('port')}</Label>
          <Input type="number" value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: parseInt(e.target.value) || 465 }))}
            className="h-8 text-xs font-mono"
            readOnly={form.provider !== 'custom'} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('encryption')}</Label>
          <Select value={form.encryption} onValueChange={(v: 'tls' | 'starttls' | 'none') => setForm(f => ({ ...f, encryption: v }))}
            disabled={form.provider !== 'custom'}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tls">TLS</SelectItem>
              <SelectItem value="starttls">STARTTLS</SelectItem>
              <SelectItem value="none">{t('noEncryption')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 发送频率限制 */}
      <div className="space-y-1.5 border-t pt-2">
        <Label className="text-xs font-medium">{t('sendLimits')}</Label>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('perHourLimit')}</Label>
            <Input type="number" min={0} value={form.sendLimits?.perHour || ''} onChange={e => {
              const v = parseInt(e.target.value) || 0;
              setForm(f => ({ ...f, sendLimits: { perHour: v, perDay: f.sendLimits?.perDay || 0, intervalSec: f.sendLimits?.intervalSec || 0 } }));
            }} placeholder={t('noLimit')} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('perDayLimit')}</Label>
            <Input type="number" min={0} value={form.sendLimits?.perDay || ''} onChange={e => {
              const v = parseInt(e.target.value) || 0;
              setForm(f => ({ ...f, sendLimits: { perHour: f.sendLimits?.perHour || 0, perDay: v, intervalSec: f.sendLimits?.intervalSec || 0 } }));
            }} placeholder={t('noLimit')} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('sendInterval')}</Label>
            <Input type="number" min={0} value={form.sendLimits?.intervalSec || ''} onChange={e => {
              const v = parseInt(e.target.value) || 0;
              setForm(f => ({ ...f, sendLimits: { perHour: f.sendLimits?.perHour || 0, perDay: f.sendLimits?.perDay || 0, intervalSec: v } }));
            }} placeholder={t('noInterval')} className="h-8 text-xs font-mono" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">{t('sendLimitsHint')}</p>
      </div>

      {/* 邮箱格式验证提示 */}
      {form.email.trim() && !isValidEmail(form.email) && (
        <p className="text-xs text-destructive">{t('invalidEmailFormat')}</p>
      )}

      {/* 测试结果 */}
      {testResult && (
        <div className={`text-xs px-2 py-1.5 rounded ${testResult.ok ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {testResult.msg}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>{t('cancel')}</Button>
        {onTestConnection && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
            disabled={!form.email.trim() || !form.smtpHost.trim() || (!form.password?.trim() && !form.hasKeyringPassword) || testing}
            onClick={async () => {
              setTesting(true);
              setTestResult(null);
              try {
                await onTestConnection(form);
                setTestResult({ ok: true, msg: t('smtpTestSuccess') });
              } catch (err) {
                setTestResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
              } finally {
                setTesting(false);
              }
            }}>
            {testing ? t('smtpTesting') : t('smtpTestBtn')}
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSave}
          disabled={!form.email.trim() || !form.smtpHost.trim() || (!form.password?.trim() && !form.hasKeyringPassword)}>
          {t('saveAccount')}
        </Button>
      </div>
    </div>
  );
}
