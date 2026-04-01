// ── 发送队列（从邮件插件迁移，适配新类型体系） ──

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { AccountHealth } from '../types/account';

export type QueueItemStatus = 'delayed' | 'pending' | 'sending' | 'success' | 'error';

export interface SendQueueItem {
  id: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  subject: string;
  body: string;
  isHtml: boolean;
  isRawHtml: boolean;
  smtpHost: string;
  smtpPort: number;
  encryption: string;
  email: string;
  accountId?: string;
  password?: string;
  displayName?: string;
  attachments?: { path: string; filename: string; mimeType: string }[];
  requestReadReceipt?: boolean;
  status: QueueItemStatus;
  retryCount: number;
  maxRetries: number;
  errorMsg?: string;
  delayUntil?: number;
  createdAt: number;
  completedAt?: number;
}

function isHealthOk(health: AccountHealth | undefined): boolean {
  if (!health) return true;
  if (health.status === 'ok') return true;
  if (health.status === 'disabled') return false;
  if (health.status === 'cooldown') {
    return health.cooldownUntil ? Date.now() >= health.cooldownUntil : true;
  }
  return false;
}

interface UseSendQueueOptions {
  invoke: <T>(cmd: string, args: Record<string, unknown>) => Promise<T>;
  onItemComplete: (item: SendQueueItem) => void;
  onItemError: (item: SendQueueItem) => void;
  onQueueEmpty: () => void;
  onQueueChange?: (queue: SendQueueItem[]) => void;
  initialQueue?: SendQueueItem[];
  sendDelay?: number;
  getAccountHealth?: (accountId: string) => AccountHealth | undefined;
  pickFallbackAccount?: (originalAccountId: string, recipientEmail: string) => {
    smtpHost: string; smtpPort: number; encryption: string; email: string;
    accountId: string; password?: string; displayName?: string;
  } | null;
  onAllAccountsExhausted?: (waitMs: number) => void;
  onRateLimited?: (accountId: string, waitMs: number, reason: string) => void;
  onSendRecorded?: (accountId: string) => void;
  onAccountHealthChanged?: (accountId: string) => void;
  persistImmediately?: () => void;
}

function inlineBasicStyles(html: string): string {
  // 简化版内联样式，确保邮件客户端兼容
  return html
    .replace(/<p>/gi, '<p style="margin:0 0 1em 0;">')
    .replace(/<h([1-6])>/gi, '<h$1 style="margin:0.5em 0;font-weight:bold;">')
    .replace(/<blockquote>/gi, '<blockquote style="margin:0 0 0 1em;padding:0 0 0 1em;border-left:3px solid #ccc;color:#666;">')
    .replace(/<code>/gi, '<code style="background:#f4f4f4;padding:2px 4px;border-radius:3px;font-size:0.9em;">')
    .replace(/<pre>/gi, '<pre style="background:#f4f4f4;padding:12px;border-radius:4px;overflow:auto;">');
}

