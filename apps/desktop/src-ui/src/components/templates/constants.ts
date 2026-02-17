import i18n from '@/i18n';

export interface TemplateCategoryItem {
  key: string;
  label: string;
}

/** 静态回退（Store 尚未加载时使用） */
export function getDefaultTemplateCategories(): TemplateCategoryItem[] {
  return [
    { key: 'report', label: i18n.t('templates.categoryReport', { defaultValue: '报告' }) },
    { key: 'article', label: i18n.t('templates.categoryArticle', { defaultValue: '文章' }) },
    { key: 'email-draft', label: i18n.t('templates.categoryEmailDraft', { defaultValue: '邮件草稿' }) },
    { key: 'meeting', label: i18n.t('templates.categoryMeeting', { defaultValue: '会议纪要' }) },
    { key: 'creative', label: i18n.t('templates.categoryCreative', { defaultValue: '创意写作' }) },
    { key: 'technical', label: i18n.t('templates.categoryTechnical', { defaultValue: '技术文档' }) },
    { key: 'general', label: i18n.t('templates.categoryGeneral', { defaultValue: '通用' }) },
  ];
}

/** @deprecated 使用 getDefaultTemplateCategories() 代替 */
export const DEFAULT_TEMPLATE_CATEGORIES: TemplateCategoryItem[] = [
  { key: 'report', label: '报告' },
  { key: 'article', label: '文章' },
  { key: 'email-draft', label: '邮件草稿' },
  { key: 'meeting', label: '会议纪要' },
  { key: 'creative', label: '创意写作' },
  { key: 'technical', label: '技术文档' },
  { key: 'general', label: '通用' },
];

/**
 * 获取分类列表：优先使用 store 中的动态分类，为空时回退到默认值。
 * 在非 React 上下文中使用（如 select 选项）。
 */
export function getTemplateCategories(storeCategories: TemplateCategoryItem[]): TemplateCategoryItem[] {
  return storeCategories.length > 0 ? storeCategories : getDefaultTemplateCategories();
}

/** 向后兼容：直接导出静态常量（已有组件引用） */
export const TEMPLATE_CATEGORIES = DEFAULT_TEMPLATE_CATEGORIES;
