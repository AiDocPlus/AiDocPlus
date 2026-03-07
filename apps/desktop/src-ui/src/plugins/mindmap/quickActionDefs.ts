/**
 * 思维导图 AI 快捷操作定义
 *
 * 按 7 个分类组织，~50 个操作项，全面覆盖思维导图使用场景。
 * 用户可完全自定义。与邮件/表格/Mermaid 插件架构一致。
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
  contextMode?: 'structure' | 'content' | 'full' | 'none';
  order: number;
  builtin?: boolean;
  hidden?: boolean;
  executionMode?: ExecutionMode;
  directAction?: string;
  keywords?: string[];
}

export interface QuickActionStore {
  categories: QuickActionCategory[];
  items: QuickActionItem[];
  version: number;
  favorites?: string[];
  recentUsed?: string[];
}

const STORAGE_KEY = '_mindmap_quick_actions';
const CURRENT_VERSION = 2;

// ── 默认内置分类（7 类） ──

const DEFAULT_CATEGORIES: QuickActionCategory[] = [
  { id: 'create',   label: '创建',   icon: 'FilePlus2',      order: 0, builtin: true },
  { id: 'expand',   label: '扩展',   icon: 'GitBranch',      order: 1, builtin: true },
  { id: 'simplify', label: '精简',   icon: 'Minimize2',      order: 2, builtin: true },
  { id: 'reorg',    label: '重组',   icon: 'Shuffle',        order: 3, builtin: true },
  { id: 'style',    label: '风格',   icon: 'Paintbrush',     order: 4, builtin: true },
  { id: 'analyze',  label: '分析',   icon: 'BarChart3',      order: 5, builtin: true },
  { id: 'export',   label: '导出',   icon: 'FileOutput',     order: 6, builtin: true },
  { id: 'node',     label: '节点操作', icon: 'GitBranch',      order: 7, builtin: true },
  { id: 'translate',label: '翻译',   icon: 'Languages',      order: 8, builtin: true },
  { id: 'review',   label: '审查',   icon: 'ClipboardCheck', order: 9, builtin: true },
];

// ── 默认内置操作项 ──

const DEFAULT_ITEMS: QuickActionItem[] = [

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 创建 (create)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'create_from_doc',     categoryId: 'create', label: '从文档生成', icon: 'FileText', order: 0, builtin: true, contextMode: 'none',
    keywords: ['文档', 'wd', 'doc'],
    prompt: '根据文档正文内容，生成一个结构清晰的思维导图。使用 Markdown 标题语法（# 根节点，## 一级分支，### 二级分支）。提炼关键信息，每个节点简洁精练。只输出 Markdown 内容。' },
  { id: 'create_from_outline', categoryId: 'create', label: '从大纲生成', icon: 'List', order: 1, builtin: true, contextMode: 'none',
    keywords: ['大纲', 'dg', 'outline'],
    prompt: '将文档的标题大纲结构转化为思维导图格式。保留所有层级关系。使用 Markdown 标题语法。只输出 Markdown 内容。' },
  { id: 'create_brainstorm',   categoryId: 'create', label: '头脑风暴', icon: 'Lightbulb', order: 2, builtin: true, contextMode: 'none',
    keywords: ['风暴', 'fs', 'brainstorm'],
    prompt: '基于文档主题进行头脑风暴，生成一个发散性思维导图。围绕核心主题，从多个角度展开联想和探索。使用 Markdown 标题语法。只输出 Markdown 内容。' },
  { id: 'create_summary',      categoryId: 'create', label: '摘要导图', icon: 'FileSearch', order: 3, builtin: true, contextMode: 'none',
    keywords: ['摘要', 'zy', 'summary'],
    prompt: '提取文档的核心要点，生成一个精炼的摘要思维导图。每个分支代表一个关键主题，子节点列出要点。使用 Markdown 标题语法。只输出 Markdown 内容。' },
  { id: 'create_comparison',   categoryId: 'create', label: '对比分析', icon: 'GitCompare', order: 4, builtin: true, contextMode: 'none',
    keywords: ['对比', 'db', 'compare'],
    prompt: '从文档中识别可对比的概念或方案，生成对比分析思维导图。每个分支代表一个对比维度。使用 Markdown 标题语法。只输出 Markdown 内容。' },
  { id: 'create_timeline',     categoryId: 'create', label: '时间线导图', icon: 'Clock', order: 5, builtin: true, contextMode: 'none',
    keywords: ['时间', 'sj', 'timeline'],
    prompt: '将文档中的事件按时间顺序组织成思维导图。根节点为主题，一级分支为时间阶段，二级分支为具体事件。使用 Markdown 标题语法。只输出 Markdown 内容。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 扩展 (expand)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'expand_all',          categoryId: 'expand', label: '全面扩展', icon: 'Maximize2', order: 0, builtin: true, contextMode: 'content',
    keywords: ['扩展', 'kz', 'expand'],
    prompt: '基于文档内容，全面扩展当前思维导图的每个分支。为每个现有节点添加 2-3 个子节点。使用 Markdown 标题语法。只输出完整的 Markdown 内容。' },
  { id: 'expand_detail',       categoryId: 'expand', label: '补充细节', icon: 'Plus', order: 1, builtin: true, contextMode: 'content',
    keywords: ['细节', 'xj', 'detail'],
    prompt: '为当前思维导图的叶子节点补充具体细节和解释。保持现有结构不变，只在末端添加内容。使用 Markdown 标题语法。只输出完整的 Markdown 内容。' },
  { id: 'expand_examples',     categoryId: 'expand', label: '添加示例', icon: 'BookOpen', order: 2, builtin: true, contextMode: 'content',
    keywords: ['示例', 'sl', 'example'],
    prompt: '为当前思维导图的关键节点添加具体示例或案例。使用 Markdown 标题语法。只输出完整的 Markdown 内容。' },
  { id: 'expand_questions',    categoryId: 'expand', label: '引发问题', icon: 'HelpCircle', order: 3, builtin: true, contextMode: 'content',
    keywords: ['问题', 'wt', 'question'],
    prompt: '为当前思维导图的每个主要分支生成相关的思考问题。使用 Markdown 标题语法。只输出完整的 Markdown 内容。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 精简 (simplify)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'simplify_merge',      categoryId: 'simplify', label: '合并相似', icon: 'Merge', order: 0, builtin: true, contextMode: 'content',
    keywords: ['合并', 'hb', 'merge'],
    prompt: '分析当前思维导图，合并含义相似或重复的节点。保留核心信息，减少冗余。使用 Markdown 标题语法。只输出精简后的完整 Markdown 内容。' },
  { id: 'simplify_depth',      categoryId: 'simplify', label: '限制层级', icon: 'Layers', order: 1, builtin: true, contextMode: 'content',
    keywords: ['层级', 'cj', 'depth'],
    prompt: '将当前思维导图精简到最多 3 层深度。将深层内容合并到上层节点。使用 Markdown 标题语法。只输出精简后的完整 Markdown 内容。' },
  { id: 'simplify_keywords',   categoryId: 'simplify', label: '提炼关键词', icon: 'Key', order: 2, builtin: true, contextMode: 'content',
    keywords: ['关键词', 'gjc', 'keyword'],
    prompt: '将当前思维导图的每个节点文字精简为 2-5 个字的关键词。保持结构不变。使用 Markdown 标题语法。只输出精简后的完整 Markdown 内容。' },
  { id: 'simplify_top5',       categoryId: 'simplify', label: '保留Top5', icon: 'Award', order: 3, builtin: true, contextMode: 'content',
    keywords: ['top5', '精选'],
    prompt: '从当前思维导图中选出最重要的 5 个分支，删除其余分支。使用 Markdown 标题语法。只输出精简后的完整 Markdown 内容。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 重组 (reorg)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'reorg_logic',         categoryId: 'reorg', label: '按逻辑分类', icon: 'FolderTree', order: 0, builtin: true, contextMode: 'content',
    keywords: ['逻辑', 'lj', 'logic'],
    prompt: '重新组织当前思维导图，按逻辑关系（因果、并列、递进）重新分类节点。使用 Markdown 标题语法。只输出重组后的完整 Markdown 内容。' },
  { id: 'reorg_priority',      categoryId: 'reorg', label: '按重要性排序', icon: 'ArrowUpDown', order: 1, builtin: true, contextMode: 'content',
    keywords: ['排序', 'px', 'priority'],
    prompt: '将当前思维导图的一级分支按重要性从高到低重新排序。使用 Markdown 标题语法。只输出重组后的完整 Markdown 内容。' },
  { id: 'reorg_category',      categoryId: 'reorg', label: '按类别重组', icon: 'LayoutGrid', order: 2, builtin: true, contextMode: 'content',
    keywords: ['类别', 'lb', 'category'],
    prompt: '将当前思维导图的节点按内容类别重新分组。识别共同主题，创建新的分类结构。使用 Markdown 标题语法。只输出重组后的完整 Markdown 内容。' },
  { id: 'reorg_flatten',       categoryId: 'reorg', label: '扁平化', icon: 'AlignJustify', order: 3, builtin: true, contextMode: 'content',
    keywords: ['扁平', 'bp', 'flatten'],
    prompt: '将当前思维导图的深层嵌套结构扁平化，减少到 2 层。使用 Markdown 标题语法。只输出重组后的完整 Markdown 内容。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 风格 (style)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'style_academic',      categoryId: 'style', label: '学术风格', icon: 'GraduationCap', order: 0, builtin: true, contextMode: 'content',
    keywords: ['学术', 'xs', 'academic'],
    prompt: '将当前思维导图改写为学术风格：使用专业术语，结构严谨，层次分明。使用 Markdown 标题语法。只输出改写后的完整 Markdown 内容。' },
  { id: 'style_business',      categoryId: 'style', label: '商务风格', icon: 'Briefcase', order: 1, builtin: true, contextMode: 'content',
    keywords: ['商务', 'sw', 'business'],
    prompt: '将当前思维导图改写为商务风格：简洁有力，突出要点和行动项。使用 Markdown 标题语法。只输出改写后的完整 Markdown 内容。' },
  { id: 'style_creative',      categoryId: 'style', label: '创意风格', icon: 'Palette', order: 2, builtin: true, contextMode: 'content',
    keywords: ['创意', 'cy', 'creative'],
    prompt: '将当前思维导图改写为创意风格：使用生动比喻、emoji图标、有趣的表达。使用 Markdown 标题语法。只输出改写后的完整 Markdown 内容。' },
  { id: 'style_simple',        categoryId: 'style', label: '简洁风格', icon: 'Minus', order: 3, builtin: true, contextMode: 'content',
    keywords: ['简洁', 'jj', 'simple'],
    prompt: '将当前思维导图改写为极简风格：每个节点最多 4 个字，只保留核心概念。使用 Markdown 标题语法。只输出改写后的完整 Markdown 内容。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 分析 (analyze)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'analyze_explain',     categoryId: 'analyze', label: '解释结构', icon: 'HelpCircle', order: 0, builtin: true, contextMode: 'content',
    keywords: ['解释', 'js', 'explain'],
    prompt: '请详细解释当前思维导图的结构，包括各分支的主题、层级关系、整体逻辑。用中文回答。' },
  { id: 'analyze_gaps',        categoryId: 'analyze', label: '找出遗漏', icon: 'Search', order: 1, builtin: true, contextMode: 'full',
    keywords: ['遗漏', 'yl', 'gap'],
    prompt: '对比文档内容和当前思维导图，找出思维导图中遗漏的重要信息。列出具体的遗漏点和建议。用中文回答。' },
  { id: 'analyze_coverage',    categoryId: 'analyze', label: '评估覆盖度', icon: 'BarChart3', order: 2, builtin: true, contextMode: 'full',
    keywords: ['覆盖', 'fg', 'coverage'],
    prompt: '评估当前思维导图对文档内容的覆盖程度。给出百分比估算和各主题的覆盖情况。用中文回答。' },
  { id: 'analyze_improve',     categoryId: 'analyze', label: '改进建议', icon: 'Lightbulb', order: 3, builtin: true, contextMode: 'full',
    keywords: ['建议', 'jy', 'improve'],
    prompt: '分析当前思维导图的优缺点，给出具体的改进建议，包括结构优化、内容补充、表达改进等方面。用中文回答。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 导出 (export)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'export_svg',          categoryId: 'export', label: '导出 SVG', icon: 'FileImage', order: 0, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_svg',
    keywords: ['SVG', '导出'],
    prompt: '' },
  { id: 'export_png',          categoryId: 'export', label: '导出 PNG', icon: 'Image', order: 1, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_png',
    keywords: ['PNG', '导出'],
    prompt: '' },
  { id: 'export_markdown',     categoryId: 'export', label: '导出 Markdown', icon: 'FileCode', order: 2, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_markdown',
    keywords: ['Markdown', 'MD', '导出'],
    prompt: '' },
  { id: 'export_html',         categoryId: 'export', label: '导出 HTML', icon: 'Globe', order: 3, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_html',
    keywords: ['HTML', '导出'],
    prompt: '' },
  { id: 'export_json',         categoryId: 'export', label: '导出 JSON', icon: 'FileJson', order: 4, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'export_json',
    keywords: ['JSON', '导出'],
    prompt: '' },
  { id: 'export_outline',      categoryId: 'export', label: '生成大纲文本', icon: 'FileText', order: 5, builtin: true, contextMode: 'content',
    keywords: ['大纲', '文本', 'outline'],
    prompt: '将当前思维导图转换为有序列表格式的大纲文本，使用缩进表示层级关系。只输出大纲文本，不要解释。' },
  { id: 'export_speech',       categoryId: 'export', label: '生成演讲稿', icon: 'Mic', order: 6, builtin: true, contextMode: 'content',
    keywords: ['演讲', '稿', 'speech'],
    prompt: '基于当前思维导图的结构和内容，生成一篇完整的演讲稿。按照思维导图的分支顺序组织段落，语言流畅自然。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 节点操作 (node) — direct 模式
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'node_expand',         categoryId: 'node', label: 'AI 展开子节点', icon: 'GitBranch', order: 0, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'node_expand',
    keywords: ['展开', '子节点', 'expand'],
    prompt: '' },
  { id: 'node_summarize',      categoryId: 'node', label: 'AI 精简分支', icon: 'Minimize2', order: 1, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'node_summarize',
    keywords: ['精简', '分支', 'summarize'],
    prompt: '' },
  { id: 'node_rephrase',       categoryId: 'node', label: 'AI 改写节点', icon: 'Pencil', order: 2, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'node_rephrase',
    keywords: ['改写', '重写', 'rephrase'],
    prompt: '' },
  { id: 'node_siblings',       categoryId: 'node', label: 'AI 建议同级', icon: 'ListPlus', order: 3, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'node_siblings',
    keywords: ['同级', '建议', 'siblings'],
    prompt: '' },
  { id: 'node_translate',      categoryId: 'node', label: 'AI 翻译分支', icon: 'Languages', order: 4, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'node_translate',
    keywords: ['翻译', '分支', 'translate'],
    prompt: '' },
  { id: 'node_continue',       categoryId: 'node', label: 'AI 续写补全', icon: 'PenLine', order: 5, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'node_continue',
    keywords: ['续写', '补全', 'continue'],
    prompt: '' },
  { id: 'node_beautify',       categoryId: 'node', label: 'AI 优化整理', icon: 'Sparkles', order: 6, builtin: true, contextMode: 'none',
    executionMode: 'direct', directAction: 'node_beautify',
    keywords: ['优化', '整理', 'beautify'],
    prompt: '' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 翻译 (translate)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'translate_zh2en',     categoryId: 'translate', label: '整图中译英', icon: 'Languages', order: 0, builtin: true, contextMode: 'content',
    keywords: ['中译英', '英文', 'zh2en'],
    prompt: '将当前思维导图的所有节点翻译为英文，保持 Markdown 标题层级结构不变。只输出翻译后的完整 Markdown 内容。' },
  { id: 'translate_en2zh',     categoryId: 'translate', label: '整图英译中', icon: 'Languages', order: 1, builtin: true, contextMode: 'content',
    keywords: ['英译中', '中文', 'en2zh'],
    prompt: '将当前思维导图的所有节点翻译为中文，保持 Markdown 标题层级结构不变。只输出翻译后的完整 Markdown 内容。' },
  { id: 'translate_ja2zh',     categoryId: 'translate', label: '整图日译中', icon: 'Languages', order: 2, builtin: true, contextMode: 'content',
    keywords: ['日译中', '日文', 'ja2zh'],
    prompt: '将当前思维导图的所有节点从日文翻译为中文，保持 Markdown 标题层级结构不变。只输出翻译后的完整 Markdown 内容。' },
  { id: 'translate_bilingual',  categoryId: 'translate', label: '中英双语', icon: 'Languages', order: 3, builtin: true, contextMode: 'content',
    keywords: ['双语', '对照', 'bilingual'],
    prompt: '将当前思维导图的所有节点改为中英双语格式（中文/English），保持 Markdown 标题层级结构不变。只输出修改后的完整 Markdown 内容。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 审查 (review)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'review_structure',    categoryId: 'review', label: '审查结构', icon: 'ClipboardCheck', order: 0, builtin: true, contextMode: 'content',
    keywords: ['审查', '结构', 'structure'],
    prompt: '审查当前思维导图的结构是否合理：层级是否均衡、分支是否对称、分类是否逻辑清晰。给出具体的改进建议。用中文回答。' },
  { id: 'review_completeness', categoryId: 'review', label: '审查完整性', icon: 'CheckSquare', order: 1, builtin: true, contextMode: 'full',
    keywords: ['完整', '遗漏', 'completeness'],
    prompt: '对比文档内容和当前思维导图，审查内容是否完整，有无重要信息遗漏。列出具体的遗漏点。用中文回答。' },
  { id: 'review_logic',        categoryId: 'review', label: '审查逻辑', icon: 'ShieldCheck', order: 2, builtin: true, contextMode: 'content',
    keywords: ['逻辑', '一致', 'logic'],
    prompt: '审查当前思维导图的逻辑一致性：各分支之间是否有矛盾、分类是否互斥、层级关系是否正确。给出具体问题和建议。用中文回答。' },
  { id: 'review_style',        categoryId: 'review', label: '审查风格', icon: 'Type', order: 3, builtin: true, contextMode: 'content',
    keywords: ['风格', '文字', 'style'],
    prompt: '审查当前思维导图的文字风格：节点文字长度是否统一、表述是否简洁、用词是否专业。给出具体的修改建议。用中文回答。' },
  { id: 'review_continue',     categoryId: 'review', label: '继续完善', icon: 'RefreshCw', order: 4, builtin: true, contextMode: 'content',
    keywords: ['完善', '继续', 'continue'],
    prompt: '请继续完善当前思维导图，补充遗漏的要点，使内容更加全面。使用 Markdown 标题语法。只输出完整的 Markdown 内容。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 创建 (create) — 补充
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'create_swot',         categoryId: 'create', label: 'SWOT 分析', icon: 'Target', order: 6, builtin: true, contextMode: 'none',
    keywords: ['SWOT', '分析'],
    prompt: '对文档内容进行 SWOT 分析（优势、劣势、机会、威胁），生成思维导图。根节点为主题，四个一级分支分别为 S/W/O/T。使用 Markdown 标题语法。只输出 Markdown 内容。' },
  { id: 'create_5w2h',         categoryId: 'create', label: '5W2H 分析', icon: 'HelpCircle', order: 7, builtin: true, contextMode: 'none',
    keywords: ['5W2H', '分析'],
    prompt: '对文档内容进行 5W2H 分析（What/Why/Who/When/Where/How/How much），生成思维导图。使用 Markdown 标题语法。只输出 Markdown 内容。' },
  { id: 'create_fishbone',     categoryId: 'create', label: '鱼骨图分析', icon: 'GitFork', order: 8, builtin: true, contextMode: 'none',
    keywords: ['鱼骨', '因果', 'fishbone'],
    prompt: '对文档内容进行鱼骨图（因果分析），识别主要问题和各类原因（人、机、料、法、环、测），生成思维导图。使用 Markdown 标题语法。只输出 Markdown 内容。' },
  { id: 'create_pest',         categoryId: 'create', label: 'PEST 分析', icon: 'Globe', order: 9, builtin: true, contextMode: 'none',
    keywords: ['PEST', '宏观'],
    prompt: '对文档内容进行 PEST 分析（政治、经济、社会、技术），生成思维导图。使用 Markdown 标题语法。只输出 Markdown 内容。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 扩展 (expand) — 补充
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'expand_data',         categoryId: 'expand', label: '添加数据支撑', icon: 'BarChart', order: 4, builtin: true, contextMode: 'content',
    keywords: ['数据', '支撑', 'data'],
    prompt: '为当前思维导图的关键论点添加数据支撑和事实依据。使用 Markdown 标题语法。只输出完整的 Markdown 内容。' },
  { id: 'expand_counter',      categoryId: 'expand', label: '添加反面观点', icon: 'Scale', order: 5, builtin: true, contextMode: 'content',
    keywords: ['反面', '对立', 'counter'],
    prompt: '为当前思维导图的主要观点添加反面论点或替代方案，形成辩证思维。使用 Markdown 标题语法。只输出完整的 Markdown 内容。' },
];

// ── 持久化 ──

interface StorageLike {
  get<T>(key: string): T | null | undefined;
  set(key: string, value: unknown): void;
}

export function getDefaultStore(): QuickActionStore {
  return {
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
    version: CURRENT_VERSION,
    favorites: [],
    recentUsed: [],
  };
}

function mergeWithDefaults(stored: QuickActionStore): QuickActionStore {
  const cats = [...stored.categories];
  for (const dc of DEFAULT_CATEGORIES) {
    if (!cats.find(c => c.id === dc.id)) cats.push({ ...dc });
  }
  const items = [...stored.items];
  for (const di of DEFAULT_ITEMS) {
    if (!items.find(i => i.id === di.id)) items.push({ ...di });
  }
  return { ...stored, categories: cats, items, version: CURRENT_VERSION };
}

export function loadQuickActions(storage: StorageLike): QuickActionStore {
  const saved = storage.get<QuickActionStore>(STORAGE_KEY);
  if (saved && saved.categories && saved.items) {
    return mergeWithDefaults(saved);
  }
  const store = getDefaultStore();
  storage.set(STORAGE_KEY, store);
  return store;
}

export function saveQuickActions(storage: StorageLike, store: QuickActionStore): void {
  storage.set(STORAGE_KEY, store);
}

export function resetQuickActions(storage: StorageLike): QuickActionStore {
  const defaults = getDefaultStore();
  saveQuickActions(storage, defaults);
  return defaults;
}

export function genActionId(): string {
  return `mqa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function getBuiltinPrompt(itemId: string): string | undefined {
  return DEFAULT_ITEMS.find(i => i.id === itemId)?.prompt;
}

export function getBuiltinCategoryLabel(catId: string): string | undefined {
  return DEFAULT_CATEGORIES.find(c => c.id === catId)?.label;
}

export function getDefaultCategories(): QuickActionCategory[] {
  return DEFAULT_CATEGORIES;
}

export function getDefaultItems(): QuickActionItem[] {
  return DEFAULT_ITEMS;
}

export function exportConfig(data: QuickActionStore): string {
  return JSON.stringify(data, null, 2);
}

export function importConfig(json: string): QuickActionStore | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.items)) {
      return parsed as QuickActionStore;
    }
    return null;
  } catch { return null; }
}

export function recordRecentUsed(store: QuickActionStore, itemId: string): QuickActionStore {
  const recent = (store.recentUsed || []).filter(id => id !== itemId);
  recent.unshift(itemId);
  return { ...store, recentUsed: recent.slice(0, 20) };
}
