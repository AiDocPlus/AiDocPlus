/**
 * AiDocPlus IM Bot 桥接服务
 * 主入口：加载配置，启动各 IM 渠道，处理消息路由
 */

import { loadConfig, type AppConfig } from './config.js';
import { getClient } from './bridge.js';
import { isCommand, routeCommand } from './router/command.js';
import { AIRouter } from './router/ai.js';
import { sessionManager, SessionManager } from './session.js';
import { handleSessionInput } from './workflows/writing.js';
import { BaseChannel, type IncomingMessage, type OutgoingMessage } from './channels/base.js';
import { FeishuChannel } from './channels/feishu.js';
import { DingtalkChannel } from './channels/dingtalk.js';
import { WecomChannel } from './channels/wecom.js';
import { QQChannel } from './channels/qq.js';
import logger, { setLogLevel } from './utils/logger.js';

const TAG = 'Main';

// ============================================================
// 全局状态
// ============================================================

const channels: BaseChannel[] = [];
let aiRouter: AIRouter | null = null;
let config: AppConfig;

// ============================================================
// 消息处理器
// ============================================================

async function handleMessage(msg: IncomingMessage): Promise<OutgoingMessage | null> {
  // 白名单检查
  if (config.allowedUsers.length > 0 && !config.allowedUsers.includes(msg.senderId)) {
    logger.warn(TAG, `拒绝未授权用户: ${msg.senderId} (${msg.senderName})`);
    return { text: '⚠️ 你没有权限使用此机器人。' };
  }

  // 检查 AiDocPlus 是否可用
  const client = getClient();
  if (!client) {
    return { text: '⚠️ AiDocPlus 桌面应用未运行，请先启动 AiDocPlus。' };
  }

  const text = msg.text.trim();
  const userKey = SessionManager.userKey(msg.platform, msg.senderId);

  // 1. 斜杠指令（优先处理，/取消 可退出会话）
  if (isCommand(text)) {
    return routeCommand(text, userKey);
  }

  // 2. 检查是否有活跃的交互会话（如模板写作流程）
  if (sessionManager.has(userKey)) {
    try {
      return await handleSessionInput(text, userKey);
    } catch (e) {
      logger.error(TAG, `会话处理失败:`, (e as Error).message);
      sessionManager.remove(userKey);
      return { text: `❌ 交互流程出错: ${(e as Error).message}\n已退出当前流程。` };
    }
  }

  // 3. AI 智能路由
  if (aiRouter) {
    const result = await aiRouter.route(text);
    if (result) return result;
  }

  // 4. 兜底提示
  return {
    markdown: '💡 **使用提示**\n\n'
      + '发送 `/帮助` 查看指令列表\n'
      + (config.ai.enabled ? '或直接用自然语言描述你的需求' : '提示：配置 AI_ENABLED=true 可启用自然语言理解'),
  };
}

// ============================================================
// 启动
// ============================================================

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║     AiDocPlus IM Bot 桥接服务        ║');
  console.log('║     飞书 · 钉钉 · 企业微信 · QQ     ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // 加载配置
  config = loadConfig();
  setLogLevel(config.logLevel);

  // 检查 AiDocPlus 连接
  const client = getClient();
  if (client) {
    const alive = await client.isAlive();
    if (alive) {
      logger.info(TAG, '✅ AiDocPlus 桌面应用已连接');
    } else {
      logger.warn(TAG, '⚠️ AiDocPlus api.json 存在但应用未响应，请确保已启动');
    }
  } else {
    logger.warn(TAG, '⚠️ AiDocPlus 未运行，Bot 将在收到消息时重试连接');
  }

  // 初始化 AI 路由（通过 AiDocPlus 内置 ai.chat API，使用用户默认 AI 配置）
  if (config.ai.enabled) {
    aiRouter = new AIRouter(true);
    logger.info(TAG, 'AI 路由已启用（使用 AiDocPlus 默认 AI 配置）');
  }

  // 启动各渠道
  if (config.feishu.enabled) {
    const ch = new FeishuChannel(config.feishu);
    ch.setMessageHandler(handleMessage);
    channels.push(ch);
  }

  if (config.dingtalk.enabled) {
    const ch = new DingtalkChannel(config.dingtalk);
    ch.setMessageHandler(handleMessage);
    channels.push(ch);
  }

  if (config.wecom.enabled) {
    const ch = new WecomChannel(config.wecom);
    ch.setMessageHandler(handleMessage);
    channels.push(ch);
  }

  if (config.qq.enabled) {
    const ch = new QQChannel(config.qq);
    ch.setMessageHandler(handleMessage);
    channels.push(ch);
  }

  if (channels.length === 0) {
    logger.warn(TAG, '⚠️ 没有启用任何渠道，请在 .env 中配置至少一个渠道');
    logger.info(TAG, '提示：复制 .env.example 为 .env 并填写平台凭证');
    return;
  }

  // 依次启动
  for (const ch of channels) {
    try {
      await ch.start();
    } catch (e) {
      logger.error(TAG, `启动 ${ch.displayName} 失败:`, (e as Error).message);
    }
  }

  logger.info(TAG, `✅ IM Bot 已启动，共 ${channels.length} 个渠道`);
  logger.info(TAG, '按 Ctrl+C 停止服务');

  // 优雅退出
  const shutdown = async () => {
    logger.info(TAG, '正在关闭...');
    for (const ch of channels) {
      try {
        await ch.stop();
      } catch {
        // 忽略关闭错误
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ============================================================
// 运行
// ============================================================

main().catch((e) => {
  logger.error(TAG, '启动失败:', (e as Error).message);
  process.exit(1);
});
