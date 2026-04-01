/**
 * 节点操作 Hook
 *
 * 提供大纲节点的增删改查、移动、缩进等操作
 */

import { useCallback, useMemo } from 'react';
import type { Outline, OutlineHeadingLevel, OutlineNode, RichTextContent } from '../types';
import {
  findNode,
  findNodePath,
  getNodeAtPath,
  updateNodeInTree,
  removeNodeFromTree,
  insertNodeAtPath,
  swapSiblingNodesAtPath,
  cloneNodeTree,
  createEmptyNode,
  getPlainTextFromContent,
  extractTagsFromContent,
} from '../types';

export interface NodeOperations {
  // 节点 CRUD
  /** 根列表为空时插入第一个根节点（用于空大纲开始编辑） */
  addRootNode: () => string | null;
  addSibling: (nodeId: string) => string | null;
  addChild: (nodeId: string) => string | null;
  deleteNode: (nodeId: string) => void;
  cloneNode: (nodeId: string) => string | null;

  // 内容更新
  updateContent: (nodeId: string, content: RichTextContent) => void;
  updateNote: (nodeId: string, note: RichTextContent | null) => void;
  toggleComplete: (nodeId: string) => void;
  toggleExpand: (nodeId: string) => void;
  setHeadingLevel: (nodeId: string, level: OutlineHeadingLevel) => void;
  setColorHighlight: (nodeId: string, color: string | null) => void;

  // 层级操作
  indent: (nodeId: string) => boolean;
  outdent: (nodeId: string) => boolean;

  // 移动操作
  moveUp: (nodeId: string) => boolean;
  moveDown: (nodeId: string) => boolean;
  moveToTop: (nodeId: string) => boolean;
  moveToBottom: (nodeId: string) => boolean;

  // 批量操作
  deleteNodes: (nodeIds: string[]) => void;
  completeNodes: (nodeIds: string[], completed: boolean) => void;
  moveNodesToParent: (nodeIds: string[], parentId: string) => void;

  // 工具函数
  getNode: (nodeId: string) => OutlineNode | null;
  getNodePath: (nodeId: string) => number[] | null;
  getParent: (nodeId: string) => OutlineNode | null;
  getSiblings: (nodeId: string) => OutlineNode[];
  getDepth: (nodeId: string) => number;
  insertChildren: (parentId: string, nodes: OutlineNode[]) => void;
  insertAtPosition: (parentId: string, index: number, node: OutlineNode) => void;
}

