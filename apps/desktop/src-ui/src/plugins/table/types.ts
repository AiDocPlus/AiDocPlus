/**
 * 表格插件类型定义
 *
 * 保留旧的 TableSheet 格式用于持久化和导入导出兼容，
 * 同时定义 FortuneSheet 集成相关的类型。
 */

import type { Sheet as FortuneSheet } from '@fortune-sheet/core';
import type { WorkbookInstance } from '@fortune-sheet/react';

// ── 旧格式（向后兼容，用于持久化） ──

export type CellValue = string | number;
export type TableData = CellValue[][];

/** 旧版单个表格（headers + data 二维数组） */
export interface TableSheet {
  name: string;
  headers: string[];
  data: TableData;
}

// ── 插件持久化数据 ──

/** 存储在文档 pluginData 中的数据结构 */
export interface TablePluginData {
  /** 旧格式（兼容已有文档） */
  sheets?: TableSheet[];
  /** FortuneSheet 原生格式（新格式，优先使用） */
  fortuneSheets?: FortuneSheet[];
}

// ── FortuneSheet 相关 re-export ──

export type { FortuneSheet, WorkbookInstance };

// ── AI 相关类型 ──

/** AI 操作类型 */
export type AiOperationType =
  | 'generate'      // 从文档生成表格
  | 'fill-column'   // AI 填充列
  | 'analyze'       // 数据分析
  | 'transform'     // 数据变换
  | 'clean'         // 数据清洗
  | 'formula'       // 公式建议
  | 'visualize'     // 可视化建议
  | 'export-report' // 导出报告

/** AI 操作状态 */
export interface AiOperationState {
  type: AiOperationType | null;
  loading: boolean;
  error: string | null;
}

/** 列类型推断结果 */
export type InferredColumnType = 'number' | 'date' | 'text' | 'enum' | 'boolean' | 'empty';

/** 列统计摘要 */
export interface ColumnStats {
  name: string;
  type: InferredColumnType;
  nonEmpty: number;
  unique: number;
  min?: number | string;
  max?: number | string;
  avg?: number;
  nullRate: number;
}

/** AI 上下文层级 */
export interface ContextLayer {
  label: string;
  content: string;
  priority: 'critical' | 'important' | 'supplementary';
}
