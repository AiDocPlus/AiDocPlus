/**
 * QQ Channel 适配器
 * 使用 QQ 官方 Bot API v2 的 WebSocket 模式接收消息
 *
 * QQ 官方机器人 WebSocket 连接流程：
 * 1. 通过 REST API 获取 WebSocket 连接地址 (gateway)
 * 2. 建立 WebSocket 连接
 * 3. 发送 Identify 鉴权
 * 4. 维持心跳
 * 5. 接收并处理消息事件
 */

import WebSocket from 'ws';
import { BaseChannel, type IncomingMessage, type OutgoingMessage } from './base.js';
import type { QQConfig } from '../config.js';
import { getPlainText, truncateText } from '../formatter/card.js';
import logger from '../utils/logger.js';

const TAG = 'QQ';

// QQ Bot API
const QQ_API_BASE = 'https://api.sgroup.qq.com';
const QQ_SANDBOX_API = 'https://sandbox.api.sgroup.qq.com';

interface QQAccessToken {
  access_token: string;
  expires_in: number;
}

export class QQChannel extends BaseChannel {
  readonly name = 'qq';
  readonly displayName = 'QQ';

  private config: QQConfig;
  private ws: WebSocket | null = null;
  private accessToken: string | null = null;
  private tokenExpiry = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private lastSeq: number | null = null;
  private useSandbox = false;

  constructor(config: QQConfig) {
    super();
    this.config = config;
  }

  private get apiBase(): string {
    return this.useSandbox ? QQ_SANDBOX_API : QQ_API_BASE;
  }

  async start(): Promise<void> {
    logger.info(TAG, '正在启动 QQ 机器人连接...');

    // 获取 access_token
    await this.refreshAccessToken();

    // 获取 WebSocket Gateway
    const gateway = await this.getGateway();
    if (!gateway) {
      logger.error(TAG, '无法获取 WebSocket 地址');
      return;
    }

    // 建立 WebSocket 连接
    await this.connectWebSocket(gateway);

    logger.info(TAG, '✅ QQ 机器人连接已建立');
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    logger.info(TAG, 'QQ 连接已关闭');
  }

