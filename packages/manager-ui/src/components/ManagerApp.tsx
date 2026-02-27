import { useEffect, useCallback, useState, useRef, type ComponentType } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type {
  ResourceTypeConfig,
  ResourceSummary,
  ResourceChanges,
  EditorPanelProps,
} from '@aidocplus/manager-shared';
import { useResourceStore } from '../stores/useResourceStore';
import { useUndoStore } from '../stores/useUndoStore';
import { loadResources, loadResourceDetail, saveResource, deleteResource, createResource, reorderResources, batchSetEnabled, batchMoveCategory, loadJsonResources, loadJsonResourceDetail, saveJsonResource, createJsonResource, deleteJsonResource, batchDeleteJsonResources, batchMoveJsonCategory } from '../hooks/useResources';
import { loadCategories, saveCategories, loadJsonCategories, saveJsonCategories } from '../hooks/useCategories';
import { ManagerLayout } from './ManagerLayout';
import { ResourceList } from './ResourceList';
import { CommonFieldsEditor } from './CommonFieldsEditor';
import { CreateDialog } from './CreateDialog';
import { SettingsDialog } from './SettingsDialog';
import { AICreateDialog } from './AICreateDialog';
import { BuildDialog } from './BuildDialog';
import { CreateCategoryDialog } from './CreateCategoryDialog';

interface ManagerAppProps {
  config: ResourceTypeConfig<ComponentType<EditorPanelProps>>;
}

type DialogType = 'create' | 'batch' | 'settings' | 'ai-create' | 'build' | 'create-category' | null;

