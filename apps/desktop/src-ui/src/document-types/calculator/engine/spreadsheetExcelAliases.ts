/**
 * Excel / WPS 常用函数名与 math.js 能力对齐（大写标识符，便于从表格迁移心算稿）
 * 与 Excel 在舍入方向、负基数 FLOOR 等边界上不完全一致处以 math.js 为准。
 */
import type { MathJsStatic } from 'mathjs';
import { xnpv as xnpvFn, xirr as xirrFn } from './financialCalculator';
import {
  normdist as normdistFn,
  normSdist as normSdistFn,
  normsinv as normsinvFn,
  slope as slopeFn,
  intercept as interceptFn,
  rsq as rsqFn,
} from './statSpreadsheetFunctions';

export function registerSpreadsheetExcelAliases(
  math: MathJsStatic,
  mathToNumber: (x: unknown) => number,
  mathToNumberArray: (x: unknown) => number[],
): void {
  const countNumeric = (...args: unknown[]): number => {
    let n = 0;
    for (const a of args) {
      if (Array.isArray(a)) {
        n += mathToNumberArray(a).length;
        continue;
      }
      if (a && typeof a === 'object' && typeof (a as { toArray?: () => unknown }).toArray === 'function') {
        n += mathToNumberArray((a as { toArray: () => unknown }).toArray());
        continue;
      }
      const v = mathToNumber(a);
      if (Number.isFinite(v)) n += 1;
    }
    return n;
  };

  const chainBool2 = (
    op: (a: boolean, b: boolean) => boolean,
    args: unknown[],
  ): boolean => {
    if (args.length === 0) return true;
    let acc = Boolean(args[0]);
    for (let i = 1; i < args.length; i++) acc = op(acc, Boolean(args[i]));
    return acc;
  };

  math.import(
    {
      SUM: (...args: unknown[]) => math.sum(...args),
      AVERAGE: (...args: unknown[]) => math.mean(...args),
      AVERAGEA: (...args: unknown[]) => math.mean(...args),
      PRODUCT: (...args: unknown[]) => math.prod(...args),
      MIN: (...args: unknown[]) => math.min(...args),
      MAX: (...args: unknown[]) => math.max(...args),
      MEDIAN: (...args: unknown[]) => math.median(...args),
      COUNT: (...args: unknown[]) => countNumeric(...args),
      /** 样本标准差，对齐 STDEV.S / 旧版 STDEV */
      STDEV: (...args: unknown[]) => math.std(...args),
      STDEVS: (...args: unknown[]) => math.std(...args),
      STDEVP: (...args: unknown[]) => math.std(...args, 'uncorrected'),
      /** 样本方差，对齐 VAR.S / 旧版 VAR */
      VAR: (...args: unknown[]) => math.variance(...args),
      VARS: (...args: unknown[]) => math.variance(...args),
      VARP: (...args: unknown[]) => math.variance(...args, 'uncorrected'),
      CORREL: (a: unknown, b: unknown) => math.corr(a, b),
      POWER: (x: unknown, y: unknown) => math.pow(x, y),
      SQRT: (x: unknown) => math.sqrt(x),
      ABS: (x: unknown) => math.abs(x),
      MOD: (x: unknown, y: unknown) => math.mod(x, y),
      ROUND: (x: unknown, digits?: unknown) =>
        digits === undefined ? math.round(x) : math.round(x, mathToNumber(digits)),
      ROUNDDOWN: (x: unknown, digits?: unknown) =>
        digits === undefined ? math.floor(x) : math.floor(x, mathToNumber(digits)),
      ROUNDUP: (x: unknown, digits?: unknown) =>
        digits === undefined ? math.ceil(x) : math.ceil(x, mathToNumber(digits)),
      /** 单参数；与 Excel FLOOR.MATH 在负数行为上可能不同 */
      FLOOR: (x: unknown) => math.floor(x),
      CEILING: (x: unknown) => math.ceil(x),
      /** 自然对数 */
      LN: (x: unknown) => math.log(x),
      /** 默认以 10 为底；两参数时为 log_base(x) */
      LOG: (x: unknown, base?: unknown) =>
        base === undefined ? math.log10(x) : math.log(x, base),
      LOG10: (x: unknown) => math.log10(x),
      EXP: (x: unknown) => math.exp(x),
      PI: () => math.pi,
      DEGREES: (x: unknown) => math.divide(math.multiply(x, 180), math.pi),
      RADIANS: (x: unknown) => math.divide(math.multiply(x, math.pi), 180),
      AND: (...args: unknown[]) => chainBool2((a, b) => a && b, args),
      OR: (...args: unknown[]) => chainBool2((a, b) => a || b, args),
      NOT: (x: unknown) => !x,
      XNPV: (rate: unknown, values: unknown, dates: unknown) =>
        xnpvFn(mathToNumber(rate), mathToNumberArray(values), mathToNumberArray(dates)),
      XIRR: (values: unknown, dates: unknown, guess?: unknown) =>
        xirrFn(
          mathToNumberArray(values),
          mathToNumberArray(dates),
          guess !== undefined ? mathToNumber(guess) : 0.1,
        ),
      NORM_S_DIST: (z: unknown, cum?: unknown) =>
        normSdistFn(mathToNumber(z), cum !== undefined ? mathToNumber(cum) : 1),
      NORM_S_INV: (p: unknown) => normsinvFn(mathToNumber(p)),
      NORM_DIST: (x: unknown, mean: unknown, sd: unknown, cum: unknown) =>
        normdistFn(
          mathToNumber(x),
          mathToNumber(mean),
          mathToNumber(sd),
          mathToNumber(cum),
        ),
      SLOPE: (knownY: unknown, knownX: unknown) =>
        slopeFn(mathToNumberArray(knownY), mathToNumberArray(knownX)),
      INTERCEPT: (knownY: unknown, knownX: unknown) =>
        interceptFn(mathToNumberArray(knownY), mathToNumberArray(knownX)),
      RSQ: (knownY: unknown, knownX: unknown) =>
        rsqFn(mathToNumberArray(knownY), mathToNumberArray(knownX)),
    },
    { override: false, silent: true },
  );
}
