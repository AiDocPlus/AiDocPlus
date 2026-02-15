/**
 * 内置插件 UUID 常量
 * 每个插件有一个全局唯一的 UUID，用于 pluginData 存储和 manifest 匹配
 */
export const PLUGIN_ID_PPT = '550e8400-e29b-41d4-a716-446655440001';
export const PLUGIN_ID_QUIZ = '550e8400-e29b-41d4-a716-446655440002';
export const PLUGIN_ID_SUMMARY = '550e8400-e29b-41d4-a716-446655440003';
export const PLUGIN_ID_MINDMAP = '550e8400-e29b-41d4-a716-446655440004';
export const PLUGIN_ID_TRANSLATION = '550e8400-e29b-41d4-a716-446655440005';
export const PLUGIN_ID_DIAGRAM = '550e8400-e29b-41d4-a716-446655440006';
export const PLUGIN_ID_ANALYTICS = '550e8400-e29b-41d4-a716-446655440007';
export const PLUGIN_ID_LESSONPLAN = '550e8400-e29b-41d4-a716-446655440008';
export const PLUGIN_ID_TABLE = '550e8400-e29b-41d4-a716-446655440009';
export const PLUGIN_ID_EMAIL = '550e8400-e29b-41d4-a716-446655440010';

/**
 * 每个文档默认启用的插件（enabledPlugins 为 undefined 时使用）
 */
export const DEFAULT_DOC_PLUGINS = [PLUGIN_ID_SUMMARY, PLUGIN_ID_ANALYTICS, PLUGIN_ID_PPT];

/**
 * 插件大类定义（majorCategory）
 */
export const PLUGIN_MAJOR_CATEGORIES = [
  { key: 'content-generation', label: '内容生成' },
  { key: 'functional',         label: '功能执行' },
] as const;

export type PluginMajorCategoryKey = typeof PLUGIN_MAJOR_CATEGORIES[number]['key'];

/**
 * 插件子类定义（subCategory），按大类分组
 */
export const PLUGIN_SUB_CATEGORIES: Record<string, Array<{ key: string; label: string }>> = {
  'content-generation': [
    { key: 'ai-text',       label: 'AI 文本' },
    { key: 'visualization', label: '可视化' },
    { key: 'data',          label: '数据处理' },
    { key: 'analysis',      label: '分析统计' },
  ],
  'functional': [
    { key: 'communication', label: '通信协作' },
  ],
};

/**
 * 兼容旧代码：扁平分类列表（deprecated，后续移除）
 */
export const PLUGIN_CATEGORIES = [
  { key: 'all',            label: '全部' },
  { key: 'ai-text',        label: 'AI 文本' },
  { key: 'visualization',  label: '可视化' },
  { key: 'data',           label: '数据处理' },
  { key: 'analysis',       label: '分析统计' },
  { key: 'communication',  label: '通信协作' },
] as const;

export type PluginCategoryKey = typeof PLUGIN_CATEGORIES[number]['key'];
