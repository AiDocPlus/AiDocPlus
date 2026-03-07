// ── 群发单送引擎：智能账户匹配 + 模板匹配 + 任务展开 + useBulkSend Hook ──

import { useState, useCallback, useRef } from 'react';
import type {
  EmailAccount, BulkSendJob, BulkRecipient, SubmissionTemplate,
  Contact, AccountHealth, SendHistoryEntry,
} from './types';
import type { SendQueueItem } from './sendQueue';
import { replaceVariables, type RecipientContext } from './utils';
import {
  isAccountAvailable, canSendNow, getAccountStats, recordSend,
  markAccountError, markAccountSuccess, defaultAccountHealth,
  pruneLog, cleanupHealthMap, formatWaitTime,
} from './sendRateLimiter';

// ── 域名归类表（智能账户匹配用） ──

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

/** 根据邮箱域名推断 provider 组 */
function getProviderGroup(emailDomain: string): string | null {
  for (const [group, domains] of Object.entries(DOMAIN_PROVIDER_MAP)) {
    if (domains.includes(emailDomain)) return group;
  }
  return null;
}

/** 从账户的 provider 字段推断 provider 组 */
function getAccountProviderGroup(account: EmailAccount): string | null {
  // 先用 provider 字段精确匹配
  const p = account.provider.toLowerCase();
  if (p.includes('qq') || p === 'foxmail') return 'qq';
  if (p.includes('netease') || p.includes('163') || p.includes('126') || p.includes('yeah') || p.includes('188')) return 'netease';
  if (p.includes('gmail')) return 'gmail';
  if (p.includes('outlook')) return 'outlook';
  if (p.includes('yahoo')) return 'yahoo';
  if (p.includes('icloud')) return 'icloud';
  if (p.includes('aliyun')) return 'aliyun';
  if (p.includes('sohu')) return 'sohu';
  if (p.includes('sina')) return 'sina';
  if (p.includes('139')) return 'china139';
  if (p.includes('189')) return 'china189';
  // fallback: 用邮箱域名
  const domain = account.email.split('@')[1]?.toLowerCase();
  if (domain) return getProviderGroup(domain);
  return null;
}

// ── 智能账户匹配 ──

export interface AccountWithCredentials {
  smtpHost: string;
  smtpPort: number;
  encryption: string;
  email: string;
  accountId: string;
  password?: string;
  displayName?: string;
}

/**
 * 为收件人智能匹配最佳发件账户
 * 优先同服务商 → 有余量 → 健康的
 */
export function matchAccountForRecipient(
  recipientEmail: string,
  accounts: EmailAccount[],
  healthMap: Record<string, AccountHealth>,
  rateLogs: Record<string, number[]>,
): string | null {
  if (accounts.length === 0) return null;
  if (accounts.length === 1) return accounts[0].id;

  const recipientDomain = recipientEmail.split('@')[1]?.toLowerCase() || '';
  const recipientGroup = getProviderGroup(recipientDomain);

  // 候选列表：只取可用的账户
  const candidates = accounts.filter(a => isAccountAvailable(healthMap[a.id]));
  if (candidates.length === 0) return accounts[0].id; // 全部不可用，回退主账户

  // 同服务商候选
  const sameProvider = recipientGroup
    ? candidates.filter(a => getAccountProviderGroup(a) === recipientGroup)
    : [];

  // 同域名精确匹配
  const sameDomain = candidates.filter(a => {
    const d = a.email.split('@')[1]?.toLowerCase();
    return d === recipientDomain;
  });

  // 按余量排序（余量大的优先）
  const sortByCapacity = (list: EmailAccount[]): EmailAccount[] => {
    return [...list].sort((a, b) => {
      const logA = rateLogs[a.id] || [];
      const logB = rateLogs[b.id] || [];
      const limA = a.sendLimits || { perHour: 0, perDay: 0, intervalSec: 0 };
      const limB = b.sendLimits || { perHour: 0, perDay: 0, intervalSec: 0 };
      const statsA = getAccountStats(logA, limA);
      const statsB = getAccountStats(logB, limB);
      const capA = Math.min(statsA.remainHour, statsA.remainDay);
      const capB = Math.min(statsB.remainHour, statsB.remainDay);
      return capB - capA;
    });
  };

  // 优先级：精确域名 → 同服务商 → 任意可用
  if (sameDomain.length > 0) return sortByCapacity(sameDomain)[0].id;
  if (sameProvider.length > 0) return sortByCapacity(sameProvider)[0].id;
  return sortByCapacity(candidates)[0].id;
}

