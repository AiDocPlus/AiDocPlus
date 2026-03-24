/**
 * NovelSearchDialog — 全书搜索与替换弹窗
 *
 * N2.3: 跨章节全文搜索、正则支持、KWIC 预览、批量替换
 */
import { useState, useMemo, useCallback } from 'react';
import { Search, Replace, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { NovelDocumentContent } from './types';
import { updateChapterContent, getChapterById } from './types';
import { DIALOG_STYLE } from './constants';

interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  volumeTitle: string;
  /** 匹配在章节正文中的位置 */
  position: number;
  /** KWIC: 关键词前文 */
  before: string;
  /** 匹配文本 */
  match: string;
  /** KWIC: 关键词后文 */
  after: string;
}

interface NovelSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
  onJumpToChapter: (chapterId: string) => void;
}

const CONTEXT_CHARS = 40;

export default function NovelSearchDialog({
  open, onOpenChange, novel, onNovelChange, onJumpToChapter,
}: NovelSearchDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [replaceCount, setReplaceCount] = useState(0);

  // 执行搜索
  const results = useMemo((): SearchResult[] => {
    if (!query || query.length < 1) return [];
    const items: SearchResult[] = [];

    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

      for (const vol of novel.volumes) {
        for (const ch of vol.chapters) {
          const content = ch.scenes && ch.scenes.length > 0
            ? ch.scenes.map(s => s.content).join('\n\n')
            : ch.content;

          let match: RegExpExecArray | null;
          regex.lastIndex = 0;
          while ((match = regex.exec(content)) !== null) {
            const pos = match.index;
            const before = content.slice(Math.max(0, pos - CONTEXT_CHARS), pos);
            const after = content.slice(pos + match[0].length, pos + match[0].length + CONTEXT_CHARS);
            items.push({
              chapterId: ch.id,
              chapterTitle: ch.title,
              volumeTitle: vol.title,
              position: pos,
              before,
              match: match[0],
              after,
            });
            if (items.length >= 500) break;
          }
          if (items.length >= 500) break;
        }
        if (items.length >= 500) break;
      }
    } catch {
      // 正则语法错误
    }

    return items;
  }, [query, novel, useRegex, caseSensitive]);

  // 按章节分组
  const groupedResults = useMemo(() => {
    const map = new Map<string, { chapterTitle: string; volumeTitle: string; items: SearchResult[] }>();
    for (const r of results) {
      const existing = map.get(r.chapterId);
      if (existing) {
        existing.items.push(r);
      } else {
        map.set(r.chapterId, { chapterTitle: r.chapterTitle, volumeTitle: r.volumeTitle, items: [r] });
      }
    }
    return map;
  }, [results]);

  // 单个替换
  const handleReplaceSingle = useCallback((result: SearchResult) => {
    const ch = getChapterById(novel, result.chapterId);
    if (!ch) return;
    const content = ch.content;
    const newContent = content.slice(0, result.position) + replaceText + content.slice(result.position + result.match.length);
    onNovelChange(updateChapterContent(novel, result.chapterId, newContent));
    setReplaceCount(c => c + 1);
  }, [novel, replaceText, onNovelChange]);

  // 全部替换（当前章节）
  const handleReplaceInChapter = useCallback((chapterId: string) => {
    if (!query) return;
    const ch = getChapterById(novel, chapterId);
    if (!ch) return;

    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      const count = (ch.content.match(regex) || []).length;
      const newContent = ch.content.replace(regex, replaceText);
      onNovelChange(updateChapterContent(novel, chapterId, newContent));
      setReplaceCount(c => c + count);
    } catch { /* regex error */ }
  }, [query, novel, replaceText, useRegex, caseSensitive, onNovelChange]);

  // 全书替换
  const handleReplaceAll = useCallback(() => {
    if (!query) return;
    if (!window.confirm(`确定在全书中将"${query}"替换为"${replaceText}"？此操作不可撤销。`)) return;

    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      let updated = novel;
      let total = 0;
      for (const vol of novel.volumes) {
        for (const ch of vol.chapters) {
          const count = (ch.content.match(regex) || []).length;
          if (count > 0) {
            const newContent = ch.content.replace(regex, replaceText);
            updated = updateChapterContent(updated, ch.id, newContent);
            total += count;
          }
        }
      }
      onNovelChange(updated);
      setReplaceCount(c => c + total);
    } catch { /* regex error */ }
  }, [query, novel, replaceText, useRegex, caseSensitive, onNovelChange]);

  const toggleChapter = useCallback((chId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chId)) next.delete(chId); else next.add(chId);
      return next;
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[10vh] !translate-y-0 w-[700px] max-w-[90vw] h-[70vh] max-h-[70vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('novel.searchTitle', { defaultValue: '全书搜索' })}</DialogTitle>

        {/* 搜索栏 */}
        <div className="px-4 py-3 border-b space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              className="flex-1 text-sm bg-transparent border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('novel.searchPlaceholder', { defaultValue: '搜索全书内容...' })}
              autoFocus
            />
            <Button variant="ghost" size="sm" className={cn('h-7 px-2 text-xs', caseSensitive && 'bg-primary/10 text-primary')}
              onClick={() => setCaseSensitive(!caseSensitive)} title="区分大小写">
              Aa
            </Button>
            <Button variant="ghost" size="sm" className={cn('h-7 px-2 text-xs font-mono', useRegex && 'bg-primary/10 text-primary')}
              onClick={() => setUseRegex(!useRegex)} title="正则表达式">
              .*
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
              onClick={() => setShowReplace(!showReplace)} title="替换">
              <Replace className="h-3.5 w-3.5" />
            </Button>
          </div>

          {showReplace && (
            <div className="flex items-center gap-2 pl-6">
              <Replace className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                className="flex-1 text-sm bg-transparent border rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                value={replaceText}
                onChange={e => setReplaceText(e.target.value)}
                placeholder={t('novel.replacePlaceholder', { defaultValue: '替换为...' })}
              />
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleReplaceAll}
                disabled={!query || results.length === 0}>
                {t('novel.replaceAll', { defaultValue: '全部替换' })}
              </Button>
            </div>
          )}

          {/* 统计 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
            {query && (
              <>
                <span>{results.length >= 500 ? '500+' : results.length} 个匹配</span>
                <span>·</span>
                <span>{groupedResults.size} 个章节</span>
                {replaceCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-green-600">已替换 {replaceCount} 处</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* 结果列表 */}
        <div className="flex-1 overflow-auto px-2 py-1">
          {results.length === 0 && query && (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              {t('novel.noSearchResults', { defaultValue: '未找到匹配结果' })}
            </div>
          )}

          {Array.from(groupedResults.entries()).map(([chId, group]) => {
            const isExpanded = expandedChapters.has(chId) || groupedResults.size <= 5;
            return (
              <div key={chId} className="mb-1">
                {/* 章节标题行 */}
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm"
                  onClick={() => toggleChapter(chId)}
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <span className="text-muted-foreground text-xs">{group.volumeTitle}</span>
                  <span className="font-medium">{group.chapterTitle}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{group.items.length} 处</span>
                  {showReplace && (
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={(e) => {
                      e.stopPropagation();
                      handleReplaceInChapter(chId);
                    }}>替换本章</Button>
                  )}
                </div>

                {/* 匹配条目 */}
                {isExpanded && group.items.map((r, idx) => (
                  <div
                    key={`${chId}-${idx}`}
                    className="flex items-center gap-1 pl-7 pr-2 py-0.5 rounded hover:bg-accent/50 cursor-pointer text-xs"
                    onClick={() => {
                      onJumpToChapter(r.chapterId);
                      onOpenChange(false);
                    }}
                  >
                    <span className="text-muted-foreground truncate max-w-[120px]">...{r.before}</span>
                    <span className="font-bold text-primary bg-primary/10 px-0.5 rounded">{r.match}</span>
                    <span className="text-muted-foreground truncate max-w-[120px]">{r.after}...</span>
                    {showReplace && (
                      <Button variant="ghost" size="sm" className="h-4 text-[10px] px-1 ml-auto flex-shrink-0" onClick={(e) => {
                        e.stopPropagation();
                        handleReplaceSingle(r);
                      }}>替换</Button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {results.length >= 500 && (
            <div className="flex items-center gap-1 px-2 py-2 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('novel.searchTruncated', { defaultValue: '结果已截断（最多显示500条），请缩小搜索范围' })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
