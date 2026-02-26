import { useState, useCallback, useRef, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { AIContentDialog } from '../_framework/AIContentDialog';
import {
  Button, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../_framework/ui';
import { EMAIL_PROVIDER_PRESETS } from '@aidocplus/shared-types';
import type { EmailProviderPreset } from '@aidocplus/shared-types';
import { Mail, Send, Loader2, Wand2, Trash2, Plus, Settings, FileText, History, ChevronDown, ChevronUp, Users, Bookmark, Newspaper, FileUp } from 'lucide-react';
import { EmailBodyEditor } from './EmailBodyEditor';
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
  // 额外字段（如机构、电话、地址等，从 CSV 导入保留）
  extraFields?: Record<string, string>;
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
const PRESET_VARIABLES: VariableDef[] = [
  { name: 'title', label: '文章标题', source: 'document' },
  { name: 'content', label: '文章正文', source: 'document' },
  { name: 'date', label: '日期', source: 'document' },
];

// 预置文本片段
const PRESET_SNIPPETS: TextSnippet[] = [
  { id: 'greeting_formal', name: '问候语-正式', category: '问候', content: '尊敬的编辑您好：' },
  { id: 'greeting_general', name: '问候语-通用', category: '问候', content: '您好：' },
  { id: 'closing_formal', name: '结尾语-正式', category: '结尾', content: '此致<br/>敬礼' },
  { id: 'closing_await', name: '结尾语-期待回复', category: '结尾', content: '期待您的回复，谢谢！' },
];

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

interface EmailStorageData {
  accounts?: EmailAccount[];
  activeAccountId?: string;
  recipients?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  emailBody?: string;
  sendAsHtml?: boolean;
  contacts?: Contact[];
  savedSubjects?: SavedSubject[];
  submissionTemplates?: SubmissionTemplate[];
  textSnippets?: TextSnippet[];
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

const SYSTEM_PROMPT = '你是一位专业的邮件撰写助手。根据用户提供的文档内容和要求，撰写一封结构清晰、语言得体的邮件正文。只输出邮件正文内容，不要包含主题行、发件人、收件人等信息。';

const EMAIL_STYLES = [
  { label: '正式商务', prompt: '根据本文档的正文内容，撰写一封正式的商务邮件正文，语言专业、措辞严谨、结构清晰。' },
  { label: '简洁通知', prompt: '根据本文档的正文内容，撰写一封简洁的通知邮件正文，突出关键信息，控制在200字以内。' },
  { label: '详细报告', prompt: '根据本文档的正文内容，撰写一封详细的报告邮件正文，包含背景、主要内容、结论和建议。' },
  { label: '学术交流', prompt: '根据本文档的正文内容，撰写一封学术交流邮件正文，语言规范、逻辑严密、引用准确。' },
  { label: '轻松友好', prompt: '根据本文档的正文内容，撰写一封轻松友好的邮件正文，语气亲切自然。' },
];

const DEFAULT_PROMPT = '根据本文档的正文内容，撰写一封简洁明了的邮件正文，概括文档的核心内容。';

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
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
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
  const [sending, setSending] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [recipientsDialogOpen, setRecipientsDialogOpen] = useState(false);
  const [subjectsDialogOpen, setSubjectsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSearchText, setContactSearchText] = useState('');
  const [clearContactsDialogOpen, setClearContactsDialogOpen] = useState(false);
  const [newSubjectText, setNewSubjectText] = useState('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyPreviewIdx, setHistoryPreviewIdx] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── 投稿模板状态 ──
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SubmissionTemplate | null>(null);
  const [editingSnippet, setEditingSnippet] = useState<TextSnippet | null>(null);
  const [templateDialogTab, setTemplateDialogTab] = useState<'templates' | 'snippets'>('templates');

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

  // ── 邮件操作 ──
  const handleAIGenerated = useCallback((content: string) => {
    // AI 生成的内容通常是 Markdown，自动转换为 HTML
    const html = looksLikeMarkdown(content) ? convertMarkdownToHtml(content) : content;
    setEmailBody(html);
    saveToStorage({ emailBody: html });
    showStatus(t('generateSuccess'));
  }, [saveToStorage, showStatus, t]);

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

      const result = await host.platform.invoke<string>('send_email', {
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
        encryption: account.encryption,
        email: account.email,
        password: account.password,
        displayName: account.displayName || undefined,
        to: toList, cc: ccList, bcc: bccList,
        subject: subject.trim(),
        body: emailBody,
        isHtml: true,
        isRawHtml: true,
      });

      const historyEntry = {
        timestamp: Date.now(), to: toList, cc: ccList.length ? ccList : undefined, bcc: bccList.length ? bccList : undefined,
        subject: subject.trim(), body: emailBody, accountId: account.id, accountEmail: account.email,
        status: 'success' as const, statusMsg: result,
      };
      const history = [historyEntry, ...sendHistory];
      if (history.length > 50) history.length = 50;
      saveToStorage({ emailBody, recipients: toList, cc: ccList, bcc: bccList, subject: subject.trim(), sendHistory: history });
      appendLog(result, 'success');
      showStatus(result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
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
          <Button variant="outline" size="sm" onClick={handleSend}
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

          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setAiDialogOpen(true)}>
            <Wand2 className="h-3 w-3" />
            {t('aiGenerate')}
          </Button>

          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setTemplatesDialogOpen(true)}>
            <Newspaper className="h-3 w-3" />
            {t('submissionTemplate')}
          </Button>

          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => {
              setRecipients(''); setCc(''); setBcc(''); setSubject(''); setEmailBody('');
              saveToStorage({ recipients: [], cc: [], bcc: [], subject: '', emailBody: '' });
              showStatus('已清空');
            }}>
            <Trash2 className="h-3 w-3" />
            清空
          </Button>

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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs flex-shrink-0"
                onClick={() => setRecipientsDialogOpen(true)}>
                <Users className="h-3 w-3" />
                {t('to')}
              </Button>
              <Input value={recipients}
                onChange={(e) => { setRecipients(e.target.value); saveToStorage({ recipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }); }}
                placeholder={t('toPlaceholder')} className="font-mono text-sm flex-1" />
              <button
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                {showCcBcc ? '隐藏抄送' : '抄送/密送'}
              </button>
            </div>

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

          {/* ── 正文编辑框（撑满剩余空间） ── */}
          <div className="flex-1 min-h-0 flex flex-col">
            <EmailBodyEditor
              value={emailBody}
              onChange={(html) => { setEmailBody(html); saveToStorage({ emailBody: html }); }}
              placeholder={t('bodyPlaceholder')}
              t={t}
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

      <AIContentDialog
        open={aiDialogOpen} onOpenChange={setAiDialogOpen}
        title={t('aiGenerate')} description={t('promptBuilderDesc')}
        systemPrompt={SYSTEM_PROMPT} referenceContent={referenceContent}
        onGenerated={handleAIGenerated} presetPrompts={EMAIL_STYLES}
        defaultPrompt={DEFAULT_PROMPT} maxTokens={4096}
      />

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
              <DialogTitle>联系人管理</DialogTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                  onClick={handleCsvFileSelect}>
                  <FileUp className="h-3 w-3" />
                  {t('importCsv')}
                </Button>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                  onClick={() => setEditingContact({ id: `ct_${Date.now()}`, name: '', email: '', note: '' })}>
                  <Plus className="h-3 w-3" />
                  新建联系人
                </Button>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    const current = host.storage.get<EmailStorageData>('emailData') || {};
                    if ((current.contacts || []).length === 0) return;
                    setClearContactsDialogOpen(true);
                  }}>
                  <Trash2 className="h-3 w-3" />
                  清除全部
                </Button>
              </div>
            </div>
            <DialogDescription>勾选联系人后点击"使用所选"填入收件人</DialogDescription>
          </DialogHeader>

          {/* 搜索框 */}
          <div className="flex-shrink-0">
            <Input
              placeholder="搜索联系人（姓名、邮箱、备注）..."
              value={contactSearchText}
              onChange={e => setContactSearchText(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* 联系人编辑表单 */}
          {editingContact && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/20 flex-shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">称呼</Label>
                  <Input value={editingContact.name}
                    onChange={e => setEditingContact({ ...editingContact, name: e.target.value })}
                    placeholder="如：张三" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">邮箱</Label>
                  <Input value={editingContact.email}
                    onChange={e => setEditingContact({ ...editingContact, email: e.target.value })}
                    placeholder="user@example.com" className="h-8 text-sm font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">备注</Label>
                <Input value={editingContact.note || ''}
                  onChange={e => setEditingContact({ ...editingContact, note: e.target.value })}
                  placeholder="可选备注" className="h-8 text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingContact(null)}>取消</Button>
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
                    showStatus('已保存联系人');
                  }}>
                  保存
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
          />

          {/* 底部操作 */}
          <div className="flex items-center justify-between pt-2 border-t flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              已选 {selectedContactIds.size} 位联系人
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
              使用所选
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 清除联系人确认对话框 */}
      <Dialog open={clearContactsDialogOpen} onOpenChange={setClearContactsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>确认清除</DialogTitle>
            <DialogDescription>
              确定要清除所有联系人吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setClearContactsDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                saveToStorage({ contacts: [] });
                setSelectedContactIds(new Set());
                setClearContactsDialogOpen(false);
                showStatus('已清除所有联系人');
              }}
            >
              确认清除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 主题管理弹窗 */}
      <Dialog open={subjectsDialogOpen} onOpenChange={setSubjectsDialogOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[70vh] overflow-y-auto" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>主题管理</DialogTitle>
            <DialogDescription>保存常用邮件主题，方便快速选用</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* 当前主题 + 保存按钮 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">当前主题</Label>
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
                      showStatus('已保存主题');
                    }}>
                    <Plus className="h-3 w-3" />
                    保存
                  </Button>
                )}
              </div>
            </div>
            {/* 新增主题 */}
            <div className="flex gap-2 items-center">
              <Input value={newSubjectText} onChange={e => setNewSubjectText(e.target.value)}
                placeholder="输入新主题模板" className="text-sm flex-1" />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-shrink-0"
                disabled={!newSubjectText.trim()}
                onClick={() => {
                  const item: SavedSubject = { id: `sj_${Date.now()}`, text: newSubjectText.trim() };
                  const current = host.storage.get<EmailStorageData>('emailData') || {};
                  const subjects = [...(current.savedSubjects || []), item];
                  saveToStorage({ savedSubjects: subjects });
                  setNewSubjectText('');
                  showStatus('已保存主题');
                }}>
                <Plus className="h-3 w-3" />
                添加
              </Button>
            </div>
            {/* 已保存的主题列表 */}
            {(() => {
              const subjects = (host.storage.get<EmailStorageData>('emailData') || {}).savedSubjects || [];
              return subjects.length > 0 ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">已保存的主题</Label>
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
                          showStatus('已删除');
                        }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">暂无保存的主题</p>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* 投稿模板管理弹窗 */}
      <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>{t('submissionTemplate')}</DialogTitle>
            <DialogDescription>{t('submissionTemplateDesc')}</DialogDescription>
          </DialogHeader>

          {/* 选项卡 */}
          <div className="flex border-b flex-shrink-0">
            <button
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${templateDialogTab === 'templates' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTemplateDialogTab('templates')}>
              {t('templates')}
            </button>
            <button
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${templateDialogTab === 'snippets' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTemplateDialogTab('snippets')}>
              {t('textSnippets')}
            </button>
          </div>

          {/* 选项卡内容 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {templateDialogTab === 'templates' ? (
              <SubmissionTemplatesTab
                stored={stored}
                saveToStorage={saveToStorage}
                showStatus={showStatus}
                editingTemplate={editingTemplate}
                setEditingTemplate={setEditingTemplate}
                setRecipients={setRecipients}
                setCc={setCc}
                setBcc={setBcc}
                setSubject={setSubject}
                setEmailBody={setEmailBody}
                setTemplatesDialogOpen={setTemplatesDialogOpen}
                t={t}
                docTitle={host.content.getDocumentMeta?.()?.title || ''}
                docContent={convertMarkdownToHtml(referenceContent)}
              />
            ) : (
              <TextSnippetsTab
                stored={stored}
                saveToStorage={saveToStorage}
                showStatus={showStatus}
                editingSnippet={editingSnippet}
                setEditingSnippet={setEditingSnippet}
                t={t}
              />
            )}
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
    </>
  );
}

// ── 账户编辑表单（内部组件） ──

function AccountForm({ account, t, onSave, onCancel }: {
  account: EmailAccount;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSave: (acct: EmailAccount) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EmailAccount>({ ...account });

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

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>{t('cancel')}</Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSave}
          disabled={!form.email.trim() || !form.smtpHost.trim() || !form.password.trim()}>
          {t('saveAccount')}
        </Button>
      </div>
    </div>
  );
}

// ── 投稿模板选项卡组件 ──

function SubmissionTemplatesTab({
  stored,
  saveToStorage,
  showStatus,
  editingTemplate,
  setEditingTemplate,
  setRecipients,
  setCc,
  setBcc,
  setSubject,
  setEmailBody,
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
  setRecipients: (v: string) => void;
  setCc: (v: string) => void;
  setBcc: (v: string) => void;
  setSubject: (v: string) => void;
  setEmailBody: (v: string) => void;
  setTemplatesDialogOpen: (v: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  docTitle: string;
  docContent: string;
}) {
  const templates: SubmissionTemplate[] = stored.submissionTemplates || [];

  const handleNewTemplate = () => {
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
      showStatus('请输入模板名称', true);
      return;
    }
    const updated = templates.find(t => t.id === editingTemplate.id)
      ? templates.map(t => t.id === editingTemplate.id ? { ...editingTemplate, updatedAt: Date.now() } : t)
      : [...templates, editingTemplate];
    saveToStorage({ submissionTemplates: updated });
    setEditingTemplate(null);
    showStatus(t('templateSaved'));
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    saveToStorage({ submissionTemplates: updated });
    showStatus(t('templateDeleted'));
  };

  const handleUseTemplate = (tpl: SubmissionTemplate) => {
    // 准备变量上下文
    const context = {
      title: docTitle,
      content: docContent,
      date: getCurrentDateString(),
    };

    // 替换变量
    const processedSubject = replaceVariables(tpl.subjectTemplate, tpl.variables, context);
    const processedBody = replaceVariables(tpl.bodyTemplate, tpl.variables, context);

    // 填充收件人
    setRecipients(tpl.recipients.join(', '));
    setCc((tpl.cc || []).join(', '));
    setBcc((tpl.bcc || []).join(', '));
    setSubject(processedSubject);
    setEmailBody(processedBody);
    saveToStorage({
      recipients: tpl.recipients,
      cc: tpl.cc || [],
      bcc: tpl.bcc || [],
      subject: processedSubject,
      emailBody: processedBody,
    });
    setTemplatesDialogOpen(false);
    showStatus(t('templateApplied'));
  };

  return (
    <div className="flex gap-4 h-full min-h-[400px]">
      {/* 左侧：模板列表 */}
      <div className="w-1/3 border rounded-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <span className="text-sm font-medium">{t('templateList')}</span>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={handleNewTemplate}>
            <Plus className="h-3 w-3" />
            {t('newTemplate')}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {templates.length > 0 ? templates.map(tpl => (
            <div key={tpl.id}
              className={`flex items-center justify-between px-3 py-2 border-b cursor-pointer hover:bg-muted/50 ${editingTemplate?.id === tpl.id ? 'bg-accent/50' : ''}`}
              onClick={() => setEditingTemplate({ ...tpl })}>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{tpl.name}</div>
                <div className="text-xs text-muted-foreground truncate">{tpl.recipients.join(', ')}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={(e) => { e.stopPropagation(); handleUseTemplate(tpl); }}>
                  {t('use')}
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )) : (
            <div className="text-xs text-muted-foreground text-center py-8">{t('noTemplates')}</div>
          )}
        </div>
      </div>

      {/* 右侧：编辑区 */}
      <div className="flex-1 border rounded-md overflow-y-auto">
        {editingTemplate ? (
          <div className="p-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('templateName')} *</Label>
              <Input value={editingTemplate.name} onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} placeholder={t('templateNamePlaceholder')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('description')}</Label>
              <Input value={editingTemplate.description || ''} onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })} placeholder={t('descriptionPlaceholder')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('recipients')} *</Label>
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
                    {PRESET_VARIABLES.map(v => {
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
              <p className="text-xs text-muted-foreground">{t('subjectTemplateHint')}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('bodyTemplate')}</Label>
              <textarea
                value={editingTemplate.bodyTemplate}
                onChange={e => setEditingTemplate({ ...editingTemplate, bodyTemplate: e.target.value })}
                placeholder={t('bodyTemplatePlaceholder')}
                className="w-full h-[200px] p-2 text-sm border rounded-md resize-none font-mono"
              />
              <p className="text-xs text-muted-foreground">{t('bodyTemplateHint')}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingTemplate(null)}>{t('cancel')}</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSaveTemplate}>{t('save')}</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('selectOrCreateTemplate')}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 文本片段选项卡组件 ──

