import type { OutlineNode } from '../types';
import { createEmptyNode, generateId, normalizeNode } from '../types';
import { importFromMarkdown } from './markdownConverter';
import { importFromOPML, validateOPML } from './opmlConverter';
import { parseAIResponseToNodes } from './aiResponseParser';

export type OutlineImportFormat = 'markdown' | 'opml' | 'json' | 'indented' | 'ai-response';

type ClipboardPayload = {
  kind: 'aidocplus-outline-subtree';
  version: 1;
  format: 'json+markdown+opml';
  nodes: unknown[];
};

export function parseOutlineImport(
  format: OutlineImportFormat,
  text: string
): { nodes: OutlineNode[]; error?: string } {
  try {
    switch (format) {
      case 'markdown':
        return { nodes: importFromMarkdown(text).nodes };
      case 'opml': {
        const v = validateOPML(text);
        if (!v.valid) return { nodes: [], error: v.error || 'OPML 解析失败' };
        const data = importFromOPML(text);
        if (data.outlines.length === 0) return { nodes: [] };
        if (data.outlines.length === 1) return { nodes: data.outlines[0]!.nodes };
        return {
          nodes: data.outlines.map((o) => ({
            ...createEmptyNode(),
            id: generateId(),
            plainText: o.title,
            content: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: o.title }] }],
            },
            children: o.nodes,
          })),
        };
      }
      case 'json': {
        const data = JSON.parse(text);
        const rawArr: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray((data as { nodes?: unknown[] })?.nodes)
            ? (data as { nodes: unknown[] }).nodes
            : [];
        return { nodes: rawArr.map((item) => normalizeNode(item)) };
      }
      case 'indented':
        return { nodes: parseIndented(text) };
      case 'ai-response':
        return { nodes: parseAIResponseToNodes(text) };
      default:
        return { nodes: [], error: '不支持的导入格式' };
    }
  } catch (error) {
    return {
      nodes: [],
      error: error instanceof Error ? error.message : '解析失败',
    };
  }
}

export function parseClipboardOutlineText(
  text: string
): { nodes: OutlineNode[]; format: OutlineImportFormat; error?: string } {
  const custom = parseCustomClipboardPayload(text);
  if (custom) return { nodes: custom, format: 'json' };

  const opmlTry = parseOutlineImport('opml', text);
  if (!opmlTry.error && opmlTry.nodes.length > 0) return { nodes: opmlTry.nodes, format: 'opml' };

  const jsonTry = parseOutlineImport('json', text);
  if (!jsonTry.error && jsonTry.nodes.length > 0) return { nodes: jsonTry.nodes, format: 'json' };

  const mdTry = parseOutlineImport('markdown', text);
  if (!mdTry.error && mdTry.nodes.length > 0) return { nodes: mdTry.nodes, format: 'markdown' };

  const aiTry = parseOutlineImport('ai-response', text);
  if (!aiTry.error && aiTry.nodes.length > 0) return { nodes: aiTry.nodes, format: 'ai-response' };

  const indentedTry = parseOutlineImport('indented', text);
  if (!indentedTry.error && indentedTry.nodes.length > 0) return { nodes: indentedTry.nodes, format: 'indented' };

  return {
    nodes: [],
    format: 'markdown',
    error: '未识别到可导入的大纲结构，请检查内容格式',
  };
}

function parseCustomClipboardPayload(text: string): OutlineNode[] | null {
  try {
    const parsed = JSON.parse(text) as Partial<ClipboardPayload>;
    if (
      parsed.kind !== 'aidocplus-outline-subtree' ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.nodes)
    ) {
      return null;
    }
    return parsed.nodes.map((item) => normalizeNode(item));
  } catch {
    return null;
  }
}

function parseIndented(text: string): OutlineNode[] {
  const lines = text.split('\n');
  const rootNodes: OutlineNode[] = [];
  const nodeStack: { node: OutlineNode; indent: number }[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let indent = 0;
    for (const char of line) {
      if (char === '\t') indent += 1;
      else if (char === ' ') indent += 0.5;
      else break;
    }
    const depth = Math.floor(indent);

    const node: OutlineNode = {
      ...createEmptyNode(),
      id: generateId(),
      plainText: trimmedLine,
    };

    while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].indent >= depth) {
      nodeStack.pop();
    }

    if (nodeStack.length === 0) {
      rootNodes.push(node);
    } else {
      nodeStack[nodeStack.length - 1].node.children.push(node);
    }
    nodeStack.push({ node, indent: depth });
  }

  return rootNodes;
}
