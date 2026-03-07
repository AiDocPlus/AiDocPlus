/**
 * 直接执行引擎
 *
 * 处理 executionMode === 'direct' 的快捷操作，
 * 绕过 AI 直接调用 FortuneSheet API 操作表格数据。
 *
 * 所有操作都返回 { ok, message } 结果，
 * 调用方负责在执行前创建撤销快照。
 */

import type { Sheet, Cell } from '@fortune-sheet/core';
import type { FortuneSheetRef } from './FortuneSheetWrapper';

// ── 类型 ──

export interface DirectActionResult {
  ok: boolean;
  message: string;
}

type ActionHandler = (
  inst: FortuneSheetRef,
  opts?: Record<string, unknown>,
) => DirectActionResult;

// ── 辅助函数 ──

/** 获取当前活动 Sheet 的头行和数据行 */
function getActiveSheetData(inst: FortuneSheetRef): {
  sheet: Sheet;
  headers: string[];
  dataRows: (string | number | null)[][];
  headerRowIdx: number;
} | null {
  const sheets = inst.getAllSheets();
  const active = sheets.find(s => (s as any).status === 1) || sheets[0];
  if (!active?.celldata?.length && !active?.data?.length) return null;

  // 从 data 矩阵提取
  const data = active.data;
  if (!data || data.length === 0) return null;

  const headerRow = data[0];
  const headers = headerRow.map((cell: Cell | null) => {
    if (!cell) return '';
    if (typeof cell === 'object' && cell.v !== undefined) return String(cell.v);
    return String(cell);
  });

  const dataRows: (string | number | null)[][] = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowData = row.map((cell: Cell | null) => {
      if (!cell) return null;
      if (typeof cell === 'object' && cell.v !== undefined) return cell.v as string | number | null;
      return cell as unknown as string | number | null;
    });
    // 跳过全空行
    if (rowData.every(v => v === null || v === '')) continue;
    dataRows.push(rowData);
  }

  return { sheet: active, headers, dataRows, headerRowIdx: 0 };
}

/** 获取列索引（按名称或字母） */
function resolveColumnIndex(headers: string[], colHint?: string): number {
  if (!colHint) return -1;
  // 先尝试按名称匹配
  const idx = headers.findIndex(h => h === colHint);
  if (idx >= 0) return idx;
  // 尝试按字母 (A, B, C...)
  if (/^[A-Z]{1,2}$/i.test(colHint)) {
    const upper = colHint.toUpperCase();
    let col = 0;
    for (let i = 0; i < upper.length; i++) {
      col = col * 26 + (upper.charCodeAt(i) - 64);
    }
    return col - 1; // 0-indexed
  }
  return -1;
}

/** 获取单元格原始值（用于排序比较） */
function getCellRawValue(inst: FortuneSheetRef, row: number, col: number): string | number | null {
  const v = inst.getCellValue(row, col);
  if (v === null || v === undefined || v === '') return null;
  const num = Number(v);
  if (!isNaN(num)) return num;
  return String(v);
}

// ── 操作注册表 ──

