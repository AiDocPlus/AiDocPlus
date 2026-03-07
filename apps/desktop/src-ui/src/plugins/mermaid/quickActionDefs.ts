/**
 * Mermaid 图表 AI 快捷操作定义
 *
 * 按 8 个分类组织，~40 个操作项，全面覆盖 Mermaid 图表使用场景。
 * 用户可完全自定义。与表格/思维导图插件架构一致：categories + items + storage。
 */

// ── 类型定义 ──

export interface QuickActionCategory {
  id: string;
  label: string;
  icon: string;
  order: number;
  builtin?: boolean;
}

export type ExecutionMode = 'direct' | 'ai' | 'hybrid';

export interface QuickActionItem {
  id: string;
  categoryId: string;
  label: string;
  icon: string;
  prompt: string;
  contextMode?: 'code' | 'structure' | 'full' | 'none';
  order: number;
  builtin?: boolean;
  hidden?: boolean;
  executionMode?: ExecutionMode;
  directAction?: string;
  keywords?: string[];
  dangerous?: boolean;
}

export interface QuickActionStore {
  categories: QuickActionCategory[];
  items: QuickActionItem[];
  version: number;
  favorites?: string[];
  recentUsed?: string[];
}

const STORAGE_KEY = '_mermaid_quick_actions';
const CURRENT_VERSION = 1;

// ── 默认内置分类（8 类） ──

const DEFAULT_CATEGORIES: QuickActionCategory[] = [
  { id: 'create',    label: '创建',   icon: 'FilePlus2',      order: 0,  builtin: true },
  { id: 'convert',   label: '转换',   icon: 'ArrowRightLeft', order: 1,  builtin: true },
  { id: 'optimize',  label: '优化',   icon: 'Sparkles',       order: 2,  builtin: true },
  { id: 'style',     label: '样式',   icon: 'Paintbrush',     order: 3,  builtin: true },
  { id: 'annotate',  label: '标注',   icon: 'MessageSquare',  order: 4,  builtin: true },
  { id: 'analyze',   label: '分析',   icon: 'BarChart3',      order: 5,  builtin: true },
  { id: 'template',  label: '模板',   icon: 'LayoutTemplate', order: 6,  builtin: true },
  { id: 'export',    label: '导出',   icon: 'FileOutput',     order: 7,  builtin: true },
];

// ── 默认内置操作项 ──

