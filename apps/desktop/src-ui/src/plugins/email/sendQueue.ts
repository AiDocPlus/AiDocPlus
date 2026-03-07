import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { inlineEmailStyles } from './inlineStyles';
import type { SendLimits, AccountHealth } from './types';
import { canSendNow, isAccountAvailable } from './sendRateLimiter';

// ── 类型定义 ──

export type QueueItemStatus = 'delayed' | 'pending' | 'sending' | 'success' | 'error';

export interface SendQueueItem {
  id: string;
  /** 收件人列表 */
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  subject: string;
  body: string;
  isHtml: boolean;
  isRawHtml: boolean;
  /** SMTP 连接参数 */
  smtpHost: string;
  smtpPort: number;
  encryption: string;
  email: string;
  accountId?: string;
  password?: string;
  displayName?: string;
  attachments?: { path: string; filename: string; mimeType: string }[];
  /** 已读回执 */
  requestReadReceipt?: boolean;
  /** 队列状态 */
  status: QueueItemStatus;
  retryCount: number;
  maxRetries: number;
  errorMsg?: string;
  /** G5: 延迟发送截止时间（撤销窗口） */
  delayUntil?: number;
  /** 时间戳 */
  createdAt: number;
  completedAt?: number;
}

/** 重试延迟（毫秒）：第1次 2s，第2次 5s，第3次 10s */
const RETRY_DELAYS = [2000, 5000, 10000];
const DEFAULT_MAX_RETRIES = 3;

interface UseSendQueueOptions {
  invoke: <T>(cmd: string, args: Record<string, unknown>) => Promise<T>;
  onItemComplete: (item: SendQueueItem) => void;
  onItemError: (item: SendQueueItem) => void;
  onQueueEmpty: () => void;
  /** 队列变化时的持久化回调 */
  onQueueChange?: (queue: SendQueueItem[]) => void;
  /** 从 storage 恢复的初始队列 */
  initialQueue?: SendQueueItem[];
  /** G5: 发送延迟（毫秒），默认 0 表示不延迟 */
  sendDelay?: number;
  // ── 群发队列高级选项（普通队列不需要传） ──
  /** 获取账户频率限制 */
  getRateLimits?: (accountId: string) => SendLimits | undefined;
  /** 获取账户发送日志 */
  getSendLog?: (accountId: string) => number[];
  /** 获取账户健康状态 */
  getAccountHealth?: (accountId: string) => AccountHealth | undefined;
  /** 选择备用账户（当前账户不可用时） */
  pickFallbackAccount?: (originalAccountId: string, recipientEmail: string) => { smtpHost: string; smtpPort: number; encryption: string; email: string; accountId: string; password?: string; displayName?: string } | null;
  /** 账户进入冷却时回调 */
  onAccountCooldown?: (accountId: string, until: number, reason: string) => void;
  /** 所有账户不可用时回调 */
  onAllAccountsExhausted?: (waitMs: number) => void;
  /** 频率受限时回调 */
  onRateLimited?: (accountId: string, waitMs: number, reason: string) => void;
  /** 发送成功后记录频率日志的回调 */
  onSendRecorded?: (accountId: string) => void;
  /** 账户健康变化回调 */
  onAccountHealthChanged?: (accountId: string, health: AccountHealth) => void;
  /** 即时持久化回调（关键状态变化后调用） */
  persistImmediately?: () => void;
}

