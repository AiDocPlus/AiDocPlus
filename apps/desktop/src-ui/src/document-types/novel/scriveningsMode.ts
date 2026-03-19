/**
 * scriveningsMode.ts — Scrivenings 拼接/拆分算法
 *
 * 将多个场景拼接为单一长文档编辑，编辑后拆分回各场景
 */

import type { NovelScene } from './types';

const SEPARATOR_PREFIX = '\n\n---✦ ';
const SEPARATOR_SUFFIX = ' ✦---\n\n';

/**
 * 将多个场景拼接为单一文本（带分隔符标记场景标题）
 */
export function joinScenes(scenes: NovelScene[]): string {
  const sorted = [...scenes].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.map(sc => {
    return `${SEPARATOR_PREFIX}${sc.title}${SEPARATOR_SUFFIX}${sc.content}`;
  }).join('');
}

/**
 * 将拼接后的文本拆分回各场景内容
 * 返回 { title, content }[] 数组，按出现顺序
 */
export function splitFromJoined(joinedText: string): { title: string; content: string }[] {
  const regex = /---✦ (.+?) ✦---/g;
  const result: { title: string; content: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(joinedText)) !== null) {
    // 如果上一个分隔符后有内容，提取前一个场景的内容
    if (result.length > 0) {
      const prevContent = joinedText.slice(lastIndex, match.index).trim();
      result[result.length - 1].content = prevContent;
    }
    result.push({ title: match[1], content: '' });
    lastIndex = match.index + match[0].length;
  }

  // 最后一个场景的内容
  if (result.length > 0) {
    result[result.length - 1].content = joinedText.slice(lastIndex).trim();
  }

  return result;
}

/**
 * 将拆分结果应用回场景数组（按标题匹配更新 content）
 * 如果标题不匹配（用户可能修改了分隔符），按顺序回写
 */
export function applyJoinedToScenes(scenes: NovelScene[], splitResult: { title: string; content: string }[]): NovelScene[] {
  const sorted = [...scenes].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.map((sc, i) => {
    if (i < splitResult.length) {
      return { ...sc, content: splitResult[i].content };
    }
    return sc;
  });
}