const DEFAULT_ITEMS: QuickActionItem[] = [

  // ━━━ 创建 (create) ━━━
  { id: 'create_flowchart',   categoryId: 'create', label: '流程图', icon: 'GitBranch', order: 0, builtin: true, contextMode: 'none',
    keywords: ['流程', '流程图', 'lct', 'flowchart'],
    prompt: '根据文档正文内容，生成一个 Mermaid 流程图（flowchart TD）。分析文档中的流程、步骤、决策点，用清晰的节点和连线表达。只输出 Mermaid 代码。' },
  { id: 'create_sequence',    categoryId: 'create', label: '时序图', icon: 'ArrowDownUp', order: 1, builtin: true, contextMode: 'none',
    keywords: ['时序', '序列', 'sxt', 'sequence'],
    prompt: '根据文档正文内容，生成一个 Mermaid 时序图（sequenceDiagram）。分析文档中的交互流程、消息传递关系。只输出 Mermaid 代码。' },
  { id: 'create_class',       categoryId: 'create', label: '类图', icon: 'Box', order: 2, builtin: true, contextMode: 'none',
    keywords: ['类图', 'lt', 'class'],
    prompt: '根据文档正文内容，生成一个 Mermaid 类图（classDiagram）。分析文档中的实体、属性、关系。只输出 Mermaid 代码。' },
  { id: 'create_state',       categoryId: 'create', label: '状态图', icon: 'Circle', order: 3, builtin: true, contextMode: 'none',
    keywords: ['状态', 'ztt', 'state'],
    prompt: '根据文档正文内容，生成一个 Mermaid 状态图（stateDiagram-v2）。分析文档中的状态转换。只输出 Mermaid 代码。' },
  { id: 'create_er',          categoryId: 'create', label: 'ER图', icon: 'Database', order: 4, builtin: true, contextMode: 'none',
    keywords: ['ER', '实体关系', 'er'],
    prompt: '根据文档正文内容，生成一个 Mermaid ER 图（erDiagram）。分析文档中的实体和关系。只输出 Mermaid 代码。' },
  { id: 'create_gantt',       categoryId: 'create', label: '甘特图', icon: 'CalendarDays', order: 5, builtin: true, contextMode: 'none',
    keywords: ['甘特', 'gtt', 'gantt'],
    prompt: '根据文档正文内容，生成一个 Mermaid 甘特图（gantt）。分析文档中的任务、时间安排、依赖关系。只输出 Mermaid 代码。' },
  { id: 'create_pie',         categoryId: 'create', label: '饼图', icon: 'PieChart', order: 6, builtin: true, contextMode: 'none',
    keywords: ['饼图', 'bt', 'pie'],
    prompt: '根据文档正文内容，生成一个 Mermaid 饼图（pie）。分析文档中的比例、分布数据。只输出 Mermaid 代码。' },
  { id: 'create_mindmap',     categoryId: 'create', label: 'Mermaid思维导图', icon: 'Brain', order: 7, builtin: true, contextMode: 'none',
    keywords: ['思维导图', 'swdt', 'mindmap'],
    prompt: '根据文档正文内容，生成一个 Mermaid 思维导图（mindmap）。分析文档的层级结构。只输出 Mermaid 代码。' },
  { id: 'create_timeline',    categoryId: 'create', label: '时间线', icon: 'Clock', order: 8, builtin: true, contextMode: 'none',
    keywords: ['时间线', 'sjx', 'timeline'],
    prompt: '根据文档正文内容，生成一个 Mermaid 时间线（timeline）。分析文档中的时间节点和事件。只输出 Mermaid 代码。' },
  { id: 'create_journey',     categoryId: 'create', label: '用户旅程', icon: 'Route', order: 9, builtin: true, contextMode: 'none',
    keywords: ['旅程', 'lc', 'journey'],
    prompt: '根据文档正文内容，生成一个 Mermaid 用户旅程图（journey）。分析用户体验流程。只输出 Mermaid 代码。' },
  { id: 'create_git',         categoryId: 'create', label: 'Git图', icon: 'GitBranch', order: 10, builtin: true, contextMode: 'none',
    keywords: ['git', 'Git'],
    prompt: '根据文档正文内容，生成一个 Mermaid Git 图（gitGraph）。展示分支、合并流程。只输出 Mermaid 代码。' },

  // ━━━ 转换 (convert) ━━━
  { id: 'convert_to_flowchart', categoryId: 'convert', label: '转为流程图', icon: 'ArrowRightLeft', order: 0, builtin: true, contextMode: 'code',
    keywords: ['转换', 'zh', 'convert'],
    prompt: '将当前图表转换为 Mermaid 流程图（flowchart TD）格式，保留原有的逻辑关系。只输出 Mermaid 代码。' },
  { id: 'convert_to_sequence', categoryId: 'convert', label: '转为时序图', icon: 'ArrowRightLeft', order: 1, builtin: true, contextMode: 'code',
    prompt: '将当前图表转换为 Mermaid 时序图（sequenceDiagram）格式。只输出 Mermaid 代码。' },
  { id: 'convert_direction_lr', categoryId: 'convert', label: '改为从左到右', icon: 'ArrowRight', order: 2, builtin: true, contextMode: 'code',
    keywords: ['方向', 'fx', 'direction', 'LR'],
    prompt: '将当前流程图的布局方向改为从左到右（LR）。只输出修改后的 Mermaid 代码。' },
  { id: 'convert_direction_td', categoryId: 'convert', label: '改为从上到下', icon: 'ArrowDown', order: 3, builtin: true, contextMode: 'code',
    prompt: '将当前流程图的布局方向改为从上到下（TD）。只输出修改后的 Mermaid 代码。' },
  { id: 'convert_add_subgraph', categoryId: 'convert', label: '添加子图分组', icon: 'LayoutDashboard', order: 4, builtin: true, contextMode: 'code',
    keywords: ['子图', 'zt', 'subgraph'],
    prompt: '分析当前图表，将逻辑相关的节点用 subgraph 分组。只输出修改后的 Mermaid 代码。' },

  // ━━━ 优化 (optimize) ━━━
  { id: 'optimize_simplify',  categoryId: 'optimize', label: '简化结构', icon: 'Minimize2', order: 0, builtin: true, contextMode: 'code',
    keywords: ['简化', 'jh', 'simplify'],
    prompt: '简化当前图表，合并冗余节点，移除不必要的连线，保持核心逻辑不变。只输出 Mermaid 代码。' },
  { id: 'optimize_detail',    categoryId: 'optimize', label: '丰富细节', icon: 'Maximize2', order: 1, builtin: true, contextMode: 'full',
    keywords: ['丰富', 'ff', 'detail'],
    prompt: '基于文档内容，丰富当前图表的细节。添加缺失的节点、连线和说明文字。只输出 Mermaid 代码。' },
  { id: 'optimize_labels',    categoryId: 'optimize', label: '优化标签文字', icon: 'Type', order: 2, builtin: true, contextMode: 'code',
    keywords: ['标签', 'bq', 'label'],
    prompt: '优化当前图表中所有节点和连线的标签文字，使其更简洁、专业、易读。只输出 Mermaid 代码。' },
  { id: 'optimize_layout',    categoryId: 'optimize', label: '优化布局', icon: 'LayoutDashboard', order: 3, builtin: true, contextMode: 'code',
    keywords: ['布局', 'bj', 'layout'],
    prompt: '优化当前图表的布局，调整节点顺序和连线方向，使图表更清晰易读。只输出 Mermaid 代码。' },
  { id: 'optimize_fix_syntax', categoryId: 'optimize', label: '修复语法', icon: 'Wrench', order: 4, builtin: true, contextMode: 'code',
    keywords: ['修复', 'xf', 'fix'],
    prompt: '检查并修复当前 Mermaid 代码中的语法错误。只输出修正后的 Mermaid 代码。' },

  // ━━━ 样式 (style) ━━━
  { id: 'style_add_class',    categoryId: 'style', label: '添加样式类', icon: 'Palette', order: 0, builtin: true, contextMode: 'code',
    keywords: ['样式', 'ys', 'style'],
    prompt: '为当前图表的关键节点添加 Mermaid 样式类（classDef + class），使用合适的颜色区分不同类型的节点。只输出 Mermaid 代码。' },
  { id: 'style_highlight_path', categoryId: 'style', label: '高亮关键路径', icon: 'Highlighter', order: 1, builtin: true, contextMode: 'code',
    keywords: ['高亮', 'gg', 'highlight'],
    prompt: '在当前流程图中找出关键路径，用粗线或颜色高亮标记。只输出 Mermaid 代码。' },
  { id: 'style_add_icons',    categoryId: 'style', label: '添加图标', icon: 'Smile', order: 2, builtin: true, contextMode: 'code',
    keywords: ['图标', 'tb', 'icon'],
    prompt: '为当前图表的节点添加合适的 emoji 图标前缀，使其更直观。只输出 Mermaid 代码。' },
  { id: 'style_node_shapes',  categoryId: 'style', label: '优化节点形状', icon: 'Shapes', order: 3, builtin: true, contextMode: 'code',
    keywords: ['形状', 'xz', 'shape'],
    prompt: '为当前图表的节点使用更合适的形状（圆角矩形、菱形、圆形、六边形等），根据节点类型（开始/结束/决策/处理/IO）选择。只输出 Mermaid 代码。' },

  // ━━━ 标注 (annotate) ━━━
  { id: 'annotate_add_notes', categoryId: 'annotate', label: '添加注释', icon: 'StickyNote', order: 0, builtin: true, contextMode: 'code',
    keywords: ['注释', 'zs', 'note'],
    prompt: '为当前图表的关键节点添加 note 注释，解释其含义或重要性。只输出 Mermaid 代码。' },
  { id: 'annotate_edge_labels', categoryId: 'annotate', label: '标注连线', icon: 'Tag', order: 1, builtin: true, contextMode: 'code',
    keywords: ['连线', 'lx', 'edge'],
    prompt: '为当前图表中缺少标签的连线添加描述性文字。只输出 Mermaid 代码。' },
  { id: 'annotate_add_links', categoryId: 'annotate', label: '添加点击链接', icon: 'Link', order: 2, builtin: true, contextMode: 'code',
    keywords: ['链接', 'lj', 'link'],
    prompt: '为当前图表的关键节点添加 click 事件链接。只输出 Mermaid 代码。' },

  // ━━━ 分析 (analyze) ━━━
  { id: 'analyze_explain',    categoryId: 'analyze', label: '解释图表', icon: 'HelpCircle', order: 0, builtin: true, contextMode: 'code',
    keywords: ['解释', 'js', 'explain'],
    prompt: '请详细解释当前图表的含义，包括各节点的作用、连线的逻辑关系、整体流程的目的。用中文回答。' },
  { id: 'analyze_check',     categoryId: 'analyze', label: '检查语法', icon: 'ShieldCheck', order: 1, builtin: true, contextMode: 'code',
    keywords: ['检查', 'jc', 'check'],
    prompt: '检查当前 Mermaid 代码是否有语法错误或潜在问题，列出发现的问题和修复建议。用中文回答。' },
  { id: 'analyze_complexity', categoryId: 'analyze', label: '复杂度分析', icon: 'BarChart3', order: 2, builtin: true, contextMode: 'code',
    keywords: ['复杂度', 'fzd', 'complexity'],
    prompt: '分析当前图表的复杂度，包括节点数、边数、层级深度，评估是否需要简化。用中文回答。' },
  { id: 'analyze_suggest',   categoryId: 'analyze', label: '改进建议', icon: 'Lightbulb', order: 3, builtin: true, contextMode: 'full',
    keywords: ['建议', 'jy', 'suggest'],
    prompt: '结合文档内容，分析当前图表是否完整、准确，给出具体的改进建议。用中文回答。' },

  // ━━━ 模板 (template) ━━━
  { id: 'tpl_software_arch',  categoryId: 'template', label: '软件架构图', icon: 'Server', order: 0, builtin: true, contextMode: 'none',
    keywords: ['架构', 'jg', 'arch'],
    prompt: '根据文档内容，生成一个软件架构图。包含前端、后端、数据库、中间件等典型层次。使用 flowchart TD + subgraph。只输出 Mermaid 代码。' },
  { id: 'tpl_business_flow',  categoryId: 'template', label: '业务流程图', icon: 'Workflow', order: 1, builtin: true, contextMode: 'none',
    keywords: ['业务', 'yw', 'business'],
    prompt: '根据文档内容，生成一个业务流程图。包含开始、结束、审批、决策等节点。使用 flowchart TD。只输出 Mermaid 代码。' },
  { id: 'tpl_user_journey',   categoryId: 'template', label: '用户体验地图', icon: 'Map', order: 2, builtin: true, contextMode: 'none',
    keywords: ['体验', 'ty', 'ux'],
    prompt: '根据文档内容，生成一个用户体验旅程图（journey）。展示用户使用产品的完整流程和情感变化。只输出 Mermaid 代码。' },
  { id: 'tpl_ci_cd',          categoryId: 'template', label: 'CI/CD流水线', icon: 'Rocket', order: 3, builtin: true, contextMode: 'none',
    keywords: ['CI', 'CD', '流水线', 'lsx'],
    prompt: '生成一个 CI/CD 流水线图。包含代码提交、构建、测试、部署等阶段。使用 flowchart LR。只输出 Mermaid 代码。' },
  { id: 'tpl_db_schema',      categoryId: 'template', label: '数据库模型', icon: 'Database', order: 4, builtin: true, contextMode: 'none',
    keywords: ['数据库', 'sjk', 'database'],
    prompt: '根据文档内容，生成一个数据库 ER 图（erDiagram）。分析文档中的实体、属性和关系。只输出 Mermaid 代码。' },
  { id: 'tpl_project_plan',   categoryId: 'template', label: '项目计划', icon: 'CalendarDays', order: 5, builtin: true, contextMode: 'none',
    keywords: ['项目', 'xm', 'project'],
    prompt: '根据文档内容，生成一个项目计划甘特图（gantt）。分析文档中的任务、里程碑和时间安排。只输出 Mermaid 代码。' },

  // ━━━ 导出 (export) ━━━
  { id: 'export_svg',         categoryId: 'export', label: '导出 SVG', icon: 'FileImage', order: 0, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_svg',
    keywords: ['SVG', '导出'],
    prompt: '' },
  { id: 'export_png',         categoryId: 'export', label: '导出 PNG', icon: 'Image', order: 1, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_png',
    keywords: ['PNG', '导出'],
    prompt: '' },
  { id: 'export_jpeg',        categoryId: 'export', label: '导出 JPEG', icon: 'Image', order: 2, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_jpeg',
    keywords: ['JPEG', 'JPG', '导出'],
    prompt: '' },
  { id: 'export_webp',        categoryId: 'export', label: '导出 WebP', icon: 'Image', order: 3, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_webp',
    keywords: ['WebP', '导出'],
    prompt: '' },
  { id: 'export_code',        categoryId: 'export', label: '导出代码文件', icon: 'FileCode', order: 4, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_code',
    keywords: ['代码', 'dm', 'code'],
    prompt: '' },
  { id: 'export_to_doc',      categoryId: 'export', label: '插入到文档', icon: 'FileInput', order: 5, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_to_doc',
    keywords: ['文档', 'wd', 'doc'],
    prompt: '' },
];

