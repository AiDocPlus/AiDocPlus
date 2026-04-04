/**
 * 任务清单 AI 上下文引擎
 *
 * 分层构建上下文，对齐 calculatorContext.ts 的设计
 */
import type { TaskList, TaskListSettings } from './types';
import { PRIORITY_CONFIG, calculateStatistics, normalizeTaskPriority } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════════════

/** 任务清单阶段 */
export type TaskListPhase = 'empty' | 'planning' | 'executing' | 'reviewing';

/** 分层上下文 */
export interface TaskListContext {
  /** 核心层：待办任务 + 高优先任务（~800 token） */
  critical: string;
  /** 重要层：统计摘要 + 已完成概览（~500 token） */
  important: string;
  /** 补充层：列表名称、设置等（~300 token） */
  supplementary: string;
  /** 检测到的阶段 */
  phase: TaskListPhase;
}

// ═══════════════════════════════════════════════════════════════════════════
// 阶段检测
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 检测任务清单当前阶段
 *
 * - empty: 空白列表
 * - planning: 有待办任务，无已完成
 * - executing: 有待办和已完成
 * - reviewing: 全部已完成
 */
export function detectTaskListPhase(list: TaskList): TaskListPhase {
  const tasks = list.tasks || [];
  const pending = tasks.filter((t) => t.status === 'pending');
  const completed = tasks.filter((t) => t.status === 'completed');

  if (tasks.length === 0) return 'empty';
  if (pending.length === 0) return 'reviewing';
  if (completed.length > 0) return 'executing';
  return 'planning';
}

// ═══════════════════════════════════════════════════════════════════════════
// 分层上下文构建
// ═══════════════════════════════════════════════════════════════════════════

/** 优先级标签选择器 */
function priorityLabel(p: TaskPriority, isEn: boolean): string {
  return PRIORITY_CONFIG[p][isEn ? 'labelEn' : 'label'];
}

/** 构建核心层：待办任务 + 高优先任务 */
function buildCriticalLayer(list: TaskList, isEn: boolean, maxTasks: number = 15): string {
  const tasks = list.tasks || [];
  const pending = tasks.filter((t) => t.status === 'pending');
  const highPriority = pending.filter((t) => t.priority === 'high');

  const label = isEn ? `Pending tasks (${pending.length}):` : `待办任务（${pending.length} 个）：`;
  let content = `${label}\n`;

  // 优先显示高优先级任务，然后是非高优先级待办，取 maxTasks 条
  const highSlot = Math.min(highPriority.length, 5);
  const remaining = pending.filter((t) => t.priority !== 'high');
  const displayTasks = [
    ...highPriority.slice(0, highSlot),
    ...remaining.slice(0, maxTasks - highSlot),
  ];

  if (displayTasks.length === 0) {
    content += isEn ? '(No pending tasks)\n' : '（无待办任务）\n';
  } else {
    displayTasks.forEach((t) => {
      const pl = priorityLabel(normalizeTaskPriority(t.priority), isEn);
      const contentPreview = t.content.length > 100 ? t.content.slice(0, 100) + '...' : t.content;
      content += `- [${pl}] ${contentPreview.replace(/\n/g, ' ')}\n`;
    });
  }

  // 高优先级提示
  if (highPriority.length > 0) {
    content += isEn
      ? `\n⚠️ High priority tasks: ${highPriority.length}`
      : `\n⚠️ 高优先级任务：${highPriority.length} 个`;
  }

  return content;
}

/** 构建重要层：统计摘要 + 已完成概览 */
function buildImportantLayer(list: TaskList, isEn: boolean): string {
  const stats = calculateStatistics(list.tasks);

  let content = isEn
    ? `Statistics:
- Total: ${stats.total} | Pending: ${stats.pending} | Completed: ${stats.completed}
- High: ${stats.highPriority} | Medium: ${stats.mediumPriority} | Low: ${stats.lowPriority}
- Completion: ${(stats.completionRate * 100).toFixed(1)}%`
    : `任务统计：
- 总计: ${stats.total} | 待办: ${stats.pending} | 已完成: ${stats.completed}
- 高优先: ${stats.highPriority} | 中优先: ${stats.mediumPriority} | 低优先: ${stats.lowPriority}
- 完成率: ${(stats.completionRate * 100).toFixed(1)}%`;

  // 最近完成的任务
  const completed = list.tasks.filter((t) => t.status === 'completed');
  if (completed.length > 0) {
    const recent = completed
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
      .slice(0, 5);

    const recentLabel = isEn ? `Recently completed (${recent.length}):` : `最近完成（${recent.length} 个）：`;
    content += `\n\n${recentLabel}`;
    recent.forEach((t) => {
      const contentPreview =
        t.content.length > 50 ? `${t.content.slice(0, 50)}...` : t.content;
      content += `\n- ✓ ${contentPreview.replace(/\n/g, ' ')}`;
    });
  }

  return content;
}

