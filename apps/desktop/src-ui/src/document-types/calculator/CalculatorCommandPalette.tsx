/**
 * CalculatorCommandPalette — 计算文档命令面板
 * 支持 ⌘K 快捷键搜索执行快捷操作
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n';
import {
  Search, Star, Clock, Command, CornerDownLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  loadQuickActions,
  saveQuickActions,
  toggleFavorite,
  DEFAULT_CATEGORIES,
  type CalculatorQuickActionStore,
  type CalculatorQuickActionItem,
} from './calculatorQuickActions';
import { DynamicIcon } from '../_shared/DynamicIcon';

// 简单的内存存储
const memoryStorage: Record<string, unknown> = {};

const simpleStorage = {
  get: <T,>(key: string): T | null => {
    const value = memoryStorage[key];
    return value !== undefined ? (value as T) : null;
  },
  set: (key: string, value: unknown) => {
    memoryStorage[key] = value;
  },
};

/** 与 DocTypeHostAPI.storage 一致 */
export type CalculatorPaletteStorage = {
  get: <T>(key: string) => T | null;
  set: (key: string, value: unknown) => void;
};

interface CalculatorCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectAction: (item: CalculatorQuickActionItem) => void;
  /** 传入后与侧栏共用快捷操作持久化；不传则使用内存存储（仅孤立测试） */
  storage?: CalculatorPaletteStorage;
}

