import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save, open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCodingStore, nextTabId, detectLangFromExt } from '@/stores/useCodingStore';
import type { CodingTab } from '@/stores/useCodingStore';
import { CodingAssistantPanel } from './CodingAssistantPanel';
import { getApiServerPort, isApiServerReady } from '@/api/ApiBridge';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import { CodingFileTree } from './CodingFileTree';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import {
  Play, FilePlus, FolderOpen, Save,
  Star, StarOff, Trash2, Settings, ChevronDown, ChevronRight,
  Loader2, CheckCircle, XCircle, Clock, GripHorizontal, X,
  Copy, Check, MessageSquare, PanelRightOpen, PanelRightClose, Pencil,
  Eye, FileCode, Maximize2, Minimize2,
  Undo2, Redo2, WrapText, Keyboard, Hash, Search, ArrowUp, ArrowDown,
  PanelLeftOpen, PanelLeftClose, History,
} from 'lucide-react';

const CodeMirror = lazy(() => import('@uiw/react-codemirror'));

// ── ANSI 颜色解析 ──
const ANSI_COLORS: Record<number, string> = {
  30: 'text-gray-900 dark:text-gray-300', 31: 'text-red-600 dark:text-red-400',
  32: 'text-green-600 dark:text-green-400', 33: 'text-yellow-600 dark:text-yellow-400',
  34: 'text-blue-600 dark:text-blue-400', 35: 'text-purple-600 dark:text-purple-400',
  36: 'text-cyan-600 dark:text-cyan-400', 37: 'text-gray-200 dark:text-gray-100',
  90: 'text-gray-500', 91: 'text-red-400', 92: 'text-green-400',
  93: 'text-yellow-300', 94: 'text-blue-400', 95: 'text-purple-400',
  96: 'text-cyan-400', 97: 'text-white',
};

function parseAnsiLine(text: string): Array<{ text: string; className: string }> {
  const parts: Array<{ text: string; className: string }> = [];
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentClass = '';
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), className: currentClass });
    }
    const codes = match[1].split(';').map(Number);
    for (const code of codes) {
      if (code === 0) currentClass = '';
      else if (code === 1) currentClass += ' font-bold';
      else if (code === 2) currentClass += ' opacity-60';
      else if (code === 4) currentClass += ' underline';
      else if (ANSI_COLORS[code]) currentClass = ANSI_COLORS[code] + (currentClass.includes('font-bold') ? ' font-bold' : '');
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), className: currentClass });
  if (parts.length === 0) parts.push({ text, className: '' });
  return parts;
}

// ── 类型 ──

interface ScriptRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

interface PythonInterpreter {
  path: string;
  version: string;
  label: string;
}


const DEFAULT_CODE = `# Python 脚本
# 可通过环境变量获取文档内容：
#   import os
#   input_file = os.environ.get('AIDOCPLUS_INPUT_FILE')
#   if input_file:
#       with open(input_file, 'r', encoding='utf-8') as f:
#           content = f.read()

print("Hello from Python!")
`;

/** 各语言的默认代码模板 */
const DEFAULT_TEMPLATES: Record<string, string> = {
  python: DEFAULT_CODE,
  html: `<!DOCTYPE html>\n<html lang="zh">\n<head>\n    <meta charset="UTF-8">\n    <title>文档</title>\n</head>\n<body>\n    <h1>Hello</h1>\n</body>\n</html>\n`,
  javascript: `// JavaScript\nconsole.log("Hello!");\n`,
  typescript: `// TypeScript\nconsole.log("Hello!");\n`,
  json: `{\n    \n}\n`,
  markdown: `# 标题\n\n正文内容\n`,
  css: `/* CSS */\nbody {\n    margin: 0;\n    padding: 0;\n}\n`,
  text: '',
};

