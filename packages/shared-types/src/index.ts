/**
 * Shared type definitions for AiDocPlus
 */
import { BUILT_IN_ROLES as _BUILT_IN_ROLES } from './generated/roles.generated';

// ============================================================
// Project Types
// ============================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number; // Unix timestamp in seconds
  updatedAt: number; // Unix timestamp in seconds
  settings: ProjectSettings;
  path: string;
}

export interface ProjectSettings {
  aiProvider: AIProvider;
  defaultExportFormat: ExportFormat;
  autoSaveInterval: number; // in seconds
  versionHistoryLimit: number;
  theme: 'light' | 'dark' | 'auto';
}

// ============================================================
// Document Types
// ============================================================

export interface Attachment {
  id: string;
  fileName: string;       // 原始文件名
  filePath: string;       // 本地文件路径
  fileSize: number;       // 文件大小 (bytes)
  fileType: string;       // 扩展名 (txt/md/docx/csv/...)
  addedAt: number;        // 添加时间戳 (Unix seconds)
}

export interface Document {
  id: string;
  projectId: string;
  title: string;
  content: string;
  authorNotes: string; // 作者输入
  aiGeneratedContent: string; // AI生成内容
  versions: DocumentVersion[]; // 历史版本
  currentVersionId: string;
  metadata: DocumentMetadata;
  attachments?: Attachment[]; // 附件列表
  pluginData?: Record<string, unknown>;  // 插件数据，key = 插件 UUID
  enabledPlugins?: string[];  // 该文档启用的插件 UUID 列表（顺序即标签栏顺序）
  composedContent?: string;  // 合并内容（Markdown），汇集正文+插件片段+外部导入
}

// ============================================================
// Plugin Manifest Types
// ============================================================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;              // lucide-react 图标名称
  author: string;
  type: 'builtin' | 'custom';
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  majorCategory: string;         // 大类：'content-generation' | 'functional' | ...
  subCategory: string;           // 子类：'ai-text' | 'visualization' | 'communication' | ...
  category: string;              // 兼容旧数据（= subCategory 别名）
  tags: string[];                // 搜索标签（中英文关键词）
  // ── 插件市场预留字段 ──
  homepage?: string;             // 插件主页/文档链接
  license?: string;              // 许可证
  minAppVersion?: string;        // 最低应用版本要求
  permissions?: string[];        // 所需权限
  dependencies?: string[];       // 依赖的其他插件 UUID
  conflicts?: string[];          // 互斥的插件 UUID
}

// ============================================================
// Template Types
// ============================================================

export interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  icon: string;                  // lucide-react 图标名称
  author: string;
  type: 'builtin' | 'custom';
  category: string;              // 分类 key
  tags: string[];
  createdAt: number;
  updatedAt: number;
  includeContent: boolean;       // 是否包含素材内容
  includeAiContent: boolean;     // 是否包含正文内容
  enabledPlugins: string[];      // 预设插件列表
  pluginData?: Record<string, unknown>;
  minAppVersion?: string;
}

export interface TemplateContent {
  authorNotes: string;
  aiGeneratedContent: string;
  content: string;
  pluginData?: Record<string, unknown>;
}

export interface TemplateCategory {
  key: string;
  label: string;
  order: number;
  type: 'builtin' | 'custom';
}

// ============================================================
// Document Metadata & Version Types
// ============================================================

export interface DocumentMetadata {
  createdAt: number; // Unix timestamp in seconds
  updatedAt: number; // Unix timestamp in seconds
  author: string;
  tags: string[];
  wordCount: number;
  characterCount: number;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  content: string;
  authorNotes: string;
  aiGeneratedContent: string; // AI 生成内容
  createdAt: number; // Unix timestamp in seconds
  createdBy: 'user' | 'ai';
  changeDescription?: string;
  pluginData?: Record<string, unknown>;    // 插件数据快照
  enabledPlugins?: string[];               // 启用的插件列表快照
  composedContent?: string;                // 合并内容快照
}

// Helper function to convert timestamp to Date
export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

