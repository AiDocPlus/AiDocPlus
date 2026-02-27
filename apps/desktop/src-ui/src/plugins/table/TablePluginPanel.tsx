import { useState, useCallback, useRef, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import {
  Plus, Download, Upload, Table2,
  Rows3, Columns3, ChevronDown, ChevronUp,
  ArrowUpDown, ArrowUp, ArrowDown, Copy, Trash2, X,
  ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine,
  Calculator,
} from 'lucide-react';
import {
  type TableSheet,
  type FormulaType,
  createEmptySheet,
  addRow,
  insertRow,
  removeRow,
  addColumn,
  insertColumn,
  removeColumn,
  updateCell,
  sortByColumn,
  calcColumnStats,
  buildFormulaRow,
  evaluateCellFormula,
  sheetsToMarkdown,
  exportSheetsToXlsx,
  exportSheetsToCsv,
  exportSheetsToJson,
  exportSheetsToMarkdown,
  parseXlsxFile,
  parseCsvText,
} from './tableUtils';
import { setFileSaveAPI } from './tableUtils';
import { truncateContent } from '../_framework/pluginUtils';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { PluginPromptBuilderDialog } from '../_framework/PluginPromptBuilderDialog';

/** 插件数据结构（多表格） */
interface TablePluginData {
  sheets?: TableSheet[];
  lastPrompt?: string;
}

type SortState = { col: number; dir: 'asc' | 'desc' } | null;

const DEFAULT_PROMPT = '根据本文档的正文内容，提取其中的数据和表格，汇总生成多个表格。';

/**
 * 表格编辑器插件面板
 * 支持多表格：AI 生成 / 手动创建 / 导入，多 Sheet 导出
 */
export function TablePluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  // 注入文件保存能力到 tableUtils
  useEffect(() => {
    setFileSaveAPI({
      showSaveDialog: (opts) => host.ui.showSaveDialog(opts),
      writeFile: (path, data) => host.platform.invoke('write_binary_file', { path, data }),
    });
  }, [host]);
  const raw = (pluginData as TablePluginData) || {};

  // 兼容旧数据格式（单表格 → 多表格）
  const initSheets = (): TableSheet[] => {
    if (raw.sheets && raw.sheets.length > 0) return raw.sheets;
    // 兼容旧格式
    const old = pluginData as { tableData?: unknown[][]; headers?: string[]; hasHeader?: boolean } | null;
    if (old?.tableData && Array.isArray(old.tableData) && old.tableData.length > 0) {
      return [{ name: '表格1', headers: old.headers || [], data: old.tableData as TableSheet['data'] }];
    }
    return [];
  };

  const [sheets, setSheets] = useState<TableSheet[]>(initSheets);
  const [activeIdx, setActiveIdx] = useState(0);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState(raw.lastPrompt || DEFAULT_PROMPT);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [sortState, setSortState] = useState<SortState>(null);
  const [renamingSheet, setRenamingSheet] = useState<number | null>(null);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const FORMULA_GROUPS: { label: string; items: FormulaType[] }[] = [
    { label: t('formulaGroupBasic'), items: ['SUM', 'AVG', 'MAX', 'MIN', 'COUNT'] },
    { label: t('formulaGroupAdvanced'), items: ['MEDIAN', 'VAR', 'STDEV', 'DISTINCT'] },
  ];
  // ALL_FORMULAS 用于未来扩展

  const persist = useCallback((newSheets: TableSheet[]) => {
    setSheets(newSheets);
    onPluginDataChange({ sheets: newSheets, lastPrompt: prompt });
  }, [prompt, onPluginDataChange]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    onPluginDataChange({ sheets, lastPrompt: val });
    host.docData!.markDirty();
  }, [sheets, onPluginDataChange, host]);

  const updateCurrentSheet = useCallback((updater: (s: TableSheet) => TableSheet) => {
    const newSheets = sheets.map((s, i) => i === activeIdx ? updater(s) : s);
    persist(newSheets);
    host.docData!.markDirty();
  }, [sheets, activeIdx, persist, host]);

  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  const docTitle = document.title?.replace(/[/\\:*?"<>|]/g, '_') || '表格';
  const sheet = sheets[activeIdx] || null;

  // ── AI 生成多表格 ──
  const handleGenerate = async () => {
    const sourceContent = content || document.aiGeneratedContent || document.content || '';
    if (!sourceContent.trim()) {
      showStatus(t('emptyContent'), true);
      return;
    }

    setGenerating(true);
    showStatus('正在生成表格，请稍候...', false, true);
    const userPrompt = prompt.trim() || DEFAULT_PROMPT;

    try {
      const messages = [
        {
          role: 'system',
          content: `你是一个数据提取助手。请根据用户的要求，从文档内容中提取信息并生成一个或多个表格。
请严格以 JSON 格式返回，格式如下：
{"tables":[{"name":"表格名称","headers":["列名1","列名2"],"rows":[["值1","值2"],["值3","值4"]]}]}
注意：
1. 只返回 JSON，不要添加任何其他文字、解释或 markdown 代码块标记
2. 所有值都必须是字符串类型
3. 每行的列数必须与 headers 一致
4. 可以生成多个表格，每个表格有独立的 name、headers 和 rows
5. 根据内容的不同维度或分类，合理拆分为多个表格`
        },
        { role: 'user', content: `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 4096 });

      let jsonStr = result.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(jsonStr) as { tables?: { name: string; headers: string[]; rows: string[][] }[] };

      let newSheets: TableSheet[];
      if (parsed.tables && Array.isArray(parsed.tables) && parsed.tables.length > 0) {
        newSheets = parsed.tables.map(t => ({
          name: t.name || '表格',
          headers: t.headers || [],
          data: t.rows || [],
        }));
      } else {
        // 兼容旧的单表格格式
        const single = parsed as unknown as { headers?: string[]; rows?: string[][] };
        if (single.headers && single.rows) {
          newSheets = [{ name: '表格1', headers: single.headers, data: single.rows }];
        } else {
          throw new Error('AI 返回的 JSON 格式不正确');
        }
      }

      persist(newSheets);
      setActiveIdx(0);
      setSortState(null);
      setSelectedRow(null);
      setSelectedCol(null);
      host.docData!.markDirty();
      showStatus(t('generateSuccess'));
      onRequestSave?.();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showStatus(t('generateFailed', { error: errMsg }), true);
    } finally {
      setGenerating(false);
    }
  };

  // ── 导入 ──
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    const onParsed = (imported: TableSheet[]) => {
      persist(imported);
      setActiveIdx(0);
      setSortState(null);
      host.docData!.markDirty();
      const totalRows = imported.reduce((s, t) => s + t.data.length, 0);
      showStatus(`已导入 ${imported.length} 个表格，共 ${totalRows} 行`);
    };

    if (ext === 'csv') {
      file.text().then(text => onParsed(parseCsvText(text)))
        .catch(err => showStatus(`导入失败: ${err instanceof Error ? err.message : String(err)}`, true));
    } else {
      file.arrayBuffer().then(buffer => onParsed(parseXlsxFile(buffer)))
        .catch(err => showStatus(`导入失败: ${err instanceof Error ? err.message : String(err)}`, true));
    }
    e.target.value = '';
  }, [persist, host]);

  // ── 表格管理 ──
  const handleAddSheet = () => {
    const newSheets = [...sheets, createEmptySheet(`表格${sheets.length + 1}`)];
    persist(newSheets);
    setActiveIdx(newSheets.length - 1);
    host.docData!.markDirty();
  };

  const handleDeleteSheet = (idx: number) => {
    if (sheets.length <= 1) return;
    const newSheets = sheets.filter((_, i) => i !== idx);
    persist(newSheets);
    if (activeIdx >= newSheets.length) setActiveIdx(newSheets.length - 1);
    else if (activeIdx === idx) setActiveIdx(Math.max(0, idx - 1));
    host.docData!.markDirty();
  };

  const handleRenameSheet = (idx: number, name: string) => {
    const newSheets = sheets.map((s, i) => i === idx ? { ...s, name } : s);
    persist(newSheets);
    setRenamingSheet(null);
    host.docData!.markDirty();
  };

  // ── 单元格编辑 ──
  const handleCellChange = useCallback((row: number, col: number, value: string) => {
    updateCurrentSheet(s => ({ ...s, data: updateCell(s.data, row, col, value) }));
  }, [updateCurrentSheet]);

  const handleHeaderChange = useCallback((col: number, value: string) => {
    updateCurrentSheet(s => {
      const newHeaders = [...s.headers];
      newHeaders[col] = value;
      return { ...s, headers: newHeaders };
    });
  }, [updateCurrentSheet]);

  // ── 行操作 ──
  const handleAddRow = useCallback(() => updateCurrentSheet(s => ({ ...s, data: addRow(s.data) })), [updateCurrentSheet]);
  const handleInsertRowAbove = useCallback(() => {
    if (selectedRow === null) return;
    updateCurrentSheet(s => ({ ...s, data: insertRow(s.data, selectedRow) }));
    setSelectedRow(selectedRow + 1);
  }, [selectedRow, updateCurrentSheet]);
  const handleInsertRowBelow = useCallback(() => {
    if (selectedRow === null) return;
    updateCurrentSheet(s => ({ ...s, data: insertRow(s.data, selectedRow + 1) }));
  }, [selectedRow, updateCurrentSheet]);
  const handleDeleteRow = useCallback(() => {
    if (selectedRow === null || !sheet || sheet.data.length <= 1) return;
    updateCurrentSheet(s => ({ ...s, data: removeRow(s.data, selectedRow) }));
    setSelectedRow(null);
  }, [selectedRow, sheet, updateCurrentSheet]);

  // ── 列操作 ──
  const handleAddCol = useCallback(() => {
    updateCurrentSheet(s => ({ ...s, data: addColumn(s.data), headers: [...s.headers, `列${s.headers.length + 1}`] }));
  }, [updateCurrentSheet]);
  const handleInsertColLeft = useCallback(() => {
    if (selectedCol === null) return;
    updateCurrentSheet(s => {
      const h = [...s.headers]; h.splice(selectedCol, 0, `列${s.headers.length + 1}`);
      return { ...s, data: insertColumn(s.data, selectedCol), headers: h };
    });
    setSelectedCol(selectedCol + 1);
  }, [selectedCol, updateCurrentSheet]);
  const handleInsertColRight = useCallback(() => {
    if (selectedCol === null) return;
    updateCurrentSheet(s => {
      const h = [...s.headers]; h.splice(selectedCol + 1, 0, `列${s.headers.length + 1}`);
      return { ...s, data: insertColumn(s.data, selectedCol + 1), headers: h };
    });
  }, [selectedCol, updateCurrentSheet]);
  const handleDeleteCol = useCallback(() => {
    if (selectedCol === null || !sheet || (sheet.data.length > 0 && sheet.data[0].length <= 1)) return;
    updateCurrentSheet(s => ({
      ...s, data: removeColumn(s.data, selectedCol), headers: s.headers.filter((_, i) => i !== selectedCol),
    }));
    setSelectedCol(null);
  }, [selectedCol, sheet, updateCurrentSheet]);

  // ── 公式：插入汇总行 ──
  const handleInsertFormulaRow = useCallback((formula: FormulaType) => {
    if (!sheet) return;
    const row = buildFormulaRow(sheet.data, sheet.headers, formula);
    updateCurrentSheet(s => ({ ...s, data: [...s.data, row] }));
    showStatus(t('formulaInserted', { formula }));
  }, [sheet, updateCurrentSheet, t]);

  // ── 当前选中列的统计信息 ──
  const colStats = (selectedCol !== null && sheet) ? calcColumnStats(sheet.data, selectedCol) : null;

  // ── 排序 ──
  const handleSort = useCallback((colIndex: number) => {
    let newDir: 'asc' | 'desc' = 'asc';
    if (sortState && sortState.col === colIndex) newDir = sortState.dir === 'asc' ? 'desc' : 'asc';
    updateCurrentSheet(s => ({ ...s, data: sortByColumn(s.data, colIndex, newDir) }));
    setSortState({ col: colIndex, dir: newDir });
  }, [sortState, updateCurrentSheet]);

  // ── 复制 Markdown ──
  const handleCopyMarkdown = useCallback(async () => {
    const md = sheetsToMarkdown(sheets);
    await navigator.clipboard.writeText(md);
    showStatus(t('copiedToClipboard'));
  }, [sheets]);

  // ── 清空所有 ──
  const handleReset = useCallback(() => {
    persist([]);
    setPrompt(DEFAULT_PROMPT);
    setActiveIdx(0);
    setSelectedRow(null);
    setSelectedCol(null);
    setSortState(null);
    showStatus('已清空全部内容');
  }, [persist]);

  // ── 导出 ──
  const handleExportXlsx = async () => {
    try {
      const path = await exportSheetsToXlsx(sheets, `${docTitle}.xlsx`);
      if (path) showStatus(`已导出: ${path}`);
    } catch (e) { showStatus(`导出失败: ${e instanceof Error ? e.message : String(e)}`, true); }
  };
  const handleExportCsv = async () => {
    try {
      const path = await exportSheetsToCsv(sheets, `${docTitle}.csv`);
      if (path) showStatus(`已导出: ${path}`);
    } catch (e) { showStatus(`导出失败: ${e instanceof Error ? e.message : String(e)}`, true); }
  };
  const handleExportJson = async () => {
    try {
      const path = await exportSheetsToJson(sheets, `${docTitle}.json`);
      if (path) showStatus(`已导出: ${path}`);
    } catch (e) { showStatus(`导出失败: ${e instanceof Error ? e.message : String(e)}`, true); }
  };
  const handleExportMd = async () => {
    try {
      const path = await exportSheetsToMarkdown(sheets, `${docTitle}.md`);
      if (path) showStatus(`已导出: ${path}`);
    } catch (e) { showStatus(`导出失败: ${e instanceof Error ? e.message : String(e)}`, true); }
  };

  const hasData = sheets.length > 0 && sheets.some(s => s.data.length > 0);
  const rows = sheet?.data.length ?? 0;
  const cols = sheet ? (sheet.data.length > 0 ? sheet.data[0].length : sheet.headers.length) : 0;

  // ── 排序图标 ──
  const SortIcon = ({ ci }: { ci: number }) => {
    if (sortState?.col === ci) {
      return sortState.dir === 'asc'
        ? <ArrowUp className="h-3 w-3 inline ml-1 text-primary" />
        : <ArrowDown className="h-3 w-3 inline ml-1 text-primary" />;
    }
    return <ArrowUpDown className="h-3 w-3 inline ml-1 text-muted-foreground/40" />;
  };

  // ── 工具栏 ──
  const toolbarContent = (
    <>
      <Button variant="outline" size="sm" onClick={handleAddRow} className="gap-1 h-7 text-xs" title="添加行">
        <Rows3 className="h-3 w-3" /><Plus className="h-2.5 w-2.5" />
      </Button>
      {selectedRow !== null && (
        <>
          <Button variant="outline" size="sm" onClick={handleInsertRowAbove} className="gap-1 h-7 text-xs" title="上方插入行">
            <ArrowUpToLine className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleInsertRowBelow} className="gap-1 h-7 text-xs" title="下方插入行">
            <ArrowDownToLine className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeleteRow} className="gap-1 h-7 text-xs text-destructive" title="删除选中行" disabled={rows <= 1}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button variant="outline" size="sm" onClick={handleAddCol} className="gap-1 h-7 text-xs" title="添加列">
        <Columns3 className="h-3 w-3" /><Plus className="h-2.5 w-2.5" />
      </Button>
      {selectedCol !== null && (
        <>
          <Button variant="outline" size="sm" onClick={handleInsertColLeft} className="gap-1 h-7 text-xs" title="左侧插入列">
            <ArrowLeftToLine className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleInsertColRight} className="gap-1 h-7 text-xs" title="右侧插入列">
            <ArrowRightToLine className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeleteCol} className="gap-1 h-7 text-xs text-destructive" title="删除选中列" disabled={cols <= 1}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
      <div className="w-px h-4 bg-border mx-0.5" />
      {/* 公式按钮 */}
      <div className="relative">
        <Button variant="outline" size="sm" onClick={() => setFormulaOpen(!formulaOpen)} className="gap-1 h-7 text-xs" title={t('formula')}>
          <Calculator className="h-3 w-3" />{t('formula')}
          {formulaOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        </Button>
        {formulaOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-lg p-1.5 min-w-[180px]">
            {FORMULA_GROUPS.map((group, gi) => (
              <div key={gi}>
                {gi > 0 && <div className="h-px bg-border my-1" />}
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</div>
                {group.items.map(f => (
                  <button
                    key={f}
                    className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-accent transition-colors flex items-center gap-2"
                    onClick={() => { handleInsertFormulaRow(f); setFormulaOpen(false); }}
                  >
                    <span className="font-mono font-semibold w-16 text-primary">{f}</span>
                    <span className="text-muted-foreground">{t(`formula_${f}`)}</span>
                  </button>
                ))}
              </div>
            ))}
            <div className="h-px bg-border my-1" />
            <div className="px-2 py-1 text-[10px] text-muted-foreground">
              {t('formulaCellHint')}
            </div>
          </div>
        )}
      </div>
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 h-7 text-xs" title={t('importFile')}>
        <Upload className="h-3 w-3" />
      </Button>
      <Button variant="outline" size="sm" onClick={handleCopyMarkdown} className="gap-1 h-7 text-xs" title={t('copiedToClipboard')}>
        <Copy className="h-3 w-3" />MD
      </Button>
      <div className="flex-1" />
      <span className="text-xs text-muted-foreground">{sheets.length} 表 · {rows} 行 × {cols} 列</span>
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button variant="outline" size="sm" onClick={handleExportXlsx} className="gap-1 h-7 text-xs">
        <Download className="h-3 w-3" />Excel
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 h-7 text-xs">
        <Download className="h-3 w-3" />CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportJson} className="gap-1 h-7 text-xs">
        <Download className="h-3 w-3" />JSON
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportMd} className="gap-1 h-7 text-xs">
        <Download className="h-3 w-3" />MD
      </Button>
    </>
  );

  // ── 状态栏额外内容（选中行/列信息 + 列统计） ──
  const statusExtraContent = (selectedRow !== null || selectedCol !== null) ? (
    <span className="flex items-center gap-2 flex-wrap">
      <span className="text-blue-600 dark:text-blue-400">
        {selectedRow !== null && t('selectedRow', { num: selectedRow + 1 })}
        {selectedCol !== null && t('selectedCol', { num: selectedCol + 1 })}
        {selectedCol !== null && sheet?.headers[selectedCol] && ` (${sheet.headers[selectedCol]})`}
      </span>
      <button className="underline text-blue-600 dark:text-blue-400" onClick={() => { setSelectedRow(null); setSelectedCol(null); }}>{t('cancelSelect')}</button>
      {colStats && (
        <>
          <span className="mx-1 text-border">|</span>
          <span className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <Calculator className="h-3 w-3 inline flex-shrink-0" />
            <span className="text-green-600 dark:text-green-400"><b>Σ</b> {Number.isInteger(colStats.sum) ? colStats.sum : colStats.sum.toFixed(2)}</span>
            <span><b>AVG</b> {colStats.avg.toFixed(2)}</span>
            <span><b>MED</b> {Number.isInteger(colStats.median) ? colStats.median : colStats.median.toFixed(2)}</span>
            <span><b>MAX</b> {Number.isInteger(colStats.max) ? colStats.max : colStats.max.toFixed(2)}</span>
            <span><b>MIN</b> {Number.isInteger(colStats.min) ? colStats.min : colStats.min.toFixed(2)}</span>
            <span><b>σ</b> {colStats.stdev.toFixed(2)}</span>
            <span><b>N</b> {colStats.count}/{colStats.totalCount}</span>
            <span><b>D</b> {colStats.distinct}</span>
          </span>
        </>
      )}
    </span>
  ) : null;

  // ── 提示词构造器弹窗 ──
  const promptBuilderDialog = (
    <PluginPromptBuilderDialog
      open={builderOpen}
      onOpenChange={setBuilderOpen}
      description={t('promptBuilderDesc', { defaultValue: '设置表格生成需求，自动组装提示词' })}
      onConfirm={(builtPrompt) => handlePromptChange(builtPrompt)}
      previewPrompt={prompt}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t('promptBuilderHint', { defaultValue: '您可以直接在提示词框中编辑，或使用下方快捷选项：' })}
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handlePromptChange('根据本文档的正文内容，提取其中的数据和表格，汇总生成多个表格。')}>
            {t('promptPresetExtract', { defaultValue: '提取数据表格' })}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePromptChange('根据本文档的正文内容，生成对比分析表格。')}>
            {t('promptPresetCompare', { defaultValue: '对比分析' })}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePromptChange('根据本文档的正文内容，生成统计汇总表格。')}>
            {t('promptPresetSummary', { defaultValue: '统计汇总' })}
          </Button>
        </div>
      </div>
    </PluginPromptBuilderDialog>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<Table2 className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('welcomeDesc')}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder')}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 生成表格' })}
      generatingLabel={t('generating')}
      onPromptBuilderOpen={() => setBuilderOpen(true)}
      promptBuilderDialog={promptBuilderDialog}
      toolbar={toolbarContent}
      hasContent={hasData}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      statusExtra={statusExtraContent}
      onClearAll={handleReset}
      sourceCode={hasData ? JSON.stringify(sheets, null, 2) : undefined}
      onSourceCodeSave={(code) => {
        try {
          const parsed = JSON.parse(code);
          if (Array.isArray(parsed)) {
            persist(parsed);
            setActiveIdx(0);
            host.docData!.markDirty();
          }
        } catch { /* ignore invalid JSON */ }
      }}
    >
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />

      {/* ③ 内容区（标签栏 + 表格） */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* 标签栏 */}
        {sheets.length > 0 && (
          <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30 flex-shrink-0 overflow-x-auto">
            {sheets.map((s, idx) => (
              <div
                key={idx}
                className={`group flex items-center gap-1 px-2.5 py-1 rounded-t-md text-xs cursor-pointer border border-b-0 transition-colors
                  ${idx === activeIdx
                    ? 'bg-background text-foreground font-medium border-border'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'
                  }`}
                onClick={() => { setActiveIdx(idx); setSelectedRow(null); setSelectedCol(null); setSortState(null); setEditingCell(null); }}
                onDoubleClick={() => setRenamingSheet(idx)}
              >
                {renamingSheet === idx ? (
                  <input
                    type="text"
                    className="w-20 bg-transparent outline-none text-xs"
                    defaultValue={s.name}
                    autoFocus
                    onBlur={(e) => handleRenameSheet(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSheet(idx, (e.target as HTMLInputElement).value);
                      if (e.key === 'Escape') setRenamingSheet(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate max-w-[100px]">{s.name || `表格${idx + 1}`}</span>
                )}
                {sheets.length > 1 && (
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); handleDeleteSheet(idx); }}
                    title="删除此表格"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              className="flex items-center px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded"
              onClick={handleAddSheet}
              title="新增表格"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 表格区域 */}
        {sheet && (
          <div className="flex-1 min-h-0 overflow-auto p-3">
            <table className="w-full border-collapse text-sm">
              {sheet.headers.length > 0 && (
                <thead>
                  <tr>
                    <th className="w-8 text-center text-xs text-muted-foreground bg-muted/50 border border-border px-1 py-1">#</th>
                    {sheet.headers.map((h, ci) => {
                      const isSelected = selectedCol === ci;
                      return (
                        <th
                          key={ci}
                          className={`border border-border px-2 py-1.5 min-w-[80px] max-w-[300px] font-semibold cursor-pointer select-none ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-400 ring-inset' : 'bg-muted/50'}`}
                          onClick={(e) => {
                            if (e.detail === 2) {
                              setEditingCell({ row: -1, col: ci });
                              setSelectedCol(null);
                            } else {
                              setSelectedCol(isSelected ? null : ci);
                              setSelectedRow(null);
                            }
                          }}
                        >
                          {editingCell?.row === -1 && editingCell?.col === ci ? (
                            <input
                              type="text"
                              className="w-full bg-transparent outline-none text-sm font-semibold"
                              style={{ fontFamily: '宋体', fontSize: '16px' }}
                              defaultValue={h}
                              autoFocus
                              onBlur={(e) => { handleHeaderChange(ci, e.target.value); setEditingCell(null); }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Tab') {
                                  e.preventDefault();
                                  handleHeaderChange(ci, (e.target as HTMLInputElement).value);
                                  setEditingCell(e.key === 'Tab' && ci < cols - 1 ? { row: -1, col: ci + 1 } : null);
                                } else if (e.key === 'Escape') { setEditingCell(null); }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="flex items-center justify-between gap-1">
                              <span className="truncate" style={{ fontFamily: '宋体', fontSize: '16px' }}>{h || '\u00A0'}</span>
                              <button
                                className="flex-shrink-0 p-0.5 rounded hover:bg-accent/50"
                                onClick={(e) => { e.stopPropagation(); handleSort(ci); }}
                                title="排序"
                              >
                                <SortIcon ci={ci} />
                              </button>
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
              )}
              <tbody>
                {sheet.data.map((row, ri) => {
                  const isRowSelected = selectedRow === ri;
                  const isEvenRow = ri % 2 === 0;
                  return (
                    <tr key={ri} className={isRowSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                      <td
                        className={`w-8 text-center text-xs select-none px-1 py-1 border border-border cursor-pointer ${isRowSelected ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 font-bold' : 'text-muted-foreground bg-muted/30'}`}
                        onClick={() => { setSelectedRow(isRowSelected ? null : ri); setSelectedCol(null); }}
                        title={`点击选中第 ${ri + 1} 行`}
                      >
                        {ri + 1}
                      </td>
                      {row.map((cell, ci) => {
                        const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                        const isColSelected = selectedCol === ci;
                        const formulaResult = evaluateCellFormula(cell, sheet.data);
                        const isFormula = formulaResult !== null;
                        const displayValue = isFormula ? formulaResult : (cell !== '' ? String(cell) : '\u00A0');
                        return (
                          <td
                            key={ci}
                            className={`border border-border px-2 py-1 min-w-[80px] max-w-[300px] cursor-text
                              ${isEditing ? 'ring-2 ring-primary ring-inset' : 'hover:bg-accent/30'}
                              ${isRowSelected ? 'bg-blue-50 dark:bg-blue-900/20' : isColSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : isEvenRow ? 'bg-background' : 'bg-muted/10'}
                            `}
                            onClick={() => { setEditingCell({ row: ri, col: ci }); setSelectedRow(null); setSelectedCol(null); }}
                            title={isFormula ? String(cell) : undefined}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-full bg-transparent outline-none text-sm"
                                style={{ fontFamily: '宋体', fontSize: '16px' }}
                                defaultValue={String(cell)}
                                autoFocus
                                onBlur={(e) => { handleCellChange(ri, ci, e.target.value); setEditingCell(null); }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCellChange(ri, ci, (e.target as HTMLInputElement).value);
                                    setEditingCell(ri < rows - 1 ? { row: ri + 1, col: ci } : null);
                                  } else if (e.key === 'Tab') {
                                    e.preventDefault();
                                    handleCellChange(ri, ci, (e.target as HTMLInputElement).value);
                                    if (ci < cols - 1) setEditingCell({ row: ri, col: ci + 1 });
                                    else if (ri < rows - 1) setEditingCell({ row: ri + 1, col: 0 });
                                    else setEditingCell(null);
                                  } else if (e.key === 'Escape') { setEditingCell(null); }
                                }}
                              />
                            ) : (
                              <span
                                className={`block truncate ${isFormula ? 'text-purple-600 dark:text-purple-400 italic' : ''} ${displayValue === '#ERR' ? 'text-destructive font-bold' : ''}`}
                                style={{ fontFamily: '宋体', fontSize: '16px' }}
                              >
                                {displayValue}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PluginPanelLayout>
  );
}
