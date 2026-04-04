/**
 * DiarySearchDialog — 跨条目搜索替换对话框
 *
 * 功能：
 * - 全文搜索（支持正则）
 * - 搜索结果列表（KWIC 预览）
 * - 全局替换
 * - 定位到条目
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, Replace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent, DiaryEntry } from './types';
import { DIALOG_STYLE } from '../_shared/styles';

interface SearchMatch {
  entry: DiaryEntry;
  before: string;
  match: string;
  after: string;
  lineNum: number;
}

interface DiarySearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diary: DiaryDocumentContent;
  onSelectEntry: (entryId: string) => void;
  onReplaceInEntry: (entryId: string, search: string, replace: string, useRegex: boolean) => void;
}

export default function DiarySearchDialog({
  open, onOpenChange, diary, onSelectEntry, onReplaceInEntry,
}: DiarySearchDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [expandedReplace, setExpandedReplace] = useState(false);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时自动聚焦
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const entries = useMemo(() => diary.entries.filter(e => !e.deletedAt), [diary.entries]);

  const matches = useMemo<SearchMatch[]>(() => {
    if (!query.trim()) return [];
    const results: SearchMatch[] = [];
    let regex: RegExp | null = null;
    try {
      regex = useRegex
        ? new RegExp(query, matchCase ? 'g' : 'gi')
        : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
    } catch {
      return [];
    }
    for (const entry of entries) {
      const lines = entry.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        const line = lines[i];
        const m = regex.exec(line);
        if (m) {
          const idx = m.index;
          const matchLen = m[0].length;
          const contextBefore = line.slice(Math.max(0, idx - 20), idx);
          const contextAfter = line.slice(idx + matchLen, idx + matchLen + 30);
          results.push({ entry, before: contextBefore, match: m[0], after: contextAfter, lineNum: i + 1 });
          // 每行最多匹配3个
          let count = 1;
          while (count < 3) {
            // lastIndex 已由前一次 exec 自动推进
            const m2 = regex.exec(line);
            if (!m2) break;
            results.push({
              entry,
              before: line.slice(Math.max(0, m2.index - 20), m2.index),
              match: m2[0],
              after: line.slice(m2.index + m2[0].length, m2.index + m2[0].length + 30),
              lineNum: i + 1,
            });
            count++;
          }
        }
      }
    }
    return results;
  }, [query, useRegex, matchCase, entries]);

  // 按条目分组
  const groupedMatches = useMemo(() => {
    const groups = new Map<string, SearchMatch[]>();
    for (const m of matches) {
      const arr = groups.get(m.entry.id) || [];
      arr.push(m);
      groups.set(m.entry.id, arr);
    }
    return groups;
  }, [matches]);

  const totalEntries = new Set(matches.map(m => m.entry.id)).size;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const match = matches[selectedMatchIdx];
      if (match) {
        onSelectEntry(match.entry.id);
        onOpenChange(false);
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMatchIdx(prev => Math.min(prev + 1, matches.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMatchIdx(prev => Math.max(prev - 1, 0));
    }
    if (e.key === 'Escape') {
      onOpenChange(false);
    }
  }, [matches, selectedMatchIdx, onSelectEntry, onOpenChange]);

  // 全局替换
  const handleReplaceAll = useCallback(() => {
    if (!query.trim() || !replaceText) return;
    const entryIds = Array.from(groupedMatches.keys());
    for (const entryId of entryIds) {
      onReplaceInEntry(entryId, query, replaceText, useRegex);
    }
    onOpenChange(false);
  }, [query, replaceText, useRegex, groupedMatches, onReplaceInEntry, onOpenChange]);

  // 切换结果时自动滚动到选中项
  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedMatchIdx]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">{t('diary.searchAndReplace', { defaultValue: '搜索替换' })}</DialogTitle>
        <DialogContent
        className="!top-[15vh] !translate-y-0 w-[60vw] h-[55vh] max-w-[800px] max-h-[55vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        {/* 搜索栏 */}
        <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm px-2 py-1 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedMatchIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder={t('diary.searchPlaceholder', { defaultValue: '搜索日记内容...' })}
          />
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={matchCase} onChange={e => { setMatchCase(e.target.checked); setSelectedMatchIdx(0); }} />
            Aa
          </label>
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={useRegex} onChange={e => { setUseRegex(e.target.checked); setSelectedMatchIdx(0); }} />
            .*
          </label>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {matches.length > 0 && `${selectedMatchIdx + 1}/${matches.length} · ${totalEntries} ${t('diary.searchEntriesUnit', { defaultValue: '条目' })}`}
          </span>
        </div>

        {/* 替换栏 */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0">
          <button
            className="h-5 text-[10px] px-1.5 rounded border text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-0.5"
            onClick={() => setExpandedReplace(!expandedReplace)}
          >
            <Replace className="h-3 w-3" />
            {t('diary.replace', { defaultValue: '替换' })}
          </button>
          {expandedReplace && (
            <>
              <input
                className="flex-1 text-sm px-2 py-0.5 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={replaceText}
                onChange={e => setReplaceText(e.target.value)}
                placeholder={t('diary.replacePlaceholder', { defaultValue: '替换为...' })}
              />
              <Button variant="outline" size="sm" className="h-6 text-[10px]"
                onClick={handleReplaceAll} disabled={!query.trim() || !replaceText}>
                {t('diary.replaceAll', { defaultValue: '全部替换' })}
              </Button>
            </>
          )}
        </div>

        {/* 结果列表 */}
        <div className="flex-1 overflow-auto">
          {matches.length === 0 && query.trim() ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t('diary.noSearchResults', { defaultValue: '未找到匹配结果' })}
            </div>
          ) : matches.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              {t('diary.searchHint', { defaultValue: '输入关键词搜索所有日记条目' })}
            </div>
          ) : (
            <div className="divide-y">
              {Array.from(groupedMatches.entries()).map(([entryId, groupMatches]) => {
                const entry = groupMatches[0].entry;
                return (
                  <div key={entryId}>
                    <div className="px-3 py-1 bg-muted/30 text-[10px] text-muted-foreground flex items-center gap-1.5 sticky top-0">
                      <span className="font-medium">{entry.date}</span>
                      {entry.title && <span>· {entry.title}</span>}
                      <span className="text-muted-foreground/60">({groupMatches.length})</span>
                    </div>
                    {groupMatches.map((m, idx) => {
                      const globalIdx = matches.indexOf(m);
                      const isSelected = globalIdx === selectedMatchIdx;
                      return (
                        <div
                          key={idx}
                          ref={isSelected ? selectedRef : undefined}
                          className={cn(
                            'px-3 py-1 text-xs cursor-pointer transition-colors',
                            isSelected ? 'bg-primary/10' : 'hover:bg-accent/50',
                          )}
                          onClick={() => {
                            onSelectEntry(entry.id);
                            setSelectedMatchIdx(globalIdx);
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground/50 w-5 text-right">{m.lineNum}</span>
                            <span className="text-muted-foreground/60">{m.before}</span>
                            <span className="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded font-medium">{m.match}</span>
                            <span className="text-muted-foreground/60 truncate">{m.after}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
