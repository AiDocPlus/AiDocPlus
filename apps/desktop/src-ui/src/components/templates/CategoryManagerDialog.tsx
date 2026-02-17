import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/stores/useAppStore';
import { useTranslation } from '@/i18n';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TemplateCategory } from '@aidocplus/shared-types';

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SortableCategoryItem({
  category,
  onEdit,
  onDelete,
}: {
  category: TemplateCategory;
  onEdit: (cat: TemplateCategory) => void;
  onDelete: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (confirmingDelete) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-2 px-2 py-2 rounded-md border border-destructive bg-destructive/5"
      >
        <span className="text-sm flex-1 truncate">{t('templates.confirmDeleteCategoryNamed', { defaultValue: '确定删除 "{{name}}"？', name: category.label })}</span>
        <Button
          size="sm" variant="destructive" className="h-7 px-2 text-xs"
          onClick={() => { onDelete(category.key); setConfirmingDelete(false); }}
        >
          {t('templates.delete', { defaultValue: '删除' })}
        </Button>
        <Button
          size="sm" variant="ghost" className="h-7 w-7 p-0"
          onClick={() => setConfirmingDelete(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-2 rounded-md border border-border bg-background hover:bg-muted/50 transition-colors"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{category.label}</div>
        <div className="text-xs text-muted-foreground truncate">{category.key}</div>
      </div>

      <span className={`text-xs px-1.5 py-0.5 rounded ${
        category.type === 'builtin' ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'
      }`}>
        {category.type === 'builtin' ? t('templates.builtinTag', { defaultValue: '内置' }) : t('templates.customTag', { defaultValue: '自定义' })}
      </span>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Button
          size="sm" variant="ghost" className="h-7 w-7 p-0"
          title={t('templates.editCategory', { defaultValue: '编辑' })}
          onClick={() => onEdit(category)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          title={t('templates.deleteCategory', { defaultValue: '删除' })}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function CategoryManagerDialog({ open, onOpenChange }: CategoryManagerDialogProps) {
  const { t } = useTranslation();
  const {
    templateCategories,
    createTemplateCategory,
    updateTemplateCategory,
    deleteTemplateCategory,
    reorderTemplateCategories,
  } = useAppStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAdd = async () => {
    const key = newKey.trim();
    const label = newLabel.trim();
    if (!key || !label) return;
    try {
      await createTemplateCategory(key, label);
      setNewKey('');
      setNewLabel('');
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to create category:', err);
      alert(t('templates.createFailed', { defaultValue: '创建失败: {{error}}', error: String(err) }));
    }
  };

  const handleStartEdit = (cat: TemplateCategory) => {
    setEditingKey(cat.key);
    setEditLabel(cat.label);
  };

  const handleSaveEdit = async () => {
    if (!editingKey) return;
    const label = editLabel.trim();
    if (!label) return;
    try {
      await updateTemplateCategory(editingKey, label);
      setEditingKey(null);
    } catch (err) {
      console.error('Failed to update category:', err);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await deleteTemplateCategory(key);
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = templateCategories.findIndex(c => c.key === active.id);
    const newIndex = templateCategories.findIndex(c => c.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(templateCategories, oldIndex, newIndex);
    const orderedKeys = reordered.map(c => c.key);
    try {
      await reorderTemplateCategories(orderedKeys);
    } catch (err) {
      console.error('Failed to reorder categories:', err);
    }
  }, [templateCategories, reorderTemplateCategories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('templates.manageCategoriesTitle', { defaultValue: '管理模板分类' })}</DialogTitle>
          <DialogDescription>{t('templates.manageCategoriesDesc', { defaultValue: '创建、编辑、排序或删除模板分类。拖拽可调整顺序。' })}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={templateCategories.map(c => c.key)} strategy={verticalListSortingStrategy}>
              {templateCategories.map(cat => (
                editingKey === cat.key ? (
                  <div key={cat.key} className="flex items-center gap-2 px-2 py-2 rounded-md border border-primary bg-primary/5">
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder={t('templates.categoryNamePlaceholder', { defaultValue: '分类名称' })}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingKey(null); }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveEdit}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingKey(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <SortableCategoryItem
                    key={cat.key}
                    category={cat}
                    onEdit={handleStartEdit}
                    onDelete={handleDelete}
                  />
                )
              ))}
            </SortableContext>
          </DndContext>

          {templateCategories.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">{t('templates.noCategories', { defaultValue: '暂无分类' })}</div>
          )}
        </div>

        {/* 添加新分类 */}
        {isAdding ? (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder={t('templates.categoryKeyPlaceholder', { defaultValue: '分类标识（英文，如 proposal）' })}
                className="h-8 text-sm flex-1"
                autoFocus
              />
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t('templates.categoryLabelPlaceholder', { defaultValue: '显示名称（如 提案）' })}
                className="h-8 text-sm flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setNewKey(''); setNewLabel(''); }}>
                {t('templates.cancel', { defaultValue: '取消' })}
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!newKey.trim() || !newLabel.trim()}>
                {t('templates.add', { defaultValue: '添加' })}
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('templates.addCategory', { defaultValue: '添加分类' })}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
