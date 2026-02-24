/**
 * 检查结果级别
 */
export type CheckLevel = 'pass' | 'warning' | 'error';

/**
 * 单条检查结果
 */
export interface CheckItem {
  id: string;
  level: CheckLevel;
  category: string;
  description: string;
  suggestion: string;
  location?: string;
}

/**
 * 规则集
 */
export interface RuleSet {
  key: string;
  label: string;
  description: string;
}

/**
 * 检查报告
 */
export interface ComplianceReport {
  ruleSetKey: string;
  ruleSetLabel: string;
  items: CheckItem[];
  summary: { pass: number; warning: number; error: number };
  checkedAt: number;
}

/**
 * 内置规则集
 */
export const RULE_SETS: RuleSet[] = [
  { key: 'academic', label: '学术论文', description: '检查结构完整性、引用格式、摘要规范、学术用语' },
  { key: 'official', label: '公文写作', description: '检查格式规范、公文用语、签发要素、行文逻辑' },
  { key: 'technical', label: '技术文档', description: '检查术语一致性、版本号、代码示例、文档完整性' },
  { key: 'general', label: '通用写作', description: '检查错别字、语病、标点符号、逻辑一致性、可读性' },
  { key: 'custom', label: '自定义规则', description: '用自然语言描述你的检查要求' },
];

/**
 * 生成唯一 ID
 */
export function generateCheckId(): string {
  return `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
