// ── 阅读视图（标签栏 + 工具栏 + 阅读区 + 侧栏 + 进度条） ──

import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { useReaderStore, READER_THEME_PRESETS, type TocEntry } from '../useReaderStore';
import { colors } from '../styles';
import { ReadingPane, type ReadingPaneHandle } from '../ReadingPane';
import { ReadingSidebar, extractHeadings } from '../ReadingSidebar';
import {
  Plus, Minus, List, Settings, Maximize, Minimize, BookOpen, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Annotation } from '../types/annotations';

const TAB_COLORS = [
  'rgba(59,130,246,0.12)', 'rgba(16,185,129,0.12)', 'rgba(245,158,11,0.12)',
  'rgba(168,85,247,0.12)', 'rgba(239,68,68,0.12)', 'rgba(14,165,233,0.12)',
  'rgba(236,72,153,0.12)', 'rgba(20,184,166,0.12)',
];

const FORMAT_ICONS: Record<string, string> = {
  md: '\ud83d\udcdd', html: '\ud83c\udf10', pdf: '\ud83d\udcd5',
  docx: '\ud83d\udcd8', epub: '\ud83d\udcd6',
};

export function ReadingView() {
  const { t } = useTranslation();
  const store = useReaderStore();
  const {
    theme, fontSize, isFullscreen, tabs, activeTabId,
    increaseFontSize, decreaseFontSize,
    setFullscreen, setTheme,
    readingSidebarOpen, toggleReadingSidebar, addBookmark,
    setCurrentView, loadAnnotations,
  } = store;

  const activeTab = useMemo(() => tabs.find(tb => tb.id === activeTabId) ?? null, [tabs, activeTabId]);

  const [tocEntries, setTocEntries] = useState<TocEntry[]>([]);
  const readingPaneRef = useRef<ReadingPaneHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // ReadingPane 回调使用 ref 存储最新值，避免闭包过期
  const progressRef = useRef(0);
  const wordCountRef = useRef(0);
  // 用 ref 存储最新值供快捷键 handler 使用，避免频繁 rebind
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // 加载当前书的批注
  useEffect(() => {
    if (activeTab?.book.filename) {
      loadAnnotations(activeTab.book.filename);
    }
  }, [activeTab?.book.filename, loadAnnotations]);

  // 全屏检测
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onResized(() => { win.isFullscreen().then(setFullscreen); });
    return () => { unlisten.then(fn => fn()); };
  }, [setFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const win = getCurrentWindow();
    const current = await win.isFullscreen();
    await win.setFullscreen(!current);
  }, []);

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); increaseFontSize(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); decreaseFontSize(); return; }
      if (e.key === 'F11' || (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey && tag !== 'INPUT' && tag !== 'TEXTAREA')) {
        if (e.key === 'F11') e.preventDefault(); toggleFullscreen(); return;
      }
      if (e.key === 'Escape' && isFullscreen) { toggleFullscreen(); return; }
      const currentTabs = tabsRef.current;
      const currentTabId = activeTabIdRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key === 'w' && currentTabs.length > 0 && currentTabId) { e.preventDefault(); useReaderStore.getState().closeTab(currentTabId); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && currentTabs.length > 1) {
        e.preventDefault();
        const idx = currentTabs.findIndex(tb => tb.id === currentTabId);
        const next = e.shiftKey ? (idx <= 0 ? currentTabs.length - 1 : idx - 1) : (idx + 1) % currentTabs.length;
        useReaderStore.getState().switchTab(currentTabs[next].id); return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, increaseFontSize, decreaseFontSize, toggleFullscreen]);

  const displayProgress = activeTab?.progressPercent ?? progressRef.current;
  const displayWordCount = activeTab?.wordCount ?? wordCountRef.current;

  // 标签栏
  const [showScrollLeft, setShowScrollLeft] = useState(false);
  const [showScrollRight, setShowScrollRight] = useState(false);
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollLeft(el.scrollLeft > 2);
    setShowScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);
  useEffect(() => { checkScroll(); }, [tabs.length, checkScroll]);

  // 标签栏横向滚轮滚动（非 passive，需要 preventDefault）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // 标签拖拽
  const handleDragStart = (e: React.DragEvent, tabId: string) => { e.dataTransfer.setData('tabId', tabId); e.dataTransfer.effectAllowed = 'move'; };
  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('tabId');
    if (sourceId === targetTabId) return;
    const { tabs: allTabs } = useReaderStore.getState();
    const from = allTabs.findIndex(t => t.id === sourceId);
    const to = allTabs.findIndex(t => t.id === targetTabId);
    if (from >= 0 && to >= 0) store.reorderTabs(from, to);
  };

  // 主题选择弹窗
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!themeOpen) return;
    const handler = (e: MouseEvent) => { if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [themeOpen]);

  const bookTitle = (tab: typeof activeTab) => tab ? (tab.book.display_name || tab.book.original_name || tab.book.filename) : '';

  // 没有标签时显示欢迎内容
  if (tabs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ height: 32, borderBottom: `1px solid ${colors.borderMain}`, background: colors.bgAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: colors.textPlaceholder }}>{t('reader.noOpenBooks', { defaultValue: '没有打开的文档' })}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 380, padding: 32 }}>
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 12,
                background: 'rgba(59,130,246,0.08)', border: `1px solid ${colors.borderMain}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BookOpen size={32} style={{ color: 'rgba(59,130,246,0.6)' }} />
              </div>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary, marginBottom: 8 }}>{t('reader.welcomeTitle', { defaultValue: 'AiDocPlus Reader' })}</h2>
            <p style={{ fontSize: 13, color: colors.textMuted, marginBottom: 24, textAlign: 'center', lineHeight: 1.6 }}>
              {t('reader.welcomeSubtitle', { defaultValue: '从书库选择一本书或拖拽文件到窗口开始阅读' })}
            </p>
            <button
              onClick={() => setCurrentView('library')}
              style={{
                padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, background: colors.primary, color: '#fff',
              }}
            >
              {t('reader.goToLibrary', { defaultValue: '前往书库' })}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, fontSize: 11, color: colors.textPlaceholder }}>
              <span><kbd style={kbdStyle}>F</kbd> {t('reader.fullscreen', { defaultValue: '全屏' })}</span>
              <span><kbd style={kbdStyle}>&#8984;F</kbd> {t('reader.search', { defaultValue: '搜索' })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 标签栏 */}
      <div style={{ height: 32, borderBottom: `1px solid ${colors.borderMain}`, display: 'flex', alignItems: 'center', position: 'relative', flexShrink: 0 }}>
        {showScrollLeft && (
          <button onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
            style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 20, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer', background: colors.bgAlt, borderRight: `1px solid ${colors.borderMain}` }}>
            <ChevronLeft size={14} style={{ color: colors.textMuted }} />
          </button>
        )}
        <div ref={scrollRef} style={{ flex: 1, display: 'flex', alignItems: 'center', overflowX: 'auto' }} onScroll={checkScroll}>
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const bgColor = TAB_COLORS[index % TAB_COLORS.length];
            const icon = FORMAT_ICONS[tab.book.format] || '\ud83d\udcc4';
            return (
              <div
                key={tab.id}
                draggable
                onDragStart={e => handleDragStart(e, tab.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, tab.id)}
                onClick={() => store.switchTab(tab.id)}
                title={bookTitle(tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 10px', height: 32, cursor: 'pointer',
                  width: 150, flexShrink: 0,
                  background: isActive ? 'rgba(239,68,68,0.15)' : bgColor,
                  borderBottom: isActive ? '2px solid rgba(239,68,68,0.5)' : '2px solid transparent',
                }}
              >
                <span style={{ fontSize: 12, opacity: 0.5 }}>{icon}</span>
                <span style={{
                  flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: isActive ? '#dc2626' : colors.textSecondary,
                  fontWeight: isActive ? 500 : 400, opacity: isActive ? 1 : 0.7,
                }}>
                  {bookTitle(tab)}
                </span>
                <button onClick={e => { e.stopPropagation(); store.closeTab(tab.id); }}
                  style={{ opacity: 0, border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: colors.textMuted }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
        {showScrollRight && (
          <button onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
            style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10, width: 20, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: '4px 0 0 4px', cursor: 'pointer', background: colors.bgAlt, borderLeft: `1px solid ${colors.borderMain}` }}>
            <ChevronRight size={14} style={{ color: colors.textMuted }} />
          </button>
        )}
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', borderBottom: `1px solid ${colors.borderMain}`, background: colors.bgAlt, flexShrink: 0 }}>
        <ToolbarBtn onClick={() => increaseFontSize()} disabled={fontSize <= 12} title={`${t('reader.increaseFont', { defaultValue: '增大字号' })} (\u2318+)`}>
          <Plus size={14} />
        </ToolbarBtn>
        <span style={{ fontSize: 12, color: colors.textMuted, minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{fontSize}</span>
        <ToolbarBtn onClick={() => decreaseFontSize()} disabled={fontSize >= 32} title={`${t('reader.decreaseFont', { defaultValue: '减小字号' })} (\u2318-)`}>
          <Minus size={14} />
        </ToolbarBtn>

        <div style={{ width: 1, height: 16, background: colors.borderMain, margin: '0 4px' }} />

        {/* 主题选择 */}
        <div style={{ position: 'relative' }}>
          <ToolbarBtn onClick={() => setThemeOpen(!themeOpen)} title={t('reader.theme', { defaultValue: '主题' })}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1px solid ${colors.borderMain}`, overflow: 'hidden', background: theme.bg }}>
              <div style={{ height: 3, background: theme.heading }} />
            </div>
          </ToolbarBtn>
          {themeOpen && (
            <div ref={themeRef} style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
              padding: 8, borderRadius: 6, border: `1px solid ${colors.borderMain}`,
              background: theme.mode === 'dark' ? '#2d2d2d' : '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
            }}>
              {READER_THEME_PRESETS.map(preset => (
                <button key={preset.id} onClick={() => { setTheme(preset); setThemeOpen(false); }}
                  style={{ border: 'none', cursor: 'pointer', background: theme.id === preset.id ? 'rgba(59,130,246,0.08)' : 'transparent', borderRadius: 6, padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: 36, borderRadius: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', background: preset.bg, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 6px', gap: 2 }}>
                    <div style={{ height: 4, width: 24, borderRadius: 2, background: preset.heading }} />
                    <div style={{ height: 3, width: '100%', borderRadius: 1, opacity: 0.6, background: preset.text }} />
                    <div style={{ height: 3, width: '75%', borderRadius: 1, opacity: 0.35, background: preset.text }} />
                  </div>
                  <span style={{ fontSize: 11, color: theme.id === preset.id ? colors.primary : colors.textSecondary, fontWeight: theme.id === preset.id ? 500 : 400 }}>{t(preset.nameKey || '', { defaultValue: preset.name })}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <ToolbarBtn active={readingSidebarOpen} onClick={toggleReadingSidebar} title={t('reader.readingSidebar', { defaultValue: '目录与书签' })}>
          <List size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => setCurrentView('settings')} title={t('reader.settings', { defaultValue: '阅读设置' })}>
          <Settings size={14} />
        </ToolbarBtn>
        <ToolbarBtn onClick={toggleFullscreen} title={isFullscreen ? t('reader.exitFullscreen', { defaultValue: '退出全屏' }) : t('reader.fullscreen', { defaultValue: '全屏' })}>
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </ToolbarBtn>
      </div>

      {/* 主体 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          {activeTab ? (
            <ReadingPane
              key={activeTab.id}
              ref={readingPaneRef}
              tab={activeTab}
              onProgressChange={v => { progressRef.current = v; }}
              onWordCountChange={v => { wordCountRef.current = v; }}
              onTocChange={setTocEntries}
            />
          ) : null}
        </div>

        {/* 右侧目录/书签 */}
        {readingSidebarOpen && activeTab && (
          <div style={{ width: 200, flexShrink: 0, borderLeft: `1px solid ${colors.borderMain}` }}>
            <ReadingSidebar
              tocEntries={tocEntries}
              onTocClick={(entry) => {
                const el = entry.element;
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              currentScrollPercent={activeTab.progressPercent}
              onAddBookmark={() => {
                const container = readingPaneRef.current?.getScrollContainer();
                if (!container || !activeTab.book) return;
                const scrollable = container.scrollHeight - container.clientHeight;
                if (scrollable <= 0) return;
                const percent = Math.round((container.scrollTop / scrollable) * 100);
                const headings = extractHeadings(container);
                const label = headings.find(h => h.level <= 2)?.text || `${percent}%`;
                addBookmark({ filename: activeTab.book.filename, label, scrollPosition: container.scrollTop, progressPercent: percent });
              }}
              onJumpToBookmark={(bm) => {
                const container = readingPaneRef.current?.getScrollContainer();
                if (!container) return;
                const scrollable = container.scrollHeight - container.clientHeight;
                if (scrollable > 0) {
                  container.scrollTo({ top: (bm.progressPercent / 100) * scrollable, behavior: 'smooth' });
                }
              }}
              onJumpToAnnotation={(annotation: Annotation) => {
                const container = readingPaneRef.current?.getScrollContainer();
                if (!container || !annotation.position?.progressPercent) return;
                const scrollable = container.scrollHeight - container.clientHeight;
                if (scrollable > 0) {
                  container.scrollTo({ top: (annotation.position.progressPercent / 100) * scrollable, behavior: 'smooth' });
                } else if (annotation.position.scrollPosition) {
                  container.scrollTo({ top: annotation.position.scrollPosition, behavior: 'smooth' });
                }
              }}
            />
          </div>
        )}
      </div>

      {/* 进度条 */}
      {activeTab && displayProgress > 0 && (
        <div style={{ height: 6, background: colors.borderLight, cursor: 'pointer' }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
            store.jumpToProgress(activeTab.id, percent);
          }}>
          <div style={{ height: '100%', background: `linear-gradient(to right, ${colors.primary}, ${colors.primary}cc)`, borderRadius: '0 3px 3px 0', transition: 'width 0.5s', width: `${displayProgress}%` }} />
        </div>
      )}

      {/* 底部状态栏 */}
      {activeTab && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 12px', borderTop: `1px solid ${colors.borderMain}`,
          background: theme.mode === 'dark' ? '#1e1e1e' : '#fff', fontSize: 12, color: colors.textMuted,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={bookTitle(activeTab)}>
              {bookTitle(activeTab)}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
              background: colors.borderLight, letterSpacing: '0.05em', textTransform: 'uppercase' as const,
            }}>
              {activeTab.book.format}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {activeTab.book.format === 'pdf' && activeTab.pdfTotalPages > 0 ? (
              <span>{t('reader.pdfPageStatus', { defaultValue: '第 {{current}}/{{total}} 页', current: activeTab.pdfPage || 1, total: activeTab.pdfTotalPages })}</span>
            ) : activeTab.book.format === 'epub' && displayProgress > 0 ? (
              <span>{displayProgress}%</span>
            ) : (
              <>
                {displayWordCount > 0 && (
                  <span>{t('reader.wordCount', { defaultValue: '{{count}} 字', count: displayWordCount })}</span>
                )}
                {displayProgress > 0 && (
                  <span>{displayProgress}%</span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ children, onClick, disabled, active, title }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', borderRadius: 4, cursor: disabled ? 'default' : 'pointer',
        background: active ? '#eff6ff' : 'transparent',
        color: active ? '#2563eb' : disabled ? '#cbd5e1' : colors.textMuted,
      }}
    >
      {children}
    </button>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  height: 18, minWidth: 20, padding: '0 4px', borderRadius: 3,
  fontSize: 9, fontFamily: 'monospace', fontWeight: 500,
  background: colors.bgAlt, border: `1px solid ${colors.borderMain}`,
  color: colors.textMuted,
};
