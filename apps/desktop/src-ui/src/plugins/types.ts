import type { Document } from '@aidocplus/shared-types';

// ============================================================
// 插件大类常量
// ============================================================

/** 插件大类：内容生成类 */
export const PLUGIN_MAJOR_CATEGORY_CONTENT = 'content-generation';
/** 插件大类：功能执行类 */
export const PLUGIN_MAJOR_CATEGORY_FUNCTIONAL = 'functional';

/** 插件大类类型 */
export type PluginMajorCategory = typeof PLUGIN_MAJOR_CATEGORY_CONTENT | typeof PLUGIN_MAJOR_CATEGORY_FUNCTIONAL;

// ============================================================
// 插件 Props 类型
// ============================================================

/**
 * 插件面板组件的 Props
 * - 所有插件面板组件都接收这些 props
 * - pluginData 在内容生成类插件中为具体数据，在功能执行类插件中为 null
 */
export interface PluginPanelProps {
  /** 当前文档 */
  document: Document;
  /** 当前标签页 ID */
  tabId: string;
  /** 正文内容（AI 生成的） */
  content: string;
  /** 该插件在文档中的数据（内容生成类）或 null（功能执行类） */
  pluginData: unknown;
  /** 通知插件数据变更 */
  onPluginDataChange: (data: unknown) => void;
  /** 请求将文档保存到磁盘（AI 生成完成后调用） */
  onRequestSave?: () => void;
}

// ============================================================
// 插件接口
// ============================================================

/**
 * 文档插件接口
 * - 支持 two categories: content-generation 和 functional
 * - 通过 majorCategory 区分插件类型
 */
export interface DocumentPlugin {
  /** 唯一标识（UUID） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标组件（lucide-react） */
  icon: React.ComponentType<{ className?: string }>;
  /** 描述 */
  description?: string;
  /** 大类：'content-generation' | 'functional' */
  majorCategory?: PluginMajorCategory;
  /** 子类：'ai-text' | 'visualization' | 'communication' | ... */
  subCategory?: string;
  /** i18n 命名空间（如 'plugin-email'），用于 platform.t() 自动前缀 */
  i18nNamespace?: string;
  /** 插件面板组件 */
  PanelComponent: React.ComponentType<PluginPanelProps>;
  /** 判断文档中是否有该插件的数据 */
  hasData: (doc: Document) => boolean;
  /** 将插件数据转换为内容片段（用于合并区导入） */
  toFragments?: (pluginData: unknown) => { title: string; markdown: string }[];
  /** 插件专属设置面板（预留） */
  SettingsComponent?: React.ComponentType;
  /** 生命周期 Hook（预留） */
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDocumentChange?: () => void;
  onDestroy?: () => void;
}

/**
 * 内容生成类插件接口（类型收窄用）
 * - majorCategory 为 'content-generation'
 * - pluginData 包含实际数据
 */
export interface ContentGenerationPlugin extends DocumentPlugin {
  majorCategory: typeof PLUGIN_MAJOR_CATEGORY_CONTENT;
}

/**
 * 功能执行类插件接口（类型收窄用）
 * - majorCategory 为 'functional'
 * - pluginData 为 null，数据存储在 usePluginStorageStore
 */
export interface FunctionalPlugin extends DocumentPlugin {
  majorCategory: typeof PLUGIN_MAJOR_CATEGORY_FUNCTIONAL;
  // 功能执行类插件的 hasData 始终返回 false
  hasData: () => false;
}

/**
 * 类型守卫：判断是否为内容生成类插件
 */
export function isContentGenerationPlugin(plugin: DocumentPlugin): plugin is ContentGenerationPlugin {
  return plugin.majorCategory === PLUGIN_MAJOR_CATEGORY_CONTENT || plugin.majorCategory === undefined;
}

/**
 * 类型守卫：判断是否为功能执行类插件
 */
export function isFunctionalPlugin(plugin: DocumentPlugin): plugin is FunctionalPlugin {
  return plugin.majorCategory === PLUGIN_MAJOR_CATEGORY_FUNCTIONAL;
}
