// ── 设置视图（账户管理：SMTP + IMAP + 频率限制 + 投稿账户标记） ──

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useMailStore } from '../store/useMailStore';
import { saveAccounts, saveSignatures } from '../lib/storage';
import type { EmailAccount, EncryptionType } from '../types/account';
import type { EmailSignature } from '../types/email';
import { sanitizeHtml } from '@/lib/sanitize';

const S = {
  root: { display: 'flex', height: '100%', fontFamily: '宋体, SimSun, serif', fontSize: 16 },
  sidebar: { width: 160, borderRight: '1px solid #e2e8f0', background: '#f8fafc', padding: '8px 0', flexShrink: 0 },
  sideItem: (active: boolean): React.CSSProperties => ({
    padding: '8px 14px', cursor: 'pointer', fontSize: 14,
    background: active ? '#eff6ff' : 'transparent',
    color: active ? '#2563eb' : '#334155',
    borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
  }),
  content: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  header: { padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  headerTitle: { fontSize: 15, fontWeight: 600, color: '#1e293b', flex: 1 },
  body: { flex: 1, overflowY: 'auto' as const, padding: '12px 16px' },
  btn: (primary?: boolean, danger?: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 4, border: primary ? 'none' : '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: 14, fontFamily: '宋体, SimSun, serif',
    background: danger ? '#fee2e2' : primary ? '#3b82f6' : '#fff',
    color: danger ? '#dc2626' : primary ? '#fff' : '#334155',
  }),
  accountCard: (active: boolean): React.CSSProperties => ({
    border: active ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
    borderRadius: 6, padding: '10px 14px', marginBottom: 10, cursor: 'pointer',
    background: active ? '#eff6ff' : '#fff',
  }),
  accountName: { fontSize: 14, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 4 },
  accountMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#64748b', marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 15, fontFamily: '宋体, SimSun, serif', outline: 'none', boxSizing: 'border-box' as const },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  divider: { borderTop: '1px solid #e2e8f0', margin: '16px 0' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 10 },
  infoBox: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '8px 12px', fontSize: 13, color: '#78350f', marginBottom: 12 },
  successBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '6px 12px', fontSize: 13, color: '#166534', marginBottom: 8 },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '6px 12px', fontSize: 13, color: '#dc2626', marginBottom: 8 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 },
  badge: (color: string): React.CSSProperties => ({
    background: color, color: '#fff', padding: '1px 6px',
    borderRadius: 10, fontSize: 11,
  }),
  textarea: { width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 14, fontFamily: '宋体, SimSun, serif', outline: 'none', resize: 'vertical' as const, minHeight: 80, boxSizing: 'border-box' as const },
};

// 常见服务商预设（SMTP + IMAP）
const PROVIDERS: Array<{
  name: string;
  smtpHost: string; smtpPort: number; smtpEnc: EncryptionType;
  imapHost: string; imapPort: number; imapEnc: EncryptionType;
}> = [
  { name: 'QQ邮箱',   smtpHost: 'smtp.qq.com',         smtpPort: 465, smtpEnc: 'ssl', imapHost: 'imap.qq.com',         imapPort: 993, imapEnc: 'ssl' },
  { name: '网易163',  smtpHost: 'smtp.163.com',        smtpPort: 465, smtpEnc: 'ssl', imapHost: 'imap.163.com',        imapPort: 993, imapEnc: 'ssl' },
  { name: '网易126',  smtpHost: 'smtp.126.com',        smtpPort: 465, smtpEnc: 'ssl', imapHost: 'imap.126.com',        imapPort: 993, imapEnc: 'ssl' },
  { name: 'Yeah邮箱', smtpHost: 'smtp.yeah.net',       smtpPort: 465, smtpEnc: 'ssl', imapHost: 'imap.yeah.net',       imapPort: 993, imapEnc: 'ssl' },
  { name: 'Gmail',    smtpHost: 'smtp.gmail.com',      smtpPort: 587, smtpEnc: 'tls', imapHost: 'imap.gmail.com',      imapPort: 993, imapEnc: 'ssl' },
  { name: 'Outlook',  smtpHost: 'smtp.office365.com',  smtpPort: 587, smtpEnc: 'tls', imapHost: 'outlook.office365.com', imapPort: 993, imapEnc: 'ssl' },
  { name: '自定义',   smtpHost: '',  smtpPort: 465, smtpEnc: 'ssl', imapHost: '', imapPort: 993, imapEnc: 'ssl' },
];

type SettingsTab = 'accounts' | 'signatures' | 'general';

