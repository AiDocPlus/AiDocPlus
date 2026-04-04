/**
 * 日记文档类型 — 内部数据结构与操作函数
 * 所有数据存储在 Document.content 字段中的 JSON
 */

import { MAX_SNAPSHOTS, SNAPSHOT_INTERVAL_MS, TRASH_CLEANUP_THRESHOLD_MS } from './constants';

// ═══════════════════════════════════════════════════════
// 数据模型
// ═══════════════════════════════════════════════════════

export interface DiaryDocumentContent {
  version: 1;
  settings: DiarySettings;
  journals: DiaryJournal[];
  entries: DiaryEntry[];
  metadata: DiaryMetadata;
}

export interface DiarySettings {
  defaultJournalId: string;
  defaultTemplate: string;
  weekStartsOn: 0 | 1;       // 0=周日, 1=周一
  showWeather: boolean;
  showMood: boolean;
  showLocation: boolean;
  dailyPromptEnabled: boolean;
  tags: string[];
}

export interface DiaryJournal {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  description?: string;
}

export interface DiaryEntrySnapshot {
  id: string;
  content: string;
  title: string;
  timestamp: number;
}

export interface DiaryEntry {
  id: string;
  journalId: string;
  date: string;               // "YYYY-MM-DD"
  time: string;               // "HH:mm"
  title: string;
  content: string;
  mood?: DiaryMood;
  weather?: DiaryWeather;
  location?: string;
  tags: string[];
  privateNote?: string;
  templateId?: string;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
  starred: boolean;
  colorLabel?: string;        // 颜色标签 (hex color)
  deletedAt?: number;         // 软删除时间戳（回收站）
  snapshots?: DiaryEntrySnapshot[]; // 版本快照（限20个）
  /** D3.4: 当日习惯完成记录 */
  habitRecords?: DiaryHabitRecord[];
}

// ═══════════════════════════════════════════════════════════
// 颜色标签
// ═══════════════════════════════════════════════════════════

export interface ColorLabel {
  key: string;
  color: string;
  labelKey: string;
}

export const COLOR_LABELS: ColorLabel[] = [
  { key: 'red', color: '#ef4444', labelKey: 'diary.colorRed' },
  { key: 'orange', color: '#f97316', labelKey: 'diary.colorOrange' },
  { key: 'yellow', color: '#eab308', labelKey: 'diary.colorYellow' },
  { key: 'green', color: '#22c55e', labelKey: 'diary.colorGreen' },
  { key: 'teal', color: '#14b8a6', labelKey: 'diary.colorTeal' },
  { key: 'blue', color: '#3b82f6', labelKey: 'diary.colorBlue' },
  { key: 'purple', color: '#8b5cf6', labelKey: 'diary.colorPurple' },
  { key: 'pink', color: '#ec4899', labelKey: 'diary.colorPink' },
];

export type DiaryMood = 'great' | 'good' | 'okay' | 'bad' | 'terrible';

export const MOOD_EMOJI: Record<DiaryMood, string> = {
  great: '😄',
  good: '🙂',
  okay: '😐',
  bad: '😔',
  terrible: '😢',
};

export const MOOD_LABEL: Record<DiaryMood, string> = {
  great: '开心',
  good: '不错',
  okay: '一般',
  bad: '低落',
  terrible: '难过',
};

export const MOOD_VALUES: DiaryMood[] = ['great', 'good', 'okay', 'bad', 'terrible'];

export const MOOD_SCORE: Record<DiaryMood, number> = {
  great: 5,
  good: 4,
  okay: 3,
  bad: 2,
  terrible: 1,
};

export type DiaryWeatherType = 'sunny' | 'cloudy' | 'overcast' | 'rainy' | 'snowy' | 'windy' | 'foggy' | 'stormy';

export interface DiaryWeather {
  type: DiaryWeatherType;
  temperature?: number;
}

export const WEATHER_EMOJI: Record<DiaryWeatherType, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  overcast: '☁️',
  rainy: '🌧️',
  snowy: '❄️',
  windy: '💨',
  foggy: '🌫️',
  stormy: '⛈️',
};

