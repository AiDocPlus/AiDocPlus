import { describe, it, expect } from 'vitest';
import {
  buildCalculatorSyntaxSummaryForAI,
  CALCULATOR_FUNCTION_CATEGORIES,
  getAllCalculatorFunctions,
} from './calculatorFunctionCatalog';
import { CALCULATOR_BUILTIN_WORDS } from './calculatorBuiltinWords';

describe('buildCalculatorSyntaxSummaryForAI', () => {
  it('includes list section and key anchors', () => {
    const s = buildCalculatorSyntaxSummaryForAI(8000);
    expect(s).toContain('【列表】');
    expect(s).toContain('listLen');
    expect(s).toContain('Excel/WPS');
  });

  it('includes at least one spreadsheet-style entry name', () => {
    const s = buildCalculatorSyntaxSummaryForAI(8000);
    expect(s).toMatch(/SUM|XNPV/i);
  });

  it('full summary fits when maxLen is large (smoke)', () => {
    const s = buildCalculatorSyntaxSummaryForAI(50000);
    expect(s.length).toBeGreaterThan(3000);
    expect(s.endsWith('…(truncated)')).toBe(false);
  });
});

describe('CALCULATOR_FUNCTION_CATEGORIES', () => {
  it('includes list category aligned with fnCategory.list', () => {
    const ids = CALCULATOR_FUNCTION_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('list');
    const listCat = CALCULATOR_FUNCTION_CATEGORIES.find((c) => c.id === 'list');
    expect(listCat?.labelKey).toBe('calculator.fnCategory.list');
  });
});

describe('builtin words vs catalog (list primitives)', () => {
  const lower = new Set(CALCULATOR_BUILTIN_WORDS.map((w) => w.toLowerCase()));

  it('registers list* names that appear in catalog entries', () => {
    const names = getAllCalculatorFunctions()
      .map((f) => f.nameEn)
      .filter((n) => /^list/i.test(n) || n === 'rollMean' || n === 'rollSum');
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      expect(lower.has(n.toLowerCase())).toBe(true);
    }
  });
});