// ── 获取默认数据 ──

export function getDefaultStore(): QuickActionStore {
  return {
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
    version: CURRENT_VERSION,
    favorites: [],
    recentUsed: [],
  };
}

// ── 合并内置项（升级时保留用户自定义） ──

function mergeWithDefaults(stored: QuickActionStore): QuickActionStore {
  const result = { ...stored, version: CURRENT_VERSION };

  for (const dc of DEFAULT_CATEGORIES) {
    if (!result.categories.find(c => c.id === dc.id)) {
      result.categories.push({ ...dc });
    }
  }

  for (const di of DEFAULT_ITEMS) {
    const existing = result.items.find(i => i.id === di.id);
    if (!existing) {
      result.items.push({ ...di });
    } else if (existing.builtin) {
      if (di.executionMode && !existing.executionMode) existing.executionMode = di.executionMode;
      if (di.directAction && !existing.directAction) existing.directAction = di.directAction;
      if (di.keywords && !existing.keywords) existing.keywords = di.keywords;
    }
  }

  return result;
}

// ── Storage 接口 ──

interface StorageLike {
  get<T>(key: string): T | null | undefined;
  set(key: string, value: unknown): void;
}

// ── 加载 / 保存 / 重置 ──

export function loadQuickActions(storage: StorageLike): QuickActionStore {
  const stored = storage.get<QuickActionStore>(STORAGE_KEY);
  if (!stored || !stored.categories || !stored.items) {
    return getDefaultStore();
  }
  return mergeWithDefaults(stored);
}

