import type { EmailProviderPreset } from '@aidocplus/shared-types';
import type { EmailAccount, EmailSignature, AttachmentItem, VariableDef, TextSnippet } from './types';
import type { SendQueueItem } from './sendQueue';
import { htmlToPlainText } from './EmailBodyEditor';

// CSV 解析函数
export function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell.trim());
    if (row.some(c => c)) result.push(row); // 跳过空行
  }
  return result;
}

// 自动识别邮箱列索引
export function detectEmailColumn(headers: string[]): number {
  const keywords = ['邮箱', 'email', 'e-mail', '邮件', '电子邮件'];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (keywords.some(k => h.includes(k))) return i;
  }
  return -1;
}

// 自动识别姓名列索引
export function detectNameColumn(headers: string[]): number {
  const keywords = ['姓名', 'name', '称呼', '名字', '联系人'];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (keywords.some(k => h.includes(k))) return i;
  }
  return -1;
}

// 预置变量
export function getPresetVariables(t: (key: string) => string): VariableDef[] {
  return [
    { name: 'title', label: t('presetVarTitle'), source: 'document' },
    { name: 'content', label: t('presetVarContent'), source: 'document' },
    { name: 'date', label: t('presetVarDate'), source: 'document' },
  ];
}

// 预置文本片段
export function getPresetSnippets(t: (key: string) => string): TextSnippet[] {
  return [
    { id: 'greeting_formal', name: t('presetGreetingFormal'), category: t('categoryGreeting'), content: t('presetGreetingFormalContent') },
    { id: 'greeting_general', name: t('presetGreetingGeneral'), category: t('categoryGreeting'), content: t('presetGreetingGeneralContent') },
    { id: 'closing_formal', name: t('presetClosingFormal'), category: t('categoryClosing'), content: t('presetClosingFormalContent') },
    { id: 'closing_await', name: t('presetClosingAwait'), category: t('categoryClosing'), content: t('presetClosingAwaitContent') },
  ];
}

// 收件人上下文（群发单送用）
export interface RecipientContext {
  name?: string;
  email: string;
  /** 联系人扩展字段（如机构、电话等） */
  extraFields?: Record<string, string>;
  /** 每人独立变量值（最高优先级） */
  variables?: Record<string, string>;
}

// 变量替换函数
// recipientContext 为可选参数，群发单送时传入
export function replaceVariables(
  template: string,
  variables: VariableDef[],
  context: { title: string; content: string; date: string },
  recipientContext?: RecipientContext,
): string {
  let result = template;

  // 1. 收件人独立变量（最高优先级）
  if (recipientContext?.variables) {
    for (const [k, v] of Object.entries(recipientContext.variables)) {
      const regex = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
      result = result.replace(regex, v);
    }
  }

  // 2. 收件人扩展字段 → {{recipient_*}}
  if (recipientContext?.extraFields) {
    for (const [k, v] of Object.entries(recipientContext.extraFields)) {
      const regex = new RegExp(`\\{\\{recipient_${k}\\}\\}`, 'g');
      result = result.replace(regex, v);
    }
  }

  // 3. 收件人内置变量
  if (recipientContext) {
    result = result.replace(/\{\{recipient_name\}\}/g, recipientContext.name || '');
    result = result.replace(/\{\{recipient_email\}\}/g, recipientContext.email || '');
  }

  // 4. 模板自定义变量默认值
  for (const v of variables) {
    const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
    result = result.replace(regex, v.defaultValue || '');
  }

  // 5. 内置变量
  result = result.replace(/\{\{title\}\}/g, context.title);
  result = result.replace(/\{\{content\}\}/g, context.content);
  result = result.replace(/\{\{date\}\}/g, context.date);

  return result;
}