export function CalculatorCommandPalette({
  open,
  onClose,
  onSelectAction,
  storage,
}: CalculatorCommandPaletteProps) {
  const { t, i18n } = useTranslation();
  const effectiveStorage = storage ?? simpleStorage;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'favorites'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [actionStore, setActionStore] = useState<CalculatorQuickActionStore>(() =>
    loadQuickActions(effectiveStorage),
  );

  const storageRef = useRef(storage);
  storageRef.current = storage;

  useEffect(() => {
    if (open) {
      setActionStore(loadQuickActions(storageRef.current ?? simpleStorage));
    }
  }, [open]);

  const isEn = i18n.language === 'en';

  // 自动聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // 过滤操作
  const filteredItems = useMemo(() => {
    let items = actionStore.items.filter(i => !i.hidden);

    // 按标签页过滤
    if (activeTab === 'recent') {
      const recentIds = actionStore.recentUsed || [];
      items = recentIds
        .map(id => items.find(i => i.id === id))
        .filter((i): i is CalculatorQuickActionItem => !!i);
    } else if (activeTab === 'favorites') {
      const favoriteIds = actionStore.favorites || [];
      items = items.filter(i => favoriteIds.includes(i.id));
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.label.toLowerCase().includes(query) ||
        i.labelEn.toLowerCase().includes(query) ||
        i.id.toLowerCase().includes(query) ||
        (i.keywords && i.keywords.some(k => k.toLowerCase().includes(query)))
      );
    }

    // 排序：非搜索时按收藏和 order 排序
    if (!searchQuery.trim()) {
      items.sort((a, b) => {
        const aFav = actionStore.favorites?.includes(a.id) ? 0 : 1;
        const bFav = actionStore.favorites?.includes(b.id) ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        return a.order - b.order;
      });
    }

    return items;
  }, [actionStore, searchQuery, activeTab]);

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length, searchQuery, activeTab]);

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelectItem(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        if (activeTab === 'all') setActiveTab('recent');
        else if (activeTab === 'recent') setActiveTab('favorites');
        else setActiveTab('all');
        break;
    }
  }, [filteredItems, selectedIndex, onClose, activeTab]);

  // 选择操作（最近使用由侧栏 onSelectAction 内统一记录）
  const handleSelectItem = useCallback(
    (item: CalculatorQuickActionItem) => {
      onSelectAction(item);
      onClose();
    },
    [onSelectAction, onClose],
  );

  // 切换收藏
  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      e.stopPropagation();
      setActionStore((prev) => {
        const next = toggleFavorite(prev, itemId);
        saveQuickActions(effectiveStorage, next);
        return next;
      });
    },
    [effectiveStorage],
  );

  // 获取分类名称
  const getCategoryLabel = (categoryId: string) => {
    const cat = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
    return cat ? (isEn ? cat.labelEn : cat.label) : categoryId;
  };

  // 按分类分组（仅在"全部"标签页且无搜索时）
  const groupedItems = useMemo(() => {
    if (activeTab !== 'all' || searchQuery.trim()) return null;

    const grouped: Record<string, CalculatorQuickActionItem[]> = {};
    for (const item of filteredItems) {
      if (!grouped[item.categoryId]) {
        grouped[item.categoryId] = [];
      }
      grouped[item.categoryId].push(item);
    }

    return DEFAULT_CATEGORIES
      .filter(cat => grouped[cat.id]?.length)
      .map(cat => ({
        category: cat,
        items: grouped[cat.id] || [],
      }));
  }, [filteredItems, activeTab, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="p-0 gap-0 max-w-xl max-h-[70vh] overflow-hidden">
        <DialogTitle className="sr-only">
          {t('calculator.searchActions', { defaultValue: '搜索快捷操作...' })}
        </DialogTitle>
        {/* 搜索头部 */}
        <div className="flex items-center gap-2 px-3 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('calculator.searchActions', { defaultValue: '搜索快捷操作... (⌘K)' })}
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-6"
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">esc</kbd>
          </div>
        </div>

        {/* 标签栏 */}
        <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30">
          <Button
            variant={activeTab === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setActiveTab('all')}
          >
            {t('calculator.allActions', { defaultValue: '全部' })}
          </Button>
          <Button
            variant={activeTab === 'recent' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-xs px-2 gap-1"
            onClick={() => setActiveTab('recent')}
          >
            <Clock className="h-3 w-3" />
            {t('calculator.recent', { defaultValue: '最近' })}
          </Button>
          <Button
            variant={activeTab === 'favorites' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-xs px-2 gap-1"
            onClick={() => setActiveTab('favorites')}
          >
            <Star className="h-3 w-3" />
            {t('calculator.paletteFavorites', { defaultValue: '收藏' })}
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {filteredItems.length} {t('calculator.paletteResults', { defaultValue: '结果' })}
          </span>
        </div>

        {/* 操作列表 */}
        <ScrollArea className="flex-1 max-h-[50vh]" ref={listRef}>
          <div className="py-1">
            {filteredItems.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                {t('calculator.paletteNoMatch', { defaultValue: '未找到匹配的操作' })}
              </div>
            ) : groupedItems ? (
              // 分组显示
              groupedItems.map(({ category, items }) => (
                <div key={category.id}>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/20 flex items-center gap-1.5">
                    <DynamicIcon name={category.icon} className="h-3 w-3" />
                    {isEn ? category.labelEn : category.label}
                  </div>
                  {items.map((item) => {
                    const globalIdx = filteredItems.indexOf(item);
                    return (
                      <div
                        key={item.id}
                        data-index={globalIdx}
                        className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                          globalIdx === selectedIndex ? 'bg-primary/10' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleSelectItem(item)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <DynamicIcon name={item.icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {isEn ? item.labelEn : item.label}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.prompt.length > 50 ? item.prompt.slice(0, 50) + '...' : item.prompt}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => handleToggleFavorite(e, item.id)}
                        >
                          <Star
                            className={`h-3 w-3 ${
                              actionStore.favorites?.includes(item.id)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-muted-foreground'
                            }`}
                          />
                        </Button>
                        {globalIdx === selectedIndex && (
                          <CornerDownLeft className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              // 平铺显示
              filteredItems.map((item, idx) => (
                <div
                  key={item.id}
                  data-index={idx}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    idx === selectedIndex ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <DynamicIcon name={item.icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {isEn ? item.labelEn : item.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {getCategoryLabel(item.categoryId)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => handleToggleFavorite(e, item.id)}
                  >
                    <Star
                      className={`h-3 w-3 ${
                        actionStore.favorites?.includes(item.id)
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </Button>
                  {idx === selectedIndex && (
                    <CornerDownLeft className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* 底部提示 */}
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
              {t('calculator.paletteNavigate', { defaultValue: '导航' })}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
              {t('calculator.paletteSelect', { defaultValue: '选择' })}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Tab</kbd>
              {t('calculator.paletteSwitchTab', { defaultValue: '切换标签' })}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            K
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