/**
 * 选择备用账户（当当前账户不可用或频率受限时）
 * 排除 excludeAccountId，选择有余量且健康的
 */
export function pickFallbackAccount(
  excludeAccountId: string,
  recipientEmail: string,
  accounts: EmailAccount[],
  healthMap: Record<string, AccountHealth>,
  rateLogs: Record<string, number[]>,
): string | null {
  const available = accounts.filter(a =>
    a.id !== excludeAccountId && isAccountAvailable(healthMap[a.id])
  );
  if (available.length === 0) return null;

  // 检查频率限制，只取有余量的
  const withCapacity = available.filter(a => {
    const limits = a.sendLimits;
    if (!limits) return true;
    const log = rateLogs[a.id] || [];
    return canSendNow(log, limits).allowed;
  });

  if (withCapacity.length === 0) return null;
  return matchAccountForRecipient(recipientEmail, withCapacity, healthMap, rateLogs);
}

// ── 模板匹配 ──

/**
 * 为收件人匹配模板
 * 优先级：手动指定 → recipient 类型模板 → 通用模板 → 兜底
 */
export function matchTemplateForRecipient(
  recipient: BulkRecipient,
  templates: SubmissionTemplate[],
  defaultTemplateId?: string,
): SubmissionTemplate | null {
  // 1. 手动指定
  if (recipient.templateId) {
    const t = templates.find(tpl => tpl.id === recipient.templateId);
    if (t) return t;
  }

  // 2. recipient 类型模板，其 recipients 包含该邮箱
  const recipientTemplate = templates.find(
    tpl => tpl.type === 'recipient' && tpl.recipients.some(
      r => r.toLowerCase() === recipient.email.toLowerCase()
    )
  );
  if (recipientTemplate) return recipientTemplate;

  // 3. 通用模板
  if (defaultTemplateId) {
    const t = templates.find(tpl => tpl.id === defaultTemplateId);
    if (t) return t;
  }

  return null;
}

// ── 任务展开 ──

export interface ExpandContext {
  templates: SubmissionTemplate[];
  contacts: Contact[];
  accounts: EmailAccount[];
  healthMap: Record<string, AccountHealth>;
  rateLogs: Record<string, number[]>;
  docContext: { title: string; content: string; date: string };
  signatures: { id: string; content: string }[];
}

/**
 * 将 BulkSendJob 展开为 SendQueueItem[]
 * 只展开指定状态的收件人（默认 pending）
 */
