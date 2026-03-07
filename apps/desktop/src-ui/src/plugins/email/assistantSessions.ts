/**
 * 邮件 AI 助手 — 会话管理
 *
 * 职责：
 * - 多会话的 CRUD 操作
 * - 自动命名（取第一条用户消息前20字）
 * - 持久化到 host.storage
 * - 最多保留 30 个会话，超出自动清理最旧的
 */

import type { AssistantMessage } from '../_framework/pluginAssistantAI';

// ── 会话类型 ──

export interface AssistantSession {
  id: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: number;
  updatedAt: number;
}

const SESSIONS_KEY = '_assistant_sessions';
const ACTIVE_SESSION_KEY = '_assistant_active_session';
const MAX_SESSIONS = 30;

// ── 存储接口（与 host.storage 兼容） ──

interface StorageLike {
  get<T = unknown>(key: string): T | null;
  set(key: string, value: unknown): void;
}

// ── 生成唯一 ID ──

function genSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── 自动命名 ──

function autoTitle(messages: AssistantMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return '新对话';
  const text = firstUser.content.replace(/\n/g, ' ').trim();
  return text.length > 20 ? text.slice(0, 20) + '...' : text || '新对话';
}

// ── CRUD 操作 ──

/** 加载所有会话（按 updatedAt 降序） */
export function loadSessions(storage: StorageLike): AssistantSession[] {
  const sessions = storage.get<AssistantSession[]>(SESSIONS_KEY);
  if (!Array.isArray(sessions)) return [];
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 获取当前活跃会话 ID */
export function getActiveSessionId(storage: StorageLike): string | null {
  return storage.get<string>(ACTIVE_SESSION_KEY) || null;
}

/** 设置当前活跃会话 ID */
export function setActiveSessionId(storage: StorageLike, id: string | null): void {
  storage.set(ACTIVE_SESSION_KEY, id || '');
}

/** 保存单个会话（更新或新增） */
export function saveSession(storage: StorageLike, session: AssistantSession): void {
  let sessions = loadSessions(storage);
  const idx = sessions.findIndex(s => s.id === session.id);

  // 自动更新标题
  if (!session.title || session.title === '新对话') {
    session.title = autoTitle(session.messages);
  }
  session.updatedAt = Date.now();

  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }

  // 超出上限时清理最旧的
  if (sessions.length > MAX_SESSIONS) {
    sessions = sessions.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
  }

  storage.set(SESSIONS_KEY, sessions);
}

/** 创建新会话 */
export function createSession(): AssistantSession {
  return {
    id: genSessionId(),
    title: '新对话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** 删除会话 */
export function deleteSession(storage: StorageLike, id: string): void {
  const sessions = loadSessions(storage).filter(s => s.id !== id);
  storage.set(SESSIONS_KEY, sessions);

  // 如果删除的是当前活跃会话，清除活跃 ID
  if (getActiveSessionId(storage) === id) {
    setActiveSessionId(storage, sessions.length > 0 ? sessions[0].id : null);
  }
}

/** 重命名会话 */
export function renameSession(storage: StorageLike, id: string, title: string): void {
  const sessions = loadSessions(storage);
  const session = sessions.find(s => s.id === id);
  if (session) {
    session.title = title.trim() || autoTitle(session.messages);
    storage.set(SESSIONS_KEY, sessions);
  }
}

/** 查找会话 */
export function findSession(storage: StorageLike, id: string): AssistantSession | null {
  const sessions = loadSessions(storage);
  return sessions.find(s => s.id === id) || null;
}

/**
 * 获取或创建当前活跃会话
 * 如果没有活跃会话，自动创建一个
 */
export function getOrCreateActiveSession(storage: StorageLike): AssistantSession {
  const activeId = getActiveSessionId(storage);
  if (activeId) {
    const session = findSession(storage, activeId);
    if (session) return session;
  }

  // 没有活跃会话或已被删除，尝试用最近的
  const sessions = loadSessions(storage);
  if (sessions.length > 0) {
    setActiveSessionId(storage, sessions[0].id);
    return sessions[0];
  }

  // 完全没有会话，创建新的
  const newSession = createSession();
  saveSession(storage, newSession);
  setActiveSessionId(storage, newSession.id);
  return newSession;
}

/**
 * 迁移旧的单一消息存储到会话系统
 * 兼容升级：如果 _assistant_messages 有数据但没有会话，则迁移
 */
export function migrateOldMessages(storage: StorageLike): void {
  const oldKey = '_assistant_messages';
  const oldMessages = storage.get<AssistantMessage[]>(oldKey);
  if (!oldMessages || oldMessages.length === 0) return;

  const sessions = loadSessions(storage);
  if (sessions.length > 0) return; // 已有会话，不迁移

  const session = createSession();
  session.messages = oldMessages;
  session.title = autoTitle(oldMessages);
  session.createdAt = oldMessages[0]?.timestamp || Date.now();
  session.updatedAt = oldMessages[oldMessages.length - 1]?.timestamp || Date.now();
  saveSession(storage, session);
  setActiveSessionId(storage, session.id);
}
