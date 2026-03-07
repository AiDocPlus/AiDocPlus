/**
 * AI 动作桥接引擎
 *
 * 监听 'table-ai-apply' CustomEvent，解析 AI 助手面板发来的结构化动作，
 * 调用 FortuneSheetRef API 执行操作并触发持久化。
 *
 * 支持的动作类型：
 * - generate_table    → 创建新 Sheet 并填充数据
 * - append_rows       → 在当前 Sheet 末尾追加行
 * - add_column        → 在当前 Sheet 添加新列
 * - formula_suggestion → 在指定单元格写入公式
 * - update_cells      → 修改指定单元格值
 * - delete_rows       → 删除指定行
 * - delete_columns    → 删除指定列
 * - insert_rows       → 在指定行后插入新行
 * - replace_sheet     → 完全替换当前 Sheet
 * - sort_data         → 按列排序
 * - set_format        → 设置单元格格式
 * - clear_range       → 清除指定区域数据
 */

import { useEffect, useRef } from 'react';
import type { FortuneSheetRef } from './FortuneSheetWrapper';
import type { TableSheet } from './types';
import { tableSheetsToFortune } from './tableDataBridge';
import type { Sheet } from '@fortune-sheet/core';
import { executeDirectAction } from './directActionEngine';

/** AI 动作的 detail 结构（与 TableAssistantPanel 中的 ParsedAction 一致） */
interface AiActionDetail {
  type: string;
  data: Record<string, unknown>;
}

interface UseTableActionBridgeOptions {
  sheetRef: React.RefObject<FortuneSheetRef | null>;
  onDataChange: (sheets: Sheet[]) => void;
  showStatus: (msg: string, isError?: boolean) => void;
}

/**
 * Hook：监听 table-ai-apply 事件并执行对应的表格操作
 */
export function useTableActionBridge({ sheetRef, onDataChange, showStatus }: UseTableActionBridgeOptions) {
  const optionsRef = useRef({ onDataChange, showStatus });
  optionsRef.current = { onDataChange, showStatus };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AiActionDetail>).detail;
      if (!detail?.type) return;

      const inst = sheetRef.current;
      if (!inst) {
        optionsRef.current.showStatus('表格实例未就绪', true);
        return;
      }

      try {
        switch (detail.type) {
          case 'generate_table':
            handleGenerateTable(inst, detail.data, optionsRef.current);
            break;
          case 'append_rows':
            handleAppendRows(inst, detail.data, optionsRef.current);
            break;
          case 'add_column':
            handleAddColumn(inst, detail.data, optionsRef.current);
            break;
          case 'formula_suggestion':
            handleFormulaSuggestion(inst, detail.data, optionsRef.current);
            break;
          case 'update_cells':
            handleUpdateCells(inst, detail.data, optionsRef.current);
            break;
          case 'delete_rows':
            handleDeleteRows(inst, detail.data, optionsRef.current);
            break;
          case 'delete_columns':
            handleDeleteColumns(inst, detail.data, optionsRef.current);
            break;
          case 'insert_rows':
            handleInsertRows(inst, detail.data, optionsRef.current);
            break;
          case 'replace_sheet':
            handleReplaceSheet(inst, detail.data, optionsRef.current);
            break;
          case 'sort_data':
            handleSortData(inst, detail.data, optionsRef.current);
            break;
          case 'set_format':
            handleSetFormat(inst, detail.data, optionsRef.current);
            break;
          case 'clear_range':
            handleClearRange(inst, detail.data, optionsRef.current);
            break;
          case 'rename_column':
            handleRenameColumn(inst, detail.data, optionsRef.current);
            break;
          case 'filter_rows':
            handleFilterRows(inst, detail.data, optionsRef.current);
            break;
          case 'reorder_columns':
            handleReorderColumns(inst, detail.data, optionsRef.current);
            break;
          case 'highlight_cells':
            handleHighlightCells(inst, detail.data, optionsRef.current);
            break;
          default:
            optionsRef.current.showStatus(`未知操作类型：${detail.type}`, true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        optionsRef.current.showStatus(`操作失败：${msg}`, true);
      }
    };

    // 直接执行操作事件
    const directHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ actionId: string; opts?: Record<string, unknown> }>).detail;
      if (!detail?.actionId) return;

      const inst = sheetRef.current;
      if (!inst) {
        optionsRef.current.showStatus('表格实例未就绪', true);
        return;
      }

      const result = executeDirectAction(detail.actionId, inst, detail.opts);
      if (result.ok) {
        // 操作成功后触发持久化
        const sheets = inst.getAllSheets();
        optionsRef.current.onDataChange(sheets);
      }
      optionsRef.current.showStatus(result.message, !result.ok);

      // 通知 AssistantPanel 显示反馈
      window.dispatchEvent(new CustomEvent('table-direct-action-result', {
        detail: { ok: result.ok, message: result.message, actionId: detail.actionId },
      }));
    };

    window.addEventListener('table-ai-apply', handler);
    window.addEventListener('table-direct-action', directHandler);
    return () => {
      window.removeEventListener('table-ai-apply', handler);
      window.removeEventListener('table-direct-action', directHandler);
    };
  }, [sheetRef]);
}

