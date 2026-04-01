// ── 书库工具栏 ──

import { useTranslation } from '@/i18n';
import type { ReaderSortField } from '../../useReaderStore';
import { S } from '../../styles';
import {
  ChevronsUpDown, ChevronsDownUp, ArrowUpDown, ArrowUp, ArrowDown,
  GripVertical, Filter, Star, Check, Search, Plus, FolderPlus, X,
  BookOpen, BookMarked, BookCheck, Circle, LayoutList, LayoutGrid,
} from 'lucide-react';
import { useMemo } from 'react';
import { useState } from 'react';

interface LibraryToolbarProps {
  isLoading: boolean;
  searchOpen: boolean;
  searchQuery: string;
  starredFilter: boolean;
  readingStatusFilter: string;
  sortField: ReaderSortField;
  sortDirection: 'asc' | 'desc';
  onToggleSearch: () => void;
  onSearchQueryChange: (q: string) => void;
  onToggleStarredFilter: (v: boolean) => void;
  onSetReadingStatusFilter: (v: string) => void;
  onToggleSort: (field: ReaderSortField) => void;
  onImport: () => void;
  onCreateCategory: () => void;
  allExpanded: boolean;
  onToggleAllExpanded: () => void;
  libraryViewMode: 'list' | 'grid';
  onSetLibraryViewMode: (mode: 'list' | 'grid') => void;
}

const STATUS_OPTIONS = [
  { value: '', icon: Circle },
  { value: 'unread', icon: BookOpen },
  { value: 'reading', icon: BookMarked },
  { value: 'completed', icon: BookCheck },
] as const;

export function LibraryToolbar({
  isLoading, searchOpen, searchQuery, starredFilter, readingStatusFilter, sortField, sortDirection,
  onToggleSearch, onSearchQueryChange, onToggleStarredFilter, onSetReadingStatusFilter, onToggleSort,
  onImport, onCreateCategory, allExpanded, onToggleAllExpanded,
  libraryViewMode, onSetLibraryViewMode,
}: LibraryToolbarProps) {
  const { t } = useTranslation();
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const ExpandIcon = useMemo(() => allExpanded ? ChevronsDownUp : ChevronsUpDown, [allExpanded]);
  const expandTitle = useMemo(() => allExpanded
    ? t('reader.collapseAllCategories', { defaultValue: '折叠全部分类' })
    : t('reader.expandAllCategories', { defaultValue: '展开全部分类' }),
  [allExpanded, t]);

  const hasActiveFilter = starredFilter || readingStatusFilter !== '';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px' }}>
        <ToolbarButton title={t('reader.importFile', { defaultValue: '导入文件' })} onClick={onImport} disabled={isLoading}>
          <Plus size={14} />
        </ToolbarButton>
        <ToolbarButton title={t('reader.createCategory', { defaultValue: '新建分类' })} onClick={onCreateCategory}>
          <FolderPlus size={14} />
        </ToolbarButton>

        {/* 排序按钮 */}
        <div style={{ position: 'relative' }}>
          <ToolbarButton active={sortOpen} title={t('reader.sort', { defaultValue: '排序' })} onClick={() => setSortOpen(!sortOpen)}>
            <ArrowUpDown size={14} />
          </ToolbarButton>
          {sortOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setSortOpen(false)} />
              <div style={{ ...S.ctxMenu, left: '100%', top: 0, marginLeft: 2, minWidth: 160 }}>
                {(['custom', 'name', 'addedAt', 'lastReadAt', 'format', 'size', 'author'] as const).map(field => (
                  <button key={field} style={S.ctxMenuItem()} onClick={() => { onToggleSort(field); setSortOpen(false); }}>
                    <span style={{ flex: 1 }}>{t(`reader.sort${field.charAt(0).toUpperCase() + field.slice(1)}`, { defaultValue: field })}</span>
                    {sortField === field && field === 'custom' && <GripVertical size={12} style={{ marginLeft: 4 }} />}
                    {sortField === field && field !== 'custom' && (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 筛选按钮 */}
        <div style={{ position: 'relative' }}>
          <ToolbarButton active={hasActiveFilter || filterOpen} title={t('reader.filter', { defaultValue: '筛选' })} onClick={() => setFilterOpen(!filterOpen)}>
            <Filter size={14} />
          </ToolbarButton>
          {filterOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setFilterOpen(false)} />
              <div style={{ ...S.ctxMenu, left: '100%', top: 0, marginLeft: 2, minWidth: 140 }}>
                {/* 全部 */}
                <button style={S.ctxMenuItem()} onClick={() => { onToggleStarredFilter(false); onSetReadingStatusFilter(''); setFilterOpen(false); }}>
                  <span style={{ flex: 1 }}>{t('reader.filterAll', { defaultValue: '全部书籍' })}</span>
                  {!hasActiveFilter && <Check size={12} />}
                </button>
                {/* 收藏 */}
                <button style={S.ctxMenuItem()} onClick={() => { onToggleStarredFilter(!starredFilter); setFilterOpen(false); }}>
                  <Star size={14} style={{ color: '#eab308', marginRight: 6 }} />
                  <span style={{ flex: 1 }}>{t('reader.filterStarred', { defaultValue: '收藏书籍' })}</span>
                  {starredFilter && <Check size={12} />}
                </button>
                <div style={S.ctxMenuSep} />
                {/* 阅读状态筛选 */}
                {STATUS_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const labelKey = opt.value === '' ? 'reader.filterAll' : `reader.status${opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}`;
                  const defaultLabel = opt.value === '' ? '全部书籍' : opt.value;
                  return (
                    <button key={opt.value || '__all__'} style={S.ctxMenuItem()} onClick={() => { onSetReadingStatusFilter(opt.value); setFilterOpen(false); }}>
                      <Icon size={12} style={{ marginRight: 6, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{t(labelKey, { defaultValue: defaultLabel })}</span>
                      {readingStatusFilter === opt.value && opt.value !== '' && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <ToolbarButton active={searchOpen} title={t('reader.searchPlaceholder', { defaultValue: '搜索书名...' })} onClick={onToggleSearch}>
          <Search size={14} />
        </ToolbarButton>

        {/* 视图切换 */}
        <ToolbarButton
          title={libraryViewMode === 'list' ? t('reader.switchToGrid', { defaultValue: '网格视图' }) : t('reader.switchToList', { defaultValue: '列表视图' })}
          onClick={() => onSetLibraryViewMode(libraryViewMode === 'list' ? 'grid' : 'list')}
        >
          {libraryViewMode === 'list' ? <LayoutGrid size={14} /> : <LayoutList size={14} />}
        </ToolbarButton>

        <ToolbarButton title={expandTitle} onClick={onToggleAllExpanded}>
          <ExpandIcon size={14} />
        </ToolbarButton>
      </div>

      {/* 搜索框 */}
      {searchOpen && (
        <div style={{ padding: '0 8px 8px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchQueryChange(e.target.value)}
              placeholder={t('reader.searchPlaceholder', { defaultValue: '搜索书名...' })}
              autoFocus
              style={{ ...S.input, paddingLeft: 28, fontSize: 13 }}
            />
            {searchQuery && (
              <button onClick={() => onSearchQueryChange('')} style={{ position: 'absolute', right: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ title, onClick, active, disabled, children }: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', borderRadius: 4, cursor: disabled ? 'default' : 'pointer',
        background: active ? '#eff6ff' : 'transparent',
        color: active ? '#2563eb' : disabled ? '#cbd5e1' : '#64748b',
      }}
    >
      {children}
    </button>
  );
}