export function useNodeOperations(
  outline: Outline,
  onUpdate: (updater: (outline: Outline) => Outline) => void
): NodeOperations {
  // ========== 节点 CRUD ==========

  const addRootNode = useCallback((): string | null => {
    let newNodeId: string | null = null;
    onUpdate((outline) => {
      if (outline.nodes.length > 0) return outline;
      const newNode = createEmptyNode();
      newNodeId = newNode.id;
      return {
        ...outline,
        nodes: [newNode],
        updatedAt: new Date().toISOString(),
      };
    });
    return newNodeId;
  }, [onUpdate]);

  const addSibling = useCallback((nodeId: string): string | null => {
    const newNode = createEmptyNode();
    let inserted = false;

    onUpdate((outline) => {
      const path = findNodePath(outline.nodes, nodeId);
      if (!path) return outline;

      inserted = true;
      const parentPath = path.slice(0, -1);
      const index = path[path.length - 1];

      return {
        ...outline,
        nodes: insertNodeAtPath(outline.nodes, parentPath, index + 1, newNode),
        updatedAt: new Date().toISOString(),
      };
    });

    return inserted ? newNode.id : null;
  }, [onUpdate]);

  const addChild = useCallback((nodeId: string): string | null => {
    const newNode = createEmptyNode();
    let inserted = false;

    onUpdate((outline) => {
      const found = findNode(outline.nodes, nodeId);
      if (!found) return outline;
      inserted = true;
      return {
        ...outline,
        nodes: updateNodeInTree(outline.nodes, nodeId, (node) => ({
          ...node,
          children: [...node.children, newNode],
          expanded: true,
        })),
        updatedAt: new Date().toISOString(),
      };
    });

    return inserted ? newNode.id : null;
  }, [onUpdate]);

  const deleteNode = useCallback((nodeId: string) => {
    onUpdate((outline) => ({
      ...outline,
      nodes: removeNodeFromTree(outline.nodes, nodeId),
      updatedAt: new Date().toISOString(),
    }));
  }, [onUpdate]);

  const cloneNode = useCallback((nodeId: string): string | null => {
    let cloneId: string | null = null;

    onUpdate((outline) => {
      const node = findNode(outline.nodes, nodeId);
      if (!node) {
        cloneId = null;
        return outline;
      }

      const path = findNodePath(outline.nodes, nodeId);
      if (!path) {
        cloneId = null;
        return outline;
      }

      const clone = cloneNodeTree(node);
      cloneId = clone.id;

      return {
        ...outline,
        nodes: insertNodeAtPath(outline.nodes, path.slice(0, -1), path[path.length - 1] + 1, clone),
        updatedAt: new Date().toISOString(),
      };
    });

    return cloneId;
  }, [onUpdate]);

  // ========== 内容更新 ==========

  const updateContent = useCallback((nodeId: string, content: RichTextContent) => {
    const plainText = getPlainTextFromContent(content);
    const { tags, mentions } = extractTagsFromContent(content);

    onUpdate((outline) => ({
      ...outline,
      nodes: updateNodeInTree(outline.nodes, nodeId, (node) => ({
        ...node,
        content,
        plainText,
        tags,
        mentions,
        updatedAt: new Date().toISOString(),
      })),
      updatedAt: new Date().toISOString(),
    }));
  }, [onUpdate]);

  const updateNote = useCallback((nodeId: string, note: RichTextContent | null) => {
    onUpdate((outline) => ({
      ...outline,
      nodes: updateNodeInTree(outline.nodes, nodeId, (node) => ({
        ...node,
        note: note || undefined,
        notePlainText: note ? getPlainTextFromContent(note) : undefined,
        updatedAt: new Date().toISOString(),
      })),
      updatedAt: new Date().toISOString(),
    }));
  }, [onUpdate]);

  const toggleComplete = useCallback((nodeId: string) => {
    onUpdate((outline) => ({
      ...outline,
      nodes: updateNodeInTree(outline.nodes, nodeId, (node) => ({
        ...node,
        completed: !node.completed,
        updatedAt: new Date().toISOString(),
      })),
      updatedAt: new Date().toISOString(),
    }));
  }, [onUpdate]);

  const toggleExpand = useCallback((nodeId: string) => {
    onUpdate((outline) => {
      const node = findNode(outline.nodes, nodeId);
      if (!node || node.children.length === 0) return outline;

      return {
        ...outline,
        nodes: updateNodeInTree(outline.nodes, nodeId, (node) => ({
          ...node,
          expanded: !node.expanded,
        })),
        collapsedNodeIds: (() => {
          const newSet = new Set(outline.collapsedNodeIds);
          if (node.expanded) {
            newSet.add(nodeId);
          } else {
            newSet.delete(nodeId);
          }
          return Array.from(newSet);
        })(),
        updatedAt: new Date().toISOString(),
      };
    });
  }, [onUpdate]);

  const setHeadingLevel = useCallback((nodeId: string, level: OutlineHeadingLevel) => {
    onUpdate((outline) => ({
      ...outline,
      nodes: updateNodeInTree(outline.nodes, nodeId, (node) => ({
        ...node,
        headingLevel: level,
        updatedAt: new Date().toISOString(),
      })),
      updatedAt: new Date().toISOString(),
    }));
  }, [onUpdate]);

  const setColorHighlight = useCallback((nodeId: string, color: string | null) => {
    onUpdate((outline) => ({
      ...outline,
      nodes: updateNodeInTree(outline.nodes, nodeId, (node) => ({
        ...node,
        colorHighlight: color || undefined,
        updatedAt: new Date().toISOString(),
      })),
      updatedAt: new Date().toISOString(),
    }));
  }, [onUpdate]);

  // ========== 层级操作 ==========

  const indent = useCallback((nodeId: string): boolean => {
    let success = false;
    onUpdate((outline) => {
      const path = findNodePath(outline.nodes, nodeId);
      if (!path || path.length === 0 || path[path.length - 1] === 0) {
        return outline;
      }
      const parentPath = path.slice(0, -1);
      const index = path[path.length - 1];
      const prevSiblingPath = [...parentPath, index - 1];
      const prevSibling = getNodeAtPath(outline.nodes, prevSiblingPath);
      const moved = findNode(outline.nodes, nodeId);
      if (!prevSibling || !moved) return outline;

      const safeMoved: OutlineNode = {
        ...moved,
        tags: moved.tags ?? [],
        mentions: moved.mentions ?? [],
        children: moved.children ?? [],
      };
      const nodesWithoutMoved = removeNodeFromTree(outline.nodes, nodeId);
      const nextNodes = updateNodeInTree(nodesWithoutMoved, prevSibling.id, (node) => ({
        ...node,
        children: [...(node.children ?? []), safeMoved],
        expanded: true,
      }));

      success = true;
      return {
        ...outline,
        nodes: nextNodes,
        updatedAt: new Date().toISOString(),
      };
    });

    return success;
  }, [onUpdate]);

  const outdent = useCallback((nodeId: string): boolean => {
    let success = false;
    onUpdate((outline) => {
      const path = findNodePath(outline.nodes, nodeId);
      if (!path || path.length <= 1) return outline;
      const parentPath = path.slice(0, -1);
      const grandparentPath = parentPath.slice(0, -1);
      const moved = findNode(outline.nodes, nodeId);
      if (!moved) return outline;
      const parentIndex = parentPath[parentPath.length - 1];
      if (typeof parentIndex !== 'number' || parentIndex < 0) return outline;
      const insertIndex = parentIndex + 1;
      const nodesWithoutMoved = removeNodeFromTree(outline.nodes, nodeId);
      const nextNodes = insertNodeAtPath(nodesWithoutMoved, grandparentPath, insertIndex, moved);
      if (nextNodes === outline.nodes) return outline;
      success = true;

      return {
        ...outline,
        nodes: nextNodes,
        updatedAt: new Date().toISOString(),
      };
    });

    return success;
  }, [onUpdate]);

  // ========== 移动操作 ==========

  const moveUp = useCallback((nodeId: string): boolean => {
    let success = false;
    onUpdate((outline) => {
      const path = findNodePath(outline.nodes, nodeId);
      if (!path || path[path.length - 1] === 0) return outline;

      const parentPath = path.slice(0, -1);
      const index = path[path.length - 1];
      const newNodes = swapSiblingNodesAtPath(
        outline.nodes,
        parentPath,
        index,
        'up'
      );
      if (newNodes === outline.nodes) return outline;

      success = true;
      return {
        ...outline,
        nodes: newNodes,
        updatedAt: new Date().toISOString(),
      };
    });

    return success;
  }, [onUpdate]);

  const moveDown = useCallback((nodeId: string): boolean => {
    let success = false;
    onUpdate((outline) => {
      const path = findNodePath(outline.nodes, nodeId);
      if (!path) return outline;

      const parentPath = path.slice(0, -1);
      const index = path[path.length - 1];

      const newNodes = swapSiblingNodesAtPath(
        outline.nodes,
        parentPath,
        index,
        'down'
      );
      if (newNodes === outline.nodes) return outline;

      success = true;
      return {
        ...outline,
        nodes: newNodes,
        updatedAt: new Date().toISOString(),
      };
    });

    return success;
  }, [onUpdate]);

  const moveToTop = useCallback((nodeId: string): boolean => {
    let success = false;
    onUpdate((outline) => {
      const path = findNodePath(outline.nodes, nodeId);
      if (!path || path[path.length - 1] === 0) return outline;
      const parentPath = path.slice(0, -1);
      const moved = findNode(outline.nodes, nodeId);
      if (!moved) return outline;
      const nodesWithoutMoved = removeNodeFromTree(outline.nodes, nodeId);
      const nextNodes = insertNodeAtPath(nodesWithoutMoved, parentPath, 0, moved);
      if (nextNodes === outline.nodes) return outline;

      success = true;
      return {
        ...outline,
        nodes: nextNodes,
        updatedAt: new Date().toISOString(),
      };
    });

    return success;
  }, [onUpdate]);

  const moveToBottom = useCallback((nodeId: string): boolean => {
    let success = false;
    onUpdate((outline) => {
      const path = findNodePath(outline.nodes, nodeId);
      if (!path) return outline;

      const parentPath = path.slice(0, -1);
      const moved = findNode(outline.nodes, nodeId);
      if (!moved) return outline;
      const parent = parentPath.length === 0
        ? { children: outline.nodes }
        : getNodeAtPath(outline.nodes, parentPath);
      if (!parent) return outline;
      const index = path[path.length - 1];
      if (index >= parent.children.length - 1) return outline;

      const nodesWithoutMoved = removeNodeFromTree(outline.nodes, nodeId);
      const parentAfter = parentPath.length === 0
        ? { children: nodesWithoutMoved }
        : getNodeAtPath(nodesWithoutMoved, parentPath);
      if (!parentAfter) return outline;
      const insertIndex = parentAfter.children.length;
      const nextNodes = insertNodeAtPath(nodesWithoutMoved, parentPath, insertIndex, moved);
      if (nextNodes === outline.nodes) return outline;

      success = true;
      return {
        ...outline,
        nodes: nextNodes,
        updatedAt: new Date().toISOString(),
      };
    });

    return success;
  }, [onUpdate]);

  // ========== 批量操作 ==========

  const deleteNodes = useCallback((nodeIds: string[]) => {
    onUpdate((outline) => {
      let nodes = outline.nodes;
      for (const nodeId of nodeIds) {
        nodes = removeNodeFromTree(nodes, nodeId);
      }
      return {
        ...outline,
        nodes,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [onUpdate]);

  const completeNodes = useCallback((nodeIds: string[], completed: boolean) => {
    onUpdate((outline) => {
      let nodes = outline.nodes;
      for (const nodeId of nodeIds) {
        nodes = updateNodeInTree(nodes, nodeId, (node) => ({
          ...node,
          completed,
          updatedAt: new Date().toISOString(),
        }));
      }
      return {
        ...outline,
        nodes,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [onUpdate]);

  const moveNodesToParent = useCallback((nodeIds: string[], parentId: string) => {
    onUpdate((outline) => {
      const nodesToMove: OutlineNode[] = [];
      let nodes = outline.nodes;

      // 收集要移动的节点
      for (const nodeId of nodeIds) {
        const node = findNode(nodes, nodeId);
        if (node) {
          nodesToMove.push(node);
          nodes = removeNodeFromTree(nodes, nodeId);
        }
      }

      // 添加到目标父节点
      nodes = updateNodeInTree(nodes, parentId, (node) => ({
        ...node,
        children: [...node.children, ...nodesToMove],
        expanded: true,
      }));

      return {
        ...outline,
        nodes,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [onUpdate]);

  // ========== 工具函数 ==========

  const getNode = useCallback((nodeId: string): OutlineNode | null => {
    return findNode(outline.nodes, nodeId);
  }, [outline.nodes]);

  const getNodePath = useCallback((nodeId: string): number[] | null => {
    return findNodePath(outline.nodes, nodeId);
  }, [outline.nodes]);

  const getParent = useCallback((nodeId: string): OutlineNode | null => {
    const path = findNodePath(outline.nodes, nodeId);
    if (!path || path.length <= 1) return null;
    return getNodeAtPath(outline.nodes, path.slice(0, -1));
  }, [outline.nodes]);

  const getSiblings = useCallback((nodeId: string): OutlineNode[] => {
    const path = findNodePath(outline.nodes, nodeId);
    if (!path) return [];

    if (path.length === 1) {
      return outline.nodes;
    }

    const parent = getNodeAtPath(outline.nodes, path.slice(0, -1));
    return parent ? parent.children : [];
  }, [outline.nodes]);

  const getDepth = useCallback((nodeId: string): number => {
    const path = findNodePath(outline.nodes, nodeId);
    return path ? path.length - 1 : 0;
  }, [outline.nodes]);

  const insertChildren = useCallback((parentId: string, nodes: OutlineNode[]) => {
    onUpdate((outline) => ({
      ...outline,
      nodes: updateNodeInTree(outline.nodes, parentId, (node) => ({
        ...node,
        children: [...node.children, ...nodes],
        expanded: true,
      })),
      updatedAt: new Date().toISOString(),
    }));
  }, [onUpdate]);

  const insertAtPosition = useCallback((parentId: string, index: number, node: OutlineNode) => {
    onUpdate((outline) => {
      if (parentId === 'root') {
        const newNodes = [...outline.nodes];
        newNodes.splice(index, 0, node);
        return {
          ...outline,
          nodes: newNodes,
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        ...outline,
        nodes: updateNodeInTree(outline.nodes, parentId, (p) => {
          const newChildren = [...p.children];
          newChildren.splice(index, 0, node);
          return {
            ...p,
            children: newChildren,
          };
        }),
        updatedAt: new Date().toISOString(),
      };
    });
  }, [onUpdate]);

  return useMemo(() => ({
    addRootNode,
    addSibling,
    addChild,
    deleteNode,
    cloneNode,
    updateContent,
    updateNote,
    toggleComplete,
    toggleExpand,
    setHeadingLevel,
    setColorHighlight,
    indent,
    outdent,
    moveUp,
    moveDown,
    moveToTop,
    moveToBottom,
    deleteNodes,
    completeNodes,
    moveNodesToParent,
    getNode,
    getNodePath,
    getParent,
    getSiblings,
    getDepth,
    insertChildren,
    insertAtPosition,
  }), [
    addRootNode,
    addSibling,
    addChild,
    deleteNode,
    cloneNode,
    updateContent,
    updateNote,
    toggleComplete,
    toggleExpand,
    setHeadingLevel,
    setColorHighlight,
    indent,
    outdent,
    moveUp,
    moveDown,
    moveToTop,
    moveToBottom,
    deleteNodes,
    completeNodes,
    moveNodesToParent,
    getNode,
    getNodePath,
    getParent,
    getSiblings,
    getDepth,
    insertChildren,
    insertAtPosition,
  ]);
}

export default useNodeOperations;