// ── generate_table：创建新 Sheet 并填充 ──

function handleGenerateTable(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const headers = data.headers as string[] | undefined;
  const rows = data.rows as string[][] | undefined;
  const name = (data.name as string) || '表格';

  if (!headers?.length) {
    opts.showStatus('AI 返回的表格缺少列标题', true);
    return;
  }

  const newSheet: TableSheet = {
    name,
    headers,
    data: rows || [],
  };

  const fortuneData = tableSheetsToFortune([newSheet]);
  // 合并到现有 Sheets
  const existing = inst.getAllSheets();
  const merged = [...existing, ...fortuneData];
  inst.updateSheets(merged);
  opts.onDataChange(merged);
  opts.showStatus(`已生成表格「${name}」— ${headers.length} 列, ${rows?.length || 0} 行`);
}

// ── append_rows：在当前 Sheet 末尾追加行 ──

function handleAppendRows(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const rows = data.rows as (string | number)[][] | undefined;
  if (!rows?.length) {
    opts.showStatus('没有要追加的行数据', true);
    return;
  }

  // 获取当前 Sheet 信息以确定追加位置
  const currentSheet = inst.getSheet();
  if (!currentSheet) {
    opts.showStatus('无法获取当前工作表', true);
    return;
  }

  // 找到当前数据的最后一行（非空行）
  const celldata = currentSheet.celldata || [];
  let maxRow = 0;
  for (const cell of celldata) {
    if (cell.r > maxRow) maxRow = cell.r;
  }
  const startRow = maxRow + 1;

  // 逐行逐列写入
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const val = rows[r][c];
      if (val !== '' && val !== null && val !== undefined) {
        inst.setCellValue(startRow + r, c, val);
      }
    }
  }

  // 触发持久化
  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已追加 ${rows.length} 行数据`);
}

// ── add_column：在当前 Sheet 添加新列 ──

function handleAddColumn(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const header = (data.header as string) || (data.name as string) || '新列';
  const values = data.values as (string | number)[] | undefined;

  // 获取当前 Sheet 以确定插入列的位置
  const currentSheet = inst.getSheet();
  if (!currentSheet) {
    opts.showStatus('无法获取当前工作表', true);
    return;
  }

  const celldata = currentSheet.celldata || [];
  let maxCol = 0;
  for (const cell of celldata) {
    if (cell.c > maxCol) maxCol = cell.c;
  }
  const newCol = maxCol + 1;

  // 写入列标题（第 0 行）
  inst.setCellValue(0, newCol, header);
  // 加粗表头
  inst.setCellFormat(0, newCol, 'bl', 1);

  // 写入列数据（从第 1 行开始）
  if (values?.length) {
    for (let r = 0; r < values.length; r++) {
      const val = values[r];
      if (val !== '' && val !== null && val !== undefined) {
        inst.setCellValue(r + 1, newCol, val);
      }
    }
  }

  // 触发持久化
  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已添加列「${header}」${values?.length ? ` — ${values.length} 行数据` : ''}`);
}

// ── formula_suggestion：在指定单元格写入公式 ──

