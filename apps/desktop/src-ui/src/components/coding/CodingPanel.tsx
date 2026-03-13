import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCodingStore, nextTabId, detectLangFromExt } from '@/stores/useCodingStore';
import { formatBackendError } from '@/lib/backendError';
import type { CodingTab } from '@/stores/useCodingStore';
import { CodingAssistantPanel } from './CodingAssistantPanel';
import { getApiServerPort, isApiServerReady } from '@/api/ApiBridge';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import { CodingFileTree } from './CodingFileTree';
import { useCodingEditorExtensions } from './useCodingEditorExtensions';
import { CodingOutput } from './CodingOutput';
import { CodingSettingsPopover } from './CodingSettingsPopover';
import { useCodingScriptRunner } from './useCodingScriptRunner';
// CodingDialogs 组件在内联实现，保留引用备用
// import { GotoLineDialog, CommandPalette, ShortcutsDialog, TabContextMenu } from './CodingDialogs';
import { DEFAULT_TEMPLATES, NEW_FILE_TYPES, SUPPORTED_EXTENSIONS } from './CodingPanel.constants';
import type { PythonInterpreter } from './CodingPanel.constants';
import {
  Play, FilePlus, FolderOpen, Save,
  Star, StarOff, ChevronDown, ChevronRight,
  Loader2, CheckCircle, XCircle, Clock, GripHorizontal, X,
  MessageSquare, PanelRightOpen, PanelRightClose,
  Eye, FileCode, Maximize2, Minimize2,
  Undo2, Redo2, WrapText, Keyboard, Hash,
  PanelLeftOpen, PanelLeftClose, History,
  Copy, Pencil,
} from 'lucide-react';

const CodeMirror = lazy(() => import('@uiw/react-codemirror'));

// ── SortableTab 子组件 ──

