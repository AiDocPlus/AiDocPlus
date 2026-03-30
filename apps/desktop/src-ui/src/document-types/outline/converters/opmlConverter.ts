/**
 * OPML 转换器
 * 
 * 大纲处理标记语言（Outline Processor Markup Language）
 * 标准格式导入导出，兼容 Workflowy、Dynalist、幕布
 */

import type { Outline, OutlineDocumentContent, OutlineNode, RichTextContent } from '../types';
import {
  createDefaultSettings,
  createRichTextFromPlain,
  extractTagsFromText,
  extractMentionsFromText,
  generateId,
  getPlainTextFromContent,
  normalizeOutlineHeadingLevel,
} from '../types';

/**
 * 导出为 OPML 格式
 */
export function exportToOPML(data: OutlineDocumentContent): string {
  const outlines = data.outlines.map((outline) => {
    const body = outline.nodes.map((node) => nodeToOPML(node, 2)).join('\n');
    return `  <outline text="${escapeXml(outline.title)}">\n${body}\n  </outline>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(data.outlines[0]?.title || 'Untitled')}</title>
    <dateCreated>${data.createdAt}</dateCreated>
    <dateModified>${data.updatedAt}</dateModified>
    <generator>AiDocPlus Outline</generator>
    <docs>https://github.com/AiDocPlus/AiDocPlus</docs>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

/**
 * 节点转 OPML
 */
function nodeToOPML(node: OutlineNode, depth: number): string {
  const indent = '  '.repeat(depth);
  const attributes = [
    `text="${escapeXml(node.plainText)}"`,
    node.completed ? 'completed="true"' : '',
    node.colorHighlight ? `color="${escapeXml(node.colorHighlight)}"` : '',
    node.notePlainText ? `note="${escapeXml(node.notePlainText)}"` : '',
    node.headingLevel > 0 ? `heading="${node.headingLevel}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (node.children.length === 0) {
    return `${indent}<outline ${attributes} />`;
  }

  const children = node.children
    .map((child) => nodeToOPML(child, depth + 1))
    .join('\n');
  return `${indent}<outline ${attributes}>\n${children}\n${indent}</outline>`;
}

/**
 * 从 OPML 导入
 */
export function importFromOPML(opml: string): OutlineDocumentContent {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opml, 'text/xml');

  // 检查解析错误
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('OPML 解析失败：无效的 XML 格式');
  }

  const head = doc.querySelector('head');
  const body = doc.querySelector('body');

  if (!body) {
    throw new Error('OPML 解析失败：缺少 body 元素');
  }

  const title =
    head?.querySelector('title')?.textContent || '导入的大纲';
  const dateCreated =
    head?.querySelector('dateCreated')?.textContent ||
    new Date().toISOString();

  // 解析所有 outline 元素
  const topLevelOutlines = Array.from(body.children).filter(
    (el) => el.tagName === 'outline'
  );

  // 如果只有一个顶层 outline，作为单个大纲导入
  // 如果有多个，作为多个大纲导入
  const outlines: Outline[] = topLevelOutlines.map((el, index) => ({
    id: generateId(),
    title:
      index === 0
        ? title
        : el.getAttribute('text') || `大纲 ${index + 1}`,
    nodes: Array.from(el.children)
      .filter((child) => child.tagName === 'outline')
      .map((child) => opmlElementToNode(child)),
    collapsedNodeIds: [],
    createdAt: dateCreated,
    updatedAt: new Date().toISOString(),
  }));

  return {
    version: 2,
    outlines,
    activeOutlineId: outlines[0]?.id || '',
    settings: createDefaultSettings(),
    createdAt: dateCreated,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * OPML 元素转节点
 */
function opmlElementToNode(element: Element): OutlineNode {
  const text = element.getAttribute('text') || '';
  const completed = element.getAttribute('completed') === 'true';
  const color = element.getAttribute('color') || undefined;
  const note = element.getAttribute('note') || undefined;
  const headingLevel = normalizeOutlineHeadingLevel(
    parseInt(element.getAttribute('heading') || '0', 10)
  );

  const content = createRichTextFromPlain(text);
  const now = new Date().toISOString();

  return {
    id: generateId(),
    content,
    plainText: text,
    tags: extractTagsFromText(text),
    mentions: extractMentionsFromText(text),
    ...(note && {
      note: createRichTextFromPlain(note),
      notePlainText: note,
    }),
    completed,
    expanded: true,
    headingLevel,
    colorHighlight: color,
    createdAt: now,
    updatedAt: now,
    children: Array.from(element.children)
      .filter((child) => child.tagName === 'outline')
      .map((child) => opmlElementToNode(child)),
  };
}

/**
 * 转义 XML 特殊字符
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 验证 OPML 格式
 */
export function validateOPML(opml: string): { valid: boolean; error?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(opml, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return { valid: false, error: '无效的 XML 格式' };
    }

    const opmlElement = doc.querySelector('opml');
    if (!opmlElement) {
      return { valid: false, error: '缺少 opml 根元素' };
    }

    const version = opmlElement.getAttribute('version');
    if (!version) {
      return { valid: false, error: '缺少 version 属性' };
    }

    const body = doc.querySelector('body');
    if (!body) {
      return { valid: false, error: '缺少 body 元素' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

/**
 * 导出单个大纲为 OPML
 */
export function outlineToOPML(outline: Outline): string {
  const data: OutlineDocumentContent = {
    version: 2,
    outlines: [outline],
    activeOutlineId: outline.id,
    settings: createDefaultSettings(),
    createdAt: outline.createdAt,
    updatedAt: outline.updatedAt,
  };
  return exportToOPML(data);
}

/**
 * 从 OPML 文件内容提取标题
 */
export function extractOPMLTitle(opml: string): string | null {
  const match = opml.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1] : null;
}