// Helper function to convert Date to timestamp
export function dateToTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// ============================================================
// AI Provider Types
// ============================================================

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'deepseek' | 'qwen' | 'glm' | 'glm-code' | 'minimax' | 'minimax-code' | 'kimi' | 'kimi-code' | 'custom';

export interface AIProviderCapabilities {
  webSearch: boolean;
  thinking: boolean;
  functionCalling: boolean;
  vision: boolean;
}

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: { id: string; name: string }[];
  authHeader?: 'bearer' | 'x-api-key';
  capabilities: AIProviderCapabilities;
}

// AI_PROVIDERS 已外部化到 AiDocPlus-AIProviders
export { AI_PROVIDERS, getProviderConfig } from './generated/ai-providers.generated';

export type ChatContextMode = 'none' | 'material' | 'prompt' | 'generated';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number; // Unix timestamp in seconds
  contextMode?: ChatContextMode; // 聊天上下文模式（仅 assistant 消息使用）
}

export interface AIRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stopSequences?: string[];
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
}

// ============================================================
// Slides / PPT Types
// ============================================================

export type SlideLayout =
  | 'title'           // 封面（大标题 + 副标题）
  | 'section'         // 章节分隔页
  | 'content'         // 标题 + 要点列表
  | 'two-column'      // 双栏
  | 'image-text'      // 图文混排
  | 'blank';          // 空白

export interface Slide {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  content: string[];            // 正文要点（每条一个 bullet）
  notes?: string;               // 演讲者备注
  imageUrl?: string;            // 图片（可选）
  order: number;
}

export interface PptThemeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
}

export interface PptThemeFontSizes {
  title: number;      // 封面标题 (默认 48)
  subtitle: number;   // 副标题 (默认 24)
  heading: number;    // 内容页标题 (默认 32)
  body: number;       // 正文要点 (默认 22)
}

export const DEFAULT_FONT_SIZES: PptThemeFontSizes = {
  title: 44,
  subtitle: 22,
  heading: 28,
  body: 20,
};

export interface PptTheme {
  id: string;
  name: string;
  colors: PptThemeColors;
  fonts: {
    title: string;
    body: string;
  };
  fontSizes?: PptThemeFontSizes;
}

export interface SlidesDeck {
  slides: Slide[];
  theme: PptTheme;
  aspectRatio: '16:9' | '4:3';
}

// ============================================================
// Export Types
// ============================================================

export type ExportFormat = 'md' | 'docx' | 'xlsx' | 'pptx' | 'html' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  includeVersionHistory?: boolean;
  includeMetadata?: boolean;
  template?: string;
}

// ============================================================
// Plugin Types
// ============================================================

export interface PluginManifest {
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  engines: {
    aidocplus: string;
  };
  activationEvents?: string[];
  contributes?: PluginContributes;
  main: string;
}

export interface PluginContributes {
  commands?: PluginCommand[];
  views?: PluginView[];
  statusBarItems?: PluginStatusBarItem[];
}

export interface PluginCommand {
  id: string;
  title: string;
  category?: string;
  icon?: string;
  keybinding?: string;
}

export interface PluginView {
  id: string;
  name: string;
  location: 'left' | 'right' | 'bottom';
  icon?: string;
}

export interface PluginStatusBarItem {
  id: string;
  text: string;
  alignment: 'left' | 'right';
  command?: string;
}

export interface ExtensionContext {
  subscriptions: Disposable[];
  workspaceState: StateStorage;
  globalState: StateStorage;
  extensionPath: string;
}

export interface Disposable {
  dispose(): void;
}

export interface StateStorage {
  get<T>(key: string, defaultValue?: T): Promise<T>;
  update(key: string, value: unknown): Promise<void>;
}

// ============================================================
// File System Types (for Tauri IPC)
// ============================================================

export interface FileSystemEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  children?: FileSystemEntry[];
}

export interface FileReadResult {
  path: string;
  content: string;
  encoding: string;
}

// ============================================================
// Error Types
// ============================================================

export class AiDocPlusError extends Error {
  code: string;
  details?: unknown;

