/**
 * stock-research/utils.ts — 工具函数
 *
 * 功能：
 * - 数字格式化
 * - 日期格式化
 * - 计算辅助函数
 * - 验证函数
 */

import { CURRENCY_SYMBOLS } from './constants';

// ═══════════════════════════════════════════════════════
// 数字格式化
// ═══════════════════════════════════════════════════════

/**
 * 格式化数字（带默认值）
 */
export function formatNumber(
  value: number | undefined | null,
  options?: {
    decimals?: number;
    suffix?: string;
    prefix?: string;
    defaultValue?: string;
  }
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return options?.defaultValue ?? '-';
  }

  const { decimals = 2, suffix = '', prefix = '' } = options || {};
  const formatted = value.toFixed(decimals);

  return `${prefix}${formatted}${suffix}`;
}

/**
 * 格式化百分比
 */
export function formatPercent(
  value: number | undefined | null,
  options?: {
    decimals?: number;
    showSign?: boolean;
    defaultValue?: string;
  }
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return options?.defaultValue ?? '-';
  }

  const { decimals = 1, showSign = true } = options || {};
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * 格式化金额
 */
export function formatCurrency(
  value: number | undefined | null,
  currency: string = 'CNY',
  options?: {
    decimals?: number;
    compact?: boolean;
    defaultValue?: string;
  }
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return options?.defaultValue ?? '-';
  }

  const { decimals = 2, compact = false } = options || {};
  const symbol = CURRENCY_SYMBOLS[currency] || '¥';

  if (compact && Math.abs(value) >= 10000) {
    const billion = value / 100000000;
    if (Math.abs(billion) >= 1) {
      return `${symbol}${billion.toFixed(1)}亿`;
    }
    const million = value / 10000;
    return `${symbol}${million.toFixed(0)}万`;
  }

  return `${symbol}${value.toFixed(decimals)}`;
}

/**
 * 格式化大数字（亿/万）
 */
export function formatLargeNumber(
  value: number | undefined | null,
  unit: string = '亿',
  options?: {
    decimals?: number;
    defaultValue?: string;
  }
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return options?.defaultValue ?? '-';
  }

  const { decimals = 2 } = options || {};
  return `${value.toFixed(decimals)}${unit}`;
}

// ═══════════════════════════════════════════════════════
// 日期格式化
// ═══════════════════════════════════════════════════════

/**
 * 格式化日期
 */
export function formatDate(
  timestamp: number | undefined | null,
  options?: {
    format?: 'full' | 'date' | 'time' | 'relative';
    defaultValue?: string;
  }
): string {
  if (timestamp === undefined || timestamp === null) {
    return options?.defaultValue ?? '-';
  }

  const { format = 'date' } = options || {};
  const date = new Date(timestamp);

  switch (format) {
    case 'full':
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'time':
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    case 'relative':
      return formatRelativeTime(timestamp);
    case 'date':
    default:
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
  }
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}年前`;
  if (months > 0) return `${months}个月前`;
  if (weeks > 0) return `${weeks}周前`;
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

// ═══════════════════════════════════════════════════════
// 计算辅助函数
// ═══════════════════════════════════════════════════════

/**
 * 计算盈亏比例
 */
export function calculateProfitLossPercent(
  currentPrice: number,
  costBasis: number
): number {
  if (costBasis === 0) return 0;
  return ((currentPrice - costBasis) / costBasis) * 100;
}

/**
 * 计算年化收益率
 */
export function calculateAnnualizedReturn(
  startValue: number,
  endValue: number,
  days: number
): number {
  if (startValue === 0 || days === 0) return 0;
  const totalReturn = (endValue - startValue) / startValue;
  const years = days / 365;
  return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
}

/**
 * 计算波动率（基于收益率数组）
 */
export function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance);
}

/**
 * 计算夏普比率
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.03
): number {
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const volatility = calculateVolatility(returns);
  if (volatility === 0) return 0;
  return (avgReturn - riskFreeRate) / volatility;
}

/**
 * 计算最大回撤
 */
export function calculateMaxDrawdown(values: number[]): { maxDrawdown: number; startIndex: number; endIndex: number } {
  if (values.length < 2) {
    return { maxDrawdown: 0, startIndex: 0, endIndex: 0 };
  }

  let maxDrawdown = 0;
  let peak = values[0];
  let peakIndex = 0;
  let startIndex = 0;
  let endIndex = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
      peakIndex = i;
    } else {
      const drawdown = (peak - values[i]) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        startIndex = peakIndex;
        endIndex = i;
      }
    }
  }

  return { maxDrawdown: maxDrawdown * 100, startIndex, endIndex };
}

/**
 * 计算 PEG
 */
export function calculatePEG(pe: number, growthRate: number): number {
  if (growthRate === 0) return Infinity;
  return pe / growthRate;
}

/**
 * 计算安全边际
 */
export function calculateMarginOfSafety(
  intrinsicValue: number,
  currentPrice: number
): number {
  if (intrinsicValue === 0) return 0;
  return ((intrinsicValue - currentPrice) / intrinsicValue) * 100;
}

// ═══════════════════════════════════════════════════════
// 验证函数
// ═══════════════════════════════════════════════════════

/**
 * 验证股票代码格式
 */
export function isValidStockCode(code: string, market?: string): boolean {
  if (!code || code.trim().length === 0) return false;

  // A股：6位数字
  if (!market || ['SH', 'SZ', 'BJ'].includes(market)) {
    return /^\d{6}$/.test(code);
  }

  // 美股：1-5位大写字母
  if (['NASDAQ', 'NYSE'].includes(market)) {
    return /^[A-Z]{1,5}$/.test(code);
  }

  // 港股：数字或字母+数字
  if (market === 'HK') {
    return /^\d{4,5}$|^[A-Z]+\d+$/.test(code);
  }

  return true; // 其他市场不验证
}

/**
 * 验证价格是否有效
 */
export function isValidPrice(price: number): boolean {
  return !isNaN(price) && price > 0 && price < 1000000;
}

/**
 * 验证百分比是否有效
 */
export function isValidPercent(value: number): boolean {
  return !isNaN(value) && value >= -100 && value <= 1000;
}

// ═══════════════════════════════════════════════════════
// 颜色辅助函数
// ═══════════════════════════════════════════════════════

/**
 * 获取涨跌颜色类名
 */
export function getChangeColorClass(value: number): string {
  if (value > 0) return 'text-green-500';
  if (value < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

/**
 * 获取风险等级颜色类名
 */
export function getRiskColorClass(level: string): string {
  switch (level) {
    case 'low': return 'text-green-500';
    case 'medium': return 'text-yellow-500';
    case 'high': return 'text-orange-500';
    case 'extreme': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

/**
 * 获取论点状态图标
 */
export function getThesisStatusIcon(status: string): string {
  switch (status) {
    case 'bullish': return '📈';
    case 'bearish': return '📉';
    case 'neutral': return '➖';
    default: return '❓';
  }
}

/**
 * 获取新闻情感图标
 */
export function getNewsSentimentIcon(sentiment?: string): string {
  switch (sentiment) {
    case 'positive': return '🟢';
    case 'negative': return '🔴';
    case 'neutral': return '⚪';
    default: return '⚪';
  }
}

// ═══════════════════════════════════════════════════════
// ID 生成
// ═══════════════════════════════════════════════════════

let idCounter = 0;

/**
 * 生成唯一 ID
 */
export function generateId(prefix: string = 'id'): string {
  idCounter++;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  const counter = idCounter.toString(36);
  return `${prefix}_${timestamp}${random}${counter}`;
}
