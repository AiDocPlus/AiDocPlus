/**
 * 表格 AI 快捷操作定义
 *
 * 按 12 个分类组织，~120 个操作项，全面覆盖电子表格日常使用场景。
 * 用户可完全自定义。与邮件插件架构一致：categories + items + storage。
 */

// ── 类型定义 ──

export interface QuickActionCategory {
  id: string;
  label: string;
  icon: string;
  order: number;
  builtin?: boolean;
}

/** 执行模式：direct=不经过AI直接执行, ai=发给AI聊天, hybrid=AI分析后生成可执行动作 */
export type ExecutionMode = 'direct' | 'ai' | 'hybrid';

export interface QuickActionItem {
  id: string;
  categoryId: string;
  label: string;
  icon: string;
  prompt: string;
  contextMode?: 'data' | 'stats' | 'structure' | 'none';
  order: number;
  builtin?: boolean;
  hidden?: boolean;
  /** 执行模式（默认 'ai'） */
  executionMode?: ExecutionMode;
  /** direct 模式时的动作标识符 */
  directAction?: string;
  /** 搜索关键词（含拼音首字母等） */
  keywords?: string[];
  /** 是否为破坏性操作（需二次确认） */
  dangerous?: boolean;
}

export interface QuickActionStore {
  categories: QuickActionCategory[];
  items: QuickActionItem[];
  version: number;
  /** 收藏的操作项 ID 列表 */
  favorites?: string[];
  /** 最近使用的操作项 ID 列表（最多 20 个） */
  recentUsed?: string[];
}

const STORAGE_KEY = '_table_quick_actions';
const CURRENT_VERSION = 3;

// ── 默认内置分类（12 类） ──

const DEFAULT_CATEGORIES: QuickActionCategory[] = [
  { id: 'create',    label: '创建',     icon: 'FilePlus2',      order: 0,  builtin: true },
  { id: 'generate',  label: '生成',     icon: 'Wand2',          order: 1,  builtin: true },
  { id: 'analyze',   label: '分析',     icon: 'BarChart3',      order: 2,  builtin: true },
  { id: 'clean',     label: '清洗',     icon: 'Eraser',         order: 3,  builtin: true },
  { id: 'transform', label: '变换',     icon: 'ArrowRightLeft', order: 4,  builtin: true },
  { id: 'formula',   label: '公式',     icon: 'Calculator',     order: 5,  builtin: true },
  { id: 'fill',      label: '填充',     icon: 'Sparkles',       order: 6,  builtin: true },
  { id: 'filter',    label: '排序筛选', icon: 'ListFilter',     order: 7,  builtin: true },
  { id: 'format',    label: '格式',     icon: 'Paintbrush',     order: 8,  builtin: true },
  { id: 'validate',  label: '校验',     icon: 'ShieldCheck',    order: 9,  builtin: true },
  { id: 'export',    label: '导出',     icon: 'FileOutput',     order: 10, builtin: true },
  { id: 'scenario',  label: '场景',     icon: 'LayoutTemplate', order: 11, builtin: true },
];

// ── 默认内置操作项 ──

