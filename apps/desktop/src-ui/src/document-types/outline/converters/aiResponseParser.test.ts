import { describe, it, expect } from 'vitest';
import { parseAIResponseToNodes, validateAIResponse } from './aiResponseParser';

describe('aiResponseParser', () => {
  it('parses heading format', () => {
    const nodes = parseAIResponseToNodes(`# A\n## B\n## C\n### D`);
    expect(nodes.length).toBe(1);
    expect(nodes[0]!.plainText).toBe('A');
    expect(nodes[0]!.children.length).toBe(2);
    expect(nodes[0]!.children[0]!.plainText).toBe('B');
    expect(nodes[0]!.children[1]!.children[0]!.plainText).toBe('D');
  });

  it('parses indented list format', () => {
    const nodes = parseAIResponseToNodes(`- A\n  - B\n- C`);
    expect(nodes.length).toBe(2);
    expect(nodes[0]!.children[0]!.plainText).toBe('B');
  });

  it('validates response node count', () => {
    const v = validateAIResponse(`- A\n  - B\n- C`);
    expect(v.valid).toBe(true);
    expect(v.nodeCount).toBe(3);
  });
});

