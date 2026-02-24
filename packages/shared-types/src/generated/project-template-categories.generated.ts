/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-ProjectTemplates/scripts/build.py 生成
 */

export interface ProjectTemplateCategory {
  key: string;
  name: string;
  icon: string;
  order: number;
}

export const PROJECT_TEMPLATE_CATEGORIES: ProjectTemplateCategory[] = [
  { key: "academic", name: "学术论文", icon: "🎓", order: 0 },
  { key: "business", name: "商务报告", icon: "💼", order: 1 },
  { key: "tech", name: "技术文档", icon: "💻", order: 2 },
  { key: "creative", name: "创意写作", icon: "✨", order: 3 },
  { key: "education", name: "教育教学", icon: "📚", order: 4 },
  { key: "government", name: "公文政务", icon: "🏛️", order: 5 },
  { key: "general", name: "通用", icon: "📄", order: 6 },
];
