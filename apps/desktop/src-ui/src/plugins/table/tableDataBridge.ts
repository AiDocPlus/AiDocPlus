/**
 * 表格数据桥接层
 *
 * 负责 TableSheet（旧格式）↔ FortuneSheet（新格式）的双向转换，
 * 以及生成默认空白 Sheet。
 */

import type { Sheet, CellWithRowAndCol, Cell } from '@fortune-sheet/core';
import type { TableSheet, TablePluginData } from './types';

// ── 默认空白 Sheet ──

/** 生成一个空白的 FortuneSheet（用于"一打开就是表格"） */
export function createDefaultFortuneSheet(): Sheet[] {
  return [
    {
      name: '表格1',
      id: 'sheet_001',
      status: 1,
      order: 0,
      row: 10,
      column: 6,
      celldata: [],
      config: {},
    },
  ];
}

// ── 旧格式 → FortuneSheet ──

/** 将 TableSheet[]（旧格式）转换为 FortuneSheet Sheet[] */
export function tableSheetsToFortune(sheets: TableSheet[]): Sheet[] {
  return sheets.map((sheet, idx) => {
    const celldata: CellWithRowAndCol[] = [];

    // 写入表头行（第 0 行），加粗 + 背景色
    sheet.headers.forEach((header, c) => {
      celldata.push({
        r: 0,
        c,
        v: {
          v: header,
          m: String(header),
          ct: { fa: 'General', t: 'g' },
          ff: 5,           // 宋体
          bl: 1,           // bold
          bg: '#E8EAED',   // 浅灰背景
        } as Cell,
      });
    });

    // 写入数据行（从第 1 行开始）
    sheet.data.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val === '' || val === null || val === undefined) return;
        const isNum = typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val)));
        celldata.push({
          r: r + 1,
          c,
          v: {
            v: isNum ? Number(val) : val,
            m: String(val),
            ct: isNum
              ? { fa: 'General', t: 'n' }
              : { fa: 'General', t: 'g' },
            ff: 5,         // 宋体
          } as Cell,
        });
      });
    });

    const totalRows = Math.max(sheet.data.length + 1, 10);
    const totalCols = Math.max(sheet.headers.length, 6);

    return {
      name: sheet.name,
      id: `sheet_${String(idx).padStart(3, '0')}`,
      status: idx === 0 ? 1 : 0,
      order: idx,
      row: totalRows,
      column: totalCols,
      celldata,
      config: {},
    };
  });
}

// ── FortuneSheet → 旧格式 ──

/** 将 FortuneSheet Sheet[] 转换回 TableSheet[]（用于持久化兼容和导出） */
export function fortuneToTableSheets(fortuneSheets: Sheet[]): TableSheet[] {
  return fortuneSheets.map((fs) => {
    // 确定实际数据范围
    const cells = fs.celldata || [];
    if (cells.length === 0 && fs.data) {
      // 如果有 data matrix 但没有 celldata，从 data 转换
      return fortuneDataMatrixToTableSheet(fs.name, fs.data);
    }

    let maxR = 0;
    let maxC = 0;
    for (const cell of cells) {
      if (cell.r > maxR) maxR = cell.r;
      if (cell.c > maxC) maxC = cell.c;
    }

    // 第 0 行作为表头
    const headers: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const cell = cells.find((ce) => ce.r === 0 && ce.c === c);
      headers.push(cellToString(cell?.v));
    }

    // 第 1 行起为数据
    const data: (string | number)[][] = [];
    for (let r = 1; r <= maxR; r++) {
      const row: (string | number)[] = [];
      for (let c = 0; c <= maxC; c++) {
        const cell = cells.find((ce) => ce.r === r && ce.c === c);
        row.push(cellToValue(cell?.v));
      }
      data.push(row);
    }

    return trimSheet({ name: fs.name, headers, data });
  });
}

/** 从 data matrix 转换（FortuneSheet 内部有时使用 data 而非 celldata） */
function fortuneDataMatrixToTableSheet(
  name: string,
  matrix: (Cell | null)[][],
): TableSheet {
  if (!matrix.length) return { name, headers: [], data: [] };

  const headers = matrix[0].map((cell) => cellToString(cell));
  const data = matrix.slice(1).map((row) => row.map((cell) => cellToValue(cell)));

  return trimSheet({ name, headers, data });
}

