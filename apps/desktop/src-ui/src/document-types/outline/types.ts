/**
 * 大纲文档类型定义
 * 
 * 专业级大纲写作工具，对标幕布核心体验
 */

import type { OutlineHeadingLevel } from './outlineHeadingLevel';
import { normalizeOutlineHeadingLevel } from './outlineHeadingLevel';

export type { OutlineHeadingLevel } from './outlineHeadingLevel';
export { normalizeOutlineHeadingLevel, outlineHeadingEditorClass } from './outlineHeadingLevel';

// ═══════════════════════════════════════════════════════════════════════════════
// 高亮颜色系统
// ═══════════════════════════════════════════════════════════════════════════════

export interface HighlightColor {
  name: string;
  value: string;
}

/**
 * 36 种预设高亮颜色（6 行 x 6 列）
 * 供工具栏和浮动菜单共用
 */
export const HIGHLIGHT_COLORS: HighlightColor[] = [
  // 暖黄
  { name: 'lightYellow', value: '#fef9c3' },
  { name: 'yellow', value: '#fef3c7' },
  { name: 'amber', value: '#fef08a' },
  { name: 'peach', value: '#fed7aa' },
  { name: 'apricot', value: '#ffedd5' },
  { name: 'lightOrange', value: '#fff7ed' },
  // 绿系
  { name: 'mint', value: '#d1fae5' },
  { name: 'lightGreen', value: '#dcfce7' },
  { name: 'green', value: '#bbf7d0' },
  { name: 'olive', value: '#d9f99d' },
  { name: 'sage', value: '#ecfccb' },
  { name: 'lime', value: '#fef9c3' },
  // 蓝系
  { name: 'skyBlue', value: '#e0f2fe' },
  { name: 'lightBlue', value: '#dbeafe' },
  { name: 'blue', value: '#bfdbfe' },
  { name: 'cobalt', value: '#93c5fd' },
  { name: 'lavender', value: '#ddd6fe' },
  { name: 'haze', value: '#c7d2fe' },
  // 紫粉
  { name: 'lightPurple', value: '#f3e8ff' },
  { name: 'lilac', value: '#e9d5ff' },
  { name: 'wisteria', value: '#d8b4fe' },
  { name: 'pink', value: '#fce7f3' },
  { name: 'rose', value: '#fecdd3' },
  { name: 'lightRed', value: '#ffe4e6' },
  // 红橙
  { name: 'coral', value: '#fed7aa' },
  { name: 'tomato', value: '#fecaca' },
  { name: 'salmon', value: '#fda4af' },
  { name: 'clay', value: '#fdba74' },
  { name: 'sienna', value: '#f87171' },
  { name: 'brick', value: '#ef4444' },
  // 中性
  { name: 'lightGray', value: '#f3f4f6' },
  { name: 'silver', value: '#e5e7eb' },
  { name: 'warmGray', value: '#f5f5f4' },
  { name: 'cream', value: '#fefce8' },
  { name: 'ivory', value: '#fffbeb' },
  { name: 'tan', value: '#fef2f2' },
];

/** 自定义颜色缓存 key */
const CUSTOM_COLORS_KEY = 'outline-custom-highlight-colors';
const MAX_CUSTOM_COLORS = 8;

/** 读取自定义颜色 */
export function loadCustomColors(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_COLORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c: unknown): c is string => typeof c === 'string');
  } catch {
    return [];
  }
}

/** 保存自定义颜色 */
export function saveCustomColor(color: string): void {
  const existing = loadCustomColors();
  const filtered = existing.filter((c) => c !== color);
  const updated = [color, ...filtered].slice(0, MAX_CUSTOM_COLORS);
  localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(updated));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 基础类型定义
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 富文本内容（ProseMirror JSON 格式）
 */
