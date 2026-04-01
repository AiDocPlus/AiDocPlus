// ── 模板管理视图 ──

import { useState, useCallback } from 'react';
import { useMailStore } from '../store/useMailStore';
import type { SubmissionTemplate } from '../types/email';
import { BUILTIN_VARIABLES } from '../lib/templateVars';
import { saveTemplates } from '../lib/storage';

const S = {
  root: { display: 'flex', height: '100%', fontFamily: '宋体, SimSun, serif', fontSize: 16 },
  list: { width: 260, borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' as const, background: '#f8fafc' },
  listToolbar: { padding: '10px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 6 },
  listItems: { flex: 1, overflowY: 'auto' as const },
  listItem: (active: boolean): React.CSSProperties => ({
    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
    background: active ? '#eff6ff' : 'transparent',
    borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
  }),
  itemName: { fontSize: 14, fontWeight: 500, color: '#1e293b', marginBottom: 2 },
  itemMeta: { fontSize: 12, color: '#94a3b8' },
  editor: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  editorHeader: { padding: '10px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, alignItems: 'center' },
  editorTitle: { flex: 1, fontSize: 15, fontWeight: 600, color: '#1e293b' },
  editorBody: { flex: 1, overflowY: 'auto' as const, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12 },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  label: { fontSize: 13, color: '#64748b', fontWeight: 500 },
  input: { padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 15, fontFamily: '宋体, SimSun, serif', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 15, fontFamily: '宋体, SimSun, serif', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const },
  btn: (primary?: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 4, border: primary ? 'none' : '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: 14, fontFamily: '宋体, SimSun, serif',
    background: primary ? '#3b82f6' : '#fff', color: primary ? '#fff' : '#334155',
  }),
  typeTag: (type?: string): React.CSSProperties => ({
    display: 'inline-block', padding: '1px 8px', borderRadius: 10, fontSize: 11,
    background: type === 'recipient' ? '#f0fdf4' : '#eff6ff',
    color: type === 'recipient' ? '#15803d' : '#1d4ed8',
    border: type === 'recipient' ? '1px solid #bbf7d0' : '1px solid #bfdbfe',
  }),
  varHint: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '8px 12px', fontSize: 13, color: '#475569' },
  empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 15 },
};

const EMPTY_TPL: Omit<SubmissionTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', description: '', type: 'general', recipients: [], cc: [], bcc: [],
  subjectTemplate: '', bodyTemplate: '', variables: [], category: '',
};

