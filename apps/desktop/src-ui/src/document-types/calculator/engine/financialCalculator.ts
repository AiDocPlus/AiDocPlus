/**
 * financialCalculator.ts — 金融函数模块
 * 基于 financial 库实现 NPV、IRR、PMT、FV、PV、NPER、RATE、IPMT、PPMT、MIRR；自研 XNPV、XIRR（Excel 语义）
 */
import * as financial from 'financial';

/** 与 Excel 习惯一致：0=期末，1=期初（映射到 financial 的 PaymentDueTime） */
function paymentWhen(type?: number): financial.PaymentDueTime {
  return type === 1 ? financial.PaymentDueTime.Begin : financial.PaymentDueTime.End;
}

// ============================================================
// 金融计算函数
// ============================================================

/**
 * 净现值 (Net Present Value)
 * npv(rate, [cashFlows]) 或 npv([-100, 30, 30, 30, 30], 0.1)
 */
export function npv(rate: number, cashFlows: number[]): number {
  return finiteOrNaN(financial.npv(rate, cashFlows));
}

/**
 * 内部收益率 (Internal Rate of Return)
 * irr([cashFlows])
 */
export function irr(cashFlows: number[]): number {
  return finiteOrNaN(financial.irr(cashFlows));
}

/**
 * 每期还款额 (Payment)
 * pmt(rate, nper, pv, fv?, type?)
 * - rate: 每期利率
 * - nper: 总期数
 * - pv: 现值（贷款金额）
 * - fv: 未来值（默认 0）
 * - type: 0=期末付款, 1=期初付款（默认 0）
 */
export function pmt(rate: number, nper: number, pv: number, fv = 0, type = 0): number {
  return finiteOrNaN(financial.pmt(rate, nper, pv, fv, paymentWhen(type)));
}

/**
 * 未来值 (Future Value)
 * fv(rate, nper, pmt, pv?, type?)
 */
export function fv(rate: number, nper: number, pmt: number, pv = 0, type = 0): number {
  return finiteOrNaN(financial.fv(rate, nper, pmt, pv, paymentWhen(type)));
}

/**
 * 现值 (Present Value)
 * pv(rate, nper, pmt, fv?, type?)
 */
export function pv(rate: number, nper: number, pmt: number, fv = 0, type = 0): number {
  return finiteOrNaN(financial.pv(rate, nper, pmt, fv, paymentWhen(type)));
}

/**
 * 还清贷款所需期数
 * nper(rate, pmt, pv, fv?, type?)
 */
export function nper(rate: number, pmt: number, pv: number, fv = 0, type = 0): number {
  return finiteOrNaN(financial.nper(rate, pmt, pv, fv, paymentWhen(type)));
}

/**
 * 反解每期利率（迭代求解，可能为 NaN）
 * rate(nper, pmt, pv, fv?, type?, guess?, tol?, maxIter?)
 */
export function rate(
  nper: number,
  pmt: number,
  pv: number,
  fv = 0,
  type = 0,
  guess?: number,
  tol?: number,
  maxIter?: number,
): number {
  return finiteOrNaN(financial.rate(nper, pmt, pv, fv, paymentWhen(type), guess, tol, maxIter));
}

/**
 * 指定期数的利息部分（per 从 1 起计）
 * ipmt(rate, per, nper, pv, fv?, type?)
 */
export function ipmt(rate: number, per: number, nper: number, pv: number, fv = 0, type = 0): number {
  return finiteOrNaN(financial.ipmt(rate, per, nper, pv, fv, paymentWhen(type)));
}

/**
 * 指定期数的本金部分
 * ppmt(rate, per, nper, pv, fv?, type?)
 */
export function ppmt(rate: number, per: number, nper: number, pv: number, fv = 0, type = 0): number {
  return finiteOrNaN(financial.ppmt(rate, per, nper, pv, fv, paymentWhen(type)));
}

/**
 * 修正内部收益率（再投资率与融资成本不同）
 * mirr(cashFlows, financeRate, reinvestRate)
 */
export function mirr(cashFlows: number[], financeRate: number, reinvestRate: number): number {
  return finiteOrNaN(financial.mirr(cashFlows, financeRate, reinvestRate));
}

/**
 * 复利计算
 * compound(principal, rate, periods)
 */
export function compound(principal: number, rate: number, periods: number): number {
  return principal * Math.pow(1 + rate, periods);
}

/**
 * 折现计算
 * discount(futureValue, rate, periods)
 */
