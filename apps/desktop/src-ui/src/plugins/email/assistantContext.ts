/**
 * 邮件 AI 助手 — 智能上下文引擎
 *
 * 职责：
 * - 分层构建邮件上下文（critical / important / supplementary）
 * - Token 预算管理，按层级裁剪
 * - 邮件阶段自动检测（空白→草拟→审阅→就绪）
 * - 收件人智能：从发送历史推断关系和语言偏好
 * - 生成智能系统提示词
 */

import type { EmailStorageData } from './types';

// ── 邮件阶段 ──

export type EmailPhase = 'blank' | 'drafting' | 'reviewing' | 'ready';

// ── 邮件上下文模式 ──

export type EmailContextMode = 'none' | 'body' | 'recipients' | 'account' | 'template';

export function detectEmailPhase(data: EmailStorageData): EmailPhase {
  const hasSubject = !!(data.subject && data.subject.trim());
  const hasRecipients = !!(data.recipients && data.recipients.length > 0);
  const hasBody = !!(data.emailBody && data.emailBody.replace(/<[^>]*>/g, '').trim());
  const hasAccount = !!(data.activeAccountId && data.accounts?.some(a => a.id === data.activeAccountId));

  if (!hasSubject && !hasRecipients && !hasBody) return 'blank';
  if (hasSubject && hasRecipients && hasBody && hasAccount) return 'ready';
  if (hasBody) return 'reviewing';
  return 'drafting';
}

// ── 分层上下文构建 ──

interface ContextLayer {
  label: string;
  content: string;
}

/** 构建分层上下文，按 critical → important → supplementary 优先级 */
function buildContextLayers(data: EmailStorageData): { critical: ContextLayer[]; important: ContextLayer[]; supplementary: ContextLayer[] } {
  const critical: ContextLayer[] = [];
  const important: ContextLayer[] = [];
  const supplementary: ContextLayer[] = [];

  // ── Critical：始终包含 ──
  if (data.subject) {
    critical.push({ label: '主题', content: `当前邮件主题：${data.subject}` });
  }
  if (data.recipients && data.recipients.length > 0) {
    critical.push({ label: '收件人', content: `收件人：${data.recipients.join(', ')}` });
  }
  if (data.cc && data.cc.length > 0) {
    critical.push({ label: '抄送', content: `抄送：${data.cc.join(', ')}` });
  }
  if (data.bcc && data.bcc.length > 0) {
    critical.push({ label: '密送', content: `密送：${data.bcc.join(', ')}` });
  }
  critical.push({ label: '格式', content: `邮件格式：${data.emailFormat === 'plaintext' ? '纯文本' : 'HTML'}` });

  // ── Important：优先包含（正文不再在此注入，由上下文模式单独提供） ──
  if (data.accounts && data.accounts.length > 0) {
    const active = data.accounts.find(a => a.id === data.activeAccountId);
    if (active) {
      important.push({ label: '账户', content: `当前发件账户：${active.displayName || active.name} <${active.email}>` });
    }
  }
  if (data.activeSignatureId && data.signatures) {
    const activeSig = data.signatures.find(s => s.id === data.activeSignatureId);
    if (activeSig) {
      important.push({ label: '签名', content: `当前签名：「${activeSig.name}」` });
    }
  }

  // ── Supplementary：空间允许时 ──
  if (data.attachments && data.attachments.length > 0) {
    const attList = data.attachments.map(a => `${a.filename} (${(a.size / 1024).toFixed(0)}KB)`).join(', ');
    supplementary.push({ label: '附件', content: `附件 (${data.attachments.length}个)：${attList}` });
  }
  if (data.accounts && data.accounts.length > 1) {
    const others = data.accounts.filter(a => a.id !== data.activeAccountId).map(a => a.email).join(', ');
    supplementary.push({ label: '其他账户', content: `其他账户：${others}` });
  }
  if (data.signatures && data.signatures.length > 0) {
    supplementary.push({ label: '已有签名', content: `已有签名：${data.signatures.map(s => s.name).join(', ')}` });
  }
  // 收件人历史交互
  if (data.sendHistory && data.recipients && data.recipients.length > 0) {
    const recipientSet = new Set(data.recipients.map(r => r.toLowerCase().trim()));
    const recentToRecipient = data.sendHistory
      .filter(h => h.status === 'success' && h.to.some(t => recipientSet.has(t.toLowerCase().trim())))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 2);
    if (recentToRecipient.length > 0) {
      const lines = recentToRecipient.map(h => {
        const date = new Date(h.timestamp).toLocaleDateString();
        const bodySnippet = h.body.replace(/<[^>]*>/g, '').slice(0, 200);
        return `  ${date} 主题「${h.subject}」：${bodySnippet}`;
      });
      supplementary.push({ label: '收件人历史', content: `与当前收件人的近期交互：\n${lines.join('\n')}` });
    }
  }

  return { critical, important, supplementary };
}

