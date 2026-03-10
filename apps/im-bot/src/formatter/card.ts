/**
 * 各平台消息格式化工具
 * 将 OutgoingMessage 转换为各平台特有的消息格式
 */

import type { OutgoingMessage } from '../channels/base.js';

// ============================================================
// 通用：Markdown → 纯文本降级
// ============================================================

export function markdownToPlainText(md: string): string {
  return md
    .replace(/\*\*(.*?)\*\*/g, '$1')       // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')            // *italic* → italic
    .replace(/`{3}[\s\S]*?`{3}/g, '')       // 去除代码块
    .replace(/`(.*?)`/g, '$1')              // `code` → code
    .replace(/^#+\s*/gm, '')                 // 去除标题标记
    .replace(/^[•\-]\s*/gm, '- ')           // 统一列表符号
    .trim();
}

/**
 * 获取消息文本（优先 Markdown，降级为纯文本）
 */
export function getMessageText(msg: OutgoingMessage): string {
  if (msg.markdown) return msg.markdown;
  if (msg.text) return msg.text;
  return '';
}

/**
 * 获取纯文本（强制降级）
 */
export function getPlainText(msg: OutgoingMessage): string {
  if (msg.text) return msg.text;
  if (msg.markdown) return markdownToPlainText(msg.markdown);
  return '';
}

// ============================================================
// 飞书消息卡片
// ============================================================

export function toFeishuCard(msg: OutgoingMessage): object {
  const text = getMessageText(msg);

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: 'AiDocPlus' },
      template: 'blue',
    },
    elements: [
      {
        tag: 'markdown',
        content: text,
      },
    ],
  };
}

/**
 * 飞书纯文本消息
 */
export function toFeishuText(msg: OutgoingMessage): object {
  return { text: getPlainText(msg) };
}

// ============================================================
// 钉钉消息
// ============================================================

/**
 * 钉钉 Markdown 消息
 */
export function toDingtalkMarkdown(msg: OutgoingMessage): object {
  const text = getMessageText(msg);
  const title = text.split('\n')[0].replace(/[#*`]/g, '').trim().substring(0, 20) || 'AiDocPlus';
  return {
    msgtype: 'markdown',
    markdown: { title, text },
  };
}

/**
 * 钉钉纯文本消息
 */
export function toDingtalkText(msg: OutgoingMessage): object {
  return {
    msgtype: 'text',
    text: { content: getPlainText(msg) },
  };
}

// ============================================================
// 企业微信消息
// ============================================================

/**
 * 企微 Markdown 消息
 */
export function toWecomMarkdown(msg: OutgoingMessage): object {
  // 企微 Markdown 不支持完整语法，做一些适配
  let text = getMessageText(msg);
  // 企微不支持 ** 加粗语法，但支持自己的加粗
  // 企微 Markdown 语法与标准略有不同，这里保持原样让企微自行渲染
  return {
    msgtype: 'markdown',
    markdown: { content: text },
  };
}

/**
 * 企微纯文本消息
 */
export function toWecomText(msg: OutgoingMessage): object {
  return {
    msgtype: 'text',
    text: { content: getPlainText(msg) },
  };
}

// ============================================================
// QQ 消息
// ============================================================

/**
 * QQ Markdown 消息（QQ 官方 Bot 支持 Markdown）
 */
export function toQQMarkdown(msg: OutgoingMessage): object {
  const text = getMessageText(msg);
  return {
    msg_type: 2, // markdown
    markdown: { content: text },
  };
}

/**
 * QQ 纯文本消息
 */
export function toQQText(msg: OutgoingMessage): object {
  return {
    msg_type: 0, // text
    content: getPlainText(msg),
  };
}

// ============================================================
// 截断工具
// ============================================================

/**
 * 截断消息到指定长度（各平台有消息长度限制）
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
