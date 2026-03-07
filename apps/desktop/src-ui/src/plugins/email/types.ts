// ── 邮件插件内部类型（完全独立于主程序） ──
import type { SendQueueItem } from './sendQueue';

export interface LogEntry {
  time: string;
  level: 'info' | 'error' | 'success';
  msg: string;
}

export interface EmailAccount {
  id: string;
  name: string;
  provider: string;
  smtpHost: string;
  smtpPort: number;
  encryption: 'tls' | 'starttls' | 'none';
  email: string;
  /** @deprecated 密码不再明文存储，仅用于向后兼容旧数据迁移 */
  password?: string;
  /** 密码已存入 OS 密钥链 */
  hasKeyringPassword?: boolean;
  displayName?: string;
  /** 发送频率限制 */
  sendLimits?: SendLimits;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  note?: string;
  groupId?: string;
  starred?: boolean;
  createdAt?: number;
  // 额外字段（如机构、电话、地址等，从 CSV 导入保留）
  extraFields?: Record<string, string>;
}

export interface ContactGroup {
  id: string;
  name: string;
  color?: string;
}

export interface AttachmentItem {
  id: string;
  path: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface SavedSubject {
  id: string;
  text: string;
}

// ── 投稿模板相关类型 ──

// 文本片段
export interface TextSnippet {
  id: string;
  name: string;
  content: string;
  category?: string;
}

// 变量定义
export interface VariableDef {
  name: string;
  label: string;
  defaultValue?: string;
  source: 'document' | 'user' | 'ai';
}

// 投稿模板
export interface SubmissionTemplate {
  id: string;
  name: string;
  description?: string;
  type?: 'general' | 'recipient';
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  subjectTemplate: string;
  bodyTemplate: string;
  variables: VariableDef[];
  category?: string;
  lastUsedAt?: number;
  useCount?: number;
  createdAt: number;
  updatedAt: number;
}

// ── 发送频率限制 ──

export interface SendLimits {
  /** 每小时发送上限，0 = 不限制 */
  perHour: number;
  /** 每天发送上限，0 = 不限制 */
  perDay: number;
  /** 每封邮件间隔秒数，0 = 不限制 */
  intervalSec: number;
}

// ── 账户健康状态 ──

export interface AccountHealth {
  status: 'ok' | 'cooldown' | 'disabled';
  lastError?: string;
  lastErrorAt?: number;
  /** 连续失败次数 */
  consecutiveErrors: number;
  /** 冷却截止时间戳 */
  cooldownUntil?: number;
}

// ── 群发任务 ──

export interface BulkRecipient {
  email: string;
  name?: string;
  /** 关联联系人 ID（用于提取 extraFields） */
  contactId?: string;
  /** 专属模板 ID（手动或自动匹配） */
  templateId?: string;
  /** 智能匹配的发件账户 */
  matchedAccountId?: string;
  /** 实际使用的账户（含故障降级后的切换） */
  actualAccountId?: string;
  /** 每人独立变量值 */
  variables?: Record<string, string>;
  status: 'pending' | 'queued' | 'sent' | 'failed' | 'skipped';
  error?: string;
  sentAt?: number;
  /** 关联的 SendQueueItem.id（用于实时状态同步） */
  queueItemId?: string;
}

export interface BulkSendJob {
  id: string;
  name: string;
  /** 主发件账户 */
  accountId: string;
  /** 是否启用智能账户匹配 */
  autoMatchAccount: boolean;
  /** 通用模板 ID */
  defaultTemplateId?: string;
  /** 兜底主题 */
  defaultSubject: string;
  /** 兜底正文 */
  defaultBody: string;
  recipients: BulkRecipient[];
  attachments?: AttachmentItem[];
  signatureId?: string;
  status: 'draft' | 'sending' | 'paused' | 'completed' | 'cancelled';
  progress: { total: number; sent: number; failed: number };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  /** 最后一次持久化的时间戳 */
  lastPersistedAt?: number;
}

export interface EmailSignature {
  id: string;
  name: string;
  content: string;
}

export interface SendHistoryEntry {
  timestamp: number;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  accountId: string;
  accountEmail?: string;
  status: 'success' | 'error';
  statusMsg?: string;
  /** 所属群发任务 ID */
  bulkJobId?: string;
  /** 所属群发任务名 */
  bulkJobName?: string;
}

export interface EmailDraft {
  id: string;
  /** 草稿名称（自动生成或用户命名） */
  name: string;
  recipients: string;
  cc: string;
  bcc: string;
  subject: string;
  emailBody: string;
  emailFormat: 'html' | 'plaintext';
  accountId: string;
  attachments: AttachmentItem[];
  activeSignatureId: string;
  createdAt: number;
  updatedAt: number;
}

export interface EmailStorageData {
  accounts?: EmailAccount[];
  activeAccountId?: string;
  recipients?: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject?: string;
  emailBody?: string;
  emailFormat?: 'html' | 'plaintext';
  sendAsHtml?: boolean;
  contacts?: Contact[];
  contactGroups?: ContactGroup[];
  savedSubjects?: SavedSubject[];
  submissionTemplates?: SubmissionTemplate[];
  textSnippets?: TextSnippet[];
  attachments?: AttachmentItem[];
  signatures?: EmailSignature[];
  activeSignatureId?: string;
  sendHistory?: SendHistoryEntry[];
  drafts?: EmailDraft[];
  pendingSendQueue?: SendQueueItem[];
  /** 群发队列的待发送项（独立于 pendingSendQueue） */
  bulkPendingQueue?: SendQueueItem[];
  /** 账户发送时间戳日志（频率限制用，两个队列共享） */
  sendRateLog?: Record<string, number[]>;
  /** 账户健康状态（两个队列共享） */
  accountHealthMap?: Record<string, AccountHealth>;
  /** 群发任务列表 */
  bulkJobs?: BulkSendJob[];
}
