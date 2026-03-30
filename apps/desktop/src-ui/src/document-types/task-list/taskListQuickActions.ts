/**
 * 任务清单快捷操作定义
 *
 * 8 分类 50+ 操作，对齐 calculatorQuickActions.ts 的结构
 */
// ── 类型定义 ──

export interface TaskListQuickActionCategory {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  order: number;
  builtin?: boolean;
}

export interface TaskListQuickActionItem {
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
}

export interface TaskListQuickActionStore {
  categories: TaskListQuickActionCategory[];
  items: TaskListQuickActionItem[];
  version: number;
  favorites?: string[];
  recentUsed?: string[];
}

const STORAGE_KEY = '_tasklist_quick_actions';
const CURRENT_VERSION = 1;

// ── 默认分类 ──

export const DEFAULT_CATEGORIES: TaskListQuickActionCategory[] = [
  { id: 'create', label: '任务创建', labelEn: 'Task Creation', icon: 'Plus', order: 0, builtin: true },
  { id: 'breakdown', label: '任务分解', labelEn: 'Breakdown', icon: 'GitBranch', order: 1, builtin: true },
  { id: 'priority', label: '优先级', labelEn: 'Priority', icon: 'AlertCircle', order: 2, builtin: true },
  { id: 'progress', label: '进度分析', labelEn: 'Progress', icon: 'BarChart3', order: 3, builtin: true },
  { id: 'efficiency', label: '效率提升', labelEn: 'Efficiency', icon: 'Zap', order: 4, builtin: true },
  { id: 'template', label: '模板生成', labelEn: 'Templates', icon: 'FileCode2', order: 5, builtin: true },
  { id: 'report', label: '报告生成', labelEn: 'Reports', icon: 'FileText', order: 6, builtin: true },
  { id: 'assistant', label: '智能助手', labelEn: 'Assistant', icon: 'Brain', order: 7, builtin: true },
];

// ── 默认操作项 ──