export interface RichTextContent {
  type: 'doc';
  content: Array<{
    type: 'paragraph';
    content?: Array<{
      type: 'text';
      text: string;
      marks?: Array<{
        type: 'bold' | 'italic' | 'underline' | 'strike' | 'highlight';
        attrs?: { color?: string };
      }>;
    } | {
      type: 'tag';
      attrs: { name: string; type: 'hash' | 'mention' };
    }>;
  }>;
}

/**
 * 大纲节点
 */
export interface OutlineNode {
  id: string;                    // 唯一标识符
  content: RichTextContent;      // 富文本内容
  plainText: string;             // 纯文本缓存
  tags: string[];                // 提取的标签列表
  mentions: string[];            // 提取的提及列表
  note?: RichTextContent;        // 备注（富文本）
  notePlainText?: string;        // 备注纯文本
  completed: boolean;            // 完成状态
  expanded: boolean;             // 展开状态
  headingLevel: OutlineHeadingLevel; // 0 正文；1–7 为 H1–H7（显式格式，与树深度无关）
  colorHighlight?: string;       // 颜色高亮
  createdAt: string;             // 创建时间 ISO
  updatedAt: string;             // 更新时间 ISO
  children: OutlineNode[];       // 子节点数组
}

/**
 * 大纲（单个大纲结构）
 */
export interface Outline {
  id: string;                    // 大纲ID
  title: string;                 // 大纲标题
  nodes: OutlineNode[];          // 根级节点列表
  /**
   * 折叠节点 ID 列表（持久化）。
   * 注意：这里必须使用数组而不是 Set，否则 JSON 序列化会丢失数据。
   */
  collapsedNodeIds: string[];
  createdAt: string;             // 创建时间
  updatedAt: string;             // 更新时间
}

/**
 * 文档设置
 */
export interface OutlineSettings {
  // 显示设置
  defaultExpandLevel: number;        // 默认展开层级（1-6，0=全部展开）
  showCompleted: 'all' | 'active' | 'completed';  // 完成项目显示模式
  showNotes: 'all' | 'hover' | 'active';          // 备注显示模式
  fontSize: 14 | 16 | 18;            // 字体大小
  lineSpacing: 'compact' | 'normal' | 'loose';    // 行间距
  showGuideLines: boolean;           // 是否显示层级引导线

  // 编辑设置
  autoSave: boolean;                 // 自动保存
  autoSaveInterval: number;          // 自动保存间隔（秒）
  enableRichText: boolean;           // 启用富文本编辑
  defaultHeadingLevel: 0 | 1;        // 默认新建节点标题级别
  showWordCount?: boolean;           // 显示字数统计
  showProgress?: boolean;            // 显示完成进度
}

/**
 * 文档内容（存储结构）
 */
export interface OutlineDocumentContent {
  version: 2;                    // 数据版本
  outlines: Outline[];           // 大纲列表
  activeOutlineId: string;       // 当前激活大纲ID
  settings: OutlineSettings;     // 文档设置
  createdAt: string;             // 文档创建时间
  updatedAt: string;             // 文档更新时间
}

/**
 * 标签索引（运行时生成）
 */
export interface TagIndex {
  tags: Map<string, Set<string>>;      // tag -> nodeIds
  mentions: Map<string, Set<string>>;  // mention -> nodeIds
  allTags: string[];                   // 所有唯一标签
  allMentions: string[];               // 所有唯一提及
}

/**
 * 过滤器状态
 */
export interface FilterState {
  selectedTags: Set<string>;           // 选中的标签
  selectedMentions: Set<string>;       // 选中的提及
  searchQuery: string;                 // 搜索关键词
}

/**
 * 统计信息
 */
