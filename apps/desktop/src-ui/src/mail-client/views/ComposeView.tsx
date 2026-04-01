// ── 写邮件视图（含草稿、签名、回复上下文） ──

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useMailStore } from '../store/useMailStore';
import { saveDrafts, saveSendHistory } from '../lib/storage';
import type { AttachmentItem, EmailDraft } from '../types/email';

interface ComposeState {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  showCc: boolean;
  showBcc: boolean;
  attachments: AttachmentItem[];
  sending: boolean;
  error: string;
  success: string;
  draftId: string;
}

const makeInit = (): ComposeState => ({
  to: '', cc: '', bcc: '', subject: '', body: '',
  showCc: false, showBcc: false, attachments: [],
  sending: false, error: '', success: '',
  draftId: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
});

const S = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100%', fontFamily: '宋体, SimSun, serif', fontSize: 16 },
  header: { padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  headerTitle: { fontSize: 15, fontWeight: 600, color: '#1e293b', flex: 1 },
  form: { flex: 1, overflowY: 'auto' as const, padding: '8px 16px', display: 'flex', flexDirection: 'column' as const, gap: 0 },
  row: { display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', padding: '7px 0' },
  label: { width: 44, color: '#64748b', fontSize: 13, flexShrink: 0 },
  input: { flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: '宋体, SimSun, serif', background: 'transparent', color: '#1e293b' },
  subjectInput: { flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: '宋体, SimSun, serif', background: 'transparent', color: '#1e293b', fontWeight: 500 },
  textarea: { flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: '宋体, SimSun, serif', background: 'transparent', color: '#1e293b', resize: 'none' as const, minHeight: 280, padding: '10px 0' },
  toolbar: { display: 'flex', gap: 8, padding: '8px 16px', borderTop: '1px solid #e2e8f0', background: '#fafafa', alignItems: 'center', flexWrap: 'wrap' as const, flexShrink: 0 },
  btn: { padding: '6px 18px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: '宋体, SimSun, serif' },
  btnPrimary: { background: '#3b82f6', color: '#fff' },
  btnSecondary: { background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' },
  btnSmall: (active?: boolean): React.CSSProperties => ({
    padding: '3px 9px', borderRadius: 4, border: '1px solid #e2e8f0', cursor: 'pointer',
    fontSize: 12, background: active ? '#eff6ff' : '#fff', color: active ? '#2563eb' : '#64748b',
    fontFamily: '宋体, SimSun, serif',
  }),
  msg: { padding: '6px 12px', borderRadius: 4, fontSize: 13, margin: '4px 0' },
  msgError: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  msgSuccess: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  accountSelect: { border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 8px', fontSize: 13, fontFamily: '宋体, SimSun, serif', background: '#fff', color: '#334155', maxWidth: 280 },
  sigSelect: { border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 8px', fontSize: 13, fontFamily: '宋体, SimSun, serif', background: '#fff', color: '#334155' },
  sigPreview: { borderTop: '1px dashed #e2e8f0', marginTop: 8, paddingTop: 8, color: '#64748b', fontSize: 13 },
  draftListItem: (active: boolean): React.CSSProperties => ({
    padding: '6px 10px', cursor: 'pointer', borderRadius: 4, fontSize: 13,
    background: active ? '#eff6ff' : 'transparent', color: '#334155',
    border: '1px solid transparent',
  }),
  attachTag: { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2px 8px', fontSize: 12, color: '#475569' },
};

export function ComposeView() {
  const [state, setState] = useState<ComposeState>(makeInit);
  const [showDrafts, setShowDrafts] = useState(false);

  const accounts = useMailStore(s => s.accounts);
  const activeAccountId = useMailStore(s => s.activeAccountId);
  const signatures = useMailStore(s => s.signatures);
  const activeSignatureId = useMailStore(s => s.activeSignatureId);
  const drafts = useMailStore(s => s.drafts);
  const addOrUpdateDraft = useMailStore(s => s.addOrUpdateDraft);
  const deleteDraft = useMailStore(s => s.deleteDraft);
  const setDrafts = useMailStore(s => s.setDrafts);
  const addHistoryEntry = useMailStore(s => s.addHistoryEntry);
  const sendHistory = useMailStore(s => s.sendHistory);
  const replyContext = useMailStore(s => s.replyContext);
  const setReplyContext = useMailStore(s => s.setReplyContext);
  const openDraftId = useMailStore(s => s.openDraftId);
  const setOpenDraftId = useMailStore(s => s.setOpenDraftId);
  const setCurrentView = useMailStore(s => s.setCurrentView);

  const [selectedAccountId, setSelectedAccountId] = useState(activeAccountId);
  const [selectedSignatureId, setSelectedSignatureId] = useState(activeSignatureId);

  // 初始化 activeAccountId/签名
  useEffect(() => {
    if (activeAccountId && !selectedAccountId) {
      setSelectedAccountId(activeAccountId);
    }
  }, [activeAccountId, selectedAccountId]);

  useEffect(() => {
    if (activeSignatureId && !selectedSignatureId) {
      setSelectedSignatureId(activeSignatureId);
    }
  }, [activeSignatureId, selectedSignatureId]);

  // 草稿编辑信号接入（从草稿箱跳转过来）
  useEffect(() => {
    if (!openDraftId) return;
    const draft = drafts.find(d => d.id === openDraftId);
    if (draft) {
      setState({
        to: draft.recipients,
        cc: draft.cc || '',
        bcc: draft.bcc || '',
        subject: draft.subject,
        body: draft.emailBody,
        showCc: !!(draft.cc),
        showBcc: !!(draft.bcc),
        attachments: draft.attachments || [],
        sending: false,
        error: '',
        success: '',
        draftId: draft.id,
      });
      if (draft.accountId) setSelectedAccountId(draft.accountId);
      if (draft.activeSignatureId) setSelectedSignatureId(draft.activeSignatureId);
    }
    setOpenDraftId(null);
  }, [openDraftId, drafts, setOpenDraftId]);

  // 回复上下文接入
  useEffect(() => {
    if (replyContext) {
      setState(prev => ({
        ...prev,
        to: replyContext.to,
        subject: replyContext.subject,
        body: replyContext.quotedBody,
        showCc: false,
        showBcc: false,
      }));
      setReplyContext(null);
    }
  }, [replyContext, setReplyContext]);

  const set = useCallback((patch: Partial<ComposeState>) =>
    setState(prev => ({ ...prev, ...patch })), []);

  const activeAccount = accounts.find(a => a.id === (selectedAccountId || activeAccountId));
  const activeSig = signatures.find(s => s.id === selectedSignatureId);

  const handleSend = useCallback(async () => {
    if (!state.to.trim()) { set({ error: '请填写收件人邮箱地址' }); return; }
    if (!state.subject.trim()) { set({ error: '请填写邮件主题' }); return; }
    if (!activeAccount) { set({ error: '未选择发件账户，请先在设置中添加邮箱账户' }); return; }

    set({ sending: true, error: '', success: '' });
    try {
      // 拼接签名
      const bodyWithSig = activeSig
        ? `${state.body}\n\n--\n${activeSig.content}`
        : state.body;

      const htmlBody = `<div style="font-family:宋体,SimSun,serif;font-size:16px;">${
        bodyWithSig.replace(/\n/g, '<br/>')
      }</div>`;

      await invoke('send_email', {
        smtpHost: activeAccount.smtpHost,
        smtpPort: activeAccount.smtpPort,
        encryption: activeAccount.encryption,
        email: activeAccount.email,
        accountId: activeAccount.hasKeyringPassword ? activeAccount.id : null,
        password: activeAccount.hasKeyringPassword ? null : (activeAccount.password || null),
        displayName: activeAccount.displayName || null,
        to: state.to.split(/[,;，；\s]+/).map(s => s.trim()).filter(Boolean),
        cc: state.cc ? state.cc.split(/[,;，；\s]+/).map(s => s.trim()).filter(Boolean) : [],
        bcc: state.bcc ? state.bcc.split(/[,;，；\s]+/).map(s => s.trim()).filter(Boolean) : [],
        replyTo: null,
        priority: null,
        subject: state.subject,
        body: htmlBody,
        isHtml: true,
        isRawHtml: true,
        attachments: state.attachments.map(a => ({ path: a.path, filename: a.filename, mimeType: a.mimeType })),
        requestReadReceipt: false,
      });

      // 删除对应草稿
      if (drafts.some(d => d.id === state.draftId)) {
        const updated = drafts.filter(d => d.id !== state.draftId);
        setDrafts(updated);
        await saveDrafts(updated);
      }

      // 写入发送历史
      const toList = state.to.split(/[,;，；\s]+/).map(s => s.trim()).filter(Boolean);
      const entry = {
        timestamp: Date.now(),
        to: toList,
        cc: state.cc ? state.cc.split(/[,;，；\s]+/).map(s => s.trim()).filter(Boolean) : [],
        bcc: state.bcc ? state.bcc.split(/[,;，；\s]+/).map(s => s.trim()).filter(Boolean) : [],
        subject: state.subject,
        body: state.body,
        accountId: activeAccount.id,
        accountEmail: activeAccount.email,
        status: 'success' as const,
      };
      addHistoryEntry(entry);
      const updatedHistory = [entry, ...sendHistory].slice(0, 500);
      saveSendHistory(updatedHistory).catch(err => console.error('[ComposeView] 历史持久化失败:', err));

      const newState = makeInit();
      setState({ ...newState, success: '邮件发送成功！' });
    } catch (err) {
      set({ sending: false, error: err instanceof Error ? err.message : String(err) });
    }
  }, [state, activeAccount, activeSig, drafts, setDrafts, addHistoryEntry, sendHistory, set]);

  const handleSaveDraft = useCallback(async () => {
    if (!state.to && !state.subject && !state.body) {
      set({ error: '草稿内容为空，无需保存' });
      return;
    }
    const now = Date.now();
    const draft: EmailDraft = {
      id: state.draftId,
      name: state.subject || '（无主题）',
      recipients: state.to,
      cc: state.cc,
      bcc: state.bcc,
      subject: state.subject,
      emailBody: state.body,
      emailFormat: 'html',
      accountId: selectedAccountId || activeAccountId,
      attachments: state.attachments,
      activeSignatureId: selectedSignatureId,
      createdAt: drafts.find(d => d.id === state.draftId)?.createdAt || now,
      updatedAt: now,
    };
    addOrUpdateDraft(draft);
    const updated = drafts.some(d => d.id === draft.id)
      ? drafts.map(d => d.id === draft.id ? draft : d)
      : [...drafts, draft];
    await saveDrafts(updated);
    set({ success: '草稿已保存' });
    setTimeout(() => set({ success: '' }), 2000);
  }, [state, selectedAccountId, activeAccountId, selectedSignatureId, drafts, addOrUpdateDraft, set]);

  const handleLoadDraft = useCallback(async (draft: EmailDraft) => {
    setState({
      to: draft.recipients,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.emailBody,
      showCc: !!draft.cc,
      showBcc: !!draft.bcc,
      attachments: draft.attachments,
      sending: false, error: '', success: '',
      draftId: draft.id,
    });
    setSelectedAccountId(draft.accountId || activeAccountId);
    setSelectedSignatureId(draft.activeSignatureId || activeSignatureId);
    setShowDrafts(false);
  }, [activeAccountId, activeSignatureId]);

  const handleDeleteDraft = useCallback(async (id: string) => {
    deleteDraft(id);
    const updated = drafts.filter(d => d.id !== id);
    await saveDrafts(updated);
  }, [deleteDraft, drafts]);

  const handleDiscard = useCallback(() => {
    setState(makeInit());
    setReplyContext(null);
  }, [setReplyContext]);

  return (
    <div style={S.root}>
      {/* 头部 */}
      <div style={S.header}>
        <span style={S.headerTitle}>写邮件</span>
        {drafts.length > 0 && (
          <button style={S.btnSmall(showDrafts)} onClick={() => setShowDrafts(v => !v)}>
            草稿 ({drafts.length})
          </button>
        )}
      </div>

      {/* 草稿列表侧栏 */}
      {showDrafts && (
        <div style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa', padding: '6px 12px', maxHeight: 160, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>点击加载草稿：</div>
          {drafts.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={S.draftListItem(d.id === state.draftId)} onClick={() => handleLoadDraft(d)}>
                {d.name || '（无主题）'} — {new Date(d.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              <button style={{ ...S.btnSmall(), color: '#dc2626', fontSize: 11 }}
                onClick={() => handleDeleteDraft(d.id)}>删除</button>
            </div>
          ))}
        </div>
      )}

      {/* 表单区 */}
      <div style={S.form}>
        {/* 发件人 */}
        <div style={S.row}>
          <span style={S.label}>发件人</span>
          {accounts.length === 0 ? (
            <span style={{ ...S.input, color: '#94a3b8', cursor: 'pointer' }}
              onClick={() => setCurrentView('settings')}>
              未配置账户，点击前往设置 →
            </span>
          ) : (
            <select value={selectedAccountId || activeAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              style={S.accountSelect}>
              {accounts.filter(a => a.enabled).map(a => (
                <option key={a.id} value={a.id}>
                  {a.displayName ? `${a.displayName} <${a.email}>` : a.email}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 收件人 */}
        <div style={S.row}>
          <span style={S.label}>收件人</span>
          <input style={S.input} value={state.to}
            onChange={e => set({ to: e.target.value, error: '' })}
            placeholder="多个地址用逗号或分号分隔" />
          <button style={S.btnSmall(state.showCc)} onClick={() => set({ showCc: !state.showCc })}>抄送</button>
          <button style={S.btnSmall(state.showBcc)} onClick={() => set({ showBcc: !state.showBcc })}>密送</button>
        </div>

        {/* 抄送 */}
        {state.showCc && (
          <div style={S.row}>
            <span style={S.label}>抄送</span>
            <input style={S.input} value={state.cc}
              onChange={e => set({ cc: e.target.value })}
              placeholder="多个地址用逗号分隔" />
          </div>
        )}

        {/* 密送 */}
        {state.showBcc && (
          <div style={S.row}>
            <span style={S.label}>密送</span>
            <input style={S.input} value={state.bcc}
              onChange={e => set({ bcc: e.target.value })}
              placeholder="多个地址用逗号分隔" />
          </div>
        )}

        {/* 主题 */}
        <div style={S.row}>
          <span style={S.label}>主题</span>
          <input style={S.subjectInput} value={state.subject}
            onChange={e => set({ subject: e.target.value, error: '' })}
            placeholder="邮件主题" />
        </div>

        {/* 签名选择 */}
        {signatures.length > 0 && (
          <div style={{ ...S.row, borderBottom: 'none' }}>
            <span style={S.label}>签名</span>
            <select value={selectedSignatureId} onChange={e => setSelectedSignatureId(e.target.value)}
              style={S.sigSelect}>
              <option value="">不使用签名</option>
              {signatures.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 正文 */}
        <textarea style={S.textarea} value={state.body}
          onChange={e => set({ body: e.target.value })}
          placeholder="邮件正文..." />

        {/* 签名预览 */}
        {activeSig && (
          <div style={S.sigPreview}
            dangerouslySetInnerHTML={{ __html: `--<br/>${activeSig.content.replace(/\n/g, '<br/>')}` }} />
        )}

        {/* 附件 */}
        {state.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 0' }}>
            {state.attachments.map(att => (
              <span key={att.id} style={S.attachTag}>
                📎 {att.filename}
                <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 12, padding: 0 }}
                  onClick={() => set({ attachments: state.attachments.filter(a => a.id !== att.id) })}>×</button>
              </span>
            ))}
          </div>
        )}

        {state.error && <div style={{ ...S.msg, ...S.msgError }}>{state.error}</div>}
        {state.success && <div style={{ ...S.msg, ...S.msgSuccess }}>{state.success}</div>}
      </div>

      {/* 工具栏 */}
      <div style={S.toolbar}>
        <button style={{ ...S.btn, ...S.btnPrimary, opacity: state.sending ? 0.6 : 1 }}
          onClick={handleSend} disabled={state.sending}>
          {state.sending ? '发送中...' : '发 送'}
        </button>
        <button style={{ ...S.btn, ...S.btnSecondary }} onClick={handleSaveDraft}>存草稿</button>
        <button style={{ ...S.btn, ...S.btnSecondary }} onClick={handleDiscard}>丢 弃</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {state.to.split(/[,;，；]/).filter(s => s.trim()).length || 0} 个收件人
        </span>
      </div>
    </div>
  );
}
