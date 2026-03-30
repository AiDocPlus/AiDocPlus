import { describe, expect, it } from 'vitest';
import { insertNodeAtPath, removeNodeFromTree, swapSiblingNodesAtPath, type OutlineNode } from './types';

function mkNode(id: string, text: string, children: OutlineNode[] = []): OutlineNode {
  const now = new Date().toISOString();
  return {
    id,
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
    plainText: text,
    tags: [],
    mentions: [],
    completed: false,
    expanded: true,
    headingLevel: 0,
    createdAt: now,
    updatedAt: now,
    children,
  };
}

describe('outline tree immutable operations', () => {
  it('moves sibling up immutably', () => {
    const nodes = [mkNode('a', 'A'), mkNode('b', 'B'), mkNode('c', 'C')];
    const next = swapSiblingNodesAtPath(nodes, [], 2, 'up');
    expect(next.map((n) => n.id)).toEqual(['a', 'c', 'b']);
    expect(nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('removes by id then inserts at path', () => {
    const nodes = [mkNode('a', 'A'), mkNode('b', 'B'), mkNode('c', 'C')];
    const moved = nodes[0]!;
    const removed = removeNodeFromTree(nodes, 'a');
    const next = insertNodeAtPath(removed, [], 2, moved);
    expect(next.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });
});
