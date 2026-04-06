/**
 * 大纲工作区
 *
 * 主工作区容器，整合所有大纲编辑功能
 * layoutMode: 'full'
 */

import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useAppStore } from '@/stores/useAppStore';

// 导入大纲样式
import './styles/outline.css';

import type {
  OutlineDocumentContent,
  Outline,
  FilterState,
  TagIndex,
} from './types';
import {
  parseOutlineContent,
  serializeOutlineContent,
  outlineContentSerializedEqual,
  createEmptyOutline,
  buildTagIndex,
  getOutlineStats,
  findNode,
  findNodePath,
  getNodeAtPath,
  cloneNodeTree,
  removeNodeFromTree,
  insertNodeAtPath,
  updateNodeInTree,
  generateId,
  extractAllNodes,
} from './types';

import { OutlineEditor, type OutlineEditorRef } from './components/OutlineEditor';
import { OutlineTabs } from './components/OutlineTabs';
import { OutlineEditorToolbar } from './components/OutlineEditorToolbar';
import { MindMapEditorToolbar } from './components/MindMapEditorToolbar';
import { TopToolbar } from './components/Toolbar/TopToolbar';
import { StatusBar } from './components/StatusBar';
import { LeftSidebar } from './components/Sidebar/LeftSidebar';
import { OutlineErrorBoundary } from './components/OutlineErrorBoundary';
import { MindMapView } from './components/MindMapView';
import { ExportDialog } from './components/ExportDialog';
import { ImportDialog } from './components/ImportDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { ZoomBreadcrumb } from './components/ZoomBreadcrumb';
import { ArticleView } from './components/ArticleView';
import { ItemMoverDialog } from './components/ItemMoverDialog';
import { PresentationMode } from './components/PresentationMode';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import OutlineAISidebar from './OutlineAISidebar';
import type { MindMapLayout } from '@/plugins/mindmap/SimpleMindMapRenderer';
import type { MindMapViewRef } from './components/MindMapView';

const VersionHistoryPanel = lazy(() =>
  import('@/components/version/VersionHistoryPanel').then((m) => ({ default: m.VersionHistoryPanel })),
);

/** 右栏 AI 宽度（与计算文档 CalculatorWorkspace 一致：localStorage + 拖拽 220–500） */
const OUTLINE_AI_WIDTH_KEY = 'outline-ai-panel-width';
const OUTLINE_AI_MIN_W = 220;
const OUTLINE_AI_MAX_W = 500;
const OUTLINE_AI_DEFAULT_W = 320;

function readOutlineAiPanelWidth(): number {
  if (typeof window === 'undefined') return OUTLINE_AI_DEFAULT_W;
  const raw = localStorage.getItem(OUTLINE_AI_WIDTH_KEY);
  const n = parseInt(raw || '', 10);
  if (!Number.isNaN(n) && n >= OUTLINE_AI_MIN_W && n <= OUTLINE_AI_MAX_W) return n;
  return OUTLINE_AI_DEFAULT_W;
}

// 历史栈最大长度
const MAX_HISTORY = 50;

/**
 * 工作区状态
 */
interface WorkspaceState {
  data: OutlineDocumentContent;
  viewMode: 'outline' | 'mindmap' | 'article';
  isFocusMode: boolean;
  focusNodeId: string | null;
  zoomStack: string[];
  selectedNodeIds: Set<string>;
  activeNodeId: string | null;
  filterState: FilterState;
  tagIndex: TagIndex;
  searchQuery: string;
  searchMatches: Set<string>;
  isLeftSidebarOpen: boolean;
  isAISidebarOpen: boolean;
  undoStack: OutlineDocumentContent[];
  redoStack: OutlineDocumentContent[];
  canUndo: boolean;
  canRedo: boolean;
}