export function useSendQueue(options: UseSendQueueOptions) {
  const [queue, setQueue] = useState<SendQueueItem[]>(() => {
    // 从 storage 恢复：只恢复 pending/delayed 状态的项（sending 项重置为 pending，delayed 保持）
    if (options.initialQueue?.length) {
      return options.initialQueue
        .filter(item => item.status === 'pending' || item.status === 'sending' || item.status === 'delayed')
        .map(item => item.status === 'sending' ? { ...item, status: 'pending' as const } : item);
    }
    return [];
  });
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const queueRef = useRef<SendQueueItem[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 持久化去抖定时器
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 同步 queue 到 ref，并去抖持久化
  useEffect(() => {
    queueRef.current = queue;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      optionsRef.current.onQueueChange?.(queue);
    }, 300);
  }, [queue]);

  const updateItem = useCallback((id: string, updates: Partial<SendQueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;

    const now = Date.now();
    // G5: 将已到期的 delayed 项转为 pending
    const delayedReady = queueRef.current.filter(item => item.status === 'delayed' && item.delayUntil && item.delayUntil <= now);
    if (delayedReady.length > 0) {
      setQueue(prev => prev.map(item =>
        item.status === 'delayed' && item.delayUntil && item.delayUntil <= now
          ? { ...item, status: 'pending' as const, delayUntil: undefined }
          : item
      ));
      // 需要等待 state 更新后再处理
      setTimeout(() => processNext(), 50);
      return;
    }
    // G5: 如果还有 delayed 项未到期，设置定时器
    const nextDelayed = queueRef.current.find(item => item.status === 'delayed' && item.delayUntil && item.delayUntil > now);
    if (nextDelayed && nextDelayed.delayUntil) {
      const delayMs = nextDelayed.delayUntil - now;
      setTimeout(() => processNext(), Math.min(delayMs + 50, 6000));
    }

    const next = queueRef.current.find(item => item.status === 'pending');

    if (!next) {
      setProcessing(false);
      optionsRef.current.onQueueEmpty();
      return;
    }

    const opts = optionsRef.current;
    const accountId = next.accountId || '';

    // ── 高级模式：账户健康检查 + 频率限制 ──
    let sendItem = next;
    if (opts.getAccountHealth) {
      const health = opts.getAccountHealth(accountId);
      if (health && !isAccountAvailable(health)) {
        // 当前账户不可用，尝试 fallback
        const fallback = opts.pickFallbackAccount?.(accountId, next.to[0] || '');
        if (fallback) {
          // 用备用账户发送
          sendItem = { ...next, smtpHost: fallback.smtpHost, smtpPort: fallback.smtpPort, encryption: fallback.encryption, email: fallback.email, accountId: fallback.accountId, password: fallback.password, displayName: fallback.displayName };
          updateItem(next.id, { smtpHost: fallback.smtpHost, smtpPort: fallback.smtpPort, encryption: fallback.encryption, email: fallback.email, accountId: fallback.accountId, password: fallback.password, displayName: fallback.displayName });
        } else {
          // 无可用账户，检查全局最早恢复时间
          const waitMs = health.cooldownUntil ? Math.max(health.cooldownUntil - Date.now(), 1000) : 60000;
          opts.onAllAccountsExhausted?.(waitMs);
          processingRef.current = false;
          setTimeout(() => processNext(), Math.min(waitMs, 60000));
          return;
        }
      }
    }

    if (opts.getRateLimits && opts.getSendLog) {
      const sendAccountId = sendItem.accountId || accountId;
      const limits = opts.getRateLimits(sendAccountId);
      const log = opts.getSendLog(sendAccountId);
      if (limits && log) {
        const result = canSendNow(log, limits);
        if (!result.allowed) {
          // 尝试 fallback 到有余量的账户
          const fallback = opts.pickFallbackAccount?.(sendAccountId, next.to[0] || '');
          if (fallback) {
            sendItem = { ...sendItem, smtpHost: fallback.smtpHost, smtpPort: fallback.smtpPort, encryption: fallback.encryption, email: fallback.email, accountId: fallback.accountId, password: fallback.password, displayName: fallback.displayName };
            updateItem(next.id, { smtpHost: fallback.smtpHost, smtpPort: fallback.smtpPort, encryption: fallback.encryption, email: fallback.email, accountId: fallback.accountId, password: fallback.password, displayName: fallback.displayName });
          } else {
            opts.onRateLimited?.(sendAccountId, result.waitMs, result.reason);
            processingRef.current = false;
            setTimeout(() => processNext(), Math.min(result.waitMs, 60000));
            return;
          }
        }
      }
    }

    processingRef.current = true;
    setProcessing(true);
    updateItem(next.id, { status: 'sending' });

    try {
      // HTML 邮件自动内联样式，提高邮件客户端兼容性
      const bodyToSend = sendItem.isHtml ? inlineEmailStyles(sendItem.body) : sendItem.body;

      await opts.invoke<string>('send_email', {
        smtpHost: sendItem.smtpHost,
        smtpPort: sendItem.smtpPort,
        encryption: sendItem.encryption,
        email: sendItem.email,
        accountId: sendItem.accountId,
        password: sendItem.password,
        displayName: sendItem.displayName,
        to: sendItem.to,
        cc: sendItem.cc,
        bcc: sendItem.bcc,
        replyTo: sendItem.replyTo || null,
        priority: sendItem.priority || null,
        subject: sendItem.subject,
        body: bodyToSend,
        isHtml: sendItem.isHtml,
        isRawHtml: sendItem.isRawHtml,
        attachments: sendItem.attachments,
        requestReadReceipt: sendItem.requestReadReceipt,
      });

      const completedAccountId = sendItem.accountId || accountId;
      const completed: SendQueueItem = { ...sendItem, status: 'success', completedAt: Date.now() };
      updateItem(next.id, { status: 'success', completedAt: Date.now() });
      opts.onItemComplete(completed);
      // 记录频率日志 + 账户健康恢复
      opts.onSendRecorded?.(completedAccountId);
      opts.persistImmediately?.();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const failedAccountId = sendItem.accountId || accountId;

      // 通知账户健康变化（如果有高级模式）
      opts.onAccountHealthChanged?.(failedAccountId, {
        status: 'ok', consecutiveErrors: 0, lastError: errMsg, lastErrorAt: Date.now(),
      });

      if (next.retryCount < next.maxRetries) {
        // 安排重试
        const delay = RETRY_DELAYS[next.retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        updateItem(next.id, { status: 'pending', retryCount: next.retryCount + 1, errorMsg: errMsg });
        processingRef.current = false;
        opts.persistImmediately?.();
        setTimeout(() => processNext(), delay);
        return;
      }

      // 超过重试次数，标记失败
      const failed: SendQueueItem = { ...sendItem, status: 'error', errorMsg: errMsg, completedAt: Date.now() };
      updateItem(next.id, { status: 'error', errorMsg: errMsg, completedAt: Date.now() });
      opts.onItemError(failed);
      opts.persistImmediately?.();
    }

    processingRef.current = false;
    // 继续处理下一个
    setTimeout(() => processNext(), 500);
  }, [updateItem]);

  // 恢复的队列有 pending 项时，自动开始处理
  const initialProcessTriggered = useRef(false);
  useEffect(() => {
    if (!initialProcessTriggered.current && queue.some(i => i.status === 'pending')) {
      initialProcessTriggered.current = true;
      setTimeout(() => processNext(), 1000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enqueue = useCallback((items: Omit<SendQueueItem, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt'>[]) => {
    const delay = optionsRef.current.sendDelay || 0;
    const now = Date.now();
    const newItems: SendQueueItem[] = items.map((item, idx) => ({
      ...item,
      id: `sq_${now}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
      status: (delay > 0 ? 'delayed' : 'pending') as QueueItemStatus,
      delayUntil: delay > 0 ? now + delay : undefined,
      retryCount: 0,
      maxRetries: DEFAULT_MAX_RETRIES,
      createdAt: now,
    }));
    setQueue(prev => [...prev, ...newItems]);
    // 触发处理（如有延迟则在延迟后触发）
    setTimeout(() => processNext(), delay > 0 ? delay + 50 : 100);
    return newItems;
  }, [processNext]);

  const retryItem = useCallback((id: string) => {
    updateItem(id, { status: 'pending', retryCount: 0, errorMsg: undefined, completedAt: undefined });
    setTimeout(() => processNext(), 100);
  }, [updateItem, processNext]);

  const removeItem = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(item => item.status !== 'success' && item.status !== 'error'));
  }, []);

  const cancelPending = useCallback(() => {
    setQueue(prev => prev.filter(item => item.status !== 'pending'));
  }, []);

  // G5: 撤销延迟中的发送
  const cancelDelayed = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const cancelAllDelayed = useCallback(() => {
    setQueue(prev => prev.filter(item => item.status !== 'delayed'));
  }, []);

  const stats = useMemo(() => ({
    total: queue.length,
    delayed: queue.filter(i => i.status === 'delayed').length,
    pending: queue.filter(i => i.status === 'pending').length,
    sending: queue.filter(i => i.status === 'sending').length,
    success: queue.filter(i => i.status === 'success').length,
    error: queue.filter(i => i.status === 'error').length,
  }), [queue]);

  return {
    queue,
    processing,
    stats,
    enqueue,
    retryItem,
    removeItem,
    clearCompleted,
    cancelPending,
    cancelDelayed,
    cancelAllDelayed,
  };
}
