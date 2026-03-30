/** 任务清单文档类型 — 与 host.storage 共用的键（侧栏与工具栏共用） */
export const TASKLIST_AI_SERVICE_STORAGE_KEY = '_tasklist_service_id';

/** 按文档记忆：待办区优先级筛选（全部 / 仅高优先） */
export function taskListPriorityFilterStorageKey(documentId: string): string {
  return `priorityFilter_${documentId}`;
}
