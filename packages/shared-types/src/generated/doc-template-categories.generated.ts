/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-DocTemplates/scripts/build.py 生成
 */

export interface DocTemplateCategory {
  key: string;
  label: string;
  order: number;
  category_type: string;
}

export const DEFAULT_DOC_TEMPLATE_CATEGORIES: DocTemplateCategory[] = [
  { key: "report", label: "报告", order: 0, category_type: "builtin" },
  { key: "article", label: "文章", order: 1, category_type: "builtin" },
  { key: "email-draft", label: "邮件草稿", order: 2, category_type: "builtin" },
  { key: "meeting", label: "会议纪要", order: 3, category_type: "builtin" },
  { key: "creative", label: "创意写作", order: 4, category_type: "builtin" },
  { key: "technical", label: "技术文档", order: 5, category_type: "builtin" },
  { key: "general", label: "通用", order: 6, category_type: "builtin" },
];
