/**
 * Markdown 转换器
 * 
 * 大纲与 Markdown 格式的双向转换
 */

import type { Outline, OutlineHeadingLevel, OutlineNode, RichTextContent } from '../types';
import {
  createEmptyNode,
  createRichTextFromPlain,
  extractTagsFromText,
  extractMentionsFromText,
  generateId,
  getPlainTextFromContent,
} from '../types';

/**
 * Markdown 导出选项
 */
export interface MarkdownExportOptions {
  includeCompleted?: boolean;      // 是否包含完成标记 [x]
  includeNotes?: boolean;          // 是否包含备注
  maxDepth?: number;               // 最大导出深度
  useHeadings?: boolean;           // 使用标题语法而非列表
  headingOffset?: number;          // 标题级别偏移
  numberedLists?: boolean;         // 使用有序列表（1. 2. 3.）
}

/**
 * 导出为 Markdown
 */
export function outlineToMarkdown(
  outline: Outline,
  options: MarkdownExportOptions = {}
): string {
  const {
    includeCompleted = true,
    includeNotes = true,
    maxDepth = Infinity,
    useHeadings = false,
    headingOffset = 0,
    numberedLists = false,
  } = options;

  let result = `# ${outline.title}\n\n`;

  if (useHeadings) {
    result += nodesToMarkdownHeadings(outline.nodes, headingOffset + 1, maxDepth);
  } else {
    result += nodesToMarkdownList(outline.nodes, 0, maxDepth, includeCompleted, includeNotes, numberedLists);
  }

  return result;
}

/**
 * 节点数组转 Markdown 列表
 */
function nodesToMarkdownList(
  nodes: OutlineNode[],
  depth: number,
  maxDepth: number,
  includeCompleted: boolean,
  includeNotes: boolean,
  numberedLists: boolean
): string {
  if (depth >= maxDepth) return '';

  const indent = '  '.repeat(depth);
  let numberedIndex = 1;

  return nodes.map(node => {
    const check = includeCompleted && node.completed ? '[x] ' : '';
    const prefix = numberedLists ? `${numberedIndex++}. ` : '- ';
    const richText = nodeContentToMarkdown(node.content);
    const displayText = richText || node.plainText;
    let line = `${indent}${prefix}${check}${displayText}`;

    // 添加备注（HTML 注释格式）
    if (includeNotes && node.notePlainText) {
      line += ` <!-- ${escapeHtmlComment(node.notePlainText)} -->`;
    }

    // 递归处理子节点
    if (node.children.length > 0 && depth + 1 < maxDepth) {
      line += '\n' + nodesToMarkdownList(
        node.children,
        depth + 1,
        maxDepth,
        includeCompleted,
        includeNotes,
        numberedLists
      );
    }

    return line;
  }).join('\n');
}

/**
 * 节点数组转 Markdown 标题
 */
function nodesToMarkdownHeadings(
  nodes: OutlineNode[],
  level: number,
  maxDepth: number
): string {
  if (level > 6 || level > maxDepth) return '';

  const heading = '#'.repeat(level);

  return nodes.map(node => {
    const richText = nodeContentToMarkdown(node.content);
    const displayText = richText || node.plainText;
    let result = `${heading} ${displayText}\n`;

    if (node.notePlainText) {
      result += `\n${node.notePlainText}\n`;
    }

    if (node.children.length > 0) {
      result += '\n' + nodesToMarkdownHeadings(node.children, level + 1, maxDepth);
    }

    return result;
  }).join('\n');
}

/**
 * 转义 HTML 注释中的特殊字符
 */
function escapeHtmlComment(text: string): string {
  return text.replace(/-->/g, '--&gt;');
}

/**
 * 从 Markdown 导入
 */
export function importFromMarkdown(markdown: string): Outline {
  const lines = markdown.split('\n');
  const rootNodes: OutlineNode[] = [];
  const stack: { node: OutlineNode; level: number }[] = [];

  // 提取标题
  let title = '导入的大纲';
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed) continue;

    // 解析标题格式（# ## ###）
    const headingMatch = trimmed.match(/^(#{1,7})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();

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
      continue;
    }

    // 解析列表格式（- * + 或 1.）
    const listMatch = trimmed.match(/^(\s*)(?:[-*+]|\d+\.)\s+(?:\[([ x])\]\s+)?(.+)$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const completed = listMatch[2] === 'x';
      const text = listMatch[3].trim();

      // 解析备注（HTML 注释格式）
      const noteMatch = text.match(/(.+?)\s*<!--\s*(.+?)\s*-->$/);
      const mainText = noteMatch ? noteMatch[1].trim() : text;
      const note = noteMatch ? noteMatch[2].trim() : undefined;

      const level = Math.floor(indent / 2) + 1;
      const node = createNodeFromText(mainText, { completed, note });

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
  }

  return {
    id: generateId(),
    title,
    nodes: rootNodes,
    collapsedNodeIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 从文本创建节点
 */
function createNodeFromText(
  text: string,
  options: {
    completed?: boolean;
    note?: string;
    headingLevel?: OutlineHeadingLevel;
  } = {}
): OutlineNode {
  const { completed = false, note, headingLevel = 0 } = options;

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [],
    ...(note && {
      note: createRichTextFromPlain(note),
      notePlainText: note,
    }),
  };
}

/**
 * 大纲数组转 Markdown
 */
export function outlinesToMarkdown(
  outlines: Outline[],
  options: MarkdownExportOptions = {}
): string {
  return outlines
    .map((outline, index) => {
      const md = outlineToMarkdown(outline, options);
      if (index > 0) {
        return '\n---\n\n' + md;
      }
      return md;
    })
    .join('\n');
}

/**
 * 从 Markdown 导入多大纲
 */
export function importOutlinesFromMarkdown(markdown: string): Outline[] {
  // 使用 --- 分隔符分割多个大纲
  const sections = markdown.split(/^\s*---\s*$/m);

  return sections
    .map((section) => section.trim())
    .filter((section) => section.length > 0)
    .map((section) => importFromMarkdown(section));
}

/**
 * 节点数组转 Markdown 文本（简化版）
 */
export function nodesToMarkdown(nodes: OutlineNode[], depth = 0): string {
  const indent = '  '.repeat(depth);
  return nodes
    .map((n) => {
      const check = n.completed ? '[x] ' : '';
      const line = `${indent}- ${check}${n.plainText}`;
      const children =
        n.children.length > 0 ? '\n' + nodesToMarkdown(n.children, depth + 1) : '';
      return line + children;
    })
    .join('\n');
}

/**
 * 提取分支为 Markdown
 */
export function extractBranchAsMarkdown(node: OutlineNode): string {
  return nodesToMarkdown([node], 0);
}

/**
 * 将节点内容转为 Markdown 格式文本
 */
export function nodeContentToMarkdown(content: RichTextContent): string {
  if (!content.content || content.content.length === 0) return '';

  return content.content
    .map((p) => {
      if (!p.content) return '';
      return p.content
        .map((node) => {
          if (node.type === 'text') {
            let text = node.text;
            if (node.marks) {
              for (const mark of node.marks) {
                switch (mark.type) {
                  case 'bold':
                    text = `**${text}**`;
                    break;
                  case 'italic':
                    text = `*${text}*`;
                    break;
                  case 'underline':
                    text = `<u>${text}</u>`;
                    break;
                  case 'strike':
                    text = `~~${text}~~`;
                    break;
                  case 'highlight':
                  case 'colorHighlight':
                    text = `==${text}==`;
                    break;
                }
              }
            }
            return text;
          }
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
