/**
 * 纯前端文本差异计算工具
 * 基于 Myers diff 算法的简化实现
 */

export type DiffType = 'add' | 'remove' | 'equal';

export interface DiffSegment {
  type: DiffType;
  value: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

export type DiffMode = 'line' | 'word' | 'char';

/**
 * 按指定模式拆分文本
 */
function splitByMode(text: string, mode: DiffMode): string[] {
  switch (mode) {
    case 'line':
      return text.split('\n');
    case 'word':
      return text.split(/(\s+)/);
    case 'char':
      return text.split('');
  }
}

/**
 * 计算两个序列的最长公共子序列（LCS）表
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * 从 LCS 表回溯生成差异
 */
function backtrack(dp: number[][], a: string[], b: string[]): DiffSegment[] {
  const result: DiffSegment[] = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'equal', value: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', value: b[j - 1] });
      j--;
    } else if (i > 0) {
      result.unshift({ type: 'remove', value: a[i - 1] });
      i--;
    }
  }

  return result;
}

/**
 * 合并相邻的同类型差异段
 */
function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];

  const merged: DiffSegment[] = [{ ...segments[0] }];
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    if (last.type === segments[i].type) {
      last.value += segments[i].value;
    } else {
      merged.push({ ...segments[i] });
    }
  }
  return merged;
}

/**
 * 计算两段文本的差异
 */
export function computeDiff(left: string, right: string, mode: DiffMode): DiffSegment[] {
  if (left === right) {
    return left ? [{ type: 'equal', value: left }] : [];
  }

  const a = splitByMode(left, mode);
  const b = splitByMode(right, mode);

  // 对于大文本，限制计算规模
  const MAX_TOKENS = 10000;
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    // 降级为行模式
    if (mode !== 'line') {
      return computeDiff(left, right, 'line');
    }
    // 行数仍然过多，截断
    const aSlice = a.slice(0, MAX_TOKENS);
    const bSlice = b.slice(0, MAX_TOKENS);
    const dp = lcsTable(aSlice, bSlice);
    const raw = backtrack(dp, aSlice, bSlice);
    // 行模式需要在值之间加换行符
    const withSep = raw.map(s => ({ ...s, value: s.value }));
    return mergeSegments(withSep);
  }

  const dp = lcsTable(a, b);
  const raw = backtrack(dp, a, b);

  // 行模式：给每个段的值加回换行符
  if (mode === 'line') {
    return mergeSegments(raw.map((s, idx) => ({
      ...s,
      value: s.value + (idx < raw.length - 1 ? '\n' : ''),
    })));
  }

  return mergeSegments(raw);
}

/**
 * 统计差异
 */
export function computeStats(segments: DiffSegment[]): DiffStats {
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const seg of segments) {
    const len = seg.value.length;
    switch (seg.type) {
      case 'add': additions += len; break;
      case 'remove': deletions += len; break;
      case 'equal': unchanged += len; break;
    }
  }

  return { additions, deletions, unchanged };
}

/**
 * 将差异结果格式化为统一 diff 文本
 */
export function formatUnifiedDiff(segments: DiffSegment[]): string {
  const lines: string[] = [];
  for (const seg of segments) {
    const segLines = seg.value.split('\n');
    for (const line of segLines) {
      if (!line && segLines.indexOf(line) === segLines.length - 1) continue;
      switch (seg.type) {
        case 'add': lines.push(`+ ${line}`); break;
        case 'remove': lines.push(`- ${line}`); break;
        case 'equal': lines.push(`  ${line}`); break;
      }
    }
  }
  return lines.join('\n');
}
