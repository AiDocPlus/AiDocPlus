/**
 * CalculatorWorkspace — 计算文档主工作区
 * 多 Sheet 支持 + 行级对齐编辑器
 * layoutMode: 'full'，完全自定义布局
 */
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  lazy,
  Suspense,
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import {
  Calculator, Trash2, Download, Upload, HelpCircle, Zap,
  Plus, Edit2, MoreHorizontal, Copy, Trash, Undo2, Redo2,
  Settings, Variable, FileCode2, Clipboard, Scissors,
  Save, SaveAll, History, FilePlus, FileText, Star, Sigma,
  PanelRightClose, PanelRightOpen, ListTree, ChevronDown, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  parseCalculatorContent,
  createEmptyCalculatorContent,
  createLineFromExpression,
  sheetVariablesFromEngine,
  normalizeCalculatorVariables,
  type CalculatorDocumentContent,
  type CalculatorLine,
  type CalculatorSheet,
  type CalculatorSettings,
  type CalculatorVariable,
  addSheet,
  deleteSheet,
  renameSheet,
  switchSheet,
  updateSheet,
  getActiveSheet,
  syncCalculatorLineMeta,
  inferLineRole,
} from './types';
import { computeSheetLinesSequential } from './calculatorCompute';
import { CalculatorEngine, createCalculatorEngine } from './engine/CalculatorEngine';
import { importFile } from './engine/importer';
import { CalculatorAISidebar } from './CalculatorAISidebar';
import { CalculatorLineEditor, type CalculatorLineEditorHandle } from './CalculatorLineEditor';
import {
  CALCULATOR_FUNCTION_CATEGORIES,
  searchCalculatorFunctions,
  type CalculatorFunctionEntry,
} from './calculatorFunctionCatalog';
import {
  CalculatorTemplatePanel,
  BUILT_IN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  loadCustomTemplates,
  loadFavorites,
  type CalculatorTemplate,
} from './CalculatorTemplatePanel';
import { useResizableResultColumn } from './CalculatorResizer';
import { CalculatorExportDialog } from './CalculatorExportDialog';
import { CalculatorSettingsDialog } from './CalculatorSettingsDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { ResizableHandle } from '@/components/ui/resizable-handle';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const VersionHistoryPanel = lazy(() =>
  import('@/components/version/VersionHistoryPanel').then((m) => ({ default: m.VersionHistoryPanel })),
);
import { TOOLBAR_CLASS, STATUS_BAR_CLASS, TOOLBAR_ICON } from '../_shared/styles';

/** 主工具栏图标按钮（与长篇小说等文档一致：仅图标 + title） */
const CALC_TB_ICON = 'h-7 w-7 shrink-0 p-0';

// ============================================================
// Sheet 标签栏组件
// ============================================================

