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
import { Mail, Send, Loader2, Wand2, Trash2, Plus, Settings, FileText, History, ChevronDown, ChevronUp, Users, Bookmark } from 'lucide-react';
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
}

interface SavedSubject {
  id: string;
  text: string;
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
  const [newSubjectText, setNewSubjectText] = useState('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyPreviewIdx, setHistoryPreviewIdx] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-hidden flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>联系人管理</DialogTitle>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs"
                onClick={() => setEditingContact({ id: `ct_${Date.now()}`, name: '', email: '', note: '' })}>
                <Plus className="h-3 w-3" />
                新建联系人
              </Button>
            </div>
            <DialogDescription>勾选联系人后点击"使用所选"填入收件人</DialogDescription>
          </DialogHeader>

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

          {/* 联系人列表（可勾选） */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
            {(() => {
              const contacts: Contact[] = (host.storage.get<EmailStorageData>('emailData') || {}).contacts || [];
              return contacts.length > 0 ? contacts.map(c => (
                <div key={c.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${selectedContactIds.has(c.id) ? 'bg-pink-500/10' : 'hover:bg-muted/50'}`}
                  onClick={() => {
                    setSelectedContactIds(prev => {
                      const next = new Set(prev);
                      next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                      return next;
                    });
                  }}>
                  <input type="checkbox"
                    checked={selectedContactIds.has(c.id)}
                    readOnly
                    className="h-4 w-4 rounded border-gray-300 flex-shrink-0 pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{c.name || '未命名'}</span>
                      <span className="text-xs text-muted-foreground font-mono truncate">{c.email}</span>
                    </div>
                    {c.note && <span className="text-xs text-muted-foreground">{c.note}</span>}
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); setEditingContact({ ...c }); }}>
                    编辑
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive flex-shrink-0"
                    onClick={(e) => { e.stopPropagation();
                      const current = host.storage.get<EmailStorageData>('emailData') || {};
                      const updated = (current.contacts || []).filter(x => x.id !== c.id);
                      saveToStorage({ contacts: updated });
                      setSelectedContactIds(prev => { const next = new Set(prev); next.delete(c.id); return next; });
                      showStatus('已删除');
                    }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground text-center py-4">暂无联系人，点击右上角新建</p>
              );
            })()}
          </div>

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
