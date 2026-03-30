/**
 * 大纲文档 AI 快捷操作定义
 *
 * 多分类快捷操作，支持收藏、最近使用、关键词搜索。
 */

// ═══════════════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════════════

export interface OutlineQuickActionCategory {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  order: number;
  builtin?: boolean;
  hidden?: boolean;
}

export interface OutlineQuickActionItem {
  id: string;
  categoryId: string;
  label: string;
  labelEn: string;
  icon: string;
  prompt: string;
  order: number;
  builtin?: boolean;
  hidden?: boolean;
  keywords?: string[];
  /** 是否需要当前节点（空大纲时禁用） */
  requiresActiveNode?: boolean;
}

export interface OutlineQuickActionStore {
  categories: OutlineQuickActionCategory[];
  items: OutlineQuickActionItem[];
  version: number;
  favorites?: string[];
  recentUsed?: string[];
}

const STORAGE_KEY = '_outline_quick_actions';
const CURRENT_VERSION = 1;

// ═══════════════════════════════════════════════════════════════════════════
// 默认分类
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_CATEGORIES: OutlineQuickActionCategory[] = [
  { id: 'generate', label: '生成扩展', labelEn: 'Generate & Expand', icon: 'Sparkles', order: 0, builtin: true },
  { id: 'polish', label: '内容润色', labelEn: 'Polish', icon: 'Wand2', order: 1, builtin: true },
  { id: 'structure', label: '结构优化', labelEn: 'Structure', icon: 'GitBranch', order: 2, builtin: true },
  { id: 'analyze', label: '智能分析', labelEn: 'Analyze', icon: 'Brain', order: 3, builtin: true },
  { id: 'tag', label: '标签管理', labelEn: 'Tags', icon: 'Tag', order: 4, builtin: true },
  { id: 'format', label: '格式转换', labelEn: 'Format', icon: 'Type', order: 5, builtin: true },
  { id: 'task', label: '任务管理', labelEn: 'Tasks', icon: 'CheckSquare', order: 6, builtin: true },
  { id: 'summary', label: '内容总结', labelEn: 'Summary', icon: 'FileText', order: 7, builtin: true },
  { id: 'writing', label: '写作辅助', labelEn: 'Writing', icon: 'PenTool', order: 8, builtin: true },
  { id: 'import-export', label: '导入导出', labelEn: 'Import/Export', icon: 'Download', order: 9, builtin: true },
  { id: 'custom', label: '自定义', labelEn: 'Custom', icon: 'Settings', order: 10, builtin: true },
];

