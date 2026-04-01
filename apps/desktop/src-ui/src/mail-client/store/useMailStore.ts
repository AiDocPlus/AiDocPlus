// ── 邮件客户端全局状态管理 ──

import { create } from 'zustand';
import type { MailView } from '../types/email';
import type { EmailAccount } from '../types/account';
import type { Contact, ContactGroup } from '../types/contact';
import type {
  SubmissionTemplate,
  TextSnippet,
  EmailSignature,
  EmailDraft,
  BulkSendJob,
  SendHistoryEntry,
} from '../types/email';

/** 回复草稿上下文（从收件箱回复时传入） */
export interface ReplyContext {
  to: string;
  subject: string;
  quotedBody: string;
  fromName?: string;
}

interface MailStore {
  // ── 导航 ──
  currentView: MailView;
  setCurrentView: (view: MailView) => void;

  // ── AI 面板 ──
  aiPanelVisible: boolean;
  toggleAiPanel: () => void;

  // ── 账户 ──
  accounts: EmailAccount[];
  activeAccountId: string;
  setAccounts: (accounts: EmailAccount[]) => void;
  setActiveAccountId: (id: string) => void;

  // ── 联系人 ──
  contacts: Contact[];
  contactGroups: ContactGroup[];
  setContacts: (contacts: Contact[]) => void;
  setContactGroups: (groups: ContactGroup[]) => void;

  // ── 模板 ──
  templates: SubmissionTemplate[];
  textSnippets: TextSnippet[];
  setTemplates: (templates: SubmissionTemplate[]) => void;
  setTextSnippets: (snippets: TextSnippet[]) => void;

  // ── 签名 ──
  signatures: EmailSignature[];
  activeSignatureId: string;
  setSignatures: (sigs: EmailSignature[]) => void;
  setActiveSignatureId: (id: string) => void;

  // ── 草稿 ──
  drafts: EmailDraft[];
  setDrafts: (drafts: EmailDraft[]) => void;
  addOrUpdateDraft: (draft: EmailDraft) => void;
  deleteDraft: (id: string) => void;

  // ── 群发 ──
  bulkJobs: BulkSendJob[];
  setBulkJobs: (jobs: BulkSendJob[]) => void;

  // ── 发送历史 ──
  sendHistory: SendHistoryEntry[];
  setSendHistory: (history: SendHistoryEntry[]) => void;
  addHistoryEntry: (entry: SendHistoryEntry) => void;

  // ── 草稿编辑信号（草稿箱→写邮件） ──
  openDraftId: string | null;
  setOpenDraftId: (id: string | null) => void;

  // ── 回复上下文（收件箱→写邮件） ──
  replyContext: ReplyContext | null;
  setReplyContext: (ctx: ReplyContext | null) => void;

  // ── 加载状态 ──
  initialized: boolean;
  setInitialized: (v: boolean) => void;
}

export const useMailStore = create<MailStore>((set) => ({
  // 导航
  currentView: 'compose',
  setCurrentView: (view) => set({ currentView: view }),

  // AI 面板
  aiPanelVisible: true,
  toggleAiPanel: () => set((s) => ({ aiPanelVisible: !s.aiPanelVisible })),

  // 账户
  accounts: [],
  activeAccountId: '',
  setAccounts: (accounts) => set({ accounts }),
  setActiveAccountId: (id) => set({ activeAccountId: id }),

  // 联系人
  contacts: [],
  contactGroups: [],
  setContacts: (contacts) => set({ contacts }),
  setContactGroups: (groups) => set({ contactGroups: groups }),

  // 模板
  templates: [],
  textSnippets: [],
  setTemplates: (templates) => set({ templates }),
  setTextSnippets: (snippets) => set({ textSnippets: snippets }),

  // 签名
  signatures: [],
  activeSignatureId: '',
  setSignatures: (sigs) => set({ signatures: sigs }),
  setActiveSignatureId: (id) => set({ activeSignatureId: id }),

  // 草稿
  drafts: [],
  setDrafts: (drafts) => set({ drafts }),
  addOrUpdateDraft: (draft) =>
    set((s) => {
      const exists = s.drafts.some((d) => d.id === draft.id);
      return {
        drafts: exists
          ? s.drafts.map((d) => (d.id === draft.id ? draft : d))
          : [...s.drafts, draft],
      };
    }),
  deleteDraft: (id) => set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),

  // 群发
  bulkJobs: [],
  setBulkJobs: (jobs) => set({ bulkJobs: jobs }),

  // 发送历史
  sendHistory: [],
  setSendHistory: (history) => set({ sendHistory: history }),
  addHistoryEntry: (entry) =>
    set((s) => ({ sendHistory: [entry, ...s.sendHistory].slice(0, 500) })),

  // 草稿编辑信号
  openDraftId: null,
  setOpenDraftId: (id) => set({ openDraftId: id }),

  // 回复上下文
  replyContext: null,
  setReplyContext: (ctx) => set({ replyContext: ctx }),

  // 加载状态
  initialized: false,
  setInitialized: (v) => set({ initialized: v }),
}));
