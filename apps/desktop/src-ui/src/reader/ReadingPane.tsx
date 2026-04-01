import { useEffect, useRef, useCallback, useMemo, useState, useImperativeHandle, forwardRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useReaderStore, type EbookContent, type ReaderTab, type TocEntry } from './useReaderStore';
import { EpubReader } from './renderers/EpubReader';
import { PdfReader } from './renderers/PdfReader';
import { MarkdownReader } from './renderers/MarkdownReader';
import { HtmlReader } from './renderers/HtmlReader';
import { WordReader } from './renderers/WordReader';
import { ReadingSearch, domTextSearch, type SearchOptions } from './ReadingSearch';
import { extractHeadings } from './ReadingSidebar';
import { SelectionContextMenu } from './components/reading/SelectionContextMenu';
import { Loader2, AlertCircle, BookOpen, FileText } from 'lucide-react';
import { useTranslation } from '@/i18n';

export interface ReadingPaneHandle {
  getScrollContainer: () => HTMLDivElement | null;
}

interface ReadingPaneProps {
  tab: ReaderTab;
  onProgressChange?: (percent: number) => void;
  onWordCountChange?: (count: number) => void;
  onTocChange?: (entries: TocEntry[]) => void;
}

export const ReadingPane = forwardRef<ReadingPaneHandle, ReadingPaneProps>(
  function ReadingPane({ tab, onProgressChange, onWordCountChange, onTocChange }, ref) {
  const { t } = useTranslation();
  const {
    theme,
    setTabContent, setTabLoading, setTabError, setTabProgress,
    saveProgress, getProgress, closeTab, getEffectiveSettings,
  } = useReaderStore();

  const book = tab.book;
  const content = tab.content;
  const loading = tab.loading;
  const error = tab.error;

  // 使用 getEffectiveSettings 合并全局+单书设置
  const settings = getEffectiveSettings(book.filename);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const progressRestoredRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMatch, setSearchMatch] = useState({ count: 0, current: 0 });
  const searchOptionsRef = useRef<SearchOptions>({ caseSensitive: false, wholeWord: false });
  const lastSearchQueryRef = useRef('');
  const searchDirectionRef = useRef<'next' | 'prev'>('next');

  // 文本选择右键菜单
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; text: string } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 0) {
      e.preventDefault();
      setSelectionMenu({ x: e.clientX, y: e.clientY, text });
    } else {
      setSelectionMenu(null);
    }
  }, []);

  /** 获取上次阅读进度，用于恢复 EPUB/PDF 位置 */
  const savedReadingProgress = getProgress(book.filename);

  const binaryData = useMemo(() => {
    if (!content?.is_binary) return null;
    return Uint8Array.from(atob(content.data), (c) => c.charCodeAt(0));
  }, [content?.is_binary, content?.data]);

  const isScrollableFormat = book?.format === 'md' || book?.format === 'html';

  const performSearch = useCallback((query: string, options: SearchOptions) => {
    searchOptionsRef.current = options;
    lastSearchQueryRef.current = query;
    searchDirectionRef.current = 'next';
    if (book?.format === 'md' || book?.format === 'html') {
      const result = domTextSearch(scrollContainerRef.current, query, options);
      setSearchMatch({ count: result.count, current: result.currentIndex });
    }
  }, [book?.format]);

  const handleSearchNext = useCallback(() => {
    searchDirectionRef.current = 'next';
    if (book?.format === 'md' || book?.format === 'html') {
      const result = domTextSearch(scrollContainerRef.current, lastSearchQueryRef.current, searchOptionsRef.current, 'next');
      setSearchMatch({ count: result.count, current: result.currentIndex });
    }
  }, [book?.format]);

  const handleSearchPrev = useCallback(() => {
    searchDirectionRef.current = 'prev';
    if (book?.format === 'md' || book?.format === 'html') {
      const result = domTextSearch(scrollContainerRef.current, lastSearchQueryRef.current, searchOptionsRef.current, 'prev');
      setSearchMatch({ count: result.count, current: result.currentIndex });
    }
  }, [book?.format]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!book) return;
    if (content) return;

    let cancelled = false;
    setTabLoading(tab.id, true);
    progressRestoredRef.current = false;

    invoke<EbookContent>('read_ebook_file', { filename: book.filename })
      .then((data) => {
        if (!cancelled) {
          setTabContent(tab.id, data);
          if (isScrollableFormat) {
            const words = data.data.split(/\s+/).filter(Boolean).length;
            onWordCountChange?.(words);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setTabError(tab.id, String(e));
        }
      });

    return () => { cancelled = true; };
  }, [book?.filename, tab.id, content]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || !book) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;
    const percent = Math.round((el.scrollTop / scrollable) * 100);
    onProgressChange?.(percent);
    setTabProgress(tab.id, {
      scrollPosition: el.scrollTop,
      percent,
    });
    saveProgress(book.filename, {
      scrollPosition: el.scrollTop,
      progressPercent: percent,
    });
  }, [tab.id, book, saveProgress, setTabProgress, onProgressChange]);

  // 用 ref 存储最新 handleScroll，避免 effect 因依赖变化频繁重新注册
  const handleScrollRef = useRef(handleScroll);
  handleScrollRef.current = handleScroll;

  // 节流滚动事件（每 200ms 最多触发一次）
  useEffect(() => {
    if (!isScrollableFormat) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const throttled = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; handleScrollRef.current(); }, 200);
    };
    el.addEventListener('scroll', throttled, { passive: true });
    return () => {
      el.removeEventListener('scroll', throttled);
      if (timer) clearTimeout(timer);
    };
  }, [isScrollableFormat]);

  useEffect(() => {
    if (!book || !scrollContainerRef.current || progressRestoredRef.current) return;
    if (!content) return;
    if (!isScrollableFormat) return;

    const saved = getProgress(book.filename);
    if (saved?.scrollPosition && saved.scrollPosition > 0) {
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = saved.scrollPosition!;
          onProgressChange?.(saved.progressPercent ?? 0);
          progressRestoredRef.current = true;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [content, book, getProgress, onProgressChange]);

  // Listen for jump-to-progress requests from store
  useEffect(() => {
    if (!isScrollableFormat) return;
    const handler = (targetTabId: string, percent: number) => {
      if (targetTabId !== tab.id || !scrollContainerRef.current) return;
      const scrollable = scrollContainerRef.current.scrollHeight - scrollContainerRef.current.clientHeight;
      if (scrollable <= 0) return;
      scrollContainerRef.current.scrollTop = (percent / 100) * scrollable;
    };
    setTabProgress(tab.id, { percent: 0 });
    useReaderStore.getState().setJumpToProgressHandler(handler as any);
    return () => {
      useReaderStore.getState().setJumpToProgressHandler(null as any);
    };
  }, [tab.id, book?.format]);

  useImperativeHandle(ref, () => ({
    getScrollContainer: () => scrollContainerRef.current,
  }), []);

  useEffect(() => {
    if (!isScrollableFormat) {
      onTocChange?.([]);
      return;
    }
    if (!content) {
      onTocChange?.([]);
      return;
    }
    const timer = setTimeout(() => {
      const entries = extractHeadings(scrollContainerRef.current);
      onTocChange?.(entries);
    }, 500);
    return () => clearTimeout(timer);
  }, [content, book?.format, onTocChange]);

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground select-none">
        <div className="relative mb-6">
          <BookOpen className="h-20 w-20 opacity-10 stroke-1" />
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText className="h-8 w-8 opacity-15 stroke-1" />
          </div>
        </div>
        <p className="text-base font-medium mb-1 opacity-60">
          {t('reader.noBookSelected', { defaultValue: '选择一本书开始阅读' })}
        </p>
        <p className="text-xs opacity-40 max-w-[200px] text-center leading-relaxed">
          {t('reader.selectFromLibrary', { defaultValue: '从左侧书库选择一本书，或拖拽文件到此窗口' })}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-destructive text-sm">{error}</p>
        <button onClick={() => closeTab(tab.id)} className="text-sm text-muted-foreground hover:text-foreground">
          {t('reader.close', { defaultValue: '关闭' })}
        </button>
      </div>
    );
  }

  if (!content) return null;

  const format = book.format;

  const searchBar = searchOpen ? (
    <ReadingSearch
      onSearch={performSearch}
      onHighlightNext={handleSearchNext}
      onHighlightPrev={handleSearchPrev}
      onClose={() => {
        setSearchOpen(false);
        window.getSelection()?.removeAllRanges();
        setSearchMatch({ count: 0, current: 0 });
      }}
      matchCount={searchMatch.count}
      currentMatch={searchMatch.current}
    />
  ) : null;

  switch (format) {
    case 'epub':
      return binaryData ? (
        <div className="h-full flex flex-col">
          {searchBar}
          <div className="flex-1 min-h-0">
            <EpubReader
              data={binaryData}
              fontSize={settings.fontSize}
              fontFamily={settings.fontFamily}
              lineHeight={settings.lineHeight}
              theme={theme}
              initialCfi={savedReadingProgress?.epubCfi}
              onProgressChange={(percent, epubCfi) => {
                onProgressChange?.(percent);
                setTabProgress(tab.id, { percent, epubCfi });
                saveProgress(book.filename, { epubCfi, progressPercent: percent });
              }}
            />
          </div>
        </div>
      ) : null;
    case 'pdf':
      return binaryData ? (
        <div className="h-full flex flex-col">
          {searchBar}
          <div className="flex-1 min-h-0">
            <PdfReader
              data={binaryData}
              initialPage={savedReadingProgress?.currentPage}
              onPageChange={(page, total) => {
                const percent = total > 0 ? Math.round((page / total) * 100) : 0;
                onProgressChange?.(percent);
                setTabProgress(tab.id, { percent, pdfPage: page, pdfTotalPages: total });
                saveProgress(book.filename, { currentPage: page, progressPercent: percent });
              }}
            />
          </div>
        </div>
      ) : null;
    case 'docx':
      return binaryData ? (
        <div className="h-full flex flex-col">
          {searchBar}
          <div className="flex-1 min-h-0">
            <WordReader data={binaryData} theme={theme} onProgressChange={(percent) => {
              onProgressChange?.(percent);
              setTabProgress(tab.id, { percent });
              saveProgress(book.filename, { progressPercent: percent });
            }} />
          </div>
        </div>
      ) : null;
    case 'html':
    case 'md': {
      const readerProps = { content: content.data, fontSize: settings.fontSize, fontFamily: settings.fontFamily, lineHeight: settings.lineHeight, paragraphSpacing: settings.paragraphSpacing, contentWidth: settings.contentWidth, theme };
      const ReaderComponent = format === 'html' ? HtmlReader : MarkdownReader;
      return (
        <div className="h-full flex flex-col">
          {searchBar}
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto" onContextMenu={handleContextMenu}>
            <ReaderComponent {...readerProps} />
          </div>
          {selectionMenu && (
            <SelectionContextMenu
              x={selectionMenu.x} y={selectionMenu.y}
              selectedText={selectionMenu.text}
              filename={book.filename}
              scrollPosition={scrollContainerRef.current?.scrollTop}
              progressPercent={tab.progressPercent}
              onClose={() => setSelectionMenu(null)}
            />
          )}
        </div>
      );
    }
    default:
      return (
        <div className="flex items-center justify-center h-full text-destructive">
          {t('reader.unsupportedFormat', { defaultValue: '不支持的文件格式' })}
        </div>
      );
  }
});
