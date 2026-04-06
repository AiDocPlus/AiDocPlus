/**
 * CalculatorSheetTabs — Sheet 标签栏组件
 * 支持：新建、重命名（双击/菜单）、复制、删除 Sheet
 */
import { useState, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Copy, Trash, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';
import type { CalculatorSheet } from './types';

// ============================================================
// SheetTabs
// ============================================================

export interface SheetTabsProps {
  sheets: CalculatorSheet[];
  activeSheetId: string;
  onSelectSheet: (id: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (id: string, name: string) => void;
  onDeleteSheet: (id: string) => void;
  onDuplicateSheet: (id: string) => void;
}

export function SheetTabs({
  sheets,
  activeSheetId,
  onSelectSheet,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
  onDuplicateSheet,
}: SheetTabsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = (sheet: CalculatorSheet) => {
    setEditingId(sheet.id);
    setEditName(sheet.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      onRenameSheet(editingId, editName.trim());
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

  const handleTabDoubleClick = (e: React.MouseEvent, sheet: CalculatorSheet) => {
    e.preventDefault();
    e.stopPropagation();
    if (sheet.id !== activeSheetId) {
      onSelectSheet(sheet.id);
    }
    handleStartEdit(sheet);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 border-b overflow-x-auto scrollbar-hide">
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className={cn(
            'group flex items-center gap-1 px-3 py-1.5 rounded-t text-sm cursor-pointer transition-colors select-none',
            sheet.id === activeSheetId
              ? 'bg-sky-600 text-white border border-sky-700 border-b-transparent shadow-sm dark:bg-sky-700 dark:border-sky-800'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent',
          )}
          onClick={() => sheet.id !== activeSheetId && onSelectSheet(sheet.id)}
          onDoubleClick={(e) => handleTabDoubleClick(e, sheet)}
        >
          {editingId === sheet.id ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="h-6 w-24 text-sm px-1"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="truncate max-w-[100px]">{sheet.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity',
                      sheet.id === activeSheetId
                        ? 'hover:bg-white/20 text-white'
                        : 'hover:bg-muted',
                    )}
                    onClick={(e) => e.stopPropagation()}
                    title={t('calculator.sheetMenu', { defaultValue: '工作表菜单' })}
                    aria-label={t('calculator.sheetMenu', { defaultValue: '工作表菜单' })}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => handleStartEdit(sheet)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    {t('calculator.renameSheet', { defaultValue: '重命名' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicateSheet(sheet.id)}>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('calculator.duplicateSheet', { defaultValue: '复制' })}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteSheet(sheet.id)}
                    disabled={sheets.length <= 1}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    {t('calculator.deleteSheet', { defaultValue: '删除' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        onClick={onAddSheet}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================
// 错误边界：避免单点渲染异常拖死整个标签页
// ============================================================

export class CalculatorWorkspaceErrorBoundary extends Component<
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
    console.error('[CalculatorWorkspace]', error, info.componentStack);
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
          data-calculator-error-boundary="true"
        >
          <p className="text-sm max-w-md">
            {i18n.t('calculator.workspaceErrorBoundary', {
              defaultValue: '计算工作区出现异常。可尝试重试；若仍失败请切换文档后重新打开或检查文档内容。',
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
