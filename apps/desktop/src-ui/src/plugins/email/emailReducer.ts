import type {
  LogEntry, EmailAccount, AttachmentItem,
  EmailSignature, EmailStorageData, EmailDraft,
  BulkSendJob,
} from './types';

// ── State ──

export interface EmailState {
  // 账户
  accounts: EmailAccount[];
  selectedAccountId: string;
  // 邮件表单
  recipients: string;
  cc: string;
  bcc: string;
  replyTo: string;
  subject: string;
  emailBody: string;
  emailFormat: 'html' | 'plaintext';
  attachments: AttachmentItem[];
  // 签名
  signatures: EmailSignature[];
  activeSignatureId: string;
  // 日志
  logs: LogEntry[];
  // 草稿
  drafts: EmailDraft[];
  // 群发
  bulkJobs: BulkSendJob[];
}

export function createInitialState(stored: EmailStorageData): EmailState {
  return {
    accounts: stored.accounts || [],
    selectedAccountId: stored.activeAccountId || '',
    recipients: (stored.recipients || []).join(', '),
    cc: (stored.cc || []).join(', '),
    bcc: (stored.bcc || []).join(', '),
    replyTo: stored.replyTo || '',
    subject: stored.subject || '',
    emailBody: stored.emailBody || '',
    emailFormat: stored.emailFormat || 'html',
    attachments: stored.attachments || [],
    signatures: stored.signatures || [],
    activeSignatureId: stored.activeSignatureId || '',
    logs: [],
    drafts: stored.drafts || [],
    bulkJobs: stored.bulkJobs || [],
  };
}

// ── Actions ──

export type EmailAction =
  // 账户
  | { type: 'SET_ACCOUNTS'; accounts: EmailAccount[] }
  | { type: 'ADD_ACCOUNT'; account: EmailAccount }
  | { type: 'UPDATE_ACCOUNT'; account: EmailAccount }
  | { type: 'DELETE_ACCOUNT'; id: string }
  | { type: 'SET_SELECTED_ACCOUNT'; id: string }
  // 邮件表单字段
  | { type: 'SET_FIELD'; field: 'recipients' | 'cc' | 'bcc' | 'replyTo' | 'subject' | 'emailBody' | 'emailFormat'; value: string }
  // 批量设置表单（模板应用等）
  | { type: 'APPLY_FORM'; fields: Partial<Pick<EmailState, 'recipients' | 'cc' | 'bcc' | 'replyTo' | 'subject' | 'emailBody'>> }
  // 附件
  | { type: 'SET_ATTACHMENTS'; attachments: AttachmentItem[] }
  | { type: 'ADD_ATTACHMENTS'; attachments: AttachmentItem[] }
  | { type: 'REMOVE_ATTACHMENT'; id: string }
  // 签名
  | { type: 'SET_SIGNATURES'; signatures: EmailSignature[] }
  | { type: 'ADD_SIGNATURE'; signature: EmailSignature }
  | { type: 'UPDATE_SIGNATURE'; signature: EmailSignature }
  | { type: 'DELETE_SIGNATURE'; id: string }
  | { type: 'SET_ACTIVE_SIGNATURE'; id: string }
  // 日志
  | { type: 'APPEND_LOG'; entry: LogEntry }
  | { type: 'CLEAR_LOGS' }
  // 草稿
  | { type: 'SAVE_DRAFT'; draft: EmailDraft }
  | { type: 'DELETE_DRAFT'; id: string }
  | { type: 'LOAD_DRAFT'; draft: EmailDraft }
  // 群发任务
  | { type: 'SET_BULK_JOBS'; jobs: BulkSendJob[] }
  | { type: 'ADD_BULK_JOB'; job: BulkSendJob }
  | { type: 'UPDATE_BULK_JOB'; job: BulkSendJob }
  | { type: 'DELETE_BULK_JOB'; id: string };

// ── Reducer ──

