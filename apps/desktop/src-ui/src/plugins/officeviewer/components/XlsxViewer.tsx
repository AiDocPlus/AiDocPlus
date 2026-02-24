import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { usePluginHost } from '../../_framework/PluginHostAPI';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from '../../_framework/ui';
import {
  Table, Loader2, AlertCircle, Download, Printer,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';

// 保留 worksheet 引用，不预加载所有数据
interface SheetData {
  name: string;
  worksheet: XLSX.WorkSheet;
  totalRows: number;
  maxCols: number;
}

interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

interface XlsxViewerProps {
  filePath: string;
  fileName: string;
  onError: (error: string) => void;
}

// 从 worksheet 按范围读取数据
function getRowsInRange(
  worksheet: XLSX.WorkSheet,
  startRow: number,
  endRow: number,
  maxCols: number
): unknown[][] {
  const rows: unknown[][] = [];
  for (let r = startRow; r <= endRow; r++) {
    const row: unknown[] = [];
    for (let c = 0; c < maxCols; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[cellAddress];
      row.push(cell?.v ?? '');
    }
    rows.push(row);
  }
  return rows;
}

// 获取工作表的范围信息
function getSheetRange(worksheet: XLSX.WorkSheet): { totalRows: number; maxCols: number } {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  return {
    totalRows: range.e.r - range.s.r + 1,
    maxCols: range.e.c - range.s.c + 1,
  };
}

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

export function XlsxViewer({ filePath, fileName, onError }: XlsxViewerProps) {
  const host = usePluginHost();
  const tableRef = useRef<HTMLTableElement>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  useEffect(() => {
    let cancelled = false;

    const loadExcel = async () => {
      setLoading(true);
      setError(null);
      setPagination({ pageIndex: 0, pageSize: 100 });

      try {
        // 读取文件
        const dataUrl = await host.platform.invoke<string>('read_file_base64', { path: filePath });
        const response = await fetch(dataUrl);
        const arrayBuffer = await response.arrayBuffer();

        if (cancelled) return;

        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetList: SheetData[] = workbook.SheetNames.map(name => {
          const worksheet = workbook.Sheets[name];
          const { totalRows, maxCols } = getSheetRange(worksheet);
          return { name, worksheet, totalRows, maxCols };
        });

        if (cancelled) return;

        setSheets(sheetList);
        if (sheetList.length > 0) {
          setActiveSheet(sheetList[0].name);
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        onError(`Excel 解析失败: ${errorMsg}`);
        setLoading(false);
      }
    };

    loadExcel();

    return () => {
      cancelled = true;
    };
  }, [filePath, host.platform, onError]);

  // 当前工作表
  const currentSheet = sheets.find(s => s.name === activeSheet);

  // 计算总页数
  const totalPages = useMemo(() => {
    if (!currentSheet) return 0;
    return Math.ceil(currentSheet.totalRows / pagination.pageSize);
  }, [currentSheet, pagination.pageSize]);

  // 当前页数据（按需读取）
  const currentPageData = useMemo(() => {
    if (!currentSheet) return [];
    const startRow = pagination.pageIndex * pagination.pageSize;
    const endRow = Math.min(startRow + pagination.pageSize - 1, currentSheet.totalRows - 1);
    return getRowsInRange(currentSheet.worksheet, startRow, endRow, currentSheet.maxCols);
  }, [currentSheet, pagination]);

  // 切换工作表时重置分页
  const handleSheetChange = useCallback((sheetName: string) => {
    setActiveSheet(sheetName);
    setPagination(p => ({ ...p, pageIndex: 0 }));
  }, []);

  // 分页控制
  const handleFirstPage = () => setPagination(p => ({ ...p, pageIndex: 0 }));
  const handlePrevPage = () => setPagination(p => ({ ...p, pageIndex: Math.max(0, p.pageIndex - 1) }));
  const handleNextPage = () => setPagination(p => ({ ...p, pageIndex: Math.min(totalPages - 1, p.pageIndex + 1) }));
  const handleLastPage = () => setPagination(p => ({ ...p, pageIndex: totalPages - 1 }));
  const handlePageSizeChange = (value: string) => {
    setPagination({ pageIndex: 0, pageSize: Number(value) });
  };

  // 计算当前显示的行范围
  const rowRange = useMemo(() => {
    if (!currentSheet) return { start: 0, end: 0 };
    const start = pagination.pageIndex * pagination.pageSize + 1;
    const end = Math.min(start + pagination.pageSize - 1, currentSheet.totalRows);
    return { start, end };
  }, [currentSheet, pagination]);

  // 打印当前页
  const handlePrint = () => {
    if (!tableRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onError('无法打开打印窗口，请检查弹窗阻止设置');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>打印 - ${fileName} - ${activeSheet}</title>
          <style>
            body { margin: 20px; font-family: Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #ccc; padding: 4px 8px; font-size: 12px; }
            th { background: #f5f5f5; font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h3 style="margin-bottom: 10px;">${fileName} - ${activeSheet} (第 ${rowRange.start}-${rowRange.end} 行)</h3>
          ${tableRef.current.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // 下载原文件
  const handleDownload = async () => {
    try {
      const dataUrl = await host.platform.invoke<string>('read_file_base64', { path: filePath });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      onError(`下载失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 导出当前工作表为 CSV（全部数据）
  const handleExportCsv = useCallback(async () => {
    if (!currentSheet) return;

    try {
      // 分批读取所有数据
      const allData: unknown[][] = [];
      const batchSize = 1000;
      for (let i = 0; i < currentSheet.totalRows; i += batchSize) {
        const endRow = Math.min(i + batchSize - 1, currentSheet.totalRows - 1);
        const batch = getRowsInRange(currentSheet.worksheet, i, endRow, currentSheet.maxCols);
        allData.push(...batch);
      }

      const csvContent = allData
        .map(row => {
          return row
            .map(cell => {
              const cellStr = cell?.toString() ?? '';
              if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return cellStr;
            })
            .join(',');
        })
        .join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName.replace(/\.[^.]+$/, '')}_${activeSheet}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      onError(`导出失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [currentSheet, fileName, activeSheet, onError]);

  // 错误状态
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md p-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <p className="text-destructive font-medium">Excel 加载失败</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // 加载中状态
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">加载 Excel 中...</p>
        </div>
      </div>
    );
  }

  // 无工作表
  if (sheets.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">工作表为空</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex-wrap">
        {/* 工作表选择器 */}
        <Table className="h-4 w-4 text-muted-foreground" />
        <Select value={activeSheet} onValueChange={handleSheetChange}>
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sheets.map(sheet => (
              <SelectItem key={sheet.name} value={sheet.name}>
                {sheet.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-px h-4 bg-border mx-1" />

        {/* 分页控制 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleFirstPage}
          disabled={pagination.pageIndex === 0}
          title="首页"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handlePrevPage}
          disabled={pagination.pageIndex === 0}
          title="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs min-w-[60px] text-center">
          {pagination.pageIndex + 1} / {totalPages || 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleNextPage}
          disabled={pagination.pageIndex >= totalPages - 1}
          title="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleLastPage}
          disabled={pagination.pageIndex >= totalPages - 1}
          title="末页"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>

        {/* 每页行数选择 */}
        <Select value={String(pagination.pageSize)} onValueChange={handlePageSizeChange}>
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(size => (
              <SelectItem key={size} value={String(size)}>
                {size} 行
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-px h-4 bg-border mx-1" />

        {/* 打印和下载 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handlePrint}
          title="打印当前页"
        >
          <Printer className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleExportCsv}
          title="导出全部为 CSV"
        >
          <Table className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleDownload}
          title="下载原文件"
        >
          <Download className="h-4 w-4" />
        </Button>

        <div className="flex-1" />
        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{fileName}</span>
      </div>

      {/* 表格内容 */}
      <div className="flex-1 overflow-auto p-2">
        {currentSheet && currentPageData.length > 0 ? (
          <table ref={tableRef} className="w-full border-collapse text-sm">
            <tbody>
              {currentPageData.map((row, rowIdx) => {
                if (!row || row.length === 0) return null;
                // 第一行（全局）或每页第一行高亮
                const isFirstRow = pagination.pageIndex === 0 && rowIdx === 0;
                return (
                  <tr key={rowIdx} className={isFirstRow ? 'bg-muted/50 font-medium' : ''}>
                    {Array.from({ length: currentSheet.maxCols }).map((_, cellIdx) => {
                      const cell = row[cellIdx];
                      return (
                        <td
                          key={cellIdx}
                          className="border border-border px-2 py-1 text-xs whitespace-nowrap"
                        >
                          {cell?.toString() ?? ''}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            工作表为空
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <div className="px-3 py-1 border-t bg-muted/20 flex-shrink-0 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          显示第 {rowRange.start}-{rowRange.end} 行，共 {currentSheet?.totalRows || 0} 行
        </span>
        <span className="text-xs text-muted-foreground">
          {currentSheet?.maxCols || 0} 列
        </span>
      </div>
    </div>
  );
}
