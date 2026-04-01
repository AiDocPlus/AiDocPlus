// ── 书库管理视图 ──

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useReaderStore, type EbookInfo, type EbookCategory, type ReaderSortField } from '../useReaderStore';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { S } from '../styles';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { BookOpen, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { BookItem } from '../components/library/BookItem';
import { BookGrid } from '../components/library/BookGrid';
import { BookContextMenu } from '../components/library/BookContextMenu';
import { CategoryContextMenu } from '../components/library/CategoryContextMenu';
import { BookPropertiesDialog } from '../components/library/BookPropertiesDialog';
import { InlineRenameInput } from '../components/library/InlineRenameInput';
import { InlineCreateInput } from '../components/library/InlineCreateInput';
import { LibraryToolbar } from '../components/library/LibraryToolbar';

// ── 树状辅助 ──

function childCategories(categories: EbookCategory[], parentId: string | null): EbookCategory[] {
  return categories.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
}

function booksInCategory(books: EbookInfo[], categoryId: string | null): EbookInfo[] {
  return books.filter(b => b.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order);
}

function descendantIds(categories: EbookCategory[], id: string): string[] {
  const result: string[] = [id];
  const visited = new Set<string>([id]);
  // 预构建 parent -> children 映射，避免 O(n) 遍历
  const childrenMap = new Map<string, EbookCategory[]>();
  for (const c of categories) {
    if (c.parent_id != null) {
      const list = childrenMap.get(c.parent_id) || [];
      list.push(c);
      childrenMap.set(c.parent_id, list);
    }
  }
  let i = 0;
  while (i < result.length) {
    const children = childrenMap.get(result[i]) || [];
    for (const c of children) {
      if (!visited.has(c.id)) {
        visited.add(c.id);
        result.push(c.id);
      }
    }
    i++;
  }
  return result;
}

function totalBooksInTree(categories: EbookCategory[], books: EbookInfo[], catId: string): number {
  const ids = new Set(descendantIds(categories, catId));
  return books.filter(b => b.category_id != null && ids.has(b.category_id)).length;
}

function sortItems<T>(
  items: T[], field: ReaderSortField, direction: 'asc' | 'desc',
  nameKey: keyof T, dateKey: keyof T, lastReadMap?: Record<string, string>,
  getFilename?: (item: T) => string | undefined,
  getFormat?: (item: T) => string | undefined,
  getSizeBytes?: (item: T) => number | undefined,
  getAuthor?: (item: T) => string | undefined,
): T[] {
  if (field === 'custom') return items;
  const dir = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    switch (field) {
      case 'name': return dir * String(a[nameKey] ?? '').localeCompare(String(b[nameKey] ?? ''));
      case 'addedAt': return dir * String(a[dateKey] ?? '').localeCompare(String(b[dateKey] ?? ''));
      case 'lastReadAt': {
        if (!lastReadMap || !getFilename) return 0;
        const aTime = lastReadMap[getFilename(a) ?? ''] ?? '';
        const bTime = lastReadMap[getFilename(b) ?? ''] ?? '';
        if (!aTime && !bTime) return 0;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return dir * aTime.localeCompare(bTime);
      }
      case 'format': return dir * String(getFormat?.(a) ?? '').localeCompare(String(getFormat?.(b) ?? ''));
      case 'size': return dir * (getSizeBytes?.(a) ?? 0) - (getSizeBytes?.(b) ?? 0);
      case 'author': return dir * String(getAuthor?.(a) ?? '').localeCompare(String(getAuthor?.(b) ?? ''));
      default: return 0;
    }
  });
}

// ── 分类树组件 ──

