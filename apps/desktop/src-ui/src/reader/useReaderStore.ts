import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ReaderView } from './styles';
import type { Annotation, AnnotationsMap } from './types/annotations';

// ── 类型定义 ──

export interface EbookCategory {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export interface EbookInfo {
  filename: string;
  original_name: string;
  display_name: string;
  format: string;
  size_bytes: number;
  added_at: string;
  category_id: string | null;
  sort_order: number;
  starred: boolean;
  author: string;
  cover_image?: string;
  /** 阅读状态：unread / reading / completed */
  reading_status: string;
  /** 用户自定义标签 */
  tags: string[];
}

export interface EbookContent {
  data: string;
  is_binary: boolean;
}

export interface LibraryIndex {
  version: number;
  categories: EbookCategory[];
  books: EbookInfo[];
}

/** 阅读进度记录 */
export interface ReadingProgress {
  scrollPosition?: number;
  currentPage?: number;
  epubCfi?: string;
  progressPercent?: number;
  lastReadAt: string;
}

/** 书签 */
export interface ReaderBookmark {
  id: string;
  filename: string;
  label: string;
  scrollPosition: number;
  progressPercent: number;
  createdAt: string;
}

/** 目录条目 */
export interface TocEntry {
  id: string;
  level: number;
  text: string;
  element?: HTMLElement;
}

/** 阅读器主题配色 */
export interface ReaderThemeConfig {
  id: string;
  name: string;
  nameKey?: string;
  mode: 'light' | 'dark';
  bg: string;
  text: string;
  heading: string;
  muted: string;
  accent: string;
  codeBg: string;
}

export type ReaderSortField = 'custom' | 'name' | 'addedAt' | 'lastReadAt' | 'format' | 'size' | 'author';

/** 每本书可覆盖的设置项 */
export interface PerBookSettings {
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  paragraphSpacing?: number;
  contentWidth?: number;
  themeId?: string;
  textAlignment?: 'left' | 'justify';
}

/** 最终生效的阅读设置（全局 + 单书覆盖） */
export interface EffectiveReaderSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  paragraphSpacing: number;
  contentWidth: number;
  textAlignment: 'left' | 'justify';
}

/** AI 聊天消息 */
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

/** 阅读统计 */
export interface ReadingStats {
  /** 总阅读时间（秒） */
  totalReadingSeconds: number;
  /** 按日期索引的阅读时长（ISO date string -> 秒） */
  dailySeconds: Record<string, number>;
  /** 已完成书籍数 */
  completedBooks: number;
  /** 阅读书籍总数 */
  totalBooksOpened: number;
}

/** 单个阅读器标签 */
export interface ReaderTab {
  id: string;
  book: EbookInfo;
  /** 已加载的内容（切换回已打开的标签时保留） */
  content: EbookContent | null;
  loading: boolean;
  error: string | null;
  progressPercent: number;
  wordCount: number;
  /** 滚动位置（Markdown/HTML） */
  scrollPosition: number;
  /** EPUB CFI */
  epubCfi: string | null;
  /** PDF 当前页 */
  pdfPage: number;
  /** PDF 总页数 */
  pdfTotalPages: number;
}

