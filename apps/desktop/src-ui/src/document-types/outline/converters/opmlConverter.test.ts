import { describe, it, expect } from 'vitest';
import { exportToOPML, importFromOPML } from './opmlConverter';
import type { OutlineDocumentContent } from '../types';

describe('opmlConverter', () => {
  it('exports and imports OPML roundtrip (basic)', () => {
    const now = '2026-01-01T00:00:00.000Z';
    const data: OutlineDocumentContent = {
      version: 2,
      activeOutlineId: 'o1',
      createdAt: now,
      updatedAt: now,
      settings: {
        defaultExpandLevel: 2,
        showCompleted: 'all',
        showNotes: 'all',
        fontSize: 14,
        lineSpacing: 'normal',
        showGuideLines: true,
        autoSave: true,
        autoSaveInterval: 10,
        enableRichText: true,
        defaultHeadingLevel: 0,
      },
      outlines: [
        {
          id: 'o1',
          title: 'O1',
          collapsedNodeIds: [],
          createdAt: now,
          updatedAt: now,
          nodes: [
            {
              id: 'n1',
              content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
              plainText: 'A',
              tags: [],
              mentions: [],
              completed: true,
              expanded: true,
              headingLevel: 2,
              createdAt: now,
              updatedAt: now,
              notePlainText: 'note',
              children: [],
            },
          ],
        },
      ],
    };

    const opml = exportToOPML(data);
    expect(opml).toContain('<opml');
    expect(opml).toContain('O1');

    const imported = importFromOPML(opml);
    expect(imported.outlines.length).toBeGreaterThan(0);
    expect(imported.outlines[0]!.nodes[0]!.plainText).toBe('A');
    expect(imported.outlines[0]!.nodes[0]!.completed).toBe(true);
  });
});

