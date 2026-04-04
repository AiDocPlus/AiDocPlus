import { describe, it, expect } from 'vitest';
import {
  normalizeCalculatorInput,
  stripThousandsSeparators,
  normalizeCalculatorOperators,
  formatExpressionOperatorsForDisplay,
} from './calculatorInputNormalize';

describe('calculatorInputNormalize', () => {
  it('maps × ÷ and comparison Unicode to ASCII operators', () => {
    expect(normalizeCalculatorInput('3×4')).toBe('3*4');
    expect(normalizeCalculatorInput('12÷3')).toBe('12/3');
    expect(normalizeCalculatorInput('1≤2')).toBe('1<=2');
    expect(normalizeCalculatorOperators('a≥b')).toBe('a>=b');
    expect(normalizeCalculatorOperators('x≠y')).toBe('x!=y');
  });

  it('strips Western thousands separators only', () => {
    expect(stripThousandsSeparators('1,234.56')).toBe('1234.56');
    expect(normalizeCalculatorInput('1,000+2,000')).toBe('1000+2000');
    expect(normalizeCalculatorInput('[12, 15, 18]')).toBe('[12, 15, 18]');
  });

  it('preserves commas inside array brackets (no spaces)', () => {
    expect(stripThousandsSeparators('[100,234,567]')).toBe('[100,234,567]');
    expect(stripThousandsSeparators('sum([1,234])')).toBe('sum([1,234])');
    expect(stripThousandsSeparators('[1,234,567.89]')).toBe('[1,234,567.89]');
  });

  it('strips thousands outside brackets even with adjacent array', () => {
    expect(stripThousandsSeparators('1,234 + [100,200]')).toBe('1234 + [100,200]');
  });

  it('handles ‰ ‱ and middle dot between digits', () => {
    expect(normalizeCalculatorInput('5‰')).toBe('(5/1000)');
    expect(normalizeCalculatorInput('2‱')).toBe('(2/10000)');
    expect(normalizeCalculatorInput('3·4')).toBe('3*4');
  });

  it('handles 乘以 / 除以 phrasing', () => {
    expect(normalizeCalculatorInput('10 乘以 2')).toBe('10*2');
    expect(normalizeCalculatorInput('总价乘以1.1')).toBe('总价*1.1');
    expect(normalizeCalculatorInput('100 除以 4')).toBe('100/4');
  });

  it('formatExpressionOperatorsForDisplay maps * / to × ÷ in cjk mode', () => {
    expect(formatExpressionOperatorsForDisplay('3*4', 'ascii')).toBe('3*4');
    expect(formatExpressionOperatorsForDisplay('3*4', 'cjk')).toBe('3 × 4');
    expect(formatExpressionOperatorsForDisplay('2*3*4', 'cjk')).toBe('2 × 3 × 4');
    expect(formatExpressionOperatorsForDisplay('1*2*3*4*5*6*7*8*9*10', 'cjk')).toBe('1 × 2 × 3 × 4 × 5 × 6 × 7 × 8 × 9 × 10');
  });

  it('normalizes 乘以/除以 between identifiers without spaces', () => {
    expect(normalizeCalculatorInput('利润乘以税率')).toBe('利润*税率');
    expect(normalizeCalculatorInput('总价除以数量')).toBe('总价/数量');
  });
});