/** 构建补充层：列表名称、设置等 */
function buildSupplementaryLayer(list: TaskList, settings: TaskListSettings, isEn: boolean): string {
  return isEn
    ? `List: ${list.name}
Default priority: ${PRIORITY_CONFIG[normalizeTaskPriority(settings.defaultPriority)].labelEn}
Show completed: ${settings.showCompleted ? 'Yes' : 'No'}`
    : `列表名称: ${list.name}
默认优先级: ${PRIORITY_CONFIG[normalizeTaskPriority(settings.defaultPriority)].label}
显示已完成: ${settings.showCompleted ? '是' : '否'}`;
}

/**
 * 构建完整分层上下文
 */
export function buildTaskListContext(
  list: TaskList,
  settings: TaskListSettings,
  isEn = false,
): TaskListContext {
  const phase = detectTaskListPhase(list);

  return {
    critical: buildCriticalLayer(list, isEn),
    important: buildImportantLayer(list, isEn),
    supplementary: buildSupplementaryLayer(list, settings, isEn),
    phase,
  };
}

/**
 * 将分层上下文合并为字符串（用于 AI 系统提示注入）
 */
export function formatContextForAI(ctx: TaskListContext, isEn = false): string {
  const header = isEn ? 'Current task list context:' : '当前任务清单上下文：';
  return `${header}

${ctx.critical}

${ctx.important}

${ctx.supplementary}
`;
}

/**
 * 智能上下文构建（根据阶段调整内容）
 *
 * - empty: 返回空状态提示
 * - planning: 完整上下文
 * - executing: 完整上下文
 * - reviewing: 强调已完成状态
 */
export function buildSmartContext(
  list: TaskList,
  settings: TaskListSettings,
  isEn = false,
): string {
  const ctx = buildTaskListContext(list, settings, isEn);

  switch (ctx.phase) {
    case 'empty':
      return isEn
        ? `Current task list context:

The list is empty, waiting for user to add tasks.
`
        : `当前任务清单上下文：

列表为空，等待用户添加任务。
`;
    case 'reviewing':
      // 全部完成，强调总结
      return isEn
        ? `Current task list context (all completed):

${ctx.important}

${ctx.supplementary}

All tasks completed! Ready for next phase planning.
`
        : `当前任务清单上下文（全部完成）：

${ctx.important}

${ctx.supplementary}

🎉 所有任务已完成！可以进入下一阶段的规划。
`;
    case 'planning':
    case 'executing':
    default:
      return formatContextForAI(ctx, isEn);
  }
}

/**
 * 获取当前任务摘要（用于快捷操作占位符）
 */
export function getCurrentTaskSummary(list: TaskList, isEn = false): string {
  const pending = list.tasks.filter((t) => t.status === 'pending');
  if (pending.length === 0) return isEn ? 'No pending tasks' : '暂无待办任务';

  const first = pending[0];
  return first.content.slice(0, 100) || (isEn ? 'Empty task' : '空任务');
}

/**
 * 获取待办任务摘要（用于快捷操作占位符，最多 10 条）
 */
export function getAllTasksSummary(list: TaskList, isEn = false): string {
  const pending = list.tasks.filter((t) => t.status === 'pending');
  if (pending.length === 0) return isEn ? 'No pending tasks' : '暂无待办任务';

  return pending
    .slice(0, 10)
    .map((t) => {
      const pl = priorityLabel(normalizeTaskPriority(t.priority), isEn);
      return `- [${pl}] ${t.content.slice(0, 50).replace(/\n/g, ' ')}`;
    })
    .join('\n');
}
