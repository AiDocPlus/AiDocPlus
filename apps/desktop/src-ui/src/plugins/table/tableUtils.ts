import * as XLSX from 'xlsx';

/** 文件保存回调接口，由插件面板注入 */
export interface FileSaveAPI {
  showSaveDialog(opts: { defaultName: string; extensions: string[] }): Promise<string | null>;
  writeFile(path: string, data: number[]): Promise<void>;
}

let _fileSaveAPI: FileSaveAPI | null = null;

/** 由插件面板调用，注入文件保存能力 */
export function setFileSaveAPI(api: FileSaveAPI) {
  _fileSaveAPI = api;
}

export type CellValue = string | number;
export type TableData = CellValue[][];

/** 单个表格 */
export interface TableSheet {
  name: string;
  headers: string[];
  data: TableData;
}

// ── 表格数据操作 ──

export function createEmptyTable(rows: number, cols: number): TableData {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

export function createEmptySheet(name: string, rows = 5, cols = 4): TableSheet {
  return {
    name,
    headers: Array.from({ length: cols }, (_, i) => `列${i + 1}`),
    data: createEmptyTable(rows, cols),
  };
}

export function addRow(data: TableData): TableData {
  const cols = data.length > 0 ? data[0].length : 3;
  return [...data, Array.from({ length: cols }, () => '' as CellValue)];
}

export function insertRow(data: TableData, atIndex: number): TableData {
  const cols = data.length > 0 ? data[0].length : 3;
  const newRow = Array.from({ length: cols }, () => '' as CellValue);
  const result = [...data];
  result.splice(atIndex, 0, newRow);
  return result;
}

export function removeRow(data: TableData, rowIndex: number): TableData {
  if (data.length <= 1) return data;
  return data.filter((_, i) => i !== rowIndex);
}

export function addColumn(data: TableData): TableData {
  return data.map(row => [...row, '']);
}

export function insertColumn(data: TableData, atIndex: number): TableData {
  return data.map(row => {
    const newRow = [...row];
    newRow.splice(atIndex, 0, '');
    return newRow;
  });
}

export function removeColumn(data: TableData, colIndex: number): TableData {
  if (data.length > 0 && data[0].length <= 1) return data;
  return data.map(row => row.filter((_, i) => i !== colIndex));
}

export function updateCell(data: TableData, row: number, col: number, value: CellValue): TableData {
  const newData = data.map(r => [...r]);
  if (newData[row]) {
    newData[row][col] = value;
  }
  return newData;
}

export function sortByColumn(data: TableData, colIndex: number, direction: 'asc' | 'desc'): TableData {
  return [...data].sort((a, b) => {
    const va = a[colIndex] ?? '';
    const vb = b[colIndex] ?? '';
    const na = Number(va);
    const nb = Number(vb);
    if (!isNaN(na) && !isNaN(nb) && va !== '' && vb !== '') {
      return direction === 'asc' ? na - nb : nb - na;
    }
    const cmp = String(va).localeCompare(String(vb), 'zh-CN');
    return direction === 'asc' ? cmp : -cmp;
  });
}

// ── 列计算公式 ──

/** 从单元格值中提取数值，忽略非数值内容 */
function parseNumeric(val: CellValue): number | null {
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (s === '') return null;
  // 去除常见前后缀（如 ¥、$、%、元、万 等）后尝试解析
  const cleaned = s.replace(/^[¥$￥€£]+/, '').replace(/[%％元万亿个件台套份]+$/, '').trim();
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/** 提取某列的所有数值 */
function getColumnNumbers(data: TableData, colIndex: number): number[] {
  const nums: number[] = [];
  for (const row of data) {
    const v = row[colIndex];
    const n = parseNumeric(v);
    if (n !== null) nums.push(n);
  }
  return nums;
}

export interface ColumnStats {
  sum: number;
  avg: number;
  max: number;
  min: number;
  median: number;
  variance: number;
  stdev: number;
  count: number;       // 数值单元格数量
  distinct: number;    // 去重计数（含非数值）
  totalCount: number;  // 总行数
}

/** 计算指定列的统计值，如果没有数值则返回 null */
export function calcColumnStats(data: TableData, colIndex: number): ColumnStats | null {
  const nums = getColumnNumbers(data, colIndex);
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  const avg = sum / nums.length;
  // 中位数
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  // 方差 & 标准差
  const variance = nums.reduce((acc, n) => acc + (n - avg) ** 2, 0) / nums.length;
  const stdev = Math.sqrt(variance);
  // 去重计数（含非数值单元格）
  const uniqueVals = new Set(data.map(row => String(row[colIndex] ?? '').trim()).filter(v => v !== ''));
  return {
    sum,
    avg,
    max: Math.max(...nums),
    min: Math.min(...nums),
    median,
    variance,
    stdev,
    count: nums.length,
    distinct: uniqueVals.size,
    totalCount: data.length,
  };
}

export type FormulaType = 'SUM' | 'AVG' | 'MAX' | 'MIN' | 'COUNT' | 'MEDIAN' | 'VAR' | 'STDEV' | 'DISTINCT';

/** 对指定列应用单个公式 */
export function applyFormula(data: TableData, colIndex: number, formula: FormulaType): number | null {
  const stats = calcColumnStats(data, colIndex);
  if (!stats) return null;
  switch (formula) {
    case 'SUM': return stats.sum;
    case 'AVG': return stats.avg;
    case 'MAX': return stats.max;
    case 'MIN': return stats.min;
    case 'COUNT': return stats.count;
    case 'MEDIAN': return stats.median;
    case 'VAR': return stats.variance;
    case 'STDEV': return stats.stdev;
    case 'DISTINCT': return stats.distinct;
  }
}

/** 生成汇总行：对每列应用指定公式，非数值列填空 */
export function buildFormulaRow(data: TableData, headers: string[], formula: FormulaType): CellValue[] {
  const cols = headers.length || (data.length > 0 ? data[0].length : 0);
  const row: CellValue[] = [];
  for (let i = 0; i < cols; i++) {
    const result = applyFormula(data, i, formula);
    if (result !== null) {
      // AVG 保留两位小数，其余整数时不带小数
      row.push(formula === 'AVG' ? Number(result.toFixed(2)) : (Number.isInteger(result) ? result : Number(result.toFixed(2))));
    } else {
      // 第一列标注公式名称，其余留空
      row.push(i === 0 && result === null ? formula : '');
    }
  }
  return row;
}

// ── 单元格公式解析 ──

/**
 * 列字母转索引：A→0, B→1, ..., Z→25, AA→26
 */
function colLetterToIndex(letter: string): number {
  let idx = 0;
  for (let i = 0; i < letter.length; i++) {
    idx = idx * 26 + (letter.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * 解析单元格引用如 "A1" → { row: 0, col: 0 }
 * 行号从1开始（对应数据行，不含表头），列从A开始
 */
function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return { col: colLetterToIndex(m[1].toUpperCase()), row: parseInt(m[2], 10) - 1 };
}

/**
 * 获取单元格的原始值（数值）
 */
function getCellNumericValue(data: TableData, row: number, col: number): number {
  if (row < 0 || row >= data.length || col < 0 || col >= (data[0]?.length ?? 0)) return 0;
  const v = parseNumeric(data[row][col]);
  return v ?? 0;
}

/**
 * 展开范围引用如 "A1:A5" → 所有单元格的数值数组
 */
function expandRange(data: TableData, rangeStr: string): number[] {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return [];
  const start = parseCellRef(parts[0].trim());
  const end = parseCellRef(parts[1].trim());
  if (!start || !end) return [];
  const nums: number[] = [];
  const r1 = Math.min(start.row, end.row), r2 = Math.max(start.row, end.row);
  const c1 = Math.min(start.col, end.col), c2 = Math.max(start.col, end.col);
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      nums.push(getCellNumericValue(data, r, c));
    }
  }
  return nums;
}

/**
 * 解析公式参数：可以是范围 "A1:A5"、单元格 "B3"、或数字 "42"
 * 返回数值数组
 */
function parseFormulaArgs(data: TableData, argsStr: string): number[] {
  const nums: number[] = [];
  const parts = argsStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes(':')) {
      nums.push(...expandRange(data, trimmed));
    } else {
      const ref = parseCellRef(trimmed);
      if (ref) {
        nums.push(getCellNumericValue(data, ref.row, ref.col));
      } else {
        const n = Number(trimmed);
        if (!isNaN(n)) nums.push(n);
      }
    }
  }
  return nums;
}

