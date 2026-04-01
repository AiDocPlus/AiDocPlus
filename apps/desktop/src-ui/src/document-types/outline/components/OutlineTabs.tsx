/**
 * 大纲标签栏 — 对齐 CalculatorWorkspace SheetTabs（圆角顶、sky 激活、⋯ 菜单）
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Plus, Edit2, MoreHorizontal, Copy, Trash } from 'lucide-react';

import type { Outline } from '../types';

interface OutlineTabsProps {
  outlines: Outline[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function OutlineTabs({
  outlines,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onDuplicate,
}: OutlineTabsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((outline: Outline) => {
    setEditingId(outline.id);
    setEditValue(outline.title);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const confirmRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, onRename]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditValue('');
  }, []);

  const handleTabDoubleClick = useCallback(
    (e: React.MouseEvent, outline: Outline) => {
      e.preventDefault();
      e.stopPropagation();
      if (outline.id !== activeId) {
        onSelect(outline.id);
      }
      startRename(outline);
    },
    [activeId, onSelect, startRename]
  );

  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelRename();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId, cancelRename]);

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 border-b overflow-x-auto scrollbar-hide flex-shrink-0">
      {outlines.map((outline) => (
        <div
          key={outline.id}
          className={cn(
            'group flex items-center gap-1 px-3 py-1.5 rounded-t text-sm cursor-pointer transition-colors select-none min-w-0',
            activeId === outline.id
              ? 'bg-sky-600 text-white border border-sky-700 border-b-transparent shadow-sm dark:bg-sky-700 dark:border-sky-800'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent',
          )}
          onClick={() => outline.id !== activeId && onSelect(outline.id)}
          onDoubleClick={(e) => handleTabDoubleClick(e, outline)}
        >
          {editingId === outline.id ? (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={confirmRename}
              onKeyDown={(e) => {
                if ((e.nativeEvent as KeyboardEvent).isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') confirmRename();
                if (e.key === 'Escape') cancelRename();
              }}
              className={cn(
                'h-6 w-28 sm:w-32 text-sm px-1 py-0',
                activeId === outline.id
                  ? 'bg-white/95 text-foreground border-sky-500'
                  : 'bg-background border',
              )}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span
                className={cn(
                  'truncate max-w-[100px] sm:max-w-[120px]',
                  activeId === outline.id ? 'font-medium' : '',
                )}
              >
                {outline.title}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity shrink-0',
                      activeId === outline.id ? 'hover:bg-white/20 text-white' : 'hover:bg-muted',
                    )}
                    onClick={(e) => e.stopPropagation()}
                    title={t('outline.tabMenu', { defaultValue: '大纲菜单' })}
                    aria-label={t('outline.tabMenu', { defaultValue: '大纲菜单' })}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(outline);
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    {t('outline.renameOutline', { defaultValue: '重命名' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(outline.id);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {t('outline.duplicateOutline', { defaultValue: '复制大纲' })}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={outlines.length <= 1}
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(outline.id);
                    }}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    {t('outline.deleteOutline', { defaultValue: '删除大纲' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
        onClick={onAdd}
        title={t('outline.newOutline', { defaultValue: '新大纲' })}
        aria-label={t('outline.newOutline', { defaultValue: '新大纲' })}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default OutlineTabs;
