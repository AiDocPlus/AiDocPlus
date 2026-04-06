/**
 * 左侧边栏
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Home, ChevronRight, X } from 'lucide-react';

import type { TagIndex, FilterState } from '../../types';

interface LeftSidebarProps {
  tagIndex: TagIndex;
  filterState: FilterState;
  onFilterChange: (filter: Partial<FilterState>) => void;
  onClearFilters: () => void;
  breadcrumbs: { label: string; nodeId: string }[];
  isFocusMode: boolean;
  onExitFocus: () => void;
  onBreadcrumbClick?: (index: number) => void;
}

export function LeftSidebar({
  tagIndex,
  filterState,
  onFilterChange,
  onClearFilters,
  breadcrumbs,
  isFocusMode,
  onExitFocus,
  onBreadcrumbClick,
}: LeftSidebarProps) {
  const { t } = useTranslation();

  const hasTagOrMentionFilters =
    tagIndex.allTags.length > 0 || tagIndex.allMentions.length > 0;
  const showFocusChrome = isFocusMode && breadcrumbs.length > 0;

  return (
    <div className="w-64 shrink-0 border-r bg-muted/20 flex flex-col">
      <ScrollArea className="flex-1 p-3">
        {/* 专注模式面包屑 */}
        {showFocusChrome && (
          <div className="mb-4 p-2 bg-background rounded-md border">
            <div className="text-xs text-muted-foreground mb-2">
              {t('outline.focusMode', { defaultValue: '专注模式' })}
            </div>
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <button
                className="flex items-center text-primary hover:text-primary/80"
                onClick={onExitFocus}
              >
                <Home className="h-3 w-3 mr-1" />
                {t('outline.root', { defaultValue: '根' })}
              </button>
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.nodeId} className="flex items-center">
                  <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />
                  {index === breadcrumbs.length - 1 ? (
                    <span className="font-medium truncate max-w-[120px]">
                      {crumb.label}
                    </span>
                  ) : (
                    <button
                      className="text-muted-foreground hover:text-primary truncate max-w-[120px]"
                      onClick={() => onBreadcrumbClick?.(index)}
                    >
                      {crumb.label}
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 无标签/提及时避免整块空白（对齐思维导图插件：侧栏仅在有筛选能力时占空间） */}
        {!showFocusChrome && !hasTagOrMentionFilters && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            {t('outline.sidebar.emptyHint', {
              defaultValue: '在节点内容中使用 #标签 或 @提及 后，可在此筛选。点击工具栏左侧图标可收起本栏。',
            })}
          </p>
        )}

        {/* 标签过滤 */}
        {tagIndex.allTags.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('outline.tags', { defaultValue: '标签' })}
              </h4>
              {filterState.selectedTags.size > 0 && (
                <button
                  className="text-xs text-primary hover:text-primary/80"
                  onClick={() =>
                    onFilterChange({ selectedTags: new Set() })
                  }
                >
                  {t('common.clear', { defaultValue: '清除' })}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {tagIndex.allTags.map((tag) => {
                const isSelected = filterState.selectedTags.has(tag);
                const count = tagIndex.tags.get(tag)?.size || 0;
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const newTags = new Set(filterState.selectedTags);
                      if (isSelected) {
                        newTags.delete(tag);
                      } else {
                        newTags.add(tag);
                      }
                      onFilterChange({ selectedTags: newTags });
                    }}
                    className={cn(
                      'text-xs px-2 py-1 rounded transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background hover:bg-muted'
                    )}
                  >
                    #{tag} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 提及过滤 */}
        {tagIndex.allMentions.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('outline.mentions', { defaultValue: '提及' })}
              </h4>
              {filterState.selectedMentions.size > 0 && (
                <button
                  className="text-xs text-primary hover:text-primary/80"
                  onClick={() =>
                    onFilterChange({ selectedMentions: new Set() })
                  }
                >
                  {t('common.clear', { defaultValue: '清除' })}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {tagIndex.allMentions.map((mention) => {
                const isSelected = filterState.selectedMentions.has(mention);
                const count = tagIndex.mentions.get(mention)?.size || 0;
                return (
                  <button
                    key={mention}
                    onClick={() => {
                      const newMentions = new Set(filterState.selectedMentions);
                      if (isSelected) {
                        newMentions.delete(mention);
                      } else {
                        newMentions.add(mention);
                      }
                      onFilterChange({ selectedMentions: newMentions });
                    }}
                    className={cn(
                      'text-xs px-2 py-1 rounded transition-colors',
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-background hover:bg-muted'
                    )}
                  >
                    @{mention} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 清除所有过滤 */}
        {(filterState.selectedTags.size > 0 ||
          filterState.selectedMentions.size > 0) && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onClearFilters}
          >
            <X className="h-4 w-4 mr-2" />
            {t('outline.clearAllFilters', {
              defaultValue: '清除所有过滤',
            })}
          </Button>
        )}
      </ScrollArea>
    </div>
  );
}

export default LeftSidebar;
