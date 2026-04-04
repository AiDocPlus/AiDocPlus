/**
 * diaryImport.ts — 日记导入解析逻辑
 *
 * 4种格式：自身JSON / Day One JSON / Markdown / 纯文本
 */
import type { DiaryDocumentContent, DiaryEntry } from './types';
import { genId, toLocalDateStr } from './types';

// ═══════════════════════════════════════════════════════
// 导入结果
// ═══════════════════════════════════════════════════════

export interface ImportedEntry {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  title: string;
  content: string;
  mood?: string;
  weather?: string;
  tags: string[];
  starred: boolean;
  location?: string;
}

export interface ImportResult {
  format: 'aidocplus-json' | 'dayone-json' | 'markdown' | 'plaintext' | 'csv' | 'unknown';
  entries: ImportedEntry[];
  errors: string[];
  dateRange: { from: string; to: string } | null;
}

// ═══════════════════════════════════════════════════════
// 自动检测格式
// ═══════════════════════════════════════════════════════

export function detectFormat(content: string): ImportResult['format'] {
  const trimmed = content.trim();
  if (!trimmed) return 'unknown';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (json.version === 1 && Array.isArray(json.entries)) return 'aidocplus-json';
      if (json.exportedAt && Array.isArray(json.entries)) return 'aidocplus-json';
      if (Array.isArray(json.entries) && json.entries[0]?.creationDate) return 'dayone-json';
      if (Array.isArray(json) && json[0]?.creationDate) return 'dayone-json';
      return 'aidocplus-json'; // 尝试作为自身格式
    } catch {
      return 'unknown';
    }
  }
  // D4.2: CSV 检测
  const firstLine = trimmed.split('\n')[0];
  if (/^["']?(?:date|日期|Date)["']?[,\t]/.test(firstLine)) return 'csv';
  if (trimmed.startsWith('#') || /^\d{4}-\d{2}-\d{2}/.test(trimmed)) return 'markdown';
  return 'plaintext';
}

// ═══════════════════════════════════════════════════════
// 解析：自身 JSON 格式
// ═══════════════════════════════════════════════════════

export function parseAidocplusJson(content: string): ImportResult {
  const errors: string[] = [];
  try {
    const json = JSON.parse(content);
    const entries: ImportedEntry[] = [];
    const rawEntries = json.entries || [];
    for (const e of rawEntries) {
      if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) { errors.push(`跳过日期格式无效的条目: ${e.date || '(空)'}`); continue; }
      entries.push({
        date: e.date,
        time: e.time || '00:00',
        title: e.title || '',
        content: e.content || '',
        mood: e.mood,
        weather: e.weather?.type || e.weather,
        tags: Array.isArray(e.tags) ? e.tags : [],
        starred: !!e.starred,
        location: e.location,
      });
    }
    const dates = entries.map(e => e.date).sort();
    return {
      format: 'aidocplus-json',
      entries,
      errors,
      dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    };
  } catch (err) {
    return { format: 'aidocplus-json', entries: [], errors: [`JSON 解析失败: ${err}`], dateRange: null };
  }
}

// ═══════════════════════════════════════════════════════
// 解析：Day One JSON 格式
// ═══════════════════════════════════════════════════════

export function parseDayOneJson(content: string): ImportResult {
  const errors: string[] = [];
  try {
    const json = JSON.parse(content);
    const rawEntries = json.entries || (Array.isArray(json) ? json : []);
    const entries: ImportedEntry[] = [];
    for (const e of rawEntries) {
      const creationDate = e.creationDate || e.creation_date;
      if (!creationDate) { errors.push(`跳过缺少 creationDate 的条目`); continue; }
      const d = new Date(creationDate);
      const date = toLocalDateStr(d);
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const text = e.text || e.richText || '';
      const tags = Array.isArray(e.tags) ? e.tags : [];
      const weather = e.weather?.conditionsDescription;
      const location = e.location?.placeName || e.location?.localityName;
      entries.push({
        date, time,
        title: '',
        content: text,
        mood: undefined,
        weather,
        tags,
        starred: !!e.starred,
        location,
      });
    }
    const dates = entries.map(e => e.date).sort();
    return {
      format: 'dayone-json',
      entries,
      errors,
      dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    };
  } catch (err) {
    return { format: 'dayone-json', entries: [], errors: [`Day One JSON 解析失败: ${err}`], dateRange: null };
  }
}

