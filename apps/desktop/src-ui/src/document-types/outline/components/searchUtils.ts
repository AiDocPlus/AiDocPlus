/**
 * 搜索工具函数（独立文件避免 Fast Refresh 警告）
 */

/**
 * 转义正则表达式特殊字符
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 高亮搜索结果文本
 */
export function highlightSearchMatches(
  text: string,
  query: string,
  caseSensitive = false,
  useRegex = false
): Array<{ text: string; isMatch: boolean }> {
  if (!query.trim()) {
    return [{ text, isMatch: false }];
  }

  const flags = caseSensitive ? 'g' : 'gi';
  let regex: RegExp;

  try {
    if (useRegex) {
      regex = new RegExp(query, flags);
    } else {
      regex = new RegExp(escapeRegex(query), flags);
    }
  } catch {
    return [{ text, isMatch: false }];
  }

  const result: Array<{ text: string; isMatch: boolean }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    if (match.index !== undefined) {
      if (match.index > lastIndex) {
        result.push({ text: text.slice(lastIndex, match.index), isMatch: false });
      }
      result.push({ text: match[0], isMatch: true });
      lastIndex = match.index + match[0].length;
    }
  }

  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex), isMatch: false });
  }

  return result;
}
