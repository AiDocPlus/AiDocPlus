import { describe, it, expect } from 'vitest';
import { createCalculatorEngine } from './CalculatorEngine';

describe('CalculatorEngine', () => {
  it('defines and evaluates multi-character Chinese variable 现金股票 across lines', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r1 = engine.evaluate('现金股票 = 100', 1);
    expect(r1.type).toBe('number');
    expect(r1.value).toBe(100);
    const r2 = engine.evaluate('现金股票 + 1', 2);
    expect(r2.type).toBe('number');
    expect(r2.value).toBe(101);
  });

  it('normalizes fullwidth equals and strips zero-width characters', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('\u200b现金\uFF1D42', 1);
    expect(r.type).toBe('number');
    expect(r.value).toBe(42);
  });

  it('sum(所有行) aggregates numeric results from lines above current line', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    expect(engine.evaluate('10', 1).value).toBe(10);
    expect(engine.evaluate('20', 2).value).toBe(20);
    const r3 = engine.evaluate('sum(所有行)', 3);
    expect(r3.type).toBe('number');
    expect(r3.value).toBe(30);
  });

  it('sum(所有行) on first line is empty aggregate (sum([]) → 0)', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('sum(所有行)', 1);
    expect(r.type).toBe('number');
    expect(r.value).toBe(0);
  });

  it('sum(all lines) matches Chinese 所有行 semantics', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    engine.evaluate('3', 1);
    engine.evaluate('7', 2);
    const r = engine.evaluate('sum(all lines)', 3);
    expect(r.type).toBe('number');
    expect(r.value).toBe(10);
  });

  it('appends double-quoted segments to result display without affecting numeric value', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('10 "万"', 1);
    expect(r.type).toBe('number');
    expect(r.value).toBe(10);
    expect(r.displayValue.endsWith(' 万')).toBe(true);
    expect(r.displayValue.startsWith('10')).toBe(true);
  });

  it('does not treat quoted 万 as numeric multiplier (100 "万" stays 100)', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('100 "万"', 1);
    expect(r.value).toBe(100);
    expect(r.displayValue).toMatch(/100.*万/);
  });

  it('evaluates pmt() with expressions (math.js financial import)', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('pmt(0.01, 12, -1000)', 1);
    expect(r.type).toBe('number');
    expect(Number(r.value)).toBeGreaterThan(0);
    expect(Number.isFinite(Number(r.value))).toBe(true);
  });

  it('evaluates pmt with variables on prior lines', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    engine.evaluate('每期利率 = 0.01', 1);
    const r = engine.evaluate('pmt(每期利率, 12, -1000)', 2);
    expect(r.type).toBe('number');
    expect(Number(r.value)).toBeGreaterThan(0);
  });

  it('nper and rate invert pmt for fixed-rate loan', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const rPmt = engine.evaluate('pmt(0.01, 12, -1000)', 1);
    const pay = Number(rPmt.value);
    expect(Number.isFinite(pay)).toBe(true);
    // financial 约定：还本付息现金流 pmt 与示例一致时常为负，pv 为正
    const rNper = engine.evaluate(`nper(0.01, -${pay}, 1000)`, 2);
    expect(rNper.type).toBe('number');
    expect(Number(rNper.value)).toBeCloseTo(12, 4);
    const rRate = engine.evaluate(`rate(12, -${pay}, 1000, 0)`, 3);
    expect(rRate.type).toBe('number');
    expect(Number(rRate.value)).toBeCloseTo(0.01, 4);
  });

  it('evaluates ipmt and ppmt for period 1', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const rPmt = engine.evaluate('pmt(0.01, 12, -1000)', 1);
    const pay = Number(rPmt.value);
    const i = engine.evaluate(`ipmt(0.01, 1, 12, -1000)`, 2);
    const p = engine.evaluate(`ppmt(0.01, 1, 12, -1000)`, 3);
    expect(i.type).toBe('number');
    expect(p.type).toBe('number');
    expect(i.value + p.value).toBeCloseTo(pay, 6);
  });

  it('evaluates mirr with cash flow array', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('mirr([-1000, 300, 400, 500], 0.08, 0.1)', 1);
    expect(r.type).toBe('number');
    expect(Number.isFinite(Number(r.value))).toBe(true);
  });

  it('sequential template-style lines (mortgage snippet) evaluate without error', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const lines = [
      '贷款金额 = 1000000',
      '年利率 = 4.2%',
      '贷款年限 = 30',
      '月供 = pmt(年利率/12, 贷款年限*12, -贷款金额)',
      '总还款 = 月供 * 贷款年限 * 12',
    ];
    for (let i = 0; i < lines.length; i++) {
      const res = engine.evaluate(lines[i]!, i + 1);
      expect(res.type).not.toBe('error');
    }
  });

  it('inline pmt in DTI-style template evaluates', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('房贷月供 = pmt(4.2%/12, 30*12, -800000)', 1);
    expect(r.type).toBe('number');
    expect(Number(r.value)).toBeGreaterThan(0);
  });

  it('evaluates prod, atan2, quantileSeq from math.js', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    expect(Number(engine.evaluate('prod([2, 3, 4])', 1).value)).toBe(24);
    expect(Number(engine.evaluate('atan2(1, 0)', 2).value)).toBeCloseTo(Math.PI / 2, 5);
    expect(Number(engine.evaluate('quantileSeq([1, 2, 3, 4, 5], 0.5)', 3).value)).toBe(3);
  });

  it('evaluates tiered commission template expression', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const expr =
      'min(180000, 100000) * 0.03 + max(0, 180000 - 100000) * 0.06';
    const r = engine.evaluate(expr, 1);
    expect(r.type).toBe('number');
    expect(Number(r.value)).toBeCloseTo(7800, 4);
  });

  it('evaluates equities-style PE and DuPont lines', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    expect(Number(engine.evaluate('股价 = 20', 1).value)).toBe(20);
    expect(Number(engine.evaluate('EPS = 1.25', 2).value)).toBe(1.25);
    const pe = engine.evaluate('PE = 股价 / EPS', 3);
    expect(pe.type).toBe('number');
    expect(Number(pe.value)).toBeCloseTo(16, 4);
    engine.evaluate('净利率 = 12%', 4);
    engine.evaluate('资产周转率 = 0.85', 5);
    engine.evaluate('权益乘数 = 1.8', 6);
    const roe = engine.evaluate('ROE = 净利率 * 资产周转率 * 权益乘数', 7);
    expect(roe.type).toBe('number');
    expect(Number(roe.value)).toBeGreaterThan(0);
  });

  it('evaluates DCF sketch npv line', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('npv([12, 14, 16, 18, 216], 0.09)', 1);
    expect(r.type).toBe('number');
    expect(Number.isFinite(Number(r.value))).toBe(true);
  });

  it('getVariableDefinitionLines tracks last assignment line', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    engine.evaluate('x = 1', 1);
    engine.evaluate('x = 2', 5);
    expect(engine.getVariableDefinitionLines().x).toBe(5);
  });

  it('extractLineSemantics finds definitions and line refs', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    engine.evaluate('a = 10', 1);
    const sem = engine.extractLineSemantics('b = line 1 + 1', 2);
    expect(sem.definedVariables).toEqual(['b']);
    expect(sem.dependencies).toContain('line:1');
  });

  it('extractLineSemantics detects 所有行 token', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const sem = engine.extractLineSemantics('sum(所有行)', 3);
    expect(sem.dependencies).toContain('__all_lines__');
  });

  it('npv with empty cash flows yields NaN', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('npv([], 0.1)', 1);
    expect(r.type).toBe('number');
    expect(Number.isNaN(Number(r.value))).toBe(true);
  });

  it('irr with all same-sign flows yields NaN', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r = engine.evaluate('irr([1, 2, 3])', 1);
    expect(r.type).toBe('number');
    expect(Number.isNaN(Number(r.value))).toBe(true);
  });

  it('does not rewrite 均值 as mean on assignment LHS (变量名可含均值/最大值等)', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    engine.evaluate('数据 = [1, 2, 3]', 1);
    const r = engine.evaluate('均值 = mean(数据)', 2);
    expect(r.type).toBe('number');
    expect(Number(r.value)).toBeCloseTo(2, 5);
    expect(Number(engine.evaluate('均值 + 1', 3).value)).toBeCloseTo(3, 5);
  });

  it('stores array/matrix variables and supports sum/mean/std with Chinese name', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r1 = engine.evaluate('数据 = [12, 15, 18, 22, 25]', 1);
    expect(r1.type).toBe('matrix');
    expect(r1.displayValue).toMatch(/项/);
    expect(Number(engine.evaluate('sum(数据)', 2).value)).toBe(92);
    expect(Number(engine.evaluate('mean(数据)', 3).value)).toBeCloseTo(18.4, 5);
    expect(Number(engine.evaluate('median(数据)', 4).value)).toBe(18);
    expect(Number(engine.evaluate('std(数据)', 5).value)).toBeGreaterThan(0);
    expect(Number(engine.evaluate('min(数据)', 6).value)).toBe(12);
    expect(Number(engine.evaluate('max(数据)', 7).value)).toBe(25);
  });

  it('normalizes ideographic comma 、 in list literals for math.js', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r1 = engine.evaluate('数据 = [12、15、18、22]', 1);
    expect(r1.type).toBe('matrix');
    expect(Number(engine.evaluate('sum(数据)', 2).value)).toBe(67);
  });

  it('fullwidth comma in list is normalized via NFKC before evaluation', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r1 = engine.evaluate('数据 = [12，15，18]', 1);
    expect(r1.type).toBe('matrix');
    expect(Number(engine.evaluate('sum(数据)', 2).value)).toBe(45);
  });

  it('extractLineSemantics does not treat "line N" inside English words as row refs', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const sem = engine.extractLineSemantics('x = airline 12', 2);
    expect(sem.dependencies).not.toContain('line:12');
  });

  it('evaluates × ÷ · ‰ and thousands-separated numbers after normalization', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    expect(Number(engine.evaluate('3×4', 1).value)).toBe(12);
    expect(Number(engine.evaluate('12÷3', 2).value)).toBe(4);
    expect(Number(engine.evaluate('2·3', 3).value)).toBe(6);
    expect(Number(engine.evaluate('5‰', 4).value)).toBe(0.005);
    expect(Number(engine.evaluate('1,000+2,000', 5).value)).toBe(3000);
  });

  it('basic stats template: list assignment then sum/mean/median/std/min/max and range', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const lines = [
      ['// 基础统计', 1],
      ['数据 = [12, 15, 18, 22, 25, 28, 30, 33, 36, 40]', 2],
      ['总和 = sum(数据)', 3],
      ['均值 = mean(数据)', 4],
      ['中位数M = median(数据)', 5],
      ['标准差S = std(数据)', 6],
      ['最小值M = min(数据)', 7],
      ['最大值M = max(数据)', 8],
      ['极差J = 最大值M - 最小值M', 9],
    ] as const;
    for (const [expr, ln] of lines) {
      const res = engine.evaluate(expr, ln);
      expect(res.type, `line ${ln}: ${expr} -> ${res.error ?? ''}`).not.toBe('error');
    }
    expect(Number(engine.evaluate('总和', 99).value)).toBe(259);
    expect(Number(engine.evaluate('极差J', 99).value)).toBe(28);
  });

  it('evaluates xirr and XIRR aliases', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    const r1 = engine.evaluate('xirr([-1000, 1100], [0, 365])', 1);
    expect(r1.type).toBe('number');
    expect(Number(r1.value)).toBeCloseTo(0.1, 4);
    const r2 = engine.evaluate('XIRR([-1000, 1100], [0, 365])', 2);
    expect(r2.type).toBe('number');
    expect(Number(r2.value)).toBeCloseTo(0.1, 4);
  });

  it('list primitives: listAt (1-based), listSlice via assignment, listLen', () => {
    const engine = createCalculatorEngine();
    engine.clearVariables();
    engine.evaluate('数据 = [1, 2, 3]', 1);
    expect(Number(engine.evaluate('listAt(数据, 2)', 2).value)).toBe(2);
    const slice = engine.evaluate('切片 = listSlice(数据, 1, 2)', 3);
    expect(slice.type).toBe('matrix');
    expect(Number(engine.evaluate('listLen(数据)', 4).value)).toBe(3);
  });
});
