/**
 * AiDocPlus 统一资源类型定义
 * 所有资源仓库共享此文件，定义资源包标准、Manifest 格式、分类体系等
 */

// ============================================================
// 资源类型枚举
// ============================================================

/** 资源类型 */
export type ResourceType =
  | 'role'
  | 'prompt-template'
  | 'document-template'
  | 'project-template'
  | 'ai-provider'
  | 'plugin'
  | 'theme'              // 未来扩展
  | 'language-pack'      // 未来扩展
  | 'bundle';            // 资源包集合

/** 资源来源 */
export type ResourceSource =
  | 'builtin'            // 随应用分发
  | 'local'              // 用户本地创建
  | 'community'          // 社区下载
  | 'enterprise';        // 企业内部（未来）

// ============================================================
// 作者信息
// ============================================================

export interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
  verified?: boolean;
}

// ============================================================
// 基础 Manifest（所有资源共享）
// ============================================================

export interface ResourceManifestBase {
  // ── 标识 ──
  id: string;                       // UUID v4（本地唯一）
  packageName?: string;             // @scope/name（社区发布时必需）
  name: string;                     // 显示名称
  description: string;              // 描述
  icon: string;                     // emoji 或 lucide 图标名
  version: string;                  // semver

  // ── 作者 ──
  author: string | AuthorInfo;

  // ── 分类 ──
  resourceType: ResourceType;
  majorCategory: string;            // 一级分类 key
  subCategory: string;              // 二级分类 key
  tags: string[];                   // 搜索标签
  order: number;                    // 排序权重

  // ── 状态 ──
  enabled: boolean;
  source: ResourceSource;
  createdAt: string;                // ISO 8601
  updatedAt: string;

  // ── 兼容性 ──
  minAppVersion?: string;
  license?: string;

  // ── 国际化（预留） ──
  i18n?: Record<string, {
    name?: string;
    description?: string;
    tags?: string[];
  }>;

  // ── 安全（预留） ──
  checksum?: string;                // SHA-256
  signature?: string;
}

// ============================================================
// 角色 Manifest
// ============================================================

export interface RoleManifest extends ResourceManifestBase {
  resourceType: 'role';
  markdownModePrompt?: string;
  suggestedTemperature?: number;
  suggestedMaxTokens?: number;
  recommendedTemplateCategories?: string[];
  recommendedPlugins?: string[];
  /** 角色能力声明（未来用于智能匹配） */
  capabilities?: string[];
}

// ============================================================
// 提示词模板 Manifest
// ============================================================

/** 结构化模板变量 */
export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  required: boolean;
  default?: string;
  options?: string[];               // type='select' 时的选项
  placeholder?: string;
}

export interface PromptTemplateManifest extends ResourceManifestBase {
  resourceType: 'prompt-template';
  variables?: TemplateVariable[];
  /** 期望输出格式 */
  outputFormat?: 'markdown' | 'json' | 'text';
  /** 预估 token 消耗 */
  estimatedTokens?: number;
}

// ============================================================
// 文档模板 Manifest
// ============================================================

export interface DocumentTemplateManifest extends ResourceManifestBase {
  resourceType: 'document-template';
  includeContent: boolean;
  includeAiContent: boolean;
  enabledPlugins: string[];
  pluginData?: Record<string, unknown>;
  /** 预览截图路径 */
  previewImage?: string;
}

// ============================================================
// 项目模板 Manifest
// ============================================================

/** 项目结构中的单个文档定义 */
export interface ProjectStructureItem {
  title: string;
  templateId?: string;              // 关联的文档模板 ID
  order: number;
  description?: string;
  requiredPlugins?: string[];
}

export interface ProjectTemplateManifest extends ResourceManifestBase {
  resourceType: 'project-template';
  documentCount: number;
  defaultPlugins: string[];
  structure: ProjectStructureItem[];
}

// ============================================================
// AI 服务商 Manifest
// ============================================================

/** AI 能力声明 */
export interface AIProviderCapabilities {
  webSearch: boolean;
  thinking: boolean;
  functionCalling: boolean;
  vision: boolean;
}

/** 详细模型定义 */
export interface AIModelDefinition {
  id: string;
  name: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportedFeatures?: string[];     // ['vision', 'thinking', 'function-calling']
  deprecated?: boolean;
  releaseDate?: string;
}