export function saveQuickActions(storage: StorageLike, data: QuickActionStore): void {
  storage.set(STORAGE_KEY, { ...data, version: CURRENT_VERSION });
}

export function resetQuickActions(storage: StorageLike): QuickActionStore {
  const defaults = getDefaultStore();
  saveQuickActions(storage, defaults);
  return defaults;
}

export function genActionId(): string {
  return `mqa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── 获取内置项的默认提示词 ──

export function getBuiltinPrompt(itemId: string): string | undefined {
  return DEFAULT_ITEMS.find(i => i.id === itemId)?.prompt;
}

// ── 获取内置分类的默认标签 ──

export function getBuiltinCategoryLabel(catId: string): string | undefined {
  return DEFAULT_CATEGORIES.find(c => c.id === catId)?.label;
}

// ── 获取所有内置分类 ID ──

export function getBuiltinCategoryIds(): string[] {
  return DEFAULT_CATEGORIES.map(c => c.id);
}

// ── 导出配置为 JSON 字符串 ──

export function exportConfig(data: QuickActionStore): string {
  return JSON.stringify(data, null, 2);
}

// ── 导入配置 ──

export function importConfig(json: string): QuickActionStore | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.items)) {
      return mergeWithDefaults(parsed as QuickActionStore);
    }
    return null;
  } catch {
    return null;
  }
}

// ── 记录最近使用 ──

export function recordRecentUsed(store: QuickActionStore, itemId: string): QuickActionStore {
  const recent = (store.recentUsed || []).filter(id => id !== itemId);
  recent.unshift(itemId);
  return { ...store, recentUsed: recent.slice(0, 20) };
}

// ── 兼容旧导出 ──

export function getDefaultCategories(): QuickActionCategory[] {
  return DEFAULT_CATEGORIES;
}

export function getDefaultItems(): QuickActionItem[] {
  return DEFAULT_ITEMS;
}