/** 新建文件类型选项 */
const NEW_FILE_TYPES = [
  { ext: 'py', label: 'Python', lang: 'python' },
  { ext: 'html', label: 'HTML', lang: 'html' },
  { ext: 'js', label: 'JavaScript', lang: 'javascript' },
  { ext: 'ts', label: 'TypeScript', lang: 'typescript' },
  { ext: 'json', label: 'JSON', lang: 'json' },
  { ext: 'md', label: 'Markdown', lang: 'markdown' },
  { ext: 'css', label: 'CSS', lang: 'css' },
  { ext: 'txt', label: '纯文本', lang: 'text' },
];

/** 支持打开的文件扩展名 */
const SUPPORTED_EXTENSIONS = ['py','html','htm','js','jsx','ts','tsx','json','md','css','txt','xml','yaml','yml','toml','sh','sql'];

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
    addRunHistory, clearRunHistory, addRecentFile, clearRecentFiles,
  } = store;

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  // ── Python 环境（从 Store 缓存读取） ──
  const pythonInfo = store.pythonInfo;
  const detecting = store.pythonDetecting;
  const [pythonList, setPythonList] = useState<PythonInterpreter[]>([]);
  const [pythonListLoaded, setPythonListLoaded] = useState(false);
  const [pythonPopoverOpen, setPythonPopoverOpen] = useState(false);

  // ── Node.js 环境（从 Store 缓存读取） ──
  const nodeInfo = store.nodeInfo;
  const nodeDetecting = store.nodeDetecting;

  // ── 运行状态 ──
  const [running, setRunning] = useState(false);

  // ── 编辑器 ──
  const [outputHeight, setOutputHeight] = useState(settings.outputHeight || 200);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [outputPreview, setOutputPreview] = useState(false); // 输出区预览模式
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

  // ── 输出复制 ──
  const [outputCopied, setOutputCopied] = useState(false);
  const outputRef = useRef<HTMLPreElement | null>(null);
  const autoScrollRef = useRef(true);

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
  const [outputSearchOpen, setOutputSearchOpen] = useState(false);
  const [outputSearchQuery, setOutputSearchQuery] = useState('');
  const [outputSearchIdx, setOutputSearchIdx] = useState(0);
  const outputSearchRef = useRef<HTMLInputElement>(null);

  // ── DnD sensors ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── 状态栏 ──
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [lastResult, setLastResult] = useState<ScriptRunResult | null>(null);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg); setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

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

  // ── CodeMirror 扩展（动态语言加载） ──
  const [cmLangExts, setCmLangExts] = useState<any[]>([]);
  const [cmKeymapExts, setCmKeymapExts] = useState<any[]>([]);
  const [cmTheme, setCmTheme] = useState<any>(undefined);

  // 主题加载函数
  const loadEditorTheme = useCallback(async (themeId: string) => {
    if (themeId === 'light') {
      setCmTheme(undefined);
    } else if (themeId === 'oneDark') {
      const m = await import('@codemirror/theme-one-dark');
      setCmTheme(m.oneDark);
    } else {
      // auto: 跟随系统
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        const m = await import('@codemirror/theme-one-dark');
        setCmTheme(m.oneDark);
      } else {
        setCmTheme(undefined);
      }
    }
  }, []);

  // 加载快捷键（只加载一次）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const keyMod = await import('@codemirror/view');
        if (cancelled) return;
        const runKeymap = keyMod.keymap.of([
          { key: 'Mod-Enter', run: () => { handleRunRef.current?.(); return true; } },
          { key: 'Mod-Shift-Enter', run: () => { handleRunRef.current?.(); setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return true; } },
          { key: 'Mod-s', run: () => { handleSaveRef.current?.(); return true; } },
          { key: 'Mod-g', run: () => { gotoLineRef.current?.(); return true; } },
        ]);
        setCmKeymapExts([runKeymap]);
      } catch (err) {
        console.warn('加载 CodeMirror 快捷键失败:', err);
      }
      try {
        await loadEditorTheme(settings.editorTheme);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // 按 activeTab.language 动态加载语言扩展
  const activeLang = activeTab?.language || 'text';
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const langMod = await import('@codemirror/language');
        const langDataMod = await import('@codemirror/language-data');
        const { LanguageDescription } = await import('@codemirror/language');
        if (cancelled) return;

        // 映射语言名 → CodeMirror language-data 名称
        const cmLangMap: Record<string, string> = {
          python: 'Python', html: 'HTML', javascript: 'JavaScript', typescript: 'TypeScript',
          json: 'JSON', markdown: 'Markdown', css: 'CSS', xml: 'XML',
          yaml: 'YAML', toml: 'TOML', shell: 'Shell', sql: 'SQL',
        };
        const cmName = cmLangMap[activeLang];
        const exts: any[] = [];

        if (cmName) {
          const desc = LanguageDescription.matchLanguageName(langDataMod.languages, cmName, true);
          if (desc) {
            const langSupport = await desc.load();
            exts.push(langSupport);
          }
        }

        // Python 用 4 空格缩进
        if (activeLang === 'python') {
          exts.push(langMod.indentUnit.of('    '));
        } else {
          exts.push(langMod.indentUnit.of('  '));
        }

        if (!cancelled) setCmLangExts(exts);
      } catch (err) {
        console.warn('加载语言扩展失败:', err);
        if (!cancelled) setCmLangExts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [activeLang]);

  // word wrap 扩展
  const [cmWrapExt, setCmWrapExt] = useState<any[]>([]);
  useEffect(() => {
    if (wordWrap) {
      import('@codemirror/view').then(m => setCmWrapExt([m.EditorView.lineWrapping]));
    } else {
      setCmWrapExt([]);
    }
  }, [wordWrap]);

  // 合并扩展
  const cmExts = useMemo(() => [...cmLangExts, ...cmKeymapExts, ...cmWrapExt], [cmLangExts, cmKeymapExts, cmWrapExt]);

  // 监听系统主题变化（仅 auto 模式生效）
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (settings.editorTheme === 'auto') {
        loadEditorTheme('auto');
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [settings.editorTheme, loadEditorTheme]);

  // 响应 editorTheme 设置变化
  useEffect(() => {
    loadEditorTheme(settings.editorTheme);
  }, [settings.editorTheme, loadEditorTheme]);

  // ── 编辑器操作 ──
  const gotoLineRef = useRef<(() => void) | null>(null);
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

  // ── 运行脚本 ──
  const handleRunRef = useRef<(() => void) | null>(null);
  const handleSaveRef = useRef<(() => void) | null>(null);

  /** 判断当前语言是否支持运行 */
  const canRun = useMemo(() => {
    if (activeLang === 'python') return pythonInfo?.available && !detecting;
    if (activeLang === 'javascript' || activeLang === 'typescript') return nodeInfo?.available && !nodeDetecting;
    return false;
  }, [activeLang, pythonInfo, detecting, nodeInfo, nodeDetecting]);

  // 用于存储流式输出行的 ref（避免闭包捕获旧值）
  const streamLinesRef = useRef<Array<{ text: string; type: 'stdout' | 'stderr' | 'info' }>>([]);

  const handleRun = useCallback(async () => {
    if (running || !activeTab) return;

    const lang = activeTab.language || 'python';
    const isPython = lang === 'python';
    const isNode = lang === 'javascript' || lang === 'typescript';

    if (isPython && !pythonInfo?.available) { showStatus(t('coding.pythonNotFound', { defaultValue: '未找到 Python' }), true); return; }
    if (isNode && !nodeInfo?.available) { showStatus('未找到 Node.js', true); return; }
    if (!isPython && !isNode) return;

    setRunning(true);
    setLastResult(null);
    const cmdLabel = isPython ? 'python' : 'node';
    const headerLine = { text: `$ ${cmdLabel} ${activeTab.title}`, type: 'info' as const };
    streamLinesRef.current = [headerLine];
    updateTab(activeTab.id, { outputLines: [headerLine], lastExitCode: null });

    // 先保存文件再运行
    try {
      await invoke('save_coding_script', { filePath: activeTab.filePath, content: activeTab.code });
      updateTab(activeTab.id, { dirty: false });
    } catch { /* ignore save error, still try to run */ }

    const argsArr = settings.extraArgs.trim() ? settings.extraArgs.trim().split(/\s+/) : undefined;
    const isAbsolute = activeTab.filePath.startsWith('/') || /^[a-zA-Z]:/.test(activeTab.filePath);
    const scriptFullPath = isAbsolute ? activeTab.filePath : `${scriptsDir}/${activeTab.filePath}`;

    const interpreter = isPython
      ? (settings.customPythonPath || pythonInfo?.path || 'python3')
      : (settings.customNodePath || nodeInfo?.path || 'node');

    const tabId = activeTab.id;

    // 监听实时输出
    const unlistenChunk = await listen<{ stream: string; text: string }>('coding:output:chunk', (event) => {
      const { stream, text } = event.payload;
      const line = { text, type: (stream === 'stderr' ? 'stderr' : 'stdout') as 'stdout' | 'stderr' };
      streamLinesRef.current = [...streamLinesRef.current, line];
      updateTab(tabId, { outputLines: [...streamLinesRef.current] });
    });

    // 监听完成事件
    const unlistenDone = await listen<{ exitCode: number | null; timedOut: boolean; killed: boolean; durationMs: number }>('coding:output:done', (event) => {
      const { exitCode, timedOut, killed, durationMs } = event.payload;

      if (timedOut) {
        streamLinesRef.current = [...streamLinesRef.current, { text: `⏱ ${t('coding.timedOut', { defaultValue: '执行超时' })} (${settings.timeout}s)`, type: 'info' }];
        showStatus(t('coding.timedOut', { defaultValue: '执行超时' }), true);
      } else if (killed) {
        streamLinesRef.current = [...streamLinesRef.current, { text: `⚠ ${t('coding.killed', { defaultValue: '已终止' })}`, type: 'info' }];
        showStatus(t('coding.killed', { defaultValue: '已终止' }), true);
      } else if (exitCode === 0) {
        showStatus(`✅ ${(durationMs / 1000).toFixed(2)}s`);
      } else {
        showStatus(`❌ ${t('coding.exitCode', { defaultValue: '退出码' })}: ${exitCode}`, true);
      }

      setLastResult({ stdout: '', stderr: '', exitCode, timedOut, durationMs } as ScriptRunResult);
      updateTab(tabId, { outputLines: [...streamLinesRef.current], lastExitCode: exitCode });
      addRunHistory({
        id: `run_${Date.now()}`,
        fileName: activeTab.title,
        language: lang,
        exitCode,
        durationMs,
        timestamp: Date.now(),
      });
      setRunning(false);
      unlistenChunk();
      unlistenDone();
    });

    // 发起流式运行
    try {
      const envVars: Record<string, string> = { ...(settings.envVars || {}) };
      if (settings.specifyOutput && settings.outputPath) envVars['AIDOCPLUS_OUTPUT_FILE'] = settings.outputPath;
      await invoke('run_script_stream', {
        interpreter,
        scriptPath: scriptFullPath,
        args: argsArr || null,
        envVars: Object.keys(envVars).length > 0 ? envVars : null,
        timeoutSecs: settings.timeout,
        cwd: null,
      });
    } catch (err) {
      unlistenChunk();
      unlistenDone();
      updateTab(tabId, {
        outputLines: [headerLine, { text: String(err), type: 'stderr' }],
      });
      showStatus(String(err), true);
      setRunning(false);
    }
  }, [running, activeTab, pythonInfo, nodeInfo, settings, scriptsDir, showStatus, t, updateTab]);

  const handleKillScript = useCallback(async () => {
    try {
      await invoke('kill_running_script');
    } catch { /* ignore */ }
  }, []);

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
    } catch (err) { showStatus(String(err), true); }
  }, [tabs, addTab, setActiveTab, showStatus]);

  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    try {
      await saveFile(activeTab.id);
      showStatus(`✅ ${t('coding.saved', { defaultValue: '已保存' })}: ${activeTab.title}`);
    } catch (err) { showStatus(String(err), true); }
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
    } catch (err) { showStatus(String(err), true); }
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

  // ── 输出智能自动滚动 ──
  useEffect(() => {
    const el = outputRef.current;
    if (el && autoScrollRef.current) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
  }, [activeTab?.outputLines.length]);

  const handleOutputScroll = useCallback(() => {
    const el = outputRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    autoScrollRef.current = atBottom;
  }, []);

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

  // ── 输出区搜索匹配 ──
  const outputSearchMatches = useMemo(() => {
    if (!outputSearchQuery || !activeTab) return [];
    const q = outputSearchQuery.toLowerCase();
    const matches: number[] = [];
    activeTab.outputLines.forEach((line, i) => {
      if (line.text.toLowerCase().includes(q)) matches.push(i);
    });
    return matches;
  }, [outputSearchQuery, activeTab?.outputLines]);

  const handleOutputSearchNav = useCallback((dir: 1 | -1) => {
    if (outputSearchMatches.length === 0) return;
    const next = (outputSearchIdx + dir + outputSearchMatches.length) % outputSearchMatches.length;
    setOutputSearchIdx(next);
    // 滚动到匹配行
    const el = outputRef.current;
    if (el) {
      const lineEls = el.querySelectorAll('[data-output-line]');
      const targetLine = outputSearchMatches[next];
      if (lineEls[targetLine]) {
        lineEls[targetLine].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [outputSearchMatches, outputSearchIdx]);

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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-base px-2" title={t('coding.settings', { defaultValue: '设置' })}>
              <Settings className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-72 p-3 space-y-2.5">
            <p className="text-base font-semibold">{t('coding.settings', { defaultValue: '设置' })}</p>
            {/* Python 专属设置 */}
            {activeLang === 'python' && (
              <div className="space-y-0.5">
                <Label className="text-sm">{t('coding.pythonPath', { defaultValue: 'Python 路径' })}</Label>
                <Input value={settings.customPythonPath} onChange={e => updateSettings({ customPythonPath: e.target.value })}
                  placeholder={t('coding.pythonPathPlaceholder', { defaultValue: '留空自动检测' })} className="h-8 text-base" />
              </div>
            )}
            {/* Node.js 专属设置 */}
            {(activeLang === 'javascript' || activeLang === 'typescript') && (
              <div className="space-y-0.5">
                <Label className="text-sm">Node.js 路径</Label>
                <Input value={settings.customNodePath} onChange={e => updateSettings({ customNodePath: e.target.value })}
                  placeholder="留空自动检测" className="h-8 text-base" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-sm flex-1">{t('coding.timeout', { defaultValue: '超时(秒)' })}</Label>
              <Input type="number" value={settings.timeout} min={5} max={300}
                onChange={e => updateSettings({ timeout: Number(e.target.value) })}
                className="h-8 text-base w-20" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('coding.fontSize', { defaultValue: '字号' })}</Label>
                <span className="text-sm font-mono text-muted-foreground">{settings.fontSize}px</span>
              </div>
              <input type="range" min={10} max={20} step={1} value={settings.fontSize}
                onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
                className="w-full h-1.5 accent-primary" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-sm">{t('coding.editorTheme', { defaultValue: '编辑器主题' })}</Label>
              <div className="flex gap-1">
                {[
                  { id: 'auto', label: t('coding.themeAuto', { defaultValue: '自动' }) },
                  { id: 'light', label: t('coding.themeLight', { defaultValue: '浅色' }) },
                  { id: 'oneDark', label: 'One Dark' },
                ].map(th => (
                  <Button key={th.id} variant={settings.editorTheme === th.id ? 'default' : 'outline'}
                    size="sm" className="h-6 text-xs flex-1"
                    onClick={() => updateSettings({ editorTheme: th.id })}>
                    {th.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('coding.passDocContent', { defaultValue: '传入文档内容' })}</Label>
              <Switch checked={settings.passDocContent} onCheckedChange={v => updateSettings({ passDocContent: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('coding.specifyOutput', { defaultValue: '指定输出路径' })}</Label>
              <Switch checked={settings.specifyOutput} onCheckedChange={v => updateSettings({ specifyOutput: v })} />
            </div>
            {settings.specifyOutput && (
              <div className="flex items-center gap-1.5">
                <Input value={settings.outputPath} onChange={e => updateSettings({ outputPath: e.target.value })}
                  placeholder={t('coding.outputPath', { defaultValue: '输出文件路径' })} className="h-8 text-base flex-1" />
                <Button variant="outline" size="sm" className="h-8 text-base"
                  onClick={async () => { const p = await save({ defaultPath: 'output.txt' }); if (p) updateSettings({ outputPath: p }); }}>
                  {t('coding.selectOutputPath', { defaultValue: '选择' })}
                </Button>
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-sm">{t('coding.extraArgs', { defaultValue: '额外参数' })}</Label>
              <Input value={settings.extraArgs} onChange={e => updateSettings({ extraArgs: e.target.value })}
                placeholder={t('coding.extraArgsPlaceholder', { defaultValue: '传递给脚本的额外参数' })} className="h-8 text-base" />
            </div>
            {/* 环境变量编辑器 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('coding.envVars', { defaultValue: '环境变量' })}</Label>
                <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]"
                  onClick={() => {
                    const vars = { ...settings.envVars };
                    const key = `VAR_${Object.keys(vars).length + 1}`;
                    vars[key] = '';
                    updateSettings({ envVars: vars });
                  }}>+ {t('coding.addEnvVar', { defaultValue: '添加' })}</Button>
              </div>
              {Object.entries(settings.envVars || {}).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1">
                  <Input value={k} className="h-6 text-xs flex-1 font-mono" title={t('coding.envKey', { defaultValue: '变量名' })}
                    onChange={e => {
                      const vars = { ...settings.envVars };
                      const val = vars[k]; delete vars[k]; vars[e.target.value] = val;
                      updateSettings({ envVars: vars });
                    }} />
                  <span className="text-muted-foreground">=</span>
                  <Input value={v} className="h-6 text-xs flex-1 font-mono" title={t('coding.envValue', { defaultValue: '值' })}
                    onChange={e => updateSettings({ envVars: { ...settings.envVars, [k]: e.target.value } })} />
                  <button className="p-0.5 hover:bg-muted rounded" title={t('common.delete', { defaultValue: '删除' })}
                    onClick={() => { const vars = { ...settings.envVars }; delete vars[k]; updateSettings({ envVars: vars }); }}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {/* 运行历史 */}
            {runHistory.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t('coding.runHistory', { defaultValue: '运行历史' })}</Label>
                  <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]"
                    onClick={clearRunHistory}>{t('coding.clearHistory', { defaultValue: '清除' })}</Button>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-0.5">
                  {runHistory.slice(0, 10).map(h => (
                    <div key={h.id} className="flex items-center gap-1.5 text-[10px] font-mono">
                      {h.exitCode === 0
                        ? <CheckCircle className="h-2.5 w-2.5 text-green-500 flex-shrink-0" />
                        : <XCircle className="h-2.5 w-2.5 text-red-500 flex-shrink-0" />}
                      <span className="truncate flex-1">{h.fileName}</span>
                      <span className="text-muted-foreground">{(h.durationMs / 1000).toFixed(1)}s</span>
                      <span className="text-muted-foreground">{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-sm">{t('coding.scriptsDir', { defaultValue: '脚本目录' })}</Label>
              <div className="text-sm text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded break-all">{scriptsDir}</div>
            </div>
          </PopoverContent>
        </Popover>
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
      <div className={`flex-shrink-0 flex flex-col ${maximized === 'editor' ? 'hidden' : maximized === 'output' ? 'flex-1' : ''}`}
        style={maximized === 'output' ? { minHeight: 0 } : { height: outputHeight, minHeight: 80 }}>
        {/* 输出标题栏 */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 border-b bg-muted/20">
          <span className="text-xs font-medium">{t('coding.output', { defaultValue: '输出' })}</span>
          {outputStatusEl && <span className="text-[11px]">{outputStatusEl}</span>}
          <div className="flex-1" />
          {activeTab && activeTab.outputLines.length > 0 && (
            <>
              {/* 预览/原始切换 */}
              <Button variant={outputPreview ? 'default' : 'ghost'} size="sm" className="h-5 px-1.5 text-[10px] gap-0.5"
                onClick={() => setOutputPreview(v => !v)}
                title={outputPreview ? '原始输出' : '预览'}>
                <Eye className="h-2.5 w-2.5" />
                {outputPreview ? '原始' : '预览'}
              </Button>
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5"
                onClick={() => {
                  const text = activeTab.outputLines.map(l => l.text).join('\n');
                  navigator.clipboard.writeText(text).then(() => {
                    setOutputCopied(true);
                    setTimeout(() => setOutputCopied(false), 2000);
                  });
                }}
                title={t('coding.copyOutput', { defaultValue: '复制输出' })}>
                {outputCopied ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
                {outputCopied ? t('coding.copied', { defaultValue: '已复制' }) : t('coding.copy', { defaultValue: '复制' })}
              </Button>
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5"
                onClick={() => { setOutputSearchOpen(v => !v); setTimeout(() => outputSearchRef.current?.focus(), 50); }}
                title={t('coding.searchOutput', { defaultValue: '搜索输出' })}>
                <Search className="h-2.5 w-2.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5"
                onClick={() => { updateTab(activeTab.id, { outputLines: [], lastExitCode: null }); setLastResult(null); setOutputPreview(false); setOutputSearchOpen(false); setOutputSearchQuery(''); }}>
                <Trash2 className="h-2.5 w-2.5" />{t('coding.clearOutput', { defaultValue: '清除' })}
              </Button>
            </>
          )}
          <button
            onClick={() => setMaximized(v => v === 'output' ? 'none' : 'output')}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={maximized === 'output' ? '还原' : '最大化输出区'}>
            {maximized === 'output' ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>

        {/* 输出搜索条 */}
        {outputSearchOpen && (
          <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 border-b bg-muted/30">
            <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <input
              ref={outputSearchRef}
              className="flex-1 bg-transparent border-none outline-none text-xs h-5 placeholder:text-muted-foreground/50"
              placeholder={t('coding.searchOutput', { defaultValue: '搜索输出...' })}
              title={t('coding.searchOutput', { defaultValue: '搜索输出' })}
              value={outputSearchQuery}
              onChange={e => { setOutputSearchQuery(e.target.value); setOutputSearchIdx(0); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { handleOutputSearchNav(e.shiftKey ? -1 : 1); }
                if (e.key === 'Escape') { setOutputSearchOpen(false); setOutputSearchQuery(''); }
              }}
            />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {outputSearchQuery ? `${outputSearchMatches.length > 0 ? outputSearchIdx + 1 : 0}/${outputSearchMatches.length}` : ''}
            </span>
            <button onClick={() => handleOutputSearchNav(-1)} className="p-0.5 hover:bg-muted rounded" title={t('coding.prevMatch', { defaultValue: '上一个' })}>
              <ArrowUp className="h-3 w-3" />
            </button>
            <button onClick={() => handleOutputSearchNav(1)} className="p-0.5 hover:bg-muted rounded" title={t('coding.nextMatch', { defaultValue: '下一个' })}>
              <ArrowDown className="h-3 w-3" />
            </button>
            <button onClick={() => { setOutputSearchOpen(false); setOutputSearchQuery(''); }} className="p-0.5 hover:bg-muted rounded" title={t('common.close', { defaultValue: '关闭' })}>
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* 输出内容 — 支持原始/预览两种模式 */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {activeTab && activeTab.outputLines.length > 0 ? (
            outputPreview ? (
              // 预览模式
              <div className="h-full overflow-auto px-3 py-2">
                {(() => {
                  const outputText = activeTab.outputLines.filter(l => l.type === 'stdout').map(l => l.text).join('\n');
                  const isHtml = activeLang === 'html' || /^\s*<!DOCTYPE|^\s*<html/i.test(outputText);
                  if (isHtml) {
                    return <iframe srcDoc={outputText} sandbox="allow-scripts allow-same-origin" className="w-full h-full border rounded bg-white" title="HTML 预览" />;
                  }
                  return <MarkdownPreview content={outputText} theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} fontSize={settings.fontSize} />;
                })()}
              </div>
            ) : (
              // 原始模式
              <pre
                ref={outputRef}
                onScroll={handleOutputScroll}
                className="h-full overflow-auto px-3 py-2 text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-words select-text"
                style={{ fontSize: `${Math.max(settings.fontSize - 1, 11)}px` }}
              >
                {activeTab.outputLines.map((line, i) => {
                  const baseClass = line.type === 'stderr' ? 'text-red-500 dark:text-red-400' :
                    line.type === 'info' ? 'text-blue-500 dark:text-blue-400 opacity-70' : 'text-foreground';
                  const isMatch = outputSearchQuery && outputSearchMatches.includes(i);
                  const isCurrent = isMatch && outputSearchMatches[outputSearchIdx] === i;
                  const highlightClass = isCurrent ? 'bg-yellow-300 dark:bg-yellow-700' : isMatch ? 'bg-yellow-100 dark:bg-yellow-900/40' : '';
                  const hasAnsi = line.type === 'stdout' && /\x1b\[/.test(line.text);
                  if (hasAnsi) {
                    const parts = parseAnsiLine(line.text);
                    return <span key={i} data-output-line={i} className={`block ${highlightClass}`}>{parts.map((p, j) =>
                      p.className ? <span key={j} className={p.className}>{p.text}</span> : p.text
                    )}</span>;
                  }
                  // 图片路径检测：绝对路径 + 图片扩展名
                  const trimmed = line.text.trim();
                  const imgMatch = /^(\/[^\s]+\.(png|jpg|jpeg|gif|bmp|svg|webp))$/i.test(trimmed)
                    || /^([A-Z]:\\[^\s]+\.(png|jpg|jpeg|gif|bmp|svg|webp))$/i.test(trimmed);
                  if (imgMatch && line.type === 'stdout') {
                    const imgPath = trimmed;
                    return (
                      <span key={i} data-output-line={i} className={`block ${highlightClass}`}>
                        <span className="text-xs text-muted-foreground">{imgPath}</span>
                        <img
                          src={`https://asset.localhost/${encodeURIComponent(imgPath)}`}
                          alt={imgPath.replace(/^.*[\\/]/, '')}
                          className="max-w-full max-h-[300px] rounded border mt-1 mb-1"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </span>
                    );
                  }
                  return <span key={i} data-output-line={i} className={`block ${baseClass} ${highlightClass}`}>{line.text}</span>;
                })}
              </pre>
            )
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
              {(activeLang === 'python' || activeLang === 'javascript' || activeLang === 'typescript')
                ? `${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Shift+Enter ${t('coding.run', { defaultValue: '运行' })}`
                : (activeLang === 'html' || activeLang === 'markdown')
                  ? t('coding.clickPreview', { defaultValue: '点击"预览"按钮查看效果' })
                  : t('coding.editMode', { defaultValue: '编辑模式' })
              }
            </div>
          )}
        </div>
      </div>

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
                  }).catch(err => showStatus(String(err), true));
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
