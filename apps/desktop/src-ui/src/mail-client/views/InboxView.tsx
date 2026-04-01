// ── 收件箱视图（Phase 7：接入真实 IMAP 数据） ──

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useMailStore } from '../store/useMailStore';
import type { ReplyContext } from '../store/useMailStore';

interface EmailSummary {
  uid: number;
  messageId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  date: string;
  isRead: boolean;
  hasAttachment: boolean;
  preview: string;
}

interface EmailDetail {
  uid: number;
  messageId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  toList: string[];
  ccList: string[];
  date: string;
  textBody: string;
  htmlBody: string;
  isRead: boolean;
  attachments: Array<{ filename: string; mimeType: string; size: number }>;
}

const S = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100%', fontFamily: '宋体, SimSun, serif', fontSize: 16 },
  header: { padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', flexShrink: 0 },
  headerTitle: { fontSize: 15, fontWeight: 600, color: '#1e293b', flex: 1 },
  btn: (primary?: boolean, danger?: boolean, small?: boolean): React.CSSProperties => ({
    padding: small ? '3px 10px' : '5px 14px',
    borderRadius: 4, border: primary ? 'none' : '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: small ? 12 : 13, fontFamily: '宋体, SimSun, serif',
    background: danger ? '#fee2e2' : primary ? '#3b82f6' : '#fff',
    color: danger ? '#dc2626' : primary ? '#fff' : '#334155',
  }),
  main: { flex: 1, display: 'flex', overflow: 'hidden' },
  listPanel: { width: 300, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  listToolbar: { padding: '6px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  searchInput: { flex: 1, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13, fontFamily: '宋体, SimSun, serif', outline: 'none' },
  list: { flex: 1, overflowY: 'auto' as const },
  item: (active: boolean, unread: boolean): React.CSSProperties => ({
    padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
    background: active ? '#eff6ff' : unread ? '#fff' : '#fafafa',
    borderLeft: active ? '3px solid #3b82f6' : unread ? '3px solid #6366f1' : '3px solid transparent',
  }),
  itemFrom: (unread: boolean): React.CSSProperties => ({
    fontSize: 13, fontWeight: unread ? 600 : 400, color: '#1e293b',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  }),
  itemSubject: (unread: boolean): React.CSSProperties => ({
    fontSize: 12, color: unread ? '#334155' : '#64748b', fontWeight: unread ? 500 : 400,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: 2,
  }),
  itemPreview: { fontSize: 11, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  itemDate: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  detailPanel: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  detailHeader: { padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#fafafa', flexShrink: 0 },
  detailSubject: { fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 6 },
  detailMeta: { fontSize: 12, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' as const },
  detailBody: { flex: 1, overflowY: 'auto' as const, padding: '14px 16px' },
  emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' as const, color: '#94a3b8', gap: 10 },
  configPanel: { padding: 24, maxWidth: 480 },
  configTitle: { fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#1e293b' },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#64748b', marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 14, fontFamily: '宋体, SimSun, serif', outline: 'none', boxSizing: 'border-box' as const },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '6px 12px', fontSize: 13, color: '#dc2626', marginBottom: 10 },
  infoBox: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '6px 12px', fontSize: 13, color: '#1d4ed8', marginBottom: 10 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.slice(0, 16);
  }
}

export function InboxView() {
  const accounts = useMailStore(s => s.accounts);
  const activeAccountId = useMailStore(s => s.activeAccountId);
  const setReplyContext = useMailStore(s => s.setReplyContext);
  const setCurrentView = useMailStore(s => s.setCurrentView);

  // IMAP 配置（优先使用已有账户 IMAP 设置，否则单独配置）
  const activeAccount = accounts.find(a => a.id === activeAccountId);

  const [imapHost, setImapHost] = useState(activeAccount?.imapHost || '');
  const [imapPort, setImapPort] = useState(String(activeAccount?.imapPort || 993));
  const [imapEmail, setImapEmail] = useState(activeAccount?.email || '');
  const [imapPassword, setImapPassword] = useState('');
  const [configured, setConfigured] = useState(false);

  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [selected, setSelected] = useState<EmailDetail | null>(null);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolder, _setCurrentFolder] = useState('INBOX');

  const buildParams = useCallback(() => ({
    host: imapHost,
    port: parseInt(imapPort) || 993,
    email: imapEmail,
    password: imapPassword || undefined,
    accountId: activeAccount?.hasKeyringPassword ? activeAccountId : undefined,
    encryption: 'tls',
  }), [imapHost, imapPort, imapEmail, imapPassword, activeAccount, activeAccountId]);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await invoke<EmailSummary[]>('imap_fetch_inbox', {
        params: buildParams(),
        mailbox: currentFolder,
        limit: 50,
      });
      setEmails(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [buildParams, currentFolder]);

  const fetchDetail = useCallback(async (uid: number) => {
    setLoadingDetail(true);
    setSelectedUid(uid);
    setSelected(null);
    try {
      const detail = await invoke<EmailDetail>('imap_fetch_email', {
        params: buildParams(),
        mailbox: currentFolder,
        uid,
      });
      setSelected(detail);
      setEmails(prev => prev.map(e => e.uid === uid ? { ...e, isRead: true } : e));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDetail(false);
    }
  }, [buildParams, currentFolder]);

  const handleDelete = useCallback(async (uid: number) => {
    if (!confirm('确定删除此邮件？')) return;
    try {
      await invoke('imap_delete_email', { params: buildParams(), mailbox: currentFolder, uid });
      setEmails(prev => prev.filter(e => e.uid !== uid));
      if (selectedUid === uid) { setSelected(null); setSelectedUid(null); }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [buildParams, currentFolder, selectedUid]);

  const handleMarkRead = useCallback(async (uid: number, read: boolean) => {
    try {
      await invoke('imap_mark_read', { params: buildParams(), mailbox: currentFolder, uid, read });
      setEmails(prev => prev.map(e => e.uid === uid ? { ...e, isRead: read } : e));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [buildParams, currentFolder]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { fetchInbox(); return; }
    setLoading(true);
    setError('');
    try {
      const uids = await invoke<number[]>('imap_search', {
        params: buildParams(), mailbox: currentFolder, query: searchQuery,
      });
      if (uids.length === 0) { setEmails([]); return; }
      const result = await invoke<EmailSummary[]>('imap_fetch_inbox', {
        params: buildParams(), mailbox: currentFolder, limit: 50,
      });
      setEmails(result.filter(e => uids.includes(e.uid)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fetchInbox, buildParams, currentFolder]);

  useEffect(() => {
    if (configured) { fetchInbox(); }
  }, [configured, fetchInbox]);

  // 更新 imapEmail 当 activeAccount 变化时
  useEffect(() => {
    if (activeAccount) {
      setImapHost(activeAccount.imapHost || '');
      setImapPort(String(activeAccount.imapPort || 993));
      setImapEmail(activeAccount.email);
    }
  }, [activeAccount]);

  // 未配置 IMAP 时显示配置面板
  if (!configured) {
    const canConnect = imapHost.trim() && imapEmail.trim() && (imapPassword.trim() || activeAccount?.hasKeyringPassword);
    return (
      <div style={S.root}>
        <div style={S.header}>
          <span style={S.headerTitle}>收件箱</span>
        </div>
        <div style={{ ...S.emptyState, alignItems: 'flex-start' }}>
          <div style={S.configPanel}>
            <div style={S.configTitle}>配置 IMAP 收件设置</div>
            {activeAccount && (
              <div style={S.infoBox}>
                已选账户：{activeAccount.displayName || activeAccount.email}
                {activeAccount.hasKeyringPassword ? '（密码已从密钥链读取）' : '（需手动输入密码）'}
              </div>
            )}
            <div style={S.field}>
              <label style={S.label}>IMAP 服务器</label>
              <input style={S.input} value={imapHost} onChange={e => setImapHost(e.target.value)} placeholder="imap.163.com / imap.qq.com" />
            </div>
            <div style={S.row2}>
              <div style={S.field}>
                <label style={S.label}>端口</label>
                <input style={S.input} type="number" value={imapPort} title="IMAP端口" placeholder="993" onChange={e => setImapPort(e.target.value)} />
              </div>
              <div style={S.field}>
                <label style={S.label}>邮箱地址</label>
                <input style={S.input} value={imapEmail} onChange={e => setImapEmail(e.target.value)} placeholder="your@email.com" />
              </div>
            </div>
            {!activeAccount?.hasKeyringPassword && (
              <div style={S.field}>
                <label style={S.label}>密码 / 授权码</label>
                <input style={S.input} type="password" value={imapPassword} onChange={e => setImapPassword(e.target.value)} placeholder="IMAP授权码" />
              </div>
            )}
            {error && <div style={S.errorBox}>{error}</div>}
            <button
              style={S.btn(true)}
              disabled={!canConnect}
              onClick={() => { setError(''); setConfigured(true); }}
            >
              连接收件箱
            </button>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = emails.filter(e => !e.isRead).length;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <span style={S.headerTitle}>
          收件箱 {unreadCount > 0 && <span style={{ fontSize: 12, background: '#6366f1', color: '#fff', padding: '1px 6px', borderRadius: 10, marginLeft: 4 }}>{unreadCount}</span>}
        </span>
        <button style={S.btn()} onClick={fetchInbox} disabled={loading}>{loading ? '刷新中...' : '刷新'}</button>
        <button style={S.btn()} onClick={() => { setConfigured(false); setEmails([]); setSelected(null); }}>重新配置</button>
      </div>

      {error && (
        <div style={{ ...S.errorBox, margin: '0 0 0 0', borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
          {error} <button style={{ marginLeft: 8, cursor: 'pointer', border: 'none', background: 'none', color: '#dc2626', fontFamily: '宋体, SimSun, serif' }} onClick={() => setError('')}>×</button>
        </div>
      )}

      <div style={S.main}>
        {/* 邮件列表 */}
        <div style={S.listPanel}>
          <div style={S.listToolbar}>
            <input
              style={S.searchInput}
              placeholder="搜索..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button style={S.btn(false, false, true)} onClick={handleSearch}>搜索</button>
          </div>
          <div style={S.list}>
            {loading && (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>加载中...</div>
            )}
            {!loading && emails.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>暂无邮件</div>
            )}
            {emails.map(email => (
              <div
                key={email.uid}
                style={S.item(selectedUid === email.uid, !email.isRead)}
                onClick={() => fetchDetail(email.uid)}
              >
                <div style={S.itemFrom(!email.isRead)}>
                  {email.fromName || email.fromEmail}
                </div>
                <div style={S.itemSubject(!email.isRead)}>{email.subject || '（无主题）'}</div>
                <div style={S.itemPreview}>{email.preview}</div>
                <div style={S.itemDate}>{formatDate(email.date)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 邮件详情 */}
        <div style={S.detailPanel}>
          {!selected && !loadingDetail && (
            <div style={S.emptyState}>
              <span style={{ fontSize: 36 }}>✉️</span>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>选择邮件查看详情</span>
            </div>
          )}
          {loadingDetail && (
            <div style={S.emptyState}>
              <span style={{ fontSize: 14, color: '#94a3b8' }}>加载邮件中...</span>
            </div>
          )}
          {selected && !loadingDetail && (
            <>
              <div style={S.detailHeader}>
                <div style={S.detailSubject}>{selected.subject || '（无主题）'}</div>
                <div style={S.detailMeta}>
                  <span>发件人：{selected.fromName ? `${selected.fromName} <${selected.fromEmail}>` : selected.fromEmail}</span>
                  <span>时间：{formatDate(selected.date)}</span>
                  {selected.toList.length > 0 && <span>收件人：{selected.toList.join(', ')}</span>}
                  {selected.ccList.length > 0 && <span>抄送：{selected.ccList.join(', ')}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button style={S.btn(true, false, true)} onClick={() => {
                    if (!selected) return;
                    const reSubject = selected.subject.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`;
                    const quotedBody = `\n\n--- 原邮件 ---\n发件人：${selected.fromName || selected.fromEmail}\n时间：${selected.date}\n\n${selected.textBody || ''}`;
                    const ctx: ReplyContext = {
                      to: selected.fromEmail,
                      subject: reSubject,
                      quotedBody,
                      fromName: selected.fromName,
                    };
                    setReplyContext(ctx);
                    setCurrentView('compose');
                  }}>回复</button>
                  <button style={S.btn(false, false, true)} onClick={() => handleMarkRead(selected.uid, !selected.isRead)}>
                    {selected.isRead ? '标为未读' : '标为已读'}
                  </button>
                  <button style={S.btn(false, true, true)} onClick={() => handleDelete(selected.uid)}>删除</button>
                  {selected.attachments.length > 0 && (
                    <span style={{ fontSize: 12, color: '#6366f1', alignSelf: 'center' }}>
                      📎 {selected.attachments.length} 个附件
                    </span>
                  )}
                </div>
              </div>
              <div style={S.detailBody}>
                {selected.htmlBody ? (
                  <iframe
                    title="邮件正文"
                    srcDoc={selected.htmlBody}
                    style={{ width: '100%', height: '100%', border: 'none', minHeight: 400 }}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <pre style={{ fontFamily: '宋体, SimSun, serif', fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#334155', margin: 0 }}>
                    {selected.textBody || '（无正文）'}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
