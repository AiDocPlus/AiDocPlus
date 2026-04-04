/**
 * 行式文档 — 一维数值列表原语（1-based 索引；与行号心智一致）
 */

import { quantileSeq } from 'mathjs';

/** 单列表最大元素数（防拖垮 UI） */
export const MAX_LIST_ELEMENTS = 10000;

export function clampList(arr: number[]): number[] {
  if (arr.length <= MAX_LIST_ELEMENTS) return arr;
  return arr.slice(0, MAX_LIST_ELEMENTS);
}

export function listLen(a: number[]): number {
  return a.length;
}

/** 1-based；越界 NaN */
export function listAt(a: number[], i: number): number {
  if (!Number.isFinite(i) || i < 1) return Number.NaN;
  const k = Math.floor(i);
  if (k > a.length) return Number.NaN;
  return a[k - 1]!;
}

/**
 * 1-based 闭区间 [start, end]
 */
export function listSlice(a: number[], start: number, end: number): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const s = Math.max(1, Math.floor(start));
  const e = Math.min(a.length, Math.floor(end));
  if (s > e) return [];
  return a.slice(s - 1, e);
}

export function listConcat(parts: number[][]): number[] {
  const out: number[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) out.push(p[i]!);
  }
  return clampList(out);
}

export function listReverse(a: number[]): number[] {
  return [...a].reverse();
}

/** 相邻差分 */
export function listDiff(a: number[]): number[] {
  if (a.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < a.length; i++) {
    out.push(a[i]! - a[i - 1]!);
  }
  return out;
}

export function listCumprod(a: number[]): number[] {
  const out: number[] = [];
  let p = 1;
  for (const x of a) {
    p *= x;
    out.push(p);
  }
  return out;
}

export function listSort(a: number[]): number[] {
  return [...a].sort((x, y) => x - y);
}

/**
 * 平均秩（并列取平均），1-based 秩
 */
export function listRank(a: number[]): number[] {
  const n = a.length;
  if (n === 0) return [];
  const idx = a.map((v, i) => ({ v, i }));
  idx.sort((x, y) => x.v - y.v);
  const ranks = new Array<number>(n).fill(Number.NaN);
  let j = 0;
  while (j < n) {
    let k = j + 1;
    while (k < n && idx[k]!.v === idx[j]!.v) k++;
    const sumR = ((j + 1 + k) * (k - j)) / 2;
    const avg = sumR / (k - j);
    for (let t = j; t < k; t++) {
      ranks[idx[t]!.i] = avg;
    }
    j = k;
  }
  return ranks;
}

/** 首次出现位置 1-based；未找到 NaN */
export function listIndexOf(value: number, keys: number[]): number {
  const i = keys.indexOf(value);
  return i < 0 ? Number.NaN : i + 1;
}

/** keys 与 values 等长；精确匹配首个 key */
export function listLookup(value: number, keys: number[], values: number[]): number {
  if (keys.length !== values.length) return Number.NaN;
  const i = keys.indexOf(value);
  return i < 0 ? Number.NaN : values[i]!;
}

/** 保序首次出现 */
export function listUnique(a: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const x of a) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

/** 尾部窗口；前 window-1 项为 NaN（滑动窗口 O(n)） */
export function rollMean(a: number[], window: number): number[] {
  const w = Math.floor(window);
  if (!(w >= 1) || !Number.isFinite(w)) return a.map(() => Number.NaN);
  const n = a.length;
  const out: number[] = [];
  let windowSum = 0;
  for (let i = 0; i < n; i++) {
    windowSum += a[i]!;
    if (i >= w) windowSum -= a[i - w]!;
    if (i + 1 < w) {
      out.push(Number.NaN);
    } else {
      out.push(windowSum / w);
    }
  }
  return out;
}

export function rollSum(a: number[], window: number): number[] {
  const w = Math.floor(window);
  if (!(w >= 1) || !Number.isFinite(w)) return a.map(() => Number.NaN);
  const n = a.length;
  const out: number[] = [];
  let windowSum = 0;
  for (let i = 0; i < n; i++) {
    windowSum += a[i]!;
    if (i >= w) windowSum -= a[i - w]!;
    if (i + 1 < w) {
      out.push(Number.NaN);
    } else {
      out.push(windowSum);
    }
  }
  return out;
}

export function listFill(n: number, value: number): number[] {
  const k = Math.floor(n);
  if (!(k >= 0) || k > MAX_LIST_ELEMENTS) return [];
  return Array(k).fill(value);
}

export function listRange(start: number, end: number, step = 1): number[] {
  const st = Math.floor(start);
  const en = Math.floor(end);
  const sp = Math.abs(step);
  if (!(sp > 0) || !Number.isFinite(sp)) return [];
  const out: number[] = [];
  if (step >= 0) {
    for (let x = st; x <= en; x += sp) {
      out.push(x);
      if (out.length >= MAX_LIST_ELEMENTS) break;
    }
  } else {
    for (let x = st; x >= en; x -= sp) {
      out.push(x);
      if (out.length >= MAX_LIST_ELEMENTS) break;
    }
  }
  return out;
}

export function listQuantile(a: number[], p: number): number {
  if (a.length === 0) return Number.NaN;
  return Number(quantileSeq(a, p));
}

/** 升序排列对应的「原位置」1-based 索引 */
export function listArgSort(a: number[]): number[] {
  const idx = a.map((v, i) => ({ v, i }));
  idx.sort((x, y) => x.v - y.v || x.i - y.i);
  return idx.map((x) => x.i + 1);
}

/** 列表均值 */
export function listMean(a: number[]): number {
  if (a.length === 0) return Number.NaN;
  return a.reduce((s, v) => s + v, 0) / a.length;
}
