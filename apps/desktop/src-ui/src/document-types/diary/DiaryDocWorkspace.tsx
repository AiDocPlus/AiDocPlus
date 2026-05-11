/**
 * DiaryDocWorkspace — 专业日记创作工作台
 *
 * 三栏布局：左栏（日历+条目列表）| 中栏（工具栏+编辑器+状态栏）| 右栏（AI助手占位）
 * 数据源：单文档 JSON（DiaryDocumentContent）
 */
import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { BookHeart, Sparkles, List, AlignJustify, Trash2, Search } from 'lucide-react';
import DiaryCalendar from './DiaryCalendar';
import DiaryEntryList from './DiaryEntryList';
import DiaryFilterPanel from './DiaryFilterPanel';
import DiaryTimelineView from './DiaryTimelineView';
import DiaryToolbar from './DiaryToolbar';
import DiaryEditor from './DiaryEditor';
import DiaryContextMenu from './DiaryContextMenu';
import DiaryStatusBar from './DiaryStatusBar';
// 懒加载重型弹窗/侧栏组件
const DiarySettingsDialog = lazy(() => import('./DiarySettingsDialog'));
const DiaryAISidebar = lazy(() => import('./DiaryAISidebar'));
const DiaryDashboard = lazy(() => import('./DiaryDashboard'));
const DiaryExportDialog = lazy(() => import('./DiaryExportDialog'));
const DiaryOnThisDay = lazy(() => import('./DiaryOnThisDay'));
const DiaryImportDialog = lazy(() => import('./DiaryImportDialog'));
const DiaryTemplateDialog = lazy(() => import('./DiaryTemplateDialog'));
const DiaryDailyPrompt = lazy(() => import('./DiaryDailyPrompt'));
const DiaryTrashPanel = lazy(() => import('./DiaryTrashPanel'));
const DiarySearchDialog = lazy(() => import('./DiarySearchDialog'));
import NovelEditorSettings, { loadAppearance, getAppearanceStyle, getEditorInnerStyle, type EditorAppearance } from '../novel/NovelEditorSettings';
import {
  parseDiaryContent, createEmptyDiaryContent, createEntry,
  updateEntryContent, updateEntryMeta, toggleEntryStarred, softDeleteEntry, duplicateEntry, moveEntryToJournal,
  collectAllTags, addSnapshot, updateDiaryMetadata,
  getEntryById, getEntriesOnThisDay,
  getPrevEntryDate, getNextEntryDate, getTodayDateStr,
  getTotalWordCount, getTodayWordCount, calculateStreak,
  getEntryWordCount, applyFilter, EMPTY_FILTER,
  MOOD_EMOJI,
  type DiaryDocumentContent, type DiaryEntry, type DiaryMood, type DiaryWeatherType, type DiaryFilterState,
} from './types';
import { getTemplateById } from './diaryTemplates';
import { createDemoDiaryContent } from './diaryDemoData';
import { DEFAULT_LEFT_WIDTH, DEFAULT_RIGHT_WIDTH, CONTENT_SAVE_DEBOUNCE_MS, META_SAVE_DEBOUNCE_MS, SAVE_STATUS_DISPLAY_MS } from './constants';