// ═══════════════════════════════════════════════════════════════════════════
// 默认操作项
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_ITEMS: OutlineQuickActionItem[] = [
  // ━━ 生成扩展 (generate) ━━
  { id: 'gen_expand', categoryId: 'generate', label: '扩展当前节点', labelEn: 'Expand Node', icon: 'Sparkles', order: 0, builtin: true, requiresActiveNode: true,
    keywords: ['扩展', 'ks', 'expand', '展开', 'zk'],
    prompt: '请扩展当前节点「{{activeNode}}」的内容，添加更多细节、子项或相关想法。保持与大纲整体风格一致。输出为 Markdown 列表格式。' },
  { id: 'gen_children', categoryId: 'generate', label: '生成子节点', labelEn: 'Generate Children', icon: 'List', order: 1, builtin: true, requiresActiveNode: true,
    keywords: ['子节点', 'zjd', 'children', '子项', 'zx'],
    prompt: '请为当前节点「{{activeNode}}」生成 3-5 个子节点。每个子节点应该是该主题的一个具体方面或步骤。输出为 Markdown 缩进列表格式。' },
  { id: 'gen_siblings', categoryId: 'generate', label: '生成同级节点', labelEn: 'Generate Siblings', icon: 'Plus', order: 2, builtin: true, requiresActiveNode: true,
    keywords: ['同级', 'tj', 'sibling', '兄弟', 'xd'],
    prompt: '请为当前节点「{{activeNode}}」生成 2-3 个同级节点，作为并列的主题。输出为 Markdown 列表格式。' },
  { id: 'gen_outline', categoryId: 'generate', label: '生成大纲模板', labelEn: 'Generate Outline', icon: 'FileText', order: 3, builtin: true, requiresActiveNode: false,
    keywords: ['大纲', 'dg', 'outline', '模板', 'mb'],
    prompt: '请根据主题「{{topic}}」生成一个完整的大纲模板。包含多个层级，使用 Markdown 列表格式，缩进表示层级关系。' },
  { id: 'gen_brainstorm', categoryId: 'generate', label: '头脑风暴', labelEn: 'Brainstorm', icon: 'Lightbulb', order: 4, builtin: true, requiresActiveNode: true,
    keywords: ['头脑风暴', 'tnfz', 'brainstorm', '创意', 'cy'],
    prompt: '请围绕当前节点「{{activeNode}}」进行头脑风暴，生成 5-8 个相关的想法或方向。不要局限于现有结构，尽可能发散思维。' },
  { id: 'gen_examples', categoryId: 'generate', label: '生成示例', labelEn: 'Generate Examples', icon: 'BookOpen', order: 5, builtin: true, requiresActiveNode: true,
    keywords: ['示例', 'sl', 'example', '例子', 'lz'],
    prompt: '请为当前节点「{{activeNode}}」生成 3-5 个具体的示例或案例。每个示例应该简明扼要，便于理解。' },

  // ━━ 内容润色 (polish) ━━
  { id: 'polish_text', categoryId: 'polish', label: '润色文本', labelEn: 'Polish Text', icon: 'Wand2', order: 0, builtin: true, requiresActiveNode: true,
    keywords: ['润色', 'rs', 'polish', '优化', 'yh'],
    prompt: '请润色当前节点「{{activeNode}}」的文本，使其更加流畅、专业。保持原意不变，提升表达质量。' },
  { id: 'polish_simplify', categoryId: 'polish', label: '简化表达', labelEn: 'Simplify', icon: 'Minus', order: 1, builtin: true, requiresActiveNode: true,
    keywords: ['简化', 'jh', 'simplify', '精简', 'jj'],
    prompt: '请简化当前节点「{{activeNode}}」的表达，去除冗余，保留核心信息。使文字更加简洁有力。' },
  { id: 'polish_expand', categoryId: 'polish', label: '扩展描述', labelEn: 'Expand Description', icon: 'Maximize2', order: 2, builtin: true, requiresActiveNode: true,
    keywords: ['扩展', 'ks', 'expand', '详述', 'xs'],
    prompt: '请扩展当前节点「{{activeNode}}」的描述，添加更多细节和背景信息，使内容更加丰富完整。' },
  { id: 'polish_formal', categoryId: 'polish', label: '正式化表达', labelEn: 'Make Formal', icon: 'Briefcase', order: 3, builtin: true, requiresActiveNode: true,
    keywords: ['正式', 'zs', 'formal', '专业', 'zy'],
    prompt: '请将当前节点「{{activeNode}}」改写为更加正式、专业的表达方式。适合商务或学术场景。' },
  { id: 'polish_casual', categoryId: 'polish', label: '口语化表达', labelEn: 'Make Casual', icon: 'MessageCircle', order: 4, builtin: true, requiresActiveNode: true,
    keywords: ['口语', 'ky', 'casual', '轻松', 'qs'],
    prompt: '请将当前节点「{{activeNode}}」改写为更加轻松、口语化的表达方式。适合博客或个人笔记。' },
  { id: 'polish_concise', categoryId: 'polish', label: '提炼要点', labelEn: 'Extract Key Points', icon: 'Target', order: 5, builtin: true, requiresActiveNode: true,
    keywords: ['要点', 'yd', 'keypoint', '提炼', 'tl'],
    prompt: '请从当前节点「{{activeNode}}」中提炼出 3-5 个关键要点，每个要点用一句话概括。' },

  // ━━ 结构优化 (structure) ━━
  { id: 'struct_reorg', categoryId: 'structure', label: '重组层级', labelEn: 'Reorganize', icon: 'GitBranch', order: 0, builtin: true, requiresActiveNode: false,
    keywords: ['重组', 'cz', 'reorganize', '重构', 'cg'],
    prompt: '请分析当前大纲的层级结构，建议如何重新组织使其更加合理。给出具体的调整方案和理由。' },
  { id: 'struct_extract', categoryId: 'structure', label: '提取摘要', labelEn: 'Extract Summary', icon: 'FileText', order: 1, builtin: true, requiresActiveNode: false,
    keywords: ['摘要', 'zy', 'summary', '概要', 'gy'],
    prompt: '请提取当前大纲的核心内容，生成一个 100-200 字的摘要。突出主要结构和关键信息。' },
  { id: 'struct_split', categoryId: 'structure', label: '拆分节点', labelEn: 'Split Node', icon: 'Scissors', order: 2, builtin: true, requiresActiveNode: true,
    keywords: ['拆分', 'cf', 'split', '分割', 'fg'],
    prompt: '请将当前节点「{{activeNode}}」拆分为多个更小的子节点。每个子节点应该聚焦一个具体方面。输出为 Markdown 列表。' },
  { id: 'struct_merge', categoryId: 'structure', label: '合并建议', labelEn: 'Merge Suggestions', icon: 'GitMerge', order: 3, builtin: true, requiresActiveNode: false,
    keywords: ['合并', 'hb', 'merge', '整合', 'zh'],
    prompt: '请分析当前大纲中可能需要合并的节点（内容相似或重复），给出合并建议和具体方案。' },
  { id: 'struct_balance', categoryId: 'structure', label: '平衡层级', labelEn: 'Balance Levels', icon: 'Scale', order: 4, builtin: true, requiresActiveNode: false,
    keywords: ['平衡', 'ph', 'balance', '均匀', 'jy'],
    prompt: '请分析当前大纲的层级深度和节点分布，建议如何使其更加平衡。指出过于深或过于浅的部分。' },
  { id: 'struct_order', categoryId: 'structure', label: '优化顺序', labelEn: 'Optimize Order', icon: 'ArrowUpDown', order: 5, builtin: true, requiresActiveNode: false,
    keywords: ['顺序', 'sx', 'order', '排序', 'px'],
    prompt: '请分析当前大纲的节点顺序，建议更合理的排列方式（如按时间、重要性、逻辑等）。' },

  // ━━ 智能分析 (analyze) ━━
  { id: 'ana_structure', categoryId: 'analyze', label: '结构分析', labelEn: 'Analyze Structure', icon: 'GitBranch', order: 0, builtin: true, requiresActiveNode: false,
    keywords: ['结构', 'jg', 'structure', '分析', 'fx'],
    prompt: '请分析当前大纲的结构特点：\n1. 层级深度是否合理\n2. 节点分布是否均衡\n3. 逻辑是否清晰\n4. 有哪些可以改进的地方' },
  { id: 'ana_logic', categoryId: 'analyze', label: '逻辑检查', labelEn: 'Check Logic', icon: 'CheckCircle', order: 1, builtin: true, requiresActiveNode: false,
    keywords: ['逻辑', 'lj', 'logic', '检查', 'jc'],
    prompt: '请检查当前大纲的逻辑关系：\n1. 是否有矛盾之处\n2. 是否有遗漏\n3. 层级关系是否恰当\n4. 给出修改建议' },
  { id: 'ana_complete', categoryId: 'analyze', label: '完整性评估', labelEn: 'Completeness Check', icon: 'ClipboardCheck', order: 2, builtin: true, requiresActiveNode: false,
    keywords: ['完整', 'wz', 'complete', '评估', 'pg'],
    prompt: '请评估当前大纲的完整性：\n1. 是否覆盖了主题的主要方面\n2. 哪些部分可能需要补充\n3. 给出完善建议' },
  { id: 'ana_gap', categoryId: 'analyze', label: '差距分析', labelEn: 'Gap Analysis', icon: 'AlertCircle', order: 3, builtin: true, requiresActiveNode: false,
    keywords: ['差距', 'cj', 'gap', '缺失', 'qs'],
    prompt: '请分析当前大纲可能存在的差距：\n1. 与同类主题的典型大纲相比缺少什么\n2. 哪些方面可能被忽略\n3. 如何填补这些差距' },
  { id: 'ana_quality', categoryId: 'analyze', label: '质量评估', labelEn: 'Quality Assessment', icon: 'Award', order: 4, builtin: true, requiresActiveNode: false,
    keywords: ['质量', 'zl', 'quality', '评分', 'pf'],
    prompt: '请对当前大纲进行综合质量评估（1-10分）：\n1. 结构性评分\n2. 完整性评分\n3. 逻辑性评分\n4. 实用性评分\n5. 总体评价和改进建议' },

  // ━━ 标签管理 (tag) ━━
  { id: 'tag_extract', categoryId: 'tag', label: '提取标签', labelEn: 'Extract Tags', icon: 'Tag', order: 0, builtin: true, requiresActiveNode: false,
    keywords: ['提取', 'tq', 'extract', '标签', 'bq'],
    prompt: '请从当前大纲中提取 5-10 个有意义的标签。这些标签应该能够概括大纲的主要内容。输出为 #标签 格式。' },
  { id: 'tag_suggest', categoryId: 'tag', label: '推荐标签', labelEn: 'Suggest Tags', icon: 'Tags', order: 1, builtin: true, requiresActiveNode: false,
    keywords: ['推荐', 'tj', 'suggest', '标签', 'bq'],
    prompt: '请根据大纲主题「{{title}}」推荐 5-8 个常用的分类标签。这些标签可以用于分类和检索。' },
  { id: 'tag_organize', categoryId: 'tag', label: '整理标签', labelEn: 'Organize Tags', icon: 'Folder', order: 2, builtin: true, requiresActiveNode: false,
    keywords: ['整理', 'zl', 'organize', '分类', 'fl'],
    prompt: '请整理当前大纲中已有的标签：\n1. 哪些标签可以合并\n2. 哪些标签应该拆分\n3. 建议的标签层级结构' },
  { id: 'tag_clean', categoryId: 'tag', label: '清理无用标签', labelEn: 'Clean Tags', icon: 'Trash2', order: 3, builtin: true, requiresActiveNode: false,
    keywords: ['清理', 'ql', 'clean', '删除', 'sc'],
    prompt: '请分析当前大纲中的标签，指出哪些可能是无用的或重复的，建议删除或合并。' },

  // ━━ 格式转换 (format) ━━
  { id: 'fmt_heading', categoryId: 'format', label: '转为标题', labelEn: 'Make Heading', icon: 'Heading', order: 0, builtin: true, requiresActiveNode: true,
    keywords: ['标题', 'bt', 'heading', 'H1', 'H2'],
    prompt: '请将当前节点「{{activeNode}}」转换为更合适的标题格式。建议使用 H1/H2/H3 等标题级别，并说明理由。' },
  { id: 'fmt_list', categoryId: 'format', label: '转为列表', labelEn: 'Make List', icon: 'List', order: 1, builtin: true, requiresActiveNode: true,
    keywords: ['列表', 'lb', 'list', '项目', 'xm'],
    prompt: '请将当前节点「{{activeNode}}」的内容拆分为列表格式。每个要点作为一个独立的列表项。' },
  { id: 'fmt_note', categoryId: 'format', label: '转为备注', labelEn: 'Make Note', icon: 'MessageSquare', order: 2, builtin: true, requiresActiveNode: true,
    keywords: ['备注', 'bz', 'note', '注释', 'zs'],
    prompt: '请将当前节点「{{activeNode}}」的内容转换为备注格式。精简节点正文，详细内容放入备注。' },
  { id: 'fmt_checklist', categoryId: 'format', label: '转为清单', labelEn: 'Make Checklist', icon: 'CheckSquare', order: 3, builtin: true, requiresActiveNode: true,
    keywords: ['清单', 'qd', 'checklist', '待办', 'db'],
    prompt: '请将当前节点「{{activeNode}}」转换为待办清单格式。每个子项成为一个可勾选的任务。' },

  // ━━ 任务管理 (task) ━━
  { id: 'task_complete', categoryId: 'task', label: '标记完成', labelEn: 'Mark Complete', icon: 'CheckCircle', order: 0, builtin: true, requiresActiveNode: true,
    keywords: ['完成', 'wc', 'complete', '标记', 'bj'],
    prompt: '当前节点「{{activeNode}}」已完成。请建议如何在节点内容中记录完成信息（如完成日期、备注等）。' },
  { id: 'task_deadline', categoryId: 'task', label: '添加截止日期', labelEn: 'Add Deadline', icon: 'Calendar', order: 1, builtin: true, requiresActiveNode: true,
    keywords: ['截止', 'jz', 'deadline', '日期', 'rq'],
    prompt: '请为当前节点「{{activeNode}}」建议一个合理的截止日期，并说明如何在节点中标记。' },
  { id: 'task_priority', categoryId: 'task', label: '设置优先级', labelEn: 'Set Priority', icon: 'Flag', order: 2, builtin: true, requiresActiveNode: true,
    keywords: ['优先级', 'yxj', 'priority', '重要', 'zy'],
    prompt: '请评估当前节点「{{activeNode}}」的优先级（高/中/低），并给出理由。建议如何在节点中标记优先级。' },
  { id: 'task_progress', categoryId: 'task', label: '进度追踪', labelEn: 'Track Progress', icon: 'Activity', order: 3, builtin: true, requiresActiveNode: false,
    keywords: ['进度', 'jd', 'progress', '追踪', 'zg'],
    prompt: '请分析当前大纲中的任务完成进度：\n1. 已完成节点数\n2. 进行中节点数\n3. 待完成节点数\n4. 整体完成率\n5. 预计剩余工作量' },
  { id: 'task_next', categoryId: 'task', label: '下一步行动', labelEn: 'Next Actions', icon: 'ArrowRight', order: 4, builtin: true, requiresActiveNode: false,
    keywords: ['下一步', 'xyb', 'next', '行动', 'xd'],
    prompt: '请分析当前大纲，找出接下来应该优先处理的 3-5 个节点。给出优先顺序和理由。' },

  // ━━ 内容总结 (summary) ━━
  { id: 'sum_subtree', categoryId: 'summary', label: '总结子树', labelEn: 'Summarize Subtree', icon: 'FileText', order: 0, builtin: true, requiresActiveNode: true,
    keywords: ['子树', 'zs', 'subtree', '总结', 'zj'],
    prompt: '请总结当前节点「{{activeNode}}」及其所有子节点的内容。生成一个 50-100 字的总结，突出核心要点。' },
  { id: 'sum_all', categoryId: 'summary', label: '总结全部', labelEn: 'Summarize All', icon: 'Book', order: 1, builtin: true, requiresActiveNode: false,
    keywords: ['全部', 'qb', 'all', '总结', 'zj'],
    prompt: '请总结整个大纲的核心内容。生成一个 100-200 字的总结，包括：\n1. 主题概述\n2. 主要要点\n3. 结论或建议' },
  { id: 'sum_toc', categoryId: 'summary', label: '生成目录', labelEn: 'Generate TOC', icon: 'List', order: 2, builtin: true, requiresActiveNode: false,
    keywords: ['目录', 'ml', 'toc', '索引', 'sy'],
    prompt: '请为当前大纲生成一个目录结构。列出所有主要章节和子章节，使用缩进表示层级。' },
  { id: 'sum_abstract', categoryId: 'summary', label: '生成摘要', labelEn: 'Generate Abstract', icon: 'FileText', order: 3, builtin: true, requiresActiveNode: false,
    keywords: ['摘要', 'zy', 'abstract', '简介', 'jj'],
    prompt: '请为当前大纲生成一个正式的摘要，适合用于报告或文档开头。包括背景、内容概要、结论。' },
  { id: 'sum_keypoints', categoryId: 'summary', label: '提取关键点', labelEn: 'Extract Key Points', icon: 'Key', order: 4, builtin: true, requiresActiveNode: false,
    keywords: ['关键点', 'gjd', 'keypoint', '要点', 'yd'],
    prompt: '请从当前大纲中提取 5-10 个最重要的关键点。每个关键点用一句话概括，并注明来源节点。' },

  // ━━ 写作辅助 (writing) ━━
  { id: 'write_continue', categoryId: 'writing', label: '续写内容', labelEn: 'Continue Writing', icon: 'PenTool', order: 0, builtin: true, requiresActiveNode: true,
    keywords: ['续写', 'xx', 'continue', '延伸', 'ys'],
    prompt: '请基于当前节点「{{activeNode}}」续写内容。保持风格一致，添加更多相关的想法或细节。' },
  { id: 'write_rewrite', categoryId: 'writing', label: '改写风格', labelEn: 'Rewrite Style', icon: 'RefreshCw', order: 1, builtin: true, requiresActiveNode: true,
    keywords: ['改写', 'gx', 'rewrite', '风格', 'fg'],
    prompt: '请将当前节点「{{activeNode}}」改写为不同的风格。提供 2-3 种风格选项（如学术、商务、轻松），每种给出示例。' },
  { id: 'write_translate', categoryId: 'writing', label: '翻译节点', labelEn: 'Translate Node', icon: 'Languages', order: 2, builtin: true, requiresActiveNode: true,
    keywords: ['翻译', 'fy', 'translate', '英文', 'yw'],
    prompt: '请将当前节点「{{activeNode}}」翻译为英文（如果原文是英文则翻译为中文）。保持专业性和准确性。' },
  { id: 'write_outline_to_text', categoryId: 'writing', label: '大纲转正文', labelEn: 'Outline to Text', icon: 'FileText', order: 3, builtin: true, requiresActiveNode: true,
    keywords: ['正文', 'zw', 'text', '文章', 'wz'],
    prompt: '请将当前节点「{{activeNode}}」及其子节点转换为连贯的正文段落。保持逻辑流畅，适当添加过渡语。' },
  { id: 'write_ideas', categoryId: 'writing', label: '创意启发', labelEn: 'Creative Ideas', icon: 'Lightbulb', order: 4, builtin: true, requiresActiveNode: true,
    keywords: ['创意', 'cy', 'creative', '灵感', 'lg'],
    prompt: '请围绕当前节点「{{activeNode}}」提供一些创意启发。思考不同的角度、方法或可能性，帮助拓展思路。' },

  // ━━ 导入导出 (import-export) ━━
  { id: 'exp_markdown', categoryId: 'import-export', label: '导出Markdown', labelEn: 'Export Markdown', icon: 'FileText', order: 0, builtin: true, requiresActiveNode: false,
    keywords: ['导出', 'dc', 'export', 'markdown', 'md'],
    prompt: '请将当前大纲转换为标准的 Markdown 格式。使用标题（#）表示层级，使用列表表示同级节点。输出完整的 Markdown 文本。' },
  { id: 'exp_opml', categoryId: 'import-export', label: '导出OPML', labelEn: 'Export OPML', icon: 'Code', order: 1, builtin: true, requiresActiveNode: false,
    keywords: ['opml', '导出', 'dc', 'export'],
    prompt: '请将当前大纲转换为 OPML 格式（大纲交换格式）。输出标准的 OPML XML 代码。' },
  { id: 'exp_json', categoryId: 'import-export', label: '导出JSON', labelEn: 'Export JSON', icon: 'Braces', order: 2, builtin: true, requiresActiveNode: false,
    keywords: ['json', '导出', 'dc', 'export'],
    prompt: '请将当前大纲转换为 JSON 格式。包含节点 ID、内容、层级关系等完整信息。' },
  { id: 'imp_markdown', categoryId: 'import-export', label: '导入Markdown', labelEn: 'Import Markdown', icon: 'Upload', order: 3, builtin: true, requiresActiveNode: false,
    keywords: ['导入', 'dr', 'import', 'markdown', 'md'],
    prompt: '请告诉我如何将 Markdown 文本导入为大纲。说明支持的格式要求（如标题层级、列表缩进等）。' },
  { id: 'imp_text', categoryId: 'import-export', label: '导入纯文本', labelEn: 'Import Text', icon: 'Upload', order: 4, builtin: true, requiresActiveNode: false,
    keywords: ['导入', 'dr', 'import', '文本', 'wb'],
    prompt: '请将以下纯文本转换为大纲格式。自动识别段落和缩进，生成合理的层级结构：\n{{textInput}}' },

  // ━━ 自定义 (custom) ━━
  { id: 'custom_prompt', categoryId: 'custom', label: '自定义提示', labelEn: 'Custom Prompt', icon: 'Settings', order: 0, builtin: true, requiresActiveNode: false,
    keywords: ['自定义', 'zdy', 'custom', '提示', 'ts'],
    prompt: '这是一个自定义操作。请在聊天中描述你想要对大纲进行的操作，我会尽力帮助你。' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 持久化函数
// ═══════════════════════════════════════════════════════════════════════════

export function getDefaultStore(): OutlineQuickActionStore {
  return {
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
    version: CURRENT_VERSION,
    favorites: [],
    recentUsed: [],
  };
}

function mergeWithDefaults(stored: OutlineQuickActionStore): OutlineQuickActionStore {
  const cats = [...(stored.categories || [])];
  for (const dc of DEFAULT_CATEGORIES) {
    if (!cats.find(c => c.id === dc.id)) cats.push({ ...dc });
  }
  const items = [...(stored.items || [])];
  for (const di of DEFAULT_ITEMS) {
    if (!items.find(i => i.id === di.id)) items.push({ ...di });
  }
  return { ...stored, categories: cats, items, version: CURRENT_VERSION };
}

export function loadQuickActions(storage: {
  get: <T>(key: string) => T | null;
  set: (key: string, value: unknown) => void;
}): OutlineQuickActionStore {
  const saved = storage.get<OutlineQuickActionStore>(STORAGE_KEY);
  if (saved && saved.categories && saved.items) {
    return mergeWithDefaults(saved);
  }
  const store = getDefaultStore();
  storage.set(STORAGE_KEY, store);
  return store;
}

export function saveQuickActions(
  storage: { set: (key: string, value: unknown) => void },
  store: OutlineQuickActionStore
): void {
  storage.set(STORAGE_KEY, store);
}

export function recordRecentUsed(
  store: OutlineQuickActionStore,
  itemId: string
): OutlineQuickActionStore {
  const recent = (store.recentUsed || []).filter(id => id !== itemId);
  recent.unshift(itemId);
  return { ...store, recentUsed: recent.slice(0, 20) };
}

export function toggleFavorite(
  store: OutlineQuickActionStore,
  itemId: string
): OutlineQuickActionStore {
  const favorites = store.favorites || [];
  if (favorites.includes(itemId)) {
    return { ...store, favorites: favorites.filter(id => id !== itemId) };
  }
  return { ...store, favorites: [...favorites, itemId] };
}

// ═══════════════════════════════════════════════════════════════════════════
// 查询函数
// ═══════════════════════════════════════════════════════════════════════════

export function getItemsByCategory(
  store: OutlineQuickActionStore,
  categoryId: string
): OutlineQuickActionItem[] {
  return store.items
    .filter(item => item.categoryId === categoryId && !item.hidden)
    .sort((a, b) => a.order - b.order);
}

export function searchItems(
  store: OutlineQuickActionStore,
  query: string
): OutlineQuickActionItem[] {
  const lowerQuery = query.toLowerCase();
  return store.items.filter(item => {
    if (item.hidden) return false;
    const labelMatch = item.label.toLowerCase().includes(lowerQuery) ||
      item.labelEn.toLowerCase().includes(lowerQuery);
    const keywordMatch = (item.keywords || []).some(k => k.toLowerCase().includes(lowerQuery));
    return labelMatch || keywordMatch;
  });
}

export function getFavoriteItems(store: OutlineQuickActionStore): OutlineQuickActionItem[] {
  const favorites = store.favorites || [];
  return favorites
    .map(id => store.items.find(item => item.id === id))
    .filter((item): item is OutlineQuickActionItem => !!item && !item.hidden);
}

export function getRecentItems(store: OutlineQuickActionStore): OutlineQuickActionItem[] {
  const recent = store.recentUsed || [];
  return recent
    .map(id => store.items.find(item => item.id === id))
    .filter((item): item is OutlineQuickActionItem => !!item && !item.hidden);
}
