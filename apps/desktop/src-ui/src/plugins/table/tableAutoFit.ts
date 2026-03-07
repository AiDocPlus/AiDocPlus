/**
 * 列自适应宽度算法
 *
 * 根据单元格内容长度计算最佳列宽，中文字符算 2 宽度。
 */

import type { FortuneSheetRef } from './FortuneSheetWrapper';

/** 计算字符串的显示宽度（中文算2，其他算1） */
function getDisplayWidth(str: string): number {
  let width = 0;
  for (const ch of str) {
    // CJK 统一汉字 + 全角标点
    if (ch.charCodeAt(0) > 0x7F) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/** 每字符对应的像素宽度（经验值） */
const CHAR_PX = 8;
/** 列宽下限 */
const MIN_COL_WIDTH = 50;
/** 列宽上限 */
const MAX_COL_WIDTH = 300;
/** 左右 padding */
const PADDING = 16;

/**
 * 自适应当前 Sheet 的所有列宽
 *
 * 遍历当前 Sheet 的 celldata，计算每列最大内容宽度，
 * 通过 setColumnWidth API 一次性设置。
 */
export function autoFitColumns(sheetRef: FortuneSheetRef): void {
  const inst = sheetRef.getInstance();
  if (!inst) return;

  const sheet = inst.getSheet();
  if (!sheet) return;

  const celldata = sheet.celldata || [];
  if (celldata.length === 0) return;

  // 收集每列的最大显示宽度
  const colMaxWidth: Record<number, number> = {};

  for (const cell of celldata) {
    const c = cell.c;
    // 取显示值 m，否则取 v
    const v = cell.v;
    let text = '';
    if (v) {
      if (typeof v === 'object' && v !== null) {
        text = (v as { m?: string; v?: unknown }).m !== undefined
          ? String((v as { m?: string }).m)
          : String((v as { v?: unknown }).v ?? '');
      } else {
        text = String(v);
      }
    }

    if (!text) continue;

    const displayWidth = getDisplayWidth(text);
    const pixelWidth = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, displayWidth * CHAR_PX + PADDING));

    if (!colMaxWidth[c] || pixelWidth > colMaxWidth[c]) {
      colMaxWidth[c] = pixelWidth;
    }
  }

  if (Object.keys(colMaxWidth).length === 0) return;

  // 转换为 FortuneSheet setColumnWidth 要求的格式 { "列号": 宽度 }
  const colInfo: Record<string, number> = {};
  for (const [col, width] of Object.entries(colMaxWidth)) {
    colInfo[col] = width;
  }

  sheetRef.setColumnWidth(colInfo);
}
