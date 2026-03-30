import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useReaderStore, type EbookContent } from './useReaderStore';
import { EpubReader } from './renderers/EpubReader';
import { PdfReader } from './renderers/PdfReader';
import { MarkdownReader } from './renderers/MarkdownReader';
import { HtmlReader } from './renderers/HtmlReader';
import { WordReader } from './renderers/WordReader';
import { Loader2, AlertCircle, BookOpen, FileText } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface ReadingPaneProps {
  onProgressChange?: (percent: number) => void;
}

export function ReadingPane({ onProgressChange }: ReadingPaneProps) {
  const { t } = useTranslation();
  const { currentBook, fontSize, fontFamily, lineHeight, paragraphSpacing, contentWidth, theme, closeBook, saveProgress, getProgress } = useReaderStore();
  const [content, setContent] = useState<EbookContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const progressRestoredRef = useRef(false);
  const currentFilenameRef = useRef<string | undefined>(undefined);

  // 稳定二进制数据引用，避免每次渲染创建新 Uint8Array 导致 PDF/EPUB 重新加载
  const binaryData = useMemo(() => {
    if (!content?.is_binary) return null;
    return Uint8Array.from(atob(content.data), (c) => c.charCodeAt(0));
  }, [content?.is_binary, content?.data]);

  // 加载电子书内容
  useEffect(() => {
    if (!currentBook) {
      setContent(null);
      progressRestoredRef.current = false;
      currentFilenameRef.current = undefined;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    progressRestoredRef.current = false;
    currentFilenameRef.current = currentBook.filename;

    invoke<EbookContent>('read_ebook_file', { filename: currentBook.filename })
      .then((data) => {
        if (!cancelled) {
          setContent(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [currentBook?.filename]);

  // Markdown / HTML 滚动进度追踪
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const filename = currentFilenameRef.current;
    if (!filename) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;
    const percent = Math.round((el.scrollTop / scrollable) * 100);
    onProgressChange?.(percent);
    saveProgress(filename, {
      scrollPosition: el.scrollTop,
      progressPercent: percent,
    });
  }, [saveProgress, onProgressChange]);

  // 恢复 Markdown / HTML 滚动位置
  useEffect(() => {
    if (!currentBook || !scrollContainerRef.current || progressRestoredRef.current) return;
    if (!content) return;
    if (currentBook.format !== 'md' && currentBook.format !== 'html') return;

    const saved = getProgress(currentBook.filename);
    if (saved?.scrollPosition && saved.scrollPosition > 0) {
      // 延迟恢复，等待内容渲染完成
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = saved.scrollPosition!;
          onProgressChange?.(saved.progressPercent ?? 0);
          progressRestoredRef.current = true;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [content, currentBook, getProgress, onProgressChange]);

  if (!currentBook) {
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
        <button onClick={closeBook} className="text-sm text-muted-foreground hover:text-foreground">
          {t('reader.open', { defaultValue: '关闭' })}
        </button>
      </div>
    );
  }

  if (!content) return null;

  const format = currentBook.format;

  switch (format) {
    case 'epub':
      return binaryData ? (
        <EpubReader
          data={binaryData}
          fontSize={fontSize}
          theme={theme.mode}
          onProgressChange={(percent, epubCfi) => {
            onProgressChange?.(percent);
            saveProgress(currentBook.filename, { epubCfi, progressPercent: percent });
          }}
        />
      ) : null;
    case 'pdf':
      return binaryData ? (
        <PdfReader
          data={binaryData}
          onPageChange={(page, total) => {
            const percent = total > 0 ? Math.round((page / total) * 100) : 0;
            onProgressChange?.(percent);
            saveProgress(currentBook.filename, { currentPage: page, progressPercent: percent });
          }}
        />
      ) : null;
    case 'docx':
      return binaryData ? <WordReader data={binaryData} /> : null;
    case 'html':
      return (
        <div ref={scrollContainerRef} className="h-full overflow-auto" onScroll={handleScroll}>
          <HtmlReader content={content.data} fontSize={fontSize} fontFamily={fontFamily} lineHeight={lineHeight} paragraphSpacing={paragraphSpacing} contentWidth={contentWidth} theme={theme} />
        </div>
      );
    case 'md':
      return (
        <div ref={scrollContainerRef} className="h-full overflow-auto" onScroll={handleScroll}>
          <MarkdownReader content={content.data} fontSize={fontSize} fontFamily={fontFamily} lineHeight={lineHeight} paragraphSpacing={paragraphSpacing} contentWidth={contentWidth} theme={theme} />
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center h-full text-destructive">
          {t('reader.unsupportedFormat', { defaultValue: '不支持的文件格式' })}
        </div>
      );
  }
}
