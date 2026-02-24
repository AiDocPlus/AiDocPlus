import { useEffect, useRef, useState } from 'react';
import { init, type PptxViewer as PptxViewerType } from 'pptx-preview';
import { usePluginHost } from '../../_framework/PluginHostAPI';
import { Button } from '../../_framework/ui';
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle,
  Download, Maximize2, Minimize2
} from 'lucide-react';

interface PptxViewerProps {
  filePath: string;
  fileName: string;
  onError: (error: string) => void;
}

export function PptxViewer({ filePath, fileName, onError }: PptxViewerProps) {
  const host = usePluginHost();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PptxViewerType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPptx = async () => {
      setLoading(true);
      setError(null);
      setCurrentSlide(1);
      setTotalSlides(0);

      try {
        // 读取文件
        const dataUrl = await host.platform.invoke<string>('read_file_base64', { path: filePath });
        const response = await fetch(dataUrl);
        const arrayBuffer = await response.arrayBuffer();

        if (cancelled || !containerRef.current) return;

        // 清空容器
        containerRef.current.innerHTML = '';

        // 初始化预览器
        viewerRef.current = init(containerRef.current, {
          width: 960,
          height: 540,
        });

        // 预览 PPTX
        await viewerRef.current.preview(arrayBuffer);

        if (cancelled) return;

        // 获取幻灯片总数（pptx-preview 会渲染所有幻灯片）
        // 我们通过监听滚动或点击来跟踪当前幻灯片
        const slides = containerRef.current.querySelectorAll('.pptx-slide');
        setTotalSlides(slides.length);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        onError(`PPTX 加载失败: ${errorMsg}`);
        setLoading(false);
      }
    };

    loadPptx();

    return () => {
      cancelled = true;
      viewerRef.current = null;
    };
  }, [filePath, host.platform, onError]);

  // 幻灯片导航
  const handlePrevSlide = () => {
    if (!containerRef.current || currentSlide <= 1) return;

    const slides = containerRef.current.querySelectorAll('.pptx-slide');
    if (slides[currentSlide - 2]) {
      slides[currentSlide - 2].scrollIntoView({ behavior: 'smooth', block: 'center' });
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleNextSlide = () => {
    if (!containerRef.current || currentSlide >= totalSlides) return;

    const slides = containerRef.current.querySelectorAll('.pptx-slide');
    if (slides[currentSlide]) {
      slides[currentSlide].scrollIntoView({ behavior: 'smooth', block: 'center' });
      setCurrentSlide(currentSlide + 1);
    }
  };

  // 全屏切换
  const handleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        onError(`全屏失败: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 下载原文件
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
          <p className="text-destructive font-medium">PPTX 加载失败</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        {/* 幻灯片导航 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handlePrevSlide}
          disabled={currentSlide <= 1 || loading}
          title="上一张"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm min-w-[60px] text-center">
          {currentSlide} / {totalSlides || 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleNextSlide}
          disabled={currentSlide >= totalSlides || loading}
          title="下一张"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* 全屏和下载 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleFullscreen}
          disabled={loading}
          title={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
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
      <div className="flex-1 overflow-auto bg-muted/20 relative">
        {/* 加载中状态 */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">加载 PPTX 中...</p>
            </div>
          </div>
        )}

        {/* PPTX 渲染容器 */}
        <div
          ref={containerRef}
          className="p-4 min-h-full [&>.pptx-preview-wrapper]:mx-auto"
        />
      </div>
    </div>
  );
}
