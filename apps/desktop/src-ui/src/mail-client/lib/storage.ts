// ── 邮件客户端本地数据持久化（Phase 8） ──
// 存储路径：~/AiDocPlus/MailClient/

import { invoke } from '@tauri-apps/api/core';
import type { EmailAccount } from '../types/account';
import type { Contact, ContactGroup } from '../types/contact';
import type {
  SubmissionTemplate,
  EmailSignature,
  EmailDraft,
  BulkSendJob,
  SendHistoryEntry,
} from '../types/email';

const DATA_DIR = 'AiDocPlus/MailClient';

interface MailClientData {
  version: number;
  accounts: EmailAccount[];
  activeAccountId: string;
  contacts: Contact[];
  contactGroups: ContactGroup[];
  templates: SubmissionTemplate[];
  signatures: EmailSignature[];
  activeSignatureId: string;
  drafts: EmailDraft[];
  bulkJobs: BulkSendJob[];
  sendHistory: SendHistoryEntry[];
}

const DEFAULT_DATA: MailClientData = {
  version: 1,
  accounts: [],
  activeAccountId: '',
  contacts: [],
  contactGroups: [],
  templates: [],
  signatures: [],
  activeSignatureId: '',
  drafts: [],
  bulkJobs: [],
  sendHistory: [],
};

/** 获取数据文件完整路径 */
async function getDataPath(): Promise<string> {
  const home = await invoke<string>('get_home_dir');
  if (home) {
    return `${home}/${DATA_DIR}/data.json`;
  }
  throw new Error('无法获取用户主目录');
}

/** 读取邮件客户端数据 */
export async function loadMailClientData(): Promise<MailClientData> {
  try {
    const path = await getDataPath();
    const content = await invoke<string>('read_text_file', { path });
    const parsed = JSON.parse(content) as Partial<MailClientData>;
    return { ...DEFAULT_DATA, ...parsed };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

/** 保存邮件客户端数据 */
export async function saveMailClientData(data: Partial<MailClientData>): Promise<void> {
  try {
    const path = await getDataPath();
    const current = await loadMailClientData();
    const merged = { ...current, ...data };
    await invoke('write_file', {
      path,
      content: JSON.stringify(merged, null, 2),
    });
  } catch (err) {
    console.error('[MailClient] 保存数据失败:', err);
  }
}

/** 保存账户列表 */
export async function saveAccounts(accounts: EmailAccount[], activeAccountId: string): Promise<void> {
  await saveMailClientData({ accounts, activeAccountId });
}

/** 保存联系人数据 */
export async function saveContacts(contacts: Contact[], contactGroups: ContactGroup[]): Promise<void> {
  await saveMailClientData({ contacts, contactGroups });
}

/** 保存模板数据 */
export async function saveTemplates(templates: SubmissionTemplate[]): Promise<void> {
  await saveMailClientData({ templates });
}

/** 保存签名数据 */
export async function saveSignatures(signatures: EmailSignature[], activeSignatureId: string): Promise<void> {
  await saveMailClientData({ signatures, activeSignatureId });
}

/** 保存草稿数据 */
export async function saveDrafts(drafts: EmailDraft[]): Promise<void> {
  await saveMailClientData({ drafts });
}

/** 保存群发任务 */
export async function saveBulkJobs(bulkJobs: BulkSendJob[]): Promise<void> {
  await saveMailClientData({ bulkJobs });
}

/** 保存发送历史（最多保留 500 条） */
export async function saveSendHistory(sendHistory: SendHistoryEntry[]): Promise<void> {
  await saveMailClientData({ sendHistory: sendHistory.slice(0, 500) });
}