export const READER_THEME_PRESETS: ReaderThemeConfig[] = [
  { id: 'default',   nameKey: 'reader.themeDefault',   name: '默认白',   mode: 'light', bg: '#ffffff', text: '#1a1a1a', heading: '#111111', muted: '#666666', accent: '#2563eb', codeBg: '#f5f5f5' },
  { id: 'paper',     nameKey: 'reader.themePaper',     name: '纸张',     mode: 'light', bg: '#faf8f5', text: '#2c2c2c', heading: '#1a1a1a', muted: '#888888', accent: '#c77832', codeBg: '#f0eeeb' },
  { id: 'sepia',     nameKey: 'reader.themeSepia',     name: '羊皮纸',   mode: 'light', bg: '#f5ecd7', text: '#5b4636', heading: '#3d2e1f', muted: '#8a7560', accent: '#a0522d', codeBg: '#ebe2cf' },
  { id: 'warm',      nameKey: 'reader.themeWarm',      name: '暖黄',     mode: 'light', bg: '#fef9ef', text: '#4a4a4a', heading: '#333333', muted: '#999999', accent: '#d97706', codeBg: '#fdf3e0' },
  { id: 'green',     nameKey: 'reader.themeGreen',     name: '护眼绿',   mode: 'light', bg: '#c7edcc', text: '#2d4a32', heading: '#1e3523', muted: '#5a7d5f', accent: '#2d7a46', codeBg: '#b5dfbb' },
  { id: 'gray',      nameKey: 'reader.themeGray',      name: '浅灰',     mode: 'light', bg: '#e8e8e8', text: '#333333', heading: '#1a1a1a', muted: '#777777', accent: '#2563eb', codeBg: '#dddcdc' },
  { id: 'dark',      nameKey: 'reader.themeDark',      name: '深灰',     mode: 'dark',  bg: '#1e1e1e', text: '#d4d4d4', heading: '#e5e5e5', muted: '#888888', accent: '#60a5fa', codeBg: '#2d2d2d' },
  { id: 'amoled',    nameKey: 'reader.themeAmoled',    name: '纯黑',     mode: 'dark',  bg: '#000000', text: '#c0c0c0', heading: '#e0e0e0', muted: '#707070', accent: '#6cb4ee', codeBg: '#111111' },
];

// ── Store 状态 ──

interface ReaderState {
  /** 当前视图 */
  currentView: ReaderView;
  setCurrentView: (view: ReaderView) => void;
  /** AI 面板可见性 */
  aiPanelVisible: boolean;
  toggleAiPanel: () => void;

  /** 书库数据 */
  books: EbookInfo[];
  categories: EbookCategory[];
  /** 打开的标签列表 */
  tabs: ReaderTab[];
  /** 当前激活的标签 ID */
  activeTabId: string | null;
  isLoading: boolean;
  error: string | null;
  /** 全局阅读设置 */
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  paragraphSpacing: number;
  contentWidth: number;
  theme: ReaderThemeConfig;
  isFullscreen: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  sortField: ReaderSortField;
  sortDirection: 'asc' | 'desc';
  starredFilter: boolean;
  /** 阅读状态筛选（空字符串 = 全部） */
  readingStatusFilter: string;
  /** 阅读进度（按 filename 索引） */
  readingProgress: Record<string, ReadingProgress>;
  /** 书签（按 filename 索引） */
  bookmarks: Record<string, ReaderBookmark[]>;
  /** 阅读区右侧面板（目录/书签） */
  readingSidebarOpen: boolean;
  /** 分类树展开状态 */
  expandedCategories: string[];
  setExpandedCategories: (ids: string[]) => void;
  /** 书库视图模式 */
  libraryViewMode: 'list' | 'grid';
  setLibraryViewMode: (mode: 'list' | 'grid') => void;

  /** 每本书独立设置（覆盖全局） */
  perBookSettings: Record<string, Partial<PerBookSettings>>;
  setPerBookSetting: (filename: string, settings: Partial<PerBookSettings>) => void;
  getEffectiveSettings: (filename: string) => EffectiveReaderSettings;

  /** 文本排版选项 */
  textAlignment: 'left' | 'justify';
  setTextAlignment: (alignment: 'left' | 'justify') => void;

  /** AI 对话历史（按 filename 索引） */
  aiChatHistory: Record<string, AiChatMessage[]>;
  addAiChatMessage: (filename: string, message: AiChatMessage) => void;
  clearAiChatHistory: (filename: string) => void;

  /** 阅读统计 */
  readingStats: ReadingStats;
  recordReadingSession: (filename: string, durationSeconds: number) => void;

  /** 书库操作 */
  loadLibrary: () => Promise<void>;
  importFile: (path: string, categoryId?: string | null) => Promise<EbookInfo | null>;
  importFileRaw: (path: string, categoryId?: string | null) => Promise<EbookInfo | null>;
  deleteBook: (filename: string) => Promise<void>;
  renameBook: (filename: string, newName: string) => Promise<void>;
  moveBook: (filename: string, categoryId: string | null, sortOrder?: number) => Promise<void>;
  createCategory: (name: string, parentId?: string | null) => Promise<EbookCategory | null>;
  renameCategory: (id: string, newName: string) => Promise<void>;
  deleteCategory: (id: string, moveBooksToParent: boolean) => Promise<void>;
  moveCategory: (categoryId: string, newParentId: string | null) => Promise<void>;
  reorderBooks: (categoryId: string | null, orderedFilenames: string[]) => Promise<void>;
  reorderCategories: (parentId: string | null, orderedIds: string[]) => Promise<void>;
  toggleStarred: (filename: string) => Promise<void>;