  async sendReply(originalMsg: IncomingMessage, reply: OutgoingMessage): Promise<void> {
    const token = await this.getAccessToken();
    if (!token) {
      logger.error(TAG, '无法发送消息：access_token 不可用');
      return;
    }

    const raw = originalMsg.raw as any;
    const text = getPlainText(reply);

    try {
      // 群聊消息回复
      if (originalMsg.isGroup && originalMsg.groupId) {
        const url = `${this.apiBase}/v2/groups/${originalMsg.groupId}/messages`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `QQBot ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: truncateText(text, 2000),
            msg_type: 0,
            msg_id: originalMsg.messageId,
            msg_seq: raw?.msg_seq ? raw.msg_seq + 1 : 1,
          }),
          signal: AbortSignal.timeout(10000),
        });
      }
      // 私聊/频道消息回复
      else if (raw?.channel_id) {
        const url = `${this.apiBase}/channels/${raw.channel_id}/messages`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `QQBot ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: truncateText(text, 2000),
            msg_id: originalMsg.messageId,
          }),
          signal: AbortSignal.timeout(10000),
        });
      }
      // C2C 私聊
      else {
        const url = `${this.apiBase}/v2/users/${originalMsg.senderId}/messages`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `QQBot ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: truncateText(text, 2000),
            msg_type: 0,
            msg_id: originalMsg.messageId,
            msg_seq: raw?.msg_seq ? raw.msg_seq + 1 : 1,
          }),
          signal: AbortSignal.timeout(10000),
        });
      }
    } catch (e) {
      logger.error(TAG, '发送消息失败:', (e as Error).message);
    }
  }

  // ============================================================
  // access_token 管理
  // ============================================================

  private async refreshAccessToken(): Promise<void> {
    try {
      const resp = await fetch('https://bots.qq.com/app/getAppAccessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: this.config.appId,
          clientSecret: this.config.appSecret,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await resp.json()) as QQAccessToken;
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      logger.info(TAG, 'access_token 已刷新');
    } catch (e) {
      logger.error(TAG, '获取 access_token 失败:', (e as Error).message);
    }
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
    return this.accessToken;
  }

  // ============================================================
  // WebSocket 连接
  // ============================================================

  private async getGateway(): Promise<string | null> {
    try {
      const token = await this.getAccessToken();
      const resp = await fetch(`${this.apiBase}/gateway`, {
        headers: { 'Authorization': `QQBot ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      const data = (await resp.json()) as { url?: string };
      return data.url || null;
    } catch (e) {
      logger.error(TAG, '获取 Gateway 失败:', (e as Error).message);
      return null;
    }
  }

  private async connectWebSocket(gatewayUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(gatewayUrl);

      this.ws.on('open', () => {
        logger.info(TAG, 'WebSocket 已连接');
      });

      this.ws.on('message', async (data: WebSocket.RawData) => {
        try {
          const payload = JSON.parse(data.toString());
          await this.handleWsPayload(payload);
          if (payload.op === 0 && !this.sessionId) {
            // Ready 事件
          }
        } catch (e) {
          logger.error(TAG, '处理 WS 消息异常:', (e as Error).message);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        logger.warn(TAG, `WebSocket 已断开: ${code} ${reason.toString()}`);
        this.scheduleReconnect(gatewayUrl);
      });

      this.ws.on('error', (err: Error) => {
        logger.error(TAG, 'WebSocket 错误:', err.message);
      });

      // 超时后 resolve（连接建立后等待 Hello）
      setTimeout(() => resolve(), 5000);
    });
  }

  private scheduleReconnect(gatewayUrl: string): void {
    logger.info(TAG, '5 秒后重连...');
    setTimeout(async () => {
      try {
        await this.connectWebSocket(gatewayUrl);
      } catch (e) {
        logger.error(TAG, '重连失败:', (e as Error).message);
      }
    }, 5000);
  }

  private async handleWsPayload(payload: any): Promise<void> {
    const { op, s, t, d } = payload;

    // 保存序列号
    if (s) this.lastSeq = s;

    switch (op) {
      case 10: // Hello
        this.startHeartbeat(d.heartbeat_interval);
        await this.sendIdentify();
        break;

      case 11: // Heartbeat ACK
        break;

      case 0: // Dispatch
        if (t === 'READY') {
          this.sessionId = d.session_id;
          logger.info(TAG, `鉴权成功，session: ${this.sessionId}`);
        } else if (t === 'GROUP_AT_MESSAGE_CREATE' || t === 'AT_MESSAGE_CREATE' || t === 'C2C_MESSAGE_CREATE') {
          await this.handleMessageEvent(t, d);
        }
        break;

      default:
        logger.debug(TAG, `收到 op=${op} t=${t}`);
    }
  }

  private async sendIdentify(): Promise<void> {
    const token = await this.getAccessToken();
    const identify = {
      op: 2,
      d: {
        token: `QQBot ${token}`,
        intents: 0 | (1 << 25) | (1 << 30) | (1 << 12), // GROUP_AT_MESSAGE | C2C_MESSAGE | AT_MESSAGE
        shard: [0, 1],
      },
    };
    this.ws?.send(JSON.stringify(identify));
    logger.debug(TAG, '已发送 Identify');
  }

  private startHeartbeat(interval: number): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 1, d: this.lastSeq }));
      }
    }, interval);
  }

  // ============================================================
  // 消息处理
  // ============================================================

  private async handleMessageEvent(eventType: string, data: any): Promise<void> {
    const text = (data.content || '').replace(/<@!\d+>/g, '').trim();
    if (!text) return;

    const isGroup = eventType === 'GROUP_AT_MESSAGE_CREATE';
    const isC2C = eventType === 'C2C_MESSAGE_CREATE';

    const incoming: IncomingMessage = {
      platform: 'qq',
      messageId: data.id || '',
      senderId: data.author?.id || data.author?.member_openid || '',
      senderName: data.author?.username || 'QQ用户',
      text,
      isGroup,
      groupId: isGroup ? data.group_openid : (isC2C ? undefined : data.channel_id),
      isMentioned: eventType !== 'C2C_MESSAGE_CREATE',
      raw: { ...data, channel_id: data.channel_id, msg_seq: data.msg_seq },
    };

    logger.info(TAG, `收到消息 [${incoming.senderName}]: ${truncateText(text, 50)}`);

    if (this.onMessage) {
      const reply = await this.onMessage(incoming);
      if (reply) {
        await this.sendReply(incoming, reply);
      }
    }
  }
}
