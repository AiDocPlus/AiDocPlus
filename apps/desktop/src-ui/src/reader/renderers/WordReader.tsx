import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface WordReaderProps {
  data: Uint8Array;
}

export function WordReader({ data }: WordReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // 清空容器后重新渲染
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

  return (
    <div className="h-full overflow-auto relative">
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
      <div ref={containerRef} className="docx-viewer-wrapper docx-viewer-container" />
    </div>
  );
}
