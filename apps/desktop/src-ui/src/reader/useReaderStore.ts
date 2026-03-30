import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

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
  /** 滚动位置（Markdown / HTML） */
  scrollPosition?: number;
  /** 当前页（PDF） */
  currentPage?: number;
  /** EPUB CFI 位置 */
  epubCfi?: string;
  /** 进度百分比 0-100 */
  progressPercent?: number;
  /** 最近阅读时间 ISO */
  lastReadAt: string;
}

/** 阅读器主题配色 */
export interface ReaderThemeConfig {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  bg: string;
  text: string;
  heading: string;
  muted: string;
  accent: string;
  codeBg: string;
}

export type ReaderSortField = 'custom' | 'name' | 'addedAt' | 'lastReadAt';

export const READER_THEME_PRESETS: ReaderThemeConfig[] = [
  { id: 'default',   name: '默认白',   mode: 'light', bg: '#ffffff', text: '#1a1a1a', heading: '#111111', muted: '#666666', accent: '#2563eb', codeBg: '#f5f5f5' },
  { id: 'paper',     name: '纸张',     mode: 'light', bg: '#faf8f5', text: '#2c2c2c', heading: '#1a1a1a', muted: '#888888', accent: '#c77832', codeBg: '#f0eeeb' },
  { id: 'sepia',     name: '羊皮纸',   mode: 'light', bg: '#f5ecd7', text: '#5b4636', heading: '#3d2e1f', muted: '#8a7560', accent: '#a0522d', codeBg: '#ebe2cf' },
  { id: 'warm',      name: '暖黄',     mode: 'light', bg: '#fef9ef', text: '#4a4a4a', heading: '#333333', muted: '#999999', accent: '#d97706', codeBg: '#fdf3e0' },
  { id: 'green',     name: '护眼绿',   mode: 'light', bg: '#c7edcc', text: '#2d4a32', heading: '#1e3523', muted: '#5a7d5f', accent: '#2d7a46', codeBg: '#b5dfbb' },
  { id: 'gray',      name: '浅灰',     mode: 'light', bg: '#e8e8e8', text: '#333333', heading: '#1a1a1a', muted: '#777777', accent: '#2563eb', codeBg: '#dddcdc' },
  { id: 'dark',      name: '深灰',     mode: 'dark',  bg: '#1e1e1e', text: '#d4d4d4', heading: '#e5e5e5', muted: '#888888', accent: '#60a5fa', codeBg: '#2d2d2d' },
  { id: 'amoled',    name: '纯黑',     mode: 'dark',  bg: '#000000', text: '#c0c0c0', heading: '#e0e0e0', muted: '#707070', accent: '#6cb4ee', codeBg: '#111111' },
];

interface ReaderState {
  books: EbookInfo[];
  categories: EbookCategory[];
  currentBook: EbookInfo | null;
  isLoading: boolean;
  error: string | null;
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
  /** 阅读进度（按 filename 索引） */
  readingProgress: Record<string, ReadingProgress>;

  loadLibrary: () => Promise<void>;
  importFile: (path: string, categoryId?: string | null) => Promise<EbookInfo | null>;
  deleteBook: (filename: string) => Promise<void>;
  openBook: (book: EbookInfo) => void;
  closeBook: () => void;
  renameBook: (filename: string, newName: string) => Promise<void>;
  moveBook: (filename: string, categoryId: string | null, sortOrder?: number) => Promise<void>;
  createCategory: (name: string, parentId?: string | null) => Promise<EbookCategory | null>;
  renameCategory: (id: string, newName: string) => Promise<void>;
  deleteCategory: (id: string, moveBooksToParent: boolean) => Promise<void>;
  moveCategory: (categoryId: string, newParentId: string | null) => Promise<void>;
  reorderBooks: (categoryId: string | null, orderedFilenames: string[]) => Promise<void>;
  reorderCategories: (parentId: string | null, orderedIds: string[]) => Promise<void>;
  toggleStarred: (filename: string) => Promise<void>;
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
  clearError: () => void;
  saveProgress: (filename: string, progress: Partial<ReadingProgress>) => void;
  getProgress: (filename: string) => ReadingProgress | null;
}

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 32;
const FONT_SIZE_STEP = 2;

const STORAGE_KEY = 'aidocplus-reader-state';

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
  };
}

function persistState(s: ReaderState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ps(s)));
  } catch { /* ignore */ }
}

/** 兼容旧版 theme 字符串 → 迁移为 ReaderThemeConfig */
function migrateTheme(theme: unknown): ReaderThemeConfig {
  if (theme && typeof theme === 'object' && 'bg' in theme) return theme as ReaderThemeConfig;
  if (theme === 'dark') return READER_THEME_PRESETS[6]; // dark
  if (theme === 'sepia') return READER_THEME_PRESETS[2]; // sepia
  return READER_THEME_PRESETS[0]; // default
}

const persisted = loadPersistedState();

export const useReaderStore = create<ReaderState>((set, get) => ({
  books: [],
  categories: [],
  currentBook: null,
  isLoading: false,
  error: null,
  fontSize: persisted.fontSize ?? 16,
  fontFamily: persisted.fontFamily ?? 'system',
  lineHeight: persisted.lineHeight ?? 1.8,
  paragraphSpacing: persisted.paragraphSpacing ?? 1,
  contentWidth: persisted.contentWidth ?? 800,
  theme: migrateTheme(persisted.theme) ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? READER_THEME_PRESETS[6] : READER_THEME_PRESETS[0]),
  isFullscreen: false,
  sidebarOpen: persisted.sidebarOpen ?? true,
  sidebarWidth: persisted.sidebarWidth ?? 280,
  sortField: persisted.sortField ?? 'custom',
  sortDirection: persisted.sortDirection ?? 'asc',
  starredFilter: persisted.starredFilter ?? false,
  readingProgress: persisted.readingProgress ?? {},

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

  deleteBook: async (filename: string) => {
    try {
      await invoke('delete_ebook', { filename });
      const { currentBook, readingProgress } = get();
      if (currentBook?.filename === filename) {
        set({ currentBook: null });
      }
      const { [filename]: _, ...rest } = readingProgress;
      set({ readingProgress: rest });
      persistState({ ...get(), readingProgress: rest });
      await get().loadLibrary();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  openBook: (book: EbookInfo) => {
    set({ currentBook: book, error: null });
  },

  closeBook: () => {
    set({ currentBook: null });
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
}));
