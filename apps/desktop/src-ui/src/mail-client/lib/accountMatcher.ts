// ── 智能账户匹配引擎（后缀优先 + 配额检查） ──

import type { EmailAccount, AccountRateState } from '../types/account';
import type { AccountHealth } from '../types/account';

/**
 * 提取邮箱后缀（@ 后面的部分，小写）
 */
export function getEmailDomain(email: string): string {
  const idx = email.lastIndexOf('@');
  return idx >= 0 ? email.slice(idx + 1).toLowerCase() : '';
}

/**
 * 检查账户是否有剩余配额
 */
export function hasQuota(
  account: EmailAccount,
  rateState?: AccountRateState,
): boolean {
  if (!rateState) return true;

  const now = Date.now();
  const limits = account.sendLimits;

  // 检查小时配额（距上次重置 ≥ 60 分钟时清零）
  let hourCount = rateState.sentThisHour;
  if (now - rateState.lastHourReset >= 60 * 60 * 1000) {
    hourCount = 0;
  }
  if (limits.maxPerHour > 0 && hourCount >= limits.maxPerHour) {
    return false;
  }

  // 检查日配额（日期变更时清零）
  let dayCount = rateState.sentToday;
  const lastResetDate = new Date(rateState.lastDayReset).toDateString();
  const todayDate = new Date(now).toDateString();
  if (lastResetDate !== todayDate) {
    dayCount = 0;
  }
  if (limits.maxPerDay > 0 && dayCount >= limits.maxPerDay) {
    return false;
  }

  return true;
}

/**
 * 计算账户剩余配额（取小时和日配额的较小值）
 */
export function remainingQuota(
  account: EmailAccount,
  rateState?: AccountRateState,
): number {
  if (!rateState) {
    return Math.min(
      account.sendLimits.maxPerHour || Infinity,
      account.sendLimits.maxPerDay || Infinity,
    );
  }

  const now = Date.now();
  const limits = account.sendLimits;

  let hourCount = rateState.sentThisHour;
  if (now - rateState.lastHourReset >= 60 * 60 * 1000) hourCount = 0;

  let dayCount = rateState.sentToday;
  const lastResetDate = new Date(rateState.lastDayReset).toDateString();
  if (lastResetDate !== new Date(now).toDateString()) dayCount = 0;

  const hourRemaining = limits.maxPerHour > 0 ? limits.maxPerHour - hourCount : Infinity;
  const dayRemaining = limits.maxPerDay > 0 ? limits.maxPerDay - dayCount : Infinity;

  return Math.max(0, Math.min(hourRemaining, dayRemaining));
}

/**
 * 检查账户是否可用（启用 + 投稿账户 + 健康 + 有配额）
 */
export function isAccountAvailable(
  account: EmailAccount,
  healthMap: Record<string, AccountHealth>,
  rateStates: Record<string, AccountRateState>,
): boolean {
  if (!account.enabled || !account.isSubmissionAccount) return false;

  const health = healthMap[account.id];
  if (health) {
    if (health.status === 'disabled') return false;
    if (health.status === 'cooldown' && health.cooldownUntil && Date.now() < health.cooldownUntil) {
      return false;
    }
  }

  return hasQuota(account, rateStates[account.id]);
}

/**
 * 智能匹配发件账户
 *
 * 优先级：
 * 1. 手动指定（matchedAccountId 非空）
 * 2. 后缀匹配：收件人邮箱后缀 → 相同后缀的可用投稿账户（配额最多的优先）
 * 3. 默认账户：primaryAccountId
 *
 * 如果后缀匹配到的账户已达限额，回退到其他有配额的账户
 */
export function matchAccountForRecipient(
  recipientEmail: string,
  accounts: EmailAccount[],
  healthMap: Record<string, AccountHealth>,
  rateStates: Record<string, AccountRateState>,
  primaryAccountId: string,
  manualAccountId?: string,
): string {
  // 1. 手动指定
  if (manualAccountId) {
    const manual = accounts.find((a) => a.id === manualAccountId);
    if (manual && isAccountAvailable(manual, healthMap, rateStates)) {
      return manualAccountId;
    }
  }

  // 收集所有可用投稿账户
  const available = accounts.filter((a) => isAccountAvailable(a, healthMap, rateStates));
  if (available.length === 0) {
    // 没有可用账户，强制返回主账户
    return primaryAccountId;
  }

  // 2. 后缀匹配
  const recipientDomain = getEmailDomain(recipientEmail);
  if (recipientDomain) {
    const sameDomain = available.filter(
      (a) => getEmailDomain(a.email) === recipientDomain,
    );
    if (sameDomain.length > 0) {
      // 选配额最多的
      sameDomain.sort(
        (a, b) => remainingQuota(b, rateStates[b.id]) - remainingQuota(a, rateStates[a.id]),
      );
      return sameDomain[0].id;
    }
  }

  // 3. 默认账户（如果可用）
  const primary = available.find((a) => a.id === primaryAccountId);
  if (primary) return primaryAccountId;

  // 4. 回退：配额最多的可用账户
  available.sort(
    (a, b) => remainingQuota(b, rateStates[b.id]) - remainingQuota(a, rateStates[a.id]),
  );
  return available[0].id;
}

/**
 * 记录一次发送，更新运行时计数
 */
export function recordSend(
  accountId: string,
  rateStates: Record<string, AccountRateState>,
): void {
  const now = Date.now();
  const state = rateStates[accountId];
  if (!state) {
    rateStates[accountId] = {
      sentThisHour: 1,
      sentToday: 1,
      lastHourReset: now,
      lastDayReset: now,
      lastSentAt: now,
    };
    return;
  }

  // 小时重置
  if (now - state.lastHourReset >= 60 * 60 * 1000) {
    state.sentThisHour = 0;
    state.lastHourReset = now;
  }

  // 日重置
  const lastResetDate = new Date(state.lastDayReset).toDateString();
  if (lastResetDate !== new Date(now).toDateString()) {
    state.sentToday = 0;
    state.lastDayReset = now;
  }

  state.sentThisHour += 1;
  state.sentToday += 1;
  state.lastSentAt = now;
}

/**
 * 预览群发时的账户分配情况（用于 UI 展示）
 */
export function previewAccountAssignments(
  recipientEmails: string[],
  accounts: EmailAccount[],
  healthMap: Record<string, AccountHealth>,
  rateStates: Record<string, AccountRateState>,
  primaryAccountId: string,
): { email: string; accountId: string; accountEmail: string; domain: string }[] {
  // 使用副本避免修改原始状态
  const tempStates: Record<string, AccountRateState> = {};
  for (const [k, v] of Object.entries(rateStates)) {
    tempStates[k] = { ...v };
  }

  return recipientEmails.map((recipientEmail) => {
    const accountId = matchAccountForRecipient(
      recipientEmail,
      accounts,
      healthMap,
      tempStates,
      primaryAccountId,
    );
    recordSend(accountId, tempStates);
    const account = accounts.find((a) => a.id === accountId);
    return {
      email: recipientEmail,
      accountId,
      accountEmail: account?.email || '',
      domain: getEmailDomain(recipientEmail),
    };
  });
}