  /** 标签操作 */
  openBook: (book: EbookInfo) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  switchTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  duplicateTab: (tabId: string) => void;

  /** 标签内容更新 */
  setTabContent: (tabId: string, content: EbookContent) => void;
  setTabLoading: (tabId: string, loading: boolean) => void;
  setTabError: (tabId: string, error: string | null) => void;
  setTabProgress: (tabId: string, progress: Partial<{ percent: number; scrollPosition: number; epubCfi: string | null; pdfPage: number; pdfTotalPages: number; wordCount: number }>) => void;

  /** 设置 */
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  setFontFamily: (family: string) => void;
  setLineHeight: (height: number) => void;
  setParagraphSpacing: (spacing: number) => void;
  setContentWidth: (width: number) => void;
  setTheme: (theme: ReaderThemeConfig) => void;
  setFullscreen: (v: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setSortField: (field: ReaderSortField) => void;
  setSortDirection: (dir: 'asc' | 'desc') => void;
  setStarredFilter: (v: boolean) => void;
  setReadingStatusFilter: (v: string) => void;
  updateEbookMetadata: (filename: string, readingStatus?: string, tags?: string[]) => Promise<void>;
  clearError: () => void;

  /** 进度 */
  saveProgress: (filename: string, progress: Partial<ReadingProgress>) => void;
  getProgress: (filename: string) => ReadingProgress | null;
  jumpToProgress: (tabId: string, percent: number) => void;
  onJumpToProgress: ((tabId: string, percent: number) => void) | null;
  setJumpToProgressHandler: (handler: ((tabId: string, percent: number) => void) | null) => void;

  /** 书签 */
  addBookmark: (bookmark: Omit<ReaderBookmark, 'id' | 'createdAt'>) => void;
  removeBookmark: (id: string) => void;
  toggleReadingSidebar: () => void;
  /** 启动时恢复上次打开的标签页 */
  restoreTabs: () => void;

  /** 批注系统 */
  annotations: AnnotationsMap;
  loadAnnotations: (filename: string) => Promise<void>;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string, filename: string) => void;
  updateAnnotation: (id: string, filename: string, updates: Partial<Annotation>) => void;
}

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 32;
const FONT_SIZE_STEP = 2;

const STORAGE_KEY = 'aidocplus-reader-state-v2';

