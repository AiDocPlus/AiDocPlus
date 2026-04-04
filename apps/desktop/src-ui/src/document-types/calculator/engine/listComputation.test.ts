import { describe, it, expect } from 'vitest';
import {
  clampList,
  listArgSort,
  listAt,
  listIndexOf,
  listLookup,
  listRank,
  listRange,
  listSlice,
  rollMean,
  rollSum,
  MAX_LIST_ELEMENTS,
} from './listComputation';

describe('listComputation', () => {
  it('listAt is 1-based; out of range → NaN', () => {
    const a = [10, 20, 30];
    expect(listAt(a, 1)).toBe(10);
    expect(listAt(a, 3)).toBe(30);
    expect(Number.isNaN(listAt(a, 0))).toBe(true);
    expect(Number.isNaN(listAt(a, 4))).toBe(true);
  });

  it('listSlice is 1-based inclusive', () => {
    expect(listSlice([1, 2, 3, 4], 2, 3)).toEqual([2, 3]);
    expect(listSlice([1, 2, 3], 3, 1)).toEqual([]);
  });

  it('listRank uses average rank for ties (RANK.AVG style)', () => {
    expect(listRank([1, 3, 3, 2])).toEqual([1, 3.5, 3.5, 2]);
    expect(listRank([5, 5, 5])).toEqual([2, 2, 2]);
  });

  it('listRange supports negative step', () => {
    expect(listRange(3, 1, -1)).toEqual([3, 2, 1]);
    expect(listRange(5, 1, -2)).toEqual([5, 3, 1]);
  });

  it('listIndexOf and listLookup', () => {
    expect(listIndexOf(2, [1, 2, 3])).toBe(2);
    expect(Number.isNaN(listIndexOf(9, [1, 2, 3]))).toBe(true);
    expect(listLookup(2, [1, 2, 3], [10, 20, 30])).toBe(20);
    expect(Number.isNaN(listLookup(9, [1, 2], [10, 20]))).toBe(true);
  });

  it('listArgSort returns 1-based original positions in sort order', () => {
    expect(listArgSort([30, 10, 20])).toEqual([2, 3, 1]);
  });

  it('clampList truncates to MAX_LIST_ELEMENTS', () => {
    const long = Array.from({ length: MAX_LIST_ELEMENTS + 50 }, (_, i) => i);
    expect(clampList(long).length).toBe(MAX_LIST_ELEMENTS);
  });

  it('rollMean sliding window correctness', () => {
    const a = [1, 2, 3, 4, 5];
    const r = rollMean(a, 3);
    // Positions 0,1: not enough → NaN
    expect(Number.isNaN(r[0])).toBe(true);
    expect(Number.isNaN(r[1])).toBe(true);
    expect(r[2]).toBeCloseTo(2);   // (1+2+3)/3
    expect(r[3]).toBeCloseTo(3);   // (2+3+4)/3
    expect(r[4]).toBeCloseTo(4);   // (3+4+5)/3
  });

  it('rollSum sliding window correctness', () => {
    const a = [10, 20, 30, 40];
    const r = rollSum(a, 2);
    expect(Number.isNaN(r[0])).toBe(true);
    expect(r[1]).toBe(30);  // 10+20
    expect(r[2]).toBe(50);  // 20+30
    expect(r[3]).toBe(70);  // 30+40
  });

  it('rollMean/rollSum window of 1 returns original array', () => {
    const a = [3, 7, 2];
    expect(rollMean(a, 1)).toEqual([3, 7, 2]);
    expect(rollSum(a, 1)).toEqual([3, 7, 2]);
  });
});
