/**
 * DiaryDocWorkspace — 专业日记创作工作台
 *
 * 三栏布局：左栏（日历+条目列表）| 中栏（工具栏+编辑器+状态栏）| 右栏（AI助手占位）
 * 数据源：单文档 JSON（DiaryDocumentContent）
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { BookHeart, Clock, Sparkles, List, AlignJustify, Trash2 } from 'lucide-react';
import DiaryCalendar from './DiaryCalendar';
import DiaryEntryList from './DiaryEntryList';
import DiaryFilterPanel from './DiaryFilterPanel';
import DiaryTimelineView from './DiaryTimelineView';
import DiaryToolbar from './DiaryToolbar';
import DiaryEditor from './DiaryEditor';
import DiaryEntryInfo, { type InfoTab } from './DiaryEntryInfo';
import DiaryContextMenu from './DiaryContextMenu';
import DiarySettingsDialog from './DiarySettingsDialog';
import DiaryAISidebar from './DiaryAISidebar';
import DiaryDashboard from './DiaryDashboard';
import DiaryExportDialog from './DiaryExportDialog';
import DiaryOnThisDay from './DiaryOnThisDay';
import DiaryImportDialog from './DiaryImportDialog';
import DiaryTemplateDialog from './DiaryTemplateDialog';
import DiaryDailyPrompt from './DiaryDailyPrompt';
import DiaryTrashPanel from './DiaryTrashPanel';
import DiaryStatusBar from './DiaryStatusBar';
import NovelEditorSettings, { loadAppearance, getAppearanceStyle, getEditorInnerStyle, type EditorAppearance } from '../novel/NovelEditorSettings';
import {
  parseDiaryContent, createEmptyDiaryContent, createEntry,
  updateEntryContent, updateEntryMeta, toggleEntryStarred, softDeleteEntry, duplicateEntry, moveEntryToJournal,
  addGlobalTag, collectAllTags, addSnapshot, restoreFromSnapshot,
  getEntryById, getEntriesOnThisDay,
  getPrevEntryDate, getNextEntryDate, getTodayDateStr,
  getTotalWordCount, getTodayWordCount, calculateStreak,
  getEntryWordCount, applyFilter, EMPTY_FILTER,
  MOOD_EMOJI,
  type DiaryDocumentContent, type DiaryMood, type DiaryWeatherType, type DiaryFilterState,
} from './types';
import { getTemplateById } from './diaryTemplates';
import { createDemoDiaryContent } from './diaryDemoData';
import { DEFAULT_LEFT_WIDTH, DEFAULT_RIGHT_WIDTH, CONTENT_SAVE_DEBOUNCE_MS, META_SAVE_DEBOUNCE_MS, SAVE_STATUS_DISPLAY_MS } from './constants';

export default function DiaryDocWorkspace({ document: doc, host, tabId }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const { closeTab, closeAllTabs } = useAppStore(useShallow(s => ({
    closeTab: s.closeTab, closeAllTabs: s.closeAllTabs,
  })));

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

  // ── 日历状态 ──
  const [calendarDate, setCalendarDate] = useState(new Date());

  // ── 条目状态 ──
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [entryContent, setEntryContent] = useState('');
  const [editorRevision, setEditorRevision] = useState(0);

  // ── 高级筛选状态 ──
  const [advancedFilter, setAdvancedFilter] = useState<DiaryFilterState>({ ...EMPTY_FILTER });

  // ── 左栏视图模式（持久化） ──
  type LeftViewMode = 'list' | 'timeline';
  const [leftViewMode, setLeftViewModeRaw] = useState<LeftViewMode>(() => {
    const saved = host.storage.get<string>('_diary_left_view_mode');
    return (saved === 'timeline') ? 'timeline' : 'list';
  });
  const setLeftViewMode = useCallback((mode: LeftViewMode) => {
    setLeftViewModeRaw(mode);
    host.storage.set('_diary_left_view_mode', mode);
  }, [host.storage]);

  // ── 右键菜单状态 ──
  const [ctxEntry, setCtxEntry] = useState<import('./types').DiaryEntry | null>(null);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });

  // ── 弹窗状态 ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [forceInfoTab, setForceInfoTab] = useState<InfoTab | null>(null);

  // ── 解析日记内容 ──
  const getDiary = useCallback((): DiaryDocumentContent => {
    const d = host.doc.getDocument();
    return parseDiaryContent(d.content || '') || createEmptyDiaryContent();
  }, [host.doc]);

  // ── 初始化日记数据 ──
  useEffect(() => {
    const d = getDiary();
    setDiary(d);
    // 恢复上次编辑的条目
    const lastEntryId = host.storage.get<string>('_diary_last_entry_id');
    const lastDate = host.storage.get<string>('_diary_last_date');
    if (lastEntryId && d.entries.find(e => e.id === lastEntryId)) {
      const entry = d.entries.find(e => e.id === lastEntryId)!;
      setActiveEntryId(lastEntryId);
      setEntryContent(entry.content);
      setSelectedDate(entry.date);
      const [y, m] = entry.date.split('-').map(Number);
      setCalendarDate(new Date(y, m - 1, 1));
    } else if (lastDate) {
      setSelectedDate(lastDate);
      const entries = d.entries.filter(e => e.date === lastDate).sort((a, b) => a.createdAt - b.createdAt);
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

  const [diary, setDiary] = useState<DiaryDocumentContent>(getDiary);
  const diaryRef = useRef(diary);
  diaryRef.current = diary;
  const filteredEntries = useMemo(() => applyFilter(diary, advancedFilter), [diary, advancedFilter]);

  // ── 保存（非编辑操作：元数据/心情/天气等，立即同步到 store，独立 debounce 写磁盘） ──
  const metaSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDiary = useCallback((updated: DiaryDocumentContent) => {
    setDiary(updated);
    diaryRef.current = updated;
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    setSaveStatus('unsaved');
    if (metaSaveTimerRef.current) clearTimeout(metaSaveTimerRef.current);
    metaSaveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      host.doc.save();
      metaSaveTimerRef.current = null;
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('saved'), SAVE_STATUS_DISPLAY_MS);
    }, META_SAVE_DEBOUNCE_MS);
  }, [host.doc]);

  // ── 组件卸载时清理所有 timer ──
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (metaSaveTimerRef.current) clearTimeout(metaSaveTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    setSaveStatus('saving');
    // 先更新当前条目内容
    if (activeEntryId) {
      const updated = updateEntryContent(diary, activeEntryId, entryContent);
      setDiary(updated);
      host.doc.updateInMemory({ content: JSON.stringify(updated) });
    }
    host.doc.save().finally(() => {
      setIsSaving(false);
      setSaveStatus('saved');
    });
  }, [activeEntryId, diary, entryContent, host.doc]);

  const handleSaveAll = useCallback(() => {
    handleSave();
  }, [handleSave]);

  // ── 选中条目 ──
  const selectEntry = useCallback((entryId: string) => {
    if (!entryId) return; // 防御：无效 entryId 直接返回

    // 取消待处理的保存
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // 保存当前条目（仅当内容真的变化了才保存）
    const currentActiveId = activeEntryId;
    const currentContent = entryContent;
    if (currentActiveId && currentContent !== undefined) {
      const currentEntry = diaryRef.current.entries.find(e => e.id === currentActiveId);
      // 只有内容真的变化了才保存
      if (currentEntry && currentEntry.content !== currentContent) {
        const updated = updateEntryContent(diaryRef.current, currentActiveId, currentContent);
        saveDiary(updated);
      }
    }

    // 查找新条目（防御：确保条目存在）
    const entry = diaryRef.current.entries.find(e => e.id === entryId);
    if (!entry) {
      console.warn('[Diary] selectEntry: entry not found', entryId);
      return;
    }

    // 更新状态
    setActiveEntryId(entryId);
    setEntryContent(entry.content || '');
    setSelectedDate(entry.date);
    host.storage.set('_diary_last_entry_id', entryId);
    host.storage.set('_diary_last_date', entry.date);

    // 同步日历月份
    const [y, m] = entry.date.split('-').map(Number);
    if (calendarDate.getFullYear() !== y || calendarDate.getMonth() + 1 !== m) {
      setCalendarDate(new Date(y, m - 1, 1));
    }
  }, [activeEntryId, entryContent, saveDiary, calendarDate, host.storage]);

  // ── 日期选择 ──
  const selectDate = useCallback((dateStr: string) => {
    if (!dateStr) return; // 防御：无效 dateStr 直接返回

    // 取消待处理的保存
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    // 保存当前条目（仅当内容真的变化了才保存）
    const currentActiveId = activeEntryId;
    const currentContent = entryContent;
    if (currentActiveId && currentContent !== undefined) {
      const currentEntry = diaryRef.current.entries.find(e => e.id === currentActiveId);
      if (currentEntry && currentEntry.content !== currentContent) {
        const updated = updateEntryContent(diaryRef.current, currentActiveId, currentContent);
        saveDiary(updated);
      }
    }

    setSelectedDate(dateStr);
    host.storage.set('_diary_last_date', dateStr);
    const entries = diaryRef.current.entries.filter(e => e.date === dateStr).sort((a, b) => a.createdAt - b.createdAt);
    if (entries.length > 0) {
      setActiveEntryId(entries[0].id);
      setEntryContent(entries[0].content || '');
      host.storage.set('_diary_last_entry_id', entries[0].id);
    } else {
      setActiveEntryId(null);
      setEntryContent('');
    }
  }, [activeEntryId, entryContent, saveDiary, host.storage]);

  // ── 新建条目 ──
  const handleNewEntry = useCallback(() => {
    // 保存当前
    if (activeEntryId) {
      const updated = updateEntryContent(diary, activeEntryId, entryContent);
      saveDiary(updated);
    }
    const journalId = diary.settings.defaultJournalId;
    const updated = createEntry(diary, journalId, selectedDate);
    const newEntry = updated.entries[updated.entries.length - 1];
    saveDiary(updated);
    setActiveEntryId(newEntry.id);
    setEntryContent(newEntry.content);
  }, [activeEntryId, entryContent, diary, saveDiary, selectedDate]);

  // ── 内容变化（用 diaryRef 避免 diary 引用变化导致回调重建 → 子组件 effect 循环） ──
  const dirtyMarkedRef = useRef(false);
  const handleContentChange = useCallback((content: string) => {
    // 内容未变时提前退出，避免 debounce 回调导致不必要的 diary 更新
    const currentEntry = activeEntryId ? diaryRef.current.entries.find(e => e.id === activeEntryId) : null;
    if (currentEntry && currentEntry.content === content) return;
    setEntryContent(content);
    setSaveStatus('unsaved');
    // 首次变化时立即 markDirty 以显示 Tab 红点（不调用 updateInMemory 避免全局重渲染）
    if (!dirtyMarkedRef.current) {
      host.doc.markDirty();
      dirtyMarkedRef.current = true;
    }
    if (activeEntryId) {
      let updated = updateEntryContent(diaryRef.current, activeEntryId, content);
      updated = addSnapshot(updated, activeEntryId);
      setDiary(updated);
    }
  }, [activeEntryId, host.doc]);

  // ── 自动保存（延迟同步到 store + 保存到磁盘） ──
  useEffect(() => {
    if (!activeEntryId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // 延迟同步到 store（避免每次按键都触发上层重渲染）
      host.doc.updateInMemory({ content: JSON.stringify(diaryRef.current) });
      host.doc.markDirty();
      setSaveStatus('saving');
      host.doc.save().then(() => {
        dirtyMarkedRef.current = false;
      });
      saveTimerRef.current = null;
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('saved'), SAVE_STATUS_DISPLAY_MS);
    }, CONTENT_SAVE_DEBOUNCE_MS);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [entryContent, activeEntryId, host.doc]);

  // ── 导航 ──
  const handlePrevDay = useCallback(() => {
    const prev = getPrevEntryDate(diary, selectedDate);
    if (prev) selectDate(prev);
  }, [diary, selectedDate, selectDate]);

  const handleNextDay = useCallback(() => {
    const next = getNextEntryDate(diary, selectedDate);
    if (next) selectDate(next);
  }, [diary, selectedDate, selectDate]);

  const handleToday = useCallback(() => {
    const today = getTodayDateStr();
    setCalendarDate(new Date());
    selectDate(today);
  }, [selectDate]);

  // ── 元数据操作 ──
  const activeEntry = activeEntryId ? getEntryById(diary, activeEntryId) || null : null;

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
      ? entry.tags.filter(t => t !== tag)
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

  // ── Phase 2: 条目信息面板回调 ──
  const handleUpdatePrivateNote = useCallback((note: string) => {
    if (!activeEntryId) return;
    saveDiary(updateEntryMeta(diaryRef.current, activeEntryId, { privateNote: note }));
  }, [activeEntryId, saveDiary]);

  const handleUpdateLocation = useCallback((location: string) => {
    if (!activeEntryId) return;
    saveDiary(updateEntryMeta(diaryRef.current, activeEntryId, { location }));
  }, [activeEntryId, saveDiary]);

  const handleTagAdd = useCallback((tag: string) => {
    if (!activeEntryId) return;
    const entry = getEntryById(diaryRef.current, activeEntryId);
    if (!entry) return;
    let updated = addGlobalTag(diaryRef.current, tag);
    if (!entry.tags.includes(tag)) {
      updated = updateEntryMeta(updated, activeEntryId, { tags: [...entry.tags, tag] });
    }
    saveDiary(updated);
  }, [activeEntryId, saveDiary]);

  const handleMoveToJournal = useCallback((journalId: string) => {
    if (!activeEntryId) return;
    saveDiary(moveEntryToJournal(diaryRef.current, activeEntryId, journalId));
  }, [activeEntryId, saveDiary]);

  // ── Phase 2: 右键菜单回调 ──
  const handleCtxToggleStarred = useCallback((entryId: string) => {
    saveDiary(toggleEntryStarred(diaryRef.current, entryId));
  }, [saveDiary]);

  const handleCtxDuplicate = useCallback((entryId: string) => {
    saveDiary(duplicateEntry(diaryRef.current, entryId));
  }, [saveDiary]);

  const handleCtxDelete = useCallback((entryId: string) => {
    const updated = softDeleteEntry(diaryRef.current, entryId);
    saveDiary(updated);
    if (activeEntryId === entryId) {
      setActiveEntryId(null);
      setEntryContent('');
    }
  }, [saveDiary, activeEntryId]);

  const handleCtxMoveToJournal = useCallback((entryId: string, journalId: string) => {
    saveDiary(moveEntryToJournal(diaryRef.current, entryId, journalId));
  }, [saveDiary]);

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
    if (focusMode) {
      setFocusMode(false);
      setLeftCollapsed(false);
    } else {
      setFocusMode(true);
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, [focusMode]);


  // ── 键盘快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      // Escape: 退出专注模式
      if (e.key === 'Escape' && focusMode) {
        e.preventDefault();
        setFocusMode(false);
        setLeftCollapsed(false);
        return;
      }
      if (!meta) return;
      switch (e.key) {
        case 'n': case 'N':
          if (!e.shiftKey) { e.preventDefault(); handleNewEntry(); }
          break;
        case 's': case 'S':
          e.preventDefault();
          if (e.shiftKey) handleSaveAll(); else handleSave();
          break;
        case '[': e.preventDefault(); handlePrevDay(); break;
        case ']': e.preventDefault(); handleNextDay(); break;
        case 't': case 'T':
          if (!e.shiftKey) { e.preventDefault(); handleToday(); }
          break;
        case 'b': case 'B':
          if (!e.shiftKey) { /* 让编辑器处理 ⌘B 粗体 */ }
          break;
        case 'e': case 'E':
          if (!e.shiftKey) { e.preventDefault(); handleFocus(); }
          break;
        case 'j': case 'J':
          if (!e.shiftKey) { /* 让编辑器处理 */ }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode, handleNewEntry, handleSave, handleSaveAll, handlePrevDay, handleNextDay, handleToday, handleFocus]);

  // ── 统计数据 ──
  const totalWords = useMemo(() => getTotalWordCount(diary), [diary]);
  const todayWords = useMemo(() => getTodayWordCount(diary), [diary]);
  const streak = useMemo(() => calculateStreak(diary), [diary]);
  const onThisDay = useMemo(() => getEntriesOnThisDay(diary, selectedDate), [diary, selectedDate]);
  const chapterWords = activeEntry ? getEntryWordCount(activeEntry) : 0;
  const paragraphCount = activeEntry ? (entryContent.split(/\n\s*\n/).filter(p => p.trim()).length) : 0;
  const readingTimeMin = Math.max(1, Math.round(chapterWords / 300));
  const dailyWordGoal = diary.metadata.dailyWordGoal || 0;

  return (
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
                onSelectEntry={selectEntry}
              />
            )}

            {/* 底部统计 */}
            <div className="px-2 py-1 border-t text-[10px] text-muted-foreground space-y-0.5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span>{diary.entries.length}条 · {totalWords > 9999 ? `${(totalWords / 10000).toFixed(1)}万` : totalWords}字</span>
                <span className="text-green-600 dark:text-green-400">{t('diary.todayWords', { defaultValue: '今日+{{count}}', count: todayWords })}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🔥 {t('diary.streak', { defaultValue: '连续{{count}}天', count: streak.current })}</span>
                {streak.longest > streak.current && (
                  <span className="text-muted-foreground/60">({t('diary.longestStreak', { defaultValue: '最长{{count}}天', count: streak.longest })})</span>
                )}
                <div className="flex-1" />
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
            onOpenVersionHistory={() => setForceInfoTab('history')}
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
                  host={host}
                  onChange={handleContentChange}
                  textIndent={editorAppearance.textIndent}
                  key={`${activeEntry.id}-${editorRevision}`}
                />
              </div>
            </div>
            {/* 状态栏 */}
            <DiaryStatusBar
              entry={activeEntry}
              todayWordCount={getTodayWordCount(diary)}
              dailyGoal={diary.metadata.dailyWordGoal || 0}
              streak={calculateStreak(diary).current}
              saveStatus={saveStatus}
            />
            {/* 条目信息面板 */}
            <DiaryEntryInfo
              entry={activeEntry}
              journals={diary.journals}
              allTags={allTags}
              onUpdatePrivateNote={handleUpdatePrivateNote}
              onUpdateLocation={handleUpdateLocation}
              onTagToggle={handleTagToggle}
              onTagAdd={handleTagAdd}
              onMoveToJournal={handleMoveToJournal}
              onRestoreSnapshot={(snapshotId) => {
                if (!activeEntryId) return;
                const updated = restoreFromSnapshot(diary, activeEntryId, snapshotId);
                saveDiary(updated);
                const entry = getEntryById(updated, activeEntryId);
                if (entry) setEntryContent(entry.content);
              }}
              forceTab={forceInfoTab}
              onForceTabHandled={() => setForceInfoTab(null)}
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
                  <div className="text-lg font-bold text-foreground">{diary.entries.length}</div>
                  <div className="text-[10px] text-muted-foreground">{t('diary.totalEntries', { defaultValue: '条目总数' })}</div>
                </div>
                <div className="rounded-lg border bg-card p-2">
                  <div className="text-lg font-bold text-foreground">{totalWords > 9999 ? `${(totalWords / 10000).toFixed(1)}万` : totalWords}</div>
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
                    {[...diary.entries].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5).map(entry => (
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

        {/* 状态栏（专注模式下显示最小版本） */}
        {activeEntry && (
          focusMode ? (
            /* 专注模式最小状态栏 */
            <div className="flex items-center gap-2 px-3 py-0.5 border-t text-[10px] text-muted-foreground flex-shrink-0 bg-card/80">
              <span className={cn('flex items-center gap-0.5',
                saveStatus === 'unsaved' ? 'text-amber-500' : saveStatus === 'saving' ? 'text-blue-500' : 'text-green-500')}>
                {saveStatus === 'saved' ? '✅' : saveStatus === 'saving' ? '⏳' : '⚠️'}
              </span>
              <span className="tabular-nums">{chapterWords}{t('diary.charUnit', { defaultValue: '字' })}</span>
              {dailyWordGoal > 0 && (
                <>
                  <span className="w-px h-3 bg-border" />
                  <span className={cn('tabular-nums', todayWords >= dailyWordGoal ? 'text-green-600 dark:text-green-400' : '')}>
                    {todayWords}/{dailyWordGoal}
                  </span>
                </>
              )}
              <div className="flex-1" />
              <span className="text-muted-foreground/50">{t('diary.pressEscToExit', { defaultValue: '按 Esc 退出专注' })}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-0.5 border-t text-[10px] text-muted-foreground flex-shrink-0 bg-card">
              {/* 保存状态 */}
              <span className={cn('flex items-center gap-0.5',
                saveStatus === 'unsaved' ? 'text-amber-500' : saveStatus === 'saving' ? 'text-blue-500' : 'text-green-500')}>
                {saveStatus === 'saved' ? '✅' : saveStatus === 'saving' ? '⏳' : '⚠️'}
                {saveStatus === 'saved' ? t('diary.statusSaved', { defaultValue: '已保存' })
                  : saveStatus === 'saving' ? t('diary.statusSaving', { defaultValue: '保存中...' })
                  : t('diary.statusUnsaved', { defaultValue: '未保存' })}
              </span>
              <span className="w-px h-3 bg-border" />
              <span className="tabular-nums">{chapterWords}{t('diary.charUnit', { defaultValue: '字' })}</span>
              <span className="w-px h-3 bg-border" />
              <span>{paragraphCount}{t('diary.paragraphUnit', { defaultValue: '段' })}</span>
              <span className="w-px h-3 bg-border" />
              <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{t('diary.readingTime', { defaultValue: '约{{min}}分钟', min: readingTimeMin })}</span>
              {/* 每日字数目标进度 */}
              {dailyWordGoal > 0 && (
                <>
                  <span className="w-px h-3 bg-border" />
                  <span className="flex items-center gap-1">
                    <span className={cn('tabular-nums', todayWords >= dailyWordGoal ? 'text-green-600 dark:text-green-400 font-medium' : '')}>
                      {todayWords >= dailyWordGoal ? '✅' : '🎯'} {todayWords}/{dailyWordGoal}
                    </span>
                    <span className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <span className={cn('block h-full rounded-full transition-all',
                        todayWords >= dailyWordGoal ? 'bg-green-500' : todayWords >= dailyWordGoal * 0.7 ? 'bg-yellow-500' : 'bg-primary/60',
                      )} style={{ width: `${Math.min(100, Math.round(todayWords / dailyWordGoal * 100))}%` }} />
                    </span>
                  </span>
                </>
              )}
              <div className="flex-1" />
              <span>🔥 {t('diary.streak', { defaultValue: '连续{{count}}天', count: streak.current })}</span>
              <span className="text-green-600 dark:text-green-400">{t('diary.todayWords', { defaultValue: '今日+{{count}}', count: todayWords })}</span>
            </div>
          )
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
                    setEditorRevision(r => r + 1);
                  }
                }}
              />
            </div>
            <DiaryOnThisDay entries={onThisDay} onSelectEntry={selectEntry} />
          </div>
        </>
      )}
    </div>
  );
}
