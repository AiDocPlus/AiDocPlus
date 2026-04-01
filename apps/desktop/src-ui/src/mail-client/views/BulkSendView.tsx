// ── 群发视图（含向导：选收件人 → 选模板 → 选账户 → 发送，接入真实发送队列） ──

import { useState, useCallback, useMemo, useRef } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { useMailStore } from '../store/useMailStore';
import type { BulkRecipient, BulkSendJob, SendHistoryEntry } from '../types/email';
import { previewAccountAssignments } from '../lib/accountMatcher';
import { useSendQueue } from '../lib/sendQueue';
import { useBulkSend } from '../lib/bulkEngine';
import { saveBulkJobs } from '../lib/storage';
import type { AccountRateState } from '../types/account';

type Step = 'recipients' | 'template' | 'accounts' | 'confirm';

const S = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100%', fontFamily: '宋体, SimSun, serif', fontSize: 16 },
  header: { padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 600, color: '#1e293b', flex: 1 },
  steps: { display: 'flex', gap: 4 },
  step: (active: boolean, done: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 12, fontSize: 13, fontFamily: '宋体, SimSun, serif',
    background: active ? '#3b82f6' : done ? '#dcfce7' : '#f1f5f9',
    color: active ? '#fff' : done ? '#166534' : '#64748b',
  }),
  body: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const },
  scrollable: { flex: 1, overflowY: 'auto' as const, padding: '12px 16px' },
  footer: { padding: '10px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 },
  btn: (primary?: boolean, danger?: boolean): React.CSSProperties => ({
    padding: '6px 18px', borderRadius: 4, border: primary ? 'none' : '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: 15, fontFamily: '宋体, SimSun, serif',
    background: danger ? '#fee2e2' : primary ? '#3b82f6' : '#fff',
    color: danger ? '#dc2626' : primary ? '#fff' : '#334155',
  }),
  btnSm: (primary?: boolean, danger?: boolean): React.CSSProperties => ({
    padding: '4px 10px', borderRadius: 4, border: primary ? 'none' : '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: 13, fontFamily: '宋体, SimSun, serif',
    background: danger ? '#fee2e2' : primary ? '#3b82f6' : '#fff',
    color: danger ? '#dc2626' : primary ? '#fff' : '#334155',
  }),
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 8 },
  input: { width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 15, fontFamily: '宋体, SimSun, serif', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 15, fontFamily: '宋体, SimSun, serif', outline: 'none', resize: 'vertical' as const, minHeight: 80, boxSizing: 'border-box' as const },
  label: { fontSize: 13, color: '#64748b', marginBottom: 4, display: 'block' },
  row: { borderBottom: '1px solid #f8fafc', padding: '6px 0', display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 8, alignItems: 'center', fontSize: 14 },
  infoBox: (color: string): React.CSSProperties => ({ background: color, borderRadius: 4, padding: '8px 12px', fontSize: 13, marginBottom: 12 }),
  progress: { background: '#f1f5f9', borderRadius: 4, height: 8, overflow: 'hidden' as const, marginTop: 4 },
  progressBar: (pct: number, color?: string): React.CSSProperties => ({ width: `${pct}%`, height: '100%', background: color || '#3b82f6', transition: 'width 0.3s' }),
  logBox: { background: '#1e293b', borderRadius: 4, padding: '8px 10px', maxHeight: 120, overflowY: 'auto' as const, marginTop: 8, fontFamily: 'monospace', fontSize: 12 },
  logLine: (level: string): React.CSSProperties => ({
    color: level === 'error' ? '#f87171' : level === 'success' ? '#4ade80' : '#94a3b8',
    marginBottom: 2,
  }),
};

const STEPS: Step[] = ['recipients', 'template', 'accounts', 'confirm'];
const STEP_LABELS: Record<Step, string> = {
  recipients: '1. 选收件人', template: '2. 选模板',
  accounts: '3. 发件账户', confirm: '4. 确认发送',
};
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', sending: '发送中', paused: '已暂停', completed: '已完成', cancelled: '已取消',
};
const STATUS_COLOR: Record<string, string> = {
  draft: '#64748b', sending: '#2563eb', paused: '#f59e0b', completed: '#16a34a', cancelled: '#dc2626',
};

