import i18n from '@/i18n';

export interface DocTemplateCategoryItem {
  key: string;
  label: string;
}

/** 静态回退（Store 尚未加载时使用） */
export function getDefaultDocTemplateCategories(): DocTemplateCategoryItem[] {
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

/**
 * 获取文档模板分类列表：优先使用 store 中的动态分类，为空时回退到默认值。
 */
export function getDocTemplateCategories(storeCategories: DocTemplateCategoryItem[]): DocTemplateCategoryItem[] {
  return storeCategories.length > 0 ? storeCategories : getDefaultDocTemplateCategories();
}
