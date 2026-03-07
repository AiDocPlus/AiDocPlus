// ── 发送频率限制 + 账户健康管理（纯函数模块，无 React 依赖） ──

import type { SendLimits, AccountHealth } from './types';

// ── 频率限制 ──

interface RateLimitResult {
  allowed: boolean;
  waitMs: number;
  reason: string;
}

interface AccountStats {
  sentLastHour: number;
  sentLastDay: number;
  remainHour: number;
  remainDay: number;
}

/**
 * 检查某账户当前是否可以发送
 * 三层限流：最小间隔 → 小时上限 → 日上限
 */
export function canSendNow(log: number[], limits: SendLimits): RateLimitResult {
  const now = Date.now();

  // 1. 最小间隔检查
  if (limits.intervalSec > 0 && log.length > 0) {
    const lastSend = log[log.length - 1];
    const elapsed = now - lastSend;
    const required = limits.intervalSec * 1000;
    if (elapsed < required) {
      return { allowed: false, waitMs: required - elapsed, reason: 'interval' };
    }
  }

  // 2. 小时上限检查
  if (limits.perHour > 0) {
    const oneHourAgo = now - 3600_000;
    const sentLastHour = log.filter(t => t > oneHourAgo).length;
    if (sentLastHour >= limits.perHour) {
      // 等到最早的那条过期
      const sorted = log.filter(t => t > oneHourAgo).sort((a, b) => a - b);
      const waitMs = sorted[0] + 3600_000 - now + 100;
      return { allowed: false, waitMs: Math.max(waitMs, 1000), reason: 'hourly' };
    }
  }

  // 3. 日上限检查
  if (limits.perDay > 0) {
    const oneDayAgo = now - 86400_000;
    const sentLastDay = log.filter(t => t > oneDayAgo).length;
    if (sentLastDay >= limits.perDay) {
      const sorted = log.filter(t => t > oneDayAgo).sort((a, b) => a - b);
      const waitMs = sorted[0] + 86400_000 - now + 100;
      return { allowed: false, waitMs: Math.max(waitMs, 1000), reason: 'daily' };
    }
  }

  return { allowed: true, waitMs: 0, reason: '' };
}

/** 记录一次发送，返回新的日志数组 */
export function recordSend(log: number[]): number[] {
  return [...log, Date.now()];
}

/** 清除 >24h 的旧记录 */
export function pruneLog(log: number[]): number[] {
  const cutoff = Date.now() - 86400_000;
  return log.filter(t => t > cutoff);
}

/** 获取账户发送统计 */
export function getAccountStats(log: number[], limits: SendLimits): AccountStats {
  const now = Date.now();
  const sentLastHour = log.filter(t => t > now - 3600_000).length;
  const sentLastDay = log.filter(t => t > now - 86400_000).length;
  return {
    sentLastHour,
    sentLastDay,
    remainHour: limits.perHour > 0 ? Math.max(0, limits.perHour - sentLastHour) : Infinity,
    remainDay: limits.perDay > 0 ? Math.max(0, limits.perDay - sentLastDay) : Infinity,
  };
}

/** 预估完成时间（毫秒） */
export function estimateCompletion(remaining: number, limits: SendLimits): number {
  if (remaining <= 0) return 0;

  // 取最严格的限制
  let msPerEmail = 500; // 基础处理时间

  if (limits.intervalSec > 0) {
    msPerEmail = Math.max(msPerEmail, limits.intervalSec * 1000);
  }

  if (limits.perHour > 0) {
    const msPerEmailByHour = 3600_000 / limits.perHour;
    msPerEmail = Math.max(msPerEmail, msPerEmailByHour);
  }

  if (limits.perDay > 0) {
    const msPerEmailByDay = 86400_000 / limits.perDay;
    msPerEmail = Math.max(msPerEmail, msPerEmailByDay);
  }

  return remaining * msPerEmail;
}

// ── 账户健康管理 ──

/** 冷却时间阈值（连续错误达此数即进入 cooldown） */
const COOLDOWN_THRESHOLD = 3;

/** 冷却时间基数（毫秒）：5 分钟 */
const COOLDOWN_BASE_MS = 5 * 60 * 1000;