class DiaryWorkspaceErrorBoundary extends Component<
  { children: ReactNode; docId: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; docId: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[DiaryDocWorkspace]', error, info.componentStack);
  }

  override componentDidUpdate(prevProps: { docId: string }): void {
    if (prevProps.docId !== this.props.docId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground bg-card"
          data-diary-error-boundary="true"
        >
          <p className="text-sm max-w-md">
            日记工作区出现异常。可尝试重试；若仍失败请切换文档后重新打开。
          </p>
          <button
            type="button"
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
            onClick={() => this.setState({ hasError: false })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DiaryDocWorkspace(props: DocTypeEditorProps) {
  return (
    <DiaryWorkspaceErrorBoundary docId={props.document.id}>
      <DiaryDocWorkspaceMain {...props} />
    </DiaryWorkspaceErrorBoundary>
  );
}

function DiaryDocWorkspaceMain({ document: doc, host, tabId }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const { closeTab, closeAllTabs } = useAppStore(useShallow(s => ({
    closeTab: s.closeTab, closeAllTabs: s.closeAllTabs,
  })));

  // ── 按文档隔离的 storage key 前缀 ──
  const dk = useMemo(() => `diary_${doc.id}_`, [doc.id]);

  // ── 布局状态 ──
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false); // AI 默认展开
  const [focusMode, setFocusMode] = useState(false);
  const [editorAppearance, setEditorAppearance] = useState<EditorAppearance>(() => loadAppearance(host.storage));

  // ── 保存状态 ──
  type SaveStatus = 'saved' | 'saving' | 'unsaved';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── 撤销/重做历史 ──
  const MAX_UNDO_HISTORY = 50;
  const [undoPast, setUndoPast] = useState<DiaryDocumentContent[]>([]);
  const [undoFuture, setUndoFuture] = useState<DiaryDocumentContent[]>([]);
  const undoPastRef = useRef(undoPast);
  undoPastRef.current = undoPast;
  const undoFutureRef = useRef(undoFuture);
  undoFutureRef.current = undoFuture;

  // ── 日历状态 ──
  const [calendarDate, setCalendarDate] = useState(new Date());

  // ── 条目状态 ──
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const activeEntryIdRef = useRef(activeEntryId);
  activeEntryIdRef.current = activeEntryId;
  const [entryContent, setEntryContent] = useState('');
  const entryContentRef = useRef(entryContent);
  entryContentRef.current = entryContent;

  // ── 高级筛选状态 ──
  const [advancedFilter, setAdvancedFilter] = useState<DiaryFilterState>({ ...EMPTY_FILTER });

  // ── 左栏视图模式（持久化） ──
  type LeftViewMode = 'list' | 'timeline';
  const [leftViewMode, setLeftViewModeRaw] = useState<LeftViewMode>(() => {
    const saved = host.storage.get<string>(`${dk}_left_view_mode`);
    return (saved === 'timeline') ? 'timeline' : 'list';
  });
  const setLeftViewMode = useCallback((mode: LeftViewMode) => {
    setLeftViewModeRaw(mode);
    host.storage.set(`${dk}_left_view_mode`, mode);
  }, [host.storage]);

  // ── 右键菜单状态 ──
  const [ctxEntry, setCtxEntry] = useState<DiaryEntry | null>(null);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });

  // ── 弹窗状态 ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ── 解析日记内容 ──
  const getDiary = useCallback((): DiaryDocumentContent => {
    const d = host.doc.getDocument();
    return parseDiaryContent(d.content || '') || createEmptyDiaryContent();
  }, [host.doc]);

  // ── 初始化日记数据 ──
  useEffect(() => {
    // 切换文档时清理旧文档的 timer 和状态
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (saveStatusTimerRef.current) { clearTimeout(saveStatusTimerRef.current); saveStatusTimerRef.current = null; }
    dirtyMarkedRef.current = false;
    const d = getDiary();
    setDiary(d);
    // 恢复上次编辑的条目
    const lastEntryId = host.storage.get<string>(`${dk}_last_entry_id`);
    const lastDate = host.storage.get<string>(`${dk}_last_date`);
    if (lastEntryId && d.entries.find(e => e.id === lastEntryId && !e.deletedAt)) {
      const entry = d.entries.find(e => e.id === lastEntryId && !e.deletedAt)!;
      setActiveEntryId(lastEntryId);
      setEntryContent(entry.content);
      setSelectedDate(entry.date);
      const [y, m] = entry.date.split('-').map(Number);
      setCalendarDate(new Date(y, m - 1, 1));
    } else if (lastDate) {
      setSelectedDate(lastDate);
      const entries = d.entries.filter(e => e.date === lastDate && !e.deletedAt).sort((a, b) => a.createdAt - b.createdAt);
      if (entries.length > 0) {
        setActiveEntryId(entries[0].id);
        setEntryContent(entries[0].content);
      } else {
        setActiveEntryId(null);
        setEntryContent('');
      }
      const [y, m] = lastDate.split('-').map(Number);
      setCalendarDate(new Date(y, m - 1, 1));
    } else {
      setActiveEntryId(null);
      setEntryContent('');
      setSelectedDate(getTodayDateStr());
      setCalendarDate(new Date());
    }
  }, [doc.id, getDiary, host.doc, host.storage]);

  const [diary, setDiary] = useState<DiaryDocumentContent>(() => createEmptyDiaryContent());
  const diaryRef = useRef(diary);
  diaryRef.current = diary;
  const filteredEntries = useMemo(() => applyFilter(diary, advancedFilter), [diary, advancedFilter]);

  // ── 统一保存 debounce ──
  // 所有变更（内容编辑 + 元数据修改）共用同一个 timer，避免并发保存
  // 注意：后调用的 delay 会覆盖先前的 timer，所以元数据(2s)比内容(5s)更早保存
  const scheduleSave = useCallback((delayMs: number) => {
    setSaveStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      host.doc.save().then(() => {
        dirtyMarkedRef.current = false;
      }).catch(() => {
        setSaveStatus('unsaved');
      });
      saveTimerRef.current = null;
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('saved'), SAVE_STATUS_DISPLAY_MS);
    }, delayMs);
  }, [host.doc]);

  const saveDiary = useCallback((updated: DiaryDocumentContent) => {
    updated = updateDiaryMetadata(updated);
    setDiary(updated);
    diaryRef.current = updated;
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    scheduleSave(META_SAVE_DEBOUNCE_MS);
  }, [host.doc, scheduleSave]);

  // ── 撤销/重做回调 ──
  const pushUndoHistory = useCallback(() => {
    setUndoPast(prev => [...prev, diaryRef.current].slice(-MAX_UNDO_HISTORY));
    setUndoFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    const p = undoPastRef.current;
    if (p.length === 0) return;
    const prev = p[p.length - 1];
    setUndoPast(pp => pp.slice(0, -1));
    setUndoFuture(f => [diaryRef.current, ...f].slice(0, MAX_UNDO_HISTORY));
    setDiary(prev);
    diaryRef.current = prev;
    host.doc.updateInMemory({ content: JSON.stringify(prev) });
    host.doc.markDirty();
    scheduleSave(META_SAVE_DEBOUNCE_MS);
    const currentId = activeEntryIdRef.current;
    if (currentId) {
      const entry = prev.entries.find(e => e.id === currentId);
      if (entry) setEntryContent(entry.content);
      else { setActiveEntryId(null); setEntryContent(''); }
    }
  }, [host.doc, scheduleSave]);

  const handleRedo = useCallback(() => {
    const f = undoFutureRef.current;
    if (f.length === 0) return;
    const next = f[0];
    setUndoFuture(ff => ff.slice(1));
    setUndoPast(p => [...p, diaryRef.current].slice(-MAX_UNDO_HISTORY));
    setDiary(next);
    diaryRef.current = next;
    host.doc.updateInMemory({ content: JSON.stringify(next) });
    host.doc.markDirty();
    scheduleSave(META_SAVE_DEBOUNCE_MS);
    const currentId = activeEntryIdRef.current;
    if (currentId) {
      const entry = next.entries.find(e => e.id === currentId);
      if (entry) setEntryContent(entry.content);
      else { setActiveEntryId(null); setEntryContent(''); }
    }
  }, [host.doc, scheduleSave]);

  // ── 组件卸载时清理所有 timer ──
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  const handleSave = useCallback(() => {
    // 使用 ref 获取最新内容，避免闭包过期
    const currentContent = entryContentRef.current;
    const currentEntryId = activeEntryIdRef.current;
    let needSync = false;
    if (currentEntryId) {
      const entry = diaryRef.current.entries.find(e => e.id === currentEntryId);
      if (entry && entry.content !== currentContent) {
        let updated = updateEntryContent(diaryRef.current, currentEntryId, currentContent);
        updated = updateDiaryMetadata(updated);
        setDiary(updated);
        diaryRef.current = updated;
        host.doc.updateInMemory({ content: JSON.stringify(updated) });
        needSync = true;
      }
    }
    // 若无变化且文档未脏，跳过磁盘写入
    if (!needSync && !dirtyMarkedRef.current) {
      setSaveStatus('saved');
      return;
    }
    setIsSaving(true);
    setSaveStatus('saving');
    host.doc.save().then(() => {
      setIsSaving(false);
      setSaveStatus('saved');
      dirtyMarkedRef.current = false;
    }).catch(() => {
      setIsSaving(false);
      setSaveStatus('unsaved');
    });
  }, [host.doc]);

  const handleSaveAll = useCallback(() => {
    handleSave();
  }, [handleSave]);

  // ── 选中条目 ──
  const selectEntry = useCallback((entryId: string) => {
    if (!entryId) return;

    // 取消待处理的保存
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // 使用 ref 获取最新值，避免闭包过期
    const currentActiveId = activeEntryIdRef.current;
    const currentContent = entryContentRef.current;
    if (currentActiveId && currentContent !== undefined) {
      const currentEntry = diaryRef.current.entries.find(e => e.id === currentActiveId);
      if (currentEntry && currentEntry.content !== currentContent) {
        const updated = updateEntryContent(diaryRef.current, currentActiveId, currentContent);
        saveDiary(updated);
      }
    }

    const entry = diaryRef.current.entries.find(e => e.id === entryId);
    if (!entry) return;

    setActiveEntryId(entryId);
    setEntryContent(entry.content || '');
    setSelectedDate(entry.date);
    host.storage.set(`${dk}_last_entry_id`, entryId);
    host.storage.set(`${dk}_last_date`, entry.date);

    const [y, m] = entry.date.split('-').map(Number);
    if (calendarDate.getFullYear() !== y || calendarDate.getMonth() + 1 !== m) {
      setCalendarDate(new Date(y, m - 1, 1));
    }
  }, [saveDiary, calendarDate, host.storage]);

  // ── 日期选择 ──
  const selectDate = useCallback((dateStr: string) => {
    if (!dateStr) return;

    // 取消待处理的保存
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // 使用 ref 获取最新值
    const currentActiveId = activeEntryIdRef.current;
    const currentContent = entryContentRef.current;
    if (currentActiveId && currentContent !== undefined) {
      const currentEntry = diaryRef.current.entries.find(e => e.id === currentActiveId);
      if (currentEntry && currentEntry.content !== currentContent) {
        const updated = updateEntryContent(diaryRef.current, currentActiveId, currentContent);
        saveDiary(updated);
      }
    }

    setSelectedDate(dateStr);
    host.storage.set(`${dk}_last_date`, dateStr);
    const [y, m] = dateStr.split('-').map(Number);
    setCalendarDate(new Date(y, m - 1, 1));
    const entries = diaryRef.current.entries.filter(e => e.date === dateStr && !e.deletedAt).sort((a, b) => a.createdAt - b.createdAt);
    if (entries.length > 0) {
      setActiveEntryId(entries[0].id);
      setEntryContent(entries[0].content || '');
      host.storage.set(`${dk}_last_entry_id`, entries[0].id);
    } else {
      setActiveEntryId(null);
      setEntryContent('');
    }
  }, [saveDiary, host.storage]);

  // ── 新建条目 ──
  const handleNewEntry = useCallback(() => {
    pushUndoHistory();
    // 使用 ref 获取最新值
    const currentId = activeEntryIdRef.current;
    const currentContent = entryContentRef.current;
    if (currentId) {
      const updated = updateEntryContent(diaryRef.current, currentId, currentContent);
      saveDiary(updated);
    }
    const journalId = diaryRef.current.settings.defaultJournalId;
    const dateStr = selectedDateRef.current;
    const updated = createEntry(diaryRef.current, journalId, dateStr);
    const newEntry = updated.entries[updated.entries.length - 1];
    saveDiary(updated);
    setActiveEntryId(newEntry.id);
    setEntryContent(newEntry.content);
  }, [saveDiary, pushUndoHistory]);

  // ── 写作计时器 ──
  // 追踪用户在当前条目上的写作时间，停止输入后暂停
  const writingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const writingSecondsRef = useRef(0);
  const [writingTime, setWritingTime] = useState(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_TIMEOUT = 30_000; // 30秒无输入暂停计时

  // 切换条目或日期时重置计时器，先同步最后计时值再清零
  useEffect(() => {
    if (writingTimerRef.current) { clearInterval(writingTimerRef.current); writingTimerRef.current = null; }
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    writingSecondsRef.current = 0;
    setWritingTime(0);
  }, [activeEntryId]);

  const startWritingTimer = useCallback(() => {
    if (writingTimerRef.current) return; // 已在运行
    writingTimerRef.current = setInterval(() => {
      writingSecondsRef.current++;
      setWritingTime(writingSecondsRef.current); // 每秒更新 UI
    }, 1000);
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (writingTimerRef.current) clearInterval(writingTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);


  // ── 内容变化（用 diaryRef 避免 diary 引用变化导致回调重建 → 子组件 effect 循环） ──
  const dirtyMarkedRef = useRef(false);
  const handleContentChange = useCallback((content: string) => {
    const currentEntry = activeEntryId ? diaryRef.current.entries.find(e => e.id === activeEntryId) : null;
    if (currentEntry && currentEntry.content === content) return;
    setEntryContent(content);
    setSaveStatus('unsaved');
    // 启动写作计时器
    startWritingTimer();
    // 重置空闲暂停
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (writingTimerRef.current) { clearInterval(writingTimerRef.current); writingTimerRef.current = null; }
      if (writingSecondsRef.current > 0) setWritingTime(writingSecondsRef.current);
    }, IDLE_TIMEOUT);
    // 首次变化时立即 markDirty 以显示 Tab 红点（不调用 updateInMemory 避免全局重渲染）
    if (!dirtyMarkedRef.current) {
      host.doc.markDirty();
      dirtyMarkedRef.current = true;
    }
    if (activeEntryId) {
      let updated = updateEntryContent(diaryRef.current, activeEntryId, content);
      updated = addSnapshot(updated, activeEntryId);
      setDiary(updated);
      diaryRef.current = updated;
      // 同步内存数据（供上层组件和自动保存使用）
      host.doc.updateInMemory({ content: JSON.stringify(updated) });
    }
  }, [activeEntryId, host.doc]);

  // ── 自动保存（延迟保存到磁盘） ──
  useEffect(() => {
    if (!activeEntryId) return;
    scheduleSave(CONTENT_SAVE_DEBOUNCE_MS);
    // 注意：不设 cleanup，scheduleSave 内部已自行管理 timer
  }, [entryContent, activeEntryId, scheduleSave]);

  // ── 导航 ──
  const handlePrevDay = useCallback(() => {
    const prev = getPrevEntryDate(diaryRef.current, selectedDate);
    if (prev) selectDate(prev);
  }, [selectedDate, selectDate]);

  const handleNextDay = useCallback(() => {
    const next = getNextEntryDate(diaryRef.current, selectedDate);
    if (next) selectDate(next);
  }, [selectedDate, selectDate]);

  const handleToday = useCallback(() => {
    const today = getTodayDateStr();
    setCalendarDate(new Date());
    selectDate(today);
  }, [selectDate]);

  // ── 元数据操作 ──
  const activeEntry = useMemo(
    () => activeEntryId ? getEntryById(diary, activeEntryId) || null : null,
    [diary, activeEntryId],
  );

  const handleMoodChange = useCallback((mood: DiaryMood | undefined) => {
    if (!activeEntryId) return;
    saveDiary(updateEntryMeta(diaryRef.current, activeEntryId, { mood }));
  }, [activeEntryId, saveDiary]);

  const handleWeatherChange = useCallback((type: DiaryWeatherType) => {
    if (!activeEntryId) return;
    const entry = getEntryById(diaryRef.current, activeEntryId);
    if (!entry) return;
    saveDiary(updateEntryMeta(diaryRef.current, activeEntryId, {
      weather: { type, temperature: entry.weather?.temperature },
    }));
  }, [activeEntryId, saveDiary]);

  const handleTemperatureChange = useCallback((temp: number | undefined) => {
    if (!activeEntryId) return;
    const entry = getEntryById(diaryRef.current, activeEntryId);
    if (!entry?.weather) return;
    saveDiary(updateEntryMeta(diaryRef.current, activeEntryId, {
      weather: { ...entry.weather, temperature: temp },
    }));
  }, [activeEntryId, saveDiary]);

  const handleTagToggle = useCallback((tag: string) => {
    if (!activeEntryId) return;
    const entry = getEntryById(diaryRef.current, activeEntryId);
    if (!entry) return;
    const tags = entry.tags.includes(tag)
      ? entry.tags.filter(x => x !== tag)
      : [...entry.tags, tag];
    saveDiary(updateEntryMeta(diaryRef.current, activeEntryId, { tags }));
  }, [activeEntryId, saveDiary]);

  const handleTemplateApply = useCallback((templateId: string) => {
    if (!activeEntryId) return;
    const template = getTemplateById(templateId, diaryRef.current.metadata.customTemplates);
    if (template && template.content) {
      const currentContent = getEntryById(diaryRef.current, activeEntryId)?.content || '';
      const newContent = currentContent ? currentContent + '\n\n' + template.content : template.content;
      setEntryContent(newContent);
      saveDiary(updateEntryContent(diaryRef.current, activeEntryId, newContent));
    }
  }, [activeEntryId, saveDiary]);

  const handleToggleStarred = useCallback(() => {
    if (!activeEntryId) return;
    saveDiary(toggleEntryStarred(diaryRef.current, activeEntryId));
  }, [activeEntryId, saveDiary]);

  const handleColorLabelChange = useCallback((colorLabel: string | undefined) => {
    if (!activeEntryId) return;
    saveDiary(updateEntryMeta(diaryRef.current, activeEntryId, { colorLabel }));
  }, [activeEntryId, saveDiary]);

  const handleSearchReplace = useCallback((entryId: string, search: string, replace: string, useRegex: boolean) => {
    const entry = diaryRef.current.entries.find(e => e.id === entryId);
    if (!entry) return;
    try {
      const re = useRegex ? new RegExp(search, 'g') : new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const escapedReplace = useRegex ? replace : replace.replace(/\$/g, '$$$$');
      const newContent = entry.content.replace(re, escapedReplace);
      if (newContent !== entry.content) {
        const updated = updateEntryContent(diaryRef.current, entryId, newContent);
        saveDiary(updated);
        // 如果替换的是当前活动条目，更新编辑器内容
        if (entryId === activeEntryIdRef.current) setEntryContent(newContent);
      }
    } catch {
      // 正则语法错误，静默忽略
    }
  }, [saveDiary]);

  const handleMoveToJournal = useCallback((journalId: string) => {
    if (!activeEntryId) return;
    pushUndoHistory();
    saveDiary(moveEntryToJournal(diaryRef.current, activeEntryId, journalId));
  }, [activeEntryId, saveDiary, pushUndoHistory]);

  // ── Phase 2: 右键菜单回调 ──
  const handleCtxToggleStarred = useCallback((entryId: string) => {
    saveDiary(toggleEntryStarred(diaryRef.current, entryId));
  }, [saveDiary]);

  const handleCtxDuplicate = useCallback((entryId: string) => {
    pushUndoHistory();
    saveDiary(duplicateEntry(diaryRef.current, entryId));
  }, [saveDiary, pushUndoHistory]);

  const handleCtxDelete = useCallback((entryId: string) => {
    pushUndoHistory();
    const updated = softDeleteEntry(diaryRef.current, entryId);
    saveDiary(updated);
    if (activeEntryIdRef.current === entryId) {
      setActiveEntryId(null);
      setEntryContent('');
    }
  }, [saveDiary, pushUndoHistory]);

  const handleCtxMoveToJournal = useCallback((entryId: string, journalId: string) => {
    pushUndoHistory();
    saveDiary(moveEntryToJournal(diaryRef.current, entryId, journalId));
  }, [saveDiary, pushUndoHistory]);

  const handleCtxSetMood = useCallback((entryId: string, mood: DiaryMood | undefined) => {
    saveDiary(updateEntryMeta(diaryRef.current, entryId, { mood }));
  }, [saveDiary]);

  const handleCtxSetWeather = useCallback((entryId: string, weather: DiaryWeatherType) => {
    const entry = getEntryById(diaryRef.current, entryId);
    saveDiary(updateEntryMeta(diaryRef.current, entryId, {
      weather: { type: weather, temperature: entry?.weather?.temperature },
    }));
  }, [saveDiary]);

  const handleEntryContextMenu = useCallback((e: React.MouseEvent, entry: import('./types').DiaryEntry) => {
    e.preventDefault();
    setCtxEntry(entry);
    setCtxPos({ x: e.clientX, y: e.clientY });
  }, []);

  const allTags = useMemo(() => collectAllTags(diary), [diary]);

  const handleFocus = useCallback(() => {
    setFocusMode(prev => {
      if (prev) {
        setLeftCollapsed(false);
        setRightCollapsed(false);
      } else {
        setLeftCollapsed(true);
        setRightCollapsed(true);
      }
      return !prev;
    });
  }, []);


  // ── 键盘快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      // Escape: 退出专注模式
      if (e.key === 'Escape') {
        if (focusMode) {
          e.preventDefault();
          setFocusMode(false);
          setLeftCollapsed(false);
          setRightCollapsed(false);
          return;
        }
        if (searchOpen) {
          e.preventDefault();
          setSearchOpen(false);
          return;
        }
      }
      if (!meta) return;
      // ⌘F: 打开搜索
      if ((e.key === 'f' || e.key === 'F') && !e.shiftKey) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      // ⌘Z / ⌘⇧Z: 撤销/重做（全局拦截，不分输入框）
      if ((e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
      }
      // 在输入框中时仅拦截保存（⌘S）
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (isEditing && e.key !== 's' && e.key !== 'S') return;
      switch (e.key) {
        case 'n': case 'N':
          if (!e.shiftKey && !isEditing) { e.preventDefault(); handleNewEntry(); }
          break;
        case 's': case 'S':
          e.preventDefault();
          if (e.shiftKey) handleSaveAll(); else handleSave();
          break;
        case '[': if (!isEditing) { e.preventDefault(); handlePrevDay(); } break;
        case ']': if (!isEditing) { e.preventDefault(); handleNextDay(); } break;
        case 't': case 'T':
          if (!e.shiftKey && !isEditing) { e.preventDefault(); handleToday(); }
          break;
        case 'b': case 'B':
          if (!e.shiftKey) { /* 让编辑器处理 ⌘B 粗体 */ }
          break;
        case 'e': case 'E':
          if (!e.shiftKey && !isEditing) { e.preventDefault(); handleFocus(); }
          break;
        case 'j': case 'J':
          if (!e.shiftKey) { /* 让编辑器处理 */ }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode, searchOpen, handleNewEntry, handleSave, handleSaveAll, handlePrevDay, handleNextDay, handleToday, handleFocus, handleUndo, handleRedo]);

  // ── 统计数据 ──
  const activeEntryCount = useMemo(() => diary.entries.filter(e => !e.deletedAt).length, [diary.entries]);
  const totalWords = useMemo(() => getTotalWordCount(diary), [diary]);
  const todayWords = useMemo(() => getTodayWordCount(diary), [diary]);
  const streak = useMemo(() => calculateStreak(diary), [diary]);
  // 跨午夜自动刷新：每分钟检查日期是否变化
  const [today, setToday] = useState(getTodayDateStr());
  useEffect(() => {
    const timer = setInterval(() => {
      const now = getTodayDateStr();
      if (now !== today) setToday(now);
    }, 60_000);
    return () => clearInterval(timer);
  }, [today]);
  const onThisDay = useMemo(() => getEntriesOnThisDay(diary, today), [diary, today]);
  const chapterWords = useMemo(() => activeEntry ? getEntryWordCount(activeEntry) : 0, [activeEntry]);
  const paragraphCount = useMemo(() => activeEntry ? (entryContent.split(/\n\s*\n/).filter(p => p.trim()).length) : 0, [activeEntry, entryContent]);
  const readingTimeMin = useMemo(() => Math.max(1, Math.round(chapterWords / 300)), [chapterWords]);
  const dailyWordGoal = diary.metadata.dailyWordGoal || 0;
  const recentEntries = useMemo(
    () => [...diary.entries].filter(e => !e.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5),
    [diary.entries],
  );

  return (
    <Suspense fallback={null}>
    <div className="flex h-full w-full overflow-hidden" style={{ fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' }}>
      {/* ═══ 左栏：日历+条目列表 ═══ */}
      {!leftCollapsed && (
        <>
          <div className="flex-shrink-0 h-full overflow-hidden border-r bg-card flex flex-col" style={{ width: leftWidth }}>
            {/* 日历 */}
            <DiaryCalendar
              diary={diary}
              currentDate={calendarDate}
              selectedDate={selectedDate}
              onMonthChange={setCalendarDate}
              onDateSelect={selectDate}
              onDateDoubleClick={(dateStr) => {
                // 检查当日是否已有条目，避免重复创建
                const existing = diaryRef.current.entries.filter(e => e.date === dateStr && !e.deletedAt);
                if (existing.length > 0) {
                  selectDate(dateStr);
                  return;
                }
                selectDate(dateStr);
                // 在该日期创建新条目
                const journalId = diaryRef.current.settings.defaultJournalId;
                const updated = createEntry(diaryRef.current, journalId, dateStr);
                const newEntry = updated.entries[updated.entries.length - 1];
                saveDiary(updated);
                setActiveEntryId(newEntry.id);
                setEntryContent(newEntry.content);
              }}
              weekStartsOn={diary.settings.weekStartsOn}
            />

            {/* 高级筛选面板 */}
            <DiaryFilterPanel
              diary={diary}
              filter={advancedFilter}
              onFilterChange={setAdvancedFilter}
              resultCount={filteredEntries.length}
            />

            {/* 视图切换 */}
            <div className="flex items-center gap-1 px-2 py-0.5 border-b flex-shrink-0">
              <button
                className={cn('h-5 w-5 rounded flex items-center justify-center transition-colors',
                  leftViewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
                onClick={() => setLeftViewMode('list')}
                title={t('diary.listView', { defaultValue: '列表视图' })}>
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                className={cn('h-5 w-5 rounded flex items-center justify-center transition-colors',
                  leftViewMode === 'timeline' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
                onClick={() => setLeftViewMode('timeline')}
                title={t('diary.timelineView', { defaultValue: '时间线视图' })}>
                <AlignJustify className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] text-muted-foreground ml-1">
                {filteredEntries.length}{t('diary.entryCountUnit', { defaultValue: '条' })}
              </span>
            </div>

            {/* 条目列表 / 时间线视图 */}
            {leftViewMode === 'list' ? (
              <DiaryEntryList
                entries={filteredEntries}
                selectedEntryId={activeEntryId}
                highlightKeyword={advancedFilter.keyword}
                onSelectEntry={selectEntry}
                onContextMenu={handleEntryContextMenu}
              />
            ) : (
              <DiaryTimelineView
                entries={filteredEntries}
                selectedEntryId={activeEntryId}
                highlightKeyword={advancedFilter.keyword}
                onSelectEntry={selectEntry}
              />
            )}

            {/* 底部统计 */}
            <div className="px-2 py-1 border-t text-[10px] text-muted-foreground space-y-0.5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span>{activeEntryCount}{t('diary.entryCountUnit', { defaultValue: '条' })} · {totalWords > 9999 ? `${(totalWords / 10000).toFixed(1)}${t('diary.tenThousandUnit', { defaultValue: '万' })}` : totalWords}{t('diary.charUnit', { defaultValue: '字' })}</span>
                <span className="text-green-600 dark:text-green-400">{t('diary.todayWords', { defaultValue: '今日+{{count}}', count: todayWords })}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🔥 {t('diary.streak', { defaultValue: '连续{{count}}天', count: streak.current })}</span>
                {streak.longest > streak.current && (
                  <span className="text-muted-foreground/60">({t('diary.longestStreak', { defaultValue: '最长{{count}}天', count: streak.longest })})</span>
                )}
                <div className="flex-1" />
                <button className="flex items-center gap-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
                  onClick={() => setSearchOpen(true)}
                  title={t('diary.searchAndReplace', { defaultValue: '搜索替换 (⌘F)' })}>
                  <Search className="h-3 w-3" />
                </button>
                <button className="flex items-center gap-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
                  onClick={() => setTrashOpen(true)}
                  title={t('diary.trash', { defaultValue: '回收站' })}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          <ResizableHandle direction="horizontal" onResize={(d) => setLeftWidth(w => Math.min(350, Math.max(180, w + d)))} />
        </>
      )}

      {/* ═══ 中栏：工具栏+编辑器+状态栏 ═══ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* 工具栏 */}
        {!focusMode && (
          <DiaryToolbar
            diary={diary}
            activeEntry={activeEntry}
            selectedDate={selectedDate}
            leftCollapsed={leftCollapsed}
            rightCollapsed={rightCollapsed}
            focusMode={focusMode}
            isSaving={isSaving}
            onToggleLeft={() => setLeftCollapsed(!leftCollapsed)}
            onToggleRight={() => setRightCollapsed(!rightCollapsed)}
            onToggleFocus={handleFocus}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onToday={handleToday}
            onNewEntry={handleNewEntry}
            onCloseTab={() => tabId && closeTab(tabId, false)}
            onCloseAllTabs={() => closeAllTabs()}
            onSave={handleSave}
            onSaveAll={handleSaveAll}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoPast.length > 0}
            canRedo={undoFuture.length > 0}
            onOpenDashboard={() => setDashboardOpen(true)}
            onOpenExport={() => setExportOpen(true)}
            onOpenImport={() => setImportOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onMoodChange={handleMoodChange}
            onWeatherChange={handleWeatherChange}
            onTemperatureChange={handleTemperatureChange}
            onTagToggle={handleTagToggle}
            onTemplateApply={handleTemplateApply}
            onToggleStarred={handleToggleStarred}
            onJournalChange={handleMoveToJournal}
            onColorLabelChange={handleColorLabelChange}
            allTags={allTags}
            editorAppearanceSlot={
              <NovelEditorSettings storage={host.storage} appearance={editorAppearance} onAppearanceChange={setEditorAppearance} />
            }
          />
        )}

        {/* 编辑区 / 欢迎页 */}
        {activeEntry ? (
          <>
            <div className="flex-1 min-h-0 overflow-hidden" style={getAppearanceStyle(editorAppearance)}>
              <div style={getEditorInnerStyle(editorAppearance)}>
                <DiaryEditor
                  entryId={activeEntry.id}
                  content={entryContent}
                  onChange={handleContentChange}
                  textIndent={editorAppearance.textIndent}
                  key={activeEntry.id}
                />
              </div>
            </div>
            {/* 状态栏 */}
            <DiaryStatusBar
              entry={activeEntry}
              todayWordCount={todayWords}
              dailyGoal={dailyWordGoal}
              streak={streak.current}
              chapterWords={chapterWords}
              paragraphCount={paragraphCount}
              readingTimeMin={readingTimeMin}
              writingTime={writingTime}
              focusMode={focusMode}
              saveStatus={saveStatus}
            />
          </>
        ) : (
          /* ═══ 欢迎页 ═══ */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md">
              <BookHeart className="h-12 w-12 mx-auto text-muted-foreground/20" />
              <div className="text-muted-foreground">
                <p className="text-base font-medium mb-1">{t('diary.welcomeTitle', { defaultValue: '日记工作台' })}</p>
                <p className="text-sm">{t('diary.welcomeSubtitle', { defaultValue: '在左侧选择日期或点击下方开始今天的日记' })}</p>
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="default" size="sm" className="gap-1" onClick={handleNewEntry}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('diary.startToday', { defaultValue: '开始今天的日记' })}
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setTemplateDialogOpen(true)}>
                  {t('diary.useTemplate', { defaultValue: '使用模板' })}
                </Button>
              </div>
              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border bg-card p-2">
                  <div className="text-lg font-bold text-foreground">{activeEntryCount}</div>
                  <div className="text-[10px] text-muted-foreground">{t('diary.totalEntries', { defaultValue: '条目总数' })}</div>
                </div>
                <div className="rounded-lg border bg-card p-2">
                  <div className="text-lg font-bold text-foreground">{totalWords > 9999 ? `${(totalWords / 10000).toFixed(1)}${t('diary.tenThousandUnit', { defaultValue: '万' })}` : totalWords}</div>
                  <div className="text-[10px] text-muted-foreground">{t('diary.totalWords', { defaultValue: '总字数' })}</div>
                </div>
                <div className="rounded-lg border bg-card p-2">
                  <div className="text-lg font-bold text-foreground">🔥 {streak.current}</div>
                  <div className="text-[10px] text-muted-foreground">{t('diary.streakDays', { defaultValue: '连续天数' })}</div>
                </div>
              </div>
              {/* 历史上的今天 */}
              {onThisDay.length > 0 && (
                <div className="text-left space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">📅 {t('diary.onThisDay', { defaultValue: '历史上的今天' })}</p>
                  {onThisDay.slice(0, 3).map(entry => (
                    <button key={entry.id}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded-md border hover:bg-accent transition-colors"
                      onClick={() => selectEntry(entry.id)}>
                      <span className="text-muted-foreground">{entry.date.slice(0, 4)}年</span>
                      {entry.mood && <span className="ml-1">{MOOD_EMOJI[entry.mood]}</span>}
                      <span className="ml-1 truncate">{entry.title || entry.content.slice(0, 40).replace(/\n/g, ' ')}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* 每日写作提示 */}
              {diary.entries.length > 0 && (
                <DiaryDailyPrompt
                  host={host}
                  diary={diary}
                  onStartWithPrompt={(content) => {
                    const journalId = diary.settings.defaultJournalId;
                    const updated = createEntry(diary, journalId, selectedDate, content);
                    const newEntry = updated.entries[updated.entries.length - 1];
                    saveDiary(updated);
                    setActiveEntryId(newEntry.id);
                    setEntryContent(newEntry.content);
                  }}
                />
              )}
              {/* 加载示例日记 */}
              {diary.entries.length === 0 && (
                <button
                  className="text-xs px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                  onClick={() => { const demo = createDemoDiaryContent(); saveDiary(demo); }}>
                  📖 {t('diary.loadDemo', { defaultValue: '加载示例日记' })}
                </button>
              )}
              {diary.entries.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{t('diary.recentEntries', { defaultValue: '最近写作' })}</p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {recentEntries.map(entry => (
                      <button key={entry.id} onClick={() => selectEntry(entry.id)}
                        className="text-xs px-2.5 py-1 rounded-md border hover:bg-accent transition-colors">
                        {entry.mood && MOOD_EMOJI[entry.mood]} {entry.date.slice(5)} {entry.title || entry.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ═══ 右键菜单 ═══ */}
      <DiaryContextMenu
        entry={ctxEntry}
        journals={diary.journals}
        position={ctxPos}
        onClose={() => setCtxEntry(null)}
        onToggleStarred={handleCtxToggleStarred}
        onDuplicate={handleCtxDuplicate}
        onDelete={handleCtxDelete}
        onMoveToJournal={handleCtxMoveToJournal}
        onSetMood={handleCtxSetMood}
        onSetWeather={handleCtxSetWeather}
      />

      {/* ═══ 模板弹窗 ═══ */}
      <DiaryTemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        customTemplates={diary.metadata.customTemplates}
        onApply={(content, mode) => {
          if (!activeEntryId) {
            // 无活动条目时，用模板新建
            const journalId = diary.settings.defaultJournalId;
            const updated = createEntry(diary, journalId, selectedDate, content);
            const newEntry = updated.entries[updated.entries.length - 1];
            saveDiary(updated);
            setActiveEntryId(newEntry.id);
            setEntryContent(newEntry.content);
          } else {
            const newContent = mode === 'replace' ? content : (entryContent + '\n\n' + content);
            setEntryContent(newContent);
            saveDiary(updateEntryContent(diary, activeEntryId, newContent));
          }
        }}
      />

      {/* ═══ 仪表盘弹窗 ═══ */}
      <DiaryDashboard open={dashboardOpen} onOpenChange={setDashboardOpen} diary={diary} />

      {/* ═══ 导入弹窗 ═══ */}
      <DiaryImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        diary={diary}
        onDiaryChange={saveDiary}
      />

      {/* ═══ 导出弹窗 ═══ */}
      <DiaryExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        diary={diary}
        documentId={doc.id}
        projectId={doc.projectId}
      />

      {/* ═══ 搜索替换弹窗 ═══ */}
      <DiarySearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        diary={diary}
        onSelectEntry={(entryId) => { selectEntry(entryId); setSearchOpen(false); }}
        onReplaceInEntry={handleSearchReplace}
      />

      {/* ═══ 设置弹窗 ═══ */}
      <DiarySettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        diary={diary}
        onDiaryChange={saveDiary}
      />

      {/* ═══ 回收站弹窗 ═══ */}
      <DiaryTrashPanel
        open={trashOpen}
        onOpenChange={setTrashOpen}
        diary={diary}
        onDiaryChange={saveDiary}
        onSelectEntry={selectEntry}
      />

      {/* ═══ 右栏：AI 日记助手 ═══ */}
      {!rightCollapsed && (
        <>
          <ResizableHandle direction="horizontal" onResize={(d) => setRightWidth(w => Math.min(500, Math.max(220, w - d)))} />
          <div className="flex-shrink-0 h-full overflow-hidden border-l flex flex-col" style={{ width: rightWidth }}>
            <div className="flex-1 min-h-0 overflow-hidden">
              <DiaryAISidebar
                host={host}
                diary={diary}
                activeEntry={activeEntry}
                onInsertToDoc={(text) => {
                  if (activeEntryId) {
                    const currentContent = getEntryById(diaryRef.current, activeEntryId)?.content || '';
                    const newContent = currentContent + '\n\n' + text;
                    setEntryContent(newContent);
                    saveDiary(updateEntryContent(diaryRef.current, activeEntryId, newContent));
                  }
                }}
              />
            </div>
            <DiaryOnThisDay entries={onThisDay} onSelectEntry={selectEntry} />
          </div>
        </>
      )}
    </div>
    </Suspense>
  );
}
