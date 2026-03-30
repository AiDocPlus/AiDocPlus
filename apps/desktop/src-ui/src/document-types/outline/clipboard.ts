import type { OutlineNode } from './types';
import { normalizeNode } from './types';
import { outlineToMarkdown } from './converters/markdownConverter';
import { outlineToOPML } from './converters/opmlConverter';

type OutlineClipboardPayload = {
  kind: 'aidocplus-outline-subtree';
  version: 1;
  format: 'json+markdown+opml';
  nodes: OutlineNode[];
  markdown: string;
  opml: string;
};

export async function writeOutlineSubtreeToClipboard(
  title: string,
  nodes: OutlineNode[]
): Promise<void> {
  const markdown = outlineToMarkdown(
    {
      id: 'clipboard',
      title,
      nodes,
      collapsedNodeIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { includeNotes: true }
  );
  const opml = outlineToOPML({
    id: 'clipboard',
    title,
    nodes,
    collapsedNodeIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const payload: OutlineClipboardPayload = {
    kind: 'aidocplus-outline-subtree',
    version: 1,
    format: 'json+markdown+opml',
    nodes,
    markdown,
    opml,
  };
  const json = JSON.stringify(payload, null, 2);

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      'application/x-aidocplus-outline+json': new Blob([json], {
        type: 'application/json',
      }),
      'text/plain': new Blob([markdown], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return;
  }

  await navigator.clipboard.writeText(json);
}

export function parseOutlineClipboardPayload(text: string): OutlineNode[] | null {
  try {
    const parsed = JSON.parse(text) as Partial<OutlineClipboardPayload>;
    if (
      parsed.kind !== 'aidocplus-outline-subtree' ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.nodes)
    ) {
      return null;
    }
    return parsed.nodes.map((n) => normalizeNode(n));
  } catch {
    return null;
  }
}