/** 冷却时间最大值：30 分钟 */
const COOLDOWN_MAX_MS = 30 * 60 * 1000;

/** 默认健康状态 */
export function defaultAccountHealth(): AccountHealth {
  return { status: 'ok', consecutiveErrors: 0 };
}

/**
 * 标记账户发送出错
 * 连续错误 >= 3 次 → 进入 cooldown（指数退避：5min → 15min → 30min）
 */
export function markAccountError(health: AccountHealth, errorMsg: string): AccountHealth {
  const consecutiveErrors = health.consecutiveErrors + 1;
  const now = Date.now();

  if (consecutiveErrors >= COOLDOWN_THRESHOLD) {
    // 指数退避：round = 从第一次达到阈值算起的轮数
    const round = Math.floor((consecutiveErrors - COOLDOWN_THRESHOLD) / COOLDOWN_THRESHOLD);
    const cooldownMs = Math.min(COOLDOWN_BASE_MS * Math.pow(3, round), COOLDOWN_MAX_MS);
    return {
      status: 'cooldown',
      lastError: errorMsg,
      lastErrorAt: now,
      consecutiveErrors,
      cooldownUntil: now + cooldownMs,
    };
  }

  return {
    ...health,
    lastError: errorMsg,
    lastErrorAt: now,
    consecutiveErrors,
  };
}

/** 标记账户发送成功 → 重置错误计数，恢复 ok */
export function markAccountSuccess(health: AccountHealth): AccountHealth {
  return {
    status: 'ok',
    consecutiveErrors: 0,
    lastError: health.lastError,
    lastErrorAt: health.lastErrorAt,
  };
}

/** 检查账户是否可用（ok 或 cooldown 已过期） */
export function isAccountAvailable(health: AccountHealth | undefined): boolean {
  if (!health) return true; // 无记录视为 ok
  if (health.status === 'ok') return true;
  if (health.status === 'disabled') return false;
  if (health.status === 'cooldown') {
    return health.cooldownUntil ? Date.now() >= health.cooldownUntil : true;
  }
  return false;
}

/** 全局：在所有账户中找到最早可用的时刻。如果有账户现在可用，返回 0 */
export function getNextAvailableTime(
  accountIds: string[],
  healthMap: Record<string, AccountHealth>,
  rateLogs: Record<string, number[]>,
  limitsMap: Record<string, SendLimits>,
): number {
  const now = Date.now();
  let earliest = Infinity;

  for (const id of accountIds) {
    const health = healthMap[id];

    // 如果账户健康
    if (isAccountAvailable(health)) {
      const log = rateLogs[id] || [];
      const limits = limitsMap[id];
      if (!limits) return 0; // 无限制 → 立即可用

      const result = canSendNow(log, limits);
      if (result.allowed) return 0;
      earliest = Math.min(earliest, now + result.waitMs);
    } else if (health?.status === 'cooldown' && health.cooldownUntil) {
      earliest = Math.min(earliest, health.cooldownUntil);
    }
    // disabled 的跳过
  }

  return earliest === Infinity ? 0 : Math.max(0, earliest - now);
}

/** 清理过期的 cooldown 状态 */
export function cleanupHealthMap(
  healthMap: Record<string, AccountHealth>,
): Record<string, AccountHealth> {
  const now = Date.now();
  const cleaned: Record<string, AccountHealth> = {};
  for (const [id, h] of Object.entries(healthMap)) {
    if (h.status === 'cooldown' && h.cooldownUntil && now >= h.cooldownUntil) {
      // cooldown 已过期，重置为 ok（保留错误记录但清零计数）
      cleaned[id] = { ...h, status: 'ok', consecutiveErrors: 0, cooldownUntil: undefined };
    } else {
      cleaned[id] = h;
    }
  }
  return cleaned;
}

/** 格式化等待时间为可读字符串 */
export function formatWaitTime(ms: number): string {
  if (ms <= 0) return '';
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec} 秒`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 ? `${min} 分 ${sec} 秒` : `${min} 分钟`;
  const hours = Math.floor(min / 60);
  const remainMin = min % 60;
  return remainMin > 0 ? `${hours} 小时 ${remainMin} 分` : `${hours} 小时`;
}
