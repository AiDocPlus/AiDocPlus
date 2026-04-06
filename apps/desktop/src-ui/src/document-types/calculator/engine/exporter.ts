/**
 * exporter.ts — 计算结果导出模块
 * 支持 CSV、TXT、JSON 格式导出
 */
import type { CalculatorDocumentContent } from '../types';
import { formatExpressionOperatorsForDisplay } from '../calculatorInputNormalize';

function expressionForExport(expr: string, doc: CalculatorDocumentContent): string {
  const mode = doc.settings.operatorSymbols === 'cjk' ? 'cjk' : 'ascii';
  return formatExpressionOperatorsForDisplay(expr, mode);
}

/** CSV 表头文案（由 UI 传入 i18n 或沿用默认中文） */
export interface CalculatorCSVColumnLabels {
  lineNumber: string;
  expression: string;
  result: string;
  type: string;
  /** 备注行在「类型」列的显示 */
  noteKind: string;
}

const DEFAULT_CSV_LABELS_ZH: CalculatorCSVColumnLabels = {
  lineNumber: '行号',
  expression: '表达式',
  result: '结果',
  type: '类型',
  noteKind: '备注',
};

// ============================================================
// CSV 导出
// ============================================================

/**
 * 导出为 CSV 格式
 */
export function exportToCSV(
  doc: CalculatorDocumentContent,
  sheetId?: string,
  columnLabels: CalculatorCSVColumnLabels = DEFAULT_CSV_LABELS_ZH,
): string {
  const sheet = sheetId
    ? doc.sheets.find(s => s.id === sheetId)
    : doc.sheets.find(s => s.id === doc.activeSheetId);

  if (!sheet) return '';

  const rows: string[][] = [];

  rows.push([
    columnLabels.lineNumber,
    columnLabels.expression,
    columnLabels.result,
    columnLabels.type,
  ]);

  // 数据行
  for (const line of sheet.lines) {
    rows.push([
      String(line.lineNumber),
      escapeCSVField(expressionForExport(line.expression, doc)),
      line.isNote ? '' : (line.result.displayValue || ''),
      line.isNote ? columnLabels.noteKind : line.result.type,
    ]);
  }

  return '\uFEFF' + rows.map(row => row.join(',')).join('\n');
}

/**
 * 导出所有 Sheet 为 CSV
 */
export function exportAllSheetsToCSV(doc: CalculatorDocumentContent): string {
  const parts: string[] = [];

  for (const sheet of doc.sheets) {
    parts.push(`# ${sheet.name}`);
    parts.push(exportToCSV(doc, sheet.id));
    parts.push(''); // 空行分隔
  }

  return parts.join('\n');
}

// ============================================================
// TXT 导出
// ============================================================

/**
 * 导出为人类可读的 TXT 格式（类似 Soulver 风格）
 */
export function exportToTXT(doc: CalculatorDocumentContent, sheetId?: string): string {
  const sheet = sheetId
    ? doc.sheets.find(s => s.id === sheetId)
    : doc.sheets.find(s => s.id === doc.activeSheetId);

  if (!sheet) return '';

  const lines: string[] = [];

  for (const line of sheet.lines) {
    const ex = expressionForExport(line.expression, doc);
    if (line.isNote) {
      lines.push(ex);
    } else if (line.result.displayValue) {
      lines.push(`${ex} = ${line.result.displayValue}`);
    } else {
      lines.push(ex);
    }
  }

  return lines.join('\n');
}

/**
 * 导出所有 Sheet 为 TXT
 */
export function exportAllSheetsToTXT(doc: CalculatorDocumentContent): string {
  const parts: string[] = [];

  for (const sheet of doc.sheets) {
    parts.push(`═══════ ${sheet.name} ═══════`);
    parts.push(exportToTXT(doc, sheet.id));
    parts.push(''); // 空行分隔
  }

  return parts.join('\n');
}

// ============================================================
// JSON 导出
// ============================================================

/**
 * 导出为 JSON 格式（完整数据）
 */
export function exportToJSON(doc: CalculatorDocumentContent): string {
  return JSON.stringify(doc, null, 2);
}

// ============================================================
// Markdown 导出
// ============================================================

/** Markdown 表头列名（可由 UI 传入 i18n） */
export interface CalculatorMarkdownColumnLabels {
  lineNumber: string;
  expression: string;
  result: string;
}

const DEFAULT_MD_LABELS_ZH: CalculatorMarkdownColumnLabels = {
  lineNumber: '行号',
  expression: '表达式',
  result: '结果',
};

/**
 * 导出为 Markdown 格式
 */
