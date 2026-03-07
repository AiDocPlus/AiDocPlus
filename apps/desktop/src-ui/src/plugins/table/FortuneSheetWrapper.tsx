/**
 * FortuneSheet 封装组件
 *
 * 职责：
 * - 初始化 FortuneSheet Workbook
 * - 通过 onOp/onChange 追踪变更 → 触发持久化（300ms 防抖）
 * - 暴露丰富的 ref API 供 AI 操作、工具栏、状态栏使用
 * - 配置中文 locale、工具栏、hooks 等
 */

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState, useMemo } from 'react';
import { Workbook } from '@fortune-sheet/react';
import type { WorkbookInstance } from '@fortune-sheet/react';
import type { Sheet, Op, Cell, Selection, Hooks } from '@fortune-sheet/core';
import '@fortune-sheet/react/dist/index.css';
import './fortune-sheet-overrides.css';
import { dataToCelldata } from './tableDataBridge';

/** 选区信息（用于状态栏统计） */
export interface SelectionInfo {
  sheetId: string;
  selection: Selection;
}

export interface FortuneSheetWrapperProps {
  /** 初始数据（仅首次渲染使用） */
  initialData: Sheet[];
  /** 数据变更回调（用于持久化，已防抖 300ms） */
  onDataChange: (sheets: Sheet[]) => void;
  /** 选区变化回调（用于状态栏统计） */
  onSelectionChange?: (info: SelectionInfo) => void;
  /** 容器高度（默认 100%） */
  height?: string | number;
}

export interface FortuneSheetRef {
  /** 获取 Workbook 实例（底层 API） */
  getInstance: () => WorkbookInstance | null;
  /** 获取所有 Sheet 数据 */
  getAllSheets: () => Sheet[];
  /** 通过 API 更新数据（完全替换） */
  updateSheets: (data: Sheet[]) => void;

  // ── 单元格操作 ──
  setCellValue: (row: number, col: number, value: any) => void;
  setCellValuesByRange: (data: any[][], range: { row: number[]; column: number[] }) => void;
  setCellFormat: (row: number, col: number, attr: keyof Cell, value: any) => void;
  getCellValue: (row: number, col: number) => any;

  // ── 行列操作 ──
  insertRowOrColumn: (type: 'row' | 'column', index: number, count: number, direction?: 'lefttop' | 'rightbottom') => void;
  deleteRowOrColumn: (type: 'row' | 'column', start: number, end: number) => void;
  setColumnWidth: (colInfo: Record<string, number>) => void;

  // ── 选区 ──
  getSelection: () => { row: number[]; column: number[] }[] | undefined;
  getCellsByRange: (range: Selection) => (Cell | null)[][];

  // ── Sheet 管理 ──
  addSheet: () => void;
  deleteSheet: () => void;
  getSheet: () => any;

  // ── 编辑 ──
  undo: () => void;
  redo: () => void;

  // ── 视图 ──
  freeze: (type: 'row' | 'column' | 'both', range: { row: number; column: number }) => void;
  scroll: (opts: { scrollLeft?: number; scrollTop?: number; targetRow?: number; targetColumn?: number }) => void;
}

