import { describe, it, expect } from 'vitest';
import {
  parseCalculatorContent,
  normalizeCalcResult,
  normalizeCalculatorVariables,
  sheetVariablesFromEngine,
  resolveActiveSheetId,
  createEmptySheet,
} from './types';

describe('normalizeCalcResult', () => {
  it('treats null as error', () => {
    const r = normalizeCalcResult(null);
    expect(r.type).toBe('error');
    expect(r.error).toBeTruthy();
  });

  it('accepts valid number result', () => {
    const r = normalizeCalcResult({
      type: 'number',
      value: 3,
      displayValue: '3',
    });
    expect(r.type).toBe('number');
    expect(r.value).toBe(3);
  });

  it('maps unknown type to error', () => {
    const r = normalizeCalcResult({ type: 'bogus', value: 1, displayValue: '' });
    expect(r.type).toBe('error');
  });
});

describe('normalizeCalculatorVariables', () => {
  it('filters null entries and maps plain numbers', () => {
    const v = normalizeCalculatorVariables({
      a: null,
      b: 42,
      c: { name: 'c', value: 1, sourceLine: 2, type: 'number' },
    } as Record<string, unknown>);
    expect(v.a).toBeUndefined();
    expect(v.b?.value).toBe(42);
    expect(v.c?.sourceLine).toBe(2);
  });
});

describe('sheetVariablesFromEngine', () => {
  it('applies definition line map', () => {
    const v = sheetVariablesFromEngine({ x: 1 }, { x: 5 });
    expect(v.x?.sourceLine).toBe(5);
  });
});

describe('parseCalculatorContent', () => {
  it('normalizes sparse lines and fixes invalid activeSheetId', () => {
    const doc = parseCalculatorContent(
      JSON.stringify({
        version: 2,
        sheets: [
          {
            id: 's1',
            name: 'Main',
            lines: [{ expression: '100' }],
            variables: { bad: null },
            createdAt: '2020-01-01T00:00:00.000Z',
            updatedAt: '2020-01-01T00:00:00.000Z',
          },
        ],
        activeSheetId: 'missing-id',
        settings: {},
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      }),
    );
    expect(doc).not.toBeNull();
    expect(doc!.activeSheetId).toBe('s1');
    expect(doc!.sheets[0].lines[0].lineNumber).toBe(1);
    expect(doc!.sheets[0].lines[0].expression).toBe('100');
    expect(doc!.sheets[0].lines[0].lineRole).toBe('normal');
    expect(doc!.sheets[0].lines[0].id.length).toBeGreaterThan(0);
    expect(doc!.sheets[0].lines[0].definedVariables).toEqual([]);
    expect(Object.keys(doc!.sheets[0].variables).length).toBe(0);
  });

  it('uses empty sheet when sheets array empty', () => {
    const doc = parseCalculatorContent(
      JSON.stringify({
        version: 2,
        sheets: [],
        activeSheetId: '',
        settings: {},
        createdAt: 't',
        updatedAt: 't',
      }),
    );
    expect(doc!.sheets.length).toBe(1);
    expect(doc!.activeSheetId).toBe(doc!.sheets[0].id);
  });
});

describe('resolveActiveSheetId', () => {
  it('falls back to first sheet', () => {
    const a = createEmptySheet('A');
    const b = createEmptySheet('B');
    expect(resolveActiveSheetId([a, b], 'x')).toBe(a.id);
    expect(resolveActiveSheetId([a, b], b.id)).toBe(b.id);
  });
});
