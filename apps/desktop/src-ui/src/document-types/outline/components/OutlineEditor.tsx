/**
 * 大纲编辑器
 *
 * 核心编辑组件，处理大纲节点的渲染、编辑和交互
 * 支持：拖拽排序、富文本编辑、搜索、键盘快捷键
 */

import {
  useState,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useEffect,
  type ForwardedRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  pointerWithin,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  DragCancelEvent,
  DragOverEvent,
  DragEndEvent,
  DragStartEvent,
  CollisionDetection,
  CollisionDescriptor,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus } from 'lucide-react';

import type {
  Outline,
  OutlineHeadingLevel,
  OutlineNode,
  FilterState,
  TagIndex,
  OutlineSettings,
  RichTextContent,
} from '../types';
import {
  findNode,
  findNodePath,
  getNodeAtPath,
  getParentNode,
  getSiblingNodes,
  removeNodeFromTree,
  insertNodeAtPath,
  cloneNodeTree,
} from '../types';
import { useNodeOperations } from '../hooks/useNodeOperations';
import { useOutlineKeyboard } from '../hooks/useOutlineKeyboard';
import { writeOutlineSubtreeToClipboard, parseOutlineClipboardPayload } from '../clipboard';
import { parseClipboardOutlineText } from '../converters/importParsers';

import { OutlineRow } from './OutlineRow';
import { SearchPanel } from './SearchPanel';
import type { ProseMirrorNodeEditorRef } from './ProseMirrorNodeEditor';
import type { OutlineNodeMenuHandlersPartial } from './NodeFloatingMenu';

/**
 * 编辑器引用接口
 */
export interface OutlineEditorRef {
  undo: () => void;
  redo: () => void;

  // 编辑操作
  addSibling: () => void;
  addChild: () => void;
  deleteNode: () => void;
  moveUp: () => void;
  moveDown: () => void;
  indent: () => void;
  outdent: () => void;
  cloneNode: () => void;

  // 展开/折叠
  expandAll: () => void;
  collapseAll: () => void;
  toggleExpand: () => void;

  // 信息获取
  getActiveNode: () => OutlineNode | null;
  getActiveNodePath: () => number[] | null;
  getActiveBranchMarkdown: () => string;
  insertChildren: (nodes: OutlineNode[]) => void;
  updateActiveNodeContent: (content: RichTextContent) => void;

  // 搜索
  openSearch: () => void;
  closeSearch: () => void;

  // 格式化
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleStrike: () => void;
  setHighlight: (color: string | null) => void;
  setHeadingLevel: (level: OutlineHeadingLevel) => void;
  clearFormat: () => void;
  completeSelected: (completed: boolean) => void;
}

/**
 * 编辑器属性
 */