/** 裁剪 TableSheet 中尾部的空行和右侧的空列，仅保留有内容的区域 */
function trimSheet(sheet: TableSheet): TableSheet {
  let { headers, data } = sheet;

  // 判断单元格是否为空
  const isEmpty = (v: string | number | null | undefined): boolean =>
    v === '' || v === null || v === undefined;

  // 1. 从底部向上移除全空行
  let lastNonEmptyRow = data.length - 1;
  while (lastNonEmptyRow >= 0 && data[lastNonEmptyRow].every(isEmpty)) {
    lastNonEmptyRow--;
  }
  data = lastNonEmptyRow < 0 ? [] : data.slice(0, lastNonEmptyRow + 1);

  // 2. 从右向左找到最后一个有内容的列
  const colCount = headers.length;
  let lastNonEmptyCol = colCount - 1;
  while (lastNonEmptyCol >= 0) {
    const headerHasContent = !isEmpty(headers[lastNonEmptyCol]);
    const colHasData = data.some(row => !isEmpty(row[lastNonEmptyCol]));
    if (headerHasContent || colHasData) break;
    lastNonEmptyCol--;
  }

  if (lastNonEmptyCol < 0) {
    return { name: sheet.name, headers: [], data: [] };
  }

  if (lastNonEmptyCol < colCount - 1) {
    headers = headers.slice(0, lastNonEmptyCol + 1);
    data = data.map(row => row.slice(0, lastNonEmptyCol + 1));
  }

  return { name: sheet.name, headers, data };
}

function cellToString(cell: Cell | null | undefined): string {
  if (!cell) return '';
  if (cell.m !== undefined && cell.m !== null) return String(cell.m);
  if (cell.v !== undefined && cell.v !== null) return String(cell.v);
  return '';
}

function cellToValue(cell: Cell | null | undefined): string | number {
  if (!cell) return '';
  const v = cell.v;
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return String(v);
}

// ── 从 pluginData 加载 ──

/** 从文档 pluginData 中解析出 FortuneSheet 数据 */
export function loadFortuneData(pluginData: unknown): Sheet[] {
  if (!pluginData || typeof pluginData !== 'object') return createDefaultFortuneSheet();

  const pd = pluginData as TablePluginData;

  // 优先使用新格式
  if (pd.fortuneSheets && Array.isArray(pd.fortuneSheets) && pd.fortuneSheets.length > 0) {
    return pd.fortuneSheets;
  }

  // 回退：旧格式转换
  if (pd.sheets && Array.isArray(pd.sheets) && pd.sheets.length > 0) {
    return tableSheetsToFortune(pd.sheets);
  }

  return createDefaultFortuneSheet();
}

/**
 * 将 data 二维矩阵转换为 celldata 数组（仅保留非空单元格）
 * FortuneSheet 初始化时从 celldata 构建 data，然后删除 celldata，
 * 因此持久化时必须从 data 矩阵重建 celldata。
 */
export function dataToCelldata(data: (Cell | null)[][] | undefined): CellWithRowAndCol[] {
  const celldata: CellWithRowAndCol[] = [];
  if (!data) return celldata;
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const v = data[r][c];
      if (v != null) {
        celldata.push({ r, c, v });
      }
    }
  }
  return celldata;
}

/** 将 FortuneSheet 数据打包为 pluginData 用于持久化 */
export function packFortuneData(fortuneSheets: Sheet[]): TablePluginData {
  // 重建 celldata：FortuneSheet 运行时删除了 celldata，只留 data 矩阵，
  // 但初始化时需要 celldata，因此保存前必须从 data 转回 celldata。
  const sheetsToSave: Sheet[] = fortuneSheets.map((fs) => ({
    ...fs,
    celldata: dataToCelldata(fs.data as (Cell | null)[][] | undefined),
  }));
  return {
    fortuneSheets: sheetsToSave,
    sheets: fortuneToTableSheets(fortuneSheets),
  };
}
