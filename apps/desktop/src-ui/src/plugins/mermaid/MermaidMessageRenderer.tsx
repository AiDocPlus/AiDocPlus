/**
 * Mermaid 消息渲染器
 *
 * 在 AI 助手消息中检测 Mermaid 代码块，提供：
 * - 代码 / 预览 Tab 切换
 * - 内嵌 SVG 预览（异步渲染）
 * - "应用到编辑器" 按钮
 * - 渲染错误提示 + 修复按钮
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Code, Eye, Play, AlertTriangle, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MermaidBlockProps {
  code: string;
  index: number;
  onApply: (code: string) => void;
  onFixError?: (error: string) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

type ViewTab = 'code' | 'preview';

export function MermaidCodeBlock({ code, index, onApply, onFixError, t }: MermaidBlockProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('preview');
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [renderError, setRenderError] = useState<string>('');
  const [rendering, setRendering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 异步渲染 Mermaid
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!code.trim()) return;
      setRendering(true);
      setRenderError('');
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
          securityLevel: 'loose',
        });
        const id = `msg-mermaid-${index}-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled) {
          setSvgHtml(svg);
          setRenderError('');
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setRenderError(msg);
          setSvgHtml('');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    render();
    return () => { cancelled = true; };
  }, [code, index]);

  const handleApply = useCallback(() => {
    onApply(code);
  }, [code, onApply]);

  const handleFixError = useCallback(() => {
    if (onFixError && renderError) {
      onFixError(renderError);
    }
  }, [onFixError, renderError]);

  return (
    <div className="border rounded-lg overflow-hidden my-2 bg-muted/20">
      {/* Tab 栏 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/40">
        <button
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
          }`}
          onClick={() => setActiveTab('code')}
        >
          <Code className="h-3 w-3" />
          {t('messageAction.viewCode', { defaultValue: '代码' })}
        </button>
        <button
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
          }`}
          onClick={() => setActiveTab('preview')}
        >
          <Eye className="h-3 w-3" />
          {t('messageAction.viewPreview', { defaultValue: '预览' })}
        </button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] gap-1"
          onClick={handleApply}
        >
          <Play className="h-3 w-3" />
          {t('assistant.applyToDiagram', { defaultValue: '应用到编辑器' })}
        </Button>
      </div>

      {/* 内容区 */}
      {activeTab === 'code' ? (
        <pre className="p-3 text-xs overflow-x-auto max-h-[300px] overflow-y-auto">
          <code>{code}</code>
        </pre>
      ) : (
        <div ref={containerRef} className="p-3 min-h-[60px] flex items-center justify-center">
          {rendering && (
            <span className="text-xs text-muted-foreground animate-pulse">渲染中...</span>
          )}
          {!rendering && renderError && (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('messageAction.renderError', { defaultValue: '渲染失败' })}
              </div>
              <p className="text-[10px] text-muted-foreground max-w-[300px] break-all">{renderError.slice(0, 200)}</p>
              {onFixError && (
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={handleFixError}>
                  <Wrench className="h-3 w-3" />
                  {t('messageAction.fixError', { defaultValue: '修复语法' })}
                </Button>
              )}
            </div>
          )}
          {!rendering && !renderError && svgHtml && (
            <div
              className="mermaid-inline-preview w-full [&_svg]:max-w-full [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── 从 AI 消息中提取 Mermaid 代码块 ──

const MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)```/g;

export interface ExtractedBlock {
  code: string;
  start: number;
  end: number;
}

export function extractMermaidBlocks(text: string): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(MERMAID_FENCE_RE.source, MERMAID_FENCE_RE.flags);
  while ((match = re.exec(text)) !== null) {
    blocks.push({
      code: match[1].trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return blocks;
}

// ── 纯 Mermaid 代码检测（无 fence 标记） ──

const MERMAID_KEYWORDS = [
  'flowchart', 'graph', 'sequenceDiagram', 'classDiagram',
  'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap',
  'timeline', 'journey', 'gitGraph',
];

export function looksLikeMermaidCode(text: string): boolean {
  const trimmed = text.trim();
  const firstLine = trimmed.split('\n')[0]?.trim().toLowerCase() || '';
  return MERMAID_KEYWORDS.some(kw => firstLine.startsWith(kw.toLowerCase()));
}
