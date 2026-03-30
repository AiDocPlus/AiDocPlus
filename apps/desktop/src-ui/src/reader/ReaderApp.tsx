import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from '@/i18n';
import { useReaderStore, READER_THEME_PRESETS } from './useReaderStore';
import { LibraryPanel } from './LibraryPanel';
import { ReadingPane } from './ReadingPane';
import { ReaderSettings } from './ReaderSettings';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import { Maximize, Minimize, Plus, Minus, PanelLeftClose, PanelLeft, Settings } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

const SUPPORTED_EXTENSIONS = new Set(['md', 'html', 'htm', 'docx', 'pdf', 'epub']);

export function ReaderApp() {
  const { t } = useTranslation();
  const {
    theme, fontSize, isFullscreen, sidebarOpen, sidebarWidth, currentBook,
    loadLibrary, increaseFontSize, decreaseFontSize, toggleSidebar,
    setFullscreen, setTheme, setSidebarWidth, importFile, openBook,
  } = useReaderStore();
  const [progressPercent, setProgressPercent] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // 拖拽结束时恢复过渡
  useEffect(() => {
    if (!isResizing) return;
    const handleUp = () => setIsResizing(false);
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [isResizing]);

  // 应用主题到 <html> 和 CSS 变量
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('light', 'dark', 'sepia');
    html.classList.add(theme.mode);
    if (theme.mode === 'dark') {
      html.classList.add('dark');
    }
    html.style.setProperty('--reader-bg', theme.bg);
    html.style.setProperty('--reader-text', theme.text);
    html.style.setProperty('--reader-heading', theme.heading);
    html.style.setProperty('--reader-muted', theme.muted);
    html.style.setProperty('--reader-accent', theme.accent);
    html.style.setProperty('--reader-code-bg', theme.codeBg);
  }, [theme]);

  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onResized(() => {
      win.isFullscreen().then(setFullscreen);
    });
    return () => { unlisten.then(fn => fn()); };
  }, [setFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const win = getCurrentWindow();
    const current = await win.isFullscreen();
    await win.setFullscreen(!current);
  }, []);

  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        increaseFontSize();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        decreaseFontSize();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'F11' || (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey && tag !== 'INPUT' && tag !== 'TEXTAREA')) {
        if (e.key === 'F11') e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, increaseFontSize, decreaseFontSize, toggleSidebar, toggleFullscreen]);

  const handleDrop = useCallback(async (paths: string[]) => {
    for (const p of paths) {
      const ext = p.split('.').pop()?.toLowerCase();
      if (ext && SUPPORTED_EXTENSIONS.has(ext)) {
        const book = await importFile(p);
        if (book) openBook(book);
        return;
      }
    }
  }, [importFile, openBook]);

  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      handleDrop(event.payload.paths);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [handleDrop]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* 工具栏 */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-toolbar shadow-sm">
        <button className="reader-toolbar-btn" onClick={toggleSidebar}
          title={`${t('reader.toggleSidebar', { defaultValue: '切换侧边栏' })} (⌘B)`}>
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>

        <div className="reader-toolbar-sep" />

        <button className="reader-toolbar-btn" onClick={decreaseFontSize}
          title={`${t('reader.decreaseFont', { defaultValue: '减小字号' })} (⌘-)`} disabled={fontSize <= 12}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground min-w-[36px] text-center font-medium tabular-nums">
          {fontSize}
        </span>
        <button className="reader-toolbar-btn" onClick={increaseFontSize}
          title={`${t('reader.increaseFont', { defaultValue: '增大字号' })} (⌘=)`} disabled={fontSize >= 32}>
          <Plus className="h-4 w-4" />
        </button>

        <div className="reader-toolbar-sep" />

        {/* 主题选择 Popover */}
        <Popover open={themeOpen} onOpenChange={setThemeOpen}>
          <PopoverTrigger asChild>
            <button className="reader-toolbar-btn" title={t('reader.theme', { defaultValue: '主题' })}>
              <div className="relative w-4 h-4 rounded-full border border-border/50 overflow-hidden" style={{ backgroundColor: theme.bg }}>
                <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: theme.heading }} />
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="bottom" sideOffset={4} className="w-auto p-3 !bg-card !border-border">
            <div className="grid grid-cols-4 gap-2">
              {READER_THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => { setTheme(preset); setThemeOpen(false); }}
                  className={`flex flex-col items-center gap-1.5 py-2 px-1.5 rounded-lg transition-all duration-100 ${
                    theme.id === preset.id ? 'ring-2 ring-primary/40 bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <div
                    className="w-full h-10 rounded-md shadow-sm flex flex-col justify-center px-2 py-1.5 gap-0.5"
                    style={{ backgroundColor: preset.bg }}
                  >
                    <div className="h-[4px] w-6 rounded-sm" style={{ backgroundColor: preset.heading }} />
                    <div className="h-[3px] w-full rounded-sm opacity-60" style={{ backgroundColor: preset.text }} />
                    <div className="h-[3px] w-3/4 rounded-sm opacity-35" style={{ backgroundColor: preset.text }} />
                  </div>
                  <span className={`text-xs leading-tight ${theme.id === preset.id ? 'text-primary font-medium' : 'text-foreground/70'}`}>
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <button className={`reader-toolbar-btn ${settingsOpen ? 'active' : ''}`}
          onClick={() => setSettingsOpen(!settingsOpen)}
          title={t('reader.settings', { defaultValue: '阅读设置' })}>
          <Settings className="h-4 w-4" />
        </button>

        <button className="reader-toolbar-btn" onClick={toggleFullscreen}
          title={`${isFullscreen ? t('reader.exitFullscreen', { defaultValue: '退出全屏' }) : t('reader.fullscreen', { defaultValue: '全屏' })} (F)`}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <div className={`shrink-0 border-r border-border ${isResizing ? '' : 'transition-all duration-300 ease-out'} overflow-hidden ${
          sidebarOpen ? 'opacity-100' : 'w-0 opacity-0 border-r-0'
        }`} style={sidebarOpen ? { width: sidebarWidth } : undefined}>
          <div className="h-full" style={{ width: sidebarWidth }}>
            <LibraryPanel />
          </div>
        </div>

        {/* 侧边栏拖拽调整宽度手柄 */}
        {sidebarOpen && (
          <ResizableHandle
            direction="horizontal"
            onResize={(delta) => { setIsResizing(true); setSidebarWidth(sidebarWidth + delta); }}
          />
        )}

        {/* 设置面板 */}
        <div className={`shrink-0 border-r border-border transition-all duration-300 ease-out overflow-hidden ${
          settingsOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 border-r-0'
        }`}>
          <div className="w-[260px] h-full">
            <ReaderSettings onClose={() => setSettingsOpen(false)} />
          </div>
        </div>

        {/* 阅读区 */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <ReadingPane onProgressChange={setProgressPercent} />
          {currentBook && progressPercent > 0 && (
            <div className="h-1 bg-muted">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out rounded-r-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
