import { useState, useMemo, useCallback } from 'react';
import { getAllPlugins } from './registry';
import { DEFAULT_DOC_PLUGINS, getMergedMajorCategories, getMergedSubCategories } from './constants';
import type { MergedCategory } from './constants';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from '@/i18n';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Search, Plus, X, RotateCcw, Check, ChevronDown, ChevronRight, Trash2, PlusCircle, ListPlus } from 'lucide-react';
import { PluginCard } from './PluginCard';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Document, PluginManifest } from '@aidocplus/shared-types';
import type { DocumentPlugin } from './types';

// ── 可排序插件卡片包装器 ──
function SortablePluginCard({
  plugin,
  manifest,
  document: doc,
  usageCount,
  onRemove,
  onMoveToTop,
  onMoveToBottom,
  onCategoryChange,
  categories,
}: {
  plugin: DocumentPlugin;
  manifest?: PluginManifest;
  document: Document;
  usageCount?: number;
  onRemove: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onCategoryChange: (majorKey: string, subKey: string) => void;
  categories: { majors: MergedCategory[]; getSubs: (majorKey: string) => MergedCategory[] };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plugin.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <PluginCard
        plugin={plugin}
        manifest={manifest}
        document={doc}
        isEnabled={true}
        draggable={true}
        dragHandleProps={listeners}
        usageCount={usageCount}
        onRemove={onRemove}
        onMoveToTop={onMoveToTop}
        onMoveToBottom={onMoveToBottom}
        onCategoryChange={onCategoryChange}
        categories={categories}
      />
    </div>
  );
}

interface PluginManagerPanelProps {
  document: Document;
  enabledPluginIds?: string[];
  onEnabledPluginsChange: (pluginIds: string[]) => void;
  onClose: () => void;
  /** 过滤显示的插件大类，不传则显示全部 */
  filterCategory?: 'content-generation' | 'functional';
}

/**
 * 插件管理面板：树状分类 + 搜索 + 为当前文档增删插件 + 拖拽排序 + 分类CRUD
 */