const EMPTY_ACCOUNT: Omit<EmailAccount, 'id'> = {
  email: '', displayName: '',
  smtpHost: '', smtpPort: 465, encryption: 'ssl' as EncryptionType,
  imapHost: '', imapPort: 993, imapEncryption: 'ssl' as EncryptionType,
  password: '', provider: '',
  hasKeyringPassword: false, isSubmissionAccount: true, enabled: true,
  sendLimits: { maxPerHour: 30, maxPerDay: 200, intervalSec: 3 },
};

export function SettingsView() {
  const accounts = useMailStore(s => s.accounts);
  const setAccounts = useMailStore(s => s.setAccounts);
  const activeAccountId = useMailStore(s => s.activeAccountId);
  const setActiveAccountId = useMailStore(s => s.setActiveAccountId);
  const signatures = useMailStore(s => s.signatures);
  const setSignatures = useMailStore(s => s.setSignatures);
  const activeSignatureId = useMailStore(s => s.activeSignatureId);
  const setActiveSignatureId = useMailStore(s => s.setActiveSignatureId);

  const [tab, setTab] = useState<SettingsTab>('accounts');

  // 账户编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmailAccount | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  // 签名编辑状态
  const [editingSig, setEditingSig] = useState<EmailSignature | null>(null);
  const [isNewSig, setIsNewSig] = useState(false);

  // 持久化账户
  const persistAccounts = useCallback(async (updated: EmailAccount[]) => {
    setAccounts(updated);
    const newActiveId = updated.some(a => a.id === activeAccountId)
      ? activeAccountId
      : (updated[0]?.id || '');
    await saveAccounts(updated, newActiveId);
  }, [setAccounts, activeAccountId]);

  // 持久化签名
  const persistSignatures = useCallback(async (updated: EmailSignature[], activeSigId: string) => {
    setSignatures(updated);
    setActiveSignatureId(activeSigId);
    await saveSignatures(updated, activeSigId);
  }, [setSignatures, setActiveSignatureId]);

  const handleNew = () => {
    const acc: EmailAccount = {
      ...EMPTY_ACCOUNT,
      id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    };
    setEditing(acc);
    setEditingId(acc.id);
    setIsNew(true);
    setTestStatus('idle');
    setTestMsg('');
    setSaveMsg('');
  };

  const handleSelect = (acc: EmailAccount) => {
    setEditing({ ...acc });
    setEditingId(acc.id);
    setIsNew(false);
    setTestStatus('idle');
    setTestMsg('');
    setSaveMsg('');
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.email.trim()) { setSaveMsg('error:请填写邮箱地址'); return; }
    if (!editing.smtpHost.trim()) { setSaveMsg('error:请填写 SMTP 服务器地址'); return; }
    const updated = isNew
      ? [...accounts, editing]
      : accounts.map(a => a.id === editing.id ? editing : a);
    await persistAccounts(updated);
    if (!activeAccountId || isNew) setActiveAccountId(editing.id);
    setIsNew(false);
    setSaveMsg('ok:账户已保存');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此邮箱账户？')) return;
    const updated = accounts.filter(a => a.id !== id);
    await persistAccounts(updated);
    if (editingId === id) { setEditing(null); setEditingId(null); }
    if (activeAccountId === id) setActiveAccountId(updated[0]?.id || '');
  };

  const handleTestSmtp = async () => {
    if (!editing) return;
    setTestStatus('testing');
    setTestMsg('');
    try {
      await invoke('test_smtp_connection', {
        smtpHost: editing.smtpHost,
        smtpPort: editing.smtpPort,
        encryption: editing.encryption,
        email: editing.email,
        accountId: editing.hasKeyringPassword ? editing.id : null,
        password: editing.hasKeyringPassword ? null : (editing.password || null),
      });
      setTestStatus('ok');
      setTestMsg('SMTP 连接成功！配置正确。');
    } catch (err) {
      setTestStatus('error');
      setTestMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStorePassword = async () => {
    if (!editing || !editing.password) return;
    try {
      await invoke('store_email_credential', { accountId: editing.id, password: editing.password });
      upd({ hasKeyringPassword: true, password: '' });
      setSaveMsg('ok:密码已安全存储到密钥链');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(`error:${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const upd = (patch: Partial<EmailAccount>) =>
    setEditing(prev => prev ? { ...prev, ...patch } : null);

  const updLimits = (patch: Partial<EmailAccount['sendLimits']>) =>
    setEditing(prev => prev ? { ...prev, sendLimits: { ...prev.sendLimits, ...patch } } : null);

  const handleProviderSelect = (providerName: string) => {
    const p = PROVIDERS.find(pr => pr.name === providerName);
    if (!p) return;
    upd({
      smtpHost: p.smtpHost, smtpPort: p.smtpPort, encryption: p.smtpEnc,
      imapHost: p.imapHost, imapPort: p.imapPort, imapEncryption: p.imapEnc,
      provider: providerName,
    });
  };

  const saveMsgType = saveMsg.startsWith('error:') ? 'error' : saveMsg.startsWith('ok:') ? 'ok' : '';
  const saveMsgText = saveMsg.replace(/^(error|ok):/, '');

  return (
    <div style={S.root}>
      {/* 左侧导航 */}
      <div style={S.sidebar}>
        <div style={S.sideItem(tab === 'accounts')} onClick={() => setTab('accounts')}>邮箱账户</div>
        <div style={S.sideItem(tab === 'signatures')} onClick={() => setTab('signatures')}>邮件签名</div>
        <div style={S.sideItem(tab === 'general')} onClick={() => setTab('general')}>通用设置</div>
      </div>

      {/* 右侧内容 */}
      <div style={S.content}>

        {/* ── 账户管理 ── */}
        {tab === 'accounts' && (
          <>
            <div style={S.header}>
              <span style={S.headerTitle}>邮箱账户管理</span>
              <button style={S.btn(true)} onClick={handleNew}>+ 添加账户</button>
            </div>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* 账户列表 */}
              <div style={{ width: 240, borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '8px 12px', flexShrink: 0 }}>
                {accounts.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                    点击"添加账户"开始配置
                  </div>
                ) : accounts.map(a => (
                  <div key={a.id} style={S.accountCard(editingId === a.id)} onClick={() => handleSelect(a)}>
                    <div style={S.accountName}>
                      {a.displayName || a.email}
                      {a.id === activeAccountId && <span style={S.badge('#16a34a')}>默认</span>}
                      {a.isSubmissionAccount && <span style={S.badge('#2563eb')}>投稿</span>}
                      {!a.enabled && <span style={S.badge('#94a3b8')}>停用</span>}
                    </div>
                    <div style={S.accountMeta}>{a.email}</div>
                    <div style={S.accountMeta}>
                      {a.smtpHost || '未配置SMTP'}
                      {a.imapHost ? ` · IMAP✓` : ''}
                    </div>
                    {a.sendLimits.maxPerHour > 0 && (
                      <div style={S.accountMeta}>{a.sendLimits.maxPerHour}/h · {a.sendLimits.maxPerDay}/d</div>
                    )}
                  </div>
                ))}
              </div>

              {/* 编辑区 */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {!editing ? (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>选择或创建账户</div>
                ) : (
                  <>
                    {/* 基本信息 */}
                    <div style={S.sectionTitle}>基本信息</div>
                    <div style={S.row2}>
                      <div style={S.field}>
                        <label style={S.label}>邮箱地址 *</label>
                        <input style={S.input} value={editing.email}
                          onChange={e => upd({ email: e.target.value })} placeholder="your@email.com" />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>显示名称</label>
                        <input style={S.input} value={editing.displayName || ''}
                          onChange={e => upd({ displayName: e.target.value })} placeholder="张三" />
                      </div>
                    </div>

                    <div style={S.field}>
                      <label style={S.label}>服务商快捷选择</label>
                      <select style={{ ...S.input, height: 34 }} value={editing.provider || ''}
                        onChange={e => handleProviderSelect(e.target.value)} title="选择邮件服务商">
                        <option value="">手动配置...</option>
                        {PROVIDERS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>

                    <div style={S.divider} />
                    {/* SMTP */}
                    <div style={S.sectionTitle}>发件 SMTP 配置</div>
                    <div style={S.row3}>
                      <div style={S.field}>
                        <label style={S.label}>SMTP 服务器</label>
                        <input style={S.input} value={editing.smtpHost}
                          onChange={e => upd({ smtpHost: e.target.value })} placeholder="smtp.163.com" />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>端口</label>
                        <input style={S.input} type="number" value={editing.smtpPort}
                          onChange={e => upd({ smtpPort: parseInt(e.target.value) || 465 })} />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>加密方式</label>
                        <select style={{ ...S.input, height: 34 }} value={editing.encryption}
                          onChange={e => upd({ encryption: e.target.value as EncryptionType })} title="SMTP加密方式">
                          <option value="ssl">SSL/TLS（端口465）</option>
                          <option value="tls">STARTTLS（端口587）</option>
                          <option value="none">无加密（端口25）</option>
                        </select>
                      </div>
                    </div>

                    <div style={S.divider} />
                    {/* IMAP */}
                    <div style={S.sectionTitle}>收件 IMAP 配置</div>
                    <div style={S.infoBox}>
                      配置 IMAP 后可在收件箱中接收邮件。QQ/163 等需在网页版邮箱开启 IMAP 服务。
                    </div>
                    <div style={S.row3}>
                      <div style={S.field}>
                        <label style={S.label}>IMAP 服务器</label>
                        <input style={S.input} value={editing.imapHost || ''}
                          onChange={e => upd({ imapHost: e.target.value })} placeholder="imap.163.com" />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>端口</label>
                        <input style={S.input} type="number" value={editing.imapPort || 993}
                          onChange={e => upd({ imapPort: parseInt(e.target.value) || 993 })} />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>加密方式</label>
                        <select style={{ ...S.input, height: 34 }} value={editing.imapEncryption || 'ssl'}
                          onChange={e => upd({ imapEncryption: e.target.value as EncryptionType })} title="IMAP加密方式">
                          <option value="ssl">SSL/TLS（端口993）</option>
                          <option value="tls">STARTTLS（端口143）</option>
                          <option value="none">无加密</option>
                        </select>
                      </div>
                    </div>

                    <div style={S.divider} />
                    {/* 密码 */}
                    <div style={S.sectionTitle}>认证密码</div>
                    {editing.hasKeyringPassword ? (
                      <div style={S.successBox}>
                        ✓ 密码已安全存储于系统密钥链。
                        <button style={{ marginLeft: 8, ...S.btn(false, true) }}
                          onClick={async () => {
                            await invoke('delete_email_credential', { accountId: editing.id });
                            upd({ hasKeyringPassword: false });
                          }}>
                          清除密码
                        </button>
                      </div>
                    ) : (
                      <div style={S.row2}>
                        <div style={S.field}>
                          <label style={S.label}>密码 / 授权码</label>
                          <input style={S.input} type="password" value={editing.password || ''}
                            onChange={e => upd({ password: e.target.value })}
                            placeholder="SMTP/IMAP授权码（建议存入密钥链）" />
                        </div>
                        <div style={S.field}>
                          <label style={S.label}>&nbsp;</label>
                          <button style={{ ...S.btn(), marginTop: 2 }} onClick={handleStorePassword}
                            disabled={!editing.password}>
                            存入密钥链
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SMTP 测试 */}
                    {testStatus !== 'idle' && (
                      <div style={testStatus === 'ok' ? S.successBox : testStatus === 'error' ? S.errorBox : S.infoBox}>
                        {testStatus === 'testing' ? '正在测试连接...' : testMsg}
                      </div>
                    )}
                    <button style={S.btn()} onClick={handleTestSmtp} disabled={testStatus === 'testing'}>
                      测试 SMTP 连接
                    </button>

                    <div style={S.divider} />
                    {/* 频率限制 */}
                    <div style={S.sectionTitle}>发送频率限制</div>
                    <div style={S.infoBox}>
                      设置群发速率上限，防止触发邮件服务商的反垃圾限制。0 表示不限制。
                    </div>
                    <div style={S.row3}>
                      <div style={S.field}>
                        <label style={S.label}>每小时最多发送</label>
                        <input style={S.input} type="number" min={0} value={editing.sendLimits.maxPerHour}
                          onChange={e => updLimits({ maxPerHour: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>每天最多发送</label>
                        <input style={S.input} type="number" min={0} value={editing.sendLimits.maxPerDay}
                          onChange={e => updLimits({ maxPerDay: parseInt(e.target.value) || 0 })} />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>发送间隔（秒）</label>
                        <input style={S.input} type="number" min={0} value={editing.sendLimits.intervalSec}
                          onChange={e => updLimits({ intervalSec: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>

                    <div style={S.divider} />
                    {/* 账户属性 */}
                    <div style={S.sectionTitle}>账户属性</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={S.checkRow}>
                        <input type="checkbox" checked={editing.enabled}
                          onChange={e => upd({ enabled: e.target.checked })} />
                        <span>启用此账户</span>
                      </label>
                      <label style={S.checkRow}>
                        <input type="checkbox" checked={editing.isSubmissionAccount}
                          onChange={e => upd({ isSubmissionAccount: e.target.checked })} />
                        <span>用于群发投稿（可参与智能账户匹配）</span>
                      </label>
                    </div>

                    {/* 保存状态 */}
                    {saveMsgType && (
                      <div style={{ marginTop: 12, ...(saveMsgType === 'ok' ? S.successBox : S.errorBox) }}>
                        {saveMsgText}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button style={S.btn(true)} onClick={handleSave}>保存账户</button>
                      {!isNew && editing.id !== activeAccountId && (
                        <button style={S.btn()} onClick={() => setActiveAccountId(editing.id)}>设为默认</button>
                      )}
                      {!isNew && (
                        <button style={S.btn(false, true)} onClick={() => handleDelete(editing.id)}>删除账户</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── 签名管理 ── */}
        {tab === 'signatures' && (
          <>
            <div style={S.header}>
              <span style={S.headerTitle}>邮件签名管理</span>
              <button style={S.btn(true)} onClick={() => {
                const newSig: EmailSignature = {
                  id: `sig_${Date.now()}`,
                  name: '新签名',
                  content: '',
                };
                setEditingSig(newSig);
                setIsNewSig(true);
              }}>+ 新建签名</button>
            </div>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* 签名列表 */}
              <div style={{ width: 200, borderRight: '1px solid #e2e8f0', overflowY: 'auto', padding: '8px 12px', flexShrink: 0 }}>
                {signatures.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>暂无签名</div>
                ) : signatures.map(sig => (
                  <div key={sig.id}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', borderRadius: 4, marginBottom: 4, fontSize: 14,
                      background: editingSig?.id === sig.id ? '#eff6ff' : '#fff',
                      border: editingSig?.id === sig.id ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    }}
                    onClick={() => { setEditingSig({ ...sig }); setIsNewSig(false); }}>
                    <div style={{ fontWeight: 500 }}>{sig.name}</div>
                    {sig.id === activeSignatureId && (
                      <span style={S.badge('#16a34a')}>默认</span>
                    )}
                  </div>
                ))}
              </div>
              {/* 签名编辑区 */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {!editingSig ? (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>选择或创建签名</div>
                ) : (
                  <>
                    <div style={S.field}>
                      <label style={S.label}>签名名称</label>
                      <input style={S.input} value={editingSig.name}
                        onChange={e => setEditingSig(prev => prev ? { ...prev, name: e.target.value } : null)} />
                    </div>
                    <div style={S.field}>
                      <label style={S.label}>签名内容（支持 HTML）</label>
                      <textarea style={S.textarea}
                        value={editingSig.content}
                        onChange={e => setEditingSig(prev => prev ? { ...prev, content: e.target.value } : null)}
                        placeholder="例：&#10;-- &#10;张三&#10;XX出版社" />
                    </div>
                    {editingSig.content && (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 12, marginBottom: 12, background: '#fafafa' }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>预览：</div>
                        <div style={{ fontSize: 14, fontFamily: '宋体, SimSun, serif' }}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(editingSig.content.replace(/\n/g, '<br/>')) }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={S.btn(true)} onClick={async () => {
                        if (!editingSig) return;
                        const updated = isNewSig
                          ? [...signatures, editingSig]
                          : signatures.map(s => s.id === editingSig.id ? editingSig : s);
                        await persistSignatures(updated, activeSignatureId);
                        setIsNewSig(false);
                      }}>保存签名</button>
                      {!isNewSig && editingSig.id !== activeSignatureId && (
                        <button style={S.btn()} onClick={async () => {
                          await persistSignatures(signatures, editingSig.id);
                        }}>设为默认</button>
                      )}
                      {!isNewSig && (
                        <button style={S.btn(false, true)} onClick={async () => {
                          if (!confirm('确定删除此签名？')) return;
                          const updated = signatures.filter(s => s.id !== editingSig.id);
                          const newActiveId = activeSignatureId === editingSig.id ? (updated[0]?.id || '') : activeSignatureId;
                          await persistSignatures(updated, newActiveId);
                          setEditingSig(null);
                        }}>删除</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── 通用设置 ── */}
        {tab === 'general' && (
          <>
            <div style={S.header}>
              <span style={S.headerTitle}>通用设置</span>
            </div>
            <div style={S.body}>
              <div style={S.sectionTitle}>数据存储</div>
              <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
                邮件客户端数据保存于：<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 3 }}>~/AiDocPlus/MailClient/data.json</code>
              </div>
              <div style={S.sectionTitle}>关于</div>
              <div style={{ fontSize: 14, color: '#64748b' }}>
                AiDocPlus 邮件客户端 · 支持 SMTP 发件 + IMAP 收件 · 智能投稿账户匹配
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