export const DEFAULT_ITEMS: TaskListQuickActionItem[] = [
  // ━━ 任务创建 ━━
  { id: 'create_today', categoryId: 'create', label: '快速创建今日任务', labelEn: 'Quick Today Tasks', icon: 'Calendar', order: 0, builtin: true,
    keywords: ['今日', 'jr', 'today'],
    prompt: '根据我的工作内容：{{userInput}}，帮我创建今日任务清单（5-8个任务），包含适当的优先级。输出用 ```tasks 代码块格式。' },

  { id: 'create_weekly', categoryId: 'create', label: '创建周计划', labelEn: 'Weekly Plan', icon: 'CalendarDays', order: 1, builtin: true,
    keywords: ['周计划', 'zh', 'weekly'],
    prompt: '帮我根据以下目标创建本周任务计划：{{userInput}}\n按周一到周日分布，考虑工作日和周末的差异。输出用 ```tasks 代码块格式。' },

  { id: 'create_project', categoryId: 'create', label: '项目启动清单', labelEn: 'Project Kickoff', icon: 'Rocket', order: 2, builtin: true,
    keywords: ['项目', 'xm', 'project'],
    prompt: '为项目"{{userInput}}"创建启动清单，包含需求确认、团队组建、计划制定等关键任务。输出用 ```tasks 代码块格式。' },

  { id: 'create_meeting_prep', categoryId: 'create', label: '会议准备清单', labelEn: 'Meeting Prep', icon: 'Users', order: 3, builtin: true,
    keywords: ['会议', 'hy', 'meeting'],
    prompt: '为会议"{{userInput}}"创建准备清单，包含议程、材料、人员通知等。输出用 ```tasks 代码块格式。' },

  { id: 'create_travel', categoryId: 'create', label: '旅行准备清单', labelEn: 'Travel Prep', icon: 'Plane', order: 4, builtin: true,
    keywords: ['旅行', 'lx', 'travel'],
    prompt: '为目的地"{{userInput}}"创建旅行准备清单，包含证件、行李、预订等。输出用 ```tasks 代码块格式。' },

  { id: 'create_shopping', categoryId: 'create', label: '购物清单', labelEn: 'Shopping List', icon: 'ShoppingCart', order: 5, builtin: true,
    keywords: ['购物', 'gw', 'shopping'],
    prompt: '根据我的需求"{{userInput}}"创建购物清单。输出用 ```tasks 代码块格式。' },

  // ━━ 任务分解 ━━
  { id: 'breakdown_large', categoryId: 'breakdown', label: '分解大任务', labelEn: 'Break Down Task', icon: 'GitBranch', order: 0, builtin: true,
    keywords: ['分解', 'fj', 'breakdown'],
    prompt: '将以下大任务分解为3-5个可执行的小任务：\n{{currentTask}}\n\n每个子任务应该有明确的完成标准。输出用 ```tasks 代码块格式。' },

  { id: 'breakdown_goal', categoryId: 'breakdown', label: '目标拆解', labelEn: 'Goal Breakdown', icon: 'Target', order: 1, builtin: true,
    keywords: ['目标', 'mb', 'goal'],
    prompt: '将目标"{{userInput}}"按SMART原则拆解为可执行的任务序列，包含里程碑。输出用 ```tasks 代码块格式。' },

  { id: 'breakdown_deadline', categoryId: 'breakdown', label: '按截止日期拆分', labelEn: 'By Deadline', icon: 'CalendarClock', order: 2, builtin: true,
    keywords: ['截止', 'jz', 'deadline'],
    prompt: '为任务"{{userInput}}"按时间节点拆分为多个子任务，每个子任务有明确的截止时间。输出用 ```tasks 代码块格式。' },

  { id: 'breakdown_milestone', categoryId: 'breakdown', label: '里程碑拆分', labelEn: 'Milestone Split', icon: 'Flag', order: 3, builtin: true,
    keywords: ['里程碑', 'lcb', 'milestone'],
    prompt: '为项目"{{userInput}}"创建里程碑清单，每个里程碑包含3-5个关键任务。输出用 ```tasks 代码块格式。' },

  { id: 'breakdown_daily', categoryId: 'breakdown', label: '日任务拆分', labelEn: 'Daily Tasks', icon: 'Sun', order: 4, builtin: true,
    keywords: ['日任务', 'rw', 'daily'],
    prompt: '将本周目标"{{userInput}}"拆分为每天的待办任务。输出用 ```tasks 代码块格式。' },

  // ━━ 优先级 ━━
  { id: 'priority_suggest', categoryId: 'priority', label: '优先级建议', labelEn: 'Priority Suggestion', icon: 'AlertCircle', order: 0, builtin: true,
    keywords: ['优先级', 'yxj', 'priority'],
    prompt: '分析以下任务列表，使用重要紧急矩阵为每个任务建议优先级：\n{{allTasks}}\n\n输出建议列表，说明理由。' },

  { id: 'priority_matrix', categoryId: 'priority', label: '重要紧急分析', labelEn: 'Urgent-Important', icon: 'Grid3X3', order: 1, builtin: true,
    keywords: ['矩阵', 'jz', 'matrix'],
    prompt: '对当前所有待办任务进行重要紧急矩阵分析，列出四个象限的任务分布和行动建议。' },

  { id: 'priority_reorder', categoryId: 'priority', label: '重排优先级', labelEn: 'Reorder Priority', icon: 'ArrowUpDown', order: 2, builtin: true,
    keywords: ['重排', 'cp', 'reorder'],
    prompt: '根据当前任务的重要性和紧急性，建议重新排序的顺序：\n{{allTasks}}' },

  { id: 'priority_focus', categoryId: 'priority', label: '识别核心任务', labelEn: 'Core Tasks', icon: 'Focus', order: 3, builtin: true,
    keywords: ['核心', 'hx', 'focus'],
    prompt: '从当前任务中识别最核心的3个任务（能产生80%结果的20%任务），说明原因。' },

  // ━━ 进度分析 ━━
  { id: 'progress_report', categoryId: 'progress', label: '生成进度报告', labelEn: 'Progress Report', icon: 'BarChart3', order: 0, builtin: true,
    keywords: ['进度', 'jd', 'progress'],
    prompt: '生成当前任务列表的进度报告，包含：完成率、优先级分布、时间趋势、阻塞项建议。' },

  { id: 'progress_weekly', categoryId: 'progress', label: '周进度分析', labelEn: 'Weekly Progress', icon: 'CalendarRange', order: 1, builtin: true,
    keywords: ['周进度', 'zjd', 'weekly'],
    prompt: '分析本周任务完成情况，对比上周，给出改进建议。' },

  { id: 'progress_blockers', categoryId: 'progress', label: '阻塞识别', labelEn: 'Identify Blockers', icon: 'AlertTriangle', order: 2, builtin: true,
    keywords: ['阻塞', 'zs', 'blocker'],
    prompt: '分析当前任务列表，识别可能的阻塞项和依赖链，提供解决建议。' },

  { id: 'progress_stats', categoryId: 'progress', label: '统计摘要', labelEn: 'Statistics', icon: 'PieChart', order: 3, builtin: true,
    keywords: ['统计', 'tj', 'stats'],
    prompt: '生成当前任务列表的统计摘要：总数、待办、已完成、高优先级数量，以及完成率。' },

  { id: 'progress_predict', categoryId: 'progress', label: '完成预测', labelEn: 'Completion Predict', icon: 'TrendingUp', order: 4, builtin: true,
    keywords: ['预测', 'yc', 'predict'],
    prompt: '根据当前任务进度和优先级分布，预测本周可能完成的任务，以及可能延期的风险项。' },

  // ━━ 效率提升 ━━
  { id: 'efficiency_timeblock', categoryId: 'efficiency', label: '时间块建议', labelEn: 'Time Blocks', icon: 'LayoutGrid', order: 0, builtin: true,
    keywords: ['时间块', 'sjk', 'timeblock'],
    prompt: '根据我的任务类型，建议时间块划分方案（深度工作、会议、邮件、休息等），以及每个时间块适合的任务。' },

  { id: 'efficiency_focus', categoryId: 'efficiency', label: '专注时段', labelEn: 'Focus Time', icon: 'Focus', order: 1, builtin: true,
    keywords: ['专注', 'zz', 'focus'],
    prompt: '从当前任务中识别最适合深度专注的任务，建议专注时段安排和配套策略。' },

  { id: 'efficiency_energy', categoryId: 'efficiency', label: '精力管理', labelEn: 'Energy Management', icon: 'Battery', order: 2, builtin: true,
    keywords: ['精力', 'jl', 'energy'],
    prompt: '根据任务难度和我的精力曲线，建议如何安排高难度任务和低难度任务的时间。' },

  { id: 'efficiency_batch', categoryId: 'efficiency', label: '批量处理建议', labelEn: 'Batch Processing', icon: 'Layers', order: 3, builtin: true,
    keywords: ['批量', 'pl', 'batch'],
    prompt: '分析当前任务，找出可以批量处理的相似任务，提高效率。' },

  // ━━ 模板生成 ━━
  { id: 'template_daily', categoryId: 'template', label: '工作日计划', labelEn: 'Daily Work Plan', icon: 'Sun', order: 0, builtin: true,
    keywords: ['日计划', 'rjh', 'daily'],
    prompt: '生成一个标准工作日的任务清单模板，包含早晨规划、核心工作、午休、下午工作、日回顾。输出用 ```tasks 代码块格式。' },

  { id: 'template_weekly', categoryId: 'template', label: '周计划模板', labelEn: 'Weekly Plan', icon: 'CalendarDays', order: 1, builtin: true,
    keywords: ['周计划', 'zjh', 'weekly'],
    prompt: '生成一个周计划任务模板，包含周一到周五的常规任务和重点项目。输出用 ```tasks 代码块格式。' },

  { id: 'template_monthly', categoryId: 'template', label: '月度目标', labelEn: 'Monthly Goals', icon: 'CalendarRange', order: 2, builtin: true,
    keywords: ['月目标', 'ymb', 'monthly'],
    prompt: '生成一个月度目标模板，包含关键结果和每周里程碑。输出用 ```tasks 代码块格式。' },

  { id: 'template_project', categoryId: 'template', label: '项目启动', labelEn: 'Project Kickoff', icon: 'Rocket', order: 3, builtin: true,
    keywords: ['项目', 'xm', 'project'],
    prompt: '生成项目启动清单模板，包含需求确认、团队组建、计划制定、风险识别等。输出用 ```tasks 代码块格式。' },

  { id: 'template_meeting', categoryId: 'template', label: '会议准备', labelEn: 'Meeting Prep', icon: 'Users', order: 4, builtin: true,
    keywords: ['会议', 'hy', 'meeting'],
    prompt: '生成会议准备清单模板，包含议程、材料、通知、设备检查等。输出用 ```tasks 代码块格式。' },

  { id: 'template_travel', categoryId: 'template', label: '旅行准备', labelEn: 'Travel Prep', icon: 'Plane', order: 5, builtin: true,
    keywords: ['旅行', 'lx', 'travel'],
    prompt: '生成旅行准备清单模板，包含证件、行李、预订、紧急联系等。输出用 ```tasks 代码块格式。' },

  { id: 'template_learning', categoryId: 'template', label: '学习计划', labelEn: 'Learning Plan', icon: 'GraduationCap', order: 6, builtin: true,
    keywords: ['学习', 'xx', 'learning'],
    prompt: '生成学习计划模板，包含目标设定、资源准备、学习进度、复习计划。输出用 ```tasks 代码块格式。' },

  { id: 'template_fitness', categoryId: 'template', label: '健身计划', labelEn: 'Fitness Plan', icon: 'Dumbbell', order: 7, builtin: true,
    keywords: ['健身', 'js', 'fitness'],
    prompt: '生成健身计划模板，包含热身、力量训练、有氧运动、拉伸恢复。输出用 ```tasks 代码块格式。' },

  { id: 'template_moving', categoryId: 'template', label: '搬家清单', labelEn: 'Moving Checklist', icon: 'Home', order: 8, builtin: true,
    keywords: ['搬家', 'bj', 'moving'],
    prompt: '生成搬家准备清单模板，包含打包、预约、清理、入住检查等。输出用 ```tasks 代码块格式。' },

  { id: 'template_reading', categoryId: 'template', label: '读书计划', labelEn: 'Reading Plan', icon: 'BookOpen', order: 9, builtin: true,
    keywords: ['读书', 'ds', 'reading'],
    prompt: '生成读书计划模板，包含选书、阅读进度、笔记整理、读后感。输出用 ```tasks 代码块格式。' },

  { id: 'template_budget', categoryId: 'template', label: '月度预算', labelEn: 'Monthly Budget', icon: 'Wallet', order: 10, builtin: true,
    keywords: ['预算', 'ys', 'budget'],
    prompt: '生成月度预算任务模板，包含收入记录、支出分类、储蓄目标、复盘检查。输出用 ```tasks 代码块格式。' },

  // ━━ 报告生成 ━━
  { id: 'report_weekly', categoryId: 'report', label: '周报生成', labelEn: 'Weekly Report', icon: 'FileText', order: 0, builtin: true,
    keywords: ['周报', 'zb', 'weekly'],
    prompt: '根据本周完成的任务生成工作周报，包含：完成情况、关键成果、遇到问题、下周计划。' },

  { id: 'report_monthly', categoryId: 'report', label: '月报生成', labelEn: 'Monthly Report', icon: 'FileChartLine', order: 1, builtin: true,
    keywords: ['月报', 'yb', 'monthly'],
    prompt: '生成本月工作总结报告，包含：月度目标达成、效率分析、改进建议、下月重点。' },

  { id: 'report_project', categoryId: 'report', label: '项目总结', labelEn: 'Project Summary', icon: 'FolderKanban', order: 2, builtin: true,
    keywords: ['项目总结', 'xmzj', 'project'],
    prompt: '根据项目相关任务生成项目总结报告，包含：里程碑完成、关键指标、经验教训。' },

  { id: 'report_retrospect', categoryId: 'report', label: '回顾总结', labelEn: 'Retrospective', icon: 'RotateCcw', order: 3, builtin: true,
    keywords: ['回顾', 'hg', 'retrospect'],
    prompt: '对当前任务列表进行回顾总结：做得好的、需要改进的、下一步行动。' },

  { id: 'report_team', categoryId: 'report', label: '团队同步报告', labelEn: 'Team Sync Report', icon: 'Users', order: 4, builtin: true,
    keywords: ['团队', 'td', 'team'],
    prompt: '生成团队同步报告模板，包含：我完成的工作、进行中的工作、需要帮助的事项。' },

  { id: 'report_deadline', categoryId: 'report', label: '截止日期报告', labelEn: 'Deadline Report', icon: 'CalendarClock', order: 5, builtin: true,
    keywords: ['截止日期', 'jzrq', 'deadline'],
    prompt: '生成即将到期的任务报告，按截止日期排序，标注风险项。' },

  // ━━ 智能助手 ━━
  { id: 'assistant_next', categoryId: 'assistant', label: '下一步行动', labelEn: 'Next Action', icon: 'ArrowRight', order: 0, builtin: true,
    keywords: ['下一步', 'xyb', 'next'],
    prompt: '根据当前任务状态和优先级，建议我现在应该做的最合适的下一步行动。' },

  { id: 'assistant_motivate', categoryId: 'assistant', label: '动力激励', labelEn: 'Motivation', icon: 'Heart', order: 1, builtin: true,
    keywords: ['动力', 'dl', 'motivate'],
    prompt: '看到我的任务列表，给我一些鼓励和动力建议，帮助我保持积极心态推进工作。' },

  { id: 'assistant_review', categoryId: 'assistant', label: '反思回顾', labelEn: 'Reflection', icon: 'RotateCcw', order: 2, builtin: true,
    keywords: ['反思', 'fs', 'review'],
    prompt: '帮我回顾今天的任务完成情况，分析效率高低的原因，提出明天改进的建议。' },

  { id: 'assistant_tips', categoryId: 'assistant', label: '效率技巧', labelEn: 'Efficiency Tips', icon: 'Lightbulb', order: 3, builtin: true,
    keywords: ['技巧', 'jq', 'tips'],
    prompt: '根据我当前的任务特点，给我一些提高效率的具体建议。' },

  { id: 'assistant_simplify', categoryId: 'assistant', label: '简化建议', labelEn: 'Simplify', icon: 'Minimize2', order: 4, builtin: true,
    keywords: ['简化', 'jh', 'simplify'],
    prompt: '分析我的任务列表，找出可以简化、委托或删除的任务，帮助我聚焦核心工作。' },

  { id: 'assistant_deadline_help', categoryId: 'assistant', label: '截止日期求助', labelEn: 'Deadline Help', icon: 'SOS', order: 5, builtin: true,
    keywords: ['紧急', 'jj', 'deadline'],
    prompt: '我有紧急截止日期，帮我分析当前任务，建议哪些可以先跳过或快速完成。' },

  { id: 'assistant_overwhelmed', categoryId: 'assistant', label: '任务太多怎么办', labelEn: 'Overwhelmed', icon: 'HelpCircle', order: 6, builtin: true,
    keywords: ['太多', 'td', 'overwhelmed'],
    prompt: '我的任务太多了，帮我分析哪些是真正重要的，建议如何简化或重新安排。' },

  { id: 'assistant_start', categoryId: 'assistant', label: '如何开始', labelEn: 'How to Start', icon: 'Play', order: 7, builtin: true,
    keywords: ['开始', 'ks', 'start'],
    prompt: '我不知道从哪里开始，帮我选择一个最容易上手的任务，给我开始的动力。' },
];

