// ============================================================
// 资源管理器配置（每个管理器提供一份）
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ResourceTypeConfig<CustomPanel = any> {
  /** 窗口标题 */
  appTitle: string;
  /** 资源类型标识 */
  resourceType: string;
  /** 资源类型中文标签 */
  resourceLabel: string;
  /** 默认数据目录名（'data' 或 'plugins'） */
  defaultDataDir: string;
  /** 资源仓库根目录（用于执行 build.sh） */
  repoDir?: string;
  /** 附属内容文件定义 */
  contentFiles: ContentFileSpec[];
  /** 特有 manifest 字段定义 */
  extraManifestFields: FieldDefinition[];
  /** 自定义编辑面板（渲染在通用字段下方） */
  CustomEditorPanel?: CustomPanel;
  /** 新建资源时的默认 manifest 模板 */
  defaultManifest: Partial<ManifestBase>;
  /** AI 生成配置 */
  aiGenerate: AIGenerateConfig;
  /** 数据模式：directory（目录结构）或 json-file（每个分类一个JSON文件） */
  dataMode?: 'directory' | 'json-file';
}

// ============================================================
// AI 生成配置
// ============================================================

export interface AIGenerateConfig {
  /** 系统提示词模板（描述该资源类型的结构和要求） */
  systemPromptTemplate: string;
  /** AI 应输出的文件列表 */
  outputFiles: string[];
  /** 示例资源 ID（作为 few-shot 参考） */
  exampleResources?: string[];
}

export interface AIServiceConfig {
  /** API Base URL */
  baseUrl: string;
  /** API Key */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 温度 */
  temperature?: number;
}

// ============================================================
// Manifest 基础结构
// ============================================================

export interface ManifestBase {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  author: string | AuthorInfo;
  resourceType: string;
  majorCategory: string;
  subCategory: string;
  tags: string[];
  order: number;
  enabled: boolean;
  source: string;
  roles?: string[];
  createdAt: string;
  updatedAt: string;
  i18n?: Record<string, I18nEntry>;
  [key: string]: unknown;
}

export interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
}

export interface I18nEntry {
  name?: string;
  description?: string;
}

// ============================================================
// 分类结构（_meta.json）
// ============================================================

export interface MetaConfig {
  schemaVersion: string;
  resourceType: string;
  categories: CategoryDefinition[];
}

export interface CategoryDefinition {
  key: string;
  name: string;
  icon?: string;
  order: number;
}

// ============================================================
// 资源项（前端使用）
// ============================================================

export interface ResourceItem {
  /** 资源 ID */
  id: string;
  /** manifest 所在目录的绝对路径 */
  path: string;
  /** 完整 manifest 数据 */
  manifest: ManifestBase;
  /** 附属内容文件内容 */
  contentFiles: Record<string, string>;
  /** 是否有未保存的修改 */
  isDirty: boolean;
}

export interface ResourceSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  majorCategory: string;
  subCategory: string;
  tags: string[];
  order: number;
  enabled: boolean;
  source: string;
  path: string;
}

// ============================================================
// 编辑面板 Props
// ============================================================

export interface EditorPanelProps {
  /** 当前选中的资源 */
  resource: ResourceItem;
  /** 变更回调 */
  onChange: (changes: ResourceChanges) => void;
}

export interface ResourceChanges {
  /** manifest 字段变更 */
  manifest?: Partial<ManifestBase>;
  /** 内容文件变更 */
  contentFiles?: Record<string, string>;
}

// ============================================================
// 字段定义（用于动态表单生成）
// ============================================================

export interface FieldDefinition {
  /** 字段 key（对应 manifest 中的 key） */
  key: string;
  /** 显示标签 */
  label: string;
  /** 字段类型 */
  type: FieldType;
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  defaultValue?: unknown;
  /** 下拉选项（type 为 'select' 时） */
  options?: SelectOption[];
  /** 占位符 */
  placeholder?: string;
  /** 描述/帮助文本 */
  description?: string;
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'tags'
  | 'color'
  | 'json'
  | 'i18n-editor'
  | 'model-list'
  | 'capabilities';

export interface SelectOption {
  value: string;
  label: string;
}

// ============================================================
// 内容文件定义
// ============================================================

export interface ContentFileSpec {
  /** 文件名 */
  filename: string;
  /** 文件类型 */
  type: 'markdown' | 'json' | 'text';
  /** UI 显示标签 */
  label: string;
  /** 新建时的默认内容 */
  defaultContent: string;
}

// ============================================================
// 导入导出
// ============================================================

export interface ExportOptions {
  /** 要导出的资源路径列表 */
  resourcePaths: string[];
  /** 输出 ZIP 文件路径 */
  outputPath: string;
}

export interface ImportResult {
  /** 成功导入的资源 ID 列表 */
  imported: string[];
  /** 跳过的资源（已存在） */
  skipped: string[];
  /** 失败的资源 */
  failed: Array<{ id: string; error: string }>;
}

// ============================================================
// 批量操作
// ============================================================

export interface BatchOperation {
  type: 'set-enabled' | 'set-roles' | 'move-category' | 'update-field';
  resourcePaths: string[];
  value: unknown;
}
