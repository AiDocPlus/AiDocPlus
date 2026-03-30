import { describe, it, expect } from 'vitest';
import { xnpv, xirr } from './financialCalculator';

describe('xnpv / xirr', () => {
  it('xnpv with rate 0 equals sum of cash flows', () => {
    const v = [-100, 50, 60];
    const d = [0, 100, 200];
    expect(xnpv(0, v, d)).toBeCloseTo(10, 10);
  });

  it('xirr for two-flow zero-NPV at r=0', () => {
    const r = xirr([-100, 100], [0, 365]);
    expect(r).toBeCloseTo(0, 5);
  });

  it('xirr approximates annual return for one-year payoff', () => {
    const r = xirr([-1000, 1100], [0, 365]);
    expect(r).toBeCloseTo(0.1, 4);
  });

  it('detects Unix ms date spacing as days', () => {
    const day = 86400000;
    const r = xirr([-1000, 1100], [0, 365 * day]);
    expect(r).toBeCloseTo(0.1, 4);
  });
});
