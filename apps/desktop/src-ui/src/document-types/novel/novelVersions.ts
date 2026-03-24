/**
 * novelVersions.ts — 章节级版本快照管理
 *
 * Phase 11: 自动保存快照、diff 对比、恢复
 */

export interface ChapterSnapshot {
  id: string;
  timestamp: number;
  content: string;
  wordCount: number;
  label?: string;
}

import type { StorageLike } from './constants';

const MAX_SNAPSHOTS = 100;

function storageKey(chapterId: string): string {
  return `_novel_snapshots_${chapterId}`;
}

export function loadSnapshots(storage: StorageLike, chapterId: string): ChapterSnapshot[] {
  return storage.get<ChapterSnapshot[]>(storageKey(chapterId)) || [];
}

export function saveSnapshot(storage: StorageLike, chapterId: string, content: string, label?: string): ChapterSnapshot[] {
  const snapshots = loadSnapshots(storage, chapterId);
  const wc = content.replace(/\s/g, '').length;
  // 避免保存与最新快照完全相同的内容
  if (snapshots.length > 0 && snapshots[snapshots.length - 1].content === content) {
    return snapshots;
  }
  const snap: ChapterSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    content,
    wordCount: wc,
    label,
  };
  const updated = [...snapshots, snap];
  // 清理：保留重要版本（有 label）+ 最新 MAX_SNAPSHOTS 个
  const important = updated.filter(s => s.label);
  const regular = updated.filter(s => !s.label);
  const trimmed = [...important, ...regular.slice(-MAX_SNAPSHOTS)];
  trimmed.sort((a, b) => a.timestamp - b.timestamp);
  storage.set(storageKey(chapterId), trimmed);
  return trimmed;
}

export function toggleSnapshotLabel(storage: StorageLike, chapterId: string, snapshotId: string, label?: string): ChapterSnapshot[] {
  const snapshots = loadSnapshots(storage, chapterId);
  const updated = snapshots.map(s => s.id === snapshotId ? { ...s, label: s.label ? undefined : (label || '重要版本') } : s);
  storage.set(storageKey(chapterId), updated);
  return updated;
}

/** 简单行级 diff */
export interface DiffLine {
  type: 'same' | 'add' | 'remove';
  content: string;
}

// ═══ N6.1: 自动备份系统 ═══

export interface AutoBackupConfig {
  enabled: boolean;
  /** 自动备份间隔（分钟） */
  intervalMinutes: 5 | 15 | 30 | 60;
  /** 保留策略：最近 N 个常规备份 */
  maxRegularBackups: number;
  /** 保留策略：每日保留 N 天 */
  dailyRetentionDays: number;
  /** 保留策略：每周保留 N 周 */
  weeklyRetentionWeeks: number;
}

const AUTO_BACKUP_CONFIG_KEY = '_novel_auto_backup_config';
const DEFAULT_CONFIG: AutoBackupConfig = {
  enabled: true,
  intervalMinutes: 15,
  maxRegularBackups: 50,
  dailyRetentionDays: 30,
  weeklyRetentionWeeks: 12,
};

export function loadAutoBackupConfig(storage: StorageLike): AutoBackupConfig {
  return storage.get<AutoBackupConfig>(AUTO_BACKUP_CONFIG_KEY) || { ...DEFAULT_CONFIG };
}

export function saveAutoBackupConfig(storage: StorageLike, config: AutoBackupConfig): void {
  storage.set(AUTO_BACKUP_CONFIG_KEY, config);
}

/** 应用备份保留策略：保留重要版本 + 最新 N 个 + 每日/每周各一个 */
export function applyRetentionPolicy(snapshots: ChapterSnapshot[], config: AutoBackupConfig): ChapterSnapshot[] {
  const important = snapshots.filter(s => s.label);
  const regular = snapshots.filter(s => !s.label);

  // 最新 N 个
  const recent = regular.slice(-config.maxRegularBackups);

  // 每日保留（取每天最后一个）
  const dailyCutoff = Date.now() - config.dailyRetentionDays * 24 * 60 * 60 * 1000;
  const dailyMap = new Map<string, ChapterSnapshot>();
  for (const s of regular) {
    if (s.timestamp >= dailyCutoff) {
      const day = new Date(s.timestamp).toISOString().slice(0, 10);
      dailyMap.set(day, s);
    }
  }

  // 每周保留（取每周最后一个）
  const weeklyCutoff = Date.now() - config.weeklyRetentionWeeks * 7 * 24 * 60 * 60 * 1000;
  const weeklyMap = new Map<string, ChapterSnapshot>();
  for (const s of regular) {
    if (s.timestamp >= weeklyCutoff) {
      const d = new Date(s.timestamp);
      const week = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`;
      weeklyMap.set(week, s);
    }
  }

  // 合并去重
  const idSet = new Set<string>();
  const result: ChapterSnapshot[] = [];
  for (const s of [...important, ...recent, ...dailyMap.values(), ...weeklyMap.values()]) {
    if (!idSet.has(s.id)) {
      idSet.add(s.id);
      result.push(s);
    }
  }
  return result.sort((a, b) => a.timestamp - b.timestamp);
}

/** 获取备份统计信息 */
export function getBackupStats(storage: StorageLike, chapterId: string): {
  total: number;
  important: number;
  oldest: number | null;
  newest: number | null;
  storageEstimate: number;
} {
  const snaps = loadSnapshots(storage, chapterId);
  const important = snaps.filter(s => s.label).length;
  const oldest = snaps.length > 0 ? snaps[0].timestamp : null;
  const newest = snaps.length > 0 ? snaps[snaps.length - 1].timestamp : null;
  const storageEstimate = snaps.reduce((s, snap) => s + snap.content.length * 2, 0);
  return { total: snaps.length, important, oldest, newest, storageEstimate };
}

export function diffTexts(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  // LCS-based diff

  // 简单 LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  let i = m, j = n;
  const ops: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: 'same', content: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', content: newLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'remove', content: oldLines[i - 1] });
      i--;
    }
  }

  return ops;
}