const ACTION_HANDLERS: Record<string, ActionHandler> = {

  // ━━━ 排序 ━━━

  sort_asc: (inst, opts) => sortColumn(inst, 'asc', opts?.column as string | undefined),
  sort_desc: (inst, opts) => sortColumn(inst, 'desc', opts?.column as string | undefined),

  // ━━━ 去重 ━━━

  dedup_rows: (inst) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    const { dataRows } = info;
    const seen = new Set<string>();
    const duplicateRowIndices: number[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const key = JSON.stringify(dataRows[i]);
      if (seen.has(key)) {
        duplicateRowIndices.push(i + 1); // +1 因为跳过了表头行
      } else {
        seen.add(key);
      }
    }

    if (duplicateRowIndices.length === 0) {
      return { ok: true, message: '未发现重复行' };
    }

    // 从后往前删除，避免索引错位
    for (let i = duplicateRowIndices.length - 1; i >= 0; i--) {
      const rowIdx = duplicateRowIndices[i];
      inst.deleteRowOrColumn('row', rowIdx, rowIdx);
    }

    return { ok: true, message: `已删除 ${duplicateRowIndices.length} 行重复数据` };
  },

  // ━━━ 清除空行 ━━━

  remove_empty_rows: (inst) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    const sheets = inst.getAllSheets();
    const active = sheets.find(s => (s as any).status === 1) || sheets[0];
    const data = active.data;
    if (!data) return { ok: false, message: '当前表格无数据' };

    const emptyRows: number[] = [];
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const isEmpty = row.every((cell: Cell | null) => {
        if (!cell) return true;
        if (typeof cell === 'object' && (cell.v === null || cell.v === undefined || cell.v === '')) return true;
        return false;
      });
      if (isEmpty) emptyRows.push(r);
    }

    if (emptyRows.length === 0) return { ok: true, message: '未发现空行' };

    for (let i = emptyRows.length - 1; i >= 0; i--) {
      inst.deleteRowOrColumn('row', emptyRows[i], emptyRows[i]);
    }

    return { ok: true, message: `已删除 ${emptyRows.length} 个空行` };
  },

  // ━━━ 修剪空白 ━━━

  trim_whitespace: (inst) => {
    const sheets = inst.getAllSheets();
    const active = sheets.find(s => (s as any).status === 1) || sheets[0];
    const data = active.data;
    if (!data) return { ok: false, message: '当前表格无数据' };

    let count = 0;
    for (let r = 0; r < data.length; r++) {
      for (let c = 0; c < data[r].length; c++) {
        const cell = data[r][c];
        if (cell && typeof cell === 'object' && typeof cell.v === 'string') {
          const trimmed = cell.v.trim();
          if (trimmed !== cell.v) {
            inst.setCellValue(r, c, trimmed);
            count++;
          }
        }
      }
    }

    return { ok: true, message: count > 0 ? `已修剪 ${count} 个单元格的首尾空白` : '未发现需要修剪的空白' };
  },

  // ━━━ 统一大小写 ━━━

  unify_case_upper: (inst) => unifyCaseAction(inst, 'upper'),
  unify_case_lower: (inst) => unifyCaseAction(inst, 'lower'),

  // ━━━ 转置 ━━━

  transpose: (inst) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    const sheets = inst.getAllSheets();
    const active = sheets.find(s => (s as any).status === 1) || sheets[0];
    const data = active.data;
    if (!data || data.length === 0) return { ok: false, message: '当前表格无数据' };

    const rows = data.length;
    const cols = Math.max(...data.map(r => r.length));

    // 构建转置数据
    const transposed: (Cell | null)[][] = [];
    for (let c = 0; c < cols; c++) {
      const newRow: (Cell | null)[] = [];
      for (let r = 0; r < rows; r++) {
        newRow.push(data[r]?.[c] || null);
      }
      transposed.push(newRow);
    }

    // 用 replace_sheet 方式重建
    const newSheet: Sheet = {
      ...active,
      data: transposed,
      celldata: [],
      row: transposed.length,
      column: transposed[0]?.length || 0,
    };

    const otherSheets = sheets.filter(s => s !== active);
    inst.updateSheets([...otherSheets, newSheet]);

    return { ok: true, message: `已转置：${rows}行×${cols}列 → ${cols}行×${rows}列` };
  },

  // ━━━ 序号填充 ━━━

  fill_sequence: (inst) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    const { dataRows } = info;
    // 在第一列前插入序号列
    inst.insertRowOrColumn('column', 0, 1, 'lefttop');
    inst.setCellValue(0, 0, '序号');
    for (let i = 0; i < dataRows.length; i++) {
      inst.setCellValue(i + 1, 0, i + 1);
    }

    return { ok: true, message: `已生成 ${dataRows.length} 个序号` };
  },

  // ━━━ 提取唯一值 ━━━

  extract_unique: (inst, opts) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    const colIdx = resolveColumnIndex(info.headers, opts?.column as string);
    // 如果没指定列，使用第一列
    const targetCol = colIdx >= 0 ? colIdx : 0;
    const colName = info.headers[targetCol] || `列${targetCol + 1}`;

    const values = new Set<string>();
    for (const row of info.dataRows) {
      const v = row[targetCol];
      if (v !== null && v !== '') values.add(String(v));
    }

    return {
      ok: true,
      message: `列「${colName}」有 ${values.size} 个唯一值：${[...values].slice(0, 20).join('、')}${values.size > 20 ? '...' : ''}`,
    };
  },

  // ━━━ 数字格式化 ━━━

  format_number: (inst) => applyNumberFormat(inst, '#,##0.00'),
  format_currency: (inst) => applyNumberFormat(inst, '¥#,##0.00'),
  format_percent: (inst) => applyNumberFormat(inst, '0.00%'),
  format_date: (inst) => applyNumberFormat(inst, 'yyyy-mm-dd'),

  // ━━━ 校验 ━━━

  check_unique: (inst, opts) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    const colIdx = resolveColumnIndex(info.headers, opts?.column as string);
    const targetCol = colIdx >= 0 ? colIdx : 0;
    const colName = info.headers[targetCol] || `列${targetCol + 1}`;

    const counts = new Map<string, number>();
    for (const row of info.dataRows) {
      const v = String(row[targetCol] ?? '');
      counts.set(v, (counts.get(v) || 0) + 1);
    }

    const dups = [...counts.entries()].filter(([, c]) => c > 1);
    if (dups.length === 0) {
      return { ok: true, message: `列「${colName}」所有值均唯一，无重复` };
    }

    const dupList = dups.slice(0, 10).map(([v, c]) => `「${v}」×${c}`).join('、');
    return {
      ok: true,
      message: `列「${colName}」发现 ${dups.length} 个重复值：${dupList}${dups.length > 10 ? '...' : ''}`,
    };
  },

  check_required: (inst) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    const missing: { col: string; count: number }[] = [];
    for (let c = 0; c < info.headers.length; c++) {
      let emptyCount = 0;
      for (const row of info.dataRows) {
        if (row[c] === null || row[c] === '' || row[c] === undefined) emptyCount++;
      }
      if (emptyCount > 0) {
        missing.push({ col: info.headers[c] || `列${c + 1}`, count: emptyCount });
      }
    }

    if (missing.length === 0) {
      return { ok: true, message: '所有字段均无缺失值' };
    }

    const detail = missing.map(m => `「${m.col}」缺 ${m.count} 个`).join('、');
    return { ok: true, message: `发现缺失值：${detail}` };
  },

  check_email_format: (inst) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    // 查找邮箱列
    const emailColIdx = info.headers.findIndex(h =>
      /邮箱|email|mail/i.test(h)
    );
    if (emailColIdx < 0) {
      return { ok: false, message: '未找到邮箱列（请将列名包含"邮箱"或"email"）' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidRows: number[] = [];
    for (let i = 0; i < info.dataRows.length; i++) {
      const v = String(info.dataRows[i][emailColIdx] ?? '');
      if (v && !emailRegex.test(v)) {
        invalidRows.push(i + 2); // +2 = 1-based + header row
      }
    }

    if (invalidRows.length === 0) {
      return { ok: true, message: '所有邮箱格式校验通过' };
    }

    return {
      ok: true,
      message: `发现 ${invalidRows.length} 个格式错误的邮箱（行：${invalidRows.slice(0, 10).join(', ')}${invalidRows.length > 10 ? '...' : ''}）`,
    };
  },

  // ━━━ 导出 ━━━

  copy_as_csv: (inst) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    const lines = [info.headers.join(',')];
    for (const row of info.dataRows) {
      lines.push(row.map(v => {
        if (v === null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','));
    }

    const csv = lines.join('\n');
    navigator.clipboard.writeText(csv).catch(() => {});
    return { ok: true, message: `已复制 CSV 到剪贴板（${info.dataRows.length} 行）` };
  },

  copy_as_markdown: (inst) => {
    const info = getActiveSheetData(inst);
    if (!info) return { ok: false, message: '当前表格无数据' };

    const headerLine = '| ' + info.headers.join(' | ') + ' |';
    const sepLine = '| ' + info.headers.map(() => '---').join(' | ') + ' |';
    const dataLines = info.dataRows.map(row =>
      '| ' + row.map(v => v === null ? '' : String(v)).join(' | ') + ' |'
    );

    const md = [headerLine, sepLine, ...dataLines].join('\n');
    navigator.clipboard.writeText(md).catch(() => {});
    return { ok: true, message: `已复制 Markdown 表格到剪贴板（${info.dataRows.length} 行）` };
  },
};

// ── 排序实现 ──

function sortColumn(inst: FortuneSheetRef, order: 'asc' | 'desc', colHint?: string): DirectActionResult {
  const info = getActiveSheetData(inst);
  if (!info) return { ok: false, message: '当前表格无数据' };

  // 确定排序列：优先用指定列，否则用选区列，最后用第一列
  let colIdx = resolveColumnIndex(info.headers, colHint);
  if (colIdx < 0) {
    const sel = inst.getSelection();
    if (sel?.[0]) colIdx = sel[0].column[0];
    else colIdx = 0;
  }

  const colName = info.headers[colIdx] || `列${colIdx + 1}`;
  const totalDataRows = info.dataRows.length;

  // 建立 rowIndex -> sortValue 映射
  const rowValues: { origRow: number; value: string | number | null }[] = [];
  for (let r = 0; r < totalDataRows; r++) {
    rowValues.push({ origRow: r + 1, value: getCellRawValue(inst, r + 1, colIdx) });
  }

  // 排序
  rowValues.sort((a, b) => {
    if (a.value === null && b.value === null) return 0;
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    if (typeof a.value === 'number' && typeof b.value === 'number') {
      return order === 'asc' ? a.value - b.value : b.value - a.value;
    }
    const cmp = String(a.value).localeCompare(String(b.value), 'zh-CN');
    return order === 'asc' ? cmp : -cmp;
  });

  // 检查是否已经是排好序的
  const alreadySorted = rowValues.every((v, i) => v.origRow === i + 1);
  if (alreadySorted) {
    return { ok: true, message: `列「${colName}」已是${order === 'asc' ? '升序' : '降序'}排列` };
  }

  // 收集所有行数据，然后按新顺序写回
  const sheets = inst.getAllSheets();
  const active = sheets.find(s => (s as any).status === 1) || sheets[0];
  const data = active.data;
  if (!data) return { ok: false, message: '无法读取数据' };

  const headerRow = data[0];
  const sortedDataRows = rowValues.map(rv => data[rv.origRow]);
  const newData = [headerRow, ...sortedDataRows];

  // 重建 sheet
  const newSheet: Sheet = {
    ...active,
    data: newData,
    celldata: [],
  };
  const otherSheets = sheets.filter(s => s !== active);
  inst.updateSheets([...otherSheets, newSheet]);

  return { ok: true, message: `已按列「${colName}」${order === 'asc' ? '升序' : '降序'}排列（${totalDataRows} 行）` };
}

// ── 大小写统一 ──

function unifyCaseAction(inst: FortuneSheetRef, mode: 'upper' | 'lower'): DirectActionResult {
  const sheets = inst.getAllSheets();
  const active = sheets.find(s => (s as any).status === 1) || sheets[0];
  const data = active.data;
  if (!data) return { ok: false, message: '当前表格无数据' };

  let count = 0;
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const cell = data[r][c];
      if (cell && typeof cell === 'object' && typeof cell.v === 'string') {
        const converted = mode === 'upper' ? cell.v.toUpperCase() : cell.v.toLowerCase();
        if (converted !== cell.v) {
          inst.setCellValue(r, c, converted);
          count++;
        }
      }
    }
  }

  const label = mode === 'upper' ? '大写' : '小写';
  return { ok: true, message: count > 0 ? `已将 ${count} 个单元格转为${label}` : `未发现需要转换的文本` };
}