interface PersistedState {
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  paragraphSpacing?: number;
  contentWidth?: number;
  sidebarWidth?: number;
  sidebarOpen?: boolean;
  sortField?: ReaderSortField;
  sortDirection?: 'asc' | 'desc';
  starredFilter?: boolean;
  theme?: ReaderThemeConfig;
  readingProgress?: Record<string, ReadingProgress>;
  bookmarks?: Record<string, ReaderBookmark[]>;
  /** 上次打开的标签 */
  lastTabs?: Array<{ filename: string }>;
  lastActiveTabFilename?: string;
  /** UI 视图状态 */
  currentView?: ReaderView;
  aiPanelVisible?: boolean;
  readingSidebarOpen?: boolean;
  /** 分类树展开状态 */
  expandedCategories?: string[];
  /** 阅读状态筛选 */
  readingStatusFilter?: string;
  /** 书库视图模式 */
  libraryViewMode?: 'list' | 'grid';
  /** 每本书独立设置 */
  perBookSettings?: Record<string, Partial<PerBookSettings>>;
  /** 文本排版 */
  textAlignment?: 'left' | 'justify';
  /** AI 对话历史（按 filename 索引） */
  aiChatHistory?: Record<string, AiChatMessage[]>;
  /** 阅读统计 */
  readingStats?: ReadingStats;
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function ps(s: ReaderState): PersistedState {
  return {
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    lineHeight: s.lineHeight,
    paragraphSpacing: s.paragraphSpacing,
    contentWidth: s.contentWidth,
    sidebarWidth: s.sidebarWidth,
    sidebarOpen: s.sidebarOpen,
    sortField: s.sortField,
    sortDirection: s.sortDirection,
    starredFilter: s.starredFilter,
    theme: s.theme,
    readingProgress: s.readingProgress,
    bookmarks: s.bookmarks,
    lastTabs: s.tabs.map(t => ({ filename: t.book.filename })),
    lastActiveTabFilename: s.activeTabId ? s.tabs.find(t => t.id === s.activeTabId)?.book.filename : undefined,
    currentView: s.currentView,
    aiPanelVisible: s.aiPanelVisible,
    readingSidebarOpen: s.readingSidebarOpen,
    expandedCategories: [...(s.expandedCategories ?? [])],
    readingStatusFilter: s.readingStatusFilter,
    libraryViewMode: s.libraryViewMode,
    perBookSettings: s.perBookSettings,
    textAlignment: s.textAlignment,
    aiChatHistory: s.aiChatHistory,
    readingStats: s.readingStats,
  };
}

function persistState(s: ReaderState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ps(s)));
  } catch (e) {
    // QuotaExceededError: 尝试清理 aiChatHistory 后重试
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      try {
        const pruned = ps(s);
        // 清空所有 AI 聊天历史（最大数据来源），仅影响序列化后的 JSON
        // 不需要同步更新内存中的 store state（保留最新数据更安全）
        pruned.aiChatHistory = {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
        console.warn('[ReaderStore] storage quota exceeded, cleared AI chat history in persisted storage');
      } catch {
        console.error('[ReaderStore] persist failed even after pruning');
      }
    } else {
      console.warn('[ReaderStore] persist failed:', e);
    }
  }
}

function migrateTheme(theme: unknown): ReaderThemeConfig {
  const defaults = READER_THEME_PRESETS[0];
  if (!theme || typeof theme !== 'object') return defaults;
  const t = theme as Record<string, unknown>;
  return {
    id: typeof t.id === 'string' ? t.id : defaults.id,
    name: typeof t.name === 'string' ? t.name : defaults.name,
    mode: t.mode === 'light' || t.mode === 'dark' ? t.mode : defaults.mode,
    bg: typeof t.bg === 'string' ? t.bg : defaults.bg,
    text: typeof t.text === 'string' ? t.text : defaults.text,
    heading: typeof t.heading === 'string' ? t.heading : defaults.heading,
    muted: typeof t.muted === 'string' ? t.muted : defaults.muted,
    accent: typeof t.accent === 'string' ? t.accent : defaults.accent,
    codeBg: typeof t.codeBg === 'string' ? t.codeBg : defaults.codeBg,
  };
}

let tabCounter = 0;
function genTabId(): string {
  return `reader-tab-${++tabCounter}-${Date.now().toString(36)}`;
}

const persisted = loadPersistedState();

