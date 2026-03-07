import { useState, useCallback, useRef, useEffect, useReducer, useMemo } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import {
  Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../_framework/ui';
import { Mail, Send, Loader2, Settings, FileText, History, ChevronDown, Users, Bookmark, Newspaper, FileUp, Paperclip, X, FilePlus, PenLine, Archive, Save, Eye, Smartphone, Tablet, Monitor, SlidersHorizontal, ListChecks, RotateCcw } from 'lucide-react';
import { EmailBodyEditor } from './EmailBodyEditor';
import { looksLikeMarkdown, convertMarkdownToHtml } from './markdownToHtml';
import type {
  LogEntry, EmailAccount, Contact, AttachmentItem,
  SubmissionTemplate,
  EmailSignature, EmailStorageData, EmailDraft,
  BulkSendJob, ContactGroup, AccountHealth, SendHistoryEntry,
} from './types';
import {
  replaceVariables, getCurrentDateString,
  formatFileSize, isValidEmail, translateSmtpResult,
  mimeMap, prepareSendPayload,
} from './utils';
import type { SendPayloadInput } from './utils';
import { inlineEmailStyles } from './inlineStyles';
import { TemplateDialog } from './dialogs/TemplateDialog';
import { emailReducer, createInitialState } from './emailReducer';
import { useSendQueue } from './sendQueue';
import type { SendQueueItem } from './sendQueue';
import {
  AccountDialog, HistoryDialog, ContactDialog, SubjectDialog,
  SendConfirmDialog, SignatureDialog, QueueDialog, DraftsDialog, CsvImportDialog,
  BulkSendDialog, BulkJobManagerDialog,
} from './dialogs';
import { useBulkSend } from './bulkSendEngine';
import { TagInput } from './TagInput';
import { EmailContext } from './EmailContext';
import type { EmailContextValue } from './EmailContext';
import { useDialogState } from './useDialogState';

// G5: 撤销发送条组件
function UndoSendBar({ delayedItems, onCancel, t }: {
  delayedItems: SendQueueItem[];
  onCancel: (id: string) => void;
  t: (key: string, opts?: Record<string, string | number>) => string;
}) {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forceUpdate(n => n + 1), 200);
    return () => clearInterval(timer);
  }, []);
  const now = Date.now();
  return (
    <div className="px-2 py-1.5 border-t bg-amber-500/10 flex-shrink-0 space-y-1">
      {delayedItems.map(item => {
        const remaining = Math.max(0, Math.ceil(((item.delayUntil || now) - now) / 1000));
        return (
          <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-amber-700 dark:text-amber-300 truncate flex-1">
              {t('undoCountdown', { seconds: remaining, to: item.to.join(', ') })}
            </span>
            <Button variant="outline" size="sm" className="h-5 px-2 text-xs flex-shrink-0"
              onClick={() => onCancel(item.id)}>
              {t('undoSend')}
            </Button>
          </div>
        );
      })}
    </div>
  );
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

  // ── useReducer 统一管理核心状态 ──
  const [state, dispatch] = useReducer(emailReducer, stored, createInitialState);
  const { accounts, selectedAccountId, recipients, cc, bcc, replyTo, subject, emailBody, emailFormat, attachments, signatures, activeSignatureId, logs, drafts } = state;

  // ── dispatch 便捷包装：设置单个表单字段 ──
  const setRecipients = useCallback((v: string) => dispatch({ type: 'SET_FIELD', field: 'recipients', value: v }), []);
  const setCc = useCallback((v: string) => dispatch({ type: 'SET_FIELD', field: 'cc', value: v }), []);
  const setBcc = useCallback((v: string) => dispatch({ type: 'SET_FIELD', field: 'bcc', value: v }), []);
  const setReplyTo = useCallback((v: string) => dispatch({ type: 'SET_FIELD', field: 'replyTo', value: v }), []);
  const setSubject = useCallback((v: string) => dispatch({ type: 'SET_FIELD', field: 'subject', value: v }), []);
  const setEmailBody = useCallback((v: string) => dispatch({ type: 'SET_FIELD', field: 'emailBody', value: v }), []);

  // ── UI 局部状态（对话框、瞬态交互，不纳入 reducer） ──
  const dlg = useDialogState();
  const {
    accountDialogOpen, setAccountDialogOpen,
    recipientsDialogOpen, setRecipientsDialogOpen,
    subjectsDialogOpen, setSubjectsDialogOpen,
    sendConfirmDialogOpen, setSendConfirmDialogOpen,
    historyDialogOpen, setHistoryDialogOpen,
    signatureDialogOpen, setSignatureDialogOpen,
    templatesDialogOpen, setTemplatesDialogOpen,
    csvImportDialogOpen, setCsvImportDialogOpen,
    draftsDialogOpen, setDraftsDialogOpen,
    queueDialogOpen, setQueueDialogOpen,
    newEmailConfirmOpen, setNewEmailConfirmOpen,
    previewDialogOpen, setPreviewDialogOpen,
    bulkSendDialogOpen, setBulkSendDialogOpen,
    bulkJobManagerOpen, setBulkJobManagerOpen,
    recipientSuggestions, setRecipientSuggestions,
    showRecipientSuggestions, setShowRecipientSuggestions,
  } = dlg;
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(() => !!(cc.trim() || bcc.trim()));
  const [matchedTemplate, setMatchedTemplate] = useState<SubmissionTemplate | null>(null);
  const recipientInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvEmailColumn, setCsvEmailColumn] = useState<number>(-1);
  const [csvNameColumn, setCsvNameColumn] = useState<number>(-1);
  const [logExpanded, setLogExpanded] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [requestReadReceipt, setRequestReadReceipt] = useState(false);
  const [emailPriority, setEmailPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [keepContentAfterSend, setKeepContentAfterSend] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const hasQueueErrorsRef = useRef(false);

  // ── AI 应用撤销栈（10 秒后自动消失） ──
  const [aiUndoStack, setAiUndoStack] = useState<Array<{ field: 'body' | 'subject'; oldValue: string; timestamp: number }>>([]);
  useEffect(() => {
    if (aiUndoStack.length === 0) return;
    const timer = setTimeout(() => setAiUndoStack([]), 10000);
    return () => clearTimeout(timer);
  }, [aiUndoStack]);

  const appendLog = useCallback((msg: string, level: LogEntry['level'] = 'info') => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    dispatch({ type: 'APPEND_LOG', entry: { time, level, msg } });
  }, []);

  const contacts: Contact[] = stored.contacts || [];
  const contactGroups: ContactGroup[] = stored.contactGroups || [];
  const allTemplates: SubmissionTemplate[] = stored.submissionTemplates || [];

  // 日志更新时仅在日志容器内部滚动到底部
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  // ── 快捷键 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter：打开发送确认
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!sending && emailBody.trim() && recipients.trim() && subject.trim() && accounts.length > 0) {
          setSendConfirmDialogOpen(true);
        }
      }
      // Ctrl/Cmd + S：保存草稿
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // 触发保存草稿按钮的点击 - 通过 dispatch 直接保存
        const draft = {
          id: currentDraftId || `draft_${Date.now()}`,
          name: subject.trim() || t('draftUntitled'),
          recipients, cc, bcc, subject, emailBody, emailFormat,
          accountId: selectedAccountId,
          attachments, activeSignatureId,
          createdAt: currentDraftId ? Date.now() : Date.now(),
          updatedAt: Date.now(),
        };
        dispatch({ type: 'SAVE_DRAFT', draft });
        const current = host.storage.get<EmailStorageData>('emailData') || {};
        const exists = (current.drafts || []).findIndex(d => d.id === draft.id);
        const drafts = exists >= 0
          ? (current.drafts || []).map(d => d.id === draft.id ? draft : d)
          : [draft, ...(current.drafts || [])];
        host.storage.set('emailData', { ...current, drafts });
        if (!currentDraftId) setCurrentDraftId(draft.id);
        appendLog(t('draftSaved'), 'success');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sending, emailBody, recipients, subject, accounts, currentDraftId, cc, bcc, emailFormat, selectedAccountId, attachments, activeSignatureId, dispatch, host.storage, appendLog, t]);

  // E.2: 未保存变更提示（浏览器刷新/关闭时）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (emailBody.trim() || recipients.trim()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [emailBody, recipients]);

  // G1: 草稿自动保存（30秒防抖）
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const hasContent = recipients.trim() || subject.trim() || emailBody.trim();
    if (!hasContent) return;
    autoSaveTimerRef.current = setTimeout(() => {
      const now = Date.now();
      const draftId = currentDraftId || `draft_${now}`;
      const draft: EmailDraft = {
        id: draftId,
        name: subject.trim() || t('draftUntitled'),
        recipients, cc, bcc, subject, emailBody, emailFormat,
        accountId: selectedAccountId,
        attachments, activeSignatureId,
        createdAt: currentDraftId ? (drafts.find(d => d.id === currentDraftId)?.createdAt || now) : now,
        updatedAt: now,
      };
      dispatch({ type: 'SAVE_DRAFT', draft });
      if (!currentDraftId) setCurrentDraftId(draftId);
      const current = host.storage.get<EmailStorageData>('emailData') || {};
      const updatedDrafts = currentDraftId
        ? (current.drafts || []).map(d => d.id === draft.id ? draft : d)
        : [draft, ...(current.drafts || [])];
      host.storage.set('emailData', { ...current, drafts: updatedDrafts });
    }, 30000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [recipients, cc, bcc, subject, emailBody, emailFormat, selectedAccountId, attachments, activeSignatureId, currentDraftId, drafts, dispatch, host.storage, t]);

  const sendHistory: EmailStorageData['sendHistory'] = stored.sendHistory || [];

  const showStatus = useCallback((msg: string, isError = false) => {
    appendLog(msg, isError ? 'error' : 'info');
    if (isError) setLogExpanded(true);
  }, [appendLog]);

  const saveToStorage = useCallback((updates: Partial<EmailStorageData>) => {
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    host.storage.set('emailData', { ...current, ...updates });
  }, [host.storage]);

  // ── 发送队列 ──
  const sendQueueCallbacks = useRef({
    onItemComplete: (_item: SendQueueItem) => { /* 由下方 useEffect 赋值 */ },
    onItemError: (_item: SendQueueItem) => { /* 由下方 useEffect 赋值 */ },
    onQueueEmpty: () => { /* 由下方 useEffect 赋值 */ },
  });
  // 保持 ref 回调的 t/appendLog 最新
  useEffect(() => {
    sendQueueCallbacks.current.onItemComplete = (item: SendQueueItem) => {
      const translated = translateSmtpResult('SEND_OK: ' + item.to.join(', '), t);
      appendLog(translated, 'success');
      const historyEntry = {
        timestamp: Date.now(), to: item.to, cc: item.cc.length ? item.cc : undefined, bcc: item.bcc.length ? item.bcc : undefined,
        subject: item.subject, body: item.body, accountId: item.accountId || '', accountEmail: item.email,
        status: 'success' as const, statusMsg: translated,
      };
      const current = host.storage.get<EmailStorageData>('emailData') || {};
      const history = [historyEntry, ...(current.sendHistory || [])];
      if (history.length > 200) history.length = 200;
      host.storage.set('emailData', { ...current, sendHistory: history });
    };
    sendQueueCallbacks.current.onItemError = (item: SendQueueItem) => {
      hasQueueErrorsRef.current = true;
      const errMsg = translateSmtpResult(item.errorMsg || 'SEND_FAILED: unknown', t);
      appendLog(`${t('sendFailed', { error: errMsg })} [${item.to.join(', ')}]`, 'error');
      const historyEntry = {
        timestamp: Date.now(), to: item.to, cc: item.cc.length ? item.cc : undefined, bcc: item.bcc.length ? item.bcc : undefined,
        subject: item.subject, body: item.body, accountId: item.accountId || '', accountEmail: item.email,
        status: 'error' as const, statusMsg: errMsg,
      };
      const current = host.storage.get<EmailStorageData>('emailData') || {};
      const history = [historyEntry, ...(current.sendHistory || [])];
      if (history.length > 200) history.length = 200;
      host.storage.set('emailData', { ...current, sendHistory: history });
    };
    sendQueueCallbacks.current.onQueueEmpty = () => {
      sendingRef.current = false;
      setSending(false);
      // F1: 发送成功后清空表单（无错误且未勾选保留内容时）
      if (!hasQueueErrorsRef.current && !keepContentAfterSend) {
        dispatch({ type: 'SET_FIELD', field: 'recipients', value: '' });
        dispatch({ type: 'SET_FIELD', field: 'cc', value: '' });
        dispatch({ type: 'SET_FIELD', field: 'bcc', value: '' });
        dispatch({ type: 'SET_FIELD', field: 'replyTo', value: '' });
        dispatch({ type: 'SET_FIELD', field: 'subject', value: '' });
        dispatch({ type: 'SET_FIELD', field: 'emailBody', value: '' });
        dispatch({ type: 'SET_ATTACHMENTS', attachments: [] });
        setCurrentDraftId(null);
        setRequestReadReceipt(false);
        setEmailPriority('normal');
        saveToStorage({ recipients: [], cc: [], bcc: [], replyTo: '', subject: '', emailBody: '', attachments: [] });
        appendLog(t('formClearedAfterSend'), 'info');
      }
      hasQueueErrorsRef.current = false;
    };
  }, [t, appendLog, host.storage, keepContentAfterSend, saveToStorage]);

  const { queue: sendQueue, stats: sendQueueStats, enqueue, retryItem, removeItem, clearCompleted: clearQueueCompleted, cancelDelayed } = useSendQueue({
    invoke: host.platform.invoke,
    onItemComplete: (...args) => sendQueueCallbacks.current.onItemComplete(...args),
    onItemError: (...args) => sendQueueCallbacks.current.onItemError(...args),
    onQueueEmpty: () => sendQueueCallbacks.current.onQueueEmpty(),
    onQueueChange: (q) => {
      const current = host.storage.get<EmailStorageData>('emailData') || {};
      host.storage.set('emailData', { ...current, pendingSendQueue: q.filter(i => i.status === 'pending' || i.status === 'sending' || i.status === 'delayed') });
    },
    initialQueue: (() => {
      const data = host.storage.get<EmailStorageData>('emailData');
      return data?.pendingSendQueue;
    })(),
    sendDelay: 5000,
  });

  // ── 群发独立队列 + 引擎 ──
  const referenceContentForBulk = host.content.getAIContent() || host.content.getDocumentContent();
  const docContextForBulk = useMemo(() => ({
    title: host.content.getDocumentMeta?.()?.title || '',
    content: convertMarkdownToHtml(referenceContentForBulk),
    date: getCurrentDateString(),
  }), [referenceContentForBulk, host.content]);

  const bulkPersistJobs = useCallback((jobs: BulkSendJob[]) => {
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    host.storage.set('emailData', { ...current, bulkJobs: jobs });
    dispatch({ type: 'SET_BULK_JOBS', jobs });
  }, [host.storage]);

  const bulkPersistHealth = useCallback((map: Record<string, AccountHealth>) => {
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    host.storage.set('emailData', { ...current, accountHealthMap: map });
  }, [host.storage]);

  const bulkPersistRateLog = useCallback((log: Record<string, number[]>) => {
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    host.storage.set('emailData', { ...current, sendRateLog: log });
  }, [host.storage]);

  const bulkAddHistory = useCallback((entry: SendHistoryEntry) => {
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    const history = [entry, ...(current.sendHistory || [])];
    if (history.length > 500) history.length = 500;
    host.storage.set('emailData', { ...current, sendHistory: history });
  }, [host.storage]);

  const bulkAppendLog = useCallback((level: 'info' | 'error' | 'success', msg: string) => {
    appendLog(msg, level);
  }, [appendLog]);

  // 群发队列实例（独立于普通队列）
  const { enqueue: bulkEnqueue, cancelPending: bulkCancelPending } = useSendQueue({
    invoke: host.platform.invoke,
    onItemComplete: (item) => bulkSendRef.current.onBulkItemComplete(item),
    onItemError: (item) => bulkSendRef.current.onBulkItemError(item),
    onQueueEmpty: () => bulkSendRef.current.onBulkQueueEmpty(),
    onQueueChange: (q) => {
      const current = host.storage.get<EmailStorageData>('emailData') || {};
      host.storage.set('emailData', { ...current, bulkPendingQueue: q.filter(i => i.status === 'pending' || i.status === 'sending') });
    },
    initialQueue: (() => {
      const data = host.storage.get<EmailStorageData>('emailData');
      return data?.bulkPendingQueue;
    })(),
    // 群发队列启用高级模式回调（由 useBulkSend 提供）
    getRateLimits: (id) => bulkSendRef.current.getRateLimits(id),
    getSendLog: (id) => bulkSendRef.current.getSendLog(id),
    getAccountHealth: (id) => bulkSendRef.current.getAccountHealth(id),
    pickFallbackAccount: (orig, recip) => bulkSendRef.current.pickFallback(orig, recip),
    onRateLimited: (id, ms, reason) => bulkSendRef.current.onRateLimited(id, ms, reason),
    onAllAccountsExhausted: (ms) => bulkSendRef.current.onAllAccountsExhausted(ms),
    onSendRecorded: (id) => bulkSendRef.current.onSendRecorded(id),
  });

  const bulkSend = useBulkSend({
    invoke: host.platform.invoke,
    accounts,
    templates: allTemplates,
    contacts,
    signatures: signatures.map(s => ({ id: s.id, content: s.content })),
    docContext: docContextForBulk,
    bulkEnqueue,
    bulkCancelPending,
    persistJobs: bulkPersistJobs,
    persistHealthMap: bulkPersistHealth,
    persistRateLog: bulkPersistRateLog,
    addHistoryEntry: bulkAddHistory,
    appendLog: bulkAppendLog,
  });

  // ref 用于群发队列回调中访问最新的 bulkSend 函数
  const bulkSendRef = useRef(bulkSend);
  bulkSendRef.current = bulkSend;

  // 初始化群发状态（从 storage 恢复）
  const bulkInitDone = useRef(false);
  useEffect(() => {
    if (bulkInitDone.current) return;
    bulkInitDone.current = true;
    const data = host.storage.get<EmailStorageData>('emailData');
    if (data) {
      bulkSend.initFromStorage(
        data.bulkJobs || [],
        data.accountHealthMap || {},
        data.sendRateLog || {},
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 草稿箱操作 ──
  const handleSaveDraft = useCallback(() => {
    const now = Date.now();
    const draft: EmailDraft = {
      id: currentDraftId || `draft_${now}_${Math.random().toString(36).slice(2, 6)}`,
      name: subject.trim() || t('draftUntitled'),
      recipients, cc, bcc, subject, emailBody, emailFormat,
      accountId: selectedAccountId,
      attachments,
      activeSignatureId,
      createdAt: currentDraftId ? (drafts.find(d => d.id === currentDraftId)?.createdAt || now) : now,
      updatedAt: now,
    };
    dispatch({ type: 'SAVE_DRAFT', draft });
    setCurrentDraftId(draft.id);
    saveToStorage({ drafts: currentDraftId ? drafts.map(d => d.id === draft.id ? draft : d) : [draft, ...drafts] });
    showStatus(t('draftSaved'));
  }, [currentDraftId, subject, recipients, cc, bcc, emailBody, emailFormat, selectedAccountId, attachments, activeSignatureId, drafts, saveToStorage, showStatus, t]);

  const handleLoadDraft = useCallback((draft: EmailDraft) => {
    dispatch({ type: 'LOAD_DRAFT', draft });
    setCurrentDraftId(draft.id);
    saveToStorage({
      recipients: draft.recipients.split(',').map(s => s.trim()).filter(Boolean),
      cc: draft.cc.split(',').map(s => s.trim()).filter(Boolean),
      bcc: draft.bcc.split(',').map(s => s.trim()).filter(Boolean),
      subject: draft.subject, emailBody: draft.emailBody, emailFormat: draft.emailFormat,
      attachments: draft.attachments, activeSignatureId: draft.activeSignatureId,
    });
    setDraftsDialogOpen(false);
    showStatus(t('draftLoaded', { name: draft.name }));
  }, [saveToStorage, showStatus, t]);

  const handleDeleteDraft = useCallback((id: string) => {
    dispatch({ type: 'DELETE_DRAFT', id });
    const updated = drafts.filter(d => d.id !== id);
    saveToStorage({ drafts: updated });
    if (currentDraftId === id) setCurrentDraftId(null);
    showStatus(t('draftDeleted'));
  }, [drafts, currentDraftId, saveToStorage, showStatus, t]);

  const handleRenameDraft = useCallback((id: string, newName: string) => {
    const updated = drafts.map(d => d.id === id ? { ...d, name: newName, updatedAt: Date.now() } : d);
    dispatch({ type: 'SAVE_DRAFT', draft: updated.find(d => d.id === id)! });
    saveToStorage({ drafts: updated });
    showStatus(t('draftRenamed'));
  }, [drafts, saveToStorage, showStatus, t]);

  // ── AI 侧边栏事件监听 ──
  useEffect(() => {
    const handleAiApply = (e: Event) => {
      const { field, value, mode = 'replace' } = (e as CustomEvent).detail;
      if (field === 'body') {
        setAiUndoStack(prev => [...prev.slice(-9), { field: 'body', oldValue: emailBody, timestamp: Date.now() }]);
        const html = looksLikeMarkdown(value) ? convertMarkdownToHtml(value) : value;
        const styled = inlineEmailStyles(html);
        let newBody: string;
        if (mode === 'append' || mode === 'insert') {
          newBody = emailBody + styled;
        } else {
          newBody = styled;
        }
        setEmailBody(newBody);
        saveToStorage({ emailBody: newBody });
        showStatus(t('generateSuccess'));
      } else if (field === 'subject') {
        setAiUndoStack(prev => [...prev.slice(-9), { field: 'subject', oldValue: subject, timestamp: Date.now() }]);
        setSubject(value);
        saveToStorage({ subject: value });
      }
    };
    const handleAiAddAccount = async (e: Event) => {
      const { account } = (e as CustomEvent).detail;
      if (account && account.email) {
        const acctId = account.id || `acct_${Date.now()}`;
        // Phase 1.2: AI 添加账户也走 keyring 流程
        if (account.password) {
          try {
            await host.platform.invoke<string>('store_email_credential', {
              accountId: acctId,
              password: account.password,
            });
          } catch { /* 密钥链存储失败时仍创建账户 */ }
        }
        const acct: EmailAccount = {
          id: acctId,
          name: account.name || account.email,
          provider: account.provider || 'custom',
          smtpHost: account.smtpHost || '',
          smtpPort: account.smtpPort || 465,
          encryption: account.encryption || 'tls',
          email: account.email,
          password: undefined,
          hasKeyringPassword: !!account.password,
          displayName: account.displayName || '',
        };
        dispatch({ type: 'ADD_ACCOUNT', account: acct });
        saveToStorage({ accounts: [...accounts, acct] });
        if (!selectedAccountId) {
          dispatch({ type: 'SET_SELECTED_ACCOUNT', id: acct.id });
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
        dispatch({ type: 'ADD_SIGNATURE', signature: sig });
        saveToStorage({ signatures: [...signatures, sig] });
        showStatus(t('signatureSaved'));
      }
    };
    // Phase 5.5: AI 助手请求邮件上下文
    const handleAiGetContext = () => {
      const account = accounts.find(a => a.id === selectedAccountId);
      window.dispatchEvent(new CustomEvent('email-ai-context-response', { detail: {
        recipients, cc, bcc, subject, emailBody, emailFormat,
        accountEmail: account?.email || '',
        accountName: account?.displayName || account?.name || '',
        attachmentCount: attachments.length,
        signatureName: signatures.find(s => s.id === activeSignatureId)?.name || '',
      }}));
    };
    window.addEventListener('email-ai-apply', handleAiApply);
    window.addEventListener('email-ai-add-account', handleAiAddAccount);
    window.addEventListener('email-ai-add-signature', handleAiAddSignature);
    window.addEventListener('email-ai-get-context', handleAiGetContext);
    return () => {
      window.removeEventListener('email-ai-apply', handleAiApply);
      window.removeEventListener('email-ai-add-account', handleAiAddAccount);
      window.removeEventListener('email-ai-add-signature', handleAiAddSignature);
      window.removeEventListener('email-ai-get-context', handleAiGetContext);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, recipients, cc, bcc, subject, emailBody, emailFormat, attachments, signatures, activeSignatureId, accounts, saveToStorage, showStatus, t]);

  // ── 账户管理操作 ──
  const saveAccount = useCallback(async (acct: EmailAccount) => {
    // Phase 1.2: 密码存入 OS 密钥链，不再明文写入 storage
    const passwordToStore = acct.password;
    if (passwordToStore) {
      try {
        await host.platform.invoke<string>('store_email_credential', {
          accountId: acct.id,
          password: passwordToStore,
        });
      } catch (err) {
        showStatus(t('keyringStoreFailed') + ': ' + (err instanceof Error ? err.message : String(err)), true);
        return;
      }
    }
    // 清除明文密码，标记已存入密钥链
    const safeAcct: EmailAccount = {
      ...acct,
      password: undefined,
      hasKeyringPassword: true,
    };
    dispatch({ type: 'ADD_ACCOUNT', account: safeAcct });
    const idx = accounts.findIndex(a => a.id === safeAcct.id);
    const nextAccounts = idx >= 0 ? accounts.map(a => a.id === safeAcct.id ? safeAcct : a) : [...accounts, safeAcct];
    saveToStorage({ accounts: nextAccounts });
    if (!selectedAccountId || accounts.length === 0) {
      dispatch({ type: 'SET_SELECTED_ACCOUNT', id: safeAcct.id });
      saveToStorage({ activeAccountId: safeAcct.id });
    }
    showStatus(t('accountSaved'));
  }, [accounts, selectedAccountId, saveToStorage, showStatus, t, host.platform]);

  const deleteAccount = useCallback(async (id: string) => {
    // Phase 1.2: 同时从密钥链删除凭证
    try {
      await host.platform.invoke<string>('delete_email_credential', { accountId: id });
    } catch { /* 忽略密钥链删除失败（可能从未存入） */ }
    dispatch({ type: 'DELETE_ACCOUNT', id });
    const nextAccounts2 = accounts.filter(a => a.id !== id);
    saveToStorage({ accounts: nextAccounts2 });
    if (selectedAccountId === id) {
      const newActive = nextAccounts2.length > 0 ? nextAccounts2[0].id : '';
      dispatch({ type: 'SET_SELECTED_ACCOUNT', id: newActive });
      saveToStorage({ activeAccountId: newActive });
    }
    showStatus(t('accountDeleted'));
  }, [accounts, selectedAccountId, saveToStorage, showStatus, t, host.platform]);

  const handleSelectAccount = useCallback((id: string) => {
    dispatch({ type: 'SET_SELECTED_ACCOUNT', id });
    saveToStorage({ activeAccountId: id });
  }, [saveToStorage]);

  // ── 拖拽附件状态 ──
  const [isDragOver, setIsDragOver] = useState(false);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

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
    dispatch({ type: 'SET_ATTACHMENTS', attachments: updated });
    saveToStorage({ attachments: updated });
    showStatus(t('attachmentAdded', { count: newAtts.length }));

    // 附件大小警告
    const SINGLE_LIMIT_MB = 25;
    const TOTAL_LIMIT_MB = 25;
    for (const att of newAtts) {
      if (att.size > SINGLE_LIMIT_MB * 1024 * 1024) {
        appendLog(t('attachmentSingleWarning', { name: att.filename, limit: SINGLE_LIMIT_MB }), 'error');
      }
    }
    const totalSize = updated.reduce((sum, a) => sum + (a.size || 0), 0);
    if (totalSize > TOTAL_LIMIT_MB * 1024 * 1024) {
      appendLog(t('attachmentSizeWarning', { limit: TOTAL_LIMIT_MB }), 'error');
    }
  }, [host.platform, saveToStorage, showStatus, appendLog, t]);

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
  const handleRecipientChange = useCallback((value: string) => {
    setRecipients(value);
    saveToStorage({ recipients: value.split(',').map(s => s.trim()).filter(Boolean) });
  }, [saveToStorage]);

  const handleRecipientSearch = useCallback((text: string) => {
    const q = text.trim().toLowerCase();
    if (q.length >= 1) {
      // 从联系人列表中搜索
      const fromContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.note || '').toLowerCase().includes(q)
      ).slice(0, 6);
      // G3: 从发送历史中提取最近联系人
      const seenEmails = new Set(fromContacts.map(c => c.email.toLowerCase()));
      const fromHistory: Contact[] = [];
      for (const entry of sendHistory) {
        for (const email of (entry.to || [])) {
          const lower = email.toLowerCase();
          if (lower.includes(q) && !seenEmails.has(lower)) {
            seenEmails.add(lower);
            fromHistory.push({ id: `recent_${email}`, name: '', email, note: t('recentContact') });
          }
        }
        if (fromHistory.length >= 4) break;
      }
      const merged = [...fromContacts, ...fromHistory].slice(0, 8);
      setRecipientSuggestions(merged);
      setShowRecipientSuggestions(merged.length > 0);
    } else {
      setRecipientSuggestions([]);
      setShowRecipientSuggestions(false);
    }
  }, [contacts, sendHistory, t]);

  const handleSelectContact = useCallback((contact: Contact) => {
    const parts = recipients.split(',').map(s => s.trim()).filter(Boolean);
    const formatted = contact.name ? `"${contact.name}" <${contact.email}>` : contact.email;
    parts.push(formatted);
    const newVal = parts.join(', ');
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
    // 更新使用统计
    updateTemplateStats(matchedTemplate.id);
    showStatus(t('templateApplied'));
  }, [matchedTemplate, host.content, saveToStorage, showStatus, t]);

  const updateTemplateStats = useCallback((templateId: string) => {
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    const tpls = current.submissionTemplates || [];
    const updated = tpls.map(tp =>
      tp.id === templateId
        ? { ...tp, lastUsedAt: Date.now(), useCount: (tp.useCount || 0) + 1 }
        : tp
    );
    saveToStorage({ submissionTemplates: updated });
  }, [host.storage, saveToStorage]);

  // ── 共享 payload 输入（H1 重构） ──
  const sendingRef = useRef(false);
  const getPayloadInput = useCallback((): SendPayloadInput => ({
    accounts, selectedAccountId, recipients, cc, bcc, subject, emailBody, emailFormat,
    attachments, signatures, activeSignatureId, requestReadReceipt, replyTo, priority: emailPriority,
  }), [accounts, selectedAccountId, recipients, cc, bcc, subject, emailBody, emailFormat, attachments, signatures, activeSignatureId, requestReadReceipt, replyTo, emailPriority]);

  // ── 发送前通用日志 ──
  const logSendInfo = useCallback((payload: ReturnType<typeof prepareSendPayload>) => {
    if (typeof payload === 'string') return;
    const { account, toList, ccList, bccList } = payload;
    appendLog(`SMTP: ${account.smtpHost}:${account.smtpPort} (${account.encryption})`, 'info');
    appendLog(`From: ${account.email}`, 'info');
    appendLog(`To: ${toList.join(', ')}`, 'info');
    if (ccList.length) appendLog(`CC: ${ccList.join(', ')}`, 'info');
    if (bccList.length) appendLog(`BCC: ${bccList.join(', ')}`, 'info');
    appendLog(`Subject: ${subject.trim()}`, 'info');
    if (attachments.length) appendLog(`${t('sendConfirmAttachments')}: ${attachments.length}`, 'info');
    const activeSig = signatures.find(s => s.id === activeSignatureId);
    if (activeSig?.content) appendLog(`${t('signatureAppended')}: ${activeSig.name}`, 'info');
  }, [appendLog, subject, attachments, signatures, activeSignatureId, t]);

  // ── 校验错误处理（F5: 空主题/正文不再硬阻止，在 SendConfirmDialog 中已确认） ──
  const handleValidationError = useCallback((err: string) => {
    const msgMap: Record<string, string> = {
      noAccount: t('selectAccountFirst'),
      noRecipient: t('recipientRequired'),
      noSubject: t('subjectRequired'),
      noBody: t('bodyRequired'),
    };
    showStatus(msgMap[err] || err, true);
  }, [showStatus, t]);

  // ── 邮件操作（通过发送队列） ──
  const handleSend = useCallback(() => {
    if (sendingRef.current) return;
    const result = prepareSendPayload(getPayloadInput(), { skipEmptyCheck: true });
    if (typeof result === 'string') { handleValidationError(result); return; }

    logSendInfo(result);
    sendingRef.current = true;
    hasQueueErrorsRef.current = false;
    setSending(true);
    setLogExpanded(true);
    showStatus(t('queueAdded'));
    enqueue([result.queueItem]);
    saveToStorage({ emailBody, recipients: result.toList, cc: result.ccList, bcc: result.bccList, subject: subject.trim(), replyTo: replyTo.trim() });
  }, [getPayloadInput, logSendInfo, handleValidationError, enqueue, saveToStorage, showStatus, t, emailBody, subject, replyTo]);

  // ── 逐个群发（每个收件人独立一封邮件） ──
  const handleBulkSend = useCallback(() => {
    if (sendingRef.current) return;
    const result = prepareSendPayload(getPayloadInput(), { skipEmptyCheck: true });
    if (typeof result === 'string') { handleValidationError(result); return; }
    if (result.toList.length < 2) { showStatus(t('bulkNeedMultiple'), true); return; }

    sendingRef.current = true;
    hasQueueErrorsRef.current = false;
    setSending(true);
    setLogExpanded(true);
    appendLog(t('bulkStarted', { count: result.toList.length }), 'info');

    enqueue(result.toList.map(recipient => ({
      ...result.queueItem, to: [recipient], cc: [], bcc: [],
    })));
    showStatus(t('bulkQueued', { count: result.toList.length }));
  }, [getPayloadInput, handleValidationError, enqueue, showStatus, appendLog, t]);

  // ── 群发任务创建 ──
  const handleCreateBulkJob = useCallback((job: BulkSendJob) => {
    dispatch({ type: 'ADD_BULK_JOB', job });
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    const jobs = [job, ...(current.bulkJobs || [])];
    host.storage.set('emailData', { ...current, bulkJobs: jobs });
    appendLog(`${t('createBulkJob')}: ${job.name} (${job.recipients.length} ${t('people')})`, 'success');
    setLogExpanded(true);
  }, [dispatch, host.storage, appendLog, t]);

  // ── 从当前编辑器内容直接创建群发任务（SendConfirmDialog 快捷入口） ──
  const handleCreateBulkJobFromCurrent = useCallback(() => {
    const toList = recipients.split(',').map(s => s.trim()).filter(s => isValidEmail(s));
    if (toList.length < 1) { showStatus(t('bulkNeedMultiple'), true); return; }
    const now = Date.now();
    const bulkRecipients = toList.map(email => {
      const c = contacts.find(ct => ct.email.toLowerCase() === email.toLowerCase());
      return { email, name: c?.name, contactId: c?.id, status: 'pending' as const };
    });
    const job: BulkSendJob = {
      id: `bulk_${now}_${Math.random().toString(36).slice(2, 6)}`,
      name: subject.trim() || `群发任务 ${new Date().toLocaleDateString()}`,
      accountId: selectedAccountId,
      autoMatchAccount: true,
      defaultSubject: subject,
      defaultBody: emailBody,
      recipients: bulkRecipients,
      attachments: attachments.length > 0 ? attachments : undefined,
      signatureId: activeSignatureId || undefined,
      status: 'draft',
      progress: { total: bulkRecipients.length, sent: 0, failed: 0 },
      createdAt: now,
    };
    handleCreateBulkJob(job);
    setBulkJobManagerOpen(true);
    showStatus(`${t('createBulkJob')}: ${job.name}`);
  }, [recipients, subject, emailBody, selectedAccountId, attachments, activeSignatureId, contacts, handleCreateBulkJob, showStatus, t]);

  // F4: 新建邮件
  const handleNewEmail = useCallback(() => {
    dispatch({ type: 'SET_FIELD', field: 'recipients', value: '' });
    dispatch({ type: 'SET_FIELD', field: 'cc', value: '' });
    dispatch({ type: 'SET_FIELD', field: 'bcc', value: '' });
    dispatch({ type: 'SET_FIELD', field: 'replyTo', value: '' });
    dispatch({ type: 'SET_FIELD', field: 'subject', value: '' });
    dispatch({ type: 'SET_FIELD', field: 'emailBody', value: '' });
    dispatch({ type: 'SET_ATTACHMENTS', attachments: [] });
    saveToStorage({ recipients: [], cc: [], bcc: [], replyTo: '', subject: '', emailBody: '', attachments: [] });
    setCurrentDraftId(null);
    setRequestReadReceipt(false);
    setEmailPriority('normal');
    showStatus(t('newEmailCreated'));
  }, [dispatch, saveToStorage, showStatus, t]);

  const referenceContent = host.content.getAIContent() || host.content.getDocumentContent();

  const handleApplyTemplate = useCallback((tpl: SubmissionTemplate) => {
    const context = { title: host.content.getDocumentMeta?.()?.title || '', content: convertMarkdownToHtml(referenceContent), date: getCurrentDateString() };
    const processedSubject = replaceVariables(tpl.subjectTemplate, tpl.variables, context);
    const processedBody = replaceVariables(tpl.bodyTemplate, tpl.variables, context);
    setRecipients(tpl.recipients.join(', '));
    setCc((tpl.cc || []).join(', '));
    setBcc((tpl.bcc || []).join(', '));
    setSubject(processedSubject);
    setEmailBody(processedBody);
    saveToStorage({ recipients: tpl.recipients, cc: tpl.cc || [], bcc: tpl.bcc || [], subject: processedSubject, emailBody: processedBody });
    updateTemplateStats(tpl.id);
    showStatus(t('templateApplied'));
  }, [host.content, referenceContent, saveToStorage, showStatus, t, updateTemplateStats]);

  const handleInsertSnippet = useCallback((content: string) => {
    setEmailBody(emailBody + content);
    saveToStorage({ emailBody: emailBody + content });
    showStatus(t('snippetInserted'));
  }, [emailBody, saveToStorage, showStatus, t]);

  const ctxValue = useMemo<EmailContextValue>(() => ({
    state, dispatch, saveToStorage, showStatus, t, host,
  }), [state, saveToStorage, showStatus, t, host]);

  return (
    <EmailContext.Provider value={ctxValue}>
    <>
      <div className="h-full flex flex-col">
        {/* ① 顶部工具栏 */}
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30 flex-shrink-0 flex-wrap">
          {/* 发送按钮 */}
          <Button variant="outline" size="sm" onClick={() => setSendConfirmDialogOpen(true)}
            disabled={sending || !recipients.trim() || accounts.length === 0}
            className="gap-1 h-7 text-xs">
            {sending ? (<><Loader2 className="h-3 w-3 animate-spin" />{t('sending')}</>) : (<><Send className="h-3 w-3" />{t('send')}</>)}
          </Button>

          {/* 邮件预览 */}
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" title={t('emailPreview')}
            onClick={() => setPreviewDialogOpen(true)}>
            <Eye className="h-3 w-3" />{t('preview')}
          </Button>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* 账户选择（显示账户名） */}
          {accounts.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs max-w-[180px]">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{accounts.find(a => a.id === selectedAccountId)?.name || accounts.find(a => a.id === selectedAccountId)?.email || t('selectAccount')}</span>
                  <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
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
            <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setAccountDialogOpen(true)}>
              <Settings className="h-3 w-3" />
              {t('accountSetup')}
            </Button>
          )}

          {/* 新建+模板（合并下拉） */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" title={t('newBlankEmail')}>
                <FilePlus className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={() => {
                const hasContent = recipients.trim() || subject.trim() || emailBody.trim() || attachments.length > 0;
                if (hasContent) { setNewEmailConfirmOpen(true); } else { handleNewEmail(); }
              }}>
                <FilePlus className="h-4 w-4 mr-2" />
                {t('newBlankEmail')}
              </DropdownMenuItem>
              {allTemplates.length > 0 && <DropdownMenuSeparator />}
              {allTemplates.map(tmpl => (
                <DropdownMenuItem key={tmpl.id} onClick={() => {
                  const context = { title: host.content.getDocumentMeta?.()?.title || '', content: convertMarkdownToHtml(referenceContent), date: getCurrentDateString() };
                  const processedSubject = replaceVariables(tmpl.subjectTemplate, tmpl.variables, context);
                  const processedBody = replaceVariables(tmpl.bodyTemplate, tmpl.variables, context);
                  setRecipients(tmpl.recipients.join(', '));
                  setCc((tmpl.cc || []).join(', '));
                  setBcc((tmpl.bcc || []).join(', '));
                  setSubject(processedSubject);
                  setEmailBody(processedBody);
                  dispatch({ type: 'SET_ATTACHMENTS', attachments: [] });
                  saveToStorage({ recipients: tmpl.recipients, cc: tmpl.cc || [], bcc: tmpl.bcc || [], subject: processedSubject, emailBody: processedBody, attachments: [] });
                  updateTemplateStats(tmpl.id);
                  showStatus(t('newFromTemplate', { name: tmpl.name }));
                }}>
                  <Newspaper className="h-4 w-4 mr-2" />
                  <span className="truncate">{tmpl.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTemplatesDialogOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                {t('manageTemplates')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 保存草稿 */}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={handleSaveDraft}
            title={t('draftSave')}>
            <Save className="h-3 w-3" />
          </Button>

          {/* 草稿箱 */}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setDraftsDialogOpen(true)}
            title={t('draftBox', { count: drafts.length })}>
            <Archive className="h-3 w-3" />
          </Button>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* 签名（下拉） */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" title={t('signature')}>
                <PenLine className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => { dispatch({ type: 'SET_ACTIVE_SIGNATURE', id: '' }); saveToStorage({ activeSignatureId: '' }); }}>
                <PenLine className="h-4 w-4 mr-2" />
                <span className="text-muted-foreground">{t('noSignature')}</span>
                {!activeSignatureId && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
              {signatures.map(sig => (
                <DropdownMenuItem key={sig.id} onClick={() => { dispatch({ type: 'SET_ACTIVE_SIGNATURE', id: sig.id }); saveToStorage({ activeSignatureId: sig.id }); }}>
                  <PenLine className="h-4 w-4 mr-2" />
                  {sig.name}
                  {sig.id === activeSignatureId && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSignatureDialogOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                {t('manageSignatures')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 发送设置（下拉） */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" title={t('sendSettings')}>
                <SlidersHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setRequestReadReceipt(!requestReadReceipt)}>
                <span className="w-4 text-center mr-2">{requestReadReceipt ? '✓' : ''}</span>
                {t('readReceipt')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-xs text-muted-foreground">{t('priorityLabel')}</div>
              {(['high', 'normal', 'low'] as const).map(p => (
                <DropdownMenuItem key={p} onClick={() => setEmailPriority(p)}>
                  <span className="w-4 text-center mr-2">{emailPriority === p ? '✓' : ''}</span>
                  {t(`priority_${p}`)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setKeepContentAfterSend(!keepContentAfterSend)}>
                <span className="w-4 text-center mr-2">{keepContentAfterSend ? '✓' : ''}</span>
                {t('keepContentAfterSend')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 发送历史 */}
          <span title={t('sentCount', { count: sendHistory.length })}>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
            onClick={() => setHistoryDialogOpen(true)} disabled={sendHistory.length === 0}>
            <History className="h-3 w-3" />
          </Button>
          </span>

          {/* 群发单送 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                disabled={accounts.length === 0}
                title={t('bulkSendWizard')}>
                <Users className="h-3 w-3" />
                {t('bulkPanel')}
                {bulkSend.activeJob && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => setBulkSendDialogOpen(true)}>
                <FilePlus className="h-4 w-4 mr-2" />
                {t('bulkNewJob')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkJobManagerOpen(true)}>
                <ListChecks className="h-4 w-4 mr-2" />
                {t('bulkManagerTitle')}
                {bulkSend.jobs.length > 0 && (
                  <span className="ml-auto text-[10px] text-muted-foreground">{bulkSend.jobs.length}</span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 发送队列 */}
          <span title={t('queueStatus', { pending: sendQueueStats.pending + sendQueueStats.sending, error: sendQueueStats.error })}>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
            onClick={() => setQueueDialogOpen(true)} disabled={sendQueue.length === 0}>
            {sendQueueStats.sending > 0 ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListChecks className="h-3 w-3" />}
          </Button>
          </span>

          <div className="flex-1" />
          {/* F6: 队列实时进度指示器 */}
          {(sendQueueStats.sending > 0 || sendQueueStats.pending > 0) && (
            <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs text-muted-foreground"
              onClick={() => setQueueDialogOpen(true)} title={t('queueStatus', { pending: sendQueueStats.pending + sendQueueStats.sending, error: sendQueueStats.error })}>
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('sendProgress', {
                done: sendQueueStats.success,
                total: sendQueueStats.success + sendQueueStats.sending + sendQueueStats.pending,
              })}
              {sendQueueStats.error > 0 && <span className="text-destructive ml-1">({sendQueueStats.error} {t('sendProgressFailed')})</span>}
            </Button>
          )}
        </div>

        {/* ② 功能区（不滚动，正文编辑框撑满剩余空间） */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>

          {/* 无账户时的引导 */}
          {accounts.length === 0 && (
            <div className="px-4 py-3 bg-amber-500/10 border-b flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{t('setupGuideTitle')}</span>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1 ml-6 list-decimal mb-2">
                <li>{t('setupGuideStep1')}</li>
                <li>{t('setupGuideStep2')}</li>
                <li>{t('setupGuideStep3')}</li>
              </ol>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAccountDialogOpen(true)}>
                <Settings className="h-3 w-3" />
                {t('setupGuideAction')}
              </Button>
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
              <TagInput
                value={recipients}
                onChange={handleRecipientChange}
                placeholder={t('toPlaceholder')}
                suggestions={recipientSuggestions}
                onInputChange={handleRecipientSearch}
                onFocus={() => { if (recipientSuggestions.length > 0) setShowRecipientSuggestions(true); }}
                onBlur={() => setShowRecipientSuggestions(false)}
                showSuggestions={showRecipientSuggestions}
                onSelectSuggestion={handleSelectContact}
                inputRef={recipientInputRef}
                onDuplicate={(email) => showStatus(t('duplicateRecipientRemoved', { email }))}
              />
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
                  <TagInput value={cc}
                    onChange={(v) => { setCc(v); saveToStorage({ cc: v.split(',').map(s => s.trim()).filter(Boolean) }); }}
                    placeholder={t('ccPlaceholder')}
                    onDuplicate={(email) => showStatus(t('duplicateRecipientRemoved', { email }))} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium w-[68px] flex-shrink-0 pl-1">{t('bcc')}</Label>
                  <TagInput value={bcc}
                    onChange={(v) => { setBcc(v); saveToStorage({ bcc: v.split(',').map(s => s.trim()).filter(Boolean) }); }}
                    placeholder={t('bccPlaceholder')}
                    onDuplicate={(email) => showStatus(t('duplicateRecipientRemoved', { email }))} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium w-[68px] flex-shrink-0 pl-1">{t('replyToLabel')}</Label>
                  <Input value={replyTo}
                    onChange={(e) => { setReplyTo(e.target.value); saveToStorage({ replyTo: e.target.value }); }}
                    placeholder={t('replyToPlaceholder')} className="flex-1" />
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

          {/* ── 附件区域（支持拖拽，无附件时收缩为单行按钮） ── */}
          {(attachments.length > 0 || isDragOver) ? (
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
              <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                {attachments.map(att => (
                  <span key={att.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-muted rounded text-xs max-w-[180px]">
                    <Paperclip className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{att.filename}</span>
                    {att.size > 0 && <span className="text-muted-foreground ml-0.5">({formatFileSize(att.size)})</span>}
                    <button title={t('removeAttachment')} className="ml-0.5 hover:text-destructive" onClick={() => {
                      const updated = attachments.filter(a => a.id !== att.id);
                      dispatch({ type: 'SET_ATTACHMENTS', attachments: updated });
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
                      {isWarning && !isDanger && ` ⚠ ${t('attachmentSizeNearLimit')}`}
                    </span>
                  );
                })()}
              </div>
            </div>
          ) : null}

          {/* ── AI 应用撤销条 ── */}
          {aiUndoStack.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/30 border-b text-xs">
              <RotateCcw className="h-3 w-3 text-amber-600 flex-shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">{t('aiAppliedUndo', { defaultValue: 'AI 内容已应用' })}</span>
              <button className="text-blue-600 dark:text-blue-400 hover:underline"
                onClick={() => {
                  const last = aiUndoStack[aiUndoStack.length - 1];
                  if (last.field === 'body') {
                    setEmailBody(last.oldValue);
                    saveToStorage({ emailBody: last.oldValue });
                  } else if (last.field === 'subject') {
                    setSubject(last.oldValue);
                    saveToStorage({ subject: last.oldValue });
                  }
                  setAiUndoStack(prev => prev.slice(0, -1));
                  showStatus(t('aiUndone', { defaultValue: '已撤销' }));
                }}>
                {t('aiUndo', { defaultValue: '撤销' })}
              </button>
              <button className="text-muted-foreground hover:text-foreground ml-auto"
                onClick={() => setAiUndoStack([])}
                title={t('aiDismissUndo', { defaultValue: '关闭' })}>
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* ── 正文编辑框（撑满剩余空间） ── */}
          <div className="flex-1 min-h-0 flex flex-col">
            <EmailBodyEditor
              value={emailBody}
              onChange={(html) => { setEmailBody(html); saveToStorage({ emailBody: html }); }}
              placeholder={t('bodyPlaceholder')}
              t={t}
              format={emailFormat}
              onFormatChange={(f) => {
                dispatch({ type: 'SET_FIELD', field: 'emailFormat', value: f }); saveToStorage({ emailFormat: f });
              }}
              onSaveStatus={() => { /* 编辑器保存状态 */ }}
            />
          </div>

          {/* G5: 撤销发送条 */}
          {sendQueueStats.delayed > 0 && (
            <UndoSendBar
              delayedItems={sendQueue.filter(i => i.status === 'delayed')}
              onCancel={(id) => { cancelDelayed(id); appendLog(t('sendCancelled'), 'info'); }}
              t={t}
            />
          )}

          {/* ── 底部状态栏（可折叠日志 + 摘要信息） ── */}
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
              <div className="flex items-center gap-2">
                {/* 快速摘要 + 快捷键提示 */}
                <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                  {accounts.find(a => a.id === selectedAccountId)?.email || t('noAccount')}
                  {attachments.length > 0 && ` · ${t('sendConfirmAttCount', { count: attachments.length })}`}
                  {emailFormat === 'plaintext' && ` · ${t('plainText')}`}
                </span>
                <span className="text-[10px] text-muted-foreground/40 hidden md:inline" title={t('shortcutTip')}>
                  ⌘↵ {t('shortcutSend')} · ⌘S {t('shortcutSave')}
                </span>
                {logs.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CLEAR_LOGS' }); }}>
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

      <AccountDialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}
        onSaveAccount={saveAccount} onDeleteAccount={deleteAccount} />

      <HistoryDialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}
        onResend={(entry) => {
          dispatch({ type: 'SET_FIELD', field: 'recipients', value: entry.to.join(', ') });
          dispatch({ type: 'SET_FIELD', field: 'cc', value: (entry.cc || []).join(', ') });
          dispatch({ type: 'SET_FIELD', field: 'bcc', value: (entry.bcc || []).join(', ') });
          dispatch({ type: 'SET_FIELD', field: 'subject', value: entry.subject });
          dispatch({ type: 'SET_FIELD', field: 'emailBody', value: entry.body });
          if (entry.accountId && accounts.some(a => a.id === entry.accountId)) {
            dispatch({ type: 'SET_SELECTED_ACCOUNT', id: entry.accountId });
          }
          setCurrentDraftId(null);
          showStatus(t('historyResendLoaded'));
        }} />
      <ContactDialog open={recipientsDialogOpen} onOpenChange={setRecipientsDialogOpen}
        currentRecipients={recipients}
        onUseSelected={(emailStr: string, emails: string[], append: boolean) => {
          if (append && recipients.trim()) {
            const merged = recipients.trim() + ', ' + emailStr;
            setRecipients(merged);
            const existingEmails = recipients.split(',').map(s => s.trim()).filter(Boolean);
            saveToStorage({ recipients: [...existingEmails, ...emails] });
          } else {
            setRecipients(emailStr);
            saveToStorage({ recipients: emails });
          }
        }}
        onOpenCsvImport={(headers: string[], data: string[][], emailCol: number, nameCol: number) => {
          setCsvHeaders(headers); setCsvData(data);
          setCsvEmailColumn(emailCol); setCsvNameColumn(nameCol);
          setCsvImportDialogOpen(true);
        }} />

      <SubjectDialog open={subjectsDialogOpen} onOpenChange={setSubjectsDialogOpen} />

      {/* 模板与片段管理弹窗 */}
      <TemplateDialog
        open={templatesDialogOpen}
        onOpenChange={setTemplatesDialogOpen}
        onApplyTemplate={handleApplyTemplate}
        onInsertSnippet={handleInsertSnippet}
        docTitle={host.content.getDocumentMeta?.()?.title || ''}
        docContent={convertMarkdownToHtml(referenceContent)}
      />

      <CsvImportDialog open={csvImportDialogOpen} onOpenChange={setCsvImportDialogOpen}
        csvHeaders={csvHeaders} csvData={csvData}
        csvEmailColumn={csvEmailColumn} csvNameColumn={csvNameColumn}
        onEmailColumnChange={setCsvEmailColumn} onNameColumnChange={setCsvNameColumn} />

      <SendConfirmDialog open={sendConfirmDialogOpen} onOpenChange={setSendConfirmDialogOpen}
        onSend={handleSend} onBulkSend={handleBulkSend}
        onCreateBulkJobFromCurrent={handleCreateBulkJobFromCurrent} />

      <SignatureDialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen} />
      <QueueDialog open={queueDialogOpen} onOpenChange={setQueueDialogOpen}
        queue={sendQueue} stats={sendQueueStats}
        onRetry={retryItem} onRemove={removeItem} onClearCompleted={clearQueueCompleted}
        onCancelDelayed={cancelDelayed} />
      <DraftsDialog open={draftsDialogOpen} onOpenChange={setDraftsDialogOpen}
        onLoadDraft={handleLoadDraft} onDeleteDraft={handleDeleteDraft}
        onRenameDraft={handleRenameDraft} currentDraftId={currentDraftId}
        accounts={accounts} />

      <BulkSendDialog
        open={bulkSendDialogOpen}
        onOpenChange={setBulkSendDialogOpen}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        contacts={contacts}
        contactGroups={contactGroups}
        templates={allTemplates}
        attachments={attachments}
        signatures={signatures.map(s => ({ id: s.id, name: s.name }))}
        activeSignatureId={activeSignatureId}
        currentSubject={subject}
        currentBody={emailBody}
        currentFormat={emailFormat === 'html' ? 'html' : 'text'}
        currentRecipients={recipients}
        t={t}
        onCreateJob={handleCreateBulkJob}
      />

      <BulkJobManagerDialog
        open={bulkJobManagerOpen}
        onOpenChange={setBulkJobManagerOpen}
        jobs={bulkSend.jobs}
        activeJobId={bulkSend.activeJob?.id}
        onStart={bulkSend.startJob}
        onPause={bulkSend.pauseJob}
        onResume={bulkSend.resumeJob}
        onCancel={bulkSend.cancelJob}
        onRetryFailed={bulkSend.retryFailed}
        onDelete={bulkSend.deleteJob}
        onNewJob={() => setBulkSendDialogOpen(true)}
        t={t}
      />

      {/* F4: 新建邮件确认对话框 */}
      <Dialog open={newEmailConfirmOpen} onOpenChange={setNewEmailConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>{t('newEmailConfirm')}</DialogTitle>
            <DialogDescription>{t('newEmailConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setNewEmailConfirmOpen(false)}>{t('cancel')}</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setNewEmailConfirmOpen(false); handleSaveDraft(); handleNewEmail(); }}>{t('newEmailSaveDraftFirst')}</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setNewEmailConfirmOpen(false); handleNewEmail(); }}>{t('newEmailConfirmOk')}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* 邮件预览对话框 */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[780px] max-h-[85vh] overflow-hidden flex flex-col" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{t('emailPreview')}</DialogTitle>
              <div className="flex items-center gap-0.5 border rounded-md p-0.5">
                <Button variant={previewWidth === 'mobile' ? 'secondary' : 'ghost'} size="sm" className="h-6 w-6 p-0"
                  title={t('previewMobile')} onClick={() => setPreviewWidth('mobile')}>
                  <Smartphone className="h-3 w-3" />
                </Button>
                <Button variant={previewWidth === 'tablet' ? 'secondary' : 'ghost'} size="sm" className="h-6 w-6 p-0"
                  title={t('previewTablet')} onClick={() => setPreviewWidth('tablet')}>
                  <Tablet className="h-3 w-3" />
                </Button>
                <Button variant={previewWidth === 'desktop' ? 'secondary' : 'ghost'} size="sm" className="h-6 w-6 p-0"
                  title={t('previewDesktop')} onClick={() => setPreviewWidth('desktop')}>
                  <Monitor className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <DialogDescription>{t('emailPreview')}</DialogDescription>
          </DialogHeader>
          {/* 邮件信息头 */}
          <div className="space-y-1 text-xs border rounded-md p-2 bg-muted/30">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-14 flex-shrink-0">{t('previewFrom')}</span>
              <span className="font-mono truncate">{accounts.find(a => a.id === selectedAccountId)?.email || '-'}</span>
            </div>
            <div className="flex gap-2 min-w-0">
              <span className="text-muted-foreground w-14 flex-shrink-0">{t('previewTo')}</span>
              <span className="font-mono truncate">{recipients || '-'}</span>
            </div>
            <div className="flex gap-2 min-w-0">
              <span className="text-muted-foreground w-14 flex-shrink-0">{t('previewSubject')}</span>
              <span className="font-medium truncate">{subject || '-'}</span>
            </div>
          </div>
          {/* 邮件正文预览 */}
          <div className="flex-1 min-h-0 overflow-auto border-2 rounded-md bg-white dark:border-muted flex justify-center">
            <iframe
              title="preview"
              sandbox="allow-same-origin"
              style={{ width: previewWidth === 'mobile' ? '375px' : previewWidth === 'tablet' ? '768px' : '100%' }}
              className="min-h-[350px] max-h-[500px] border-0"
              onLoad={(e) => {
                const iframe = e.currentTarget;
                try {
                  const h = iframe.contentDocument?.documentElement?.scrollHeight;
                  if (h) iframe.style.height = Math.min(Math.max(h + 16, 350), 500) + 'px';
                } catch { /* cross-origin fallback */ }
              }}
              srcDoc={(() => {
                const isPlain = emailFormat === 'plaintext';
                let body = isPlain ? emailBody.replace(/\n/g, '<br>') : emailBody;
                const activeSig = signatures.find(s => s.id === activeSignatureId);
                if (activeSig?.content) {
                  body += '<br><br>--<br>' + activeSig.content;
                }
                return inlineEmailStyles(body);
              })()}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
    </EmailContext.Provider>
  );
}
