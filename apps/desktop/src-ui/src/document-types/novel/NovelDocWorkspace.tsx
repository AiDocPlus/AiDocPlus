/**
 * NovelDocWorkspace — 专业小说创作工作台
 *
 * 三栏布局：左栏（卷/章管理）| 中栏（编辑器+章节信息+状态栏）| 右栏（AI助手）
 * 工具栏：章节导航/新建/关闭/保存/版本/设定集/专注
 * 数据源：单文档 JSON（NovelDocumentContent）
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { EditorView } from '@codemirror/view';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Plus, BookOpen, ChevronDown, ChevronRight, Search,
  Circle, CheckCircle2, PenLine, X, XCircle, Save, SaveAll,
  History, BookMarked, Maximize2, FilePlus,
  ChevronsUpDown, ChevronLeft, AlignCenter, BarChart3, FileDown,
  List, LayoutGrid, GitBranch, MessageSquare, Columns,
} from 'lucide-react';
import NovelAISidebar from './NovelAISidebar';
import { createDemoNovelContent } from './novelDemoData';
import NovelOutlineView from './NovelOutlineView';
import NovelCorkboardView from './NovelCorkboardView';
import NovelPlotlineView from './NovelPlotlineView';
import NovelCollections from './NovelCollections';
import NovelEditorSettings, { loadAppearance, getAppearanceStyle, getEditorInnerStyle, type EditorAppearance } from './NovelEditorSettings';
import { joinScenes, splitFromJoined, applyJoinedToScenes } from './scriveningsMode';
import NovelChapterContextMenu, { type ContextMenuTarget } from './NovelChapterContextMenu';
import NovelChapterInfo from './NovelChapterInfo';
import NovelSettingsDialog from './NovelSettingsDialog';
import NovelSelectionToolbar from './NovelSelectionToolbar';
import NovelDashboard from './NovelDashboard';
import NovelStatusBar from './NovelStatusBar';
import NovelExportDialog from './NovelExportDialog';
import NovelVersionDialog from './NovelVersionDialog';
import NovelInlineAI from './NovelInlineAI';
import NovelSearchDialog from './NovelSearchDialog';
import { saveSnapshot } from './novelVersions';
import {
  parseNovelContent, addVolume, addChapter, updateChapterContent,
  getChapterById, getTotalWordCount, createEmptyNovelContent,
  deleteVolume, deleteChapter, renameVolume, renameChapter,
  moveVolumeUp, moveVolumeDown, moveChapterUp, moveChapterDown,
  moveChapterToVolume, updateChapterStatus, updateChapterOutline,
  updateChapterSummary, updateChapterNotes,
  getVolumeWordCount, getChapterWordCount, getTodayWordCount,
  updateChapterMeta, duplicateChapter, splitChapter,
  insertChapterBefore, insertChapterAfter,
  updateDailyWordStats, mergeChapters,
  updateSceneContent, getSceneWordCount,
  type NovelDocumentContent, type NovelChapter, type NovelWritingSession,
} from './types';

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5分钟空闲超时

const CHAPTER_TEMPLATES: { key: string; label: string; outline: string; content: string }[] = [
  { key: 'blank', label: '空白', outline: '', content: '' },
  { key: 'opening', label: '开场', outline: '引入主要角色和场景，建立故事基调，设置悬念钩子', content: '# \n\n' },
  { key: 'dialogue', label: '对话', outline: '通过角色对话推动情节，揭示角色关系和性格', content: '# \n\n「」\n\n「」\n\n' },
  { key: 'action', label: '战斗', outline: '紧张的动作场景，节奏快速，描写打斗细节和紧张氛围', content: '# \n\n' },
  { key: 'transition', label: '过渡', outline: '场景过渡，时间推移，角色反思或旅途描写', content: '# \n\n' },
  { key: 'ending', label: '结尾', outline: '章节结尾，制造悬念或情感高潮，引导读者继续阅读', content: '# \n\n' },
];

export default function NovelDocWorkspace({ document: doc, host, tabId }: DocTypeEditorProps) {
  const dk = useMemo(() => `novel_${doc.id}_`, [doc.id]);
  const { t } = useTranslation();
  const { closeTab, closeAllTabs, saveDocument } = useAppStore(useShallow(s => ({
    closeTab: s.closeTab, closeAllTabs: s.closeAllTabs,
    saveDocument: s.saveDocument,
  })));

  // ── 布局状态 ──
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(320);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  type ViewMode = 'editor' | 'outline' | 'corkboard';
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [editorAppearance, setEditorAppearance] = useState<EditorAppearance>(() => loadAppearance(host.storage));
  const [scriveningsMode, setScriveningsMode] = useState(false);
  type LinguisticFocusMode = 'off' | 'dialogue' | 'narration';
  const [linguisticFocus, setLinguisticFocus] = useState<LinguisticFocusMode>('off');
  const [splitMode, setSplitMode] = useState(false);
  const [splitContent, setSplitContent] = useState('');
  const [splitChapterId, setSplitChapterId] = useState<string | null>(null);
  const [typewriterMode, setTypewriterMode] = useState<boolean>(() => {
    return host.storage.get<boolean>(`${dk}_typewriter_mode`) ?? false;
  });

  // ── 保存状态指示 ── 'saved' | 'saving' | 'unsaved'
  type SaveStatus = 'saved' | 'saving' | 'unsaved';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 今日字数统计（Phase 4） ──
  const baselineWordCountRef = useRef<number>(0);
  const dailyStatsThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayAccumulatedRef = useRef<number>(0);

  // ── 写作会话追踪（Phase 4） ──
  const writingSessionRef = useRef<{ startTime: number; lastActiveTime: number; wordsAtStart: number } | null>(null);

  // ── 番茄钟（Phase 4） ──
  type PomodoroState = 'idle' | 'working' | 'resting';
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>('idle');
  const [pomodoroRemaining, setPomodoroRemaining] = useState(0); // 剩余秒数
  const pomodoroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 每日目标达成提醒（Phase 4） ──
  const [dailyGoalReached, setDailyGoalReached] = useState(false);
  const dailyGoalShownRef = useRef(false);

  // ── Phase 2: 编辑器 EditorView ref + 选区浮动工具栏 ──
  const cmEditorRef = useRef<EditorView | null>(null);
  const [selToolbar, setSelToolbar] = useState<{ visible: boolean; x: number; y: number; text: string; from: number; to: number }>({ visible: false, x: 0, y: 0, text: '', from: 0, to: 0 });

  // ── Phase 3: 拖拽排序 ──
  const [dragChapterId, setDragChapterId] = useState<string | null>(null);
  const [dragVolumeId, setDragVolumeId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // ── Phase 9.3: 排序模式 ──
  type SortMode = 'structure' | 'words-desc' | 'words-asc' | 'recent';
  const [sortMode, setSortMode] = useState<SortMode>('structure');

  // ── Phase 3.3: 批量操作（多选） ──
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

  // ── 章节状态 ──
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [chapterContent, setChapterContent] = useState('');
  const [creatingVolume, setCreatingVolume] = useState(false);
  const [creatingChapterInVolume, setCreatingChapterInVolume] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 右键菜单 ──
  const [ctxTarget, setCtxTarget] = useState<ContextMenuTarget | null>(null);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // ── 设定集弹窗 ──
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsDialogTab, setSettingsDialogTab] = useState<'synopsis' | 'outline' | 'characters' | 'relations' | 'locations' | 'factions' | 'foreshadowing' | 'timeline' | 'worldview' | 'materials' | 'goals' | 'check' | 'plotlines' | undefined>(undefined);

  // ── Phase 5: 仪表盘弹窗 ──
  const [dashboardOpen, setDashboardOpen] = useState(false);

  // ── Phase 6: 导出弹窗 ──
  const [exportOpen, setExportOpen] = useState(false);

  // ── Phase 11: 版本历史弹窗 ──
  const [versionOpen, setVersionOpen] = useState(false);

  // ── 情节线弹窗 ──
  const [plotlineViewOpen, setPlotlineViewOpen] = useState(false);

  // ── N2.3: 全书搜索弹窗 ──
  const [searchOpen, setSearchOpen] = useState(false);

  // ── 解析小说内容 ──
  const getNovel = useCallback((): NovelDocumentContent => {
    const d = host.doc.getDocument();
    return parseNovelContent(d.content || '') || createEmptyNovelContent();
  }, [host.doc]);

  const [novel, setNovel] = useState<NovelDocumentContent>(getNovel);

  useEffect(() => {
    const n = getNovel();
    setNovel(n);
    setActiveChapterId(null);
    setChapterContent('');
    setExpandedVolumes(new Set(n.volumes.map(v => v.id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // ── 保存 ──
  const saveNovel = useCallback((updated: NovelDocumentContent) => {
    setNovel(updated);
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    setSaveStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      host.doc.save();
      saveTimerRef.current = null;
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('saved'), 1500);
    }, 3000);
  }, [host.doc]);

  const selectChapter = useCallback((chId: string) => {
    // 切换前：保存旧章节快照（必须在状态变化前）
    if (activeChapterId && chapterContent) {
      saveSnapshot(host.storage, activeSceneId || activeChapterId, chapterContent);
    }

    // 切换前：合并保存（写作会话 + 章节内容，一次 saveNovel 避免数据丢失）
    let novelToSave = novel;
    if (activeChapterId && writingSessionRef.current) {
      const sess = writingSessionRef.current;
      const wordsNow = chapterContent.replace(/\s/g, '').length;
      const wordsWritten = Math.max(0, wordsNow - sess.wordsAtStart);
      if (wordsWritten > 0) {
        const session: NovelWritingSession = {
          date: new Date().toISOString().slice(0, 10),
          startTime: sess.startTime,
          endTime: Date.now(),
          wordsWritten,
        };
        const sessions = [...(novelToSave.metadata.writingSessions || []), session].slice(-200);
        novelToSave = { ...novelToSave, metadata: { ...novelToSave.metadata, writingSessions: sessions } };
      }
      writingSessionRef.current = null;
    }
    if (activeChapterId && chapterContent !== undefined) {
      if (activeSceneId) {
        novelToSave = updateSceneContent(novelToSave, activeChapterId, activeSceneId, chapterContent);
      } else {
        novelToSave = updateChapterContent(novelToSave, activeChapterId, chapterContent);
      }
    }
    if (novelToSave !== novel) {
      saveNovel(novelToSave);
    }

    const ch = getChapterById(novelToSave, chId);
    setActiveChapterId(chId);
    // 场景模式：自动选中第一个场景
    if (ch?.scenes && ch.scenes.length > 0) {
      const firstScene = [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      setActiveSceneId(firstScene.id);
      setChapterContent(firstScene.content);
      setExpandedChapters(prev => new Set([...prev, chId]));
    } else {
      setActiveSceneId(null);
      setChapterContent(ch?.content || '');
    }
    // 记录新章节基准字数
    const effectiveContent = ch?.scenes && ch.scenes.length > 0
      ? [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.content || ''
      : (ch?.content || '');
    const newWc = effectiveContent.replace(/\s/g, '').length;
    baselineWordCountRef.current = newWc;
    // 开始新写作会话
    writingSessionRef.current = { startTime: Date.now(), lastActiveTime: Date.now(), wordsAtStart: newWc };
  }, [activeChapterId, activeSceneId, chapterContent, novel, saveNovel, host.storage]);

  const selectScene = useCallback((chId: string, sceneId: string) => {
    // 先保存当前编辑内容
    if (activeChapterId && activeSceneId && chapterContent !== undefined) {
      const updated = updateSceneContent(novel, activeChapterId, activeSceneId, chapterContent);
      saveNovel(updated);
    } else if (activeChapterId && !activeSceneId && chapterContent !== undefined) {
      const updated = updateChapterContent(novel, activeChapterId, chapterContent);
      saveNovel(updated);
    }
    // 保存快照
    if ((activeSceneId || activeChapterId) && chapterContent) {
      saveSnapshot(host.storage, activeSceneId || activeChapterId || '', chapterContent);
    }
    const ch = getChapterById(novel, chId);
    const scene = ch?.scenes?.find(s => s.id === sceneId);
    setActiveChapterId(chId);
    setActiveSceneId(sceneId);
    setChapterContent(scene?.content || '');
    const newWc = (scene?.content || '').replace(/\s/g, '').length;
    baselineWordCountRef.current = newWc;
    writingSessionRef.current = { startTime: Date.now(), lastActiveTime: Date.now(), wordsAtStart: newWc };
  }, [activeChapterId, activeSceneId, chapterContent, novel, saveNovel, host.storage]);

  const handleChapterChange = useCallback((val: string) => {
    setChapterContent(val);
    setSaveStatus('unsaved');
    if (activeChapterId) {
      let updated: NovelDocumentContent;
      if (activeSceneId) {
        updated = updateSceneContent(novel, activeChapterId, activeSceneId, val);
      } else {
        updated = updateChapterContent(novel, activeChapterId, val);
      }
      // Phase 9.6: 更新 lastEditedAt
      updated = updateChapterMeta(updated, activeChapterId, { lastEditedAt: Date.now() });
      setNovel(updated);
      host.doc.updateInMemory({ content: JSON.stringify(updated) });
      host.doc.markDirty();

      // Phase 4: 更新今日字数统计（10秒节流）
      const currentWc = val.replace(/\s/g, '').length;
      const existingToday = getTodayWordCount(novel);
      // 今日总量 = 已有今日统计 + 本次打开章节以来的增量
      const todayTotal = existingToday + Math.max(0, currentWc - baselineWordCountRef.current);
      todayAccumulatedRef.current = todayTotal;

      if (!dailyStatsThrottleRef.current) {
        dailyStatsThrottleRef.current = setTimeout(() => {
          dailyStatsThrottleRef.current = null;
          setNovel(prev => {
            const patched = updateDailyWordStats(prev, todayAccumulatedRef.current);
            host.doc.updateInMemory({ content: JSON.stringify(patched) });
            host.doc.markDirty();
            return patched;
          });
        }, 10000); // 10秒节流
      }

      // Phase 4: 更新写作会话活动时间
      if (writingSessionRef.current) {
        writingSessionRef.current.lastActiveTime = Date.now();
      }

      // Phase 4: 检查每日目标达成
      if (novel.metadata.dailyGoal && novel.metadata.dailyGoal > 0 && !dailyGoalShownRef.current) {
        if (todayTotal >= novel.metadata.dailyGoal) {
          dailyGoalShownRef.current = true;
          setDailyGoalReached(true);
          setTimeout(() => setDailyGoalReached(false), 5000);
        }
      }
    }
  }, [activeChapterId, activeSceneId, novel, host.doc]);

  useEffect(() => {
    if (!activeChapterId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      host.doc.save();
      saveTimerRef.current = null;
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('saved'), 1500);
    }, 5000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [chapterContent, activeChapterId, host.doc]);

  const handleAddVolume = useCallback(() => {
    const trimmed = newTitle.trim();
    if (!trimmed) { setCreatingVolume(false); return; }
    const updated = addVolume(novel, trimmed);
    saveNovel(updated);
    setExpandedVolumes(prev => new Set([...prev, updated.volumes[updated.volumes.length - 1].id]));
    setCreatingVolume(false);
    setNewTitle('');
  }, [newTitle, novel, saveNovel]);

  const [selectedTemplate, setSelectedTemplate] = useState('blank');

  const handleAddChapter = useCallback(() => {
    const trimmed = newTitle.trim();
    if (!trimmed || !creatingChapterInVolume) { setCreatingChapterInVolume(null); return; }
    let updated = addChapter(novel, creatingChapterInVolume, trimmed);
    // 应用模板
    const tpl = CHAPTER_TEMPLATES.find(t => t.key === selectedTemplate);
    if (tpl && (tpl.outline || tpl.content)) {
      const vol = updated.volumes.find(v => v.id === creatingChapterInVolume);
      if (vol) {
        const lastCh = vol.chapters[vol.chapters.length - 1];
        if (lastCh) {
          updated = { ...updated, volumes: updated.volumes.map(v => v.id === creatingChapterInVolume ? {
            ...v, chapters: v.chapters.map(c => c.id === lastCh.id ? { ...c, outline: tpl.outline || undefined, content: tpl.content.replace('# \n', `# ${trimmed}\n`) } : c)
          } : v) };
        }
      }
    }
    saveNovel(updated);
    setCreatingChapterInVolume(null);
    setNewTitle('');
    setSelectedTemplate('blank');
  }, [newTitle, novel, creatingChapterInVolume, saveNovel, selectedTemplate]);

  const handleInsertToDoc = useCallback((text: string) => {
    if (!activeChapterId) return;
    setChapterContent(prev => {
      const newContent = prev + '\n\n' + text;
      const updated = updateChapterContent(novel, activeChapterId, newContent);
      saveNovel(updated);
      return newContent;
    });
  }, [activeChapterId, novel, saveNovel]);

  // ── 工具栏操作 ──
  const handleSave = useCallback(async () => {
    if (activeChapterId) {
      const updated = updateChapterContent(novel, activeChapterId, chapterContent);
      const json = JSON.stringify(updated);
      host.doc.updateInMemory({ content: json });
    }
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const latest = useAppStore.getState().documents.find(d => d.id === doc.id);
      if (latest) await saveDocument(latest);
      if (tabId) useAppStore.getState().markTabAsClean(tabId);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    } finally { setIsSaving(false); }
  }, [host.doc, saveDocument, doc.id, tabId, activeChapterId, novel, chapterContent]);

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      for (const tab of useAppStore.getState().tabs) {
        if (!tab.isDirty) continue;
        const d = useAppStore.getState().documents.find(dd => dd.id === tab.documentId);
        if (d) await saveDocument(d);
      }
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    } finally { setIsSaving(false); }
  }, [saveDocument]);

  const handleFocus = useCallback(() => {
    setFocusMode(!focusMode);
    if (!focusMode) { setLeftCollapsed(true); setRightCollapsed(true); }
    else { setLeftCollapsed(false); setRightCollapsed(false); }
  }, [focusMode]);

  // ── 右键菜单回调 ──
  const handleContextMenu = useCallback((e: React.MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxTarget(target);
    setCtxPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleRenameConfirm = useCallback(() => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    // 判断是卷还是章节
    const isVol = novel.volumes.some(v => v.id === renamingId);
    const updated = isVol
      ? renameVolume(novel, renamingId, renameValue.trim())
      : renameChapter(novel, renamingId, renameValue.trim());
    saveNovel(updated);
    setRenamingId(null);
  }, [renamingId, renameValue, novel, saveNovel]);

  const handleDeleteVolume = useCallback((volId: string) => {
    const vol = novel.volumes.find(v => v.id === volId);
    const chCount = vol?.chapters.length || 0;
    const msg = chCount > 0
      ? `确定删除「${vol?.title || ''}」及其 ${chCount} 个章节？此操作不可撤销。`
      : `确定删除「${vol?.title || ''}」？`;
    if (!window.confirm(msg)) return;
    if (vol && vol.chapters.some(c => c.id === activeChapterId)) {
      setActiveChapterId(null);
      setChapterContent('');
    }
    saveNovel(deleteVolume(novel, volId));
  }, [novel, activeChapterId, saveNovel]);

  const handleDeleteChapter = useCallback((chapterId: string) => {
    const ch = getChapterById(novel, chapterId);
    const wc = ch ? getChapterWordCount(ch) : 0;
    const msg = wc > 0
      ? `确定删除「${ch?.title || ''}」（${wc}字）？此操作不可撤销。`
      : `确定删除「${ch?.title || ''}」？`;
    if (!window.confirm(msg)) return;
    if (chapterId === activeChapterId) {
      setActiveChapterId(null);
      setChapterContent('');
    }
    saveNovel(deleteChapter(novel, chapterId));
  }, [novel, activeChapterId, saveNovel]);

  // ── 章节信息面板回调 ──
  const handleUpdateOutline = useCallback((val: string) => {
    if (!activeChapterId) return;
    saveNovel(updateChapterOutline(novel, activeChapterId, val));
  }, [novel, activeChapterId, saveNovel]);

  const handleUpdateSummary = useCallback((val: string) => {
    if (!activeChapterId) return;
    saveNovel(updateChapterSummary(novel, activeChapterId, val));
  }, [novel, activeChapterId, saveNovel]);

  const handleUpdateNotes = useCallback((val: string) => {
    if (!activeChapterId) return;
    saveNovel(updateChapterNotes(novel, activeChapterId, val));
  }, [novel, activeChapterId, saveNovel]);

  const handleUpdateStatus = useCallback((status: NovelChapter['status']) => {
    if (!activeChapterId) return;
    saveNovel(updateChapterStatus(novel, activeChapterId, status));
  }, [novel, activeChapterId, saveNovel]);

  const activeChapter = activeChapterId ? getChapterById(novel, activeChapterId) : null;
  const totalWords = getTotalWordCount(novel);
  const chapterWords = chapterContent.replace(/\s/g, '').length;
  const totalChapters = novel.volumes.reduce((s, v) => s + v.chapters.length, 0);
  const sortedVolumes = useMemo(() => [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder), [novel.volumes]);

  // ── 所有章节列表（用于快速跳转和搜索） ──
  const allChapters = useMemo(() => {
    const list: { id: string; title: string; volTitle: string }[] = [];
    for (const v of sortedVolumes) {
      for (const ch of [...v.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
        list.push({ id: ch.id, title: ch.title, volTitle: v.title });
      }
    }
    return list;
  }, [sortedVolumes]);

  // ── Phase 9: 全书最大章节字数（用于微型字数条等比缩放） ──
  const maxChapterWc = useMemo(() => {
    let max = 1;
    for (const v of novel.volumes) for (const c of v.chapters) {
      const wc = getChapterWordCount(c);
      if (wc > max) max = wc;
    }
    return max;
  }, [novel]);

  // ── 状态栏增强数据 ──
  const paragraphCount = activeChapter ? chapterContent.split(/\n\s*\n/).filter(p => p.trim()).length : 0;
  const readingTimeMin = Math.max(1, Math.ceil(chapterWords / 500));

  // ── 打字机模式切换 ──
  const handleToggleTypewriter = useCallback(() => {
    setTypewriterMode(prev => {
      const next = !prev;
      host.storage.set(`${dk}_typewriter_mode`, next);
      return next;
    });
  }, [host.storage]);

  // ── 键盘快捷键（⌘S/⌘Shift+S/⌘[/⌘]/⌘\\/⌘Shift+\\/⌘E/Esc） ──
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleSaveAllRef = useRef(handleSaveAll);
  handleSaveAllRef.current = handleSaveAll;
  const selectChapterRef = useRef(selectChapter);
  selectChapterRef.current = selectChapter;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Esc 退出专注模式
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
        setLeftCollapsed(false);
        setRightCollapsed(false);
        return;
      }
      if (!mod) return;
      // ⌘S 保存
      if (e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSaveRef.current();
        return;
      }
      // ⌘Shift+S 保存全部
      if (e.key === 's' && e.shiftKey) {
        e.preventDefault();
        handleSaveAllRef.current();
        return;
      }
      // ⌘[ 上一章
      if (e.key === '[' && !e.shiftKey) {
        e.preventDefault();
        const idx = allChapters.findIndex(c => c.id === activeChapterId);
        if (idx > 0) selectChapterRef.current(allChapters[idx - 1].id);
        return;
      }
      // ⌘] 下一章
      if (e.key === ']' && !e.shiftKey) {
        e.preventDefault();
        const idx = allChapters.findIndex(c => c.id === activeChapterId);
        if (idx >= 0 && idx < allChapters.length - 1) selectChapterRef.current(allChapters[idx + 1].id);
        return;
      }
      // ⌘\\ 切换左栏
      if (e.key === '\\' && !e.shiftKey) {
        e.preventDefault();
        setLeftCollapsed(prev => !prev);
        return;
      }
      // ⌘Shift+\\ 切换右栏
      if (e.key === '\\' && e.shiftKey) {
        e.preventDefault();
        setRightCollapsed(prev => !prev);
        return;
      }
      // ⌘1/2/3 视图切换
      if (e.key === '1' && !e.shiftKey) { e.preventDefault(); setViewMode('editor'); return; }
      if (e.key === '2' && !e.shiftKey) { e.preventDefault(); setViewMode('outline'); return; }
      if (e.key === '3' && !e.shiftKey) { e.preventDefault(); setViewMode('corkboard'); return; }
      // ⌘E 专注模式
      if (e.key === 'e' && !e.shiftKey) {
        e.preventDefault();
        setFocusMode(prev => {
          const next = !prev;
          if (next) { setLeftCollapsed(true); setRightCollapsed(true); }
          else { setLeftCollapsed(false); setRightCollapsed(false); }
          return next;
        });
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode, activeChapterId, allChapters]);

  // ── Phase 7.4: 伏笔跳转事件监听（从设定集弹窗跳转到章节） ──
  useEffect(() => {
    const handler = (e: Event) => {
      const chId = (e as CustomEvent).detail;
      if (chId && typeof chId === 'string') {
        setSettingsDialogOpen(false);
        setTimeout(() => selectChapterRef.current(chId), 200);
      }
    };
    window.addEventListener('novel-jump-to-chapter', handler);
    return () => window.removeEventListener('novel-jump-to-chapter', handler);
  }, []);

  // ── Phase 2: 选区检测（mouseup 时检查是否有选中文本，弹出浮动工具栏） ──
  useEffect(() => {
    const handleMouseUp = () => {
      const view = cmEditorRef.current;
      if (!view) return;
      setTimeout(() => {
        try {
          const { from, to } = view.state.selection.main;
          if (to - from > 2) {
            const text = view.state.sliceDoc(from, to);
            const coords = view.coordsAtPos(from);
            if (coords) {
              setSelToolbar({ visible: true, x: coords.left, y: coords.top, text, from, to });
            }
          } else {
            setSelToolbar(prev => prev.visible ? { ...prev, visible: false } : prev);
          }
        } catch { /* view destroyed */ }
      }, 50);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // ── Phase 2: 选中文本替换/插入回调 ──
  const handleSelReplace = useCallback((text: string) => {
    const view = cmEditorRef.current;
    if (!view || (selToolbar.from === selToolbar.to)) return;
    view.dispatch({
      changes: { from: selToolbar.from, to: selToolbar.to, insert: text },
      selection: { anchor: selToolbar.from + text.length },
    });
    view.focus();
  }, [selToolbar.from, selToolbar.to]);

  const handleSelInsertAfter = useCallback((text: string) => {
    const view = cmEditorRef.current;
    if (!view) return;
    const insertPos = selToolbar.to || view.state.selection.main.to;
    view.dispatch({
      changes: { from: insertPos, to: insertPos, insert: '\n\n' + text },
      selection: { anchor: insertPos + text.length + 2 },
    });
    view.focus();
  }, [selToolbar.to]);

  // ── Phase 2: 「插入到光标」回调（从 AI 侧栏调用） ──
  const handleInsertAtCursor = useCallback((text: string) => {
    const view = cmEditorRef.current;
    if (!view) {
      // fallback: 追加到末尾
      if (activeChapterId) {
        setChapterContent(prev => {
          const newContent = prev + '\n\n' + text;
          const updated = updateChapterContent(novel, activeChapterId, newContent);
          saveNovel(updated);
          return newContent;
        });
      }
      return;
    }
    const pos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: pos, to: pos, insert: text },
      selection: { anchor: pos + text.length },
    });
    view.focus();
  }, [activeChapterId, novel, saveNovel]);

  // ── Phase 4: 写作会话空闲检测（5分钟无操作结束会话） ──
  useEffect(() => {
    if (!activeChapterId) return;
    const idleCheck = setInterval(() => {
      if (writingSessionRef.current) {
        const idle = Date.now() - writingSessionRef.current.lastActiveTime;
        if (idle > IDLE_TIMEOUT) {
          // 空闲超时，结束会话
          const sess = writingSessionRef.current;
          const wordsNow = chapterContent.replace(/\s/g, '').length;
          const wordsWritten = Math.max(0, wordsNow - sess.wordsAtStart);
          if (wordsWritten > 0) {
            const session: NovelWritingSession = {
              date: new Date().toISOString().slice(0, 10),
              startTime: sess.startTime,
              endTime: sess.lastActiveTime,
              wordsWritten,
            };
            setNovel(prev => {
              const sessions = [...(prev.metadata.writingSessions || []), session].slice(-200);
              return { ...prev, metadata: { ...prev.metadata, writingSessions: sessions } };
            });
          }
          writingSessionRef.current = null;
        }
      }
    }, 60000); // 每分钟检查一次
    return () => clearInterval(idleCheck);
  }, [activeChapterId, chapterContent, IDLE_TIMEOUT]);

  // ── Phase 4: 组件卸载时结束写作会话、持久化每日统计、保存当前章节内容 ──
  // 用 ref 保存最新值，避免 cleanup 闭包捕获过时状态
  const novelRef = useRef(novel);
  novelRef.current = novel;
  const activeChapterIdRef = useRef(activeChapterId);
  activeChapterIdRef.current = activeChapterId;
  const activeSceneIdRef = useRef(activeSceneId);
  activeSceneIdRef.current = activeSceneId;
  const chapterContentRef = useRef(chapterContent);
  chapterContentRef.current = chapterContent;

  useEffect(() => {
    return () => {
      // 清理番茄钟
      if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
      // 清理每日统计节流
      if (dailyStatsThrottleRef.current) clearTimeout(dailyStatsThrottleRef.current);
      // 清理自动保存定时器
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // 清理保存状态定时器
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      // 保存当前正在编辑的章节内容，防止卸载时丢失
      const latestNovel = novelRef.current;
      const chId = activeChapterIdRef.current;
      const scId = activeSceneIdRef.current;
      const content = chapterContentRef.current;
      if (chId && content !== undefined) {
        let updated: NovelDocumentContent;
        if (scId) {
          updated = updateSceneContent(latestNovel, chId, scId, content);
        } else {
          updated = updateChapterContent(latestNovel, chId, content);
        }
        host.doc.updateInMemory({ content: JSON.stringify(updated) });
        host.doc.save();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Phase 4: 番茄钟逻辑（统一 interval，避免嵌套泄漏） ──
  const handlePomodoroToggle = useCallback(() => {
    if (pomodoroState === 'idle') {
      setPomodoroState('working');
      setPomodoroRemaining(25 * 60);
    } else {
      if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
      pomodoroIntervalRef.current = null;
      setPomodoroState('idle');
      setPomodoroRemaining(0);
    }
  }, [pomodoroState]);

  useEffect(() => {
    if (pomodoroState === 'idle') {
      if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
      pomodoroIntervalRef.current = null;
      return;
    }
    pomodoroIntervalRef.current = setInterval(() => {
      setPomodoroRemaining(prev => {
        if (prev <= 1) {
          if (pomodoroState === 'working') {
            setPomodoroState('resting');
            return 5 * 60;
          } else {
            setPomodoroState('idle');
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current); };
  }, [pomodoroState]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ═══ 左栏：卷/章树 ═══ */}
      {!leftCollapsed && (
        <>
          <div className="flex-shrink-0 h-full overflow-hidden border-r bg-card flex flex-col" style={{ width: leftWidth }}>
            {/* 搜索框 + 折叠/展开 + 添加卷 */}
            <div className="flex items-center gap-1 px-2 py-1 border-b flex-shrink-0">
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input className="flex-1 text-sm bg-transparent border-0 focus:outline-none px-1"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('novel.searchChapter', { defaultValue: '搜索章节...' })} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5" title={t('novel.sortMode', { defaultValue: '排序' })}>
                    <ChevronsUpDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {([['structure', '结构顺序'], ['words-desc', '字数多→少'], ['words-asc', '字数少→多'], ['recent', '最近修改']] as const).map(([key, label]) => (
                    <DropdownMenuItem key={key} className="text-xs" onClick={() => setSortMode(key)}>
                      {sortMode === key ? '◀ ' : ''}{label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem className="text-xs border-t" onClick={() => {
                    if (expandedVolumes.size === novel.volumes.length) setExpandedVolumes(new Set());
                    else setExpandedVolumes(new Set(novel.volumes.map(v => v.id)));
                  }}>全部折叠/展开</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setCreatingVolume(true); setNewTitle(''); }}
                title={t('novel.addVolume', { defaultValue: '添加卷' })}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* 卷/章列表 */}
            <div className="flex-1 overflow-auto p-1 space-y-0.5">
              {novel.volumes.length === 0 && !creatingVolume && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <BookOpen className="h-8 w-8 mx-auto opacity-20 mb-2" />
                  <p>{t('novel.noVolumes', { defaultValue: '点击 + 创建第一卷' })}</p>
                </div>
              )}
              {sortedVolumes.map(vol => {
                const isExpanded = expandedVolumes.has(vol.id);
                const sortedChs = [...vol.chapters].sort((a, b) => {
                  if (sortMode === 'words-desc') return (b.content.replace(/\s/g, '').length) - (a.content.replace(/\s/g, '').length);
                  if (sortMode === 'words-asc') return (a.content.replace(/\s/g, '').length) - (b.content.replace(/\s/g, '').length);
                  if (sortMode === 'recent') return (b.lastEditedAt || 0) - (a.lastEditedAt || 0);
                  return a.sortOrder - b.sortOrder;
                });
                const filteredChs = searchQuery
                  ? sortedChs.filter(ch => ch.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  : sortedChs;
                // 搜索时如果卷内无匹配章节则隐藏
                if (searchQuery && filteredChs.length === 0) return null;

                return (
                  <div key={vol.id}>
                    {/* 卷标题 (Phase 3.2: 卷拖拽排序) */}
                    <div className="flex items-center gap-1 px-1 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', `vol:${vol.id}`); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={(e) => { if (e.dataTransfer.types.includes('text/plain')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const data = e.dataTransfer.getData('text/plain');
                        if (data.startsWith('vol:')) {
                          const srcVolId = data.slice(4);
                          if (srcVolId !== vol.id) {
                            // 重排卷顺序：将 srcVol 移到当前 vol 位置
                            const sorted = [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder);
                            const srcIdx = sorted.findIndex(v => v.id === srcVolId);
                            const tgtIdx = sorted.findIndex(v => v.id === vol.id);
                            if (srcIdx >= 0 && tgtIdx >= 0) {
                              const [moved] = sorted.splice(srcIdx, 1);
                              sorted.splice(tgtIdx, 0, moved);
                              const reordered = { ...novel, volumes: sorted.map((v, i) => ({ ...v, sortOrder: i })) };
                              saveNovel(reordered);
                            }
                          }
                        }
                      }}
                      onClick={() => setExpandedVolumes(prev => {
                        const next = new Set(prev);
                        if (next.has(vol.id)) next.delete(vol.id); else next.add(vol.id);
                        return next;
                      })}
                      onContextMenu={(e) => handleContextMenu(e, { type: 'volume', id: vol.id })}>
                      {renamingId === vol.id ? (
                        <input className="flex-1 text-sm border rounded px-1.5 py-0.5 bg-background" autoFocus
                          value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingId(null); }}
                          onBlur={handleRenameConfirm}
                          onClick={e => e.stopPropagation()} />
                      ) : (
                        <>
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <BookOpen className="h-3.5 w-3.5 text-amber-500" />
                          <span className="flex-1 truncate font-medium">{vol.title}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {(() => { const vw = getVolumeWordCount(vol); return vw > 999 ? `${(vw/1000).toFixed(1)}k` : vw; })()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{vol.chapters.length}章</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={(e) => {
                            e.stopPropagation(); setCreatingChapterInVolume(vol.id); setNewTitle('');
                          }} title={t('novel.ctxAddChapter', { defaultValue: '添加章节' })}>
                            <Plus className="h-2.5 w-2.5" />
                          </Button>
                        </>
                      )}
                    </div>
                    {/* Phase 3: 卷摘要显示 */}
                    {isExpanded && vol.synopsis && (
                      <div className="px-2 pb-0.5 text-[10px] text-muted-foreground/70 truncate italic">{vol.synopsis.slice(0, 50)}{vol.synopsis.length > 50 ? '...' : ''}</div>
                    )}
                    {/* 卷进度条 */}
                    {vol.wordGoal && vol.wordGoal > 0 && (() => {
                      const vw = getVolumeWordCount(vol);
                      const pct = Math.min(100, Math.round(vw / vol.wordGoal * 100));
                      return (
                        <div className="mx-1 mb-0.5 h-[2px] bg-muted rounded-full overflow-hidden" title={`${vw}/${vol.wordGoal} (${pct}%)`}>
                          <div className={cn('h-full rounded-full transition-all',
                            pct < 50 ? 'bg-red-400' : pct < 80 ? 'bg-yellow-400' : pct <= 100 ? 'bg-green-400' : 'bg-blue-400'
                          )} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      );
                    })()}
                    {/* 章节列表 */}
                    {(isExpanded || searchQuery) && filteredChs.map(ch => (
                      <div key={ch.id}
                        draggable
                        onDragStart={(e) => { setDragChapterId(ch.id); setDragVolumeId(vol.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetId(ch.id); }}
                        onDragLeave={() => setDropTargetId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDropTargetId(null);
                          if (dragChapterId && dragChapterId !== ch.id) {
                            // 如果拖拽到同卷内不同章节 → 重排序
                            if (dragVolumeId === vol.id) {
                              // 简单实现：将拖拽章节移到目标章节位置
                              let updated = novel;
                              const srcVol = updated.volumes.find(v => v.id === vol.id);
                              if (srcVol) {
                                const sorted = [...srcVol.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
                                const srcIdx = sorted.findIndex(c => c.id === dragChapterId);
                                const tgtIdx = sorted.findIndex(c => c.id === ch.id);
                                if (srcIdx >= 0 && tgtIdx >= 0) {
                                  const [moved] = sorted.splice(srcIdx, 1);
                                  sorted.splice(tgtIdx, 0, moved);
                                  const reordered = sorted.map((c, i) => ({ ...c, sortOrder: i }));
                                  updated = { ...updated, volumes: updated.volumes.map(v => v.id === vol.id ? { ...v, chapters: reordered } : v) };
                                  saveNovel(updated);
                                }
                              }
                            } else {
                              // 跨卷拖拽 → moveChapterToVolume
                              saveNovel(moveChapterToVolume(novel, dragChapterId, vol.id));
                            }
                          }
                          setDragChapterId(null);
                          setDragVolumeId(null);
                        }}
                        onDragEnd={() => { setDragChapterId(null); setDragVolumeId(null); setDropTargetId(null); }}
                        className={cn('flex items-center gap-1 pl-5 pr-1 py-1 rounded cursor-pointer text-sm transition-colors',
                          activeChapterId === ch.id ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium' : 'hover:bg-accent',
                          dropTargetId === ch.id && dragChapterId && dragChapterId !== ch.id ? 'border-t-2 border-primary' : '',
                          dragChapterId === ch.id ? 'opacity-40' : '',
                        )}
                        onClick={(e) => {
                          if (e.shiftKey) {
                            // Phase 3.3: Shift+点击多选
                            setSelectedChapterIds(prev => {
                              const next = new Set(prev);
                              if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id);
                              return next;
                            });
                          } else {
                            setSelectedChapterIds(new Set());
                            // 有场景时切换展开/折叠
                            if (ch.scenes && ch.scenes.length > 0) {
                              setExpandedChapters(prev => {
                                const next = new Set(prev);
                                if (next.has(ch.id)) next.delete(ch.id); else next.add(ch.id);
                                return next;
                              });
                            }
                            selectChapter(ch.id);
                          }
                        }}
                        onContextMenu={(e) => {
                          // 如果有多选且右键点击的是已选中的章节，传递批量信息
                          if (selectedChapterIds.size > 0 && selectedChapterIds.has(ch.id)) {
                            handleContextMenu(e, { type: 'chapter', id: ch.id, volumeId: vol.id });
                          } else {
                            handleContextMenu(e, { type: 'chapter', id: ch.id, volumeId: vol.id });
                          }
                        }}>
                        {renamingId === ch.id ? (
                          <input className="flex-1 text-sm border rounded px-1.5 py-0.5 bg-background" autoFocus
                            value={renameValue} onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingId(null); }}
                            onBlur={handleRenameConfirm}
                            onClick={e => e.stopPropagation()} />
                        ) : (
                          <>
                            {/* Phase 9: 完成度色块（3px竖线） */}
                            {(() => {
                              const wc = getChapterWordCount(ch);
                              const pctColor = ch.wordGoal && ch.wordGoal > 0
                                ? (wc / ch.wordGoal < 0.3 ? 'bg-red-400' : wc / ch.wordGoal < 0.7 ? 'bg-yellow-400' : wc / ch.wordGoal <= 1 ? 'bg-green-400' : 'bg-blue-400')
                                : (ch.status === 'done' ? 'bg-green-400' : ch.status === 'revised' ? 'bg-blue-400' : 'bg-yellow-400');
                              return <span className={cn('w-[3px] h-4 rounded-full flex-shrink-0', pctColor)} />;
                            })()}
                            {ch.colorLabel && (
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ch.colorLabel }} />
                            )}
                            {ch.status === 'done' ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                              : ch.status === 'revised' ? <PenLine className="h-3 w-3 text-blue-500" />
                              : <Circle className="h-3 w-3 text-yellow-500" />}
                            <span className="flex-1 truncate" title={ch.content.slice(0, 200).replace(/\n/g, ' ') + (ch.content.length > 200 ? '...' : '')}>{ch.title}</span>
                            {/* Phase 9.4: 章节文字标签 */}
                            {ch.tags && ch.tags.length > 0 && ch.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="text-[8px] px-1 py-0 rounded bg-muted text-muted-foreground flex-shrink-0">{tag}</span>
                            ))}
                            {ch.povCharacterId && (() => {
                              const povChar = novel.settings.characters.find(c => c.id === ch.povCharacterId);
                              return povChar ? <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded flex-shrink-0">{povChar.name.slice(0, 2)}</span> : null;
                            })()}
                            {/* Phase 9: 微型字数条（40px） */}
                            <span className="w-10 h-2 bg-muted rounded-full overflow-hidden flex-shrink-0" title={`${getChapterWordCount(ch)}字`}>
                              <span className={cn('h-full rounded-full block', ch.status === 'done' ? 'bg-green-400' : ch.status === 'revised' ? 'bg-blue-400' : 'bg-amber-400')}
                                style={{ width: `${Math.min(100, getChapterWordCount(ch) / maxChapterWc * 100)}%` }} />
                            </span>
                            <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                              {(() => {
                                const wc = getChapterWordCount(ch);
                                const wcStr = wc > 999 ? `${(wc/1000).toFixed(1)}k` : String(wc);
                                return ch.wordGoal ? `${wcStr}/${ch.wordGoal > 999 ? `${(ch.wordGoal/1000).toFixed(1)}k` : ch.wordGoal}` : wcStr;
                              })()}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                    {/* 场景子列表（在章节列表下方，按活动章节展开） */}
                    {(isExpanded || searchQuery) && filteredChs.map(ch => {
                      if (!ch.scenes || ch.scenes.length === 0) return null;
                      if (!expandedChapters.has(ch.id)) return null;
                      const sortedScenes = [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder);
                      return sortedScenes.map(sc => (
                        <div key={sc.id}
                          className={cn('flex items-center gap-1 pl-9 pr-1 py-0.5 rounded cursor-pointer text-xs transition-colors',
                            activeSceneId === sc.id ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 font-medium' : 'hover:bg-accent text-muted-foreground',
                          )}
                          onClick={() => selectScene(ch.id, sc.id)}
                          onContextMenu={(e) => handleContextMenu(e, { type: 'chapter' as const, id: sc.id, volumeId: undefined })}>
                          {sc.status === 'done' ? <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                            : sc.status === 'revised' ? <PenLine className="h-2.5 w-2.5 text-blue-500" />
                            : <Circle className="h-2.5 w-2.5 text-yellow-500" />}
                          <span className="flex-1 truncate">{sc.title}</span>
                          <span className="text-[9px] text-muted-foreground tabular-nums">{getSceneWordCount(sc)}</span>
                        </div>
                      ));
                    })}
                    {isExpanded && creatingChapterInVolume === vol.id && (
                      <div className="pl-5 pr-1 py-0.5 space-y-0.5">
                        <input className="w-full px-1.5 py-0.5 text-sm border rounded bg-background"
                          value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus
                          placeholder={t('novel.chapterTitle', { defaultValue: '章节标题...' })}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddChapter(); if (e.key === 'Escape') setCreatingChapterInVolume(null); }}
                          onBlur={handleAddChapter} />
                        <div className="flex gap-0.5 flex-wrap">
                          {CHAPTER_TEMPLATES.map(tpl => (
                            <button key={tpl.key} className={cn('text-[9px] px-1.5 py-0.5 rounded border transition-colors',
                              selectedTemplate === tpl.key ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground hover:text-foreground border-transparent'
                            )} onClick={(e) => { e.stopPropagation(); setSelectedTemplate(tpl.key); }}>{tpl.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {creatingVolume && (
                <div className="px-1 py-0.5">
                  <input className="w-full px-1.5 py-0.5 text-sm border rounded bg-background"
                    value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus
                    placeholder={t('novel.volumeTitle', { defaultValue: '卷标题...' })}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddVolume(); if (e.key === 'Escape') setCreatingVolume(false); }}
                    onBlur={handleAddVolume} />
                </div>
              )}
            </div>

            {/* 智能集合 */}
            <NovelCollections novel={novel} onSelectChapter={selectChapter} />

            {/* 底部统计 */}
            <div className="px-2 py-1 border-t text-[10px] text-muted-foreground space-y-0.5">
              <div className="flex items-center justify-between">
                <span>{totalWords > 9999 ? `${(totalWords/10000).toFixed(1)}万` : totalWords}字 · {novel.volumes.length}卷{totalChapters}章</span>
                {novel.metadata.totalGoal && novel.metadata.totalGoal > 0 && (
                  <span>{Math.round(totalWords / novel.metadata.totalGoal * 100)}%</span>
                )}
              </div>
              {novel.metadata.totalGoal && novel.metadata.totalGoal > 0 && (
                <div className="h-[2px] bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all',
                    totalWords / novel.metadata.totalGoal < 0.5 ? 'bg-red-400' : totalWords / novel.metadata.totalGoal < 0.8 ? 'bg-yellow-400' : 'bg-green-400'
                  )} style={{ width: `${Math.min(100, Math.round(totalWords / novel.metadata.totalGoal * 100))}%` }} />
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-green-600 dark:text-green-400">今日 +{getTodayWordCount(novel)}字</span>
                {novel.metadata.dailyGoal && novel.metadata.dailyGoal > 0 && (
                  <span>/ {novel.metadata.dailyGoal}字</span>
                )}
              </div>
            </div>
          </div>
          <ResizableHandle direction="horizontal" onResize={(d) => setLeftWidth(w => Math.min(350, Math.max(160, w + d)))} />
        </>
      )}

      {/* ═══ 中栏：章节编辑器 ═══ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* 工具栏 */}
        <div className="flex items-center gap-1 px-2 py-1 border-b flex-shrink-0 bg-card text-xs">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setLeftCollapsed(!leftCollapsed)}
            title={leftCollapsed ? t('novel.showLeft', { defaultValue: '显示左栏' }) : t('novel.hideLeft', { defaultValue: '隐藏左栏' })}>
            {leftCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </Button>
          {/* 上一章/下一章导航 */}
          <Button variant="ghost" size="icon" className="h-5 w-5" title="上一章 (⌘[)"
            disabled={!activeChapterId || allChapters.findIndex(c => c.id === activeChapterId) <= 0}
            onClick={() => {
              const idx = allChapters.findIndex(c => c.id === activeChapterId);
              if (idx > 0) selectChapter(allChapters[idx - 1].id);
            }}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          {/* 章节名下拉跳转 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-sm font-medium truncate max-w-[200px] flex items-center gap-0.5 hover:text-primary transition-colors"
                title={t('novel.jumpToChapter', { defaultValue: '跳转章节' })}>
                {activeChapter?.title || t('novel.selectChapter', { defaultValue: '选择章节' })}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              {allChapters.map(ch => (
                <DropdownMenuItem key={ch.id} className="text-xs" onClick={() => selectChapter(ch.id)}>
                  <span className="text-muted-foreground mr-1">{ch.volTitle}</span>
                  {ch.title}
                  {ch.id === activeChapterId && <span className="ml-auto text-primary">◀</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="h-5 w-5" title="下一章 (⌘])"
            disabled={!activeChapterId || allChapters.findIndex(c => c.id === activeChapterId) >= allChapters.length - 1}
            onClick={() => {
              const idx = allChapters.findIndex(c => c.id === activeChapterId);
              if (idx >= 0 && idx < allChapters.length - 1) selectChapter(allChapters[idx + 1].id);
            }}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 新建/关闭 */}
          <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => {
            if (novel.volumes.length > 0) { setCreatingChapterInVolume(novel.volumes[0].id); setNewTitle(''); }
          }} title={t('novel.newChapter', { defaultValue: '新建章节' })} disabled={novel.volumes.length === 0}>
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => tabId && closeTab(tabId, false)}
            title={t('tabs.closeTab', { defaultValue: '关闭' })}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => closeAllTabs()}
            title={t('tabs.closeAllTabs', { defaultValue: '全关' })}>
            <XCircle className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 保存 */}
          <Button type="button" variant={isSaving ? 'secondary' : 'outline'} size="icon" className="h-5 w-5" disabled={isSaving}
            onClick={(e) => { e.stopPropagation(); handleSave(); }} title={t('editor.saveCurrent', { defaultValue: '保存' })}>
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-5 w-5" disabled={isSaving}
            onClick={(e) => { e.stopPropagation(); handleSaveAll(); }} title={t('editor.saveAll', { defaultValue: '保存全部' })}>
            <SaveAll className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 版本历史 */}
          <Button type="button" variant="outline" size="icon" className="h-5 w-5"
            onClick={() => { if (activeChapterId && chapterContent) saveSnapshot(host.storage, activeChapterId, chapterContent); setVersionOpen(true); }}
            title={t('novel.versionHistory', { defaultValue: '版本历史' })} disabled={!activeChapterId}>
            <History className="h-3.5 w-3.5" />
          </Button>
          {/* Phase 5: 仪表盘 */}
          <Button type="button" variant="outline" size="icon" className="h-5 w-5"
            onClick={() => setDashboardOpen(true)}
            title={t('novel.dashboard', { defaultValue: '仪表盘' })}>
            <BarChart3 className="h-3.5 w-3.5" />
          </Button>
          {/* Phase 6: 导出 */}
          <Button type="button" variant="outline" size="icon" className="h-5 w-5"
            onClick={() => setExportOpen(true)}
            title={t('novel.exportNovel', { defaultValue: '导出全书' })}>
            <FileDown className="h-3.5 w-3.5" />
          </Button>
          {/* N2.3: 全书搜索 */}
          <Button type="button" variant="outline" size="icon" className="h-5 w-5"
            onClick={() => setSearchOpen(true)}
            title={t('novel.searchNovel', { defaultValue: '全书搜索 (⌘F)' })}>
            <Search className="h-3.5 w-3.5" />
          </Button>
          {/* 情节线 */}
          <Button type="button" variant="outline" size="icon" className="h-5 w-5"
            onClick={() => setPlotlineViewOpen(true)}
            title={t('novel.plotlineView', { defaultValue: '情节线' })}>
            <GitBranch className="h-3.5 w-3.5" />
          </Button>
          {/* 视图切换 */}
          <div className="flex items-center border rounded overflow-hidden h-5">
            <button className={cn('px-1 h-full', viewMode === 'editor' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setViewMode('editor')} title={t('novel.viewEditor', { defaultValue: '编辑视图' })}>
              <PenLine className="h-3 w-3" />
            </button>
            <button className={cn('px-1 h-full border-l', viewMode === 'outline' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setViewMode('outline')} title={t('novel.viewOutline', { defaultValue: '大纲视图' })}>
              <List className="h-3 w-3" />
            </button>
            <button className={cn('px-1 h-full border-l', viewMode === 'corkboard' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setViewMode('corkboard')} title={t('novel.viewCorkboard', { defaultValue: '索引卡' })}>
              <LayoutGrid className="h-3 w-3" />
            </button>
          </div>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* 设定集弹窗 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-5 px-1.5 gap-0.5" title={t('novel.settings', { defaultValue: '设定集' })}>
                <BookMarked className="h-3.5 w-3.5" />
                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(['synopsis', 'outline', 'characters', 'relations', 'locations', 'factions', 'foreshadowing', 'timeline', 'worldview', 'materials'] as const).map(tab => (
                <DropdownMenuItem key={tab} className="text-xs" onClick={() => { setSettingsDialogTab(tab); setSettingsDialogOpen(true); }}>
                  {{synopsis:'梗概',outline:'大纲',characters:'人物',relations:'关系',locations:'地点',factions:'阵营',foreshadowing:'伏笔',timeline:'时间线',worldview:'世界观',materials:'素材库'}[tab]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* 分屏对照 */}
          <Button variant={splitMode ? 'default' : 'outline'} size="icon" className="h-5 w-5"
            onClick={() => {
              if (!splitMode) {
                // 打开分屏：加载上一章内容到下半屏
                const idx = allChapters.findIndex(c => c.id === activeChapterId);
                if (idx > 0) {
                  const prevCh = getChapterById(novel, allChapters[idx - 1].id);
                  if (prevCh) {
                    setSplitContent(prevCh.scenes && prevCh.scenes.length > 0
                      ? prevCh.scenes.map(s => s.content).join('\n\n') : prevCh.content);
                    setSplitChapterId(allChapters[idx - 1].id);
                  }
                }
                setSplitMode(true);
              } else {
                setSplitMode(false);
              }
            }}
            title={t('novel.splitMode', { defaultValue: '分屏对照' })}>
            <Columns className="h-3.5 w-3.5" />
          </Button>
          {/* 拼接编辑模式 */}
          <Button variant={scriveningsMode ? 'default' : 'outline'} size="icon" className="h-5 w-5"
            disabled={!activeChapterId || !activeChapter?.scenes || activeChapter.scenes.length === 0}
            onClick={() => {
              if (!scriveningsMode && activeChapterId && activeChapter?.scenes && activeChapter.scenes.length > 0) {
                const joined = joinScenes(activeChapter.scenes);
                setChapterContent(joined);
                setScriveningsMode(true);
                setActiveSceneId(null);
              } else if (scriveningsMode && activeChapterId) {
                const parts = splitFromJoined(chapterContent);
                const ch = getChapterById(novel, activeChapterId);
                if (ch?.scenes) {
                  const updated = { ...novel, volumes: novel.volumes.map(v => ({ ...v, chapters: v.chapters.map(c => c.id === activeChapterId ? { ...c, scenes: applyJoinedToScenes(c.scenes || [], parts) } : c) })) };
                  saveNovel(updated);
                }
                setScriveningsMode(false);
                selectChapter(activeChapterId);
              }
            }}
            title={t('novel.scriveningsMode', { defaultValue: '拼接编辑' })}>
            <BookOpen className="h-3.5 w-3.5" />
          </Button>
          {/* 专注模式 */}
          <Button variant={focusMode ? 'default' : 'outline'} size="icon" className="h-5 w-5" onClick={handleFocus}
            title={t('novel.focusMode', { defaultValue: '专注模式 (⌘E)' })}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          {/* 打字机模式 */}
          <Button variant={typewriterMode ? 'default' : 'outline'} size="icon" className="h-5 w-5" onClick={handleToggleTypewriter}
            title={t('novel.typewriterMode', { defaultValue: '打字机模式' })}>
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          {/* 对话聚焦 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={linguisticFocus !== 'off' ? 'default' : 'outline'} size="icon" className="h-5 w-5"
                title={t('novel.linguisticFocus', { defaultValue: '对话聚焦' })}>
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem className="text-xs" onClick={() => setLinguisticFocus('off')}>
                {linguisticFocus === 'off' ? '◀ ' : ''}关闭
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={() => setLinguisticFocus('dialogue')}>
                {linguisticFocus === 'dialogue' ? '◀ ' : ''}对话聚焦
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={() => setLinguisticFocus('narration')}>
                {linguisticFocus === 'narration' ? '◀ ' : ''}叙述聚焦
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* 编辑器外观设置 */}
          <NovelEditorSettings storage={host.storage} appearance={editorAppearance} onAppearanceChange={setEditorAppearance} />
          <div className="flex-1" />
          {/* AI 开关 */}
          <Button variant={rightCollapsed ? 'outline' : 'default'} size="icon" className="h-5 w-5"
            onClick={() => setRightCollapsed(!rightCollapsed)}
            title={rightCollapsed ? t('novel.showAI', { defaultValue: '打开 AI' }) : t('novel.hideAI', { defaultValue: '关闭 AI' })}>
            {rightCollapsed ? <PanelRightOpen className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* 章节目标进度条 */}
        {activeChapter?.wordGoal && activeChapter.wordGoal > 0 && (() => {
          const pct = Math.min(100, Math.round(chapterWords / activeChapter.wordGoal * 100));
          return (
            <div className="h-[3px] bg-muted flex-shrink-0" title={`${chapterWords}/${activeChapter.wordGoal} (${pct}%)`}>
              <div className={cn('h-full transition-all',
                pct < 50 ? 'bg-red-400' : pct < 80 ? 'bg-yellow-400' : pct <= 100 ? 'bg-green-400' : 'bg-blue-400'
              )} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          );
        })()}

        {/* 编辑区 / 大纲视图 / 索引卡视图 */}
        {viewMode === 'outline' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <NovelOutlineView novel={novel} onNovelChange={saveNovel} onSelectChapter={(id) => { setViewMode('editor'); selectChapter(id); }} onSelectScene={(chId, scId) => { setViewMode('editor'); selectScene(chId, scId); }} characters={novel.settings.characters} />
          </div>
        )}
        {viewMode === 'corkboard' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <NovelCorkboardView novel={novel} onNovelChange={saveNovel} onSelectChapter={(id) => { setViewMode('editor'); selectChapter(id); }} onSelectScene={(chId, scId) => { setViewMode('editor'); selectScene(chId, scId); }} />
          </div>
        )}
        {viewMode === 'editor' && <div className={cn(
          'flex-1 min-h-0 overflow-hidden',
          focusMode && 'px-[12%]',
          typewriterMode && 'novel-typewriter-mode',
          focusMode && 'novel-focus-dim',
          splitMode && 'flex flex-col',
        )} style={getAppearanceStyle(editorAppearance)}>
          {activeChapter ? (
            splitMode ? (
              <>
                <div className="flex-1 min-h-0 border-b">
                  <div style={getEditorInnerStyle(editorAppearance)}>
                    <MarkdownEditor value={chapterContent} onChange={handleChapterChange}
                      placeholder={t('novel.editorPlaceholder', { defaultValue: '开始书写...' })}
                      theme="light" editorRef={cmEditorRef} showStatusBar={false} enableSelectionToolbar={false}
                      textIndent={editorAppearance.textIndent} />
                  </div>
                </div>
                <div className="flex-shrink-0 px-2 py-0.5 bg-muted/30 text-[10px] text-muted-foreground border-b">
                  对照：{splitChapterId ? allChapters.find(c => c.id === splitChapterId)?.title || '' : '（无）'}
                </div>
                <div className="flex-1 min-h-0">
                  <div style={getEditorInnerStyle(editorAppearance)}>
                    <MarkdownEditor value={splitContent} onChange={setSplitContent}
                      placeholder="对照内容..."
                      theme="light" showStatusBar={false} enableSelectionToolbar={false}
                      textIndent={editorAppearance.textIndent} />
                  </div>
                </div>
              </>
            ) : (
              <div style={getEditorInnerStyle(editorAppearance)}>
                <MarkdownEditor value={chapterContent} onChange={handleChapterChange}
                  placeholder={t('novel.editorPlaceholder', { defaultValue: '开始书写...' })}
                  theme="light" editorRef={cmEditorRef} showStatusBar={false} enableSelectionToolbar={false}
                  textIndent={editorAppearance.textIndent} />
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-md">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/20" />
                <div className="text-muted-foreground">
                  <p className="text-base font-medium mb-1">小说创作工作台</p>
                  <p className="text-sm">在左侧选择或创建一个章节开始写作</p>
                </div>
                {/* 全书统计概览 */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border bg-card p-2">
                    <div className="text-lg font-bold text-foreground">{totalWords > 9999 ? `${(totalWords/10000).toFixed(1)}万` : totalWords}</div>
                    <div className="text-[10px] text-muted-foreground">全书字数</div>
                  </div>
                  <div className="rounded-lg border bg-card p-2">
                    <div className="text-lg font-bold text-foreground">{novel.volumes.length}卷{totalChapters}章</div>
                    <div className="text-[10px] text-muted-foreground">结构</div>
                  </div>
                  <div className="rounded-lg border bg-card p-2">
                    <div className="text-lg font-bold text-green-600">+{getTodayWordCount(novel)}</div>
                    <div className="text-[10px] text-muted-foreground">今日写作</div>
                  </div>
                </div>
                {/* 最近编辑章节 */}
                {allChapters.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">快速开始</p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {allChapters.slice(0, 5).map(ch => (
                        <button key={ch.id} onClick={() => selectChapter(ch.id)}
                          className="text-xs px-2.5 py-1 rounded-md border hover:bg-accent transition-colors">
                          {ch.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* 加载示例小说 */}
                {novel.volumes.every(v => v.chapters.every(c => !c.content && (!c.scenes || c.scenes.length === 0))) && (
                  <button
                    className="text-xs px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                    onClick={() => { const demo = createDemoNovelContent(); saveNovel(demo); setExpandedVolumes(new Set(demo.volumes.map(v => v.id))); }}>
                    📖 加载示例小说《断剑山庄》
                  </button>
                )}
              </div>
            </div>
          )}
        </div>}

        {/* 章节信息面板 */}
        <NovelChapterInfo
          chapter={activeChapter}
          characters={novel.settings.characters}
          onUpdateOutline={handleUpdateOutline}
          onUpdateSummary={handleUpdateSummary}
          onUpdateNotes={handleUpdateNotes}
          onUpdateStatus={handleUpdateStatus}
          onUpdateMeta={(patch) => {
            if (!activeChapterId) return;
            saveNovel(updateChapterMeta(novel, activeChapterId, patch));
          }}
        />

        {/* 状态栏 */}
        {!focusMode && (
          <NovelStatusBar
            saveStatus={saveStatus}
            activeChapter={activeChapter}
            chapterWords={chapterWords}
            paragraphCount={paragraphCount}
            readingTimeMin={readingTimeMin}
            novel={novel}
            totalWords={totalWords}
            totalChapters={totalChapters}
            cmEditorRef={cmEditorRef}
            pomodoroState={pomodoroState}
            pomodoroRemaining={pomodoroRemaining}
            onPomodoroToggle={handlePomodoroToggle}
            dailyGoalReached={dailyGoalReached}
          />
        )}
      </div>

      {/* ═══ 右栏：AI 写作助手 ═══ */}
      {!rightCollapsed && (
        <>
          <ResizableHandle direction="horizontal" onResize={(d) => setRightWidth(w => Math.min(500, Math.max(220, w - d)))} />
          <div className="flex-shrink-0 h-full overflow-hidden border-l" style={{ width: rightWidth }}>
            <NovelAISidebar
              host={host}
              novel={novel}
              activeChapterId={activeChapterId}
              activeSceneId={activeSceneId}
              onInsertToDoc={handleInsertToDoc}
              onInsertAtCursor={handleInsertAtCursor}
            />
          </div>
        </>
      )}

      {/* ═══ 右键菜单 ═══ */}
      <NovelChapterContextMenu
        novel={novel}
        target={ctxTarget}
        position={ctxPos}
        onClose={() => setCtxTarget(null)}
        onRenameVolume={(id) => { setRenamingId(id); setRenameValue(novel.volumes.find(v => v.id === id)?.title || ''); }}
        onDeleteVolume={handleDeleteVolume}
        onMoveVolumeUp={(id) => saveNovel(moveVolumeUp(novel, id))}
        onMoveVolumeDown={(id) => saveNovel(moveVolumeDown(novel, id))}
        onAddChapterInVolume={(id) => { setCreatingChapterInVolume(id); setNewTitle(''); }}
        onRenameChapter={(id) => { setRenamingId(id); setRenameValue(getChapterById(novel, id)?.title || ''); }}
        onDeleteChapter={handleDeleteChapter}
        onMoveChapterUp={(id) => saveNovel(moveChapterUp(novel, id))}
        onMoveChapterDown={(id) => saveNovel(moveChapterDown(novel, id))}
        onChangeChapterStatus={(id, status) => saveNovel(updateChapterStatus(novel, id, status))}
        onMoveChapterToVolume={(chId, volId) => saveNovel(moveChapterToVolume(novel, chId, volId))}
        onInsertChapterBefore={(id) => saveNovel(insertChapterBefore(novel, id, '新章节'))}
        onInsertChapterAfter={(id) => saveNovel(insertChapterAfter(novel, id, '新章节'))}
        onDuplicateChapter={(id) => saveNovel(duplicateChapter(novel, id))}
        onSplitChapter={(id) => {
          const ch = getChapterById(novel, id);
          if (ch && ch.content.length > 0) {
            const mid = Math.floor(ch.content.length / 2);
            const splitPos = ch.content.indexOf('\n', mid);
            saveNovel(splitChapter(novel, id, splitPos > 0 ? splitPos : mid));
          }
        }}
        onSetColorLabel={(id, color) => saveNovel(updateChapterMeta(novel, id, { colorLabel: color }))}
        onSetSceneType={(id, sceneType) => saveNovel(updateChapterMeta(novel, id, { sceneType: sceneType as NovelChapter['sceneType'] }))}
        onMergeWithNext={(id) => {
          // 找到当前章节和下一章
          for (const v of novel.volumes) {
            const sorted = [...v.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
            const idx = sorted.findIndex(c => c.id === id);
            if (idx >= 0 && idx < sorted.length - 1) {
              saveNovel(mergeChapters(novel, id, sorted[idx + 1].id));
              break;
            }
          }
        }}
      />

      {/* ═══ 设定集弹窗 ═══ */}
      <NovelSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        initialTab={settingsDialogTab}
        novel={novel}
        activeChapterId={activeChapterId}
        onNovelChange={saveNovel}
        host={host}
        documentId={doc.id}
      />

      {/* ═══ Phase 2: 选中文本浮动工具栏 ═══ */}
      <NovelSelectionToolbar
        editorRef={cmEditorRef}
        host={host}
        novel={novel}
        activeChapterId={activeChapterId}
        visible={selToolbar.visible}
        position={{ x: selToolbar.x, y: selToolbar.y }}
        selectedText={selToolbar.text}
        onClose={() => setSelToolbar(prev => ({ ...prev, visible: false }))}
        onReplace={handleSelReplace}
        onInsertAfter={handleSelInsertAfter}
      />

      {/* ═══ Phase 5: 仪表盘弹窗 ═══ */}
      <NovelDashboard open={dashboardOpen} onOpenChange={setDashboardOpen} novel={novel} />

      {/* ═══ Phase 6: 导出弹窗 ═══ */}
      <NovelExportDialog open={exportOpen} onOpenChange={setExportOpen} novel={novel} documentId={doc.id} projectId={doc.projectId} />

      {/* ═══ Phase 11: 版本历史弹窗 ═══ */}
      <NovelVersionDialog
        open={versionOpen}
        onOpenChange={setVersionOpen}
        chapterId={activeChapterId}
        chapterTitle={activeChapter?.title || ''}
        currentContent={chapterContent}
        storage={host.storage}
        onRestore={(content) => {
          setChapterContent(content);
          if (activeChapterId) {
            const updated = updateChapterContent(novel, activeChapterId, content);
            saveNovel(updated);
          }
        }}
        onManualSave={() => {
          if (activeChapterId && chapterContent) {
            saveSnapshot(host.storage, activeSceneId || activeChapterId, chapterContent, '手动保存');
            setVersionOpen(false);
            setTimeout(() => setVersionOpen(true), 100);
          }
        }}
      />

      {/* ═══ 情节线弹窗 ═══ */}
      <NovelPlotlineView
        open={plotlineViewOpen}
        onOpenChange={setPlotlineViewOpen}
        novel={novel}
        onNovelChange={saveNovel}
        onJumpToScene={(chId, scId) => {
          if (scId) selectScene(chId, scId);
          else selectChapter(chId);
        }}
      />

      {/* ═══ N2.3: 全书搜索弹窗 ═══ */}
      <NovelSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        novel={novel}
        onNovelChange={saveNovel}
        onJumpToChapter={selectChapter}
      />

      {/* ═══ Phase 2.2/2.3: 内联 AI + 虚影预览 ═══ */}
      {activeChapterId && (
        <NovelInlineAI editorRef={cmEditorRef} host={host} novel={novel} activeChapterId={activeChapterId} />
      )}
    </div>
  );
}
