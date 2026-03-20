/**
 * diaryAnalysis.ts — 日记统计分析逻辑
 */
import type { DiaryDocumentContent, DiaryMood } from './types';
import { MOOD_SCORE, getEntryWordCount } from './types';

/** 年度热力图数据 */
export interface HeatmapDay {
  date: string;
  count: number; // 条目数
  words: number; // 字数
}

export function getYearlyHeatmap(diary: DiaryDocumentContent, year: number): HeatmapDay[] {
  // 先建立 date→{count, words} 的 Map，O(N)
  const dateMap = new Map<string, { count: number; words: number }>();
  for (const e of diary.entries) {
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
    const dateStr = d.toISOString().slice(0, 10);
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
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return diary.entries
    .filter(e => e.date >= cutoffStr && e.mood)
    .map(e => ({ date: e.date, score: MOOD_SCORE[e.mood!], mood: e.mood! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 心情分布 */
export function getMoodDistribution(diary: DiaryDocumentContent): { mood: DiaryMood; count: number }[] {
  const counts: Record<string, number> = {};
  for (const e of diary.entries) {
    if (e.mood) counts[e.mood] = (counts[e.mood] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([mood, count]) => ({ mood: mood as DiaryMood, count }))
    .sort((a, b) => b.count - a.count);
}

/** 标签频率 */
export function getTagFrequency(diary: DiaryDocumentContent): { tag: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const e of diary.entries) {
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
  for (const e of diary.entries) {
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
  const today = new Date();
  const stats: MonthlyStats[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthEntries = diary.entries.filter(e => e.date.startsWith(prefix));
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
  return [...diary.entries]
    .map(e => ({ date: e.date, title: e.title || e.content.slice(0, 30).replace(/\n/g, ' '), words: getEntryWordCount(e) }))
    .sort((a, b) => b.words - a.words)
    .slice(0, limit);
}
