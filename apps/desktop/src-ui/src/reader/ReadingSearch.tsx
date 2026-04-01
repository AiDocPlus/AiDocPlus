import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface ReadingSearchProps {
  onSearch?: (query: string, options: SearchOptions) => void;
  onHighlightNext?: () => void;
  onHighlightPrev?: () => void;
  onClose?: () => void;
  matchCount?: number;
  currentMatch?: number;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export function ReadingSearch({
  onSearch,
  onHighlightNext,
  onHighlightPrev,
  onClose,
  matchCount,
  currentMatch,
}: ReadingSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      onSearch?.(value, { caseSensitive, wholeWord });
    },
    [onSearch, caseSensitive, wholeWord],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.shiftKey ? onHighlightPrev?.() : onHighlightNext?.();
      } else if (e.key === 'Escape') {
        onClose?.();
      }
    },
    [onHighlightNext, onHighlightPrev, onClose],
  );

  const toggleCaseSensitive = useCallback(() => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    onSearch?.(query, { caseSensitive: next, wholeWord });
  }, [query, onSearch, caseSensitive, wholeWord]);

  const toggleWholeWord = useCallback(() => {
    const next = !wholeWord;
    setWholeWord(next);
    onSearch?.(query, { caseSensitive, wholeWord: next });
  }, [query, onSearch, caseSensitive, wholeWord]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border-b bg-card shrink-0">
      <div className="flex items-center gap-1 flex-1 min-w-0 bg-muted/50 rounded-md border px-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('reader.searchPlaceholder', { defaultValue: '搜索...' })}
          className="h-7 bg-transparent text-sm outline-none w-full min-w-0"
        />
        {query && (
          <button onClick={() => { setQuery(''); onSearch?.('', { caseSensitive, wholeWord }); }} className="shrink-0 hover:text-foreground text-muted-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <button
        onClick={toggleCaseSensitive}
        className={`shrink-0 h-6 w-6 flex items-center justify-center rounded text-xs hover:bg-muted transition-colors ${
          caseSensitive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
        }`}
        title={t('reader.caseSensitive', { defaultValue: '区分大小写' })}
      >
        Aa
      </button>
      <button
        onClick={toggleWholeWord}
        className={`shrink-0 h-6 w-6 flex items-center justify-center rounded text-xs hover:bg-muted transition-colors ${
          wholeWord ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
        }`}
        title={t('reader.wholeWord', { defaultValue: '全词匹配' })}
      >
        Ab
      </button>

      <div className="flex items-center gap-0.5">
        <button
          onClick={onHighlightPrev}
          disabled={!query}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onHighlightNext}
          disabled={!query}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {(matchCount !== undefined && query) && (
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {currentMatch !== undefined ? `${currentMatch}/${matchCount}` : matchCount === 0 ? '0' : matchCount}
        </span>
      )}

      <button
        onClick={onClose}
        className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * DOM 内文本搜索工具（适用于 MD/HTML 渲染后的容器）
 */
export function domTextSearch(
  container: HTMLElement | null,
  query: string,
  options: SearchOptions,
  direction: 'next' | 'prev' = 'next',
): { count: number; currentIndex: number; cleared: boolean } {
  if (!container || !query) {
    window.getSelection()?.removeAllRanges();
    return { count: 0, currentIndex: 0, cleared: true };
  }

  const selection = window.getSelection();
  selection?.removeAllRanges();

  let searchQuery = query;
  if (!options.caseSensitive) searchQuery = searchQuery.toLowerCase();

  const treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const matches: { node: Text; index: number }[] = [];
  let node: Node | null;

  while ((node = treeWalker.nextNode())) {
    const text = options.caseSensitive ? node.textContent || '' : (node.textContent || '').toLowerCase();
    let pos = 0;
    while (true) {
      const found = text.indexOf(searchQuery, pos);
      if (found === -1) break;
      if (options.wholeWord) {
        const before = found > 0 ? text[found - 1] : ' ';
        const after = found + searchQuery.length < text.length ? text[found + searchQuery.length] : ' ';
        if (/\w/.test(before) || /\w/.test(after)) { pos = found + 1; continue; }
      }
      matches.push({ node: node as Text, index: found });
      pos = found + 1;
    }
  }

  if (matches.length === 0) return { count: 0, currentIndex: 0, cleared: true };

  let targetIndex = direction === 'next' ? 0 : matches.length - 1;

  const sel = selection;
  if (sel && sel.rangeCount > 0) {
    const existingRange = sel.getRangeAt(0);
    const startNode = existingRange.startContainer;
    const startOffset = existingRange.startOffset;
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].node === startNode && matches[i].index === startOffset) {
        targetIndex = direction === 'next' ? (i + 1) % matches.length : (i - 1 + matches.length) % matches.length;
        break;
      }
    }
  }

  const target = matches[targetIndex];
  const range = document.createRange();
  range.setStart(target.node, target.index);
  range.setEnd(target.node, target.index + query.length);

  const sel2 = selection;
  sel2?.removeAllRanges();
  sel2?.addRange(range);

  try {
    const el = target.node.parentElement;
    if (el?.scrollIntoView({ block: 'center', behavior: 'smooth' })) {
      void 0;
    }
  } catch {}

  return { count: matches.length, currentIndex: targetIndex + 1, cleared: false };
}