  constructor(
    message: string,
    code: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AiDocPlusError';
    this.code = code;
    this.details = details;
  }
}

export function isAiDocPlusError(error: unknown): error is AiDocPlusError {
  return error instanceof AiDocPlusError;
}

// ============================================================
// Settings Types
// ============================================================

export type SupportedLanguage = 'zh' | 'en' | 'ja';

export interface ToolbarButtons {
  undo: boolean;           // 撤销
  redo: boolean;           // 重做
  copy: boolean;           // 复制
  cut: boolean;            // 剪切
  paste: boolean;          // 粘贴
  clearAll: boolean;       // 清空全部内容
  headings: boolean;       // 标题下拉
  bold: boolean;           // 粗体
  italic: boolean;         // 斜体
  strikethrough: boolean;  // 删除线
  inlineCode: boolean;     // 行内代码
  clearFormat: boolean;    // 清除格式
  unorderedList: boolean;  // 无序列表
  orderedList: boolean;    // 有序列表
  taskList: boolean;       // 任务列表
  quote: boolean;          // 引用
  horizontalRule: boolean; // 分隔线
  link: boolean;           // 链接
  image: boolean;          // 图片
  table: boolean;          // 表格
  footnote: boolean;       // 脚注
  codeBlock: boolean;      // 代码块
  mermaid: boolean;        // Mermaid 图表
  math: boolean;           // 数学公式
  importFile: boolean;     // 导入文件
  goToTop: boolean;        // 滚动到顶部
  goToBottom: boolean;     // 滚动到底部
}

export interface EditorSettings {
  fontSize: number; // in pixels
  fontFamily: string; // font family for editor
  lineHeight: number; // ratio
  tabSize: number; // in spaces
  autoSave: boolean;
  autoSaveInterval: number; // in seconds
  showLineNumbers: boolean;
  wordWrap: boolean;
  spellCheck: boolean;
  highlightActiveLine: boolean; // 高亮当前行
  bracketMatching: boolean; // 括号匹配
  closeBrackets: boolean; // 自动闭合括号
  codeFolding: boolean; // 代码折叠
  highlightSelectionMatches: boolean; // 高亮选中文本的其他匹配
  autocompletion: boolean; // 自动补全
  multiCursor: boolean; // 多光标编辑
  scrollPastEnd: boolean; // 允许滚动到文档末尾之后
  indentOnInput: boolean; // 输入时自动缩进
  markdownLint: boolean; // Markdown 语法检查
  defaultViewMode: 'edit' | 'preview' | 'split'; // 默认视图模式
  toolbarButtons: ToolbarButtons; // 工具栏按钮可见性
}

export interface UISettings {
  theme: 'light' | 'dark' | 'auto';
  language: SupportedLanguage;
  layout: 'vertical' | 'horizontal';
  fontSize: number; // UI font size in pixels
  sidebarWidth: number; // in pixels
  chatPanelWidth: number; // in pixels
}

export interface FileSettings {
  defaultPath: string;
  autoBackup: boolean;
  backupInterval: number; // in seconds
  maxBackups: number;
}

/** 单个 AI 服务配置 */
export interface AIServiceConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
  /** 最近一次连接测试结果：true=成功, false=失败, undefined=未测试 */
  lastTestOk?: boolean;
}

export interface AISettings {
  services: AIServiceConfig[];
  activeServiceId: string;
  temperature: number;
  maxTokens: number;
  streamEnabled: boolean;
  systemPrompt: string;
  /** 插件发送给 AI 的正文最大字符数，0 表示不限制 */
  maxContentLength: number;
  /** 启用后 AI 将始终以纯净 Markdown 格式返回内容 */
  markdownMode: boolean;
  /** markdownMode 开启时追加的格式约束提示词 */
  markdownModePrompt: string;
  /** 启用深度思考模式（对支持的模型启用推理/思考能力） */
  enableThinking: boolean;
}

/** 获取当前激活的服务配置 */
export function getActiveService(ai: AISettings): AIServiceConfig | undefined {
  return ai.services.find(s => s.id === ai.activeServiceId && s.enabled);
}

