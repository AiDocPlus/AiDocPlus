import { useState, useEffect, useMemo } from 'react';
import { Bookmark, BookmarkCheck, List, Plus, Trash2, Highlighter } from 'lucide-react';
import { useReaderStore, type TocEntry, type ReaderBookmark } from './useReaderStore';
import { useTranslation } from '@/i18n';
import { AnnotationPanel } from './components/reading/AnnotationPanel';
import type { Annotation } from './types/annotations';

interface ReadingSidebarProps {
  tocEntries: TocEntry[];
  onTocClick?: (entry: TocEntry) => void;
  currentScrollPercent?: number;
  currentHeadings?: { text: string; level: number }[];
  onAddBookmark?: () => void;
  onJumpToBookmark?: (bm: ReaderBookmark) => void;
  onJumpToAnnotation?: (annotation: Annotation) => void;
}

type SidebarTab = 'toc' | 'bookmarks' | 'annotations';

export function ReadingSidebar({
  tocEntries,
  onTocClick,
  currentHeadings,
  onAddBookmark,
  onJumpToBookmark,
  onJumpToAnnotation,
}: ReadingSidebarProps) {
  const { t } = useTranslation();
  const { bookmarks, removeBookmark, activeTabId, tabs, annotations } = useReaderStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>('toc');

  const activeBook = tabs.find(tb => tb.id === activeTabId)?.book;
  const filename = activeBook?.filename;
  const fileBookmarks = useMemo(
    () => (filename ? bookmarks[filename] ?? [] : []),
    [bookmarks, filename],
  );
  const annotationCount = useMemo(
    () => (filename ? (annotations[filename] ?? []).length : 0),
    [annotations, filename],
  );

  const bookmarkHeadings = useMemo(() => {
    if (!currentHeadings) return null;
    for (const h of currentHeadings) {
      if (h.level <= 2) return h.text;
    }
    return currentHeadings[0]?.text || '';
  }, [currentHeadings]);

  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0">
        <button
          onClick={() => setActiveTab('toc')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === 'toc' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <List className="h-3 w-3" />
          {t('reader.toc', { defaultValue: '目录' })}
        </button>
        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === 'bookmarks' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Bookmark className="h-3 w-3" />
          {t('reader.bookmarks', { defaultValue: '书签' })}
          {fileBookmarks.length > 0 && (
            <span className="ml-0.5 text-[10px] opacity-60">{fileBookmarks.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('annotations')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === 'annotations' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Highlighter className="h-3 w-3" />
          {t('reader.annotations', { defaultValue: '批注' })}
          {annotationCount > 0 && (
            <span className="ml-0.5 text-[10px] opacity-60">{annotationCount}</span>
          )}
        </button>
        <div className="flex-1" />
        {activeTab === 'bookmarks' && onAddBookmark && (
          <button
            onClick={onAddBookmark}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={t('reader.addBookmark', { defaultValue: '添加书签' })}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'toc' ? (
          <TocPanel entries={tocEntries} onTocClick={onTocClick} />
        ) : activeTab === 'bookmarks' ? (
          <BookmarksPanel
            bookmarks={fileBookmarks}
            onRemove={removeBookmark}
            onJumpToBookmark={onJumpToBookmark}
            emptyLabel={bookmarkHeadings}
          />
        ) : (
          filename ? (
            <AnnotationPanel filename={filename} onJumpToAnnotation={onJumpToAnnotation} />
          ) : null
        )}
      </div>
    </div>
  );
}

function TocPanel({ entries, onTocClick }: { entries: TocEntry[]; onTocClick?: (entry: TocEntry) => void }) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!entries.length) return;
    const observer = new IntersectionObserver(
      (items) => {
        for (const item of items) {
          if (item.isIntersecting) {
            setActiveId(item.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );

    entries.forEach((entry) => {
      if (entry.element) observer.observe(entry.element);
    });

    return () => observer.disconnect();
  }, [entries]);

  if (!entries.length) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground opacity-60">
        {t('reader.noHeadings', { defaultValue: '未检测到标题' })}
      </div>
    );
  }

  return (
    <div className="py-1">
      {entries.map((entry) => (
        <button
          key={entry.id}
          onClick={() => {
            entry.element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            onTocClick?.(entry);
          }}
          className={`w-full text-left text-xs px-2 py-1.5 rounded-sm transition-colors truncate ${
            activeId === entry.id
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-foreground/70 hover:bg-muted hover:text-foreground'
          }`}
          style={{ paddingLeft: `${(entry.level - 1) * 12 + 8}px` }}
        >
          {entry.text}
        </button>
      ))}
    </div>
  );
}

function BookmarksPanel({
  bookmarks,
  onRemove,
  onJumpToBookmark,
}: {
  bookmarks: ReaderBookmark[];
  onRemove: (id: string) => void;
  onJumpToBookmark?: (bm: ReaderBookmark) => void;
  emptyLabel?: string | null;
}) {
  const { t } = useTranslation();

  if (!bookmarks.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-muted-foreground opacity-60 px-4">
        <Bookmark className="h-6 w-6 opacity-30" />
        <p className="text-center">{t('reader.noBookmarks', { defaultValue: '暂无书签' })}</p>
        <p className="text-center text-[10px] opacity-70">
          {t('reader.bookmarkHint', { defaultValue: '点击 + 添加当前阅读位置' })}
        </p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {bookmarks.map((bm) => (
        <div
          key={bm.id}
          className="group flex items-start gap-2 px-2 py-1.5 hover:bg-muted rounded-sm cursor-pointer transition-colors"
          onClick={() => {
            onJumpToBookmark?.(bm);
          }}
        >
          <BookmarkCheck className="h-3 w-3 shrink-0 mt-0.5 text-primary/60" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{bm.label}</p>
            <p className="text-[10px] text-muted-foreground">{bm.progressPercent}%</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(bm.id);
            }}
            className="shrink-0 h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function extractHeadings(container: HTMLElement | null): TocEntry[] {
  if (!container) return [];
  const result: TocEntry[] = [];
  const selector = 'h1, h2, h3, h4, h5, h6';
  const headings = container.querySelectorAll(selector);
  headings.forEach((el) => {
    const heading = el as HTMLElement;
    const level = parseInt(heading.tagName[1], 10);
    const text = heading.textContent?.trim();
    if (!text) return;
    const id = `reader-toc-${result.length}`;
    heading.id = id;
    heading.setAttribute('data-reader-toc', 'true');
    result.push({ id, level, text, element: heading });
  });
  return result;
}
