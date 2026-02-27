import { useSettingsStore } from '@/stores/useSettingsStore';

/**
 * 根据 AI 设置中的 maxContentLength 截断正文内容。
 * maxContentLength = 0 表示不限制。
 */
export function truncateContent(content: string): string {
  const maxLen = useSettingsStore.getState().ai.maxContentLength;
  if (!maxLen || maxLen <= 0) return content;
  return content.length > maxLen ? content.substring(0, maxLen) : content;
}