function handleFormulaSuggestion(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const cellRef = data.cell as string | undefined;
  const formula = data.formula as string | undefined;

  if (!cellRef || !formula) {
    opts.showStatus('缺少单元格引用或公式', true);
    return;
  }

  // 解析单元格引用（如 "A1" → row=0, col=0）
  const match = cellRef.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    opts.showStatus(`无法解析单元格引用「${cellRef}」`, true);
    return;
  }

  const colStr = match[1].toUpperCase();
  const rowNum = parseInt(match[2], 10) - 1;
  let colNum = 0;
  for (let i = 0; i < colStr.length; i++) {
    colNum = colNum * 26 + (colStr.charCodeAt(i) - 65 + 1);
  }
  colNum -= 1;

  if (rowNum < 0 || colNum < 0) {
    opts.showStatus(`单元格引用「${cellRef}」无效`, true);
    return;
  }

  // 写入公式（FortuneSheet 公式以 = 开头）
  const formulaStr = formula.startsWith('=') ? formula : `=${formula}`;

  // 检查并自动扩展列：确保目标列和公式引用的列都在 Sheet 范围内
  const currentSheet = inst.getSheet();
  const currentColCount = currentSheet?.column ?? currentSheet?.column_count ?? 0;
  if (currentColCount > 0) {
    // 收集公式中引用的所有列号（如 D:D → 3, G2 → 6）
    let maxNeededCol = colNum;
    const colRefs = formulaStr.match(/[A-Z]+(?=\d|:)/gi) || [];
    for (const ref of colRefs) {
      let c = 0;
      for (let i = 0; i < ref.length; i++) {
        c = c * 26 + (ref.toUpperCase().charCodeAt(i) - 65 + 1);
      }
      c -= 1;
      if (c > maxNeededCol) maxNeededCol = c;
    }
    if (maxNeededCol >= currentColCount) {
      const colsToAdd = maxNeededCol - currentColCount + 1;
      inst.insertRowOrColumn('column', currentColCount - 1, colsToAdd, 'rightbottom');
    }
  }
  inst.setCellValue(rowNum, colNum, formulaStr);

  // 触发持久化
  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已在 ${cellRef} 写入公式：${formulaStr}`);
}

// ── 辅助：解析单元格引用 "A1" → {row, col} ──

function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  const colStr = m[1].toUpperCase();
  const row = parseInt(m[2], 10) - 1;
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 65 + 1);
  }
  col -= 1;
  if (row < 0 || col < 0) return null;
  return { row, col };
}

// ── 辅助：列字母 → 列号（0-indexed） ──

function colLetterToIndex(letter: string): number {
  const s = letter.toUpperCase();
  let col = 0;
  for (let i = 0; i < s.length; i++) {
    col = col * 26 + (s.charCodeAt(i) - 65 + 1);
  }
  return col - 1;
}

// ── 辅助：解析范围 "A1:B5" → {r0,c0,r1,c1} ──

function parseRange(range: string): { r0: number; c0: number; r1: number; c1: number } | null {
  const parts = range.split(':');
  if (parts.length !== 2) return null;
  const start = parseCellRef(parts[0].trim());
  const end = parseCellRef(parts[1].trim());
  if (!start || !end) return null;
  return { r0: start.row, c0: start.col, r1: end.row, c1: end.col };
}

// ── update_cells：修改指定单元格 ──

function handleUpdateCells(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const updates = data.updates as { cell: string; value: string | number }[] | undefined;
  if (!updates?.length) {
    opts.showStatus('没有要修改的单元格', true);
    return;
  }

  let count = 0;
  for (const u of updates) {
    const ref = parseCellRef(u.cell);
    if (!ref) continue;
    inst.setCellValue(ref.row, ref.col, u.value);
    count++;
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已修改 ${count} 个单元格`);
}

// ── delete_rows：删除指定行 ──

function handleDeleteRows(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const rows = data.rows as number[] | undefined;
  if (!rows?.length) {
    opts.showStatus('没有指定要删除的行', true);
    return;
  }

  // 从大到小排序，从后往前删，避免索引偏移
  const sorted = [...rows].sort((a, b) => b - a);
  for (const rowNum of sorted) {
    const idx = rowNum - 1; // 1-indexed → 0-indexed
    if (idx >= 0) {
      inst.deleteRowOrColumn('row', idx, idx);
    }
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已删除 ${rows.length} 行`);
}

// ── delete_columns：删除指定列 ──

function handleDeleteColumns(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const columns = data.columns as string[] | undefined;
  if (!columns?.length) {
    opts.showStatus('没有指定要删除的列', true);
    return;
  }

  // 转为索引，从大到小排序后删除
  const indices = columns.map(colLetterToIndex).filter(i => i >= 0).sort((a, b) => b - a);
  for (const colIdx of indices) {
    inst.deleteRowOrColumn('column', colIdx, colIdx);
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已删除 ${columns.length} 列（${columns.join(', ')}）`);
}

