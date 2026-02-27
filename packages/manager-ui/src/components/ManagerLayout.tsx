import { type ReactNode, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Sparkles,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Layers,
  Download,
  Upload,
  Hammer,
  Settings,
  Undo2,
  Redo2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ListOrdered,
  X,
  CheckSquare,
  Square,
  Power,
  PowerOff,
  FolderInput,
} from 'lucide-react';
import { CategoryTree } from './CategoryTree';
import { SearchBar } from './SearchBar';
import { ResizeHandle } from './ResizeHandle';
import { useResourceStore } from '../stores/useResourceStore';

const MIN_PANEL_WIDTH = 120;
const MAX_CATEGORY_WIDTH = 360;
const MAX_RESOURCE_WIDTH = 480;

interface ManagerLayoutProps {
  title: string;
  toolbar: {
    onNew: () => void;
    onAINew: () => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onSave: () => void;
    onBatch: () => void;
    onImport: () => void;
    onExport: () => void;
    onBuild?: () => void;
    onSettings: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onReindex: () => void;
    onBatchDelete: () => void;
    onBatchEnable: (enabled: boolean) => void;
    onBatchMove: (category: string) => void;
    onBatchExport: () => void;
    hasSelection: boolean;
    isDirty: boolean;
    canUndo: boolean;
    canRedo: boolean;
  };
  resourceList: ReactNode;
  editorPanel: ReactNode;
  categoryFooter?: ReactNode;
  onCreateCategory?: () => void;
  onReorderCategories?: (reordered: import('@aidocplus/manager-shared').CategoryDefinition[]) => void;
}

