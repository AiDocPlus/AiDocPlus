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
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import {
  CheckSquare,
  Square,
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
  ListTodo,
  GripVertical,
  Check,
  Save,
  SaveAll,
  History,
  Settings,
  HelpCircle,
  Download,
  FilePlus,
  CheckCircle2,
  RotateCcw,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  type TaskListDocumentContent,
  type TaskList,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
  type TaskListSettings,
  PRIORITY_CONFIG,
  generateListId,
  generateTaskId,
} from './types';
import { TOOLBAR_ICON, STATUS_BAR_CLASS } from '../_shared/styles';
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
const VersionHistoryPanel = lazy(() =>
  import('@/components/version/VersionHistoryPanel').then((m) => ({ default: m.VersionHistoryPanel })),
);

/** 主工具栏图标按钮 */
const TB_ICON = 'h-7 w-7 shrink-0 p-0';

class TaskListWorkspaceErrorBoundary extends Component<
  { children: ReactNode; docId: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; docId: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[TaskListWorkspace]', error, info.componentStack);
  }

  override componentDidUpdate(prevProps: { docId: string }): void {
    if (prevProps.docId !== this.props.docId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground bg-card"
          data-tasklist-error-boundary="true"
        >
          <p className="text-sm max-w-md">
            {i18n.t('taskList.workspaceErrorBoundary', {
              defaultValue: '任务清单工作区出现异常。可尝试重试；若仍失败请切换文档后重新打开。',
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false })}
          >
            {i18n.t('calculator.workspaceErrorRetry', { defaultValue: '重试' })}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// 历史记录（撤销/重做）
// ============================================================

interface HistoryState {
  doc: TaskListDocumentContent;
}

const MAX_HISTORY = 50;

// ============================================================
// 可排序任务行组件
// ============================================================

interface TaskRowBaseProps {
  task: TaskItem;
  onToggle: () => void;
  onContentChange: (content: string) => void;
  onPriorityChange: (priority: TaskPriority) => void;
  onDelete: () => void;
  onCopy: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  isCompleted?: boolean;
  /** 待办区：拖拽 */
  sortable?: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
    isDragging: boolean;
  };
}

function TaskRowBase({
  task,
  onToggle,
  onContentChange,
  onPriorityChange,
  onDelete,
  onCopy,
  isSelected = false,
  onSelect,
  isCompleted = false,
  sortable,
}: TaskRowBaseProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(task.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditContent(task.content);
  }, [task.content]);

  const handleSave = () => {
    if (editContent !== task.content) {
      onContentChange(editContent);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditContent(task.content);
      setIsEditing(false);
    }
  };

  const pr = normalizeTaskPriority(task.priority);
  const priorityConfig = PRIORITY_CONFIG[pr];

  return (
    <div
      ref={sortable?.setNodeRef}
      style={sortable?.style}
      className={cn(
        'group flex items-start gap-2 px-2 py-2 border-b border-border/40 hover:bg-muted/30 transition-colors',
        isCompleted && 'opacity-60',
        sortable?.isDragging && 'bg-muted/50 shadow-lg',
      )}
    >
      {/* 拖拽手柄（仅待办 Sortable 区） */}
      {sortable ? (
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          className="shrink-0 p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <div className="w-7 shrink-0" aria-hidden />
      )}

      {/* 多选（与下方「完成」圆形复选框区分：方形图标） */}
      {onSelect && (
        <button
          type="button"
          aria-pressed={isSelected ? true : false}
          className={cn(
            'shrink-0 mt-0.5 p-0.5 rounded-md transition-colors',
            isSelected
              ? 'text-primary bg-primary/12'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )}
          onClick={onSelect}
          title={
            isSelected
              ? t('taskList.deselectRow', { defaultValue: '取消选中' })
              : t('taskList.selectRow', { defaultValue: '选中' })
          }
        >
          {isSelected ? (
            <CheckSquare className="h-5 w-5 stroke-[2.5]" />
          ) : (
            <Square className="h-5 w-5 stroke-[2]" />
          )}
        </button>
      )}

      {/* 优先级指示器 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'shrink-0 w-5 h-5 rounded-full mt-0.5',
              pr === 'high' && 'bg-red-500',
              pr === 'medium' && 'bg-yellow-500',
              pr === 'low' && 'bg-green-500',
            )}
            title={priorityConfig.label}
            aria-label={t('taskList.priorityPickerAria', {
              label: priorityConfig.label,
              defaultValue: '优先级：{{label}}',
            })}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-24">
          <DropdownMenuItem onClick={() => onPriorityChange('high')}>
            <span className="w-3 h-3 rounded-full bg-red-500 mr-2" />
            {t('taskList.priorityHigh', { defaultValue: '高' })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPriorityChange('medium')}>
            <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
            {t('taskList.priorityMedium', { defaultValue: '中' })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPriorityChange('low')}>
            <span className="w-3 h-3 rounded-full bg-green-500 mr-2" />
            {t('taskList.priorityLow', { defaultValue: '低' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 完成（圆形描边，与多选方形图标区分） */}
      <button
        type="button"
        className={cn(
          'shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center transition-colors',
          isCompleted
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40 hover:border-primary/55 bg-background',
        )}
        onClick={onToggle}
        title={
          isCompleted
            ? t('taskList.markAsPending', { defaultValue: '恢复为待办' })
            : t('taskList.markAsDone', { defaultValue: '标记完成' })
        }
      >
        {isCompleted && <Check className="h-3 w-3 stroke-[3]" />}
      </button>

      {/* 内容区 */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="min-h-[60px] text-sm resize-none"
            placeholder={t('taskList.contentPlaceholder', { defaultValue: '输入任务内容...' })}
            autoFocus
          />
        ) : (
          <div
            className={cn(
              'text-sm whitespace-pre-wrap cursor-text min-h-[24px] py-1',
              isCompleted && 'line-through text-muted-foreground',
            )}
            onClick={() => setIsEditing(true)}
          >
            {task.content || (
              <span className="text-muted-foreground/50 italic">
                {t('taskList.emptyContent', { defaultValue: '点击编辑...' })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onCopy}
          title={t('taskList.copy', { defaultValue: '复制' })}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={onDelete}
          title={t('taskList.delete', { defaultValue: '删除' })}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* 完成时间 */}
      {isCompleted && task.completedAt && (
        <span className="text-xs text-muted-foreground shrink-0">
          {formatRelativeTime(task.completedAt)}
        </span>
      )}
    </div>
  );
}

type TaskRowHandlersProps = Omit<TaskRowBaseProps, 'sortable'>;

function SortableTaskRow(props: TaskRowHandlersProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <TaskRowBase
      {...props}
      sortable={{
        setNodeRef,
        style,
        attributes,
        listeners,
        isDragging,
      }}
    />
  );
}

function StaticTaskRow(props: TaskRowHandlersProps) {
  return <TaskRowBase {...props} />;
}

// ============================================================
// 列表标签栏组件
// ============================================================

interface ListTabsProps {
  lists: TaskList[];
  activeListId: string;
  onSelectList: (id: string) => void;
  onAddList: () => void;
  onRenameList: (id: string, name: string) => void;
  onDeleteList: (id: string) => void;
  onDuplicateList: (id: string) => void;
}

function ListTabs({
  lists,
  activeListId,
  onSelectList,
  onAddList,
  onRenameList,
  onDeleteList,
  onDuplicateList,
}: ListTabsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = (list: TaskList) => {
    setEditingId(list.id);
    setEditName(list.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      onRenameList(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditName('');
    }
  };

  const handleTabDoubleClick = (e: React.MouseEvent, list: TaskList) => {
    e.preventDefault();
    e.stopPropagation();
    if (list.id !== activeListId) {
      onSelectList(list.id);
    }
    handleStartEdit(list);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30 overflow-x-auto">
      {lists.map((list) => {
        const isActive = list.id === activeListId;
        return (
        <div
          key={list.id}
          className={cn(
            'group flex items-center gap-1 px-2.5 py-1 rounded text-sm cursor-pointer transition-colors shrink-0 select-none',
            isActive
              ? 'bg-red-100 dark:bg-red-950/55 text-red-950 dark:text-red-50 font-medium border border-red-300/80 dark:border-red-800/80 shadow-sm'
              : 'hover:bg-muted text-muted-foreground',
          )}
          onClick={() => !isActive && onSelectList(list.id)}
          onDoubleClick={(e) => handleTabDoubleClick(e, list)}
        >
          {editingId === list.id ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="h-6 min-w-[140px] max-w-[220px] w-auto text-sm px-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <ListTodo className="h-3.5 w-3.5 shrink-0 opacity-90" />
              <span className="truncate max-w-[100px]">{list.name}</span>
              <span
                className={cn(
                  'text-xs ml-1 tabular-nums',
                  isActive
                    ? 'text-red-800/85 dark:text-red-200/90'
                    : 'text-muted-foreground/60',
                )}
              >
                ({list.tasks.filter((t) => t.status === 'pending').length})
              </span>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted-foreground/10 rounded transition-opacity"
                onClick={(e) => e.stopPropagation()}
                aria-label={t('common.moreOptions', { defaultValue: '更多操作' })}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                onClick={() => {
                  // 延后到菜单关闭后再进入编辑，避免焦点/失焦与闭包状态打架（对齐计算器侧常见处理）
                  setTimeout(() => handleStartEdit(list), 0);
                }}
              >
                {t('common.rename', { defaultValue: '重命名' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicateList(list.id)}>
                {t('taskList.duplicateList', { defaultValue: '复制列表' })}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDeleteList(list.id)}
                disabled={lists.length <= 1}
              >
                {t('common.delete', { defaultValue: '删除' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0"
        onClick={onAddList}
        title={t('taskList.addList', { defaultValue: '新建列表' })}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================
// 辅助函数
// ============================================================

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // 时钟偏差或未来时间：直接显示本地日期时间
  if (diffDays < 0) return date.toLocaleString();
  if (diffDays === 0) return i18n.language.startsWith('zh') ? '今天' : 'today';
  if (diffDays === 1) return i18n.language.startsWith('zh') ? '昨天' : 'yesterday';
  if (diffDays < 7) return `${diffDays}${i18n.language.startsWith('zh') ? '天前' : ' days ago'}`;
  return date.toLocaleDateString();
}

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

  // AI 侧栏状态
  const [aiSidebarOpen, setAiSidebarOpen] = useState(true);
  const [aiSidebarWidth, setAiSidebarWidth] = useState(320);

  // 模板对话框状态
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
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

  // 文档切换时重新加载（对齐 CalculatorWorkspace）
  useEffect(() => {
    const d = host.doc.getDocument();
    setTaskDoc(parseTaskListContent(d.content || ''));
    setPast([]);
    setFuture([]);
    const pf = host.storage.get(taskListPriorityFilterStorageKey(doc.id));
    setPriorityFilter(normalizePriorityFilterFromStorage(pf));
    setTaskSearch('');
    setSelectedTaskIds(new Set());
  }, [doc.id, host]);

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

  // 推入历史
  const pushHistory = useCallback(() => {
    setPast((prev) => {
      const next = [...prev, { doc: taskDocRef.current }];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setFuture([]);
  }, []);

  const handleSettingsApply = useCallback(
    (settings: TaskListSettings) => {
      pushHistory();
      saveDoc({ ...taskDocRef.current, settings });
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
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [{ doc: taskDocRef.current }, ...f]);
    saveDoc(prev.doc);
  }, [past, saveDoc]);

  // 重做
  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, { doc: taskDocRef.current }]);
    saveDoc(next.doc);
  }, [future, saveDoc]);

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;
    const doc = taskDocRef.current;
    const list = getActiveList(doc);
    if (!list) return;
    const oldIndex = list.tasks.findIndex((t) => t.id === active.id);
    const newIndex = list.tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      pushHistory();
      const newTasks = arrayMove(list.tasks, oldIndex, newIndex).map((t, i) => ({
        ...t,
        sortOrder: i,
      }));
      saveDoc(updateList(doc, list.id, { tasks: newTasks }));
    }
  };

  // 待办任务
  const pendingTasks = useMemo(
    () => activeList?.tasks.filter((t) => t.status === 'pending') ?? [],
    [activeList],
  );

  const displayedPendingTasks = useMemo(
    () => filterPendingForDisplay(pendingTasks, priorityFilter, ''),
    [pendingTasks, priorityFilter],
  );

  /** 待办 + 搜索（用于展示与拖拽） */
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
                {t('taskList.filterHigh', { defaultValue: '仅高优先' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleShowCompletedSetting}>
                {taskDoc.settings.showCompleted
                  ? t('taskList.hideCompleted', { defaultValue: '隐藏已完成' })
                  : t('taskList.showCompleted', { defaultValue: '显示已完成' })}
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
                        return `${pendingSearchFiltered.length}/${displayedPendingTasks.length}`;
                      }
                      if (priorityFilter === 'high' && pendingTasks.length !== displayedPendingTasks.length) {
                        return `${displayedPendingTasks.length}/${pendingTasks.length}`;
                      }
                      return `${displayedPendingTasks.length}`;
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

                {displayedPendingTasks.length === 0 ? (
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
                          <SortableTaskRow
                            key={task.id}
                            task={task}
                            onToggle={() => handleToggleTask(task.id)}
                            onContentChange={(content) => handleUpdateTask(task.id, { content }, true)}
                            onPriorityChange={(priority) => handleUpdateTask(task.id, { priority }, true)}
                            onDelete={() => handleDeleteTask(task.id)}
                            onCopy={() => void handleCopyTask(task.id)}
                            isSelected={selectedTaskIds.has(task.id)}
                            onSelect={() => handleToggleSelect(task.id)}
                          />
                        ))}
                      </SortableContext>
                    ) : (
                      <div>
                        {pendingSearchFiltered.map((task) => (
                          <StaticTaskRow
                            key={task.id}
                            task={task}
                            onToggle={() => handleToggleTask(task.id)}
                            onContentChange={(content) => handleUpdateTask(task.id, { content }, true)}
                            onPriorityChange={(priority) => handleUpdateTask(task.id, { priority }, true)}
                            onDelete={() => handleDeleteTask(task.id)}
                            onCopy={() => void handleCopyTask(task.id)}
                            isSelected={selectedTaskIds.has(task.id)}
                            onSelect={() => handleToggleSelect(task.id)}
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
                          <StaticTaskRow
                            key={task.id}
                            task={task}
                            onToggle={() => handleToggleTask(task.id)}
                            onContentChange={(content) => handleUpdateTask(task.id, { content }, true)}
                            onPriorityChange={(priority) => handleUpdateTask(task.id, { priority }, true)}
                            onDelete={() => handleDeleteTask(task.id)}
                            onCopy={() => void handleCopyTask(task.id)}
                            isCompleted
                            isSelected={selectedTaskIds.has(task.id)}
                            onSelect={() => handleToggleSelect(task.id)}
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
                  pushHistory();
                  saveDoc(
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
            pushHistory();
            const updated = addList(taskDocRef.current, newList);
            const withActive = {
              ...updated,
              activeListId: newList.id,
            };
            saveDoc(withActive);
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
