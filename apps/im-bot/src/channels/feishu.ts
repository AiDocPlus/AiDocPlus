/**
 * 飞书 Channel 适配器
 * 使用飞书官方 Node.js SDK 的长连接模式接收消息
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { BaseChannel, type IncomingMessage, type OutgoingMessage } from './base.js';
import type { FeishuConfig } from '../config.js';
import { toFeishuCard, getPlainText, truncateText } from '../formatter/card.js';
import logger from '../utils/logger.js';

const TAG = 'Feishu';

export class FeishuChannel extends BaseChannel {
  readonly name = 'feishu';
  readonly displayName = '飞书';

  private config: FeishuConfig;
  private client: lark.Client;
  private wsClient: any = null;
  // 消息去重：飞书长连接模式下处理耗时较长时 SDK 会重发同一条消息
  private processedMsgIds = new Map<string, number>();
  private dedupeTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly DEDUPE_TTL_MS = 5 * 60 * 1000; // 5 分钟

  constructor(config: FeishuConfig) {
    super();
    this.config = config;
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      disableTokenCache: false,
    });
  }

  async start(): Promise<void> {
    logger.info(TAG, '正在启动飞书长连接...');

    const eventDispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: any) => {
        try {
          await this.handleMessage(data);
        } catch (e) {
          logger.error(TAG, '处理消息异常:', (e as Error).message);
        }
      },
    });

    this.wsClient = new lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      loggerLevel: lark.LoggerLevel.warn,
    });

    await this.wsClient.start({ eventDispatcher });
    logger.info(TAG, '✅ 飞书长连接已建立');
  }

  async stop(): Promise<void> {
    if (this.dedupeTimer) {
      clearInterval(this.dedupeTimer);
      this.dedupeTimer = null;
    }
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    logger.info(TAG, '飞书连接已关闭');
  }

  async sendReply(originalMsg: IncomingMessage, reply: OutgoingMessage): Promise<void> {
    const receiveId = originalMsg.isGroup ? originalMsg.groupId! : originalMsg.senderId;
    const receiveIdType = originalMsg.isGroup ? 'chat_id' : 'open_id';

    logger.debug(TAG, `准备回复 -> ${receiveIdType}:${receiveId}`);

    try {
      if (reply.markdown || reply.card) {
        // 使用消息卡片（支持 Markdown 渲染）
        const card = reply.card || toFeishuCard(reply);
        const resp = await this.client.im.message.create({
          params: { receive_id_type: receiveIdType },
          data: {
            receive_id: receiveId,
            msg_type: 'interactive',
            content: JSON.stringify(card),
          },
        });
        logger.info(TAG, `✅ 卡片消息已发送, msg_id=${(resp as any)?.message_id || 'unknown'}`);
      } else {
        // 纯文本
        const text = truncateText(getPlainText(reply), 4000);
        const resp = await this.client.im.message.create({
          params: { receive_id_type: receiveIdType },
          data: {
            receive_id: receiveId,
            msg_type: 'text',
            content: JSON.stringify({ text }),
          },
        });
        logger.info(TAG, `✅ 文本消息已发送, msg_id=${(resp as any)?.message_id || 'unknown'}`);
      }
    } catch (e: any) {
      logger.error(TAG, '发送消息失败:', e?.message || e);
      if (e?.response?.data) {
        logger.error(TAG, '详细错误:', JSON.stringify(e.response.data));
      }
    }
  }

  // ============================================================
  // 内部方法
  // ============================================================

  private startDedupeCleanup(): void {
    if (this.dedupeTimer) return;
    this.dedupeTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, ts] of this.processedMsgIds) {
        if (now - ts > FeishuChannel.DEDUPE_TTL_MS) {
          this.processedMsgIds.delete(id);
        }
      }
    }, 30_000);
  }

  private async handleMessage(data: any): Promise<void> {
    const message = data?.message;
    if (!message) return;

    // 消息去重：跳过已处理的 message_id
    const msgId = message.message_id || '';
    if (msgId && this.processedMsgIds.has(msgId)) {
      logger.debug(TAG, `跳过重复消息: ${msgId}`);
      return;
    }
    if (msgId) {
      this.processedMsgIds.set(msgId, Date.now());
      this.startDedupeCleanup();
    }

    // 只处理文本消息
    const msgType = message.message_type;
    if (msgType !== 'text') {
      logger.debug(TAG, `忽略非文本消息: ${msgType}`);
      return;
    }

    // 解析文本
    let text = '';
    try {
      const content = JSON.parse(message.content);
      text = content.text || '';
    } catch {
      return;
    }

    // 去除 @机器人 的提及标记
    text = text.replace(/@_user_\d+/g, '').trim();

    if (!text) return;

    const sender = data.sender || {};
    const chatId = message.chat_id || '';
    const chatType = message.chat_type || '';

    const incoming: IncomingMessage = {
      platform: 'feishu',
      messageId: message.message_id || '',
      senderId: sender.sender_id?.open_id || sender.sender_id?.user_id || '',
      senderName: sender.sender_id?.name || '飞书用户',
      text,
      isGroup: chatType === 'group',
      groupId: chatType === 'group' ? chatId : undefined,
      isMentioned: true, // 长连接模式下收到的消息都是发给机器人的
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
