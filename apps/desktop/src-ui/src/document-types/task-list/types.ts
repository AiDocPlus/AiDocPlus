/**
 * 任务清单文档类型 - 数据模型
 */

// ============================================================
// 任务状态和优先级
// ============================================================

/** 任务状态 */
export type TaskStatus = 'pending' | 'completed';

/** 任务优先级 */
export type TaskPriority = 'high' | 'medium' | 'low';

/** 优先级配置 */
export const PRIORITY_CONFIG: Record<TaskPriority, {
  label: string;
  labelEn: string;
  color: string;
  dotColor: string;
  bgColor: string;
}> = {
  high: {
    label: '高',
    labelEn: 'High',
    color: 'text-red-600 dark:text-red-400',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
  },
  medium: {
    label: '中',
    labelEn: 'Medium',
    color: 'text-yellow-600 dark:text-yellow-400',
    dotColor: 'bg-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
  },
  low: {
    label: '低',
    labelEn: 'Low',
    color: 'text-green-600 dark:text-green-400',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
  },
};

// ============================================================
// 任务条目
// ============================================================

/** 任务条目 — 极简设计 */
export interface TaskItem {
  /** 唯一标识 */
  id: string;
  /** 任务内容（多行文本） */
  content: string;
  /** 优先级 */
  priority: TaskPriority;
  /** 状态 */
  status: TaskStatus;
  /** 完成时间 */
  completedAt?: string;
  /** 排序权重 */
  sortOrder: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

// ============================================================
// 任务列表
// ============================================================

/** 任务列表 — 类似 CalculatorSheet */
export interface TaskList {
  /** 唯一 ID */
  id: string;
  /** 列表名称 */
  name: string;
  /** 列表图标 */
  icon: string;
  /** 列表颜色 */
  color: string;
  /** 所有任务 */
  tasks: TaskItem[];
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

// ============================================================
// 文档设置
// ============================================================

/** 任务清单设置 */
export interface TaskListSettings {
  /** 默认优先级 */
  defaultPriority: TaskPriority;
  /** 是否显示已完成任务 */
  showCompleted: boolean;
  /** 已完成保留天数（自动清理） */
  completedRetentionDays: number;
  /** 排序方式 */
  sortBy: 'priority' | 'createdAt' | 'sortOrder';
  /** 升序/降序 */
  sortOrder: 'asc' | 'desc';
}

/** 默认设置 */
export const DEFAULT_TASKLIST_SETTINGS: TaskListSettings = {
  defaultPriority: 'medium',
  showCompleted: true,
  completedRetentionDays: 30,
  sortBy: 'sortOrder',
  sortOrder: 'asc',
};

// ============================================================
// 文档内容
// ============================================================

/** 任务清单文档内容 */
export interface TaskListDocumentContent {
  /** 格式版本号 */
  version: number;
  /** 所有任务列表 */
  lists: TaskList[];
  /** 当前激活的列表 ID */
  activeListId: string;
  /** 设置 */
  settings: TaskListSettings;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

// ============================================================
// 统计类型
// ============================================================

/** 任务统计 */
export interface TaskStatistics {
  total: number;
  pending: number;
  completed: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  completionRate: number;
}

// ============================================================
// 辅助函数
// ============================================================

/** 生成唯一 ID */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 生成列表 ID */
export function generateListId(): string {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 创建空任务 */
export function createEmptyTask(priority: TaskPriority = 'medium'): TaskItem {
  const now = new Date().toISOString();
  return {
    id: generateTaskId(),
    content: '',
    priority,
    status: 'pending',
    sortOrder: Date.now(),
    createdAt: now,
    updatedAt: now,
  };
}

/** 归一化优先级（损坏数据回退为 medium） */
export function normalizeTaskPriority(p: unknown): TaskPriority {
  if (p === 'high' || p === 'medium' || p === 'low') return p;
  return 'medium';
}

/** 归一化任务条目 */
export function normalizeTaskItem(raw: Partial<TaskItem> & { id?: string }): TaskItem {
  const now = new Date().toISOString();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateTaskId(),
    content: typeof raw.content === 'string' ? raw.content : '',
    priority: normalizeTaskPriority(raw.priority),
    status: raw.status === 'completed' ? 'completed' : 'pending',
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : undefined,
    sortOrder: typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? raw.sortOrder : Date.now(),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  };
}

/** 创建空列表 */
export function createEmptyList(name: string = '新列表', icon?: string): TaskList {
  const now = new Date().toISOString();
  return {
    id: generateListId(),
    name,
    icon: icon ?? 'ListTodo',
    color: '#3b82f6',
    tasks: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** 创建空文档内容 */
export function createEmptyTaskListContent(): TaskListDocumentContent {
  const now = new Date().toISOString();
  const defaultList = createEmptyList(i18nLanguage() === 'zh' ? '工作' : 'Work');
  return {
    version: 1,
    lists: [defaultList],
    activeListId: defaultList.id,
    settings: { ...DEFAULT_TASKLIST_SETTINGS },
    createdAt: now,
    updatedAt: now,
  };
}

/** 获取当前语言（使用浏览器语言设置作为 fallback） */
function i18nLanguage(): string {
  return (navigator.language || 'zh').slice(0, 2);
}

/** 按设置裁剪过期已完成任务 */
export function pruneCompletedTasksByRetention(doc: TaskListDocumentContent): TaskListDocumentContent {
  const days = doc.settings?.completedRetentionDays ?? 30;
  if (days <= 0) return doc;
  const cutoff = Date.now() - days * 86400000;
  const lists = (doc.lists || []).map((list) => ({
    ...list,
    tasks: (list.tasks || []).filter((t) => {
      if (t.status !== 'completed') return true;
      if (!t.completedAt) return true;
      return new Date(t.completedAt).getTime() >= cutoff;
    }),
  }));
  return { ...doc, lists, updatedAt: new Date().toISOString() };
}

/** 校验并修复文档结构 */
export function normalizeTaskListDocument(raw: TaskListDocumentContent): TaskListDocumentContent {
  const base = createEmptyTaskListContent();
  let lists = Array.isArray(raw.lists) ? raw.lists : [];
  lists = lists.map((list) => ({
    ...list,
    id: typeof list.id === 'string' && list.id ? list.id : generateListId(),
    name: typeof list.name === 'string' ? list.name : base.lists[0].name,
    icon: typeof list.icon === 'string' ? list.icon : 'ListTodo',
    color: typeof list.color === 'string' ? list.color : '#3b82f6',
    tasks: Array.isArray(list.tasks) ? list.tasks.map((t) => normalizeTaskItem(t)) : [],
    createdAt: typeof list.createdAt === 'string' ? list.createdAt : base.createdAt,
    updatedAt: typeof list.updatedAt === 'string' ? list.updatedAt : base.updatedAt,
  }));
  if (lists.length === 0) {
    const fallback = createEmptyList();
    lists = [fallback];
  }
  let activeListId = typeof raw.activeListId === 'string' ? raw.activeListId : lists[0].id;
  if (!lists.some((l) => l.id === activeListId)) {
    activeListId = lists[0].id;
  }
  const settings: TaskListSettings = {
    ...DEFAULT_TASKLIST_SETTINGS,
    ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}),
    defaultPriority: normalizeTaskPriority((raw.settings as TaskListSettings | undefined)?.defaultPriority),
    sortBy: ['priority', 'createdAt', 'sortOrder'].includes((raw.settings as TaskListSettings)?.sortBy)
      ? (raw.settings as TaskListSettings).sortBy
      : DEFAULT_TASKLIST_SETTINGS.sortBy,
    sortOrder: (raw.settings as TaskListSettings)?.sortOrder === 'desc' ? 'desc' : 'asc',
    showCompleted: typeof (raw.settings as TaskListSettings)?.showCompleted === 'boolean'
      ? (raw.settings as TaskListSettings).showCompleted
      : DEFAULT_TASKLIST_SETTINGS.showCompleted,
    completedRetentionDays: typeof (raw.settings as TaskListSettings)?.completedRetentionDays === 'number'
      ? Math.max(0, (raw.settings as TaskListSettings).completedRetentionDays)
      : DEFAULT_TASKLIST_SETTINGS.completedRetentionDays,
  };
  const merged: TaskListDocumentContent = {
    ...base,
    ...raw,
    version: 1,
    lists,
    activeListId,
    settings,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
  };
  return pruneCompletedTasksByRetention(merged);
}

/** 解析文档内容 */
export function parseTaskListContent(content: string): TaskListDocumentContent {
  try {
    const parsed = JSON.parse(content) as TaskListDocumentContent;
    return normalizeTaskListDocument({
      ...createEmptyTaskListContent(),
      ...parsed,
      version: 1,
    });
  } catch {
    return createEmptyTaskListContent();
  }
}

/** 获取激活列表 */
export function getActiveList(doc: TaskListDocumentContent): TaskList | undefined {
  return doc.lists.find((list) => list.id === doc.activeListId);
}

/** 更新列表 */
export function updateList(
  doc: TaskListDocumentContent,
  listId: string,
  updates: Partial<TaskList>,
): TaskListDocumentContent {
  const now = new Date().toISOString();
  return {
    ...doc,
    lists: doc.lists.map((list) =>
      list.id === listId ? { ...list, ...updates, updatedAt: now } : list,
    ),
    updatedAt: now,
  };
}

/** 添加列表 */
export function addList(doc: TaskListDocumentContent, list: TaskList): TaskListDocumentContent {
  const now = new Date().toISOString();
  return {
    ...doc,
    lists: [...doc.lists, list],
    activeListId: list.id,
    updatedAt: now,
  };
}

/** 删除列表 */
export function deleteList(doc: TaskListDocumentContent, listId: string): TaskListDocumentContent {
  const now = new Date().toISOString();
  const newLists = doc.lists.filter((list) => list.id !== listId);
  // 如果删除的是当前激活的列表，切换到第一个
  let newActiveListId = doc.activeListId;
  if (doc.activeListId === listId) {
    newActiveListId = newLists[0]?.id || '';
  }
  // 确保至少有一个列表
  if (newLists.length === 0) {
    const defaultList = createEmptyList();
    return {
      ...doc,
      lists: [defaultList],
      activeListId: defaultList.id,
      updatedAt: now,
    };
  }
  return {
    ...doc,
    lists: newLists,
    activeListId: newActiveListId,
    updatedAt: now,
  };
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * 将待办排序后置于已完成之前（保持已完成相对顺序）
 */
export function sortTasksForDisplay(
  tasks: TaskItem[],
  sortBy: TaskListSettings['sortBy'],
  sortOrder: 'asc' | 'desc',
): TaskItem[] {
  const pending = tasks.filter((t) => t.status === 'pending');
  const completed = tasks.filter((t) => t.status === 'completed');
  const dir = sortOrder === 'asc' ? 1 : -1;
  const sorted = [...pending];
  if (sortBy === 'priority') {
    sorted.sort((a, b) => {
      const pa = normalizeTaskPriority(a.priority);
      const pb = normalizeTaskPriority(b.priority);
      return dir * (PRIORITY_RANK[pa] - PRIORITY_RANK[pb]);
    });
  } else if (sortBy === 'createdAt') {
    sorted.sort(
      (a, b) => dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    );
  } else {
    sorted.sort((a, b) => dir * (a.sortOrder - b.sortOrder));
  }
  return [...sorted, ...completed];
}

/** 计算统计 */
export function calculateStatistics(tasks: TaskItem[]): TaskStatistics {
  const total = tasks.length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const highPriority = tasks.filter((t) => t.priority === 'high' && t.status === 'pending').length;
  const mediumPriority = tasks.filter((t) => t.priority === 'medium' && t.status === 'pending').length;
  const lowPriority = tasks.filter((t) => t.priority === 'low' && t.status === 'pending').length;

  return {
    total,
    pending,
    completed,
    highPriority,
    mediumPriority,
    lowPriority,
    completionRate: total > 0 ? completed / total : 0,
  };
}

/** 提取纯文本（用于搜索和 AI 上下文） */
export function extractTaskListPlainText(doc: TaskListDocumentContent): string {
  const list = getActiveList(doc);
  if (!list) return '';

  const pending = list.tasks.filter((t) => t.status === 'pending');
  const completed = list.tasks.filter((t) => t.status === 'completed');

  const lines: string[] = [];

  lines.push(`列表: ${list.name}`);
  lines.push('');

  if (pending.length > 0) {
    lines.push('待办任务:');
    pending.forEach((t) => {
      const pr = normalizeTaskPriority(t.priority);
      const priorityLabel = PRIORITY_CONFIG[pr].label;
      lines.push(`- [${priorityLabel}] ${t.content}`);
    });
  }

  if (completed.length > 0) {
    lines.push('');
    lines.push('已完成任务:');
    completed.slice(-10).forEach((t) => {
      lines.push(`- ✓ ${t.content}`);
    });
  }

  const stats = calculateStatistics(list.tasks);
  lines.push('');
  lines.push(`统计: 待办 ${stats.pending}, 已完成 ${stats.completed}, 高优先 ${stats.highPriority}`);

  return lines.join('\n');
}