export const WEATHER_LABEL: Record<DiaryWeatherType, string> = {
  sunny: '晴',
  cloudy: '多云',
  overcast: '阴',
  rainy: '雨',
  snowy: '雪',
  windy: '风',
  foggy: '雾',
  stormy: '暴风雨',
};

export const WEATHER_TYPES: DiaryWeatherType[] = ['sunny', 'cloudy', 'overcast', 'rainy', 'snowy', 'windy', 'foggy', 'stormy'];

export interface DiaryTemplate {
  id: string;
  name: string;
  icon: string;
  content: string;
  description?: string;
}

/** D3.4: 习惯定义 */
export interface DiaryHabit {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** 目标类型：boolean=打勾, number=数值 */
  type: 'boolean' | 'number';
  /** 数值类型的单位（如"分钟""杯""页"） */
  unit?: string;
  /** 数值类型的目标值 */
  target?: number;
  /** 数值类型的步长（默认 1） */
  step?: number;
  sortOrder: number;
  archived?: boolean;
}

/** D3.4: 单日习惯记录 */
export interface DiaryHabitRecord {
  habitId: string;
  /** boolean 类型的值 */
  done?: boolean;
  /** number 类型的值 */
  value?: number;
}

export interface DiaryMetadata {
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
  totalWords: number;
  dailyWordGoal?: number;
  customTemplates: DiaryTemplate[];
  /** D3.4: 习惯追踪定义列表 */
  habits?: DiaryHabit[];
}

// ═══════════════════════════════════════════════════════
// ID 生成
// ═══════════════════════════════════════════════════════

export function genId(prefix: string): string {
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(2, 8);
  return `${prefix}_${randomPart}`;
}

// ═══════════════════════════════════════════════════════
// 解析与创建
// ═══════════════════════════════════════════════════════

export function parseDiaryContent(raw: string): DiaryDocumentContent | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.entries)) return null;
    // 补全缺失的顶层字段，防止下游访问 undefined 崩溃
    const empty = createEmptyDiaryContent();
    if (!data.settings) data.settings = empty.settings;
    if (!Array.isArray(data.journals) || data.journals.length === 0) {
      data.journals = empty.journals;
      data.settings.defaultJournalId = empty.settings.defaultJournalId;
    } else {
      // 确保 defaultJournalId 指向存在的日记本
      if (!data.journals.some(j => j.id === data.settings.defaultJournalId)) {
        data.settings.defaultJournalId = data.journals[0].id;
      }
    }
    if (!data.metadata) data.metadata = empty.metadata;
    return data as DiaryDocumentContent;
  } catch {
    return null;
  }
}

export function createEmptyDiaryContent(): DiaryDocumentContent {
  const defaultJournals: DiaryJournal[] = [
    { id: genId('dj'), name: '我的日记', icon: '📖', color: '#3b82f6', sortOrder: 0 },
    { id: genId('dj'), name: '工作日志', icon: '💼', color: '#8b5cf6', sortOrder: 1 },
    { id: genId('dj'), name: '生活随笔', icon: '🌱', color: '#22c55e', sortOrder: 2 },
    { id: genId('dj'), name: '读书笔记', icon: '📚', color: '#f59e0b', sortOrder: 3 },
    { id: genId('dj'), name: '健康运动', icon: '🏃', color: '#ef4444', sortOrder: 4 },
  ];
  return {
    version: 1,
    settings: {
      defaultJournalId: defaultJournals[0].id,
      defaultTemplate: 'freewrite',
      weekStartsOn: 1,
      showWeather: true,
      showMood: true,
      showLocation: true,
      dailyPromptEnabled: false,
      tags: ['工作', '生活', '学习', '运动', '阅读', '社交', '心情', '旅行'],
    },
    journals: defaultJournals,
    entries: [],
    metadata: {
      currentStreak: 0,
      longestStreak: 0,
      totalEntries: 0,
      totalWords: 0,
      customTemplates: [],
    },
  };
}

export function extractDiaryPlainText(content: string): string {
  const diary = parseDiaryContent(content);
  if (!diary) return content;
  return diary.entries.filter(e => !e.deletedAt).map(e => `${e.date} ${e.title}\n${e.content}`).join('\n\n');
}

