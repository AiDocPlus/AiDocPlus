import { describe, it, expect } from 'vitest';
import {
  normsdist,
  normsinv,
  normdist,
  normSdist,
  slope,
  intercept,
  rsq,
} from './statSpreadsheetFunctions';

describe('statSpreadsheetFunctions', () => {
  it('normsdist(0)=0.5', () => {
    expect(normsdist(0)).toBeCloseTo(0.5, 8);
  });

  it('normsinv(0.5)=0', () => {
    expect(normsinv(0.5)).toBeCloseTo(0, 6);
  });

  it('normdist CDF vs PDF', () => {
    expect(normdist(0, 0, 1, 1)).toBeCloseTo(0.5, 6);
    expect(normdist(0, 0, 1, 0)).toBeCloseTo(normSdist(0, 0), 8);
  });

  it('slope and intercept on y=2x+1', () => {
    const x = [0, 1, 2, 3];
    const y = [1, 3, 5, 7];
    expect(slope(y, x)).toBeCloseTo(2, 8);
    expect(intercept(y, x)).toBeCloseTo(1, 8);
    expect(rsq(y, x)).toBeCloseTo(1, 8);
  });
});
