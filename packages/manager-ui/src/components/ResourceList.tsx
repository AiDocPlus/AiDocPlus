import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ArrowDownAZ, ArrowDown01 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useResourceStore } from '../stores/useResourceStore';
import { cn } from './ui/cn';
import { SortableItem } from './SortableItem';
import type { ResourceSummary } from '@aidocplus/manager-shared';

interface ResourceListProps {
  onSelect: (resource: ResourceSummary) => void;
  onReorder?: (idOrderPairs: Array<[string, number]>) => void;
}

export function ResourceList({ onSelect, onReorder }: ResourceListProps) {
  const { t } = useTranslation();
  const filteredResources = useResourceStore((s) => s.filteredResources)();
  const selectedResource = useResourceStore((s) => s.selectedResource);
  const selectedCategory = useResourceStore((s) => s.selectedCategory);
  const categories = useResourceStore((s) => s.categories);
  const checkedPaths = useResourceStore((s) => s.checkedPaths);
  const toggleChecked = useResourceStore((s) => s.toggleChecked);
  const batchMode = useResourceStore((s) => s.batchMode);
  const resourceSortMode = useResourceStore((s) => s.resourceSortMode);
  const setResourceSortMode = useResourceStore((s) => s.setResourceSortMode);

  // 只有选中具体分类时才允许手动拖拽排序（"全部"视图下禁用，避免跨分类混排）
  const isManualSort = resourceSortMode === 'manual' && !!selectedCategory;

  const categoryName = selectedCategory
    ? categories.find((c) => c.key === selectedCategory)?.name ?? selectedCategory
    : t('common.all', { defaultValue: '全部' });

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const currentIds = filteredResources.map((r) => r.id);
    const oldIndex = currentIds.indexOf(active.id as string);
    const newIndex = currentIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(filteredResources, oldIndex, newIndex);
    const pairs: Array<[string, number]> = reordered.map((r, i) => [r.path, i]);
    onReorder(pairs);
  }, [filteredResources, onReorder]);

  return (
    <div className="flex flex-col h-full">
      {/* 列表头 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0">
        <span className="text-sm font-semibold text-muted-foreground">
          {categoryName}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setResourceSortMode(resourceSortMode === 'manual' ? 'alpha' : 'manual')}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title={resourceSortMode === 'manual' ? '切换为字母排序' : '切换为手动排序'}
          >
            {resourceSortMode === 'manual' ? (
              <ArrowDown01 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ArrowDownAZ className="h-4 w-4 text-blue-600" />
            )}
          </button>
          <span className="text-[11px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
            {filteredResources.length} {t('common.items', { defaultValue: '项' })}
          </span>
        </div>
      </div>

      {/* 列表内容 */}
      {filteredResources.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          {t('common.noData', { defaultValue: '暂无数据' })}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredResources.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              {filteredResources.map((r) => {
                const isSelected = selectedResource?.id === r.id;
                const isChecked = checkedPaths.has(r.path);

                return (
                  <SortableItem key={r.id} id={r.id} disabled={!isManualSort} showHandle={isManualSort}>
                    <div
                      onClick={() => batchMode ? toggleChecked(r.path) : onSelect(r)}
                      className={cn(
                        'flex items-start gap-3 px-2 py-2.5 cursor-pointer rounded-md transition-colors',
                        batchMode && isChecked
                          ? 'bg-blue-100 border-l-[3px] border-l-blue-600'
                          : isSelected && !batchMode
                            ? 'bg-blue-100 border-l-[3px] border-l-blue-600'
                            : 'hover:bg-accent/50'
                      )}
                    >
                      {/* 复选框（仅批量模式显示） */}
                      {batchMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChecked(r.path);
                          }}
                          className={cn(
                            'mt-0.5 w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 transition-colors',
                            isChecked
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-input hover:border-primary/50'
                          )}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </button>
                      )}

                      {/* 图标 */}
                      {r.icon && (
                        <span className="text-lg shrink-0">{r.icon}</span>
                      )}

                      {/* 信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{r.name}</span>
                          {!r.enabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 shrink-0">
                              {t('common.disabled', { defaultValue: '已禁用' })}
                            </span>
                          )}
                        </div>
                        {r.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                            {r.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </SortableItem>
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