export function OutlineWorkspace({
  documentId,
  document,
  tabId,
  host,
}: DocTypeEditorProps) {
  const { t } = useTranslation();
  const editorRef = useRef<OutlineEditorRef>(null);
  const mindMapRef = useRef<MindMapViewRef>(null);
  const hostRef = useRef(host);
  const lastAppliedContentRef = useRef<string | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [itemMoverOpen, setItemMoverOpen] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);

  const [aiPanelWidth, setAiPanelWidth] = useState(readOutlineAiPanelWidth);
  const [mindMapLayout, setMindMapLayout] = useState<MindMapLayout>('logicalStructure');

  // 保存状态：从 AppStore 读取当前 tab 是否脏
  const tabIsDirty = useAppStore((s) => s.tabs.find((t) => t.id === tabId)?.isDirty ?? false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(OUTLINE_AI_WIDTH_KEY, String(aiPanelWidth));
  }, [aiPanelWidth]);

  useEffect(() => {
    hostRef.current = host;
  }, [host]);

  const [state, setState] = useState<WorkspaceState>(() => {
    const data = parseOutlineContent(document.content || '');
    const allNodes = data.outlines.flatMap((o) => extractAllNodes(o.nodes));
    const tagIndex = buildTagIndex(allNodes);
    return {
      data,
      viewMode: 'outline' as const,
      isFocusMode: false,
      focusNodeId: null,
      zoomStack: [],
      selectedNodeIds: new Set<string>(),
      activeNodeId: null,
      filterState: {
        selectedTags: new Set<string>(),
        selectedMentions: new Set<string>(),
        searchQuery: '',
      },
      tagIndex,
      searchQuery: '',
      searchMatches: new Set<string>(),
      isLeftSidebarOpen: false,
      // 与任务清单等 full 布局一致：默认展开 AI，避免用户找不到入口
      isAISidebarOpen: true,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    };
  });

  // 防抖保存
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 立即保存（Cmd+S 快捷键用）
  const saveNow = useCallback(() => {
    const h = hostRef.current;
    const nextContent = serializeOutlineContent(state.data);
    const currentContent = h.doc.getDocument().content || '';
    if (currentContent === nextContent) return;
    void h.doc.save();
  }, []);

  const syncInMemoryAndMarkDirty = useCallback((newData: OutlineDocumentContent) => {
    const h = hostRef.current;
    const nextContent = serializeOutlineContent(newData);
    const currentContent = h.doc.getDocument().content || '';
    if (currentContent === nextContent) return false;
    h.doc.updateInMemory({ content: nextContent });
    h.doc.markDirty();
    return true;
  }, []);

  const saveDocument = useCallback(
    (newData: OutlineDocumentContent) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setIsSaving(true);
      saveTimeoutRef.current = setTimeout(() => {
        const h = hostRef.current;
        const nextContent = serializeOutlineContent(newData);
        const currentContent = h.doc.getDocument().content || '';
        if (currentContent === nextContent) {
          setIsSaving(false);
          return;
        }
        if (newData.settings.autoSave) {
          void h.doc.save();
        }
        setIsSaving(false);
      }, 500);
    },
    []
  );

  // Cmd+S 快捷键保存
  useEffect(() => {
    const onSave = () => { saveNow(); };
    window.addEventListener('save-active-tab', onSave);
    return () => window.removeEventListener('save-active-tab', onSave);
  }, [saveNow]);

  // 外部内容变化时（如版本恢复/多端修改）同步到工作区状态
  useEffect(() => {
    const incoming = document.content || '';
    const last = lastAppliedContentRef.current ?? '';
    if (outlineContentSerializedEqual(last, incoming)) {
      lastAppliedContentRef.current = incoming;
      return;
    }

    setState((prev) => {
      const prevContent = serializeOutlineContent(prev.data);
      // 与本地状态语义一致：仅同步宿主字符串形式，避免 pretty/紧凑 JSON 不一致时误覆盖拖拽结果
      if (outlineContentSerializedEqual(prevContent, incoming)) {
        lastAppliedContentRef.current = incoming;
        return prev;
      }
      const parsed = parseOutlineContent(incoming);
      const allNodes = parsed.outlines.flatMap((o) => extractAllNodes(o.nodes));
      const tagIndex = buildTagIndex(allNodes);
      lastAppliedContentRef.current = incoming;
      return {
        ...prev,
        data: parsed,
        tagIndex,
        // 内容变更后，清空选择/搜索，避免指向不存在的节点
        selectedNodeIds: new Set(),
        activeNodeId: null,
        searchMatches: new Set(),
        isFocusMode: false,
        focusNodeId: null,
      };
    });
  }, [document.content]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // 更新数据并触发保存
  const updateData = useCallback(
    (
      updater: (data: OutlineDocumentContent) => OutlineDocumentContent,
      pushHistory = true
    ) => {
      let nextDataToPersist: OutlineDocumentContent | null = null;
      setState((prev) => {
        const newData = updater(prev.data);
        nextDataToPersist = newData;
        const allNodes = newData.outlines.flatMap((o) =>
          extractAllNodes(o.nodes)
        );
        const newTagIndex = buildTagIndex(allNodes);

        // 更新历史栈
        const newUndoStack = pushHistory
          ? [...prev.undoStack, prev.data].slice(-MAX_HISTORY)
          : prev.undoStack;

        return {
          ...prev,
          data: newData,
          tagIndex: newTagIndex,
          undoStack: newUndoStack,
          redoStack: [],
          canUndo: newUndoStack.length > 0,
          canRedo: false,
        };
      });
      if (nextDataToPersist) {
        syncInMemoryAndMarkDirty(nextDataToPersist);
        saveDocument(nextDataToPersist);
      }
    },
    [saveDocument, syncInMemoryAndMarkDirty]
  );

  const updateSearchMatches = useCallback((matches: Set<string>) => {
    setState((prev) => {
      if (prev.searchMatches === matches) return prev;
      if (prev.searchMatches.size === matches.size) {
        let same = true;
        for (const id of matches) {
          if (!prev.searchMatches.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return { ...prev, searchMatches: matches };
    });
  }, []);

  // 撤销
  const undo = useCallback(() => {
    let nextDataToPersist: OutlineDocumentContent | null = null;
    setState((prev) => {
      if (prev.undoStack.length === 0) return prev;

      const prevData = prev.undoStack[prev.undoStack.length - 1];
      const allNodes = prevData.outlines.flatMap((o) =>
        extractAllNodes(o.nodes)
      );
      nextDataToPersist = prevData;

      return {
        ...prev,
        data: prevData,
        tagIndex: buildTagIndex(allNodes),
        undoStack: prev.undoStack.slice(0, -1),
        redoStack: [prev.data, ...prev.redoStack],
        canUndo: prev.undoStack.length > 1,
        canRedo: true,
      };
    });
    if (nextDataToPersist) {
      syncInMemoryAndMarkDirty(nextDataToPersist);
      saveDocument(nextDataToPersist);
    }
  }, [saveDocument, syncInMemoryAndMarkDirty]);

  // 重做
  const redo = useCallback(() => {
    let nextDataToPersist: OutlineDocumentContent | null = null;
    setState((prev) => {
      if (prev.redoStack.length === 0) return prev;

      const nextData = prev.redoStack[0];
      const allNodes = nextData.outlines.flatMap((o) =>
        extractAllNodes(o.nodes)
      );
      nextDataToPersist = nextData;

      return {
        ...prev,
        data: nextData,
        tagIndex: buildTagIndex(allNodes),
        undoStack: [...prev.undoStack, prev.data],
        redoStack: prev.redoStack.slice(1),
        canUndo: true,
        canRedo: prev.redoStack.length > 1,
      };
    });
    if (nextDataToPersist) {
      syncInMemoryAndMarkDirty(nextDataToPersist);
      saveDocument(nextDataToPersist);
    }
  }, [saveDocument, syncInMemoryAndMarkDirty]);

  // 获取当前大纲（outlines 为空时的稳定 fallback，避免每次渲染创建新对象）
  const [fallbackOutline] = useState<Outline>(() => createEmptyOutline());
  const activeOutline = useMemo(() => {
    return (
      state.data.outlines.find((o) => o.id === state.data.activeOutlineId) ||
      state.data.outlines[0] ||
      fallbackOutline
    );
  }, [state.data.outlines, state.data.activeOutlineId, fallbackOutline]);

  const activeNode = useMemo(() => {
    if (!state.activeNodeId) return null;
    return findNode(activeOutline.nodes, state.activeNodeId);
  }, [activeOutline.nodes, state.activeNodeId]);

  /** 编辑工具栏：空大纲可无选中添加首节点；有节点时需选中才能添加/编辑 */
  const outlineToolbarFlags = useMemo(() => {
    const hasNodes = activeOutline.nodes.length > 0;
    const a = state.activeNodeId;
    return {
      canAddSibling: !hasNodes || !!a,
      canAddChild: !hasNodes || !!a,
      canToggleExpandActive:
        !!activeNode && (activeNode.children?.length ?? 0) > 0,
    };
  }, [activeOutline.nodes.length, state.activeNodeId, activeNode]);

  // 切换大纲
  const switchOutline = useCallback((outlineId: string) => {
    let nextDataToPersist: OutlineDocumentContent | null = null;
    setState((prev) => {
      const newData = {
        ...prev.data,
        activeOutlineId: outlineId,
      };
      nextDataToPersist = newData;
      return {
        ...prev,
        data: newData,
        selectedNodeIds: new Set<string>(),
        activeNodeId: null,
        searchMatches: new Set<string>(),
      };
    });
    if (nextDataToPersist) {
      syncInMemoryAndMarkDirty(nextDataToPersist);
      saveDocument(nextDataToPersist);
    }
  }, [saveDocument, syncInMemoryAndMarkDirty]);

  // 添加新大纲
  const addOutline = useCallback(() => {
    const newOutline = createEmptyOutline(
      t('outline.newOutline', { defaultValue: '新大纲' })
    );

    updateData((data) => ({
      ...data,
      outlines: [...data.outlines, newOutline],
      activeOutlineId: newOutline.id,
    }));
  }, [updateData, t]);

  // 删除大纲
  const deleteOutline = useCallback(
    (outlineId: string) => {
      if (state.data.outlines.length <= 1) {
        host.ui.showNotification(t('outline.cannotDeleteLast'), 'info');
        return;
      }

      updateData((data) => {
        const newOutlines = data.outlines.filter((o) => o.id !== outlineId);
        return {
          ...data,
          outlines: newOutlines,
          activeOutlineId:
            data.activeOutlineId === outlineId
              ? newOutlines[0]?.id
              : data.activeOutlineId,
        };
      });
    },
    [updateData, state.data.outlines.length, host.ui, t]
  );

  // 重命名大纲
  const renameOutline = useCallback(
    (outlineId: string, newTitle: string) => {
      updateData((data) => ({
        ...data,
        outlines: data.outlines.map((o) =>
          o.id === outlineId ? { ...o, title: newTitle } : o
        ),
      }));
    },
    [updateData]
  );

  // 复制当前大纲（对齐计算文档「复制工作表」）
  const duplicateOutline = useCallback(
    (outlineId: string) => {
      const src = state.data.outlines.find((o) => o.id === outlineId);
      if (!src) return;
      const now = new Date().toISOString();
      const dup: Outline = {
        ...src,
        id: generateId(),
        title: `${src.title} (${t('outline.duplicateCopy', { defaultValue: '副本' })})`,
        nodes: src.nodes.map((n) => cloneNodeTree(n)),
        createdAt: now,
        updatedAt: now,
      };
      updateData((data) => ({
        ...data,
        outlines: [...data.outlines, dup],
        activeOutlineId: dup.id,
      }));
    },
    [state.data.outlines, updateData, t]
  );

  const handleSaveDocument = useCallback(() => {
    void host.doc.save();
  }, [host.doc]);

  const handleSaveAllDocuments = useCallback(() => {
    void host.doc.saveAllDirtyTabs();
  }, [host.doc]);

  const handleCreateVersionQuick = useCallback(() => {
    void host.doc.createVersion();
  }, [host.doc]);

  // 更新大纲内容
  const updateOutline = useCallback(
    (updater: (outline: Outline) => Outline) => {
      updateData((data) => ({
        ...data,
        outlines: data.outlines.map((o) =>
          o.id === data.activeOutlineId ? updater(o) : o
        ),
      }));
    },
    [updateData]
  );

  // 节点选择
  const selectNode = useCallback((
    nodeId: string,
    mode: 'single' | 'toggle' | 'range',
    orderedVisibleNodeIds?: string[]
  ) => {
    setState((prev) => {
      if (mode === 'toggle') {
        const isSelected = prev.selectedNodeIds.has(nodeId);
        const newSelected = new Set(prev.selectedNodeIds);
        if (isSelected) {
          newSelected.delete(nodeId);
        } else {
          newSelected.add(nodeId);
        }
        selectionAnchorRef.current = nodeId;
        return {
          ...prev,
          selectedNodeIds: newSelected,
          activeNodeId: nodeId,
        };
      }
      if (mode === 'range' && orderedVisibleNodeIds && orderedVisibleNodeIds.length > 0) {
        const anchor = selectionAnchorRef.current || prev.activeNodeId || nodeId;
        const a = orderedVisibleNodeIds.indexOf(anchor);
        const b = orderedVisibleNodeIds.indexOf(nodeId);
        if (a >= 0 && b >= 0) {
          const start = Math.min(a, b);
          const end = Math.max(a, b);
          const rangeIds = orderedVisibleNodeIds.slice(start, end + 1);
          return {
            ...prev,
            selectedNodeIds: new Set(rangeIds),
            activeNodeId: nodeId,
          };
        }
      }
      selectionAnchorRef.current = nodeId;
      return {
        ...prev,
        selectedNodeIds: new Set([nodeId]),
        activeNodeId: nodeId,
      };
    });
  }, []);

  const selectAllVisibleNodes = useCallback((orderedVisibleNodeIds: string[]) => {
    if (orderedVisibleNodeIds.length === 0) return;
    selectionAnchorRef.current = orderedVisibleNodeIds[0];
    setState((prev) => ({
      ...prev,
      selectedNodeIds: new Set(orderedVisibleNodeIds),
      activeNodeId: orderedVisibleNodeIds[0] ?? prev.activeNodeId,
    }));
  }, []);

  const deleteSelectedNodes = useCallback(() => {
    const ids = Array.from(state.selectedNodeIds);
    if (ids.length === 0) return false;
    updateOutline((outline) => {
      let nodes = outline.nodes;
      for (const id of ids) {
        nodes = removeNodeFromTree(nodes, id);
      }
      return {
        ...outline,
        nodes,
        updatedAt: new Date().toISOString(),
      };
    });
    setState((prev) => ({
      ...prev,
      selectedNodeIds: new Set<string>(),
      activeNodeId: null,
    }));
    return true;
  }, [state.selectedNodeIds, updateOutline]);

  // 激活节点
  const activateNode = useCallback((nodeId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedNodeIds: nodeId ? new Set([nodeId]) : new Set<string>(),
      activeNodeId: nodeId,
    }));
  }, []);

  // 进入聚焦模式（支持多层 Zoom）
  const enterFocusMode = useCallback((nodeId: string) => {
    setState((prev) => {
      const currentFocusId = prev.isFocusMode && prev.focusNodeId ? prev.focusNodeId : null;
      return {
        ...prev,
        isFocusMode: true,
        focusNodeId: nodeId,
        zoomStack: currentFocusId ? [...prev.zoomStack, currentFocusId] : prev.zoomStack,
        selectedNodeIds: new Set<string>(),
      };
    });
  }, []);

  // 退出聚焦模式（支持多层回退）
  const exitFocusMode = useCallback(() => {
    setState((prev) => {
      if (prev.zoomStack.length > 0) {
        // 回退到上一层
        const parentId = prev.zoomStack[prev.zoomStack.length - 1];
        return {
          ...prev,
          focusNodeId: parentId,
          zoomStack: prev.zoomStack.slice(0, -1),
        };
      }
      return {
        ...prev,
        isFocusMode: false,
        focusNodeId: null,
        zoomStack: [],
      };
    });
  }, []);

  // 切换视图模式（循环）
  const toggleViewMode = useCallback(() => {
    setState((prev) => {
      const modes: Array<'outline' | 'mindmap' | 'article'> = ['outline', 'mindmap', 'article'];
      const idx = modes.indexOf(prev.viewMode);
      return { ...prev, viewMode: modes[(idx + 1) % modes.length] };
    });
  }, []);

  // 直接设置视图模式
  const setViewMode = useCallback((mode: 'outline' | 'mindmap' | 'article') => {
    setState((prev) => ({ ...prev, viewMode: mode }));
  }, []);

  // 更新过滤器
  const updateFilter = useCallback((filter: Partial<FilterState>) => {
    setState((prev) => {
      const newFilter = { ...prev.filterState, ...filter };
      return {
        ...prev,
        filterState: newFilter,
      };
    });
  }, []);

  // 清空过滤器
  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      filterState: {
        selectedTags: new Set<string>(),
        selectedMentions: new Set<string>(),
        searchQuery: '',
      },
      searchQuery: '',
      searchMatches: new Set<string>(),
    }));
  }, []);

  // 统计信息
  const stats = useMemo(() => getOutlineStats(state.data), [state.data]);

  // 面包屑路径
  const breadcrumbs = useMemo(() => {
    if (!state.isFocusMode || !state.focusNodeId) return [];

    const path = findNodePath(activeOutline.nodes, state.focusNodeId);
    if (!path) return [];

    const crumbs: { label: string; nodeId: string }[] = [];
    for (let i = 0; i < path.length; i++) {
      const node = getNodeAtPath(activeOutline.nodes, path.slice(0, i + 1));
      if (node) {
        crumbs.push({ label: node.plainText, nodeId: node.id });
      }
    }
    return crumbs;
  }, [activeOutline.nodes, state.isFocusMode, state.focusNodeId]);

  // 跳转到指定 Zoom 层级（通过面包屑，必须在 breadcrumbs 之后）
  const zoomToIndex = useCallback((index: number) => {
    const targetNodeId = breadcrumbs[index]?.nodeId;
    if (!targetNodeId) {
      setState((prev) => ({ ...prev, isFocusMode: false, focusNodeId: null, zoomStack: [] }));
      return;
    }
    setState((prev) => {
      if (targetNodeId === prev.focusNodeId) return prev;
      const newZoomStack = breadcrumbs.slice(0, index).map(b => b.nodeId);
      return {
        ...prev,
        focusNodeId: targetNodeId,
        zoomStack: newZoomStack,
      };
    });
  }, [breadcrumbs]);

  return (
    <OutlineErrorBoundary resetKey={documentId}>
      {/*
        布局对齐计算文档 CalculatorWorkspace：
        - 外层横向 flex：左栏 = 工具栏 + 标签 +（左辅助栏 | 主编辑）+ 状态栏；右栏 = 拖拽条 + 可调宽 AI。
        - 状态栏仅覆盖主内容列，不延伸到 AI 下方。
      */}
      <div className="flex h-full w-full overflow-hidden bg-background">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 顶部工具栏 */}
          <TopToolbar
            documentTitle={document.title || t('outline.untitled', { defaultValue: '未命名大纲' })}
            viewMode={state.viewMode}
            canUndo={state.canUndo}
            canRedo={state.canRedo}
            onUndo={undo}
            onRedo={redo}
            onSave={handleSaveDocument}
            onSaveAll={handleSaveAllDocuments}
            onCreateVersion={handleCreateVersionQuick}
            onOpenVersionHistory={() => setVersionHistoryOpen(true)}
            onToggleViewMode={toggleViewMode}
            onSetViewMode={setViewMode}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenExport={() => setExportOpen(true)}
            onOpenImport={() => setImportOpen(true)}
            leftSidebarOpen={state.isLeftSidebarOpen}
            onToggleLeftSidebar={() =>
              setState((prev) => ({ ...prev, isLeftSidebarOpen: !prev.isLeftSidebarOpen }))
            }
            aiSidebarOpen={state.isAISidebarOpen}
            onToggleAISidebar={() =>
              setState((prev) => ({ ...prev, isAISidebarOpen: !prev.isAISidebarOpen }))
            }
            filterState={state.filterState}
            onFilterChange={updateFilter}
            onClearFilters={clearFilters}
            onOpenItemMover={() => setItemMoverOpen(true)}
            onOpenPresentation={() => setPresentationOpen(true)}
          />

          {/* 大纲标签切换 */}
          <OutlineTabs
            outlines={state.data.outlines}
            activeId={state.data.activeOutlineId}
            onSelect={switchOutline}
            onAdd={addOutline}
            onRename={renameOutline}
            onDelete={deleteOutline}
            onDuplicate={duplicateOutline}
          />

          <OutlineEditorToolbar
            visible={state.viewMode === 'outline'}
            hasActiveNode={!!state.activeNodeId}
            canAddSibling={outlineToolbarFlags.canAddSibling}
            canAddChild={outlineToolbarFlags.canAddChild}
            canToggleExpandActive={outlineToolbarFlags.canToggleExpandActive}
            onAddSibling={() => editorRef.current?.addSibling()}
            onAddChild={() => editorRef.current?.addChild()}
            onDeleteNode={() => editorRef.current?.deleteNode()}
            onMoveUp={() => editorRef.current?.moveUp()}
            onMoveDown={() => editorRef.current?.moveDown()}
            onIndent={() => editorRef.current?.indent()}
            onOutdent={() => editorRef.current?.outdent()}
            onClone={() => editorRef.current?.cloneNode()}
            onOpenSearch={() => editorRef.current?.openSearch()}
            hasCollapsedNodes={(activeOutline.collapsedNodeIds?.length ?? 0) > 0}
            onToggleExpandAll={() => {
              if ((activeOutline.collapsedNodeIds?.length ?? 0) > 0) {
                editorRef.current?.expandAll();
              } else {
                editorRef.current?.collapseAll();
              }
            }}
            onToggleExpandActive={() => editorRef.current?.toggleExpand()}
            onFormatBold={() => editorRef.current?.toggleBold()}
            onFormatItalic={() => editorRef.current?.toggleItalic()}
            onFormatUnderline={() => editorRef.current?.toggleUnderline()}
            onFormatStrike={() => editorRef.current?.toggleStrike()}
            onClearFormat={() => editorRef.current?.clearFormat()}
            onFormatHighlight={(color) => editorRef.current?.setHighlight(color)}
            onSetHeading={(level) => editorRef.current?.setHeadingLevel(level)}
            activeHeadingLevel={activeNode?.headingLevel ?? 0}
          />
          <MindMapEditorToolbar
            visible={state.viewMode === 'mindmap'}
            layout={mindMapLayout}
            onSetLayout={setMindMapLayout}
            onZoomIn={() => mindMapRef.current?.zoomIn()}
            onZoomOut={() => mindMapRef.current?.zoomOut()}
            onResetScale={() => mindMapRef.current?.resetScale()}
            onFitContent={() => mindMapRef.current?.fitContent()}
            onCenterRoot={() => mindMapRef.current?.moveToCenter()}
            onExpandAll={() => mindMapRef.current?.expandAll()}
            onCollapseToLevel={(level) => mindMapRef.current?.collapseToLevel(level)}
          />

          {/* Zoom 面包屑（聚焦模式时显示） */}
          {state.isFocusMode && state.focusNodeId && breadcrumbs.length > 0 && (
            <ZoomBreadcrumb
              items={breadcrumbs.map(b => ({ label: b.label, nodeId: b.nodeId }))}
              onZoomTo={zoomToIndex}
              onExit={exitFocusMode}
            />
          )}

          {/* 主工作区（仅左栏：不含 AI） */}
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            {/* 左侧边栏 */}
            {state.isLeftSidebarOpen && (
              <LeftSidebar
                tagIndex={state.tagIndex}
                filterState={state.filterState}
                onFilterChange={updateFilter}
                onClearFilters={clearFilters}
                breadcrumbs={breadcrumbs}
                isFocusMode={state.isFocusMode}
                onExitFocus={exitFocusMode}
                onBreadcrumbClick={zoomToIndex}
              />
            )}

            {/* 主编辑区 */}
            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden">
                {state.viewMode === 'outline' ? (
                  <OutlineEditor
                    ref={editorRef}
                    outline={activeOutline}
                    filterState={state.filterState}
                    tagIndex={state.tagIndex}
                    selectedNodeIds={state.selectedNodeIds}
                    activeNodeId={state.activeNodeId}
                    searchMatches={state.searchMatches}
                    isFocusMode={state.isFocusMode}
                    focusNodeId={state.focusNodeId}
                    settings={state.data.settings}
                    onOutlineChange={updateOutline}
                    onNodeSelect={selectNode}
                    onNodeActivate={activateNode}
                    onFocusNode={enterFocusMode}
                    onSelectAllVisibleNodes={selectAllVisibleNodes}
                    onDeleteSelectedNodes={deleteSelectedNodes}
                    onSearchMatchesChange={updateSearchMatches}
                    onUndo={undo}
                    onRedo={redo}
                    documentId={documentId}
                    onOpenExport={() => setExportOpen(true)}
                  />
                ) : state.viewMode === 'mindmap' ? (
                  <MindMapView
                    ref={mindMapRef}
                    outline={activeOutline}
                    onNodeActivate={(id) => activateNode(id)}
                    onOutlineChange={(updater) => updateOutline(updater)}
                    layout={mindMapLayout}
                  />
                ) : (
                  <ArticleView
                    outline={activeOutline}
                    onFocusNode={(id) => {
                      enterFocusMode(id);
                      setViewMode('outline');
                    }}
                    onSwitchToOutline={() => setViewMode('outline')}
                  />
                )}
              </div>
            </main>
          </div>

          {/* 状态栏（与计算文档一致：只属于主列） */}
          <StatusBar
            stats={stats}
            filterActive={
              state.filterState.selectedTags.size > 0 ||
              state.filterState.selectedMentions.size > 0 ||
              state.filterState.searchQuery !== ''
            }
            saveStatus={isSaving ? 'saving' : tabIsDirty ? 'unsaved' : 'saved'}
            showWordCount={state.data.settings.showWordCount}
            showProgress={state.data.settings.showProgress}
          />
        </div>

        {/* 右栏：ResizableHandle + AI（与 CalculatorWorkspace 相同模式） */}
        {state.isAISidebarOpen && (
          <>
            <ResizableHandle
              direction="horizontal"
              onResize={(d) =>
                setAiPanelWidth((w) =>
                  Math.min(OUTLINE_AI_MAX_W, Math.max(OUTLINE_AI_MIN_W, w - d)),
                )
              }
            />
            <div
              className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l bg-card"
              style={{ width: aiPanelWidth }}
            >
              <OutlineAISidebar
                document={document}
                host={host}
                activeNodeId={state.activeNodeId}
                activeOutline={activeOutline}
                selectedNodeIds={Array.from(state.selectedNodeIds)}
                onClose={() => setState((prev) => ({ ...prev, isAISidebarOpen: false }))}
                onApplyNodes={(nodes, strategy) => {
                  if (strategy === 'replace-outline') {
                    updateOutline((o) => ({
                      ...o,
                      nodes,
                      updatedAt: new Date().toISOString(),
                    }));
                    return;
                  }
                  if (strategy === 'insert-children') {
                    editorRef.current?.insertChildren(nodes);
                    return;
                  }
                  updateOutline((o) => ({
                    ...o,
                    nodes: [...o.nodes, ...nodes],
                    updatedAt: new Date().toISOString(),
                  }));
                }}
              />
            </div>
          </>
        )}

        <ExportDialog
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          outline={activeOutline}
          documentTitle={document.title || t('outline.title', { defaultValue: '大纲' })}
          documentId={documentId}
          projectId={document.projectId}
        />

        <ImportDialog
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          activeNodeId={state.activeNodeId}
          onImport={(nodes, strategy) => {
            if (strategy === 'replace-outline') {
              updateOutline((o) => ({
                ...o,
                nodes,
                updatedAt: new Date().toISOString(),
              }));
              return;
            }
            if (strategy === 'insert-children') {
              editorRef.current?.insertChildren(nodes);
              return;
            }
            // append-root
            updateOutline((o) => ({
              ...o,
              nodes: [...o.nodes, ...nodes],
              updatedAt: new Date().toISOString(),
            }));
          }}
        />

        <SettingsDialog
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={state.data.settings}
          onSettingsChange={(settings) => {
            updateData((data) => ({
              ...data,
              settings,
              updatedAt: new Date().toISOString(),
            }), false);
          }}
        />

        {/* Item Mover Dialog */}
        <ItemMoverDialog
          isOpen={itemMoverOpen}
          onClose={() => setItemMoverOpen(false)}
          nodes={activeOutline.nodes}
          sourceNodeId={state.activeNodeId}
          onMove={(sourceId, targetId, position) => {
            updateOutline((o) => {
              const movedNode = findNode(o.nodes, sourceId);
              if (!movedNode) return o;
              const nodesWithoutSource = removeNodeFromTree(o.nodes, sourceId);
              if (position === 'inside') {
                const targetNode = findNode(nodesWithoutSource, targetId);
                if (!targetNode) return o;
                const updatedNodes = updateNodeInTree(nodesWithoutSource, targetId, (n) => ({
                  ...n,
                  children: [...n.children, cloneNodeTree(movedNode)],
                }));
                return { ...o, nodes: updatedNodes, updatedAt: new Date().toISOString() };
              }
              const targetPath = findNodePath(nodesWithoutSource, targetId);
              if (!targetPath) return o;
              const parentPath = targetPath.slice(0, -1);
              const targetIndex = targetPath[targetPath.length - 1];
              const insertIdx = position === 'before' ? targetIndex : targetIndex + 1;
              const newNodes = insertNodeAtPath(nodesWithoutSource, parentPath, insertIdx, cloneNodeTree(movedNode));
              return { ...o, nodes: newNodes, updatedAt: new Date().toISOString() };
            });
          }}
        />

        {/* Presentation Mode */}
        {presentationOpen && (
          <PresentationMode
            nodes={activeOutline.nodes}
            outlineTitle={activeOutline.title || document.title || ''}
            onClose={() => setPresentationOpen(false)}
          />
        )}

        <Suspense fallback={null}>
          <VersionHistoryPanel
            open={versionHistoryOpen}
            onClose={() => setVersionHistoryOpen(false)}
            projectId={document.projectId}
            documentId={documentId}
          />
        </Suspense>
      </div>
    </OutlineErrorBoundary>
  );
}

export default OutlineWorkspace;