export function useSendQueue(options: UseSendQueueOptions) {
  const [queue, setQueue] = useState<SendQueueItem[]>(() => {
    if (options.initialQueue?.length) {
      return options.initialQueue
        .filter(item => ['pending', 'sending', 'delayed'].includes(item.status))
        .map(item => item.status === 'sending' ? { ...item, status: 'pending' as const } : item);
    }
    return [];
  });
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const queueRef = useRef<SendQueueItem[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const delayedReady = queueRef.current.filter(
      item => item.status === 'delayed' && item.delayUntil && item.delayUntil <= now,
    );
    if (delayedReady.length > 0) {
      setQueue(prev => prev.map(item =>
        item.status === 'delayed' && item.delayUntil && item.delayUntil <= now
          ? { ...item, status: 'pending' as const, delayUntil: undefined }
          : item,
      ));
      setTimeout(() => processNext(), 50);
      return;
    }

    const next = queueRef.current.find(item => item.status === 'pending');
    if (!next) {
      setProcessing(false);
      optionsRef.current.onQueueEmpty();
      return;
    }

    const opts = optionsRef.current;
    const accountId = next.accountId || '';

    // 账户健康检查
    let sendItem = next;
    if (opts.getAccountHealth) {
      const health = opts.getAccountHealth(accountId);
      if (health && !isHealthOk(health)) {
        const fallback = opts.pickFallbackAccount?.(accountId, next.to[0] || '');
        if (fallback) {
          sendItem = { ...next, ...fallback };
          updateItem(next.id, fallback);
        } else {
          const waitMs = health.cooldownUntil ? Math.max(health.cooldownUntil - Date.now(), 1000) : 60_000;
          opts.onAllAccountsExhausted?.(waitMs);
          processingRef.current = false;
          setTimeout(() => processNext(), Math.min(waitMs, 60_000));
          return;
        }
      }
    }

    processingRef.current = true;
    setProcessing(true);
    updateItem(next.id, { status: 'sending' });

    try {
      const bodyToSend = sendItem.isHtml ? inlineBasicStyles(sendItem.body) : sendItem.body;
      await opts.invoke<string>('send_email', {
        smtpHost: sendItem.smtpHost,
        smtpPort: sendItem.smtpPort,
        encryption: sendItem.encryption,
        email: sendItem.email,
        accountId: sendItem.accountId || null,
        password: sendItem.password || null,
        displayName: sendItem.displayName || null,
        to: sendItem.to,
        cc: sendItem.cc,
        bcc: sendItem.bcc,
        replyTo: sendItem.replyTo || null,
        priority: sendItem.priority || null,
        subject: sendItem.subject,
        body: bodyToSend,
        isHtml: sendItem.isHtml,
        isRawHtml: sendItem.isRawHtml,
        attachments: sendItem.attachments || [],
        requestReadReceipt: sendItem.requestReadReceipt || false,
      });

      const completedAccountId = sendItem.accountId || accountId;
      const completed: SendQueueItem = { ...sendItem, status: 'success', completedAt: Date.now() };
      updateItem(next.id, { status: 'success', completedAt: Date.now() });
      opts.onItemComplete(completed);
      opts.onSendRecorded?.(completedAccountId);
      opts.persistImmediately?.();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (next.retryCount < next.maxRetries) {
        const delay = [2000, 5000, 10000][next.retryCount] || 10000;
        updateItem(next.id, { status: 'pending', retryCount: next.retryCount + 1, errorMsg: errMsg });
        processingRef.current = false;
        setTimeout(() => processNext(), delay);
        return;
      }
      const failedItem: SendQueueItem = { ...sendItem, status: 'error', errorMsg: errMsg, completedAt: Date.now() };
      updateItem(next.id, { status: 'error', errorMsg: errMsg, completedAt: Date.now() });
      opts.onItemError(failedItem);
      opts.persistImmediately?.();
    }

    processingRef.current = false;
    setProcessing(false);
    setTimeout(() => processNext(), 200);
  }, [updateItem]);

  const enqueue = useCallback((
    items: Omit<SendQueueItem, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt'>[],
  ): SendQueueItem[] => {
    const now = Date.now();
    const newItems: SendQueueItem[] = items.map((item, i) => ({
      ...item,
      id: `q_${now}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      status: 'pending' as const,
      retryCount: 0,
      maxRetries: 3,
      createdAt: now,
    }));
    setQueue(prev => [...prev, ...newItems]);
    setTimeout(() => processNext(), 0);
    return newItems;
  }, [processNext]);

  const retryItem = useCallback((id: string) => {
    setQueue(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'pending' as const, retryCount: 0, errorMsg: undefined } : item,
    ));
    setTimeout(() => processNext(), 0);
  }, [processNext]);

  const removeItem = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(item => !['success', 'error'].includes(item.status)));
  }, []);

  const cancelPending = useCallback(() => {
    setQueue(prev => prev.filter(item => item.status !== 'pending'));
  }, []);

  const stats = useMemo(() => ({
    total: queue.length,
    delayed: queue.filter(i => i.status === 'delayed').length,
    pending: queue.filter(i => i.status === 'pending').length,
    sending: queue.filter(i => i.status === 'sending').length,
    success: queue.filter(i => i.status === 'success').length,
    error: queue.filter(i => i.status === 'error').length,
  }), [queue]);

  return { queue, processing, stats, enqueue, retryItem, removeItem, clearCompleted, cancelPending };
}
