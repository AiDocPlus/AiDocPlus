import { useEffect, useRef, useState, useCallback } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import { Button } from '../../_framework/ui';
import { usePluginHost } from '../../_framework/PluginHostAPI';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle,
  Maximize2, Download, Printer, RotateCw, Maximize
} from 'lucide-react';

// 设置 PDF.js worker
GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';

interface PdfViewerProps {
  filePath: string;
  fileName: string;
  onError: (error: string) => void;
}

export function PdfViewer({ filePath, fileName, onError }: PdfViewerProps) {
  const host = usePluginHost();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [fitMode, setFitMode] = useState<'none' | 'width' | 'page'>('none');
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载 PDF
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        // 读取文件
        const dataUrl = await host.platform.invoke<string>('read_file_base64', { path: filePath });
        const response = await fetch(dataUrl);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        if (cancelled) return;

        const loadingTask = getDocument({
          data: uint8Array,
          useSystemFonts: true,
        });

        const pdf = await loadingTask.promise;

        if (cancelled) return;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        if (cancelled) return;
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        onError(`PDF 加载失败: ${errorMsg}`);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (filePath) {
      loadPdf();
    }

    return () => {
      cancelled = true;
    };
  }, [filePath, host.platform, onError]);

  // 计算适应模式的缩放比例
  const calculateFitScale = useCallback(async (pageNum: number, mode: 'width' | 'page') => {
    if (!pdfDoc || !containerRef.current) return scale;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1, rotation });

    const containerWidth = containerRef.current.clientWidth - 32;
    const containerHeight = containerRef.current.clientHeight - 32;

    if (mode === 'width') {
      return containerWidth / viewport.width;
    } else {
      const scaleX = containerWidth / viewport.width;
      const scaleY = containerHeight / viewport.height;
      return Math.min(scaleX, scaleY);
    }
  }, [pdfDoc, rotation, scale]);

  // 渲染页面
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || loading) return;

    let cancelled = false;

    const renderPage = async () => {
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        // 计算实际缩放比例
        let actualScale = scale;
        if (fitMode !== 'none') {
          actualScale = await calculateFitScale(currentPage, fitMode);
        }

        const viewport = page.getViewport({ scale: actualScale, rotation });

        // 设置设备像素比以获得清晰渲染
        const outputScale = window.devicePixelRatio || 1;

        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d');
        if (!context) {
          onError('无法创建 Canvas 上下文');
          return;
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1
          ? [outputScale, 0, 0, outputScale, 0, 0]
          : undefined;

        const renderContext = {
          canvasContext: context,
          viewport,
          transform,
        };

        // @ts-expect-error pdfjs-dist 类型版本差异，运行时正常
        await page.render(renderContext).promise;
      } catch (err) {
        if (cancelled) return;
        onError(`页面渲染失败: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (!cancelled) {
          setRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale, rotation, fitMode, loading, calculateFitScale, onError]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleZoomIn = () => {
    setScale(Math.min(scale + 0.2, 3));
    setFitMode('none');
  };

  const handleZoomOut = () => {
    setScale(Math.max(scale - 0.2, 0.5));
    setFitMode('none');
  };

  const handleFitWidth = () => {
    setFitMode(fitMode === 'width' ? 'none' : 'width');
  };

  const handleFitPage = () => {
    setFitMode(fitMode === 'page' ? 'none' : 'page');
  };

  const handleRotate = () => {
    setRotation((rotation + 90) % 360);
  };

  const handlePrint = async () => {
    if (!pdfDoc) return;

    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        onError('无法打开打印窗口，请检查弹窗阻止设置');
        return;
      }

      printWindow.document.write(`
        <html>
          <head><title>打印 PDF - ${fileName}</title></head>
          <body style="margin:0; padding:0;">
            <div id="print-container"></div>
          </body>
        </html>
      `);

      const container = printWindow.document.getElementById('print-container');

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5, rotation });

        const canvas = printWindow.document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.display = 'block';
        canvas.style.marginBottom = '20px';

        if (container) {
          container.appendChild(canvas);
        }

        // @ts-expect-error pdfjs-dist 类型版本差异，运行时正常
        await page.render({
          canvasContext: context,
          viewport,
        }).promise;
      }

      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      onError(`打印失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDownload = async () => {
    try {
      const dataUrl = await host.platform.invoke<string>('read_file_base64', { path: filePath });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      onError(`下载失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 错误状态
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md p-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <p className="text-destructive font-medium">PDF 加载失败</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex-wrap">
        {/* 页面导航 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handlePrevPage}
          disabled={currentPage <= 1 || loading}
          title="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm min-w-[60px] text-center">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleNextPage}
          disabled={currentPage >= totalPages || loading}
          title="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* 缩放控制 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleZoomOut}
          disabled={scale <= 0.5 && fitMode === 'none'}
          title="缩小"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleZoomIn}
          disabled={scale >= 3 && fitMode === 'none'}
          title="放大"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        {/* 适应模式 */}
        <Button
          variant={fitMode === 'width' ? 'default' : 'outline'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleFitWidth}
          title="适应宽度"
        >
          <Maximize className="h-4 w-4" />
        </Button>
        <Button
          variant={fitMode === 'page' ? 'default' : 'outline'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleFitPage}
          title="适应页面"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* 旋转 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleRotate}
          title="旋转 90°"
        >
          <RotateCw className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* 打印和下载 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handlePrint}
          title="打印"
        >
          <Printer className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleDownload}
          title="下载"
        >
          <Download className="h-4 w-4" />
        </Button>

        <div className="flex-1" />
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{fileName}</span>
      </div>

      {/* 内容区 */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/20 p-4 relative">
        {/* 加载中状态 */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">加载 PDF 中...</p>
            </div>
          </div>
        )}

        {/* 渲染中提示 */}
        {rendering && !loading && (
          <div className="absolute top-2 right-2 flex items-center gap-2 text-muted-foreground bg-white/80 px-2 py-1 rounded z-10">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">渲染中...</span>
          </div>
        )}

        {/* PDF Canvas */}
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            style={{
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              backgroundColor: 'white',
            }}
          />
        </div>
      </div>
    </div>
  );
}