export function TemplatesView() {
  const templates = useMailStore(s => s.templates);
  const setTemplates = useMailStore(s => s.setTemplates);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SubmissionTemplate | null>(null);
  const [dirty, setDirty] = useState(false);


  const persistTemplates = useCallback((updated: SubmissionTemplate[]) => {
    setTemplates(updated);
    saveTemplates(updated).catch(err => console.error('[TemplatesView] 保存失败:', err));
  }, [setTemplates]);

  const handleNew = () => {
    const now = Date.now();
    const tpl: SubmissionTemplate = {
      ...EMPTY_TPL,
      id: `tpl_${now}_${Math.random().toString(36).slice(2, 5)}`,
      createdAt: now, updatedAt: now,
      variables: [],
    };
    setEditing(tpl);
    setActiveId(tpl.id);
    setDirty(true);
  };

  const handleSelect = (id: string) => {
    if (dirty && editing && !confirm('当前模板有未保存的修改，是否放弃？')) return;
    const t = templates.find(t => t.id === id);
    setActiveId(id);
    setEditing(t ? { ...t } : null);
    setDirty(false);
  };

  const handleSave = () => {
    if (!editing) return;
    const now = Date.now();
    const updated = editing.createdAt
      ? templates.find(t => t.id === editing.id)
        ? templates.map(t => t.id === editing.id ? { ...editing, updatedAt: now } : t)
        : [...templates, { ...editing, updatedAt: now }]
      : [...templates, { ...editing, createdAt: now, updatedAt: now }];
    persistTemplates(updated);
    setActiveId(editing.id);
    setDirty(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定删除此模板？')) return;
    const updated = templates.filter(t => t.id !== id);
    persistTemplates(updated);
    if (activeId === id) { setActiveId(null); setEditing(null); }
  };

  const handleDuplicate = (tpl: SubmissionTemplate) => {
    const now = Date.now();
    const copy: SubmissionTemplate = {
      ...tpl,
      id: `tpl_${now}_${Math.random().toString(36).slice(2, 5)}`,
      name: `${tpl.name}（副本）`,
      createdAt: now, updatedAt: now,
    };
    persistTemplates([...templates, copy]);
    setActiveId(copy.id);
    setEditing({ ...copy });
    setDirty(false);
  };

  const upd = (patch: Partial<SubmissionTemplate>) => {
    setEditing(prev => prev ? { ...prev, ...patch } : null);
    setDirty(true);
  };

  return (
    <div style={S.root}>
      {/* 左侧模板列表 */}
      <div style={S.list}>
        <div style={S.listToolbar}>
          <button style={S.btn(true)} onClick={handleNew}>+ 新建</button>
        </div>
        <div style={S.listItems}>
          {templates.length === 0 ? (
            <div style={{ padding: 16, color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>暂无模板</div>
          ) : templates.map(t => (
            <div key={t.id} style={S.listItem(activeId === t.id)} onClick={() => handleSelect(t.id)}>
              <div style={S.itemName}>{t.name || '（无标题）'}</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                <span style={S.typeTag(t.type)}>{t.type === 'recipient' ? '专用' : '通用'}</span>
                {t.category && <span style={{ ...S.itemMeta }}>{t.category}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧编辑区 */}
      <div style={S.editor}>
        {!editing ? (
          <div style={S.empty}>选择或新建模板</div>
        ) : (
          <>
            <div style={S.editorHeader}>
              <span style={S.editorTitle}>{editing.name || '（新模板）'}</span>
              {dirty && <span style={{ fontSize: 12, color: '#f59e0b' }}>● 未保存</span>}
              <button style={S.btn(true)} onClick={handleSave}>保存</button>
              {templates.find(t => t.id === editing.id) && (
                <>
                  <button style={S.btn()} onClick={() => handleDuplicate(editing)}>复制</button>
                  <button style={{ ...S.btn(), color: '#dc2626' }} onClick={() => handleDelete(editing.id)}>删除</button>
                </>
              )}
            </div>

            <div style={S.editorBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={S.field}>
                  <label style={S.label}>模板名称 *</label>
                  <input style={S.input} value={editing.name} onChange={e => upd({ name: e.target.value })} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>分类</label>
                  <input style={S.input} value={editing.category || ''} onChange={e => upd({ category: e.target.value })} placeholder="如：投稿/推广" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={S.field}>
                  <label style={S.label}>类型</label>
                  <select
                    style={{ ...S.input, height: 34 }}
                    value={editing.type || 'general'}
                    onChange={e => upd({ type: e.target.value as 'general' | 'recipient' })}
                    title="选择模板类型"
                  >
                    <option value="general">通用模板</option>
                    <option value="recipient">专用模板（指定收件人）</option>
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.label}>描述</label>
                  <input style={S.input} value={editing.description || ''} onChange={e => upd({ description: e.target.value })} />
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>主题模板</label>
                <input
                  style={S.input}
                  value={editing.subjectTemplate}
                  onChange={e => upd({ subjectTemplate: e.target.value })}
                  placeholder="支持 {{变量名}} 占位符"
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>正文模板</label>
                <textarea
                  style={{ ...S.textarea, minHeight: 240 }}
                  value={editing.bodyTemplate}
                  onChange={e => upd({ bodyTemplate: e.target.value })}
                  placeholder="支持 {{变量名}} 占位符&#10;&#10;例：尊敬的{{recipient_name}}，..."
                />
              </div>

              {/* 内置变量提示 */}
              <div style={S.varHint}>
                <strong>可用内置变量：</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 6 }}>
                  {BUILTIN_VARIABLES.map(v => (
                    <code
                      key={v.name}
                      style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 3, fontSize: 12, cursor: 'pointer' }}
                      title={v.description}
                      onClick={() => {
                        const sel = window.getSelection()?.toString();
                        if (!sel) upd({ bodyTemplate: editing.bodyTemplate + `{{${v.name}}}` });
                      }}
                    >{`{{${v.name}}}`}</code>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