function CategoryTree({
  categories, books, filteredBooks, sortField, sortDirection, lastReadMap,
  expanded, renamingTarget, creatingIn,
  sensors, onToggle, onRenameTarget, onCreateIn,
  onRenameCategory, onCreateCategory, onBookDragEnd, onCategoryDragEnd,
  onCtxMenu, readingProgress, openBook, t,
}: {
  categories: EbookCategory[];
  books: EbookInfo[];
  filteredBooks: EbookInfo[];
  sortField: ReaderSortField;
  sortDirection: 'asc' | 'desc';
  lastReadMap: Record<string, string>;
  expanded: Set<string>;
  renamingTarget: { type: 'book' | 'category'; id: string } | null;
  creatingIn: string | null;
  sensors: ReturnType<typeof useSensors>;
  onToggle: (id: string) => void;
  onRenameTarget: (t: { type: 'book' | 'category'; id: string } | null) => void;
  onCreateIn: (id: string | null) => void;
  onRenameCategory: (id: string, name: string) => void;
  onCreateCategory: (parentId: string | null, name: string) => void;
  onBookDragEnd: (e: DragEndEvent, categoryId: string | null) => void;
  onCategoryDragEnd: (e: DragEndEvent, parentId: string | null) => void;
  onCtxMenu: (e: React.MouseEvent, type: string, data: any) => void;
  readingProgress: Record<string, any>;
  openBook: (book: EbookInfo) => void;
  t: (key: string, opts?: any) => string;
}) {
  const sortedRootCategories = sortItems(childCategories(categories, null), sortField, sortDirection, 'name', 'sort_order');
  const uncategorizedBooks = sortItems(
    booksInCategory(filteredBooks, null), sortField, sortDirection, 'display_name', 'added_at', lastReadMap,
    (b) => b.filename, (b) => b.format, (b) => b.size_bytes, (b) => b.author,
  );
  const isCreatingRoot = creatingIn === '__root__';

  const renderCategory = (cat: EbookCategory, depth: number) => {
    const isExpanded = expanded.has(cat.id);
    const count = totalBooksInTree(categories, books, cat.id);
    const isRenaming = renamingTarget?.type === 'category' && renamingTarget.id === cat.id;
    const isCreatingHere = creatingIn === cat.id;

    const sortedChildCats = sortItems(childCategories(categories, cat.id), sortField, sortDirection, 'name', 'sort_order');
    const sortedCatBooks = sortItems(
      booksInCategory(filteredBooks, cat.id), sortField, sortDirection, 'display_name', 'added_at', lastReadMap,
      (b) => b.filename, (b) => b.format, (b) => b.size_bytes, (b) => b.author,
    );

    return (
      <div key={cat.id}>
        <div
          onClick={() => onToggle(cat.id)}
          onDoubleClick={() => onRenameTarget({ type: 'category', id: cat.id })}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onCtxMenu(e, 'category', cat); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
            paddingLeft: `${depth * 16 + 6}px`,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = S.colors.hoverBg; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          {isExpanded ? <ChevronDown size={12} style={{ color: S.colors.textMuted, flexShrink: 0 }} /> : <ChevronRight size={12} style={{ color: S.colors.textMuted, flexShrink: 0 }} />}
          {isExpanded
            ? <FolderOpen size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
            : <Folder size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
          }
          {isRenaming ? (
            <InlineRenameInput
              value={cat.name}
              onSave={v => onRenameCategory(cat.id, v)}
              onCancel={() => onRenameTarget(null)}
            />
          ) : (
            <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
          )}
          {!isRenaming && count > 0 && (
            <span style={{ fontSize: 11, color: S.colors.textMuted, fontVariantNumeric: 'tabular-nums', marginRight: 4 }}>{count}</span>
          )}
        </div>

        {isExpanded && (
          <div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onCategoryDragEnd(e, cat.id)}>
              <SortableContext items={sortedChildCats.map(c => c.id)}>
                {sortedChildCats.map(child => renderCategory(child, depth + 1))}
              </SortableContext>
            </DndContext>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onBookDragEnd(e, cat.id)}>
              <SortableContext items={sortedCatBooks.map(b => b.filename)}>
                {sortedCatBooks.map(book => {
                  const isRen = renamingTarget?.type === 'book' && renamingTarget.id === book.filename;
                  return (
                    <BookItem
                      key={book.filename} book={book} isActive={false} depth={depth + 1}
                      showDragHandle={sortField === 'custom'}
                      readingProgress={readingProgress} isRenaming={isRen}
                      onClick={() => openBook(book)}
                      onDoubleClick={() => onRenameTarget({ type: 'book', id: book.filename })}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onCtxMenu(e, 'book', book); }}
                      renameInput={isRen ? (
                        <InlineRenameInput
                          value={book.display_name || book.original_name || book.filename}
                          onSave={v => { onRenameTarget(null); useReaderStore.getState().renameBook(book.filename, v); }}
                          onCancel={() => onRenameTarget(null)}
                        />
                      ) : undefined}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
            {isCreatingHere && (
              <div style={{ paddingLeft: `${(depth + 1) * 16 + 6}px` }}>
                <InlineCreateInput
                  placeholder={t('reader.categoryName', { defaultValue: '分类名称' })}
                  onSave={name => onCreateCategory(cat.id, name)}
                  onCancel={() => onCreateIn(null)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 根级分类 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onCategoryDragEnd(e, null)}>
        <SortableContext items={sortedRootCategories.map(c => c.id)}>
          {sortedRootCategories.map(cat => renderCategory(cat, 0))}
        </SortableContext>
      </DndContext>
      {isCreatingRoot && (
        <InlineCreateInput
          placeholder={t('reader.categoryName', { defaultValue: '分类名称' })}
          onSave={name => onCreateCategory(null, name)}
          onCancel={() => onCreateIn(null)}
        />
      )}

      {/* 未分类 */}
      {uncategorizedBooks.length > 0 && (
        <div>
          <div
            onClick={() => onToggle('__uncategorized__')}
            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onCtxMenu(e, 'uncategorized', null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = S.colors.hoverBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {expanded.has('__uncategorized__') ? <ChevronDown size={12} style={{ color: S.colors.textMuted }} /> : <ChevronRight size={12} style={{ color: S.colors.textMuted }} />}
            <BookOpen size={16} style={{ color: S.colors.textMuted }} />
            <span style={{ flex: 1, fontSize: 13, color: S.colors.textMuted }}>{t('reader.uncategorized', { defaultValue: '未分类' })}</span>
            <span style={{ fontSize: 11, color: S.colors.textMuted }}>{uncategorizedBooks.length}</span>
          </div>
          {expanded.has('__uncategorized__') && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onBookDragEnd(e, null)}>
              <SortableContext items={uncategorizedBooks.map(b => b.filename)}>
                <div>
                  {uncategorizedBooks.map(book => {
                    const isRen = renamingTarget?.type === 'book' && renamingTarget.id === book.filename;
                    return (
                      <BookItem
                        key={book.filename} book={book} isActive={false} depth={1}
                        showDragHandle={sortField === 'custom'}
                        readingProgress={readingProgress} isRenaming={isRen}
                        onClick={() => openBook(book)}
                        onDoubleClick={() => onRenameTarget({ type: 'book', id: book.filename })}
                        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onCtxMenu(e, 'book', book); }}
                        renameInput={isRen ? (
                          <InlineRenameInput
                            value={book.display_name || book.original_name || book.filename}
                            onSave={v => { onRenameTarget(null); useReaderStore.getState().renameBook(book.filename, v); }}
                            onCancel={() => onRenameTarget(null)}
                          />
                        ) : undefined}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}

// ── 主视图 ──

export function LibraryView() {
  const { t } = useTranslation();
  const {
    books, categories, isLoading, readingProgress,
    sortField, sortDirection, starredFilter, readingStatusFilter,
    openBook,
    renameCategory, moveBook, moveCategory,
    createCategory, deleteCategory,
    reorderBooks, reorderCategories,
    toggleStarred,
    setSortField, setSortDirection, setStarredFilter, setReadingStatusFilter,
    updateEbookMetadata,
    libraryViewMode, setLibraryViewMode,
    expandedCategories, setExpandedCategories,
  } = useReaderStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const expanded = useMemo(() => new Set(expandedCategories), [expandedCategories]);
  const setExpanded = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const current = new Set(expandedCategories);
    const next = typeof updater === 'function' ? (updater as (prev: Set<string>) => Set<string>)(current) : updater;
    setExpandedCategories([...next]);
  }, [expandedCategories, setExpandedCategories]);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const handleOpenBook = useCallback((book: EbookInfo) => {
    setActiveCategoryId(book.category_id);
    openBook(book);
  }, [openBook]);
  const [renamingTarget, setRenamingTarget] = useState<{ type: 'book' | 'category'; id: string } | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [propertiesBook, setPropertiesBook] = useState<EbookInfo | null>(null);

  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; type: string; data: EbookInfo | EbookCategory | null } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const allCategoryIds = useMemo(() => [...categories.map(c => c.id), '__uncategorized__'], [categories]);
  const allExpanded = allCategoryIds.length > 0 && allCategoryIds.every(id => expandedCategories.includes(id));
  const toggleAllExpanded = useCallback(() => {
    if (allExpanded) setExpandedCategories([]);
    else setExpandedCategories(allCategoryIds);
  }, [allExpanded, allCategoryIds, setExpandedCategories]);
  const toggle = (id: string) => setExpanded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const handleToggleSort = (field: ReaderSortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    let result = books.filter(b =>
      (b.display_name || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.original_name || '').toLowerCase().includes(q) ||
      b.filename.toLowerCase().includes(q),
    );
    if (starredFilter) result = result.filter(b => b.starred);
    if (readingStatusFilter) result = result.filter(b => b.reading_status === readingStatusFilter);
    return result;
  }, [books, searchQuery, starredFilter, readingStatusFilter]);

  const lastReadMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(readingProgress)) {
      if (v.lastReadAt) map[k] = v.lastReadAt;
    }
    return map;
  }, [readingProgress]);

  const filteredBooks = useMemo(() => {
    let result = books;
    if (starredFilter) result = result.filter(b => b.starred);
    if (readingStatusFilter) result = result.filter(b => b.reading_status === readingStatusFilter);
    return result;
  }, [books, starredFilter, readingStatusFilter]);

  const handleImport = useCallback(async (categoryId?: string | null) => {
    setCtxMenu(null);
    const targetCategoryId = categoryId ?? activeCategoryId;
    const filePath = await open({
      multiple: true,
      filters: [{ name: 'E-books', extensions: ['md', 'html', 'htm', 'docx', 'pdf', 'epub'] }],
    });
    if (!filePath) return;
    const paths = Array.isArray(filePath) ? filePath : [filePath];
    // 批量导入：逐个调用 importFileRaw，最后只刷新一次 loadLibrary
    const store = useReaderStore.getState();
    let lastBook: EbookInfo | null = null;
    for (const p of paths) {
      const book = await store.importFileRaw(p as string, targetCategoryId);
      if (book) lastBook = book;
    }
    await store.loadLibrary();
    // 仅打开最后一本导入的书
    if (lastBook) handleOpenBook(lastBook);
  }, [handleOpenBook, activeCategoryId]);

  const handleBookDragEnd = useCallback((event: DragEndEvent, categoryId: string | null) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = booksInCategory(filteredBooks, categoryId);
    const ids = items.map(b => b.filename);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    reorderBooks(categoryId, arrayMove(ids, oldIdx, newIdx));
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
    reorderCategories(parentId, arrayMove(ids, oldIdx, newIdx));
    if (sortField !== 'custom') setSortField('custom');
  }, [categories, sortField, setSortField, reorderCategories]);

  const handleCreateCategory = async (parentId: string | null, name: string) => {
    setCreatingIn(null);
    if (!name.trim()) return;
    const cat = await createCategory(name.trim(), parentId);
    if (cat && parentId) setExpanded(prev => new Set(prev).add(parentId));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>{t('reader.library', { defaultValue: '书库' })}</span>
        <span style={S.headerSubtitle}>{books.length} {t('reader.books', { defaultValue: '本' })}</span>
      </div>

      {/* 工具栏 */}
      <LibraryToolbar
        isLoading={isLoading}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        starredFilter={starredFilter}
        readingStatusFilter={readingStatusFilter}
        sortField={sortField}
        sortDirection={sortDirection}
        onToggleSearch={() => setSearchOpen(!searchOpen)}
        onSearchQueryChange={setSearchQuery}
        onToggleStarredFilter={setStarredFilter}
        onSetReadingStatusFilter={setReadingStatusFilter}
        onToggleSort={handleToggleSort}
        libraryViewMode={libraryViewMode}
        onSetLibraryViewMode={setLibraryViewMode}
        onImport={() => handleImport()}
        onCreateCategory={() => setCreatingIn('__root__')}
        allExpanded={allExpanded}
        onToggleAllExpanded={toggleAllExpanded}
      />

      {/* 树 / 搜索结果 / 空状态 */}
      <div style={{ ...S.scrollContainer, flex: 1 }}>
        {books.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, textAlign: 'center', color: S.colors.textMuted }}>
            <BookOpen size={64} style={{ marginBottom: 16, opacity: 0.15, strokeWidth: 1 }} />
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{t('reader.emptyLibrary', { defaultValue: '书库为空' })}</p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>{t('reader.dragOrImport', { defaultValue: '拖拽文件到窗口或点击导入按钮' })}</p>
          </div>
        ) : searchQuery.trim() && searchResults !== null ? (
          searchResults.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: S.colors.textMuted, fontSize: 12 }}>
              {t('common.noResults', { defaultValue: '无匹配结果' })}
            </div>
          ) : libraryViewMode === 'grid' ? (
            <BookGrid
              books={searchResults}
              readingProgress={readingProgress}
              onOpenBook={openBook}
              onContextMenu={(e, book) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'book', data: book }); }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {searchResults.map(book => (
                <BookItem
                  key={book.filename} book={book} isActive={false} depth={0}
                  showDragHandle={false} readingProgress={readingProgress} isRenaming={false}
                  onClick={() => handleOpenBook(book)}
                  onDoubleClick={() => {}}
                  onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'book', data: book }); }}
                />
              ))}
            </div>
          )
        ) : (
          <CategoryTree
            categories={categories} books={books} filteredBooks={filteredBooks}
            sortField={sortField} sortDirection={sortDirection} lastReadMap={lastReadMap}
            expanded={expanded} renamingTarget={renamingTarget} creatingIn={creatingIn}
            sensors={sensors}
            onToggle={toggle} onRenameTarget={setRenamingTarget} onCreateIn={setCreatingIn}
            onRenameCategory={async (id, name) => { setRenamingTarget(null); await renameCategory(id, name); }}
            onCreateCategory={handleCreateCategory}
            onBookDragEnd={handleBookDragEnd} onCategoryDragEnd={handleCategoryDragEnd}
            onCtxMenu={(e, type, data) => setCtxMenu({ x: e.clientX, y: e.clientY, type, data })}
            readingProgress={readingProgress} openBook={handleOpenBook} t={t}
          />
        )}

        {/* 空白区域右键 */}
        <div
          style={{ minHeight: 40 }}
          onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, type: 'empty', data: null }); }}
        />
      </div>

      {/* 书籍右键菜单 */}
      {ctxMenu?.type === 'book' && ctxMenu.data && (
        <BookContextMenu
          book={ctxMenu.data as EbookInfo} x={ctxMenu.x} y={ctxMenu.y} categories={categories}
          onClose={() => setCtxMenu(null)}
          onOpen={handleOpenBook} onToggleStarred={toggleStarred}
          onRename={book => setRenamingTarget({ type: 'book', id: book.filename })}
          onMove={(filename, categoryId) => moveBook(filename, categoryId)}
          onDelete={async book => {
            const confirmed = await ask(t('reader.deleteConfirm', { defaultValue: '确认删除此文件？' }), { title: t('reader.delete', { defaultValue: '删除' }), kind: 'warning' });
            if (confirmed) await useReaderStore.getState().deleteBook(book.filename);
          }}
          sortField={sortField} sortDirection={sortDirection} onToggleSort={handleToggleSort}
          onUpdateReadingStatus={(filename, status) => updateEbookMetadata(filename, status)}
        />
      )}

      {/* 分类/未分类/空白右键菜单 */}
      {(ctxMenu?.type === 'category' || ctxMenu?.type === 'uncategorized' || ctxMenu?.type === 'empty') && (
        <CategoryContextMenu
          type={ctxMenu.type as 'category' | 'uncategorized' | 'empty'} x={ctxMenu.x} y={ctxMenu.y} data={ctxMenu.data as EbookCategory | null} categories={categories}
          onClose={() => setCtxMenu(null)}
          onImport={handleImport}
          onCreateSubcategory={parentId => setCreatingIn(parentId)}
          onRename={cat => setRenamingTarget({ type: 'category', id: cat.id })}
          onMoveCategory={moveCategory}
          onDelete={async cat => {
            const confirmed = await ask(t('reader.deleteCategoryConfirm', { defaultValue: '删除分类？' }), { title: t('reader.delete', { defaultValue: '删除' }), kind: 'warning' });
            if (confirmed) await deleteCategory(cat.id, true);
          }}
          onExpandAll={toggleAllExpanded} onCollapseAll={toggleAllExpanded}
          onCreateRootCategory={() => setCreatingIn('__root__')}
        />
      )}

      {/* 书籍属性对话框 */}
      <BookPropertiesDialog
        book={propertiesBook} open={!!propertiesBook} onClose={() => setPropertiesBook(null)}
        categories={categories} readingProgress={readingProgress} t={t}
      />
    </div>
  );
}
