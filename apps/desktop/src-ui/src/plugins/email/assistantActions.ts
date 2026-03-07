/**
 * 邮件 AI 助手 — 结构化动作协议引擎
 *
 * 职责：
 * - 解析 AI 输出中的 JSON 动作块
 * - 提供动作类型注册表
 * - 从原始内容中分离动作块和文本内容
 */

// ── 动作类型定义 ──

export type ActionType =
  | 'add_account'
  | 'add_signature'
  | 'apply_body'
  | 'apply_subject'
  | 'add_recipient'
  | 'create_template'
  | 'set_priority'
  | 'precheck_report'
  | 'subject_options'
  | 'translate_result';

export interface ParsedAction {
  type: ActionType;
  data: Record<string, unknown>;
  /** 原始 JSON 字符串（用于显示源码） */
  raw: string;
}

// ── 预检报告类型 ──

export interface PrecheckItem {
  category: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
  suggestion?: string;
}

export interface PrecheckReport {
  score: number;
  checks: PrecheckItem[];
}

// ── 解析器 ──

/**
 * 从 AI 回复内容中解析结构化动作
 * 返回：{ actions, textContent }
 * - actions: 解析出的动作列表
 * - textContent: 去除动作 JSON 块后的纯文本/Markdown 内容
 */
export function parseAssistantActions(content: string): { actions: ParsedAction[]; textContent: string } {
  const actions: ParsedAction[] = [];
  let textContent = content;

  // 匹配所有 ```json ... ``` 块
  const jsonBlockRe = /```json\s*\n([\s\S]*?)```/g;
  const blocksToRemove: Array<{ start: number; end: number }> = [];
  let match;

  while ((match = jsonBlockRe.exec(content)) !== null) {
    const jsonStr = match[1].trim();
    try {
      const obj = JSON.parse(jsonStr);
      if (obj && typeof obj === 'object' && obj.action) {
        const actionType = obj.action as ActionType;
        const knownActions: ActionType[] = [
          'add_account', 'add_signature', 'apply_body', 'apply_subject',
          'add_recipient', 'create_template', 'set_priority',
          'precheck_report', 'subject_options', 'translate_result',
        ];
        if (knownActions.includes(actionType)) {
          actions.push({ type: actionType, data: obj, raw: jsonStr });
          blocksToRemove.push({ start: match.index, end: match.index + match[0].length });
        }
      }
    } catch {
      // 非动作 JSON，保留不处理
    }
  }

  // 从后往前移除已解析的 JSON 块，避免索引偏移
  for (let i = blocksToRemove.length - 1; i >= 0; i--) {
    const { start, end } = blocksToRemove[i];
    textContent = textContent.slice(0, start) + textContent.slice(end);
  }

  // 清理多余空行
  textContent = textContent.replace(/\n{3,}/g, '\n\n').trim();

  return { actions, textContent };
}

// ── 动作分类标签 ──

export const ACTION_LABELS: Record<ActionType, string> = {
  add_account: '添加账户',
  add_signature: '添加签名',
  apply_body: '应用到正文',
  apply_subject: '设置主题',
  add_recipient: '添加收件人',
  create_template: '保存为模板',
  set_priority: '设置优先级',
  precheck_report: '检查报告',
  subject_options: '主题候选',
  translate_result: '翻译结果',
};

// ── 预检报告分类标签 ──

export const PRECHECK_CATEGORY_LABELS: Record<string, string> = {
  grammar: '语法',
  spelling: '拼写',
  tone: '语气',
  structure: '结构',
  recipient: '收件人',
  subject: '主题',
  attachment: '附件',
  professional: '专业度',
  sensitive: '敏感词',
};

// ── 预检报告状态图标 ──

export const PRECHECK_STATUS_ICON: Record<string, string> = {
  pass: '✅',
  warning: '⚠️',
  fail: '❌',
};

/**
 * 从 precheck_report 动作数据中提取结构化报告
 */
export function extractPrecheckReport(data: Record<string, unknown>): PrecheckReport | null {
  if (typeof data.score !== 'number' || !Array.isArray(data.checks)) return null;
  return {
    score: data.score as number,
    checks: (data.checks as PrecheckItem[]).map(c => ({
      category: c.category || 'other',
      status: (['pass', 'warning', 'fail'].includes(c.status) ? c.status : 'warning') as PrecheckItem['status'],
      detail: c.detail || '',
      suggestion: c.suggestion,
    })),
  };
}

/**
 * 从 subject_options 动作数据中提取主题列表
 */
export function extractSubjectOptions(data: Record<string, unknown>): string[] {
  if (!Array.isArray(data.options)) return [];
  return data.options.filter((o): o is string => typeof o === 'string');
}
