/**
 * Channel 抽象接口
 * 所有 IM 平台适配器都实现此接口
 */

// ============================================================
// 统一消息结构
// ============================================================

/** 收到的消息 */
export interface IncomingMessage {
  /** 消息来源平台 */
  platform: 'feishu' | 'dingtalk' | 'wecom' | 'qq';
  /** 消息ID */
  messageId: string;
  /** 发送者ID */
  senderId: string;
  /** 发送者名称 */
  senderName: string;
  /** 消息文本内容 */
  text: string;
  /** 是否群聊 */
  isGroup: boolean;
  /** 群聊ID（群聊时有效） */
  groupId?: string;
  /** 是否 @机器人 */
  isMentioned: boolean;
  /** 原始消息对象（平台特有） */
  raw?: unknown;
}

/** 要发送的回复 */
export interface OutgoingMessage {
  /** 纯文本 */
  text?: string;
  /** Markdown 格式 */
  markdown?: string;
  /** 平台特有的卡片/富文本结构 */
  card?: unknown;
}

// ============================================================
// Channel 抽象基类
// ============================================================

export abstract class BaseChannel {
  /** 平台名称 */
  abstract readonly name: string;
  /** 平台显示名 */
  abstract readonly displayName: string;

  /** 消息处理回调 */
  protected onMessage: ((msg: IncomingMessage) => Promise<OutgoingMessage | null>) | null = null;

  /**
   * 注册消息处理器
   */
  setMessageHandler(handler: (msg: IncomingMessage) => Promise<OutgoingMessage | null>): void {
    this.onMessage = handler;
  }

  /**
   * 启动渠道连接
   */
  abstract start(): Promise<void>;

  /**
   * 停止渠道连接
   */
  abstract stop(): Promise<void>;

  /**
   * 向指定目标发送消息
   */
  abstract sendReply(originalMsg: IncomingMessage, reply: OutgoingMessage): Promise<void>;
}
