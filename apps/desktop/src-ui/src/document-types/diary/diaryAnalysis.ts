/**
 * diaryAnalysis.ts — 日记统计分析逻辑
 */
import type { DiaryDocumentContent, DiaryMood, DiaryEntry } from './types';
import { MOOD_SCORE, MOOD_LABEL, MOOD_EMOJI, getEntryWordCount, getTodayDateStr, toLocalDateStr } from './types';

/** 获取未删除的条目（统计分析统一使用） */
function activeEntries(diary: DiaryDocumentContent): DiaryEntry[] {
  return diary.entries.filter(e => !e.deletedAt);
}

/** 年度热力图数据 */
export interface HeatmapDay {
  date: string;
  count: number; // 条目数
  words: number; // 字数
}

export function getYearlyHeatmap(diary: DiaryDocumentContent, year: number): HeatmapDay[] {
  const entries = activeEntries(diary);
  // 先建立 date→{count, words} 的 Map，O(N)
  const dateMap = new Map<string, { count: number; words: number }>();
  for (const e of entries) {
    if (e.date.startsWith(String(year))) {
      const existing = dateMap.get(e.date);
      if (existing) {
        existing.count++;
        existing.words += getEntryWordCount(e);
      } else {
        dateMap.set(e.date, { count: 1, words: getEntryWordCount(e) });
      }
    }
  }
  // 遍历 365 天查 Map，O(365)
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const days: HeatmapDay[] = [];
  const d = new Date(start);
  while (d <= end) {
    const dateStr = toLocalDateStr(d);
    const entry = dateMap.get(dateStr);
    days.push({
      date: dateStr,
      count: entry?.count || 0,
      words: entry?.words || 0,
    });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** 心情趋势（近N天，数值化） */
export interface MoodPoint {
  date: string;
  score: number; // 1-5
  mood: DiaryMood;
}

export function getMoodTrend(diary: DiaryDocumentContent, days: number): MoodPoint[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = toLocalDateStr(cutoff);

  return activeEntries(diary)
    .filter(e => e.date >= cutoffStr && e.mood)
    .map(e => ({ date: e.date, score: MOOD_SCORE[e.mood!], mood: e.mood! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 心情分布 */
export function getMoodDistribution(diary: DiaryDocumentContent): { mood: DiaryMood; count: number }[] {
  const counts: Record<string, number> = {};
  for (const e of activeEntries(diary)) {
    if (e.mood) counts[e.mood] = (counts[e.mood] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([mood, count]) => ({ mood: mood as DiaryMood, count }))
    .sort((a, b) => b.count - a.count);
}

/** 标签频率 */
export function getTagFrequency(diary: DiaryDocumentContent): { tag: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const e of activeEntries(diary)) {
    for (const tag of e.tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/** 写作时段分布（24小时） */
export function getWritingHourDistribution(diary: DiaryDocumentContent): number[] {
  const hours = new Array(24).fill(0);
  for (const e of activeEntries(diary)) {
    if (e.time) {
      const h = parseInt(e.time.split(':')[0], 10);
      if (h >= 0 && h < 24) hours[h]++;
    }
  }
  return hours;
}

/** 月度统计 */
export interface MonthlyStats {
  month: string; // "YYYY-MM"
  entries: number;
  words: number;
}

export function getMonthlyStats(diary: DiaryDocumentContent, months: number = 12): MonthlyStats[] {
  const entries = activeEntries(diary);
  const today = new Date();
  const stats: MonthlyStats[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthEntries = entries.filter(e => e.date.startsWith(prefix));
    stats.push({
      month: prefix,
      entries: monthEntries.length,
      words: monthEntries.reduce((s, e) => s + getEntryWordCount(e), 0),
    });
  }
  return stats;
}

/** 最长条目排行 */
export function getLongestEntries(diary: DiaryDocumentContent, limit: number = 10): { date: string; title: string; words: number }[] {
  return [...activeEntries(diary)]
    .map(e => ({ date: e.date, title: e.title || e.content.slice(0, 30).replace(/\n/g, ' '), words: getEntryWordCount(e) }))
    .sort((a, b) => b.words - a.words)
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════
// D1.2: 情绪洞察引擎
// ═══════════════════════════════════════════════════════

/** 心情与天气关联分析 */
export interface MoodWeatherCorrelation {
  weather: string;
  avgScore: number;
  count: number;
}

export function getMoodWeatherCorrelation(diary: DiaryDocumentContent): MoodWeatherCorrelation[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of activeEntries(diary)) {
    if (e.mood && e.weather) {
      const key = e.weather.type;
      const existing = map.get(key);
      if (existing) {
        existing.total += MOOD_SCORE[e.mood];
        existing.count++;
      } else {
        map.set(key, { total: MOOD_SCORE[e.mood], count: 1 });
      }
    }
  }
  return Array.from(map.entries())
    .map(([weather, { total, count }]) => ({ weather, avgScore: Math.round(total / count * 10) / 10, count }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

/** 心情与星期关联分析 */
export interface MoodWeekdayCorrelation {
  weekday: number; // 0=周日, 1=周一, ..., 6=周六
  avgScore: number;
  count: number;
}

export function getMoodWeekdayCorrelation(diary: DiaryDocumentContent): MoodWeekdayCorrelation[] {
  const buckets: { total: number; count: number }[] = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  for (const e of activeEntries(diary)) {
    if (e.mood) {
      const d = new Date(e.date + 'T00:00:00');
      const weekday = d.getDay();
      buckets[weekday].total += MOOD_SCORE[e.mood];
      buckets[weekday].count++;
    }
  }
  return buckets.map((b, i) => ({
    weekday: i,
    avgScore: b.count > 0 ? Math.round(b.total / b.count * 10) / 10 : 0,
    count: b.count,
  }));
}

/** 心情与标签关联分析 */
export interface MoodTagCorrelation {
  tag: string;
  avgScore: number;
  count: number;
  /** 相对全局平均心情的偏差 */
  deviation: number;
}

export function getMoodTagCorrelation(diary: DiaryDocumentContent): MoodTagCorrelation[] {
  const entries = activeEntries(diary);
  // 全局平均
  const allMoods = entries.filter(e => e.mood).map(e => MOOD_SCORE[e.mood!]);
  const globalAvg = allMoods.length > 0 ? allMoods.reduce((s, v) => s + v, 0) / allMoods.length : 3;

  const map = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    if (e.mood && e.tags.length > 0) {
      for (const tag of e.tags) {
        const existing = map.get(tag);
        if (existing) {
          existing.total += MOOD_SCORE[e.mood];
          existing.count++;
        } else {
          map.set(tag, { total: MOOD_SCORE[e.mood], count: 1 });
        }
      }
    }
  }
  return Array.from(map.entries())
    .filter(([, { count }]) => count >= 2)
    .map(([tag, { total, count }]) => {
      const avg = total / count;
      return { tag, avgScore: Math.round(avg * 10) / 10, count, deviation: Math.round((avg - globalAvg) * 10) / 10 };
    })
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}

/** 情绪热力图：星期 × 时段（4 个时段） */
export interface MoodHeatmapCell {
  weekday: number;
  period: number; // 0=凌晨(0-6), 1=上午(6-12), 2=下午(12-18), 3=晚上(18-24)
  avgScore: number;
  count: number;
}

const PERIOD_KEYS = ['diary.periodDawn', 'diary.periodMorning', 'diary.periodAfternoon', 'diary.periodEvening'];
const PERIOD_DEFAULTS = ['凌晨', '上午', '下午', '晚上'];

export function getMoodHeatmap(diary: DiaryDocumentContent): { cells: MoodHeatmapCell[]; periodKeys: string[]; periodDefaults: string[] } {
  const grid: { total: number; count: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 4 }, () => ({ total: 0, count: 0 })),
  );

  for (const e of activeEntries(diary)) {
    if (e.mood && e.time) {
      const d = new Date(e.date + 'T00:00:00');
      const weekday = d.getDay();
      const hour = parseInt(e.time.split(':')[0], 10);
      const period = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
      grid[weekday][period].total += MOOD_SCORE[e.mood];
      grid[weekday][period].count++;
    }
  }

  const cells: MoodHeatmapCell[] = [];
  for (let w = 0; w < 7; w++) {
    for (let p = 0; p < 4; p++) {
      const { total, count } = grid[w][p];
      cells.push({
        weekday: w,
        period: p,
        avgScore: count > 0 ? Math.round(total / count * 10) / 10 : 0,
        count,
      });
    }
  }

  return { cells, periodKeys: PERIOD_KEYS, periodDefaults: PERIOD_DEFAULTS };
}

/** 周期性模式检测（哪些日子心情规律性高/低） */
export interface PeriodicPattern {
  type: 'weekday_low' | 'weekday_high' | 'time_low' | 'time_high';
  /** i18n key, e.g. 'diary.patternWeekdayLow' */
  labelKey: string;
  labelDefault: string;
  /** i18n key for detail */
  detailKey: string;
  detailDefault: string;
  detailParams: Record<string, unknown>;
  significance: number; // 偏离程度（0-1）
}

const WEEKDAY_KEYS = ['diary.weekdaySun', 'diary.weekdayMon', 'diary.weekdayTue', 'diary.weekdayWed', 'diary.weekdayThu', 'diary.weekdayFri', 'diary.weekdaySat'];
const WEEKDAY_DEFAULTS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export { WEEKDAY_KEYS, WEEKDAY_DEFAULTS, PERIOD_KEYS, PERIOD_DEFAULTS };

export function detectPeriodicPatterns(diary: DiaryDocumentContent): PeriodicPattern[] {
  const patterns: PeriodicPattern[] = [];

  // 星期模式
  const weekdayData = getMoodWeekdayCorrelation(diary);
  const validWeekdays = weekdayData.filter(w => w.count >= 3);
  if (validWeekdays.length >= 5) {
    const allAvg = validWeekdays.reduce((s, w) => s + w.avgScore * w.count, 0) / validWeekdays.reduce((s, w) => s + w.count, 0);
    for (const w of validWeekdays) {
      const wdLabel = WEEKDAY_DEFAULTS[w.weekday];
      const diff = w.avgScore - allAvg;
      if (diff < -0.5 && w.count >= 3) {
        patterns.push({
          type: 'weekday_low',
          labelKey: 'diary.patternWeekdayLow',
          labelDefault: `${wdLabel}心情偏低`,
          detailKey: 'diary.patternWeekdayLowDetail',
          detailDefault: `${wdLabel}平均心情 {{avg}}/5（低于均值 {{absDiff}}），共 {{count}} 次记录`,
          detailParams: { avg: w.avgScore, absDiff: Math.abs(diff).toFixed(1), count: w.count },
          significance: Math.min(1, Math.abs(diff) / 2),
        });
      } else if (diff > 0.5 && w.count >= 3) {
        patterns.push({
          type: 'weekday_high',
          labelKey: 'diary.patternWeekdayHigh',
          labelDefault: `${wdLabel}心情偏高`,
          detailKey: 'diary.patternWeekdayHighDetail',
          detailDefault: `${wdLabel}平均心情 {{avg}}/5（高于均值 {{diff}}），共 {{count}} 次记录`,
          detailParams: { avg: w.avgScore, diff: diff.toFixed(1), count: w.count },
          significance: Math.min(1, diff / 2),
        });
      }
    }
  }

  // 时段模式
  const heatmap = getMoodHeatmap(diary);
  const periodTotals = [0, 0, 0, 0];
  const periodCounts = [0, 0, 0, 0];
  for (const cell of heatmap.cells) {
    periodTotals[cell.period] += cell.avgScore * cell.count;
    periodCounts[cell.period] += cell.count;
  }
  const periodAvgs = periodTotals.map((t, i) => periodCounts[i] > 0 ? t / periodCounts[i] : 0);
  const validPeriods = periodAvgs.filter(a => a > 0);
  if (validPeriods.length >= 2) {
    const allPeriodAvg = validPeriods.reduce((s, v) => s + v, 0) / validPeriods.length;
    for (let p = 0; p < 4; p++) {
      if (periodCounts[p] < 3) continue;
      const diff = periodAvgs[p] - allPeriodAvg;
      const pLabel = PERIOD_DEFAULTS[p];
      if (diff < -0.5) {
        patterns.push({
          type: 'time_low',
          labelKey: 'diary.patternTimeLow',
          labelDefault: `${pLabel}心情偏低`,
          detailKey: 'diary.patternTimeLowDetail',
          detailDefault: `${pLabel}写日记时平均心情 {{avg}}/5，低于其他时段`,
          detailParams: { avg: periodAvgs[p].toFixed(1) },
          significance: Math.min(1, Math.abs(diff) / 2),
        });
      } else if (diff > 0.5) {
        patterns.push({
          type: 'time_high',
          labelKey: 'diary.patternTimeHigh',
          labelDefault: `${pLabel}心情偏高`,
          detailKey: 'diary.patternTimeHighDetail',
          detailDefault: `${pLabel}写日记时平均心情 {{avg}}/5，高于其他时段`,
          detailParams: { avg: periodAvgs[p].toFixed(1) },
          significance: Math.min(1, diff / 2),
        });
      }
    }
  }

  return patterns.sort((a, b) => b.significance - a.significance);
}

/** 构建情绪洞察 AI 提示词（用于 DiaryAISidebar） */
export function buildEmotionInsightPrompt(diary: DiaryDocumentContent): string {
  const parts: string[] = [];
  parts.push('请基于以下日记数据，为我提供深度情绪洞察分析：\n');

  // 心情分布
  const dist = getMoodDistribution(diary);
  if (dist.length > 0) {
    parts.push('【心情分布】');
    for (const d of dist) {
      parts.push(`  ${MOOD_EMOJI[d.mood]} ${MOOD_LABEL[d.mood]}: ${d.count}次`);
    }
  }

  // 心情与天气
  const weatherCorr = getMoodWeatherCorrelation(diary);
  if (weatherCorr.length > 0) {
    parts.push('\n【心情与天气关联】');
    for (const w of weatherCorr.slice(0, 5)) {
      parts.push(`  ${w.weather}: 平均心情 ${w.avgScore}/5（${w.count}次）`);
    }
  }

  // 心情与星期
  const weekdayCorr = getMoodWeekdayCorrelation(diary);
  const validWd = weekdayCorr.filter(w => w.count > 0);
  if (validWd.length > 0) {
    parts.push('\n【心情与星期关联】');
    for (const w of validWd) {
      parts.push(`  ${WEEKDAY_DEFAULTS[w.weekday]}: 平均 ${w.avgScore}/5（${w.count}次）`);
    }
  }

  // 心情与标签
  const tagCorr = getMoodTagCorrelation(diary);
  if (tagCorr.length > 0) {
    parts.push('\n【心情与标签关联（偏差最大的）】');
    for (const t of tagCorr.slice(0, 8)) {
      const sign = t.deviation > 0 ? '+' : '';
      parts.push(`  #${t.tag}: 平均 ${t.avgScore}/5（${sign}${t.deviation}，${t.count}次）`);
    }
  }

  // 周期性模式
  const patterns = detectPeriodicPatterns(diary);
  if (patterns.length > 0) {
    parts.push('\n【检测到的周期性模式】');
    for (const p of patterns) {
      parts.push(`  ${p.labelDefault}: ${p.detailDefault.replace(/\{\{(\w+)\}\}/g, (_, k) => String(p.detailParams[k] ?? ''))}`);
    }
  }

  parts.push('\n请分析以上数据，给出：');
  parts.push('1. 情绪触发器：哪些因素（天气/活动/日期）与好/坏心情关联最强？');
  parts.push('2. 周期性规律：是否存在固定的情绪周期？原因推测？');
  parts.push('3. 个性化建议：基于分析结果，给出3-5条具体的情绪调节建议。');

  return parts.join('\n');
}
