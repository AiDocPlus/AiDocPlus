import { describe, it, expect } from 'vitest';
import { computeSheetLinesSequential, sumSectionNumericResults } from './calculatorCompute';
import type { CalculatorLine } from './types';
import { createLineFromExpression } from './types';

function num(n: number): CalculatorLine['result'] {
  return { type: 'number', value: n, displayValue: String(n) };
}

describe('sumSectionNumericResults', () => {
  it('sums only normal finite number rows in range', () => {
    const built: CalculatorLine[] = [
      { ...createLineFromExpression('10', 1, 'soulver'), result: num(10) },
      { ...createLineFromExpression('// x', 2, 'soulver'), result: { type: 'string', value: '// x', displayValue: '' } },
      { ...createLineFromExpression('20', 3, 'soulver'), result: num(20) },
    ];
    expect(sumSectionNumericResults(built, -1, 3)).toBe(30);
  });
});

describe('computeSheetLinesSequential', () => {
  const optsBase = {
    evaluateNormalLine: (expression: string, _ln: number) => {
      const t = expression.trim();
      const n = Number(t);
      if (t && Number.isFinite(n)) return { type: 'number' as const, value: n, displayValue: t };
      return { type: 'error' as const, value: null, displayValue: '', error: 'bad' };
    },
    extractSemantics: () => ({ definedVariables: [] as string[], dependencies: [] as string[] }),
    formatSubtotalDisplay: (s: number) => `Σ${s}`,
    nowIso: () => 't',
  };

  it('subtotal sums normals after heading until self (Soulver)', () => {
    const lines: CalculatorLine[] = [
      createLineFromExpression('# A', 1, 'soulver'),
      createLineFromExpression('10', 2, 'soulver'),
      createLineFromExpression('20', 3, 'soulver'),
      createLineFromExpression('小计', 4, 'soulver'),
    ];
    const out = computeSheetLinesSequential(lines, {
      ...optsBase,
      hashBehavior: 'soulver',
    });
    expect(out[0].lineRole).toBe('heading');
    expect(out[3].lineRole).toBe('subtotal');
    expect(out[3].result.type).toBe('number');
    expect(out[3].result.value).toBe(30);
    expect(out[3].dependencies).toContain('__section_total__');
  });

  it('leading subtotal yields zero', () => {
    const lines: CalculatorLine[] = [createLineFromExpression('小计', 1, 'soulver')];
    const out = computeSheetLinesSequential(lines, {
      ...optsBase,
      hashBehavior: 'soulver',
    });
    expect(out[0].result.type).toBe('number');
    expect(out[0].result.value).toBe(0);
  });

  it('legacy mode treats # as comment not heading boundary', () => {
    const lines: CalculatorLine[] = [
      createLineFromExpression('# sec', 1, 'legacy'),
      createLineFromExpression('5', 2, 'legacy'),
      createLineFromExpression('小计', 3, 'legacy'),
    ];
    const out = computeSheetLinesSequential(lines, {
      ...optsBase,
      hashBehavior: 'legacy',
    });
    expect(out[0].lineRole).toBe('comment');
    expect(out[2].result.type).toBe('number');
    expect(out[2].result.value).toBe(5);
  });
});
