/**
 * novelAnalysis.ts — 小说正文扫描/分析工具函数
 *
 * Phase 7: 设定集交叉引用增强
 * - scanCharacterAppearances: 扫描角色在各章的出场情况
 * - scanLocationAppearances: 扫描地点在各章的出现情况
 * - checkConsistency: 一致性检查
 */

import type { NovelDocumentContent } from './types';

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
