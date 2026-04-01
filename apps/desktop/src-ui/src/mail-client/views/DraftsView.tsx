// ── 草稿箱视图 ──

import { useState, useMemo } from 'react';
import { useMailStore } from '../store/useMailStore';
import { saveDrafts } from '../lib/storage';
import type { EmailDraft } from '../types/email';

const S = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100%', fontFamily: '宋体, SimSun, serif', fontSize: 16 },
  header: { padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  headerTitle: { fontSize: 15, fontWeight: 600, color: '#1e293b', flex: 1 },
  toolbar: { padding: '8px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  search: { flex: 1, padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 14, fontFamily: '宋体, SimSun, serif', outline: 'none' },
  list: { flex: 1, overflowY: 'auto' as const },
  th: {
    display: 'grid', gridTemplateColumns: '1fr 160px 120px 80px',
    gap: 8, padding: '6px 16px', background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0', fontSize: 13, color: '#64748b', fontWeight: 500,
    flexShrink: 0,
  },
  row: (selected: boolean): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: '1fr 160px 120px 80px',
    gap: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 14,
    background: selected ? '#eff6ff' : 'transparent',
    borderBottom: '1px solid #f8fafc',
    alignItems: 'center',
  }),
  meta: { fontSize: 12, color: '#94a3b8' },
  empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 15, flexDirection: 'column' as const, gap: 8 },
  btn: (primary?: boolean, danger?: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 4, border: primary ? 'none' : '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: 13, fontFamily: '宋体, SimSun, serif',
    background: danger ? '#fee2e2' : primary ? '#3b82f6' : '#fff',
    color: danger ? '#dc2626' : primary ? '#fff' : '#334155',
  }),
};

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DraftsView() {
  const drafts = useMailStore(s => s.drafts);
  const setDrafts = useMailStore(s => s.setDrafts);
  const setCurrentView = useMailStore(s => s.setCurrentView);
  const setOpenDraftId = useMailStore(s => s.setOpenDraftId);
  const accounts = useMailStore(s => s.accounts);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EmailDraft | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return drafts;
    const q = search.toLowerCase();
    return drafts.filter(d =>
      (d.subject || '').toLowerCase().includes(q) ||
      (d.recipients || '').toLowerCase().includes(q) ||
      (d.emailBody || '').toLowerCase().includes(q),
    );
  }, [drafts, search]);

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`确定删除 ${ids.length} 封草稿？`)) return;
    const updated = drafts.filter(d => !ids.includes(d.id));
    setDrafts(updated);
    await saveDrafts(updated);
    if (selected && ids.includes(selected.id)) setSelected(null);
    setSelectedIds(new Set());
  };

  const handleOpen = (draft: EmailDraft) => {
    setOpenDraftId(draft.id);
    setCurrentView('compose');
  };

  const getAccountEmail = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.email || accountId;
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <span style={S.headerTitle}>草稿箱</span>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>{drafts.length} 封草稿</span>
        {selectedIds.size > 0 && (
          <button style={S.btn(false, true)} onClick={() => handleDelete(Array.from(selectedIds))}>
            删除 ({selectedIds.size})
          </button>
        )}
        <button style={S.btn(true)} onClick={() => setCurrentView('compose')}>写新邮件</button>
      </div>
      <div style={S.toolbar}>
        <input style={S.search} placeholder="搜索草稿..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={S.th}>
            <span>主题</span>
            <span>收件人</span>
            <span>修改时间</span>
            <span>操作</span>
          </div>
          <div style={S.list}>
            {filtered.length === 0 ? (
              <div style={S.empty}>
                <span>📝</span>
                <span>{drafts.length === 0 ? '暂无草稿' : '无匹配草稿'}</span>
                {drafts.length === 0 && (
                  <button style={S.btn(true)} onClick={() => setCurrentView('compose')}>写邮件</button>
                )}
              </div>
            ) : filtered.map(d => (
              <div key={d.id} style={S.row(selected?.id === d.id)}
                onClick={() => setSelected(selected?.id === d.id ? null : d)}>
                <div>
                  <div style={{ fontWeight: 500 }}>{d.subject || '（无主题）'}</div>
                  <div style={S.meta}>{getAccountEmail(d.accountId)}</div>
                </div>
                <span style={{ fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.recipients || '（未填收件人）'}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{formatDate(d.updatedAt)}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={S.btn(true)} onClick={e => { e.stopPropagation(); handleOpen(d); }}>
                    编辑
                  </button>
                  <button style={S.btn(false, true)} onClick={e => { e.stopPropagation(); handleDelete([d.id]); }}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 草稿预览 */}
        {selected && (
          <div style={{ width: 340, borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#fafafa', flexShrink: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{selected.subject || '（无主题）'}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>收件人：{selected.recipients || '（未填）'}</div>
              {selected.cc && <div style={{ fontSize: 12, color: '#94a3b8' }}>抄送：{selected.cc}</div>}
              <div style={{ fontSize: 12, color: '#94a3b8' }}>修改：{new Date(selected.updatedAt).toLocaleString('zh-CN')}</div>
              <button style={{ ...S.btn(true), marginTop: 8 }} onClick={() => handleOpen(selected)}>
                在写邮件中编辑
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
              {selected.emailBody || '（无正文）'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
