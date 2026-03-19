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

const MAX_SNAPSHOTS = 100;

interface StorageLike {
  get<T>(key: string): T | null | undefined;
  set(key: string, value: unknown): void;
}

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