export interface OutlineStats {
  totalOutlines: number;
  totalNodes: number;
  completedNodes: number;
  maxDepth: number;
  totalTags: number;
  totalMentions: number;
  totalWords: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 创建空大纲文档
 */
export function createEmptyOutlineDocument(): OutlineDocumentContent {
  const now = new Date().toISOString();
  const defaultOutline = createEmptyOutline();

  return {
    version: 2,
    outlines: [defaultOutline],
    activeOutlineId: defaultOutline.id,
    settings: createDefaultSettings(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 创建空大纲
 */
export function createEmptyOutline(title?: string): Outline {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: title || '未命名大纲',
    nodes: [],
    collapsedNodeIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 创建空节点
 */
export function createEmptyNode(text?: string): OutlineNode {
  const now = new Date().toISOString();
  const content = createRichTextFromPlain(text || '');

  return {
    id: generateId(),
    content,
    plainText: text || '',
    tags: extractTagsFromText(text || ''),
    mentions: extractMentionsFromText(text || ''),
    completed: false,
    expanded: true,
    headingLevel: 0,
    createdAt: now,
    updatedAt: now,
    children: [],
  };
}

/**
 * 创建默认设置
 */
export function createDefaultSettings(): OutlineSettings {
  return {
    defaultExpandLevel: 3,
    showCompleted: 'all',
    showNotes: 'hover',
    fontSize: 16,
    lineSpacing: 'normal',
    showGuideLines: true,
    autoSave: true,
    autoSaveInterval: 5,
    enableRichText: true,
    defaultHeadingLevel: 0,
  };
}

/**
 * 从纯文本创建富文本
 */
export function createRichTextFromPlain(text: string): RichTextContent {
  return {
    type: 'doc',
    content: text
      ? [{
          type: 'paragraph',
          content: [{ type: 'text', text }],
        }]
      : [],
  };
}

/**
 * 提取标签
 */
export function extractTagsFromText(text: string): string[] {
  const tagRegex = /#([^\s#@]+)/g;
  const tags: string[] = [];
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    if (!tags.includes(match[1])) {
      tags.push(match[1]);
    }
  }
  return tags;
}

/**
 * 提取提及
 */
export function extractMentionsFromText(text: string): string[] {
  const mentionRegex = /@([^\s#@]+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    if (!mentions.includes(match[1])) {
      mentions.push(match[1]);
    }
  }
  return mentions;
}

/**
 * 从富文本提取纯文本
 */
export function getPlainTextFromContent(content: RichTextContent): string {
  if (!content.content || content.content.length === 0) return '';

  return content.content
    .map((p) => {
      if (!p.content) return '';
      return p.content
        .map((node) => {
          if (node.type === 'text') return node.text;
          if (node.type === 'tag') {
            return node.attrs.type === 'hash'
              ? `#${node.attrs.name}`
              : `@${node.attrs.name}`;
          }
          return '';
        })
        .join('');
    })
    .join('\n');
}

/**
 * 提取富文本中的标签
 */
export function extractTagsFromContent(content: RichTextContent): {
  tags: string[];
  mentions: string[];
} {
  const text = getPlainTextFromContent(content);
  return {
    tags: extractTagsFromText(text),
    mentions: extractMentionsFromText(text),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 节点操作工具函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 在树中查找节点
 */
export function findNode(nodes: OutlineNode[] | undefined | null, id: string): OutlineNode | null {
  if (!nodes?.length) return null;
  for (const node of nodes) {
    if (!node) continue;
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return null;
}

/**
 * 查找节点路径
 */
export function findNodePath(nodes: OutlineNode[], id: string, path: number[] = []): number[] | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n) continue;
    const currentPath = [...path, i];
    if (n.id === id) return currentPath;

    const childPath = findNodePath(n.children ?? [], id, currentPath);
    if (childPath) return childPath;
  }
  return null;
}

/**
 * 获取节点深度
 */
export function getNodeDepth(nodes: OutlineNode[], id: string): number {
  const path = findNodePath(nodes, id);
  return path ? path.length - 1 : 0;
}

/**
 * 根据路径获取节点
 */
export function getNodeAtPath(nodes: OutlineNode[], path: number[]): OutlineNode | null {
  if (!path.length) return null;
  let current: OutlineNode | undefined = nodes[path[0]];
  for (let i = 1; i < path.length && current; i++) {
    const ch: OutlineNode[] = current.children ?? [];
    current = ch[path[i]];
  }
  return current || null;
}

/**
 * 获取父节点
 */
export function getParentNode(nodes: OutlineNode[], id: string): OutlineNode | null {
  const path = findNodePath(nodes, id);
  if (!path || path.length <= 1) return null;

  return getNodeAtPath(nodes, path.slice(0, -1));
}

/**
 * 获取同级节点
 */
export function getSiblingNodes(nodes: OutlineNode[], id: string): OutlineNode[] {
  const path = findNodePath(nodes, id);
  if (!path) return [];

  if (path.length === 1) {
    return nodes;
  }

  const parent = getNodeAtPath(nodes, path.slice(0, -1));
  return parent ? parent.children : [];
}

/**
 * 克隆节点树
 */
export function cloneNodeTree(node: OutlineNode): OutlineNode {
  return {
    ...node,
    id: generateId(),
    content: JSON.parse(JSON.stringify(node.content)),
    note: node.note ? JSON.parse(JSON.stringify(node.note)) : undefined,
    tags: [...(node.tags ?? [])],
    mentions: [...(node.mentions ?? [])],
    children: (node.children ?? []).map(cloneNodeTree),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 更新树中的节点
 */
export function updateNodeInTree(
  nodes: OutlineNode[],
  id: string,
  updater: (node: OutlineNode) => OutlineNode
): OutlineNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return updater({ ...node, updatedAt: new Date().toISOString() });
    }
    return {
      ...node,
      children: updateNodeInTree(node.children, id, updater),
    };
  });
}

/**
 * 从树中删除节点
 */
export function removeNodeFromTree(nodes: OutlineNode[], id: string): OutlineNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({
      ...node,
      children: removeNodeFromTree(node.children, id),
    }));
}

