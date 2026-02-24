/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-DocTemplates/scripts/build.py 生成
 */

export interface BuiltinDocTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  majorCategory: string;
  subCategory: string;
  tags: string[];
  roles: string[];
  order: number;
  source: string;
}

export const BUILT_IN_DOC_TEMPLATES: BuiltinDocTemplate[] = [
  { id: "doc-academic-paper", name: "学术论文", description: "标准学术论文结构，含摘要、引言、方法、结果、讨论", icon: "🎓", majorCategory: "article", subCategory: "general", tags: [], roles: ["researcher", "student"], order: 0, source: "builtin" },
  { id: "doc-tech-blog", name: "技术博客", description: "技术文章/博客，适合分享技术经验、解决方案和最佳实践", icon: "💻", majorCategory: "article", subCategory: "general", tags: [], roles: ["programmer"], order: 1, source: "builtin" },
  { id: "doc-wechat-article", name: "公众号文章", description: "微信公众号文章，注重可读性和传播性", icon: "📱", majorCategory: "article", subCategory: "general", tags: [], roles: ["content-creator", "marketing"], order: 2, source: "builtin" },
  { id: "doc-press-release", name: "新闻稿", description: "企业/活动新闻稿，规范的新闻写作格式", icon: "📰", majorCategory: "article", subCategory: "general", tags: [], roles: ["marketing", "content-creator"], order: 3, source: "builtin" },
  { id: "doc-story-outline", name: "短篇故事大纲", description: "短篇小说/故事大纲，含人物、情节和主题设计", icon: "✨", majorCategory: "creative", subCategory: "general", tags: [], roles: ["content-creator"], order: 0, source: "builtin" },
  { id: "doc-ad-copy", name: "广告文案", description: "营销广告文案，突出产品卖点和用户价值", icon: "🎯", majorCategory: "creative", subCategory: "general", tags: [], roles: ["marketing", "content-creator"], order: 1, source: "builtin" },
  { id: "doc-business-email", name: "商务邮件", description: "正式商务邮件，适用于合作洽谈、商务沟通等场景", icon: "✉️", majorCategory: "email-draft", subCategory: "general", tags: [], roles: ["product-manager", "civil-servant", "marketing"], order: 0, source: "builtin" },
  { id: "doc-legal-letter", name: "法律函件", description: "正式法律函件，用于法律通知、律师函等场景", icon: "⚖️", majorCategory: "email-draft", subCategory: "general", tags: [], roles: ["lawyer"], order: 1, source: "builtin" },
  { id: "doc-complaint-letter", name: "投诉信", description: "正式投诉信，清晰陈述问题并提出合理诉求", icon: "📝", majorCategory: "email-draft", subCategory: "general", tags: [], roles: ["lawyer", "civil-servant"], order: 2, source: "builtin" },
  { id: "doc-blank", name: "空白文档", description: "空白文档，从零开始创作", icon: "📄", majorCategory: "general", subCategory: "general", tags: [], roles: ["general"], order: 0, source: "builtin" },
  { id: "doc-reading-notes", name: "读书笔记", description: "读书笔记模板，记录阅读感悟和核心观点", icon: "📚", majorCategory: "general", subCategory: "general", tags: [], roles: ["general", "student", "researcher"], order: 1, source: "builtin" },
  { id: "doc-meeting-minutes", name: "会议纪要", description: "标准会议纪要，记录会议决议、行动项和责任人", icon: "📋", majorCategory: "meeting", subCategory: "general", tags: [], roles: ["civil-servant", "product-manager"], order: 0, source: "builtin" },
  { id: "doc-review-minutes", name: "项目评审纪要", description: "项目评审会议纪要，含评审意见、问题清单和整改要求", icon: "🔎", majorCategory: "meeting", subCategory: "general", tags: [], roles: ["product-manager", "programmer"], order: 1, source: "builtin" },
  { id: "doc-work-summary", name: "工作总结报告", description: "年度/季度/月度工作总结，梳理成果、问题与计划", icon: "📊", majorCategory: "report", subCategory: "general", tags: [], roles: ["civil-servant", "product-manager"], order: 0, source: "builtin" },
  { id: "doc-project-progress", name: "项目进展报告", description: "项目阶段性进展汇报，含里程碑、风险和下步计划", icon: "📈", majorCategory: "report", subCategory: "general", tags: [], roles: ["product-manager", "civil-servant"], order: 1, source: "builtin" },
  { id: "doc-research-report", name: "调研分析报告", description: "市场/用户/行业调研报告，含数据分析和结论建议", icon: "🔍", majorCategory: "report", subCategory: "general", tags: [], roles: ["researcher", "product-manager"], order: 2, source: "builtin" },
  { id: "doc-experiment-report", name: "实验报告", description: "科学实验报告，含实验目的、方法、结果和分析", icon: "🧪", majorCategory: "report", subCategory: "general", tags: [], roles: ["researcher", "student"], order: 3, source: "builtin" },
  { id: "doc-api-spec", name: "API说明文档", description: "RESTful API接口文档，含请求参数、响应格式和示例", icon: "🔌", majorCategory: "technical", subCategory: "general", tags: [], roles: ["programmer"], order: 0, source: "builtin" },
  { id: "doc-requirements", name: "需求规格说明", description: "软件需求规格说明书，含功能需求、非功能需求和约束条件", icon: "📋", majorCategory: "technical", subCategory: "general", tags: [], roles: ["product-manager", "programmer"], order: 1, source: "builtin" },
  { id: "doc-tech-plan", name: "技术方案", description: "技术架构设计方案，含技术选型、架构设计和实施计划", icon: "🏗️", majorCategory: "technical", subCategory: "general", tags: [], roles: ["programmer", "product-manager"], order: 2, source: "builtin" },
];