/**
 * 计算单元格公式。支持：
 * =SUM(A1:A5)  =AVG(A1:B3)  =MAX(A1:A10)  =MIN(A1:A10)
 * =COUNT(A1:A10)  =MEDIAN(A1:A10)
 * =A1+B1  =A1*2  等简单四则运算（含单元格引用）
 *
 * 返回计算结果字符串，如果不是公式则返回 null
 */
export function evaluateCellFormula(value: CellValue, data: TableData): string | null {
  const s = String(value).trim();
  if (!s.startsWith('=')) return null;
  const expr = s.substring(1).trim();

  // 函数公式：=FUNC(args)
  const funcMatch = expr.match(/^(SUM|AVG|AVERAGE|MAX|MIN|COUNT|MEDIAN|STDEV|VAR)\((.+)\)$/i);
  if (funcMatch) {
    const func = funcMatch[1].toUpperCase();
    const nums = parseFormulaArgs(data, funcMatch[2]);
    if (nums.length === 0) return '0';
    switch (func) {
      case 'SUM': return formatResult(nums.reduce((a, b) => a + b, 0));
      case 'AVG':
      case 'AVERAGE': return formatResult(nums.reduce((a, b) => a + b, 0) / nums.length);
      case 'MAX': return formatResult(Math.max(...nums));
      case 'MIN': return formatResult(Math.min(...nums));
      case 'COUNT': return String(nums.length);
      case 'MEDIAN': {
        const sorted = [...nums].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return formatResult(sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]);
      }
      case 'STDEV': {
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        return formatResult(Math.sqrt(nums.reduce((acc, n) => acc + (n - avg) ** 2, 0) / nums.length));
      }
      case 'VAR': {
        const avg2 = nums.reduce((a, b) => a + b, 0) / nums.length;
        return formatResult(nums.reduce((acc, n) => acc + (n - avg2) ** 2, 0) / nums.length);
      }
      default: return '#ERR';
    }
  }

  // 简单四则运算：替换单元格引用为数值后 eval
  try {
    const replaced = expr.replace(/[A-Z]+\d+/gi, (match) => {
      const ref = parseCellRef(match);
      if (!ref) return '0';
      return String(getCellNumericValue(data, ref.row, ref.col));
    });
    // 安全检查：只允许数字、运算符、括号、空格、小数点
    if (!/^[\d\s+\-*/().]+$/.test(replaced)) return '#ERR';
    // eslint-disable-next-line no-eval
    const result = Function(`"use strict"; return (${replaced})`)();
    return formatResult(Number(result));
  } catch {
    return '#ERR';
  }
}