/** 定价信息（预留） */
export interface AIProviderPricing {
  inputPer1kTokens?: number;
  outputPer1kTokens?: number;
  currency?: string;
}

export interface AIProviderManifest extends ResourceManifestBase {
  resourceType: 'ai-provider';
  baseUrl: string;
  defaultModel: string;
  models: AIModelDefinition[];
  authHeader?: 'bearer' | 'x-api-key';
  capabilities: AIProviderCapabilities;
  /** 定价信息（预留） */
  pricing?: AIProviderPricing;
  /** 可用区域 */
  regions?: string[];               // ['cn', 'us', 'eu']
  /** 合规认证（预留） */
  compliance?: string[];            // ['gdpr', 'hipaa']
}

// ============================================================
// 插件 Manifest
// ============================================================

/** 插件权限 */
export type PluginPermission =
  | 'document:read'
  | 'document:write'
  | 'ai:chat'
  | 'ai:generate'
  | 'network:fetch'
  | 'clipboard:read'
  | 'clipboard:write'
  | 'storage:local'
  | 'notification:show'
  | 'file:read'
  | 'file:write';

export interface PluginResourceManifest extends ResourceManifestBase {
  resourceType: 'plugin';
  permissions: PluginPermission[];
  dependencies?: string[];
  conflicts?: string[];
  homepage?: string;
  entryPoint: string;               // 'index.ts'
  panelComponent?: string;          // 'Panel.tsx'
}

// ============================================================
// 分类体系
// ============================================================

/** 二级分类定义 */
export interface SubCategoryDefinition {
  key: string;
  name: string;
  icon?: string;
  order: number;
  i18n?: Record<string, { name?: string }>;
}

/** 一级分类定义 */
export interface CategoryDefinition {
  key: string;
  name: string;
  icon?: string;
  order: number;
  i18n?: Record<string, { name?: string }>;
  subCategories: SubCategoryDefinition[];
}

/** _meta.json 格式 */
export interface ResourceMetaConfig {
  schemaVersion: string;
  resourceType: ResourceType;
  defaultLocale: string;
  categories: CategoryDefinition[];
}

// ============================================================
// 资源包格式（.aidocpkg）
// ============================================================

/** 资源包 package.json */
export interface AidocPackageJson {
  name: string;                     // @scope/name
  version: string;                  // semver
  resourceType: ResourceType;
  aidocpkgVersion: string;          // 包格式版本

  author: AuthorInfo;
  contributors?: AuthorInfo[];
  license?: string;

  engines?: {
    aidocplus?: string;             // 最低主程序版本
  };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  repository?: string;
  homepage?: string;
  keywords?: string[];

  // 社区元数据（注册中心填充）
  publishedAt?: string;
  downloads?: number;
  rating?: number;
  verified?: boolean;
  featured?: boolean;
}

/** 资源包签名 */
export interface PackageSignature {
  algorithm: string;                // 'ed25519'
  publicKey: string;
  signatures: Record<string, string>;
  signedAt: string;
  signedBy: {
    name: string;
    keyId: string;
  };
}

// ============================================================
// 查询与过滤
// ============================================================

/** 资源查询过滤器 */
export interface ResourceFilter {
  resourceType?: ResourceType;
  majorCategory?: string;
  subCategory?: string;
  source?: ResourceSource;
  enabled?: boolean;
  tags?: string[];
  query?: string;                   // 全文搜索
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'updatedAt' | 'order' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/** 资源摘要（列表展示用，从 SQLite 索引读取） */
export interface ResourceSummary {
  id: string;
  packageName?: string;
  resourceType: ResourceType;
  name: string;
  description: string;
  icon: string;
  author: string;
  version: string;
  majorCategory: string;
  subCategory: string;
  tags: string[];
  order: number;
  enabled: boolean;
  source: ResourceSource;
  updatedAt: string;
}

/** 资源统计 */
export interface ResourceStats {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
}

// ============================================================
// 安装历史
// ============================================================

export type InstallAction = 'install' | 'update' | 'uninstall';

export interface InstallHistoryEntry {
  id: number;
  resourceId: string;
  action: InstallAction;
  fromVersion?: string;
  toVersion?: string;
  timestamp: string;
}