export function exportToMarkdown(
  doc: CalculatorDocumentContent,
  sheetId?: string,
  columnLabels: CalculatorMarkdownColumnLabels = DEFAULT_MD_LABELS_ZH,
): string {
  const sheet = sheetId
    ? doc.sheets.find(s => s.id === sheetId)
    : doc.sheets.find(s => s.id === doc.activeSheetId);

  if (!sheet) return '';

  const lines: string[] = [];

  lines.push(`# ${sheet.name}`);
  lines.push('');
  lines.push(
    `| ${columnLabels.lineNumber} | ${columnLabels.expression} | ${columnLabels.result} |`,
  );
  lines.push('|------|---------|------|');

  for (const line of sheet.lines) {
    const ex = expressionForExport(line.expression, doc);
    if (line.isNote) {
      lines.push(`| ${line.lineNumber} | *${escapeMarkdown(ex)}* | |`);
    } else {
      lines.push(`| ${line.lineNumber} | \`${escapeMarkdown(ex)}\` | **${escapeMarkdown(line.result.displayValue || '-')}** |`);
    }
  }

  return lines.join('\n');
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 转义 CSV 字段
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/\r/g, '').replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * 转义 Markdown 特殊字符
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[|`*_~\[\]]/g, '\\$&');
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// HTML 导出
// ============================================================

/**
 * 导出为 HTML 格式（带内联样式，独立可用）
 */
export function exportToHTML(doc: CalculatorDocumentContent, sheetId?: string): string {
  const sheet = sheetId
    ? doc.sheets.find(s => s.id === sheetId)
    : doc.sheets.find(s => s.id === doc.activeSheetId);

  if (!sheet) return '';

  const lines: string[] = [];
  lines.push(`<!DOCTYPE html>`);
  lines.push(`<html lang="zh">`);
  lines.push(`<head><meta charset="UTF-8"><title>${escapeHtml(sheet.name)}</title>`);
  lines.push(`<style>body{font-family:"Songti SC","SimSun",serif;font-size:14px;max-width:800px;margin:2em auto;padding:0 1em}`);
  lines.push(`table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}`);
  lines.push(`th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}`);
  lines.push(`.note{color:#999;font-style:italic}.heading{font-weight:600;background:#f0f0f0}`);
  lines.push(`.subtotal{background:#fffbeb;font-weight:600}.error{color:#dc2626}`);
  lines.push(`.fn-def{color:#6366f1;font-style:italic}`);
  lines.push(`h1{font-size:1.3em;border-bottom:2px solid #ddd;padding-bottom:4px}</style></head>`);
  lines.push(`<body>`);
  lines.push(`<h1>${escapeHtml(sheet.name)}</h1>`);
  lines.push(`<table><thead><tr><th>#</th><th>Expression</th><th>Result</th></tr></thead><tbody>`);

  for (const line of sheet.lines) {
    const ex = expressionForExport(line.expression, doc);
    let rowClass = '';
    if (line.lineRole === 'heading') rowClass = 'heading';
    else if (line.lineRole === 'subtotal') rowClass = 'subtotal';
    else if (line.lineRole === 'comment') rowClass = 'note';
    else if (line.lineRole === 'function_def') rowClass = 'fn-def';
    else if (line.result.type === 'error') rowClass = 'error';

    const exprCell = line.isNote
      ? `<span class="${rowClass || 'note'}">${escapeHtml(ex)}</span>`
      : `<code>${escapeHtml(ex)}</code>`;

    const resultCell = line.isNote
      ? ''
      : line.result.type === 'error'
        ? `<span class="error">${escapeHtml(line.result.error || 'Error')}</span>`
        : escapeHtml(line.result.displayValue || '-');

    lines.push(`<tr class="${rowClass}"><td>${line.lineNumber}</td><td>${exprCell}</td><td>${resultCell}</td></tr>`);
  }

  lines.push(`</tbody></table></body></html>`);
  return lines.join('\n');
}

/**
 * 导出所有 Sheet 为 HTML
 */
export function exportAllSheetsToHTML(doc: CalculatorDocumentContent): string {
  const parts: string[] = [];
  for (const sheet of doc.sheets) {
    parts.push(exportToHTML(doc, sheet.id));
  }
  return parts.join('\n<hr/>\n');
}

/**
 * 下载导出文件
 */
export function downloadExport(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// 导出格式配置
// ============================================================

export interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  exporter: (doc: CalculatorDocumentContent, sheetId?: string) => string;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'csv',
    name: 'CSV',
    extension: 'csv',
    mimeType: 'text/csv',
    exporter: exportToCSV,
  },
  {
    id: 'txt',
    name: 'TXT (人类可读)',
    extension: 'txt',
    mimeType: 'text/plain',
    exporter: exportToTXT,
  },
  {
    id: 'json',
    name: 'JSON (完整数据)',
    extension: 'json',
    mimeType: 'application/json',
    exporter: (doc) => exportToJSON(doc),
  },
  {
    id: 'md',
    name: 'Markdown',
    extension: 'md',
    mimeType: 'text/markdown',
    exporter: exportToMarkdown,
  },
];