// ============================================================
// Email Settings
// ============================================================

/** 邮件服务商预设 */
export interface EmailProviderPreset {
  id: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  encryption: 'tls' | 'starttls' | 'none';
}

export const EMAIL_PROVIDER_PRESETS: EmailProviderPreset[] = [
  { id: 'netease163', name: '网易 163',    smtpHost: 'smtp.163.com',      smtpPort: 465, encryption: 'tls' },
  { id: 'netease126', name: '网易 126',    smtpHost: 'smtp.126.com',      smtpPort: 465, encryption: 'tls' },
  { id: 'china139',   name: '移动 139',    smtpHost: 'smtp.139.com',      smtpPort: 465, encryption: 'tls' },
  { id: 'qq',         name: 'QQ 邮箱',     smtpHost: 'smtp.qq.com',       smtpPort: 465, encryption: 'tls' },
  { id: 'gmail',      name: 'Gmail',       smtpHost: 'smtp.gmail.com',    smtpPort: 465, encryption: 'tls' },
  { id: 'outlook',    name: 'Outlook',     smtpHost: 'smtp.office365.com', smtpPort: 587, encryption: 'starttls' },
  { id: 'aliyun',     name: '阿里云邮箱',  smtpHost: 'smtp.aliyun.com',   smtpPort: 465, encryption: 'tls' },
  { id: 'custom',     name: '自定义',      smtpHost: '',                   smtpPort: 465, encryption: 'tls' },
];

export function getEmailPreset(presetId: string): EmailProviderPreset | undefined {
  return EMAIL_PROVIDER_PRESETS.find(p => p.id === presetId);
}

/** 单个邮箱账户配置 */
export interface EmailAccountConfig {
  id: string;
  name: string;
  provider: string;
  smtpHost: string;
  smtpPort: number;
  encryption: 'tls' | 'starttls' | 'none';
  email: string;
  password: string;
  displayName?: string;
  enabled: boolean;
  lastTestOk?: boolean;
}

export interface EmailSettings {
  accounts: EmailAccountConfig[];
  activeAccountId: string;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  accounts: [],
  activeAccountId: '',
};

/** 获取当前激活的邮箱账户 */
export function getActiveEmailAccount(email: EmailSettings): EmailAccountConfig | undefined {
  return email.accounts.find(a => a.id === email.activeAccountId && a.enabled);
}

// ============================================================
// User Role Types
// ============================================================

export interface UserRole {
  id: string;
  name: string;
  icon: string;
  description: string;
  isBuiltIn: boolean;
  /** 角色专属 System Prompt（拼接在用户自定义 prompt 之前） */
  systemPrompt: string;
  /** 可选：覆盖 markdownModePrompt */
  markdownModePrompt?: string;
  /** 可选：推荐的 AI temperature */
  suggestedTemperature?: number;
  /** 可选：推荐的 AI maxTokens */
  suggestedMaxTokens?: number;
  /** 可选：推荐的模板分类 key */
  recommendedTemplateCategories?: string[];
  /** 可选：推荐的插件 ID */
  recommendedPlugins?: string[];
}

export interface RoleSettings {
  /** 当前激活角色 ID，'' 表示无角色 */
  activeRoleId: string;
  /** 自定义角色列表（内置角色不持久化） */
  customRoles: UserRole[];
}

// BUILT_IN_ROLES 已外部化到 AiDocPlus-Roles
export const BUILT_IN_ROLES = _BUILT_IN_ROLES;

export const DEFAULT_ROLE_SETTINGS: RoleSettings = {
  activeRoleId: '',
  customRoles: [],
};

/** 获取当前激活的角色 */
export function getActiveRole(role: RoleSettings): UserRole | undefined {
  if (!role.activeRoleId) return undefined;
  const builtIn = BUILT_IN_ROLES.find(r => r.id === role.activeRoleId);
  if (builtIn) return builtIn;
  return role.customRoles.find(r => r.id === role.activeRoleId);
}