export function discount(futureValue: number, rate: number, periods: number): number {
  return futureValue / Math.pow(1 + rate, periods);
}

/**
 * 投资回报率 (Return on Investment)
 * roi(gain, cost)
 */
export function roi(gain: number, cost: number): number {
  if (cost === 0) return Number.NaN;
  return (gain - cost) / cost;
}

/** 现金流数组最大长度（防止 irr/npv 长时间阻塞） */
export const MAX_FINANCIAL_CASH_FLOWS = 500;

/** 将 financial 库可能返回的 Infinity/非有限值兜底为 NaN */
function finiteOrNaN(v: number): number {
  return Number.isFinite(v) ? v : Number.NaN;
}

/**
 * 将「日期」统一为与首项的间隔天数（Excel 序列号或相对天数；绝对值大于 1e9 视为 Unix 毫秒）
 */
function dayOffsetsFromFirst(dates: number[]): number[] {
  if (dates.length === 0) return [];
  const d0 = dates[0]!;
  // 任意值 > 1e9 即视为 Unix 毫秒时间戳（正常使用不会混合序列号和毫秒）
  const useMs = dates.some((d) => Math.abs(d) > 1e9);
  return dates.map((d) => (useMs ? (d - d0) / 86400000 : d - d0));
}

/**
 * Excel XNPV：年折现率 rate，现金流与日期等长；以首笔日期为 t=0，指数按 365 天年（与 Excel 一致）。
 */
export function xnpv(rate: number, values: number[], dates: number[]): number {
  if (values.length !== dates.length || values.length === 0) return Number.NaN;
  if (values.length > MAX_FINANCIAL_CASH_FLOWS) return Number.NaN;
  if (!Number.isFinite(rate) || rate <= -1) return Number.NaN;
  const t = dayOffsetsFromFirst(dates);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const years = t[i]! / 365;
    sum += values[i]! / Math.pow(1 + rate, years);
  }
  return sum;
}

function xnpvDerivative(rate: number, values: number[], dates: number[]): number {
  if (values.length !== dates.length || values.length === 0) return Number.NaN;
  if (!Number.isFinite(rate) || rate <= -1) return Number.NaN;
  const t = dayOffsetsFromFirst(dates);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const years = t[i]! / 365;
    const v = values[i]!;
    sum += (-years * v) / Math.pow(1 + rate, years + 1);
  }
  return sum;
}

/**
 * Excel XIRR：使 XNPV=0 的年化收益率；牛顿迭代为主，失败时二分搜索。
 */
