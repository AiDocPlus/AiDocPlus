// ── 电子书阅读器根组件（导航栏 + 主视图 + AI 面板） ──

import React, { useCallback, useEffect, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  Library,
  BookOpen,
  Settings,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useReaderStore } from './useReaderStore';
import type { ReaderView } from './styles';
import { S, colors, applyTheme } from './styles';
import { LibraryView } from './views/LibraryView';
import { ReadingView } from './views/ReadingView';
import { SettingsView } from './views/SettingsView';
import { AiPanel } from './views/AiPanel';
import { useTranslation } from '@/i18n';

// 导航项定义
const NAV_ITEMS: { view: ReaderView; icon: React.ElementType; labelKey: string; labelDefault: string }[] = [
  { view: 'library',  icon: Library,  labelKey: 'reader.navLibrary',  labelDefault: '书库' },
  { view: 'reading',  icon: BookOpen, labelKey: 'reader.navReading',  labelDefault: '阅读' },
  { view: 'settings', icon: Settings, labelKey: 'reader.navSettings', labelDefault: '设置' },
];

const SUPPORTED_EXTENSIONS = new Set(['md', 'html', 'htm', 'docx', 'pdf', 'epub']);

export function ReaderApp() {
  const { t } = useTranslation();
  const currentView = useReaderStore(s => s.currentView);
  const setCurrentView = useReaderStore(s => s.setCurrentView);
  const aiPanelVisible = useReaderStore(s => s.aiPanelVisible);
  const toggleAiPanel = useReaderStore(s => s.toggleAiPanel);
  const theme = useReaderStore(s => s.theme);
  const books = useReaderStore(s => s.books);
  const tabs = useReaderStore(s => s.tabs);
  const activeTabId = useReaderStore(s => s.activeTabId);
  const importFile = useReaderStore(s => s.importFile);
  const openBook = useReaderStore(s => s.openBook);

  const activeTab = useMemo(() => tabs.find(tb => tb.id === activeTabId) ?? null, [tabs, activeTabId]);
  const recordReadingSession = useReaderStore(s => s.recordReadingSession);

  // ── 阅读计时：每 60 秒记录一次 ──
  const activeFilename = activeTab?.book.filename ?? null;
  useEffect(() => {
    if (currentView !== 'reading' || !activeFilename) return;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 60;
      recordReadingSession(activeFilename, 60);
    }, 60_000);
    return () => clearInterval(timer);
  }, [currentView, activeFilename, recordReadingSession]);

  // ── 初始化：加载书库 + 恢复标签页 ──
  const loadLibrary = useReaderStore(s => s.loadLibrary);
  const restoreTabs = useReaderStore(s => s.restoreTabs);
  useEffect(() => {
    (async () => {
      try {
        await loadLibrary();
        restoreTabs();
      } catch (e) {
        console.error('[ReaderApp] init failed:', e);
      }
    })();
  }, [loadLibrary, restoreTabs]);

  // ── 主题 CSS 变量 + 更新模块级样式 ──
  useEffect(() => {
    applyTheme(theme);
    const html = document.documentElement;
    html.classList.remove('light', 'dark', 'sepia');
    html.classList.add(theme.mode);
    if (theme.mode === 'dark') html.classList.add('dark');
    html.style.setProperty('--reader-bg', theme.bg);
    html.style.setProperty('--reader-text', theme.text);
    html.style.setProperty('--reader-heading', theme.heading);
    html.style.setProperty('--reader-muted', theme.muted);
    html.style.setProperty('--reader-accent', theme.accent);
    html.style.setProperty('--reader-code-bg', theme.codeBg);
    return () => {
      html.classList.remove('light', 'dark', 'sepia');
      html.style.removeProperty('--reader-bg');
      html.style.removeProperty('--reader-text');
      html.style.removeProperty('--reader-heading');
      html.style.removeProperty('--reader-muted');
      html.style.removeProperty('--reader-accent');
      html.style.removeProperty('--reader-code-bg');
    };
  }, [theme]);

  // ── 文件拖入导入 ──
  const handleDrop = useCallback(async (paths: string[]) => {
    for (const p of paths) {
      try {
        const ext = p.split('.').pop()?.toLowerCase();
        if (ext && SUPPORTED_EXTENSIONS.has(ext)) {
          const book = await importFile(p);
          if (book) openBook(book);
        }
      } catch (e) { console.warn('[ReaderApp] import failed:', p, e); }
    }
  }, [importFile, openBook]);

  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      handleDrop(event.payload.paths);
    });
    return () => { unlisten.then(fn => fn()).catch(() => {}); };
  }, [handleDrop]);

  // ── 视图渲染 ──
  const renderMainView = useCallback(() => {
    switch (currentView) {
      case 'library':  return <LibraryView />;
      case 'reading':  return <ReadingView />;
      case 'settings': return <SettingsView />;
      default:         return <LibraryView />;
    }
  }, [currentView]);

  // ── 状态栏信息 ──
  const statusText = useMemo(() => {
    if (currentView === 'reading' && activeTab) {
      const name = activeTab.book.display_name || activeTab.book.original_name || activeTab.book.filename;
      return `${name} | ${activeTab.book.format.toUpperCase()}${activeTab.progressPercent > 0 ? ` | ${activeTab.progressPercent}%` : ''}`;
    }
    if (currentView === 'library') {
      return t('reader.statusLibrary', { defaultValue: '书库: {{count}} 本书', count: books.length });
    }
    return t('reader.appTitle', { defaultValue: '电子书阅读器' });
  }, [currentView, activeTab, books.length, t]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
      fontSize: 13,
      backgroundColor: colors.bg,
    }}>
      {/* 主区域：导航栏 + 内容 + AI 面板 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左侧导航栏 */}
        <nav style={S.nav}>
          {NAV_ITEMS.map(({ view, icon: Icon, labelKey, labelDefault }) => {
            const active = currentView === view;
            const label = t(labelKey, { defaultValue: labelDefault });
            return (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                title={label}
                style={S.navButton(active)}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = colors.navHover;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon size={20} />
                <span style={{ fontSize: 9, lineHeight: 1 }}>{label}</span>
              </button>
            );
          })}

          {/* 底部 AI 面板切换 */}
          <div style={{ flex: 1 }} />
          <button
            onClick={toggleAiPanel}
            title={aiPanelVisible
              ? t('reader.hideAiPanel', { defaultValue: '隐藏 AI 面板' })
              : t('reader.showAiPanel', { defaultValue: '显示 AI 面板' })
            }
            style={{
              ...S.navButton(false),
              marginBottom: 8,
              color: aiPanelVisible ? colors.navIcon : colors.navMuted,
            }}
          >
            {aiPanelVisible ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          </button>
        </nav>

        {/* 主内容区 */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: theme.bg,
        }}>
          {renderMainView()}
        </main>

        {/* 右侧 AI 面板 */}
        {aiPanelVisible && (
          <aside style={{
            width: 340,
            minWidth: 340,
            borderLeft: `1px solid ${colors.borderMain}`,
            backgroundColor: theme.mode === 'dark' ? '#1e293b' : '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              height: 44,
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              borderBottom: `1px solid ${colors.borderMain}`,
              fontWeight: 600,
              fontSize: 14,
              color: colors.textSecondary,
            }}>
              {t('reader.aiAssistant', { defaultValue: 'AI 阅读助手' })}
            </div>
            <AiPanel />
          </aside>
        )}
      </div>

      {/* 底部状态栏 */}
      <footer style={S.statusBar}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {statusText}
        </span>
        <span>|</span>
        <span>{t('reader.aiReady', { defaultValue: 'AI 助手已就绪' })}</span>
      </footer>
    </div>
  );
}
