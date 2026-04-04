/**
 * dateCalculator.ts — 日期计算模块
 * 基于 date-fns 实现自然语言日期计算
 */
import {
  parse,
  format,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isValid,
} from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

// ============================================================
// 日期解析
// ============================================================

/** 中文日期关键词映射 */
const CHINESE_DATE_KEYWORDS: Record<string, () => Date> = {
  '今天': () => new Date(),
  '明天': () => addDays(new Date(), 1),
  '后天': () => addDays(new Date(), 2),
  '昨天': () => addDays(new Date(), -1),
  '前天': () => addDays(new Date(), -2),
  '本周一': () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  '本周末': () => endOfWeek(new Date(), { weekStartsOn: 1 }),
  '本月初': () => startOfMonth(new Date()),
  '本月末': () => endOfMonth(new Date()),
  '本年初': () => startOfYear(new Date()),
  '本年末': () => endOfYear(new Date()),
};

/** 英文日期关键词映射 */
const ENGLISH_DATE_KEYWORDS: Record<string, () => Date> = {
  'today': () => new Date(),
  'tomorrow': () => addDays(new Date(), 1),
  'yesterday': () => addDays(new Date(), -1),
  'now': () => new Date(),
  'this week': () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  'this month': () => startOfMonth(new Date()),
  'this year': () => startOfYear(new Date()),
};

/** 中文时间单位映射 */
const CHINESE_UNITS: Record<string, (date: Date, amount: number) => Date> = {
  '天': addDays,
  '日': addDays,
  '周': addWeeks,
  '星期': addWeeks,
  '月': addMonths,
  '个月': addMonths,
  '年': addYears,
};

/** 英文时间单位映射 */
const ENGLISH_UNITS: Record<string, (date: Date, amount: number) => Date> = {
  'day': addDays,
  'days': addDays,
  'week': addWeeks,
  'weeks': addWeeks,
  'month': addMonths,
  'months': addMonths,
  'year': addYears,
  'years': addYears,
};

// ============================================================
// 解析函数
// ============================================================

/**
 * 解析日期表达式
 * 支持格式：
 * - today, tomorrow, 今天, 明天
 * - today + 2 weeks, 今天 + 2周
 * - 2024-01-01, 2024/01/01, 1月1日, 1月1
 * - Jan 1, January 1st
 */
export function parseDateExpression(expr: string): Date | null {
  const trimmed = expr.trim();
  const normalized = trimmed.toLowerCase();

  // 1. 中文关键词：仅整行精确匹配，避免「价格明天涨」等误识别为日期
  for (const [keyword, getter] of Object.entries(CHINESE_DATE_KEYWORDS)) {
    if (trimmed === keyword) {
      return getter();
    }
  }

  // 2. 英文关键词：整行精确匹配（忽略大小写）
  for (const [keyword, getter] of Object.entries(ENGLISH_DATE_KEYWORDS)) {
    if (normalized === keyword) {
      return getter();
    }
  }

  // 3. 尝试解析标准日期格式
  // YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY
  const datePatterns = [
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/,  // 2024-01-01, 2024/01/01
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/,  // 01/01/2024, 1-1-2024
    /^(\d{1,2})月(\d{1,2})[日号]?$/,        // 1月1日, 12月25号
  ];

  for (const pattern of datePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      try {
        let year: number, month: number, day: number;
        if (pattern === datePatterns[0]) {
          year = parseInt(match[1]); month = parseInt(match[2]); day = parseInt(match[3]);
        } else if (pattern === datePatterns[1]) {
          year = parseInt(match[3]); month = parseInt(match[1]); day = parseInt(match[2]);
        } else {
          year = new Date().getFullYear(); month = parseInt(match[1]); day = parseInt(match[2]);
        }
        // 校验合法性：月 1-12，日 1-31
        if (month < 1 || month > 12 || day < 1 || day > 31) continue;
        const date = new Date(year, month - 1, day);
        // 反向校验：Date 构造器会静默进位（如 2月30日→3月2日）
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) continue;
        return date;
      } catch {
        continue;
      }
    }
  }

  // 4. 尝试 date-fns parse
  const parsed = parse(normalized, 'MMM d', new Date(), { locale: enUS });
  if (isValid(parsed)) return parsed;

  const parsedZh = parse(expr, 'M月d日', new Date());
  if (isValid(parsedZh)) return parsedZh;

  return null;
}

/**
 * 解析日期加减表达式
 * 格式：date + N unit, date - N unit
 * 例如：today + 2 weeks, 2024-01-01 + 30 days, 今天 + 1个月
 */