/**
 * 构建 token 预算内的上下文字符串
 * @param data 邮件存储数据
 * @param budget 字符预算（默认 4000，约 2000 token）
 */
export function buildTieredContext(data: EmailStorageData, budget = 4000): string {
  const layers = buildContextLayers(data);
  const parts: string[] = [];
  let remaining = budget;

  // 按优先级依次加入
  for (const layer of [layers.critical, layers.important, layers.supplementary]) {
    for (const item of layer) {
      if (item.content.length <= remaining) {
        parts.push(item.content);
        remaining -= item.content.length;
      } else if (remaining > 100) {
        // 截断加入
        parts.push(item.content.slice(0, remaining - 20) + '\n...(已截断)');
        remaining = 0;
        break;
      }
    }
    if (remaining <= 0) break;
  }

  return parts.length > 0 ? '\n\n--- 当前邮件状态 ---\n' + parts.join('\n') : '';
}

// ── 按模式构建上下文 ──

/** 构建「正文」模式的上下文：完整 HTML 正文，不截断、不去标签 */
function buildBodyContext(data: EmailStorageData): string {
  if (!data.emailBody) return '';
  const bodyText = data.emailBody.replace(/<[^>]*>/g, '').trim();
  if (!bodyText) return '';
  return `当前邮件正文（HTML）：\n${data.emailBody}`;
}

/** 构建「收件人」模式的上下文 */
function buildRecipientsContext(data: EmailStorageData): string {
  const parts: string[] = [];
  if (data.recipients && data.recipients.length > 0) {
    parts.push(`收件人：${data.recipients.join(', ')}`);
  }
  if (data.cc && data.cc.length > 0) {
    parts.push(`抄送：${data.cc.join(', ')}`);
  }
  if (data.bcc && data.bcc.length > 0) {
    parts.push(`密送：${data.bcc.join(', ')}`);
  }
  // 联系人详情
  if (data.contacts && data.contacts.length > 0 && data.recipients) {
    const recipientSet = new Set(data.recipients.map(r => r.toLowerCase().trim()));
    const matched = data.contacts.filter(c => recipientSet.has(c.email.toLowerCase().trim()));
    if (matched.length > 0) {
      parts.push('\n联系人详情：');
      for (const c of matched) {
        let line = `  ${c.name} <${c.email}>`;
        if (c.note) line += `（备注：${c.note}）`;
        if (c.groupId && data.contactGroups) {
          const grp = data.contactGroups.find(g => g.id === c.groupId);
          if (grp) line += `（分组：${grp.name}）`;
        }
        if (c.extraFields) {
          const extras = Object.entries(c.extraFields).map(([k, v]) => `${k}: ${v}`).join(', ');
          if (extras) line += `（${extras}）`;
        }
        parts.push(line);
      }
    }
  }
  // 发送历史
  if (data.sendHistory && data.recipients && data.recipients.length > 0) {
    const recipientSet = new Set(data.recipients.map(r => r.toLowerCase().trim()));
    const recent = data.sendHistory
      .filter(h => h.to.some(t => recipientSet.has(t.toLowerCase().trim())))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
    if (recent.length > 0) {
      parts.push('\n与当前收件人的发送历史：');
      for (const h of recent) {
        const date = new Date(h.timestamp).toLocaleDateString();
        const status = h.status === 'success' ? '✓' : '✗';
        const snippet = h.body.replace(/<[^>]*>/g, '').slice(0, 150);
        parts.push(`  ${status} ${date} 主题「${h.subject}」：${snippet}`);
      }
    }
  }
  return parts.join('\n');
}

/** 构建「账户」模式的上下文 */
function buildAccountContext(data: EmailStorageData): string {
  const parts: string[] = [];
  if (data.accounts && data.accounts.length > 0) {
    const active = data.accounts.find(a => a.id === data.activeAccountId);
    if (active) {
      parts.push(`当前发件账户：${active.displayName || active.name} <${active.email}>`);
      parts.push(`  服务商：${active.provider}`);
      parts.push(`  SMTP：${active.smtpHost}:${active.smtpPort} (${active.encryption})`);
    }
    if (data.accounts.length > 1) {
      const others = data.accounts.filter(a => a.id !== data.activeAccountId);
      parts.push(`\n其他账户 (${others.length}个)：`);
      for (const a of others) {
        parts.push(`  ${a.displayName || a.name} <${a.email}> (${a.provider})`);
      }
    }
  }
  if (data.signatures && data.signatures.length > 0) {
    parts.push(`\n签名列表 (${data.signatures.length}个)：`);
    for (const s of data.signatures) {
      const active = s.id === data.activeSignatureId ? '（当前使用）' : '';
      parts.push(`  「${s.name}」${active}`);
    }
  }
  // 最近发送错误
  if (data.sendHistory) {
    const errors = data.sendHistory.filter(h => h.status === 'error').sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
    if (errors.length > 0) {
      parts.push('\n最近发送失败记录：');
      for (const e of errors) {
        const date = new Date(e.timestamp).toLocaleDateString();
        parts.push(`  ${date} 收件人 ${e.to.join(', ')} 错误：${e.statusMsg || '未知'}`);
      }
    }
  }
  return parts.join('\n');
}