// ── insert_rows：在指定行后插入新行 ──

function handleInsertRows(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const afterRow = data.afterRow as number | undefined;
  const rows = data.rows as (string | number)[][] | undefined;
  if (afterRow === undefined || !rows?.length) {
    opts.showStatus('缺少插入位置或行数据', true);
    return;
  }

  const insertIdx = afterRow; // afterRow 是 1-indexed，转为 0-indexed 插入位置 = afterRow
  // 先插入空行
  inst.insertRowOrColumn('row', insertIdx, rows.length, 'rightbottom');

  // 写入数据
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const val = rows[r][c];
      if (val !== '' && val !== null && val !== undefined) {
        inst.setCellValue(insertIdx + r, c, val);
      }
    }
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已在第 ${afterRow} 行后插入 ${rows.length} 行`);
}

// ── replace_sheet：完全替换当前 Sheet ──

function handleReplaceSheet(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const headers = data.headers as string[] | undefined;
  const rows = data.rows as string[][] | undefined;

  if (!headers?.length) {
    opts.showStatus('替换数据缺少列标题', true);
    return;
  }

  const currentSheet = inst.getSheet();
  const sheetName = currentSheet?.name || '表格1';

  const newSheet: TableSheet = {
    name: sheetName,
    headers,
    data: rows || [],
  };

  // 替换当前 Sheet，保留其他 Sheet
  const allSheets = inst.getAllSheets();
  const currentIdx = allSheets.findIndex(s => s.name === sheetName);
  const fortuneData = tableSheetsToFortune([newSheet]);

  if (currentIdx >= 0 && fortuneData.length > 0) {
    // 保留原始 sheet 的 id 和 order
    fortuneData[0].id = allSheets[currentIdx].id;
    fortuneData[0].order = allSheets[currentIdx].order;
    fortuneData[0].status = allSheets[currentIdx].status;
    allSheets[currentIdx] = fortuneData[0];
    inst.updateSheets(allSheets);
    opts.onDataChange(allSheets);
  } else {
    inst.updateSheets(fortuneData);
    opts.onDataChange(fortuneData);
  }

  opts.showStatus(`已替换「${sheetName}」— ${headers.length} 列, ${rows?.length || 0} 行`);
}

// ── sort_data：按列排序 ──

function handleSortData(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const column = data.column as string | undefined;
  const order = (data.order as string) || 'asc';

  if (!column) {
    opts.showStatus('缺少排序列', true);
    return;
  }

  const colIdx = colLetterToIndex(column);
  if (colIdx < 0) {
    opts.showStatus(`无效的列引用「${column}」`, true);
    return;
  }

  // 读取所有数据行（跳过表头第0行）
  const currentSheet = inst.getSheet();
  if (!currentSheet) {
    opts.showStatus('无法获取当前工作表', true);
    return;
  }

  const celldata = currentSheet.celldata || [];
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of celldata) {
    if (cell.r > maxRow) maxRow = cell.r;
    if (cell.c > maxCol) maxCol = cell.c;
  }

  if (maxRow < 1) {
    opts.showStatus('没有数据行可排序', true);
    return;
  }

  // 构建数据矩阵（不含表头）
  const rows: { rowIdx: number; values: (string | number | null)[] }[] = [];
  for (let r = 1; r <= maxRow; r++) {
    const vals: (string | number | null)[] = [];
    for (let c = 0; c <= maxCol; c++) {
      vals.push(inst.getCellValue(r, c) ?? null);
    }
    rows.push({ rowIdx: r, values: vals });
  }

  // 排序
  rows.sort((a, b) => {
    const va = a.values[colIdx];
    const vb = b.values[colIdx];
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    const na = typeof va === 'number' ? va : Number(va);
    const nb = typeof vb === 'number' ? vb : Number(vb);
    if (!isNaN(na) && !isNaN(nb)) {
      return order === 'asc' ? na - nb : nb - na;
    }
    const sa = String(va);
    const sb = String(vb);
    return order === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });

  // 写回排序后的数据
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c <= maxCol; c++) {
      inst.setCellValue(r + 1, c, rows[r].values[c] ?? '');
    }
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已按列 ${column} ${order === 'asc' ? '升序' : '降序'}排序`);
}

