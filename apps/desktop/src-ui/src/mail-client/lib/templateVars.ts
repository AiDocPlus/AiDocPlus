// ── 变量替换引擎（含收件人单位/分类等新变量） ──

import type { VariableDef, RecipientContext } from '../types/email';

/** 文档上下文（从主程序传入） */
export interface DocContext {
  title?: string;
  content?: string;
  [key: string]: string | undefined;
}

/**
 * 内置变量列表（用于 UI 插入变量下拉菜单）
 */
export const BUILTIN_VARIABLES: { name: string; label: string; description: string }[] = [
  { name: 'title', label: '文档标题', description: '当前文档的标题' },
  { name: 'content', label: '文档正文', description: '当前文档的正文内容' },
  { name: 'date', label: '当前日期', description: '发送时的日期（YYYY-MM-DD）' },
  { name: 'recipient_name', label: '收件人姓名', description: '收件人的姓名' },
  { name: 'recipient_email', label: '收件人邮箱', description: '收件人的邮箱地址' },
  { name: 'recipient_organization', label: '收件人单位', description: '收件人所属单位/机构' },
  { name: 'recipient_category', label: '收件人分类', description: '收件人分类（期刊/出版社等）' },
];

/**
 * 替换模板中的 {{变量名}} 占位符
 *
 * 优先级：
 * 1. recipient.variables（每人独立值）
 * 2. 内置变量（recipient_name/email/organization/category）
 * 3. recipient.extraFields（CSV 导入的扩展字段）
 * 4. docContext（文档标题/正文）
 * 5. VariableDef.defaultValue
 */
export function replaceVariables(
  template: string,
  variableDefs: VariableDef[],
  docContext?: DocContext,
  recipient?: RecipientContext,
): string {
  if (!template) return '';

  // 构建默认值映射
  const defaults: Record<string, string> = {};
  for (const v of variableDefs) {
    if (v.defaultValue) defaults[v.name] = v.defaultValue;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    // 1. 每人独立变量值
    if (recipient?.variables?.[varName] !== undefined) {
      return recipient.variables[varName];
    }

    // 2. 内置收件人变量
    if (recipient) {
      switch (varName) {
        case 'recipient_name':
          return recipient.name || '';
        case 'recipient_email':
          return recipient.email || '';
        case 'recipient_organization':
          return recipient.organization || '';
        case 'recipient_category':
          return recipient.category || '';
      }

      // 3. extraFields（支持 recipient_* 格式）
      const extraKey = varName.startsWith('recipient_')
        ? varName.slice('recipient_'.length)
        : varName;
      if (recipient.extraFields?.[extraKey] !== undefined) {
        return recipient.extraFields[extraKey];
      }
      if (recipient.extraFields?.[varName] !== undefined) {
        return recipient.extraFields[varName];
      }
    }

    // 4. 文档上下文
    if (docContext) {
      if (varName === 'date') {
        return new Date().toISOString().split('T')[0];
      }
      if (docContext[varName] !== undefined) {
        return docContext[varName] || '';
      }
    }

    // 5. 默认值
    if (defaults[varName] !== undefined) {
      return defaults[varName];
    }

    // 未匹配到，保留原始占位符
    return `{{${varName}}}`;
  });
}

/**
 * 从模板字符串中提取所有变量名
 */
export function extractVariableNames(template: string): string[] {
  const names = new Set<string>();
  const regex = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    names.add(match[1]);
  }
  return Array.from(names);
}
