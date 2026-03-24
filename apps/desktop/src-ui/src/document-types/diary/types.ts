/**
 * 日记文档类型 — 内部数据结构与操作函数
 * 所有数据存储在 Document.content 字段中的 JSON
 */

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

function genId(prefix: string): string {
  // 使用 crypto.randomUUID() 生成唯一 ID，避免 Date.now() + Math.random() 的碰撞风险
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
    if (data && data.version === 1 && Array.isArray(data.entries)) return data as DiaryDocumentContent;
    return null;
  } catch {
    return null;
  }
}

export function createEmptyDiaryContent(): DiaryDocumentContent {
  const defaultJournals: DiaryJournal[] = [
    { id: genId('dj'), name: '我的日记', icon: '📖', color: '#3b82f6', sortOrder: 0 },
    { id: genId('dj'), name: '工作日志', icon: '�', color: '#8b5cf6', sortOrder: 1 },
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
  return diary.entries.map(e => `${e.date} ${e.title}\n${e.content}`).join('\n\n');
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

export function deleteEntry(diary: DiaryDocumentContent, entryId: string): DiaryDocumentContent {
  return { ...diary, entries: diary.entries.filter(e => e.id !== entryId) };
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
  // 避免循环导入，直接使用内联常量
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
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
  const snaps = entry.snapshots || [];
  // 检查是否达到快照上限
  if (snaps.length >= 20) return diary;
  // 检查时间间隔（60秒）
  if (snaps.length > 0 && now - snaps[snaps.length - 1].timestamp < 60000) return diary;
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
  return {
    ...diary,
    entries: diary.entries.map(e =>
      e.id === entryId ? { ...e, content: snap.content, title: snap.title, updatedAt: Date.now() } : e
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

export function getEntriesByDate(diary: DiaryDocumentContent, date: string): DiaryEntry[] {
  return diary.entries.filter(e => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
}

export function getEntriesByDateRange(diary: DiaryDocumentContent, from: string, to: string): DiaryEntry[] {
  return diary.entries.filter(e => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export function getEntriesByJournal(diary: DiaryDocumentContent, journalId: string): DiaryEntry[] {
  return diary.entries.filter(e => e.journalId === journalId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function getEntriesByTag(diary: DiaryDocumentContent, tag: string): DiaryEntry[] {
  return diary.entries.filter(e => e.tags.includes(tag));
}

export function getEntriesOnThisDay(diary: DiaryDocumentContent, today: string): DiaryEntry[] {
  const mmdd = today.slice(5); // "MM-DD"
  return diary.entries
    .filter(e => e.date.slice(5) === mmdd && e.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** 获取前一条有条目的日期 */
export function getPrevEntryDate(diary: DiaryDocumentContent, currentDate: string): string | null {
  const dates = [...new Set(diary.entries.map(e => e.date))].sort();
  const idx = dates.indexOf(currentDate);
  if (idx > 0) return dates[idx - 1];
  // 如果当前日期不在列表中，找比它小的最大日期
  const prev = dates.filter(d => d < currentDate);
  return prev.length > 0 ? prev[prev.length - 1] : null;
}

/** 获取后一条有条目的日期 */
export function getNextEntryDate(diary: DiaryDocumentContent, currentDate: string): string | null {
  const dates = [...new Set(diary.entries.map(e => e.date))].sort();
  const idx = dates.indexOf(currentDate);
  if (idx >= 0 && idx < dates.length - 1) return dates[idx + 1];
  const next = dates.filter(d => d > currentDate);
  return next.length > 0 ? next[0] : null;
}

// ═══════════════════════════════════════════════════════
// 日记本 CRUD
// ═══════════════════════════════════════════════════════

export function addJournal(diary: DiaryDocumentContent, name: string, icon: string, color: string): DiaryDocumentContent {
  const journal: DiaryJournal = {
    id: genId('dj'),
    name,
    icon,
    color,
    sortOrder: diary.journals.length,
  };
  return { ...diary, journals: [...diary.journals, journal] };
}

export function renameJournal(diary: DiaryDocumentContent, journalId: string, name: string): DiaryDocumentContent {
  return {
    ...diary,
    journals: diary.journals.map(j => j.id === journalId ? { ...j, name } : j),
  };
}

export function deleteJournal(diary: DiaryDocumentContent, journalId: string): DiaryDocumentContent {
  const defaultId = diary.settings.defaultJournalId;
  if (journalId === defaultId) return diary; // 不允许删除默认日记本
  return {
    ...diary,
    journals: diary.journals.filter(j => j.id !== journalId),
    entries: diary.entries.map(e => e.journalId === journalId ? { ...e, journalId: defaultId } : e),
  };
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
  const today = new Date().toISOString().slice(0, 10);
  return diary.entries
    .filter(e => e.date === today && !e.deletedAt)
    .reduce((sum, e) => sum + getEntryWordCount(e), 0);
}

export function calculateStreak(diary: DiaryDocumentContent): { current: number; longest: number } {
  const activeEntries = diary.entries.filter(e => !e.deletedAt);
  if (activeEntries.length === 0) return { current: 0, longest: 0 };

  const dates = [...new Set(activeEntries.map(e => e.date))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);

  // 计算当前连续天数
  let current = 0;
  let checkDate = today;
  for (let i = 0; i < 1000; i++) {
    if (dates.includes(checkDate)) {
      current++;
    } else if (i > 0) {
      // 允许今天还没写
      break;
    }
    // 前一天
    const d = new Date(checkDate);
    d.setDate(d.getDate() - 1);
    checkDate = d.toISOString().slice(0, 10);
  }

  // 计算最长连续天数
  let longest = 0;
  let streak = 0;
  const sortedDates = [...dates].sort();
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) {
        streak++;
      } else {
        streak = 1;
      }
    }
    if (streak > longest) longest = streak;
  }

  return { current, longest };
}

export function getEntriesCountByMonth(diary: DiaryDocumentContent, year: number, month: number): Map<number, number> {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const map = new Map<number, number>();
  for (const entry of diary.entries) {
    if (entry.date.startsWith(prefix) && !entry.deletedAt) {
      const day = parseInt(entry.date.slice(8, 10), 10);
      map.set(day, (map.get(day) || 0) + 1);
    }
  }
  return map;
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
  for (const entry of diary.entries) {
    if (entry.date.startsWith(prefix) && entry.mood && !entry.deletedAt) {
      const day = parseInt(entry.date.slice(8, 10), 10);
      // 同一天多条取最后一条的心情
      map.set(day, entry.mood);
    }
  }
  return map;
}

// ═══════════════════════════════════════════════════════
// 元数据更新
// ═══════════════════════════════════════════════════════

export function updateDiaryMetadata(diary: DiaryDocumentContent): DiaryDocumentContent {
  const { current, longest } = calculateStreak(diary);
  return {
    ...diary,
    metadata: {
      ...diary.metadata,
      currentStreak: current,
      longestStreak: Math.max(longest, diary.metadata.longestStreak),
      totalEntries: diary.entries.length,
      totalWords: getTotalWordCount(diary),
    },
  };
}

export function addGlobalTag(diary: DiaryDocumentContent, tag: string): DiaryDocumentContent {
  if (diary.settings.tags.includes(tag)) return diary;
  return { ...diary, settings: { ...diary.settings, tags: [...diary.settings.tags, tag] } };
}

export function removeGlobalTag(diary: DiaryDocumentContent, tag: string): DiaryDocumentContent {
  return { ...diary, settings: { ...diary.settings, tags: diary.settings.tags.filter(t => t !== tag) } };
}

/** 收集所有已使用的标签（去重） */
export function collectAllTags(diary: DiaryDocumentContent): string[] {
  const tagSet = new Set<string>(diary.settings.tags);
  for (const entry of diary.entries) {
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

export function countFilterResults(diary: DiaryDocumentContent, filter: DiaryFilterState): number {
  return applyFilter(diary, filter).length;
}

/** 获取今天日期字符串 YYYY-MM-DD */
export function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 格式化日期显示 */
export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`;
}

