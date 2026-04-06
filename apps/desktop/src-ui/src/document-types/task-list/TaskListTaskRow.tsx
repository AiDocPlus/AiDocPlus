/**
 * TaskListTaskRow — 任务行组件
 * 包含：TaskRowBase、SortableTaskRow、StaticTaskRow、TaskRowWithContextMenu
 * 以及 formatRelativeTime 辅助函数
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckSquare,
  Square,
  Trash2,
  Copy,
  GripVertical,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import {
  normalizeTaskPriority,
  PRIORITY_CONFIG,
  type TaskItem,
  type TaskPriority,
} from './types';

// ============================================================
// 辅助函数
// ============================================================

export function formatRelativeTime(
  t: (key: string, opts?: Record<string, unknown>) => string,
  isoString: string,
): string {
  const date = new Date(isoString);
  const now = new Date();

  const d = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const todayStr = d(now);
  const dateStr = d(date);

  if (date > now) return date.toLocaleString();
  if (dateStr === todayStr) return t('taskList.timeToday', { defaultValue: '今天' });

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === d(yesterday)) return t('taskList.timeYesterday', { defaultValue: '昨天' });

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7)
    return t('taskList.timeDaysAgo', { count: diffDays, defaultValue: `${diffDays} 天前` });
  return date.toLocaleDateString();
}

// ============================================================
// TaskRowBase
// ============================================================

export interface TaskRowBaseProps {
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

export function TaskRowBase({
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
    } else if (e.key === 'Backspace' && !editContent.trim()) {
      e.preventDefault();
      onDelete();
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
            title={t(`taskList.priority${pr === 'high' ? 'High' : pr === 'medium' ? 'Medium' : 'Low'}`, {
              defaultValue: priorityConfig.label,
            })}
            aria-label={t('taskList.priorityPickerAria', {
              label: t(`taskList.priority${pr === 'high' ? 'High' : pr === 'medium' ? 'Medium' : 'Low'}`),
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
          {formatRelativeTime(t, task.completedAt)}
        </span>
      )}
    </div>
  );
}

// ============================================================
// SortableTaskRow
// ============================================================

export type TaskRowHandlersProps = Omit<TaskRowBaseProps, 'sortable'>;

export function SortableTaskRow(props: TaskRowHandlersProps) {
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

// ============================================================
// StaticTaskRow
// ============================================================

export function StaticTaskRow(props: TaskRowHandlersProps) {
  return <TaskRowBase {...props} />;
}

// ============================================================
// TaskRowWithContextMenu
// ============================================================

export function TaskRowWithContextMenu(
  props: TaskRowHandlersProps & {
    onDuplicate: () => void;
    onAddAbove: () => void;
    onAddBelow: () => void;
  },
) {
  const { t } = useTranslation();
  const pr = normalizeTaskPriority(props.task.priority);
  const priorityDot = PRIORITY_CONFIG[pr];
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <StaticTaskRow {...props} />
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={props.onToggle}>
          {props.isCompleted
            ? t('taskList.markAsPending', { defaultValue: '恢复为待办' })
            : t('taskList.markAsDone', { defaultValue: '标记完成' })}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <span className="flex items-center gap-1.5">
              <span className={cn('w-2.5 h-2.5 rounded-full', priorityDot.dotColor)} />
              {t('taskList.priority', { defaultValue: '优先级' })}
            </span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => props.onPriorityChange('high')}>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2" />
              {t('taskList.priorityHigh', { defaultValue: '高' })}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => props.onPriorityChange('medium')}>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 mr-2" />
              {t('taskList.priorityMedium', { defaultValue: '中' })}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => props.onPriorityChange('low')}>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
              {t('taskList.priorityLow', { defaultValue: '低' })}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={props.onDuplicate}>
          {t('taskList.duplicateTask', { defaultValue: '复制任务' })}
        </ContextMenuItem>
        <ContextMenuItem onClick={props.onCopy}>
          {t('taskList.copyText', { defaultValue: '复制文本' })}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={props.onAddAbove}>
          {t('taskList.addAbove', { defaultValue: '在上方添加' })}
        </ContextMenuItem>
        <ContextMenuItem onClick={props.onAddBelow}>
          {t('taskList.addBelow', { defaultValue: '在下方添加' })}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={props.onDelete} className="text-destructive">
          {t('taskList.deleteTask', { defaultValue: '删除' })}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
