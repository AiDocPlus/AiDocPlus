/**
 * DocType SDK — 文档类型接口定义
 *
 * 每种文档类型（normal/novel/study-notes/translation/...）通过实现这些接口
 * 向平台声明自己的能力：编辑器组件、AI 侧栏、Skills、Workflow、导出等。
 */
import type { ComponentType, LazyExoticComponent } from 'react';
import type { Document } from '@aidocplus/shared-types';

// ============================================================
// 文档类型定义（DocTypeDefinition）
// ============================================================

/**
 * 文档类型定义 — 每种文档类型必须实现的接口。
 * 类似插件的 Manifest，但粒度更大（完整编辑器 + AI 工作流）。
 */
export interface DocTypeDefinition {
  /**
   * 类型唯一 ID（全局唯一，推荐反向域名格式）。
   * 不同文档类型可以有相同的显示名称，但 ID 必须不同。
   * 内置类型：'normal', 'novel', 'study-notes', 'translation'
   * 社区类型：'com.author.my-novel-pro'
   */
  id: string;
  /** 版本号（semver） */
  version: string;
  /** 显示名称 i18n key（可与其他类型重名） */
  labelKey: string;
  /** 简短描述 i18n key */
  descriptionKey: string;
  /** lucide-react 图标组件 */
  icon: ComponentType<{ className?: string }>;
  /** 文件后缀（用于文件树显示区分，如 '.novel'） */
  fileSuffix?: string;
  /** 创建时的分类标签（用于"新建文档"面板分组） */
  category: DocTypeCategory;

  // ═══ UI 组件 ═══

  /**
   * 主编辑器组件（lazy 加载）。
   * 平台会向编辑器传递 DocTypeEditorProps。
   */
  EditorComponent: LazyExoticComponent<ComponentType<DocTypeEditorProps>>;
  /**
   * 布局模式：
   * - 'standard': 使用平台标准布局（编辑器 + 右侧 AI/插件面板）
   * - 'full': 自己管理整个工作区（如小说三栏、翻译双栏）
   */
  layoutMode: 'standard' | 'full';
  /** 自定义 AI 侧栏组件（layoutMode='standard' 时替代通用 ChatPanel） */
  AISidebarComponent?: LazyExoticComponent<ComponentType<DocTypeAISidebarProps>>;
  /** 是否支持插件系统（默认 false，仅 normal 类型为 true） */
  supportsPlugins?: boolean;

  // ═══ 数据 ═══

  /** 创建空文档的初始 content */
  createEmptyContent(): string;
  /** 从 content 提取纯文本（用于搜索/字数统计） */
  extractPlainText(content: string): string;
  /** 验证 content 格式是否有效 */
  validateContent?(content: string): { valid: boolean; error?: string };

  // ═══ 导出 ═══

  /** 支持的导出格式 */
  exportFormats?: DocTypeExportFormat[];

  // ═══ AI ═══

  /**
   * 构建类型专属的 AI 系统提示词（默认值，用户可在提示词管理中覆盖）。
   * 返回空字符串表示使用通用系统提示词。
   */
  defaultSystemPrompt?: string;
  /** AI 快捷操作列表（如小说的续写/扩写，学习体会的提炼/反思） */
  aiQuickActions?: DocTypeAIAction[];
}

export type DocTypeCategory = 'writing' | 'business' | 'academic' | 'creative' | 'other';

// ============================================================
// 编辑器 Props
// ============================================================

/** 平台传递给文档类型编辑器的统一 props */
export interface DocTypeEditorProps {
  /** 文档 ID */
  documentId: string;
  /** 完整文档对象 */
  document: Document;
  /** Tab ID（用于面板状态管理） */
  tabId: string;
  /** 平台宿主 API */
  host: DocTypeHostAPI;
}

/** AI 侧栏 props（standard 布局模式下使用） */
export interface DocTypeAISidebarProps extends DocTypeEditorProps {
  onClose: () => void;
}

// ============================================================
// 平台宿主 API（DocTypeHostAPI）
// ============================================================

/** AI 消息格式 */
export interface ChatMessage {
  role: string;
  content: string;
}

