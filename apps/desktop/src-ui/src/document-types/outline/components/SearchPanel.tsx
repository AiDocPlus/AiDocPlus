/**
 * 搜索面板组件
 *
 * 支持全文搜索、匹配高亮、导航
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  CaseSensitive,
  Regex,
} from 'lucide-react';

import type { OutlineNode } from '../types';

export interface SearchMatch {
  nodeId: string;
  fieldName: 'content' | 'note';
  startIndex: number;
  endIndex: number;
  text: string;
}

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: OutlineNode[];
  onHighlightMatches: (matches: Set<string>) => void;
  onNavigateToNode: (nodeId: string) => void;
  className?: string;
}

export function SearchPanel({
  isOpen,
  onClose,
  nodes,
  onHighlightMatches,
  onNavigateToNode,
  className,
}: SearchPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 搜索匹配结果
  const matches = useMemo(() => {
    if (!query.trim()) return [];

    const results: SearchMatch[] = [];
    const flags = caseSensitive ? 'g' : 'gi';

    let regex: RegExp;
    try {
      if (useRegex) {
        regex = new RegExp(query, flags);
      } else {
        regex = new RegExp(escapeRegex(query), flags);
      }
    } catch {
      return [];
    }

    function searchNode(node: OutlineNode) {
      // 搜索内容
      const contentMatches = [...node.plainText.matchAll(regex)];
      for (const match of contentMatches) {
        if (match.index !== undefined) {
          results.push({
            nodeId: node.id,
            fieldName: 'content',
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            text: match[0],
          });
        }
      }

      // 搜索备注
      if (node.notePlainText) {
        const noteMatches = [...node.notePlainText.matchAll(regex)];
        for (const match of noteMatches) {
          if (match.index !== undefined) {
            results.push({
              nodeId: node.id,
              fieldName: 'note',
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              text: match[0],
            });
          }
        }
      }

      // 递归搜索子节点
      for (const child of node.children) {
        searchNode(child);
      }
    }

    for (const node of nodes) {
      searchNode(node);
    }

    return results;
  }, [query, caseSensitive, useRegex, nodes]);

  // 匹配的节点 ID 集合
  const matchedNodeIds = useMemo(() => {
    return new Set(matches.map((m) => m.nodeId));
  }, [matches]);

  // matches 数量变化时钳制 currentIndex
  useEffect(() => {
    setCurrentIndex((prev) =>
      matches.length === 0 ? 0 : Math.min(prev, matches.length - 1)
    );
  }, [matches.length]);

  // 更新高亮
  useEffect(() => {
    onHighlightMatches(matchedNodeIds);
    // onHighlightMatches 可能是父组件每次 render 都新建的函数引用；
    // 这里刻意只在 matchedNodeIds 变化时触发，避免形成更新闭环。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedNodeIds]);

  // 自动聚焦
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // 导航到上一个
  const goToPrev = useCallback(() => {
    if (matches.length === 0) return;

    setCurrentIndex((prev) => {
      const newIndex = prev > 0 ? prev - 1 : matches.length - 1;
      onNavigateToNode(matches[newIndex].nodeId);
      return newIndex;
    });
  }, [matches, onNavigateToNode]);

  // 导航到下一个
  const goToNext = useCallback(() => {
    if (matches.length === 0) return;

    setCurrentIndex((prev) => {
      const newIndex = prev < matches.length - 1 ? prev + 1 : 0;
      onNavigateToNode(matches[newIndex].nodeId);
      return newIndex;
    });
  }, [matches, onNavigateToNode]);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrev();
        } else {
          goToNext();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [goToPrev, goToNext, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2 bg-background border-b',
        className
      )}
    >
      {/* 搜索图标 */}
      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />

      {/* 搜索输入框 */}
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setCurrentIndex(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder={t('outline.searchPlaceholder', {
          defaultValue: '搜索...',
        })}
        className="h-8 flex-1 min-w-0 text-sm"
        autoComplete="off"
        spellCheck={false}
      />

      {/* 大小写敏感 */}
      <Button
        variant={caseSensitive ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setCaseSensitive(!caseSensitive)}
        title={t('outline.search.caseSensitive', { defaultValue: '区分大小写' })}
      >
        <CaseSensitive className="h-4 w-4" />
      </Button>

      {/* 正则表达式 */}
      <Button
        variant={useRegex ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setUseRegex(!useRegex)}
        title={t('outline.search.regex', { defaultValue: '正则表达式' })}
      >
        <Regex className="h-4 w-4" />
      </Button>

      {/* 分隔符 */}
      <div className="w-px h-5 bg-border" />

      {/* 匹配计数 */}
      <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[4rem] text-center">
        {matches.length > 0
          ? `${currentIndex + 1} / ${matches.length}`
          : t('outline.search.noResults', { defaultValue: '无结果' })}
      </span>

      {/* 上一个 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={goToPrev}
        disabled={matches.length === 0}
        title={t('outline.search.prev', { defaultValue: '上一个' })}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      {/* 下一个 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={goToNext}
        disabled={matches.length === 0}
        title={t('outline.search.next', { defaultValue: '下一个' })}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      {/* 关闭 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={onClose}
        title={t('common.close', { defaultValue: '关闭' })}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 高亮搜索结果文本
 */
export function highlightSearchMatches(
  text: string,
  query: string,
  caseSensitive = false,
  useRegex = false
): Array<{ text: string; isMatch: boolean }> {
  if (!query.trim()) {
    return [{ text, isMatch: false }];
  }

  const flags = caseSensitive ? 'g' : 'gi';
  let regex: RegExp;

  try {
    if (useRegex) {
      regex = new RegExp(query, flags);
    } else {
      regex = new RegExp(escapeRegex(query), flags);
    }
  } catch {
    return [{ text, isMatch: false }];
  }

  const result: Array<{ text: string; isMatch: boolean }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    if (match.index !== undefined) {
      // 添加非匹配文本
      if (match.index > lastIndex) {
        result.push({
          text: text.slice(lastIndex, match.index),
          isMatch: false,
        });
      }

      // 添加匹配文本
      result.push({
        text: match[0],
        isMatch: true,
      });

      lastIndex = match.index + match[0].length;
    }
  }

  // 添加剩余文本
  if (lastIndex < text.length) {
    result.push({
      text: text.slice(lastIndex),
      isMatch: false,
    });
  }

  return result;
}

export default SearchPanel;
