// ── 邮箱账户类型定义 ──

/** 加密方式 */
export type EncryptionType = 'ssl' | 'tls' | 'none';

/** 发送频率限制 */
export interface SendLimits {
  /** 每小时发送上限 */
  maxPerHour: number;
  /** 每天发送上限 */
  maxPerDay: number;
  /** 每封邮件间隔秒数，0 = 不限制 */
  intervalSec: number;
}

/** 邮箱账户 */
export interface EmailAccount {
  id: string;
  email: string;
  displayName?: string;

  // SMTP 发件配置
  smtpHost: string;
  smtpPort: number;
  encryption: EncryptionType;
  hasKeyringPassword: boolean;
  /** @deprecated 密码不再明文存储，仅用于向后兼容旧数据迁移 */
  password?: string;

  // IMAP 收件配置（Phase 6 启用）
  imapHost?: string;
  imapPort?: number;
  imapEncryption?: EncryptionType;

  // 频率限制
  sendLimits: SendLimits;

  // 账户用途标记
  /** 是否用于投稿群发 */
  isSubmissionAccount: boolean;
  /** 是否启用 */
  enabled: boolean;

  // 邮箱服务商名称（用于 UI 展示图标等）
  provider?: string;
}

/** 账户健康状态 */
export interface AccountHealth {
  status: 'ok' | 'cooldown' | 'disabled';
  lastError?: string;
  lastErrorAt?: number;
  /** 连续失败次数 */
  consecutiveErrors: number;
  /** 冷却截止时间戳 */
  cooldownUntil?: number;
}

/** 账户运行时发送计数（不持久化） */
export interface AccountRateState {
  sentThisHour: number;
  sentToday: number;
  lastHourReset: number;
  lastDayReset: number;
  /** 最近一封邮件的发送时间戳 */
  lastSentAt?: number;
}

/** 默认频率限制 */
export const DEFAULT_SEND_LIMITS: SendLimits = {
  maxPerHour: 20,
  maxPerDay: 100,
  intervalSec: 0,
};

/** 创建新账户的默认值 */
export function createDefaultAccount(partial: Partial<EmailAccount> & { id: string; email: string; smtpHost: string; smtpPort: number }): EmailAccount {
  return {
    encryption: 'ssl',
    hasKeyringPassword: false,
    sendLimits: { ...DEFAULT_SEND_LIMITS },
    isSubmissionAccount: true,
    enabled: true,
    displayName: '',
    provider: '',
    ...partial,
  };
}
