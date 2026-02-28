import { useState, useCallback, useRef, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import {
  Button, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../_framework/ui';
import { EMAIL_PROVIDER_PRESETS } from '@aidocplus/shared-types';
import type { EmailProviderPreset } from '@aidocplus/shared-types';
import { Mail, Send, Loader2, Trash2, Plus, Settings, FileText, History, ChevronDown, ChevronUp, Users, Bookmark, Newspaper, FileUp, Paperclip, X, FilePlus, FileText as FileTextIcon, PenLine } from 'lucide-react';
import { EmailBodyEditor, htmlToPlainText } from './EmailBodyEditor';
import { looksLikeMarkdown, convertMarkdownToHtml } from './markdownToHtml';

interface LogEntry {
  time: string;
  level: 'info' | 'error' | 'success';
  msg: string;
}

// ── 插件内部类型（完全独立于主程序） ──

interface EmailAccount {
  id: string;
  name: string;
  provider: string;
  smtpHost: string;
  smtpPort: number;
  encryption: 'tls' | 'starttls' | 'none';
  email: string;
  password: string;
  displayName?: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  note?: string;
  groupId?: string;
  // 额外字段（如机构、电话、地址等，从 CSV 导入保留）
  extraFields?: Record<string, string>;
}

interface ContactGroup {
  id: string;
  name: string;
  color?: string;
}

interface AttachmentItem {
  id: string;
  path: string;
  filename: string;
  size: number;
  mimeType: string;
}

interface SavedSubject {
  id: string;
  text: string;
}

// ── 投稿模板相关类型 ──

// 文本片段
interface TextSnippet {
  id: string;
  name: string;
  content: string;
  category?: string;
}

// 变量定义
interface VariableDef {
  name: string;
  label: string;
  defaultValue?: string;
  source: 'document' | 'user' | 'ai';
}

// 投稿模板
interface SubmissionTemplate {
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
  createdAt: number;
  updatedAt: number;
}

// 预置变量
function getPresetVariables(t: (key: string) => string): VariableDef[] {
  return [
    { name: 'title', label: t('presetVarTitle'), source: 'document' },
    { name: 'content', label: t('presetVarContent'), source: 'document' },
    { name: 'date', label: t('presetVarDate'), source: 'document' },
  ];
}

// 预置文本片段
function getPresetSnippets(t: (key: string) => string): TextSnippet[] {
  return [
    { id: 'greeting_formal', name: t('presetGreetingFormal'), category: t('categoryGreeting'), content: t('presetGreetingFormalContent') },
    { id: 'greeting_general', name: t('presetGreetingGeneral'), category: t('categoryGreeting'), content: t('presetGreetingGeneralContent') },
    { id: 'closing_formal', name: t('presetClosingFormal'), category: t('categoryClosing'), content: t('presetClosingFormalContent') },
    { id: 'closing_await', name: t('presetClosingAwait'), category: t('categoryClosing'), content: t('presetClosingAwaitContent') },
  ];
}

// CSV 解析函数
function parseCSV(text: string): string[][] {
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
function detectEmailColumn(headers: string[]): number {
  const keywords = ['邮箱', 'email', 'e-mail', '邮件', '电子邮件'];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (keywords.some(k => h.includes(k))) return i;
  }
  return -1;
}

// 自动识别姓名列索引
function detectNameColumn(headers: string[]): number {
  const keywords = ['姓名', 'name', '称呼', '名字', '联系人'];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (keywords.some(k => h.includes(k))) return i;
  }
  return -1;
}

interface EmailSignature {
  id: string;
  name: string;
  content: string;
}

interface EmailStorageData {
  accounts?: EmailAccount[];
  activeAccountId?: string;
  recipients?: string[];
  cc?: string[];
  bcc?: string[];
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
  sendHistory?: Array<{
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
  }>;
}


// 变量替换函数
function replaceVariables(
  template: string,
  variables: VariableDef[],
  context: {
    title: string;
    content: string;
    date: string;
  }
): string {
  let result = template;

  // 替换预置变量
  result = result.replace(/\{\{title\}\}/g, context.title);
  result = result.replace(/\{\{content\}\}/g, context.content);
  result = result.replace(/\{\{date\}\}/g, context.date);

  // 替换自定义变量
  for (const v of variables) {
    const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
    result = result.replace(regex, v.defaultValue || '');
  }

  return result;
}

// 获取当前日期字符串
function getCurrentDateString(): string {
  return new Date().toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function translateSmtpResult(raw: string, t: (key: string, params?: Record<string, string | number>) => string): string {
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
  if (raw === 'RECIPIENT_EMPTY') return t('recipientRequired');
  return raw;
}

function makeAccountId() {
  return `acct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function newBlankAccount(preset?: EmailProviderPreset): EmailAccount {
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

/**
 * 邮件发送插件面板（功能执行类）
 * 所有数据（含邮箱账户）通过 host.storage 独立持久化
 */
export function EmailPluginPanel(_props: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  // 从独立存储恢复
  const stored = host.storage.get<EmailStorageData>('emailData') || {};

  // ── 账户管理状态 ──
  const [accounts, setAccounts] = useState<EmailAccount[]>(stored.accounts || []);
  const [selectedAccountId, setSelectedAccountId] = useState(stored.activeAccountId || '');
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);

  // ── 邮件表单状态 ──
  const [recipients, setRecipients] = useState((stored.recipients || []).join(', '));
  const [cc, setCc] = useState((stored.cc || []).join(', '));
  const [bcc, setBcc] = useState((stored.bcc || []).join(', '));
  const [subject, setSubject] = useState(stored.subject || '');
  const [emailBody, setEmailBody] = useState(stored.emailBody || '');
  // sendAsHtml 已移除，富文本编辑器始终输出 HTML
  const [emailFormat, setEmailFormat] = useState<'html' | 'plaintext'>(stored.emailFormat || 'html');
  const [attachments, setAttachments] = useState<AttachmentItem[]>(stored.attachments || []);
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [recipientsDialogOpen, setRecipientsDialogOpen] = useState(false);
  const [subjectsDialogOpen, setSubjectsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSearchText, setContactSearchText] = useState('');
  const [contactGroupFilter, setContactGroupFilter] = useState('');
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [clearContactsDialogOpen, setClearContactsDialogOpen] = useState(false);
  const [newSubjectText, setNewSubjectText] = useState('');
  const [sendConfirmDialogOpen, setSendConfirmDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyPreviewIdx, setHistoryPreviewIdx] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── 签名管理状态 ──
  const [signatures, setSignatures] = useState<EmailSignature[]>(stored.signatures || []);
  const [activeSignatureId, setActiveSignatureId] = useState(stored.activeSignatureId || '');
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null);

  // ── 投稿模板状态 ──
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SubmissionTemplate | null>(null);
  const [editingSnippet, setEditingSnippet] = useState<TextSnippet | null>(null);

  // ── 收件人自动补全状态 ──
  const [recipientSuggestions, setRecipientSuggestions] = useState<Contact[]>([]);
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);
  const [matchedTemplate, setMatchedTemplate] = useState<SubmissionTemplate | null>(null);
  const recipientInputRef = useRef<HTMLInputElement>(null);

  // ── CSV 导入状态 ──
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvEmailColumn, setCsvEmailColumn] = useState<number>(-1);
  const [csvNameColumn, setCsvNameColumn] = useState<number>(-1);

  // ── 工作状态区域 ──
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const appendLog = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setLogs(prev => [...prev, { time, level, msg }]);
  }, []);

  // 日志更新时仅在日志容器内部滚动到底部
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const sendHistory: EmailStorageData['sendHistory'] = stored.sendHistory || [];

  const showStatus = useCallback((msg: string, isError = false) => {
    appendLog(msg, isError ? 'error' : 'info');
    if (isError) setLogExpanded(true);
  }, [appendLog]);

  const saveToStorage = useCallback((updates: Partial<EmailStorageData>) => {
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    host.storage.set('emailData', { ...current, ...updates });
  }, [host.storage]);

  // ── AI 侧边栏事件监听 ──
  useEffect(() => {
    const handleAiApply = (e: Event) => {
      const { field, value } = (e as CustomEvent).detail;
      if (field === 'body') {
        const html = looksLikeMarkdown(value) ? convertMarkdownToHtml(value) : value;
        setEmailBody(html);
        saveToStorage({ emailBody: html });
        showStatus(t('generateSuccess'));
      } else if (field === 'subject') {
        setSubject(value);
        saveToStorage({ subject: value });
      }
    };
    const handleAiAddAccount = (e: Event) => {
      const { account } = (e as CustomEvent).detail;
      if (account && account.email) {
        const acct: EmailAccount = {
          id: account.id || `acct_${Date.now()}`,
          name: account.name || account.email,
          provider: account.provider || 'custom',
          smtpHost: account.smtpHost || '',
          smtpPort: account.smtpPort || 465,
          encryption: account.encryption || 'tls',
          email: account.email,
          password: account.password || '',
          displayName: account.displayName || '',
        };
        setAccounts(prev => {
          const next = [...prev, acct];
          saveToStorage({ accounts: next });
          return next;
        });
        if (!selectedAccountId) {
          setSelectedAccountId(acct.id);
          saveToStorage({ activeAccountId: acct.id });
        }
        showStatus(t('accountSaved'));
      }
    };
    const handleAiAddSignature = (e: Event) => {
      const { signature } = (e as CustomEvent).detail;
      if (signature && signature.content) {
        const sig: EmailSignature = {
          id: `sig_${Date.now()}`,
          name: signature.name || '新签名',
          content: signature.content,
        };
        setSignatures(prev => {
          const next = [...prev, sig];
          saveToStorage({ signatures: next });
          return next;
        });
        showStatus(t('signatureSaved'));
      }
    };
    window.addEventListener('email-ai-apply', handleAiApply);
    window.addEventListener('email-ai-add-account', handleAiAddAccount);
    window.addEventListener('email-ai-add-signature', handleAiAddSignature);
    return () => {
      window.removeEventListener('email-ai-apply', handleAiApply);
      window.removeEventListener('email-ai-add-account', handleAiAddAccount);
      window.removeEventListener('email-ai-add-signature', handleAiAddSignature);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, saveToStorage, showStatus, t]);

  // ── 账户管理操作 ──
  const saveAccount = useCallback((acct: EmailAccount) => {
    setAccounts(prev => {
      const idx = prev.findIndex(a => a.id === acct.id);
      const next = idx >= 0 ? prev.map(a => a.id === acct.id ? acct : a) : [...prev, acct];
      saveToStorage({ accounts: next });
      return next;
    });
    if (!selectedAccountId || accounts.length === 0) {
      setSelectedAccountId(acct.id);
      saveToStorage({ activeAccountId: acct.id });
    }
    setEditingAccount(null);
    showStatus(t('accountSaved'));
  }, [accounts.length, selectedAccountId, saveToStorage, showStatus, t]);

  const deleteAccount = useCallback((id: string) => {
    setAccounts(prev => {
      const next = prev.filter(a => a.id !== id);
      saveToStorage({ accounts: next });
      if (selectedAccountId === id) {
        const newActive = next.length > 0 ? next[0].id : '';
        setSelectedAccountId(newActive);
        saveToStorage({ activeAccountId: newActive });
      }
      return next;
    });
    setEditingAccount(null);
    showStatus(t('accountDeleted'));
  }, [selectedAccountId, saveToStorage, showStatus, t]);

  const handleSelectAccount = useCallback((id: string) => {
    setSelectedAccountId(id);
    saveToStorage({ activeAccountId: id });
  }, [saveToStorage]);

  // ── 拖拽附件状态 ──
  const [isDragOver, setIsDragOver] = useState(false);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    zip: 'application/zip', rar: 'application/x-rar-compressed', txt: 'text/plain', csv: 'text/csv',
  };

  const addFilesAsAttachments = useCallback(async (filePaths: string[]) => {
    const newAtts: AttachmentItem[] = [];
    for (const fpath of filePaths) {
      const fname = fpath.split('/').pop() || fpath.split('\\').pop() || fpath;
      const ext = fname.split('.').pop()?.toLowerCase() || '';
      let fileSize = 0;
      try {
        const meta = await host.platform.invoke<{ size: number }>('get_file_metadata', { path: fpath });
        fileSize = meta.size || 0;
      } catch { /* ignore */ }
      newAtts.push({ id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, path: fpath, filename: fname, size: fileSize, mimeType: mimeMap[ext] || 'application/octet-stream' });
    }
    const updated = [...attachmentsRef.current, ...newAtts];
    setAttachments(updated);
    saveToStorage({ attachments: updated });
    showStatus(t('attachmentAdded', { count: newAtts.length }));
  }, [host.platform, saveToStorage, showStatus, t]);

  // Tauri 2 file-drop 事件监听
  useEffect(() => {
    const tauri = (window as unknown as Record<string, unknown>).__TAURI__ as Record<string, unknown> | undefined;
    if (!tauri) return;
    const eventModule = tauri.event as { listen?: (event: string, handler: (e: { payload: { paths?: string[]; position?: unknown; type: string } }) => void) => Promise<() => void> } | undefined;
    if (!eventModule?.listen) return;
    let unlisten: (() => void) | null = null;
    eventModule.listen('tauri://drag-drop', (e) => {
      const payload = e.payload;
      if (payload.paths && payload.paths.length > 0) {
        setIsDragOver(false);
        addFilesAsAttachments(payload.paths);
      }
    }).then(fn => { unlisten = fn; });
    // 拖拽进入/离开视觉反馈
    let unlistenOver: (() => void) | null = null;
    let unlistenLeave: (() => void) | null = null;
    eventModule.listen('tauri://drag-over', () => { setIsDragOver(true); }).then(fn => { unlistenOver = fn; });
    eventModule.listen('tauri://drag-leave', () => { setIsDragOver(false); }).then(fn => { unlistenLeave = fn; });
    return () => { unlisten?.(); unlistenOver?.(); unlistenLeave?.(); };
  }, [addFilesAsAttachments]);

  // ── 收件人联系人模糊搜索 ──
  const contacts: Contact[] = stored.contacts || [];
  const allTemplates: SubmissionTemplate[] = stored.submissionTemplates || [];

  const handleRecipientInput = useCallback((value: string) => {
    setRecipients(value);
    saveToStorage({ recipients: value.split(',').map(s => s.trim()).filter(Boolean) });

    // 取最后一个逗号后的文本作为搜索词
    const parts = value.split(',');
    const lastPart = (parts[parts.length - 1] || '').trim().toLowerCase();

    if (lastPart.length >= 1 && contacts.length > 0) {
      const matched = contacts.filter(c =>
        c.name.toLowerCase().includes(lastPart) ||
        c.email.toLowerCase().includes(lastPart) ||
        (c.note || '').toLowerCase().includes(lastPart)
      ).slice(0, 8);
      setRecipientSuggestions(matched);
      setShowRecipientSuggestions(matched.length > 0);
    } else {
      setRecipientSuggestions([]);
      setShowRecipientSuggestions(false);
    }
  }, [contacts, saveToStorage]);

  const handleSelectContact = useCallback((contact: Contact) => {
    const parts = recipients.split(',').map(s => s.trim()).filter(Boolean);
    // 替换最后一个不完整的输入
    if (parts.length > 0) {
      parts.pop();
    }
    const formatted = contact.name ? `"${contact.name}" <${contact.email}>` : contact.email;
    parts.push(formatted);
    const newVal = parts.join(', ') + ', ';
    setRecipients(newVal);
    saveToStorage({ recipients: newVal.split(',').map(s => s.trim()).filter(Boolean) });
    setShowRecipientSuggestions(false);
    setRecipientSuggestions([]);

    // 检查是否有匹配的专属模板
    const matchingTpl = allTemplates.find(tpl =>
      tpl.recipients.some(r => r.toLowerCase() === contact.email.toLowerCase())
    );
    if (matchingTpl) {
      setMatchedTemplate(matchingTpl);
    }

    // 聚焦回输入框
    setTimeout(() => recipientInputRef.current?.focus(), 50);
  }, [recipients, allTemplates, saveToStorage]);

  const handleApplyMatchedTemplate = useCallback(() => {
    if (!matchedTemplate) return;
    const context = { title: host.content.getDocumentMeta?.()?.title || '', content: convertMarkdownToHtml(referenceContent), date: getCurrentDateString() };
    const processedSubject = replaceVariables(matchedTemplate.subjectTemplate, matchedTemplate.variables, context);
    const processedBody = replaceVariables(matchedTemplate.bodyTemplate, matchedTemplate.variables, context);
    setSubject(processedSubject);
    setEmailBody(processedBody);
    setCc((matchedTemplate.cc || []).join(', '));
    setBcc((matchedTemplate.bcc || []).join(', '));
    saveToStorage({ subject: processedSubject, emailBody: processedBody, cc: matchedTemplate.cc || [], bcc: matchedTemplate.bcc || [] });
    setMatchedTemplate(null);
    showStatus(t('templateApplied'));
  }, [matchedTemplate, host.content, saveToStorage, showStatus, t]);

  // ── 邮件操作 ──
  const handleSend = useCallback(async () => {
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) { showStatus(t('selectAccountFirst'), true); return; }

    const toList = recipients.split(',').map(s => s.trim()).filter(Boolean);
    if (toList.length === 0) { showStatus(t('recipientRequired'), true); return; }
    if (!subject.trim()) { showStatus(t('subjectRequired'), true); return; }
    if (!emailBody.trim()) { showStatus(t('bodyRequired'), true); return; }

    const ccList = cc.split(',').map(s => s.trim()).filter(Boolean);
    const bccList = bcc.split(',').map(s => s.trim()).filter(Boolean);

    setSending(true);
    setLogExpanded(true);
    showStatus(t('sending'));

    try {

      appendLog(`SMTP: ${account.smtpHost}:${account.smtpPort} (${account.encryption})`, 'info');
      appendLog(`From: ${account.email}`, 'info');
      appendLog(`To: ${toList.join(', ')}`, 'info');
      if (ccList.length) appendLog(`CC: ${ccList.join(', ')}`, 'info');
      if (bccList.length) appendLog(`BCC: ${bccList.join(', ')}`, 'info');
      appendLog(`Subject: ${subject.trim()}`, 'info');
      appendLog(`HTML: Yes (rich text), Body: ${emailBody.length} chars`, 'info');

      if (attachments.length) appendLog(`${t('sendConfirmAttachments')}: ${attachments.length}`, 'info');

      const isPlain = emailFormat === 'plaintext';
      // 追加签名
      let bodyToSend = emailBody;
      const activeSig = signatures.find(s => s.id === activeSignatureId);
      if (activeSig?.content) {
        if (isPlain) {
          bodyToSend = emailBody + '\n\n-- \n' + htmlToPlainText(activeSig.content);
        } else {
          bodyToSend = emailBody + '<br/><br/><div style="border-top:1px solid #ccc;padding-top:8px;margin-top:12px;color:#666;">' + activeSig.content + '</div>';
        }
        appendLog(`${t('signatureAppended')}: ${activeSig.name}`, 'info');
      }
      const result = await host.platform.invoke<string>('send_email', {
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
        encryption: account.encryption,
        email: account.email,
        password: account.password,
        displayName: account.displayName || undefined,
        to: toList, cc: ccList, bcc: bccList,
        subject: subject.trim(),
        body: bodyToSend,
        isHtml: !isPlain,
        isRawHtml: !isPlain,
        attachments: attachments.length ? attachments.map(a => ({ path: a.path, filename: a.filename, mimeType: a.mimeType })) : undefined,
      });

      const historyEntry = {
        timestamp: Date.now(), to: toList, cc: ccList.length ? ccList : undefined, bcc: bccList.length ? bccList : undefined,
        subject: subject.trim(), body: emailBody, accountId: account.id, accountEmail: account.email,
        status: 'success' as const, statusMsg: result,
      };
      const history = [historyEntry, ...sendHistory];
      if (history.length > 50) history.length = 50;
      saveToStorage({ emailBody, recipients: toList, cc: ccList, bcc: bccList, subject: subject.trim(), sendHistory: history });
      const translated = translateSmtpResult(result, t);
      appendLog(translated, 'success');
      showStatus(translated);
    } catch (err) {
      const rawErr = err instanceof Error ? err.message : String(err);
      const errMsg = translateSmtpResult(rawErr, t);
      const historyEntry = {
        timestamp: Date.now(), to: toList, cc: ccList.length ? ccList : undefined, bcc: bccList.length ? bccList : undefined,
        subject: subject.trim(), body: emailBody, accountId: account.id, accountEmail: account.email,
        status: 'error' as const, statusMsg: errMsg,
      };
      const history = [historyEntry, ...sendHistory];
      if (history.length > 50) history.length = 50;
      saveToStorage({ sendHistory: history });
      appendLog(errMsg, 'error');
      showStatus(t('sendFailed', { error: errMsg }), true);
    } finally {
      setSending(false);
    }
  }, [accounts, selectedAccountId, recipients, cc, bcc, subject, emailBody, sendHistory, saveToStorage, showStatus, appendLog, t, host.platform]);

  // ── CSV 导入处理 ──
  const handleCsvFileSelect = useCallback(async () => {
    try {
      // 使用 Tauri 文件对话框
      const selected = await host.ui.showOpenDialog({
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!selected) return;

      // 读取文件内容
      const content = await host.platform.invoke<string>('read_text_file', { path: selected });
      const rows = parseCSV(content);
      if (rows.length < 2) {
        showStatus(t('csvEmptyOrNoData'), true);
        return;
      }

      const headers = rows[0];
      const data = rows.slice(1);

      setCsvHeaders(headers);
      setCsvData(data);
      setCsvEmailColumn(detectEmailColumn(headers));
      setCsvNameColumn(detectNameColumn(headers));
      setCsvImportDialogOpen(true);
    } catch (err) {
      showStatus(t('csvReadFailed') + ': ' + (err instanceof Error ? err.message : String(err)), true);
    }
  }, [host, showStatus, t]);

  const handleCsvImport = useCallback(() => {
    if (csvEmailColumn < 0) {
      showStatus(t('csvSelectEmailColumn'), true);
      return;
    }

    const current = host.storage.get<EmailStorageData>('emailData') || {};
    const existingContacts = current.contacts || [];

    const newContacts: Contact[] = csvData.map(row => {
      const email = row[csvEmailColumn] || '';
      const name = csvNameColumn >= 0 ? row[csvNameColumn] || '' : '';

      // 收集额外字段
      const extraFields: Record<string, string> = {};
      csvHeaders.forEach((header, idx) => {
        if (idx !== csvEmailColumn && idx !== csvNameColumn && row[idx]) {
          extraFields[header] = row[idx];
        }
      });

      return {
        id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        email,
        name,
        extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
      };
    }).filter(c => c.email.trim());

    // 合并（跳过已存在的邮箱）
    const existingEmails = new Set(existingContacts.map(c => c.email.toLowerCase()));
    const toAdd = newContacts.filter(c => !existingEmails.has(c.email.toLowerCase()));
    const updated = [...existingContacts, ...toAdd];

    saveToStorage({ contacts: updated });
    setCsvImportDialogOpen(false);
    setCsvData([]);
    showStatus(t('csvImportSuccess', { count: toAdd.length, total: newContacts.length }));
  }, [csvData, csvEmailColumn, csvNameColumn, csvHeaders, host.storage, saveToStorage, showStatus, t]);

  const referenceContent = host.content.getAIContent() || host.content.getDocumentContent();

  return (
    <>
      <div className="h-full flex flex-col">
        {/* ① 顶部工具栏 */}
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30 flex-shrink-0 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setSendConfirmDialogOpen(true)}
            disabled={sending || !emailBody.trim() || !recipients.trim() || !subject.trim() || accounts.length === 0}
            className="gap-1 h-7 text-xs">
            {sending ? (<><Loader2 className="h-3 w-3 animate-spin" />{t('sending')}</>) : (<><Send className="h-3 w-3" />{t('send')}</>)}
          </Button>

          <div className="w-px h-4 bg-border mx-0.5" />

          {accounts.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                  <Mail className="h-3 w-3" />
                  {accounts.find(a => a.id === selectedAccountId)?.name || accounts.find(a => a.id === selectedAccountId)?.email || t('selectAccount')}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {accounts.map(acct => (
                  <DropdownMenuItem key={acct.id}
                    className={acct.id === selectedAccountId ? 'bg-accent' : ''}
                    onClick={() => handleSelectAccount(acct.id)}>
                    {acct.name || acct.email}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAccountDialogOpen(true)}>
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  {t('accountSetup')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setAccountDialogOpen(true)}>
              <Settings className="h-3 w-3" />
              {t('accountSetup')}
            </Button>
          )}


          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setTemplatesDialogOpen(true)}>
            <Newspaper className="h-3 w-3" />
            {t('submissionTemplate')}
          </Button>

          {/* 签名选择 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                <PenLine className="h-3 w-3" />
                {activeSignatureId ? (signatures.find(s => s.id === activeSignatureId)?.name || t('signature')) : t('signature')}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => { setActiveSignatureId(''); saveToStorage({ activeSignatureId: '' }); }}>
                <span className="text-muted-foreground">{t('noSignature')}</span>
              </DropdownMenuItem>
              {signatures.map(sig => (
                <DropdownMenuItem key={sig.id} onClick={() => { setActiveSignatureId(sig.id); saveToStorage({ activeSignatureId: sig.id }); }}>
                  {sig.name}
                  {sig.id === activeSignatureId && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => { setSignatureDialogOpen(true); setEditingSignature(null); }}>
                <Settings className="h-3 w-3 mr-1" />
                {t('manageSignatures')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 新建邮件下拉 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                <FilePlus className="h-3 w-3" />
                {t('newEmail')}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => {
                setRecipients(''); setCc(''); setBcc(''); setSubject(''); setEmailBody(''); setAttachments([]);
                saveToStorage({ recipients: [], cc: [], bcc: [], subject: '', emailBody: '', attachments: [] });
                showStatus(t('newBlankCreated'));
              }}>
                <FileTextIcon className="h-4 w-4 mr-2" />
                {t('newBlankEmail')}
              </DropdownMenuItem>
              {(host.storage.get<EmailStorageData>('emailData')?.submissionTemplates || []).length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {(host.storage.get<EmailStorageData>('emailData')?.submissionTemplates || []).map(tmpl => (
                    <DropdownMenuItem key={tmpl.id} onClick={() => {
                      setRecipients(tmpl.recipients.join(', '));
                      setCc((tmpl.cc || []).join(', '));
                      setBcc((tmpl.bcc || []).join(', '));
                      setSubject(tmpl.subjectTemplate);
                      setEmailBody(tmpl.bodyTemplate);
                      setAttachments([]);
                      saveToStorage({ recipients: tmpl.recipients, cc: tmpl.cc || [], bcc: tmpl.bcc || [], subject: tmpl.subjectTemplate, emailBody: tmpl.bodyTemplate, attachments: [] });
                      showStatus(t('newFromTemplate', { name: tmpl.name }));
                    }}>
                      <Newspaper className="h-4 w-4 mr-2" />
                      <span className="truncate">{tmpl.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1" />
          {sendHistory.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
              onClick={() => { setHistoryDialogOpen(true); setHistoryPreviewIdx(null); }}>
              <History className="h-3 w-3" />
              {t('sentCount', { count: sendHistory.length })}
            </Button>
          )}
        </div>

        {/* ② 功能区（不滚动，正文编辑框撑满剩余空间） */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>

          {/* 无账户时的提示 */}
          {accounts.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm cursor-pointer flex-shrink-0 border-b"
              onClick={() => setAccountDialogOpen(true)}>
              <Mail className="h-4 w-4" />
              <span>{t('noAccountClickSetup')}</span>
            </div>
          )}

          {/* ── 邮件表单（固定区域） ── */}
          <div className="px-3 py-2 space-y-2 flex-shrink-0 border-b">
            <div className="flex items-center gap-2 relative">
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs flex-shrink-0"
                onClick={() => setRecipientsDialogOpen(true)}>
                <Users className="h-3 w-3" />
                {t('to')}
              </Button>
              <div className="flex-1 relative">
                <Input ref={recipientInputRef} value={recipients}
                  onChange={(e) => handleRecipientInput(e.target.value)}
                  onFocus={() => { if (recipientSuggestions.length > 0) setShowRecipientSuggestions(true); }}
                  onBlur={() => { setTimeout(() => setShowRecipientSuggestions(false), 200); }}
                  placeholder={t('toPlaceholder')} className="font-mono text-sm" />
                {/* 联系人模糊搜索下拉 */}
                {showRecipientSuggestions && recipientSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                    {recipientSuggestions.map(c => (
                      <div key={c.id}
                        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent text-sm"
                        onMouseDown={(e) => { e.preventDefault(); handleSelectContact(c); }}>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground ml-1.5 font-mono text-xs">&lt;{c.email}&gt;</span>
                        </div>
                        {c.note && <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{c.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                {showCcBcc ? t('hideCcBcc') : t('showCcBcc')}
              </button>
            </div>

            {/* 专属模板匹配提示 */}
            {matchedTemplate && (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs ml-[76px]">
                <Newspaper className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                <span className="flex-1 text-blue-700 dark:text-blue-300">
                  {t('matchedTemplateHint', { name: matchedTemplate.name })}
                </span>
                <Button variant="outline" size="sm" className="h-5 px-2 text-[10px]" onClick={handleApplyMatchedTemplate}>
                  {t('applyTemplate')}
                </Button>
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => setMatchedTemplate(null)}>
                  {t('ignore')}
                </Button>
              </div>
            )}

            {/* 收件人邮箱格式验证 */}
            {(() => {
              const allEmails = recipients.split(',').map(s => s.trim().replace(/^.*<([^>]+)>$/, '$1')).filter(Boolean);
              const invalid = allEmails.filter(e => !isValidEmail(e));
              if (invalid.length === 0) return null;
              return <p className="text-xs text-destructive pl-[76px]">{t('invalidRecipients', { emails: invalid.join(', ') })}</p>;
            })()}

            {showCcBcc && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium w-[68px] flex-shrink-0 pl-1">{t('cc')}</Label>
                  <Input value={cc}
                    onChange={(e) => { setCc(e.target.value); saveToStorage({ cc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }); }}
                    placeholder={t('ccPlaceholder')} className="font-mono text-sm flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium w-[68px] flex-shrink-0 pl-1">{t('bcc')}</Label>
                  <Input value={bcc}
                    onChange={(e) => { setBcc(e.target.value); saveToStorage({ bcc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }); }}
                    placeholder={t('bccPlaceholder')} className="font-mono text-sm flex-1" />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs flex-shrink-0"
                onClick={() => setSubjectsDialogOpen(true)}>
                <Bookmark className="h-3 w-3" />
                {t('subject')}
              </Button>
              <Input value={subject}
                onChange={(e) => { setSubject(e.target.value); saveToStorage({ subject: e.target.value }); }}
                placeholder={t('subjectPlaceholder')} className="flex-1" />
            </div>
          </div>

          {/* ── 附件区域（支持拖拽） ── */}
          <div className={`flex items-center gap-1 px-2 py-1 border-b flex-shrink-0 transition-colors ${isDragOver ? 'bg-primary/10 border-primary/30' : ''}`}>
            {isDragOver && (
              <span className="text-xs text-primary font-medium mr-1">
                <FileUp className="h-3 w-3 inline mr-0.5" />
                {t('dropFilesHere')}
              </span>
            )}
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
              onClick={async () => {
                const files = await host.ui.showOpenDialogMultiple({ filters: [] });
                if (!files.length) return;
                addFilesAsAttachments(files);
              }}>
              <Paperclip className="h-3 w-3" />
              {t('addAttachment')}
            </Button>
            {attachments.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                {attachments.map(att => (
                  <span key={att.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-muted rounded text-xs max-w-[180px]">
                    <Paperclip className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{att.filename}</span>
                    {att.size > 0 && <span className="text-muted-foreground ml-0.5">({formatFileSize(att.size)})</span>}
                    <button title={t('removeAttachment')} className="ml-0.5 hover:text-destructive" onClick={() => {
                      const updated = attachments.filter(a => a.id !== att.id);
                      setAttachments(updated);
                      saveToStorage({ attachments: updated });
                    }}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {(() => {
                  const totalSize = attachments.reduce((sum, a) => sum + (a.size || 0), 0);
                  if (totalSize <= 0) return null;
                  const isWarning = totalSize > 20 * 1024 * 1024;
                  const isDanger = totalSize > 25 * 1024 * 1024;
                  return (
                    <span className={`text-xs ml-1 flex-shrink-0 ${isDanger ? 'text-destructive font-medium' : isWarning ? 'text-orange-500 font-medium' : 'text-muted-foreground'}`}>
                      {t('attachmentTotalSize', { size: formatFileSize(totalSize) })}
                      {isDanger && ` ⚠ ${t('attachmentSizeExceeded')}`}
                      {isWarning && !isDanger && ` ⚠ ${t('attachmentSizeWarning')}`}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── 正文编辑框（撑满剩余空间） ── */}
          <div className="flex-1 min-h-0 flex flex-col">
            <EmailBodyEditor
              value={emailBody}
              onChange={(html) => { setEmailBody(html); saveToStorage({ emailBody: html }); }}
              placeholder={t('bodyPlaceholder')}
              t={t}
              format={emailFormat}
              onFormatChange={(f) => { setEmailFormat(f); saveToStorage({ emailFormat: f }); }}
              onSaveStatus={() => { /* 编辑器保存状态 */ }}
            />
          </div>

          {/* ── 工作状态（可折叠） ── */}
          <div className="px-2 py-1 border-t flex-shrink-0">
            <div className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setLogExpanded(!logExpanded)}>
              <Label className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                <FileText className="h-3 w-3" />
                {t('workStatus')}
                {logs.length > 0 && (
                  <span className="ml-1 text-muted-foreground/60">({logs.length})</span>
                )}
              </Label>
              <div className="flex items-center gap-1">
                {logs.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); setLogs([]); }}>
                    {t('clearLog')}
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">{logExpanded ? '▲' : '▼'}</span>
              </div>
            </div>
            {logExpanded && (
              <div ref={logContainerRef} className="h-[100px] overflow-y-auto border rounded-md bg-muted/30 px-2 py-1 font-mono text-xs leading-relaxed mt-1">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground/50 text-center pt-8">{t('logEmpty')}</p>
                ) : (
                  logs.map((entry, i) => (
                    <div key={i} className={`${
                      entry.level === 'error' ? 'text-red-500' :
                      entry.level === 'success' ? 'text-green-600 dark:text-green-400' :
                      'text-muted-foreground'
                    }`}>
                      <span className="text-muted-foreground/60">[{entry.time}]</span>{' '}{entry.msg}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 账户管理弹窗 */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{t('accountManage')}</DialogTitle>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                onClick={() => setEditingAccount(newBlankAccount())}>
                <Plus className="h-3 w-3" />
                {t('addAccount')}
              </Button>
            </div>
            <DialogDescription>{t('accountManageDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {accounts.length > 0 && (
              <div className="space-y-1">
                {accounts.map(acct => {
                  const preset = EMAIL_PROVIDER_PRESETS.find(p => p.id === acct.provider);
                  return (
                    <div key={acct.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
                      <span className="truncate flex-1">
                        <span className="font-medium">{acct.name || acct.email}</span>
                        {preset && <span className="text-muted-foreground ml-1">({preset.name})</span>}
                      </span>
                      <div className="flex gap-1 ml-2">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                          onClick={() => setEditingAccount({ ...acct })}>
                          {t('edit')}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteId(acct.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {accounts.length === 0 && !editingAccount && (
              <p className="text-xs text-muted-foreground text-center py-4">{t('noAccountYet')}</p>
            )}

            {editingAccount && (
              <AccountForm
                account={editingAccount}
                t={t}
                onSave={saveAccount}
                onCancel={() => setEditingAccount(null)}
                onTestConnection={async (acct) => {
                  await host.platform.invoke<string>('test_smtp_connection', {
                    smtpHost: acct.smtpHost,
                    smtpPort: acct.smtpPort,
                    encryption: acct.encryption,
                    email: acct.email,
                    password: acct.password,
                  });
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除账户确认弹窗 */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <DialogContent className="sm:max-w-[360px]" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>{t('confirmDeleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('confirmDeleteDesc', { name: accounts.find(a => a.id === confirmDeleteId)?.name || accounts.find(a => a.id === confirmDeleteId)?.email || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmDeleteId(null)}>
              {t('cancel')}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => { if (confirmDeleteId) { deleteAccount(confirmDeleteId); setConfirmDeleteId(null); } }}>
              <Trash2 className="h-3 w-3 mr-1" />
              {t('confirmDelete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 发送历史弹窗 */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[80vh] overflow-hidden flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>{t('historyTitle')}</DialogTitle>
            <DialogDescription>{t('historyDesc', { count: sendHistory.length })}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pt-1">
            {sendHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('historyEmpty')}</p>
            ) : (
              sendHistory.map((item, idx) => {
                const isExpanded = historyPreviewIdx === idx;
                const date = new Date(item.timestamp);
                const timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                return (
                  <div key={idx} className="border rounded-md overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                      onClick={() => setHistoryPreviewIdx(isExpanded ? null : idx)}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{item.subject || t('historyNoSubject')}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t('to')}: {item.to?.join(', ')}
                          {item.cc?.length ? ` | CC: ${item.cc.join(', ')}` : ''}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{timeStr}</span>
                        <span className={`text-xs ${item.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {item.status === 'success' ? t('historySendSuccess') : t('historySendFailed')}
                        </span>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    </div>
                    {isExpanded && (
                      <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                          {item.accountEmail && (
                            <><span className="text-muted-foreground">{t('historyFrom')}:</span><span className="font-mono">{item.accountEmail}</span></>
                          )}
                          <span className="text-muted-foreground">{t('to')}:</span><span className="font-mono">{item.to?.join(', ')}</span>
                          {item.cc?.length ? (<><span className="text-muted-foreground">CC:</span><span className="font-mono">{item.cc.join(', ')}</span></>) : null}
                          {item.bcc?.length ? (<><span className="text-muted-foreground">BCC:</span><span className="font-mono">{item.bcc.join(', ')}</span></>) : null}
                          {item.statusMsg && (
                            <><span className="text-muted-foreground">{t('historyResult')}:</span><span className={item.status === 'error' ? 'text-red-500' : ''}>{item.statusMsg}</span></>
                          )}
                        </div>
                        {item.body && (
                          <div className="border rounded bg-background p-2 max-h-[200px] overflow-y-auto">
                            <div className="prose prose-sm dark:prose-invert max-w-none text-xs" dangerouslySetInnerHTML={{ __html: item.body }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => setHistoryDialogOpen(false)}>
              {t('historyClose')}
            </Button>
            {sendHistory.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => { saveToStorage({ sendHistory: [] }); setHistoryDialogOpen(false); }}>
                <Trash2 className="h-3 w-3 mr-1" />
                {t('historyClear')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* 收件人（联系人）管理弹窗 */}
      <Dialog open={recipientsDialogOpen} onOpenChange={(open) => {
        setRecipientsDialogOpen(open);
        if (open) {
          setEditingContact(null);
          // 根据当前收件人预选联系人
          const currentEmails = recipients.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
          const contacts: Contact[] = (host.storage.get<EmailStorageData>('emailData') || {}).contacts || [];
          const ids = new Set(contacts.filter(c => currentEmails.includes(c.email.toLowerCase())).map(c => c.id));
          setSelectedContactIds(ids);
        }
      }}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{t('contactManage')}</DialogTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                  onClick={handleCsvFileSelect}>
                  <FileUp className="h-3 w-3" />
                  {t('importCsv')}
                </Button>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                  onClick={() => setEditingContact({ id: `ct_${Date.now()}`, name: '', email: '', note: '' })}>
                  <Plus className="h-3 w-3" />
                  {t('newContact')}
                </Button>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    const current = host.storage.get<EmailStorageData>('emailData') || {};
                    if ((current.contacts || []).length === 0) return;
                    setClearContactsDialogOpen(true);
                  }}>
                  <Trash2 className="h-3 w-3" />
                  {t('clearAllContacts')}
                </Button>
              </div>
            </div>
            <DialogDescription>{t('contactManageDesc')}</DialogDescription>
          </DialogHeader>

          {/* 搜索框 + 分组过滤 */}
          <div className="flex-shrink-0 space-y-1.5">
            <Input
              placeholder={t('contactSearchPlaceholder')}
              value={contactSearchText}
              onChange={e => setContactSearchText(e.target.value)}
              className="h-8 text-sm"
            />
            {/* 分组过滤标签 */}
            {(() => {
              const groups: ContactGroup[] = (host.storage.get<EmailStorageData>('emailData') || {}).contactGroups || [];
              if (groups.length === 0 && !editingGroup) return null;
              return (
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={() => setContactGroupFilter('')}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${!contactGroupFilter ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                  >{t('groupAll')}</button>
                  {groups.map(g => (
                    <button key={g.id}
                      onClick={() => setContactGroupFilter(g.id === contactGroupFilter ? '' : g.id)}
                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${g.id === contactGroupFilter ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                    >
                      {g.color && <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: g.color }} />}
                      {g.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setEditingGroup(editingGroup ? null : { id: `grp_${Date.now()}`, name: '', color: '#6366f1' })}
                    className="px-1.5 py-0.5 rounded text-xs border border-dashed border-border hover:bg-muted text-muted-foreground"
                  >{editingGroup ? '✕' : '+'}</button>
                </div>
              );
            })()}
            {/* 分组编辑行 */}
            {editingGroup && (
              <div className="flex items-center gap-1.5">
                <input type="color" value={editingGroup.color || '#6366f1'}
                  onChange={e => setEditingGroup({ ...editingGroup, color: e.target.value })}
                  title={t('groupColor')}
                  className="w-6 h-6 rounded border cursor-pointer p-0" />
                <Input value={editingGroup.name}
                  onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  placeholder={t('groupNamePlaceholder')} className="h-7 text-xs flex-1" />
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  disabled={!editingGroup.name.trim()}
                  onClick={() => {
                    const current = host.storage.get<EmailStorageData>('emailData') || {};
                    const groups = current.contactGroups || [];
                    const idx = groups.findIndex(g => g.id === editingGroup.id);
                    const updated = idx >= 0
                      ? groups.map(g => g.id === editingGroup.id ? editingGroup : g)
                      : [...groups, editingGroup];
                    saveToStorage({ contactGroups: updated });
                    setEditingGroup(null);
                    showStatus(t('groupSaved'));
                  }}>{t('save')}</Button>
                {/* 如果是已有分组，显示删除按钮 */}
                {(host.storage.get<EmailStorageData>('emailData')?.contactGroups || []).some(g => g.id === editingGroup.id) && (
                  <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      const current = host.storage.get<EmailStorageData>('emailData') || {};
                      const updated = (current.contactGroups || []).filter(g => g.id !== editingGroup.id);
                      // 清除关联的联系人 groupId
                      const contacts = (current.contacts || []).map(c => c.groupId === editingGroup.id ? { ...c, groupId: undefined } : c);
                      saveToStorage({ contactGroups: updated, contacts });
                      if (contactGroupFilter === editingGroup.id) setContactGroupFilter('');
                      setEditingGroup(null);
                      showStatus(t('groupDeleted'));
                    }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 联系人编辑表单 */}
          {editingContact && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/20 flex-shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t('contactName')}</Label>
                  <Input value={editingContact.name}
                    onChange={e => setEditingContact({ ...editingContact, name: e.target.value })}
                    placeholder={t('contactNamePlaceholder')} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('contactEmail')}</Label>
                  <Input value={editingContact.email}
                    onChange={e => setEditingContact({ ...editingContact, email: e.target.value })}
                    placeholder="user@example.com" className="h-8 text-sm font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t('contactNote')}</Label>
                  <Input value={editingContact.note || ''}
                    onChange={e => setEditingContact({ ...editingContact, note: e.target.value })}
                    placeholder={t('contactNotePlaceholder')} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('contactGroup')}</Label>
                  <Select value={editingContact.groupId || '__none__'} onValueChange={v => setEditingContact({ ...editingContact, groupId: v === '__none__' ? undefined : v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('noGroup')}</SelectItem>
                      {((host.storage.get<EmailStorageData>('emailData') || {}).contactGroups || []).map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingContact(null)}>{t('cancel')}</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  disabled={!editingContact.email.trim()}
                  onClick={() => {
                    const current = host.storage.get<EmailStorageData>('emailData') || {};
                    const contacts = current.contacts || [];
                    const idx = contacts.findIndex(c => c.id === editingContact.id);
                    const updated = idx >= 0
                      ? contacts.map(c => c.id === editingContact.id ? editingContact : c)
                      : [...contacts, editingContact];
                    saveToStorage({ contacts: updated });
                    setEditingContact(null);
                    showStatus(t('contactSaved'));
                  }}>
                  {t('save')}
                </Button>
              </div>
            </div>
          )}

          {/* 联系人列表 */}
          <ContactListSection
            host={host}
            saveToStorage={saveToStorage}
            showStatus={showStatus}
            selectedContactIds={selectedContactIds}
            setSelectedContactIds={setSelectedContactIds}
            setEditingContact={setEditingContact}
            searchText={contactSearchText}
            groupFilter={contactGroupFilter}
            t={t}
          />

          {/* 底部操作 */}
          <div className="flex items-center justify-between pt-2 border-t flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {t('contactSelectedCount', { count: selectedContactIds.size })}
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
              disabled={selectedContactIds.size === 0}
              onClick={() => {
                const contacts: Contact[] = (host.storage.get<EmailStorageData>('emailData') || {}).contacts || [];
                const selected = contacts.filter(c => selectedContactIds.has(c.id));
                const emailStr = selected.map(c => c.name ? `${c.name} <${c.email}>` : c.email).join(', ');
                setRecipients(emailStr);
                saveToStorage({ recipients: selected.map(c => c.email) });
                setRecipientsDialogOpen(false);
              }}>
              <Users className="h-3 w-3" />
              {t('useSelected')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 清除联系人确认对话框 */}
      <Dialog open={clearContactsDialogOpen} onOpenChange={setClearContactsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>{t('confirmClearContacts')}</DialogTitle>
            <DialogDescription>
              {t('confirmClearContactsDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setClearContactsDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                saveToStorage({ contacts: [] });
                setSelectedContactIds(new Set());
                setClearContactsDialogOpen(false);
                showStatus(t('allContactsCleared'));
              }}
            >
              {t('confirmClearBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 主题管理弹窗 */}
      <Dialog open={subjectsDialogOpen} onOpenChange={setSubjectsDialogOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[70vh] overflow-y-auto" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>{t('subjectManage')}</DialogTitle>
            <DialogDescription>{t('subjectManageDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* 当前主题 + 保存按钮 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('currentSubject')}</Label>
              <div className="flex gap-2">
                <Input value={subject}
                  onChange={(e) => { setSubject(e.target.value); saveToStorage({ subject: e.target.value }); }}
                  placeholder={t('subjectPlaceholder')} className="text-sm flex-1" />
                {subject.trim() && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1 flex-shrink-0"
                    onClick={() => {
                      const item: SavedSubject = { id: `sj_${Date.now()}`, text: subject.trim() };
                      const current = host.storage.get<EmailStorageData>('emailData') || {};
                      const subjects = [...(current.savedSubjects || []), item];
                      saveToStorage({ savedSubjects: subjects });
                      showStatus(t('subjectSaved'));
                    }}>
                    <Plus className="h-3 w-3" />
                    {t('save')}
                  </Button>
                )}
              </div>
            </div>
            {/* 新增主题 */}
            <div className="flex gap-2 items-center">
              <Input value={newSubjectText} onChange={e => setNewSubjectText(e.target.value)}
                placeholder={t('newSubjectPlaceholder')} className="text-sm flex-1" />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-shrink-0"
                disabled={!newSubjectText.trim()}
                onClick={() => {
                  const item: SavedSubject = { id: `sj_${Date.now()}`, text: newSubjectText.trim() };
                  const current = host.storage.get<EmailStorageData>('emailData') || {};
                  const subjects = [...(current.savedSubjects || []), item];
                  saveToStorage({ savedSubjects: subjects });
                  setNewSubjectText('');
                  showStatus(t('subjectSaved'));
                }}>
                <Plus className="h-3 w-3" />
                {t('addSubject')}
              </Button>
            </div>
            {/* 已保存的主题列表 */}
            {(() => {
              const subjects = (host.storage.get<EmailStorageData>('emailData') || {}).savedSubjects || [];
              return subjects.length > 0 ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('savedSubjects')}</Label>
                  {subjects.map(s => (
                    <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
                      <button className="flex-1 min-w-0 text-left truncate" onClick={() => {
                        setSubject(s.text);
                        saveToStorage({ subject: s.text });
                        setSubjectsDialogOpen(false);
                      }}>
                        {s.text}
                      </button>
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive flex-shrink-0"
                        onClick={() => {
                          const updated = subjects.filter(x => x.id !== s.id);
                          saveToStorage({ savedSubjects: updated });
                          showStatus(t('deleted'));
                        }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">{t('noSavedSubjects')}</p>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* 模板与片段管理弹窗 */}
      <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
        <DialogContent className="sm:max-w-[960px] max-h-[85vh] overflow-hidden flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>{t('templateAndSnippets')}</DialogTitle>
            <DialogDescription>{t('templateAndSnippetsDesc')}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden">
            <TemplatesAndSnippetsPanel
              stored={stored}
              saveToStorage={saveToStorage}
              showStatus={showStatus}
              editingTemplate={editingTemplate}
              setEditingTemplate={setEditingTemplate}
              editingSnippet={editingSnippet}
              setEditingSnippet={setEditingSnippet}
              setRecipients={setRecipients}
              setCc={setCc}
              setBcc={setBcc}
              setSubject={setSubject}
              setEmailBody={setEmailBody}
              emailBody={emailBody}
              setTemplatesDialogOpen={setTemplatesDialogOpen}
              t={t}
              docTitle={host.content.getDocumentMeta?.()?.title || ''}
              docContent={convertMarkdownToHtml(referenceContent)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV 导入预览对话框 */}
      <Dialog open={csvImportDialogOpen} onOpenChange={setCsvImportDialogOpen}>
        <DialogContent className="sm:max-w-[900px] w-[95vw] h-[85vh] flex flex-col p-0" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
            <DialogTitle>{t('csvImportTitle')}</DialogTitle>
            <DialogDescription>{t('csvImportDesc', { count: csvData.length - 1 })}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-4">
            {/* 列映射 */}
            <div className="flex gap-6 flex-shrink-0">
              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium">{t('csvEmailColumn')} *</Label>
                <Select value={String(csvEmailColumn)} onValueChange={v => setCsvEmailColumn(parseInt(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('csvSelectColumn')} />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-sm font-medium">{t('csvNameColumn')}</Label>
                <Select value={String(csvNameColumn)} onValueChange={v => setCsvNameColumn(parseInt(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('csvSelectColumn')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">{t('csvNone')}</SelectItem>
                    {csvHeaders.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 数据预览 */}
            <div className="flex-1 min-h-0 border rounded-md overflow-auto" style={{ maxHeight: 'calc(85vh - 220px)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    {csvHeaders.map((h, i) => (
                      <th key={i} className={`px-3 py-2 text-left font-medium border-b whitespace-nowrap ${i === csvEmailColumn ? 'bg-blue-500/20' : i === csvNameColumn ? 'bg-green-500/20' : ''}`}>
                        {h}
                        {i === csvEmailColumn && <span className="ml-1 text-blue-600 text-xs">({t('csvEmail')})</span>}
                        {i === csvNameColumn && <span className="ml-1 text-green-600 text-xs">({t('csvName')})</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(1, 21).map((row, ri) => (
                    <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                      {row.map((cell, ci) => (
                        <td key={ci} className={`px-3 py-2 ${ci === csvEmailColumn ? 'bg-blue-500/10' : ci === csvNameColumn ? 'bg-green-500/10' : ''}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvData.length > 21 && (
                <div className="text-sm text-muted-foreground text-center py-3 bg-muted/50 sticky bottom-0">
                  {t('csvMoreRows', { count: csvData.length - 21 })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t flex-shrink-0 bg-muted/30">
            <Button variant="outline" onClick={() => setCsvImportDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCsvImport} disabled={csvEmailColumn < 0}>
              {t('csvImportButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 发送确认对话框 */}
      <Dialog open={sendConfirmDialogOpen} onOpenChange={setSendConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>{t('sendConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('sendConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmFrom')}</span>
              <span className="font-mono truncate">{accounts.find(a => a.id === selectedAccountId)?.email || '-'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmTo')}</span>
              <span className="font-mono break-all">{recipients || '-'}</span>
            </div>
            {cc.trim() && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-16 flex-shrink-0">{t('cc')}</span>
                <span className="font-mono break-all">{cc}</span>
              </div>
            )}
            {bcc.trim() && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-16 flex-shrink-0">{t('bcc')}</span>
                <span className="font-mono break-all">{bcc}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmSubject')}</span>
              <span className="truncate">{subject || '-'}</span>
            </div>
            {attachments.length > 0 && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-16 flex-shrink-0">{t('sendConfirmAttachments')}</span>
                <span>{t('sendConfirmAttCount', { count: attachments.length })}</span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setSendConfirmDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => { setSendConfirmDialogOpen(false); handleSend(); }}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {t('sendConfirmBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 签名管理弹窗 */}
      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[70vh] overflow-y-auto" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{t('manageSignatures')}</DialogTitle>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                onClick={() => setEditingSignature({ id: `sig_${Date.now()}`, name: '', content: '' })}>
                <Plus className="h-3 w-3" />
                {t('newSignature')}
              </Button>
            </div>
            <DialogDescription>{t('signatureDesc')}</DialogDescription>
          </DialogHeader>

          {editingSignature && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/20">
              <div className="space-y-1">
                <Label className="text-xs">{t('signatureName')}</Label>
                <Input value={editingSignature.name}
                  onChange={e => setEditingSignature({ ...editingSignature, name: e.target.value })}
                  placeholder={t('signatureNamePlaceholder')} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('signatureContent')}</Label>
                <textarea value={editingSignature.content}
                  onChange={e => setEditingSignature({ ...editingSignature, content: e.target.value })}
                  placeholder={t('signatureContentPlaceholder')}
                  className="w-full h-24 px-3 py-2 text-sm border rounded-md bg-background resize-none" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingSignature(null)}>{t('cancel')}</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  disabled={!editingSignature.name.trim() || !editingSignature.content.trim()}
                  onClick={() => {
                    const idx = signatures.findIndex(s => s.id === editingSignature.id);
                    const updated = idx >= 0
                      ? signatures.map(s => s.id === editingSignature.id ? editingSignature : s)
                      : [...signatures, editingSignature];
                    setSignatures(updated);
                    saveToStorage({ signatures: updated });
                    setEditingSignature(null);
                    showStatus(t('signatureSaved'));
                  }}>
                  {t('save')}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {signatures.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('noSignaturesYet')}</p>
            ) : signatures.map(sig => (
              <div key={sig.id} className={`flex items-start gap-2 p-2 rounded border text-sm ${sig.id === activeSignatureId ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50 border-transparent'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sig.name}</span>
                    {sig.id === activeSignatureId && <span className="text-xs text-primary">{t('signatureActive')}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2" dangerouslySetInnerHTML={{ __html: sig.content }} />
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {sig.id !== activeSignatureId && (
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs"
                      onClick={() => { setActiveSignatureId(sig.id); saveToStorage({ activeSignatureId: sig.id }); }}>
                      {t('signatureUse')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs"
                    onClick={() => setEditingSignature({ ...sig })}>
                    {t('edit')}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      const updated = signatures.filter(s => s.id !== sig.id);
                      setSignatures(updated);
                      if (activeSignatureId === sig.id) { setActiveSignatureId(''); saveToStorage({ signatures: updated, activeSignatureId: '' }); }
                      else saveToStorage({ signatures: updated });
                    }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── 账户编辑表单（内部组件） ──

function AccountForm({ account, t, onSave, onCancel, onTestConnection }: {
  account: EmailAccount;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSave: (acct: EmailAccount) => void;
  onCancel: () => void;
  onTestConnection?: (acct: EmailAccount) => Promise<void>;
}) {
  const [form, setForm] = useState<EmailAccount>({ ...account });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleProviderChange = (providerId: string) => {
    const preset = EMAIL_PROVIDER_PRESETS.find(p => p.id === providerId);
    setForm(prev => ({
      ...prev,
      provider: providerId,
      smtpHost: preset?.smtpHost || prev.smtpHost,
      smtpPort: preset?.smtpPort || prev.smtpPort,
      encryption: preset?.encryption || prev.encryption,
    }));
  };

  const handleSave = () => {
    if (!form.email.trim()) return;
    if (!form.smtpHost.trim()) return;
    onSave({ ...form, name: form.name || form.email });
  };

  return (
    <div className="border rounded-md p-3 space-y-2.5 bg-background">
      <div className="space-y-1.5">
        <Label className="text-xs">{t('provider')}</Label>
        <Select value={form.provider} onValueChange={handleProviderChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_PROVIDER_PRESETS.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('accountName')}</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={t('accountNamePlaceholder')} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('displayName')}</Label>
          <Input value={form.displayName || ''} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
            placeholder={t('displayNamePlaceholder')} className="h-8 text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('emailAddress')}</Label>
          <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="user@example.com" className="h-8 text-xs font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('password')}</Label>
          <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder={t('passwordPlaceholder')} className="h-8 text-xs font-mono" />
        </div>
      </div>

      {form.provider === 'custom' && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">SMTP {t('host')}</Label>
            <Input value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))}
              placeholder="smtp.example.com" className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('port')}</Label>
            <Input type="number" value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: parseInt(e.target.value) || 465 }))}
              className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('encryption')}</Label>
            <Select value={form.encryption} onValueChange={(v: 'tls' | 'starttls' | 'none') => setForm(f => ({ ...f, encryption: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tls">TLS</SelectItem>
                <SelectItem value="starttls">STARTTLS</SelectItem>
                <SelectItem value="none">{t('noEncryption')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 邮箱格式验证提示 */}
      {form.email.trim() && !isValidEmail(form.email) && (
        <p className="text-xs text-destructive">{t('invalidEmailFormat')}</p>
      )}

      {/* 测试结果 */}
      {testResult && (
        <div className={`text-xs px-2 py-1.5 rounded ${testResult.ok ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {testResult.msg}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>{t('cancel')}</Button>
        {onTestConnection && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
            disabled={!form.email.trim() || !form.smtpHost.trim() || !form.password.trim() || testing}
            onClick={async () => {
              setTesting(true);
              setTestResult(null);
              try {
                await onTestConnection(form);
                setTestResult({ ok: true, msg: t('smtpTestSuccess') });
              } catch (err) {
                setTestResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
              } finally {
                setTesting(false);
              }
            }}>
            {testing ? t('smtpTesting') : t('smtpTestBtn')}
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSave}
          disabled={!form.email.trim() || !form.smtpHost.trim() || !form.password.trim()}>
          {t('saveAccount')}
        </Button>
      </div>
    </div>
  );
}

// ── 模板与片段统一管理面板 ──

function TemplatesAndSnippetsPanel({
  stored,
  saveToStorage,
  showStatus,
  editingTemplate,
  setEditingTemplate,
  editingSnippet,
  setEditingSnippet,
  setRecipients,
  setCc,
  setBcc,
  setSubject,
  setEmailBody,
  emailBody,
  setTemplatesDialogOpen,
  t,
  docTitle,
  docContent,
}: {
  stored: EmailStorageData;
  saveToStorage: (updates: Partial<EmailStorageData>) => void;
  showStatus: (msg: string, isError?: boolean) => void;
  editingTemplate: SubmissionTemplate | null;
  setEditingTemplate: (t: SubmissionTemplate | null) => void;
  editingSnippet: TextSnippet | null;
  setEditingSnippet: (s: TextSnippet | null) => void;
  setRecipients: (v: string) => void;
  setCc: (v: string) => void;
  setBcc: (v: string) => void;
  setSubject: (v: string) => void;
  setEmailBody: (v: string) => void;
  emailBody: string;
  setTemplatesDialogOpen: (v: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  docTitle: string;
  docContent: string;
}) {
  const templates: SubmissionTemplate[] = stored.submissionTemplates || [];
  const userSnippets: TextSnippet[] = stored.textSnippets || [];
  const presetSnippets = getPresetSnippets(t);
  const allSnippets = [...presetSnippets, ...userSnippets];

  // ── 模板操作 ──
  const handleNewTemplate = () => {
    setEditingSnippet(null);
    setEditingTemplate({
      id: `tpl_${Date.now()}`,
      name: '',
      recipients: [],
      subjectTemplate: '',
      bodyTemplate: '',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate || !editingTemplate.name.trim()) {
      showStatus(t('pleaseEnterTemplateName'), true);
      return;
    }
    const updated = templates.find(x => x.id === editingTemplate.id)
      ? templates.map(x => x.id === editingTemplate.id ? { ...editingTemplate, updatedAt: Date.now() } : x)
      : [...templates, editingTemplate];
    saveToStorage({ submissionTemplates: updated });
    setEditingTemplate(null);
    showStatus(t('templateSaved'));
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = templates.filter(x => x.id !== id);
    saveToStorage({ submissionTemplates: updated });
    if (editingTemplate?.id === id) setEditingTemplate(null);
    showStatus(t('templateDeleted'));
  };

  const handleUseTemplate = (tpl: SubmissionTemplate) => {
    const context = { title: docTitle, content: docContent, date: getCurrentDateString() };
    const processedSubject = replaceVariables(tpl.subjectTemplate, tpl.variables, context);
    const processedBody = replaceVariables(tpl.bodyTemplate, tpl.variables, context);
    setRecipients(tpl.recipients.join(', '));
    setCc((tpl.cc || []).join(', '));
    setBcc((tpl.bcc || []).join(', '));
    setSubject(processedSubject);
    setEmailBody(processedBody);
    saveToStorage({
      recipients: tpl.recipients, cc: tpl.cc || [], bcc: tpl.bcc || [],
      subject: processedSubject, emailBody: processedBody,
    });
    setTemplatesDialogOpen(false);
    showStatus(t('templateApplied'));
  };

  // ── 片段操作 ──
  const handleNewSnippet = () => {
    setEditingTemplate(null);
    setEditingSnippet({
      id: `snippet_${Date.now()}`,
      name: '',
      content: '',
      category: '',
    });
  };

  const handleSaveSnippet = () => {
    if (!editingSnippet || !editingSnippet.name.trim()) {
      showStatus(t('pleaseEnterName'), true);
      return;
    }
    const updated = userSnippets.find(s => s.id === editingSnippet.id)
      ? userSnippets.map(s => s.id === editingSnippet.id ? editingSnippet : s)
      : [...userSnippets, editingSnippet];
    saveToStorage({ textSnippets: updated });
    setEditingSnippet(null);
    showStatus(t('snippetSaved'));
  };

  const handleDeleteSnippet = (id: string) => {
    if (presetSnippets.find((s: TextSnippet) => s.id === id)) {
      showStatus(t('cannotDeletePreset'), true);
      return;
    }
    const updated = userSnippets.filter(s => s.id !== id);
    saveToStorage({ textSnippets: updated });
    if (editingSnippet?.id === id) setEditingSnippet(null);
    showStatus(t('snippetDeleted'));
  };

  const handleInsertSnippet = (content: string) => {
    setEmailBody(emailBody + content);
    saveToStorage({ emailBody: emailBody + content });
    showStatus(t('snippetInserted'));
  };

  // 所有变量（预置+自定义）
  const getAllVariables = (tpl: SubmissionTemplate) => {
    return [...getPresetVariables(t), ...tpl.variables];
  };

  return (
    <div className="flex gap-3 h-full min-h-[420px]">
      {/* 左侧：统一列表 */}
      <div className="w-[280px] flex-shrink-0 border rounded-md overflow-hidden flex flex-col">
        {/* 投稿模板分组 */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">{t('templates')}</span>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={handleNewTemplate}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="overflow-y-auto max-h-[40%]">
          {templates.length > 0 ? templates.map(tpl => (
            <div key={tpl.id}
              className={`flex items-center justify-between px-3 py-1.5 border-b cursor-pointer hover:bg-muted/50 text-sm ${editingTemplate?.id === tpl.id ? 'bg-accent/50' : ''}`}
              onClick={() => { setEditingSnippet(null); setEditingTemplate({ ...tpl }); }}>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate">{tpl.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{tpl.recipients.join(', ') || t('noRecipients')}</div>
              </div>
              <div className="flex gap-0.5 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={(e) => { e.stopPropagation(); handleUseTemplate(tpl); }}>
                  {t('use')}
                </Button>
                <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}>
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </div>
            </div>
          )) : (
            <div className="text-[10px] text-muted-foreground text-center py-3">{t('noTemplates')}</div>
          )}
        </div>

        {/* 文本片段分组 */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-t bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">{t('textSnippets')}</span>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={handleNewSnippet}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {allSnippets.map(s => (
            <div key={s.id}
              className={`flex items-center justify-between px-3 py-1.5 border-b cursor-pointer hover:bg-muted/50 ${editingSnippet?.id === s.id ? 'bg-accent/50' : ''}`}
              onClick={() => { setEditingTemplate(null); setEditingSnippet({ ...s }); }}>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate">
                  {s.name}
                  {s.category && <span className="ml-1 text-[10px] text-muted-foreground">({s.category})</span>}
                </div>
              </div>
              <div className="flex gap-0.5 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={(e) => { e.stopPropagation(); handleInsertSnippet(s.content); }}>
                  {t('insert')}
                </Button>
                {!presetSnippets.find((p: TextSnippet) => p.id === s.id) && (
                  <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteSnippet(s.id); }}>
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：编辑区 */}
      <div className="flex-1 border rounded-md overflow-hidden flex flex-col">
        {editingTemplate ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            <div className="space-y-1">
              <Label className="text-xs">{t('templateName')} *</Label>
              <Input value={editingTemplate.name} onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} placeholder={t('templateNamePlaceholder')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('templateDescription')}</Label>
              <Input value={editingTemplate.description || ''} onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })} placeholder={t('descriptionPlaceholder')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('recipients')}</Label>
              <Input value={editingTemplate.recipients.join(', ')} onChange={e => setEditingTemplate({ ...editingTemplate, recipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder={t('recipientsPlaceholder')} className="h-8 text-sm font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('cc')}</Label>
                <Input value={(editingTemplate.cc || []).join(', ')} onChange={e => setEditingTemplate({ ...editingTemplate, cc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder={t('ccPlaceholder')} className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('bcc')}</Label>
                <Input value={(editingTemplate.bcc || []).join(', ')} onChange={e => setEditingTemplate({ ...editingTemplate, bcc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder={t('bccPlaceholder')} className="h-8 text-sm font-mono" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('subjectTemplate')}</Label>
              <div className="flex gap-2">
                <Input value={editingTemplate.subjectTemplate} onChange={e => setEditingTemplate({ ...editingTemplate, subjectTemplate: e.target.value })} placeholder={t('subjectTemplatePlaceholder')} className="h-8 text-sm flex-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">{t('insertVar')}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {getAllVariables(editingTemplate).map((v: VariableDef) => {
                      const varStr = '{{' + v.name + '}}';
                      return (
                        <DropdownMenuItem key={v.name} onClick={() => setEditingTemplate({ ...editingTemplate, subjectTemplate: editingTemplate.subjectTemplate + varStr })}>
                          {v.label} ({varStr})
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('bodyTemplate')}</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 text-[10px]">{t('insertVar')}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {getAllVariables(editingTemplate).map((v: VariableDef) => {
                      const varStr = '{{' + v.name + '}}';
                      return (
                        <DropdownMenuItem key={v.name} onClick={() => setEditingTemplate({ ...editingTemplate, bodyTemplate: editingTemplate.bodyTemplate + varStr })}>
                          {v.label} ({varStr})
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <textarea
                value={editingTemplate.bodyTemplate}
                onChange={e => setEditingTemplate({ ...editingTemplate, bodyTemplate: e.target.value })}
                placeholder={t('bodyTemplatePlaceholder')}
                className="w-full h-[140px] p-2 text-sm border rounded-md resize-none font-mono"
              />
            </div>
            {/* 自定义变量管理 */}
            <div className="space-y-1.5 border rounded-md p-2.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{t('customVariables')}</Label>
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={() => {
                  const newVar: VariableDef = { name: `var_${Date.now()}`, label: '', defaultValue: '', source: 'user' };
                  setEditingTemplate({ ...editingTemplate, variables: [...editingTemplate.variables, newVar] });
                }}>
                  <Plus className="h-3 w-3 mr-0.5" />{t('addVariable')}
                </Button>
              </div>
              {/* 预置变量（只读） */}
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground">{t('presetVariables')}</div>
                <div className="flex flex-wrap gap-1">
                  {getPresetVariables(t).map(v => (
                    <span key={v.name} className="text-[10px] px-1.5 py-0.5 bg-muted rounded border">
                      {v.label} <code className="text-primary">{`{{${v.name}}}`}</code>
                    </span>
                  ))}
                </div>
              </div>
              {/* 自定义变量列表 */}
              {editingTemplate.variables.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] text-muted-foreground">{t('customVariablesList')}</div>
                  {editingTemplate.variables.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Input value={v.name} onChange={e => {
                        const vars = [...editingTemplate.variables];
                        vars[idx] = { ...v, name: e.target.value.replace(/\s/g, '_') };
                        setEditingTemplate({ ...editingTemplate, variables: vars });
                      }} placeholder={t('varName')} className="h-7 text-xs w-[100px] font-mono" />
                      <Input value={v.label} onChange={e => {
                        const vars = [...editingTemplate.variables];
                        vars[idx] = { ...v, label: e.target.value };
                        setEditingTemplate({ ...editingTemplate, variables: vars });
                      }} placeholder={t('varLabel')} className="h-7 text-xs flex-1" />
                      <Input value={v.defaultValue || ''} onChange={e => {
                        const vars = [...editingTemplate.variables];
                        vars[idx] = { ...v, defaultValue: e.target.value };
                        setEditingTemplate({ ...editingTemplate, variables: vars });
                      }} placeholder={t('varDefaultValue')} className="h-7 text-xs flex-1" />
                      <Button variant="ghost" size="sm" className="h-7 px-1 text-destructive hover:text-destructive" onClick={() => {
                        const vars = editingTemplate.variables.filter((_, i) => i !== idx);
                        setEditingTemplate({ ...editingTemplate, variables: vars });
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* sticky 保存按钮 */}
            <div className="flex justify-end gap-2 pt-1 sticky bottom-0 bg-background py-2 border-t -mx-3 px-3 -mb-3">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingTemplate(null)}>{t('cancel')}</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSaveTemplate} disabled={!editingTemplate.name.trim()}>{t('save')}</Button>
            </div>
          </div>
        ) : editingSnippet ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            <div className="space-y-1">
              <Label className="text-xs">{t('snippetName')} *</Label>
              <Input value={editingSnippet.name} onChange={e => setEditingSnippet({ ...editingSnippet, name: e.target.value })} placeholder={t('snippetNamePlaceholder')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('category')}</Label>
              <Input value={editingSnippet.category || ''} onChange={e => setEditingSnippet({ ...editingSnippet, category: e.target.value })} placeholder={t('categoryPlaceholder')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('content')}</Label>
              <textarea
                value={editingSnippet.content}
                onChange={e => setEditingSnippet({ ...editingSnippet, content: e.target.value })}
                placeholder={t('snippetContentPlaceholder')}
                className="w-full h-[200px] p-2 text-sm border rounded-md resize-none font-mono"
              />
              <p className="text-xs text-muted-foreground">{t('snippetContentHint')}</p>
            </div>
            {/* sticky 保存按钮 */}
            <div className="flex justify-end gap-2 pt-1 sticky bottom-0 bg-background py-2 border-t -mx-3 px-3 -mb-3">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingSnippet(null)}>{t('cancel')}</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleInsertSnippet(editingSnippet.content)}>{t('insertToBody')}</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSaveSnippet} disabled={!editingSnippet.name.trim()}>{t('save')}</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('selectOrCreateItem')}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 联系人列表组件 ──
function ContactListSection({
  host,
  saveToStorage,
  showStatus,
  selectedContactIds,
  setSelectedContactIds,
  setEditingContact,
  searchText,
  groupFilter,
  t,
}: {
  host: ReturnType<typeof usePluginHost>;
  saveToStorage: (data: Partial<EmailStorageData>) => void;
  showStatus: (msg: string, isError?: boolean) => void;
  selectedContactIds: Set<string>;
  setSelectedContactIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditingContact: React.Dispatch<React.SetStateAction<Contact | null>>;
  searchText: string;
  groupFilter: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const allContacts: Contact[] = (host.storage.get<EmailStorageData>('emailData') || {}).contacts || [];
  const groups: ContactGroup[] = (host.storage.get<EmailStorageData>('emailData') || {}).contactGroups || [];

  // 分组 + 搜索过滤
  let contacts = allContacts;
  if (groupFilter) {
    contacts = contacts.filter(c => c.groupId === groupFilter);
  }
  if (searchText.trim()) {
    const query = searchText.toLowerCase();
    contacts = contacts.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.note || '').toLowerCase().includes(query) ||
      (c.extraFields && Object.values(c.extraFields).some(v => v.toLowerCase().includes(query)))
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* 联系人数量 */}
      {allContacts.length > 0 && (
        <div className="px-3 py-1 border-b flex-shrink-0 bg-muted/30 text-xs text-muted-foreground">
          {searchText.trim() ? (
            <>{t('contactFoundCount', { found: contacts.length, total: allContacts.length })}</>
          ) : (
            <>{t('contactTotalCount', { total: allContacts.length })}</>
          )}
        </div>
      )}

      {/* 联系人列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 p-1">
        {contacts.length > 0 ? (
          contacts.map(c => (
            <div
              key={c.id}
              className={`flex items-start gap-2 px-3 py-2 rounded cursor-pointer text-sm border ${
                selectedContactIds.has(c.id)
                  ? 'bg-pink-500/10 border-pink-500/30'
                  : 'hover:bg-muted/50 border-transparent'
              }`}
              onClick={() => {
                setSelectedContactIds(prev => {
                  const next = new Set(prev);
                  next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                  return next;
                });
              }}
            >
              <input
                type="checkbox"
                checked={selectedContactIds.has(c.id)}
                readOnly
                className="h-4 w-4 rounded border-gray-300 flex-shrink-0 mt-0.5 pointer-events-none"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name || t('contactUnnamed')}</span>
                  <span className="text-xs text-muted-foreground font-mono">{c.email}</span>
                  {c.groupId && (() => {
                    const grp = groups.find(g => g.id === c.groupId);
                    if (!grp) return null;
                    return <span className="text-[10px] px-1.5 py-0 rounded-full border" style={grp.color ? { borderColor: grp.color, color: grp.color } : {}}>{grp.name}</span>;
                  })()}
                </div>
                {c.note && <div className="text-xs text-muted-foreground mt-0.5">{c.note}</div>}
                {c.extraFields && Object.keys(c.extraFields).length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {Object.entries(c.extraFields).map(
                      ([key, value]) =>
                        value && (
                          <span key={key}>
                            <span className="font-medium">{key}:</span> {value}
                          </span>
                        )
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs flex-shrink-0"
                onClick={e => {
                  e.stopPropagation();
                  setEditingContact({ ...c });
                }}
              >
                {t('edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-destructive hover:text-destructive flex-shrink-0"
                onClick={e => {
                  e.stopPropagation();
                  const current = host.storage.get<EmailStorageData>('emailData') || {};
                  const updated = (current.contacts || []).filter(x => x.id !== c.id);
                  saveToStorage({ contacts: updated });
                  setSelectedContactIds(prev => {
                    const next = new Set(prev);
                    next.delete(c.id);
                    return next;
                  });
                  showStatus(t('contactDeleted'));
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        ) : searchText.trim() ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('noContactsFound')}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('noContactsYet')}
          </p>
        )}
      </div>
    </div>
  );
}
