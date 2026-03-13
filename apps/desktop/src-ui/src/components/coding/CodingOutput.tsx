import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import {
  Eye, Copy, Check, Search, Trash2, Maximize2, Minimize2,
  ArrowUp, ArrowDown, X,
} from 'lucide-react';

// ── ANSI 颜色解析 ──
const ANSI_COLORS: Record<number, string> = {
  30: 'text-gray-900 dark:text-gray-300', 31: 'text-red-600 dark:text-red-400',
  32: 'text-green-600 dark:text-green-400', 33: 'text-yellow-600 dark:text-yellow-400',
  34: 'text-blue-600 dark:text-blue-400', 35: 'text-purple-600 dark:text-purple-400',
  36: 'text-cyan-600 dark:text-cyan-400', 37: 'text-gray-200 dark:text-gray-100',
  90: 'text-gray-500', 91: 'text-red-400', 92: 'text-green-400',
  93: 'text-yellow-300', 94: 'text-blue-400', 95: 'text-purple-400',
  96: 'text-cyan-400', 97: 'text-white',
};

export function parseAnsiLine(text: string): Array<{ text: string; className: string }> {
  const parts: Array<{ text: string; className: string }> = [];
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentClass = '';
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), className: currentClass });
    }
    const codes = match[1].split(';').map(Number);
    for (const code of codes) {
      if (code === 0) currentClass = '';
      else if (code === 1) currentClass += ' font-bold';
      else if (code === 2) currentClass += ' opacity-60';
      else if (code === 4) currentClass += ' underline';
      else if (ANSI_COLORS[code]) currentClass = ANSI_COLORS[code] + (currentClass.includes('font-bold') ? ' font-bold' : '');
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), className: currentClass });
  if (parts.length === 0) parts.push({ text, className: '' });
  return parts;
}

// ── 类型 ──
export interface OutputLine {
  text: string;
  type: 'stdout' | 'stderr' | 'info';
}

interface CodingOutputProps {
  outputLines: OutputLine[];
  activeLang: string;
  fontSize: number;
  maximized: 'none' | 'editor' | 'output';
  outputHeight: number;
  outputStatusEl: React.ReactNode;
  outputPreview: boolean;
  onOutputPreviewChange: (v: boolean) => void;
  onClear: () => void;
  onMaximize: () => void;
}