/**
 * 在指定路径插入节点
 */
export function insertNodeAtPath(
  nodes: OutlineNode[],
  parentPath: number[],
  index: number,
  newNode: OutlineNode
): OutlineNode[] {
  if (parentPath.length === 0) {
    const newNodes = [...nodes];
    newNodes.splice(index, 0, newNode);
    return newNodes;
  }

  if (parentPath[0] >= nodes.length) {
    console.warn('[insertNodeAtPath] path index out of bounds:', parentPath[0], 'nodes.length:', nodes.length);
    return nodes;
  }

  return nodes.map((node, i) => {
    if (i === parentPath[0]) {
      return {
        ...node,
        children: insertNodeAtPath(
          node.children ?? [],
          parentPath.slice(1),
          index,
          newNode
        ),
      };
    }
    return node;
  });
}

/**
 * 在同一父节点下交换 index 与相邻项（上移/下移），全程不可变。
 * 避免在 setState updater 内原地改 children，否则 React 18 开发模式会重复调用 updater 导致连跳两格。
 */
export function swapSiblingNodesAtPath(
  nodes: OutlineNode[],
  parentPath: number[],
  index: number,
  direction: 'up' | 'down'
): OutlineNode[] {
  const siblingIndex = direction === 'up' ? index - 1 : index + 1;

  if (parentPath.length === 0) {
    if (index < 0 || index >= nodes.length) return nodes;
    if (siblingIndex < 0 || siblingIndex >= nodes.length) return nodes;
    const next = [...nodes];
    [next[index], next[siblingIndex]] = [next[siblingIndex], next[index]];
    return next;
  }

  const i = parentPath[0];
  if (i < 0 || i >= nodes.length) return nodes;

  return nodes.map((node, idx) => {
    if (idx !== i) return node;
    const ch = node.children ?? [];
    const newChildren = swapSiblingNodesAtPath(
      ch,
      parentPath.slice(1),
      index,
      direction
    );
    if (newChildren === ch) return node;
    return {
      ...node,
      children: newChildren,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 统计和索引函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 统计节点数量
 */
export function countNodes(nodes: OutlineNode[] | undefined | null): number {
  if (!nodes?.length) return 0;
  return nodes.reduce((sum, node) => {
    if (!node) return sum;
    return sum + 1 + countNodes(node.children ?? []);
  }, 0);
}

/**
 * 统计已完成节点
 */
export function countCompleted(nodes: OutlineNode[] | undefined | null): number {
  if (!nodes?.length) return 0;
  return nodes.reduce((sum, node) => {
    if (!node) return sum;
    return sum + (node.completed ? 1 : 0) + countCompleted(node.children ?? []);
  }, 0);
}

/**
 * 获取最大深度
 */
export function getMaxDepth(nodes: OutlineNode[] | undefined | null, currentDepth = 1): number {
  if (!nodes?.length) return currentDepth - 1;
  return Math.max(
    ...nodes.map((node) =>
      node
        ? Math.max(currentDepth, getMaxDepth(node.children ?? [], currentDepth + 1))
        : currentDepth - 1
    )
  );
}

/**
 * 提取所有节点（跳过无效项；children 缺失时按空数组处理，避免树损坏或热更新半态导致崩溃）
 */
export function extractAllNodes(nodes: OutlineNode[] | undefined | null): OutlineNode[] {
  if (!nodes?.length) return [];
  const result: OutlineNode[] = [];
  for (const node of nodes) {
    if (!node) continue;
    result.push(node);
    result.push(...extractAllNodes(node.children ?? []));
  }
  return result;
}

/**
 * 构建标签索引
 */
export function buildTagIndex(nodes: OutlineNode[]): TagIndex {
  const tags = new Map<string, Set<string>>();
  const mentions = new Map<string, Set<string>>();

  function traverse(node: OutlineNode | undefined | null) {
    if (!node?.id) return;
    const tagList = node.tags ?? [];
    const mentionList = node.mentions ?? [];
    for (const tag of tagList) {
      if (!tags.has(tag)) {
        tags.set(tag, new Set());
      }
      tags.get(tag)!.add(node.id);
    }

    for (const mention of mentionList) {
      if (!mentions.has(mention)) {
        mentions.set(mention, new Set());
      }
      mentions.get(mention)!.add(node.id);
    }

    for (const child of node.children ?? []) {
      traverse(child);
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return {
    tags,
    mentions,
    allTags: Array.from(tags.keys()).sort(),
    allMentions: Array.from(mentions.keys()).sort(),
  };
}

/**
 * 根据标签过滤节点
 */
export function filterNodesByTags(
  nodes: OutlineNode[],
  filter: FilterState,
  index: TagIndex
): OutlineNode[] {
  if (
    filter.selectedTags.size === 0 &&
    filter.selectedMentions.size === 0 &&
    filter.searchQuery === ''
  ) {
    return nodes;
  }

  // 获取匹配所有条件的节点ID
  let matchingIds: Set<string> | null = null;

  if (filter.selectedTags.size > 0) {
    for (const tag of filter.selectedTags) {
      const tagNodeIds = index.tags.get(tag);
      if (!tagNodeIds) return [];
      if (matchingIds === null) {
        matchingIds = new Set(tagNodeIds);
      } else {
        matchingIds = new Set([...matchingIds].filter((id: string) => tagNodeIds.has(id)));
      }
    }
  }

  if (filter.selectedMentions.size > 0) {
    for (const mention of filter.selectedMentions) {
      const mentionNodeIds = index.mentions.get(mention);
      if (!mentionNodeIds) return [];
      if (matchingIds === null) {
        matchingIds = new Set(mentionNodeIds);
      } else {
        matchingIds = new Set(
          [...matchingIds].filter((id: string) => mentionNodeIds.has(id))
        );
      }
    }
  }

  // 搜索过滤
  if (filter.searchQuery) {
    const query = filter.searchQuery.toLowerCase();
    const searchIds = new Set<string>();

    function traverse(node: OutlineNode | undefined | null) {
      if (!node?.id) return;
      const plain = (node.plainText ?? '').toLowerCase();
      const note = node.notePlainText?.toLowerCase() ?? '';
      if (plain.includes(query) || note.includes(query)) {
        searchIds.add(node.id);
      }
      for (const child of node.children ?? []) {
        traverse(child);
      }
    }

    for (const node of nodes) {
      traverse(node);
    }

    if (matchingIds === null) {
      matchingIds = searchIds;
    } else {
      matchingIds = new Set(
        [...matchingIds].filter((id: string) => searchIds.has(id))
      );
    }
  }

  if (matchingIds === null || matchingIds.size === 0) {
    return [];
  }

  // 过滤节点树，保留匹配节点及其路径上的所有父节点
  function filterTree(node: OutlineNode | undefined | null): OutlineNode | null {
    if (!node?.id) return null;
    const filteredChildren = (node.children ?? [])
      .map(filterTree)
      .filter((n): n is OutlineNode => n !== null);

    if (matchingIds!.has(node.id) || filteredChildren.length > 0) {
      return {
        ...node,
        tags: node.tags ?? [],
        mentions: node.mentions ?? [],
        children: filteredChildren,
      };
    }

    return null;
  }

  return nodes.map(filterTree).filter((n): n is OutlineNode => n !== null);
}

/**
 * 获取大纲统计信息
 */
export function getOutlineStats(
  data: OutlineDocumentContent
): OutlineStats {
  let totalNodes = 0;
  let completedNodes = 0;
  let maxDepth = 0;
  let totalWords = 0;

  function countWords(text: string): number {
    if (!text.trim()) return 0;
    // 中文每字算一词，英文按空格分词
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const nonChineseText = text.replace(/[\u4e00-\u9fa5]/g, ' ');
    const englishWords = nonChineseText.trim().split(/\s+/).filter(Boolean).length;
    return chineseChars + englishWords;
  }

  function countNodeWords(nodes: OutlineNode[]): number {
    let words = 0;
    for (const node of nodes) {
      words += countWords(node.plainText);
      if (node.notePlainText) words += countWords(node.notePlainText);
      words += countNodeWords(node.children);
    }
    return words;
  }

  for (const outline of data.outlines) {
    totalNodes += countNodes(outline.nodes);
    completedNodes += countCompleted(outline.nodes);
    maxDepth = Math.max(maxDepth, getMaxDepth(outline.nodes));
    totalWords += countNodeWords(outline.nodes);
  }

  const index = buildTagIndex(
    data.outlines.flatMap((o) => extractAllNodes(o.nodes))
  );

  return {
    totalOutlines: data.outlines.length,
    totalNodes,
    completedNodes,
    maxDepth,
    totalTags: index.allTags.length,
    totalMentions: index.allMentions.length,
    totalWords,
  };
}

/**
 * 解析文档内容
 */
export function parseOutlineContent(content: string): OutlineDocumentContent {
  try {
    const parsed = JSON.parse(content);

    // 版本迁移处理
    if (parsed.version === 1) {
      // 从版本1迁移到版本2
      return normalizeOutlineData(migrateFromV1(parsed));
    }

    return normalizeOutlineData(parsed);
  } catch (error) {
    console.error('Failed to parse outline content:', error);
    return createEmptyOutlineDocument();
  }
}

/**
 * 序列化文档内容
 */
export function serializeOutlineContent(
  data: OutlineDocumentContent
): string {
  return JSON.stringify(data, null, 2);
}

/**
 * 两段大纲 JSON 是否语义相同（宿主可能返回紧凑 JSON，本地用 pretty print，严格字符串比较会误判并覆盖状态）。
 */
export function outlineContentSerializedEqual(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = tryParseOutlineContentWithoutLog(a);
  const pb = tryParseOutlineContentWithoutLog(b);
  if (!pa || !pb) return false;
  return JSON.stringify(pa) === JSON.stringify(pb);
}

function tryParseOutlineContentWithoutLog(content: string): OutlineDocumentContent | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.version === 1) {
      return normalizeOutlineData(migrateFromV1(parsed));
    }
    return normalizeOutlineData(parsed);
  } catch {
    return null;
  }
}

/**
 * 提取纯文本（用于全文搜索）
 */
export function extractOutlinePlainText(content: string): string {
  try {
    const data = parseOutlineContent(content);
    const texts: string[] = [];

    function traverse(node: OutlineNode) {
      texts.push(node.plainText);
      if (node.notePlainText) {
        texts.push(node.notePlainText);
      }
      for (const child of node.children) {
        traverse(child);
      }
    }

    for (const outline of data.outlines) {
      for (const node of outline.nodes) {
        traverse(node);
      }
      texts.push(outline.title);
    }

    return texts.join('\n');
  } catch {
    return '';
  }
}

/**
 * 从版本1迁移
 */
function migrateFromV1(v1Data: unknown): OutlineDocumentContent {
  // 处理旧版本数据格式
  const data = v1Data as {
    version: 1;
    outlines?: unknown[];
    activeOutlineId?: string;
  };

  const now = new Date().toISOString();

  return {
    version: 2,
    outlines: (data.outlines || []).map((o: unknown) => {
      const oldOutline = o as { id?: string; title?: string; nodes?: unknown[] };
      return {
        id: oldOutline.id || generateId(),
        title: oldOutline.title || '未命名大纲',
        nodes: (oldOutline.nodes || []).map((n: unknown) =>
          migrateNodeFromV1(n)
        ),
        collapsedNodeIds: [],
        createdAt: now,
        updatedAt: now,
      };
    }),
    activeOutlineId: data.activeOutlineId || '',
    settings: createDefaultSettings(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 迁移节点从版本1
 */
function migrateNodeFromV1(v1Node: unknown): OutlineNode {
  const node = v1Node as {
    id?: string;
    text?: string;
    content?: RichTextContent;
    note?: string;
    completed?: boolean;
    expanded?: boolean;
    children?: unknown[];
  };

  const now = new Date().toISOString();
  const text = node.text || '';
  const content =
    node.content || createRichTextFromPlain(text);

  return {
    id: node.id || generateId(),
    content,
    plainText: getPlainTextFromContent(content),
    tags: extractTagsFromText(text),
    mentions: extractMentionsFromText(text),
    note: node.note ? createRichTextFromPlain(node.note) : undefined,
    notePlainText: node.note,
    completed: node.completed || false,
    expanded: node.expanded !== false,
    headingLevel: 0,
    createdAt: now,
    updatedAt: now,
    children: (node.children || []).map((c) => migrateNodeFromV1(c)),
  };
}

function normalizeOutlineData(raw: unknown): OutlineDocumentContent {
  const fallback = createEmptyOutlineDocument();
  if (!raw || typeof raw !== 'object') return fallback;

  const r = raw as Partial<OutlineDocumentContent> & { outlines?: unknown[] };
  const now = new Date().toISOString();

  const outlines: Outline[] = Array.isArray(r.outlines)
    ? r.outlines.map((o) => normalizeOutline(o))
    : [];

  const effectiveOutlines = outlines.length > 0 ? outlines : fallback.outlines;
  const activeOutlineId =
    typeof r.activeOutlineId === 'string' && effectiveOutlines.some((o) => o.id === r.activeOutlineId)
      ? r.activeOutlineId
      : effectiveOutlines[0].id;

  return {
    version: 2,
    outlines: effectiveOutlines,
    activeOutlineId,
    settings: normalizeSettings(r.settings),
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  };
}

function normalizeOutline(raw: unknown): Outline {
  const now = new Date().toISOString();
  if (!raw || typeof raw !== 'object') {
    return {
      ...createEmptyOutline(),
      createdAt: now,
      updatedAt: now,
    };
  }

  const o = raw as Partial<Outline> & { nodes?: unknown[]; collapsedNodeIds?: unknown };
  const nodes: OutlineNode[] = Array.isArray(o.nodes)
    ? o.nodes.map((n) => normalizeNode(n))
    : [];

  const collapsed = normalizeStringArray(o.collapsedNodeIds);

  return {
    id: typeof o.id === 'string' && o.id ? o.id : generateId(),
    title: typeof o.title === 'string' && o.title ? o.title : '未命名大纲',
    nodes,
    collapsedNodeIds: collapsed,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : now,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : now,
  };
}

export function normalizeNode(raw: unknown): OutlineNode {
  const now = new Date().toISOString();
  if (!raw || typeof raw !== 'object') return createEmptyNode('');

  const n = raw as Partial<OutlineNode> & { children?: unknown[] };

  const content = isRichTextContent(n.content) ? n.content : createRichTextFromPlain(n.plainText || '');
  const plainText = typeof n.plainText === 'string' ? n.plainText : getPlainTextFromContent(content);
  const extracted = extractTagsFromContent(content);

  return {
    id: typeof n.id === 'string' && n.id ? n.id : generateId(),
    content,
    plainText,
    tags: Array.isArray(n.tags) ? n.tags.filter((x): x is string => typeof x === 'string') : extracted.tags,
    mentions: Array.isArray(n.mentions) ? n.mentions.filter((x): x is string => typeof x === 'string') : extracted.mentions,
    note: isRichTextContent(n.note) ? n.note : (typeof n.notePlainText === 'string' ? createRichTextFromPlain(n.notePlainText) : undefined),
    notePlainText: typeof n.notePlainText === 'string' ? n.notePlainText : undefined,
    completed: !!n.completed,
    expanded: n.expanded !== false,
    headingLevel: normalizeOutlineHeadingLevel(n.headingLevel),
    colorHighlight: typeof n.colorHighlight === 'string' ? n.colorHighlight : undefined,
    createdAt: typeof n.createdAt === 'string' ? n.createdAt : now,
    updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : now,
    children: Array.isArray(n.children) ? n.children.map((c) => normalizeNode(c)) : [],
  };
}

function normalizeSettings(raw: unknown): OutlineSettings {
  const d = createDefaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw as Partial<OutlineSettings>;

  return {
    defaultExpandLevel: typeof s.defaultExpandLevel === 'number' ? s.defaultExpandLevel : d.defaultExpandLevel,
    showCompleted: s.showCompleted === 'all' || s.showCompleted === 'active' || s.showCompleted === 'completed' ? s.showCompleted : d.showCompleted,
    showNotes: s.showNotes === 'all' || s.showNotes === 'hover' || s.showNotes === 'active' ? s.showNotes : d.showNotes,
    fontSize: s.fontSize === 14 || s.fontSize === 16 || s.fontSize === 18 ? s.fontSize : d.fontSize,
    lineSpacing: s.lineSpacing === 'compact' || s.lineSpacing === 'normal' || s.lineSpacing === 'loose' ? s.lineSpacing : d.lineSpacing,
    showGuideLines: typeof s.showGuideLines === 'boolean' ? s.showGuideLines : d.showGuideLines,
    autoSave: typeof s.autoSave === 'boolean' ? s.autoSave : d.autoSave,
    autoSaveInterval: typeof s.autoSaveInterval === 'number' ? s.autoSaveInterval : d.autoSaveInterval,
    enableRichText: typeof s.enableRichText === 'boolean' ? s.enableRichText : d.enableRichText,
    defaultHeadingLevel: s.defaultHeadingLevel === 0 || s.defaultHeadingLevel === 1 ? s.defaultHeadingLevel : d.defaultHeadingLevel,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string');
  // 兼容旧错误写入（例如 Set 被序列化成 {}）
  return [];
}

function isRichTextContent(value: unknown): value is RichTextContent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<RichTextContent>;
  return v.type === 'doc' && Array.isArray(v.content);
}
