import { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import type { Book, Rendition, NavItem } from 'epubjs';
import type { ReaderThemeConfig } from '../useReaderStore';
import { ChevronLeft, ChevronRight, List, X } from 'lucide-react';
import { useTranslation } from '@/i18n';

const FONT_FAMILIES: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  serif: '"Songti SC", "SimSun", "STSong", "Noto Serif SC", Georgia, "Times New Roman", serif',
  sans: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif',
};

interface EpubReaderProps {
  data: Uint8Array;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  theme: ReaderThemeConfig;
  /** 恢复上次阅读位置（EPUB CFI） */
  initialCfi?: string | null;
  onProgressChange?: (percent: number, epubCfi: string) => void;
}

/** 递归渲染 TOC 树（支持层级缩进） */
function TocTree({
  items,
  depth,
  onNavigate,
}: {
  items: NavItem[];
  depth: number;
  onNavigate: (href: string) => void;
}) {
  return (
    <>
      {items.map((item, i) => (
        <div key={`${item.id || i}-${depth}`}>
          <button
            onClick={() => onNavigate(item.href)}
            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted truncate transition-colors"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {item.label.trim()}
          </button>
          {item.subitems && item.subitems.length > 0 && (
            <TocTree items={item.subitems} depth={depth + 1} onNavigate={onNavigate} />
          )}
        </div>
      ))}
    </>
  );
}

export function EpubReader({ data, fontSize, fontFamily, lineHeight, theme, initialCfi, onProgressChange }: EpubReaderProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  // 用 ref 保存最新的 onProgressChange 回调，避免 effect 闭包陈旧
  const onProgressChangeRef = useRef(onProgressChange);
  onProgressChangeRef.current = onProgressChange;

  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyTheme = useCallback((rendition: Rendition, size: number, th: ReaderThemeConfig, lh: number, ff: string) => {
    const fontStack = FONT_FAMILIES[ff] ?? FONT_FAMILIES.system;
    rendition.themes.default({
      body: {
        background: th.bg,
        color: th.text,
        'font-size': `${size}px`,
        'font-family': fontStack,
        'line-height': String(lh),
        'max-width': '720px',
        margin: '0 auto',
        padding: '0 !important',
      },
      'p, div, li': {
        'line-height': String(lh),
        'margin-bottom': '0.5em',
      },
      'h1, h2, h3, h4': {
        'line-height': '1.3',
        'margin-top': '1.5em',
        color: th.heading,
      },
      a: {
        color: th.accent,
      },
      img: {
        'max-width': '100%',
        height: 'auto',
      },
      table: {
        'border-collapse': 'collapse',
        width: '100%',
      },
      'th, td': {
        border: '1px solid',
        padding: '0.5em',
      },
      pre: {
        'background-color': th.codeBg,
        color: th.text,
      },
      code: {
        'background-color': th.codeBg,
        color: th.text,
      },
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const book = ePub(arrayBuffer);
    bookRef.current = book;

    const rendition = book.renderTo(containerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
    });
    renditionRef.current = rendition;

    const displayTarget = initialCfi || undefined;
    rendition.display(displayTarget).then(() => {
      applyTheme(rendition, fontSize, theme, lineHeight, fontFamily);

      rendition.on('relocated', (location: { start: { cfi: string; percentage: number } }) => {
        const percent = Math.round(location.start.percentage * 100);
        setProgressPercent(percent);
        // 通过 ref 调用最新的回调，避免闭包陈旧
        onProgressChangeRef.current?.(percent, location.start.cfi);
      });

      book.locations.generate(1024).then(() => {
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    });

    book.loaded.navigation.then((nav: { toc: NavItem[] }) => {
      setToc(nav.toc || []);
    });

    return () => {
      renditionRef.current?.destroy();
      renditionRef.current = null;
      book.destroy();
      bookRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current, fontSize, theme, lineHeight, fontFamily);
    }
  }, [fontSize, theme, lineHeight, fontFamily, applyTheme]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          renditionRef.current?.prev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          renditionRef.current?.next();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const goNext = () => renditionRef.current?.next();
  const goPrev = () => renditionRef.current?.prev();
  const goToTocItem = (href: string) => {
    renditionRef.current?.display(href);
    setTocOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">{t('reader.loading', { defaultValue: '加载中...' })}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="reader-toolbar">
        <button onClick={goPrev} className="reader-renderer-btn" title={t('reader.prevPage', { defaultValue: '上一页' })}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground min-w-[60px] text-center font-medium tabular-nums">
          {progressPercent}%
        </span>
        <button onClick={goNext} className="reader-renderer-btn" title={t('reader.nextPage', { defaultValue: '下一页' })}>
          <ChevronRight className="h-4 w-4" />
        </button>
        {toc.length > 0 && (
          <>
            <div className="reader-toolbar-sep" />
            <button onClick={() => setTocOpen(!tocOpen)}
              className={`reader-renderer-btn ${tocOpen ? 'active' : ''}`}
              title={t('reader.toc', { defaultValue: '目录' })}>
              {tocOpen ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1" />
        {/* TOC 滑入动画 */}
        <div className={`shrink-0 border-l border-border overflow-hidden transition-all duration-300 ease-out ${
          tocOpen ? 'w-[240px] opacity-100' : 'w-0 opacity-0'
        }`}>
          <div className="w-[240px] h-full overflow-y-auto p-3 bg-card reader-scroll">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{t('reader.toc', { defaultValue: '目录' })}</p>
            <TocTree items={toc} depth={0} onNavigate={goToTocItem} />
          </div>
        </div>
      </div>
    </div>
  );
}