export function ManagerApp({ config }: ManagerAppProps) {
  const isJsonMode = config.dataMode === 'json-file';
  const dataDir = useResourceStore((s) => s.dataDir);
  const setDataDir = useResourceStore((s) => s.setDataDir);
  const selectedResource = useResourceStore((s) => s.selectedResource);
  const setSelectedResource = useResourceStore((s) => s.setSelectedResource);
  const checkedPaths = useResourceStore((s) => s.checkedPaths);
  const clearChecked = useResourceStore((s) => s.clearChecked);
  const setBatchMode = useResourceStore((s) => s.setBatchMode);
  const batchMode = useResourceStore((s) => s.batchMode);
  const filteredResources = useResourceStore((s) => s.filteredResources);

  const [isDirty, setIsDirty] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);

  const pushUndo = useUndoStore((s) => s.pushUndo);
  const undo = useUndoStore((s) => s.undo);
  const redo = useUndoStore((s) => s.redo);
  const canUndo = useUndoStore((s) => s.canUndo);
  const canRedo = useUndoStore((s) => s.canRedo);
  const clearStacks = useUndoStore((s) => s.clearStacks);
  const hasSnapshotRef = useRef(false);

  // 初始化数据目录：config.defaultDataDir 由 App.tsx 根据资源类型计算好，直接使用
  // 仅当 config.defaultDataDir 为空时才 fallback 到 cmd_get_data_dir（--data-dir 启动参数）
  useEffect(() => {
    if (config.defaultDataDir) {
      setDataDir(config.defaultDataDir);
    } else {
      invoke<string | null>('cmd_get_data_dir')
        .then((dir) => {
          if (dir) {
            setDataDir(dir);
          }
        })
        .catch(() => {});
    }
  }, [config.defaultDataDir, setDataDir]);

  // 加载数据
  useEffect(() => {
    if (!dataDir) return;
    // DEBUG: 输出数据加载信息
    console.log('[DEBUG] ManagerApp 加载数据:', {
      dataDir,
      isJsonMode,
      dataMode: config.dataMode,
      resourceType: config.resourceType,
    });
    if (isJsonMode) {
      loadJsonResources(dataDir);
      loadJsonCategories(dataDir);
    } else {
      loadResources(dataDir);
      loadCategories(dataDir);
    }
  }, [dataDir, isJsonMode]);

  const reload = useCallback(async () => {
    if (dataDir) {
      if (isJsonMode) {
        await loadJsonResources(dataDir);
        await loadJsonCategories(dataDir);
      } else {
        await loadResources(dataDir);
        await loadCategories(dataDir);
      }
    }
  }, [dataDir, isJsonMode]);

  // 选中资源时加载详情
  const handleSelectResource = useCallback(
    async (summary: ResourceSummary) => {
      try {
        let detail;
        if (isJsonMode) {
          // path 格式为 "category_key::template_id"
          const parts = summary.path.split('::');
          detail = await loadJsonResourceDetail(dataDir, parts[0], parts[1], config.contentFiles);
        } else {
          detail = await loadResourceDetail(summary.path, config.contentFiles);
        }
        setSelectedResource(detail);
        setIsDirty(false);
        hasSnapshotRef.current = false;
        clearStacks();
      } catch (e) {
        console.error('加载资源详情失败:', e);
      }
    },
    [config.contentFiles, setSelectedResource, clearStacks, isJsonMode, dataDir]
  );

  // 资源变更
  const handleChange = useCallback(
    (changes: ResourceChanges) => {
      if (!selectedResource) return;
      // 首次修改时保存快照用于撤销
      if (!hasSnapshotRef.current) {
        pushUndo(structuredClone(selectedResource));
        hasSnapshotRef.current = true;
      }
      const updated = { ...selectedResource };
      if (changes.manifest) {
        updated.manifest = { ...updated.manifest, ...changes.manifest };
      }
      if (changes.contentFiles) {
        updated.contentFiles = { ...updated.contentFiles, ...changes.contentFiles };
      }
      updated.isDirty = true;
      setSelectedResource(updated);
      setIsDirty(true);
    },
    [selectedResource, setSelectedResource, pushUndo]
  );

  // 撤销
  const handleUndo = useCallback(() => {
    if (!selectedResource) return;
    // 先把当前状态 push 到 redo（通过 undo store 内部处理）
    const snapshot = undo();
    if (snapshot) {
      setSelectedResource(snapshot);
      setIsDirty(snapshot.isDirty);
      hasSnapshotRef.current = false;
    }
  }, [selectedResource, undo, setSelectedResource]);

  // 重做
  const handleRedo = useCallback(() => {
    if (!selectedResource) return;
    // 先保存当前状态
    pushUndo(structuredClone(selectedResource));
    const snapshot = redo();
    if (snapshot) {
      setSelectedResource(snapshot);
      setIsDirty(snapshot.isDirty);
      hasSnapshotRef.current = false;
    }
  }, [selectedResource, redo, pushUndo, setSelectedResource]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!selectedResource) return;
    try {
      if (isJsonMode) {
        await saveJsonResource(dataDir, selectedResource, config.contentFiles);
      } else {
        await saveResource(selectedResource);
      }
      setIsDirty(false);
      await reload();
    } catch (e) {
      console.error('保存失败:', e);
    }
  }, [selectedResource, reload, isJsonMode, dataDir, config.contentFiles]);

  // 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (mod && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, handleSave]);

  // 重排分类
  const handleReorderCategories = useCallback(async (reordered: import('@aidocplus/manager-shared').CategoryDefinition[]) => {
    if (!dataDir) return;
    try {
      if (isJsonMode) {
        await saveJsonCategories(dataDir, reordered);
      } else {
        const meta = {
          schemaVersion: '1.0',
          resourceType: config.resourceType,
          categories: reordered,
        };
        await saveCategories(dataDir, meta);
      }
    } catch (e) {
      console.error('重排分类失败:', e);
    }
  }, [dataDir, config.resourceType, isJsonMode]);

  // 新建分类
  const handleCreateCategory = useCallback(async (key: string, name: string, icon: string) => {
    if (!dataDir) return;
    try {
      const store = useResourceStore.getState();
      const existingCategories = store.categories;
      const newOrder = Math.max(-1, ...existingCategories.map((c) => c.order)) + 1;
      if (isJsonMode) {
        await saveJsonCategories(dataDir, [
          ...existingCategories,
          { key, name, icon, order: newOrder },
        ]);
      } else {
        const meta = {
          schemaVersion: '1.0',
          resourceType: config.resourceType,
          categories: [
            ...existingCategories,
            { key, name, icon, order: newOrder },
          ],
        };
        await saveCategories(dataDir, meta);
      }
      setActiveDialog(null);
    } catch (e) {
      alert('创建分类失败: ' + String(e));
    }
  }, [dataDir, config.resourceType, isJsonMode]);

  // 删除
  const handleDelete = useCallback(async () => {
    if (!selectedResource) return;
    if (!confirm(`确定要删除「${selectedResource.manifest.name}」吗？`)) return;
    try {
      if (isJsonMode) {
        await deleteJsonResource(dataDir, selectedResource.path);
      } else {
        await deleteResource(selectedResource.path);
      }
      setSelectedResource(null);
      await reload();
    } catch (e) {
      console.error('删除失败:', e);
    }
  }, [selectedResource, reload, setSelectedResource, isJsonMode, dataDir]);

  // 新建
  const handleCreateConfirm = useCallback(async (
    category: string,
    id: string,
    manifest: Record<string, unknown>,
    contentFiles: Array<{ filename: string; content: string }>
  ) => {
    if (!dataDir) return;
    try {
      let newPath: string;
      if (isJsonMode) {
        newPath = await createJsonResource(dataDir, category, id, manifest, contentFiles);
      } else {
        newPath = await createResource(dataDir, category, id, manifest, contentFiles);
      }
      setActiveDialog(null);
      await reload();
      // 自动选中新资源
      let detail;
      if (isJsonMode) {
        const parts = newPath.split('::');
        detail = await loadJsonResourceDetail(dataDir, parts[0], parts[1], config.contentFiles);
      } else {
        detail = await loadResourceDetail(newPath, config.contentFiles);
      }
      setSelectedResource(detail);
      setIsDirty(false);
    } catch (e) {
      alert('创建失败: ' + String(e));
    }
  }, [dataDir, reload, config.contentFiles, setSelectedResource, isJsonMode]);

  // 一键重排（按名称重新编号）
  const handleReindex = useCallback(async () => {
    if (!dataDir) return;
    try {
      const count = await invoke<number>('cmd_reindex_all_orders', { dataDir });
      alert(`已重新排序 ${count} 个资源（每个分类内按名称排序）`);
      await reload();
    } catch (e) {
      alert('重排失败: ' + String(e));
    }
  }, [dataDir, reload]);

  // 拖拽重排资源
  const handleReorderResources = useCallback(async (idOrderPairs: Array<[string, number]>) => {
    try {
      await reorderResources(idOrderPairs);
      await reload();
    } catch (e) {
      console.error('重排资源失败:', e);
    }
  }, [reload]);

  // 上移
  const handleMoveUp = useCallback(async () => {
    if (!selectedResource) return;
    const list = filteredResources();
    const idx = list.findIndex((r) => r.id === selectedResource.id);
    if (idx <= 0) return;
    const prev = list[idx - 1];
    const curr = list[idx];
    try {
      await reorderResources([
        [curr.path, prev.order],
        [prev.path, curr.order],
      ]);
      await reload();
    } catch (e) {
      console.error('上移失败:', e);
    }
  }, [selectedResource, filteredResources, reload]);

  // 下移
  const handleMoveDown = useCallback(async () => {
    if (!selectedResource) return;
    const list = filteredResources();
    const idx = list.findIndex((r) => r.id === selectedResource.id);
    if (idx < 0 || idx >= list.length - 1) return;
    const next = list[idx + 1];
    const curr = list[idx];
    try {
      await reorderResources([
        [curr.path, next.order],
        [next.path, curr.order],
      ]);
      await reload();
    } catch (e) {
      console.error('下移失败:', e);
    }
  }, [selectedResource, filteredResources, reload]);

  // 导出
  const handleExport = useCallback(async () => {
    const paths = checkedPaths.size > 0
      ? Array.from(checkedPaths)
      : selectedResource ? [selectedResource.path] : [];
    if (paths.length === 0) {
      alert('请先选择要导出的资源');
      return;
    }
    try {
      const outputPath = await save({
        defaultPath: `${config.resourceType}-export.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (!outputPath) return;
      await invoke('cmd_export_resources', { resourcePaths: paths, outputPath });
      alert(`导出成功：${paths.length} 个资源`);
    } catch (e) {
      alert('导出失败: ' + String(e));
    }
  }, [checkedPaths, selectedResource, config.resourceType]);

  // 导入
  const handleImport = useCallback(async () => {
    if (!dataDir) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (!selected) return;
      const zipPath = typeof selected === 'string' ? selected : selected;
      const result = await invoke<{ imported: string[]; skipped: string[]; failed: Array<{ id: string; error: string }> }>('cmd_import_resources', { zipPath, dataDir });
      let msg = `导入完成：\n成功 ${result.imported.length} 个`;
      if (result.skipped.length > 0) msg += `\n跳过 ${result.skipped.length} 个（已存在）`;
      if (result.failed.length > 0) msg += `\n失败 ${result.failed.length} 个`;
      alert(msg);
      await reload();
    } catch (e) {
      alert('导入失败: ' + String(e));
    }
  }, [dataDir, reload]);

  // 批量启用/禁用
  const handleBatchEnable = useCallback(async (enabled: boolean) => {
    const paths = Array.from(checkedPaths);
    if (paths.length === 0) return;
    try {
      const count = await batchSetEnabled(paths, enabled);
      alert(`已${enabled ? '启用' : '禁用'} ${count} 个资源`);
      clearChecked();
      await reload();
    } catch (e) {
      alert('批量操作失败: ' + String(e));
    }
  }, [checkedPaths, clearChecked, reload]);

  // 批量移动分类
  const handleBatchMove = useCallback(async (category: string) => {
    const paths = Array.from(checkedPaths);
    if (paths.length === 0) return;
    try {
      let count: number;
      if (isJsonMode) {
        count = await batchMoveJsonCategory(dataDir, paths, category);
      } else {
        count = await batchMoveCategory(paths, category);
      }
      alert(`已移动 ${count} 个资源到「${category}」`);
      clearChecked();
      await reload();
    } catch (e) {
      alert('批量移动失败: ' + String(e));
    }
  }, [checkedPaths, clearChecked, reload, isJsonMode, dataDir]);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    const paths = Array.from(checkedPaths);
    if (paths.length === 0) return;
    if (!confirm(`确定要删除选中的 ${paths.length} 个资源吗？此操作不可撤销！`)) return;
    try {
      let count: number;
      if (isJsonMode) {
        count = await batchDeleteJsonResources(dataDir, paths);
      } else {
        count = await invoke<number>('cmd_batch_delete_resources', { resourcePaths: paths });
      }
      alert(`已删除 ${count} 个资源`);
      clearChecked();
      setSelectedResource(null);
      await reload();
    } catch (e) {
      alert('批量删除失败: ' + String(e));
    }
  }, [checkedPaths, clearChecked, setSelectedResource, reload, isJsonMode, dataDir]);

  // 批量导出
  const handleBatchExport = useCallback(async () => {
    const paths = Array.from(checkedPaths);
    if (paths.length === 0) return;
    try {
      const outputPath = await save({
        defaultPath: `${config.resourceType}-batch-export.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (!outputPath) return;
      await invoke('cmd_export_resources', { resourcePaths: paths, outputPath });
      alert(`导出成功：${paths.length} 个资源`);
    } catch (e) {
      alert('导出失败: ' + String(e));
    }
  }, [checkedPaths, config.resourceType]);

  // AI 批量新建确认
  const handleAIBatchCreated = useCallback(async (
    items: Array<{
      category: string;
      id: string;
      manifest: Record<string, unknown>;
      contentFiles: Array<{ filename: string; content: string }>;
    }>,
    newCategory?: { key: string; name: string; icon: string },
  ) => {
    if (!dataDir) return;
    try {
      // 如果有新分类，先创建
      if (newCategory) {
        const store = useResourceStore.getState();
        const existingCategories = store.categories;
        const newCat = { key: newCategory.key, name: newCategory.name, icon: newCategory.icon, order: existingCategories.length };
        if (isJsonMode) {
          await saveJsonCategories(dataDir, [...existingCategories, newCat]);
        } else {
          const meta = {
            schemaVersion: '1.0',
            resourceType: config.resourceType,
            categories: [...existingCategories, newCat],
          };
          await saveCategories(dataDir, meta);
        }
      }

      // 逐个创建资源
      let successCount = 0;
      const errors: string[] = [];
      for (const item of items) {
        try {
          await createResource(dataDir, item.category, item.id, item.manifest, item.contentFiles);
          successCount++;
        } catch (e) {
          errors.push(`${item.id}: ${String(e)}`);
        }
      }

      setActiveDialog(null);
      await reload();

      if (errors.length > 0) {
        alert(`创建完成：成功 ${successCount} 个，失败 ${errors.length} 个\n${errors.join('\n')}`);
      } else {
        alert(`成功创建 ${successCount} 个${config.resourceLabel}`);
      }
    } catch (e) {
      alert('批量创建失败: ' + String(e));
    }
  }, [dataDir, reload, config.resourceType, config.resourceLabel]);

  // 编辑区
  const editorPanel = selectedResource ? (
    <div className="p-3 space-y-3">
      <CommonFieldsEditor resource={selectedResource} onChange={handleChange} />
      {config.CustomEditorPanel && (
        <config.CustomEditorPanel resource={selectedResource} onChange={handleChange} />
      )}
    </div>
  ) : (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      选择一个资源进行编辑
    </div>
  );

  return (
    <>
      <ManagerLayout
        title={config.appTitle}
        toolbar={{
          onNew: () => setActiveDialog('create'),
          onAINew: () => setActiveDialog('ai-create'),
          onDelete: handleDelete,
          onMoveUp: handleMoveUp,
          onMoveDown: handleMoveDown,
          onSave: handleSave,
          onUndo: handleUndo,
          onRedo: handleRedo,
          onBatch: () => setBatchMode(!batchMode),
          onImport: handleImport,
          onExport: handleExport,
          onReindex: handleReindex,
          onBuild: config.repoDir ? () => setActiveDialog('build') : undefined,
          onSettings: () => setActiveDialog('settings'),
          onBatchDelete: handleBatchDelete,
          onBatchEnable: handleBatchEnable,
          onBatchMove: handleBatchMove,
          onBatchExport: handleBatchExport,
          hasSelection: !!selectedResource || checkedPaths.size > 0,
          isDirty,
          canUndo: canUndo(),
          canRedo: canRedo(),
        }}
        resourceList={<ResourceList onSelect={handleSelectResource} onReorder={handleReorderResources} />}
        editorPanel={editorPanel}
        onCreateCategory={() => setActiveDialog('create-category')}
        onReorderCategories={handleReorderCategories}
      />

      {/* 对话框 */}
      {activeDialog === 'create' && (
        <CreateDialog
          config={config}
          onConfirm={handleCreateConfirm}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === 'settings' && (
        <SettingsDialog onClose={() => setActiveDialog(null)} />
      )}
      {activeDialog === 'ai-create' && (
        <AICreateDialog
          config={config}
          onBatchCreated={handleAIBatchCreated}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === 'build' && config.repoDir && (
        <BuildDialog
          repoDir={config.repoDir}
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog === 'create-category' && (
        <CreateCategoryDialog
          onConfirm={handleCreateCategory}
          onClose={() => setActiveDialog(null)}
        />
      )}
    </>
  );
}