interface SheetTabsProps {
  sheets: CalculatorSheet[];
  activeSheetId: string;
  onSelectSheet: (id: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (id: string, name: string) => void;
  onDeleteSheet: (id: string) => void;
  onDuplicateSheet: (id: string) => void;
}

function SheetTabs({
  sheets,
  activeSheetId,
  onSelectSheet,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
  onDuplicateSheet,
}: SheetTabsProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = (sheet: CalculatorSheet) => {
    setEditingId(sheet.id);
    setEditName(sheet.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      onRenameSheet(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditName('');
    }
  };

  const handleTabDoubleClick = (e: React.MouseEvent, sheet: CalculatorSheet) => {
    e.preventDefault();
    e.stopPropagation();
    if (sheet.id !== activeSheetId) {
      onSelectSheet(sheet.id);
    }
    handleStartEdit(sheet);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 border-b overflow-x-auto">
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className={cn(
            'group flex items-center gap-1 px-3 py-1.5 rounded-t text-sm cursor-pointer transition-colors select-none',
            sheet.id === activeSheetId
              ? 'bg-sky-600 text-white border border-sky-700 border-b-transparent shadow-sm dark:bg-sky-700 dark:border-sky-800'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent',
          )}
          onClick={() => sheet.id !== activeSheetId && onSelectSheet(sheet.id)}
          onDoubleClick={(e) => handleTabDoubleClick(e, sheet)}
        >
          {editingId === sheet.id ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
              className="h-6 w-24 text-sm px-1"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="truncate max-w-[100px]">{sheet.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity',
                      sheet.id === activeSheetId
                        ? 'hover:bg-white/20 text-white'
                        : 'hover:bg-muted',
                    )}
                    onClick={(e) => e.stopPropagation()}
                    title={t('calculator.sheetMenu', { defaultValue: '工作表菜单' })}
                    aria-label={t('calculator.sheetMenu', { defaultValue: '工作表菜单' })}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => handleStartEdit(sheet)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    {t('calculator.renameSheet', { defaultValue: '重命名' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicateSheet(sheet.id)}>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('calculator.duplicateSheet', { defaultValue: '复制' })}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteSheet(sheet.id)}
                    disabled={sheets.length <= 1}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    {t('calculator.deleteSheet', { defaultValue: '删除' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        onClick={onAddSheet}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================
// 错误边界：避免单点渲染异常拖死整个标签页
// ============================================================

class CalculatorWorkspaceErrorBoundary extends Component<
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
    console.error('[CalculatorWorkspace]', error, info.componentStack);
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
          data-calculator-error-boundary="true"
        >
          <p className="text-sm max-w-md">
            {i18n.t('calculator.workspaceErrorBoundary', {
              defaultValue: '计算工作区出现异常。可尝试重试；若仍失败请切换文档后重新打开或检查文档内容。',
            })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false })}
          >
            {i18n.t('calculator.workspaceErrorRetry', { defaultValue: '重试' })}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// 主组件
// ============================================================

function CalculatorWorkspaceMain({ document: doc, host }: DocTypeEditorProps) {
  const { t, i18n } = useTranslation();
  const mod = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl+';
  const isEn = i18n.language === 'en';
  const [calcDoc, setCalcDoc] = useState<CalculatorDocumentContent>(() =>
    parseCalculatorContent(doc.content || '') || createEmptyCalculatorContent()
  );
  /** 与长篇小说一致：false 表示右栏 AI 展开 */
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightWidth, setRightWidth] = useState(320);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [templateMenuNonce, setTemplateMenuNonce] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [textImportOpen, setTextImportOpen] = useState(false);
  const [textImportBody, setTextImportBody] = useState('');
  const [textImportMode, setTextImportMode] = useState<'append' | 'replace'>('append');
  const [textImportConfirmOpen, setTextImportConfirmOpen] = useState(false);

  const {
    resultWidth,
    setResultWidth,
    minWidth: resultColMinWidth,
    maxWidth: resultColMaxWidth,
  } = useResizableResultColumn();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engineRef = useRef<CalculatorEngine | null>(null);
  const calcDocRef = useRef(calcDoc);
  calcDocRef.current = calcDoc;

  // 撤销 / 重做：past 为当前文档之前的快照栈，future 为撤销后可重做的快照栈
  const [past, setPast] = useState<CalculatorDocumentContent[]>([]);
  const [future, setFuture] = useState<CalculatorDocumentContent[]>([]);
  const MAX_HISTORY = 50;

  // 当前行选择状态
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);

  // 行剪贴板（用于复制/粘贴）
  const [lineClipboard, setLineClipboard] = useState<CalculatorLine | null>(null);

  // 设置对话框
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // 导出对话框
  const [showExportDialog, setShowExportDialog] = useState(false);

  // 导入确认 / 错误
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pendingImportContent, setPendingImportContent] = useState<CalculatorDocumentContent | null>(null);
  const [importErrorOpen, setImportErrorOpen] = useState(false);
  const [importErrorMessage, setImportErrorMessage] = useState('');

  // 帮助
  const [helpOpen, setHelpOpen] = useState(false);

  const lineEditorRef = useRef<CalculatorLineEditorHandle | null>(null);
  const [functionMenuSearch, setFunctionMenuSearch] = useState('');

  // 初始化计算引擎
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = createCalculatorEngine();
    }
  }, []);

  // 文档切换时重新加载
  useEffect(() => {
    const d = host.doc.getDocument();
    setCalcDoc(parseCalculatorContent(d.content || '') || createEmptyCalculatorContent());
    setPast([]);
    setFuture([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // 获取当前激活的 Sheet
  const activeSheet = useMemo(() => getActiveSheet(calcDoc), [calcDoc]);

  /** 兼容引擎曾写入的纯数字映射、磁盘中的 null 项等 */
  const normalizedSheetVariables = useMemo((): Record<string, CalculatorVariable> => {
    if (!activeSheet) return {};
    return normalizeCalculatorVariables(activeSheet.variables as Record<string, unknown>);
  }, [activeSheet]);

  // 保存（debounced）
  const saveDoc = useCallback((updated: CalculatorDocumentContent, addToHistory = true) => {
    if (addToHistory) {
      const cur = calcDocRef.current;
      setPast(p => [...p, cur].slice(-MAX_HISTORY));
      setFuture([]);
    }

    setCalcDoc(updated);
    host.doc.updateInMemory({ content: JSON.stringify(updated, null, 2) });
    host.doc.markDirty();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => host.doc.save(), 3000);
  }, [host.doc]);

  const flushPendingAutoSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const handleExplicitSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      flushPendingAutoSaveTimer();
      host.doc.updateInMemory({ content: JSON.stringify(calcDocRef.current, null, 2) });
      await host.doc.save();
    } finally {
      setIsSaving(false);
    }
  }, [host.doc, isSaving, flushPendingAutoSaveTimer]);

  const handleSaveAll = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      flushPendingAutoSaveTimer();
      host.doc.updateInMemory({ content: JSON.stringify(calcDocRef.current, null, 2) });
      await host.doc.save();
      await host.doc.saveAllDirtyTabs();
    } finally {
      setIsSaving(false);
    }
  }, [host.doc, isSaving, flushPendingAutoSaveTimer]);

  const handleCreateVersionQuick = useCallback(async () => {
    try {
      flushPendingAutoSaveTimer();
      host.doc.updateInMemory({ content: JSON.stringify(calcDocRef.current, null, 2) });
      await host.doc.createVersion(
        t('version.manualCheckpoint', { defaultValue: '手动创建版本' }),
      );
    } catch (err) {
      console.error('[CalculatorWorkspace] createVersion failed:', err);
    }
  }, [host.doc, flushPendingAutoSaveTimer, t]);

  const handleExplicitSaveRef = useRef(handleExplicitSave);
  const handleSaveAllRef = useRef(handleSaveAll);
  handleExplicitSaveRef.current = handleExplicitSave;
  handleSaveAllRef.current = handleSaveAll;

  useEffect(() => {
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.('[data-calculator-workspace="true"]')) return;
      e.preventDefault();
      if (e.shiftKey) {
        void handleSaveAllRef.current();
      } else {
        void handleExplicitSaveRef.current();
      }
    };
    window.addEventListener('keydown', onDocKeyDown);
    return () => window.removeEventListener('keydown', onDocKeyDown);
  }, []);

  const templatesForMenu = useMemo(() => {
    void templateMenuNonce;
    return [...BUILT_IN_TEMPLATES, ...loadCustomTemplates()];
  }, [templateMenuNonce]);

  const favoriteIdSet = useMemo(() => {
    void templateMenuNonce;
    return new Set(loadFavorites());
  }, [templateMenuNonce]);

  const favoriteTemplates = useMemo(
    () => templatesForMenu.filter((tmpl) => favoriteIdSet.has(tmpl.id)),
    [templatesForMenu, favoriteIdSet],
  );

  // 撤销
  const handleUndo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p;
      const cur = calcDocRef.current;
      const previous = p[p.length - 1];
      setFuture(f => [cur, ...f].slice(0, MAX_HISTORY));
      setCalcDoc(previous);
      host.doc.updateInMemory({ content: JSON.stringify(previous, null, 2) });
      host.doc.markDirty();
      return p.slice(0, -1);
    });
  }, [host.doc]);

  // 重做
  const handleRedo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f;
      const cur = calcDocRef.current;
      const next = f[0];
      setPast(p => [...p, cur].slice(-MAX_HISTORY));
      setCalcDoc(next);
      host.doc.updateInMemory({ content: JSON.stringify(next, null, 2) });
      host.doc.markDirty();
      return f.slice(1);
    });
  }, [host.doc]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // 计算所有行（含 Soulver 式标题分段与小计）
  const computeAllLines = useCallback((lines: CalculatorLine[], _sheetId: string, settings?: CalculatorSettings): CalculatorLine[] => {
    const engine = engineRef.current;
    if (!engine) return lines;

    const s = settings ?? calcDocRef.current.settings;
    engine.setDisplaySettings(s);
    engine.clearVariables();

    const formatSubtotalDisplay = (sum: number) => {
      const decimals = s.decimalPlaces;
      const loc = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US';
      const nf = new Intl.NumberFormat(loc, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return i18n.t('calculator.subtotalDisplay', { defaultValue: '小计：{{value}}', value: nf.format(sum) });
    };

    return computeSheetLinesSequential(lines, {
      hashBehavior: s.hashBehavior,
      evaluateNormalLine: (expression, lineNumber) => engine.evaluate(expression, lineNumber),
      extractSemantics: (expression, lineNumber) => engine.extractLineSemantics(expression, lineNumber),
      formatSubtotalDisplay,
      nowIso: () => new Date().toISOString(),
    });
  }, [i18n]);

  // Sheet 操作
  const handleAddSheet = useCallback(() => {
    const updated = addSheet(calcDoc);
    saveDoc(updated);
  }, [calcDoc, saveDoc]);

  const handleSelectSheet = useCallback((sheetId: string) => {
    const updated = switchSheet(calcDoc, sheetId);
    saveDoc(updated);
  }, [calcDoc, saveDoc]);

  const handleRenameSheet = useCallback((sheetId: string, name: string) => {
    const updated = renameSheet(calcDoc, sheetId, name);
    saveDoc(updated);
  }, [calcDoc, saveDoc]);

  const handleDeleteSheet = useCallback((sheetId: string) => {
    const updated = deleteSheet(calcDoc, sheetId);
    saveDoc(updated);
  }, [calcDoc, saveDoc]);

  const handleDuplicateSheet = useCallback((sheetId: string) => {
    const sheet = calcDoc.sheets.find(s => s.id === sheetId);
    if (!sheet) return;

    const base = Date.now();
    const newSheet: CalculatorSheet = {
      ...sheet,
      id: `sheet-${Date.now()}`,
      name: `${sheet.name} (copy)`,
      lines: sheet.lines.map((l, i) => ({
        ...l,
        id: `line-${base}-${i}-${Math.random().toString(36).slice(2, 9)}`,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated: CalculatorDocumentContent = {
      ...calcDoc,
      sheets: [...calcDoc.sheets, newSheet],
      activeSheetId: newSheet.id,
      updatedAt: new Date().toISOString(),
    };
    saveDoc(updated);
  }, [calcDoc, saveDoc]);

  // 非实时模式：失焦/Enter 后整表重算
  const handleComputeCommit = useCallback(() => {
    if (!activeSheet || calcDoc.settings.liveUpdate) return;
    const computedLines = computeAllLines(activeSheet.lines, activeSheet.id);
    const updated = updateSheet(calcDoc, activeSheet.id, {
      lines: computedLines,
      variables: sheetVariablesFromEngine(
        engineRef.current?.getVariables() || {},
        engineRef.current?.getVariableDefinitionLines(),
      ),
    });
    saveDoc(updated);
  }, [activeSheet, calcDoc, computeAllLines, saveDoc]);

  /** 手动重新计算当前工作表（不受实时开关影响） */
  const handleRecalculateCurrentSheet = useCallback(() => {
    if (!activeSheet) return;
    const computedLines = computeAllLines(activeSheet.lines, activeSheet.id);
    const updated = updateSheet(calcDoc, activeSheet.id, {
      lines: computedLines,
      variables: sheetVariablesFromEngine(
        engineRef.current?.getVariables() || {},
        engineRef.current?.getVariableDefinitionLines(),
      ),
    });
    saveDoc(updated);
  }, [activeSheet, calcDoc, computeAllLines, saveDoc]);

  /** 依次重新计算文档内全部工作表 */
  const handleRecalculateAllSheets = useCallback(() => {
    const doc = calcDocRef.current;
    if (doc.sheets.length === 0) return;
    let next = doc;
    for (const sheet of doc.sheets) {
      const computedLines = computeAllLines(sheet.lines, sheet.id);
      next = updateSheet(next, sheet.id, {
        lines: computedLines,
        variables: sheetVariablesFromEngine(
          engineRef.current?.getVariables() || {},
          engineRef.current?.getVariableDefinitionLines(),
        ),
      });
    }
    saveDoc(next);
  }, [computeAllLines, saveDoc]);

  // 行内容变更
  const handleLinesChange = useCallback((newLines: CalculatorLine[]) => {
    if (!activeSheet) return;

    const hb = calcDoc.settings.hashBehavior;
    const linesWithNumbers = newLines.map((line, i) =>
      syncCalculatorLineMeta({ ...line, lineNumber: i + 1 }, hb),
    );

    if (calcDoc.settings.liveUpdate) {
      const computedLines = computeAllLines(linesWithNumbers, activeSheet.id);
      const updated = updateSheet(calcDoc, activeSheet.id, {
        lines: computedLines,
        variables: sheetVariablesFromEngine(
          engineRef.current?.getVariables() || {},
          engineRef.current?.getVariableDefinitionLines(),
        ),
      });
      saveDoc(updated);
      return;
    }

    const pendingLabel = t('calculator.resultPending', { defaultValue: '…' });
    const merged = linesWithNumbers.map(line => {
      const prev = activeSheet.lines.find(l => l.id === line.id);
      const sameExpr = prev && prev.expression === line.expression;
      if (line.isNote) {
        return { ...line, result: { type: 'string' as const, value: line.expression, displayValue: '' } };
      }
      if (sameExpr && prev) {
        return { ...line, result: prev.result };
      }
      return {
        ...line,
        result: { type: 'number' as const, value: 0, displayValue: pendingLabel },
      };
    });

    const updated = updateSheet(calcDoc, activeSheet.id, {
      lines: merged,
      variables: activeSheet.variables,
    });
    saveDoc(updated);
  }, [activeSheet, calcDoc, computeAllLines, saveDoc, t]);

  const handleInsertSubtotalLine = useCallback(() => {
    const sheet = getActiveSheet(calcDocRef.current);
    if (!sheet) return;
    const hb = calcDocRef.current.settings.hashBehavior;
    const lines = sheet.lines;
    const afterIdx =
      activeLineIndex !== null && activeLineIndex >= 0 ? activeLineIndex : lines.length - 1;
    const insertAt = afterIdx < 0 ? 0 : Math.min(afterIdx + 1, lines.length);
    const expr = i18n.language.startsWith('zh') ? '小计' : 'subtotal';
    const newLine = createLineFromExpression(expr, insertAt + 1, hb);
    const merged = [...lines.slice(0, insertAt), newLine, ...lines.slice(insertAt)].map((l, i) =>
      syncCalculatorLineMeta({ ...l, lineNumber: i + 1 }, hb),
    );
    const computedLines = computeAllLines(merged, sheet.id);
    const updated = updateSheet(calcDocRef.current, sheet.id, {
      lines: computedLines,
      variables: sheetVariablesFromEngine(
        engineRef.current?.getVariables() || {},
        engineRef.current?.getVariableDefinitionLines(),
      ),
    });
    saveDoc(updated);
    setActiveLineIndex(insertAt);
  }, [computeAllLines, saveDoc, i18n.language, activeLineIndex]);

  const handleInsertHeadingLine = useCallback(() => {
    const sheet = getActiveSheet(calcDocRef.current);
    if (!sheet) return;
    const hb = calcDocRef.current.settings.hashBehavior;
    const lines = sheet.lines;
    const afterIdx =
      activeLineIndex !== null && activeLineIndex >= 0 ? activeLineIndex : lines.length - 1;
    const insertAt = afterIdx < 0 ? 0 : Math.min(afterIdx + 1, lines.length);
    const expr = t('calculator.headingLineTemplate', { defaultValue: '# 标题' });
    const newLine = createLineFromExpression(expr, insertAt + 1, hb);
    const merged = [...lines.slice(0, insertAt), newLine, ...lines.slice(insertAt)].map((l, i) =>
      syncCalculatorLineMeta({ ...l, lineNumber: i + 1 }, hb),
    );
    const computedLines = computeAllLines(merged, sheet.id);
    const updated = updateSheet(calcDocRef.current, sheet.id, {
      lines: computedLines,
      variables: sheetVariablesFromEngine(
        engineRef.current?.getVariables() || {},
        engineRef.current?.getVariableDefinitionLines(),
      ),
    });
    saveDoc(updated);
    setActiveLineIndex(insertAt);
  }, [computeAllLines, saveDoc, t, activeLineIndex]);

  const handleInsertPrevLineRef = useCallback(() => {
    const token = i18n.language.startsWith('en') ? 'above' : '上一行';
    lineEditorRef.current?.insertTextAtActiveCaret(token, { caretHint: 'end' });
  }, [i18n.language]);

  const handleCalculatorSettingsChange = useCallback((settings: CalculatorSettings) => {
    let updated: CalculatorDocumentContent = {
      ...calcDoc,
      settings,
      updatedAt: new Date().toISOString(),
    };
    const sheet = getActiveSheet(updated);
    if (sheet) {
      const computedLines = computeAllLines(sheet.lines, sheet.id, settings);
      updated = updateSheet(updated, sheet.id, {
        lines: computedLines,
        variables: sheetVariablesFromEngine(
          engineRef.current?.getVariables() || {},
          engineRef.current?.getVariableDefinitionLines(),
        ),
      });
    }
    saveDoc(updated);
  }, [calcDoc, computeAllLines, saveDoc]);

  // 清空当前 Sheet
  const handleClear = useCallback(() => {
    if (!activeSheet) return;
    const updated = updateSheet(calcDoc, activeSheet.id, {
      lines: [],
      variables: {},
    });
    saveDoc(updated);
  }, [activeSheet, calcDoc, saveDoc]);

  // 插入模板
  const handleInsertTemplate = useCallback((expressions: string[]) => {
    if (!activeSheet) return;

    const hb = calcDoc.settings.hashBehavior;
    // 将模板表达式转换为行
    const newLines = expressions.map((expr, i) =>
      createLineFromExpression(expr, activeSheet.lines.length + i + 1, hb),
    );

    // 追加到现有行后面
    const updatedLines = [...activeSheet.lines, ...newLines];
    const computedLines = computeAllLines(updatedLines, activeSheet.id);

    const updated = updateSheet(calcDoc, activeSheet.id, {
      lines: computedLines,
      variables: sheetVariablesFromEngine(
        engineRef.current?.getVariables() || {},
        engineRef.current?.getVariableDefinitionLines(),
      ),
    });
    saveDoc(updated);
  }, [activeSheet, calcDoc, calcDoc.settings.hashBehavior, computeAllLines, saveDoc]);

  const handleInsertCatalogEntry = useCallback((entry: CalculatorFunctionEntry) => {
    lineEditorRef.current?.insertTextAtActiveCaret(entry.insertTemplate, {
      caretHint: entry.caretHint,
    });
  }, []);

  const handleInsertFormulaFromAI = useCallback((formula: string) => {
    const text = formula.trim();
    if (!text) return;
    lineEditorRef.current?.insertTextAtActiveCaret(text, { caretHint: 'end' });
  }, []);

  const handleInsertAllLinesToken = useCallback(() => {
    const token = i18n.language.startsWith('en') ? 'all lines' : '所有行';
    lineEditorRef.current?.insertTextAtActiveCaret(token, { caretHint: 'end' });
  }, [i18n.language]);

  const handleInsertStatLine = useCallback(
    (kind: 'sum' | 'mean' | 'max' | 'min') => {
      const line =
        kind === 'sum'
          ? t('calculator.formulaStatSum', { defaultValue: '合计 = sum(所有行)' })
          : kind === 'mean'
            ? t('calculator.formulaStatMean', { defaultValue: '平均 = mean(所有行)' })
            : kind === 'max'
              ? t('calculator.formulaStatMax', { defaultValue: '最大 = max(所有行)' })
              : t('calculator.formulaStatMin', { defaultValue: '最小 = min(所有行)' });
      lineEditorRef.current?.replaceExpressionAtActiveLine(line);
    },
    [t],
  );

  const filteredCalculatorFunctions = useMemo(
    () => searchCalculatorFunctions(functionMenuSearch),
    [functionMenuSearch],
  );

  const getTemplateMenuHint = useCallback(
    (tmpl: CalculatorTemplate) => {
      const count = tmpl.expressions.length;
      const firstExpr =
        tmpl.expressions.find((e) => {
          const x = e.trimStart();
          return (
            x.length > 0 &&
            !x.startsWith('//') &&
            !x.startsWith('#') &&
            !x.startsWith('@') &&
            !x.startsWith('/*')
          );
        }) ?? tmpl.expressions[0] ?? '';
      const preview = firstExpr.replace(/\s+/g, ' ').trim().slice(0, 40);
      return t('calculator.templateMenuHint', {
        defaultValue: '{{count}} 条 · {{preview}}',
        count,
        preview: preview || '—',
      });
    },
    [t],
  );

  // ============================================================
  // 行操作（删除、复制、粘贴）
  // ============================================================

  // 删除当前活动行
  const handleDeleteLine = useCallback(() => {
    if (!activeSheet || activeLineIndex === null || activeLineIndex < 0) return;

    const newLines = activeSheet.lines.filter((_, index) => index !== activeLineIndex);
    const linesWithNumbers = newLines.map((line, i) => ({
      ...line,
      lineNumber: i + 1,
    }));

    const computedLines = computeAllLines(linesWithNumbers, activeSheet.id);
    const updated = updateSheet(calcDoc, activeSheet.id, {
      lines: computedLines,
      variables: sheetVariablesFromEngine(
        engineRef.current?.getVariables() || {},
        engineRef.current?.getVariableDefinitionLines(),
      ),
    });
    saveDoc(updated);

    // 调整活动行索引
    if (activeLineIndex >= newLines.length) {
      setActiveLineIndex(Math.max(0, newLines.length - 1));
    }
  }, [activeSheet, activeLineIndex, calcDoc, computeAllLines, saveDoc]);

  // 复制当前活动行到剪贴板
  const handleCopyLine = useCallback(() => {
    if (!activeSheet || activeLineIndex === null || activeLineIndex < 0) return;
    const lineToCopy = activeSheet.lines[activeLineIndex];
    if (lineToCopy) {
      setLineClipboard({ ...lineToCopy });
    }
  }, [activeSheet, activeLineIndex]);

  // 粘贴剪贴板中的行
  const handlePasteLine = useCallback(() => {
    if (!activeSheet || !lineClipboard) return;

    // 在当前活动行之后插入，如果没有活动行则追加到末尾
    const insertIndex = activeLineIndex !== null ? activeLineIndex + 1 : activeSheet.lines.length;

    // 创建新行（重置 ID 和行号）
    const newLine: CalculatorLine = {
      ...lineClipboard,
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    const newLines = [
      ...activeSheet.lines.slice(0, insertIndex),
      newLine,
      ...activeSheet.lines.slice(insertIndex),
    ];

    // 重新计算行号和结果
    const linesWithNumbers = newLines.map((line, i) => ({
      ...line,
      lineNumber: i + 1,
    }));

    const computedLines = computeAllLines(linesWithNumbers, activeSheet.id);
    const updated = updateSheet(calcDoc, activeSheet.id, {
      lines: computedLines,
      variables: sheetVariablesFromEngine(
        engineRef.current?.getVariables() || {},
        engineRef.current?.getVariableDefinitionLines(),
      ),
    });
    saveDoc(updated);
    setActiveLineIndex(insertIndex);
  }, [activeSheet, activeLineIndex, lineClipboard, calcDoc, computeAllLines, saveDoc]);

  // 剪切当前活动行（复制后删除）
  const handleCutLine = useCallback(() => {
    handleCopyLine();
    handleDeleteLine();
  }, [handleCopyLine, handleDeleteLine]);

  // 全局键盘快捷键（须放在 handleCopyLine 等定义之后，避免 TDZ）
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && activeLineIndex !== null) {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
          e.preventDefault();
          handleCopyLine();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x' && activeLineIndex !== null) {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
          e.preventDefault();
          handleCutLine();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && lineClipboard) {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
          e.preventDefault();
          handlePasteLine();
        }
      } else if (e.key === 'Delete' && activeLineIndex !== null) {
        e.preventDefault();
        handleDeleteLine();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        const el = e.target as HTMLElement | null;
        if (el?.closest?.('[data-calculator-workspace="true"]')) {
          e.preventDefault();
          handleInsertSubtotalLine();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    activeLineIndex,
    lineClipboard,
    handleCopyLine,
    handleCutLine,
    handlePasteLine,
    handleDeleteLine,
    handleInsertSubtotalLine,
  ]);

  // 检查是否可以执行行操作
  const canDeleteLine = activeLineIndex !== null && activeLineIndex >= 0 && activeSheet && activeSheet.lines.length > 0;
  const canCopyLine = activeLineIndex !== null && activeLineIndex >= 0 && activeSheet && activeSheet.lines.length > 0;
  const canPasteLine = lineClipboard !== null && activeSheet !== null;

  const runImportFromFilePicker = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.slvr,.soulver,.csv,.txt';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const result = await importFile(file);
      if (result.success) {
        setPendingImportContent(result.content);
        setImportConfirmOpen(true);
      } else {
        setImportErrorMessage(result.error);
        setImportErrorOpen(true);
      }
    };

    input.click();
  }, []);

  const openTextImportDialog = useCallback(() => {
    setTextImportBody('');
    setTextImportMode('append');
    setTextImportOpen(true);
  }, []);

  const applyTextImport = useCallback(() => {
    if (!activeSheet) return;
    const hb = calcDoc.settings.hashBehavior;
    const raw = textImportBody.replace(/\r\n/g, '\n');
    const parts = raw.split('\n');
    const newLinesFromText = parts.map((expr, i) => createLineFromExpression(expr, i + 1, hb));

    if (textImportMode === 'replace') {
      const computedLines = computeAllLines(newLinesFromText, activeSheet.id);
      const updated = updateSheet(calcDoc, activeSheet.id, {
        lines: computedLines,
        variables: sheetVariablesFromEngine(
          engineRef.current?.getVariables() || {},
          engineRef.current?.getVariableDefinitionLines(),
        ),
      });
      saveDoc(updated);
    } else {
      const merged = [...activeSheet.lines, ...newLinesFromText].map((line, idx) => ({
        ...line,
        lineNumber: idx + 1,
      }));
      const computedLines = computeAllLines(merged, activeSheet.id);
      const updated = updateSheet(calcDoc, activeSheet.id, {
        lines: computedLines,
        variables: sheetVariablesFromEngine(
          engineRef.current?.getVariables() || {},
          engineRef.current?.getVariableDefinitionLines(),
        ),
      });
      saveDoc(updated);
    }
    setTextImportOpen(false);
    setTextImportBody('');
    setTextImportConfirmOpen(false);
  }, [
    activeSheet,
    textImportBody,
    textImportMode,
    calcDoc,
    calcDoc.settings.hashBehavior,
    computeAllLines,
    saveDoc,
  ]);

  const openTextImportConfirm = useCallback(() => {
    if (!textImportBody.trim()) return;
    setTextImportConfirmOpen(true);
  }, [textImportBody]);

  const textImportLineCount = useMemo(() => {
    if (!textImportBody.trim()) return 0;
    return textImportBody.replace(/\r\n/g, '\n').split('\n').length;
  }, [textImportBody]);

  const confirmImport = useCallback(() => {
    if (pendingImportContent) {
      saveDoc(pendingImportContent);
    }
    setPendingImportContent(null);
    setImportConfirmOpen(false);
  }, [pendingImportContent, saveDoc]);

  // 统计信息
  const stats = useMemo(() => {
    if (!activeSheet) return { totalLines: 0, calcLines: 0, variableCount: 0, errorCount: 0 };

    const totalLines = activeSheet.lines.length;
    const noteLines = activeSheet.lines.filter(l => l.isNote).length;
    const calcLines = totalLines - noteLines;
    const variableCount = Object.keys(normalizedSheetVariables).length;
    const errorCount = activeSheet.lines.filter(l => l.result.type === 'error').length;

    return { totalLines, calcLines, variableCount, errorCount };
  }, [activeSheet, normalizedSheetVariables]);

  /** 浮动统计：当前段内（上一标题/小计之后到活动行）有限数值 normal 行 */
  const sectionFloatStats = useMemo(() => {
    if (!activeSheet) return { values: [] as number[], scopeLabel: '' };
    const hb = calcDoc.settings.hashBehavior;
    const lines = activeSheet.lines;
    const lineCount = lines.length;
    const activeIdx = activeLineIndex;
    let start = 0;
    let end = lineCount > 0 ? lineCount - 1 : 0;
    if (activeIdx !== null && activeIdx >= 0 && lineCount > 0) {
      const safeEnd = Math.min(activeIdx, lineCount - 1);
      end = safeEnd;
      const scanTo = Math.min(activeIdx, lineCount);
      for (let i = 0; i < scanTo; i++) {
        const line = lines[i];
        if (!line) continue;
        const role = inferLineRole(line.expression, hb);
        if (role === 'heading' || role === 'subtotal') start = i + 1;
      }
      if (start > end) start = end;
    }
    const values: number[] = [];
    for (let i = start; i <= end; i++) {
      const line = lines[i];
      if (!line) continue;
      if (inferLineRole(line.expression, hb) !== 'normal') continue;
      if (
        line.result.type === 'number' &&
        typeof line.result.value === 'number' &&
        Number.isFinite(line.result.value)
      ) {
        values.push(line.result.value);
      }
    }
    const scopeLabel =
      activeIdx !== null && activeIdx >= 0
        ? t('calculator.floatingStatsScopeSection', {
            defaultValue: '当前段至第 {{n}} 行',
            n: activeIdx + 1,
          })
        : t('calculator.floatingStatsScopeSheet', { defaultValue: '整张表' });
    return { values, scopeLabel };
  }, [activeSheet, activeLineIndex, calcDoc.settings.hashBehavior, t]);

  const floatingAgg = useMemo(() => {
    const { values } = sectionFloatStats;
    if (values.length === 0) {
      return { count: 0, sum: NaN, avg: NaN, min: NaN, max: NaN };
    }
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [sectionFloatStats]);

  const fmtStatNum = useCallback(
    (n: number) => {
      if (!Number.isFinite(n)) return '—';
      const d = calcDoc.settings.decimalPlaces;
      return n.toFixed(d);
    },
    [calcDoc.settings.decimalPlaces],
  );

  return (
    <div className="flex h-full w-full overflow-hidden" data-calculator-workspace="true">
      {/* 中栏：与长篇小说相同 — 工具栏 + Sheet + 主编辑 + 状态栏 */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b flex-shrink-0 bg-card overflow-x-auto min-w-0">
        <Calculator className={cn(TOOLBAR_ICON, 'text-primary shrink-0')} />
        <span className="text-sm font-medium truncate">{doc.title}</span>

        {/* 撤销/重做 */}
        <div className="flex items-center gap-0.5 ml-1">
          <Button
            variant="ghost"
            size="icon"
            className={CALC_TB_ICON}
            onClick={handleUndo}
            disabled={!canUndo}
            title={t('calculator.undo', { defaultValue: '撤销' })}
          >
            <Undo2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={CALC_TB_ICON}
            onClick={handleRedo}
            disabled={!canRedo}
            title={t('calculator.redo', { defaultValue: '重做' })}
          >
            <Redo2 className="h-3 w-3" />
          </Button>
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={CALC_TB_ICON}
            disabled={isSaving}
            onClick={() => void handleExplicitSave()}
            title={`${t('calculator.saveDocument', { defaultValue: '保存' })} (${mod}S)`}
            aria-label={t('calculator.saveDocument', { defaultValue: '保存' })}
          >
            <Save className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={CALC_TB_ICON}
            disabled={isSaving}
            onClick={() => void handleSaveAll()}
            title={`${t('calculator.saveAllDocuments', { defaultValue: '全部保存' })} (${mod}⇧S)`}
            aria-label={t('calculator.saveAllDocuments', { defaultValue: '全部保存' })}
          >
            <SaveAll className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={CALC_TB_ICON}
                title={t('calculator.versionMenu', { defaultValue: '版本' })}
                aria-label={t('calculator.versionMenu', { defaultValue: '版本' })}
              >
                <History className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => void handleCreateVersionQuick()}>
                <FilePlus className="h-4 w-4 mr-2" />
                {t('version.createVersion', { defaultValue: '创建历史版本' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setVersionHistoryOpen(true)}>
                <History className="h-4 w-4 mr-2" />
                {t('version.manageVersions', { defaultValue: '历史版本管理' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-0.5 px-2 text-xs shrink-0"
                title={t('calculator.recalculateMenu', { defaultValue: '重新计算' })}
                aria-label={t('calculator.recalculateMenu', { defaultValue: '重新计算' })}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem
                disabled={!activeSheet}
                onClick={() => handleRecalculateCurrentSheet()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('calculator.recalculateCurrentSheet', { defaultValue: '重新计算当前工作表' })}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={calcDoc.sheets.length === 0}
                onClick={() => handleRecalculateAllSheets()}
              >
                <SaveAll className="h-4 w-4 mr-2" />
                {t('calculator.recalculateAllSheets', { defaultValue: '重新计算所有工作表' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        {/* 行操作：删除、复制、粘贴 */}
        <Button
          variant="ghost"
          size="icon"
          className={CALC_TB_ICON}
          onClick={handleCutLine}
          disabled={!canCopyLine}
          title={t('calculator.cutLine', { defaultValue: '剪切行 (Ctrl+X)' })}
        >
          <Scissors className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={CALC_TB_ICON}
          onClick={handleCopyLine}
          disabled={!canCopyLine}
          title={t('calculator.copyLine', { defaultValue: '复制行 (Ctrl+C)' })}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={CALC_TB_ICON}
          onClick={handlePasteLine}
          disabled={!canPasteLine}
          title={t('calculator.pasteLine', { defaultValue: '粘贴行 (Ctrl+V)' })}
        >
          <Clipboard className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={CALC_TB_ICON}
          onClick={handleDeleteLine}
          disabled={!canDeleteLine}
          title={t('calculator.deleteLine', { defaultValue: '删除行 (Delete)' })}
        >
          <Trash className="h-3 w-3" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* 插入函数（与引擎目录一致） */}
        <DropdownMenu
          onOpenChange={(open) => {
            if (!open) setFunctionMenuSearch('');
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={CALC_TB_ICON}
              title={t('calculator.functionMenu', { defaultValue: '插入函数 (ƒx)' })}
              aria-label={t('calculator.functionMenu', { defaultValue: '插入函数' })}
            >
              <Sigma className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[min(22rem,90vw)] max-h-[min(70vh,480px)] overflow-y-auto p-0">
            <div className="p-2 border-b border-border sticky top-0 bg-popover z-10">
              <Input
                placeholder={t('calculator.functionMenuSearch', { defaultValue: '搜索函数…' })}
                value={functionMenuSearch}
                onChange={(e) => setFunctionMenuSearch(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="py-1">
              {functionMenuSearch.trim() ? (
                filteredCalculatorFunctions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {t('calculator.functionMenuNoMatch', { defaultValue: '无匹配项' })}
                  </div>
                ) : (
                  filteredCalculatorFunctions.map((f) => (
                    <DropdownMenuItem
                      key={`${f.id}-search`}
                      className="flex flex-row items-start gap-1 py-2 pr-1"
                      onSelect={() => handleInsertCatalogEntry(f)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-xs font-medium">
                          {f.nameEn}
                          {f.nameZh ? ` · ${f.nameZh}` : ''}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{f.syntax}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title={t('calculator.copyFunctionSyntax', { defaultValue: '复制语法' })}
                        aria-label={t('calculator.copyFunctionSyntax', { defaultValue: '复制语法' })}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(f.syntax);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </DropdownMenuItem>
                  ))
                )
              ) : (
                [...CALCULATOR_FUNCTION_CATEGORIES].sort((a, b) => a.order - b.order).map((cat) => (
                  <DropdownMenuSub key={cat.id}>
                    <DropdownMenuSubTrigger className="text-xs">
                      {t(cat.labelKey, { defaultValue: cat.id })}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                      {cat.functions.map((f) => (
                        <DropdownMenuItem
                          key={f.id}
                          className="flex flex-row items-start gap-1 py-2 pr-1"
                          onSelect={() => handleInsertCatalogEntry(f)}
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-xs font-medium">
                              {f.nameEn}
                              {f.nameZh ? ` · ${f.nameZh}` : ''}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">{f.syntax}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title={t('calculator.copyFunctionSyntax', { defaultValue: '复制语法' })}
                            aria-label={t('calculator.copyFunctionSyntax', { defaultValue: '复制语法' })}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(f.syntax);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 变量与「所有行」统计（与插入函数相邻） */}
        {activeSheet && activeSheet.lines.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(CALC_TB_ICON, 'relative')}
                title={t('calculator.variablesAndStats', { defaultValue: '变量与统计' })}
                aria-label={t('calculator.variablesAndStats', { defaultValue: '变量与统计' })}
              >
                <Variable className="h-3.5 w-3.5" />
                {Object.keys(normalizedSheetVariables).length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary/15 text-[9px] font-medium leading-[14px] text-center text-primary tabular-nums">
                    {Object.keys(normalizedSheetVariables).length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {t('calculator.specialVariables', { defaultValue: '特殊变量' })}
              </div>
              <div className="px-2 pb-1 text-[11px] text-muted-foreground leading-snug">
                {t('calculator.allLinesHint', {
                  defaultValue: '表示当前行上方已成功求值的数值行，用于 sum / mean 等函数。',
                })}
              </div>
              <DropdownMenuItem onClick={() => handleInsertAllLinesToken()}>
                <code className="text-xs mr-2">{i18n.language.startsWith('en') ? 'all lines' : '所有行'}</code>
                <span className="text-xs text-muted-foreground">
                  {t('calculator.insertAtCaret', { defaultValue: '插入到光标' })}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <Sigma className="h-3.5 w-3.5 shrink-0" />
                  {t('calculator.oneClickStats', { defaultValue: '一键统计（替换当前行）' })}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  <DropdownMenuItem onClick={() => handleInsertStatLine('sum')}>
                    {t('calculator.statMenuSum', { defaultValue: '求和' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInsertStatLine('mean')}>
                    {t('calculator.statMenuMean', { defaultValue: '平均值' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInsertStatLine('max')}>
                    {t('calculator.statMenuMax', { defaultValue: '最大值' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleInsertStatLine('min')}>
                    {t('calculator.statMenuMin', { defaultValue: '最小值' })}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {Object.keys(normalizedSheetVariables).length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {t('calculator.variables', { defaultValue: '变量' })}
                  </div>
                  {Object.entries(normalizedSheetVariables).map(([name, v]) => (
                    <DropdownMenuItem key={name} className="justify-between gap-2">
                      <code className="text-xs shrink-0">{name}</code>
                      <div className="flex flex-col items-end gap-0.5 min-w-0">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {String(v.value)}
                        </span>
                        {v.sourceLine > 0 && (
                          <span className="text-[10px] text-muted-foreground/80">
                            {t('calculator.variableSourceLine', {
                              defaultValue: '第{{line}}行',
                              line: v.sourceLine,
                            })}
                          </span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* 模板下拉 */}
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) setTemplateMenuNonce((n) => n + 1);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={CALC_TB_ICON}
              title={t('calculator.templates', { defaultValue: '模板' })}
              aria-label={t('calculator.templates', { defaultValue: '模板' })}
            >
              <FileCode2 className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-[min(70vh,420px)] overflow-y-auto">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <Star className="h-3.5 w-3.5 shrink-0" />
                <span>{isEn ? 'Favorites' : '收藏'}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                {favoriteTemplates.length === 0 ? (
                  <DropdownMenuItem disabled>{isEn ? 'No favorites' : '暂无收藏'}</DropdownMenuItem>
                ) : (
                  favoriteTemplates.map((tmpl) => (
                    <DropdownMenuItem
                      key={tmpl.id}
                      className="flex flex-col items-start gap-0.5 py-2"
                      onClick={() => handleInsertTemplate(tmpl.expressions)}
                    >
                      <span className="text-xs font-medium">{isEn ? tmpl.nameEn : tmpl.name}</span>
                      <span className="text-[10px] text-muted-foreground">{getTemplateMenuHint(tmpl)}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {TEMPLATE_CATEGORIES.map((cat) => {
              const catTemplates = templatesForMenu.filter((x) => x.categoryId === cat.id);
              if (catTemplates.length === 0) return null;
              return (
                <DropdownMenuSub key={cat.id}>
                  <DropdownMenuSubTrigger>{isEn ? cat.nameEn : cat.name}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                    {catTemplates.map((tmpl) => (
                      <DropdownMenuItem
                        key={tmpl.id}
                        className="flex flex-col items-start gap-0.5 py-2"
                        onClick={() => handleInsertTemplate(tmpl.expressions)}
                      >
                        <span className="text-xs font-medium">{isEn ? tmpl.nameEn : tmpl.name}</span>
                        <span className="text-[10px] text-muted-foreground">{getTemplateMenuHint(tmpl)}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTemplateManagerOpen(true)}>
              <FileText className="h-4 w-4 mr-2" />
              {t('calculator.manageTemplates', { defaultValue: '管理模板…' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Soulver 式分段：插入小计 / 标题 / 上一行引用 */}
        {activeSheet && activeSheet.lines.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={CALC_TB_ICON}
                title={t('calculator.insertSegmentMenu', { defaultValue: '插入分段（小计/标题）' })}
                aria-label={t('calculator.insertSegmentMenu', { defaultValue: '插入分段（小计/标题）' })}
              >
                <ListTree className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => handleInsertSubtotalLine()}>
                <span className="text-xs font-medium">{t('calculator.insertSubtotal', { defaultValue: '插入小计行' })}</span>
                <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{mod}T</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleInsertHeadingLine()}>
                {t('calculator.insertHeading', { defaultValue: '插入标题行（#）' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleInsertPrevLineRef()}>
                {t('calculator.insertPrevLineRef', { defaultValue: '插入上一行结果（above / 上一行）' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={CALC_TB_ICON}
              title={t('calculator.import', { defaultValue: '导入' })}
              aria-label={t('calculator.import', { defaultValue: '导入' })}
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void runImportFromFilePicker()}>
              <Upload className="h-4 w-4 mr-2" />
              {t('calculator.importFromFile', { defaultValue: '从文件…' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openTextImportDialog}>
              <FileText className="h-4 w-4 mr-2" />
              {t('calculator.importFromText', { defaultValue: '从多行文本…' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="icon"
          className={CALC_TB_ICON}
          onClick={() => setShowExportDialog(true)}
          title={t('calculator.export', { defaultValue: '导出' })}
          aria-label={t('calculator.export', { defaultValue: '导出' })}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={CALC_TB_ICON}
          onClick={handleClear}
          title={t('calculator.clear', { defaultValue: '清空' })}
          aria-label={t('calculator.clear', { defaultValue: '清空' })}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={CALC_TB_ICON}
          onClick={() => setShowSettingsDialog(true)}
          title={t('calculator.settings', { defaultValue: '设置' })}
          aria-label={t('calculator.settings', { defaultValue: '设置' })}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={CALC_TB_ICON}
          onClick={() => setHelpOpen(true)}
          title={t('calculator.help', { defaultValue: '帮助' })}
          aria-label={t('calculator.help', { defaultValue: '帮助' })}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={rightCollapsed ? 'outline' : 'default'}
          size="icon"
          className={CALC_TB_ICON}
          onClick={() => setRightCollapsed(!rightCollapsed)}
          title={
            rightCollapsed
              ? t('calculator.showAI', { defaultValue: '打开 AI' })
              : t('calculator.hideAI', { defaultValue: '关闭 AI' })
          }
          aria-label={
            rightCollapsed
              ? t('calculator.showAI', { defaultValue: '打开 AI' })
              : t('calculator.hideAI', { defaultValue: '关闭 AI' })
          }
        >
          {rightCollapsed ? (
            <PanelRightOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelRightClose className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Sheet 标签栏 */}
      <SheetTabs
        sheets={calcDoc.sheets}
        activeSheetId={calcDoc.activeSheetId}
        onSelectSheet={handleSelectSheet}
        onAddSheet={handleAddSheet}
        onRenameSheet={handleRenameSheet}
        onDeleteSheet={handleDeleteSheet}
        onDuplicateSheet={handleDuplicateSheet}
      />

      {/* 主编辑区 */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {activeSheet && (
          <CalculatorLineEditor
            ref={lineEditorRef}
            lines={activeSheet.lines}
            variables={normalizedSheetVariables}
            onChange={handleLinesChange}
            activeLineIndex={activeLineIndex}
            onActiveLineChange={setActiveLineIndex}
            liveUpdate={calcDoc.settings.liveUpdate}
            onComputeCommit={handleComputeCommit}
            resultWidth={resultWidth}
            onResultWidthChange={setResultWidth}
            minResultWidth={resultColMinWidth}
            maxResultWidth={resultColMaxWidth}
            hashBehavior={calcDoc.settings.hashBehavior}
          />
        )}
      </div>

      {/* 分段数值统计（可折叠） */}
      {activeSheet && activeSheet.lines.length > 0 && (
        <Collapsible defaultOpen className="border-t border-border/60 bg-muted/15 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
                {t('calculator.floatingStatsTitle', { defaultValue: '分段统计' })}
              </button>
            </CollapsibleTrigger>
            <span className="text-[11px] text-muted-foreground/90 truncate">{sectionFloatStats.scopeLabel}</span>
          </div>
          <CollapsibleContent>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-2 text-xs tabular-nums text-foreground/90">
              <span>
                {t('calculator.floatingStatsCount', { defaultValue: '条数' })}: {floatingAgg.count}
              </span>
              <span>
                {t('calculator.floatingStatsSum', { defaultValue: '合计' })}: {fmtStatNum(floatingAgg.sum)}
              </span>
              <span>
                {t('calculator.floatingStatsAvg', { defaultValue: '平均' })}: {fmtStatNum(floatingAgg.avg)}
              </span>
              <span>
                {t('calculator.floatingStatsMin', { defaultValue: '最小' })}: {fmtStatNum(floatingAgg.min)}
              </span>
              <span>
                {t('calculator.floatingStatsMax', { defaultValue: '最大' })}: {fmtStatNum(floatingAgg.max)}
              </span>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 状态栏 */}
      <div className={STATUS_BAR_CLASS}>
        <span>
          {t('calculator.lineCount', {
            defaultValue: `行数: ${stats.totalLines}`,
            count: stats.totalLines
          })}
        </span>
        <span>
          {t('calculator.variableCount', {
            defaultValue: `变量: ${stats.variableCount}`,
            count: stats.variableCount
          })}
        </span>
        {stats.errorCount > 0 && (
          <span className="text-red-500">
            {t('calculator.errorCount', {
              defaultValue: `错误: ${stats.errorCount}`,
              count: stats.errorCount
            })}
          </span>
        )}
        <div className="flex-1" />
        <span className="text-muted-foreground">
          {calcDoc.sheets.length} {t('calculator.sheets', { defaultValue: '个空间' })}
        </span>
        <Zap className="h-3 w-3 text-primary" />
        <span className={calcDoc.settings.liveUpdate ? 'text-primary' : 'text-muted-foreground'}>
          {calcDoc.settings.liveUpdate
            ? t('calculator.liveMode', { defaultValue: '实时计算' })
            : t('calculator.manualComputeMode', { defaultValue: '按 Enter 计算' })}
        </span>
      </div>
      </div>

      {/* 右栏：AI（与长篇小说 — ResizableHandle + 固定宽度容器） */}
      {!rightCollapsed && activeSheet && (
        <>
          <ResizableHandle
            direction="horizontal"
            onResize={(d) => setRightWidth((w) => Math.min(500, Math.max(220, w - d)))}
          />
          <div
            className="flex-shrink-0 h-full overflow-hidden border-l bg-card"
            style={{ width: rightWidth }}
          >
            <CalculatorAISidebar
              key={doc.id}
              document={doc}
              host={host}
              calcDoc={calcDoc}
              activeSheet={activeSheet}
              onClose={() => setRightCollapsed(true)}
              onInsertFormula={handleInsertFormulaFromAI}
            />
          </div>
        </>
      )}

      <CalculatorSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        settings={calcDoc.settings}
        onSettingsChange={handleCalculatorSettingsChange}
      />

      <Dialog open={importConfirmOpen} onOpenChange={(o) => { setImportConfirmOpen(o); if (!o) setPendingImportContent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('calculator.importConfirmTitle', { defaultValue: '替换当前文档？' })}</DialogTitle>
            <DialogDescription>
              {t('calculator.importConfirmMessage', {
                defaultValue: '导入将用文件内容替换当前计算文档的全部数据，此操作可通过撤销恢复。',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setImportConfirmOpen(false); setPendingImportContent(null); }}>
              {t('common.cancel', { defaultValue: '取消' })}
            </Button>
            <Button onClick={confirmImport}>
              {t('calculator.importConfirmReplace', { defaultValue: '替换' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importErrorOpen} onOpenChange={setImportErrorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('calculator.importErrorTitle', { defaultValue: '导入失败' })}</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap">{importErrorMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setImportErrorOpen(false)}>{t('common.close', { defaultValue: '关闭' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('calculator.helpTitle', { defaultValue: '计算文档帮助' })}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="text-sm text-muted-foreground space-y-3 whitespace-pre-wrap">
              <p>{t('calculator.helpIntro', { defaultValue: '' })}</p>
              <p>{t('calculator.helpSyntax', { defaultValue: '' })}</p>
              <p>{t('calculator.helpFunctionsPointer', { defaultValue: '' })}</p>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setHelpOpen(false)}>{t('common.close', { defaultValue: '关闭' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateManagerOpen} onOpenChange={setTemplateManagerOpen}>
        <DialogContent className="max-w-2xl h-[min(85vh,720px)] p-0 gap-0 overflow-hidden flex flex-col sm:max-w-2xl">
          <DialogTitle className="sr-only">
            {t('calculator.templates', { defaultValue: '模板' })}
          </DialogTitle>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <CalculatorTemplatePanel
              onSelectTemplate={handleInsertTemplate}
              onClose={() => setTemplateManagerOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={textImportOpen}
        onOpenChange={(o) => {
          setTextImportOpen(o);
          if (!o) setTextImportConfirmOpen(false);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('calculator.importTextTitle', { defaultValue: '从多行文本导入' })}
            </DialogTitle>
            <DialogDescription>
              {t('calculator.pasteLinesHint', {
                defaultValue: '每行一条表达式。可选择追加到当前工作表，或替换当前工作表中的全部行。',
              })}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={textImportBody}
            onChange={(e) => setTextImportBody(e.target.value)}
            rows={14}
            className="font-mono text-sm"
            placeholder={t('calculator.importTextPlaceholder', { defaultValue: '粘贴或输入多行…' })}
          />
          <div className="flex flex-wrap gap-2 py-2">
            <Button
              type="button"
              variant={textImportMode === 'append' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setTextImportMode('append')}
            >
              {t('calculator.importTextAppend', { defaultValue: '追加到当前工作表' })}
            </Button>
            <Button
              type="button"
              variant={textImportMode === 'replace' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setTextImportMode('replace')}
            >
              {t('calculator.importTextReplaceSheet', { defaultValue: '替换当前工作表' })}
            </Button>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTextImportOpen(false)}>
              {t('common.cancel', { defaultValue: '取消' })}
            </Button>
            <Button onClick={openTextImportConfirm} disabled={!textImportBody.trim()}>
              {t('calculator.importTextNext', { defaultValue: '继续' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={textImportConfirmOpen} onOpenChange={setTextImportConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {textImportMode === 'replace'
                ? t('calculator.importTextConfirmReplaceTitle', { defaultValue: '替换当前工作表？' })
                : t('calculator.importTextConfirmAppendTitle', { defaultValue: '追加多行文本？' })}
            </DialogTitle>
            <DialogDescription>
              {t('calculator.importTextConfirmLines', {
                defaultValue: '将导入约 {{count}} 行。',
                count: textImportLineCount,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTextImportConfirmOpen(false)}>
              {t('common.cancel', { defaultValue: '取消' })}
            </Button>
            <Button
              onClick={() => {
                void applyTextImport();
              }}
            >
              {t('common.confirm', { defaultValue: '确认' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        <VersionHistoryPanel
          open={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          projectId={doc.projectId}
          documentId={doc.id}
        />
      </Suspense>

      {/* 导出对话框 */}
      <CalculatorExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        calcDoc={calcDoc}
        defaultTitle={doc.title || 'calculator'}
      />
    </div>
  );
}

export default function CalculatorWorkspace(props: DocTypeEditorProps) {
  return (
    <CalculatorWorkspaceErrorBoundary docId={props.document.id}>
      <CalculatorWorkspaceMain {...props} />
    </CalculatorWorkspaceErrorBoundary>
  );
}