// ── set_format：设置单元格格式 ──

function handleSetFormat(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const ranges = data.ranges as { range: string; bold?: boolean; color?: string; bg?: string }[] | undefined;
  if (!ranges?.length) {
    opts.showStatus('没有指定格式范围', true);
    return;
  }

  let count = 0;
  for (const item of ranges) {
    const r = parseRange(item.range);
    if (!r) continue;
    for (let row = r.r0; row <= r.r1; row++) {
      for (let col = r.c0; col <= r.c1; col++) {
        if (item.bold !== undefined) inst.setCellFormat(row, col, 'bl', item.bold ? 1 : 0);
        if (item.color) inst.setCellFormat(row, col, 'fc', item.color);
        if (item.bg) inst.setCellFormat(row, col, 'bg', item.bg);
        count++;
      }
    }
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已设置 ${count} 个单元格格式`);
}

// ── clear_range：清除指定区域数据 ──

function handleClearRange(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const range = data.range as string | undefined;
  if (!range) {
    opts.showStatus('没有指定清除范围', true);
    return;
  }

  const r = parseRange(range);
  if (!r) {
    opts.showStatus(`无法解析范围「${range}」`, true);
    return;
  }

  let count = 0;
  for (let row = r.r0; row <= r.r1; row++) {
    for (let col = r.c0; col <= r.c1; col++) {
      inst.setCellValue(row, col, '');
      count++;
    }
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已清除 ${count} 个单元格（${range}）`);
}

// ── rename_column：重命名列 ──

function handleRenameColumn(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const oldName = data.oldName as string | undefined;
  const newName = data.newName as string | undefined;

  if (!oldName || !newName) {
    opts.showStatus('缺少旧列名或新列名', true);
    return;
  }

  const currentSheet = inst.getSheet();
  if (!currentSheet) {
    opts.showStatus('无法获取当前工作表', true);
    return;
  }

  // 在第 0 行找到列名匹配的列
  const celldata = currentSheet.celldata || [];
  let maxCol = 0;
  for (const cell of celldata) {
    if (cell.c > maxCol) maxCol = cell.c;
  }

  let found = false;
  for (let c = 0; c <= maxCol; c++) {
    const val = inst.getCellValue(0, c);
    if (val !== null && val !== undefined && String(val).trim() === oldName.trim()) {
      inst.setCellValue(0, c, newName);
      found = true;
      break;
    }
  }

  if (!found) {
    opts.showStatus(`未找到列「${oldName}」`, true);
    return;
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已将列「${oldName}」重命名为「${newName}」`);
}

// ── filter_rows：按条件筛选行 ──

function handleFilterRows(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const condition = data.condition as string | undefined;
  const keepMatched = data.keepMatched !== false; // 默认保留匹配行

  if (!condition) {
    opts.showStatus('缺少筛选条件', true);
    return;
  }

  const currentSheet = inst.getSheet();
  if (!currentSheet) {
    opts.showStatus('无法获取当前工作表', true);
    return;
  }

  const celldata = currentSheet.celldata || [];
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of celldata) {
    if (cell.r > maxRow) maxRow = cell.r;
    if (cell.c > maxCol) maxCol = cell.c;
  }

  if (maxRow < 1) {
    opts.showStatus('没有数据行可筛选', true);
    return;
  }

  // 解析简单条件格式：「列名>值」「列名=值」「列名<值」「列名!=值」「列名包含值」
  const condMatch = condition.match(/^(.+?)\s*(>=|<=|!=|>|<|=|包含|contains)\s*(.+)$/i);
  if (!condMatch) {
    opts.showStatus(`无法解析筛选条件「${condition}」，支持格式：列名>值、列名=值、列名包含值`, true);
    return;
  }

  const colName = condMatch[1].trim();
  const operator = condMatch[2].trim().toLowerCase();
  const targetVal = condMatch[3].trim();

  // 找到列索引
  let colIdx = -1;
  for (let c = 0; c <= maxCol; c++) {
    const val = inst.getCellValue(0, c);
    if (val !== null && val !== undefined && String(val).trim() === colName) {
      colIdx = c;
      break;
    }
  }

  if (colIdx < 0) {
    opts.showStatus(`未找到列「${colName}」`, true);
    return;
  }

  // 评估每行是否匹配
  const rowsToDelete: number[] = [];
  for (let r = 1; r <= maxRow; r++) {
    const cellVal = inst.getCellValue(r, colIdx);
    const strVal = cellVal !== null && cellVal !== undefined ? String(cellVal).trim() : '';
    const numVal = Number(strVal);
    const numTarget = Number(targetVal);

    let matched = false;
    switch (operator) {
      case '>':  matched = !isNaN(numVal) && !isNaN(numTarget) && numVal > numTarget; break;
      case '<':  matched = !isNaN(numVal) && !isNaN(numTarget) && numVal < numTarget; break;
      case '>=': matched = !isNaN(numVal) && !isNaN(numTarget) && numVal >= numTarget; break;
      case '<=': matched = !isNaN(numVal) && !isNaN(numTarget) && numVal <= numTarget; break;
      case '=':  matched = strVal === targetVal; break;
      case '!=': matched = strVal !== targetVal; break;
      case '包含': case 'contains': matched = strVal.includes(targetVal); break;
    }

    // keepMatched=true 时删除不匹配的行，反之删除匹配的行
    if (keepMatched ? !matched : matched) {
      rowsToDelete.push(r);
    }
  }

  if (rowsToDelete.length === 0) {
    opts.showStatus(`筛选完成，没有需要删除的行`);
    return;
  }

  // 从后往前删除
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    const idx = rowsToDelete[i];
    inst.deleteRowOrColumn('row', idx, idx);
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已${keepMatched ? '保留' : '删除'}匹配「${condition}」的行，共删除 ${rowsToDelete.length} 行`);
}