export const useReaderStore = create<ReaderState>((set, get) => ({
  currentView: persisted.currentView ?? 'library',
  setCurrentView: (view) => { set({ currentView: view }); persistState(get()); },
  aiPanelVisible: persisted.aiPanelVisible ?? false,
  toggleAiPanel: () => { const next = !get().aiPanelVisible; set({ aiPanelVisible: next }); persistState(get()); },

  books: [],
  categories: [],
  tabs: [],
  activeTabId: null,
  isLoading: false,
  error: null,
  fontSize: persisted.fontSize ?? 16,
  fontFamily: persisted.fontFamily ?? 'system',
  lineHeight: persisted.lineHeight ?? 1.8,
  paragraphSpacing: persisted.paragraphSpacing ?? 1,
  contentWidth: persisted.contentWidth ?? 800,
  theme: persisted.theme ? migrateTheme(persisted.theme) : (window.matchMedia('(prefers-color-scheme: dark)').matches ? READER_THEME_PRESETS[6] : READER_THEME_PRESETS[0]),
  isFullscreen: false,
  sidebarOpen: persisted.sidebarOpen ?? true,
  sidebarWidth: persisted.sidebarWidth ?? 280,
  sortField: persisted.sortField ?? 'custom',
  sortDirection: persisted.sortDirection ?? 'asc',
  starredFilter: persisted.starredFilter ?? false,
  readingStatusFilter: persisted.readingStatusFilter ?? '',
  readingProgress: persisted.readingProgress ?? {},
  bookmarks: persisted.bookmarks ?? {},
  readingSidebarOpen: persisted.readingSidebarOpen ?? false,
  expandedCategories: persisted.expandedCategories ?? [],
  setExpandedCategories: (ids) => {
    set({ expandedCategories: ids });
    persistState(get());
  },
  libraryViewMode: persisted.libraryViewMode ?? 'list',
  perBookSettings: persisted.perBookSettings ?? {},
  textAlignment: persisted.textAlignment ?? 'justify',
  onJumpToProgress: null,

  aiChatHistory: persisted.aiChatHistory ?? {},
  readingStats: persisted.readingStats ?? {
    totalReadingSeconds: 0,
    dailySeconds: {},
    completedBooks: 0,
    totalBooksOpened: 0,
  },

  loadLibrary: async () => {
    set({ isLoading: true, error: null });
    try {
      const index = await invoke<LibraryIndex>('get_library_index');
      set({ books: index.books, categories: index.categories, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  importFile: async (path: string, categoryId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const book = await invoke<EbookInfo>('import_ebook', {
        sourcePath: path,
        categoryId: categoryId ?? null,
      });
      await get().loadLibrary();
      set({ isLoading: false });
      return book;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return null;
    }
  },

  /** 导入单本书（不触发 loadLibrary，供批量导入使用） */
  importFileRaw: async (path: string, categoryId?: string | null) => {
    try {
      return await invoke<EbookInfo>('import_ebook', {
        sourcePath: path,
        categoryId: categoryId ?? null,
      });
    } catch (e) {
      console.error('[ReaderStore] importFileRaw failed:', e);
      return null;
    }
  },

  deleteBook: async (filename: string) => {
    try {
      await invoke('delete_ebook', { filename });
      const { tabs, activeTabId, readingProgress, bookmarks, perBookSettings, aiChatHistory } = get();
      const { [filename]: _, ...restProgress } = readingProgress;
      const { [filename]: _b, ...restBookmarks } = bookmarks;
      const { [filename]: _p, ...restPerBook } = perBookSettings;
      const { [filename]: _a, ...restChat } = aiChatHistory;
      const newTabs = tabs.filter(t => t.book.filename !== filename);
      let newActive = activeTabId;
      if (newTabs.length === 0) {
        newActive = null;
      } else if (!newTabs.find(t => t.id === activeTabId)) {
        newActive = newTabs[newTabs.length - 1].id;
      }
      set({ tabs: newTabs, activeTabId: newActive, readingProgress: restProgress, bookmarks: restBookmarks, perBookSettings: restPerBook, aiChatHistory: restChat });
      persistState(get());
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  openBook: (book: EbookInfo) => {
    const { tabs } = get();
    const existing = tabs.find(t => t.book.filename === book.filename);
    if (existing) {
      set({ activeTabId: existing.id, currentView: 'reading' as ReaderView });
      persistState(get());
      return;
    }
    const tab: ReaderTab = {
      id: genTabId(),
      book,
      content: null,
      loading: true,
      error: null,
      progressPercent: 0,
      wordCount: 0,
      scrollPosition: 0,
      epubCfi: null,
      pdfPage: 1,
      pdfTotalPages: 0,
    };
    set({ tabs: [...tabs, tab], activeTabId: tab.id, currentView: 'reading' as ReaderView });
    persistState(get());
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    const newTabs = tabs.filter(t => t.id !== tabId);
    let newActive = activeTabId;
    if (activeTabId === tabId) {
      if (newTabs.length === 0) {
        newActive = null;
      } else {
        const newIdx = Math.min(idx, newTabs.length - 1);
        newActive = newTabs[newIdx].id;
      }
    }
    set({ tabs: newTabs, activeTabId: newActive });
    persistState(get());
  },

  closeOtherTabs: (tabId: string) => {
    const { tabs } = get();
    const kept = tabs.find(t => t.id === tabId);
    if (kept) {
      set({ tabs: [kept], activeTabId: tabId });
      persistState(get());
    }
  },

  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null });
    persistState(get());
  },

  switchTab: (tabId: string) => {
    set({ activeTabId: tabId });
    persistState(get());
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    const { tabs } = get();
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, moved);
    set({ tabs: newTabs });
    persistState(get());
  },

  duplicateTab: (tabId: string) => {
    const { tabs } = get();
    const src = tabs.find(t => t.id === tabId);
    if (!src) return;
    const tab: ReaderTab = { ...src, id: genTabId(), content: src.content ? { ...src.content } : null };
    const idx = tabs.findIndex(t => t.id === tabId);
    const newTabs = [...tabs];
    newTabs.splice(idx + 1, 0, tab);
    set({ tabs: newTabs, activeTabId: tab.id });
    persistState(get());
  },

  setTabContent: (tabId: string, content: EbookContent) => {
    set(state => ({
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, content, loading: false, error: null } : t),
    }));
  },

  setTabLoading: (tabId: string, loading: boolean) => {
    set(state => ({
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, loading } : t),
    }));
  },

  setTabError: (tabId: string, error: string | null) => {
    set(state => ({
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, error, loading: false } : t),
    }));
  },

  setTabProgress: (tabId: string, progress: Partial<{ percent: number; scrollPosition: number; epubCfi: string | null; pdfPage: number; pdfTotalPages: number; wordCount: number }>) => {
    set(state => ({
      tabs: state.tabs.map(t => {
        if (t.id !== tabId) return t;
        const updated = { ...t };
        if (progress.percent !== undefined) updated.progressPercent = progress.percent;
        if (progress.scrollPosition !== undefined) updated.scrollPosition = progress.scrollPosition;
        if (progress.epubCfi !== undefined) updated.epubCfi = progress.epubCfi;
        if (progress.pdfPage !== undefined) updated.pdfPage = progress.pdfPage;
        if (progress.pdfTotalPages !== undefined) updated.pdfTotalPages = progress.pdfTotalPages;
        if (progress.wordCount !== undefined) updated.wordCount = progress.wordCount;
        return updated;
      }),
    }));
  },

  renameBook: async (filename: string, newName: string) => {
    try {
      await invoke('rename_ebook', { filename, newName });
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  moveBook: async (filename: string, categoryId: string | null, sortOrder?: number) => {
    try {
      await invoke('move_ebook', { filename, categoryId, sortOrder: sortOrder ?? null });
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createCategory: async (name: string, parentId?: string | null) => {
    try {
      const cat = await invoke<EbookCategory>('create_category', {
        name,
        parentId: parentId ?? null,
      });
      await get().loadLibrary();
      return cat;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },

  renameCategory: async (id: string, newName: string) => {
    try {
      await invoke('rename_category', { id, newName });
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteCategory: async (id: string, moveBooksToParent: boolean) => {
    try {
      await invoke('delete_category', { id, moveBooksToParent });
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  moveCategory: async (categoryId: string, newParentId: string | null) => {
    try {
      await invoke('move_category', { categoryId, newParentId });
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  reorderBooks: async (categoryId: string | null, orderedFilenames: string[]) => {
    try {
      await invoke('reorder_books', { categoryId, orderedFilenames });
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  reorderCategories: async (parentId: string | null, orderedIds: string[]) => {
    try {
      await invoke('reorder_categories', { parentId, orderedIds });
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  toggleStarred: async (filename: string) => {
    try {
      const newStarred = await invoke<boolean>('toggle_ebook_starred', { filename });
      set(state => ({
        books: state.books.map(b =>
          b.filename === filename ? { ...b, starred: newStarred } : b
        ),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setFontSize: (size: number) => {
    const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
    set({ fontSize: clamped });
    persistState(get());
  },

  increaseFontSize: () => {
    const next = Math.min(MAX_FONT_SIZE, get().fontSize + FONT_SIZE_STEP);
    set({ fontSize: next });
    persistState(get());
  },

  decreaseFontSize: () => {
    const next = Math.max(MIN_FONT_SIZE, get().fontSize - FONT_SIZE_STEP);
    set({ fontSize: next });
    persistState(get());
  },

  setFontFamily: (family: string) => {
    set({ fontFamily: family });
    persistState(get());
  },

  setLineHeight: (height: number) => {
    set({ lineHeight: Math.max(1.2, Math.min(3, height)) });
    persistState(get());
  },

  setParagraphSpacing: (spacing: number) => {
    set({ paragraphSpacing: Math.max(0, Math.min(3, spacing)) });
    persistState(get());
  },

  setContentWidth: (width: number) => {
    set({ contentWidth: Math.max(500, Math.min(1200, width)) });
    persistState(get());
  },

  setTheme: (theme: ReaderThemeConfig) => {
    set({ theme });
    persistState(get());
  },

  setFullscreen: (v: boolean) => {
    set({ isFullscreen: v });
  },

  toggleSidebar: () => {
    const next = !get().sidebarOpen;
    set({ sidebarOpen: next });
    persistState(get());
  },

  setSidebarWidth: (w: number) => {
    const clamped = Math.max(180, Math.min(480, w));
    set({ sidebarWidth: clamped });
    persistState(get());
  },

  setSortField: (field: ReaderSortField) => {
    set({ sortField: field });
    persistState(get());
  },

  setSortDirection: (dir: 'asc' | 'desc') => {
    set({ sortDirection: dir });
    persistState(get());
  },

  setStarredFilter: (v: boolean) => {
    set({ starredFilter: v });
    persistState(get());
  },

  setReadingStatusFilter: (v: string) => {
    set({ readingStatusFilter: v });
    persistState(get());
  },

  setLibraryViewMode: (mode: 'list' | 'grid') => {
    set({ libraryViewMode: mode });
    persistState(get());
  },

  updateEbookMetadata: async (filename: string, readingStatus?: string, tags?: string[]) => {
    try {
      await invoke('update_ebook_metadata', { filename, readingStatus: readingStatus ?? null, tags: tags ?? null });
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  saveProgress: (filename: string, progress: Partial<ReadingProgress>) => {
    const existing = get().readingProgress[filename];
    const updated: ReadingProgress = {
      ...existing,
      ...progress,
      lastReadAt: new Date().toISOString(),
    };
    const newProgress = { ...get().readingProgress, [filename]: updated };
    set({ readingProgress: newProgress });
    persistState(get());
  },

  getProgress: (filename: string) => {
    return get().readingProgress[filename] ?? null;
  },

  jumpToProgress: (tabId: string, percent: number) => {
    const handler = get().onJumpToProgress;
    if (handler) handler(tabId, percent);
  },

  setJumpToProgressHandler: (handler) => {
    set({ onJumpToProgress: handler });
  },

  addBookmark: (bookmark) => {
    const id = `bm-${Date.now().toString(36)}`;
    const entry: ReaderBookmark = {
      ...bookmark,
      id,
      createdAt: new Date().toISOString(),
    };
    const existing = get().bookmarks[bookmark.filename] ?? [];
    const newBookmarks = { ...get().bookmarks, [bookmark.filename]: [...existing, entry] };
    set({ bookmarks: newBookmarks });
    persistState(get());
  },

  removeBookmark: (id) => {
    const bookmarks = get().bookmarks;
    const newBookmarks: Record<string, ReaderBookmark[]> = {};
    for (const [filename, list] of Object.entries(bookmarks)) {
      const filtered = list.filter(b => b.id !== id);
      if (filtered.length > 0) newBookmarks[filename] = filtered;
    }
    set({ bookmarks: newBookmarks });
    persistState(get());
  },

  toggleReadingSidebar: () => {
    set({ readingSidebarOpen: !get().readingSidebarOpen });
    persistState(get());
  },

  annotations: {},

  loadAnnotations: async (filename: string) => {
    try {
      const json = await invoke<string>('load_annotations', { filename });
      const list: Annotation[] = JSON.parse(json);
      set(state => ({ annotations: { ...state.annotations, [filename]: list } }));
    } catch { /* ignore */ }
  },

  addAnnotation: (annotation: Annotation) => {
    const { annotations } = get();
    const list = annotations[annotation.filename] ?? [];
    const newList = [...list, annotation];
    const newMap = { ...annotations, [annotation.filename]: newList };
    set({ annotations: newMap });
    invoke('save_annotations', { filename: annotation.filename, annotationsJson: JSON.stringify(newList) }).catch(() => {});
  },

  removeAnnotation: (id: string, filename: string) => {
    const { annotations } = get();
    const list = annotations[filename] ?? [];
    const newList = list.filter(a => a.id !== id);
    const newMap = { ...annotations, [filename]: newList };
    set({ annotations: newMap });
    invoke('save_annotations', { filename, annotationsJson: JSON.stringify(newList) }).catch(() => {});
  },

  updateAnnotation: (id: string, filename: string, updates: Partial<Annotation>) => {
    const { annotations } = get();
    const list = annotations[filename] ?? [];
    const newList = list.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a);
    const newMap = { ...annotations, [filename]: newList };
    set({ annotations: newMap });
    invoke('save_annotations', { filename, annotationsJson: JSON.stringify(newList) }).catch(() => {});
  },

  restoreTabs: () => {
    const { lastTabs, lastActiveTabFilename } = loadPersistedState();
    if (!lastTabs || lastTabs.length === 0) return;
    const { books } = get();
    if (books.length === 0) return;
    const newTabs: ReaderTab[] = [];
    let newActiveTabId: string | null = null;
    for (const tabInfo of lastTabs) {
      const book = books.find(b => b.filename === tabInfo.filename);
      if (!book) continue;
      const tab: ReaderTab = {
        id: genTabId(),
        book,
        content: null,
        loading: true,
        error: null,
        progressPercent: 0,
        wordCount: 0,
        scrollPosition: 0,
        epubCfi: null,
        pdfPage: 1,
        pdfTotalPages: 0,
      };
      newTabs.push(tab);
      if (tabInfo.filename === lastActiveTabFilename) {
        newActiveTabId = tab.id;
      }
    }
    if (newTabs.length > 0) {
      set({
        tabs: newTabs,
        activeTabId: newActiveTabId ?? newTabs[0].id,
        currentView: 'reading',
      });
    }
  },

  // ── Per-book settings ──

  setPerBookSetting: (filename, settings) => {
    const current = get().perBookSettings;
    const existing = current[filename] ?? {};
    const updated = { ...current, [filename]: { ...existing, ...settings } };
    set({ perBookSettings: updated });
    persistState(get());
  },

  getEffectiveSettings: (filename) => {
    const s = get();
    const perBook = s.perBookSettings[filename] ?? {};
    return {
      fontSize: perBook.fontSize ?? s.fontSize,
      fontFamily: perBook.fontFamily ?? s.fontFamily,
      lineHeight: perBook.lineHeight ?? s.lineHeight,
      paragraphSpacing: perBook.paragraphSpacing ?? s.paragraphSpacing,
      contentWidth: perBook.contentWidth ?? s.contentWidth,
      textAlignment: perBook.textAlignment ?? s.textAlignment,
    };
  },

  setTextAlignment: (alignment) => {
    set({ textAlignment: alignment });
    persistState(get());
  },

  // ── AI Chat History ──

  addAiChatMessage: (filename, message) => {
    const history = get().aiChatHistory;
    const list = history[filename] ?? [];
    const newList = [...list, message];
    // 限制每本书最多保留 200 条消息，防止 localStorage 溢出
    if (newList.length > 200) newList.splice(0, newList.length - 200);
    set({ aiChatHistory: { ...history, [filename]: newList } });
    persistState(get());
  },

  clearAiChatHistory: (filename) => {
    const history = { ...get().aiChatHistory };
    delete history[filename];
    set({ aiChatHistory: history });
    persistState(get());
  },

  // ── Reading Stats ──

  recordReadingSession: (_filename, durationSeconds) => {
    const stats = get().readingStats;
    const today = new Date().toISOString().slice(0, 10);
    const newDailySeconds = { ...stats.dailySeconds };
    newDailySeconds[today] = (newDailySeconds[today] ?? 0) + durationSeconds;
    // 清理 365 天前的每日数据，防止无限增长
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    for (const key of Object.keys(newDailySeconds)) {
      if (key < cutoff) delete newDailySeconds[key];
    }
    set({
      readingStats: {
        ...stats,
        totalReadingSeconds: stats.totalReadingSeconds + durationSeconds,
        dailySeconds: newDailySeconds,
      },
    });
    persistState(get());
  },
}));
