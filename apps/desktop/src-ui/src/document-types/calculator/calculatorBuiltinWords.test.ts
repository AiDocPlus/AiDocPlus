import { describe, it, expect } from 'vitest';
import {
  CALCULATOR_BUILTIN_WORDS,
  isCalculatorBuiltinWord,
} from './calculatorBuiltinWords';

describe('calculatorBuiltinWords', () => {
  it('marks rate and financial names as builtin', () => {
    expect(isCalculatorBuiltinWord('rate')).toBe(true);
    expect(isCalculatorBuiltinWord('npv')).toBe(true);
    expect(isCalculatorBuiltinWord('RATE')).toBe(true);
  });

  it('allows typical user variable names', () => {
    expect(isCalculatorBuiltinWord('股价')).toBe(false);
    expect(isCalculatorBuiltinWord('PE')).toBe(false);
    expect(isCalculatorBuiltinWord('x1')).toBe(false);
  });

  it('includes Chinese aggregate tokens', () => {
    expect(isCalculatorBuiltinWord('合计')).toBe(true);
    expect(isCalculatorBuiltinWord('所有行')).toBe(true);
  });

  it('list length stable for regression', () => {
    expect(CALCULATOR_BUILTIN_WORDS.length).toBeGreaterThanOrEqual(40);
  });
});