export function PluginManagerPanel({
  document,
  enabledPluginIds,
  onEnabledPluginsChange,
  onClose,
  filterCategory,
}: PluginManagerPanelProps) {
  const { t } = useTranslation('plugin-framework');
  const { pluginManifests, loadPlugins } = useAppStore();
  const { plugins: pluginsSettings, addCategory, renameCategory, deleteCategory } = useSettingsStore();

  const allPlugins = useMemo(() => getAllPlugins(), []);
  const currentEnabled = enabledPluginIds ?? DEFAULT_DOC_PLUGINS;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [expandedMajors, setExpandedMajors] = useState<Set<string>>(() => {
    const majors = getMergedMajorCategories();
    return new Set(majors.map(c => c.key));
  });

  // 分类编辑状态
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [addingTo, setAddingTo] = useState<{ type: 'major' | 'sub'; majorKey: string | null } | null>(null);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');

  const pluginUsageCount: Record<string, number> = pluginsSettings?.usageCount || {};

  // dnd-kit 传感器
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getManifest = (pluginId: string): PluginManifest | undefined =>
    pluginManifests.find(m => m.id === pluginId);

  // 合并后的分类
  const mergedMajors = useMemo(() => getMergedMajorCategories(), [pluginsSettings?.customCategories]);

  // 构建树结构数据
  const treeData = useMemo(() => {
    const majorCounts: Record<string, number> = {};
    const subCounts: Record<string, Record<string, number>> = {};

    for (const m of pluginManifests) {
      if (!m.enabled) continue;
      const major = m.majorCategory || 'content-generation';
      const sub = m.subCategory || m.category || '';
      majorCounts[major] = (majorCounts[major] || 0) + 1;
      if (!subCounts[major]) subCounts[major] = {};
      if (sub) subCounts[major][sub] = (subCounts[major][sub] || 0) + 1;
    }

    return { majorCounts, subCounts, total: allPlugins.length };
  }, [pluginManifests, allPlugins]);

  // 过滤插件
  const filteredPlugins = useMemo(() => {
    let plugins = allPlugins;

    // 按大类过滤（来自 filterCategory prop）
    if (filterCategory) {
      plugins = plugins.filter(p => {
        const m = getManifest(p.id);
        const cat = m?.majorCategory || p.majorCategory || 'content-generation';
        return cat === filterCategory;
      });
    }

    if (selectedNode !== 'all') {
      if (selectedNode.includes(':')) {
        const [major, sub] = selectedNode.split(':');
        plugins = plugins.filter(p => {
          const m = getManifest(p.id);
          const pMajor = m?.majorCategory || p.majorCategory || 'content-generation';
          const pSub = m?.subCategory || p.subCategory || m?.category || '';
          return pMajor === major && pSub === sub;
        });
      } else {
        plugins = plugins.filter(p => {
          const m = getManifest(p.id);
          const pMajor = m?.majorCategory || p.majorCategory || 'content-generation';
          return pMajor === selectedNode;
        });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      plugins = plugins.filter(p => {
        const m = getManifest(p.id);
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (m?.tags || []).some(tag => tag.toLowerCase().includes(q))
        );
      });
    }

    return plugins;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlugins, selectedNode, searchQuery, pluginManifests]);

  // 已启用插件按 currentEnabled 顺序排列
  const enabledPlugins = useMemo(() => {
    return currentEnabled
      .map(id => filteredPlugins.find(p => p.id === id))
      .filter((p): p is DocumentPlugin => !!p);
  }, [filteredPlugins, currentEnabled]);

  const availablePlugins = filteredPlugins.filter(p => !currentEnabled.includes(p.id));
  const sortedAvailable = useMemo(() => {
    return [...availablePlugins].sort((a, b) => {
      return (pluginUsageCount[b.id] || 0) - (pluginUsageCount[a.id] || 0);
    });
  }, [availablePlugins, pluginUsageCount]);

  // ── 操作回调 ──

  const handleAdd = (pluginId: string) => {
    onEnabledPluginsChange([...currentEnabled, pluginId]);
  };

  const handleRemove = (pluginId: string) => {
    onEnabledPluginsChange(currentEnabled.filter(id => id !== pluginId));
  };

  const handleResetDefault = () => {
    onEnabledPluginsChange([...DEFAULT_DOC_PLUGINS]);
  };

  const handleAddAllFiltered = () => {
    const newIds = sortedAvailable.map(p => p.id);
    onEnabledPluginsChange([...currentEnabled, ...newIds]);
  };

  const handleClearEnabled = () => {
    onEnabledPluginsChange([]);
  };

  // 拖拽排序完成
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = currentEnabled.indexOf(active.id as string);
    const newIndex = currentEnabled.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onEnabledPluginsChange(arrayMove([...currentEnabled], oldIndex, newIndex));
  };

  // 移到顶部/底部
  const handleMoveToTop = (pluginId: string) => {
    const rest = currentEnabled.filter(id => id !== pluginId);
    onEnabledPluginsChange([pluginId, ...rest]);
  };

  const handleMoveToBottom = (pluginId: string) => {
    const rest = currentEnabled.filter(id => id !== pluginId);
    onEnabledPluginsChange([...rest, pluginId]);
  };

  // 修改插件分类归属
  const handleCategoryChange = useCallback(async (pluginId: string, majorKey: string, subKey: string) => {
    const manifest = pluginManifests.find(m => m.id === pluginId);
    if (!manifest) return;
    const updated = { ...manifest, majorCategory: majorKey, subCategory: subKey, category: subKey };
    try {
      await invoke('sync_plugin_manifests', { manifests: [updated] });
      await loadPlugins();
    } catch (e) {
      console.error('Failed to update plugin category:', e);
    }
  }, [pluginManifests, loadPlugins]);

  // 分类树操作
  const toggleMajor = (majorKey: string) => {
    setExpandedMajors(prev => {
      const next = new Set(prev);
      if (next.has(majorKey)) next.delete(majorKey);
      else next.add(majorKey);
      return next;
    });
  };

  const handleStartRename = (nodeKey: string, currentLabel: string) => {
    setEditingNode(nodeKey);
    setEditingLabel(currentLabel);
  };

  const handleFinishRename = (type: 'major' | 'sub', majorKey: string | null, key: string) => {
    if (editingLabel.trim()) {
      renameCategory(type, majorKey, key, editingLabel.trim());
    }
    setEditingNode(null);
    setEditingLabel('');
  };

  const handleStartAdd = (type: 'major' | 'sub', majorKey: string | null) => {
    setAddingTo({ type, majorKey });
    setNewCategoryLabel('');
  };

  const handleFinishAdd = () => {
    if (!addingTo || !newCategoryLabel.trim()) {
      setAddingTo(null);
      return;
    }
    const key = newCategoryLabel.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fff-]/g, '');
    if (!key) { setAddingTo(null); return; }
    addCategory(addingTo.type, addingTo.majorKey, key, newCategoryLabel.trim());
    if (addingTo.type === 'major') {
      setExpandedMajors(prev => new Set([...prev, key]));
    }
    setAddingTo(null);
    setNewCategoryLabel('');
  };

  const handleDeleteCategory = (type: 'major' | 'sub', majorKey: string | null, key: string, isBuiltin: boolean) => {
    if (isBuiltin) return;
    deleteCategory(type, majorKey, key);
    if (selectedNode === key || selectedNode.startsWith(key + ':')) {
      setSelectedNode('all');
    }
  };

  // 分类数据供 PluginCard 使用
  const categoryData = useMemo(() => ({
    majors: mergedMajors,
    getSubs: getMergedSubCategories,
  }), [mergedMajors]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部搜索栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleResetDefault} className="gap-1 flex-shrink-0">
          <RotateCcw className="h-3.5 w-3.5" />
          {t('resetDefault')}
        </Button>
        <Button variant="default" size="sm" onClick={onClose} className="gap-1 flex-shrink-0">
          <Check className="h-3.5 w-3.5" />
          {t('done')}
        </Button>
      </div>

      {/* 主体：左侧树 + 右侧列表 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧树状分类 */}
        <div className="w-44 flex-shrink-0 border-r bg-muted/20 overflow-y-auto py-2">
          {/* 全部 */}
          <button
            onClick={() => setSelectedNode('all')}
            className={`
              w-full text-left px-3 py-2 text-sm transition-colors
              ${selectedNode === 'all'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 font-medium border-r-2 border-red-500'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            <span>{t('categories.all', { defaultValue: '全部' })}</span>
            <span className="ml-1 text-xs opacity-60">({treeData.total})</span>
          </button>

          {/* 大类 → 子类 树 */}
          {mergedMajors.map(major => {
            const majorCount = treeData.majorCounts[major.key] || 0;
            const isExpanded = expandedMajors.has(major.key);
            const isMajorSelected = selectedNode === major.key;
            const subCategories = getMergedSubCategories(major.key);
            const isEditingMajor = editingNode === `major:${major.key}`;

            return (
              <div key={major.key}>
                {/* 大类节点 */}
                <div className="flex items-center group">
                  <button
                    onClick={() => toggleMajor(major.key)}
                    className="flex-shrink-0 p-1 ml-1 text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-3 w-3" />
                      : <ChevronRight className="h-3 w-3" />
                    }
                  </button>
                  {isEditingMajor ? (
                    <input
                      autoFocus
                      value={editingLabel}
                      onChange={e => setEditingLabel(e.target.value)}
                      onBlur={() => handleFinishRename('major', null, major.key)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleFinishRename('major', null, major.key);
                        if (e.key === 'Escape') setEditingNode(null);
                      }}
                      className="flex-1 min-w-0 px-1 py-1 text-sm bg-background border rounded outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setSelectedNode(major.key)}
                      onDoubleClick={() => handleStartRename(`major:${major.key}`, major.label)}
                      className={`
                        flex-1 text-left px-1 py-2 text-sm transition-colors truncate
                        ${isMajorSelected
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : majorCount === 0
                            ? 'text-muted-foreground/50'
                            : 'text-muted-foreground hover:text-foreground'
                        }
                      `}
                    >
                      <span>{major.label}</span>
                      <span className="ml-1 text-xs opacity-60">({majorCount})</span>
                    </button>
                  )}
                  {/* hover 操作按钮 */}
                  <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                    <button
                      onClick={() => handleStartAdd('sub', major.key)}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                      title={t('addSubCategory', { defaultValue: '添加子分类' })}
                    >
                      <PlusCircle className="h-3 w-3" />
                    </button>
                    {!major.isBuiltin && (
                      <button
                        onClick={() => handleDeleteCategory('major', null, major.key, major.isBuiltin)}
                        className="p-0.5 text-muted-foreground hover:text-destructive"
                        title={t('deleteCategory', { defaultValue: '删除分类' })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 子类节点 */}
                {isExpanded && subCategories.map(sub => {
                  const subCount = treeData.subCounts[major.key]?.[sub.key] || 0;
                  const nodeKey = `${major.key}:${sub.key}`;
                  const isSubSelected = selectedNode === nodeKey;
                  const isEditingSub = editingNode === `sub:${nodeKey}`;

                  return (
                    <div key={nodeKey} className="flex items-center group">
                      {isEditingSub ? (
                        <input
                          autoFocus
                          value={editingLabel}
                          onChange={e => setEditingLabel(e.target.value)}
                          onBlur={() => handleFinishRename('sub', major.key, sub.key)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleFinishRename('sub', major.key, sub.key);
                            if (e.key === 'Escape') setEditingNode(null);
                          }}
                          className="flex-1 min-w-0 ml-8 mr-2 px-1 py-1 text-sm bg-background border rounded outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => setSelectedNode(nodeKey)}
                          onDoubleClick={() => handleStartRename(`sub:${nodeKey}`, sub.label)}
                          className={`
                            flex-1 text-left pl-8 pr-2 py-1.5 text-sm transition-colors truncate
                            ${isSubSelected
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 font-medium border-r-2 border-red-500'
                              : subCount === 0
                                ? 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }
                          `}
                        >
                          <span>{sub.label}</span>
                          {subCount === 0
                            ? <span className="ml-1 text-xs opacity-40">{t('none')}</span>
                            : <span className="ml-1 text-xs opacity-60">({subCount})</span>
                          }
                        </button>
                      )}
                      {!sub.isBuiltin && (
                        <button
                          onClick={() => handleDeleteCategory('sub', major.key, sub.key, sub.isBuiltin)}
                          className="flex-shrink-0 p-0.5 mr-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          title={t('deleteCategory', { defaultValue: '删除分类' })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* 新建子分类输入框 */}
                {isExpanded && addingTo?.type === 'sub' && addingTo.majorKey === major.key && (
                  <div className="pl-8 pr-2 py-1">
                    <input
                      autoFocus
                      value={newCategoryLabel}
                      onChange={e => setNewCategoryLabel(e.target.value)}
                      onBlur={handleFinishAdd}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleFinishAdd();
                        if (e.key === 'Escape') setAddingTo(null);
                      }}
                      placeholder={t('newCategoryName', { defaultValue: '分类名称...' })}
                      className="w-full px-1 py-1 text-sm bg-background border rounded outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* 新建大类输入框 */}
          {addingTo?.type === 'major' && (
            <div className="px-3 py-1">
              <input
                autoFocus
                value={newCategoryLabel}
                onChange={e => setNewCategoryLabel(e.target.value)}
                onBlur={handleFinishAdd}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleFinishAdd();
                  if (e.key === 'Escape') setAddingTo(null);
                }}
                placeholder={t('newCategoryName', { defaultValue: '分类名称...' })}
                className="w-full px-1 py-1 text-sm bg-background border rounded outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          )}

          {/* 添加大类按钮 */}
          <button
            onClick={() => handleStartAdd('major', null)}
            className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            {t('addMajorCategory', { defaultValue: '添加大类' })}
          </button>
        </div>

        {/* 右侧插件列表 */}
        <div className="flex-1 min-w-0 overflow-y-auto p-3 space-y-4">
          {/* 批量操作栏 */}
          {(sortedAvailable.length > 0 || enabledPlugins.length > 0) && (
            <div className="flex items-center gap-2 text-xs">
              {sortedAvailable.length > 0 && (
                <button
                  onClick={handleAddAllFiltered}
                  className="flex items-center gap-1 px-2 py-1 rounded border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <ListPlus className="h-3 w-3" />
                  {t('addAll', { defaultValue: '全部添加' })}
                </button>
              )}
              {enabledPlugins.length > 0 && (
                <button
                  onClick={handleClearEnabled}
                  className="flex items-center gap-1 px-2 py-1 rounded border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X className="h-3 w-3" />
                  {t('clearAll', { defaultValue: '清空已启用' })}
                </button>
              )}
            </div>
          )}

          {/* 已启用（可拖拽排序） */}
          {enabledPlugins.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t('enabled')} ({enabledPlugins.length})
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={enabledPlugins.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1">
                    {enabledPlugins.map(p => (
                      <SortablePluginCard
                        key={p.id}
                        plugin={p}
                        manifest={getManifest(p.id)}
                        document={document}
                        usageCount={pluginUsageCount[p.id]}
                        onRemove={() => handleRemove(p.id)}
                        onMoveToTop={() => handleMoveToTop(p.id)}
                        onMoveToBottom={() => handleMoveToBottom(p.id)}
                        onCategoryChange={(major, sub) => handleCategoryChange(p.id, major, sub)}
                        categories={categoryData}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* 可添加 */}
          {sortedAvailable.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t('available')} ({sortedAvailable.length})
              </div>
              <div className="space-y-1">
                {sortedAvailable.map(p => (
                  <PluginCard
                    key={p.id}
                    plugin={p}
                    manifest={getManifest(p.id)}
                    document={document}
                    isEnabled={false}
                    usageCount={pluginUsageCount[p.id]}
                    onAdd={() => handleAdd(p.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredPlugins.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {searchQuery ? t('noMatch', { query: searchQuery }) : t('noPluginsAvailable')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
