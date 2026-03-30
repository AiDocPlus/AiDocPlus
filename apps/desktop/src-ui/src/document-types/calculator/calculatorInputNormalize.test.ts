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
  });
});