// ═══════════════════════════════════════════════════════
// 条目 CRUD
// ═══════════════════════════════════════════════════════

export function createEntry(
  diary: DiaryDocumentContent,
  journalId: string,
  date: string,
  templateContent?: string,
): DiaryDocumentContent {
  const now = Date.now();
  const d = new Date(now);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const content = templateContent || '';
  const entry: DiaryEntry = {
    id: genId('de'),
    journalId,
    date,
    time,
    title: '',
    content,
    tags: [],
    wordCount: content.replace(/\s/g, '').length,
    createdAt: now,
    updatedAt: now,
    starred: false,
  };
  return { ...diary, entries: [...diary.entries, entry] };
}

export function updateEntryContent(diary: DiaryDocumentContent, entryId: string, content: string): DiaryDocumentContent {
  return {
    ...diary,
    entries: diary.entries.map(e =>
      e.id === entryId
        ? { ...e, content, wordCount: content.replace(/\s/g, '').length, updatedAt: Date.now() }
        : e
    ),
  };
}

export function updateEntryMeta(
  diary: DiaryDocumentContent,
  entryId: string,
  patch: Partial<Omit<DiaryEntry, 'id' | 'createdAt'>>,
): DiaryDocumentContent {
  return {
    ...diary,
    entries: diary.entries.map(e =>
      e.id === entryId ? { ...e, ...patch, updatedAt: Date.now() } : e
    ),
  };
}

/** 软删除条目（移入回收站） */
export function softDeleteEntry(diary: DiaryDocumentContent, entryId: string): DiaryDocumentContent {
  return {
    ...diary,
    entries: diary.entries.map(e =>
      e.id === entryId ? { ...e, deletedAt: Date.now() } : e
    ),
  };
}

/** 恢复已删除条目 */
export function restoreEntry(diary: DiaryDocumentContent, entryId: string): DiaryDocumentContent {
  return {
    ...diary,
    entries: diary.entries.map(e =>
      e.id === entryId ? { ...e, deletedAt: undefined } : e
    ),
  };
}