/** 构建「模板」模式的上下文 */
function buildTemplateContext(data: EmailStorageData): string {
  const parts: string[] = [];
  if (data.submissionTemplates && data.submissionTemplates.length > 0) {
    parts.push(`投稿模板 (${data.submissionTemplates.length}个)：`);
    for (const tpl of data.submissionTemplates) {
      parts.push(`\n  模板「${tpl.name}」${tpl.description ? ` — ${tpl.description}` : ''}`);
      parts.push(`    收件人：${tpl.recipients.join(', ')}`);
      if (tpl.cc && tpl.cc.length > 0) parts.push(`    抄送：${tpl.cc.join(', ')}`);
      parts.push(`    主题模板：${tpl.subjectTemplate}`);
      parts.push(`    正文模板：${tpl.bodyTemplate.slice(0, 500)}${tpl.bodyTemplate.length > 500 ? '...' : ''}`);
      if (tpl.variables && tpl.variables.length > 0) {
        parts.push(`    变量：${tpl.variables.map(v => `${v.name}(${v.label})`).join(', ')}`);
      }
    }
  }
  if (data.textSnippets && data.textSnippets.length > 0) {
    parts.push(`\n文本片段 (${data.textSnippets.length}个)：`);
    for (const s of data.textSnippets) {
      parts.push(`  「${s.name}」${s.category ? `[${s.category}]` : ''}：${s.content.slice(0, 200)}`);
    }
  }
  return parts.join('\n');
}

/**
 * 根据上下文模式构建针对性的 system message 内容
 * @param data 邮件存储数据
 * @param mode 上下文模式
 * @returns 上下文内容字符串（空字符串表示无上下文）
 */
export function buildContextForMode(data: EmailStorageData, mode: EmailContextMode): string {
  switch (mode) {
    case 'body': return buildBodyContext(data);
    case 'recipients': return buildRecipientsContext(data);
    case 'account': return buildAccountContext(data);
    case 'template': return buildTemplateContext(data);
    default: return '';
  }
}

/** 上下文模式对应的中文标签 */
export const EMAIL_CONTEXT_MODE_LABELS: Record<EmailContextMode, string> = {
  none: '随便聊聊',
  body: '正文',
  recipients: '收件人',
  account: '账户',
  template: '模板',
};

// ── 上下文摘要（用于上下文可视化面板） ──

export interface ContextSummary {
  phase: EmailPhase;
  hasSubject: boolean;
  subjectPreview: string;
  recipientCount: number;
  ccCount: number;
  bodyLength: number;
  attachmentCount: number;
  accountEmail: string;
  signatureName: string;
  format: string;
}

export function getContextSummary(data: EmailStorageData): ContextSummary {
  const active = data.accounts?.find(a => a.id === data.activeAccountId);
  const activeSig = data.signatures?.find(s => s.id === data.activeSignatureId);
  const bodyText = data.emailBody ? data.emailBody.replace(/<[^>]*>/g, '').trim() : '';
  return {
    phase: detectEmailPhase(data),
    hasSubject: !!(data.subject && data.subject.trim()),
    subjectPreview: (data.subject || '').slice(0, 30),
    recipientCount: data.recipients?.length || 0,
    ccCount: (data.cc?.length || 0) + (data.bcc?.length || 0),
    bodyLength: bodyText.length,
    attachmentCount: data.attachments?.length || 0,
    accountEmail: active?.email || '',
    signatureName: activeSig?.name || '',
    format: data.emailFormat === 'plaintext' ? '纯文本' : 'HTML',
  };
}

// ── 智能系统提示词 ──

