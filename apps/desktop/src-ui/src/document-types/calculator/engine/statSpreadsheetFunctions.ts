/**
 * 统计与回归（对齐 Excel / WPS 常用名）：正态分布、简单线性回归
 */
import { erf } from 'mathjs';

const SQRT2PI = Math.sqrt(2 * Math.PI);

function toNumErf(z: number): number {
  return Number(erf(z));
}

/** 标准正态累积分布 Φ(z) */
export function normsdist(z: number): number {
  return 0.5 * (1 + toNumErf(z / Math.SQRT2));
}

/** 标准正态概率密度 φ(z) */
export function normspdf(z: number): number {
  return Math.exp(-0.5 * z * z) / SQRT2PI;
}

/** 一般正态概率密度 */
export function normdistPdf(x: number, mean: number, sd: number): number {
  if (!(sd > 0) || !Number.isFinite(sd)) return Number.NaN;
  const u = (x - mean) / sd;
  return Math.exp(-0.5 * u * u) / (sd * SQRT2PI);
}

/**
 * NORM.DIST(x, mean, sd, cumulative) — cumulative 非 0 为真时返回 CDF
 */
export function normdist(x: number, mean: number, sd: number, cumulative: number): number {
  if (!(sd > 0) || !Number.isFinite(sd)) return Number.NaN;
  const cum = Number(cumulative) !== 0;
  if (!cum) {
    return normdistPdf(x, mean, sd);
  }
  return normsdist((x - mean) / sd);
}

/**
 * NORM.S.DIST(z, cumulative) — cumulative 为 0 时返回 PDF
 */
export function normSdist(z: number, cumulative: number = 1): number {
  const cum = Number(cumulative) !== 0;
  return cum ? normsdist(z) : normspdf(z);
}

/** 标准正态分位数 Φ⁻¹(p)，p∈(0,1) */
export function normsinv(p: number): number {
  if (!(p > 0 && p < 1) || !Number.isFinite(p)) return Number.NaN;
  let lo = -10;
  let hi = 10;
  if (normsdist(lo) > p) {
    while (normsdist(lo) > p && lo > -1e10) lo *= 2;
  }
  if (normsdist(hi) < p) {
    while (normsdist(hi) < p && hi < 1e10) hi *= 2;
  }
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const c = normsdist(mid);
    if (Math.abs(c - p) < 1e-14) return mid;
    if (c < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function mean(a: number[]): number {
  if (a.length === 0) return Number.NaN;
  return a.reduce((s, v) => s + v, 0) / a.length;
}

/** Excel SLOPE(known_y, known_x) — 第一个参数为 y */
export function slope(knownY: number[], knownX: number[]): number {
  const n = knownX.length;
  if (n !== knownY.length || n < 2) return Number.NaN;
  const mx = mean(knownX);
  const my = mean(knownY);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = knownX[i]! - mx;
    const dy = knownY[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
  }
  return sxx === 0 ? Number.NaN : sxy / sxx;
}

/** Excel INTERCEPT(known_y, known_x) */
export function intercept(knownY: number[], knownX: number[]): number {
  const m = slope(knownY, knownX);
  if (!Number.isFinite(m)) return Number.NaN;
  return mean(knownY) - m * mean(knownX);
}

/** Excel RSQ(known_y, known_x) — Pearson r² */
export function rsq(knownY: number[], knownX: number[]): number {
  const n = knownX.length;
  if (n !== knownY.length || n < 2) return Number.NaN;
  const mx = mean(knownX);
  const my = mean(knownY);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = knownX[i]! - mx;
    const dy = knownY[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const den = sxx * syy;
  if (den <= 0) return Number.NaN;
  return (sxy * sxy) / den;
}
