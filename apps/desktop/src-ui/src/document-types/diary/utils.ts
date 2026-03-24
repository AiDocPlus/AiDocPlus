/**
 * 日记本文档工具函数
 */

import { ID_RANDOM_LENGTH } from './constants';

/**
 * 生成唯一ID
 * 使用 crypto.randomUUID() 避免 Date.now() + Math.random() 的碰撞风险
 */
export function generateId(prefix: string): string {
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, ID_RANDOM_LENGTH);
  return `${prefix}_${randomPart}`;
}

/**
 * 生成快照ID
 */
export function generateSnapshotId(): string {
  return `snap_${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * 安全解析日期字符串为 Date 对象
 * 避免 new Date(y, m - 1, 1) 在跨年时的边缘情况
 */
export function parseYearMonth(year: number, month: number): Date {
  // 使用 UTC 避免时区问题
  const utcDate = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  return new Date(utcDate);
}

/**
 * 从日期字符串安全获取年、月
 */
export function parseDateParts(dateStr: string): { year: number; month: number } {
  const [yearStr, monthStr] = dateStr.split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
  };
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取昨天的日期字符串
 */
export function getYesterdayStr(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDateStr(yesterday);
}

/**
 * 计算两个日期之间的天数差
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00');
  const d2 = new Date(date2 + 'T00:00:00');
  return Math.round(Math.abs(d2.getTime() - d1.getTime()) / 86400000);
}

/**
 * 检查日期是否在范围内（包含边界）
 */
export function isDateInRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}
