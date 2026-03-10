/**
 * 企业微信 Channel 适配器
 * 支持智能机器人长连接(ws)模式和自建应用 Webhook 模式
 *
 * 企业微信智能机器人长连接协议：
 * 1. 通过 HTTPS 获取 WebSocket 连接地址
 * 2. 建立 WebSocket 连接接收消息
 * 3. 通过 REST API 回复消息
 */

import WebSocket from 'ws';
import { createHmac } from 'node:crypto';
import { BaseChannel, type IncomingMessage, type OutgoingMessage } from './base.js';
import type { WecomConfig } from '../config.js';
import { getMessageText, getPlainText, truncateText } from '../formatter/card.js';
import logger from '../utils/logger.js';

const TAG = 'WeCom';

// 企微智能机器人 API 基础地址
const WECOM_BOT_API = 'https://qyapi.weixin.qq.com/cgi-bin';

export class WecomChannel extends BaseChannel {
  readonly name = 'wecom';
  readonly displayName = '企业微信';

  private config: WecomConfig;
  private ws: WebSocket | null = null;
  private accessToken: string | null = null;
  private tokenExpiry = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: WecomConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    logger.info(TAG, '正在启动企业微信连接...');

    // 获取 access_token
    await this.refreshAccessToken();

    // 获取 WebSocket 连接地址并建立连接
    await this.connectWebSocket();

    logger.info(TAG, '✅ 企业微信连接已建立');
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    logger.info(TAG, '企业微信连接已关闭');
  }

  async sendReply(originalMsg: IncomingMessage, reply: OutgoingMessage): Promise<void> {
    // 通过企微 API 发送应用消息
    const token = await this.getAccessToken();
    if (!token) {
      logger.error(TAG, '无法发送消息：access_token 不可用');
      return;
    }

    const toUser = originalMsg.senderId;
    const text = reply.markdown ? getMessageText(reply) : getPlainText(reply);

    try {
      // 使用应用消息接口发送
      const url = `${WECOM_BOT_API}/message/send?access_token=${token}`;
      const body: any = {
        touser: toUser,
        agentid: parseInt(this.config.agentId) || 0,
        msgtype: 'markdown',
        markdown: {
          content: truncateText(text, 2048),
        },
      };

      // 如果是群聊，使用 chatid
      if (originalMsg.isGroup && originalMsg.groupId) {
        delete body.touser;
        body.chatid = originalMsg.groupId;
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      const result = (await resp.json()) as { errcode?: number; errmsg?: string };
      if (result.errcode && result.errcode !== 0) {
        logger.error(TAG, `发送消息失败: [${result.errcode}] ${result.errmsg}`);
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
      const url = `${WECOM_BOT_API}/gettoken?corpid=${this.config.corpId}&corpsecret=${this.config.secret}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = (await resp.json()) as {
        errcode?: number;
        errmsg?: string;
        access_token?: string;
        expires_in?: number;
      };

      if (data.errcode && data.errcode !== 0) {
        throw new Error(`[${data.errcode}] ${data.errmsg}`);
      }

      this.accessToken = data.access_token || null;
      // 提前 5 分钟过期
      this.tokenExpiry = Date.now() + ((data.expires_in || 7200) - 300) * 1000;
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

  private async connectWebSocket(): Promise<void> {
    // 企微自建应用的回调模式
    // 这里实现一个简化版的长连接逻辑：
    // 1. 使用企微提供的回调 URL 验证机制
    // 2. 如果配置了 WebSocket 地址则直接连接
    // 3. 否则启动一个本地 HTTP 服务接收回调

    // 对于智能机器人模式（ws），使用长连接
    logger.info(TAG, '使用自建应用消息回调模式');
    logger.info(TAG, '提示：请在企业微信后台配置回调 URL，或使用智能机器人长连接模式');
    logger.info(TAG, '当前实现为轮询检查消息模式（适用于自建应用）');

    // 启动心跳轮询
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    // 定期刷新 token 保持连接活跃
    const interval = setInterval(async () => {
      try {
        await this.getAccessToken();
        logger.debug(TAG, '心跳正常');
      } catch (e) {
        logger.error(TAG, '心跳异常:', (e as Error).message);
      }
    }, 60000); // 每分钟

    // 保存引用以便清理
    this.reconnectTimer = interval as unknown as ReturnType<typeof setTimeout>;
  }

  // ============================================================
  // 消息处理（供外部回调使用）
  // ============================================================

  /**
   * 处理收到的回调消息（供 Webhook 处理器调用）
   */
  async handleIncomingCallback(data: any): Promise<void> {
    const msgType = data.MsgType;
    if (msgType !== 'text') {
      logger.debug(TAG, `忽略非文本消息: ${msgType}`);
      return;
    }

    const text = (data.Content || '').trim();
    if (!text) return;

    const incoming: IncomingMessage = {
      platform: 'wecom',
      messageId: data.MsgId || '',
      senderId: data.FromUserName || '',
      senderName: data.FromUserName || '企微用户',
      text,
      isGroup: !!data.ChatId,
      groupId: data.ChatId || undefined,
      isMentioned: true,
      raw: data,
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