const DEFAULT_ITEMS: QuickActionItem[] = [

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 创建 (create) — 从零创建表格
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'create_from_doc',   categoryId: 'create', label: '从文档提取表格', icon: 'FilePlus2', order: 0,  builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['提取', '文档', 'tq', 'wd'],
    prompt: '请根据文档正文内容，提取其中的数据和信息，生成一个或多个结构化表格。' },
  { id: 'create_from_desc',  categoryId: 'create', label: '按描述创建',     icon: 'FilePlus2', order: 1,  builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['描述', '创建', 'ms', 'cj'],
    prompt: '请根据我的需求描述创建一个新表格，设计合理的列结构和初始数据。' },
  { id: 'create_from_clipboard', categoryId: 'create', label: '从剪贴板创建', icon: 'FilePlus2', order: 2, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['剪贴板', '粘贴', 'jtb', 'zt'],
    prompt: '请将我粘贴的文本/数据整理为结构化表格，自动识别分隔符和列结构。' },
  { id: 'create_pivot',     categoryId: 'create', label: '生成透视表',     icon: 'FilePlus2', order: 3,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['透视', '汇总', 'pivot', 'ts', 'hz'],
    prompt: '请根据当前表格数据生成一个透视表/汇总表，自动识别适合作为分组维度和汇总指标的列。' },
  { id: 'create_calendar',  categoryId: 'create', label: '日历表',         icon: 'FilePlus2', order: 4,  builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['日历', '排班', 'rl', 'pb'],
    prompt: '请创建一个日历排班表，包含日期、星期、班次、负责人等列，默认生成当月数据。' },
  { id: 'create_budget',    categoryId: 'create', label: '预算表',         icon: 'FilePlus2', order: 5,  builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['预算', '收支', 'ys', 'sz'],
    prompt: '请创建一个收支预算表，包含类别、预算金额、实际金额、差异、占比等列，分月度统计。' },
  { id: 'create_attendance', categoryId: 'create', label: '考勤表',        icon: 'FilePlus2', order: 6,  builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['考勤', '打卡', 'kq', 'dk'],
    prompt: '请创建一个员工考勤记录表，包含姓名、日期、上班时间、下班时间、工时、备注等列。' },
  { id: 'create_inventory', categoryId: 'create', label: '库存表',         icon: 'FilePlus2', order: 7,  builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['库存', '进出', 'kc', 'jc'],
    prompt: '请创建一个库存管理表，包含品名、规格、入库量、出库量、库存余额、单价、金额等列。' },
  { id: 'create_contacts',  categoryId: 'create', label: '通讯录',         icon: 'FilePlus2', order: 8,  builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['通讯录', '联系人', 'txl', 'lxr'],
    prompt: '请创建一个联系人通讯录表，包含姓名、部门、职位、电话、邮箱、地址等列。' },
  { id: 'create_project',   categoryId: 'create', label: '项目进度表',     icon: 'FilePlus2', order: 9,  builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['项目', '进度', '任务', 'xm', 'jd'],
    prompt: '请创建一个项目任务管理表，包含任务名、负责人、开始日期、截止日期、状态、优先级、进度等列。' },
  { id: 'create_scorecard', categoryId: 'create', label: '评分表',         icon: 'FilePlus2', order: 10, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['评分', '打分', 'pf', 'df'],
    prompt: '请创建一个多维度评分/打分表，包含评估对象、各评分维度列、加权总分、等级等。' },
  { id: 'create_order',     categoryId: 'create', label: '订单表',         icon: 'FilePlus2', order: 11, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['订单', '客户', 'dd', 'kh'],
    prompt: '请创建一个订单管理表，包含订单号、客户、产品、数量、单价、金额、日期、状态等列。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 生成 (generate) — 基于现有数据生成新内容
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'gen_sample',       categoryId: 'generate', label: '生成示例数据',   icon: 'Wand2', order: 0, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['示例', '样例', 'sl', 'yl'],
    prompt: '请根据当前表格的列结构，生成20行合理的示例数据填充表格。' },
  { id: 'gen_more_rows',    categoryId: 'generate', label: '扩充更多行',     icon: 'Wand2', order: 1, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['扩充', '更多', 'kc', 'gd'],
    prompt: '请根据现有数据的规律和特征，继续生成更多行数据（保持数据分布一致）。' },
  { id: 'gen_summary_row',  categoryId: 'generate', label: '生成汇总行',     icon: 'Wand2', order: 2, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['汇总', '合计', 'hz', 'hj'],
    prompt: '请在表格底部添加汇总行，包含合计、均值、最大值、最小值等统计。' },
  { id: 'gen_derived_col',  categoryId: 'generate', label: '生成派生列',     icon: 'Wand2', order: 3, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['派生', '计算列', 'ps', 'jsl'],
    prompt: '请根据现有列的数据推导生成新的计算列（如增长率、占比、差值等）。' },
  { id: 'gen_category_col', categoryId: 'generate', label: '生成分类列',     icon: 'Wand2', order: 4, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['分类', '标签', 'fl', 'bq'],
    prompt: '请根据数据特征为每行自动添加分类标签列。' },
  { id: 'gen_rank_col',     categoryId: 'generate', label: '生成排名列',     icon: 'Wand2', order: 5, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['排名', 'rank', 'pm'],
    prompt: '请根据指定指标为每行生成排名列。' },
  { id: 'gen_description',  categoryId: 'generate', label: '生成数据描述',   icon: 'Wand2', order: 6, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['描述', '备注', 'ms', 'bz'],
    prompt: '请为每行数据生成自然语言描述/备注列。' },
  { id: 'gen_test_data',    categoryId: 'generate', label: '生成测试数据',   icon: 'Wand2', order: 7, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['测试', '边界', 'cs', 'bj'],
    prompt: '请生成包含边界值、异常值、空值等特殊情况的测试数据集。' },
  { id: 'gen_time_series',  categoryId: 'generate', label: '生成时间序列',   icon: 'Wand2', order: 8, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['时间序列', '日期', 'sjxl', 'rq'],
    prompt: '请按日期维度生成时间序列数据，包含日期列和对应的数值列。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 分析 (analyze) — 数据分析与洞察
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'analyze_overview',     categoryId: 'analyze', label: '数据概览',     icon: 'BarChart3',     order: 0,  builtin: true, contextMode: 'stats',
    executionMode: 'ai', keywords: ['概览', '概况', 'gl', 'gk'],
    prompt: '请分析当前表格数据，给出整体概览：数据规模、各列类型、数值列统计（均值/中位数/标准差）、缺失值情况、数据质量评估。' },
  { id: 'analyze_trend',       categoryId: 'analyze', label: '趋势分析',     icon: 'TrendingUp',    order: 1,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['趋势', '走势', 'qs', 'zs'],
    prompt: '请分析当前表格数据中的趋势和模式，识别数值列的增减趋势、季节性规律、突变点等。' },
  { id: 'analyze_outlier',     categoryId: 'analyze', label: '异常检测',     icon: 'AlertTriangle', order: 2,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['异常', '离群', 'yc', 'lq'],
    prompt: '请检查当前表格数据中的异常值和离群点，标识出可能的数据录入错误、极端值或不一致的记录。' },
  { id: 'analyze_corr',        categoryId: 'analyze', label: '相关性分析',   icon: 'GitCompare',    order: 3,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['相关性', '关联', 'xgx', 'gl'],
    prompt: '请分析当前表格中各数值列之间的相关性，识别强相关的列对，给出可能的因果关系解释。' },
  { id: 'analyze_distribution', categoryId: 'analyze', label: '分布分析',    icon: 'BarChart3',     order: 4,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['分布', '直方图', 'fb', 'zft'],
    prompt: '请分析各列的数据分布特征：偏度、峰度、分位数、频率分布、是否近似正态分布等。' },
  { id: 'analyze_compare',     categoryId: 'analyze', label: '对比分析',     icon: 'BarChart3',     order: 5,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['对比', '比较', 'db', 'bj'],
    prompt: '请按分组维度进行对比分析：同比/环比增长率、组间差异、变化幅度等。' },
  { id: 'analyze_proportion',  categoryId: 'analyze', label: '占比分析',     icon: 'PieChart',      order: 6,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['占比', '构成', 'zb', 'gc'],
    prompt: '请计算各类别的占比、构成分析，识别主要和次要成分。' },
  { id: 'analyze_topn',        categoryId: 'analyze', label: 'TOP 排名',     icon: 'BarChart3',     order: 7,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['top', '排名', 'pm'],
    prompt: '请按指定指标排出 Top N 和 Bottom N，分析头部和尾部特征。' },
  { id: 'analyze_cross',       categoryId: 'analyze', label: '交叉分析',     icon: 'BarChart3',     order: 8,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['交叉', '列联', 'jc', 'll'],
    prompt: '请对两个维度进行交叉统计/列联分析，生成交叉汇总表。' },
  { id: 'analyze_predict',     categoryId: 'analyze', label: '趋势预测',     icon: 'TrendingUp',    order: 9,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['预测', '预估', 'yc', 'yg'],
    prompt: '请基于历史数据推测未来趋势，给出预测值和置信区间。' },
  { id: 'analyze_cluster',     categoryId: 'analyze', label: '聚类分群',     icon: 'BarChart3',     order: 10, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['聚类', '分群', 'jl', 'fq'],
    prompt: '请根据多维特征将数据自动分群，描述各群体特征差异。' },
  { id: 'analyze_chart',       categoryId: 'analyze', label: '可视化建议',   icon: 'PieChart',      order: 11, builtin: true, contextMode: 'stats',
    executionMode: 'ai', keywords: ['可视化', '图表', 'ksh', 'tb'],
    prompt: '请根据当前表格的数据特征，推荐最适合的可视化图表类型（柱状图/折线图/散点图/饼图等），并说明推荐维度和指标。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 清洗 (clean) — 数据质量改善
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'clean_dedup',        categoryId: 'clean', label: '去除重复行',   icon: 'Eraser',     order: 0, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'dedup_rows', keywords: ['去重', '重复', 'qc', 'cf'], dangerous: true,
    prompt: '请检查当前表格中的重复行，列出重复记录并建议保留哪些、删除哪些。' },
  { id: 'clean_missing',      categoryId: 'clean', label: '处理缺失值',   icon: 'Eraser',     order: 1, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['缺失', '空值', 'qs', 'kz'],
    prompt: '请分析当前表格中的缺失值/空值情况，建议合理的填充策略（均值/中位数/众数/插值/删除行等）。' },
  { id: 'clean_format',       categoryId: 'clean', label: '格式统一',     icon: 'Eraser',     order: 2, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['格式', '统一', 'gs', 'ty'],
    prompt: '请检查当前表格中的格式不一致问题（日期格式、数字精度、大小写、多余空格、特殊字符等），给出统一建议。' },
  { id: 'clean_trim',         categoryId: 'clean', label: '修剪空白',     icon: 'Eraser',     order: 3, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'trim_whitespace', keywords: ['修剪', '空白', '空格', 'xj', 'kb', 'kg'],
    prompt: '请清除表格中所有单元格的多余空格、换行符、不可见字符和前后空白。' },
  { id: 'clean_case',         categoryId: 'clean', label: '大小写统一',   icon: 'Eraser',     order: 4, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['大小写', 'dxx'],
    prompt: '请检查文本列的大小写不一致问题，建议统一规则（首字母大写/全大写/全小写等）。' },
  { id: 'clean_regex',        categoryId: 'clean', label: '正则替换',     icon: 'Eraser',     order: 5, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['正则', '替换', 'regex', 'zz', 'th'],
    prompt: '请根据数据特征建议合适的正则表达式进行批量替换/清理（如提取数字、去除HTML标签等）。' },
  { id: 'clean_split',        categoryId: 'clean', label: '拆分列内容',   icon: 'Eraser',     order: 6, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['拆分', '分列', 'cf', 'fl'],
    prompt: '请分析哪些列的内容可以拆分为多列（如"张三-经理"→姓名+职位），并给出拆分方案。' },
  { id: 'clean_merge_content', categoryId: 'clean', label: '合并列内容',  icon: 'Eraser',     order: 7, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['合并', '拼接', 'hb', 'pj'],
    prompt: '请建议哪些列可以合并为一列，并给出合并规则和分隔符格式。' },
  { id: 'clean_standardize',  categoryId: 'clean', label: '标准化数值',   icon: 'Eraser',     order: 8, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['标准化', '归一化', 'bzh', 'gyh'],
    prompt: '请对数值列进行归一化或标准化处理（0-1归一化/Z-score标准化），消除量纲差异。' },
  { id: 'clean_typo',         categoryId: 'clean', label: '拼写纠错',     icon: 'Eraser',     order: 9, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['拼写', '纠错', 'px', 'jc'],
    prompt: '请检查文本列中的拼写错误、别字和常见笔误，列出并建议修正。' },
  { id: 'clean_empty_rows',   categoryId: 'clean', label: '删除空行',     icon: 'Eraser',     order: 10, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'remove_empty_rows', keywords: ['空行', '删除', 'kh', 'sc'], dangerous: true,
    prompt: '删除表格中的所有空行。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 变换 (transform) — 数据结构变换
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'transform_transpose',    categoryId: 'transform', label: '行列转置',     icon: 'ArrowRightLeft', order: 0, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'transpose', keywords: ['转置', '行列', 'zz', 'hl'],
    prompt: '请将当前表格的行和列互换（转置），生成新的表格结构。' },
  { id: 'transform_wide_to_long', categoryId: 'transform', label: '宽表转长表',   icon: 'ArrowRightLeft', order: 1, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['宽表', '长表', 'unpivot', 'kb', 'cb'],
    prompt: '请将当前宽格式表转换为长格式（unpivot），识别维度列和度量列。' },
  { id: 'transform_long_to_wide', categoryId: 'transform', label: '长表转宽表',   icon: 'ArrowRightLeft', order: 2, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['长表', '宽表', 'pivot', 'cb', 'kb'],
    prompt: '请将当前长格式表转换为宽格式（pivot），自动选择合适的行/列/值。' },
  { id: 'transform_group',        categoryId: 'transform', label: '分组汇总',     icon: 'ArrowRightLeft', order: 3, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['分组', '汇总', 'group', 'fz', 'hz'],
    prompt: '请按维度分组计算汇总指标（求和/计数/均值/最大/最小等），生成汇总结果。' },
  { id: 'transform_sample',       categoryId: 'transform', label: '数据抽样',     icon: 'ArrowRightLeft', order: 4, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['抽样', 'sample', 'cy'],
    prompt: '请从数据中进行随机抽样或系统抽样，保持数据分布特征。' },
  { id: 'transform_rank',         categoryId: 'transform', label: '排名计算',     icon: 'ArrowRightLeft', order: 5, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['排名', 'rank', 'pm'],
    prompt: '请按指标计算排名/百分位数，支持分组排名和全局排名。' },
  { id: 'transform_percent',      categoryId: 'transform', label: '百分比转换',   icon: 'ArrowRightLeft', order: 6, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['百分比', '占比', 'bfb', 'zb'],
    prompt: '请将数值列转换为占比/百分比，支持行占比和列占比。' },
  { id: 'transform_encode',       categoryId: 'transform', label: '编码转换',     icon: 'ArrowRightLeft', order: 7, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['编码', 'onehot', 'label', 'bm'],
    prompt: '请将分类文本编码为数值（Label编码/One-Hot编码），用于后续分析。' },
  { id: 'transform_merge_sheets', categoryId: 'transform', label: '合并多表',     icon: 'ArrowRightLeft', order: 8, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['合并', '多表', 'hb', 'db'],
    prompt: '请分析多个Sheet的结构关系，建议合并方案（纵向拼接/横向关联/交叉合并）。' },
  { id: 'transform_diff',         categoryId: 'transform', label: '数据对比',     icon: 'ArrowRightLeft', order: 9, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['对比', '差异', 'diff', 'db', 'cy'],
    prompt: '请对比两组数据的差异，标识出新增、删除和修改的记录。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 公式 (formula) — 公式推荐与计算
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'formula_suggest',   categoryId: 'formula', label: '智能推荐公式',   icon: 'Calculator', order: 0,  builtin: true, contextMode: 'structure',
    executionMode: 'hybrid', keywords: ['推荐', '公式', 'tj', 'gs'],
    prompt: '请根据当前表格的列结构和数据特征，推荐有用的计算公式（求和、均值、占比、同比增长等）。' },
  { id: 'formula_sum',      categoryId: 'formula', label: '求和合计',       icon: 'Calculator', order: 1,  builtin: true, contextMode: 'data',
    executionMode: 'hybrid', keywords: ['求和', 'sum', 'qh'],
    prompt: '请为数值列生成SUM/SUMIF/SUMIFS等求和公式，包含条件求和建议。' },
  { id: 'formula_count',    categoryId: 'formula', label: '计数统计',       icon: 'Calculator', order: 2,  builtin: true, contextMode: 'data',
    executionMode: 'hybrid', keywords: ['计数', 'count', 'js'],
    prompt: '请生成COUNT/COUNTIF/COUNTA等计数频率统计公式。' },
  { id: 'formula_condition', categoryId: 'formula', label: '条件公式',      icon: 'Calculator', order: 3,  builtin: true, contextMode: 'data',
    executionMode: 'hybrid', keywords: ['条件', 'if', 'tj'],
    prompt: '请根据数据特征建议IF/IFS/SWITCH等条件判断公式（分段评级、阈值标记等）。' },
  { id: 'formula_lookup',   categoryId: 'formula', label: '查找匹配',       icon: 'Calculator', order: 4,  builtin: true, contextMode: 'data',
    executionMode: 'hybrid', keywords: ['查找', 'vlookup', 'match', 'cz'],
    prompt: '请生成VLOOKUP/INDEX+MATCH/XLOOKUP等查找匹配公式。' },
  { id: 'formula_text',     categoryId: 'formula', label: '文本公式',       icon: 'Calculator', order: 5,  builtin: true, contextMode: 'data',
    executionMode: 'hybrid', keywords: ['文本', 'text', 'wb'],
    prompt: '请生成LEFT/RIGHT/MID/CONCAT/SUBSTITUTE等文本处理公式。' },
  { id: 'formula_date',     categoryId: 'formula', label: '日期公式',       icon: 'Calculator', order: 6,  builtin: true, contextMode: 'data',
    executionMode: 'hybrid', keywords: ['日期', 'date', 'rq'],
    prompt: '请生成YEAR/MONTH/DATEDIF/WORKDAY等日期计算公式。' },
  { id: 'formula_math',     categoryId: 'formula', label: '数学函数',       icon: 'Calculator', order: 7,  builtin: true, contextMode: 'data',
    executionMode: 'hybrid', keywords: ['数学', '四舍五入', 'math', 'sx'],
    prompt: '请生成ROUND/ABS/MOD/CEILING/FLOOR等数学运算公式。' },
  { id: 'formula_stats',    categoryId: 'formula', label: '统计函数',       icon: 'Calculator', order: 8,  builtin: true, contextMode: 'data',
    executionMode: 'hybrid', keywords: ['统计', '均值', 'average', 'tj', 'jz'],
    prompt: '请生成AVERAGE/MEDIAN/STDEV/PERCENTILE等统计分析公式。' },
  { id: 'formula_cross',    categoryId: 'formula', label: '跨表计算',       icon: 'Calculator', order: 9,  builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['跨表', '关联', 'kb', 'gl'],
    prompt: '请分析多表关联关系，建议跨表查找和计算公式。' },
  { id: 'formula_debug',    categoryId: 'formula', label: '公式排错',       icon: 'Calculator', order: 10, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['排错', '调试', 'debug', 'pc'],
    prompt: '请诊断表格中公式的错误原因（#REF!/#VALUE!/#N/A等），提供修复方案。' },
  { id: 'formula_explain',  categoryId: 'formula', label: '公式解释',       icon: 'Calculator', order: 11, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['解释', '说明', 'explain', 'js'],
    prompt: '请解读表格中已有公式的含义和计算逻辑，用通俗语言说明。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 填充 (fill) — AI 智能填充
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'fill_column',      categoryId: 'fill', label: 'AI 填充列',     icon: 'Sparkles', order: 0, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['填充', '新列', 'tc', 'xl'],
    prompt: '请根据现有数据和列结构，建议可以通过 AI 自动生成/推导的新列，并填充数据。' },
  { id: 'fill_missing',     categoryId: 'fill', label: 'AI 补全空值',   icon: 'Sparkles', order: 1, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['补全', '空值', 'bq', 'kz'],
    prompt: '请根据上下文规律，智能推测并填充当前表格中的空值/缺失数据。' },
  { id: 'fill_classify',    categoryId: 'fill', label: 'AI 分类标签',   icon: 'Tag',      order: 2, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['分类', '标签', 'fl', 'bq'],
    prompt: '请根据数据特征，为每行数据添加一个智能分类/标签列。' },
  { id: 'fill_score',       categoryId: 'fill', label: 'AI 评分',       icon: 'Star',     order: 3, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['评分', '打分', 'pf', 'df'],
    prompt: '请设计合理的评分规则，为每行计算一个综合评分。' },
  { id: 'fill_sequence',    categoryId: 'fill', label: '序号生成',       icon: 'Sparkles', order: 4, builtin: true, contextMode: 'structure',
    executionMode: 'direct', directAction: 'fill_sequence', keywords: ['序号', '编号', 'xh', 'bh'],
    prompt: '请自动生成递增序号/编码列（支持自定义前缀和格式，如 ORD-0001）。' },
  { id: 'fill_date_series', categoryId: 'fill', label: '日期序列',       icon: 'Sparkles', order: 5, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['日期', '序列', 'rq', 'xl'],
    prompt: '请按指定间隔（天/周/月）生成日期序列填充。' },
  { id: 'fill_random',      categoryId: 'fill', label: '随机数据',       icon: 'Sparkles', order: 6, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['随机', 'random', 'sj'],
    prompt: '请按约束条件（范围、分布、格式）生成随机数据填充。' },
  { id: 'fill_pattern',     categoryId: 'fill', label: '规律推导',       icon: 'Sparkles', order: 7, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['规律', '推导', 'gl', 'td'],
    prompt: '请从已有数据中识别规律和模式，推导并填充后续数据。' },
  { id: 'fill_geo_info',    categoryId: 'fill', label: '地理信息补全',   icon: 'Sparkles', order: 8, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['地理', '地址', 'dl', 'dz'],
    prompt: '请根据地址/城市信息补全省份、区号、邮编等地理相关字段。' },
  { id: 'fill_sentiment',   categoryId: 'fill', label: '情感分析',       icon: 'Sparkles', order: 9, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['情感', '情绪', 'qg', 'qx'],
    prompt: '请对文本列进行情感倾向分析，添加情感极性列（正面/负面/中性）和置信度。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 排序筛选 (filter) — 排序与筛选
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'filter_sort_asc',    categoryId: 'filter', label: '升序排列',       icon: 'ListFilter', order: 0, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'sort_asc', keywords: ['升序', 'asc', '排序', 'sx', 'px'],
    prompt: '请建议最适合排序的列，并按升序排列数据。' },
  { id: 'filter_sort_desc',   categoryId: 'filter', label: '降序排列',       icon: 'ListFilter', order: 1, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'sort_desc', keywords: ['降序', 'desc', '排序', 'jx', 'px'],
    prompt: '请建议最适合排序的列，并按降序排列数据。' },
  { id: 'filter_sort_multi',  categoryId: 'filter', label: '多条件排序',     icon: 'ListFilter', order: 2, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['多条件', '多列排序', 'dtj'],
    prompt: '请设计多列组合排序规则（如先按部门升序，再按金额降序）。' },
  { id: 'filter_sort_custom', categoryId: 'filter', label: '自定义排序',     icon: 'ListFilter', order: 3, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['自定义', '排序', 'zdy', 'px'],
    prompt: '请按业务含义的自定义顺序排列（如优先级：紧急>高>中>低）。' },
  { id: 'filter_unique',      categoryId: 'filter', label: '筛选唯一值',     icon: 'ListFilter', order: 4, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'extract_unique', keywords: ['唯一', '不重复', 'wy', 'bcf'],
    prompt: '请提取指定列的唯一不重复值列表。' },
  { id: 'filter_topn',        categoryId: 'filter', label: 'Top N 筛选',     icon: 'ListFilter', order: 5, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['top', '前n', '筛选', 'sx'],
    prompt: '请按指标取前N条/后N条记录。' },
  { id: 'filter_condition',   categoryId: 'filter', label: '条件筛选',       icon: 'ListFilter', order: 6, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['条件', '筛选', 'tj', 'sx'],
    prompt: '请根据条件表达式筛选符合条件的行（如金额>1000 且 状态="已完成"）。' },
  { id: 'filter_between',     categoryId: 'filter', label: '范围筛选',       icon: 'ListFilter', order: 7, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['范围', 'between', 'fw'],
    prompt: '请按数值/日期范围筛选数据（如2024年1月~3月、100~500之间）。' },
  { id: 'filter_contains',    categoryId: 'filter', label: '关键词筛选',     icon: 'ListFilter', order: 8, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['关键词', '包含', 'gjc', 'bh'],
    prompt: '请按关键词/模式匹配筛选包含指定内容的行。' },
  { id: 'filter_sample',      categoryId: 'filter', label: '随机抽样',       icon: 'ListFilter', order: 9, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['随机', '抽样', 'sj', 'cy'],
    prompt: '请从数据中随机抽取指定比例或数量的样本。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 格式 (format) — 格式化与美化
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'format_number',      categoryId: 'format', label: '数字格式化',     icon: 'Paintbrush', order: 0, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'format_number', keywords: ['数字', '小数', 'sz', 'xs'],
    prompt: '请统一数字列的格式：小数位数、千分位分隔符、正负号显示等。' },
  { id: 'format_date',        categoryId: 'format', label: '日期格式化',     icon: 'Paintbrush', order: 1, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'format_date', keywords: ['日期', '格式', 'rq', 'gs'],
    prompt: '请统一日期列的格式为 YYYY-MM-DD 或其他指定格式。' },
  { id: 'format_currency',    categoryId: 'format', label: '货币格式',       icon: 'Paintbrush', order: 2, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'format_currency', keywords: ['货币', '金额', 'hb', 'je'],
    prompt: '请为金额列添加货币符号和千分位格式（如 ¥1,234.56）。' },
  { id: 'format_percent',     categoryId: 'format', label: '百分比格式',     icon: 'Paintbrush', order: 3, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'format_percent', keywords: ['百分比', '%', 'bfb'],
    prompt: '请将小数列转换为百分比显示格式（如 0.85 → 85%）。' },
  { id: 'format_header',      categoryId: 'format', label: '表头美化',       icon: 'Paintbrush', order: 4, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['表头', '美化', 'bt', 'mh'],
    prompt: '请优化表头命名，使其更规范专业（如 "amt"→"金额(元)"、"dt"→"日期"）。' },
  { id: 'format_conditional', categoryId: 'format', label: '条件格式建议',   icon: 'Paintbrush', order: 5, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['条件格式', '高亮', 'tjgs', 'gl'],
    prompt: '请推荐适合当前数据的条件格式高亮规则（如负数标红、达标标绿、异常标黄）。' },
  { id: 'format_align',       categoryId: 'format', label: '对齐规范',       icon: 'Paintbrush', order: 6, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['对齐', '列宽', 'dq', 'lk'],
    prompt: '请建议各列的最佳对齐方式（数字右对齐、文本左对齐、日期居中）和最佳列宽。' },
  { id: 'format_unit',        categoryId: 'format', label: '单位统一',       icon: 'Paintbrush', order: 7, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['单位', '统一', 'dw', 'ty'],
    prompt: '请统一数据中的度量单位（kg/g、元/万元、m/km等），消除单位混用。' },
  { id: 'format_phone',       categoryId: 'format', label: '电话格式化',     icon: 'Paintbrush', order: 8, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['电话', '手机', 'dh', 'sj'],
    prompt: '请统一电话号码格式（如 138-0000-0000、+86 13800000000）。' },
  { id: 'format_address',     categoryId: 'format', label: '地址格式化',     icon: 'Paintbrush', order: 9, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['地址', '省市', 'dz', 'ss'],
    prompt: '请统一地址格式并补全缩写（如 "京"→"北京市"），规范省/市/区层级。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 校验 (validate) — 数据校验与质量
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'validate_unique',       categoryId: 'validate', label: '唯一性检查',     icon: 'ShieldCheck', order: 0, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'check_unique', keywords: ['唯一', '重复', 'wy', 'cf'],
    prompt: '请检查指定列是否存在重复值，列出所有重复项及其出现次数。' },
  { id: 'validate_type',         categoryId: 'validate', label: '类型一致性',     icon: 'ShieldCheck', order: 1, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['类型', '一致', 'lx', 'yz'],
    prompt: '请检查每列的数据类型是否一致（如数字列中混入文本、日期列格式不统一等）。' },
  { id: 'validate_range',        categoryId: 'validate', label: '范围校验',       icon: 'ShieldCheck', order: 2, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['范围', '校验', 'fw', 'jy'],
    prompt: '请检查数值列是否在合理范围内（如年龄0-150、百分比0-100、金额非负等）。' },
  { id: 'validate_required',     categoryId: 'validate', label: '必填项检查',     icon: 'ShieldCheck', order: 3, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'check_required', keywords: ['必填', '空值', 'bt', 'kz'],
    prompt: '请检查关键字段是否有空值/缺失，列出所有缺失的必填项。' },
  { id: 'validate_reference',    categoryId: 'validate', label: '引用完整性',     icon: 'ShieldCheck', order: 4, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['引用', '外键', 'yy', 'wj'],
    prompt: '请检查外键/关联字段的引用是否有效，是否存在悬空引用。' },
  { id: 'validate_business',     categoryId: 'validate', label: '业务规则',       icon: 'ShieldCheck', order: 5, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['业务', '规则', 'yw', 'gz'],
    prompt: '请根据数据特征推断并验证业务规则（如开始日期<结束日期、合计=明细之和等）。' },
  { id: 'validate_quality',      categoryId: 'validate', label: '数据质量评分',   icon: 'ShieldCheck', order: 6, builtin: true, contextMode: 'stats',
    executionMode: 'ai', keywords: ['质量', '评分', 'zl', 'pf'],
    prompt: '请综合评估数据质量（完整性/一致性/准确性/时效性），给出评分和改进建议。' },
  { id: 'validate_consistency',  categoryId: 'validate', label: '一致性检查',     icon: 'ShieldCheck', order: 7, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['一致性', '逻辑', 'yzx', 'lj'],
    prompt: '请检查相关字段间的逻辑一致性（如省份与邮编匹配、性别与称谓匹配等）。' },
  { id: 'validate_email',        categoryId: 'validate', label: '邮箱格式校验',   icon: 'ShieldCheck', order: 8, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'check_email_format', keywords: ['邮箱', 'email', 'yx'],
    prompt: '请校验邮箱地址列的格式是否合法，标记格式错误的记录。' },
  { id: 'validate_id',           categoryId: 'validate', label: '编码校验',       icon: 'ShieldCheck', order: 9, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['编码', '身份证', 'bm', 'sfz'],
    prompt: '请校验身份证号、统一社会信用代码、手机号等编码的格式和校验位是否正确。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 导出 (export) — 导出与代码生成
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'export_report',        categoryId: 'export', label: '生成分析报告',     icon: 'FileText',  order: 0, builtin: true, contextMode: 'stats',
    executionMode: 'ai', keywords: ['报告', '分析', 'bg', 'fx'],
    prompt: '请根据当前表格数据，生成一份完整的数据分析报告，包含数据概览、关键发现、趋势分析和结论建议。' },
  { id: 'export_sql',           categoryId: 'export', label: '生成 SQL',         icon: 'Database',  order: 1, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['sql', '数据库', 'sjk'],
    prompt: '请根据当前表格结构，生成 CREATE TABLE 和 INSERT INTO 的 SQL 语句。' },
  { id: 'export_json_schema',   categoryId: 'export', label: '生成 JSON Schema', icon: 'Braces',    order: 2, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['json', 'schema', '结构'],
    prompt: '请根据当前表格结构和数据类型，生成对应的 JSON Schema 定义。' },
  { id: 'export_csv',           categoryId: 'export', label: '生成 CSV',         icon: 'FileText',  order: 3, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'copy_as_csv', keywords: ['csv', '逗号', 'dh'],
    prompt: '请将当前表格数据转换为 CSV 格式文本输出。' },
  { id: 'export_markdown',      categoryId: 'export', label: '生成 Markdown',    icon: 'FileText',  order: 4, builtin: true, contextMode: 'data',
    executionMode: 'direct', directAction: 'copy_as_markdown', keywords: ['markdown', 'md', '表格'],
    prompt: '请将当前表格数据转换为 Markdown 表格格式。' },
  { id: 'export_python',        categoryId: 'export', label: '生成 Python 代码', icon: 'FileText',  order: 5, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['python', 'pandas', 'py'],
    prompt: '请生成用 Pandas 构建当前表格的 Python DataFrame 代码。' },
  { id: 'export_dict',          categoryId: 'export', label: '生成数据字典',     icon: 'FileText',  order: 6, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['数据字典', '字段说明', 'sjzd'],
    prompt: '请生成各列的数据字典说明文档（字段名、类型、描述、取值范围、示例等）。' },
  { id: 'export_api_mock',      categoryId: 'export', label: '生成 API Mock',    icon: 'FileText',  order: 7, builtin: true, contextMode: 'structure',
    executionMode: 'ai', keywords: ['api', 'mock', '接口'],
    prompt: '请生成 RESTful API Mock 数据和接口文档（含请求/响应格式）。' },
  { id: 'export_excel_formula', categoryId: 'export', label: '导出 Excel 公式',  icon: 'FileText',  order: 8, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['excel', '公式导出', 'gs'],
    prompt: '请将表格中的公式导出为 Excel 兼容格式，附带公式说明。' },
  { id: 'export_chart_config',  categoryId: 'export', label: '导出图表配置',     icon: 'FileText',  order: 9, builtin: true, contextMode: 'data',
    executionMode: 'ai', keywords: ['图表', 'echarts', 'chart', 'tb'],
    prompt: '请根据数据特征生成 ECharts 或 Chart.js 的图表配置 JSON。' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 场景 (scenario) — 常用场景模板
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  { id: 'scenario_finance',    categoryId: 'scenario', label: '财务报表',     icon: 'LayoutTemplate', order: 0, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['财务', '报表', 'cw', 'bb'],
    prompt: '请创建一套财务报表（收支明细表/利润表/资产负债表），包含合理的列结构和示例数据。' },
  { id: 'scenario_sales',      categoryId: 'scenario', label: '销售管理',     icon: 'LayoutTemplate', order: 1, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['销售', '客户', 'xs', 'kh'],
    prompt: '请创建销售管理表格（客户列表/销售漏斗/业绩统计），包含合理的列结构和示例数据。' },
  { id: 'scenario_hr',         categoryId: 'scenario', label: '人力资源',     icon: 'LayoutTemplate', order: 2, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['人力', '薪资', 'rl', 'xz'],
    prompt: '请创建人力资源管理表格（薪资表/绩效考核表/招聘跟踪表），包含合理的列结构和示例数据。' },
  { id: 'scenario_education',  categoryId: 'scenario', label: '学校教育',     icon: 'LayoutTemplate', order: 3, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['教育', '成绩', 'jy', 'cj'],
    prompt: '请创建学校教育管理表格（成绩单/课程表/学生花名册），包含合理的列结构和示例数据。' },
  { id: 'scenario_research',   categoryId: 'scenario', label: '科研数据',     icon: 'LayoutTemplate', order: 4, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['科研', '实验', 'ky', 'sy'],
    prompt: '请创建科研数据管理表格（实验记录/调查问卷统计/文献检索表），包含合理的列结构和示例数据。' },
  { id: 'scenario_ecommerce',  categoryId: 'scenario', label: '电商运营',     icon: 'LayoutTemplate', order: 5, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['电商', '商品', 'ds', 'sp'],
    prompt: '请创建电商运营管理表格（商品管理/库存盘点/退货记录），包含合理的列结构和示例数据。' },
  { id: 'scenario_personal',   categoryId: 'scenario', label: '个人生活',     icon: 'LayoutTemplate', order: 6, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['个人', '生活', 'gr', 'sh'],
    prompt: '请创建个人生活管理表格（记账本/旅行计划/健身记录/阅读清单），包含合理的列结构和示例数据。' },
  { id: 'scenario_meeting',    categoryId: 'scenario', label: '会议管理',     icon: 'LayoutTemplate', order: 7, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['会议', '纪要', 'hy', 'jy'],
    prompt: '请创建会议管理表格（会议纪要/待办事项/议程安排表），包含合理的列结构和示例数据。' },
  { id: 'scenario_risk',       categoryId: 'scenario', label: '风险管理',     icon: 'LayoutTemplate', order: 8, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['风险', '应急', 'fx', 'yj'],
    prompt: '请创建风险管理表格（风险登记/评估矩阵/应急预案表），包含合理的列结构和示例数据。' },
  { id: 'scenario_kpi',        categoryId: 'scenario', label: 'KPI 仪表盘',   icon: 'LayoutTemplate', order: 9, builtin: true, contextMode: 'none',
    executionMode: 'ai', keywords: ['kpi', '指标', '仪表盘', 'zb'],
    prompt: '请创建 KPI 指标跟踪表（指标名称/目标值/实际值/达成率/趋势），包含合理的列结构和示例数据。' },
];

// ── 获取默认数据 ──

export function getDefaultStore(): QuickActionStore {
  return {
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    items: DEFAULT_ITEMS.map(i => ({ ...i })),
    version: CURRENT_VERSION,
  };
}

// ── 合并内置项 ──

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
      // 同步内置项的新增字段（不覆盖用户自定义的 label/prompt/order/hidden）
      if (di.executionMode && !existing.executionMode) existing.executionMode = di.executionMode;
      if (di.directAction && !existing.directAction) existing.directAction = di.directAction;
      if (di.keywords && !existing.keywords) existing.keywords = di.keywords;
      if (di.dangerous !== undefined && existing.dangerous === undefined) existing.dangerous = di.dangerous;
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
  return `tqa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── 获取某内置项的默认提示词 ──

export function getBuiltinPrompt(itemId: string): string | undefined {
  return DEFAULT_ITEMS.find(i => i.id === itemId)?.prompt;
}

// ── 获取某内置分类的默认标签 ──

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
