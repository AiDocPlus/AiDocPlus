/**
 * diaryContext.ts — 日记 AI 上下文引擎
 *
 * 构建日记专属 system prompt，包含：
 * - 近期心情趋势
 * - 写作习惯摘要
 * - 当前条目上下文
 */
import type { DiaryDocumentContent, DiaryEntry } from './types';
import { MOOD_LABEL, MOOD_SCORE, WEATHER_LABEL, getEntryWordCount } from './types';

export type DiaryContextMode = 'current' | 'week' | 'month';

/** 构建日记专属系统提示词 */
export function buildDiarySystemPrompt(
  diary: DiaryDocumentContent,
  activeEntry: DiaryEntry | null,
  mode: DiaryContextMode = 'current',
): string {
  const parts: string[] = [];

  parts.push('你是一位专业的日记写作助手。你的任务是帮助用户记录和反思日常生活。');
  parts.push('语气温和、共情、不评判。使用开放式问题引导反思。尊重用户的隐私和情感边界。');
  parts.push('直接输出内容，不要添加额外说明。');
  parts.push('');

  // 当前条目上下文
  if (activeEntry) {
    parts.push(`【当前日记】`);
    parts.push(`日期: ${activeEntry.date}`);
    if (activeEntry.mood) parts.push(`心情: ${MOOD_LABEL[activeEntry.mood]}`);
    if (activeEntry.weather) {
      parts.push(`天气: ${WEATHER_LABEL[activeEntry.weather.type]}${activeEntry.weather.temperature !== undefined ? ` ${activeEntry.weather.temperature}°C` : ''}`);
    }
    if (activeEntry.location) parts.push(`位置: ${activeEntry.location}`);
    if (activeEntry.tags.length > 0) parts.push(`标签: ${activeEntry.tags.join(', ')}`);
    if (activeEntry.content) {
      const excerpt = activeEntry.content.length > 500 ? activeEntry.content.slice(0, 500) + '...' : activeEntry.content;
      parts.push(`内容:\n${excerpt}`);
    }
    parts.push('');
  }

  // 近期上下文
  if (mode === 'week' || mode === 'month') {
    const days = mode === 'week' ? 7 : 30;
    const context = getRecentContext(diary, days);
    if (context) {
      parts.push(`【近${days}天概览】`);
      parts.push(context);
      parts.push('');
    }
  }

  // 心情趋势
  const moodTrend = getMoodTrend(diary, 7);
  if (moodTrend) {
    parts.push(`【近7天心情趋势】${moodTrend}`);
    parts.push('');
  }

  return parts.join('\n');
}