export const FortuneSheetWrapper = forwardRef<FortuneSheetRef, FortuneSheetWrapperProps>(
  function FortuneSheetWrapper({ initialData, onDataChange, onSelectionChange, height = '100%' }, ref) {
    const workbookRef = useRef<WorkbookInstance>(null);
    const onDataChangeRef = useRef(onDataChange);
    onDataChangeRef.current = onDataChange;
    const onSelectionChangeRef = useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;

    // 用 key 强制重建（当需要完全替换数据时）
    const [resetKey, setResetKey] = useState(0);
    const pendingDataRef = useRef<Sheet[] | null>(null);

    // ── 防抖 onChange（300ms） ──
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleChange = useCallback((sheets: Sheet[]) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onDataChangeRef.current(sheets);
        debounceTimerRef.current = null;
      }, 300);
    }, []);

    // 组件卸载时清除定时器
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      };
    }, []);

    // ── FortuneSheet hooks ──
    const hooks: Hooks = useMemo(() => ({
      afterSelectionChange: (sheetId: string, selection: Selection) => {
        onSelectionChangeRef.current?.({ sheetId, selection });
      },
    }), []);

    // 暴露给父组件的丰富 API
    useImperativeHandle(ref, () => ({
      getInstance: () => workbookRef.current,
      getAllSheets: () => {
        if (!workbookRef.current) return [];
        return workbookRef.current.getAllSheets();
      },
      updateSheets: (data: Sheet[]) => {
        // 重建 celldata：运行时 FortuneSheet 会清空 celldata 只留 data 矩阵，
        // 但重建 Workbook 时需要 celldata，因此在此统一从 data 矩阵恢复。
        const fixed = data.map(s => ({
          ...s,
          celldata: (s.celldata && s.celldata.length > 0)
            ? s.celldata
            : dataToCelldata(s.data as (Cell | null)[][] | undefined),
        }));
        pendingDataRef.current = fixed;
        setResetKey((k) => k + 1);
      },

      // ── 单元格操作 ──
      setCellValue: (row, col, value) => {
        workbookRef.current?.setCellValue(row, col, value);
      },
      setCellValuesByRange: (data, range) => {
        workbookRef.current?.setCellValuesByRange(data, range);
      },
      setCellFormat: (row, col, attr, value) => {
        workbookRef.current?.setCellFormat(row, col, attr, value);
      },
      getCellValue: (row, col) => {
        try { return workbookRef.current?.getCellValue(row, col); } catch { return null; }
      },

      // ── 行列操作 ──
      insertRowOrColumn: (type, index, count, direction) => {
        workbookRef.current?.insertRowOrColumn(type, index, count, direction);
      },
      deleteRowOrColumn: (type, start, end) => {
        workbookRef.current?.deleteRowOrColumn(type, start, end);
      },
      setColumnWidth: (colInfo) => {
        workbookRef.current?.setColumnWidth(colInfo);
      },

      // ── 选区 ──
      getSelection: () => {
        try { return workbookRef.current?.getSelection(); } catch { return undefined; }
      },
      getCellsByRange: (range) => {
        try { return workbookRef.current?.getCellsByRange(range) ?? []; } catch { return []; }
      },

      // ── Sheet 管理 ──
      addSheet: () => {
        workbookRef.current?.addSheet();
      },
      deleteSheet: () => {
        workbookRef.current?.deleteSheet();
      },
      getSheet: () => {
        try { return workbookRef.current?.getSheet(); } catch { return null; }
      },

      // ── 编辑 ──
      undo: () => {
        workbookRef.current?.handleUndo();
      },
      redo: () => {
        workbookRef.current?.handleRedo();
      },

      // ── 视图 ──
      freeze: (type, range) => {
        workbookRef.current?.freeze(type, range);
      },
      scroll: (opts) => {
        workbookRef.current?.scroll(opts);
      },
    }), []);

    // 当 resetKey 变化时使用 pendingData
    const dataToUse = pendingDataRef.current || initialData;
    useEffect(() => {
      if (pendingDataRef.current) {
        pendingDataRef.current = null;
      }
    }, [resetKey]);

    // onOp：FortuneSheet 操作追踪（更细粒度，但 onChange 已足够用于持久化）
    const handleOp = useCallback((_ops: Op[]) => {
      // 可用于协作编辑场景，当前仅用 onChange 持久化
    }, []);

    return (
      <div className="w-full relative" style={{ height }}>
        <Workbook
          key={resetKey}
          ref={workbookRef}
          data={dataToUse}
          onChange={handleChange}
          onOp={handleOp}
          hooks={hooks}
          lang="zh"
          showToolbar={true}
          showFormulaBar={true}
          showSheetTabs={true}
          row={10}
          column={6}
          allowEdit={true}
        />
      </div>
    );
  },
);