export function xirr(values: number[], dates: number[], guess = 0.1): number {
  if (values.length !== dates.length || values.length < 2) return Number.NaN;
  if (values.length > MAX_FINANCIAL_CASH_FLOWS) return Number.NaN;
  const hasPos = values.some((v) => v > 0);
  const hasNeg = values.some((v) => v < 0);
  if (!hasPos || !hasNeg) return Number.NaN;

  let rate = Number.isFinite(guess) ? guess : 0.1;
  for (let iter = 0; iter < 80; iter++) {
    const npv = xnpv(rate, values, dates);
    if (!Number.isFinite(npv)) break;
    if (Math.abs(npv) < 1e-10) return rate;
    const der = xnpvDerivative(rate, values, dates);
    if (!Number.isFinite(der) || Math.abs(der) < 1e-14) break;
    const next = rate - npv / der;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - rate) < 1e-12) return next;
    rate = next;
  }

  let lo = -0.9999;
  let hi = 10;
  let fLo = xnpv(lo, values, dates);
  let fHi = xnpv(hi, values, dates);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return Number.NaN;

  // 先向右扩展 hi
  for (let expand = 0; expand < 30 && fLo * fHi > 0; expand++) {
    hi *= 2;
    fHi = xnpv(hi, values, dates);
    if (!Number.isFinite(fHi)) break;
  }

  // 若同号，再向左扩展 lo（在 -1 上限附近搜索变号点）
  if (fLo * fHi > 0) {
    for (let expand = 0; expand < 30; expand++) {
      const testRate = lo - (lo + 1) * 0.5; // 向 -1 方向靠近
      if (testRate <= -1) break;
      const fTest = xnpv(testRate, values, dates);
      if (!Number.isFinite(fTest)) break;
      if (fTest * fHi <= 0) {
        lo = testRate;
        fLo = fTest;
        break;
      }
      fLo = fTest;
      lo = testRate;
    }
  }

  // 最终仍同号则尝试在中间搜索变号点
  if (fLo * fHi > 0) {
    const probes = [-0.5, -0.25, 0, 0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
    for (const p of probes) {
      const fP = xnpv(p, values, dates);
      if (!Number.isFinite(fP)) continue;
      if (fLo * fP < 0) { hi = p; fHi = fP; break; }
      if (fP * fHi < 0) { lo = p; fLo = fP; break; }
    }
  }

  if (fLo * fHi > 0) return Number.NaN;

  for (let iter = 0; iter < 150; iter++) {
    const mid = (lo + hi) / 2;
    const fMid = xnpv(mid, values, dates);
    if (!Number.isFinite(fMid)) return Number.NaN;
    if (Math.abs(fMid) < 1e-12) return mid;
    if (Math.abs(hi - lo) < 1e-14) return mid;
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return Number.NaN;
}

/**
 * 年化收益率
 * annualizedReturn(totalReturn, days)
 */
export function annualizedReturn(totalReturn: number, days: number): number {
  if (!Number.isFinite(days) || days <= 0) {
    return Number.NaN;
  }
  if (totalReturn < -1) {
    return Number.NaN;
  }
  return Math.pow(1 + totalReturn, 365 / days) - 1;
}

// ============================================================
// 金额格式化
// ============================================================

/**
 * 格式化货币
 */
export function formatCurrency(value: number, currency: string = 'CNY'): string {
  const formatters: Record<string, (v: number) => string> = {
    'CNY': (v) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    'USD': (v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    'EUR': (v) => `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    'JPY': (v) => `¥${v.toLocaleString('ja-JP', { minimumFractionDigits: 0 })}`,
    'GBP': (v) => `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    'KRW': (v) => `₩${v.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  };

  return (formatters[currency] || formatters['CNY'])(value);
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// ============================================================
// 解析金融表达式
// ============================================================

/**
 * 尝试解析金融函数调用
 */
export function tryParseFinancial(expr: string): { fn: string; args: number[] } | null {
  const patterns: Array<{ pattern: RegExp; fn: string }> = [
    { pattern: /npv\s*\(\s*([-\d.]+)\s*,\s*\[([\d,\s.-]+)\]\s*\)/i, fn: 'npv' },
    { pattern: /npv\s*\(\s*\[([\d,\s.-]+)\]\s*,\s*([-\d.]+)\s*\)/i, fn: 'npv_alt' },
    { pattern: /irr\s*\(\s*\[([\d,\s.-]+)\]\s*\)/i, fn: 'irr' },
    { pattern: /pmt\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.-]+)\s*\)/i, fn: 'pmt' },
    { pattern: /fv\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.-]+)\s*\)/i, fn: 'fv' },
    { pattern: /pv\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.-]+)\s*\)/i, fn: 'pv' },
  ];

  for (const { pattern, fn } of patterns) {
    const match = expr.match(pattern);
    if (match) {
      if (fn === 'npv') {
        const rate = parseFloat(match[1]);
        const cashFlows = match[2].split(',').map(s => parseFloat(s.trim()));
        if (cashFlows.length > MAX_FINANCIAL_CASH_FLOWS) return null;
        return { fn: 'npv', args: [rate, ...cashFlows] };
      } else if (fn === 'npv_alt') {
        const cashFlows = match[1].split(',').map(s => parseFloat(s.trim()));
        if (cashFlows.length > MAX_FINANCIAL_CASH_FLOWS) return null;
        const rate = parseFloat(match[2]);
        return { fn: 'npv', args: [rate, ...cashFlows] };
      } else if (fn === 'irr') {
        const cashFlows = match[1].split(',').map(s => parseFloat(s.trim()));
        if (cashFlows.length > MAX_FINANCIAL_CASH_FLOWS) return null;
        return { fn: 'irr', args: cashFlows };
      } else {
        const args = match.slice(1).map(s => parseFloat(s));
        return { fn, args };
      }
    }
  }

  return null;
}

/**
 * 执行金融函数
 */
export function executeFinancialFunction(fn: string, args: number[]): number {
  switch (fn) {
    case 'npv':
      return npv(args[0], args.slice(1));
    case 'irr':
      return irr(args);
    case 'pmt':
      return pmt(args[0], args[1], args[2]);
    case 'fv':
      return fv(args[0], args[1], args[2]);
    case 'pv':
      return pv(args[0], args[1], args[2]);
    default:
      throw new Error(`Unknown financial function: ${fn}`);
  }
}
