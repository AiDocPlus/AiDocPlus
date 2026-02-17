import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useAppStore } from '@/stores/useAppStore';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { confirm } from '@tauri-apps/plugin-dialog';

interface TabBarProps {
  onSettingsOpen: () => void;
}

// 标签页背景颜色列表（非活动标签使用，活动标签固定红色）
const TAB_COLORS = [
  'rgba(59,130,246,0.15)',   // 蓝
  'rgba(16,185,129,0.15)',   // 绿
  'rgba(245,158,11,0.15)',   // 橙
  'rgba(168,85,247,0.15)',   // 紫
  'rgba(239,68,68,0.15)',    // 红
  'rgba(14,165,233,0.15)',   // 天蓝
  'rgba(236,72,153,0.15)',   // 粉
  'rgba(20,184,166,0.15)',   // 青
];

export function TabBar({ onSettingsOpen }: TabBarProps) {
  const { t } = useTranslation();
  const { tabs, switchTab, closeTab, closeOtherTabs, closeAllTabs } = useAppStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);

  // 检查滚动状态
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setShowLeftScroll(container.scrollLeft > 0);
      setShowRightScroll(
        container.scrollLeft < container.scrollWidth - container.clientWidth
      );
    }
  };

  // 滚动处理
  const scrollLeft = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  // 标签数量变化时重新检查滚动状态
  useEffect(() => {
    checkScroll();
  }, [tabs.length]);

  // 标签切换处理（左键点击）
  const handleTabClick = (tabId: string) => {
    switchTab(tabId);
  };

  // 关闭标签前检查未保存状态
  const confirmAndCloseTab = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.isDirty) {
      const shouldSave = await confirm(
        t('tabs.unsavedConfirm', { defaultValue: '"{{title}}" 有未保存的更改，是否保存后关闭？', title: tab.title }),
        { title: t('tabs.unsavedChanges', { defaultValue: '未保存的更改' }), kind: 'warning', okLabel: t('tabs.saveAndClose', { defaultValue: '保存并关闭' }), cancelLabel: t('tabs.discardAndClose', { defaultValue: '不保存' }) }
      );
      await closeTab(tabId, shouldSave);
    } else {
      await closeTab(tabId, false);
    }
  };

  // 标签关闭处理
  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    confirmAndCloseTab(tabId);
  };

  // 中键点击关闭标签
  const handleMouseDown = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      confirmAndCloseTab(tabId);
    }
  };

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // 拖拽排序
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    e.dataTransfer.setData('tabId', tabId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    const sourceTabId = e.dataTransfer.getData('tabId');

    if (sourceTabId === targetTabId) return;

    const { tabs, moveTab } = useAppStore.getState();
    const fromIndex = tabs.findIndex(t => t.id === sourceTabId);
    const toIndex = tabs.findIndex(t => t.id === targetTabId);

    if (fromIndex !== -1 && toIndex !== -1) {
      moveTab(fromIndex, toIndex);
    }
  };

  if (tabs.length === 0) {
    return (
      <>
        <div className="h-8 border-b bg-muted/20 flex items-center justify-between px-4">
          <span className="text-sm text-muted-foreground">{t('tabs.noOpenDocuments', { defaultValue: '没有打开的文档' })}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsOpen}
            className="h-7 w-7"
            title={t('settings.title')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <TabShortcuts />
      </>
    );
  }

  return (
    <>
    <div className="h-8 border-b bg-background flex items-center relative flex-shrink-0">
      {/* 左滚动按钮 */}
      {showLeftScroll && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-5 p-0 absolute left-0 top-1/2 -translate-y-1/2 z-10 border-r rounded-r-none shadow-sm"
          style={{ backgroundColor: 'hsl(var(--muted))', opacity: 1 }}
          onClick={scrollLeft}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* 标签容器 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-center overflow-x-auto"
        onScroll={checkScroll}
        onWheel={(e) => {
          if (scrollContainerRef.current && e.deltaY !== 0) {
            scrollContainerRef.current.scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }}
      >
        {tabs.map((tab, index) => {
          const bgColor = TAB_COLORS[index % TAB_COLORS.length];
          return (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, tab.id)}
              className="group relative flex items-center gap-1.5 px-2.5 h-8 cursor-pointer transition-all w-[150px] flex-shrink-0"
              style={{
                backgroundColor: tab.isActive ? 'rgba(239,68,68,0.2)' : bgColor,
                borderBottom: tab.isActive ? '2px solid rgba(239,68,68,0.6)' : '2px solid transparent',
              }}
              onClick={() => handleTabClick(tab.id)}
              onMouseDown={(e) => handleMouseDown(e, tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              title={tab.title}
            >
              {/* 未保存指示器 */}
              {tab.isDirty && (
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />
              )}

              {/* 标题 */}
              <span
                className={cn(
                  'text-sm truncate flex-1',
                  tab.isActive ? 'font-medium' : 'opacity-70'
                )}
                style={{ color: tab.isActive ? 'rgb(220,38,38)' : undefined }}
              >
                {tab.title}
              </span>

              {/* 关闭按钮 */}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={(e) => handleCloseTab(e, tab.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* 设置按钮区域 */}
      <div className="flex items-center border-l h-8 px-1 bg-background">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsOpen}
          className="h-7 w-7"
          title={t('settings.title')}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* 右滚动按钮 */}
      {showRightScroll && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-5 p-0 absolute right-[42px] top-1/2 -translate-y-1/2 z-10 border-l rounded-l-none shadow-sm"
          style={{ backgroundColor: 'hsl(var(--muted))', opacity: 1 }}
          onClick={scrollRight}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>

    {/* 右键上下文菜单 */}
    <DropdownMenu open={!!contextMenu} onOpenChange={(open) => { if (!open) closeContextMenu(); }}>
      <DropdownMenuTrigger asChild>
        <div
          style={{
            position: 'fixed',
            left: contextMenu?.x ?? 0,
            top: contextMenu?.y ?? 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0} className="min-w-[160px]">
        {contextMenu && (() => {
          const ctxTab = tabs.find(t => t.id === contextMenu.tabId);
          const ctxIndex = tabs.findIndex(t => t.id === contextMenu.tabId);
          const hasTabsToRight = ctxIndex >= 0 && ctxIndex < tabs.length - 1;
          return (
            <>
              <DropdownMenuItem onClick={() => { confirmAndCloseTab(contextMenu.tabId); closeContextMenu(); }}>
                {t('tabs.closeTab', { defaultValue: '关闭标签' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { closeOtherTabs(contextMenu.tabId); closeContextMenu(); }}>
                {t('tabs.closeOtherTabs', { defaultValue: '关闭其他标签' })}
              </DropdownMenuItem>
              {hasTabsToRight && (
                <DropdownMenuItem onClick={() => {
                  const rightTabs = tabs.slice(ctxIndex + 1);
                  rightTabs.forEach(t => closeTab(t.id, false));
                  closeContextMenu();
                }}>
                  {t('tabs.closeRightTabs', { defaultValue: '关闭右侧标签' })}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { closeAllTabs(); closeContextMenu(); }}>
                {t('tabs.closeAllTabs', { defaultValue: '关闭所有标签' })}
              </DropdownMenuItem>
              {ctxTab && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    navigator.clipboard.writeText(ctxTab.title);
                    closeContextMenu();
                  }}>
                    {t('tabs.copyDocTitle', { defaultValue: '复制文档标题' })}
                  </DropdownMenuItem>
                </>
              )}
            </>
          );
        })()}
      </DropdownMenuContent>
    </DropdownMenu>

    {/* 快捷键处理 */}
    <TabShortcuts />
  </>
  );
}

// 快捷键处理组件
function TabShortcuts() {
  const { tabs, activeTabId, closeTab, switchTab } = useAppStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // 注意：⌘+S, ⌘+Shift+S, ⌘+N, ⌘+W, ⌘+L, ⌘+H, ⌘+J, ⌘+F, ⌘+B 等
    // 已由原生系统菜单处理，不再在此重复注册

    // Cmd/Ctrl+E - 导出（系统菜单未注册此快捷键）
    if (cmdOrCtrl && e.key === 'e' && !e.shiftKey) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('editor-export'));
      return;
    }

    // Cmd/Ctrl+Tab - 下一个标签
    if (cmdOrCtrl && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (tabs.length > 0) {
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        switchTab(tabs[nextIndex].id);
      }
      return;
    }

    // Cmd/Ctrl+Shift+Tab - 上一个标签
    if (cmdOrCtrl && e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      if (tabs.length > 0) {
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const prevIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
        switchTab(tabs[prevIndex].id);
      }
      return;
    }

    // Cmd/Ctrl+数字键 - 切换到指定标签
    if (cmdOrCtrl && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      if (index < tabs.length) {
        switchTab(tabs[index].id);
      }
      return;
    }
  }, [tabs, activeTabId, closeTab, switchTab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return null;
}
