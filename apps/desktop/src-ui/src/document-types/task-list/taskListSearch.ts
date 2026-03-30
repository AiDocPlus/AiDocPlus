import type { TaskItem } from './types';

/** 从 host.storage 等外部值恢复优先级筛选，非法值回退为全部 */
export function normalizePriorityFilterFromStorage(value: unknown): 'all' | 'high' {
  return value === 'all' || value === 'high' ? value : 'all';
}

/** 与列表搜索框一致：去首尾空白并小写，用于 includes 匹配 */
export function normalizeTaskSearchQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

/** 按正文子串过滤（query 须已 normalize） */
export function filterTasksByContentSearch<T extends { content: string }>(
  tasks: T[],
  normalizedQuery: string,
): T[] {
  if (!normalizedQuery) return tasks;
  return tasks.filter((t) => t.content.toLowerCase().includes(normalizedQuery));
}

/**
 * 待办区展示：优先级筛选 + 搜索（与全选池逻辑一致）
 * @param taskSearchRaw 原始搜索框字符串
 */
export function filterPendingForDisplay(
  pendingTasks: TaskItem[],
  priorityFilter: 'all' | 'high',
  taskSearchRaw: string,
): TaskItem[] {
  const afterPriority =
    priorityFilter === 'high' ? pendingTasks.filter((t) => t.priority === 'high') : pendingTasks;
  return filterTasksByContentSearch(afterPriority, normalizeTaskSearchQuery(taskSearchRaw));
}

/** 已完成区：仅搜索 */
export function filterCompletedForDisplay(
  completedTasks: TaskItem[],
  taskSearchRaw: string,
): TaskItem[] {
  return filterTasksByContentSearch(completedTasks, normalizeTaskSearchQuery(taskSearchRaw));
}
