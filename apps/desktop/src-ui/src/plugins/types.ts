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
// AI 助手面板类型
// ============================================================

/** 插件 AI 助手面板的 Props（自定义面板组件接收） */
export interface PluginAssistantPanelProps {
  /** 插件 ID */
  pluginId: string;
  /** 当前文档 */
  document: Document;
  /** 该插件在文档中的数据 */
  pluginData: unknown;
  /** AI 正文内容 */
  aiContent: string;
  /** 当前标签页 ID */
  tabId: string;
}

/** 插件快捷操作 */
export interface PluginQuickAction {
  /** 操作 ID */
  id: string;
  /** lucide 图标名（如 'Wand2', 'FileText'） */
  icon: string;
  /** 按钮文字 */
  label: string;
  /** 构建提示词（ctx 包含文档和插件上下文） */
  buildPrompt: (ctx: { document: Document; pluginData: unknown; aiContent: string }) => string;
}

/** 插件 AI 助手配置（使用默认面板但定制行为） */
export interface PluginAssistantConfig {
  /** 默认系统提示词 */
  defaultSystemPrompt: string;
  /** 快捷操作按钮 */
  quickActions?: PluginQuickAction[];
  /** 构建上下文（追加到系统提示词末尾） */
  buildContext?: (doc: Document, pluginData: unknown, aiContent: string) => string;
}

/** 生成默认助手配置的辅助函数 */
export function createDefaultAssistantConfig(
  pluginName: string,
  pluginDesc: string,
): PluginAssistantConfig {
  return {
    defaultSystemPrompt: `你是「${pluginName}」的 AI 助手。${pluginDesc}\n\n请根据用户的需求，提供与「${pluginName}」功能相关的帮助和建议。回复使用中文。`,
    quickActions: [
      {
        id: 'help',
        icon: 'HelpCircle',
        label: '使用帮助',
        buildPrompt: () => `请介绍「${pluginName}」的主要功能和使用方法。`,
      },
      {
        id: 'optimize',
        icon: 'Sparkles',
        label: '优化建议',
        buildPrompt: ({ aiContent }) => {
          const content = aiContent ? `\n\n当前正文内容（截取前2000字）：\n${aiContent.slice(0, 2000)}` : '';
          return `请针对当前文档内容，给出与「${pluginName}」功能相关的优化建议。${content}`;
        },
      },
    ],
  };
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

  /** 完全自定义的 AI 助手面板组件（最高优先级） */
  AssistantPanelComponent?: React.ComponentType<PluginAssistantPanelProps>;
  /** AI 助手配置（使用默认面板但定制行为，次优先级） */
  assistantConfig?: PluginAssistantConfig;
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
