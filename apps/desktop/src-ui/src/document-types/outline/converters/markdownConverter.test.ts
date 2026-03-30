import { describe, it, expect } from 'vitest';
import { outlineToMarkdown, importFromMarkdown } from './markdownConverter';
import type { Outline } from '../types';

function mkOutline(): Outline {
  const now = new Date().toISOString();
  return {
    id: 'o1',
    title: '测试大纲',
    collapsedNodeIds: [],
    createdAt: now,
    updatedAt: now,
    nodes: [
      {
        id: 'n1',
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A #tag' }] }] },
        plainText: 'A #tag',
        tags: ['tag'],
        mentions: [],
        completed: true,
        expanded: true,
        headingLevel: 1,
        createdAt: now,
        updatedAt: now,
        notePlainText: 'note1',
        children: [
          {
            id: 'n1-1',
            content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
            plainText: 'B',
            tags: [],
            mentions: [],
            completed: false,
            expanded: true,
            headingLevel: 0,
            createdAt: now,
            updatedAt: now,
            children: [],
          },
        ],
      },
    ],
  };
}

describe('markdownConverter', () => {
  it('exports numbered list markdown when enabled', () => {
    const md = outlineToMarkdown(mkOutline(), {
      includeCompleted: true,
      includeNotes: true,
      numberedLists: true,
    });
    expect(md).toContain('# 测试大纲');
    expect(md).toMatch(/\n1\.\s+\[x\]\s+A/);
  });

  it('imports markdown into nodes', () => {
    const md = `# T\n\n- A\n  - B\n- C`;
    const o = importFromMarkdown(md);
    expect(o.title).toBe('T');
    // importFromMarkdown 会把标题行同时解析为一个节点（heading 格式）
    expect(o.nodes.length).toBe(3);
    expect(o.nodes[0]!.plainText).toBe('T');
    expect(o.nodes[1]!.plainText).toBe('A');
    expect(o.nodes[1]!.children[0]!.plainText).toBe('B');
  });
});

