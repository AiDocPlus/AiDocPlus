/**
 * AiDocPlus API 桥接客户端
 * 通过本地 HTTP Server 与 AiDocPlus 桌面应用通信
 */

import { readApiJson, type AiDocPlusConnection } from './config.js';
import logger from './utils/logger.js';

// Node.js 原生 fetch (undici) 会读取 ALL_PROXY 环境变量，
// 导致 localhost 请求也走 SOCKS5 代理而失败。
// 清除 ALL_PROXY 让本地 API 调用直连，HTTP_PROXY/HTTPS_PROXY 保留供外网使用。
delete process.env.ALL_PROXY;
delete process.env.all_proxy;

const TAG = 'Bridge';

// ============================================================
// 错误类
// ============================================================

export class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'ApiError';
    this.code = code;
  }
}

// ============================================================
// 客户端
// ============================================================

export class AiDocPlusClient {
  private baseUrl: string;
  private token: string;
  private reqCounter = 0;

  constructor(connection: AiDocPlusConnection) {
    this.baseUrl = `http://127.0.0.1:${connection.port}`;
    this.token = connection.token;
    logger.info(TAG, `已连接到 AiDocPlus (127.0.0.1:${connection.port})`);
  }

  /**
   * 调用 AiDocPlus API
   */
  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    this.reqCounter++;
    const reqId = `bot_${this.reqCounter}`;

    const payload = JSON.stringify({ method, params, id: reqId });

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-Caller-Level': 'script',
        },
        body: payload,
        signal: AbortSignal.timeout(60000),
      });

      const body = await response.json() as { result?: unknown; error?: { code?: number; message?: string } };

      if (body.error) {
        throw new ApiError(body.error.code || 500, body.error.message || '未知错误');
      }

      return body.result;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new Error(`无法连接到 AiDocPlus: ${(e as Error).message}`);
    }
  }

  /**
   * 检查 AiDocPlus 是否在线
   */
  async isAlive(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/status`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ============================================================
  // 便捷方法（按命名空间）
  // ============================================================

  async appStatus() {
    return this.call('app.status');
  }

  async projectList() {
    return this.call('project.list');
  }

  async documentList(params: { projectId?: string } = {}) {
    return this.call('document.list', params);
  }

  async documentGet(params: { projectId: string; documentId: string }) {
    return this.call('document.get', params);
  }

  async documentCreate(params: { projectId: string; title: string; content?: string }) {
    return this.call('document.create', params);
  }

  async searchDocuments(params: { query: string }) {
    return this.call('search.documents', params);
  }

  async aiGenerate(params: { prompt: string; systemPrompt?: string; temperature?: number; maxTokens?: number }) {
    return this.call('ai.generate', params);
  }

  async aiChat(params: { messages: Array<{ role: string; content: string }>; systemPrompt?: string }) {
    return this.call('ai.chat', params);
  }

  async templateList() {
    return this.call('template.list');
  }

  async getActiveProjectId(): Promise<string | null> {
    const result = await this.call('app.getActiveProjectId');
    // API 可能直接返回字符串，也可能返回 { projectId: string }
    if (typeof result === 'string') return result || null;
    return (result as { projectId?: string })?.projectId || null;
  }

  async getActiveDocument() {
    return this.call('app.getActiveDocument');
  }

  async getSelectedText(): Promise<string | null> {
    const result = await this.call('app.getSelectedText');
    // API 可能直接返回字符串，也可能返回 { text: string }
    if (typeof result === 'string') return result || null;
    return (result as { text?: string })?.text || null;
  }

  async templateGetContent(params: { templateId: string }) {
    return this.call('template.getContent', params);
  }

  async documentSave(params: { projectId: string; documentId: string; content?: string; aiGeneratedContent?: string; authorNotes?: string; title?: string }) {
    return this.call('document.save', params);
  }

  async exportDocument(params: { projectId: string; documentId: string; format: string }) {
    return this.call(`export.${params.format}`, {
      projectId: params.projectId,
      documentId: params.documentId,
    });
  }
}

// ============================================================
// 单例管理
// ============================================================

let clientInstance: AiDocPlusClient | null = null;

/**
 * 获取或创建 AiDocPlus 客户端
 * 自动从 ~/.aidocplus/api.json 读取连接信息
 */
export function getClient(): AiDocPlusClient | null {
  if (clientInstance) return clientInstance;

  const conn = readApiJson();
  if (!conn) {
    logger.warn(TAG, 'AiDocPlus 未运行或 api.json 不存在');
    return null;
  }

  clientInstance = new AiDocPlusClient(conn);
  return clientInstance;
}

/**
 * 重置客户端（当 AiDocPlus 重启时使用）
 */
export function resetClient(): void {
  clientInstance = null;
}

/**
 * 确保客户端可用，不可用时抛出友好错误
 */
export function requireClient(): AiDocPlusClient {
  const client = getClient();
  if (!client) {
    throw new Error('AiDocPlus 桌面应用未运行，请先启动 AiDocPlus。');
  }
  return client;
}
