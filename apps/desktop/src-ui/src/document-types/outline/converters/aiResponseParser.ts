/**
 * AI 响应解析器
 * 
 * 将 AI 生成的文本解析为大纲节点
 */

import type { OutlineHeadingLevel, OutlineNode } from '../types';
import {
  createRichTextFromPlain,
  extractTagsFromText,
  extractMentionsFromText,
  generateId,
} from '../types';

/**
 * 解析 AI 响应为节点数组
 * 支持多种格式：缩进列表、Markdown 标题、混合格式
 */
export function parseAIResponseToNodes(response: string): OutlineNode[] {
  const lines = response.split('\n').filter((l) => l.trim());

  if (lines.length === 0) return [];

  const hasHeadings = lines.some((l) => l.match(/^#{1,7}\s/));
  const hasListItems = lines.some((l) => l.match(/^\s*(?:[-*+]|\d+\.)\s/));

  if (hasHeadings && hasListItems) {
    return parseMixedFormat(lines);
  }

  if (hasHeadings) {
    return parseHeadingFormat(lines);
  }

  if (hasListItems) {
    return parseIndentedListFormat(lines);
  }

  return lines.map((text) => createNodeFromText(text.trim()));
}

/**
 * 解析标题格式（# ## ###）
 */
function parseHeadingFormat(lines: string[]): OutlineNode[] {
  const rootNodes: OutlineNode[] = [];
  const stack: { node: OutlineNode; level: number }[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,7})\s+(.+)$/);
    if (!match) continue;

    const level = match[1].length;
    const text = match[2].trim();

    const node = createNodeFromText(text, {
      headingLevel: Math.min(level, 7) as OutlineHeadingLevel,
    });

    // 确定父节点
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, level });
  }

  return rootNodes;
}

/**
 * 解析缩进列表格式
 */
function parseIndentedListFormat(lines: string[]): OutlineNode[] {
  const rootNodes: OutlineNode[] = [];
  const stack: { node: OutlineNode; depth: number }[] = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed) continue;

    const indentMatch = trimmed.match(/^(\s*)(?:[-*+]|\d+\.)\s+/);
    if (!indentMatch) continue;

    const indent = indentMatch[1].length;
    const depth = Math.floor(indent / 2);

    // 解析内容
    const content = trimmed.slice(indentMatch[0].length).trim();
    const completed = content.startsWith('[x] ') || content.startsWith('[X] ');
    const text = content.replace(/^\[[ xX]\]\s*/, '');

    const node = createNodeFromText(text, { completed });

    // 确定父节点
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, depth });
  }

  return rootNodes;
}

/**
 * 解析混合格式（标题 + 列表共存）：标题作为分组父节点，其下列表项作为子节点
 */
function parseMixedFormat(lines: string[]): OutlineNode[] {
  const rootNodes: OutlineNode[] = [];
  let currentParent: OutlineNode | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,7})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      currentParent = createNodeFromText(text, {
        headingLevel: Math.min(level, 7) as OutlineHeadingLevel,
      });
      rootNodes.push(currentParent);
      continue;
    }

    const listMatch = line.match(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.+)$/);
    if (listMatch) {
      const text = listMatch[1].trim().replace(/^\[[ xX]\]\s*/, '');
      const completed = /^\[xX]\]/.test(listMatch[0]);
      const node = createNodeFromText(text, { completed });
      if (currentParent) {
        currentParent.children.push(node);
      } else {
        rootNodes.push(node);
      }
      continue;
    }

    const trimmed = line.trim();
    if (trimmed) {
      const node = createNodeFromText(trimmed);
      if (currentParent) {
        currentParent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
  }

  return rootNodes;
}

/**
 * 从文本创建节点
 */
function createNodeFromText(
  text: string,
  options: {
    completed?: boolean;
    headingLevel?: OutlineHeadingLevel;
  } = {}
): OutlineNode {
  const { completed = false, headingLevel = 0 } = options;

  const now = new Date().toISOString();
  const content = createRichTextFromPlain(text);

  return {
    id: generateId(),
    content,
    plainText: text,
    tags: extractTagsFromText(text),
    mentions: extractMentionsFromText(text),
    completed,
    expanded: true,
    headingLevel,
    createdAt: now,
    updatedAt: now,
    children: [],
  };
}

/**
 * 验证 AI 响应是否可以解析为有效节点
 */
export function validateAIResponse(response: string): {
  valid: boolean;
  nodeCount: number;
  maxDepth: number;
} {
  const nodes = parseAIResponseToNodes(response);

  function getDepth(nodes: OutlineNode[], currentDepth = 1): number {
    if (nodes.length === 0) return currentDepth - 1;
    return Math.max(
      ...nodes.map((n) =>
        Math.max(currentDepth, getDepth(n.children, currentDepth + 1))
      )
    );
  }

  function countNodes(nodes: OutlineNode[]): number {
    return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
  }

  return {
    valid: nodes.length > 0,
    nodeCount: countNodes(nodes),
    maxDepth: getDepth(nodes),
  };
}
