import { describe, expect, it } from 'vitest';
import { parseClipboardOutlineText, parseOutlineImport } from './importParsers';

describe('importParsers', () => {
  it('parses custom structured clipboard payload', () => {
    const payload = JSON.stringify({
      kind: 'aidocplus-outline-subtree',
      version: 1,
      format: 'json+markdown+opml',
      nodes: [
        {
          id: 'n1',
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
          plainText: 'A',
          tags: [],
          mentions: [],
          completed: false,
          expanded: true,
          headingLevel: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          children: [],
        },
      ],
    });
    const parsed = parseClipboardOutlineText(payload);
    expect(parsed.error).toBeUndefined();
    expect(parsed.nodes.length).toBe(1);
    expect(parsed.nodes[0]?.plainText).toBe('A');
  });

  it('parses markdown import with stable contract', () => {
    const parsed = parseOutlineImport('markdown', '# T\n\n- A\n  - B');
    expect(parsed.error).toBeUndefined();
    expect(parsed.nodes.length).toBeGreaterThan(0);
  });

  it('returns explainable error for invalid opml', () => {
    const parsed = parseOutlineImport('opml', '<xml><broken>');
    expect(parsed.nodes).toEqual([]);
    expect(parsed.error).toBeTruthy();
  });
});
