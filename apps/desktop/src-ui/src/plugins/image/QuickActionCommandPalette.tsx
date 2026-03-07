/**
 * 图片插件快捷操作命令面板
 *
 * 提供模糊搜索、分类筛选、收藏/最近使用、执行模式标签。
 * direct 类操作点击后立即执行，不经过 AI。
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, Star, Clock, Zap, Bot, GitMerge, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { QuickActionStore, QuickActionItem, QuickActionCategory, ExecutionMode } from './quickActionDefs';
import './image-plugin.css';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: QuickActionStore;
  onAction: (item: QuickActionItem) => void;
  onToggleFavorite: (itemId: string) => void;
}

type FilterTab = 'all' | 'favorites' | 'recent' | string;

const MODE_CONFIG: Record<ExecutionMode, { label: string; icon: typeof Zap; className: string }> = {
  direct:  { label: '直接执行', icon: Zap,      className: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950' },
  ai:      { label: 'AI',      icon: Bot,      className: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950' },
  hybrid:  { label: '混合',    icon: GitMerge, className: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950' },
};

function matchItem(item: QuickActionItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (item.label.toLowerCase().includes(q)) return true;
  if (item.prompt?.toLowerCase().includes(q)) return true;
  if (item.keywords?.some(kw => kw.toLowerCase().includes(q))) return true;
  return false;
}

export function QuickActionCommandPalette({
  open, onOpenChange, store, onAction, onToggleFavorite,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveTab('all');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const sortedCategories = useMemo(() =>
    [...store.categories].sort((a, b) => a.order - b.order),
  [store.categories]);

  const favorites = useMemo(() => new Set(store.favorites || []), [store.favorites]);
  const recentUsed = useMemo(() => store.recentUsed || [], [store.recentUsed]);

  const filteredItems = useMemo(() => {
    let items = store.items.filter(i => !i.hidden);
    if (activeTab === 'favorites') {
      items = items.filter(i => favorites.has(i.id));
    } else if (activeTab === 'recent') {
      const recentSet = new Set(recentUsed);
      items = items.filter(i => recentSet.has(i.id));
      items.sort((a, b) => recentUsed.indexOf(a.id) - recentUsed.indexOf(b.id));
    } else if (activeTab !== 'all') {
      items = items.filter(i => i.categoryId === activeTab);
    }
    if (query) {
      items = items.filter(i => matchItem(i, query));
    }
    if (activeTab !== 'recent') {
      items.sort((a, b) => {
        const aFav = favorites.has(a.id) ? 0 : 1;
        const bFav = favorites.has(b.id) ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        return a.order - b.order;
      });
    }
    return items;
  }, [store.items, activeTab, query, favorites, recentUsed]);

  const groupedItems = useMemo(() => {
    if (activeTab !== 'all' || query) {
      return [{ category: null as QuickActionCategory | null, items: filteredItems }];
    }
    const groups: { category: QuickActionCategory | null; items: typeof filteredItems }[] = [];
    const favItems = filteredItems.filter(i => favorites.has(i.id));
    if (favItems.length > 0) {
      groups.push({ category: { id: '_fav', label: '收藏', icon: 'Star', order: -1 }, items: favItems });
    }
    for (const cat of sortedCategories) {
      const catItems = filteredItems.filter(i => i.categoryId === cat.id && !favorites.has(i.id));
      if (catItems.length > 0) {
        groups.push({ category: cat, items: catItems });
      }
    }
    return groups;
  }, [filteredItems, activeTab, query, sortedCategories, favorites]);

  const flatItems = useMemo(() => groupedItems.flatMap(g => g.items), [groupedItems]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
      e.preventDefault();
      onAction(flatItems[selectedIndex]);
      onOpenChange(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  }, [flatItems, selectedIndex, onAction, onOpenChange]);

  useEffect(() => {
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleItemClick = useCallback((item: QuickActionItem) => {
    onAction(item);
    onOpenChange(false);
  }, [onAction, onOpenChange]);

  const handleFavClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    onToggleFavorite(itemId);
  }, [onToggleFavorite]);

  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[12vh] !translate-y-0 w-[520px] h-[60vh] max-w-[520px] max-h-[60vh] flex flex-col p-0 gap-0 image-plugin-font"
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={e => { e.preventDefault(); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        <DialogTitle className="sr-only">快捷操作</DialogTitle>

        {/* 搜索栏 */}
        <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="搜索快捷操作..."
            className="border-0 shadow-none focus-visible:ring-0 h-8 text-sm"
          />
          {query && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => setQuery('')} title="清除搜索">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Tab 栏 */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b overflow-x-auto shrink-0">
          <TabButton active={activeTab === 'all'} onClick={() => { setActiveTab('all'); setSelectedIndex(0); }}>
            全部
          </TabButton>
          <TabButton active={activeTab === 'favorites'} onClick={() => { setActiveTab('favorites'); setSelectedIndex(0); }}>
            <Star className="h-3 w-3" />收藏
          </TabButton>
          <TabButton active={activeTab === 'recent'} onClick={() => { setActiveTab('recent'); setSelectedIndex(0); }}>
            <Clock className="h-3 w-3" />最近
          </TabButton>
          <div className="w-px h-4 bg-border mx-1" />
          {sortedCategories.map(cat => (
            <TabButton key={cat.id} active={activeTab === cat.id} onClick={() => { setActiveTab(cat.id); setSelectedIndex(0); }}>
              {cat.label}
            </TabButton>
          ))}
        </div>

        {/* 操作列表 */}
        <ScrollArea className="flex-1 min-h-0">
          <div ref={listRef} className="py-1">
            {flatItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {query ? `未找到匹配「${query}」的操作` : '暂无操作'}
              </div>
            )}

            {groupedItems.map((group, gi) => (
              <div key={gi}>
                {group.category && (activeTab === 'all' && !query) && (
                  <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    {group.category.id === '_fav' ? '⭐ 收藏' : group.category.label}
                  </div>
                )}
                {group.items.map(item => {
                  const idx = flatIndex++;
                  const isFav = favorites.has(item.id);
                  const mode = item.executionMode || 'ai';
                  const modeConf = MODE_CONFIG[mode];
                  const ModeIcon = modeConf.icon;
                  return (
                    <div
                      key={item.id}
                      data-index={idx}
                      className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md cursor-pointer text-sm transition-colors ${
                        idx === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                      }`}
                      onClick={() => handleItemClick(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <button
                        className={`shrink-0 p-0.5 rounded hover:bg-accent ${isFav ? 'text-yellow-500' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                        onClick={e => handleFavClick(e, item.id)}
                        title={isFav ? '取消收藏' : '添加收藏'}
                      >
                        <Star className="h-3 w-3" fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.dangerous && (
                        <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
                      )}
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${modeConf.className}`}>
                        <ModeIcon className="h-2.5 w-2.5" />
                        {modeConf.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* 底部提示 */}
        <div className="px-3 py-1.5 border-t text-[10px] text-muted-foreground flex items-center gap-3 shrink-0">
          <span>↑↓ 导航</span>
          <span>↵ 执行</span>
          <span>Esc 关闭</span>
          <span className="ml-auto">{filteredItems.length} 个操作</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
