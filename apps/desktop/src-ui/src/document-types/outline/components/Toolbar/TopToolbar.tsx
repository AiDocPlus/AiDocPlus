/**
 * 主工具栏 — 对齐 CalculatorWorkspace：文档级操作（保存、版本、筛选、视图、导入导出、AI、设置）
 * 节点编辑按钮见 OutlineEditorToolbar（标签页下方）
 */

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
import {
  Undo2,
  Redo2,
  LayoutList,
  Network,
  FileText,
  Settings,
  Upload,
  Download,
  PanelLeft,
  PanelRightClose,
  PanelRightOpen,
  ListTree,
  Save,
  SaveAll,
  History,
  FilePlus,
  ListFilter,
  X,
  GitBranch,
  MonitorPlay,
  ChevronDown,
  Check,
} from 'lucide-react';

import type { FilterState } from '../../types';

const TB_ICON = 'h-7 w-7 shrink-0 p-0';

interface TopToolbarProps {
  documentTitle: string;
  viewMode: 'outline' | 'mindmap' | 'article';
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onCreateVersion: () => void;
  onOpenVersionHistory: () => void;
  onToggleViewMode: () => void;
  onSetViewMode?: (mode: 'outline' | 'mindmap' | 'article') => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  leftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
  aiSidebarOpen: boolean;
  onToggleAISidebar: () => void;
  filterState: FilterState;
  onFilterChange: (patch: Partial<FilterState>) => void;
  onClearFilters: () => void;
  onOpenItemMover?: () => void;
  onOpenPresentation?: () => void;
}