// 获取当前日期字符串
export function getCurrentDateString(): string {
  return new Date().toLocaleDateString();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function translateSmtpResult(raw: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (raw.startsWith('SEND_OK: ')) return t('sendOk', { recipients: raw.slice(9) });
  if (raw.startsWith('SMTP_TEST_OK: ')) return t('smtpTestOk', { server: raw.slice(14) });
  if (raw.startsWith('SMTP_BUILD_FAILED: ')) return t('smtpBuildFailed', { detail: raw.slice(19) });
  if (raw.startsWith('SMTP_TEST_FAILED: ')) return t('smtpTestFailed', { detail: raw.slice(18) });
  if (raw.startsWith('SEND_FAILED: ')) return t('smtpSendFailed', { detail: raw.slice(13) });
  if (raw.startsWith('SENDER_FORMAT_ERROR: ')) return t('senderFormatError', { detail: raw.slice(21) });
  if (raw.startsWith('RECIPIENT_FORMAT_ERROR: ')) return t('recipientFormatError', { detail: raw.slice(23) });
  if (raw.startsWith('CC_FORMAT_ERROR: ')) return t('ccFormatError', { detail: raw.slice(17) });
  if (raw.startsWith('BCC_FORMAT_ERROR: ')) return t('bccFormatError', { detail: raw.slice(18) });
  if (raw.startsWith('EMAIL_BUILD_FAILED: ')) return t('emailBuildFailed', { detail: raw.slice(20) });
  if (raw.startsWith('ATTACHMENT_READ_FAILED: ')) return t('attachmentReadFailed', { detail: raw.slice(23) });
  if (raw.startsWith('ATTACHMENT_PATH_INVALID: ')) return t('attachmentPathInvalid', { detail: raw.slice(24) });
  if (raw.startsWith('ATTACHMENT_PATH_FORBIDDEN: ')) return t('attachmentPathForbidden', { detail: raw.slice(26) });
  if (raw.startsWith('REPLY_TO_FORMAT_ERROR: ')) return t('replyToFormatError', { detail: raw.slice(22) });
  if (raw.startsWith('SMTP_RELAY_ERROR: ')) return t('smtpRelayError', { detail: raw.slice(18) });
  if (raw.startsWith('SMTP_STARTTLS_RELAY_ERROR: ')) return t('smtpStarttlsRelayError', { detail: raw.slice(26) });
  if (raw.startsWith('TLS_PARAM_ERROR: ')) return t('tlsParamError', { detail: raw.slice(17) });
  if (raw.startsWith('KEYRING_INIT_FAILED: ')) return t('keyringInitFailed', { detail: raw.slice(21) });
  if (raw.startsWith('KEYRING_STORE_FAILED: ')) return t('keyringStoreFailed', { detail: raw.slice(22) });
  if (raw.startsWith('KEYRING_DELETE_FAILED: ')) return t('keyringDeleteFailed', { detail: raw.slice(22) });
  if (raw.startsWith('KEYRING_GET_FAILED: ')) return t('keyringGetFailed', { detail: raw.slice(20) });
  if (raw.startsWith('PASSWORD_REQUIRED: ')) return t('passwordRequired', { detail: raw.slice(19) });
  if (raw === 'RECIPIENT_EMPTY') return t('recipientRequired');
  if (raw === 'CREDENTIAL_STORED') return t('credentialStored');
  if (raw === 'CREDENTIAL_DELETED') return t('credentialDeleted');
  if (raw === 'CREDENTIAL_NOT_FOUND') return t('credentialNotFound');
  return raw;
}

export function makeAccountId() {
  return `acct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function newBlankAccount(preset?: EmailProviderPreset): EmailAccount {
  return {
    id: makeAccountId(),
    name: '',
    provider: preset?.id || 'custom',
    smtpHost: preset?.smtpHost || '',
    smtpPort: preset?.smtpPort || 465,
    encryption: preset?.encryption || 'tls',
    email: '',
    password: '',
    displayName: '',
  };
}

// ── 发送 payload 准备（消除 handleSend / handleBulkSend / handleScheduledSend 的重复代码） ──

export interface SendPayloadInput {
  accounts: { id: string; smtpHost: string; smtpPort: number; encryption: string; email: string; password?: string; hasKeyringPassword?: boolean; displayName?: string }[];
  selectedAccountId: string;
  recipients: string;
  cc: string;
  bcc: string;
  subject: string;
  emailBody: string;
  emailFormat: 'html' | 'plaintext';
  attachments: AttachmentItem[];
  signatures: EmailSignature[];
  activeSignatureId: string;
  requestReadReceipt: boolean;
  replyTo: string;
  priority: 'high' | 'normal' | 'low';
}

export interface SendPayload {
  account: SendPayloadInput['accounts'][0];
  toList: string[];
  ccList: string[];
  bccList: string[];
  bodyToSend: string;
  isPlain: boolean;
  queueItem: Omit<SendQueueItem, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'createdAt'>;
}

export type SendValidationError = 'noAccount' | 'noRecipient' | 'noSubject' | 'noBody';

/**
 * 统一校验 + 准备发送 payload
 * @returns SendPayload 或 SendValidationError 字符串
 */
export function prepareSendPayload(input: SendPayloadInput, opts?: { skipEmptyCheck?: boolean }): SendPayload | SendValidationError {
  const account = input.accounts.find(a => a.id === input.selectedAccountId);
  if (!account) return 'noAccount';

  const toList = input.recipients.split(',').map(s => s.trim()).filter(Boolean);
  if (toList.length === 0) return 'noRecipient';
  if (!opts?.skipEmptyCheck) {
    if (!input.subject.trim()) return 'noSubject';
    if (!input.emailBody.trim()) return 'noBody';
  }

  const ccList = input.cc.split(',').map(s => s.trim()).filter(Boolean);
  const bccList = input.bcc.split(',').map(s => s.trim()).filter(Boolean);
  const isPlain = input.emailFormat === 'plaintext';

  // 追加签名
  let bodyToSend = input.emailBody;
  const activeSig = input.signatures.find(s => s.id === input.activeSignatureId);
  if (activeSig?.content) {
    if (isPlain) {
      bodyToSend = input.emailBody + '\n\n-- \n' + htmlToPlainText(activeSig.content);
    } else {
      bodyToSend = input.emailBody + '<br/><br/><div style="border-top:1px solid #ccc;padding-top:8px;margin-top:12px;color:#666;">' + activeSig.content + '</div>';
    }
  }

  const queueItem = {
    to: toList, cc: ccList, bcc: bccList,
    subject: input.subject.trim(),
    body: bodyToSend,
    isHtml: !isPlain,
    isRawHtml: !isPlain,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    encryption: account.encryption,
    email: account.email,
    accountId: account.hasKeyringPassword ? account.id : undefined,
    password: account.hasKeyringPassword ? undefined : (account.password || undefined),
    displayName: account.displayName || undefined,
    attachments: input.attachments.length ? input.attachments.map(a => ({ path: a.path, filename: a.filename, mimeType: a.mimeType })) : undefined,
    requestReadReceipt: input.requestReadReceipt || undefined,
    replyTo: input.replyTo.trim() || undefined,
    priority: input.priority !== 'normal' ? input.priority : undefined,
  };

  return { account, toList, ccList, bccList, bodyToSend, isPlain, queueItem };
}

// MIME 类型映射
export const mimeMap: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
};