function formatResult(n: number): string {
  if (isNaN(n) || !isFinite(n)) return '#ERR';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// ── Markdown 转换 ──

/** 单个表格转 Markdown */
function sheetToMarkdown(sheet: TableSheet): string {
  const lines: string[] = [];
  if (sheet.name) lines.push(`### ${sheet.name}\n`);
  if (sheet.headers.length > 0) {
    lines.push('| ' + sheet.headers.join(' | ') + ' |');
    lines.push('| ' + sheet.headers.map(() => '---').join(' | ') + ' |');
  }
  for (const row of sheet.data) {
    lines.push('| ' + row.map(c => String(c).replace(/\|/g, '\\|')).join(' | ') + ' |');
  }
  return lines.join('\n');
}

/** 多表格转 Markdown（一个文件，多个分开的表格） */
export function sheetsToMarkdown(sheets: TableSheet[]): string {
  return sheets.map(s => sheetToMarkdown(s)).join('\n\n---\n\n');
}

/** 兼容旧接口：单表格 */
export function toMarkdown(data: TableData, headers: string[] = []): string {
  return sheetToMarkdown({ name: '', headers, data });
}

// ── 文件写入 ──

async function saveFileViaTauri(data: number[], defaultFileName: string, _filterName: string, extensions: string[]): Promise<string | null> {
  if (!_fileSaveAPI) throw new Error('FileSaveAPI not initialized');
  const filePath = await _fileSaveAPI.showSaveDialog({ defaultName: defaultFileName, extensions });
  if (!filePath) return null;
  await _fileSaveAPI.writeFile(filePath, data);
  return filePath;
}

// ── 导出：Excel（多 Sheet） ──

export async function exportSheetsToXlsx(sheets: TableSheet[], fileName: string = '表格.xlsx'): Promise<string | null> {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa: (string | number)[][] = [];
    if (sheet.headers.length > 0) aoa.push(sheet.headers);
    aoa.push(...sheet.data);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Sheet 名称最长 31 字符，不能含特殊字符
    const safeName = sheet.name.replace(/[:\\/?*[\]]/g, '_').substring(0, 31) || 'Sheet';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return saveFileViaTauri(Array.from(new Uint8Array(buf)), fileName, 'Excel 文件', ['xlsx']);
}

/** 兼容旧接口 */
export async function exportToXlsx(data: TableData, headers: string[] = [], hasHeader: boolean = true, fileName: string = '表格.xlsx'): Promise<string | null> {
  return exportSheetsToXlsx([{ name: 'Sheet1', headers: hasHeader ? headers : [], data }], fileName);
}

// ── 导出：CSV（多表格合并，用空行分隔） ──

export async function exportSheetsToCsv(sheets: TableSheet[], fileName: string = '表格.csv'): Promise<string | null> {
  const sections: string[] = [];
  for (const sheet of sheets) {
    const lines: string[] = [];
    if (sheets.length > 1) lines.push(csvEscape(`# ${sheet.name}`));
    if (sheet.headers.length > 0) {
      lines.push(sheet.headers.map(h => csvEscape(String(h))).join(','));
    }
    for (const row of sheet.data) {
      lines.push(row.map(cell => csvEscape(String(cell))).join(','));
    }
    sections.push(lines.join('\n'));
  }
  const bom = '\uFEFF';
  const csvStr = bom + sections.join('\n\n');
  const bytes = Array.from(new TextEncoder().encode(csvStr));
  return saveFileViaTauri(bytes, fileName, 'CSV 文件', ['csv']);
}

export async function exportToCsv(data: TableData, headers: string[] = [], hasHeader: boolean = true, fileName: string = '表格.csv'): Promise<string | null> {
  return exportSheetsToCsv([{ name: '', headers: hasHeader ? headers : [], data }], fileName);
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── 导出：JSON（多表格数组） ──

export async function exportSheetsToJson(sheets: TableSheet[], fileName: string = '表格.json'): Promise<string | null> {
  const jsonData = sheets.map(sheet => {
    const rows = sheet.headers.length > 0
      ? sheet.data.map(row => {
          const obj: Record<string, CellValue> = {};
          sheet.headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        })
      : sheet.data;
    return { name: sheet.name, data: rows };
  });
  // 单表格时直接输出数据，多表格输出数组
  const output = jsonData.length === 1 ? jsonData[0].data : jsonData;
  const jsonStr = JSON.stringify(output, null, 2);
  const bytes = Array.from(new TextEncoder().encode(jsonStr));
  return saveFileViaTauri(bytes, fileName, 'JSON 文件', ['json']);
}

export async function exportToJson(data: TableData, headers: string[] = [], fileName: string = '表格.json'): Promise<string | null> {
  return exportSheetsToJson([{ name: '', headers, data }], fileName);
}

// ── 导出：Markdown ──

export async function exportSheetsToMarkdown(sheets: TableSheet[], fileName: string = '表格.md'): Promise<string | null> {
  const md = sheetsToMarkdown(sheets);
  const bytes = Array.from(new TextEncoder().encode(md));
  return saveFileViaTauri(bytes, fileName, 'Markdown 文件', ['md']);
}

// ── 导入 ──

export function parseXlsxFile(buffer: ArrayBuffer): TableSheet[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheets: TableSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    const aoa: (string | number | boolean | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (aoa.length === 0) continue;
    const maxCols = Math.max(...aoa.map(r => r.length));

    const normalize = (row: (string | number | boolean | undefined)[]): CellValue[] => {
      const padded: CellValue[] = [];
      for (let i = 0; i < maxCols; i++) {
        const v = row[i];
        padded.push(v == null ? '' : typeof v === 'boolean' ? String(v) : v as CellValue);
      }
      return padded;
    };

    const headers = aoa[0].map(v => v == null ? '' : String(v));
    while (headers.length < maxCols) headers.push('');
    const data = aoa.slice(1).map(normalize);

    sheets.push({
      name: sheetName,
      headers,
      data: data.length > 0 ? data : createEmptyTable(3, maxCols),
    });
  }

  return sheets.length > 0 ? sheets : [createEmptySheet('Sheet1')];
}

export function parseCsvText(csvText: string): TableSheet[] {
  const text = csvText.replace(/^\uFEFF/, '');
  const workbook = XLSX.read(text, { type: 'string' });
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  if (!ws) return [createEmptySheet('Sheet1')];
  const aoa: (string | number | boolean | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (aoa.length === 0) return [createEmptySheet('Sheet1')];
  const maxCols = Math.max(...aoa.map(r => r.length));

  const headers = aoa[0].map(v => v == null ? '' : String(v));
  while (headers.length < maxCols) headers.push('');
  const data: TableData = aoa.slice(1).map(row => {
    const padded: CellValue[] = [];
    for (let i = 0; i < maxCols; i++) {
      const v = row[i];
      padded.push(v == null ? '' : typeof v === 'boolean' ? String(v) : v as CellValue);
    }
    return padded;
  });

  return [{ name: 'Sheet1', headers, data: data.length > 0 ? data : createEmptyTable(3, maxCols) }];
}