export function CodingOutput({
  outputLines,
  activeLang,
  fontSize,
  maximized,
  outputHeight,
  outputStatusEl,
  outputPreview,
  onOutputPreviewChange,
  onClear,
  onMaximize,
}: CodingOutputProps) {
  const { t } = useTranslation();
  const outputRef = useRef<HTMLPreElement | null>(null);
  const autoScrollRef = useRef(true);
  const outputSearchRef = useRef<HTMLInputElement>(null);
  const [outputCopied, setOutputCopied] = useState(false);
  const [outputSearchOpen, setOutputSearchOpen] = useState(false);
  const [outputSearchQuery, setOutputSearchQuery] = useState('');
  const [outputSearchIdx, setOutputSearchIdx] = useState(0);

  // ── 智能自动滚动 ──
  useEffect(() => {
    const el = outputRef.current;
    if (el && autoScrollRef.current) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
  }, [outputLines.length]);

  const handleOutputScroll = useCallback(() => {
    const el = outputRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    autoScrollRef.current = atBottom;
  }, []);

  // ── 搜索匹配 ──
  const outputSearchMatches = useMemo(() => {
    if (!outputSearchQuery) return [];
    const q = outputSearchQuery.toLowerCase();
    const matches: number[] = [];
    outputLines.forEach((line, i) => {
      if (line.text.toLowerCase().includes(q)) matches.push(i);
    });
    return matches;
  }, [outputSearchQuery, outputLines]);

  const handleOutputSearchNav = useCallback((dir: 1 | -1) => {
    if (outputSearchMatches.length === 0) return;
    const next = (outputSearchIdx + dir + outputSearchMatches.length) % outputSearchMatches.length;
    setOutputSearchIdx(next);
    const el = outputRef.current;
    if (el) {
      const lineEls = el.querySelectorAll('[data-output-line]');
      const targetLine = outputSearchMatches[next];
      if (lineEls[targetLine]) {
        lineEls[targetLine].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [outputSearchMatches, outputSearchIdx]);

  return (
    <div className={`flex-shrink-0 flex flex-col ${maximized === 'editor' ? 'hidden' : maximized === 'output' ? 'flex-1' : ''}`}
      style={maximized === 'output' ? { minHeight: 0 } : { height: outputHeight, minHeight: 80 }}>
      {/* 输出标题栏 */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 border-b bg-muted/20">
        <span className="text-xs font-medium">{t('coding.output', { defaultValue: '输出' })}</span>
        {outputStatusEl && <span className="text-[11px]">{outputStatusEl}</span>}
        <div className="flex-1" />
        {outputLines.length > 0 && (
          <>
            {/* 预览/原始切换 */}
            <Button variant={outputPreview ? 'default' : 'ghost'} size="sm" className="h-5 px-1.5 text-[10px] gap-0.5"
              onClick={() => onOutputPreviewChange(!outputPreview)}
              title={outputPreview ? '原始输出' : '预览'}>
              <Eye className="h-2.5 w-2.5" />
              {outputPreview ? '原始' : '预览'}
            </Button>
            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5"
              onClick={() => {
                const text = outputLines.map(l => l.text).join('\n');
                navigator.clipboard.writeText(text).then(() => {
                  setOutputCopied(true);
                  setTimeout(() => setOutputCopied(false), 2000);
                });
              }}
              title={t('coding.copyOutput', { defaultValue: '复制输出' })}>
              {outputCopied ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
              {outputCopied ? t('coding.copied', { defaultValue: '已复制' }) : t('coding.copy', { defaultValue: '复制' })}
            </Button>
            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5"
              onClick={() => { setOutputSearchOpen(v => !v); setTimeout(() => outputSearchRef.current?.focus(), 50); }}
              title={t('coding.searchOutput', { defaultValue: '搜索输出' })}>
              <Search className="h-2.5 w-2.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5"
              onClick={() => { onClear(); onOutputPreviewChange(false); setOutputSearchOpen(false); setOutputSearchQuery(''); }}>
              <Trash2 className="h-2.5 w-2.5" />{t('coding.clearOutput', { defaultValue: '清除' })}
            </Button>
          </>
        )}
        <button
          onClick={onMaximize}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title={maximized === 'output' ? '还原' : '最大化输出区'}>
          {maximized === 'output' ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </button>
      </div>

      {/* 输出搜索条 */}
      {outputSearchOpen && (
        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 border-b bg-muted/30">
          <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <input
            ref={outputSearchRef}
            className="flex-1 bg-transparent border-none outline-none text-xs h-5 placeholder:text-muted-foreground/50"
            placeholder={t('coding.searchOutput', { defaultValue: '搜索输出...' })}
            title={t('coding.searchOutput', { defaultValue: '搜索输出' })}
            value={outputSearchQuery}
            onChange={e => { setOutputSearchQuery(e.target.value); setOutputSearchIdx(0); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { handleOutputSearchNav(e.shiftKey ? -1 : 1); }
              if (e.key === 'Escape') { setOutputSearchOpen(false); setOutputSearchQuery(''); }
            }}
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {outputSearchQuery ? `${outputSearchMatches.length > 0 ? outputSearchIdx + 1 : 0}/${outputSearchMatches.length}` : ''}
          </span>
          <button onClick={() => handleOutputSearchNav(-1)} className="p-0.5 hover:bg-muted rounded" title={t('coding.prevMatch', { defaultValue: '上一个' })}>
            <ArrowUp className="h-3 w-3" />
          </button>
          <button onClick={() => handleOutputSearchNav(1)} className="p-0.5 hover:bg-muted rounded" title={t('coding.nextMatch', { defaultValue: '下一个' })}>
            <ArrowDown className="h-3 w-3" />
          </button>
          <button onClick={() => { setOutputSearchOpen(false); setOutputSearchQuery(''); }} className="p-0.5 hover:bg-muted rounded" title={t('common.close', { defaultValue: '关闭' })}>
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 输出内容 — 支持原始/预览两种模式 */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {outputLines.length > 0 ? (
          outputPreview ? (
            // 预览模式
            <div className="h-full overflow-auto px-3 py-2">
              {(() => {
                const outputText = outputLines.filter(l => l.type === 'stdout').map(l => l.text).join('\n');
                const isHtml = activeLang === 'html' || /^\s*<!DOCTYPE|^\s*<html/i.test(outputText);
                if (isHtml) {
                  return <iframe srcDoc={outputText} sandbox="allow-scripts allow-same-origin" className="w-full h-full border rounded bg-white" title="HTML 预览" />;
                }
                return <MarkdownPreview content={outputText} theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} fontSize={fontSize} />;
              })()}
            </div>
          ) : (
            // 原始模式
            <pre
              ref={outputRef}
              onScroll={handleOutputScroll}
              className="h-full overflow-auto px-3 py-2 text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-words select-text"
              style={{ fontSize: `${Math.max(fontSize - 1, 11)}px` }}
            >
              {outputLines.map((line, i) => {
                const baseClass = line.type === 'stderr' ? 'text-red-500 dark:text-red-400' :
                  line.type === 'info' ? 'text-blue-500 dark:text-blue-400 opacity-70' : 'text-foreground';
                const isMatch = outputSearchQuery && outputSearchMatches.includes(i);
                const isCurrent = isMatch && outputSearchMatches[outputSearchIdx] === i;
                const highlightClass = isCurrent ? 'bg-yellow-300 dark:bg-yellow-700' : isMatch ? 'bg-yellow-100 dark:bg-yellow-900/40' : '';
                const hasAnsi = line.type === 'stdout' && /\x1b\[/.test(line.text);
                if (hasAnsi) {
                  const parts = parseAnsiLine(line.text);
                  return <span key={i} data-output-line={i} className={`block ${highlightClass}`}>{parts.map((p, j) =>
                    p.className ? <span key={j} className={p.className}>{p.text}</span> : p.text
                  )}</span>;
                }
                // 图片路径检测：绝对路径 + 图片扩展名
                const trimmed = line.text.trim();
                const imgMatch = /^(\/[^\s]+\.(png|jpg|jpeg|gif|bmp|svg|webp))$/i.test(trimmed)
                  || /^([A-Z]:\\[^\s]+\.(png|jpg|jpeg|gif|bmp|svg|webp))$/i.test(trimmed);
                if (imgMatch && line.type === 'stdout') {
                  const imgPath = trimmed;
                  return (
                    <span key={i} data-output-line={i} className={`block ${highlightClass}`}>
                      <span className="text-xs text-muted-foreground">{imgPath}</span>
                      <img
                        src={`https://asset.localhost/${encodeURIComponent(imgPath)}`}
                        alt={imgPath.replace(/^.*[\\/]/, '')}
                        className="max-w-full max-h-[300px] rounded border mt-1 mb-1"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </span>
                  );
                }
                return <span key={i} data-output-line={i} className={`block ${baseClass} ${highlightClass}`}>{line.text}</span>;
              })}
            </pre>
          )
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
            {(activeLang === 'python' || activeLang === 'javascript' || activeLang === 'typescript')
              ? `${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Shift+Enter ${t('coding.run', { defaultValue: '运行' })}`
              : (activeLang === 'html' || activeLang === 'markdown')
                ? t('coding.clickPreview', { defaultValue: '点击"预览"按钮查看效果' })
                : t('coding.editMode', { defaultValue: '编辑模式' })
            }
          </div>
        )}
      </div>
    </div>
  );
}