/** 获取近期日记上下文摘要 */
function getRecentContext(diary: DiaryDocumentContent, days: number): string | null {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recentEntries = diary.entries
    .filter(e => e.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (recentEntries.length === 0) return null;

  const lines: string[] = [];
  lines.push(`共 ${recentEntries.length} 篇日记`);

  // 按日期列出摘要
  for (const entry of recentEntries.slice(0, 10)) {
    const mood = entry.mood ? MOOD_LABEL[entry.mood] : '';
    const excerpt = entry.content.replace(/\n/g, ' ').slice(0, 60);
    lines.push(`- ${entry.date} ${mood} ${excerpt}${entry.content.length > 60 ? '...' : ''}`);
  }
  if (recentEntries.length > 10) {
    lines.push(`... 等共 ${recentEntries.length} 篇`);
  }

  return lines.join('\n');
}

/** 获取近期心情趋势描述 */
function getMoodTrend(diary: DiaryDocumentContent, days: number): string | null {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const moods = diary.entries
    .filter(e => e.date >= cutoffStr && e.mood)
    .map(e => ({ date: e.date, score: MOOD_SCORE[e.mood!] }));

  if (moods.length < 2) return null;

  const avg = moods.reduce((s, m) => s + m.score, 0) / moods.length;
  const first = moods[moods.length - 1].score;
  const last = moods[0].score;
  const trend = last > first ? '上升' : last < first ? '下降' : '平稳';

  return `平均 ${avg.toFixed(1)}/5，趋势${trend}（${moods.length}条记录）`;
}

/** 获取上下文摘要信息（用于 UI 显示） */
export function getContextSummary(diary: DiaryDocumentContent, mode: DiaryContextMode): string {
  const today = new Date();
  const days = mode === 'current' ? 0 : mode === 'week' ? 7 : 30;

  if (days === 0) return '当前条目';

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const count = diary.entries.filter(e => e.date >= cutoffStr).length;
  const totalWords = diary.entries
    .filter(e => e.date >= cutoffStr)
    .reduce((s, e) => s + getEntryWordCount(e), 0);

  return `近${days}天 · ${count}篇 · ${totalWords}字`;
}

/** 日记 AI 快捷操作定义 */
export interface DiaryQuickAction {
  id: string;
  label: string;
  icon: string;
  promptTemplate: string;
}

export const DIARY_QUICK_ACTIONS: DiaryQuickAction[] = [
  {
    id: 'continue',
    label: '续写日记',
    icon: '📝',
    promptTemplate: '请根据以下日记内容，帮我续写，保持风格一致：\n\n{{content}}',
  },
  {
    id: 'reflect',
    label: '深度反思',
    icon: '🔍',
    promptTemplate: '请对今天的日记进行深度反思分析，帮助我理解自己的情感和行为模式：\n\n{{content}}',
  },
  {
    id: 'prompt',
    label: '写作提示',
    icon: '💡',
    promptTemplate: '根据我最近的日记，请给我一些今天可以写的话题和灵感提示。考虑我的心情和最近的经历。',
  },
  {
    id: 'weekly',
    label: '生成周报',
    icon: '📊',
    promptTemplate: '请帮我生成一份本周的日记周报。汇总近7天的关键事件、心情变化、成就和待改进事项，用结构化格式输出（概述、亮点、反思、下周展望）。',
  },
  {
    id: 'monthly',
    label: '生成月报',
    icon: '📅',
    promptTemplate: '请帮我生成一份本月的日记月报。汇总近30天的主要经历、心情趋势、成长收获和目标完成情况，用结构化格式输出。',
  },
  {
    id: 'mood-review',
    label: '心情复盘',
    icon: '💭',
    promptTemplate: '请分析我近期日记中的心情变化趋势，找出心情波动的可能原因，并给出调节建议。关注情绪转折点和反复出现的主题。',
  },
  {
    id: 'style',
    label: '风格分析',
    icon: '✍️',
    promptTemplate: '请分析我日记的写作风格特点，包括：用词偏好、句式特点、主题倾向、情感表达模式。给出具体的提升建议。\n\n{{content}}',
  },
  {
    id: 'awareness',
    label: '自我觉察',
    icon: '🧠',
    promptTemplate: '请引导我进行一次情绪觉察练习。基于我最近的日记，帮助我识别隐藏的情绪模式和内心需求。用温和引导的方式提问。',
  },
  {
    id: 'tomorrow',
    label: '明日建议',
    icon: '🔮',
    promptTemplate: '基于今天的日记反思，请给我一些明天可以做的事情建议，帮助我更好地生活。\n\n{{content}}',
  },
  {
    id: 'polish',
    label: '润色美化',
    icon: '✨',
    promptTemplate: '请对以下日记文字进行润色美化，提升表达质量，但保持原意和个人风格：\n\n{{content}}',
  },
  {
    id: 'gratitude',
    label: '感恩引导',
    icon: '🙏',
    promptTemplate: '请帮我从今天的经历中发现值得感恩的事情，引导我以感恩的心态看待生活。\n\n{{content}}',
  },
  // D1.1: 报告生成
  {
    id: 'yearly',
    label: '年度回顾',
    icon: '📆',
    promptTemplate: '请帮我生成一份年度日记回顾。分析全年的主要经历、成长轨迹、心情变化趋势、重要事件和里程碑。用结构化格式输出（年度关键词、季度概述、最难忘时刻、成长收获、明年展望）。',
  },
  // D1.2: 情绪洞察
  {
    id: 'emotion-insight',
    label: '情绪洞察',
    icon: '🔮',
    promptTemplate: '{{emotionInsight}}',
  },
  {
    id: 'emotion-trigger',
    label: '情绪触发器',
    icon: '⚡',
    promptTemplate: '请分析我近期日记中的情绪变化，帮我找出情绪触发器：\n1. 哪些事件/人/地点让我心情变好？\n2. 哪些因素导致心情低落？\n3. 我的情绪模式有什么规律？\n\n基于分析给出具体的情绪管理建议。',
  },
  {
    id: 'habit-insight',
    label: '习惯分析',
    icon: '📊',
    promptTemplate: '请分析我的日记写作习惯和生活规律：\n1. 写作频率和时间偏好\n2. 常见的主题和话题\n3. 情绪与活动的关联\n4. 建议如何优化日常习惯以提升幸福感',
  },
];

/** 检测是否连续多天心情低落 */
export function detectMoodAlert(diary: DiaryDocumentContent): string | null {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recentMoods = diary.entries
    .filter(e => e.date >= cutoffStr && e.mood && !e.deletedAt)
    .map(e => MOOD_SCORE[e.mood!]);

  if (recentMoods.length < 3) return null;
  const avg = recentMoods.reduce((s, v) => s + v, 0) / recentMoods.length;
  if (avg <= 2.5) {
    return 'mood_alert_low';
  }
  return null;
}

/** 生成每日写作提示（基于近期日记+历史上的今天） */
export function buildDailyPromptRequest(diary: DiaryDocumentContent): string {
  const today = new Date().toISOString().slice(0, 10);
  const mmdd = today.slice(5);
  const onThisDay = diary.entries
    .filter(e => e.date.slice(5) === mmdd && e.date !== today && !e.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const recentEntries = diary.entries
    .filter(e => !e.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const parts = ['请给我3个今天可以写的日记话题/灵感提示。'];
  if (recentEntries.length > 0) {
    parts.push('我最近的日记主题：');
    for (const e of recentEntries) {
      parts.push(`- ${e.date}: ${e.title || e.content.slice(0, 40)}`);
    }
  } else {
    parts.push('这是一本新日记本，还没有任何条目。请给出适合初次写日记的通用话题，如当日心情、生活目标、感恩等。');
  }
  if (onThisDay.length > 0) {
    parts.push(`历史上的今天（${mmdd}）：`);
    for (const e of onThisDay) {
      parts.push(`- ${e.date}: ${e.title || e.content.slice(0, 40)}`);
    }
  }
  parts.push('请给出简短有启发性的提示，每个1-2句话。');
  return parts.join('\n');
}