// ═══════════════════════════════════════════════════════
// 解析：Markdown 格式（按日期标题分割）
// ═══════════════════════════════════════════════════════

export function parseMarkdown(content: string): ImportResult {
  const errors: string[] = [];
  const entries: ImportedEntry[] = [];
  // 按 ## 或 ### 日期标题分割，支持 "YYYY-MM-DD"、"YYYY年M月D日"
  const dateRegex = /^#{1,3}\s+(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)\s*(.*)/;
  const lines = content.split('\n');
  let currentEntry: ImportedEntry | null = null;
  const contentLines: string[] = [];

  const flushEntry = () => {
    if (currentEntry) {
      currentEntry.content = contentLines.join('\n').trim();
      if (currentEntry.content || currentEntry.title) entries.push(currentEntry);
      contentLines.length = 0;
    }
  };

  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      flushEntry();
      let dateStr = match[1]
        .replace(/年/, '-').replace(/月/, '-').replace(/日/, '')
        .replace(/\//g, '-');
      // 标准化为 YYYY-MM-DD
      const parts = dateStr.split('-').map(s => s.trim());
      if (parts.length === 3) {
        dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      const title = match[2]?.trim() || '';
      currentEntry = {
        date: dateStr, time: '00:00', title, content: '',
        tags: [], starred: false,
      };
    } else if (currentEntry) {
      contentLines.push(line);
    }
  }
  flushEntry();

  if (entries.length === 0 && content.trim()) {
    // 无法按日期分割，整体作为一条
    const today = toLocalDateStr(new Date());
    entries.push({
      date: today, time: '00:00', title: '导入的日记',
      content: content.trim(), tags: ['导入'], starred: false,
    });
  }

  const dates = entries.map(e => e.date).sort();
  return {
    format: 'markdown',
    entries,
    errors,
    dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}

// ═══════════════════════════════════════════════════════
// 解析：纯文本（按空行或日期分割）
// ═══════════════════════════════════════════════════════

export function parsePlainText(content: string): ImportResult {
  const entries: ImportedEntry[] = [];
  // 尝试按 "YYYY-MM-DD" 行分割
  const blocks = content.split(/\n(?=\d{4}-\d{2}-\d{2})/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const firstLine = trimmed.split('\n')[0];
    const dateMatch = firstLine.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)/);
    if (dateMatch) {
      entries.push({
        date: dateMatch[1],
        time: '00:00',
        title: dateMatch[2]?.trim() || '',
        content: trimmed.split('\n').slice(1).join('\n').trim(),
        tags: [], starred: false,
      });
    } else {
      // 无日期，用今天
      const today = toLocalDateStr(new Date());
      entries.push({
        date: today, time: '00:00', title: '',
        content: trimmed, tags: ['导入'], starred: false,
      });
    }
  }
  const dates = entries.map(e => e.date).sort();
  return {
    format: 'plaintext',
    entries,
    errors: [],
    dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}

