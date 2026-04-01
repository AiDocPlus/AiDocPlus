// ── 群发引擎：模板回退 + 账户匹配 + 任务展开 + useBulkSend Hook ──

import { useState, useCallback, useRef } from 'react';
import type {
  BulkSendJob, BulkRecipient, SubmissionTemplate,
  ExpandContext, SendHistoryEntry,
} from '../types/email';
import type { EmailAccount, AccountHealth } from '../types/account';
import type { Contact } from '../types/contact';
import type { SendQueueItem } from './sendQueue';
import { replaceVariables } from './templateVars';
import { matchAccountForRecipient, recordSend } from './accountMatcher';
import type { AccountRateState } from '../types/account';

// ── 域名归类表（同服务商识别） ──

const DOMAIN_PROVIDER_MAP: Record<string, string[]> = {
  qq: ['qq.com', 'foxmail.com'],
  netease: ['163.com', '126.com', 'yeah.net', '188.com', 'vip.163.com', 'vip.126.com'],
  gmail: ['gmail.com', 'googlemail.com'],
  outlook: ['outlook.com', 'hotmail.com', 'live.com', 'live.cn'],
  yahoo: ['yahoo.com', 'yahoo.cn'],
  icloud: ['icloud.com', 'me.com', 'mac.com'],
  aliyun: ['aliyun.com'],
  sohu: ['sohu.com'],
  sina: ['sina.com', 'sina.cn'],
  china139: ['139.com'],
  china189: ['189.cn'],
};

function getDomainProvider(domain: string): string | null {
  for (const [group, domains] of Object.entries(DOMAIN_PROVIDER_MAP)) {
    if (domains.includes(domain)) return group;
  }
  return null;
}

// ── 模板匹配（四级回退） ──

/**
 * 为收件人匹配模板
 * 优先级（从高到低）：
 * 1. 联系人内嵌模板（contact.customSubjectTemplate + customBodyTemplate 非空）
 * 2. 手动指定的 templateId（BulkRecipient.templateId）
 * 3. 群发任务选定的通用模板（BulkSendJob.defaultTemplateId）
 * 4. 返回 null → 使用兜底内容（BulkSendJob.defaultSubject + defaultBody）
 */
export function matchTemplateForRecipient(
  recipient: BulkRecipient,
  contact: Contact | undefined,
  templates: SubmissionTemplate[],
  defaultTemplateId?: string,
): SubmissionTemplate | { subjectTemplate: string; bodyTemplate: string; variables: [] } | null {
  // 1. 联系人内嵌模板（最高优先级）
  if (contact?.customSubjectTemplate || contact?.customBodyTemplate) {
    return {
      subjectTemplate: contact.customSubjectTemplate || '',
      bodyTemplate: contact.customBodyTemplate || '',
      variables: [],
    };
  }

  // 2. 手动指定的 templateId
  if (recipient.templateId) {
    const t = templates.find(tpl => tpl.id === recipient.templateId);
    if (t) return t;
  }

  // 3. 通用模板
  if (defaultTemplateId) {
    const t = templates.find(tpl => tpl.id === defaultTemplateId);
    if (t) return t;
  }

  return null;
}

// ── 任务展开 ──

/**
 * 将 BulkSendJob 展开为 SendQueueItem[]
 */
