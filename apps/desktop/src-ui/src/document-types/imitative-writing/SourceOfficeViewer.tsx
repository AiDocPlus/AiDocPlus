/**
 * 原文 OfficeViewer — DOCX / PDF 渲染包装器
 * 使用 invoke 直接访问 Tauri 后端，不依赖 usePluginHost
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { renderAsync } from 'docx-preview';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import {
  Loader2, AlertCircle, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, RotateCw, FolderOpen, FileText, Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SourceViewMode } from './constants';

GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';

interface SourceOfficeViewerProps {
  filePath: string | undefined;
  fileName: string | undefined;
  fileType: 'docx' | 'pdf' | undefined;
  viewMode: SourceViewMode;
  onFileLoad: (path: string, name: string, type: 'docx' | 'pdf') => void;
  onExtractText: (text: string) => void;
}

export function SourceOfficeViewer({
  filePath,
  fileName,
  fileType,
  viewMode,
  onFileLoad,
  onExtractText,
}: SourceOfficeViewerProps) {
  const { t } = useTranslation();

  const handleOpenFile = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Office 文档', extensions: ['docx', 'pdf'] }],
    });
    if (!selected) return;
    const path = typeof selected === 'string' ? selected : selected[0];
    const namePart = path.split('/').pop() || path.split('\\').pop() || 'file';
    const ext = namePart.split('.').pop()?.toLowerCase() as 'docx' | 'pdf' | undefined;
    if (ext !== 'docx' && ext !== 'pdf') return;
    onFileLoad(path, namePart, ext);
  }, [onFileLoad]);

  if (!filePath || !fileType) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">
          {t('imitativeWriting.source.noFile', { defaultValue: '尚未选择文件' })}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleOpenFile}>
          <FolderOpen className="h-3.5 w-3.5" />
          {t('imitativeWriting.source.openFile', { defaultValue: '打开 DOCX/PDF 文件' })}
        </Button>
      </div>
    );
  }

  if (viewMode === 'docx-viewer' && fileType === 'docx') {
    return (
      <DocxViewerInline
        filePath={filePath}
        fileName={fileName || ''}
        onExtractText={onExtractText}
        onOpenFile={handleOpenFile}
      />
    );
  }
  if (viewMode === 'pdf-viewer' && fileType === 'pdf') {
    return (
      <PdfViewerInline
        filePath={filePath}
        fileName={fileName || ''}
        onExtractText={onExtractText}
        onOpenFile={handleOpenFile}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <AlertCircle className="h-8 w-8 opacity-40" />
      <p className="text-sm">
        {t('imitativeWriting.source.viewModeMismatch', { defaultValue: '文件类型与视图模式不匹配' })}
      </p>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleOpenFile}>
        <FolderOpen className="h-3.5 w-3.5" />
        {t('imitativeWriting.source.openFile', { defaultValue: '打开 DOCX/PDF 文件' })}
      </Button>
    </div>
  );
}

// ── DOCX 渲染组件 ──

function DocxViewerInline({ filePath, fileName, onExtractText, onOpenFile }: {
  filePath: string; fileName: string;
  onExtractText: (text: string) => void;
  onOpenFile: () => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(100);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!containerRef.current) return;
      setLoading(true);
      setError(null);
      try {
        const dataUrl = await invoke<string>('read_file_base64', { path: filePath });
        if (cancelled) return;
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        await renderAsync(bytes.buffer as ArrayBuffer, containerRef.current, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        });
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setError(String(e?.message || e)); setLoading(false); }
      }
    };
    render();
    return () => { cancelled = true; };
  }, [filePath]);

  const handleExtract = useCallback(async () => {
    try {
      const mammoth = await import('mammoth');
      const dataUrl = await invoke<string>('read_file_base64', { path: filePath });
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer as ArrayBuffer });
      onExtractText(result.value);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }, [filePath, onExtractText]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-2 py-0.5 border-b bg-muted/20 flex-shrink-0">
        <span className="text-xs text-muted-foreground truncate flex-1 max-w-[120px]">{fileName}</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setScale(s => Math.min(200, s + 20))}>
          <ZoomIn className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setScale(s => Math.max(50, s - 20))}>
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="text-[10px] text-muted-foreground w-8 text-center">{scale}%</span>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-1" onClick={handleExtract}
          title={t('imitativeWriting.source.extractText', { defaultValue: '提取文字到编辑器' })}>
          <Scissors className="h-3 w-3" />
          {t('imitativeWriting.source.extractBtn', { defaultValue: '提取' })}
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onOpenFile}>
          <FolderOpen className="h-3 w-3" />
        </Button>
      </div>
      {/* 内容区 */}
      <div className="flex-1 min-h-0 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive text-sm p-4">
            <AlertCircle className="h-6 w-6" />
            <span>{error}</span>
          </div>
        )}
        <div
          ref={containerRef}
          style={{ transform: `scale(${scale / 100})`, transformOrigin: 'top center', minHeight: '100%' }}
        />
      </div>
    </div>
  );
}

// ── PDF 渲染组件 ──

function PdfViewerInline({ filePath, fileName, onExtractText, onOpenFile }: {
  filePath: string; fileName: string;
  onExtractText: (text: string) => void;
  onOpenFile: () => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const dataUrl = await invoke<string>('read_file_base64', { path: filePath });
        if (cancelled) return;
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const doc = await getDocument({ data: bytes }).promise;
        if (cancelled) { doc.destroy(); return; }
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setError(String(e?.message || e)); setLoading(false); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [filePath]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    const render = async () => {
      setRendering(true);
      try {
        if (renderTaskRef.current) { await renderTaskRef.current.cancel(); }
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        // @ts-expect-error pdfjs-dist 类型版本差异，运行时正常
        renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
        await renderTaskRef.current.promise;
        if (!cancelled) setRendering(false);
      } catch (e: any) {
        if (!cancelled && e?.name !== 'RenderingCancelledException') setError(String(e));
        if (!cancelled) setRendering(false);
      }
    };
    render();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, scale, rotation]);

  const handleExtract = useCallback(async () => {
    if (!pdfDoc) return;
    let text = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    onExtractText(text);
  }, [pdfDoc, onExtractText]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-2 py-0.5 border-b bg-muted/20 flex-shrink-0">
        <span className="text-xs text-muted-foreground truncate flex-1 max-w-[100px]">{fileName}</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{currentPage}/{totalPages}</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
          <ChevronRight className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
          <ZoomIn className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
          <ZoomOut className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setRotation(r => (r + 90) % 360)}>
          <RotateCw className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-1" onClick={handleExtract}
          title={t('imitativeWriting.source.extractText', { defaultValue: '提取文字到编辑器' })}>
          <Scissors className="h-3 w-3" />
          {t('imitativeWriting.source.extractBtn', { defaultValue: '提取' })}
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onOpenFile}>
          <FolderOpen className="h-3 w-3" />
        </Button>
      </div>
      {/* 内容区 */}
      <div className="flex-1 min-h-0 overflow-auto flex justify-center py-2 relative">
        {(loading || rendering) && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center absolute inset-0 gap-2 text-destructive text-sm p-4">
            <AlertCircle className="h-6 w-6" />
            <span>{error}</span>
          </div>
        )}
        <canvas ref={canvasRef} className="shadow-sm" />
      </div>
    </div>
  );
}