/** 获取回收站条目 */
export function getDeletedEntries(diary: DiaryDocumentContent): DiaryEntry[] {
  return diary.entries.filter(e => e.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
}

/** 永久删除条目 */
export function permanentDeleteEntry(diary: DiaryDocumentContent, entryId: string): DiaryDocumentContent {
  return { ...diary, entries: diary.entries.filter(e => e.id !== entryId) };
}

/** 清理超过30天的已删除条目 */
export function cleanupDeletedEntries(diary: DiaryDocumentContent): DiaryDocumentContent {
  const cutoff = Date.now() - TRASH_CLEANUP_THRESHOLD_MS;
  return {
    ...diary,
    entries: diary.entries.filter(e => !e.deletedAt || e.deletedAt > cutoff),
  };
}

/** 添加版本快照（限20个，间隔>60秒才记录） */
export function addSnapshot(diary: DiaryDocumentContent, entryId: string): DiaryDocumentContent {
  const entry = diary.entries.find(e => e.id === entryId);
  if (!entry) return diary;
  const now = Date.now();
  const snaps = [...(entry.snapshots || [])];
  // 检查时间间隔（先检查，避免先删旧快照再放弃导致数据丢失）
  if (snaps.length > 0 && now - snaps[snaps.length - 1].timestamp < SNAPSHOT_INTERVAL_MS) return diary;
  // 检查是否达到快照上限，FIFO 淘汰最旧的
  if (snaps.length >= MAX_SNAPSHOTS) snaps.shift();
  const newSnap: DiaryEntrySnapshot = {
    id: `snap_${now}_${Math.random().toString(36).slice(2, 6)}`,
    content: entry.content,
    title: entry.title,
    timestamp: now,
  };
  const updated = [...snaps, newSnap];
  return {
    ...diary,
    entries: diary.entries.map(e =>
      e.id === entryId ? { ...e, snapshots: updated } : e
    ),
  };
}

/** 从快照恢复条目内容 */
export function restoreFromSnapshot(diary: DiaryDocumentContent, entryId: string, snapshotId: string): DiaryDocumentContent {
  const entry = diary.entries.find(e => e.id === entryId);
  if (!entry) return diary;
  const snap = entry.snapshots?.find(s => s.id === snapshotId);
  if (!snap) return diary;
  const newWordCount = snap.content.replace(/\s/g, '').length;
  return {
    ...diary,
    entries: diary.entries.map(e =>
      e.id === entryId ? { ...e, content: snap.content, title: snap.title, wordCount: newWordCount, updatedAt: Date.now() } : e
    ),
  };
}

export function duplicateEntry(diary: DiaryDocumentContent, entryId: string): DiaryDocumentContent {
  const src = diary.entries.find(e => e.id === entryId);
  if (!src) return diary;
  const now = Date.now();
  const copy: DiaryEntry = {
    ...src,
    id: genId('de'),
    title: src.title ? `${src.title} (副本)` : '',
    createdAt: now,
    updatedAt: now,
    deletedAt: undefined,
    snapshots: undefined,
  };
  return { ...diary, entries: [...diary.entries, copy] };
}

export function moveEntryToJournal(diary: DiaryDocumentContent, entryId: string, journalId: string): DiaryDocumentContent {
  return updateEntryMeta(diary, entryId, { journalId });
}

export function toggleEntryStarred(diary: DiaryDocumentContent, entryId: string): DiaryDocumentContent {
  const entry = diary.entries.find(e => e.id === entryId);
  if (!entry) return diary;
  return updateEntryMeta(diary, entryId, { starred: !entry.starred });
}

// ═══════════════════════════════════════════════════════
// 查询
// ═══════════════════════════════════════════════════════

export function getEntryById(diary: DiaryDocumentContent, entryId: string): DiaryEntry | undefined {
  return diary.entries.find(e => e.id === entryId);
}

/** 获取历史同月同日条目（排除今年） */
export function getEntriesOnThisDay(diary: DiaryDocumentContent, today: string): DiaryEntry[] {
  const mmdd = today.slice(5); // "MM-DD"
  return diary.entries
    .filter(e => !e.deletedAt && e.date.slice(5) === mmdd && e.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** 获取前一条有条目的日期 */
export function getPrevEntryDate(diary: DiaryDocumentContent, currentDate: string): string | null {
  const dates = [...new Set(diary.entries.filter(e => !e.deletedAt).map(e => e.date))].sort();
  const idx = dates.indexOf(currentDate);
  if (idx > 0) return dates[idx - 1];
  // 如果当前日期不在列表中，找比它小的最大日期
  const prev = dates.filter(d => d < currentDate);
  return prev.length > 0 ? prev[prev.length - 1] : null;
}

/** 获取后一条有条目的日期 */
export function getNextEntryDate(diary: DiaryDocumentContent, currentDate: string): string | null {
  const dates = [...new Set(diary.entries.filter(e => !e.deletedAt).map(e => e.date))].sort();
  const idx = dates.indexOf(currentDate);
  if (idx >= 0 && idx < dates.length - 1) return dates[idx + 1];
  const next = dates.filter(d => d > currentDate);
  return next.length > 0 ? next[0] : null;
}

// ═══════════════════════════════════════════════════════
// 统计
// ═══════════════════════════════════════════════════════

export function getEntryWordCount(entry: DiaryEntry): number {
  return entry.content.replace(/\s/g, '').length;
}

export function getTotalWordCount(diary: DiaryDocumentContent): number {
  return diary.entries.filter(e => !e.deletedAt).reduce((sum, e) => sum + getEntryWordCount(e), 0);
}

export function getTodayWordCount(diary: DiaryDocumentContent): number {
  const today = getTodayDateStr();
  return diary.entries
    .filter(e => e.date === today && !e.deletedAt)
    .reduce((sum, e) => sum + getEntryWordCount(e), 0);
}

/** 本地时区安全的日期格式化 YYYY-MM-DD */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本地时区安全的日期偏移 */
function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calculateStreak(diary: DiaryDocumentContent): { current: number; longest: number } {
  const activeEntries = diary.entries.filter(e => !e.deletedAt);
  if (activeEntries.length === 0) return { current: 0, longest: 0 };

  const dateSet = new Set(activeEntries.map(e => e.date));
  const today = getTodayDateStr();
  const sortedDates = [...dateSet].sort();

  // 计算当前连续天数（回溯到最早条目日期即可）
  let current = 0;
  let checkDate = today;
  const earliestDate = sortedDates.length > 0 ? sortedDates[0] : today;
  while (checkDate >= earliestDate) {
    if (dateSet.has(checkDate)) {
      current++;
    } else if (checkDate !== today) {
      // 允许今天还没写，其他日期断了就停
      break;
    }
    // 前一天
    checkDate = offsetDate(checkDate, -1);
  }

  // 计算最长连续天数
  let longest = 0;
  let streak = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const expected = offsetDate(sortedDates[i - 1], 1);
      if (sortedDates[i] === expected) {
        streak++;
      } else {
        streak = 1;
      }
    }
    if (streak > longest) longest = streak;
  }

  return { current, longest };
}

export function getWordCountByDay(diary: DiaryDocumentContent, year: number, month: number): Map<number, number> {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const map = new Map<number, number>();
  for (const entry of diary.entries) {
    if (entry.date.startsWith(prefix) && !entry.deletedAt) {
      const day = parseInt(entry.date.slice(8, 10), 10);
      map.set(day, (map.get(day) || 0) + getEntryWordCount(entry));
    }
  }
  return map;
}

export function getMoodByDay(diary: DiaryDocumentContent, year: number, month: number): Map<number, DiaryMood> {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const map = new Map<number, DiaryMood>();
  const sorted = diary.entries
    .filter(e => e.date.startsWith(prefix) && e.mood && !e.deletedAt)
    .sort((a, b) => a.updatedAt - b.updatedAt);
  for (const entry of sorted) {
    const day = parseInt(entry.date.slice(8, 10), 10);
    map.set(day, entry.mood);
  }
  return map;
}

// ═══════════════════════════════════════════════════════
// 元数据更新
// ═══════════════════════════════════════════════════════

export function updateDiaryMetadata(diary: DiaryDocumentContent): DiaryDocumentContent {
  const { current, longest } = calculateStreak(diary);
  const activeCount = diary.entries.filter(e => !e.deletedAt).length;
  return {
    ...diary,
    metadata: {
      ...diary.metadata,
      currentStreak: current,
      longestStreak: Math.max(longest, diary.metadata.longestStreak),
      totalEntries: activeCount,
      totalWords: getTotalWordCount(diary),
    },
  };
}

/** 收集所有已使用的标签（去重） */
export function collectAllTags(diary: DiaryDocumentContent): string[] {
  const tagSet = new Set<string>(diary.settings.tags);
  for (const entry of diary.entries) {
    if (entry.deletedAt) continue;
    for (const tag of entry.tags) tagSet.add(tag);
  }
  return [...tagSet].sort();
}

// ═══════════════════════════════════════════════════════
// 高级筛选
// ═══════════════════════════════════════════════════════

export interface DiaryFilterState {
  keyword: string;
  dateFrom: string;        // "YYYY-MM-DD" 或 ''
  dateTo: string;
  moods: DiaryMood[];      // 多选
  weathers: DiaryWeatherType[]; // 多选
  tags: string[];           // 多选
  journalId: string | null; // null=全部
  starredOnly: boolean;
}

export const EMPTY_FILTER: DiaryFilterState = {
  keyword: '', dateFrom: '', dateTo: '',
  moods: [], weathers: [], tags: [],
  journalId: null, starredOnly: false,
};

export function isFilterActive(f: DiaryFilterState): boolean {
  return !!(f.keyword || f.dateFrom || f.dateTo || f.moods.length || f.weathers.length || f.tags.length || f.journalId || f.starredOnly);
}

export function applyFilter(diary: DiaryDocumentContent, filter: DiaryFilterState): DiaryEntry[] {
  let entries = diary.entries.filter(e => !e.deletedAt); // 排除已软删除
  if (filter.journalId) entries = entries.filter(e => e.journalId === filter.journalId);
  if (filter.starredOnly) entries = entries.filter(e => e.starred);
  if (filter.dateFrom) entries = entries.filter(e => e.date >= filter.dateFrom);
  if (filter.dateTo) entries = entries.filter(e => e.date <= filter.dateTo);
  if (filter.moods.length > 0) entries = entries.filter(e => e.mood && filter.moods.includes(e.mood));
  if (filter.weathers.length > 0) entries = entries.filter(e => e.weather && filter.weathers.includes(e.weather.type));
  if (filter.tags.length > 0) entries = entries.filter(e => filter.tags.some(t => e.tags.includes(t)));
  if (filter.keyword.trim()) {
    const q = filter.keyword.toLowerCase();
    entries = entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      e.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

/** 获取今天日期字符串 YYYY-MM-DD（使用本地时区） */
export function getTodayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 格式化日期显示 */
export function formatDateDisplay(dateStr: string, t?: (key: string, opts?: Record<string, unknown>) => string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekDays = t
    ? [t('diary.weekdaySun', { defaultValue: '周日' }), t('diary.weekdayMon', { defaultValue: '周一' }), t('diary.weekdayTue', { defaultValue: '周二' }), t('diary.weekdayWed', { defaultValue: '周三' }), t('diary.weekdayThu', { defaultValue: '周四' }), t('diary.weekdayFri', { defaultValue: '周五' }), t('diary.weekdaySat', { defaultValue: '周六' })]
    : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const ymd = t
    ? t('diary.dateDisplay', { defaultValue: '{{year}}年{{month}}月{{day}}日', year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() })
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return `${ymd} ${weekDays[d.getDay()]}`;
}

// ═══════════════════════════════════════════════════════
// 习惯追踪
// ═══════════════════════════════════════════════════════

/** 添加习惯定义 */
export function addHabit(diary: DiaryDocumentContent, habit: DiaryHabit): DiaryDocumentContent {
  return {
    ...diary,
    metadata: { ...diary.metadata, habits: [...(diary.metadata.habits || []), habit] },
  };
}

/** 更新习惯定义 */
export function updateHabit(diary: DiaryDocumentContent, habitId: string, patch: Partial<DiaryHabit>): DiaryDocumentContent {
  return {
    ...diary,
    metadata: {
      ...diary.metadata,
      habits: (diary.metadata.habits || []).map(h => h.id === habitId ? { ...h, ...patch } : h),
    },
  };
}

/** 删除习惯定义 */
export function deleteHabit(diary: DiaryDocumentContent, habitId: string): DiaryDocumentContent {
  return {
    ...diary,
    metadata: {
      ...diary.metadata,
      habits: (diary.metadata.habits || []).filter(h => h.id !== habitId),
    },
  };
}

/** 计算习惯连续完成天数 */
export function calculateHabitStreak(diary: DiaryDocumentContent, habitId: string): { current: number; longest: number } {
  const entries = diary.entries.filter(e => !e.deletedAt).sort((a, b) => b.date.localeCompare(a.date));
  const dateSet = new Set<string>();
  for (const e of entries) {
    const record = (e.habitRecords || []).find(r => r.habitId === habitId);
    if (record && (record.done || (record.value !== undefined && record.value > 0))) {
      dateSet.add(e.date);
    }
  }
  if (dateSet.size === 0) return { current: 0, longest: 0 };

  const sortedDates = Array.from(dateSet).sort().reverse();
  let current = 0;
  let longest = 0;
  let streak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00');
    const curr = new Date(sortedDates[i] + 'T00:00:00');
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
    } else {
      if (streak > longest) longest = streak;
      streak = 1;
    }
  }
  if (streak > longest) longest = streak;

  // 计算当前连续（从今天往回数）
  const today = getTodayDateStr();
  if (dateSet.has(today)) {
    current = 1;
    for (let i = 1; ; i++) {
      const d = new Date(today + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const dateStr = toLocalDateStr(d);
      if (dateSet.has(dateStr)) {
        current++;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}

