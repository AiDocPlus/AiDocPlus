/**
 * diaryExport.ts — 日记导出逻辑
 *
 * 6种格式：Markdown / 纯文本 / DOCX / PDF / JSON / HTML
 * 其中 DOCX/PDF/HTML 复用 Rust 后端 native_export
 */
import type { DiaryDocumentContent, DiaryEntry } from './types';
import { MOOD_EMOJI, MOOD_LABEL, WEATHER_EMOJI, WEATHER_LABEL, getEntryWordCount } from './types';

export interface DiaryExportOptions {
  range: 'all' | 'dateRange' | 'journal' | 'tag' | 'starred';
  dateFrom?: string;
  dateTo?: string;
  journalId?: string;
  tag?: string;
  includeMood: boolean;
  includeWeather: boolean;
  includeTags: boolean;
  includeLocation: boolean;
  includeWordCount: boolean;
  includeTimestamp: boolean;
  sortOrder: 'asc' | 'desc';
  labels?: ExportLabels;
}

export interface ExportLabels {
  title?: string;           // 默认 '我的日记'
  weekDays?: string[];      // 默认 ['周日','周一',...,'周六']
  wordUnit?: string;        // 默认 '字'
  createdLabel?: string;    // 默认 '创建:'
  totalSuffix?: string;     // 默认 '条日记'
}

export const DEFAULT_EXPORT_OPTIONS: DiaryExportOptions = {
  range: 'all',
  includeMood: true,
  includeWeather: true,
  includeTags: true,
  includeLocation: false,
  includeWordCount: true,
  includeTimestamp: false,
  sortOrder: 'asc',
};

/** 根据选项筛选条目 */
function filterEntries(diary: DiaryDocumentContent, opts: DiaryExportOptions): DiaryEntry[] {
  let entries = [...diary.entries].filter(e => !e.deletedAt);

  switch (opts.range) {
    case 'dateRange':
      if (opts.dateFrom) entries = entries.filter(e => e.date >= opts.dateFrom!);
      if (opts.dateTo) entries = entries.filter(e => e.date <= opts.dateTo!);
      break;
    case 'journal':
      if (opts.journalId) entries = entries.filter(e => e.journalId === opts.journalId);
      break;
    case 'tag':
      if (opts.tag) entries = entries.filter(e => e.tags.includes(opts.tag!));
      break;
    case 'starred':
      entries = entries.filter(e => e.starred);
      break;
  }

  entries.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return opts.sortOrder === 'asc' ? cmp : -cmp;
  });

  return entries;
}

const DEFAULT_WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 构建条目元数据行 */
function buildMetaLine(entry: DiaryEntry, diary: DiaryDocumentContent, opts: DiaryExportOptions): string {
  const lb = opts.labels || {};
  const parts: string[] = [];
  if (opts.includeMood && entry.mood) parts.push(`${MOOD_EMOJI[entry.mood]} ${MOOD_LABEL[entry.mood]}`);
  if (opts.includeWeather && entry.weather) {
    parts.push(`${WEATHER_EMOJI[entry.weather.type]} ${WEATHER_LABEL[entry.weather.type]}${entry.weather.temperature !== undefined ? ` ${entry.weather.temperature}°C` : ''}`);
  }
  if (opts.includeLocation && entry.location) parts.push(`📍 ${entry.location}`);
  if (opts.includeTags && entry.tags.length > 0) parts.push(`🏷 ${entry.tags.map(tg => `#${tg}`).join(' ')}`);
  if (opts.includeWordCount) parts.push(`${getEntryWordCount(entry)}${lb.wordUnit || '字'}`);
  if (opts.includeTimestamp) parts.push(`${lb.createdLabel || '创建:'} ${entry.time}`);

  const journal = diary.journals.find(j => j.id === entry.journalId);
  if (journal) parts.push(`${journal.icon} ${journal.name}`);

  return parts.join(' · ');
}

/** 导出为 Markdown */
export function exportToMarkdown(diary: DiaryDocumentContent, opts: DiaryExportOptions): string {
  const lb = opts.labels || {};
  const weekDays = lb.weekDays || DEFAULT_WEEK_DAYS;
  const entries = filterEntries(diary, opts);
  const parts: string[] = [];
  parts.push(`# ${lb.title || '我的日记'}\n`);

  let currentMonth = '';
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    if (month !== currentMonth) {
      currentMonth = month;
      const [y, m] = month.split('-');
      parts.push(`\n## ${y}年${parseInt(m)}月\n`);
    }

    const d = new Date(entry.date + 'T00:00:00');
    const title = entry.title || entry.time;
    parts.push(`### ${entry.date} ${weekDays[d.getDay()]} ${title}\n`);

    const meta = buildMetaLine(entry, diary, opts);
    if (meta) parts.push(`> ${meta}\n`);

    if (entry.content) {
      parts.push(entry.content);
      parts.push('');
    }

    parts.push('---\n');
  }

  parts.push(`\n*共 ${entries.length} ${lb.totalSuffix || '条日记'}*`);
  return parts.join('\n');
}

/** 导出为纯文本 */
export function exportToPlainText(diary: DiaryDocumentContent, opts: DiaryExportOptions): string {
  const entries = filterEntries(diary, opts);
  const parts: string[] = [];

  for (const entry of entries) {
    const title = entry.title || entry.time;
    parts.push(`${entry.date} ${title}`);
    const meta = buildMetaLine(entry, diary, opts);
    if (meta) parts.push(meta);
    if (entry.content) {
      const stripped = entry.content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/^>\s+/gm, '')
        .replace(/^\|.*\|$/gm, m => m.replace(/\|/g, ' ').replace(/[-:]+/g, '').trim());
      parts.push(stripped);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/** 导出为 JSON（完整数据，可导入） */
export function exportToJSON(diary: DiaryDocumentContent, opts: DiaryExportOptions): string {
  const entries = filterEntries(diary, opts);
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    entries: entries.map(e => ({
      id: e.id,
      date: e.date,
      time: e.time,
      title: e.title,
      content: e.content,
      mood: e.mood,
      weather: e.weather,
      location: e.location,
      tags: e.tags,
      starred: e.starred,
      colorLabel: e.colorLabel,
      wordCount: getEntryWordCount(e),
      journal: diary.journals.find(j => j.id === e.journalId)?.name,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
  };
  return JSON.stringify(exportData, null, 2);
}