export function expandBulkJob(
  job: BulkSendJob,
  ctx: ExpandContext,
  rateStates: Record<string, AccountRateState>,
  filterStatus: BulkRecipient['status'][] = ['pending'],
): { items: SendQueueItem[]; updatedRecipients: BulkRecipient[] } {
  const items: SendQueueItem[] = [];
  const updatedRecipients: BulkRecipient[] = [];
  const now = Date.now();

  const primaryAccount = ctx.accounts.find(a => a.id === job.accountId);
  if (!primaryAccount) {
    return { items, updatedRecipients: job.recipients };
  }

  // 签名 HTML
  let signatureHtml = '';
  if (job.signatureId) {
    const sig = ctx.signatures.find(s => s.id === job.signatureId);
    if (sig?.content) {
      signatureHtml = '<br/><br/><div style="border-top:1px solid #ccc;padding-top:8px;margin-top:12px;color:#666;font-size:20px;">'
        + sig.content + '</div>';
    }
  }

  for (const recipient of job.recipients) {
    if (!filterStatus.includes(recipient.status)) {
      updatedRecipients.push(recipient);
      continue;
    }

    // 查找关联联系人
    const contact = recipient.contactId
      ? ctx.contacts.find(c => c.id === recipient.contactId)
      : undefined;

    // 智能账户匹配
    let matchedAccountId = recipient.matchedAccountId;
    if (job.autoMatchAccount && !matchedAccountId) {
      matchedAccountId = matchAccountForRecipient(
        recipient.email,
        ctx.accounts,
        ctx.healthMap,
        rateStates,
        job.accountId,
        undefined,
      );
    }
    const accountId = matchedAccountId || job.accountId;
    const account = ctx.accounts.find(a => a.id === accountId) || primaryAccount;

    // 模板匹配（四级回退）
    const matched = matchTemplateForRecipient(recipient, contact, ctx.templates, job.defaultTemplateId);

    // 构建收件人上下文（含单位/分类/extraFields）
    const recipientCtx = {
      name: recipient.name || contact?.name,
      email: recipient.email,
      organization: contact?.organization,
      category: contact?.category,
      extraFields: contact?.extraFields,
      variables: recipient.variables,
    };

    const subjectTpl = matched?.subjectTemplate || job.defaultSubject;
    const bodyTpl = matched?.bodyTemplate || job.defaultBody;
    const variableDefs = ('variables' in (matched || {})) ? (matched as SubmissionTemplate).variables || [] : [];

    const subject = replaceVariables(subjectTpl, variableDefs, ctx.docContext, recipientCtx);
    let body = replaceVariables(bodyTpl, variableDefs, ctx.docContext, recipientCtx);
    if (signatureHtml) body += signatureHtml;

    const itemId = `bulk_${job.id}_${now}_${Math.random().toString(36).slice(2, 6)}`;

    items.push({
      id: itemId,
      to: [recipient.email],
      cc: [],
      bcc: [],
      subject,
      body,
      isHtml: true,
      isRawHtml: true,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      encryption: account.encryption,
      email: account.email,
      accountId: account.hasKeyringPassword ? account.id : undefined,
      password: account.hasKeyringPassword ? undefined : (account.password || undefined),
      displayName: account.displayName || undefined,
      attachments: job.attachments?.map(a => ({ path: a.path, filename: a.filename, mimeType: a.mimeType })),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: now,
    });

    const usedTemplateId = matched && 'id' in matched ? matched.id : undefined;

    updatedRecipients.push({
      ...recipient,
      matchedAccountId: matchedAccountId ?? undefined,
      actualAccountId: accountId,
      templateId: recipient.templateId || usedTemplateId,
      status: 'queued',
      queueItemId: itemId,
    });
  }

  return { items, updatedRecipients };
}

// ── useBulkSend Hook ──

