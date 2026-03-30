import { useTranslation } from '@/i18n';
import { useReaderStore, type EbookInfo, type EbookCategory, type ReaderSortField } from './useReaderStore';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import {
  Plus, Trash2, BookOpen, Search, Folder, FolderOpen,
  FolderPlus, ChevronRight, ChevronDown, Pencil,
  ChevronsUpDown, ChevronsDownUp, ArrowUpDown, ArrowUp, ArrowDown,
  Filter, Star, Check, X, GripVertical, ArrowRightLeft,
  Copy, Download, Info, FileText,
} from 'lucide-react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { SortableItem } from '@/components/file-tree/SortableItem';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ReadingProgress } from './useReaderStore';

const FORMAT_BADGES: Record<string, { bg: string; text: string }> = {
  md:   { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  html: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  pdf:  { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  docx: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
  epub: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function bookTitle(book: EbookInfo): string {
  return book.display_name || book.original_name || book.filename;
}

// ── 树状辅助函数 ──

function childCategories(categories: EbookCategory[], parentId: string | null): EbookCategory[] {
  return categories
    .filter((c) => c.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function booksInCategory(books: EbookInfo[], categoryId: string | null): EbookInfo[] {
  return books
    .filter((b) => b.category_id === categoryId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function descendantIds(categories: EbookCategory[], id: string): string[] {
  const result: string[] = [id];
  let i = 0;
  while (i < result.length) {
    for (const c of categories) {
      if (c.parent_id === result[i] && !result.includes(c.id)) {
        result.push(c.id);
      }
    }
    i++;
  }
  return result;
}

function totalBooksInTree(categories: EbookCategory[], books: EbookInfo[], catId: string): number {
  const ids = descendantIds(categories, catId);
  return books.filter((b) => b.category_id && ids.includes(b.category_id)).length;
}

// ── 排序函数 ──

function sortItems<T>(
  items: T[],
  field: ReaderSortField,
  direction: 'asc' | 'desc',
  nameKey: keyof T,
  dateKey: keyof T,
  lastReadMap?: Record<string, string>,
): T[] {
  if (field === 'custom') return items;
  const dir = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    switch (field) {
      case 'name':
        return dir * String(a[nameKey] ?? '').localeCompare(String(b[nameKey] ?? ''), 'zh');
      case 'addedAt':
        return dir * String(a[dateKey] ?? '').localeCompare(String(b[dateKey] ?? ''));
      case 'lastReadAt': {
        const aTime = lastReadMap?.[String((a as any)['filename'] ?? '')] ?? '';
        const bTime = lastReadMap?.[String((b as any)['filename'] ?? '')] ?? '';
        if (!aTime && !bTime) return 0;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return dir * aTime.localeCompare(bTime);
      }
      default:
        return 0;
    }
  });
}

// ── 内联重命名输入框 ──

function InlineRenameInput({ value, onSave, onCancel }: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const trimmed = editValue.trim();
      if (trimmed && trimmed !== value) onSave(trimmed);
      else onCancel();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <input
      ref={ref}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={() => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== value) onSave(trimmed);
        else onCancel();
      }}
      onKeyDown={handleKeyDown}
      className="flex-1 px-1 py-0 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── 内联创建分类输入框 ──

function InlineCreateInput({ placeholder, onSave, onCancel }: {
  placeholder: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const canSubmit = value.trim().length > 0;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      <FolderPlus className="h-3 w-3 text-muted-foreground shrink-0" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmit) onSave(value.trim());
          else if (e.key === 'Escape') onCancel();
        }}
        className="flex-1 px-1 py-0 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder={placeholder}
      />
      <Button variant="ghost" size="icon" className="h-5 w-5 p-0" disabled={!canSubmit} onClick={() => onSave(value.trim())}>
        <Check className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={onCancel}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ── 书籍属性对话框 ──

function BookPropertiesDialog({ book, open, onOpenChange, categories, readingProgress, t }: {
  book: EbookInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: EbookCategory[];
  readingProgress: Record<string, ReadingProgress>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (!book) return null;
  const category = categories.find(c => c.id === book.category_id);
  const progress = readingProgress[book.filename];

  const rows = [
    { label: t('reader.propDisplayName', { defaultValue: '显示名称' }), value: bookTitle(book) },
    { label: t('reader.propOriginalName', { defaultValue: '原始文件名' }), value: book.original_name || '—' },
    { label: t('reader.propFilename', { defaultValue: '文件名' }), value: book.filename },
    { label: t('reader.propFormat', { defaultValue: '格式' }), value: book.format.toUpperCase() },
    { label: t('reader.propSize', { defaultValue: '大小' }), value: formatFileSize(book.size_bytes) },
    { label: t('reader.propAddedAt', { defaultValue: '添加时间' }), value: new Date(book.added_at).toLocaleString() },
    { label: t('reader.propCategory', { defaultValue: '分类' }), value: category?.name || t('reader.uncategorized', { defaultValue: '未分类' }) },
    { label: t('reader.propStarred', { defaultValue: '收藏' }), value: book.starred ? '★' : '—' },
    { label: t('reader.propReadingProgress', { defaultValue: '阅读进度' }), value: progress?.progressPercent ? `${progress.progressPercent}%` : '—' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{bookTitle(book)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 mt-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center text-sm">
              <span className="w-24 shrink-0 text-muted-foreground">{row.label}</span>
              <span className="flex-1 truncate font-medium" title={row.value}>{row.value}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── 右键菜单类型 ──

type CtxMenuType = 'book' | 'category' | 'uncategorized' | 'empty';

interface CtxMenuState {
  x: number;
  y: number;
  type: CtxMenuType;
  data: EbookInfo | EbookCategory | null;
}

// ── 菜单项样式常量 ──

const menuItemClass = "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none cursor-pointer text-left transition-colors duration-75 reader-ctx-item";

// ── 主组件 ──

export function LibraryPanel() {
  const { t } = useTranslation();
  const {
    books, categories, currentBook, isLoading, readingProgress,
    sortField, sortDirection, starredFilter,
    importFile, deleteBook, openBook,
    renameBook, moveBook,
    createCategory, renameCategory, deleteCategory, moveCategory,
    reorderBooks, reorderCategories,
    toggleStarred,
    setSortField, setSortDirection, setStarredFilter,
  } = useReaderStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [renamingTarget, setRenamingTarget] = useState<{ type: 'book' | 'category'; id: string } | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [propertiesBook, setPropertiesBook] = useState<EbookInfo | null>(null);

  // 右键菜单状态
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // 关闭右键菜单
  const closeCtxMenu = useCallback(() => {
    menuRef.current?.blur();
    setCtxMenu(null);
    setOpenSubmenu(null);
  }, []);

  // ESC 关闭菜单
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ctxMenu) closeCtxMenu();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [ctxMenu, closeCtxMenu]);

  // 展开 / 折叠
  const expandAll = () => setExpanded(new Set([...categories.map((c) => c.id), '__uncategorized__']));
  const collapseAll = () => setExpanded(new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 排序切换
  const handleToggleSort = (field: ReaderSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 搜索
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    let result = books.filter(
      (b) =>
        (b.display_name || '').toLowerCase().includes(q) ||
        (b.original_name || '').toLowerCase().includes(q) ||
        b.filename.toLowerCase().includes(q),
    );
    if (starredFilter) result = result.filter(b => b.starred);
    return result;
  }, [books, searchQuery, starredFilter]);

  // 构建阅读时间 map（排序用）
  const lastReadMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(readingProgress)) {
      if (v.lastReadAt) map[k] = v.lastReadAt;
    }
    return map;
  }, [readingProgress]);

  // 筛选后的书籍
  const filteredBooks = useMemo(() => {
    if (!starredFilter) return books;
    return books.filter(b => b.starred);
  }, [books, starredFilter]);

  // 导入
  const handleImport = useCallback(async (categoryId?: string | null) => {
    closeCtxMenu();
    const filePath = await open({
      multiple: false,
      filters: [{ name: 'E-books', extensions: ['md', 'html', 'htm', 'docx', 'pdf', 'epub'] }],
    });
    if (!filePath) return;
    const book = await importFile(filePath as string, categoryId);
    if (book) openBook(book);
  }, [importFile, openBook, closeCtxMenu]);

  // 删除
  const handleDeleteBook = async (book: EbookInfo) => {
    const confirmed = window.confirm(t('reader.deleteConfirm', { defaultValue: '确认删除此文件？' }));
    if (!confirmed) return;
    await deleteBook(book.filename);
  };

  const handleDeleteCategory = async (cat: EbookCategory) => {
    const msg = t('reader.deleteCategoryConfirm', { defaultValue: '删除分类「{name}」？其下书籍将移至未分类。' })
      .replace('{name}', cat.name);
    if (!window.confirm(msg)) return;
    await deleteCategory(cat.id, true);
  };

  // 重命名
  const handleRenameBook = async (filename: string, newName: string) => {
    setRenamingTarget(null);
    await renameBook(filename, newName);
  };

  const handleRenameCategory = async (id: string, newName: string) => {
    setRenamingTarget(null);
    await renameCategory(id, newName);
  };

  // 创建分类
  const handleCreateCategory = async (parentId: string | null, name: string) => {
    setCreatingIn(null);
    if (!name.trim()) return;
    const cat = await createCategory(name.trim(), parentId);
    if (cat && parentId) {
      setExpanded((prev) => new Set(prev).add(parentId));
    }
  };

  // Cmd/Ctrl+F 搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 拖拽结束
  const handleBookDragEnd = useCallback((event: DragEndEvent, categoryId: string | null) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = booksInCategory(filteredBooks, categoryId);
    const ids = items.map(b => b.filename);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(ids, oldIdx, newIdx);
    reorderBooks(categoryId, newOrder);
    if (sortField !== 'custom') setSortField('custom');
  }, [filteredBooks, sortField, setSortField, reorderBooks]);

  const handleCategoryDragEnd = useCallback((event: DragEndEvent, parentId: string | null) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = childCategories(categories, parentId);
    const ids = items.map(c => c.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(ids, oldIdx, newIdx);
    reorderCategories(parentId, newOrder);
    if (sortField !== 'custom') setSortField('custom');
  }, [categories, sortField, setSortField, reorderCategories]);

  // ── 渲染书籍条目 ──
  const renderBookItem = (book: EbookInfo, depth: number) => {
    const badge = FORMAT_BADGES[book.format] || { bg: 'bg-gray-500/10', text: 'text-gray-600' };
    const isActive = currentBook?.filename === book.filename;
    const isCtxTarget = ctxMenu?.type === 'book' && (ctxMenu.data as EbookInfo)?.filename === book.filename;
    const progress = readingProgress[book.filename];
    const isRenaming = renamingTarget?.type === 'book' && renamingTarget.id === book.filename;

    return (
      <SortableItem key={book.filename} id={book.filename} showHandle={sortField === 'custom'}>
        <div
          onClick={() => !isRenaming && openBook(book)}
          onDoubleClick={() => setRenamingTarget({ type: 'book', id: book.filename })}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCtxMenu({ x: e.clientX, y: e.clientY, type: 'book', data: book });
          }}
          className={`flex items-start gap-2 px-1.5 py-1 rounded-md cursor-pointer transition-colors ${
            isActive || isCtxTarget
              ? 'bg-primary/10 shadow-sm ring-1 ring-primary/20'
              : 'hover:bg-accent'
          }`}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          {/* 格式色块 */}
          <div className={`relative shrink-0 mt-0.5 h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold uppercase ${badge.bg} ${badge.text}`}>
            {book.format}
            {book.starred && (
              <Star className="absolute -top-1 -right-1 h-2.5 w-2.5 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <InlineRenameInput
                value={bookTitle(book)}
                onSave={(v) => handleRenameBook(book.filename, v)}
                onCancel={() => setRenamingTarget(null)}
              />
            ) : (
              <p className="text-sm font-medium truncate leading-tight">{bookTitle(book)}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {progress?.progressPercent && progress.progressPercent > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-10 h-0.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${progress.progressPercent}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{progress.progressPercent}%</span>
                </div>
              )}
              <span className="text-xs text-muted-foreground">{formatFileSize(book.size_bytes)}</span>
            </div>
          </div>
        </div>
      </SortableItem>
    );
  };

  // ── 排序后的子元素列表 ──
  const getSortedBooks = (categoryId: string | null) => {
    const raw = booksInCategory(filteredBooks, categoryId);
    return sortItems(raw, sortField, sortDirection, 'display_name', 'added_at', lastReadMap);
  };

  const getSortedCategories = (parentId: string | null) => {
    const raw = childCategories(categories, parentId);
    return sortItems(raw, sortField, sortDirection, 'name', 'sort_order', lastReadMap);
  };

  // ── 渲染分类 ──
  const renderCategory = (cat: EbookCategory, depth: number) => {
    const isExpanded = expanded.has(cat.id);
    const count = totalBooksInTree(categories, books, cat.id);
    const isRenaming = renamingTarget?.type === 'category' && renamingTarget.id === cat.id;
    const isCreatingHere = creatingIn === cat.id;

    const sortedChildCats = getSortedCategories(cat.id);
    const sortedCatBooks = getSortedBooks(cat.id);

    return (
      <div key={cat.id}>
        <div
          className="flex items-center gap-1 px-1.5 py-1 rounded-md cursor-pointer hover:bg-accent"
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => toggle(cat.id)}
          onDoubleClick={() => setRenamingTarget({ type: 'category', id: cat.id })}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCtxMenu({ x: e.clientX, y: e.clientY, type: 'category', data: cat });
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-amber-500" />
          )}
          {isRenaming ? (
            <InlineRenameInput
              value={cat.name}
              onSave={(v) => handleRenameCategory(cat.id, v)}
              onCancel={() => setRenamingTarget(null)}
            />
          ) : (
            <span className="text-sm truncate flex-1">{cat.name}</span>
          )}
          {count > 0 && !isRenaming && (
            <span className="text-xs text-muted-foreground tabular-nums mr-1">{count}</span>
          )}
        </div>

        {isExpanded && (
          <div className="space-y-0.5">
            {/* 子分类拖拽 */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleCategoryDragEnd(e, cat.id)}>
              <SortableContext items={sortedChildCats.map(c => c.id)}>
                {sortedChildCats.map((child) => renderCategory(child, depth + 1))}
              </SortableContext>
            </DndContext>
            {/* 书籍拖拽 */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleBookDragEnd(e, cat.id)}>
              <SortableContext items={sortedCatBooks.map(b => b.filename)}>
                {sortedCatBooks.map((book) => renderBookItem(book, depth + 1))}
              </SortableContext>
            </DndContext>
            {isCreatingHere && (
              <InlineCreateInput
                placeholder={t('reader.categoryName', { defaultValue: '分类名称' })}
                onSave={(name) => handleCreateCategory(cat.id, name)}
                onCancel={() => setCreatingIn(null)}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  // ── 未分类 ──
  const uncategorizedBooks = getSortedBooks(null);

  const renderUncategorized = () => {
    if (uncategorizedBooks.length === 0 && categories.length === 0) return null;
    const isExpanded = expanded.has('__uncategorized__');

    return (
      uncategorizedBooks.length > 0 && (
        <div>
          <div
            className="flex items-center gap-1 px-1.5 py-1 rounded-md cursor-pointer hover:bg-accent"
            style={{ paddingLeft: '4px' }}
            onClick={() => toggle('__uncategorized__')}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCtxMenu({ x: e.clientX, y: e.clientY, type: 'uncategorized', data: null });
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {t('reader.uncategorized', { defaultValue: '未分类' })}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums mr-1">{uncategorizedBooks.length}</span>
          </div>
          {isExpanded && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleBookDragEnd(e, null)}>
              <SortableContext items={uncategorizedBooks.map(b => b.filename)}>
                <div className="space-y-0.5">
                  {uncategorizedBooks.map((book) => renderBookItem(book, 1))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )
    );
  };

  const sortedRootCategories = getSortedCategories(null);
  const isCreatingRoot = creatingIn === '__root__';

  // ── 视口感知菜单定位 ──
  const adjustMenuPosition = (x: number, y: number) => {
    // 延迟到下一帧计算，先返回原始位置
    return { x, y };
  };

  // 菜单挂载后调整位置防止溢出
  useEffect(() => {
    if (!menuRef.current || !ctxMenu) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${Math.max(4, vw - rect.width - 4)}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${Math.max(4, vh - rect.height - 4)}px`;
    }
    menuRef.current.focus();
  });

  // ── 导出书籍处理器 ──
  const handleExportBook = async (book: EbookInfo) => {
    const ext = book.filename.split('.').pop() || '';
    const defaultPath = bookTitle(book) + '.' + ext;
    const filePath = await save({
      defaultPath,
      filters: [{ name: 'E-books', extensions: ['md', 'html', 'htm', 'docx', 'pdf', 'epub'] }],
    });
    if (!filePath) return;
    await invoke('export_ebook', { filename: book.filename, destPath: filePath });
  };

  // ── 获取书籍完整路径 ──
  const getBookFullPath = async (book: EbookInfo): Promise<string> => {
    const dir = await invoke<string>('get_ebook_library_dir');
    const sep = dir.includes('\\') ? '\\' : '/';
    return dir + (dir.endsWith('/') || dir.endsWith('\\') ? '' : sep) + book.filename;
  };

  // ── 渲染右键菜单 ──
  const renderContextMenu = () => {
    if (!ctxMenu) return null;

    const { x, y, type, data } = ctxMenu;
    const pos = adjustMenuPosition(x, y);

    return (
      <>
        {/* 点击外部关闭 */}
        <div
          className="fixed inset-0 z-40"
          onClick={closeCtxMenu}
          onContextMenu={(e) => { e.preventDefault(); closeCtxMenu(); }}
        />
        {/* 菜单主体 */}
        <div
          ref={menuRef}
          tabIndex={-1}
          className="fixed z-50 min-w-[10rem] rounded-md border border-border p-1 shadow-lg text-popover-foreground reader-ctx-menu"
          style={{ left: pos.x, top: pos.y }}
          onMouseLeave={() => setOpenSubmenu(null)}
          onFocus={() => menuRef.current?.focus()}
        >
          {/* ── 书籍菜单 ── */}
          {type === 'book' && data && (() => {
            const book = data as EbookInfo;
            const moveTargets = categories.filter((c) => c.id !== book.category_id);
            return (
              <>
                {/* 打开 */}
                <button className={menuItemClass} onClick={() => { closeCtxMenu(); openBook(book); }}>
                  <BookOpen className="h-3.5 w-3.5" />
                  {t('reader.open', { defaultValue: '打开' })}
                </button>
                {/* 收藏 / 取消收藏 */}
                <button className={menuItemClass} onClick={() => { closeCtxMenu(); toggleStarred(book.filename); }}>
                  <Star className={`h-3.5 w-3.5 ${book.starred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                  {book.starred
                    ? t('reader.unstar', { defaultValue: '取消收藏' })
                    : t('reader.star', { defaultValue: '收藏' })}
                </button>
                {/* 重命名 */}
                <button className={menuItemClass} onClick={() => { closeCtxMenu(); setRenamingTarget({ type: 'book', id: book.filename }); }}>
                  <Pencil className="h-3.5 w-3.5" />
                  {t('reader.rename', { defaultValue: '重命名' })}
                </button>
                {/* 移动到 — 子菜单 */}
                {moveTargets.length > 0 && (
                  <div className="relative">
                    <button
                      className={menuItemClass}
                      onMouseEnter={() => setOpenSubmenu('moveBook')}
                      onClick={() => setOpenSubmenu(openSubmenu === 'moveBook' ? null : 'moveBook')}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      {t('reader.moveTo', { defaultValue: '移动到' })}
                      <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                    </button>
                    {openSubmenu === 'moveBook' && (
                      <div
                        className="absolute left-full top-0 ml-0.5 min-w-[8rem] rounded-md border border-border p-1 shadow-lg z-50 reader-ctx-menu"
                        onMouseLeave={() => setOpenSubmenu(null)}
                      >
                        {book.category_id !== null && (
                          <button
                            className={menuItemClass}
                            onClick={() => { closeCtxMenu(); moveBook(book.filename, null); }}
                          >
                            {t('reader.uncategorized', { defaultValue: '未分类' })}
                          </button>
                        )}
                        {moveTargets.map((c) => (
                          <button
                            key={c.id}
                            className={menuItemClass}
                            onClick={() => { closeCtxMenu(); moveBook(book.filename, c.id); }}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* 排序 — 子菜单 */}
                <div className="relative">
                  <button
                    className={menuItemClass}
                    onMouseEnter={() => setOpenSubmenu('sort')}
                    onClick={() => setOpenSubmenu(openSubmenu === 'sort' ? null : 'sort')}
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {t('reader.sort', { defaultValue: '排序' })}
                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                  </button>
                  {openSubmenu === 'sort' && (
                    <div
                      className="absolute left-full top-0 ml-0.5 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md z-50"
                      onMouseLeave={() => setOpenSubmenu(null)}
                    >
                      <button className={menuItemClass} onClick={() => { closeCtxMenu(); handleToggleSort('custom'); }}>
                        <span className="flex-1">{t('reader.sortCustom', { defaultValue: '自定义（拖动）' })}</span>
                        {sortField === 'custom' && <GripVertical className="h-3 w-3 ml-2" />}
                      </button>
                      <button className={menuItemClass} onClick={() => { closeCtxMenu(); handleToggleSort('name'); }}>
                        <span className="flex-1">{t('reader.sortByName', { defaultValue: '按名称' })}</span>
                        {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-2" /> : <ArrowDown className="h-3 w-3 ml-2" />)}
                      </button>
                      <button className={menuItemClass} onClick={() => { closeCtxMenu(); handleToggleSort('addedAt'); }}>
                        <span className="flex-1">{t('reader.sortByAddedAt', { defaultValue: '按添加时间' })}</span>
                        {sortField === 'addedAt' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-2" /> : <ArrowDown className="h-3 w-3 ml-2" />)}
                      </button>
                      <button className={menuItemClass} onClick={() => { closeCtxMenu(); handleToggleSort('lastReadAt'); }}>
                        <span className="flex-1">{t('reader.sortByLastRead', { defaultValue: '最近阅读' })}</span>
                        {sortField === 'lastReadAt' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-2" /> : <ArrowDown className="h-3 w-3 ml-2" />)}
                      </button>
                    </div>
                  )}
                </div>
                {/* 分隔线 */}
                <div className="-mx-1 my-1 h-px bg-border" />
                {/* 导出/另存为 */}
                <button className={menuItemClass} onClick={() => { closeCtxMenu(); handleExportBook(book); }}>
                  <Download className="h-3.5 w-3.5" />
                  {t('reader.exportBook', { defaultValue: '导出/另存为' })}
                </button>
                {/* 分隔线 */}
                <div className="-mx-1 my-1 h-px bg-border" />
                {/* 复制书名 */}
                <button className={menuItemClass} onClick={() => { closeCtxMenu(); navigator.clipboard.writeText(bookTitle(book)); }}>
                  <Copy className="h-3.5 w-3.5" />
                  {t('reader.copyTitle', { defaultValue: '复制书名' })}
                </button>
                {/* 复制文件路径 */}
                <button className={menuItemClass} onClick={async () => {
                  closeCtxMenu();
                  const fullPath = await getBookFullPath(book);
                  await navigator.clipboard.writeText(fullPath);
                }}>
                  <Copy className="h-3.5 w-3.5" />
                  {t('reader.copyFilePath', { defaultValue: '复制文件路径' })}
                </button>
                {/* 复制书籍信息 */}
                <button className={menuItemClass} onClick={() => {
                  closeCtxMenu();
                  const info = `${bookTitle(book)} | ${t('reader.propFormat', { defaultValue: '格式' })}: ${book.format.toUpperCase()} | ${t('reader.propSize', { defaultValue: '大小' })}: ${formatFileSize(book.size_bytes)} | ${t('reader.propAddedAt', { defaultValue: '添加时间' })}: ${new Date(book.added_at).toLocaleDateString()}`;
                  navigator.clipboard.writeText(info);
                }}>
                  <FileText className="h-3.5 w-3.5" />
                  {t('reader.copyBookInfo', { defaultValue: '复制书籍信息' })}
                </button>
                {/* 分隔线 */}
                <div className="-mx-1 my-1 h-px bg-border" />
                {/* 在文件夹中显示 */}
                <button className={menuItemClass} onClick={async () => {
                  closeCtxMenu();
                  const fullPath = await getBookFullPath(book);
                  await invoke('show_in_folder', { path: fullPath });
                }}>
                  <FolderOpen className="h-3.5 w-3.5" />
                  {t('reader.showInFolder', { defaultValue: '在文件夹中显示' })}
                </button>
                {/* 属性 */}
                <button className={menuItemClass} onClick={() => { closeCtxMenu(); setPropertiesBook(book); }}>
                  <Info className="h-3.5 w-3.5" />
                  {t('reader.properties', { defaultValue: '属性' })}
                </button>
                {/* 分隔线 */}
                <div className="-mx-1 my-1 h-px bg-border" />
                {/* 删除 */}
                <button className={`${menuItemClass} text-destructive`} onClick={() => { closeCtxMenu(); handleDeleteBook(book); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('reader.delete', { defaultValue: '删除' })}
                </button>
              </>
            );
          })()}

          {/* ── 分类菜单 ── */}
          {type === 'category' && data && (() => {
            const cat = data as EbookCategory;
            const descIds = descendantIds(categories, cat.id);
            const moveTargets = categories.filter(c => c.id !== cat.id && !descIds.includes(c.id));
            return (
              <>
                {/* 导入到此分类 */}
                <button className={menuItemClass} onClick={() => { closeCtxMenu(); handleImport(cat.id); }}>
                  <Plus className="h-3.5 w-3.5" />
                  {t('reader.importToCategory', { defaultValue: '导入到此分类' })}
                </button>
                {/* 新建子分类 */}
                <button className={menuItemClass} onClick={() => { closeCtxMenu(); setCreatingIn(cat.id); }}>
                  <FolderPlus className="h-3.5 w-3.5" />
                  {t('reader.createSubcategory', { defaultValue: '新建子分类' })}
                </button>
                {/* 重命名 */}
                <button className={menuItemClass} onClick={() => { closeCtxMenu(); setRenamingTarget({ type: 'category', id: cat.id }); }}>
                  <Pencil className="h-3.5 w-3.5" />
                  {t('reader.rename', { defaultValue: '重命名' })}
                </button>
                {/* 移动分类到 — 子菜单 */}
                {(cat.parent_id !== null || moveTargets.length > 0) && (
                  <div className="relative">
                    <button
                      className={menuItemClass}
                      onMouseEnter={() => setOpenSubmenu('moveCategory')}
                      onClick={() => setOpenSubmenu(openSubmenu === 'moveCategory' ? null : 'moveCategory')}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      {t('reader.moveCategoryTo', { defaultValue: '移动分类到' })}
                      <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                    </button>
                    {openSubmenu === 'moveCategory' && (
                      <div
                        className="absolute left-full top-0 ml-0.5 min-w-[8rem] rounded-md border border-border p-1 shadow-lg z-50 reader-ctx-menu"
                        onMouseLeave={() => setOpenSubmenu(null)}
                      >
                        {cat.parent_id !== null && (
                          <button
                            className={menuItemClass}
                            onClick={() => { closeCtxMenu(); moveCategory(cat.id, null); }}
                          >
                            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                            {t('reader.rootLevel', { defaultValue: '根级别' })}
                          </button>
                        )}
                        {moveTargets.map((c) => (
                          <button
                            key={c.id}
                            className={menuItemClass}
                            onClick={() => { closeCtxMenu(); moveCategory(cat.id, c.id); }}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* 分隔线 */}
                <div className="-mx-1 my-1 h-px bg-border" />
                {/* 删除 */}
                <button className={`${menuItemClass} text-destructive`} onClick={() => { closeCtxMenu(); handleDeleteCategory(cat); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('reader.delete', { defaultValue: '删除' })}
                </button>
              </>
            );
          })()}

          {/* ── 未分类菜单 ── */}
          {type === 'uncategorized' && (
            <>
              {/* 导入到未分类 */}
              <button className={menuItemClass} onClick={() => { closeCtxMenu(); handleImport(null); }}>
                <Plus className="h-3.5 w-3.5" />
                {t('reader.importToUncategorized', { defaultValue: '导入到未分类' })}
              </button>
              {/* 分隔线 */}
              <div className="-mx-1 my-1 h-px bg-border" />
              {/* 展开全部分类 */}
              <button className={menuItemClass} onClick={() => { closeCtxMenu(); expandAll(); }}>
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {t('reader.expandAllCategories', { defaultValue: '展开全部分类' })}
              </button>
              {/* 折叠全部分类 */}
              <button className={menuItemClass} onClick={() => { closeCtxMenu(); collapseAll(); }}>
                <ChevronsDownUp className="h-3.5 w-3.5" />
                {t('reader.collapseAllCategories', { defaultValue: '折叠全部分类' })}
              </button>
            </>
          )}

          {/* ── 空白区域菜单 ── */}
          {type === 'empty' && (
            <>
              {/* 导入文件 */}
              <button className={menuItemClass} onClick={() => { closeCtxMenu(); handleImport(null); }}>
                <Plus className="h-3.5 w-3.5" />
                {t('reader.importFile', { defaultValue: '导入文件' })}
              </button>
              {/* 新建分类 */}
              <button className={menuItemClass} onClick={() => { closeCtxMenu(); setCreatingIn('__root__'); }}>
                <FolderPlus className="h-3.5 w-3.5" />
                {t('reader.createCategory', { defaultValue: '新建分类' })}
              </button>
            </>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="p-2 relative h-full flex flex-col">
      {/* 头部工具栏 — 与 FileTree 完全对齐 */}
      <div className="flex items-center justify-end mb-2 px-2 shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={expandAll} className="h-6 w-6"
            title={t('reader.expandAllCategories', { defaultValue: '展开全部分类' })}>
            <ChevronsUpDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" onClick={collapseAll} className="h-6 w-6"
            title={t('reader.collapseAllCategories', { defaultValue: '折叠全部分类' })}>
            <ChevronsDownUp className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"
                title={t('reader.sort', { defaultValue: '排序' })}>
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => handleToggleSort('custom')}>
                <span className="flex-1">{t('reader.sortCustom', { defaultValue: '自定义（拖动）' })}</span>
                {sortField === 'custom' && <GripVertical className="h-3 w-3 ml-2" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleSort('name')}>
                <span className="flex-1">{t('reader.sortByName', { defaultValue: '按名称' })}</span>
                {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-2" /> : <ArrowDown className="h-3 w-3 ml-2" />)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleSort('addedAt')}>
                <span className="flex-1">{t('reader.sortByAddedAt', { defaultValue: '按添加时间' })}</span>
                {sortField === 'addedAt' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-2" /> : <ArrowDown className="h-3 w-3 ml-2" />)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleSort('lastReadAt')}>
                <span className="flex-1">{t('reader.sortByLastRead', { defaultValue: '最近阅读' })}</span>
                {sortField === 'lastReadAt' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-2" /> : <ArrowDown className="h-3 w-3 ml-2" />)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={starredFilter ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
                title={t('reader.filter', { defaultValue: '筛选' })}>
                <Filter className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setStarredFilter(false)}>
                <span className="flex-1">{t('reader.filterAll', { defaultValue: '全部书籍' })}</span>
                {!starredFilter && <Check className="h-3 w-3 ml-2" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStarredFilter(true)}>
                <Star className="h-3 w-3 mr-1.5 text-yellow-500" />
                <span className="flex-1">{t('reader.filterStarred', { defaultValue: '收藏书籍' })}</span>
                {starredFilter && <Check className="h-3 w-3 ml-2" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => setSearchOpen(!searchOpen)} className={`h-6 w-6 ${searchOpen ? 'bg-accent' : ''}`}
            title={t('reader.searchPlaceholder', { defaultValue: '搜索书名...' })}>
            <Search className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleImport(null)} disabled={isLoading} className="h-6 w-6"
            title={t('reader.importFile', { defaultValue: '导入文件' })}>
            <Plus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCreatingIn('__root__')} className="h-6 w-6"
            title={t('reader.createCategory', { defaultValue: '新建分类' })}>
            <FolderPlus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 可折叠搜索行 */}
      {searchOpen && (
        <div className="mb-2 px-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('reader.searchPlaceholder', { defaultValue: '搜索书名...' })}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background
                placeholder:text-muted-foreground/60
                focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/50"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 p-0.5 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 书库列表 */}
      <div className="flex-1 overflow-y-auto reader-scroll">
        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center text-muted-foreground">
            <BookOpen className="h-16 w-16 mb-4 opacity-15 stroke-1" />
            <p className="text-sm font-medium mb-1">{t('reader.emptyLibrary', { defaultValue: '书库为空' })}</p>
            <p className="text-xs opacity-70">
              {t('reader.dragOrImport', { defaultValue: '拖拽文件到窗口或点击导入按钮' })}
            </p>
          </div>
        ) : searchQuery.trim() ? (
          searchResults !== null && (
            searchResults.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                {t('common.noResults', { defaultValue: '无匹配结果' })}
              </div>
            ) : (
              <div className="space-y-0.5">
                {searchResults.map((book) => renderBookItem(book, 0))}
              </div>
            )
          )
        ) : (
          <div className="space-y-0.5">
            {/* 根级分类拖拽 */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleCategoryDragEnd(e, null)}>
              <SortableContext items={sortedRootCategories.map(c => c.id)}>
                {sortedRootCategories.map((cat) => renderCategory(cat, 0))}
              </SortableContext>
            </DndContext>
            {isCreatingRoot && (
              <InlineCreateInput
                placeholder={t('reader.categoryName', { defaultValue: '分类名称' })}
                onSave={(name) => handleCreateCategory(null, name)}
                onCancel={() => setCreatingIn(null)}
              />
            )}
            {renderUncategorized()}
          </div>
        )}
        {/* 空白区域：右键可导入/新建分类 */}
        <div
          className="flex-1 min-h-[40px]"
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY, type: 'empty', data: null });
          }}
        />
      </div>

      {/* 右键菜单 */}
      {renderContextMenu()}

      {/* 书籍属性对话框 */}
      <BookPropertiesDialog
        book={propertiesBook}
        open={!!propertiesBook}
        onOpenChange={(open) => { if (!open) setPropertiesBook(null); }}
        categories={categories}
        readingProgress={readingProgress}
        t={t}
      />
    </div>
  );
}