interface OutlineEditorProps {
  outline: Outline;
  filterState: FilterState;
  tagIndex: TagIndex;
  selectedNodeIds: Set<string>;
  activeNodeId: string | null;
  searchMatches: Set<string>;
  isFocusMode: boolean;
  focusNodeId: string | null;
  settings: OutlineSettings;
  onOutlineChange: (updater: (outline: Outline) => Outline) => void;
  onNodeSelect: (
    nodeId: string,
    mode: 'single' | 'toggle' | 'range',
    orderedVisibleNodeIds?: string[]
  ) => void;
  onNodeActivate: (nodeId: string | null) => void;
  onFocusNode: (nodeId: string) => void;
  onSelectAllVisibleNodes?: (orderedVisibleNodeIds: string[]) => void;
  onDeleteSelectedNodes?: () => boolean;
  onSearchMatchesChange?: (matches: Set<string>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  /** 复制节点链接、导出菜单等 */
  documentId?: string;
  onOpenExport?: () => void;
  className?: string;
}

/**
 * 扁平化节点（用于渲染）
 */
interface FlatNode {
  node: OutlineNode;
  path: number[];
  depth: number;
  isLast: boolean;
}

/**
 * 大纲垂直列表碰撞：
 * 1) pointerWithin：指针落在某行矩形内时直接使用（与 dnd-kit 默认一致）
 * 2) 否则用指针到各行垂直区间 [top,bottom] 的最短距离选「最近行」
 *    —— 行与行之间的间隙里 pointerWithin 为空，若回退 closestCenter 会用「被拖元素」
 *    投影中心与各行中心比距，高行/备注行会导致要拖过约一整行才换序；改为纯指针 Y 距离即可 1:1 跟手
 * 3) 无指针坐标（如部分键盘场景）再回退 closestCorners
 */
const outlineVerticalListCollision: CollisionDetection = (args) => {
  const pw = pointerWithin(args);
  if (pw.length > 0) return pw;

  const { active, droppableContainers, droppableRects, pointerCoordinates } = args;
  if (!pointerCoordinates) {
    return closestCorners(args);
  }

  const activeId = active.id;
  const collisions: CollisionDescriptor[] = [];

  for (const droppableContainer of droppableContainers) {
    const { id } = droppableContainer;
    if (id === activeId) continue;
    const rect = droppableRects.get(id);
    if (!rect) continue;

    const py = pointerCoordinates.y;
    const px = pointerCoordinates.x;
    let vy: number;
    if (py < rect.top) vy = rect.top - py;
    else if (py > rect.bottom) vy = py - rect.bottom;
    else vy = 0;

    let hx = 0;
    if (px < rect.left) hx = rect.left - px;
    else if (px > rect.right) hx = px - rect.right;

    const value = vy + hx * 0.02;
    collisions.push({
      id,
      data: { droppableContainer, value },
    });
  }

  return collisions.sort(
    (a, b) => (a.data?.value as number) - (b.data?.value as number)
  );
};

/** TSX 中勿写 forwardRef<Ref, Props>，`<` 会被当作 JSX，导致 Babel 报 Missing initializer */
export const OutlineEditor = forwardRef(function OutlineEditor(
  {
    outline,
    filterState,
    tagIndex,
    selectedNodeIds,
    activeNodeId,
    searchMatches,
    isFocusMode,
    focusNodeId,
    settings,
    onOutlineChange,
    onNodeSelect,
    onNodeActivate,
    onFocusNode,
    onSelectAllVisibleNodes,
    onDeleteSelectedNodes,
    onSearchMatchesChange,
    onUndo,
    onRedo,
    documentId,
    onOpenExport,
    className,
  }: OutlineEditorProps,
  ref: ForwardedRef<OutlineEditorRef>
) {
    const { t } = useTranslation();

    // 本地状态
    const [localCollapsedIds, setLocalCollapsedIds] = useState<Set<string>>(
      () => new Set(outline.collapsedNodeIds)
    );
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // 拖拽状态
    const [_dragActiveId, setDragActiveId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // 节点操作
    const nodeOps = useNodeOperations(outline, onOutlineChange);

    // 将 activeNodeId 和 nodeOps 放入 ref，确保 imperative 方法始终读取最新值
    const activeNodeIdRef = useRef(activeNodeId);
    activeNodeIdRef.current = activeNodeId;
    const nodeOpsRef = useRef(nodeOps);
    nodeOpsRef.current = nodeOps;

    // 节点富文本编辑器实例：nodeId -> editor instance
    const nodeEditorMapRef = useRef<Map<string, ProseMirrorNodeEditorRef | null>>(
      new Map()
    );

    const registerNodeEditor = useCallback(
      (nodeId: string, editor: ProseMirrorNodeEditorRef | null) => {
        nodeEditorMapRef.current.set(nodeId, editor);
      },
      []
    );

    // 当大纲变化时同步折叠状态
    useEffect(() => {
      const incoming = Array.isArray(outline.collapsedNodeIds) ? outline.collapsedNodeIds : [];
      setLocalCollapsedIds((prev) => {
        if (sameSetAndArray(prev, incoming)) return prev;
        return new Set(incoming);
      });
    }, [outline.collapsedNodeIds]);

    // 将折叠状态持久化回 Outline（不进入撤销栈）
    useEffect(() => {
      const next = Array.from(localCollapsedIds);
      const prev = Array.isArray(outline.collapsedNodeIds) ? outline.collapsedNodeIds : [];
      if (sameStringSet(next, prev)) return;
      onOutlineChange((o) => ({
        ...o,
        collapsedNodeIds: next,
        updatedAt: new Date().toISOString(),
      }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localCollapsedIds]);

    // 获取根节点列表（考虑专注模式）
    const rootNodes = useMemo(() => {
      if (isFocusMode && focusNodeId) {
        const focusNode = findNode(outline.nodes, focusNodeId);
        if (!focusNode) return [];
        // 叶节点聚焦：显示自身为根（包装为单元素数组）
        if (focusNode.children.length === 0) {
          return [{ ...focusNode, children: [] }];
        }
        return focusNode.children;
      }
      return outline.nodes;
    }, [outline.nodes, isFocusMode, focusNodeId]);

    const rootNodesRef = useRef(rootNodes);
    rootNodesRef.current = rootNodes;

    // 扁平化节点列表（考虑折叠）
    const flatNodes = useMemo(() => {
      const result: FlatNode[] = [];

      function traverse(
        nodes: OutlineNode[],
        path: number[],
        depth: number
      ) {
        nodes.forEach((node, index) => {
          const isLast = index === nodes.length - 1;
          const currentPath = [...path, index];

          result.push({
            node,
            path: currentPath,
            depth,
            isLast,
          });

          // 如果节点未折叠，递归处理子节点
          if (!localCollapsedIds.has(node.id) && node.children.length > 0) {
            traverse(node.children, currentPath, depth + 1);
          }
        });
      }

      traverse(rootNodes, [], 0);
      return result;
    }, [rootNodes, localCollapsedIds]);

    // 扁平化节点列表（忽略折叠，用于过滤场景）
    const flatNodesUnfiltered = useMemo(() => {
      const result: FlatNode[] = [];

      function traverse(
        nodes: OutlineNode[],
        path: number[],
        depth: number
      ) {
        nodes.forEach((node, index) => {
          const isLast = index === nodes.length - 1;
          const currentPath = [...path, index];

          result.push({
            node,
            path: currentPath,
            depth,
            isLast,
          });

          // 递归处理所有子节点（忽略折叠状态）
          if (node.children.length > 0) {
            traverse(node.children, currentPath, depth + 1);
          }
        });
      }

      traverse(rootNodes, [], 0);
      return result;
    }, [rootNodes]);

    // 过滤后的节点
    const filteredNodes = useMemo(() => {
      if (
        filterState.selectedTags.size === 0 &&
        filterState.selectedMentions.size === 0 &&
        filterState.searchQuery === ''
      ) {
        return flatNodes;
      }

      // 使用忽略折叠的完整节点列表进行过滤
      const nodesToFilter = flatNodesUnfiltered;

      // 获取匹配的节点ID
      const matchingIds = new Set<string>();

      // 标签过滤
      if (filterState.selectedTags.size > 0) {
        for (const tag of filterState.selectedTags) {
          const ids = tagIndex.tags.get(tag);
          if (ids) {
            ids.forEach((id) => matchingIds.add(id));
          }
        }
      }

      // 提及过滤
      if (filterState.selectedMentions.size > 0) {
        for (const mention of filterState.selectedMentions) {
          const ids = tagIndex.mentions.get(mention);
          if (ids) {
            ids.forEach((id) => matchingIds.add(id));
          }
        }
      }

      // 搜索过滤
      if (filterState.searchQuery) {
        const query = filterState.searchQuery.toLowerCase();
        nodesToFilter.forEach(({ node }) => {
          if (
            node.plainText.toLowerCase().includes(query) ||
            (node.notePlainText &&
              node.notePlainText.toLowerCase().includes(query))
          ) {
            matchingIds.add(node.id);
          }
        });
      }

      // 过滤节点，保留匹配节点及其路径上的所有父节点
      const visibleIds = new Set<string>();
      const parentIds = new Set<string>();

      // 首先收集所有匹配节点及其父节点
      nodesToFilter.forEach(({ node, path }) => {
        if (matchingIds.has(node.id)) {
          visibleIds.add(node.id);
          // 添加路径上的所有父节点
          for (let i = 1; i <= path.length; i++) {
            const parentPath = path.slice(0, i);
            const parent = getNodeAtPath(rootNodes, parentPath);
            if (parent) {
              parentIds.add(parent.id);
            }
          }
        }
      });

      // 返回匹配节点和父节点的组合
      return nodesToFilter.filter(
        ({ node }) => visibleIds.has(node.id) || parentIds.has(node.id)
      );
    }, [flatNodes, flatNodesUnfiltered, filterState, tagIndex, rootNodes]);

    const shouldVirtualize = filteredNodes.length > 800;
    const virtualizer = useVirtualizer({
      count: filteredNodes.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => 44,
      measureElement: (el) => el?.getBoundingClientRect().height ?? 44,
      overscan: 12,
    });

    /** 使用 node.id（不要用 path）：交换顺序后 path 会变，若用 path 作 key 会复用错误行上的 ProseMirror，出现「内容串行」 */
    const filteredSortableIds = useMemo(
      () => filteredNodes.map(({ node }) => node.id),
      [filteredNodes]
    );

    const updateOutline = useCallback(
      (updater: (outline: Outline) => Outline) => {
        onOutlineChange((outline) => {
          const newOutline = updater(outline);
          newOutline.collapsedNodeIds = Array.from(localCollapsedIds);
          return newOutline;
        });
      },
      [onOutlineChange, localCollapsedIds]
    );

    const undo = useCallback(() => { onUndo?.(); }, [onUndo]);
    const redo = useCallback(() => { onRedo?.(); }, [onRedo]);

    /** 新建同级 / 空大纲时创建第一个节点（与思维导图插件 Outline 行为一致） */
    const tryAddSibling = useCallback((): boolean => {
      const ops = nodeOpsRef.current;
      const rn = rootNodesRef.current;
      if (rn.length === 0) {
        if (isFocusMode && focusNodeId) {
          const newId = ops.addChild(focusNodeId);
          if (newId) {
            setLocalCollapsedIds((prev) => {
              const next = new Set(prev);
              next.delete(focusNodeId);
              return next;
            });
            setTimeout(() => onNodeActivate(newId), 0);
            return true;
          }
          return false;
        }
        const newId = ops.addRootNode();
        if (newId) {
          setTimeout(() => onNodeActivate(newId), 0);
          return true;
        }
        return false;
      }
      const id = activeNodeIdRef.current;
      if (!id) return false;
      const newId = ops.addSibling(id);
      if (newId) {
        setTimeout(() => onNodeActivate(newId), 0);
        return true;
      }
      return false;
    }, [isFocusMode, focusNodeId, onNodeActivate]);

    const addSibling = useCallback(() => {
      void tryAddSibling();
    }, [tryAddSibling]);

    const addChild = useCallback(() => {
      const rn = rootNodesRef.current;
      if (rn.length === 0) {
        void tryAddSibling();
        return;
      }
      const id = activeNodeIdRef.current;
      if (!id) return;

      const newId = nodeOpsRef.current.addChild(id);
      if (newId) {
        setLocalCollapsedIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        setTimeout(() => onNodeActivate(newId), 0);
      }
    }, [onNodeActivate, tryAddSibling]);

    const deleteNode = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      const rn = rootNodesRef.current;

      const path = findNodePath(rn, id);
      if (!path) return;

      const siblings = getSiblingNodes(rn, id);
      const currentIndex = siblings.findIndex((n) => n.id === id);
      let nextFocusId: string | null = null;

      if (currentIndex > 0) {
        nextFocusId = siblings[currentIndex - 1].id;
      } else if (currentIndex < siblings.length - 1) {
        nextFocusId = siblings[currentIndex + 1].id;
      } else if (path.length > 1) {
        const parent = getParentNode(rn, id);
        nextFocusId = parent?.id || null;
      }

      nodeOpsRef.current.deleteNode(id);
      onNodeActivate(nextFocusId);
      if (nextFocusId) {
        onNodeSelect(nextFocusId, 'single');
      }
    }, [onNodeActivate, onNodeSelect]);

    /** 删除指定节点（浮动菜单等），不依赖 activeNodeId 同步 */
    const deleteNodeById = useCallback(
      (targetId: string) => {
        const path = findNodePath(rootNodes, targetId);
        if (!path) return;
        const siblings = getSiblingNodes(rootNodes, targetId);
        const currentIndex = siblings.findIndex((n) => n.id === targetId);
        let nextFocusId: string | null = null;
        if (currentIndex > 0) {
          nextFocusId = siblings[currentIndex - 1].id;
        } else if (currentIndex < siblings.length - 1) {
          nextFocusId = siblings[currentIndex + 1].id;
        } else if (path.length > 1) {
          const parent = getParentNode(rootNodes, targetId);
          nextFocusId = parent?.id || null;
        }
        nodeOps.deleteNode(targetId);
        onNodeActivate(nextFocusId);
        if (nextFocusId) {
          onNodeSelect(nextFocusId, 'single');
        }
      },
      [rootNodes, nodeOps, onNodeActivate, onNodeSelect]
    );

    const handleNodeMenuHeading = useCallback(
      (nodeId: string, level: OutlineHeadingLevel) => {
        nodeOps.setHeadingLevel(nodeId, level);
      },
      [nodeOps]
    );

    const runEditorOnNode = useCallback(
      (nodeId: string, fn: (ed: ProseMirrorNodeEditorRef) => void) => {
        onNodeActivate(nodeId);
        requestAnimationFrame(() => {
          const ed = nodeEditorMapRef.current.get(nodeId);
          ed?.focus();
          requestAnimationFrame(() => {
            const ed2 = nodeEditorMapRef.current.get(nodeId);
            if (ed2) fn(ed2);
          });
        });
      },
      [onNodeActivate]
    );

    const handleNodeMenuHighlight = useCallback(
      (nodeId: string, color: string | null) => {
        nodeOps.setColorHighlight(nodeId, color);
      },
      [nodeOps]
    );

    const handleCopyNodeLink = useCallback(
      (nodeId: string) => {
        const payload = ['aidocplus', 'outline', documentId ?? 'doc', outline.id, nodeId].join(':');
        void navigator.clipboard.writeText(payload).catch(() => {});
      },
      [documentId, outline.id]
    );

    const createNodeMenuHandlers = useCallback(
      (nodeId: string): OutlineNodeMenuHandlersPartial => ({
        onHeading: (level) => handleNodeMenuHeading(nodeId, level),
        onBold: () => runEditorOnNode(nodeId, (e) => e.toggleBold()),
        onItalic: () => runEditorOnNode(nodeId, (e) => e.toggleItalic()),
        onUnderline: () => runEditorOnNode(nodeId, (e) => e.toggleUnderline()),
        onStrike: () => runEditorOnNode(nodeId, (e) => e.toggleStrike()),
        onClearFormat: () => runEditorOnNode(nodeId, (e) => e.clearFormat()),
        onHighlight: (color) => handleNodeMenuHighlight(nodeId, color),
        onCopyLink: () => handleCopyNodeLink(nodeId),
        onExport: onOpenExport,
        onDelete: () => deleteNodeById(nodeId),
      }),
      [
        handleNodeMenuHeading,
        runEditorOnNode,
        handleNodeMenuHighlight,
        handleCopyNodeLink,
        onOpenExport,
        deleteNodeById,
      ]
    );

    // 上移节点（通过 ref 读取最新 activeNodeId，避免闭包陈旧）
    const moveUp = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      nodeOpsRef.current.moveUp(id);
    }, []);

    // 下移节点
    const moveDown = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      nodeOpsRef.current.moveDown(id);
    }, []);

    // 缩进节点
    const indent = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      nodeOpsRef.current.indent(id);
    }, []);

    // 提升节点
    const outdent = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      nodeOpsRef.current.outdent(id);
    }, []);

    // 克隆节点
    const cloneNode = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      const newId = nodeOpsRef.current.cloneNode(id);
      if (newId) {
        setTimeout(() => onNodeActivate(newId), 0);
      }
    }, [onNodeActivate]);

    // 展开所有节点
    const expandAll = useCallback(() => {
      setLocalCollapsedIds(new Set());
    }, []);

    // 折叠所有节点
    const collapseAll = useCallback(() => {
      const allIds = new Set<string>();
      function traverse(nodes: OutlineNode[]) {
        for (const node of nodes) {
          if (node.children.length > 0) {
            allIds.add(node.id);
            traverse(node.children);
          }
        }
      }
      traverse(rootNodes);
      setLocalCollapsedIds(allIds);
    }, [rootNodes]);

    const toggleExpand = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;

      const node = findNode(rootNodesRef.current, id);
      if (!node || node.children.length === 0) return;

      setLocalCollapsedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    }, []);

    const getActiveNode = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return null;
      return findNode(rootNodesRef.current, id);
    }, []);

    const getActiveNodePath = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return null;
      return findNodePath(rootNodesRef.current, id);
    }, []);

    const getActiveBranchMarkdown = useCallback(() => {
      const node = getActiveNode();
      if (!node) return '';
      return node.plainText;
    }, [getActiveNode]);

    const copySelectedSubtree = useCallback(async () => {
      const ids = selectedNodeIds.size > 0
        ? Array.from(selectedNodeIds)
        : activeNodeIdRef.current
          ? [activeNodeIdRef.current]
          : [];
      if (ids.length === 0) return;
      const nodes = ids
        .map((id) => findNode(rootNodesRef.current, id))
        .filter((n): n is OutlineNode => !!n)
        .map((n) => cloneNodeTree(n));
      if (nodes.length === 0) return;
      await writeOutlineSubtreeToClipboard(outline.title, nodes);
    }, [selectedNodeIds, outline.title]);

    const pasteSubtreeFromClipboard = useCallback(async () => {
      if (!navigator.clipboard?.readText) return;
      const text = await navigator.clipboard.readText();
      const customNodes = parseOutlineClipboardPayload(text);
      const nodes = customNodes ?? parseClipboardOutlineText(text).nodes;
      if (!nodes.length) return;
      const activeId = activeNodeIdRef.current;
      if (activeId) {
        nodeOpsRef.current.insertChildren(activeId, nodes);
        setLocalCollapsedIds((prev) => {
          const next = new Set(prev);
          next.delete(activeId);
          return next;
        });
        return;
      }
      updateOutline((o) => ({
        ...o,
        nodes: [...o.nodes, ...nodes],
        updatedAt: new Date().toISOString(),
      }));
    }, [updateOutline]);

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.isComposing || e.keyCode === 229) return;
        const mod = e.metaKey || e.ctrlKey;
        if (!mod) return;
        if (e.key.toLowerCase() === 'c') {
          void copySelectedSubtree();
        }
        if (e.key.toLowerCase() === 'v') {
          const fromEditor = (e.target as Element | null)?.closest?.('.ProseMirror');
          if (fromEditor) return;
          e.preventDefault();
          void pasteSubtreeFromClipboard();
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [copySelectedSubtree, pasteSubtreeFromClipboard]);

    const insertChildren = useCallback(
      (nodes: OutlineNode[]) => {
        const id = activeNodeIdRef.current;
        if (!id || nodes.length === 0) return;

        nodeOpsRef.current.insertChildren(id, nodes);
        setLocalCollapsedIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      },
      []
    );

    const updateActiveNodeContent = useCallback(
      (content: RichTextContent) => {
        const id = activeNodeIdRef.current;
        if (!id) return;
        nodeOpsRef.current.updateContent(id, content);
      },
      []
    );

    // 搜索功能
    const openSearch = useCallback(() => {
      setIsSearchOpen(true);
    }, []);

    const closeSearch = useCallback(() => {
      setIsSearchOpen(false);
      setSearchQuery('');
      onSearchMatchesChange?.(new Set());
    }, [onSearchMatchesChange]);

    const handleSearchHighlight = useCallback(
      (matches: Set<string>) => {
        onSearchMatchesChange?.(matches);
      },
      [onSearchMatchesChange]
    );

    const handleNavigateToNode = useCallback(
      (nodeId: string) => {
        onNodeActivate(nodeId);
        // 确保节点可见（展开父节点）
        const path = findNodePath(outline.nodes, nodeId);
        if (path && path.length > 1) {
          setLocalCollapsedIds((prev) => {
            const newSet = new Set(prev);
            for (let i = 0; i < path.length - 1; i++) {
              const parentNode = getNodeAtPath(outline.nodes, path.slice(0, i + 1));
              if (parentNode) {
                newSet.delete(parentNode.id);
              }
            }
            return newSet;
          });
        }
      },
      [outline.nodes, onNodeActivate]
    );

    // 格式化操作：路由到当前活跃节点的富文本编辑器
    const toggleBold = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      runEditorOnNode(id, (e) => e.toggleBold());
    }, [runEditorOnNode]);

    const toggleItalic = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      runEditorOnNode(id, (e) => e.toggleItalic());
    }, [runEditorOnNode]);

    const toggleUnderline = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      runEditorOnNode(id, (e) => e.toggleUnderline());
    }, [runEditorOnNode]);

    const toggleStrike = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      runEditorOnNode(id, (e) => e.toggleStrike());
    }, [runEditorOnNode]);

    const setHighlight = useCallback(
      (color: string | null) => {
        const id = activeNodeIdRef.current;
        if (!id) return;
        nodeOpsRef.current.setColorHighlight(id, color);
      },
      []
    );

    const setHeadingLevel = useCallback(
      (level: OutlineHeadingLevel) => {
        const id = activeNodeIdRef.current;
        if (!id) return;
        nodeOpsRef.current.setHeadingLevel(id, level);
      },
      []
    );

    const clearFormat = useCallback(() => {
      const id = activeNodeIdRef.current;
      if (!id) return;
      runEditorOnNode(id, (e) => e.clearFormat());
    }, [runEditorOnNode]);

    const completeSelected = useCallback(
      (completed: boolean) => {
        const ids = Array.from(selectedNodeIds);
        if (ids.length === 0) return;
        for (const id of ids) {
          const node = findNode(rootNodesRef.current, id);
          if (!node || node.completed === completed) continue;
          nodeOpsRef.current.toggleComplete(id);
        }
      },
      [selectedNodeIds]
    );

    // 暴露方法
    useImperativeHandle(ref, () => {
      const api: OutlineEditorRef = {
        undo,
        redo,
        addSibling,
        addChild,
        deleteNode,
        moveUp,
        moveDown,
        indent,
        outdent,
        cloneNode,
        expandAll,
        collapseAll,
        toggleExpand,
        getActiveNode,
        getActiveNodePath,
        getActiveBranchMarkdown,
        insertChildren,
        updateActiveNodeContent,
        openSearch,
        closeSearch,
        toggleBold,
        toggleItalic,
        toggleUnderline,
        toggleStrike,
        setHighlight,
        setHeadingLevel,
        clearFormat,
        completeSelected,
      };
      return api;
    });

    // 在扁平列表中导航焦点（不改变节点顺序）
    const navigateUp = useCallback(() => {
      if (!activeNodeId || filteredNodes.length === 0) return false;
      const idx = filteredNodes.findIndex((f) => f.node.id === activeNodeId);
      if (idx <= 0) return false;
      onNodeActivate(filteredNodes[idx - 1].node.id);
      return true;
    }, [activeNodeId, filteredNodes, onNodeActivate]);

    const navigateDown = useCallback(() => {
      if (!activeNodeId || filteredNodes.length === 0) return false;
      const idx = filteredNodes.findIndex((f) => f.node.id === activeNodeId);
      if (idx < 0 || idx >= filteredNodes.length - 1) return false;
      onNodeActivate(filteredNodes[idx + 1].node.id);
      return true;
    }, [activeNodeId, filteredNodes, onNodeActivate]);

    // 键盘快捷键
    useOutlineKeyboard({
      onNavigateUp: () => navigateUp(),
      onNavigateDown: () => navigateDown(),
      onMoveNodeUp: () => {
        moveUp();
        return true;
      },
      onMoveNodeDown: () => {
        moveDown();
        return true;
      },
      onAddSibling: () => tryAddSibling(),
      onIndent: () => {
        indent();
        return true;
      },
      onOutdent: () => {
        outdent();
        return true;
      },
      onDeleteNode: () => {
        deleteNode();
        return true;
      },
      onDeleteSelected: () => {
        if (selectedNodeIds.size > 1) {
          return onDeleteSelectedNodes?.() ?? false;
        }
        deleteNode();
        return true;
      },
      onDeleteIfEmpty: () => {
        const node = getActiveNode();
        if (node && node.plainText.trim() === '') {
          deleteNode();
          return true;
        }
        return false;
      },
      onCloneNode: () => {
        cloneNode();
        return true;
      },
      onToggleBold: () => {
        toggleBold();
        return true;
      },
      onToggleItalic: () => {
        toggleItalic();
        return true;
      },
      onToggleUnderline: () => {
        toggleUnderline();
        return true;
      },
      onToggleStrike: () => {
        toggleStrike();
        return true;
      },
      onSetHeading: (level) => {
        setHeadingLevel(level);
        return true;
      },
      onClearFormat: () => {
        clearFormat();
        return true;
      },
      onToggleExpand: () => {
        toggleExpand();
        return true;
      },
      onExpandAll: () => {
        expandAll();
        return true;
      },
      onCollapseAll: () => {
        collapseAll();
        return true;
      },
      onCollapseToLevel: (level) => {
        if (level <= 0) {
          collapseAll();
          return true;
        }
        const next = new Set<string>();
        const walk = (nodes: OutlineNode[], depth: number) => {
          for (const n of nodes) {
            if ((n.children?.length ?? 0) > 0) {
              if (depth >= level) next.add(n.id);
              walk(n.children, depth + 1);
            }
          }
        };
        walk(rootNodesRef.current, 1);
        setLocalCollapsedIds(next);
        return true;
      },
      onMoveToTop: () => {
        const id = activeNodeIdRef.current;
        if (!id) return false;
        return nodeOpsRef.current.moveToTop(id);
      },
      onMoveToBottom: () => {
        const id = activeNodeIdRef.current;
        if (!id) return false;
        return nodeOpsRef.current.moveToBottom(id);
      },
      onSelectAll: () => {
        const ids = filteredNodes.map((item) => item.node.id);
        if (ids.length === 0) return false;
        onSelectAllVisibleNodes?.(ids);
        return true;
      },
      onUndo: () => {
        undo();
        return true;
      },
      onRedo: () => {
        redo();
        return true;
      },
      onOpenSearch: () => {
        openSearch();
        return true;
      },
      onCloseSearch: () => {
        if (isSearchOpen) {
          closeSearch();
          return true;
        }
        return false;
      },
      onEscape: () => {
        if (isSearchOpen) {
          closeSearch();
          return true;
        }
        return false;
      },
    });

    // 拖拽传感器
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 3,
        },
      }),
      useSensor(KeyboardSensor)
    );

    // 拖拽开始
    const handleDragStart = useCallback((event: DragStartEvent) => {
      setDragActiveId(event.active.id as string);
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
      setDragOverId(event.over ? String(event.over.id) : null);
    }, []);

    const handleDragCancel = useCallback((_event: DragCancelEvent) => {
      setDragActiveId(null);
      setDragOverId(null);
    }, []);

    // 拖拽结束
    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;
        setDragActiveId(null);
        setDragOverId(null);

        if (!over) return;
        const activeId = String(active.id);
        const overId = String(over.id);
        if (!activeId || !overId || activeId === overId) return;

        // 用 node.id 在当前 outline 上动态求路径，避免 path 作为拖拽 id 带来的错位和复用问题
        updateOutline((outline) => {
          const activePath = findNodePath(outline.nodes, activeId);
          const overPath = findNodePath(outline.nodes, overId);
          if (!activePath || !overPath) return outline;
          const movedNode = findNode(outline.nodes, activeId);
          if (!movedNode) return outline;

          // 先移除 active，再按“原始 over 索引”插入，等价于同父级 arrayMove 语义
          const nodesWithoutActive = removeNodeFromTree(outline.nodes, activeId);
          const activeParentPath = activePath.slice(0, -1);
          const overParentPath = overPath.slice(0, -1);
          const overIndex = overPath[overPath.length - 1];

          const sameParent =
            activeParentPath.length === overParentPath.length &&
            activeParentPath.every((v, i) => v === overParentPath[i]);

          const isFilteredView =
            filterState.selectedTags.size > 0 ||
            filterState.selectedMentions.size > 0 ||
            filterState.searchQuery !== '';
          if (isFilteredView && !sameParent) {
            return outline;
          }

          const insertIndex = overIndex;
          const newNodes = insertNodeAtPath(
            nodesWithoutActive,
            overParentPath,
            insertIndex,
            movedNode
          );

          return { ...outline, nodes: newNodes, updatedAt: new Date().toISOString() };
        });
      },
      [updateOutline, filterState]
    );

    // 处理节点内容变更
    const handleContentChange = useCallback(
      (nodeId: string, content: RichTextContent) => {
        nodeOps.updateContent(nodeId, content);
      },
      [nodeOps]
    );

    // 处理备注变更
    const handleNoteChange = useCallback(
      (nodeId: string, note: RichTextContent) => {
        nodeOps.updateNote(nodeId, note);
      },
      [nodeOps]
    );

    // 处理展开/折叠
    const handleToggleExpand = useCallback((nodeId: string) => {
      setLocalCollapsedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) {
          newSet.delete(nodeId);
        } else {
          newSet.add(nodeId);
        }
        return newSet;
      });
    }, []);

    const emptyOutlinePlaceholder = useMemo(
      () => (
        <div
          role="region"
          aria-label={t('outline.emptyRegion', { defaultValue: '空大纲' })}
          className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center outline-none"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              tryAddSibling();
            }
          }}
        >
          <p className="text-sm text-muted-foreground max-w-sm">
            {t('outline.emptyHint', {
              defaultValue: '还没有节点。点击按钮，或按 Enter 创建第一个节点。',
            })}
          </p>
          <Button type="button" size="sm" variant="default" onClick={() => tryAddSibling()} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('outline.addFirstNode', { defaultValue: '添加第一个节点' })}
          </Button>
        </div>
      ),
      [tryAddSibling, t]
    );

    const filterEmptyPlaceholder = useMemo(
      () => (
        <div className="text-center text-sm text-muted-foreground py-12 px-4">
          {t('outline.filterNoMatch', {
            defaultValue: '没有符合筛选条件的节点，请调整筛选或清除条件。',
          })}
        </div>
      ),
      [t]
    );

    return (
      <div className={cn('h-full flex flex-col', className)}>
        {/* 搜索面板 */}
        <SearchPanel
          isOpen={isSearchOpen}
          onClose={closeSearch}
          nodes={rootNodes}
          onHighlightMatches={handleSearchHighlight}
          onNavigateToNode={handleNavigateToNode}
        />

        {/* 编辑区域 */}
        {shouldVirtualize ? (
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={outlineVerticalListCollision}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragCancel={handleDragCancel}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={filteredSortableIds} strategy={verticalListSortingStrategy}>
                <div
                  className={cn(
                    'py-4 px-2 outline-editor',
                    settings.lineSpacing,
                    settings.fontSize === 14
                      ? 'font-14'
                      : settings.fontSize === 18
                        ? 'font-18'
                        : 'font-16'
                  )}
                  data-spacing={settings.lineSpacing}
                >
                  {filteredNodes.length === 0 ? (
                    flatNodes.length === 0 ? (
                      emptyOutlinePlaceholder
                    ) : (
                      filterEmptyPlaceholder
                    )
                  ) : (
                    <div
                      style={{
                        height: virtualizer.getTotalSize(),
                        position: 'relative',
                      }}
                    >
                      {virtualizer.getVirtualItems().map((item) => {
                        const entry = filteredNodes[item.index];
                        if (!entry) return null;
                        const { node, depth, isLast } = entry;
                        const rowKey = node.id;
                        return (
                          <div
                            key={rowKey}
                            ref={virtualizer.measureElement}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${item.start}px)`,
                            }}
                          >
                            <OutlineRow
                              sortableId={node.id}
                              node={node}
                              depth={depth}
                              isLast={isLast}
                              isSelected={selectedNodeIds.has(node.id)}
                              isActive={activeNodeId === node.id}
                              isCollapsed={localCollapsedIds.has(node.id)}
                              isSearchMatch={searchMatches.has(node.id)}
                              isDragOverTarget={dragOverId === node.id}
                              showGuideLines={settings.showGuideLines}
                              showNotes={settings.showNotes}
                              lineSpacing={settings.lineSpacing}
                              enableDragAndDrop
                              searchQuery={searchQuery}
                              onRegisterEditor={registerNodeEditor}
                              onContentChange={(content) => handleContentChange(node.id, content)}
                              onNoteChange={(note) => handleNoteChange(node.id, note)}
                              onToggleExpand={() => handleToggleExpand(node.id)}
                              onSelect={(mode) =>
                                onNodeSelect(
                                  node.id,
                                  mode,
                                  filteredNodes.map((item) => item.node.id)
                                )
                              }
                              onActivate={() => onNodeActivate(node.id)}
                              onFocus={() => onFocusNode(node.id)}
                              onIndent={() => nodeOps.indent(node.id)}
                              onOutdent={() => nodeOps.outdent(node.id)}
                              onAddSibling={() => {
                                const newId = nodeOps.addSibling(node.id);
                                if (newId) setTimeout(() => onNodeActivate(newId), 0);
                              }}
                              onDeleteIfEmpty={() => {
                                if (node.plainText.trim() === '') {
                                  nodeOps.deleteNode(node.id);
                                  return true;
                                }
                                return false;
                              }}
                              nodeMenuHandlers={createNodeMenuHandlers(node.id)}
                              showExportInMenu={!!onOpenExport}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <DndContext
              sensors={sensors}
              collisionDetection={outlineVerticalListCollision}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragCancel={handleDragCancel}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={filteredSortableIds} strategy={verticalListSortingStrategy}>
                <div
                  className={cn(
                    'py-4 px-2 outline-editor',
                    settings.lineSpacing,
                    settings.fontSize === 14
                      ? 'font-14'
                      : settings.fontSize === 18
                        ? 'font-18'
                        : 'font-16'
                  )}
                  data-spacing={settings.lineSpacing}
                >
                  {filteredNodes.length === 0 ? (
                    flatNodes.length === 0 ? (
                      emptyOutlinePlaceholder
                    ) : (
                      filterEmptyPlaceholder
                    )
                  ) : (
                    filteredNodes.map(({ node, depth, isLast }) => (
                      <OutlineRow
                        key={node.id}
                        sortableId={node.id}
                        node={node}
                        depth={depth}
                        isLast={isLast}
                        isSelected={selectedNodeIds.has(node.id)}
                        isActive={activeNodeId === node.id}
                        isCollapsed={localCollapsedIds.has(node.id)}
                        isSearchMatch={searchMatches.has(node.id)}
                        isDragOverTarget={dragOverId === node.id}
                        showGuideLines={settings.showGuideLines}
                        showNotes={settings.showNotes}
                        lineSpacing={settings.lineSpacing}
                        enableDragAndDrop
                        searchQuery={searchQuery}
                        onRegisterEditor={registerNodeEditor}
                        onContentChange={(content) => handleContentChange(node.id, content)}
                        onNoteChange={(note) => handleNoteChange(node.id, note)}
                        onToggleExpand={() => handleToggleExpand(node.id)}
                        onSelect={(mode) =>
                          onNodeSelect(
                            node.id,
                            mode,
                            filteredNodes.map((item) => item.node.id)
                          )
                        }
                        onActivate={() => onNodeActivate(node.id)}
                        onFocus={() => onFocusNode(node.id)}
                        onIndent={() => nodeOps.indent(node.id)}
                        onOutdent={() => nodeOps.outdent(node.id)}
                        onAddSibling={() => {
                          const newId = nodeOps.addSibling(node.id);
                          if (newId) setTimeout(() => onNodeActivate(newId), 0);
                        }}
                        onDeleteIfEmpty={() => {
                          if (node.plainText.trim() === '') {
                            nodeOps.deleteNode(node.id);
                            return true;
                          }
                          return false;
                        }}
                        nodeMenuHandlers={createNodeMenuHandlers(node.id)}
                        showExportInMenu={!!onOpenExport}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </ScrollArea>
        )}
      </div>
    );
});

export default OutlineEditor;

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  if (sa.size !== new Set(b).size) return false;
  for (const x of b) {
    if (!sa.has(x)) return false;
  }
  return true;
}

function sameSetAndArray(set: Set<string>, arr: string[]): boolean {
  if (set.size !== new Set(arr).size) return false;
  for (const x of arr) {
    if (!set.has(x)) return false;
  }
  return true;
}