export interface UseBulkSendOptions {
  invoke: <T>(cmd: string, args: Record<string, unknown>) => Promise<T>;
  accounts: EmailAccount[];
  templates: SubmissionTemplate[];
  contacts: Contact[];
  signatures: { id: string; content: string }[];
  docContext?: Record<string, string>;
  bulkEnqueue: (items: Omit<SendQueueItem, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt'>[]) => SendQueueItem[];
  bulkCancelPending: () => void;
  persistJobs: (jobs: BulkSendJob[]) => void;
  persistHealthMap: (map: Record<string, AccountHealth>) => void;
  persistRateStates: (states: Record<string, AccountRateState>) => void;
  addHistoryEntry: (entry: SendHistoryEntry) => void;
  appendLog: (level: 'info' | 'error' | 'success', msg: string) => void;
}

export function useBulkSend(options: UseBulkSendOptions) {
  const [jobs, setJobs] = useState<BulkSendJob[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, AccountHealth>>({});
  const [rateStates, setRateStates] = useState<Record<string, AccountRateState>>({});
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const healthRef = useRef(healthMap);
  healthRef.current = healthMap;
  const rateStatesRef = useRef(rateStates);
  rateStatesRef.current = rateStates;

  const persistJobsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncePersistJobs = useCallback((updatedJobs: BulkSendJob[]) => {
    if (persistJobsTimer.current) clearTimeout(persistJobsTimer.current);
    persistJobsTimer.current = setTimeout(() => {
      optionsRef.current.persistJobs(updatedJobs);
    }, 100);
  }, []);

  const initFromStorage = useCallback((
    storedJobs: BulkSendJob[],
    storedHealth: Record<string, AccountHealth>,
    storedRateStates: Record<string, AccountRateState>,
  ) => {
    const recovered = storedJobs.map(job => {
      if (job.status === 'sending') {
        const recipients = job.recipients.map(r =>
          r.status === 'queued' ? { ...r, status: 'pending' as const, queueItemId: undefined } : r,
        );
        return { ...job, status: 'paused' as const, recipients };
      }
      return job;
    });

    setJobs(recovered);
    setHealthMap(storedHealth);
    setRateStates(storedRateStates);

    const pausedJobs = recovered.filter(j => j.status === 'paused');
    for (const j of pausedJobs) {
      optionsRef.current.appendLog('info', `群发任务「${j.name}」在上次运行中被中断，已暂停，请手动恢复`);
    }
  }, []);

  const getExpandContext = useCallback((): ExpandContext => ({
    templates: optionsRef.current.templates,
    contacts: optionsRef.current.contacts,
    accounts: optionsRef.current.accounts,
    healthMap: healthRef.current,
    rateLogs: {},
    docContext: optionsRef.current.docContext,
    signatures: optionsRef.current.signatures,
  }), []);

  const startJob = useCallback((job: BulkSendJob) => {
    const ctx = getExpandContext();
    const { items, updatedRecipients } = expandBulkJob(job, ctx, rateStatesRef.current, ['pending']);

    const startedJob: BulkSendJob = {
      ...job,
      recipients: updatedRecipients,
      status: 'sending',
      startedAt: Date.now(),
      lastPersistedAt: Date.now(),
    };

    setJobs(prev => {
      const exists = prev.find(j => j.id === job.id);
      const updated = exists
        ? prev.map(j => j.id === job.id ? startedJob : j)
        : [...prev, startedJob];
      debouncePersistJobs(updated);
      return updated;
    });

    if (items.length > 0) {
      optionsRef.current.bulkEnqueue(items);
    }
    optionsRef.current.appendLog('info', `群发任务「${job.name}」已开始，共 ${job.recipients.length} 人`);
  }, [getExpandContext, debouncePersistJobs]);

  const pauseJob = useCallback((jobId: string) => {
    optionsRef.current.bulkCancelPending();
    setJobs(prev => {
      const updated = prev.map(j => {
        if (j.id !== jobId || j.status !== 'sending') return j;
        const recipients = j.recipients.map(r =>
          r.status === 'queued' ? { ...r, status: 'pending' as const, queueItemId: undefined } : r,
        );
        return { ...j, status: 'paused' as const, recipients, lastPersistedAt: Date.now() };
      });
      debouncePersistJobs(updated);
      return updated;
    });
    const job = jobsRef.current.find(j => j.id === jobId);
    if (job) optionsRef.current.appendLog('info', `群发任务「${job.name}」已暂停`);
  }, [debouncePersistJobs]);

  const resumeJob = useCallback((jobId: string) => {
    const job = jobsRef.current.find(j => j.id === jobId);
    if (!job || job.status !== 'paused') return;

    const ctx = getExpandContext();
    const { items, updatedRecipients } = expandBulkJob(job, ctx, rateStatesRef.current, ['pending']);

    setJobs(prev => {
      const updated = prev.map(j =>
        j.id === jobId ? { ...j, recipients: updatedRecipients, status: 'sending' as const, lastPersistedAt: Date.now() } : j,
      );
      debouncePersistJobs(updated);
      return updated;
    });

    if (items.length > 0) optionsRef.current.bulkEnqueue(items);
    optionsRef.current.appendLog('info', `群发任务「${job.name}」已恢复`);
  }, [getExpandContext, debouncePersistJobs]);

  const cancelJob = useCallback((jobId: string) => {
    optionsRef.current.bulkCancelPending();
    setJobs(prev => {
      const updated = prev.map(j => {
        if (j.id !== jobId) return j;
        const recipients = j.recipients.map(r =>
          r.status === 'queued' || r.status === 'pending'
            ? { ...r, status: 'skipped' as const, queueItemId: undefined }
            : r,
        );
        return { ...j, status: 'cancelled' as const, recipients, completedAt: Date.now(), lastPersistedAt: Date.now() };
      });
      debouncePersistJobs(updated);
      return updated;
    });
    const job = jobsRef.current.find(j => j.id === jobId);
    if (job) optionsRef.current.appendLog('info', `群发任务「${job.name}」已取消`);
  }, [debouncePersistJobs]);

  const retryFailed = useCallback((jobId: string) => {
    const job = jobsRef.current.find(j => j.id === jobId);
    if (!job) return;
    const resetJob: BulkSendJob = {
      ...job,
      recipients: job.recipients.map(r =>
        r.status === 'failed' ? { ...r, status: 'pending' as const, error: undefined, queueItemId: undefined } : r,
      ),
      status: 'sending',
      progress: {
        total: job.recipients.length,
        sent: job.recipients.filter(r => r.status === 'sent').length,
        failed: 0,
      },
    };

    const ctx = getExpandContext();
    const { items, updatedRecipients } = expandBulkJob(resetJob, ctx, rateStatesRef.current, ['pending']);

    setJobs(prev => {
      const updated = prev.map(j =>
        j.id === jobId ? { ...resetJob, recipients: updatedRecipients, lastPersistedAt: Date.now() } : j,
      );
      debouncePersistJobs(updated);
      return updated;
    });

    if (items.length > 0) optionsRef.current.bulkEnqueue(items);
    optionsRef.current.appendLog('info', `群发任务「${job.name}」正在重试失败项`);
  }, [getExpandContext, debouncePersistJobs]);

  const deleteJob = useCallback((jobId: string) => {
    setJobs(prev => {
      const updated = prev.filter(j => j.id !== jobId);
      debouncePersistJobs(updated);
      return updated;
    });
  }, [debouncePersistJobs]);

  const createJob = useCallback((
    partial: Omit<BulkSendJob, 'id' | 'status' | 'progress' | 'createdAt'>,
  ): BulkSendJob => {
    const job: BulkSendJob = {
      ...partial,
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: 'draft',
      progress: { total: partial.recipients.length, sent: 0, failed: 0 },
      createdAt: Date.now(),
    };
    setJobs(prev => {
      const updated = [...prev, job];
      debouncePersistJobs(updated);
      return updated;
    });
    return job;
  }, [debouncePersistJobs]);

  // 群发队列回调
  const onBulkItemComplete = useCallback((item: SendQueueItem) => {
    const accountId = item.accountId || '';

    setRateStates(prev => {
      const updated = { ...prev };
      recordSend(accountId, updated);
      optionsRef.current.persistRateStates(updated);
      return updated;
    });

    setJobs(prev => {
      const updated = prev.map(job => {
        if (job.status !== 'sending') return job;
        const recipientIdx = job.recipients.findIndex(r => r.queueItemId === item.id);
        if (recipientIdx < 0) return job;
        const recipients = [...job.recipients];
        recipients[recipientIdx] = { ...recipients[recipientIdx], status: 'sent', sentAt: Date.now() };
        const sent = recipients.filter(r => r.status === 'sent').length;
        const failed = recipients.filter(r => r.status === 'failed').length;
        const total = recipients.length;
        const isComplete = sent + failed >= total;
        const updatedJob: BulkSendJob = {
          ...job, recipients,
          progress: { total, sent, failed },
          status: isComplete ? 'completed' : job.status,
          completedAt: isComplete ? Date.now() : undefined,
          lastPersistedAt: Date.now(),
        };
        if (isComplete) {
          optionsRef.current.appendLog('success', `群发任务「${job.name}」已完成：成功 ${sent}，失败 ${failed}`);
        }
        return updatedJob;
      });
      debouncePersistJobs(updated);
      return updated;
    });

    const sendingJob = jobsRef.current.find(j => j.status === 'sending');
    if (sendingJob) {
      optionsRef.current.addHistoryEntry({
        timestamp: Date.now(),
        to: item.to,
        subject: item.subject,
        body: item.body,
        accountId,
        accountEmail: item.email,
        status: 'success',
        bulkJobId: sendingJob.id,
        bulkJobName: sendingJob.name,
      });
    }
  }, [debouncePersistJobs]);

  const onBulkItemError = useCallback((item: SendQueueItem) => {
    const accountId = item.accountId || '';
    const errMsg = item.errorMsg || '未知错误';

    setJobs(prev => {
      const updated = prev.map(job => {
        if (job.status !== 'sending') return job;
        const recipientIdx = job.recipients.findIndex(r => r.queueItemId === item.id);
        if (recipientIdx < 0) return job;
        const recipients = [...job.recipients];
        recipients[recipientIdx] = { ...recipients[recipientIdx], status: 'failed', error: errMsg };
        const sent = recipients.filter(r => r.status === 'sent').length;
        const failed = recipients.filter(r => r.status === 'failed').length;
        const total = recipients.length;
        const isComplete = sent + failed >= total;
        const updatedJob: BulkSendJob = {
          ...job, recipients,
          progress: { total, sent, failed },
          status: isComplete ? 'completed' : job.status,
          completedAt: isComplete ? Date.now() : undefined,
          lastPersistedAt: Date.now(),
        };
        if (isComplete) {
          optionsRef.current.appendLog('info', `群发任务「${job.name}」已完成：成功 ${sent}，失败 ${failed}`);
        }
        return updatedJob;
      });
      debouncePersistJobs(updated);
      return updated;
    });

    const sendingJob = jobsRef.current.find(j => j.status === 'sending');
    if (sendingJob) {
      optionsRef.current.addHistoryEntry({
        timestamp: Date.now(), to: item.to, subject: item.subject, body: item.body,
        accountId, accountEmail: item.email, status: 'error', statusMsg: errMsg,
        bulkJobId: sendingJob.id, bulkJobName: sendingJob.name,
      });
    }
  }, [debouncePersistJobs]);

  const onBulkQueueEmpty = useCallback(() => {}, []);

  const getDomainProviderExport = getDomainProvider;

  return {
    jobs, healthMap, rateStates,
    initFromStorage,
    startJob, pauseJob, resumeJob, cancelJob, retryFailed, deleteJob, createJob,
    onBulkItemComplete, onBulkItemError, onBulkQueueEmpty,
    getDomainProvider: getDomainProviderExport,
  };
}
