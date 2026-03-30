/**
 * 大纲 AI 上下文引擎
 *
 * 分层构建上下文（critical / important / supplementary），
 * 支持阶段检测（blank / drafting / structured / completed）和 Token 预算管理。
 */

import type { Outline, OutlineNode, OutlineDocumentContent } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════════════

/** 大纲阶段 */
export type OutlinePhase = 'blank' | 'drafting' | 'structured' | 'completed';

/** 分层上下文 */
export interface LayeredOutlineContext {
  /** 核心层：当前节点 + 父子关系（~800 token） */
  critical: {
    activeNode: OutlineNode | null;
    activeNodePath: number[];
    parent: OutlineNode | null;
    children: OutlineNode[];
    siblings: OutlineNode[];
    activeNodeContent: string;
  };
  /** 重要层：附近节点 + 结构（~500 token） */
  important: {
    prevSibling: OutlineNode | null;
    nextSibling: OutlineNode | null;
    ancestorChain: OutlineNode[];
    siblingCount: number;
    nodeDepth: number;
    nearbyContext: string;
  };
  /** 补充层：全局统计（~300 token） */
  supplementary: {
    totalNodes: number;
    completedNodes: number;
    tags: string[];
    maxDepth: number;
    outlineTitle: string;
    completionRate: number;
  };
  /** 检测到的阶段 */
  phase: OutlinePhase;
  /** Token 预算 */
  tokenBudget: number;
}

export interface BuildContextOptions {
  /** Token 预算（默认 ~1600） */
  tokenBudget?: number;
  /** 强制指定阶段（不自动检测） */
  phase?: OutlinePhase;
  /** 最大节点数 */
  maxNodes?: number;
  /** 是否包含备注 */
  includeNotes?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 阶段检测
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 检测大纲当前阶段
 *
 * - blank: 空白或仅有一个空节点
 * - drafting: 有节点但缺乏层级结构（大部分为根节点）
 * - structured: 有良好的层级结构
 * - completed: 大部分节点已标记完成
 */
export function detectOutlinePhase(outline: Outline | null | undefined): OutlinePhase {
  if (!outline || !outline.nodes || outline.nodes.length === 0) {
    return 'blank';
  }

  // 统计节点
  let totalNodes = 0;
  let completedNodes = 0;
  let maxDepth = 0;
  let nodesWithChildren = 0;

  function traverse(nodes: OutlineNode[], depth: number = 0) {
    for (const node of nodes) {
      totalNodes++;
      if (node.completed) completedNodes++;
      if (depth > maxDepth) maxDepth = depth;
      if (node.children && node.children.length > 0) {
        nodesWithChildren++;
        traverse(node.children, depth + 1);
      }
    }
  }

  traverse(outline.nodes);

  // 空白
  if (totalNodes === 0 || (totalNodes === 1 && !outline.nodes[0].plainText?.trim())) {
    return 'blank';
  }

  // 完成度 > 70%
  if (completedNodes > 0 && completedNodes / totalNodes > 0.7) {
    return 'completed';
  }

  // 有层级结构（深度 >= 2 或有多个带子节点的节点）
  if (maxDepth >= 2 || nodesWithChildren >= 2) {
    return 'structured';
  }

  return 'drafting';
}

// ═══════════════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════════════

/** 在大纲中查找节点 */
function findNodeInOutline(outline: Outline, nodeId: string): OutlineNode | null {
  function traverse(nodes: OutlineNode[]): OutlineNode | null {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      const found = traverse(node.children);
      if (found) return found;
    }
    return null;
  }
  return traverse(outline.nodes);
}

/** 获取节点的数字路径索引 */
function findNodePathIndex(outline: Outline, nodeId: string): number[] {
  function traverse(nodes: OutlineNode[], path: number[]): number[] | null {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === nodeId) {
        return [...path, i];
      }
      const found = traverse(nodes[i].children, [...path, i]);
      if (found) return found;
    }
    return null;
  }
  return traverse(outline.nodes, []) || [];
}

/** 根据路径索引获取节点 */
function getNodeAtPath(outline: Outline, path: number[]): OutlineNode | null {
  if (path.length === 0) return null;
  let current: OutlineNode[] = outline.nodes;
  let node: OutlineNode | null = null;
  for (const index of path) {
    if (!current || index >= current.length) return null;
    node = current[index];
    current = node.children;
  }
  return node;
}

