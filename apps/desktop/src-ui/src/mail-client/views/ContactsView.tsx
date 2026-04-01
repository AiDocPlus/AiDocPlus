// ── 联系人管理视图（含单位/分类/专属模板编辑） ──

import { useState, useCallback, useMemo } from 'react';
import { useMailStore } from '../store/useMailStore';
import { saveContacts } from '../lib/storage';
import type { Contact } from '../types/contact';

const S = {
  root: { display: 'flex', height: '100%', fontFamily: '宋体, SimSun, serif', fontSize: 16 },
  sidebar: { width: 180, borderRight: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column' as const, padding: '8px 0' },
  sidebarItem: (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', cursor: 'pointer', fontSize: 14,
    background: active ? '#eff6ff' : 'transparent', color: active ? '#2563eb' : '#334155',
    borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
  }),
  content: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  toolbar: { display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
  search: { flex: 1, padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 14, fontFamily: '宋体, SimSun, serif', outline: 'none' },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 4, border: primary ? 'none' : '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: 14, fontFamily: '宋体, SimSun, serif',
    background: primary ? '#3b82f6' : '#fff', color: primary ? '#fff' : '#334155',
  }),
  list: { flex: 1, overflowY: 'auto' as const },
  row: (selected: boolean): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: '32px 1fr 160px 100px 80px 80px', alignItems: 'center',
    gap: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14,
    background: selected ? '#eff6ff' : 'transparent', borderBottom: '1px solid #f8fafc',
  }),
  th: { display: 'grid', gridTemplateColumns: '32px 1fr 160px 100px 80px 80px', gap: 8, padding: '6px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 13, color: '#64748b', fontWeight: 500 },
  tag: (color: string): React.CSSProperties => ({ background: color, color: '#fff', padding: '1px 6px', borderRadius: 10, fontSize: 12 }),
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox: { background: '#fff', borderRadius: 8, padding: 24, width: 540, maxHeight: '85vh', overflowY: 'auto' as const, fontFamily: '宋体, SimSun, serif' },
  modalTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#1e293b' },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  fieldInput: { width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 15, fontFamily: '宋体, SimSun, serif', outline: 'none', boxSizing: 'border-box' as const },
  fieldTextarea: { width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 15, fontFamily: '宋体, SimSun, serif', outline: 'none', resize: 'vertical' as const, minHeight: 80, boxSizing: 'border-box' as const },
  modalFooter: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 },
  empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 15 },
};

const CATEGORY_COLORS: Record<string, string> = {
  '期刊': '#3b82f6', '出版社': '#8b5cf6', '学术会议': '#059669', '默认': '#94a3b8',
};

function getCategoryColor(cat?: string) {
  return cat ? (CATEGORY_COLORS[cat] || '#6366f1') : '#94a3b8';
}

const EMPTY_CONTACT: Omit<Contact, 'id'> = {
  email: '', name: '', organization: '', category: '', note: '',
  groupId: '', starred: false, customSubjectTemplate: '', customBodyTemplate: '',
};