/** 动作协议说明（注入系统提示词） */
const ACTION_PROTOCOL = `
【结构化动作协议】
你可以在回复中输出以下 JSON 代码块，系统会自动解析并渲染可执行按钮：

1. 添加邮箱账户：
\`\`\`json
{"action":"add_account","name":"账户名","provider":"服务商ID","smtpHost":"smtp服务器","smtpPort":465,"encryption":"tls","email":"邮箱地址","password":"授权码","displayName":"发件人名称"}
\`\`\`

2. 添加签名：
\`\`\`json
{"action":"add_signature","name":"签名名称","content":"<HTML签名内容>"}
\`\`\`

3. 设置邮件主题：
\`\`\`json
{"action":"apply_subject","value":"建议的主题"}
\`\`\`

4. 添加收件人：
\`\`\`json
{"action":"add_recipient","field":"to","email":"user@example.com"}
\`\`\`
field 可以是 "to"（收件人）、"cc"（抄送）、"bcc"（密送）。

5. 主题候选列表（当用户要求建议主题时使用）：
\`\`\`json
{"action":"subject_options","options":["主题1","主题2","主题3","主题4","主题5"]}
\`\`\`

6. 发送前检查报告（当用户要求检查时使用）：
\`\`\`json
{"action":"precheck_report","score":8,"checks":[{"category":"grammar","status":"pass","detail":"未发现语法错误"},{"category":"tone","status":"warning","detail":"第二段语气偏随意","suggestion":"建议改为更正式的表达"},{"category":"attachment","status":"fail","detail":"正文提到附件但未添加"}]}
\`\`\`
status: "pass" / "warning" / "fail"
category: "grammar"(语法) / "spelling"(拼写) / "tone"(语气) / "structure"(结构) / "recipient"(收件人) / "subject"(主题) / "attachment"(附件) / "professional"(专业度) / "sensitive"(敏感词)

`;

const BASE_SYSTEM_PROMPT = `你是邮件 AI 助手，精通邮件撰写、排版、翻译和邮箱技术配置。

你的能力：
1. 撰写各种风格的邮件（商务/学术/友好/致歉/感谢/邀请/跟进/投稿）
2. 润色、排版、翻译邮件内容
3. 生成邮件回复、续写邮件
4. 检查邮件质量（拼写、语法、专业度、敏感词）
5. 配置邮箱账户（根据邮箱后缀识别SMTP服务器参数）
6. 指导用户获取各邮件服务商的授权码
7. 诊断邮件发送失败原因
8. 生成邮件模板和专业签名

【重要：HTML 输出规则】
输出邮件正文时，必须遵守以下规则：
- 只输出 HTML 片段（即邮件正文部分），直接以 <p>、<div>、<table> 等标签开头
- 所有样式必须使用内联 style 属性（如 <p style="font-size:14px;color:#333;">），不得使用 <style> 标签
- 严禁输出 <html>、<head>、<body>、<style>、<script>、<!DOCTYPE> 等网页结构标签
- 使用 \`\`\`html 代码块包裹输出

常见邮箱后缀对应服务商：
- @126.com → netease126, smtp.126.com:465/TLS
- @163.com → netease163, smtp.163.com:465/TLS
- @qq.com → qq, smtp.qq.com:465/TLS
- @foxmail.com → foxmail, smtp.qq.com:465/TLS
- @gmail.com → gmail, smtp.gmail.com:465/TLS
- @outlook.com → outlook, smtp.office365.com:587/STARTTLS
- @hotmail.com → outlook, smtp.office365.com:587/STARTTLS
- @yahoo.com → yahoo, smtp.mail.yahoo.com:465/TLS
- @aliyun.com → aliyun, smtp.aliyun.com:465/TLS
- @sina.com → sina, smtp.sina.com:465/TLS
- @sohu.com → sohu, smtp.sohu.com:465/TLS
- @139.com → china139, smtp.139.com:465/TLS
- @189.cn → china189, smtp.189.cn:465/TLS
${ACTION_PROTOCOL}
回复使用中文。`;

const PHASE_HINTS: Record<EmailPhase, string> = {
  blank: '\n\n【当前状态】用户尚未开始撰写邮件，可能需要帮助起草、配置邮箱或了解功能。',
  drafting: '\n\n【当前状态】用户正在草拟邮件，可能需要撰写正文、补充信息或配置发送参数。',
  reviewing: '\n\n【当前状态】用户已有邮件正文，可能需要润色、排版、翻译、检查或调整。',
  ready: '\n\n【当前状态】邮件基本就绪（有主题、收件人、正文、账户），用户可能需要最终检查或微调。',
};

/**
 * 构建完整的系统提示词
 * @param data 邮件存储数据
 * @param docContent 文档正文参考
 * @param customPrompt 用户自定义提示词（可选，替换默认）
 */
export function buildSmartSystemPrompt(
  data: EmailStorageData,
  docContent: string,
  customPrompt?: string,
): string {
  const phase = detectEmailPhase(data);
  const basePrompt = customPrompt?.trim() || BASE_SYSTEM_PROMPT;
  const phaseHint = PHASE_HINTS[phase];
  const emailContext = buildTieredContext(data);
  const docContext = docContent ? `\n\n--- 文档正文参考 ---\n${docContent.slice(0, 2000)}` : '';

  return basePrompt + phaseHint + emailContext + docContext;
}

/** 获取默认系统提示词（用于提示词编辑器的 placeholder） */
export function getDefaultSystemPrompt(): string {
  return BASE_SYSTEM_PROMPT;
}
