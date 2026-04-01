import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';
import type { ReaderThemeConfig } from '../useReaderStore';
import { useTranslation } from '@/i18n';

interface WordReaderProps {
  data: Uint8Array;
  theme?: ReaderThemeConfig;
  onProgressChange?: (percent: number) => void;
}

export function WordReader({ data, theme, onProgressChange }: WordReaderProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const onProgressChangeRef = useRef(onProgressChange);
  onProgressChangeRef.current = onProgressChange;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!containerRef.current) return;
      setLoading(true);
      setError(null);
      try {
        const { renderAsync } = await import('docx-preview');
        if (cancelled) return;
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        containerRef.current!.innerHTML = '';
        await renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: 'docx-viewer',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          useBase64URL: true,
        });
        if (!cancelled) setLoading(false);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    };
    render();
    return () => { cancelled = true; };
  }, [data]);

  // 注入主题覆盖样式
  useEffect(() => {
    if (!theme || !contentRef.current) return;
    const wrapper = contentRef.current.querySelector('.docx-wrapper') as HTMLElement | null;
    if (wrapper) {
      wrapper.style.backgroundColor = theme.bg;
      wrapper.style.color = theme.text;
    }
    // 对 docx-preview 内部 section 元素也注入主题
    const sections = contentRef.current.querySelectorAll('.docx-wrapper > section');
    sections.forEach((sec) => {
      const el = sec as HTMLElement;
      el.style.backgroundColor = theme.bg;
      el.style.color = theme.text;
      el.style.boxShadow = `0 0 8px rgba(0,0,0,0.08)`;
    });
  }, [theme, loading]);

  // 滚动进度追踪
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const scrollable = el.scrollHeight - el.clientHeight;
      if (scrollable <= 0) return;
      const percent = Math.round((el.scrollTop / scrollable) * 100);
      onProgressChangeRef.current?.(percent);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale(s => Math.min(3, Math.round((s + 0.1) * 10) / 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(s => Math.max(0.3, Math.round((s - 0.1) * 10) / 10));
  }, []);

  return (
    <div className="flex flex-col h-full relative">
      {/* 缩放工具栏 */}
      <div className="flex items-center justify-center gap-2 p-2 border-b border-border bg-card shrink-0">
        <button onClick={handleZoomOut} disabled={scale <= 0.3}
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted disabled:opacity-50 transition-colors"
          aria-label={t('reader.zoomOut', { defaultValue: 'Zoom out' })}>
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground min-w-[50px] text-center font-mono tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <button onClick={handleZoomIn} disabled={scale >= 3}
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted disabled:opacity-50 transition-colors"
          aria-label={t('reader.zoomIn', { defaultValue: 'Zoom in' })}>
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      {/* 内容区 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto relative bg-muted/20">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 z-10">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
        <div className="flex justify-center p-4">
          <div
            ref={contentRef}
            className="origin-top"
            style={{ zoom: scale }}
          >
            <div ref={containerRef} className="docx-viewer-wrapper docx-viewer-container" />
          </div>
        </div>
      </div>
    </div>
  );
}