export function parseDateArithmetic(expr: string): Date | null {
  // 匹配：baseDate +|- amount unit
  const arithmeticPattern = /^(.+?)\s*([\+\-])\s*(\d+(?:\.\d+)?)\s*(天|日|周|星期|月|个月|年|day|days|week|weeks|month|months|year|years)$/i;
  const match = expr.match(arithmeticPattern);

  if (!match) return null;

  const [, baseExpr, operator, amountStr, unit] = match;
  const amount = parseFloat(amountStr) * (operator === '-' ? -1 : 1);

  // 解析基准日期
  let baseDate = parseDateExpression(baseExpr.trim());
  if (!baseDate) return null;

  // 查找单位处理函数
  const unitLower = unit.toLowerCase();
  const addFn = CHINESE_UNITS[unit] || ENGLISH_UNITS[unitLower];

  if (!addFn) return null;

  return addFn(baseDate, amount);
}

/**
 * 解析日期差计算
 * 格式：date1 to date2, date1 - date2, date1 到 date2
 * 返回天数差
 */
export function parseDateDifference(expr: string): number | null {
  // 匹配：date1 (to|到|至) date2  或  date1 - date2（- 两侧需有空格，避免与 YYYY-MM-DD 冲突）
  const diffPattern = /^(.+?)\s*(?:to|到|至)\s*(.+)$|^(.+?)\s+-\s+(.+)$/;
  const match = expr.match(diffPattern);

  const left = (match?.[1] ?? match?.[3])?.trim();
  const right = (match?.[2] ?? match?.[4])?.trim();

  if (!left || !right) return null;

  const date1 = parseDateExpression(left) || parseDateArithmetic(left);
  const date2 = parseDateExpression(right) || parseDateArithmetic(right);

  if (!date1 || !date2) return null;

  return differenceInDays(date2, date1);
}

// ============================================================
// 格式化
// ============================================================

/**
 * 格式化日期显示
 */
/** 将设置里的日期格式映射为 date-fns 模式串 */
export function mapCalculatorDateFormatToDateFns(settingFormat: string): string {
  const map: Record<string, string> = {
    'YYYY-MM-DD': 'yyyy-MM-dd',
    'MM/DD/YYYY': 'MM/dd/yyyy',
    'DD/MM/YYYY': 'dd/MM/yyyy',
    'YYYY/MM/DD': 'yyyy/MM/dd',
  };
  return map[settingFormat] || 'yyyy-MM-dd';
}

export function formatDateDisplay(
  date: Date,
  formatStr: string = 'yyyy-MM-dd',
  useZhLocale = true
): string {
  return format(date, formatStr, useZhLocale ? { locale: zhCN } : {});
}

/**
 * 格式化日期差显示
 */
export function formatDurationDisplay(days: number, locale: string = 'zh'): string {
  const absDays = Math.abs(days);
  const sign = days < 0 ? '-' : '';
  if (locale.startsWith('zh')) {
    if (absDays < 7) return `${sign}${days} 天`;
    if (absDays < 30) return `${sign}${Math.round(absDays / 7)} 周`;
    if (absDays < 365) return `${sign}${Math.round(absDays / 30)} 个月`;
    return `${sign}${(absDays / 365).toFixed(1)} 年`;
  }
  if (absDays < 7) return `${sign}${days} day${absDays !== 1 ? 's' : ''}`;
  if (absDays < 30) return `${sign}${Math.round(absDays / 7)} week${Math.round(absDays / 7) !== 1 ? 's' : ''}`;
  if (absDays < 365) return `${sign}${Math.round(absDays / 30)} month${Math.round(absDays / 30) !== 1 ? 's' : ''}`;
  return `${sign}${(absDays / 365).toFixed(1)} year${(absDays / 365).toFixed(1) !== '1.0' ? 's' : ''}`;
}

// ============================================================
// 主解析函数
// ============================================================

export interface DateCalcResult {
  type: 'date' | 'duration';
  value: Date | number;
  displayValue: string;
}

/**
 * 尝试解析日期表达式
 * @param dateFormatSetting 文档设置中的日期格式（如 YYYY-MM-DD）
 */
export function tryParseDateExpression(
  expr: string,
  dateFormatSetting?: string,
  locale?: string
): DateCalcResult | null {
  const trimmed = expr.trim();
  const dateFnsPattern = dateFormatSetting
    ? mapCalculatorDateFormatToDateFns(dateFormatSetting)
    : 'yyyy-MM-dd';

  // 1. 尝试日期差
  const diff = parseDateDifference(trimmed);
  if (diff !== null) {
    return {
      type: 'duration',
      value: diff,
      displayValue: formatDurationDisplay(diff, locale),
    };
  }

  // 2. 尝试日期加减
  const arithmetic = parseDateArithmetic(trimmed);
  if (arithmetic) {
    return {
      type: 'date',
      value: arithmetic,
      displayValue: formatDateDisplay(arithmetic, dateFnsPattern),
    };
  }

  // 3. 尝试简单日期
  const date = parseDateExpression(trimmed);
  if (date) {
    return {
      type: 'date',
      value: date,
      displayValue: formatDateDisplay(date, dateFnsPattern),
    };
  }

  return null;
}
