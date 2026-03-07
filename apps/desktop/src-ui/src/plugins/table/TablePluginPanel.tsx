import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { PluginPanelProps } from '../types';
import {
  Button,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../_framework/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePluginHost } from '../_framework/PluginHostAPI';
import {
  Upload, Copy, Sparkles, Loader2,
  Columns3, Check, PanelTop, FileDown, Settings2,
} from 'lucide-react';
import type { Sheet } from '@fortune-sheet/core';
import {
  type TableSheet,
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
import { FortuneSheetWrapper } from './FortuneSheetWrapper';
import type { FortuneSheetRef, SelectionInfo } from './FortuneSheetWrapper';
import { loadFortuneData, packFortuneData, tableSheetsToFortune, fortuneToTableSheets } from './tableDataBridge';
import { useTableActionBridge } from './tableActionBridge';
import { autoFitColumns } from './tableAutoFit';

const DEFAULT_PROMPT = '根据本文档的正文内容，提取其中的数据和表格，汇总生成多个表格。';

/** 选区统计数据 */
interface SelectionStats {
  count: number;
  numericCount: number;
  sum: number;
  avg: number;
}

/**
 * 表格插件面板（FortuneSheet 版）
 *
 * 一打开即展示 Excel 级电子表格界面，不再使用 PluginPanelLayout 的欢迎页模式。
 * 顶部：AI 工具栏 + 编辑工具栏 + 导入导出
 * 中部：FortuneSheet（占满剩余空间，支持拖拽导入）
 * 底部：智能状态栏（Sheet 信息 + 选区统计 + 保存状态）
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

  // ── 状态 ──
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [frozen, setFrozen] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'unsaved' | 'idle'>('idle');
  const [draggingOver, setDraggingOver] = useState(false);
  const [selectionStats, setSelectionStats] = useState<SelectionStats | null>(null);
  const [sheetInfo, setSheetInfo] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<FortuneSheetRef>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCounterRef = useRef(0);

  // ── 加载 FortuneSheet 初始数据 ──
  const initialData = useMemo(() => loadFortuneData(pluginData), []);

  const showStatus = useCallback((msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  }, []);

  const docTitle = document.title?.replace(/[/\\:*?"<>|]/g, '_') || '表格';

  // ── 数据变更持久化 + 防抖磁盘保存 ──
  const diskSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDataChange = useCallback((sheets: Sheet[]) => {
    const packed = packFortuneData(sheets);
    onPluginDataChange(packed);
    host.docData!.markDirty();

    // 立即显示未保存状态
    setSaveState('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (diskSaveTimerRef.current) clearTimeout(diskSaveTimerRef.current);

    // 3 秒无新编辑后触发磁盘保存
    diskSaveTimerRef.current = setTimeout(() => {
      onRequestSave?.();
      setSaveState('saved');
      saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
    }, 3000);
  }, [onPluginDataChange, host, onRequestSave]);

  // ── 获取当前 TableSheet[] 用于导出 ──
  const getCurrentTableSheets = useCallback((): TableSheet[] => {
    const inst = sheetRef.current;
    if (!inst) return [];
    const fortuneSheets = inst.getAllSheets();
    return fortuneToTableSheets(fortuneSheets);
  }, []);

  // ── AI 动作桥接 ──
  useTableActionBridge({ sheetRef, onDataChange: handleDataChange, showStatus });

  // ── 选区变化 → 状态栏统计 ──
  const handleSelectionChange = useCallback((info: SelectionInfo) => {
    const inst = sheetRef.current;
    if (!inst) return;

    try {
      const sel = info.selection;
      if (!sel || !Array.isArray(sel.row) || !Array.isArray(sel.column)) {
        setSelectionStats(null);
        return;
      }

      const [r0, r1] = sel.row;
      const [c0, c1] = sel.column;
      const rowCount = r1 - r0 + 1;
      const colCount = c1 - c0 + 1;

      // 单个单元格不显示统计
      if (rowCount <= 1 && colCount <= 1) {
        setSelectionStats(null);
        return;
      }

      let count = 0;
      let numericCount = 0;
      let sum = 0;

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          count++;
          const val = inst.getCellValue(r, c);
          if (val !== null && val !== undefined && val !== '') {
            const num = typeof val === 'number' ? val : Number(val);
            if (!isNaN(num)) {
              numericCount++;
              sum += num;
            }
          }
        }
      }

      setSelectionStats({
        count,
        numericCount,
        sum,
        avg: numericCount > 0 ? sum / numericCount : 0,
      });
    } catch {
      setSelectionStats(null);
    }
  }, []);

  // ── 更新 Sheet 信息 ──
  const updateSheetInfo = useCallback(() => {
    try {
      const inst = sheetRef.current;
      if (!inst) return;
      const sheets = inst.getAllSheets();
      if (!sheets.length) return;
      const current = inst.getSheet();
      if (!current) return;
      const name = current.name || '';
      const celldata = current.celldata || [];
      let maxR = 0, maxC = 0;
      for (const cell of celldata) {
        if (cell.r > maxR) maxR = cell.r;
        if (cell.c > maxC) maxC = cell.c;
      }
      const rows = celldata.length > 0 ? maxR + 1 : 0;
      const cols = celldata.length > 0 ? maxC + 1 : 0;
      setSheetInfo(`${name} · ${sheets.length} ${t('sheet', { defaultValue: '表' })} · ${rows}${t('rows', { defaultValue: '行' })} × ${cols}${t('cols', { defaultValue: '列' })}`);
    } catch {
      // FortuneSheet 尚未初始化完成，静默忽略
    }
  }, [t]);

  // 定期更新 Sheet 信息
  useEffect(() => {
    updateSheetInfo();
    const timer = setInterval(updateSheetInfo, 2000);
    return () => clearInterval(timer);
  }, [updateSheetInfo]);

  // ── 冻结首行 ──
  const handleFreezeToggle = useCallback(() => {
    const inst = sheetRef.current;
    if (!inst) return;
    if (frozen) {
      inst.freeze('row', { row: 0, column: 0 });
      setFrozen(false);
      showStatus(t('unfreezeHeader', { defaultValue: '已取消冻结首行' }));
    } else {
      inst.freeze('row', { row: 1, column: 0 });
      setFrozen(true);
      showStatus(t('freezeHeader', { defaultValue: '已冻结首行' }));
    }
  }, [frozen, showStatus, t]);

  // ── 自适应列宽 ──
  const handleAutoFit = useCallback(() => {
    const inst = sheetRef.current;
    if (!inst) return;
    autoFitColumns(inst);
    showStatus(t('autoFitDone', { defaultValue: '列宽已自适应' }));
  }, [showStatus, t]);

  // ── AI 生成表格 ──
  const handleGenerate = useCallback(async () => {
    const sourceContent = content || document.aiGeneratedContent || document.content || '';
    if (!sourceContent.trim()) {
      showStatus(t('emptyContent', { defaultValue: '文档内容为空，无法生成表格' }), true);
      return;
    }

    setGenerating(true);
    showStatus(t('generatingMsg', { defaultValue: '正在根据文档内容生成表格...' }), false, true);
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
        newSheets = parsed.tables.map(tbl => ({
          name: tbl.name || '表格',
          headers: tbl.headers || [],
          data: tbl.rows || [],
        }));
      } else {
        const single = parsed as unknown as { headers?: string[]; rows?: string[][] };
        if (single.headers && single.rows) {
          newSheets = [{ name: '表格1', headers: single.headers, data: single.rows }];
        } else {
          throw new Error('AI 返回的 JSON 格式不正确');
        }
      }

      // 转换为 FortuneSheet 格式并写入
      const fortuneData = tableSheetsToFortune(newSheets);
      sheetRef.current?.updateSheets(fortuneData);

      // 自动调整列宽
      setTimeout(() => { if (sheetRef.current) autoFitColumns(sheetRef.current); }, 100);

      // 持久化
      const packed = packFortuneData(fortuneData);
      onPluginDataChange(packed);
      host.docData!.markDirty();
      showStatus(t('generateSuccess', { defaultValue: '表格生成完成' }));
      onRequestSave?.();
      setAiPopoverOpen(false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showStatus(t('generateFailed', { error: errMsg, defaultValue: '表格生成失败：{{error}}' }), true);
    } finally {
      setGenerating(false);
    }
  }, [content, document, prompt, host, t, onPluginDataChange, onRequestSave, showStatus]);

  // ── 导入文件（通用，供按钮和拖拽使用） ──
  const importFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    const onParsed = (imported: TableSheet[]) => {
      const fortuneData = tableSheetsToFortune(imported);
      sheetRef.current?.updateSheets(fortuneData);
      setTimeout(() => { if (sheetRef.current) autoFitColumns(sheetRef.current); }, 100);
      const packed = packFortuneData(fortuneData);
      onPluginDataChange(packed);
      host.docData!.markDirty();
      const totalRows = imported.reduce((s, tbl) => s + tbl.data.length, 0);
      showStatus(t('importSuccess', { defaultValue: '导入成功' }) + ` — ${imported.length} ${t('sheet', { defaultValue: '表' })}, ${totalRows} ${t('rows', { defaultValue: '行' })}`);
    };

    if (ext === 'csv') {
      file.text().then(text => onParsed(parseCsvText(text)))
        .catch(err => showStatus(t('importFailed', { defaultValue: '导入失败' }) + `: ${err instanceof Error ? err.message : String(err)}`, true));
    } else {
      file.arrayBuffer().then(buffer => onParsed(parseXlsxFile(buffer)))
        .catch(err => showStatus(t('importFailed', { defaultValue: '导入失败' }) + `: ${err instanceof Error ? err.message : String(err)}`, true));
    }
  }, [onPluginDataChange, host, t, showStatus]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importFile(file);
    e.target.value = '';
  }, [importFile]);

  // ── 拖拽导入 ──
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      showStatus(t('unsupportedFormat', { defaultValue: '不支持的文件格式，请拖入 .xlsx 或 .csv 文件' }), true);
      return;
    }
    importFile(file);
  }, [importFile, showStatus, t]);

  // ── 复制 Markdown ──
  const handleCopyMarkdown = useCallback(async () => {
    const sheets = getCurrentTableSheets();
    const md = sheetsToMarkdown(sheets);
    await navigator.clipboard.writeText(md);
    showStatus(t('copiedToClipboard', { defaultValue: '已复制到剪贴板' }));
  }, [getCurrentTableSheets, t, showStatus]);

  // ── 导出 ──
  const handleExport = useCallback(async (format: 'xlsx' | 'csv' | 'json' | 'md') => {
    const sheets = getCurrentTableSheets();
    if (sheets.length === 0) { showStatus(t('noData', { defaultValue: '无数据可导出' }), true); return; }
    try {
      let path: string | null = null;
      switch (format) {
        case 'xlsx': path = await exportSheetsToXlsx(sheets, `${docTitle}.xlsx`); break;
        case 'csv': path = await exportSheetsToCsv(sheets, `${docTitle}.csv`); break;
        case 'json': path = await exportSheetsToJson(sheets, `${docTitle}.json`); break;
        case 'md': path = await exportSheetsToMarkdown(sheets, `${docTitle}.md`); break;
      }
      if (path) showStatus(t('exportSuccess', { defaultValue: '导出成功' }) + `: ${path}`);
    } catch (e) {
      showStatus(t('exportFailed', { defaultValue: '导出失败' }) + `: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }, [getCurrentTableSheets, docTitle, t, showStatus]);

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── 顶部工具栏 ── */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30 flex-shrink-0" style={{ fontFamily: 'SimSun, "宋体", "Songti SC", serif', fontSize: '16px' }}>
        {/* AI 生成（Popover 内嵌 prompt） */}
        <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant={aiPopoverOpen ? 'default' : 'outline'} size="sm" className="gap-1.5 h-8 text-sm"
              title={t('generate', { defaultValue: 'AI 生成表格' })}>
              <Sparkles className="h-4 w-4" />
              {t('generate', { defaultValue: 'AI 生成' })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <p className="text-sm font-medium mb-2">{t('aiGenerateTitle', { defaultValue: 'AI 生成表格' })}</p>
            <input type="text"
              className="w-full text-sm border rounded px-2 py-1.5 bg-transparent outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              placeholder={t('promptPlaceholder', { defaultValue: '描述你需要的表格...' })}
              title={t('promptPlaceholder', { defaultValue: '描述你需要的表格...' })}
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !generating) handleGenerate(); }}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" className="h-8 text-sm gap-1" onClick={handleGenerate} disabled={generating}
                title={generating ? t('generating', { defaultValue: '生成中...' }) : t('generate', { defaultValue: '生成' })}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? t('generating', { defaultValue: '生成中...' }) : t('generate', { defaultValue: '生成' })}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* 📁 文件 下拉菜单（合并导入+导出+复制） */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-sm"
              title={t('fileMenu', { defaultValue: '文件' })}>
              <FileDown className="h-4 w-4" />
              {t('fileMenu', { defaultValue: '文件' })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem className="text-sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />{t('importFile', { defaultValue: '导入 Excel / CSV' })}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm" onClick={() => handleExport('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem className="text-sm" onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
            <DropdownMenuItem className="text-sm" onClick={() => handleExport('json')}>JSON</DropdownMenuItem>
            <DropdownMenuItem className="text-sm" onClick={() => handleExport('md')}>Markdown</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm" onClick={handleCopyMarkdown}>
              <Copy className="h-4 w-4 mr-2" />{t('copyMarkdown', { defaultValue: '复制为 Markdown' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ⚙ 视图 下拉菜单（合并冻结+列宽） */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-sm"
              title={t('viewMenu', { defaultValue: '视图' })}>
              <Settings2 className="h-4 w-4" />
              {t('viewMenu', { defaultValue: '视图' })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem className="text-sm" onClick={handleFreezeToggle}>
              <PanelTop className="h-4 w-4 mr-2" />
              {frozen ? t('unfreezeHeader', { defaultValue: '取消冻结首行' }) : t('freezeHeader', { defaultValue: '冻结首行' })}
              {frozen && <Check className="h-3.5 w-3.5 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-sm" onClick={handleAutoFit}>
              <Columns3 className="h-4 w-4 mr-2" />{t('autoFitColumns', { defaultValue: '自适应列宽' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* 保存状态指示器 */}
        {saveState === 'unsaved' && <span className="text-xs text-yellow-500">{t('unsaved', { defaultValue: '未保存' })}</span>}
        {saveState === 'saved' && <span className="text-xs text-green-500 flex items-center gap-0.5"><Check className="h-3 w-3" />{t('saved', { defaultValue: '已保存' })}</span>}
      </div>

      {/* ── FortuneSheet 主体区域 ── */}
      <div className="flex-1 min-h-0 relative">
        <FortuneSheetWrapper
          ref={sheetRef}
          initialData={initialData}
          onDataChange={handleDataChange}
          onSelectionChange={handleSelectionChange}
        />

        {/* 拖拽导入覆盖层 */}
        {draggingOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded pointer-events-none">
            <div className="bg-background/90 rounded-lg px-6 py-4 shadow-lg text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">{t('dropFileHere', { defaultValue: '松开以导入 Excel / CSV 文件' })}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 智能状态栏 ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 py-1.5 text-sm border-t bg-muted/20 text-muted-foreground min-h-[28px]" style={{ fontFamily: 'SimSun, "宋体", "Songti SC", serif' }}>
        {/* 状态消息（优先显示） */}
        {statusMsg ? (
          <span className={statusIsError ? 'text-destructive' : ''}>{statusMsg}</span>
        ) : (
          <>
            {/* Sheet 信息 */}
            {sheetInfo && <span>{sheetInfo}</span>}
          </>
        )}

        <div className="flex-1" />

        {/* 选区统计 */}
        {selectionStats && selectionStats.count > 1 && (
          <span className="tabular-nums">
            {t('count', { defaultValue: '计数' })}: {selectionStats.count}
            {selectionStats.numericCount > 0 && (
              <>
                {' · '}{t('formula_SUM', { defaultValue: '求和' })}: {selectionStats.sum.toLocaleString()}
                {' · '}{t('formula_AVG', { defaultValue: '均值' })}: {selectionStats.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </>
            )}
          </span>
        )}

      </div>

      {/* 隐藏的文件输入 */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} title={t('importFile', { defaultValue: '导入文件' })} />
    </div>
  );
}