/** AI 调用选项 */
export interface AIOptions {
  maxTokens?: number;
  serviceId?: string;
  temperature?: number;
}

/** chat_stream / 文档类型 AI 工具作用域 */
export type DocTypeToolScope =
  | 'stock'
  | 'stock:financial'
  | 'stock:technical'
  | 'document'
  | 'all';

/** AI 流式调用选项 */
export interface AIStreamOptions extends AIOptions {
  signal?: AbortSignal;
  enableWebSearch?: boolean;
  enableThinking?: boolean;
  enableTools?: boolean;
  /** 工具作用域，默认 'all' */
  toolScope?: DocTypeToolScope;
  /** Rust 侧 `chat_stream` 的 request_id，可用于 `stop_ai_stream` */
  onStreamRequestId?: (requestId: string) => void;
}

/**
 * 平台宿主 API — 文档类型通过此 API 访问所有平台能力。
 * 参考 PluginHostAPI 设计，但更强大。
 * 文档类型不应直接 import 主程序内部模块，而是通过此 API。
 */
export interface DocTypeHostAPI {
  /** SDK 版本号 */
  sdkVersion: number;
  /** 当前文档类型 ID */
  docTypeId: string;

  // ═══ 文档操作 ═══
  doc: {
    /** 获取当前文档最新状态 */
    getDocument(): Document;
    /** 更新文档字段（仅内存，不写磁盘） */
    updateInMemory(patch: Partial<Document>): void;
    /** 保存文档到磁盘 */
    save(): Promise<void>;
    /** 标记文档为脏（Tab 显示未保存标记） */
    markDirty(): void;
    /** 标记为干净 */
    markClean(): void;
    /** 创建版本快照 */
    createVersion(label?: string): Promise<void>;
  };

  // ═══ AI 服务 ═══
  ai: {
    /** 单次对话（非流式） */
    chat(messages: ChatMessage[], options?: AIOptions): Promise<string>;
    /** 流式对话 */
    chatStream(
      messages: ChatMessage[],
      onChunk: (text: string) => void,
      options?: AIStreamOptions,
    ): Promise<string>;
    /** AI 服务是否可用（与 `chatStream` 使用同一 `serviceId` 解析逻辑） */
    isAvailable(serviceId?: string): boolean;
  };

  // ═══ UI 能力 ═══
  ui: {
    /** 获取当前主题 */
    getTheme(): 'light' | 'dark';
    /** 获取当前语言 */
    getLocale(): string;
    /** i18n 翻译 */
    t(key: string, params?: Record<string, unknown>): string;
    /** 复制到剪贴板 */
    copyToClipboard(text: string): Promise<void>;
    /** 显示通知 */
    showNotification(msg: string, type?: 'info' | 'success' | 'error'): void;
  };

  // ═══ 存储 ═══
  storage: {
    /** 读取文档类型的独立存储 */
    get<T = unknown>(key: string): T | null;
    /** 写入 */
    set(key: string, value: unknown): void;
  };

  // ═══ 平台命令 ═══
  platform: {
    /** 调用 Rust 后端命令 */
    invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
    /** 监听平台事件 */
    on(event: string, callback: (...args: unknown[]) => void): () => void;
  };
}

// ============================================================
// AI 快捷操作
// ============================================================

export interface DocTypeAIAction {
  /** 操作 ID（格式：docTypeId:action，如 'novel:continue'） */
  id: string;
  /** 显示名称 i18n key */
  labelKey: string;
  /** 图标 */
  icon: ComponentType<{ className?: string }>;
  /**
   * 默认提示词模板（用户可在提示词管理中覆盖）。
   * 支持 {{content}} / {{selection}} 等占位符。
   */
  defaultPromptTemplate: string;
}

// ============================================================
// 导出格式
// ============================================================

export interface DocTypeExportFormat {
  id: string;
  labelKey: string;
  extension: string;
  handler(content: string, title: string): Promise<Blob>;
}

// ============================================================
// SDK 版本
// ============================================================

export const DOCTYPE_SDK_VERSION = 1;
