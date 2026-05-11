// ── 已发送视图 ──

import { useState, useMemo } from 'react';
import { useMailStore } from '../store/useMailStore';
import type { SendHistoryEntry } from '../types/email';
import { saveSendHistory } from '../lib/storage';
import { sanitizeHtml } from '@/lib/sanitize';

const S = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100%', fontFamily: '宋体, SimSun, serif', fontSize: 16 },
  header: { padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  headerTitle: { fontSize: 15, fontWeight: 600, color: '#1e293b', flex: 1 },
  toolbar: { padding: '8px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  search: { flex: 1, padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 14, fontFamily: '宋体, SimSun, serif', outline: 'none' },
  list: { flex: 1, overflowY: 'auto' as const },
  row: (selected: boolean): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: '1fr 200px 100px 80px',
    gap: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 14,
    background: selected ? '#eff6ff' : 'transparent',
    borderBottom: '1px solid #f8fafc',
    alignItems: 'center',
  }),
  th: {
    display: 'grid', gridTemplateColumns: '1fr 200px 100px 80px',
    gap: 8, padding: '6px 16px', background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0', fontSize: 13, color: '#64748b', fontWeight: 500,
    flexShrink: 0,
  },
  detail: { borderLeft: '1px solid #e2e8f0', width: 380, display: 'flex', flexDirection: 'column' as const, background: '#fafafa', flexShrink: 0 },
  detailHeader: { padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 },
  detailBody: { flex: 1, overflowY: 'auto' as const, padding: 16, fontSize: 14, color: '#334155', lineHeight: 1.7 },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusBadge: (ok: boolean): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 7px', borderRadius: 10, fontSize: 12,
    background: ok ? '#dcfce7' : '#fee2e2',
    color: ok ? '#16a34a' : '#dc2626',
  }),
  empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 15 },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 4, border: primary ? 'none' : '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: 13, fontFamily: '宋体, SimSun, serif',
    background: primary ? '#3b82f6' : '#fff', color: primary ? '#fff' : '#334155',
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

export function SentView() {
  const sendHistory = useMailStore(s => s.sendHistory);
  const setSendHistory = useMailStore(s => s.setSendHistory);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SendHistoryEntry | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return sendHistory;
    const q = search.toLowerCase();
    return sendHistory.filter(e =>
      e.subject.toLowerCase().includes(q) ||
      e.to.join(',').toLowerCase().includes(q) ||
      (e.body || '').toLowerCase().includes(q),
    );
  }, [sendHistory, search]);

  const handleClear = () => {
    if (!confirm('确定清除全部发送历史？此操作不可撤销。')) return;
    setSendHistory([]);
    setSelected(null);
    saveSendHistory([]).catch(err => console.error('[SentView] 清除历史持久化失败:', err));
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <span style={S.headerTitle}>已发送</span>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>共 {sendHistory.length} 封</span>
        {sendHistory.length > 0 && (
          <button style={S.btn()} onClick={handleClear}>清除历史</button>
        )}
      </div>
      <div style={S.toolbar}>
        <input style={S.search} placeholder="搜索已发邮件..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={S.th}>
            <span>主题 / 收件人</span>
            <span>发件账户</span>
            <span>时间</span>
            <span>状态</span>
          </div>
          <div style={S.list}>
            {filtered.length === 0 ? (
              <div style={S.empty}>
                {sendHistory.length === 0 ? '暂无发送记录' : '无匹配结果'}
              </div>
            ) : filtered.map((entry, idx) => (
              <div key={`${entry.timestamp}_${idx}`}
                style={S.row(selected === entry)}
                onClick={() => setSelected(entry)}>
                <div>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.subject || '（无主题）'}
                  </div>
                  <div style={S.meta}>
                    收件人：{entry.to.join(', ')}
                    {entry.bulkJobName && <span style={{ marginLeft: 8, color: '#6366f1' }}>群发：{entry.bulkJobName}</span>}
                  </div>
                </div>
                <span style={{ color: '#64748b', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.accountEmail || entry.accountId}
                </span>
                <span style={{ color: '#64748b', fontSize: 12 }}>{formatDate(entry.timestamp)}</span>
                <span style={S.statusBadge(entry.status === 'success')}>
                  {entry.status === 'success' ? '成功' : '失败'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 详情面板 */}
        {selected && (
          <div style={S.detail}>
            <div style={S.detailHeader}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{selected.subject || '（无主题）'}</div>
              <div style={S.meta}>收件人：{selected.to.join(', ')}</div>
              {selected.cc && selected.cc.length > 0 && <div style={S.meta}>抄送：{selected.cc.join(', ')}</div>}
              <div style={S.meta}>时间：{new Date(selected.timestamp).toLocaleString('zh-CN')}</div>
              <div style={S.meta}>账户：{selected.accountEmail || selected.accountId}</div>
              {selected.status === 'error' && selected.statusMsg && (
                <div style={{ marginTop: 6, padding: '4px 8px', background: '#fef2f2', color: '#dc2626', borderRadius: 4, fontSize: 12 }}>
                  错误：{selected.statusMsg}
                </div>
              )}
              <button style={{ ...S.btn(), marginTop: 8 }} onClick={() => setSelected(null)}>关闭</button>
            </div>
            <div style={S.detailBody}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.body || '（无正文）') }} />
          </div>
        )}
      </div>
    </div>
  );
}