export function expandBulkJob(
  job: BulkSendJob,
  ctx: ExpandContext,
  filterStatus: BulkRecipient['status'][] = ['pending'],
): { items: SendQueueItem[]; updatedRecipients: BulkRecipient[] } {
  const items: SendQueueItem[] = [];
  const updatedRecipients: BulkRecipient[] = [];
  const now = Date.now();

  // 查找主账户
  const primaryAccount = ctx.accounts.find(a => a.id === job.accountId);
  if (!primaryAccount) {
    return { items, updatedRecipients: job.recipients };
  }

  // 签名内容
  let signatureHtml = '';
  if (job.signatureId) {
    const sig = ctx.signatures.find(s => s.id === job.signatureId);
    if (sig?.content) {
      signatureHtml = '<br/><br/><div style="border-top:1px solid #ccc;padding-top:8px;margin-top:12px;color:#666;">' + sig.content + '</div>';
    }
  }

  for (const recipient of job.recipients) {
    if (!filterStatus.includes(recipient.status)) {
      updatedRecipients.push(recipient);
      continue;
    }

    // 智能账户匹配
    let matchedAccountId = recipient.matchedAccountId;
    if (job.autoMatchAccount && !matchedAccountId) {
      matchedAccountId = matchAccountForRecipient(
        recipient.email, ctx.accounts, ctx.healthMap, ctx.rateLogs,
      ) ?? undefined;
    }
    const accountId = matchedAccountId || job.accountId;
    const account = ctx.accounts.find(a => a.id === accountId) || primaryAccount;

    // 模板匹配
    const template = matchTemplateForRecipient(recipient, ctx.templates, job.defaultTemplateId);

    // 构建收件人上下文
    const contact = recipient.contactId ? ctx.contacts.find(c => c.id === recipient.contactId) : undefined;
    const recipientCtx: RecipientContext = {
      name: recipient.name || contact?.name,
      email: recipient.email,
      extraFields: contact?.extraFields,
      variables: recipient.variables,
    };

    // 变量替换
    const subjectTemplate = template?.subjectTemplate || job.defaultSubject;
    const bodyTemplate = template?.bodyTemplate || job.defaultBody;
    const variables = template?.variables || [];

    const subject = replaceVariables(subjectTemplate, variables, ctx.docContext, recipientCtx);
    let body = replaceVariables(bodyTemplate, variables, ctx.docContext, recipientCtx);
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

    updatedRecipients.push({
      ...recipient,
      matchedAccountId: matchedAccountId ?? undefined,
      actualAccountId: accountId,
      templateId: recipient.templateId || template?.id,
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
  docContext: { title: string; content: string; date: string };
  /** 群发队列的 enqueue 函数 */
  bulkEnqueue: (items: Omit<SendQueueItem, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt'>[]) => SendQueueItem[];
  /** 群发队列的 cancelPending 函数 */
  bulkCancelPending: () => void;
  /** 持久化回调 */
  persistJobs: (jobs: BulkSendJob[]) => void;
  persistHealthMap: (map: Record<string, AccountHealth>) => void;
  persistRateLog: (log: Record<string, number[]>) => void;
  /** 发送历史记录回调 */
  addHistoryEntry: (entry: SendHistoryEntry) => void;
  /** 日志回调 */
  appendLog: (level: 'info' | 'error' | 'success', msg: string) => void;
}

export function useBulkSend(options: UseBulkSendOptions) {
  const [jobs, setJobs] = useState<BulkSendJob[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, AccountHealth>>({});
  const [rateLog, setRateLog] = useState<Record<string, number[]>>({});
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const healthRef = useRef(healthMap);
  healthRef.current = healthMap;
  const rateLogRef = useRef(rateLog);
  rateLogRef.current = rateLog;

  // 持久化去抖
  const persistJobsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistJobs = useCallback((updatedJobs: BulkSendJob[]) => {
    if (persistJobsTimer.current) clearTimeout(persistJobsTimer.current);
    persistJobsTimer.current = setTimeout(() => {
      optionsRef.current.persistJobs(updatedJobs);
    }, 100);
  }, []);

  // 从 storage 加载初始状态
  const initFromStorage = useCallback((
    storedJobs: BulkSendJob[],
    storedHealth: Record<string, AccountHealth>,
    storedRateLog: Record<string, number[]>,
  ) => {
    // 恢复：sending → paused，queued → pending
    const recovered = storedJobs.map(job => {
      if (job.status === 'sending') {
        const recipients = job.recipients.map(r =>
          r.status === 'queued' ? { ...r, status: 'pending' as const, queueItemId: undefined } : r
        );
        return { ...job, status: 'paused' as const, recipients };
      }
      return job;
    });

    // 清理过期 cooldown
    const cleanedHealth = cleanupHealthMap(storedHealth);

    // 清理过期频率日志
    const cleanedLog: Record<string, number[]> = {};
    for (const [id, log] of Object.entries(storedRateLog)) {
      cleanedLog[id] = pruneLog(log);
    }

    setJobs(recovered);
    setHealthMap(cleanedHealth);
    setRateLog(cleanedLog);

    // 提示有未完成的任务
    const pausedJobs = recovered.filter(j => j.status === 'paused');
    if (pausedJobs.length > 0) {
      const opts = optionsRef.current;
      for (const j of pausedJobs) {
        opts.appendLog('info', `群发任务「${j.name}」在上次运行中被中断，已暂停，请手动恢复`);
      }
    }
  }, []);

  // 获取当前活跃的群发任务
  const activeJob = jobs.find(j => j.status === 'sending');

  // 构建展开上下文
  const getExpandContext = useCallback((): ExpandContext => ({
    templates: optionsRef.current.templates,
    contacts: optionsRef.current.contacts,
    accounts: optionsRef.current.accounts,
    healthMap: healthRef.current,
    rateLogs: rateLogRef.current,
    docContext: optionsRef.current.docContext,
    signatures: optionsRef.current.signatures,
  }), []);

  // 开始群发任务
  const startJob = useCallback((job: BulkSendJob) => {
    const ctx = getExpandContext();
    const { items, updatedRecipients } = expandBulkJob(job, ctx, ['pending']);

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
      persistJobs(updated);
      return updated;
    });

    if (items.length > 0) {
      optionsRef.current.bulkEnqueue(items);
    }

    optionsRef.current.appendLog('info', `群发任务「${job.name}」已开始，共 ${job.recipients.length} 人`);
  }, [getExpandContext, persistJobs]);

  // 暂停群发任务
  const pauseJob = useCallback((jobId: string) => {
    optionsRef.current.bulkCancelPending();

    setJobs(prev => {
      const updated = prev.map(j => {
        if (j.id !== jobId || j.status !== 'sending') return j;
        const recipients = j.recipients.map(r =>
          r.status === 'queued' ? { ...r, status: 'pending' as const, queueItemId: undefined } : r
        );
        return { ...j, status: 'paused' as const, recipients, lastPersistedAt: Date.now() };
      });
      persistJobs(updated);
      return updated;
    });

    const job = jobsRef.current.find(j => j.id === jobId);
    if (job) optionsRef.current.appendLog('info', `群发任务「${job.name}」已暂停`);
  }, [persistJobs]);

  // 恢复群发任务
  const resumeJob = useCallback((jobId: string) => {
    const job = jobsRef.current.find(j => j.id === jobId);
    if (!job || job.status !== 'paused') return;

    const ctx = getExpandContext();
    const { items, updatedRecipients } = expandBulkJob(job, ctx, ['pending']);

    setJobs(prev => {
      const updated = prev.map(j =>
        j.id === jobId ? { ...j, recipients: updatedRecipients, status: 'sending' as const, lastPersistedAt: Date.now() } : j
      );
      persistJobs(updated);
      return updated;
    });

    if (items.length > 0) {
      optionsRef.current.bulkEnqueue(items);
    }

    optionsRef.current.appendLog('info', `群发任务「${job.name}」已恢复`);
  }, [getExpandContext, persistJobs]);

  // 取消群发任务
  const cancelJob = useCallback((jobId: string) => {
    optionsRef.current.bulkCancelPending();

    setJobs(prev => {
      const updated = prev.map(j => {
        if (j.id !== jobId) return j;
        const recipients = j.recipients.map(r =>
          r.status === 'queued' || r.status === 'pending'
            ? { ...r, status: 'skipped' as const, queueItemId: undefined }
            : r
        );
        return { ...j, status: 'cancelled' as const, recipients, completedAt: Date.now(), lastPersistedAt: Date.now() };
      });
      persistJobs(updated);
      return updated;
    });

    const job = jobsRef.current.find(j => j.id === jobId);
    if (job) optionsRef.current.appendLog('info', `群发任务「${job.name}」已取消`);
  }, [persistJobs]);

  // 重试失败项
  const retryFailed = useCallback((jobId: string) => {
    const job = jobsRef.current.find(j => j.id === jobId);
    if (!job) return;

    // 先把 failed 改为 pending
    const resetJob: BulkSendJob = {
      ...job,
      recipients: job.recipients.map(r =>
        r.status === 'failed' ? { ...r, status: 'pending' as const, error: undefined, queueItemId: undefined } : r
      ),
      status: 'sending',
    };
    resetJob.progress = {
      total: resetJob.recipients.length,
      sent: resetJob.recipients.filter(r => r.status === 'sent').length,
      failed: 0,
    };

    const ctx = getExpandContext();
    const { items, updatedRecipients } = expandBulkJob(resetJob, ctx, ['pending']);

    setJobs(prev => {
      const updated = prev.map(j =>
        j.id === jobId ? { ...resetJob, recipients: updatedRecipients, lastPersistedAt: Date.now() } : j
      );
      persistJobs(updated);
      return updated;
    });

    if (items.length > 0) {
      optionsRef.current.bulkEnqueue(items);
    }

    optionsRef.current.appendLog('info', `群发任务「${job.name}」正在重试失败项`);
  }, [getExpandContext, persistJobs]);

  // 删除已完成/已取消的任务
  const deleteJob = useCallback((jobId: string) => {
    setJobs(prev => {
      const updated = prev.filter(j => j.id !== jobId);
      persistJobs(updated);
      return updated;
    });
  }, [persistJobs]);

  // ── 群发队列回调 ──

  /** 单封发送成功回调 */
  const onBulkItemComplete = useCallback((item: SendQueueItem) => {
    const accountId = item.accountId || '';

    // 更新频率日志
    setRateLog(prev => {
      const updated = { ...prev, [accountId]: recordSend(prev[accountId] || []) };
      optionsRef.current.persistRateLog(updated);
      return updated;
    });

    // 更新账户健康
    setHealthMap(prev => {
      const h = prev[accountId] || defaultAccountHealth();
      const updated = { ...prev, [accountId]: markAccountSuccess(h) };
      optionsRef.current.persistHealthMap(updated);
      return updated;
    });

    // 更新对应群发任务的收件人状态
    setJobs(prev => {
      const updated = prev.map(job => {
        if (job.status !== 'sending') return job;
        const recipientIdx = job.recipients.findIndex(r => r.queueItemId === item.id);
        if (recipientIdx < 0) return job;

        const recipients = [...job.recipients];
        recipients[recipientIdx] = {
          ...recipients[recipientIdx],
          status: 'sent',
          sentAt: Date.now(),
          actualAccountId: accountId || recipients[recipientIdx].actualAccountId,
        };

        const sent = recipients.filter(r => r.status === 'sent').length;
        const failed = recipients.filter(r => r.status === 'failed').length;
        const total = recipients.length;
        const isComplete = sent + failed >= total;

        const updatedJob: BulkSendJob = {
          ...job,
          recipients,
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

      persistJobs(updated);
      return updated;
    });

    // 添加发送历史
    const sendingJob = jobsRef.current.find(j => j.status === 'sending');
    if (sendingJob) {
      optionsRef.current.addHistoryEntry({
        timestamp: Date.now(),
        to: item.to,
        subject: item.subject,
        body: item.body,
        accountId: accountId,
        accountEmail: item.email,
        status: 'success',
        bulkJobId: sendingJob.id,
        bulkJobName: sendingJob.name,
      });
    }
  }, [persistJobs]);

  /** 单封发送失败回调 */
  const onBulkItemError = useCallback((item: SendQueueItem) => {
    const accountId = item.accountId || '';
    const errMsg = item.errorMsg || '未知错误';

    // 更新账户健康
    setHealthMap(prev => {
      const h = prev[accountId] || defaultAccountHealth();
      const updated = { ...prev, [accountId]: markAccountError(h, errMsg) };
      const newHealth = updated[accountId];
      if (newHealth.status === 'cooldown') {
        const until = newHealth.cooldownUntil || 0;
        optionsRef.current.appendLog('error',
          `账户 ${item.email} 连续出错 ${newHealth.consecutiveErrors} 次，暂停至 ${new Date(until).toLocaleTimeString()}`
        );
      }
      optionsRef.current.persistHealthMap(updated);
      return updated;
    });

    // 更新群发任务收件人状态
    setJobs(prev => {
      const updated = prev.map(job => {
        if (job.status !== 'sending') return job;
        const recipientIdx = job.recipients.findIndex(r => r.queueItemId === item.id);
        if (recipientIdx < 0) return job;

        const recipients = [...job.recipients];
        recipients[recipientIdx] = {
          ...recipients[recipientIdx],
          status: 'failed',
          error: errMsg,
        };

        const sent = recipients.filter(r => r.status === 'sent').length;
        const failed = recipients.filter(r => r.status === 'failed').length;
        const total = recipients.length;
        const isComplete = sent + failed >= total;

        const updatedJob: BulkSendJob = {
          ...job,
          recipients,
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

      persistJobs(updated);
      return updated;
    });

    // 添加发送历史
    const sendingJob = jobsRef.current.find(j => j.status === 'sending');
    if (sendingJob) {
      optionsRef.current.addHistoryEntry({
        timestamp: Date.now(),
        to: item.to,
        subject: item.subject,
        body: item.body,
        accountId: accountId,
        accountEmail: item.email,
        status: 'error',
        statusMsg: errMsg,
        bulkJobId: sendingJob.id,
        bulkJobName: sendingJob.name,
      });
    }
  }, [persistJobs]);

  /** 群发队列清空回调 */
  const onBulkQueueEmpty = useCallback(() => {
    // 不做表单清空等操作（独立队列的关键区别）
  }, []);

  // ── 为群发队列提供的高级回调 ──

  const getAccountHealth = useCallback((accountId: string) => {
    return healthRef.current[accountId];
  }, []);

  const getRateLimits = useCallback((accountId: string) => {
    const account = optionsRef.current.accounts.find(a => a.id === accountId);
    return account?.sendLimits;
  }, []);

  const getSendLog = useCallback((accountId: string) => {
    return rateLogRef.current[accountId] || [];
  }, []);

  const pickFallback = useCallback((originalAccountId: string, recipientEmail: string) => {
    const fallbackId = pickFallbackAccount(
      originalAccountId, recipientEmail,
      optionsRef.current.accounts, healthRef.current, rateLogRef.current,
    );
    if (!fallbackId) return null;
    const account = optionsRef.current.accounts.find(a => a.id === fallbackId);
    if (!account) return null;
    return {
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      encryption: account.encryption,
      email: account.email,
      accountId: account.hasKeyringPassword ? account.id : (undefined as unknown as string),
      password: account.hasKeyringPassword ? undefined : (account.password || undefined),
      displayName: account.displayName || undefined,
    };
  }, []);

  const onAccountHealthChanged = useCallback((_accountId: string) => {
    // 由 onBulkItemComplete / onBulkItemError 中已处理
  }, []);

  const onRateLimited = useCallback((accountId: string, waitMs: number, reason: string) => {
    const reasonText = reason === 'hourly' ? '小时配额已满' : reason === 'daily' ? '日配额已满' : '发送间隔';
    optionsRef.current.appendLog('info',
      `账户 ${accountId} ${reasonText}，等待 ${formatWaitTime(waitMs)}`
    );
  }, []);

  const onAllAccountsExhausted = useCallback((waitMs: number) => {
    optionsRef.current.appendLog('info',
      `所有账户暂不可用，等待 ${formatWaitTime(waitMs)} 后继续`
    );
  }, []);

  const onSendRecorded = useCallback((accountId: string) => {
    setRateLog(prev => {
      const updated = { ...prev, [accountId]: recordSend(prev[accountId] || []) };
      optionsRef.current.persistRateLog(updated);
      return updated;
    });
  }, []);

  return {
    jobs,
    activeJob,
    healthMap,
    rateLog,
    initFromStorage,
    startJob,
    pauseJob,
    resumeJob,
    cancelJob,
    retryFailed,
    deleteJob,
    // 群发队列回调
    onBulkItemComplete,
    onBulkItemError,
    onBulkQueueEmpty,
    // 高级回调（传给群发 useSendQueue）
    getAccountHealth,
    getRateLimits,
    getSendLog,
    pickFallback,
    onAccountHealthChanged,
    onRateLimited,
    onAllAccountsExhausted,
    onSendRecorded,
  };
}
