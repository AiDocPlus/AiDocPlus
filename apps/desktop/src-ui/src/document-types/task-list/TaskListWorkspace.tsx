/**
 * TaskListWorkspace — 任务清单主工作区
 * layoutMode: 'full'，完全自定义布局
 * 对齐 CalculatorWorkspace 的布局结构
 */
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from 'react-i18next';
import {
  CheckSquare,
  Undo2,
  Redo2,
  ArrowUpDown,
  Filter,
  FileCode2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  ChevronDown,
  Trash2,
  Copy,
  Save,
  SaveAll,
  History,
  Settings,
  HelpCircle,
  Download,
  Upload,
  FilePlus,
  CheckCircle2,
  RotateCcw,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {
  parseTaskListContent,
  createEmptyTask,
  createEmptyList,
  getActiveList,
  updateList,
  addList,
  deleteList,
  calculateStatistics,
  sortTasksForDisplay,
  normalizeTaskPriority,
  pruneCompletedTasksByRetention,
  type TaskListDocumentContent,
  type TaskList,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
  type TaskListSettings,
  generateListId,
  generateTaskId,
} from './types';
import { TOOLBAR_ICON, STATUS_BAR_CLASS } from '../_shared/styles';
import { TaskRowWithContextMenu } from './TaskListTaskRow';
import { ListTabs, TaskListWorkspaceErrorBoundary } from './TaskListTabs';
import { TaskListExportDialog } from './TaskListExportDialog';
import { TaskListSettingsDialog } from './TaskListSettingsDialog';
import { TaskListHelpDialog } from './TaskListHelpDialog';
import { TaskListBulkDeleteDialog } from './TaskListBulkDeleteDialog';
import { taskListPriorityFilterStorageKey } from './taskListStorageKeys';
import {
  filterCompletedForDisplay,
  filterPendingForDisplay,
  normalizePriorityFilterFromStorage,
} from './taskListSearch';

// 懒加载 AI 侧栏
const TaskListAISidebar = lazy(() => import('./TaskListAISidebar'));
const TaskListTemplateDialog = lazy(() => import('./TaskListTemplateDialog'));
const TaskListImportDialog = lazy(() =>
  import('./TaskListImportDialog').then((m) => ({ default: m.TaskListImportDialog })),
);
const VersionHistoryPanel = lazy(() =>
  import('@/components/version/VersionHistoryPanel').then((m) => ({ default: m.VersionHistoryPanel })),
);

/** 主工具栏图标按钮 */
const TB_ICON = 'h-7 w-7 shrink-0 p-0';

// ============================================================
// 历史记录（撤销/重做）
// ============================================================

interface HistoryState {
  doc: TaskListDocumentContent;
}

const MAX_HISTORY = 50;

// ============================================================
// 主组件
// ============================================================

function TaskListWorkspaceMain({ document: doc, tabId, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? '⌘' : 'Ctrl+';

  // 解析文档内容
  const [taskDoc, setTaskDoc] = useState<TaskListDocumentContent>(() =>
    parseTaskListContent(doc.content || ''),
  );

  /** 待办区优先级筛选：全部 / 仅高优先（按文档持久化到 host.storage） */
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high'>('all');
  /** 当前列表任务正文搜索（仅过滤展示，不改数据） */
  const [taskSearch, setTaskSearch] = useState('');
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const taskSearchInputRef = useRef<HTMLInputElement>(null);

  // 撤销/重做历史
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const pastRef = useRef(past);
  pastRef.current = past;
  const futureRef = useRef(future);
  futureRef.current = future;

  // AI 侧栏状态
  const [aiSidebarOpen, setAiSidebarOpen] = useState(true);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(320);

  // 模板对话框状态
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 多选状态
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Refs
  const taskDocRef = useRef(taskDoc);
  taskDocRef.current = taskDoc;
  const hostRef = useRef(host);
  hostRef.current = host;

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  // 文档切换时重新加载（对齐 CalculatorWorkspace）
  useEffect(() => {
    const h = hostRef.current;
    const d = h.doc.getDocument();
    setTaskDoc(parseTaskListContent(d.content || ''));
    setPast([]);
    setFuture([]);
    const pf = h.storage.get(taskListPriorityFilterStorageKey(doc.id));
    setPriorityFilter(normalizePriorityFilterFromStorage(pf));
    setTaskSearch('');
    setSelectedTaskIds(new Set());
    setImportDialogOpen(false);
  }, [doc.id]);

  const setPriorityFilterPersist = useCallback(
    (v: 'all' | 'high') => {
      setPriorityFilter(v);
      host.storage.set(taskListPriorityFilterStorageKey(doc.id), v);
    },
    [doc.id, host],
  );

  // DnD 传感器（轻移即可点选；需移动约 8px 才视为拖拽，减少误触）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 获取当前激活的列表
  const activeList = useMemo(() => getActiveList(taskDoc), [taskDoc]);
  const stats = useMemo(
    () => (activeList ? calculateStatistics(activeList.tasks) : null),
    [activeList],
  );

  // 任务删除 / 外部同步后，剔除已不存在的 id，避免批量操作误用陈旧选择
  useEffect(() => {
    if (!activeList) return;
    const valid = new Set(activeList.tasks.map((tk) => tk.id));
    setSelectedTaskIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [activeList]);

  const selectedCountRef = useRef(0);
  selectedCountRef.current = selectedTaskIds.size;
  const selectedTaskIdsRef = useRef(selectedTaskIds);
  selectedTaskIdsRef.current = selectedTaskIds;
  const pushHistoryRef = useRef<() => void>(() => {});
  const saveDocRef = useRef<(next: TaskListDocumentContent) => void>(() => {});

  // Escape：清除多选（不在输入框/对话框内抢占）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (selectedCountRef.current === 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[role="dialog"]')) return;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.getAttribute('contenteditable') === 'true') return;
      if (!target?.closest?.('[data-tasklist-workspace="true"]')) return;
      e.preventDefault();
      setSelectedTaskIds(new Set());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ⌘/Ctrl + F：聚焦任务搜索（工作区内且不在其它输入中编辑时）
  useEffect(() => {
    const onFind = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'f') return;
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.('[data-tasklist-workspace="true"]')) return;
      if (t.tagName === 'TEXTAREA') return;
      if (t.tagName === 'INPUT' && t !== taskSearchInputRef.current) return;
      e.preventDefault();
      taskSearchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onFind);
    return () => window.removeEventListener('keydown', onFind);
  }, []);

  // 保存文档（内存 + 脏标记 + 防抖落盘）
  const saveDoc = useCallback(
    (next: TaskListDocumentContent) => {
      const updated = { ...next, updatedAt: new Date().toISOString() };
      setTaskDoc(updated);
      taskDocRef.current = updated;

      host.doc.updateInMemory({
        content: JSON.stringify(updated, null, 2),
      });
      host.doc.markDirty();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void host.doc.save();
      }, 3000);
    },
    [host],
  );
  saveDocRef.current = saveDoc;

  const flushPendingAutoSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const handleExplicitSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      flushPendingAutoSaveTimer();
      host.doc.updateInMemory({ content: JSON.stringify(taskDocRef.current, null, 2) });
      await host.doc.save();
    } finally {
      setIsSaving(false);
    }
  }, [host.doc, isSaving, flushPendingAutoSaveTimer]);

  const handleSaveAll = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      flushPendingAutoSaveTimer();
      host.doc.updateInMemory({ content: JSON.stringify(taskDocRef.current, null, 2) });
      await host.doc.save();
      await host.doc.saveAllDirtyTabs();
    } finally {
      setIsSaving(false);
    }
  }, [host.doc, isSaving, flushPendingAutoSaveTimer]);

  const handleCreateVersionQuick = useCallback(async () => {
    try {
      flushPendingAutoSaveTimer();
      host.doc.updateInMemory({ content: JSON.stringify(taskDocRef.current, null, 2) });
      await host.doc.createVersion(
        t('version.manualCheckpoint', { defaultValue: '手动创建版本' }),
      );
    } catch (err) {
      console.error('[TaskListWorkspace] createVersion failed:', err);
    }
  }, [host.doc, flushPendingAutoSaveTimer, t]);

  const handleExplicitSaveRef = useRef(handleExplicitSave);
  const handleSaveAllRef = useRef(handleSaveAll);
  handleExplicitSaveRef.current = handleExplicitSave;
  handleSaveAllRef.current = handleSaveAll;

  useEffect(() => {
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.('[data-tasklist-workspace="true"]')) return;
      e.preventDefault();
      if (e.shiftKey) {
        void handleSaveAllRef.current();
      } else {
        void handleExplicitSaveRef.current();
      }
    };
    window.addEventListener('keydown', onDocKeyDown);
    return () => window.removeEventListener('keydown', onDocKeyDown);
  }, []);

  // 优先级筛选和搜索的 ref（供 Cmd+A 快捷键闭包使用）
  const priorityFilterRef = useRef(priorityFilter);
  priorityFilterRef.current = priorityFilter;
  const taskSearchRef = useRef(taskSearch);
  taskSearchRef.current = taskSearch;
  const pushHistory = useCallback(() => {
    setPast((prev) => {
      const next = [...prev, { doc: taskDocRef.current }];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setFuture([]);
  }, []);
  pushHistoryRef.current = pushHistory;

  const handleSettingsApply = useCallback(
    (settings: TaskListSettings) => {
      pushHistory();
      const doc = taskDocRef.current;
      // 立即按新保留天数清理过期已完成任务，而非等到下次加载
      saveDoc(pruneCompletedTasksByRetention({ ...doc, settings }));
    },
    [pushHistory, saveDoc],
  );

  const handleDuplicateList = useCallback(
    (listId: string) => {
      const doc = taskDocRef.current;
      const list = doc.lists.find((l) => l.id === listId);
      if (!list) return;
      pushHistory();
      const copySuffix = t('taskList.copySuffix', { defaultValue: '副本' });
      const newList: TaskList = {
        ...list,
        id: generateListId(),
        name: `${list.name} (${copySuffix})`,
        tasks: list.tasks.map((tk) => ({
          ...tk,
          id: generateTaskId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveDoc(addList(doc, newList));
    },
    [pushHistory, saveDoc, t],
  );

  // 撤销
  const handleUndo = useCallback(() => {
    const currentPast = pastRef.current;
    if (currentPast.length === 0) return;
    const prev = currentPast[currentPast.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [{ doc: taskDocRef.current }, ...f]);
    setTaskSearch('');
    saveDoc(prev.doc);
  }, [saveDoc]);

  // 重做
  const handleRedo = useCallback(() => {
    const currentFuture = futureRef.current;
    if (currentFuture.length === 0) return;
    const next = currentFuture[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, { doc: taskDocRef.current }]);
    setTaskSearch('');
    saveDoc(next.doc);
  }, [saveDoc]);

  // 切换列表
  const handleSelectList = useCallback(
    (listId: string) => {
      setSelectedTaskIds(new Set());
      const next = { ...taskDocRef.current, activeListId: listId, updatedAt: new Date().toISOString() };
      saveDoc(next);
    },
    [saveDoc],
  );

  // 新建列表
  const handleAddList = useCallback(() => {
    const newList = createEmptyList(t('taskList.newList', { defaultValue: '新列表' }));
    pushHistory();
    saveDoc(addList(taskDocRef.current, newList));
  }, [pushHistory, saveDoc, t]);

  // 重命名列表（必须用 taskDocRef，避免闭包 taskDoc 滞后导致覆盖其它编辑）
  const handleRenameList = useCallback(
    (listId: string, name: string) => {
      pushHistory();
      saveDoc(updateList(taskDocRef.current, listId, { name }));
    },
    [pushHistory, saveDoc],
  );

  // 删除列表
  const handleDeleteList = useCallback(
    (listId: string) => {
      pushHistory();
      saveDoc(deleteList(taskDocRef.current, listId));
      setSelectedTaskIds(new Set());
    },
    [pushHistory, saveDoc],
  );

  // 添加任务
  const handleAddTask = useCallback(() => {
    const doc = taskDocRef.current;
    const list = getActiveList(doc);
    if (!list) return;
    const newTask = createEmptyTask(doc.settings.defaultPriority);
    pushHistory();
    saveDoc(
      updateList(doc, list.id, {
        tasks: [...list.tasks, newTask],
      }),
    );
  }, [pushHistory, saveDoc]);

  const handleAddTaskRef = useRef(handleAddTask);
  handleAddTaskRef.current = handleAddTask;

  // 更新任务（withHistory：纳入撤销栈，用于正文/优先级编辑；始终基于 taskDocRef 避免闭包滞后）
  const handleUpdateTask = useCallback(
    (taskId: string, updates: Partial<TaskItem>, withHistory = false) => {
      const doc = taskDocRef.current;
      const list = getActiveList(doc);
      if (!list) return;
      if (withHistory) pushHistory();
      const updatedTasks = list.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
      );
      saveDoc(updateList(doc, list.id, { tasks: updatedTasks }));
    },
    [saveDoc, pushHistory],
  );

  // 切换任务状态
  const handleToggleTask = useCallback(
    (taskId: string) => {
      const doc = taskDocRef.current;
      const list = getActiveList(doc);
      if (!list) return;
      const task = list.tasks.find((t) => t.id === taskId);
      if (!task) return;

      pushHistory();
      const newStatus: TaskStatus = task.status === 'pending' ? 'completed' : 'pending';
      handleUpdateTask(taskId, {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
      });
    },
    [pushHistory, handleUpdateTask],
  );

  // 清空当前列表所有任务
  const handleClearList = useCallback(() => {
    const doc = taskDocRef.current;
    const list = getActiveList(doc);
    if (!list || list.tasks.length === 0) return;
    pushHistory();
    saveDoc(updateList(doc, list.id, { tasks: [] }));
    setSelectedTaskIds(new Set());
  }, [pushHistory, saveDoc]);

  // 删除任务
  const handleDeleteTask = useCallback(
    (taskId: string) => {
      const doc = taskDocRef.current;
      const list = getActiveList(doc);
      if (!list) return;
      pushHistory();
      saveDoc(
        updateList(doc, list.id, {
          tasks: list.tasks.filter((t) => t.id !== taskId),
        }),
      );
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    },
    [pushHistory, saveDoc],
  );

  // 复制单个任务
  const handleCopyTask = useCallback(
    async (taskId: string) => {
      const task = getActiveList(taskDocRef.current)?.tasks.find((t) => t.id === taskId);
      if (!task) return;
      try {
        await host.ui.copyToClipboard(task.content);
      } catch {
        host.ui.showNotification(
          t('taskList.copyFailed', { defaultValue: '复制失败，请检查剪贴板权限。' }),
          'error',
        );
      }
    },
    [host.ui, t],
  );

  // 复制任务（在原任务后插入副本）
  const handleDuplicateTask = useCallback(
    (taskId: string) => {
      const doc = taskDocRef.current;
      const list = getActiveList(doc);
      if (!list) return;
      const task = list.tasks.find((tk) => tk.id === taskId);
      if (!task) return;
      pushHistory();
      const copySuffix = t('taskList.copySuffix', { defaultValue: '副本' });
      const dup: TaskItem = {
        ...task,
        id: generateTaskId(),
        content: `${task.content} (${copySuffix})`,
        status: 'pending',
        completedAt: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const idx = list.tasks.findIndex((tk) => tk.id === taskId);
      const updatedTasks = [...list.tasks];
      updatedTasks.splice(idx + 1, 0, dup);
      saveDoc(updateList(doc, list.id, { tasks: updatedTasks }));
    },
    [pushHistory, saveDoc, t],
  );

  // 在指定任务位置插入新任务（index 处插入，上方 index=原位，下方 index+1）
  const handleAddTaskAtIndex = useCallback(
    (taskId: string, offset: number) => {
      const doc = taskDocRef.current;
      const list = getActiveList(doc);
      if (!list) return;
      pushHistory();
      const idx = list.tasks.findIndex((tk) => tk.id === taskId);
      const newTask = createEmptyTask(doc.settings.defaultPriority);
      const updatedTasks = [...list.tasks];
      updatedTasks.splice(idx + offset, 0, newTask);
      saveDoc(updateList(doc, list.id, { tasks: updatedTasks }));
    },
    [pushHistory, saveDoc],
  );

  // 切换任务选择
  const handleToggleSelect = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  // 合并复制选中的任务（顺序与列表中任务顺序一致）
  const handleCopySelected = useCallback(async () => {
    const list = getActiveList(taskDocRef.current);
    if (!list || selectedTaskIds.size === 0) return;
    const selectedTasks = list.tasks.filter((t) => selectedTaskIds.has(t.id));
    const content = selectedTasks.map((tk) => tk.content).join('\n');
    try {
      await host.ui.copyToClipboard(content);
    } catch {
      host.ui.showNotification(
        t('taskList.copyFailed', { defaultValue: '复制失败，请检查剪贴板权限。' }),
        'error',
      );
    }
  }, [host.ui, selectedTaskIds, t]);

  /** 当前列表中、已勾选的待办数量（用于批量操作条） */
  const selectedPendingCount = useMemo(() => {
    if (!activeList) return 0;
    return activeList.tasks.filter((t) => t.status === 'pending' && selectedTaskIds.has(t.id)).length;
  }, [activeList, selectedTaskIds]);

  /** 已勾选的已完成任务数量 */
  const selectedCompletedCount = useMemo(() => {
    if (!activeList) return 0;
    return activeList.tasks.filter((t) => t.status === 'completed' && selectedTaskIds.has(t.id)).length;
  }, [activeList, selectedTaskIds]);

  const executeBulkDelete = useCallback(() => {
    if (selectedTaskIds.size === 0) return;
    const doc = taskDocRef.current;
    const list = getActiveList(doc);
    if (!list) return;
    pushHistory();
    saveDoc(
      updateList(doc, list.id, {
        tasks: list.tasks.filter((t) => !selectedTaskIds.has(t.id)),
      }),
    );
    setSelectedTaskIds(new Set());
  }, [selectedTaskIds, pushHistory, saveDoc]);

  const handleRequestBulkDelete = useCallback(() => {
    if (selectedTaskIds.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedTaskIds]);

  const handleMarkSelectedComplete = useCallback(() => {
    if (selectedTaskIds.size === 0) return;
    const doc = taskDocRef.current;
    const list = getActiveList(doc);
    if (!list) return;
    pushHistory();
    const now = new Date().toISOString();
    const updatedTasks = list.tasks.map((t) => {
      if (!selectedTaskIds.has(t.id) || t.status !== 'pending') return t;
      return {
        ...t,
        status: 'completed' as const,
        completedAt: now,
        updatedAt: now,
      };
    });
    saveDoc(updateList(doc, list.id, { tasks: updatedTasks }));
    setSelectedTaskIds(new Set());
  }, [selectedTaskIds, pushHistory, saveDoc]);

  /** 批量将选中已完成恢复为待办 */
  const handleMarkSelectedPending = useCallback(() => {
    if (selectedTaskIds.size === 0) return;
    const doc = taskDocRef.current;
    const list = getActiveList(doc);
    if (!list) return;
    pushHistory();
    const now = new Date().toISOString();
    const updatedTasks = list.tasks.map((t) => {
      if (!selectedTaskIds.has(t.id) || t.status !== 'completed') return t;
      return {
        ...t,
        status: 'pending' as const,
        completedAt: undefined,
        updatedAt: now,
      };
    });
    saveDoc(updateList(doc, list.id, { tasks: updatedTasks }));
    setSelectedTaskIds(new Set());
  }, [selectedTaskIds, pushHistory, saveDoc]);

  const handleSetSelectedPriority = useCallback(
    (priority: TaskPriority) => {
      if (selectedTaskIds.size === 0) return;
      const doc = taskDocRef.current;
      const list = getActiveList(doc);
      if (!list) return;
      pushHistory();
      const now = new Date().toISOString();
      const p = normalizeTaskPriority(priority);
      const updatedTasks = list.tasks.map((t) => {
        if (!selectedTaskIds.has(t.id) || t.status !== 'pending') return t;
        return { ...t, priority: p, updatedAt: now };
      });
      saveDoc(updateList(doc, list.id, { tasks: updatedTasks }));
    },
    [selectedTaskIds, pushHistory, saveDoc],
  );

  const handleSetSelectedPriorityRef = useRef(handleSetSelectedPriority);
  handleSetSelectedPriorityRef.current = handleSetSelectedPriority;

  // ---- 全局快捷键：Enter 新建任务 / Cmd+A 全选 / Space 切换 / 1/2/3 优先级 ----
  useEffect(() => {
    const onWorkspaceKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.('[data-tasklist-workspace="true"]')) return;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (el.closest?.('[role="dialog"]')) return;
      if (el.getAttribute('contenteditable') === 'true') return;

      // Enter → 新建任务
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTaskRef.current();
        return;
      }

      // Cmd/Ctrl + A → 全选可见任务
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        const doc = taskDocRef.current;
        const list = getActiveList(doc);
        if (!list) return;
        const pending = list.tasks.filter((tk) => tk.status === 'pending');
        const completed = list.tasks.filter((tk) => tk.status === 'completed');
        const pool = [
          ...filterPendingForDisplay(pending, priorityFilterRef.current, taskSearchRef.current),
          ...filterCompletedForDisplay(completed, taskSearchRef.current),
        ];
        setSelectedTaskIds((prev) => {
          const ids = pool.map((tk) => tk.id);
          return prev.size === ids.length && ids.every((id) => prev.has(id)) ? new Set() : new Set(ids);
        });
        return;
      }

      // Space → 切换已选任务完成状态
      if (e.key === ' ' && selectedCountRef.current > 0) {
        e.preventDefault();
        const doc = taskDocRef.current;
        const list = getActiveList(doc);
        if (!list) return;
        pushHistoryRef.current();
        const now = new Date().toISOString();
        const ids = selectedTaskIdsRef.current;
        const updatedTasks = list.tasks.map((tk) => {
          if (!ids.has(tk.id)) return tk;
          if (tk.status === 'pending') {
            return { ...tk, status: 'completed' as const, completedAt: now, updatedAt: now };
          }
          return { ...tk, status: 'pending' as const, completedAt: undefined, updatedAt: now };
        });
        saveDocRef.current(updateList(doc, list.id, { tasks: updatedTasks }));
        setSelectedTaskIds(new Set());
        return;
      }

      // 1/2/3 → 设置已选任务优先级
      if ((e.key === '1' || e.key === '2' || e.key === '3') && selectedCountRef.current > 0) {
        e.preventDefault();
        const priorityMap: Record<string, TaskPriority> = { '1': 'high', '2': 'medium', '3': 'low' };
        const priority = priorityMap[e.key];
        if (priority) handleSetSelectedPriorityRef.current(priority);
        return;
      }
    };
    window.addEventListener('keydown', onWorkspaceKey);
    return () => window.removeEventListener('keydown', onWorkspaceKey);
  }, []);

  // 全选/取消全选待办（与当前筛选 + 搜索一致；保留已完成区的已选）
  const handleSelectAll = useCallback(() => {
    const list = getActiveList(taskDocRef.current);
    if (!list) return;
    const pool = filterPendingForDisplay(
      list.tasks.filter((t) => t.status === 'pending'),
      priorityFilter,
      taskSearch,
    );
    const poolIds = pool.map((t) => t.id);
    const allSelected = poolIds.length > 0 && poolIds.every((id) => selectedTaskIds.has(id));
    if (allSelected) {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        poolIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        poolIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [selectedTaskIds, priorityFilter, taskSearch]);

  // 全选/取消全选已完成（与搜索一致；保留待办区的已选）
  const handleSelectAllCompleted = useCallback(() => {
    const list = getActiveList(taskDocRef.current);
    if (!list) return;
    const pool = filterCompletedForDisplay(
      list.tasks.filter((t) => t.status === 'completed'),
      taskSearch,
    );
    if (pool.length === 0) return;
    const poolIds = pool.map((t) => t.id);
    const allSelected = poolIds.every((id) => selectedTaskIds.has(id));
    if (allSelected) {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        poolIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        poolIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [selectedTaskIds, taskSearch]);

  const applySortMenu = useCallback(
    (sortBy: TaskListSettings['sortBy']) => {
      const doc = taskDocRef.current;
      const list = getActiveList(doc);
      if (!list) return;
      pushHistory();
      const nextSettings: TaskListSettings = { ...doc.settings, sortBy };
      const sorted = sortTasksForDisplay(list.tasks, sortBy, nextSettings.sortOrder);
      const tasksWithOrder = sorted.map((t, i) => ({ ...t, sortOrder: i }));
      const withList = updateList(doc, list.id, { tasks: tasksWithOrder });
      saveDoc({ ...withList, settings: nextSettings });
    },
    [pushHistory, saveDoc],
  );

  const handleToggleShowCompletedSetting = useCallback(() => {
    pushHistory();
    const doc = taskDocRef.current;
    saveDoc({
      ...doc,
      settings: { ...doc.settings, showCompleted: !doc.settings.showCompleted },
    });
  }, [pushHistory, saveDoc]);

  // DnD 处理
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;
    // 搜索过滤激活时不执行拖拽排序，避免位置错乱（用户看到的是子集）
    if (taskSearchRef.current.trim() || priorityFilterRef.current !== 'all') return;
    const doc = taskDocRef.current;
    const list = getActiveList(doc);
    if (!list) return;

    // 仅在 pending 子数组中做拖拽排序（completed 不在 SortableContext 中）
    const pending = list.tasks.filter((t) => t.status === 'pending');
    const completed = list.tasks.filter((t) => t.status === 'completed');
    const oldIndex = pending.findIndex((t) => t.id === active.id);
    const newIndex = pending.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      pushHistoryRef.current();
      const reordered = arrayMove(pending, oldIndex, newIndex).map((t, i) => ({
        ...t,
        sortOrder: i,
      }));
      saveDocRef.current(updateList(doc, list.id, { tasks: [...reordered, ...completed] }));
    }
  }, []);

  // 待办任务
  const pendingTasks = useMemo(
    () => activeList?.tasks.filter((t) => t.status === 'pending') ?? [],
    [activeList],
  );

  /** 待办 + 优先级筛选（不含搜索，用于搜索时显示总数分母） */
  const pendingFiltered = useMemo(
    () => filterPendingForDisplay(pendingTasks, priorityFilter, ''),
    [pendingTasks, priorityFilter],
  );

  /** 待办 + 搜索 + 优先级筛选（用于展示、拖拽与计数分子） */
  const pendingSearchFiltered = useMemo(
    () => filterPendingForDisplay(pendingTasks, priorityFilter, taskSearch),
    [pendingTasks, priorityFilter, taskSearch],
  );

  // 已完成任务
  const completedTasks = useMemo(
    () => activeList?.tasks.filter((t) => t.status === 'completed') ?? [],
    [activeList],
  );

  /** 已完成 + 搜索 */
  const completedSearchFiltered = useMemo(
    () => filterCompletedForDisplay(completedTasks, taskSearch),
    [completedTasks, taskSearch],
  );

  return (
    <>
    <div className="flex h-full w-full overflow-hidden bg-background" data-tasklist-workspace="true">
      {/* 中栏：工具栏 + 列表标签 + 主编辑 + 状态栏（布局对齐 CalculatorWorkspace） */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b flex-shrink-0 bg-card">
        <CheckSquare className={cn(TOOLBAR_ICON, 'text-primary shrink-0')} />
        <span className="text-sm font-medium truncate">
          {doc.title || t('docType.taskList', { defaultValue: '任务清单' })}
        </span>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={TB_ICON}
            disabled={isSaving}
            onClick={() => void handleExplicitSave()}
            title={`${t('taskList.saveDocument', { defaultValue: '保存' })} (${mod}S)`}
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={TB_ICON}
            disabled={isSaving}
            onClick={() => void handleSaveAll()}
            title={`${t('taskList.saveAllDocuments', { defaultValue: '全部保存' })} (${mod}⇧S)`}
          >
            <SaveAll className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={TB_ICON}
                title={t('taskList.versionMenu', { defaultValue: '版本' })}
              >
                <History className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => void handleCreateVersionQuick()}>
                <FilePlus className="h-4 w-4 mr-2" />
                {t('version.createVersion', { defaultValue: '创建历史版本' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVersionHistoryOpen(true)}>
                <History className="h-4 w-4 mr-2" />
                {t('version.manageVersions', { defaultValue: '历史版本管理' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className={TB_ICON}
            onClick={() => setImportDialogOpen(true)}
            title={t('taskList.importTitle', { defaultValue: '导入任务' })}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={TB_ICON}
            onClick={() => setShowExportDialog(true)}
            title={t('taskList.export', { defaultValue: '导出' })}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={TB_ICON}
            onClick={handleUndo}
            disabled={past.length === 0}
            title={t('common.undo', { defaultValue: '撤销' })}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={TB_ICON}
            onClick={handleRedo}
            disabled={future.length === 0}
            title={t('common.redo', { defaultValue: '重做' })}
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <ArrowUpDown className="h-3.5 w-3.5" />
                {t('taskList.sort', { defaultValue: '排序' })}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => applySortMenu('priority')}>
                {t('taskList.sortByPriority', { defaultValue: '按优先级' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applySortMenu('createdAt')}>
                {t('taskList.sortByCreated', { defaultValue: '按创建时间' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applySortMenu('sortOrder')}>
                {t('taskList.sortByManual', { defaultValue: '按手动顺序' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <Filter className="h-3.5 w-3.5" />
                {t('taskList.filter', { defaultValue: '筛选' })}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setPriorityFilterPersist('all')}>
                {t('taskList.filterAll', { defaultValue: '全部' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriorityFilterPersist('high')}>
                {t('taskList.filterHigh', { defaultValue: '高优先级' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleShowCompletedSetting}>
                {taskDoc.settings.showCompleted
                  ? t('taskList.hideCompleted', { defaultValue: '隐藏已完成' })
                  : t('taskList.showCompleted', { defaultValue: '显示已完成' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleClearList}
                disabled={!activeList || activeList.tasks.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('taskList.clearAllTasks', { defaultValue: '清空当前列表' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            title={t('taskList.templatesButton', { defaultValue: '模板' })}
            onClick={() => setTemplateDialogOpen(true)}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            {t('taskList.templatesButton', { defaultValue: '模板' })}
          </Button>
        </div>

        <div className="flex items-center gap-1.5 min-w-0 flex-1 max-w-[14rem] px-1 rounded-md border bg-muted/25">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          <Input
            ref={taskSearchInputRef}
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setTaskSearch('');
                e.currentTarget.blur();
              }
            }}
            className="h-7 text-xs border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 min-w-0"
            placeholder={t('taskList.searchPlaceholder', { defaultValue: '搜索任务…' })}
            aria-label={t('taskList.searchPlaceholder', { defaultValue: '搜索任务…' })}
            title={`${t('taskList.searchShortcutHint', { defaultValue: '快捷键' })} ${mod}F`}
          />
        </div>

        <div className="flex-1 min-w-0" />

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className={TB_ICON}
            onClick={() => setShowSettingsDialog(true)}
            title={t('taskList.openSettings', { defaultValue: '设置' })}
            aria-label={t('taskList.openSettings', { defaultValue: '设置' })}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={TB_ICON}
            onClick={() => setHelpOpen(true)}
            title={t('taskList.help', { defaultValue: '帮助' })}
            aria-label={t('taskList.help', { defaultValue: '帮助' })}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={aiSidebarOpen ? 'default' : 'outline'}
            size="icon"
            className={TB_ICON}
            onClick={() => setAiSidebarOpen(!aiSidebarOpen)}
            title={aiSidebarOpen ? t('common.hideAI', { defaultValue: '关闭 AI' }) : t('common.showAI', { defaultValue: '打开 AI' })}
            aria-label={aiSidebarOpen ? t('common.hideAI', { defaultValue: '关闭 AI' }) : t('common.showAI', { defaultValue: '打开 AI' })}
          >
            {aiSidebarOpen ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* 列表标签栏 */}
      <ListTabs
        lists={taskDoc.lists}
        activeListId={taskDoc.activeListId}
        onSelectList={handleSelectList}
        onAddList={handleAddList}
        onRenameList={handleRenameList}
        onDeleteList={handleDeleteList}
        onDuplicateList={handleDuplicateList}
      />

      {/* 主编辑区 */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea className="flex-1 min-h-0">
              {/* 待办任务区 */}
              <div className="p-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-2">
                  <span className="text-sm font-medium text-muted-foreground shrink-0">
                    {t('taskList.pending', { defaultValue: '待办' })} (
                    {(() => {
                      if (taskSearch.trim()) {
                        return `${pendingSearchFiltered.length}/${pendingFiltered.length}`;
                      }
                      if (priorityFilter === 'high' && pendingTasks.length !== pendingFiltered.length) {
                        return `${pendingFiltered.length}/${pendingTasks.length}`;
                      }
                      return `${pendingFiltered.length}`;
                    })()}
                    )
                  </span>
                  {pendingSearchFiltered.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={handleSelectAll}
                    >
                      {(() => {
                        const pool = pendingSearchFiltered;
                        const allSel = pool.length > 0 && pool.every((x) => selectedTaskIds.has(x.id));
                        return allSel
                          ? t('common.deselectAll', { defaultValue: '取消全选' })
                          : t('common.selectAll', { defaultValue: '全选' });
                      })()}
                    </Button>
                  )}
                  {selectedPendingCount > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">|</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t('taskList.selectedCount', {
                          count: selectedPendingCount,
                          defaultValue: '已选 {{count}} 项',
                        })}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 shrink-0"
                        onClick={() => void handleCopySelected()}
                        title={t('taskList.copySelected', { defaultValue: '复制选中' })}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {t('taskList.bulkCopy', { defaultValue: '复制' })}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 shrink-0"
                            type="button"
                          >
                            {t('taskList.bulkPriority', { defaultValue: '优先级' })}
                            <ChevronDown className="h-3 w-3 opacity-70" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                          <DropdownMenuItem onClick={() => handleSetSelectedPriority('high')}>
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2 shrink-0" />
                            {t('taskList.priorityHigh', { defaultValue: '高' })}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetSelectedPriority('medium')}>
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 mr-2 shrink-0" />
                            {t('taskList.priorityMedium', { defaultValue: '中' })}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSetSelectedPriority('low')}>
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2 shrink-0" />
                            {t('taskList.priorityLow', { defaultValue: '低' })}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 shrink-0"
                        onClick={handleMarkSelectedComplete}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('taskList.bulkMarkDone', { defaultValue: '标为完成' })}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={handleRequestBulkDelete}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('taskList.bulkDelete', { defaultValue: '删除' })}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={() => setSelectedTaskIds(new Set())}
                      >
                        {t('taskList.clearSelection', { defaultValue: '取消选择' })}
                      </Button>
                    </>
                  )}
                </div>

                {pendingFiltered.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    {t('taskList.noPendingTasks', { defaultValue: '暂无待办任务' })}
                  </div>
                ) : pendingSearchFiltered.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    {t('taskList.noSearchResults', { defaultValue: '没有匹配当前搜索的任务' })}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    {priorityFilter === 'all' ? (
                      <SortableContext
                        items={pendingSearchFiltered.map((x) => x.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {pendingSearchFiltered.map((task) => (
                          <TaskRowWithContextMenu
                            key={task.id}
                            task={task}
                            isCompleted={false}
                            isSelected={selectedTaskIds.has(task.id)}
                            onToggle={() => handleToggleTask(task.id)}
                            onContentChange={(content) => handleUpdateTask(task.id, { content }, true)}
                            onPriorityChange={(priority) => handleUpdateTask(task.id, { priority }, true)}
                            onDelete={() => handleDeleteTask(task.id)}
                            onCopy={() => void handleCopyTask(task.id)}
                            onSelect={() => handleToggleSelect(task.id)}
                            onDuplicate={() => handleDuplicateTask(task.id)}
                            onAddAbove={() => handleAddTaskAtIndex(task.id, 0)}
                            onAddBelow={() => handleAddTaskAtIndex(task.id, 1)}
                          />
                        ))}
                      </SortableContext>
                    ) : (
                      <div>
                        {pendingSearchFiltered.map((task) => (
                          <TaskRowWithContextMenu
                            key={task.id}
                            task={task}
                            isCompleted={false}
                            isSelected={selectedTaskIds.has(task.id)}
                            onToggle={() => handleToggleTask(task.id)}
                            onContentChange={(content) => handleUpdateTask(task.id, { content }, true)}
                            onPriorityChange={(priority) => handleUpdateTask(task.id, { priority }, true)}
                            onDelete={() => handleDeleteTask(task.id)}
                            onCopy={() => void handleCopyTask(task.id)}
                            onSelect={() => handleToggleSelect(task.id)}
                            onDuplicate={() => handleDuplicateTask(task.id)}
                            onAddAbove={() => handleAddTaskAtIndex(task.id, 0)}
                            onAddBelow={() => handleAddTaskAtIndex(task.id, 1)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={!activeList}
                    onClick={handleAddTask}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('taskList.addTask', { defaultValue: '添加任务' })}
                  </Button>
                </div>
              </div>

              {/* 已完成任务区（可折叠 + 全选 / 批量） */}
              {taskDoc.settings.showCompleted && completedTasks.length > 0 && (
                <Collapsible defaultOpen className="p-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-2">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="group flex items-center gap-2 shrink-0 rounded-md py-1 pr-2 text-left hover:bg-muted/60 transition-colors"
                      >
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {t('taskList.completed', { defaultValue: '已完成' })} (
                          {taskSearch.trim()
                            ? `${completedSearchFiltered.length}/${completedTasks.length}`
                            : completedTasks.length}
                          )
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    {completedSearchFiltered.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSelectAllCompleted();
                      }}
                    >
                      {(() => {
                        const allSel =
                          completedSearchFiltered.length > 0 &&
                          completedSearchFiltered.every((x) => selectedTaskIds.has(x.id));
                        return allSel
                          ? t('common.deselectAll', { defaultValue: '取消全选' })
                          : t('common.selectAll', { defaultValue: '全选' });
                      })()}
                    </Button>
                    )}
                    {selectedCompletedCount > 0 && (
                      <>
                        <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">|</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {t('taskList.selectedCount', {
                            count: selectedCompletedCount,
                            defaultValue: '已选 {{count}} 项',
                          })}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 shrink-0"
                          onClick={() => void handleCopySelected()}
                          title={t('taskList.copySelected', { defaultValue: '复制选中' })}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {t('taskList.bulkCopy', { defaultValue: '复制' })}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 shrink-0"
                          onClick={handleMarkSelectedPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t('taskList.bulkMarkPending', { defaultValue: '标为待办' })}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={handleRequestBulkDelete}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('taskList.bulkDelete', { defaultValue: '删除' })}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          onClick={() => setSelectedTaskIds(new Set())}
                        >
                          {t('taskList.clearSelection', { defaultValue: '取消选择' })}
                        </Button>
                      </>
                    )}
                  </div>
                  <CollapsibleContent>
                    <div className="border rounded-lg overflow-hidden">
                      {completedSearchFiltered.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground px-2">
                          {t('taskList.noSearchResults', {
                            defaultValue: '没有匹配当前搜索的任务',
                          })}
                        </div>
                      ) : (
                        completedSearchFiltered.map((task) => (
                          <TaskRowWithContextMenu
                            key={task.id}
                            task={task}
                            isCompleted
                            isSelected={selectedTaskIds.has(task.id)}
                            onToggle={() => handleToggleTask(task.id)}
                            onContentChange={(content) => handleUpdateTask(task.id, { content }, true)}
                            onPriorityChange={(priority) => handleUpdateTask(task.id, { priority }, true)}
                            onDelete={() => handleDeleteTask(task.id)}
                            onCopy={() => void handleCopyTask(task.id)}
                            onSelect={() => handleToggleSelect(task.id)}
                            onDuplicate={() => handleDuplicateTask(task.id)}
                            onAddAbove={() => handleAddTaskAtIndex(task.id, 0)}
                            onAddBelow={() => handleAddTaskAtIndex(task.id, 1)}
                          />
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </ScrollArea>

            {/* 拖拽覆盖层 */}
            <DragOverlay>
              {activeId ? (
                <div className="bg-background border rounded shadow-lg p-2 text-sm">
                  {activeList?.tasks.find((t) => t.id === activeId)?.content.slice(0, 50)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* 状态栏（仅中栏底部，与计算文档一致） */}
      <div className={STATUS_BAR_CLASS}>
        {stats && (
          <>
            <div className="flex items-center gap-1.5" title={t('taskList.completionRate', { defaultValue: '完成率' })}>
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.round(stats.completionRate * 100)}%` }}
                />
              </div>
              <span className="tabular-nums text-xs">{Math.round(stats.completionRate * 100)}%</span>
            </div>
            <span className="text-muted-foreground">|</span>
            <span>
              {t('taskList.pending', { defaultValue: '待办' })}: {stats.pending}
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              {t('taskList.completed', { defaultValue: '已完成' })}: {stats.completed}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-red-600 dark:text-red-400">
              {t('taskList.highPriority', { defaultValue: '高优先' })}: {stats.highPriority}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-yellow-600 dark:text-yellow-400">
              {t('taskList.mediumPriority', { defaultValue: '中优先' })}: {stats.mediumPriority}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-green-600 dark:text-green-400">
              {t('taskList.lowPriority', { defaultValue: '低优先' })}: {stats.lowPriority}
            </span>
          </>
        )}
      </div>
      </div>

      {/* 右栏：AI（与 CalculatorWorkspace — ResizableHandle + 固定宽度容器） */}
      {aiSidebarOpen && (
        <>
          <ResizableHandle
            direction="horizontal"
            onResize={(delta) => {
              setAiSidebarWidth((w) => Math.min(500, Math.max(220, w - delta)));
            }}
          />
          <div
            className="flex-shrink-0 h-full overflow-hidden border-l bg-card"
            style={{ width: aiSidebarWidth }}
          >
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  {t('common.loading', { defaultValue: '加载中...' })}
                </div>
              }
            >
              <TaskListAISidebar
                key={doc.id}
                documentId={doc.id}
                document={doc}
                tabId={tabId}
                host={host}
                taskDoc={taskDoc}
                activeList={activeList}
                onClose={() => setAiSidebarOpen(false)}
                onAddTasks={(tasks) => {
                  const doc = taskDocRef.current;
                  const list = getActiveList(doc);
                  if (!list) return;
                  pushHistoryRef.current();
                  saveDocRef.current(
                    updateList(doc, list.id, {
                      tasks: [...list.tasks, ...tasks],
                    }),
                  );
                }}
              />
            </Suspense>
          </div>
        </>
      )}
    </div>

      {/* 模板选择对话框 */}
      <Suspense fallback={null}>
        <TaskListTemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          onSelectTemplate={(newList) => {
            pushHistoryRef.current();
            const updated = addList(taskDocRef.current, newList);
            const withActive = {
              ...updated,
              activeListId: newList.id,
            };
            saveDocRef.current(withActive);
          }}
        />
      </Suspense>

      {/* 从文本导入对话框 */}
      <Suspense fallback={null}>
        <TaskListImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          defaultPriority="medium"
          onImport={(tasks) => {
            const d = taskDocRef.current;
            const list = getActiveList(d);
            if (!list) return;
            pushHistoryRef.current();
            saveDocRef.current(
              updateList(d, list.id, {
                tasks: [...list.tasks, ...tasks],
              }),
            );
          }}
        />
      </Suspense>

      <TaskListExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        taskDoc={taskDoc}
        documentId={doc.id}
        projectId={doc.projectId}
        defaultTitle={doc.title || 'tasks'}
      />
      <TaskListSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        settings={taskDoc.settings}
        onSettingsChange={handleSettingsApply}
      />
      <TaskListHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      <TaskListBulkDeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        count={selectedTaskIds.size}
        onConfirm={executeBulkDelete}
      />

      <Suspense fallback={null}>
        <VersionHistoryPanel
          open={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          projectId={doc.projectId}
          documentId={doc.id}
        />
      </Suspense>
    </>
  );
}

export default function TaskListWorkspace(props: DocTypeEditorProps) {
  return (
    <TaskListWorkspaceErrorBoundary docId={props.document.id}>
      <TaskListWorkspaceMain {...props} />
    </TaskListWorkspaceErrorBoundary>
  );
}
