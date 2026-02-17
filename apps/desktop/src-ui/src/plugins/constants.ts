import { useSettingsStore, type CategoryItem } from '@/stores/useSettingsStore';

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

// ============================================================
// 合并内置分类 + 用户自定义分类
// ============================================================

/** 合并后的分类节点（带 order 和 isBuiltin 标记） */
export interface MergedCategory {
  key: string;
  label: string;
  order: number;
  isBuiltin: boolean;
}

/**
 * 获取合并后的大类列表（内置 + 用户自定义，按 order 排序）
 */
export function getMergedMajorCategories(): MergedCategory[] {
  const custom = useSettingsStore.getState().plugins?.customCategories;
  const customMajors = custom?.majors || [];
  const customMap = new Map<string, CategoryItem>(customMajors.map(c => [c.key, c]));

  // 内置大类（order 从 0 开始）
  const result: MergedCategory[] = PLUGIN_MAJOR_CATEGORIES.map((c, i) => {
    const override = customMap.get(c.key);
    return {
      key: c.key,
      label: override?.label ?? c.label,
      order: override?.order ?? i,
      isBuiltin: true,
    };
  });

  // 用户新增的大类（不在内置列表中的）
  for (const c of customMajors) {
    if (!PLUGIN_MAJOR_CATEGORIES.some(b => b.key === c.key)) {
      result.push({ key: c.key, label: c.label, order: c.order, isBuiltin: false });
    }
  }

  return result.sort((a, b) => a.order - b.order);
}

/**
 * 获取合并后的子类列表（内置 + 用户自定义，按 order 排序）
 */
export function getMergedSubCategories(majorKey: string): MergedCategory[] {
  const custom = useSettingsStore.getState().plugins?.customCategories;
  const customSubs = custom?.subs?.[majorKey] || [];
  const customMap = new Map<string, CategoryItem>(customSubs.map(c => [c.key, c]));

  const builtinSubs = PLUGIN_SUB_CATEGORIES[majorKey] || [];

  // 内置子类
  const result: MergedCategory[] = builtinSubs.map((c, i) => {
    const override = customMap.get(c.key);
    return {
      key: c.key,
      label: override?.label ?? c.label,
      order: override?.order ?? i,
      isBuiltin: true,
    };
  });

  // 用户新增的子类
  for (const c of customSubs) {
    if (!builtinSubs.some(b => b.key === c.key)) {
      result.push({ key: c.key, label: c.label, order: c.order, isBuiltin: false });
    }
  }

  return result.sort((a, b) => a.order - b.order);
}