export function TopToolbar({
  documentTitle,
  viewMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onSaveAll,
  onCreateVersion,
  onOpenVersionHistory,
  onToggleViewMode,
  onSetViewMode,
  onOpenSettings,
  onOpenExport,
  onOpenImport,
  leftSidebarOpen,
  onToggleLeftSidebar,
  aiSidebarOpen,
  onToggleAISidebar,
  filterState,
  onFilterChange,
  onClearFilters,
  onOpenItemMover,
  onOpenPresentation,
}: TopToolbarProps) {
  const { t } = useTranslation();

  const hasActiveFilters =
    filterState.selectedTags.size > 0 ||
    filterState.selectedMentions.size > 0 ||
    filterState.searchQuery !== '';

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1 flex-shrink-0">
      <ListTree className={cn('h-4 w-4 shrink-0 text-primary')} aria-hidden />
      <span className="max-w-[min(12rem,28vw)] truncate text-sm font-medium" title={documentTitle}>
        {documentTitle}
      </span>

      <div className="mx-0.5 h-4 w-px bg-border shrink-0" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={TB_ICON}
        disabled={!canUndo}
        onClick={onUndo}
        title={t('common.undo', { defaultValue: '撤销' })}
        aria-label={t('common.undo', { defaultValue: '撤销' })}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={TB_ICON}
        disabled={!canRedo}
        onClick={onRedo}
        title={t('common.redo', { defaultValue: '重做' })}
        aria-label={t('common.redo', { defaultValue: '重做' })}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </Button>

      <div className="mx-0.5 h-4 w-px bg-border shrink-0" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={TB_ICON}
        onClick={() => void onSave()}
        title={t('outline.toolbar.save', { defaultValue: '保存' })}
        aria-label={t('outline.toolbar.save', { defaultValue: '保存' })}
      >
        <Save className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={TB_ICON}
        onClick={() => void onSaveAll()}
        title={t('outline.toolbar.saveAll', { defaultValue: '全部保存' })}
        aria-label={t('outline.toolbar.saveAll', { defaultValue: '全部保存' })}
      >
        <SaveAll className="h-3.5 w-3.5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={TB_ICON}
            title={t('outline.toolbar.versionMenu', { defaultValue: '版本' })}
            aria-label={t('outline.toolbar.versionMenu', { defaultValue: '版本' })}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          <DropdownMenuItem onClick={() => void onCreateVersion()}>
            <FilePlus className="h-4 w-4 mr-2" />
            {t('version.createVersion', { defaultValue: '创建历史版本' })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenVersionHistory}>
            <History className="h-4 w-4 mr-2" />
            {t('version.manageVersions', { defaultValue: '历史版本管理' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={hasActiveFilters ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 gap-1 px-2 text-xs shrink-0"
            title={t('outline.filter.menu', { defaultValue: '筛选节点' })}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('outline.filter.menu', { defaultValue: '筛选' })}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 p-3" onCloseAutoFocus={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              {t('outline.filter.nodeText', { defaultValue: '按文字缩小列表' })}
            </div>
            <div className="relative">
              <Input
                value={filterState.searchQuery}
                onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
                placeholder={t('outline.searchPlaceholder', { defaultValue: '搜索节点…' })}
                className="h-8 text-sm pr-8"
                onKeyDown={(e) => e.stopPropagation()}
              />
              {filterState.searchQuery ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => onFilterChange({ searchQuery: '' })}
                  title={t('common.clear', { defaultValue: '清除' })}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ) : null}
            </div>
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" className="w-full h-8 text-xs" onClick={onClearFilters}>
                <X className="h-3.5 w-3.5 mr-1" />
                {t('outline.clearFilters', { defaultValue: '清除过滤' })}
              </Button>
            ) : null}
            <DropdownMenuSeparator />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full h-8 justify-start text-xs"
              onClick={onToggleLeftSidebar}
            >
              <PanelLeft className="h-3.5 w-3.5 mr-1.5" />
              {leftSidebarOpen
                ? t('outline.sidebar.hide', { defaultValue: '隐藏侧边栏' })
                : t('outline.sidebar.show', { defaultValue: '显示侧边栏' })}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-0.5 h-4 w-px bg-border shrink-0" />

      {/* 视图模式切换下拉菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs shrink-0"
          >
            {viewMode === 'outline' ? (
              <LayoutList className="h-3.5 w-3.5" />
            ) : viewMode === 'mindmap' ? (
              <Network className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {viewMode === 'outline'
                ? t('outline.view.outline', { defaultValue: '大纲' })
                : viewMode === 'mindmap'
                  ? t('outline.view.mindmap', { defaultValue: '导图' })
                  : t('outline.view.article', { defaultValue: '文章' })}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[140px]">
          {([
            { mode: 'outline' as const, icon: LayoutList, label: t('outline.view.outline', { defaultValue: '大纲' }) },
            { mode: 'mindmap' as const, icon: Network, label: t('outline.view.mindmap', { defaultValue: '导图' }) },
            { mode: 'article' as const, icon: FileText, label: t('outline.view.article', { defaultValue: '文章' }) },
          ]).map(({ mode, icon: Icon, label }) => (
            <DropdownMenuItem
              key={mode}
              className="gap-2"
              onClick={() => {
                if (onSetViewMode) {
                  onSetViewMode(mode);
                } else if (mode !== viewMode) {
                  onToggleViewMode();
                }
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
              {viewMode === mode && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Item Mover */}
      {onOpenItemMover && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs shrink-0"
          onClick={onOpenItemMover}
          title={t('outline.itemMover.title', { defaultValue: '移动节点' })}
        >
          <GitBranch className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('outline.itemMover.title', { defaultValue: '移动' })}</span>
        </Button>
      )}

      {/* Presentation */}
      {onOpenPresentation && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs shrink-0"
          onClick={onOpenPresentation}
          title={t('outline.presentation.title', { defaultValue: '演示模式' })}
        >
          <MonitorPlay className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('outline.presentation.title', { defaultValue: '演示' })}</span>
        </Button>
      )}

      <div className="mx-0.5 h-4 w-px bg-border shrink-0" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs shrink-0">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('outline.io', { defaultValue: '导入/导出' })}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
          <DropdownMenuItem onClick={onOpenExport}>
            <Download className="h-4 w-4 mr-2" />
            {t('outline.export.title', { defaultValue: '导出大纲' })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenImport}>
            <Upload className="h-4 w-4 mr-2" />
            {t('outline.import.title', { defaultValue: '导入大纲' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex-1" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={TB_ICON}
        onClick={onOpenSettings}
        title={t('outline.settings.title', { defaultValue: '大纲设置' })}
        aria-label={t('outline.settings.title', { defaultValue: '大纲设置' })}
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>

      <Button
        type="button"
        variant={aiSidebarOpen ? 'default' : 'outline'}
        size="icon"
        className={TB_ICON}
        onClick={onToggleAISidebar}
        title={aiSidebarOpen ? t('common.hideAI', { defaultValue: '关闭 AI' }) : t('common.showAI', { defaultValue: '打开 AI' })}
        aria-label={aiSidebarOpen ? t('common.hideAI', { defaultValue: '关闭 AI' }) : t('common.showAI', { defaultValue: '打开 AI' })}
      >
        {aiSidebarOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export default TopToolbar;
