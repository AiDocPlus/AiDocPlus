import { useEffect, useRef, useState, useCallback } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import { ZoomIn, ZoomOut, Loader2, ChevronLeft } from 'lucide-react';

// 本地加载 PDF.js Worker，不依赖 CDN（离线可用）
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfReaderProps {
  data: Uint8Array;
  /** 恢复上次阅读页码 */
  initialPage?: number;
  onPageChange?: (page: number, total: number) => void;
}

export function PdfReader({ data, initialPage, onPageChange }: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesWrapperRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const renderingPagesRef = useRef(new Set<number>());
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState('');
  const renderedScaleRef = useRef<number>(0);
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const initialPageRestoredRef = useRef(false);

  // Load PDF when data changes
  useEffect(() => {
    let cancelled = false;
    let docRef: PDFDocumentProxy | null = null;
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setScale(0);
      renderedScaleRef.current = 0;
      try {
        const pdf = await getDocument({ data: new Uint8Array(data) }).promise;
        if (cancelled) { pdf.destroy(); return; }
        docRef = pdf;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };
    if (data?.length) loadPdf();
    return () => { cancelled = true; docRef?.destroy(); };
  }, [data]);

  // PDF 加载后 → 适应宽度计算 scale
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    let cancelled = false;
    const fitWidth = async () => {
      try {
        const page = await pdfDoc.getPage(1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = containerRef.current!.clientWidth - 48;
        const newScale = Math.max(0.5, Math.min(3, containerWidth / viewport.width));
        setScale(newScale);
      } catch { /* keep scale 0, will retry */ }
    };
    fitWidth();
    return () => { cancelled = true; };
  }, [pdfDoc]);

  // 键盘缩放
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '+' || e.key === '=') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setScale(s => s > 0 ? Math.min(3, s + 0.2) : s);
      } else if (e.key === '-' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setScale(s => s > 0 ? Math.max(0.5, s - 0.2) : s);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 渲染单页到 canvas
  const renderPage = useCallback(async (
    pdf: PDFDocumentProxy,
    pageNum: number,
    targetScale: number,
  ) => {
    if (renderingPagesRef.current.has(pageNum)) return;

    const canvas = pagesWrapperRef.current?.querySelector<HTMLCanvasElement>(`canvas[data-page-num="${pageNum}"]`);
    if (!canvas) return;

    renderingPagesRef.current.add(pageNum);

    try {
      const page = await pdf.getPage(pageNum);

      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale: targetScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const task = page.render({ canvas, canvasContext: context, viewport });
      await task.promise;
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name !== 'RenderingCancelledException') {
        // ignore
      }
    } finally {
      renderingPagesRef.current.delete(pageNum);
    }
  }, []);

  // scale 就绪后：创建 Observer 懒渲染 + 滚动检测当前页
  useEffect(() => {
    if (!pdfDoc || !pagesWrapperRef.current || totalPages === 0 || scale <= 0) return;

    // scale 变化时需要重置
    if (renderedScaleRef.current !== scale) {
      renderedScaleRef.current = scale;
      // 清空所有 canvas 内容，让 observer 重新触发渲染
      const canvases = pagesWrapperRef.current!.querySelectorAll<HTMLCanvasElement>('canvas[data-page-num]');
      canvases.forEach(c => {
        c.width = 0;
        c.height = 0;
      });
    }

    observerRef.current?.disconnect();

    const currentPdf = pdfDoc;
    const currentScale = scale;
    const totalPagesVal = totalPages;

    const observer = new IntersectionObserver(
      (entries) => {
        // 渲染进入视口的页面 + 前后各 1 页预渲染
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const pageNum = parseInt(entry.target.getAttribute('data-page-num')!, 10);
          renderPage(currentPdf, pageNum, currentScale);
          if (pageNum > 1) renderPage(currentPdf, pageNum - 1, currentScale);
          if (pageNum < totalPagesVal) renderPage(currentPdf, pageNum + 1, currentScale);
        }

        // 当前页 = 视口内最上方的页面
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          const topEntry = visible.reduce((a, b) =>
            a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
          );
          const topPage = parseInt(topEntry.target.getAttribute('data-page-num')!, 10);
          setCurrentPage(prev => prev !== topPage ? topPage : prev);
          onPageChangeRef.current?.(topPage, totalPagesVal);
        }
      },
      {
        root: containerRef.current,
        rootMargin: '300px 0px 300px 0px',
        threshold: 0,
      }
    );

    const canvases = pagesWrapperRef.current.querySelectorAll<HTMLCanvasElement>('canvas[data-page-num]');
    canvases.forEach(c => observer.observe(c));
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [pdfDoc, totalPages, scale, renderPage]);

  // 通知外部页码变化
  useEffect(() => {
    if (totalPages > 0) {
      onPageChangeRef.current?.(currentPage, totalPages);
    }
  }, [currentPage, totalPages]);

  // 清理
  useEffect(() => {
    return () => { observerRef.current?.disconnect(); };
  }, []);

  const scrollToPage = useCallback((pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages || !containerRef.current) return;
    const canvas = pagesWrapperRef.current?.querySelector<HTMLElement>(`canvas[data-page-num="${pageNum}"]`);
    if (canvas) {
      canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum);
      onPageChangeRef.current?.(pageNum, totalPages);
    }
  }, [totalPages]);

  // 恢复上次阅读页码
  useEffect(() => {
    if (!pdfDoc || scale <= 0 || !initialPage || initialPage <= 1 || initialPageRestoredRef.current) return;
    initialPageRestoredRef.current = true;
    const timer = setTimeout(() => {
      scrollToPage(initialPage);
    }, 300);
    return () => clearTimeout(timer);
  }, [pdfDoc, scale, initialPage, scrollToPage]);

  const handlePageInputSubmit = useCallback(() => {
    const num = parseInt(pageInput, 10);
    if (!isNaN(num)) scrollToPage(num);
    setPageInput('');
  }, [pageInput, scrollToPage]);

  if (loading || (pdfDoc && scale <= 0)) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="reader-toolbar">
        <button onClick={() => currentPage > 1 && scrollToPage(currentPage - 1)} className="reader-renderer-btn" aria-label="Previous page" disabled={currentPage <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="text"
          value={pageInput || String(currentPage)}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePageInputSubmit(); if (e.key === 'Escape') setPageInput(''); }}
          className="w-10 text-center text-xs bg-transparent border border-border rounded px-1 py-0.5 font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">/ {totalPages}</span>
        <div className="reader-toolbar-sep" />
        <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="reader-renderer-btn" aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground min-w-[44px] text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="reader-renderer-btn" aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto bg-muted/30 p-6">
        <div ref={pagesWrapperRef} className="flex flex-col items-center gap-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <canvas
              key={pageNum}
              data-page-num={pageNum}
              className="max-w-full shadow-sm"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