export function emailReducer(state: EmailState, action: EmailAction): EmailState {
  switch (action.type) {
    // ── 账户 ──
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.accounts };

    case 'ADD_ACCOUNT': {
      const exists = state.accounts.find(a => a.id === action.account.id);
      return {
        ...state,
        accounts: exists
          ? state.accounts.map(a => a.id === action.account.id ? action.account : a)
          : [...state.accounts, action.account],
        selectedAccountId: state.selectedAccountId || action.account.id,
      };
    }

    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map(a => a.id === action.account.id ? action.account : a),
      };

    case 'DELETE_ACCOUNT': {
      const next = state.accounts.filter(a => a.id !== action.id);
      return {
        ...state,
        accounts: next,
        selectedAccountId: state.selectedAccountId === action.id
          ? (next.length > 0 ? next[0].id : '')
          : state.selectedAccountId,
      };
    }

    case 'SET_SELECTED_ACCOUNT':
      return { ...state, selectedAccountId: action.id };

    // ── 邮件表单 ──
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'APPLY_FORM':
      return { ...state, ...action.fields };

    // ── 附件 ──
    case 'SET_ATTACHMENTS':
      return { ...state, attachments: action.attachments };

    case 'ADD_ATTACHMENTS':
      return { ...state, attachments: [...state.attachments, ...action.attachments] };

    case 'REMOVE_ATTACHMENT':
      return { ...state, attachments: state.attachments.filter(a => a.id !== action.id) };

    // ── 签名 ──
    case 'SET_SIGNATURES':
      return { ...state, signatures: action.signatures };

    case 'ADD_SIGNATURE':
      return { ...state, signatures: [...state.signatures, action.signature] };

    case 'UPDATE_SIGNATURE':
      return {
        ...state,
        signatures: state.signatures.map(s => s.id === action.signature.id ? action.signature : s),
      };

    case 'DELETE_SIGNATURE': {
      return {
        ...state,
        signatures: state.signatures.filter(s => s.id !== action.id),
        activeSignatureId: state.activeSignatureId === action.id ? '' : state.activeSignatureId,
      };
    }

    case 'SET_ACTIVE_SIGNATURE':
      return { ...state, activeSignatureId: action.id };

    // ── 日志 ──
    case 'APPEND_LOG':
      return { ...state, logs: [...state.logs, action.entry] };

    case 'CLEAR_LOGS':
      return { ...state, logs: [] };

    // ── 草稿 ──
    case 'SAVE_DRAFT': {
      const exists = state.drafts.findIndex(d => d.id === action.draft.id);
      const drafts = exists >= 0
        ? state.drafts.map(d => d.id === action.draft.id ? action.draft : d)
        : [action.draft, ...state.drafts];
      return { ...state, drafts };
    }

    case 'DELETE_DRAFT':
      return { ...state, drafts: state.drafts.filter(d => d.id !== action.id) };

    case 'LOAD_DRAFT':
      return {
        ...state,
        recipients: action.draft.recipients,
        cc: action.draft.cc,
        bcc: action.draft.bcc,
        subject: action.draft.subject,
        emailBody: action.draft.emailBody,
        emailFormat: action.draft.emailFormat,
        attachments: action.draft.attachments,
        activeSignatureId: action.draft.activeSignatureId,
        selectedAccountId: action.draft.accountId || state.selectedAccountId,
      };

    // ── 群发任务 ──
    case 'SET_BULK_JOBS':
      return { ...state, bulkJobs: action.jobs };

    case 'ADD_BULK_JOB':
      return { ...state, bulkJobs: [...state.bulkJobs, action.job] };

    case 'UPDATE_BULK_JOB':
      return {
        ...state,
        bulkJobs: state.bulkJobs.map(j => j.id === action.job.id ? action.job : j),
      };

    case 'DELETE_BULK_JOB':
      return { ...state, bulkJobs: state.bulkJobs.filter(j => j.id !== action.id) };

    default:
      return state;
  }
}