/** 获取所有角色（内置 + 自定义） */
export function getAllRoles(role: RoleSettings): UserRole[] {
  return [...BUILT_IN_ROLES, ...role.customRoles];
}

export interface AppSettings {
  editor: EditorSettings;
  ui: UISettings;
  file: FileSettings;
  ai: AISettings;
  email: EmailSettings;
  role: RoleSettings;
  shortcuts: Record<string, string>;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 16,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  lineHeight: 1.6,
  tabSize: 4,
  autoSave: true,
  autoSaveInterval: 30,
  showLineNumbers: true,
  wordWrap: true,
  spellCheck: false,
  highlightActiveLine: true,
  bracketMatching: true,
  closeBrackets: false,
  codeFolding: false,
  highlightSelectionMatches: true,
  autocompletion: true,
  multiCursor: true,
  scrollPastEnd: false,
  indentOnInput: true,
  markdownLint: true,
  defaultViewMode: 'edit',
  toolbarButtons: {
    undo: true,
    redo: true,
    copy: true,
    cut: true,
    paste: true,
    clearAll: true,
    headings: true,
    bold: true,
    italic: true,
    strikethrough: true,
    inlineCode: true,
    clearFormat: true,
    unorderedList: true,
    orderedList: true,
    taskList: true,
    quote: true,
    horizontalRule: true,
    link: true,
    image: true,
    table: true,
    footnote: true,
    codeBlock: true,
    mermaid: true,
    math: true,
    importFile: true,
    goToTop: true,
    goToBottom: true,
  },
};

export const DEFAULT_UI_SETTINGS: UISettings = {
  theme: 'light',
  language: 'zh',
  layout: 'vertical',
  fontSize: 14,
  sidebarWidth: 280,
  chatPanelWidth: 320
};

export const DEFAULT_FILE_SETTINGS: FileSettings = {
  defaultPath: '',
  autoBackup: true,
  backupInterval: 300,
  maxBackups: 10
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  services: [],
  activeServiceId: '',
  temperature: 0.7,
  maxTokens: 2000,
  streamEnabled: true,
  systemPrompt: '',
  maxContentLength: 0,
  markdownMode: true,
  markdownModePrompt: `你是一个专业的文档写作助手。请严格遵守以下规则：
1. 始终使用 Markdown 格式输出
2. 直接输出所要求的内容，不要有任何开场白、寒暄、总结语或解释性文字
3. 不要用代码块包裹整个输出内容（即不要在最外层加 \`\`\`markdown ... \`\`\`）
4. 合理使用标题层级、列表、表格等 Markdown 元素组织内容，但不要对正文中的词汇使用加粗
5. 保持内容专业、准确、结构清晰`,
  enableThinking: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  editor: DEFAULT_EDITOR_SETTINGS,
  ui: DEFAULT_UI_SETTINGS,
  file: DEFAULT_FILE_SETTINGS,
  ai: DEFAULT_AI_SETTINGS,
  email: DEFAULT_EMAIL_SETTINGS,
  role: DEFAULT_ROLE_SETTINGS,
  shortcuts: {
    'search': 'CmdOrCtrl+Shift+F',
    'save': 'CmdOrCtrl+S',
    'newDocument': 'CmdOrCtrl+N',
    'newProject': 'CmdOrCtrl+Shift+N',
    'toggleSidebar': 'CmdOrCtrl+B',
    'toggleChat': 'CmdOrCtrl+Shift+C',
    'export': 'CmdOrCtrl+E',
    'settings': 'CmdOrCtrl+,'
  }
};

// ============================================================
// Event Types
// ============================================================

export const EventTypeValues = [
  'project:created',
  'project:updated',
  'project:deleted',
  'document:created',
  'document:updated',
  'document:deleted',
  'version:created',
  'ai:generation:start',
  'ai:generation:progress',
  'ai:generation:complete',
  'export:start',
  'export:complete',
  'plugin:loaded',
  'plugin:unloaded',
] as const;

export type EventType = typeof EventTypeValues[number];

