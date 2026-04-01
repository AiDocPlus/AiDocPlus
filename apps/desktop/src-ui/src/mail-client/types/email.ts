// ── 邮件相关类型定义 ──

import type { Contact } from './contact';
import type { EmailAccount, AccountHealth } from './account';

/** 附件 */
export interface AttachmentItem {
  id: string;
  path: string;
  filename: string;
  size: number;
  mimeType: string;
}

/** 签名 */
export interface EmailSignature {
  id: string;
  name: string;
  content: string;
}

/** 草稿 */
export interface EmailDraft {
  id: string;
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

// ── 变量系统 ──

/** 变量定义 */
export interface VariableDef {
  name: string;
  label: string;
  defaultValue?: string;
  source: 'document' | 'user' | 'ai';
}

// ── 投稿模板 ──

/** 文本片段 */
export interface TextSnippet {
  id: string;
  name: string;
  content: string;
  category?: string;
}

/** 投稿模板 */
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

// ── 群发任务 ──

/** 群发收件人 */
export interface BulkRecipient {
  email: string;
  name?: string;
  /** 关联联系人 ID（用于提取 extraFields、专属模板等） */
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

/** 群发任务 */
export interface BulkSendJob {
  id: string;
  name: string;
  /** 主发件账户 */
  accountId: string;
  /** 是否启用智能账户匹配（后缀优先） */
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
  lastPersistedAt?: number;
}

/** 发送历史记录 */
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
  bulkJobId?: string;
  bulkJobName?: string;
}

// ── 群发引擎上下文 ──

/** 收件人上下文（用于变量替换） */
export interface RecipientContext {
  name?: string;
  email: string;
  organization?: string;
  category?: string;
  extraFields?: Record<string, string>;
  variables?: Record<string, string>;
}

/** 群发展开上下文 */
export interface ExpandContext {
  accounts: EmailAccount[];
  contacts: Contact[];
  templates: SubmissionTemplate[];
  signatures: { id: string; name?: string; content: string }[];
  healthMap: Record<string, AccountHealth>;
  rateLogs: Record<string, number[]>;
  docContext?: Record<string, string>;
}

// ── 邮件客户端导航 ──

/** 导航视图 */
export type MailView =
  | 'compose'
  | 'inbox'
  | 'sent'
  | 'drafts'
  | 'contacts'
  | 'templates'
  | 'bulk-send'
  | 'settings';
