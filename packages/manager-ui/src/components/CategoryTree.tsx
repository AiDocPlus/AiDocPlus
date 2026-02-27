import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Folder, Plus, ArrowDownAZ, ArrowDown01 } from 'lucide-react';
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
import type { CategoryDefinition } from '@aidocplus/manager-shared';
import { useResourceStore } from '../stores/useResourceStore';
import { cn } from './ui/cn';
import { SortableItem } from './SortableItem';

interface CategoryTreeProps {
  onCreateCategory?: () => void;
  onReorderCategories?: (reordered: CategoryDefinition[]) => void;
}

export function CategoryTree({ onCreateCategory, onReorderCategories }: CategoryTreeProps) {
  const { t } = useTranslation();
  const resources = useResourceStore((s) => s.resources);
  const selectedCategory = useResourceStore((s) => s.selectedCategory);
  const setSelectedCategory = useResourceStore((s) => s.setSelectedCategory);
  const rawCategories = useResourceStore((s) => s.categories);
  const categorySortMode = useResourceStore((s) => s.categorySortMode);
  const setCategorySortMode = useResourceStore((s) => s.setCategorySortMode);

  const isManualSort = categorySortMode === 'manual';

  const categories = useMemo(() =>
    [...rawCategories].sort((a, b) =>
      categorySortMode === 'alpha'
        ? a.name.localeCompare(b.name, 'zh-Hans')
        : a.order - b.order
    ),
    [rawCategories, categorySortMode]
  );
  const totalCount = resources.length;

  const getCategoryCount = (key: string) => {
    return resources.filter((r) => r.majorCategory === key).length;
  };

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderCategories) return;
    const currentKeys = categories.map((c) => c.key);
    const oldIndex = currentKeys.indexOf(active.id as string);
    const newIndex = currentKeys.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(categories, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }));
    onReorderCategories(reordered);
  }, [categories, onReorderCategories]);

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <span className="text-sm font-semibold text-muted-foreground">
          {t('common.categories', { defaultValue: '分类' })}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCategorySortMode(categorySortMode === 'manual' ? 'alpha' : 'manual')}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title={categorySortMode === 'manual' ? '切换为字母排序' : '切换为手动排序'}
          >
            {categorySortMode === 'manual' ? (
              <ArrowDown01 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ArrowDownAZ className="h-4 w-4 text-blue-600" />
            )}
          </button>
          {onCreateCategory && (
            <button
              onClick={onCreateCategory}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              title={t('common.createCategory', { defaultValue: '新建分类' })}
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* 全部 */}
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'w-full flex items-center gap-2.5 pl-3 pr-3 py-2.5 rounded-md text-left transition-colors',
            selectedCategory === null
              ? 'bg-blue-100 text-blue-900 font-medium border-l-[3px] border-l-blue-600'
              : 'hover:bg-accent'
          )}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{t('common.all', { defaultValue: '全部' })}</span>
          <span className="ml-auto text-[11px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">{totalCount}</span>
        </button>

        {/* 分类列表 */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map((c) => c.key)} strategy={verticalListSortingStrategy}>
            {categories.map((cat) => (
              <SortableItem key={cat.key} id={cat.key} disabled={!isManualSort} showHandle={isManualSort}>
                <button
                  onClick={() => setSelectedCategory(cat.key)}
                  className={cn(
                    'w-full flex items-center gap-2.5 pr-3 py-2 rounded-md text-left transition-colors',
                    selectedCategory === cat.key
                      ? 'bg-blue-100 text-blue-900 font-medium border-l-[3px] border-l-blue-600'
                      : 'hover:bg-accent'
                  )}
                >
                  {cat.icon ? (
                    <span className="shrink-0">{cat.icon}</span>
                  ) : (
                    <Folder className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate text-sm">{cat.name}</span>
                  <span className="ml-auto text-[11px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                    {getCategoryCount(cat.key)}
                  </span>
                </button>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
