/**
 * 会话状态管理器
 * 管理每个用户的多轮交互上下文（如模板写作流程）
 */

import logger from './utils/logger.js';

const TAG = 'Session';

// ============================================================
// 类型定义
// ============================================================

/** 会话步骤 */
export type SessionStep =
  | 'select_template'      // 选择模板
  | 'fill_variables'       // 填写变量
  | 'confirm_generate'     // 确认生成
  | 'review_result';       // 审阅结果

/** 模板变量 */
export interface TemplateVariable {
  name: string;
  description?: string;
  value?: string;
}

/** 会话数据 */
export interface SessionData {
  /** 会话创建时间 */
  createdAt: number;
  /** 最后活跃时间 */
  lastActiveAt: number;
  /** 当前步骤 */
  step: SessionStep;
  /** 选中的模板 ID */
  templateId?: string;
  /** 选中的模板名称 */
  templateName?: string;
  /** 模板内容（prompt） */
  templateContent?: string;
  /** 需要填写的变量 */
  variables?: TemplateVariable[];
  /** AI 生成的内容 */
  generatedContent?: string;
  /** 目标项目 ID */
  projectId?: string;
  /** 当前模板列表页码（用于翻页） */
  templatePage?: number;
  /** 搜索关键词（用于模板筛选） */
  searchKeyword?: string;
  /** 缓存的模板列表（避免重复请求） */
  cachedTemplates?: Array<{ id: string; name: string; category: string }>;
}

// ============================================================
// 会话管理器
// ============================================================

/** 会话超时时间：5 分钟 */
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
/** 清理检查间隔：1 分钟 */
const CLEANUP_INTERVAL_MS = 60 * 1000;

export class SessionManager {
  private sessions = new Map<string, SessionData>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * 生成用户唯一键（平台 + 用户ID）
   */
  static userKey(platform: string, userId: string): string {
    return `${platform}:${userId}`;
  }

  /**
   * 获取用户会话
   */
  get(userKey: string): SessionData | null {
    const session = this.sessions.get(userKey);
    if (!session) return null;

    // 检查超时
    if (Date.now() - session.lastActiveAt > SESSION_TIMEOUT_MS) {
      this.sessions.delete(userKey);
      logger.info(TAG, `会话已过期: ${userKey}`);
      return null;
    }

    // 更新活跃时间
    session.lastActiveAt = Date.now();
    return session;
  }

  /**
   * 检查用户是否有活跃会话
   */
  has(userKey: string): boolean {
    return this.get(userKey) !== null;
  }

  /**
   * 创建新会话
   */
  create(userKey: string, step: SessionStep, data?: Partial<SessionData>): SessionData {
    const session: SessionData = {
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      step,
      ...data,
    };
    this.sessions.set(userKey, session);
    logger.info(TAG, `新建会话: ${userKey} → ${step}`);
    return session;
  }

  /**
   * 更新会话
   */
  update(userKey: string, data: Partial<SessionData>): SessionData | null {
    const session = this.get(userKey);
    if (!session) return null;

    Object.assign(session, data, { lastActiveAt: Date.now() });
    return session;
  }

  /**
   * 删除用户会话
   */
  remove(userKey: string): void {
    this.sessions.delete(userKey);
    logger.info(TAG, `会话已结束: ${userKey}`);
  }

  /**
   * 清理过期会话
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, session] of this.sessions) {
      if (now - session.lastActiveAt > SESSION_TIMEOUT_MS) {
        this.sessions.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info(TAG, `清理了 ${cleaned} 个过期会话`);
    }
  }

  /**
   * 销毁管理器（停止定时器）
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.sessions.clear();
  }
}

// ============================================================
// 全局单例
// ============================================================

export const sessionManager = new SessionManager();