function TextSnippetsTab({
  stored,
  saveToStorage,
  showStatus,
  editingSnippet,
  setEditingSnippet,
  t,
}: {
  stored: EmailStorageData;
  saveToStorage: (updates: Partial<EmailStorageData>) => void;
  showStatus: (msg: string, isError?: boolean) => void;
  editingSnippet: TextSnippet | null;
  setEditingSnippet: (s: TextSnippet | null) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const userSnippets: TextSnippet[] = stored.textSnippets || [];
  const allSnippets = [...PRESET_SNIPPETS, ...userSnippets];

  // 按分类分组
  const groupedSnippets: Record<string, TextSnippet[]> = {};
  for (const s of allSnippets) {
    const cat = s.category || t('uncategorized');
    if (!groupedSnippets[cat]) groupedSnippets[cat] = [];
    groupedSnippets[cat].push(s);
  }

  const handleNewSnippet = () => {
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
    // 不能删除预置片段
    if (PRESET_SNIPPETS.find(s => s.id === id)) {
      showStatus(t('cannotDeletePreset'), true);
      return;
    }
    const updated = userSnippets.filter(s => s.id !== id);
    saveToStorage({ textSnippets: updated });
    showStatus(t('snippetDeleted'));
  };

  const handleCopySnippet = (content: string) => {
    navigator.clipboard.writeText(content);
    showStatus(t('copied'));
  };

  return (
    <div className="flex gap-4 h-full min-h-[400px]">
      {/* 左侧：片段列表 */}
      <div className="w-1/3 border rounded-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <span className="text-sm font-medium">{t('snippetList')}</span>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={handleNewSnippet}>
            <Plus className="h-3 w-3" />
            {t('newSnippet')}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {Object.entries(groupedSnippets).map(([category, snippets]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">{category}</div>
              {snippets.map(s => (
                <div key={s.id}
                  className={`flex items-center justify-between px-3 py-2 border-b cursor-pointer hover:bg-muted/50 ${editingSnippet?.id === s.id ? 'bg-accent/50' : ''}`}
                  onClick={() => setEditingSnippet({ ...s })}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.content.replace(/<br\/>/g, ' ').slice(0, 30)}...</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={(e) => { e.stopPropagation(); handleCopySnippet(s.content); }}>
                      {t('copy')}
                    </Button>
                    {!PRESET_SNIPPETS.find(p => p.id === s.id) && (
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteSnippet(s.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：编辑区 */}
      <div className="flex-1 border rounded-md overflow-y-auto">
        {editingSnippet ? (
          <div className="p-3 space-y-3">
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
                className="w-full h-[150px] p-2 text-sm border rounded-md resize-none font-mono"
              />
              <p className="text-xs text-muted-foreground">{t('snippetContentHint')}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingSnippet(null)}>{t('cancel')}</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSaveSnippet} disabled={!editingSnippet.name.trim()}>{t('save')}</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('selectOrCreateSnippet')}
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
}: {
  host: ReturnType<typeof usePluginHost>;
  saveToStorage: (data: Partial<EmailStorageData>) => void;
  showStatus: (msg: string, isError?: boolean) => void;
  selectedContactIds: Set<string>;
  setSelectedContactIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditingContact: React.Dispatch<React.SetStateAction<Contact | null>>;
  searchText: string;
}) {
  const allContacts: Contact[] = (host.storage.get<EmailStorageData>('emailData') || {}).contacts || [];

  // 搜索过滤
  const contacts = searchText.trim()
    ? allContacts.filter(c => {
        const query = searchText.toLowerCase();
        return (
          c.name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          (c.note || '').toLowerCase().includes(query) ||
          (c.extraFields && Object.values(c.extraFields).some(v => v.toLowerCase().includes(query)))
        );
      })
    : allContacts;

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* 联系人数量 */}
      {allContacts.length > 0 && (
        <div className="px-3 py-1 border-b flex-shrink-0 bg-muted/30 text-xs text-muted-foreground">
          {searchText.trim() ? (
            <>找到 {contacts.length} / {allContacts.length} 位联系人</>
          ) : (
            <>共 {allContacts.length} 位联系人</>
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
                  <span className="font-medium">{c.name || '未命名'}</span>
                  <span className="text-xs text-muted-foreground font-mono">{c.email}</span>
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
                编辑
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
                  showStatus('已删除');
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        ) : searchText.trim() ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            未找到匹配的联系人
          </p>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            暂无联系人，点击右上角新建或导入 CSV
          </p>
        )}
      </div>
    </div>
  );
}