export function ContactsView() {
  const contacts = useMailStore(s => s.contacts);
  const setContacts = useMailStore(s => s.setContacts);
  const groups = useMailStore(s => s.contactGroups);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editContact, setEditContact] = useState<(Contact & { isNew?: boolean }) | null>(null);
  const [showTemplateTab, setShowTemplateTab] = useState(false);

  const filtered = useMemo(() => {
    let list = contacts;
    if (selectedGroupId) list = list.filter(c => c.groupId === selectedGroupId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.email.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q) ||
        (c.organization || '').toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [contacts, selectedGroupId, search]);

  const persistContacts = useCallback(async (updated: Contact[]) => {
    setContacts(updated);
    await saveContacts(updated, groups);
  }, [setContacts, groups]);

  const handleSave = useCallback(async () => {
    if (!editContact) return;
    if (!editContact.email.trim()) return;
    const now = Date.now();
    let updated: Contact[];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isNew: _isNew, ...contactData } = editContact as Contact & { isNew?: boolean };
    if (editContact.isNew) {
      const newC: Contact = {
        ...contactData,
        id: `c_${now}_${Math.random().toString(36).slice(2, 5)}`,
        createdAt: now,
      };
      updated = [...contacts, newC];
    } else {
      updated = contacts.map(c => c.id === editContact.id ? contactData : c);
    }
    await persistContacts(updated);
    setEditContact(null);
    setShowTemplateTab(false);
  }, [editContact, contacts, persistContacts]);

  const handleDelete = useCallback(async (ids: string[]) => {
    const updated = contacts.filter(c => !ids.includes(c.id));
    await persistContacts(updated);
    setSelected(new Set());
  }, [contacts, persistContacts]);

  const handleExportCSV = useCallback(() => {
    const header = '姓名,邮箱,单位,分类,备注';
    const rows = filtered.map(c =>
      [c.name, c.email, c.organization || '', c.category || '', c.note || '']
        .map(v => `"${v.replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '联系人.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const openNew = () => {
    setEditContact({ id: '', ...EMPTY_CONTACT, isNew: true });
    setShowTemplateTab(false);
  };

  return (
    <div style={S.root}>
      {/* 左侧分组 */}
      <div style={S.sidebar}>
        <div style={S.sidebarItem(!selectedGroupId)} onClick={() => setSelectedGroupId(null)}>
          全部联系人 ({contacts.length})
        </div>
        {groups.map(g => (
          <div key={g.id} style={S.sidebarItem(selectedGroupId === g.id)} onClick={() => setSelectedGroupId(g.id)}>
            {g.name}
          </div>
        ))}
      </div>

      {/* 右侧内容 */}
      <div style={S.content}>
        <div style={S.toolbar}>
          <input
            style={S.search}
            placeholder="搜索联系人..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button style={S.btn(true)} onClick={openNew}>+ 新建</button>
          {selected.size > 0 && (
            <button style={S.btn()} onClick={() => handleDelete(Array.from(selected))}>
              删除 ({selected.size})
            </button>
          )}
          <button style={S.btn()} onClick={handleExportCSV}>导出 CSV</button>
        </div>

        {/* 表头 */}
        <div style={S.th}>
          <span />
          <span>姓名 / 邮箱</span>
          <span>单位</span>
          <span>分类</span>
          <span>专属模板</span>
          <span>操作</span>
        </div>

        {/* 列表 */}
        <div style={S.list}>
          {filtered.length === 0 ? (
            <div style={S.empty}>暂无联系人</div>
          ) : (
            filtered.map(c => (
              <div key={c.id} style={S.row(selected.has(c.id))}>
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={e => {
                    const s = new Set(selected);
                    e.target.checked ? s.add(c.id) : s.delete(c.id);
                    setSelected(s);
                  }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{c.name || '（未填姓名）'}</div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{c.email}</div>
                </div>
                <span style={{ color: '#475569' }}>{c.organization || '-'}</span>
                <span>
                  {c.category ? (
                    <span style={S.tag(getCategoryColor(c.category))}>{c.category}</span>
                  ) : '-'}
                </span>
                <span style={{ color: c.customBodyTemplate ? '#16a34a' : '#94a3b8', fontSize: 13 }}>
                  {c.customBodyTemplate ? '已设置' : '无'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={S.btn()} onClick={() => { setEditContact({ ...c }); setShowTemplateTab(false); }}>编辑</button>
                  <button style={{ ...S.btn(), color: '#dc2626' }} onClick={() => handleDelete([c.id])}>删除</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 编辑弹窗 */}
      {editContact && (
        <div style={S.modal} onClick={e => e.target === e.currentTarget && setEditContact(null)}>
          <div style={S.modalBox}>
            <div style={S.modalTitle}>{editContact.isNew ? '新建联系人' : '编辑联系人'}</div>

            {/* Tab 切换 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
              <button
                style={{ padding: '6px 16px', border: 'none', borderBottom: showTemplateTab ? 'none' : '2px solid #3b82f6', cursor: 'pointer', background: 'transparent', color: showTemplateTab ? '#64748b' : '#3b82f6', fontFamily: '宋体, SimSun, serif', fontSize: 14 }}
                onClick={() => setShowTemplateTab(false)}
              >基本信息</button>
              <button
                style={{ padding: '6px 16px', border: 'none', borderBottom: showTemplateTab ? '2px solid #3b82f6' : 'none', cursor: 'pointer', background: 'transparent', color: showTemplateTab ? '#3b82f6' : '#64748b', fontFamily: '宋体, SimSun, serif', fontSize: 14 }}
                onClick={() => setShowTemplateTab(true)}
              >专属模板</button>
            </div>

            {!showTemplateTab ? (
              <>
                {[
                  { key: 'email', label: '邮箱 *', placeholder: '必填' },
                  { key: 'name', label: '姓名', placeholder: '' },
                  { key: 'organization', label: '单位/机构', placeholder: '' },
                  { key: 'category', label: '分类', placeholder: '期刊/出版社/学术会议等' },
                  { key: 'note', label: '备注', placeholder: '' },
                ].map(f => (
                  <div key={f.key} style={S.field}>
                    <div style={S.fieldLabel}>{f.label}</div>
                    <input
                      style={S.fieldInput}
                      placeholder={f.placeholder}
                      value={(editContact as unknown as Record<string, string>)[f.key] || ''}
                      onChange={e => setEditContact(prev => prev ? { ...prev, [f.key]: e.target.value } : null)}
                    />
                  </div>
                ))}

                <div style={S.field}>
                  <div style={S.fieldLabel}>分组</div>
                  <select
                    style={{ ...S.fieldInput, height: 34 }}
                    value={editContact.groupId || ''}
                    onChange={e => setEditContact(prev => prev ? { ...prev, groupId: e.target.value } : null)}
                    title="选择联系人分组"
                  >
                    <option value="">无分组</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#92400e' }}>
                  专属模板优先级最高，将覆盖群发任务的通用模板。支持变量：{'{{recipient_name}}'}、{'{{recipient_organization}}'}、{'{{title}}'}、{'{{date}}'} 等。
                </div>
                <div style={S.field}>
                  <div style={S.fieldLabel}>专属主题模板</div>
                  <input
                    style={S.fieldInput}
                    placeholder="例：投稿至{{recipient_organization}}——{{title}}"
                    value={editContact.customSubjectTemplate || ''}
                    onChange={e => setEditContact(prev => prev ? { ...prev, customSubjectTemplate: e.target.value } : null)}
                  />
                </div>
                <div style={S.field}>
                  <div style={S.fieldLabel}>专属正文模板</div>
                  <textarea
                    style={S.fieldTextarea}
                    placeholder="例：尊敬的{{recipient_name}}编辑..."
                    value={editContact.customBodyTemplate || ''}
                    onChange={e => setEditContact(prev => prev ? { ...prev, customBodyTemplate: e.target.value } : null)}
                  />
                </div>
              </>
            )}

            <div style={S.modalFooter}>
              <button style={S.btn()} onClick={() => { setEditContact(null); setShowTemplateTab(false); }}>取消</button>
              <button style={S.btn(true)} onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