function SortableTab({
  tab, active, onSelect, onClose, closeTitle, onContextMenu,
}: {
  tab: CodingTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  closeTitle: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-1 px-2.5 py-1 text-sm cursor-pointer border-r select-none whitespace-nowrap transition-colors ${
        active ? 'bg-background text-foreground border-b-2 border-b-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      } ${isDragging ? 'opacity-70 z-10' : ''}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      {...attributes} {...listeners}
    >
      <span className="max-w-[120px] truncate">
        {tab.dirty && <span className="text-amber-500 mr-0.5">●</span>}
        {tab.title}
      </span>
      <button
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title={closeTitle}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ── 主组件 ──

export function CodingPanel() {
  const { t } = useTranslation();
  const store = useCodingStore();

  // 初始化
  useEffect(() => { store.init(); }, []);

  const {
    tabs, activeTabId, favorites, settings, scriptsDir, initialized, runHistory, recentFiles,
    addTab, removeTab, setActiveTab, updateTab, saveFile, toggleFavorite, updateSettings, reorderTabs,
    clearRunHistory, addRecentFile, clearRecentFiles,
  } = store;

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  // ── Python 解释器选择器状态 ──
  const [pythonList, setPythonList] = useState<PythonInterpreter[]>([]);
  const [pythonListLoaded, setPythonListLoaded] = useState(false);
  const [pythonPopoverOpen, setPythonPopoverOpen] = useState(false);

  // ── 编辑器 ──
  const [outputHeight, setOutputHeight] = useState(settings.outputHeight || 200);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [outputPreview, setOutputPreview] = useState(false);
  const [maximized, setMaximized] = useState<'none' | 'editor' | 'output'>('none');
  const draggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  // ── AI 助手面板 ──
  const [assistantOpen, setAssistantOpen] = useState(settings.assistantOpen ?? true);
  const [assistantWidth, setAssistantWidth] = useState(settings.assistantWidth || 420);

  // ── 文件树面板 ──
  const [fileTreeOpen, setFileTreeOpen] = useState(settings.fileTreeOpen ?? false);
  const [fileTreeWidth, setFileTreeWidth] = useState(settings.fileTreeWidth || 200);
  const ftDragRef = useRef(false);
  const ftDragStartXRef = useRef(0);
  const ftDragStartWidthRef = useRef(0);

  // ── 运行历史面板 ──
  const [runHistoryOpen, setRunHistoryOpen] = useState(false);

  // ── 收藏面板 ──
  const [favOpen, setFavOpen] = useState(false);

  // ── 输出区 ref（供 CodeMirror 快捷键滚动） ──
  const outputRef = useRef<HTMLPreElement | null>(null);

  // ── 编辑器增强 ──
  const editorViewRef = useRef<any>(null);
  const [selectedCode, setSelectedCode] = useState('');
  const [wordWrap, setWordWrap] = useState(false);
  const [gotoLineOpen, setGotoLineOpen] = useState(false);
  const [gotoLineValue, setGotoLineValue] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [cmdPaletteQuery, setCmdPaletteQuery] = useState('');

  // ── DnD sensors ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── 状态栏 ──
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg); setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  // ── 脚本运行（委托给 hook） ──
  const {
    running, lastResult, setLastResult, canRun, handleRun, handleKillScript,
    pythonInfo, detecting, nodeInfo, nodeDetecting,
  } = useCodingScriptRunner({ activeTab, showStatus });

  // ── API Server 状态 ──
  const [apiReady, setApiReady] = useState(isApiServerReady());
  const [apiPort, setApiPort] = useState(getApiServerPort());
  useEffect(() => {
    const timer = setInterval(() => {
      setApiReady(isApiServerReady());
      setApiPort(getApiServerPort());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // ── 初始化：从缓存或异步检测 Python / Node.js ──
  useEffect(() => {
    store.detectPython();
    store.detectNode();
  }, []);

  // ── 用户修改自定义路径时强制重新检测 ──
  const prevPythonPathRef = useRef(settings.customPythonPath);
  const prevNodePathRef = useRef(settings.customNodePath);
  useEffect(() => {
    if (settings.customPythonPath !== prevPythonPathRef.current) {
      prevPythonPathRef.current = settings.customPythonPath;
      store.detectPython(true);
    }
  }, [settings.customPythonPath]);
  useEffect(() => {
    if (settings.customNodePath !== prevNodePathRef.current) {
      prevNodePathRef.current = settings.customNodePath;
      store.detectNode(true);
    }
  }, [settings.customNodePath]);

  // ── 运行/保存/跳转行 Refs（供 CodeMirror 快捷键使用） ──
  const handleRunRef = useRef<(() => void) | null>(null);
  const handleSaveRef = useRef<(() => void) | null>(null);
  const gotoLineRef = useRef<(() => void) | null>(null);

  // ── CodeMirror 扩展（动态语言加载） ──
  const activeLang = activeTab?.language || 'text';
  const { cmExts, cmTheme } = useCodingEditorExtensions({
    activeLang,
    wordWrap,
    editorTheme: settings.editorTheme,
    handleRunRef,
    handleSaveRef,
    gotoLineRef,
    outputRef,
  });

  // ── 编辑器操作 ──
  useEffect(() => {
    gotoLineRef.current = () => { setGotoLineOpen(true); setGotoLineValue(''); };
  }, []);

  const handleUndo = useCallback(() => {
    const view = editorViewRef.current;
    if (view) { import('@codemirror/commands').then(m => m.undo(view)); }
  }, []);

  const handleRedo = useCallback(() => {
    const view = editorViewRef.current;
    if (view) { import('@codemirror/commands').then(m => m.redo(view)); }
  }, []);

  const handleGotoLine = useCallback((lineNum: number) => {
    const view = editorViewRef.current;
    if (!view) return;
    const doc = view.state.doc;
    const line = Math.max(1, Math.min(lineNum, doc.lines));
    const pos = doc.line(line).from;
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
    setGotoLineOpen(false);
  }, []);

  // 标签页右键菜单操作
  const handleCloseOtherTabs = useCallback((keepTabId: string) => {
    tabs.filter(t => t.id !== keepTabId).forEach(t => removeTab(t.id));
    setTabCtxMenu(null);
  }, [tabs, removeTab]);

  const handleCloseTabsToRight = useCallback((tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;
    tabs.slice(idx + 1).forEach(t => removeTab(t.id));
    setTabCtxMenu(null);
  }, [tabs, removeTab]);

  const handleCopyPath = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) navigator.clipboard.writeText(tab.filePath);
    setTabCtxMenu(null);
  }, [tabs]);

  useEffect(() => { handleRunRef.current = handleRun; }, [handleRun]);

  // ── 标签操作 ──
  const [newFileMenuOpen, setNewFileMenuOpen] = useState(false);

  const handleNewWithType = useCallback((ext: string, lang: string) => {
    const existingNames = tabs.map(t => t.filePath);
    let idx = 1;
    while (existingNames.includes(`untitled_${idx}.${ext}`)) idx++;
    const fileName = `untitled_${idx}.${ext}`;
    addTab({
      id: nextTabId(),
      filePath: fileName,
      title: fileName,
      code: DEFAULT_TEMPLATES[lang] || '',
      language: lang,
      dirty: true,
      outputLines: [],
      lastExitCode: null,
    });
    setNewFileMenuOpen(false);
  }, [tabs, addTab]);

  const handleNew = useCallback(() => {
    // 使用当前活动语言的扩展名和语言标识
    const currentLang = activeTab?.language || 'python';
    const ft = NEW_FILE_TYPES.find(f => f.lang === currentLang) || NEW_FILE_TYPES[0];
    handleNewWithType(ft.ext, ft.lang);
  }, [handleNewWithType, activeTab]);

  const handleClose = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.dirty) {
      if (!window.confirm(t('coding.confirmClose', { defaultValue: '该文件有未保存的更改，确定关闭？' }))) return;
    }
    if (tabs.length <= 1) {
      // 最后一个标签页，替换为新标签页（使用当前关闭标签的语言）
      const closingTab = tabs.find(tb => tb.id === tabId);
      const lang = closingTab?.language || 'python';
      const ft = NEW_FILE_TYPES.find(f => f.lang === lang) || NEW_FILE_TYPES[0];
      const fileName = `untitled_1.${ft.ext}`;
      const newTab: CodingTab = {
        id: nextTabId(),
        filePath: fileName,
        title: fileName,
        code: DEFAULT_TEMPLATES[ft.lang] || '',
        language: ft.lang,
        dirty: true,
        outputLines: [],
        lastExitCode: null,
      };
      removeTab(tabId);
      addTab(newTab);
      return;
    }
    removeTab(tabId);
  }, [tabs, removeTab, addTab, t]);

  const handleOpen = useCallback(async () => {
    try {
      const result = await open({
        filters: [
          { name: '所有支持的文件', extensions: SUPPORTED_EXTENSIONS },
          { name: 'Python', extensions: ['py'] },
          { name: 'HTML', extensions: ['html', 'htm'] },
          { name: 'JavaScript', extensions: ['js', 'jsx'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'Markdown', extensions: ['md'] },
          { name: '所有文件', extensions: ['*'] },
        ],
        multiple: false,
      });
      if (!result) return;
      const filePath = typeof result === 'string' ? result : (result as any).path || String(result);
      if (!filePath) return;

      // 检查是否已打开
      const existing = tabs.find(t => t.filePath === filePath);
      if (existing) { setActiveTab(existing.id); return; }

      const content = await invoke<string>('read_coding_script', { filePath });
      const name = filePath.split(/[/\\]/).pop() || 'untitled.txt';
      addTab({
        id: nextTabId(),
        filePath,
        title: name,
        code: content,
        language: detectLangFromExt(name),
        dirty: false,
        outputLines: [],
        lastExitCode: null,
      });
    } catch (err) { showStatus(formatBackendError(err), true); }
  }, [tabs, addTab, setActiveTab, showStatus]);

  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    try {
      await saveFile(activeTab.id);
      showStatus(`✅ ${t('coding.saved', { defaultValue: '已保存' })}: ${activeTab.title}`);
    } catch (err) { showStatus(formatBackendError(err), true); }
  }, [activeTab, saveFile, showStatus, t]);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  // ── 自动保存（debounce 1.5s） ──
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSave = useCallback((tabId: string) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveFile(tabId);
      } catch { /* 静默失败 */ }
    }, 1500);
  }, [saveFile]);
  useEffect(() => { return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); }; }, []);

  // ── 收藏 ──
  const handleToggleFavorite = useCallback(() => {
    if (!activeTab) return;
    toggleFavorite(activeTab.filePath);
  }, [activeTab, toggleFavorite]);

  const handleSelectFavorite = useCallback(async (filePath: string) => {
    const existing = tabs.find(t => t.filePath === filePath);
    if (existing) { setActiveTab(existing.id); return; }
    try {
      const content = await invoke<string>('read_coding_script', { filePath });
      const name = filePath.split(/[/\\]/).pop() || 'untitled.txt';
      addTab({
        id: nextTabId(),
        filePath,
        title: name,
        code: content,
        language: detectLangFromExt(name),
        dirty: false,
        outputLines: [],
        lastExitCode: null,
      });
    } catch (err) { showStatus(formatBackendError(err), true); }
  }, [tabs, addTab, setActiveTab, showStatus]);

  // ── 拖拽分隔条 ──
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = outputHeight;
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const newH = Math.max(80, Math.min(600, dragStartHeightRef.current - (ev.clientY - dragStartYRef.current)));
      setOutputHeight(newH);
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [outputHeight]);

  // ── AI 助手面板水平拖拽 ──
  const handleAssistResize = useCallback((delta: number) => {
    setAssistantWidth(prev => Math.max(240, Math.min(600, prev - delta)));
  }, []);

  // ── 文件树面板水平拖拽 ──
  const handleFtDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    ftDragRef.current = true;
    ftDragStartXRef.current = e.clientX;
    ftDragStartWidthRef.current = fileTreeWidth;
    const onMove = (ev: MouseEvent) => {
      if (!ftDragRef.current) return;
      const delta = ev.clientX - ftDragStartXRef.current;
      setFileTreeWidth(Math.max(140, Math.min(400, ftDragStartWidthRef.current + delta)));
    };
    const onUp = () => {
      ftDragRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [fileTreeWidth]);

  // ── 布局记忆：debounce 保存到 settings ──
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current);
    layoutTimerRef.current = setTimeout(() => {
      updateSettings({ outputHeight, assistantWidth, assistantOpen, fileTreeOpen, fileTreeWidth });
    }, 500);
    return () => { if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current); };
  }, [outputHeight, assistantWidth, assistantOpen, fileTreeOpen, fileTreeWidth, updateSettings]);

  // ── 文件树打开文件 ──
  const handleOpenFileFromTree = useCallback(async (relativePath: string) => {
    // 检查是否已有标签页打开
    const existing = tabs.find(t => t.filePath === relativePath);
    if (existing) {
      setActiveTab(existing.id);
      return;
    }
    try {
      const code = await invoke<string>('read_coding_script', { filePath: relativePath });
      const fname = relativePath.replace(/^.*[\\/]/, '');
      const tab: CodingTab = {
        id: nextTabId(),
        filePath: relativePath,
        title: fname,
        code,
        language: detectLangFromExt(fname),
        dirty: false,
        outputLines: [],
        lastExitCode: null,
      };
      addTab(tab);
      addRecentFile(relativePath);
    } catch (e) {
      console.error('打开文件失败:', e);
    }
  }, [tabs, setActiveTab, addTab, addRecentFile]);

  // ── 拖放文件打开 ──
  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>('tauri://drag-drop', async (event) => {
      const paths = event.payload?.paths;
      if (!paths || paths.length === 0) return;
      for (const absPath of paths) {
        const fname = absPath.replace(/^.*[\\/]/, '');
        const ext = fname.split('.').pop()?.toLowerCase() || '';
        if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;
        // 复制到脚本目录并打开
        try {
          const content = await invoke<string>('read_external_file', { path: absPath }).catch(() => null);
          if (content === null) continue;
          await invoke('save_coding_script', { filePath: fname, content });
          // 打开
          const existing = tabs.find(t => t.filePath === fname);
          if (existing) {
            updateTab(existing.id, { code: content, dirty: false });
            setActiveTab(existing.id);
          } else {
            addTab({
              id: nextTabId(), filePath: fname, title: fname,
              code: content, language: detectLangFromExt(fname),
              dirty: false, outputLines: [], lastExitCode: null,
            });
          }
        } catch (e) {
          console.error('拖放打开失败:', e);
        }
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [tabs, setActiveTab, addTab, updateTab]);

  // ── AI 助手上下文数据 ──
  const assistantLastOutput = useMemo(() => {
    if (!activeTab) return '';
    return activeTab.outputLines.filter(l => l.type === 'stdout').map(l => l.text).join('\n');
  }, [activeTab?.outputLines]);

  const assistantLastError = useMemo(() => {
    if (!activeTab) return '';
    return activeTab.outputLines.filter(l => l.type === 'stderr').map(l => l.text).join('\n');
  }, [activeTab?.outputLines]);

  const handleApplyCode = useCallback((code: string) => {
    if (!activeTab) return;
    updateTab(activeTab.id, { code, dirty: true });
    showStatus('✅ 代码已应用到编辑器');
  }, [activeTab, updateTab, showStatus]);

  const applyAndRunRef = useRef(false);
  const handleApplyAndRun = useCallback((code: string) => {
    if (!activeTab) return;
    updateTab(activeTab.id, { code, dirty: true });
    showStatus('✅ 代码已应用，正在运行...');
    applyAndRunRef.current = true;
    // 延迟一帧等 state 更新后再触发 handleRun
    setTimeout(() => {
      if (applyAndRunRef.current) {
        applyAndRunRef.current = false;
        handleRun();
      }
    }, 100);
  }, [activeTab, updateTab, showStatus, handleRun]);

  // ── DnD 标签排序 ──
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderTabs(String(active.id), String(over.id));
  }, [tabs, reorderTabs]);

  // ── Python 状态指示（可点击切换解释器） ──
  const pythonStatusEl = useMemo(() => {
    if (detecting) return <span className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{t('coding.detecting', { defaultValue: '检测中...' })}</span>;

    const statusContent = pythonInfo?.available
      ? <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1 cursor-pointer hover:underline"><CheckCircle className="h-3 w-3" />Python {pythonInfo.version}<ChevronDown className="h-2.5 w-2.5 opacity-60" /></span>
      : <span className="text-sm text-destructive flex items-center gap-1 cursor-pointer hover:underline"><XCircle className="h-3 w-3" />{t('coding.pythonNotFound', { defaultValue: '未找到 Python' })}<ChevronDown className="h-2.5 w-2.5 opacity-60" /></span>;

    return (
      <Popover open={pythonPopoverOpen} onOpenChange={(open) => {
          setPythonPopoverOpen(open);
          if (open && !pythonListLoaded) {
            invoke<PythonInterpreter[]>('discover_pythons').then(list => {
              setPythonList(list || []);
              setPythonListLoaded(true);
            }).catch(() => { setPythonListLoaded(true); });
          }
        }}>
        <PopoverTrigger asChild>
          {statusContent}
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-80 p-1.5 max-h-72 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">{t('coding.selectPython', { defaultValue: '选择 Python 解释器' })}</p>
          {!pythonListLoaded ? (
            <div className="text-xs text-muted-foreground px-2 py-2 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />正在搜索...</div>
          ) : pythonList.length > 0 ? pythonList.map((py, i) => (
            <button key={i}
              className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                settings.customPythonPath === py.path || (!settings.customPythonPath && pythonInfo?.path === py.path)
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => {
                updateSettings({ customPythonPath: py.path });
                setPythonPopoverOpen(false);
              }}>
              <div className="truncate">Python {py.version}</div>
              <div className="text-xs text-muted-foreground truncate">{py.path}</div>
            </button>
          )) : (
            <div className="text-xs text-muted-foreground px-2 py-2">{t('coding.noPythonFound', { defaultValue: '未发现可用的 Python 解释器' })}</div>
          )}
        </PopoverContent>
      </Popover>
    );
  }, [detecting, pythonInfo, pythonList, pythonListLoaded, pythonPopoverOpen, settings.customPythonPath, t, updateSettings]);

  // ── 输出状态指示 ──
  const outputStatusEl = useMemo(() => {
    if (running) return <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><Loader2 className="h-3 w-3 animate-spin" />{t('coding.running', { defaultValue: '运行中...' })}</span>;
    if (!lastResult) return null;
    if (lastResult.timedOut) return <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><Clock className="h-3 w-3" />{t('coding.timedOut', { defaultValue: '执行超时' })} ({(lastResult.durationMs / 1000).toFixed(2)}s)</span>;
    if (lastResult.exitCode === 0) return <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="h-3 w-3" />{(lastResult.durationMs / 1000).toFixed(2)}s</span>;
    return <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" />{t('coding.exitCode', { defaultValue: '退出码' })}: {lastResult.exitCode} ({(lastResult.durationMs / 1000).toFixed(2)}s)</span>;
  }, [running, lastResult, t]);

  // 文件名
  const fileName = useMemo(() => {
    if (!activeTab) return 'untitled.py';
    return activeTab.title || activeTab.filePath.split(/[/\\]/).pop() || 'untitled.py';
  }, [activeTab]);

  const isFav = activeTab ? favorites.includes(activeTab.filePath) : false;

  // ── 命令面板 ──
  const cmdPaletteInputRef = useRef<HTMLInputElement>(null);
  const [cmdPaletteIdx, setCmdPaletteIdx] = useState(0);

  const cmdPaletteCommands = useMemo(() => [
    { id: 'run', label: t('coding.run', { defaultValue: '运行' }), shortcut: '⌘ Enter', action: () => handleRunRef.current?.() },
    { id: 'save', label: t('coding.save', { defaultValue: '保存' }), shortcut: '⌘ S', action: () => handleSaveRef.current?.() },
    { id: 'new', label: t('coding.newScript', { defaultValue: '新建文件' }), action: handleNew },
    { id: 'open', label: t('coding.openScript', { defaultValue: '打开脚本' }), action: handleOpen },
    { id: 'undo', label: t('coding.undo', { defaultValue: '撤销' }), shortcut: '⌘ Z', action: handleUndo },
    { id: 'redo', label: t('coding.redo', { defaultValue: '重做' }), shortcut: '⌘ ⇧ Z', action: handleRedo },
    { id: 'search', label: t('coding.searchReplace', { defaultValue: '搜索 / 替换' }), shortcut: '⌘ F', action: () => { const v = editorViewRef.current; if (v) import('@codemirror/search').then(m => m.openSearchPanel(v)); } },
    { id: 'goto', label: t('coding.gotoLine', { defaultValue: '跳转到行' }), shortcut: '⌘ G', action: () => { setGotoLineOpen(true); setGotoLineValue(''); } },
    { id: 'wrap', label: t('coding.wordWrap', { defaultValue: '自动换行' }) + (wordWrap ? ' ✓' : ''), action: () => setWordWrap(v => !v) },
    { id: 'shortcuts', label: t('coding.keyboardShortcuts', { defaultValue: '快捷键参考' }), action: () => setShortcutsOpen(true) },
    { id: 'fav', label: isFav ? t('coding.removeFavorite', { defaultValue: '取消收藏' }) : t('coding.addFavorite', { defaultValue: '添加收藏' }), action: handleToggleFavorite },
    { id: 'assistant', label: t('coding.toggleAssistant', { defaultValue: 'AI 助手' }), action: () => setAssistantOpen(v => !v) },
    { id: 'maxEditor', label: maximized === 'editor' ? '还原编辑区' : '最大化编辑区', action: () => setMaximized(v => v === 'editor' ? 'none' : 'editor') },
    { id: 'maxOutput', label: maximized === 'output' ? '还原输出区' : '最大化输出区', action: () => setMaximized(v => v === 'output' ? 'none' : 'output') },
  ], [t, handleNew, handleOpen, handleUndo, handleRedo, handleToggleFavorite, wordWrap, isFav, maximized]);

  const cmdPaletteFiltered = useMemo(() => {
    if (!cmdPaletteQuery.trim()) return cmdPaletteCommands;
    const q = cmdPaletteQuery.toLowerCase();
    return cmdPaletteCommands.filter(c => c.label.toLowerCase().includes(q) || c.id.includes(q));
  }, [cmdPaletteCommands, cmdPaletteQuery]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setCmdPaletteOpen(true);
        setCmdPaletteQuery('');
        setCmdPaletteIdx(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (cmdPaletteOpen) setTimeout(() => cmdPaletteInputRef.current?.focus(), 50);
  }, [cmdPaletteOpen]);

  const executeCmdPaletteItem = useCallback((idx: number) => {
    const item = cmdPaletteFiltered[idx];
    if (item) { setCmdPaletteOpen(false); item.action(); }
  }, [cmdPaletteFiltered]);

  if (!initialized) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-base">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        {t('coding.loading', { defaultValue: '加载编程区...' })}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* ═══ 左侧：代码编辑 + 输出 ═══ */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* ═══ 工具栏 ═══ */}
      <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 border-b bg-muted/20">
        <FileCode className="h-4 w-4 text-muted-foreground mr-1" />
        {activeLang === 'python' ? pythonStatusEl
          : (activeLang === 'javascript' || activeLang === 'typescript') ? (
            nodeDetecting
              ? <span className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{t('coding.detecting', { defaultValue: '检测中...' })}</span>
              : nodeInfo?.available
                ? <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Node.js {nodeInfo.version}</span>
                : <span className="text-sm text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" />未找到 Node.js</span>
          ) : (
            <span className="text-base text-muted-foreground">{activeLang.toUpperCase()}</span>
          )
        }
        <div className="flex-1" />
        {(activeLang === 'python' || activeLang === 'javascript' || activeLang === 'typescript') ? (
          running ? (
            <Button variant="outline" size="sm" className="gap-1 h-8 text-base text-destructive" onClick={handleKillScript}
              title={t('coding.stop', { defaultValue: '停止运行' })}>
              <XCircle className="h-3 w-3" />{t('coding.stop', { defaultValue: '停止' })}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1 h-8 text-base"
              onClick={handleRun} disabled={!canRun}>
              <Play className="h-3 w-3" />{t('coding.run', { defaultValue: '运行' })}
            </Button>
          )
        ) : (activeLang === 'html' || activeLang === 'markdown') ? (
          <Button variant="outline" size="sm" className="gap-1 h-8 text-base"
            onClick={() => {
              if (!activeTab) return;
              updateTab(activeTab.id, {
                outputLines: [{ text: activeTab.code, type: 'stdout' }],
                lastExitCode: 0,
              });
              setOutputPreview(true);
            }}>
            <Eye className="h-3 w-3" />{t('coding.preview', { defaultValue: '预览' })}
          </Button>
        ) : null}
        <div className="w-px h-5 bg-border" />
        <Popover open={newFileMenuOpen} onOpenChange={setNewFileMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-base px-2 gap-0.5" title={t('coding.newScript', { defaultValue: '新建文件' })}>
              <FilePlus className="h-3 w-3" /><ChevronDown className="h-2.5 w-2.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-36 p-1">
            {NEW_FILE_TYPES.map(ft => (
              <button key={ft.ext} className="w-full text-left px-2 py-1 text-sm rounded hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => handleNewWithType(ft.ext, ft.lang)}>
                {ft.label} <span className="text-muted-foreground text-xs">.{ft.ext}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" className="h-8 text-base px-2" onClick={handleOpen} title={t('coding.openScript', { defaultValue: '打开脚本' })}>
          <FolderOpen className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-base px-2" onClick={handleSave} title={`${t('coding.save', { defaultValue: '保存' })} (⌘S)`}>
          <Save className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-base px-2" onClick={handleUndo} title={`${t('coding.undo', { defaultValue: '撤销' })} (⌘Z)`}>
          <Undo2 className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-base px-2" onClick={handleRedo} title={`${t('coding.redo', { defaultValue: '重做' })} (⌘⇧Z)`}>
          <Redo2 className="h-3 w-3" />
        </Button>
        <Button variant={wordWrap ? 'default' : 'outline'} size="sm" className="h-8 text-base px-2" onClick={() => setWordWrap(v => !v)}
          title={t('coding.wordWrap', { defaultValue: '自动换行' })}>
          <WrapText className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-base px-2" onClick={() => { setGotoLineOpen(true); setGotoLineValue(''); }}
          title={`${t('coding.gotoLine', { defaultValue: '跳转到行' })} (⌘G)`}>
          <Hash className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-base px-2" onClick={handleToggleFavorite}
          title={isFav ? t('coding.removeFavorite', { defaultValue: '取消收藏' }) : t('coding.addFavorite', { defaultValue: '添加收藏' })}>
          {isFav ? <StarOff className="h-3 w-3" /> : <Star className="h-3 w-3" />}
        </Button>
        <Button variant={fileTreeOpen ? 'default' : 'outline'} size="sm" className="h-8 text-base px-2" onClick={() => setFileTreeOpen(v => !v)}
          title={t('coding.fileExplorer', { defaultValue: '文件树' })}>
          {fileTreeOpen ? <PanelLeftClose className="h-3 w-3" /> : <PanelLeftOpen className="h-3 w-3" />}
        </Button>
        <Button variant={runHistoryOpen ? 'default' : 'outline'} size="sm" className="h-8 text-base px-2" onClick={() => setRunHistoryOpen(v => !v)}
          title={t('coding.runHistory', { defaultValue: '运行历史' })}>
          <History className="h-3 w-3" />
        </Button>
        <div className="w-px h-5 bg-border" />
        <Button variant="outline" size="sm" className="h-8 text-base px-2" onClick={() => setShortcutsOpen(true)}
          title={t('coding.keyboardShortcuts', { defaultValue: '快捷键参考' })}>
          <Keyboard className="h-3 w-3" />
        </Button>
        {/* 设置 Popover */}
        <CodingSettingsPopover
          activeLang={activeLang}
          settings={settings}
          updateSettings={updateSettings}
          runHistory={runHistory}
          clearRunHistory={clearRunHistory}
          scriptsDir={scriptsDir}
        />
        <div className="w-px h-5 bg-border" />
        <Button
          variant={assistantOpen ? 'default' : 'outline'}
          size="sm" className={`h-8 text-base px-2 gap-1 ${assistantOpen ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
          onClick={() => setAssistantOpen(v => !v)}
          title={t('coding.toggleAssistant', { defaultValue: 'AI 助手' })}>
          {assistantOpen ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
          <MessageSquare className="h-3 w-3" />
        </Button>
      </div>

      {/* ═══ 运行历史面板 ═══ */}
      {runHistoryOpen && (
        <div className="flex-shrink-0 border-b bg-muted/10 max-h-48 overflow-y-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b">
            <span className="text-xs font-medium flex-1">{t('coding.runHistory', { defaultValue: '运行历史' })}</span>
            {runHistory.length > 0 && (
              <button onClick={clearRunHistory} className="text-[10px] text-muted-foreground hover:text-foreground px-1">{t('coding.clearHistory', { defaultValue: '清除' })}</button>
            )}
            <button onClick={() => setRunHistoryOpen(false)} className="text-muted-foreground hover:text-foreground" title={t('common.close', { defaultValue: '关闭' })}>
              <X className="h-3 w-3" />
            </button>
          </div>
          {runHistory.length === 0 && (
            <div className="px-3 py-3 text-[11px] text-muted-foreground">{t('coding.noHistory', { defaultValue: '暂无运行记录' })}</div>
          )}
          {runHistory.map((entry) => (
            <div key={entry.id} className="flex items-center gap-1.5 px-3 py-1 hover:bg-muted/30 text-[11px]">
              {entry.exitCode === 0
                ? <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                : <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
              <span className="flex-1 truncate">{entry.fileName}</span>
              <span className="text-muted-foreground/60 flex-shrink-0">{entry.language}</span>
              <span className="text-muted-foreground/50 flex-shrink-0">{(entry.durationMs / 1000).toFixed(2)}s</span>
              <span className="text-muted-foreground/40 flex-shrink-0 text-[9px]">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ 标签栏（DnD可拖拽排序） ═══ */}
      <div className="flex-shrink-0 flex items-center bg-muted/30 border-b overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
            {tabs.map(tab => (
              <SortableTab
                key={tab.id}
                tab={tab}
                active={tab.id === activeTabId}
                onSelect={() => setActiveTab(tab.id)}
                onClose={() => handleClose(tab.id)}
                closeTitle={t('coding.closeTab', { defaultValue: '关闭标签' })}
                onContextMenu={(e) => { e.preventDefault(); setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id }); }}
              />
            ))}
          </SortableContext>
        </DndContext>
        <button onClick={handleNew}
          className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
          title={t('coding.newScript', { defaultValue: '新建脚本' })}>
          <FilePlus className="h-3 w-3" />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setMaximized(v => v === 'editor' ? 'none' : 'editor')}
          className="px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
          title={maximized === 'editor' ? '还原' : '最大化编辑区'}>
          {maximized === 'editor' ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </button>
      </div>

      {/* ═══ 代码编辑区（flex 自适应） ═══ */}
      <div className={`flex-1 min-h-0 flex ${maximized === 'output' ? 'hidden' : ''}`}>
        {/* 文件树侧边栏 */}
        {fileTreeOpen && (
          <>
            <div className="flex-shrink-0 overflow-hidden border-r" style={{ width: fileTreeWidth }}>
              <CodingFileTree onOpenFile={handleOpenFileFromTree} activeFilePath={activeTab?.filePath} favorites={favorites} onToggleFavorite={toggleFavorite} />
            </div>
            <div
              className="flex-shrink-0 w-1 bg-muted/40 hover:bg-primary/20 cursor-col-resize transition-colors"
              onMouseDown={handleFtDragStart}
            />
          </>
        )}
        <div className="flex-1 min-w-0 relative overflow-hidden cm-font-override">
        {/* 面包屑导航 */}
        {activeTab && activeTab.filePath && (
          <div className="flex items-center gap-0.5 px-2 py-0.5 border-b bg-muted/20 text-[11px] text-muted-foreground overflow-x-auto flex-shrink-0">
            <FolderOpen className="h-3 w-3 opacity-50 flex-shrink-0" />
            {activeTab.filePath.split(/[/\\]/).map((seg, i, arr) => (
              <span key={i} className="flex items-center gap-0.5">
                {i > 0 && <ChevronRight className="h-2.5 w-2.5 opacity-40" />}
                <span className={i === arr.length - 1 ? 'text-foreground font-medium' : 'hover:text-foreground cursor-default'}>{seg}</span>
              </span>
            ))}
          </div>
        )}
        {!activeTab ? (
          <div className="h-full flex flex-col items-center justify-center gap-6 text-muted-foreground select-none">
            <FileCode className="h-16 w-16 opacity-20" />
            <div className="text-center space-y-1">
              <h2 className="text-lg font-medium text-foreground/70">{t('coding.welcomeTitle', { defaultValue: '编程工作台' })}</h2>
              <p className="text-sm">{t('coding.welcomeSubtitle', { defaultValue: '创建或打开文件开始编程' })}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNew}>
                <FilePlus className="h-3.5 w-3.5" />{t('coding.newFile', { defaultValue: '新建文件' })}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpen}>
                <FolderOpen className="h-3.5 w-3.5" />{t('coding.openFile', { defaultValue: '打开文件' })}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFileTreeOpen(true)}>
                <PanelLeftOpen className="h-3.5 w-3.5" />{t('coding.fileExplorer', { defaultValue: '文件树' })}
              </Button>
            </div>
            {recentFiles.length > 0 && (
              <div className="text-center space-y-2 mt-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-muted-foreground/60">{t('coding.recentFiles', { defaultValue: '最近文件' })}</span>
                  <button onClick={clearRecentFiles} className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground">{t('coding.clearHistory', { defaultValue: '清除' })}</button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {recentFiles.slice(0, 8).map((fp, i) => (
                    <Button key={i} variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleOpenFileFromTree(fp)}>
                      <Clock className="h-3 w-3 text-muted-foreground" />{fp.split(/[/\\]/).pop()}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {favorites.length > 0 && (
              <div className="text-center space-y-2 mt-1">
                <span className="text-xs text-muted-foreground/60">{t('coding.recentFavorites', { defaultValue: '收藏文件' })}</span>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {favorites.slice(0, 6).map((fav, i) => (
                    <Button key={i} variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleSelectFavorite(fav)}>
                      <Star className="h-3 w-3 text-yellow-500" />{fav.split(/[/\\]/).pop()}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs text-muted-foreground/40 mt-4 space-y-0.5 text-center">
              <p>{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+N {t('coding.newFile', { defaultValue: '新建文件' })}</p>
              <p>{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+O {t('coding.openFile', { defaultValue: '打开文件' })}</p>
              <p>{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Shift+Enter {t('coding.run', { defaultValue: '运行' })}</p>
            </div>
          </div>
        ) : (
        <Suspense fallback={
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />{t('coding.loadingEditor', { defaultValue: '加载编辑器...' })}
          </div>
        }>
          {activeTab && (
            <CodeMirror
              key={activeTab.id}
              value={activeTab.code}
              onCreateEditor={(view: any) => {
                editorViewRef.current = view;
                // 监听选区变化
                const origDispatch = view.dispatch.bind(view);
                view.dispatch = (...args: any[]) => {
                  origDispatch(...args);
                  const sel = view.state.selection.main;
                  setSelectedCode(sel.empty ? '' : view.state.sliceDoc(sel.from, sel.to));
                };
              }}
              onChange={(val: string) => {
                updateTab(activeTab.id, { code: val, dirty: true });
                autoSave(activeTab.id);
              }}
              height="100%"
              className="h-full"
              indentWithTab={true}
              extensions={cmExts}
              theme={cmTheme}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                indentOnInput: true,
                highlightSelectionMatches: true,
                rectangularSelection: true,
                crosshairCursor: true,
                tabSize: 4,
              }}
              style={{ fontSize: `${settings.fontSize}px` }}
              onUpdate={(viewUpdate: any) => {
                if (!viewUpdate.selectionSet && !viewUpdate.docChanged) return;
                const state = viewUpdate.state;
                const pos = state.selection.main.head;
                const line = state.doc.lineAt(pos);
                setCursorInfo({ line: line.number, col: pos - line.from + 1 });
              }}
            />
          )}
        </Suspense>
        )}
        </div>{/* 编辑器内层 div 结束 */}
      </div>{/* 编辑区 flex 行结束 */}

      {/* ═══ 可拖拽分隔条 ═══ */}
      {maximized === 'none' && (
        <div
          className="flex-shrink-0 h-2 bg-muted/40 hover:bg-primary/20 cursor-row-resize flex items-center justify-center border-y transition-colors"
          onMouseDown={handleDragStart}
        >
          <GripHorizontal className="h-3 w-3 text-muted-foreground/50" />
        </div>
      )}

      {/* ═══ 输出区（固定高度 + 拖拽调整） ═══ */}
      <CodingOutput
        outputLines={activeTab?.outputLines || []}
        activeLang={activeLang}
        fontSize={settings.fontSize}
        maximized={maximized}
        outputHeight={outputHeight}
        outputStatusEl={outputStatusEl}
        outputPreview={outputPreview}
        onOutputPreviewChange={setOutputPreview}
        onClear={() => { if (activeTab) { updateTab(activeTab.id, { outputLines: [], lastExitCode: null }); setLastResult(null); } }}
        onMaximize={() => setMaximized(v => v === 'output' ? 'none' : 'output')}
      />

      {/* ═══ 折叠面板：收藏脚本 ═══ */}
      {favorites.length > 0 && (
        <div className="flex-shrink-0 border-t">
          <button onClick={() => setFavOpen(v => !v)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            {favOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Star className="h-3 w-3" />{t('coding.favorites', { defaultValue: '收藏脚本' })}
            <span className="text-[10px] text-muted-foreground/50 ml-1">{favorites.length}</span>
          </button>
          {favOpen && (
            <div className="px-3 pb-2 space-y-0.5">
              {favorites.map((fav, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs group">
                  <button onClick={() => handleSelectFavorite(fav)}
                    className="flex-1 text-left truncate hover:text-foreground text-muted-foreground py-0.5 px-1.5 rounded hover:bg-muted/30"
                    title={fav}>
                    {fav.split(/[/\\]/).pop()}
                  </button>
                  <button onClick={() => toggleFavorite(fav)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all"
                    title={t('coding.removeFavorite', { defaultValue: '取消收藏' })}>
                    <StarOff className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* ═══ 底部信息栏 ═══ */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-0.5 border-t bg-muted/20 text-xs text-muted-foreground">
        <span>{activeLang === 'python' ? (pythonInfo?.path || 'Python')
          : (activeLang === 'javascript' || activeLang === 'typescript') ? (nodeInfo?.path || 'Node.js')
          : activeLang.toUpperCase()}</span>
        <span>·</span>
        <span>{fileName}{activeTab?.dirty ? ` (${t('coding.modified', { defaultValue: '已修改' })})` : ''}</span>
        <span>·</span>
        {apiReady ? (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400" title={`API Server :${apiPort}\n\n${activeLang === 'python'
            ? 'Python SDK:\nimport aidocplus\napi = aidocplus.connect()'
            : (activeLang === 'javascript' || activeLang === 'typescript')
              ? 'JavaScript SDK:\nconst aidocplus = require("aidocplus");\nconst api = aidocplus.connect();'
              : 'Python: import aidocplus\nJS: const aidocplus = require("aidocplus")'}`}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
            API :{apiPort}
          </span>
        ) : (
          <span className="flex items-center gap-1 opacity-50" title={t('coding.apiNotReady', { defaultValue: 'API Server 未就绪' })}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
            API
          </span>
        )}
        <div className="flex-1" />
        {statusMsg && (
          <span className={statusIsError ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>{statusMsg}</span>
        )}
        <span>{t('coding.line', { defaultValue: '行' })} {cursorInfo.line}, {t('coding.col', { defaultValue: '列' })} {cursorInfo.col}</span>
      </div>
      </div>{/* 左侧结束 */}

      {/* ═══ 右侧：AI 编程助手 ═══ */}
      {assistantOpen && (
        <>
          <ResizableHandle direction="horizontal" onResize={handleAssistResize} />
          <div className="flex-shrink-0 overflow-hidden" style={{ width: assistantWidth }}>
            <CodingAssistantPanel
              currentCode={activeTab?.code || ''}
              lastOutput={assistantLastOutput}
              lastError={assistantLastError}
              fileName={fileName}
              language={activeTab?.language || 'python'}
              onApplyCode={handleApplyCode}
              onApplyAndRun={handleApplyAndRun}
              selectedCode={selectedCode}
              activeTabId={activeTab?.id}
              initialMessages={activeTab?.chatMessages as any}
              onMessagesChange={(msgs) => { if (activeTab) updateTab(activeTab.id, { chatMessages: msgs as any }); }}
            />
          </div>
        </>
      )}

      {/* ═══ 标签页右键菜单 ═══ */}
      {tabCtxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTabCtxMenu(null)} />
          <div className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[160px] text-sm"
            style={{ left: tabCtxMenu.x, top: tabCtxMenu.y }}>
            <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors"
              onClick={() => { handleClose(tabCtxMenu.tabId); setTabCtxMenu(null); }}>
              {t('coding.closeTab', { defaultValue: '关闭' })}
            </button>
            <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors"
              onClick={() => handleCloseOtherTabs(tabCtxMenu.tabId)}>
              {t('coding.closeOtherTabs', { defaultValue: '关闭其他' })}
            </button>
            <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors"
              onClick={() => handleCloseTabsToRight(tabCtxMenu.tabId)}>
              {t('coding.closeTabsToRight', { defaultValue: '关闭右侧' })}
            </button>
            <div className="my-1 border-t" />
            <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2"
              onClick={() => handleCopyPath(tabCtxMenu.tabId)}>
              <Copy className="h-3 w-3" />{t('coding.copyPath', { defaultValue: '复制路径' })}
            </button>
            <button className="w-full text-left px-3 py-1.5 hover:bg-accent transition-colors flex items-center gap-2"
              onClick={() => {
                const fp = tabs.find(tb => tb.id === tabCtxMenu.tabId)?.filePath || '';
                const oldName = fp.split(/[/\\]/).pop() || '';
                const newName = window.prompt(t('coding.renamePrompt', { defaultValue: '输入新文件名：' }), oldName);
                if (newName && newName !== oldName) {
                  invoke<string>('rename_coding_script', { filePath: fp, newName }).then(newPath => {
                    const existing = tabs.find(tb => tb.filePath === fp);
                    if (existing) updateTab(existing.id, { filePath: newPath, title: newName, dirty: false });
                    showStatus(t('coding.renamed', { defaultValue: '已重命名' }));
                  }).catch(err => showStatus(formatBackendError(err), true));
                }
                setTabCtxMenu(null);
              }}>
              <Pencil className="h-3 w-3" />{t('coding.renameScript', { defaultValue: '重命名' })}
            </button>
          </div>
        </>
      )}

      {/* ═══ 跳转到行对话框 ═══ */}
      {gotoLineOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setGotoLineOpen(false)} />
          <div className="fixed z-50 top-1/4 left-1/2 -translate-x-1/2 bg-popover border rounded-lg shadow-xl p-4 w-72">
            <p className="text-sm font-medium mb-2">{t('coding.gotoLine', { defaultValue: '跳转到行' })}</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={gotoLineValue}
                onChange={e => setGotoLineValue(e.target.value)}
                placeholder={`1 - ${editorViewRef.current?.state?.doc?.lines || '?'}`}
                className="h-8 text-base flex-1"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const n = parseInt(gotoLineValue, 10);
                    if (n > 0) handleGotoLine(n);
                  } else if (e.key === 'Escape') {
                    setGotoLineOpen(false);
                  }
                }}
              />
              <Button size="sm" className="h-8" onClick={() => {
                const n = parseInt(gotoLineValue, 10);
                if (n > 0) handleGotoLine(n);
              }}>{t('coding.go', { defaultValue: '跳转' })}</Button>
            </div>
          </div>
        </>
      )}

      {/* ═══ 命令面板 ═══ */}
      {cmdPaletteOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setCmdPaletteOpen(false)} />
          <div className="fixed z-50 top-[15%] left-1/2 -translate-x-1/2 bg-popover border rounded-lg shadow-xl w-[380px] max-h-[60vh] flex flex-col overflow-hidden">
            <div className="p-2 border-b">
              <Input
                ref={cmdPaletteInputRef}
                value={cmdPaletteQuery}
                onChange={e => { setCmdPaletteQuery(e.target.value); setCmdPaletteIdx(0); }}
                placeholder={t('coding.cmdPalettePlaceholder', { defaultValue: '输入命令...' })}
                className="h-8 text-base"
                onKeyDown={e => {
                  if (e.key === 'Escape') { setCmdPaletteOpen(false); }
                  else if (e.key === 'ArrowDown') { e.preventDefault(); setCmdPaletteIdx(i => Math.min(i + 1, cmdPaletteFiltered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setCmdPaletteIdx(i => Math.max(i - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); executeCmdPaletteItem(cmdPaletteIdx); }
                }}
              />
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {cmdPaletteFiltered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('coding.noResults', { defaultValue: '无匹配命令' })}</p>
              )}
              {cmdPaletteFiltered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between transition-colors ${
                    i === cmdPaletteIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => executeCmdPaletteItem(i)}
                  onMouseEnter={() => setCmdPaletteIdx(i)}
                >
                  <span>{cmd.label}</span>
                  {cmd.shortcut && <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{cmd.shortcut}</kbd>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══ 快捷键参考对话框 ═══ */}
      {shortcutsOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShortcutsOpen(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover border rounded-lg shadow-xl p-5 w-[420px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-semibold">{t('coding.keyboardShortcuts', { defaultValue: '快捷键参考' })}</p>
              <button onClick={() => setShortcutsOpen(false)} className="p-1 rounded hover:bg-muted" title={t('coding.close', { defaultValue: '关闭' })}><X className="h-4 w-4" /></button>
            </div>
            {[
              { section: t('coding.shortcutsEditor', { defaultValue: '编辑器' }), keys: [
                ['⌘ ⇧ P', t('coding.cmdPalette', { defaultValue: '命令面板' })],
                ['⌘ F', t('coding.searchReplace', { defaultValue: '搜索 / 替换' })],
                ['⌘ G', t('coding.gotoLine', { defaultValue: '跳转到行' })],
                ['⌘ Z', t('coding.undo', { defaultValue: '撤销' })],
                ['⌘ ⇧ Z', t('coding.redo', { defaultValue: '重做' })],
                ['⌘ D', t('coding.selectNext', { defaultValue: '选择下一个匹配' })],
                ['⌘ /  ', t('coding.toggleComment', { defaultValue: '切换注释' })],
                ['Tab / ⇧ Tab', t('coding.indentDedent', { defaultValue: '缩进 / 反缩进' })],
              ]},
              { section: t('coding.shortcutsRun', { defaultValue: '运行' }), keys: [
                ['⌘ Enter', t('coding.run', { defaultValue: '运行' })],
                ['⌘ ⇧ Enter', t('coding.runAndScroll', { defaultValue: '运行并滚动到输出' })],
                ['⌘ S', t('coding.save', { defaultValue: '保存' })],
              ]},
            ].map(group => (
              <div key={group.section} className="mb-3">
                <p className="text-sm font-medium text-muted-foreground mb-1.5">{group.section}</p>
                {group.keys.map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between py-1 text-sm">
                    <span>{desc}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{key}</kbd>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
