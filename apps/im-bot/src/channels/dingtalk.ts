/**
 * 钉钉 Channel 适配器
 * 使用钉钉 Stream SDK 的 WebSocket 模式接收消息
 */

import { DWClient, type DWClientDownStream, TOPIC_ROBOT } from 'dingtalk-stream';
import { BaseChannel, type IncomingMessage, type OutgoingMessage } from './base.js';
import type { DingtalkConfig } from '../config.js';
import { getMessageText, getPlainText, truncateText } from '../formatter/card.js';
import logger from '../utils/logger.js';

const TAG = 'DingTalk';

export class DingtalkChannel extends BaseChannel {
  readonly name = 'dingtalk';
  readonly displayName = '钉钉';

  private config: DingtalkConfig;
  private client: DWClient | null = null;

  constructor(config: DingtalkConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    logger.info(TAG, '正在启动钉钉 Stream 连接...');

    this.client = new DWClient({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
    });

    this.client.registerCallbackListener(TOPIC_ROBOT, async (res: DWClientDownStream) => {
      try {
        await this.handleMessage(res);
      } catch (e) {
        logger.error(TAG, '处理消息异常:', (e as Error).message);
      }
    });

    await this.client.connect();
    logger.info(TAG, '✅ 钉钉 Stream 连接已建立');
  }

  async stop(): Promise<void> {
    // dingtalk-stream SDK 无显式 disconnect
    this.client = null;
    logger.info(TAG, '钉钉连接已关闭');
  }

  async sendReply(originalMsg: IncomingMessage, reply: OutgoingMessage): Promise<void> {
    // 钉钉 Stream 模式下，回复通过回调响应或 webhook 发送
    // 这里通过 webhook 回复（如果 raw 中包含 sessionWebhook）
    const raw = originalMsg.raw as any;
    const webhook = raw?.sessionWebhook;

    if (!webhook) {
      logger.warn(TAG, '无法回复：缺少 sessionWebhook');
      return;
    }

    try {
      const text = getMessageText(reply);
      const body = reply.markdown
        ? {
            msgtype: 'markdown',
            markdown: {
              title: 'AiDocPlus',
              text: truncateText(text, 10000),
            },
          }
        : {
            msgtype: 'text',
            text: { content: truncateText(getPlainText(reply), 10000) },
          };

      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    } catch (e) {
      logger.error(TAG, '发送消息失败:', (e as Error).message);
    }
  }

  // ============================================================
  // 内部方法
  // ============================================================

  private async handleMessage(res: DWClientDownStream): Promise<void> {
    let data: any;
    try {
      data = JSON.parse(res.data);
    } catch {
      return;
    }

    // 提取文本（钉钉消息在 text.content 中）
    const text = (data.text?.content || '').trim();
    if (!text) {
      // 回复 ACK
      this.client?.socketCallBackResponse(res.headers.messageId, '');
      return;
    }

    const isGroup = data.conversationType === '2';
    const incoming: IncomingMessage = {
      platform: 'dingtalk',
      messageId: data.msgId || '',
      senderId: data.senderStaffId || data.senderId || '',
      senderName: data.senderNick || '钉钉用户',
      text,
      isGroup,
      groupId: isGroup ? data.conversationId : undefined,
      isMentioned: true, // Stream 模式下收到的消息都是@机器人的
      raw: { ...data, sessionWebhook: data.sessionWebhook },
    };

    logger.info(TAG, `收到消息 [${incoming.senderName}]: ${truncateText(text, 50)}`);

    if (this.onMessage) {
      const reply = await this.onMessage(incoming);
      if (reply) {
        await this.sendReply(incoming, reply);
      }
    }

    // 回复 ACK
    this.client?.socketCallBackResponse(res.headers.messageId, '');
  }
}