/** 获取节点的祖先链 */
function getAncestorChain(outline: Outline, path: number[]): OutlineNode[] {
  const chain: OutlineNode[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const ancestorPath = path.slice(0, i + 1);
    const ancestor = getNodeAtPath(outline, ancestorPath);
    if (ancestor) chain.push(ancestor);
  }
  return chain;
}

/** 统计大纲信息 */
function collectOutlineStats(outline: Outline): {
  totalNodes: number;
  completedNodes: number;
  maxDepth: number;
  tags: string[];
  mentions: string[];
} {
  let totalNodes = 0;
  let completedNodes = 0;
  let maxDepth = 0;
  const tags = new Set<string>();
  const mentions = new Set<string>();

  function traverse(nodes: OutlineNode[], depth: number = 0) {
    for (const node of nodes) {
      totalNodes++;
      if (node.completed) completedNodes++;
      if (depth > maxDepth) maxDepth = depth;
      (node.tags || []).forEach((t) => tags.add(t));
      (node.mentions || []).forEach((m) => mentions.add(m));
      if (node.children && node.children.length > 0) {
        traverse(node.children, depth + 1);
      }
    }
  }

  traverse(outline.nodes);

  return {
    totalNodes,
    completedNodes,
    maxDepth,
    tags: Array.from(tags),
    mentions: Array.from(mentions),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 分层上下文构建
// ═══════════════════════════════════════════════════════════════════════════

/** 构建核心层：当前节点 + 父子关系 */
function buildCriticalLayer(
  outline: Outline,
  activeNodeId: string | undefined,
): LayeredOutlineContext['critical'] {
  let activeNode: OutlineNode | null = null;
  let activeNodePath: number[] = [];
  let parent: OutlineNode | null = null;
  let children: OutlineNode[] = [];
  let siblings: OutlineNode[] = [];
  let activeNodeContent = '';

  if (activeNodeId) {
    activeNode = findNodeInOutline(outline, activeNodeId);
    if (activeNode) {
      activeNodePath = findNodePathIndex(outline, activeNodeId);
      activeNodeContent = activeNode.plainText || '';

      // 获取父节点
      if (activeNodePath.length > 1) {
        const parentPath = activeNodePath.slice(0, -1);
        parent = getNodeAtPath(outline, parentPath);
      }

      // 获取子节点
      children = activeNode.children || [];

      // 获取兄弟节点
      if (activeNodePath.length > 0) {
        const siblingPath = activeNodePath.slice(0, -1);
        const parentForSiblings = siblingPath.length === 0
          ? null
          : getNodeAtPath(outline, siblingPath);
        siblings = parentForSiblings
          ? parentForSiblings.children || []
          : outline.nodes;
      } else {
        siblings = outline.nodes;
      }
    }
  }

  return {
    activeNode,
    activeNodePath,
    parent,
    children,
    siblings,
    activeNodeContent,
  };
}

/** 构建重要层：附近节点 + 结构 */
function buildImportantLayer(
  outline: Outline,
  critical: LayeredOutlineContext['critical'],
): LayeredOutlineContext['important'] {
  let ancestorChain: OutlineNode[] = [];
  let nearbyContext = '';

  if (critical.activeNodePath.length > 0) {
    const currentIndex = critical.activeNodePath[critical.activeNodePath.length - 1];

    // 前一个兄弟
    if (currentIndex > 0 && critical.siblings.length > currentIndex) {
      // prevSibling already set above, need to reassign
    }

    // 后一个兄弟
    if (currentIndex < critical.siblings.length - 1) {
      // nextSibling already set above, need to reassign
    }

    // 祖先链
    ancestorChain = getAncestorChain(outline, critical.activeNodePath);

    // 构建附近上下文
    const nearby: string[] = [];

    // 添加祖先路径
    if (ancestorChain.length > 0) {
      nearby.push(`路径: ${ancestorChain.map(n => n.plainText || '(空)').join(' → ')}`);
    }

    // 添加前后兄弟
    if (currentIndex > 0 && critical.siblings[currentIndex - 1]) {
      nearby.push(`前一项: ${critical.siblings[currentIndex - 1].plainText || '(空)'}`);
    }
    if (currentIndex < critical.siblings.length - 1 && critical.siblings[currentIndex + 1]) {
      nearby.push(`后一项: ${critical.siblings[currentIndex + 1].plainText || '(空)'}`);
    }

    // 添加子节点概览
    if (critical.children.length > 0) {
      const childPreview = critical.children
        .slice(0, 5)
        .map(c => c.plainText || '(空)')
        .join(', ');
      const more = critical.children.length > 5 ? ` 等${critical.children.length}项` : '';
      nearby.push(`子项: ${childPreview}${more}`);
    }

    nearbyContext = nearby.join('\n');
  }

  return {
    prevSibling: critical.activeNodePath.length > 0 && critical.activeNodePath[critical.activeNodePath.length - 1] > 0
      ? critical.siblings[critical.activeNodePath[critical.activeNodePath.length - 1] - 1]
      : null,
    nextSibling: critical.activeNodePath.length > 0 &&
      critical.activeNodePath[critical.activeNodePath.length - 1] < critical.siblings.length - 1
      ? critical.siblings[critical.activeNodePath[critical.activeNodePath.length - 1] + 1]
      : null,
    ancestorChain,
    siblingCount: critical.siblings.length,
    nodeDepth: critical.activeNodePath.length,
    nearbyContext,
  };
}

/** 构建补充层：全局统计 */
function buildSupplementaryLayer(outline: Outline): LayeredOutlineContext['supplementary'] {
  const stats = collectOutlineStats(outline);

  return {
    totalNodes: stats.totalNodes,
    completedNodes: stats.completedNodes,
    tags: stats.tags,
    maxDepth: stats.maxDepth,
    outlineTitle: outline.title || '未命名大纲',
    completionRate: stats.totalNodes > 0 ? stats.completedNodes / stats.totalNodes : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 公开 API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 构建完整分层上下文
 */
export function buildLayeredOutlineContext(
  outline: Outline | null | undefined,
  activeNodeId: string | undefined,
  options: BuildContextOptions = {},
): LayeredOutlineContext {
  const { tokenBudget = 1600 } = options;

  // 空大纲处理
  if (!outline || !outline.nodes || outline.nodes.length === 0) {
    return {
      critical: {
        activeNode: null,
        activeNodePath: [],
        parent: null,
        children: [],
        siblings: [],
        activeNodeContent: '',
      },
      important: {
        prevSibling: null,
        nextSibling: null,
        ancestorChain: [],
        siblingCount: 0,
        nodeDepth: 0,
        nearbyContext: '',
      },
      supplementary: {
        totalNodes: 0,
        completedNodes: 0,
        tags: [],
        maxDepth: 0,
        outlineTitle: '',
        completionRate: 0,
      },
      phase: 'blank',
      tokenBudget,
    };
  }

  const phase = options.phase ?? detectOutlinePhase(outline);
  const critical = buildCriticalLayer(outline, activeNodeId);
  const important = buildImportantLayer(outline, critical);
  const supplementary = buildSupplementaryLayer(outline);

  return {
    critical,
    important,
    supplementary,
    phase,
    tokenBudget,
  };
}

/**
 * 将分层上下文合并为字符串（用于 AI 系统提示注入）
 */
export function formatContextForAI(ctx: LayeredOutlineContext): string {
  const parts: string[] = [];

  // 核心层
  if (ctx.critical.activeNode) {
    parts.push(`当前节点: ${ctx.critical.activeNodeContent || '(空)'}`);
    if (ctx.critical.parent) {
      parts.push(`父节点: ${ctx.critical.parent.plainText || '(空)'}`);
    }
    if (ctx.critical.children.length > 0) {
      parts.push(`子节点数: ${ctx.critical.children.length}`);
    }
  }

  // 重要层
  if (ctx.important.nearbyContext) {
    parts.push(ctx.important.nearbyContext);
  }
  parts.push(`层级深度: ${ctx.important.nodeDepth}`);

  // 补充层
  parts.push(`---`);
  parts.push(`大纲: ${ctx.supplementary.outlineTitle}`);
  parts.push(`节点总数: ${ctx.supplementary.totalNodes}`);
  parts.push(`完成进度: ${Math.round(ctx.supplementary.completionRate * 100)}%`);
  if (ctx.supplementary.tags.length > 0) {
    parts.push(`标签: ${ctx.supplementary.tags.slice(0, 10).join(', ')}`);
  }

  return `当前大纲上下文：

${parts.join('\n')}`;
}

/**
 * 智能上下文构建（根据阶段调整内容）
 *
 * - blank: 鼓励用户开始创建
 * - drafting: 显示已有内容，引导扩展
 * - structured: 完整上下文，支持深度操作
 * - completed: 强调完成状态，支持复盘
 */
export function buildSmartOutlineContext(
  outline: Outline | null | undefined,
  activeNodeId: string | undefined,
  options: BuildContextOptions = {},
): string {
  const ctx = buildLayeredOutlineContext(outline, activeNodeId, options);

  switch (ctx.phase) {
    case 'blank':
      return `当前大纲上下文：

大纲为空，等待用户创建第一个主题。
建议：帮助用户规划大纲结构，或根据用户需求生成初始大纲模板。`;

    case 'drafting':
      return `当前大纲上下文（草稿阶段）：

${formatContextForAI(ctx)}

提示：大纲尚处于草稿阶段，帮助用户扩展内容或建立层级结构。`;

    case 'structured':
      return `当前大纲上下文（结构化）：

${formatContextForAI(ctx)}`;

    case 'completed':
      return `当前大纲上下文（已完成）：

${formatContextForAI(ctx)}

提示：大纲完成度较高，可以帮助用户进行总结、复盘或导出。`;

    default:
      return formatContextForAI(ctx);
  }
}

/**
 * 根据阶段生成系统提示词
 */
export function buildOutlineSystemPrompt(
  phase: OutlinePhase,
  _ctx: LayeredOutlineContext,
): string {
  const basePrompt = `你是一个专业的大纲编辑助手。你帮助用户：
1. 扩展和丰富大纲内容
2. 优化层级结构
3. 生成新的节点或子节点
4. 润色和改进节点文本
5. 总结和分析大纲内容

输出格式要求：
- 使用 Markdown 列表格式（- 或数字）
- 使用缩进表示层级关系
- 每个列表项为一行文本`;

  const phaseHints: Record<OutlinePhase, string> = {
    blank: `
当前大纲为空。主动引导用户：
- 询问用户要创建什么类型的大纲（如项目计划、读书笔记、会议纪要等）
- 根据用户需求生成初始模板`,
    drafting: `
当前大纲处于草稿阶段。帮助用户：
- 扩展现有节点的内容
- 建议合理的层级结构
- 添加缺失的关键节点`,
    structured: `
当前大纲结构完整。帮助用户：
- 深化特定节点的内容
- 优化文本表达
- 分析和总结大纲内容`,
    completed: `
当前大纲大部分已完成。帮助用户：
- 进行最终审查和优化
- 生成总结或摘要
- 准备导出或分享`,
  };

  return basePrompt + phaseHints[phase];
}

// ═══════════════════════════════════════════════════════════════════════════
// 上下文模式
// ═══════════════════════════════════════════════════════════════════════════

/** AI 侧栏上下文模式 */
export type OutlineContextMode = 'activeNode' | 'branch' | 'full';

/**
 * 根据上下文模式构建上下文文本
 *
 * - activeNode: 当前节点 + 父子兄弟（精简，适合单节点操作）
 * - branch: 当前节点所在分支的完整内容（含所有后代）
 * - full: 全大纲 Markdown
 */
export function buildOutlineContextByMode(
  outline: Outline | null,
  activeNodeId: string | null | undefined,
  mode: OutlineContextMode,
): string {
  if (!outline || !outline.nodes || outline.nodes.length === 0) return '';

  if (mode === 'full') {
    // 直接用现有 outlineToMarkdown —— 但这里为避免循环依赖，内联简单实现
    function nodesToMd(nodes: OutlineNode[], depth: number = 0): string {
      const lines: string[] = [];
      for (const node of nodes) {
        const indent = '  '.repeat(depth);
        const marker = node.completed ? '[x]' : '-';
        lines.push(`${indent}${marker} ${node.plainText || ''}`);
        if (node.notePlainText) {
          lines.push(`${indent}  > ${node.notePlainText}`);
        }
        if (node.children?.length) {
          lines.push(nodesToMd(node.children, depth + 1));
        }
      }
      return lines.join('\n');
    }
    return nodesToMd(outline.nodes);
  }

  if (mode === 'branch' && activeNodeId) {
    // 找到当前节点，返回它及其所有后代的 Markdown
    function findBranch(nodes: OutlineNode[], targetId: string): OutlineNode | null {
      for (const node of nodes) {
        if (node.id === targetId) return node;
        const found = findBranch(node.children || [], targetId);
        if (found) return found;
      }
      return null;
    }
    function subtreeToMd(node: OutlineNode, depth: number = 0): string {
      const lines: string[] = [];
      const indent = '  '.repeat(depth);
      const marker = node.completed ? '[x]' : '-';
      lines.push(`${indent}${marker} ${node.plainText || ''}`);
      if (node.notePlainText) {
        lines.push(`${indent}  > ${node.notePlainText}`);
      }
      for (const child of node.children || []) {
        lines.push(subtreeToMd(child, depth + 1));
      }
      return lines.join('\n');
    }
    const branch = findBranch(outline.nodes, activeNodeId);
    if (branch) return subtreeToMd(branch);
  }

  // activeNode 模式（或 branch 模式但无 activeNodeId）
  const ctx = buildLayeredOutlineContext(outline, activeNodeId || undefined);
  return formatContextForAI(ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
// 兼容旧 API
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated 使用 buildLayeredOutlineContext 替代 */
export interface OutlineContextOptions {
  maxNodes?: number;
  includeCompleted?: boolean;
  includeNotes?: boolean;
  focusNodeId?: string;
}

/** @deprecated 使用 buildLayeredOutlineContext 替代 */
export interface OutlineContext {
  title: string;
  structure: string;
  activeNode?: {
    id: string;
    content: string;
    path: string[];
    depth: number;
  };
  stats: {
    totalNodes: number;
    completedNodes: number;
    maxDepth: number;
  };
  tags: string[];
  mentions: string[];
}

/** @deprecated 使用 buildLayeredOutlineContext 替代 */
export function buildOutlineContext(
  document: OutlineDocumentContent,
  activeOutlineId: string,
  options: OutlineContextOptions = {},
): OutlineContext {
  const {
    maxNodes = 100,
    includeCompleted = true,
    includeNotes = true,
    focusNodeId,
  } = options;

  const outline = document.outlines?.find((o) => o.id === activeOutlineId);
  if (!outline) {
    return {
      title: '',
      structure: '',
      stats: { totalNodes: 0, completedNodes: 0, maxDepth: 0 },
      tags: [],
      mentions: [],
    };
  }

  let totalNodes = 0;
  let completedNodes = 0;
  let maxDepth = 0;
  const allTags = new Set<string>();
  const allMentions = new Set<string>();

  function collectStats(nodes: OutlineNode[], depth: number = 0) {
    for (const node of nodes) {
      totalNodes++;
      if (node.completed) completedNodes++;
      if (depth > maxDepth) maxDepth = depth;
      (node.tags || []).forEach((tag) => allTags.add(tag));
      (node.mentions || []).forEach((mention) => allMentions.add(mention));
      if (node.children && node.children.length > 0) {
        collectStats(node.children, depth + 1);
      }
    }
  }

  collectStats(outline.nodes);

  let nodeCount = 0;
  const structureLines: string[] = [];

  function buildStructure(nodes: OutlineNode[], depth: number = 0) {
    for (let i = 0; i < nodes.length && nodeCount < maxNodes; i++) {
      const node = nodes[i];
      if (!includeCompleted && node.completed) continue;
      const indent = '  '.repeat(depth);
      const marker = node.children && node.children.length > 0 ? (node.expanded ? '▼' : '▶') : '•';
      const status = node.completed ? '[✓] ' : '';
      const note = includeNotes && node.notePlainText ? ` (注: ${node.notePlainText.slice(0, 50)}${node.notePlainText.length > 50 ? '...' : ''})` : '';
      const hl = node.headingLevel && node.headingLevel > 0 ? Math.min(node.headingLevel, 7) : 0;
      const headingPrefix = hl > 0 ? '#'.repeat(hl) + ' ' : '';
      structureLines.push(`${indent}${marker} ${status}${headingPrefix}${node.plainText || ''}${note}`);
      nodeCount++;
      if (node.children && node.children.length > 0 && node.expanded) {
        buildStructure(node.children, depth + 1);
      }
    }
  }

  buildStructure(outline.nodes);

  if (nodeCount >= maxNodes) {
    structureLines.push('... (更多节点已省略)');
  }

  let activeNode: OutlineContext['activeNode'] | undefined;
  if (focusNodeId) {
    const node = findNodeInOutline(outline, focusNodeId);
    if (node) {
      const pathIndices = findNodePathIndex(outline, focusNodeId);
      const pathNodes: OutlineNode[] = [];
      for (let i = 0; i < pathIndices.length; i++) {
        const pathSoFar = pathIndices.slice(0, i + 1);
        const pathNode = getNodeAtPath(outline, pathSoFar);
        if (pathNode) pathNodes.push(pathNode);
      }
      activeNode = {
        id: node.id,
        content: node.plainText || '',
        path: pathNodes.map((p) => p.plainText || ''),
        depth: pathIndices.length - 1,
      };
    }
  }

  return {
    title: outline.title || '',
    structure: structureLines.join('\n'),
    activeNode,
    stats: {
      totalNodes,
      completedNodes,
      maxDepth,
    },
    tags: Array.from(allTags),
    mentions: Array.from(allMentions),
  };
}