// ── 数字格式化 ──

function applyNumberFormat(inst: FortuneSheetRef, format: string): DirectActionResult {
  const sheets = inst.getAllSheets();
  const active = sheets.find(s => (s as any).status === 1) || sheets[0];
  const data = active.data;
  if (!data) return { ok: false, message: '当前表格无数据' };

  // 找到所有数字列
  let count = 0;
  for (let c = 0; c < (data[0]?.length || 0); c++) {
    let isNumCol = false;
    for (let r = 1; r < Math.min(data.length, 10); r++) {
      const cell = data[r]?.[c];
      if (cell && typeof cell === 'object' && typeof cell.v === 'number') {
        isNumCol = true;
        break;
      }
    }

    if (isNumCol) {
      for (let r = 1; r < data.length; r++) {
        const cell = data[r]?.[c];
        if (cell && typeof cell === 'object' && typeof cell.v === 'number') {
          inst.setCellFormat(r, c, 'ct' as keyof Cell, { fa: format, t: 'n' });
          count++;
        }
      }
    }
  }

  return { ok: true, message: count > 0 ? `已格式化 ${count} 个数字单元格` : '未找到数字列' };
}

// ── 主入口 ──

/**
 * 执行直接操作
 * @param actionId - 来自 quickActionDefs 的 directAction 标识
 * @param inst - FortuneSheet 实例引用
 * @param opts - 可选参数（如列名等）
 */
export function executeDirectAction(
  actionId: string,
  inst: FortuneSheetRef,
  opts?: Record<string, unknown>,
): DirectActionResult {
  const handler = ACTION_HANDLERS[actionId];
  if (!handler) {
    return { ok: false, message: `未知的直接操作: ${actionId}` };
  }

  try {
    return handler(inst, opts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `操作执行失败: ${msg}` };
  }
}

/** 获取所有已注册的直接操作 ID */
export function getRegisteredDirectActions(): string[] {
  return Object.keys(ACTION_HANDLERS);
}
