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
    expect(isCalculatorBuiltinWord('所有行')).toBe(true);
    // 合计/均值/最小值等由引擎 transformChineseFunctions 在函数调用位置翻译，
    // 但允许作为赋值左侧变量名使用
    expect(isCalculatorBuiltinWord('合计')).toBe(false);
    expect(isCalculatorBuiltinWord('均值')).toBe(false);
  });

  it('includes math.js functions added in review rounds', () => {
    expect(isCalculatorBuiltinWord('sinh')).toBe(true);
    expect(isCalculatorBuiltinWord('erf')).toBe(true);
    expect(isCalculatorBuiltinWord('gamma')).toBe(true);
    expect(isCalculatorBuiltinWord('normspdf')).toBe(true);
    expect(isCalculatorBuiltinWord('phi')).toBe(true);
    expect(isCalculatorBuiltinWord('let')).toBe(true);
  });

  it('list length stable for regression', () => {
    expect(CALCULATOR_BUILTIN_WORDS.length).toBeGreaterThanOrEqual(40);
  });
});