export interface EventPayloadMap {
  'project:created': Project;
  'project:updated': Project;
  'project:deleted': { id: string };
  'document:created': Document;
  'document:updated': Document;
  'document:deleted': { id: string };
  'version:created': DocumentVersion;
  'ai:generation:start': { documentId: string };
  'ai:generation:progress': { documentId: string; progress: number };
  'ai:generation:complete': { documentId: string; content: string };
  'export:start': { documentId: string; format: ExportFormat };
  'export:complete': { documentId: string; outputPath: string };
  'plugin:loaded': { pluginId: string };
  'plugin:unloaded': { pluginId: string };
}

export interface EventEmitter {
  on<K extends EventType>(event: K, callback: (payload: EventPayloadMap[K]) => void): Disposable;
  emit<K extends EventType>(event: K, payload: EventPayloadMap[K]): void;
  off<K extends EventType>(event: K, callback: (payload: EventPayloadMap[K]) => void): void;
}

// ============================================================
// Search Types
// ============================================================

export type SearchMatchType = 'title' | 'content';

export interface SearchMatch {
  type: SearchMatchType;
  line?: number;
  column?: number;
  context: string;
  preview: string;
}

export interface SearchResult {
  documentId: string;
  projectId: string;
  title: string;
  matches: SearchMatch[];
}

export interface SearchOptions {
  query: string;
  searchContent: boolean;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  limit?: number;
}

export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
  resultCount: number;
}

// ============================================================
// Prompt Template Types
// ============================================================

export type PromptTemplateCategory = string;

export interface TemplateCategoryInfo {
  name: string;
  icon: string;
  isBuiltIn?: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: PromptTemplateCategory;
  content: string;
  variables?: string[];
  isBuiltIn: boolean;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
}

// BUILT_IN_TEMPLATES 已外部化到 AiDocPlus-PromptTemplates
export { BUILT_IN_TEMPLATES } from './generated/prompt-templates.generated';

// TEMPLATE_CATEGORIES 已外部化到 AiDocPlus-PromptTemplates
export { TEMPLATE_CATEGORIES } from './generated/template-categories.generated';

// BUILT_IN_PPT_THEMES + DEFAULT_PPT_THEME 已外部化到 AiDocPlus-DocTemplates
export { BUILT_IN_PPT_THEMES, DEFAULT_PPT_THEME } from './generated/ppt-themes.generated';

// ============================================================
// Conversation Types
// ============================================================

export interface Conversation {
  id: string;
  documentId: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
}

export interface ConversationGroup {
  label: string;
  conversations: Conversation[];
}

export const CONVERSATION_GROUPS = {
  today: 'today',
  yesterday: 'yesterday',
  lastWeek: 'lastWeek',
  lastMonth: 'lastMonth',
  older: 'older'
} as const;

// ============================================================
// Editor Tab Types
// ============================================================

export interface EditorTab {
  id: string;
  documentId: string;
  title: string;
  isDirty: boolean;
  isActive: boolean;
  order: number;
  panelState: {
    versionHistoryOpen: boolean;
    chatOpen: boolean;
    rightSidebarOpen: boolean;
    layoutMode?: 'vertical' | 'horizontal';
    splitRatio?: number;
    chatPanelWidth?: number;
    activePluginId?: string;
  };
}

// ============================================================
// Workspace State Types
// ============================================================

export interface WorkspaceTabState {
  id: string;
  documentId: string;
  panelState: EditorTab['panelState'];
}

export interface WorkspaceState {
  currentProjectId: string | null;
  openDocumentIds: string[]; // 保持兼容性
  currentDocumentId: string | null; // 保持兼容性

  // 新增标签页状态
  tabs: WorkspaceTabState[];
  activeTabId: string | null;

  uiState: {
    sidebarOpen: boolean;
    chatOpen: boolean;
    sidebarWidth?: number;
    layoutMode?: 'vertical' | 'horizontal';
    splitRatio?: number;
    chatPanelWidth?: number;
    windowWidth?: number;
    windowHeight?: number;
    windowX?: number;
    windowY?: number;
  };
  lastSavedAt: number;
}
