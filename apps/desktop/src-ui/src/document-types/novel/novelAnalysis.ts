/**
 * novelAnalysis.ts — 小说正文扫描/分析工具函数
 *
 * Phase 7: 设定集交叉引用增强
 * - scanCharacterAppearances: 扫描角色在各章的出场情况
 * - scanLocationAppearances: 扫描地点在各章的出现情况
 * - checkConsistency: 一致性检查
 */

import type { NovelDocumentContent } from './types';
import { getTotalWordCount, getTodayWordCount } from './types';

export interface AppearanceResult {
  entityId: string;
  entityName: string;
  chapters: { chapterId: string; chapterTitle: string; volumeTitle: string; count: number }[];
  totalCount: number;
  firstChapterId?: string;
}

/**
 * 扫描角色在各章的出场情况
 */
export function scanCharacterAppearances(novel: NovelDocumentContent): AppearanceResult[] {
  return novel.settings.characters.map(char => {
    const names = [char.name, ...(char.aliases || [])].filter(Boolean);
    if (names.length === 0) return { entityId: char.id, entityName: char.name, chapters: [], totalCount: 0 };

    const regex = new RegExp(names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    const chapters: AppearanceResult['chapters'] = [];
    let totalCount = 0;
    let firstChapterId: string | undefined;

    for (const vol of novel.volumes) {
      for (const ch of vol.chapters) {
        const matches = ch.content.match(regex);
        if (matches && matches.length > 0) {
          chapters.push({
            chapterId: ch.id,
            chapterTitle: ch.title,
            volumeTitle: vol.title,
            count: matches.length,
          });
          totalCount += matches.length;
          if (!firstChapterId) firstChapterId = ch.id;
        }
      }
    }

    return { entityId: char.id, entityName: char.name, chapters, totalCount, firstChapterId };
  });
}

/**
 * 扫描地点在各章的出现情况
 */
export function scanLocationAppearances(novel: NovelDocumentContent): AppearanceResult[] {
  return novel.settings.locations.map(loc => {
    const name = loc.name;
    if (!name) return { entityId: loc.id, entityName: loc.name, chapters: [], totalCount: 0 };

    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const chapters: AppearanceResult['chapters'] = [];
    let totalCount = 0;

    for (const vol of novel.volumes) {
      for (const ch of vol.chapters) {
        const matches = ch.content.match(regex);
        if (matches && matches.length > 0) {
          chapters.push({
            chapterId: ch.id,
            chapterTitle: ch.title,
            volumeTitle: vol.title,
            count: matches.length,
          });
          totalCount += matches.length;
        }
      }
    }

    return { entityId: loc.id, entityName: loc.name, chapters, totalCount };
  });
}

export interface ConsistencyIssue {
  type: 'name-variant' | 'unregistered-name';
  chapterId: string;
  chapterTitle: string;
  detail: string;
  suggestion: string;
}

/**
 * 一致性检查：检测角色名拼写变体、未注册角色名
 */
export function checkConsistency(novel: NovelDocumentContent): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const registeredNames = new Set<string>();

  for (const c of novel.settings.characters) {
    registeredNames.add(c.name);
    for (const a of (c.aliases || [])) {
      if (a) registeredNames.add(a);
    }
  }

  // 简单检测：查找正文中被「」或""包裹的对话，提取前面出现的名字
  // 这是一个简化版本，检测正文中出现的类似人名模式（2-4个中文字符后跟"说/道/笑/怒/叹"等）
  const namePattern = /([\u4e00-\u9fff]{2,4})(?:说|道|笑|怒|叹|问|答|喊|叫|低声|冷冷|沉声|轻声)/g;

  for (const vol of novel.volumes) {
    for (const ch of vol.chapters) {
      const matches = ch.content.matchAll(namePattern);
      for (const m of matches) {
        const name = m[1];
        if (!registeredNames.has(name)) {
          // 检查是否是已注册名字的变体（编辑距离1）
          let isVariant = false;
          let closestName = '';
          for (const rn of registeredNames) {
            if (Math.abs(rn.length - name.length) <= 1 && levenshtein(rn, name) === 1) {
              isVariant = true;
              closestName = rn;
              break;
            }
          }

          if (isVariant) {
            issues.push({
              type: 'name-variant',
              chapterId: ch.id,
              chapterTitle: ch.title,
              detail: `"${name}" 疑似 "${closestName}" 的拼写变体`,
              suggestion: `将 "${name}" 改为 "${closestName}"`,
            });
          } else {
            issues.push({
              type: 'unregistered-name',
              chapterId: ch.id,
              chapterTitle: ch.title,
              detail: `"${name}" 未在设定集中注册`,
              suggestion: `在设定集中添加角色 "${name}"，或检查是否为错别字`,
            });
          }
        }
      }
    }
  }

  // 去重（同一章同一名字只报一次）
  const seen = new Set<string>();
  return issues.filter(issue => {
    const key = `${issue.chapterId}:${issue.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ═══════════════════════════════════════════════════════
// N3.5: 写作目标与进度分析
// ═══════════════════════════════════════════════════════

export interface WritingSpeedTrend {
  date: string;
  words: number;
}

/** 获取近 N 天的每日写作量 */
export function getDailyWritingTrend(novel: NovelDocumentContent, days: number = 30): WritingSpeedTrend[] {
  const stats = novel.metadata.dailyWordStats || [];
  const today = new Date();
  const result: WritingSpeedTrend[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const entry = stats.find(s => s.date === dateStr);
    result.push({ date: dateStr, words: entry?.words || 0 });
  }
  return result;
}

/** 计算日均写作量（近 N 天有写作的天数） */
export function getAverageDailyWords(novel: NovelDocumentContent, days: number = 30): { avg: number; activeDays: number; totalDays: number } {
  const trend = getDailyWritingTrend(novel, days);
  const activeDays = trend.filter(d => d.words > 0).length;
  const totalWords = trend.reduce((s, d) => s + d.words, 0);
  return {
    avg: activeDays > 0 ? Math.round(totalWords / activeDays) : 0,
    activeDays,
    totalDays: days,
  };
}

export interface GoalPrediction {
  /** 全书目标字数 */
  totalGoal: number;
  /** 当前总字数 */
  currentWords: number;
  /** 剩余字数 */
  remainingWords: number;
  /** 完成百分比 */
  completionPercent: number;
  /** 日均写作量（近30天活跃日） */
  dailyAvg: number;
  /** 预计完成日期（按日均速度） */
  estimatedDate: string | null;
  /** 预计剩余天数 */
  estimatedDays: number | null;
  /** 截止日期 */
  deadline: string | null;
  /** 截止日期前是否能完成 */
  canMeetDeadline: boolean | null;
  /** 如要在截止日期前完成，每日需写字数 */
  dailyNeededForDeadline: number | null;
  /** 今日字数 */
  todayWords: number;
  /** 今日目标 */
  dailyGoal: number;
  /** 今日目标完成率 */
  dailyGoalPercent: number;
}

/** 预测写作目标完成进度 */
export function predictGoalCompletion(novel: NovelDocumentContent): GoalPrediction {
  const totalGoal = novel.metadata.totalGoal || 0;
  const currentWords = getTotalWordCount(novel);
  const remainingWords = Math.max(0, totalGoal - currentWords);
  const completionPercent = totalGoal > 0 ? Math.round(currentWords / totalGoal * 100) : 0;

  const { avg: dailyAvg } = getAverageDailyWords(novel, 30);

  // 预测完成日期
  let estimatedDate: string | null = null;
  let estimatedDays: number | null = null;
  if (dailyAvg > 0 && remainingWords > 0) {
    estimatedDays = Math.ceil(remainingWords / dailyAvg);
    const d = new Date();
    d.setDate(d.getDate() + estimatedDays);
    estimatedDate = d.toISOString().slice(0, 10);
  } else if (remainingWords <= 0) {
    estimatedDays = 0;
    estimatedDate = new Date().toISOString().slice(0, 10);
  }

  // 截止日期分析
  const deadline = novel.metadata.deadline || null;
  let canMeetDeadline: boolean | null = null;
  let dailyNeededForDeadline: number | null = null;
  if (deadline && remainingWords > 0) {
    const deadlineDate = new Date(deadline + 'T23:59:59');
    const today = new Date();
    const daysLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    dailyNeededForDeadline = Math.ceil(remainingWords / daysLeft);
    canMeetDeadline = dailyAvg >= dailyNeededForDeadline;
  }

  const todayWords = getTodayWordCount(novel);
  const dailyGoal = novel.metadata.dailyGoal || 0;
  const dailyGoalPercent = dailyGoal > 0 ? Math.round(todayWords / dailyGoal * 100) : 0;

  return {
    totalGoal, currentWords, remainingWords, completionPercent,
    dailyAvg, estimatedDate, estimatedDays,
    deadline, canMeetDeadline, dailyNeededForDeadline,
    todayWords, dailyGoal, dailyGoalPercent,
  };
}

/** 写作速度趋势（字/小时，基于写作会话） */
export function getWritingSpeedHistory(novel: NovelDocumentContent, limit: number = 20): { date: string; wordsPerHour: number }[] {
  const sessions = novel.metadata.writingSessions || [];
  return sessions
    .filter(s => s.wordsWritten > 0 && s.endTime > s.startTime)
    .slice(-limit)
    .map(s => {
      const hours = (s.endTime - s.startTime) / (1000 * 60 * 60);
      return {
        date: s.date,
        wordsPerHour: hours > 0 ? Math.round(s.wordsWritten / hours) : 0,
      };
    });
}

/** 简单 Levenshtein 距离 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
