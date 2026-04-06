/**
 * TaskListTabs — 列表标签栏组件 + 错误边界
 */
import { useState, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronDown, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';
import type { TaskList } from './types';

// ============================================================
// ListTabs
// ============================================================

export interface ListTabsProps {
  lists: TaskList[];
  activeListId: string;
  onSelectList: (id: string) => void;
  onAddList: () => void;
  onRenameList: (id: string, name: string) => void;
  onDeleteList: (id: string) => void;
  onDuplicateList: (id: string) => void;
}

export function ListTabs({
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
    <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30 overflow-x-auto scrollbar-hide">
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
                  ({list.tasks.filter((tk) => tk.status === 'pending').length})
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
// 错误边界
// ============================================================

export class TaskListWorkspaceErrorBoundary extends Component<
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
            {i18n.t('common.retry', { defaultValue: '重试' })}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
