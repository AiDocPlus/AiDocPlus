/**
 * 每个文档默认启用的插件（enabledPlugins 为 undefined 时使用）
 * UUID 直接内联，不再依赖集中式常量
 */
export const DEFAULT_DOC_PLUGINS = [
  '550e8400-e29b-41d4-a716-446655440003', // 文档摘要
  '550e8400-e29b-41d4-a716-446655440007', // 文档统计
  '550e8400-e29b-41d4-a716-446655440001', // 生成 PPT
];

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
    { key: 'export',        label: '导出发布' },
    { key: 'visualization', label: '可视化预览' },
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
  { key: 'export',          label: '导出发布' },
] as const;

export type PluginCategoryKey = typeof PLUGIN_CATEGORIES[number]['key'];