// ── reorder_columns：调整列顺序 ──

function handleReorderColumns(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const order = data.order as string[] | undefined;
  if (!order?.length) {
    opts.showStatus('缺少列顺序', true);
    return;
  }

  const currentSheet = inst.getSheet();
  if (!currentSheet) {
    opts.showStatus('无法获取当前工作表', true);
    return;
  }

  const celldata = currentSheet.celldata || [];
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of celldata) {
    if (cell.r > maxRow) maxRow = cell.r;
    if (cell.c > maxCol) maxCol = cell.c;
  }

  // 建立列名 → 列索引映射
  const nameToCol = new Map<string, number>();
  for (let c = 0; c <= maxCol; c++) {
    const val = inst.getCellValue(0, c);
    if (val !== null && val !== undefined) {
      nameToCol.set(String(val).trim(), c);
    }
  }

  // 确定新的列序（只重排 order 中指定的列，其他列保持不变追加在后）
  const newColOrder: number[] = [];
  const usedCols = new Set<number>();
  for (const name of order) {
    const idx = nameToCol.get(name.trim());
    if (idx !== undefined) {
      newColOrder.push(idx);
      usedCols.add(idx);
    }
  }
  // 追加未提及的列
  for (let c = 0; c <= maxCol; c++) {
    if (!usedCols.has(c)) {
      newColOrder.push(c);
    }
  }

  // 读取所有数据
  const allData: (string | number | null)[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: (string | number | null)[] = [];
    for (const colIdx of newColOrder) {
      row.push(inst.getCellValue(r, colIdx) ?? null);
    }
    allData.push(row);
  }

  // 写回重排后的数据
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c < newColOrder.length; c++) {
      inst.setCellValue(r, c, allData[r][c] ?? '');
    }
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  opts.showStatus(`已调整列顺序：${order.join(' → ')}`);
}

// ── highlight_cells：高亮标记单元格 ──

function handleHighlightCells(
  inst: FortuneSheetRef,
  data: Record<string, unknown>,
  opts: { onDataChange: (sheets: Sheet[]) => void; showStatus: (msg: string, isError?: boolean) => void },
) {
  const cells = data.cells as string[] | undefined;
  const color = (data.color as string) || '#FFD700';

  if (!cells?.length) {
    opts.showStatus('没有指定要高亮的单元格', true);
    return;
  }

  let count = 0;
  for (const cellRef of cells) {
    const ref = parseCellRef(cellRef);
    if (!ref) continue;
    inst.setCellFormat(ref.row, ref.col, 'bg', color);
    count++;
  }

  const allSheets = inst.getAllSheets();
  opts.onDataChange(allSheets);
  const reason = data.reason ? ` — ${data.reason}` : '';
  opts.showStatus(`已高亮 ${count} 个单元格${reason}`);
}