export function ManagerLayout({
  toolbar,
  resourceList,
  editorPanel,
  categoryFooter,
  onCreateCategory,
  onReorderCategories,
}: ManagerLayoutProps) {
  const { t } = useTranslation();

  const batchMode = useResourceStore((s) => s.batchMode);
  const checkedPaths = useResourceStore((s) => s.checkedPaths);
  const filteredResources = useResourceStore((s) => s.filteredResources)();
  const setAllChecked = useResourceStore((s) => s.setAllChecked);
  const clearChecked = useResourceStore((s) => s.clearChecked);
  const categories = useResourceStore((s) => s.categories);
  const [moveCategory, setMoveCategory] = useState('');

  const categoryCollapsed = useResourceStore((s) => s.categoryPanelCollapsed);
  const resourceCollapsed = useResourceStore((s) => s.resourcePanelCollapsed);
  const categoryWidth = useResourceStore((s) => s.categoryPanelWidth);
  const resourceWidth = useResourceStore((s) => s.resourcePanelWidth);
  const setCategoryCollapsed = useResourceStore((s) => s.setCategoryPanelCollapsed);
  const setResourceCollapsed = useResourceStore((s) => s.setResourcePanelCollapsed);
  const setCategoryWidth = useResourceStore((s) => s.setCategoryPanelWidth);
  const setResourceWidth = useResourceStore((s) => s.setResourcePanelWidth);

  const handleCategoryResize = useCallback(
    (delta: number) => {
      setCategoryWidth((prev: number) => Math.max(MIN_PANEL_WIDTH, Math.min(MAX_CATEGORY_WIDTH, prev + delta)));
    },
    [setCategoryWidth]
  );

  const handleResourceResize = useCallback(
    (delta: number) => {
      setResourceWidth((prev: number) => Math.max(MIN_PANEL_WIDTH, Math.min(MAX_RESOURCE_WIDTH, prev + delta)));
    },
    [setResourceWidth]
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* 工具栏 */}
      {batchMode ? (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-blue-50 shrink-0 min-h-[48px]">
          <span className="text-sm font-medium text-blue-700">
            已选 {checkedPaths.size} 项
          </span>

          <div className="w-px h-5 bg-blue-200 mx-1" />

          <button
            onClick={() => {
              if (checkedPaths.size === filteredResources.length) {
                clearChecked();
              } else {
                setAllChecked(filteredResources.map((r) => r.path));
              }
            }}
            className="toolbar-btn"
            title={checkedPaths.size === filteredResources.length ? '取消全选' : '全选'}
          >
            {checkedPaths.size === filteredResources.length
              ? <CheckSquare className="h-4 w-4 text-blue-600" />
              : <Square className="h-4 w-4" />}
            <span>{checkedPaths.size === filteredResources.length ? '取消全选' : '全选'}</span>
          </button>

          <div className="w-px h-5 bg-blue-200 mx-1" />

          <button
            onClick={() => toolbar.onBatchEnable(true)}
            disabled={checkedPaths.size === 0}
            className="toolbar-btn"
            title="批量启用"
          >
            <Power className="h-4 w-4" />
            <span>启用</span>
          </button>

          <button
            onClick={() => toolbar.onBatchEnable(false)}
            disabled={checkedPaths.size === 0}
            className="toolbar-btn"
            title="批量禁用"
          >
            <PowerOff className="h-4 w-4" />
            <span>禁用</span>
          </button>

          <div className="w-px h-5 bg-blue-200 mx-1" />

          <select
            value={moveCategory}
            onChange={(e) => setMoveCategory(e.target.value)}
            className="h-8 rounded-md border border-input bg-white px-2 text-sm outline-none"
          >
            <option value="">移动到...</option>
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>{cat.name}</option>
            ))}
          </select>
          <button
            onClick={() => { if (moveCategory) toolbar.onBatchMove(moveCategory); }}
            disabled={checkedPaths.size === 0 || !moveCategory}
            className="toolbar-btn"
            title="批量移动分类"
          >
            <FolderInput className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-blue-200 mx-1" />

          <button
            onClick={toolbar.onBatchExport}
            disabled={checkedPaths.size === 0}
            className="toolbar-btn"
            title="批量导出"
          >
            <Download className="h-4 w-4" />
            <span>导出</span>
          </button>

          <button
            onClick={toolbar.onBatchDelete}
            disabled={checkedPaths.size === 0}
            className="toolbar-btn text-red-600"
            title="批量删除"
          >
            <Trash2 className="h-4 w-4" />
            <span>删除</span>
          </button>

          <div className="flex-1 min-w-0" />

          <button onClick={toolbar.onBatch} className="toolbar-btn" title="退出批量模式">
            <X className="h-4 w-4" />
            <span>退出批量</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/30 shrink-0 min-h-[48px]">
          {/* 面板折叠按钮 */}
          <button
            onClick={() => setCategoryCollapsed(!categoryCollapsed)}
            className="toolbar-btn"
            title={categoryCollapsed ? '展开分类栏' : '收起分类栏'}
          >
            {categoryCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setResourceCollapsed(!resourceCollapsed)}
            className="toolbar-btn"
            title={resourceCollapsed ? '展开列表栏' : '收起列表栏'}
          >
            {resourceCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          </button>

          <div className="w-px h-5 bg-border/60 mx-1" />

          <button onClick={toolbar.onNew} className="toolbar-btn" title={t('common.create', { defaultValue: '新建' })}>
            <Plus className="h-4 w-4" />
            <span>{t('common.create', { defaultValue: '新建' })}</span>
          </button>

          <button onClick={toolbar.onAINew} className="toolbar-btn text-purple-600" title={t('common.aiCreate', { defaultValue: 'AI 新建' })}>
            <Sparkles className="h-4 w-4" />
            <span>{t('common.aiCreate', { defaultValue: 'AI 新建' })}</span>
          </button>

          <div className="w-px h-5 bg-border/60 mx-1" />

          <button onClick={toolbar.onSave} disabled={!toolbar.isDirty} className="toolbar-btn" title={t('common.save', { defaultValue: '保存' })}>
            <Save className="h-4 w-4" />
            <span>{t('common.save', { defaultValue: '保存' })}</span>
          </button>

          <button onClick={toolbar.onUndo} disabled={!toolbar.canUndo} className="toolbar-btn" title={t('common.undo', { defaultValue: '撤销' })}>
            <Undo2 className="h-4 w-4" />
          </button>

          <button onClick={toolbar.onRedo} disabled={!toolbar.canRedo} className="toolbar-btn" title={t('common.redo', { defaultValue: '重做' })}>
            <Redo2 className="h-4 w-4" />
          </button>

          <button onClick={toolbar.onDelete} disabled={!toolbar.hasSelection} className="toolbar-btn" title={t('common.delete', { defaultValue: '删除' })}>
            <Trash2 className="h-4 w-4" />
          </button>

          <button onClick={toolbar.onMoveUp} disabled={!toolbar.hasSelection} className="toolbar-btn" title={t('common.moveUp', { defaultValue: '上移' })}>
            <ChevronUp className="h-4 w-4" />
          </button>

          <button onClick={toolbar.onMoveDown} disabled={!toolbar.hasSelection} className="toolbar-btn" title={t('common.moveDown', { defaultValue: '下移' })}>
            <ChevronDown className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-border/60 mx-1" />

          <button onClick={toolbar.onBatch} className="toolbar-btn" title={t('common.batch', { defaultValue: '批量' })}>
            <Layers className="h-4 w-4" />
          </button>

          <button onClick={toolbar.onImport} className="toolbar-btn" title={t('common.import', { defaultValue: '导入' })}>
            <Upload className="h-4 w-4" />
          </button>

          <button onClick={toolbar.onExport} className="toolbar-btn" title={t('common.export', { defaultValue: '导出' })}>
            <Download className="h-4 w-4" />
          </button>

          <button onClick={toolbar.onReindex} className="toolbar-btn" title="一键重排（按名称重新编号）">
            <ListOrdered className="h-4 w-4" />
          </button>

          {toolbar.onBuild && (
            <button onClick={toolbar.onBuild} className="toolbar-btn" title={t('common.build', { defaultValue: '构建' })}>
              <Hammer className="h-4 w-4" />
            </button>
          )}

          <div className="flex-1 min-w-0" />

          <SearchBar />

          <button onClick={toolbar.onSettings} className="toolbar-btn" title={t('common.settings', { defaultValue: '设置' })}>
            <Settings className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 主体区域 - 三栏布局 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 左栏：分类树 */}
        {!categoryCollapsed && (
          <>
            <div style={{ width: categoryWidth }} className="shrink-0 flex flex-col bg-muted/20 border-r border-border">
              <div className="flex-1 overflow-y-auto">
                <CategoryTree onCreateCategory={onCreateCategory} onReorderCategories={onReorderCategories} />
              </div>
              {categoryFooter && (
                <div className="border-t p-2">{categoryFooter}</div>
              )}
            </div>
            <ResizeHandle onResize={handleCategoryResize} />
          </>
        )}

        {/* 中栏：资源列表 */}
        {!resourceCollapsed && (
          <>
            <div style={{ width: resourceWidth }} className="shrink-0 flex flex-col border-r border-border">
              {resourceList}
            </div>
            <ResizeHandle onResize={handleResourceResize} />
          </>
        )}

        {/* 右栏：编辑面板 */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {editorPanel}
        </div>
      </div>
    </div>
  );
}
