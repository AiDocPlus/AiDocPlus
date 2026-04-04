/**
 * DiaryFilterPanel — 高级筛选面板
 *
 * 可折叠，替代原有简单搜索框
 * 筛选维度：关键词、日期范围、心情、天气、标签、收藏
 * 筛选条件显示为标签条（可单独移除）
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Search, X, Filter, Star, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent, DiaryFilterState } from './types';
import {
  MOOD_EMOJI, MOOD_LABEL, MOOD_VALUES,
  WEATHER_EMOJI, WEATHER_LABEL, WEATHER_TYPES,
  collectAllTags, isFilterActive, EMPTY_FILTER,
  type DiaryMood, type DiaryWeatherType,
} from './types';

interface DiaryFilterPanelProps {
  diary: DiaryDocumentContent;
  filter: DiaryFilterState;
  onFilterChange: (filter: DiaryFilterState) => void;
  resultCount: number;
}

export default function DiaryFilterPanel({
  diary, filter, onFilterChange, resultCount,
}: DiaryFilterPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const active = isFilterActive(filter);
  const allTags = useMemo(() => collectAllTags(diary), [diary]);
  const [localKeyword, setLocalKeyword] = useState(filter.keyword);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  // 外部筛选被清除时同步输入框
  useEffect(() => { if (!filter.keyword && localKeyword) setLocalKeyword(''); }, [filter.keyword, localKeyword]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  const handleKeywordChange = useCallback((value: string) => {
    setLocalKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ ...filterRef.current, keyword: value });
    }, 300);
  }, [onFilterChange]);

  const patch = (p: Partial<DiaryFilterState>) => onFilterChange({ ...filter, ...p });

  const toggleMood = (mood: DiaryMood) => {
    const moods = filter.moods.includes(mood)
      ? filter.moods.filter(m => m !== mood)
      : [...filter.moods, mood];
    patch({ moods });
  };

  const toggleWeather = (wt: DiaryWeatherType) => {
    const weathers = filter.weathers.includes(wt)
      ? filter.weathers.filter(w => w !== wt)
      : [...filter.weathers, wt];
    patch({ weathers });
  };

  const toggleTag = (tag: string) => {
    const tags = filter.tags.includes(tag)
      ? filter.tags.filter(x => x !== tag)
      : [...filter.tags, tag];
    patch({ tags });
  };

  return (
    <div className="flex flex-col border-b flex-shrink-0">
      {/* 搜索行 */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          className={cn('flex items-center justify-center h-5 w-5 rounded transition-colors',
            active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setExpanded(!expanded)}
          title={t('diary.advancedFilter', { defaultValue: '高级筛选' })}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
        </button>
        <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input
          className="flex-1 text-sm bg-transparent border-0 focus:outline-none px-1"
          value={localKeyword}
          onChange={e => handleKeywordChange(e.target.value)}
          placeholder={t('diary.searchEntries', { defaultValue: '搜索日记...' })}
        />
        {active && (
          <span className="text-[10px] text-primary tabular-nums flex-shrink-0">{resultCount}</span>
        )}
        {active && (
          <button className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => onFilterChange({ ...EMPTY_FILTER })}
            title={t('diary.clearFilter', { defaultValue: '清除筛选' })}>
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* 活动筛选标签条 */}
      {active && !expanded && (
        <div className="flex flex-wrap gap-0.5 px-2 pb-1">
          {filter.starredOnly && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
              <Star className="h-2.5 w-2.5 fill-current" />
              {t('diary.starred', { defaultValue: '收藏' })}
              <button onClick={() => patch({ starredOnly: false })} className="hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {filter.moods.map(mood => (
            <span key={mood} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {MOOD_EMOJI[mood]}
              <button onClick={() => toggleMood(mood)} className="hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          {filter.weathers.map(wt => (
            <span key={wt} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
              {WEATHER_EMOJI[wt]}
              <button onClick={() => toggleWeather(wt)} className="hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          {filter.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
              #{tag}
              <button onClick={() => toggleTag(tag)} className="hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          {filter.dateFrom && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">
              {filter.dateFrom}~{filter.dateTo || '...'}
              <button onClick={() => patch({ dateFrom: '', dateTo: '' })} className="hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {filter.journalId && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {diary.journals.find(j => j.id === filter.journalId)?.icon} {diary.journals.find(j => j.id === filter.journalId)?.name}
              <button onClick={() => patch({ journalId: null })} className="hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
        </div>
      )}

      {/* 展开的高级筛选面板 */}
      {expanded && (
        <div className="px-2 pb-2 space-y-2 border-t pt-1.5">
          {/* 日期范围 */}
          <div className="space-y-0.5">
            <label className="text-[10px] text-muted-foreground font-medium">{t('diary.filterDateRange', { defaultValue: '日期范围' })}</label>
            <div className="flex items-center gap-1">
              <input type="date" className="flex-1 text-xs px-1.5 py-0.5 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={filter.dateFrom}
                onChange={e => patch({ dateFrom: e.target.value })} />
              <span className="text-xs text-muted-foreground">~</span>
              <input type="date" className="flex-1 text-xs px-1.5 py-0.5 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={filter.dateTo}
                onChange={e => patch({ dateTo: e.target.value })} />
            </div>
          </div>

          {/* 心情 */}
          <div className="space-y-0.5">
            <label className="text-[10px] text-muted-foreground font-medium">{t('diary.filterMood', { defaultValue: '心情' })}</label>
            <div className="flex gap-0.5">
              {MOOD_VALUES.map(mood => (
                <button key={mood}
                  className={cn('h-6 w-6 rounded text-sm flex items-center justify-center transition-all',
                    filter.moods.includes(mood) ? 'bg-primary/15 ring-1 ring-primary scale-110' : 'hover:bg-accent opacity-60 hover:opacity-100'
                  )}
                  onClick={() => toggleMood(mood)}
                  title={MOOD_LABEL[mood]}
                >
                  {MOOD_EMOJI[mood]}
                </button>
              ))}
            </div>
          </div>

          {/* 天气 */}
          <div className="space-y-0.5">
            <label className="text-[10px] text-muted-foreground font-medium">{t('diary.filterWeather', { defaultValue: '天气' })}</label>
            <div className="flex flex-wrap gap-0.5">
              {WEATHER_TYPES.map(wt => (
                <button key={wt}
                  className={cn('h-6 px-1.5 rounded text-xs flex items-center gap-0.5 transition-all',
                    filter.weathers.includes(wt) ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-accent opacity-60 hover:opacity-100'
                  )}
                  onClick={() => toggleWeather(wt)}
                  title={WEATHER_LABEL[wt]}
                >
                  {WEATHER_EMOJI[wt]}
                </button>
              ))}
            </div>
          </div>

          {/* 标签 */}
          {allTags.length > 0 && (
            <div className="space-y-0.5">
              <label className="text-[10px] text-muted-foreground font-medium">{t('diary.filterTags', { defaultValue: '标签' })}</label>
              <div className="flex flex-wrap gap-0.5">
                {allTags.map(tag => (
                  <button key={tag}
                    className={cn('text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                      filter.tags.includes(tag)
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                    onClick={() => toggleTag(tag)}
                  >
                    {filter.tags.includes(tag) ? '✓ ' : ''}{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 日记本 */}
          {diary.journals.length > 1 && (
            <div className="space-y-0.5">
              <label className="text-[10px] text-muted-foreground font-medium">{t('diary.filterJournal', { defaultValue: '日记本' })}</label>
              <div className="flex flex-wrap gap-0.5">
                <button
                  className={cn('text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                    !filter.journalId ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => patch({ journalId: null })}
                >
                  {t('diary.allJournals', { defaultValue: '全部' })}
                </button>
                {diary.journals.map(j => (
                  <button key={j.id}
                    className={cn('text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                      filter.journalId === j.id ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => patch({ journalId: filter.journalId === j.id ? null : j.id })}
                  >
                    {j.icon} {j.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 收藏 */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={filter.starredOnly}
              onChange={e => patch({ starredOnly: e.target.checked })}
              className="rounded border-border" />
            <Star className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] text-muted-foreground">{t('diary.filterStarredOnly', { defaultValue: '仅显示收藏' })}</span>
          </label>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-[10px] text-muted-foreground">
              {t('diary.filterResultCount', { defaultValue: '{{count}} 条结果', count: resultCount })}
            </span>
            <button className="text-[10px] text-primary hover:underline"
              onClick={() => onFilterChange({ ...EMPTY_FILTER })}>
              {t('diary.clearAllFilters', { defaultValue: '清除所有' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