// ═══════════════════════════════════════════════════════
// 统一入口
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// D4.2: 解析 CSV 格式（逗号/制表符分隔）
// ═══════════════════════════════════════════════════════

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inQuote) {
      inQuote = true;
    } else if (ch === '"' && inQuote) {
      if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
      else inQuote = false;
    } else if (ch === sep && !inQuote) {
      result.push(current.trim()); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSV(content: string): ImportResult {
  const errors: string[] = [];
  const entries: ImportedEntry[] = [];
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { format: 'csv', entries: [], errors: ['CSV 至少需要表头+1行数据'], dateRange: null };

  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/["']/g, ''));

  const dateIdx = headers.findIndex(h => ['date', '日期'].includes(h));
  const contentIdx = headers.findIndex(h => ['content', '内容', 'text', '正文'].includes(h));
  const titleIdx = headers.findIndex(h => ['title', '标题'].includes(h));
  const moodIdx = headers.findIndex(h => ['mood', '心情'].includes(h));
  const tagsIdx = headers.findIndex(h => ['tags', '标签'].includes(h));
  const timeIdx = headers.findIndex(h => ['time', '时间'].includes(h));
  const locationIdx = headers.findIndex(h => ['location', '位置', '地点'].includes(h));

  if (dateIdx < 0) return { format: 'csv', entries: [], errors: ['CSV 表头未找到 date/日期 列'], dateRange: null };
  if (contentIdx < 0) return { format: 'csv', entries: [], errors: ['CSV 表头未找到 content/内容 列'], dateRange: null };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], sep);
    const date = (cols[dateIdx] || '').replace(/["']/g, '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`第${i + 1}行日期无效: "${date}"`); continue; }
    const text = (cols[contentIdx] || '').replace(/["']/g, '').replace(/\\n/g, '\n');
    const tags = tagsIdx >= 0 ? (cols[tagsIdx] || '').replace(/["']/g, '').split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [];
    entries.push({
      date,
      time: timeIdx >= 0 ? (cols[timeIdx] || '00:00').replace(/["']/g, '') : '00:00',
      title: titleIdx >= 0 ? (cols[titleIdx] || '').replace(/["']/g, '') : '',
      content: text,
      mood: moodIdx >= 0 ? (cols[moodIdx] || '').replace(/["']/g, '') || undefined : undefined,
      tags, starred: false,
      location: locationIdx >= 0 ? (cols[locationIdx] || '').replace(/["']/g, '') || undefined : undefined,
    });
  }
  const dates = entries.map(e => e.date).sort();
  return { format: 'csv', entries, errors, dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null };
}

export function parseImport(content: string): ImportResult {
  const format = detectFormat(content);
  switch (format) {
    case 'aidocplus-json': return parseAidocplusJson(content);
    case 'dayone-json': return parseDayOneJson(content);
    case 'csv': return parseCSV(content);
    case 'markdown': return parseMarkdown(content);
    case 'plaintext': return parsePlainText(content);
    default: return { format: 'unknown', entries: [], errors: ['无法识别的文件格式'], dateRange: null };
  }
}

// ═══════════════════════════════════════════════════════
// 合并导入条目到日记
// ═══════════════════════════════════════════════════════

export type ConflictMode = 'skip' | 'overwrite' | 'append';

export function mergeImportedEntries(
  diary: DiaryDocumentContent,
  imported: ImportedEntry[],
  journalId: string,
  conflictMode: ConflictMode,
): { diary: DiaryDocumentContent; added: number; skipped: number; overwritten: number } {
  let updated = { ...diary, entries: [...diary.entries] };
  let added = 0, skipped = 0, overwritten = 0;
  const now = Date.now();

  for (const imp of imported) {
    // 检查冲突：同日期+同标题视为冲突
    const existing = updated.entries.find(e =>
      e.date === imp.date && e.title === imp.title && !e.deletedAt
    );

    if (existing) {
      switch (conflictMode) {
        case 'skip':
          skipped++;
          continue;
        case 'overwrite':
          updated.entries = updated.entries.map(e =>
            e.id === existing.id
              ? { ...e, content: imp.content, title: imp.title, mood: imp.mood, weather: imp.weather, tags: imp.tags, location: imp.location, time: imp.time, updatedAt: now }
              : e
          );
          overwritten++;
          continue;
        case 'append':
          // 作为新条目追加
          break;
      }
    }

    const entry: DiaryEntry = {
      id: genId('de'),
      journalId,
      date: imp.date,
      time: imp.time,
      title: imp.title,
      content: imp.content,
      tags: imp.tags,
      mood: imp.mood,
      weather: imp.weather ? { type: imp.weather } : undefined,
      wordCount: imp.content.replace(/\s/g, '').length,
      createdAt: now,
      updatedAt: now,
      starred: imp.starred,
      location: imp.location,
    };
    updated.entries.push(entry);
    added++;
  }

  return { diary: updated, added, skipped, overwritten };
}
