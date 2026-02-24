import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { usePluginHost } from '../../_framework/PluginHostAPI';
import { Button } from '../../_framework/ui';
import { Loader2, AlertCircle, Download, Printer, ZoomIn, ZoomOut } from 'lucide-react';

interface DocxViewerProps {
  filePath: string;
  fileName: string;
  onError: (error: string) => void;
}

export function DocxViewer({ filePath, fileName, onError }: DocxViewerProps) {
  const host = usePluginHost();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(100);

  useEffect(() => {
    let cancelled = false;

    const renderDocx = async () => {
      setLoading(true);
      setError(null);

      try {
        // 读取文件
        const dataUrl = await host.platform.invoke<string>('read_file_base64', { path: filePath });
        const response = await fetch(dataUrl);
        const arrayBuffer = await response.arrayBuffer();

        if (cancelled) return;

        // 等待 containerRef 可用
        if (!containerRef.current) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        // 清空容器
        containerRef.current.innerHTML = '';

        // docx-preview 接受 ArrayBuffer
        await renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: 'docx-container',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
        });

        if (cancelled) return;
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        onError(`DOCX 渲染失败: ${errorMsg}`);
        setLoading(false);
      }
    };

    renderDocx();

    return () => {
      cancelled = true;
    };
  }, [filePath, host.platform, onError]);

  const handleZoomIn = () => {
    setScale(Math.min(scale + 10, 200));
  };

  const handleZoomOut = () => {
    setScale(Math.max(scale - 10, 50));
  };

  const handlePrint = () => {
    if (!containerRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onError('无法打开打印窗口，请检查弹窗阻止设置');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>打印 - ${fileName}</title>
          <style>
            body { margin: 20px; font-family: Arial, sans-serif; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${containerRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
          <p className="text-destructive font-medium">DOCX 加载失败</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        {/* 缩放控制 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleZoomOut}
          disabled={scale <= 50}
          title="缩小"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm w-12 text-center">{scale}%</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleZoomIn}
          disabled={scale >= 200}
          title="放大"
        >
          <ZoomIn className="h-4 w-4" />
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
        <span className="text-xs text-muted-foreground">{fileName}</span>
      </div>

      {/* 内容区 - 始终渲染 containerRef */}
      <div className="flex-1 overflow-auto bg-white relative">
        {/* 加载中状态覆盖层 */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">加载 DOCX 中...</p>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          className="p-4 origin-top-left"
          style={{ transform: `scale(${scale / 100})` }}
        />
      </div>
    </div>
  );
}