// ── 持久化 ──

export function getDefaultStore(): TaskListQuickActionStore {
  return {
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    items: DEFAULT_ITEMS.map((i) => ({ ...i })),
    version: CURRENT_VERSION,
    favorites: [],
    recentUsed: [],
  };
}

function mergeWithDefaults(stored: TaskListQuickActionStore): TaskListQuickActionStore {
  const cats = [...stored.categories];
  for (const dc of DEFAULT_CATEGORIES) {
    if (!cats.find((c) => c.id === dc.id)) cats.push({ ...dc });
  }
  const items = [...stored.items];
  for (const di of DEFAULT_ITEMS) {
    if (!items.find((i) => i.id === di.id)) items.push({ ...di });
  }
  return { ...stored, categories: cats, items, version: CURRENT_VERSION };
}

export function loadQuickActions(storage: {
  get: <T>(key: string) => T | null;
  set: (key: string, value: unknown) => void;
}): TaskListQuickActionStore {
  const saved = storage.get<TaskListQuickActionStore>(STORAGE_KEY);
  if (saved && saved.categories && saved.items) {
    return mergeWithDefaults(saved);
  }
  const store = getDefaultStore();
  storage.set(STORAGE_KEY, store);
  return store;
}

export function saveQuickActions(
  storage: { set: (key: string, value: unknown) => void },
  store: TaskListQuickActionStore,
): void {
  storage.set(STORAGE_KEY, store);
}

export function recordRecentUsed(
  store: TaskListQuickActionStore,
  itemId: string,
): TaskListQuickActionStore {
  const recent = (store.recentUsed || []).filter((id) => id !== itemId);
  recent.unshift(itemId);
  return { ...store, recentUsed: recent.slice(0, 20) };
}

export function toggleFavorite(
  store: TaskListQuickActionStore,
  itemId: string,
): TaskListQuickActionStore {
  const favorites = store.favorites || [];
  if (favorites.includes(itemId)) {
    return { ...store, favorites: favorites.filter((id) => id !== itemId) };
  }
  return { ...store, favorites: [...favorites, itemId] };
}
