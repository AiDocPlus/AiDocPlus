/**
 * 思维导图视图组件
 *
 * 复用 SimpleMindMapRenderer 实现大纲/导图双视图
 */

import {
  useMemo,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  type ForwardedRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { extractAllNodes, type Outline, type OutlineNode } from '../types';
import type { SMNode } from '@/plugins/mindmap/mindmapConverter';
import { SimpleMindMapRenderer } from '@/plugins/mindmap/SimpleMindMapRenderer';
import type { SimpleMindMapRendererRef, MindMapLayout } from '@/plugins/mindmap/SimpleMindMapRenderer';

interface MindMapViewProps {
  outline: Outline;
  onNodeActivate?: (nodeId: string) => void;
  onOutlineChange?: (updater: (outline: Outline) => Outline) => void;
  layout?: MindMapLayout;
  theme?: string;
  showMiniMap?: boolean;
  rainbowLines?: boolean;
}

export interface MindMapViewRef {
  fitContent: () => void;
  undo: () => void;
  redo: () => void;
  setLayout: (layout: MindMapLayout) => void;
  setTheme: (theme: string) => void;
  expandAll: () => void;
  collapseToLevel: (level: number) => void;
  exportSvg: () => Promise<string | null>;
  exportPng: () => Promise<string | null>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetScale: () => void;
  getScale: () => number;
  moveToCenter: () => void;
}

/**
 * 将大纲节点转换为思维导图数据
 */
function outlineNodeToMindMapData(node: OutlineNode): SMNode {
  return {
    data: {
      text: node.plainText,
      id: node.id,
      isActive: false,
      isSelected: false,
      completed: node.completed,
      color: node.colorHighlight,
      note: node.notePlainText,
      tags: (node.tags?.length ?? 0) > 0 ? node.tags : undefined,
    },
    children: (node.children ?? []).map(outlineNodeToMindMapData),
  };
}

/**
 * 将思维导图数据转换回大纲节点
 */
function mindMapDataToOutlineNode(
  smNode: SMNode,
  originalNodes: OutlineNode[]
): OutlineNode {
  // 查找原始节点以保持数据完整性
  const originalNode = originalNodes.find((n) => n.id === smNode.data?.id);

  const node: OutlineNode = originalNode
    ? {
        ...originalNode,
        plainText: smNode.data?.text || originalNode.plainText,
        content: smNode.data?.text
          ? {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: smNode.data.text }],
                },
              ],
            }
          : originalNode.content,
        completed: (smNode.data?.completed as boolean) ?? originalNode.completed,
        colorHighlight: (smNode.data?.color as string | undefined) ?? originalNode.colorHighlight,
        notePlainText: (smNode.data?.note as string | undefined) ?? originalNode.notePlainText,
        updatedAt: new Date().toISOString(),
        children: [],
      }
    : {
        id:
          (smNode.data?.id as string) ||
          `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: {
          type: 'doc',
          content: smNode.data?.text
            ? [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: smNode.data.text }],
                },
              ]
            : [],
        },
        plainText: smNode.data?.text || '',
        tags: (smNode.data?.tags as string[]) || [],
        mentions: [],
        completed: (smNode.data?.completed as boolean) || false,
        expanded: true,
        headingLevel: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        children: [],
      };

  // 递归处理子节点
  if (smNode.children && smNode.children.length > 0) {
    node.children = smNode.children.map((child: any) =>
      mindMapDataToOutlineNode(child, originalNodes)
    );
  }

  return node;
}

export const MindMapView = forwardRef(function MindMapView(
  {
    outline,
    onNodeActivate,
    onOutlineChange,
    layout = 'logicalStructure',
    theme = 'default',
    showMiniMap = false,
    rainbowLines = false,
  }: MindMapViewProps,
  ref: ForwardedRef<MindMapViewRef>
) {
    const { t } = useTranslation();
    const rendererRef = useRef<SimpleMindMapRendererRef>(null);

    // 节点点击回调：桥接到 onNodeActivate
    const handleNodeClick = useCallback(
      (data: { id: string; text: string }) => {
        onNodeActivate?.(data.id);
      },
      [onNodeActivate],
    );

    // 转换大纲数据为思维导图数据
    const mindmapData = useMemo(() => {
      const root: SMNode = {
        data: {
          text: outline.title || t('outline.untitled', { defaultValue: '未命名大纲' }),
          id: outline.id,
          isActive: true,
        },
        children: outline.nodes.map(outlineNodeToMindMapData),
      };
      return root;
    }, [outline, t]);

    // 处理数据变化
    const handleDataChange = useCallback(
      (newData: SMNode) => {
        if (!onOutlineChange) return;

        // 提取所有原始节点用于数据保持
        const allOriginalNodes = extractAllNodes(outline.nodes);

        // 转换回大纲结构
        const newNodes =
          newData.children?.map((child: any) =>
            mindMapDataToOutlineNode(child, allOriginalNodes)
          ) || [];

        onOutlineChange((outline) => ({
          ...outline,
          nodes: newNodes,
          updatedAt: new Date().toISOString(),
        }));
      },
      [outline, onOutlineChange]
    );

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      fitContent: () => rendererRef.current?.fitContent(),
      undo: () => rendererRef.current?.undo(),
      redo: () => rendererRef.current?.redo(),
      setLayout: (layout: MindMapLayout) => rendererRef.current?.setLayout(layout),
      setTheme: (theme: string) => rendererRef.current?.setTheme(theme),
      expandAll: () => rendererRef.current?.expandAll(),
      collapseToLevel: (level: number) => rendererRef.current?.collapseToLevel(level),
      exportSvg: () => rendererRef.current?.exportSvg() || Promise.resolve(null),
      exportPng: () => rendererRef.current?.exportPng() || Promise.resolve(null),
      zoomIn: () => rendererRef.current?.zoomIn(),
      zoomOut: () => rendererRef.current?.zoomOut(),
      resetScale: () => rendererRef.current?.resetScale(),
      getScale: () => rendererRef.current?.getScale() || 100,
      moveToCenter: () => rendererRef.current?.moveToCenter(),
    }));

    return (
      <div className="h-full w-full">
        <SimpleMindMapRenderer
          ref={rendererRef}
          data={mindmapData}
          layout={layout}
          theme={theme}
          onDataChange={handleDataChange}
          onNodeClick={handleNodeClick}
          showMiniMap={showMiniMap}
          rainbowLines={rainbowLines}
          className="h-full w-full"
        />
      </div>
    );
  }
);

export default MindMapView;
