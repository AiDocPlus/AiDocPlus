/**
 * diaryImport.ts — 日记导入解析逻辑
 *
 * 4种格式：自身JSON / Day One JSON / Markdown / 纯文本
 */
import type { DiaryDocumentContent, DiaryEntry } from './types';

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
  format: 'aidocplus-json' | 'dayone-json' | 'markdown' | 'plaintext' | 'unknown';
  entries: ImportedEntry[];
  errors: string[];
  dateRange: { from: string; to: string } | null;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      if (!e.date) { errors.push(`跳过缺少日期的条目`); continue; }
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
      const date = d.toISOString().slice(0, 10);
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
    const today = new Date().toISOString().slice(0, 10);
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
      const today = new Date().toISOString().slice(0, 10);
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

export function parseImport(content: string): ImportResult {
  const format = detectFormat(content);
  switch (format) {
    case 'aidocplus-json': return parseAidocplusJson(content);
    case 'dayone-json': return parseDayOneJson(content);
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
              ? { ...e, content: imp.content, title: imp.title, updatedAt: now }
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