export function BulkSendView() {
  const contacts = useMailStore(s => s.contacts);
  const templates = useMailStore(s => s.templates);
  const accounts = useMailStore(s => s.accounts);
  const activeAccountId = useMailStore(s => s.activeAccountId);
  const signatures = useMailStore(s => s.signatures);
  const bulkJobsStore = useMailStore(s => s.bulkJobs);
  const setBulkJobsStore = useMailStore(s => s.setBulkJobs);
  const addHistoryEntry = useMailStore(s => s.addHistoryEntry);

  const [step, setStep] = useState<Step>('recipients');
  const [jobName, setJobName] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [manualEmails, setManualEmails] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [defaultSubject, setDefaultSubject] = useState('');
  const [defaultBody, setDefaultBody] = useState('');
  const [primaryAccountId, setPrimaryAccountId] = useState(activeAccountId);
  const [autoMatch, setAutoMatch] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState<Array<{ level: string; msg: string; ts: number }>>([]);

  const appendLog = useCallback((level: 'info' | 'error' | 'success', msg: string) => {
    setLogs(prev => [...prev.slice(-99), { level, msg, ts: Date.now() }]);
  }, []);

  // 用 ref 解耦 sendQueue ↔ bulk 的循环引用
  const bulkCallbacksRef = useRef<{
    onBulkItemComplete: (item: Parameters<ReturnType<typeof useBulkSend>['onBulkItemComplete']>[0]) => void;
    onBulkItemError: (item: Parameters<ReturnType<typeof useBulkSend>['onBulkItemError']>[0]) => void;
  } | null>(null);

  // 发送队列
  const sendQueue = useSendQueue({
    invoke: tauriInvoke as <T>(cmd: string, args: Record<string, unknown>) => Promise<T>,
    onItemComplete: useCallback((item) => {
      appendLog('success', `✓ 已发送至 ${item.to.join(', ')}`);
      bulkCallbacksRef.current?.onBulkItemComplete(item);
    }, [appendLog]),
    onItemError: useCallback((item) => {
      appendLog('error', `✗ 发送失败 ${item.to.join(', ')}: ${item.errorMsg || '未知错误'}`);
      bulkCallbacksRef.current?.onBulkItemError(item);
    }, [appendLog]),
    onQueueEmpty: useCallback(() => {
      appendLog('info', '队列已清空');
    }, [appendLog]),
  });

  // 群发引擎
  const bulk = useBulkSend({
    invoke: tauriInvoke,
    accounts,
    templates,
    contacts,
    signatures: signatures.map(s => ({ id: s.id, content: s.content })),
    bulkEnqueue: sendQueue.enqueue,
    bulkCancelPending: sendQueue.cancelPending,
    persistJobs: useCallback(async (jobs: BulkSendJob[]) => {
      setBulkJobsStore(jobs);
      await saveBulkJobs(jobs);
    }, [setBulkJobsStore]),
    persistHealthMap: useCallback(() => {}, []),
    persistRateStates: useCallback(() => {}, []),
    addHistoryEntry: useCallback((entry: SendHistoryEntry) => {
      addHistoryEntry(entry);
    }, [addHistoryEntry]),
    appendLog,
  });

  // 同步 bulk 回调到 ref（每次 render 更新）
  bulkCallbacksRef.current = {
    onBulkItemComplete: bulk.onBulkItemComplete,
    onBulkItemError: bulk.onBulkItemError,
  };

  const stepIdx = STEPS.indexOf(step);

  const recipients = useMemo((): BulkRecipient[] => {
    const fromContacts: BulkRecipient[] = contacts
      .filter(c => selectedContactIds.has(c.id))
      .map(c => ({ email: c.email, name: c.name, contactId: c.id, status: 'pending' as const }));
    const fromManual: BulkRecipient[] = manualEmails
      .split(/[\n,;，；]/).map(s => s.trim()).filter(Boolean)
      .map(email => ({ email, status: 'pending' as const }));
    const seen = new Set<string>();
    return [...fromContacts, ...fromManual].filter(r => {
      if (seen.has(r.email.toLowerCase())) return false;
      seen.add(r.email.toLowerCase());
      return true;
    });
  }, [contacts, selectedContactIds, manualEmails]);

  const assignmentPreview = useMemo(() => {
    if (!autoMatch || accounts.length === 0) return [];
    const rateStates: Record<string, AccountRateState> = {};
    return previewAccountAssignments(
      recipients.map(r => r.email), accounts, {}, rateStates, primaryAccountId || accounts[0]?.id,
    );
  }, [recipients, accounts, primaryAccountId, autoMatch]);

  // 使用 bulk engine 的 jobs（已接入真实发送，但初始从 store 同步）
  const jobs = bulk.jobs.length > 0 ? bulk.jobs : bulkJobsStore;

  const handleCreateJob = useCallback(() => {
    if (recipients.length === 0) return;
    const now = Date.now();
    const job: BulkSendJob = {
      id: `job_${now}`,
      name: jobName || `群发任务 ${new Date().toLocaleDateString()}`,
      accountId: primaryAccountId || accounts[0]?.id || '',
      autoMatchAccount: autoMatch,
      defaultTemplateId: selectedTemplateId || undefined,
      defaultSubject,
      defaultBody,
      recipients: recipients.map(r => ({ ...r, status: 'pending' as const })),
      attachments: [],
      status: 'draft',
      progress: { total: recipients.length, sent: 0, failed: 0 },
      createdAt: now,
    };
    bulk.startJob(job);
    setStep('recipients');
    setSelectedContactIds(new Set());
    setManualEmails('');
    setSelectedTemplateId('');
    setDefaultSubject('');
    setDefaultBody('');
    setJobName('');
    setShowHistory(true);
    appendLog('info', `群发任务「${job.name}」创建成功，开始发送 ${recipients.length} 封邮件`);
  }, [recipients, jobName, primaryAccountId, accounts, autoMatch, selectedTemplateId, defaultSubject, defaultBody, bulk, appendLog]);

  const handleJobAction = useCallback((jobId: string, action: 'pause' | 'resume' | 'cancel' | 'delete') => {
    if (action === 'delete') {
      const updated = jobs.filter(j => j.id !== jobId);
      setBulkJobsStore(updated);
      saveBulkJobs(updated);
      return;
    }
    if (action === 'pause') bulk.pauseJob(jobId);
    if (action === 'resume') bulk.resumeJob(jobId);
    if (action === 'cancel') bulk.cancelJob(jobId);
  }, [jobs, bulk, setBulkJobsStore]);

  if (showHistory) {
    return (
      <div style={S.root}>
        <div style={S.header}>
          <span style={S.title}>群发任务</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>队列：{sendQueue.stats.pending} 待发 · {sendQueue.stats.success} 成功 · {sendQueue.stats.error} 失败</span>
          <button style={S.btn(true)} onClick={() => setShowHistory(false)}>+ 新建群发</button>
        </div>
        <div style={S.scrollable}>
          {jobs.length === 0 ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>暂无群发任务</div>
          ) : [...jobs].reverse().map(job => {
            const pct = job.progress.total > 0
              ? Math.round((job.progress.sent + job.progress.failed) / job.progress.total * 100)
              : 0;
            return (
              <div key={job.id} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{job.name}</span>
                  <span style={{ fontSize: 12, color: STATUS_COLOR[job.status] || '#64748b', fontWeight: 500 }}>
                    {STATUS_LABEL[job.status] || job.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                  共 {job.progress.total} 人 · 已发 {job.progress.sent} · 失败 {job.progress.failed}
                  {job.startedAt && <span style={{ marginLeft: 8 }}>开始：{new Date(job.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                <div style={S.progress}>
                  <div style={S.progressBar(pct, job.status === 'completed' ? '#16a34a' : undefined)} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {job.status === 'sending' && (
                    <button style={S.btnSm()} onClick={() => handleJobAction(job.id, 'pause')}>暂停</button>
                  )}
                  {job.status === 'paused' && (
                    <button style={S.btnSm(true)} onClick={() => handleJobAction(job.id, 'resume')}>继续</button>
                  )}
                  {['sending', 'paused', 'draft'].includes(job.status) && (
                    <button style={S.btnSm(false, true)} onClick={() => handleJobAction(job.id, 'cancel')}>取消</button>
                  )}
                  {['completed', 'cancelled'].includes(job.status) && (
                    <button style={S.btnSm(false, true)} onClick={() => handleJobAction(job.id, 'delete')}>删除</button>
                  )}
                </div>
              </div>
            );
          })}

          {/* 发送日志 */}
          {logs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>发送日志</div>
              <div style={S.logBox}>
                {logs.map((l, i) => (
                  <div key={i} style={S.logLine(l.level)}>
                    [{new Date(l.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] {l.msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <span style={S.title}>新建群发</span>
        <div style={S.steps}>
          {STEPS.map((s, i) => (
            <span key={s} style={S.step(step === s, i < stepIdx)}>{STEP_LABELS[s]}</span>
          ))}
        </div>
        {jobs.length > 0 && (
          <button style={S.btn()} onClick={() => setShowHistory(true)}>任务列表 ({jobs.length})</button>
        )}
      </div>

      <div style={S.body}>
        <div style={S.scrollable}>
          {/* Step 1: 选收件人 */}
          {step === 'recipients' && (
            <>
              <div style={S.section}>
                <div style={S.sectionTitle}>任务名称</div>
                <input style={S.input} placeholder={`群发任务 ${new Date().toLocaleDateString()}`}
                  value={jobName} onChange={e => setJobName(e.target.value)} />
              </div>
              <div style={S.section}>
                <div style={S.sectionTitle}>从联系人选择 ({selectedContactIds.size} 已选)</div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 4 }}>
                  {contacts.length === 0 ? (
                    <div style={{ padding: 12, color: '#94a3b8', fontSize: 13 }}>暂无联系人，请先在联系人页面添加</div>
                  ) : contacts.map(c => (
                    <label key={c.id} style={{ display: 'flex', gap: 8, padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', fontSize: 14, alignItems: 'center' }}>
                      <input type="checkbox" checked={selectedContactIds.has(c.id)}
                        onChange={e => {
                          const s = new Set(selectedContactIds);
                          e.target.checked ? s.add(c.id) : s.delete(c.id);
                          setSelectedContactIds(s);
                        }} />
                      <span style={{ flex: 1 }}>{c.name ? `${c.name} <${c.email}>` : c.email}</span>
                      {c.category && <span style={{ fontSize: 12, color: '#6366f1' }}>{c.category}</span>}
                      {(c.customBodyTemplate || c.customSubjectTemplate) && (
                        <span style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', padding: '1px 5px', borderRadius: 3 }}>专属模板</span>
                      )}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button style={S.btnSm()} onClick={() => setSelectedContactIds(new Set(contacts.map(c => c.id)))}>全选</button>
                  <button style={S.btnSm()} onClick={() => setSelectedContactIds(new Set())}>清除</button>
                </div>
              </div>
              <div style={S.section}>
                <div style={S.sectionTitle}>手动输入邮箱（每行或逗号分隔）</div>
                <textarea style={S.textarea} placeholder="example@163.com&#10;another@qq.com"
                  value={manualEmails} onChange={e => setManualEmails(e.target.value)} />
              </div>
              {recipients.length > 0 && (
                <div style={S.infoBox('#eff6ff')}>
                  <strong style={{ color: '#1d4ed8' }}>已选 {recipients.length} 个收件人</strong>
                  {recipients.slice(0, 5).map(r => (
                    <div key={r.email} style={{ color: '#3b82f6', fontSize: 12 }}>{r.email}</div>
                  ))}
                  {recipients.length > 5 && <div style={{ color: '#64748b', fontSize: 12 }}>...等 {recipients.length - 5} 个</div>}
                </div>
              )}
            </>
          )}

          {/* Step 2: 选模板 */}
          {step === 'template' && (
            <>
              <div style={S.infoBox('#fffbeb')}>
                <strong style={{ color: '#92400e' }}>模板优先级（从高到低）：</strong>
                <div style={{ color: '#78350f', fontSize: 13, marginTop: 4 }}>
                  1. 联系人专属模板 → 2. 下方选择的通用模板 → 3. 兜底主题/正文
                </div>
              </div>
              <div style={S.section}>
                <div style={S.sectionTitle}>选择通用模板（可选）</div>
                <select style={{ ...S.input, height: 36 }} value={selectedTemplateId}
                  onChange={e => {
                    const t = templates.find(t => t.id === e.target.value);
                    setSelectedTemplateId(e.target.value);
                    if (t) { setDefaultSubject(t.subjectTemplate); setDefaultBody(t.bodyTemplate); }
                  }} title="选择群发模板">
                  <option value="">不使用模板</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.category ? ` [${t.category}]` : ''}</option>
                  ))}
                </select>
              </div>
              <div style={S.section}>
                <label style={S.label}>兜底主题（无模板时使用）</label>
                <input style={S.input} value={defaultSubject} onChange={e => setDefaultSubject(e.target.value)}
                  placeholder="支持 {{recipient_name}} 等变量" />
              </div>
              <div style={S.section}>
                <label style={S.label}>兜底正文（无模板时使用）</label>
                <textarea style={S.textarea} value={defaultBody} onChange={e => setDefaultBody(e.target.value)}
                  placeholder="支持 {{recipient_name}}、{{recipient_organization}} 等变量" />
              </div>
            </>
          )}

          {/* Step 3: 账户设置 */}
          {step === 'accounts' && (
            <>
              <div style={S.section}>
                <div style={S.sectionTitle}>主发件账户</div>
                {accounts.length === 0 ? (
                  <div style={S.infoBox('#fef2f2')}>
                    <span style={{ color: '#dc2626' }}>未配置账户，请先在设置中添加邮箱账户</span>
                  </div>
                ) : (
                  <select style={{ ...S.input, height: 36 }} value={primaryAccountId}
                    onChange={e => setPrimaryAccountId(e.target.value)} title="选择主发件账户">
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.displayName ? `${a.displayName} <${a.email}>` : a.email}
                        {a.sendLimits.maxPerHour > 0 ? ` [${a.sendLimits.maxPerHour}/h]` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div style={S.section}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={autoMatch} onChange={e => setAutoMatch(e.target.checked)} />
                  <span>启用智能账户匹配（用与收件人相同后缀的邮箱发送）</span>
                </label>
              </div>
              {autoMatch && assignmentPreview.length > 0 && (
                <div style={S.section}>
                  <div style={S.sectionTitle}>账户分配预览</div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden', fontSize: 13 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '6px 10px', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>
                      <span>收件人</span><span>发件账户</span>
                    </div>
                    {assignmentPreview.slice(0, 10).map(a => (
                      <div key={a.email} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '5px 10px', borderTop: '1px solid #f8fafc' }}>
                        <span style={{ color: '#334155' }}>{a.email}</span>
                        <span style={{ color: '#2563eb' }}>{a.accountEmail}</span>
                      </div>
                    ))}
                    {assignmentPreview.length > 10 && (
                      <div style={{ padding: '5px 10px', color: '#94a3b8', borderTop: '1px solid #f8fafc' }}>
                        ...等 {assignmentPreview.length - 10} 条
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 4: 确认 */}
          {step === 'confirm' && (
            <>
              <div style={S.infoBox('#f0fdf4')}>
                <div style={{ color: '#166534', fontWeight: 600, marginBottom: 4 }}>发送摘要</div>
                <div style={{ color: '#15803d', fontSize: 13 }}>
                  收件人：{recipients.length} 人 &nbsp;|&nbsp;
                  主账户：{accounts.find(a => a.id === primaryAccountId)?.email || '未选'} &nbsp;|&nbsp;
                  模板：{selectedTemplateId ? (templates.find(t => t.id === selectedTemplateId)?.name || '已选') : '无（使用兜底）'}
                </div>
              </div>
              {(!defaultSubject && !selectedTemplateId) && (
                <div style={S.infoBox('#fef9c3')}>
                  <span style={{ color: '#854d0e' }}>⚠️ 未设置主题或模板，发送的邮件将使用空白主题</span>
                </div>
              )}
              <div style={S.section}>
                <div style={S.sectionTitle}>收件人列表（前 20 条）</div>
                <div style={{ ...S.row, background: '#f8fafc', fontWeight: 500 }}>
                  <span>邮箱</span><span>姓名</span><span>分配账户</span>
                </div>
                {recipients.slice(0, 20).map((r, i) => {
                  const assignment = assignmentPreview.find(a => a.email === r.email);
                  return (
                    <div key={r.email} style={{ ...S.row, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <span>{r.email}</span>
                      <span style={{ color: '#64748b' }}>{r.name || '-'}</span>
                      <span style={{ color: '#2563eb', fontSize: 12 }}>
                        {assignment?.accountEmail || accounts.find(a => a.id === primaryAccountId)?.email || '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={S.footer}>
          {stepIdx > 0 && <button style={S.btn()} onClick={() => setStep(STEPS[stepIdx - 1])}>上一步</button>}
          {stepIdx < STEPS.length - 1 && (
            <button style={S.btn(true)} disabled={step === 'recipients' && recipients.length === 0}
              onClick={() => setStep(STEPS[stepIdx + 1])}>
              下一步
            </button>
          )}
          {step === 'confirm' && (
            <button style={S.btn(true)} disabled={accounts.length === 0} onClick={handleCreateJob}>
              创建任务并开始发送
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
