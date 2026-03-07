/**
 * 表格 AI 助手 — 智能上下文引擎
 *
 * 职责：
 * - 分层构建表格上下文（critical / important / supplementary）
 * - Token 预算管理，按层级裁剪
 * - 表格阶段自动检测（空白→编辑中→数据就绪→分析中）
 * - 列类型推断和统计摘要
 * - 生成智能系统提示词
 */

import type { TableSheet } from './tableUtils';
import type { TablePluginData, ColumnStats, InferredColumnType, ContextLayer } from './types';

// ── 表格阶段 ──

export type TablePhase = 'blank' | 'editing' | 'data_ready' | 'analyzing';

export function detectTablePhase(data: TablePluginData): TablePhase {
  const sheets = data.sheets;
  if (!sheets || sheets.length === 0) return 'blank';
  const totalRows = sheets.reduce((s, sh) => s + (sh.data?.length || 0), 0);
  if (totalRows === 0) return 'blank';
  if (totalRows < 3) return 'editing';
  return 'data_ready';
}

// ── 列类型推断 ──

export function inferColumnType(values: (string | number)[]): InferredColumnType {
  const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return 'empty';

  let numCount = 0;
  let dateCount = 0;
  let boolCount = 0;
  const uniqueValues = new Set<string>();

  for (const v of nonEmpty) {
    const str = String(v).trim().toLowerCase();
    uniqueValues.add(str);

    if (typeof v === 'number' || (str !== '' && !isNaN(Number(str)))) {
      numCount++;
    }
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {
      dateCount++;
    }
    if (['true', 'false', '是', '否', 'yes', 'no', '1', '0'].includes(str)) {
      boolCount++;
    }
  }

  const total = nonEmpty.length;
  if (numCount / total > 0.8) return 'number';
  if (dateCount / total > 0.6) return 'date';
  if (boolCount / total > 0.8) return 'boolean';
  if (uniqueValues.size <= Math.max(5, total * 0.3)) return 'enum';
  return 'text';
}

// ── 列统计摘要 ──

export function buildColumnStats(sheet: TableSheet): ColumnStats[] {
  if (!sheet.headers || !sheet.data || sheet.data.length === 0) return [];

  return sheet.headers.map((name, ci) => {
    const values = sheet.data.map(row => row[ci]);
    const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
    const type = inferColumnType(values);
    const uniqueSet = new Set(nonEmpty.map(v => String(v).trim().toLowerCase()));

    const stats: ColumnStats = {
      name,
      type,
      nonEmpty: nonEmpty.length,
      unique: uniqueSet.size,
      nullRate: 1 - nonEmpty.length / Math.max(values.length, 1),
    };

    if (type === 'number') {
      const nums = nonEmpty.map(v => Number(v)).filter(n => !isNaN(n));
      if (nums.length > 0) {
        stats.min = Math.min(...nums);
        stats.max = Math.max(...nums);
        stats.avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      }
    }

    return stats;
  });
}

// ── 分层上下文构建 ──

function buildContextLayers(data: TablePluginData, docContent?: string): { critical: ContextLayer[]; important: ContextLayer[]; supplementary: ContextLayer[] } {
  const critical: ContextLayer[] = [];
  const important: ContextLayer[] = [];
  const supplementary: ContextLayer[] = [];
  const sheets = data.sheets || [];

  // ── Critical：始终包含 ──
  critical.push({
    label: '表格概览',
    content: `当前共 ${sheets.length} 个表格`,
    priority: 'critical',
  });

  for (const sheet of sheets.slice(0, 5)) {
    const rowCount = sheet.data?.length || 0;
    const colCount = sheet.headers?.length || 0;
    critical.push({
      label: `表格「${sheet.name}」`,
      content: `表格「${sheet.name}」：${rowCount} 行 × ${colCount} 列，列名：${JSON.stringify(sheet.headers)}`,
      priority: 'critical',
    });
  }

  // ── Important：数据预览 + 列统计 ──
  for (const sheet of sheets.slice(0, 3)) {
    if (sheet.data && sheet.data.length > 0) {
      const preview = sheet.data.slice(0, 5).map(row => row.map(v => String(v ?? ''))).map(row => row.join('\t')).join('\n');
      important.push({
        label: `${sheet.name} 数据预览`,
        content: `「${sheet.name}」前5行数据：\n${preview}`,
        priority: 'important',
      });

      const stats = buildColumnStats(sheet);
      const numStats = stats.filter(s => s.type === 'number' && s.avg !== undefined);
      if (numStats.length > 0) {
        const statsText = numStats.map(s =>
          `  ${s.name}: 范围 ${s.min}~${s.max}, 均值 ${typeof s.avg === 'number' ? s.avg.toFixed(2) : s.avg}, 空值率 ${(s.nullRate * 100).toFixed(0)}%`
        ).join('\n');
        important.push({
          label: `${sheet.name} 数值统计`,
          content: `「${sheet.name}」数值列统计：\n${statsText}`,
          priority: 'important',
        });
      }
    }
  }

  // ── Supplementary：文档正文参考 ──
  if (docContent && docContent.trim()) {
    supplementary.push({
      label: '文档正文',
      content: `文档正文参考（截取前1500字）：\n${docContent.slice(0, 1500)}`,
      priority: 'supplementary',
    });
  }

  // 列类型摘要
  for (const sheet of sheets.slice(0, 2)) {
    const stats = buildColumnStats(sheet);
    if (stats.length > 0) {
      const typeText = stats.map(s => `${s.name}(${s.type})`).join(', ');
      supplementary.push({
        label: `${sheet.name} 列类型`,
        content: `「${sheet.name}」列类型：${typeText}`,
        priority: 'supplementary',
      });
    }
  }

  return { critical, important, supplementary };
}

/**
 * 构建 token 预算内的上下文字符串
 * @param data 表格插件数据
 * @param docContent 文档正文
 * @param budget 字符预算（默认 4000，约 2000 token）
 */
export function buildTieredContext(data: TablePluginData, docContent?: string, budget = 4000): string {
  const layers = buildContextLayers(data, docContent);
  const parts: string[] = [];
  let remaining = budget;

  for (const layer of [layers.critical, layers.important, layers.supplementary]) {
    for (const item of layer) {
      if (item.content.length <= remaining) {
        parts.push(item.content);
        remaining -= item.content.length;
      } else if (remaining > 100) {
        parts.push(item.content.slice(0, remaining - 20) + '\n...(已截断)');
        remaining = 0;
        break;
      }
    }
    if (remaining <= 0) break;
  }

  return parts.length > 0 ? '\n\n--- 当前表格状态 ---\n' + parts.join('\n') : '';
}

// ── 上下文模式 ──

export type TableContextMode = 'none' | 'data' | 'stats' | 'structure';

export const TABLE_CONTEXT_MODE_LABELS: Record<TableContextMode, string> = {
  none: '随便聊聊',
  data: '表格数据',
  stats: '统计分析',
  structure: '表结构',
};

export function buildContextForMode(data: TablePluginData, mode: TableContextMode): string {
  const sheets = data.sheets || [];
  if (sheets.length === 0) return '当前没有表格数据。';

  switch (mode) {
    case 'data': {
      const parts: string[] = [];
      for (const sheet of sheets.slice(0, 3)) {
        parts.push(`## 表格「${sheet.name}」`);
        parts.push(`列名：${JSON.stringify(sheet.headers)}`);
        if (sheet.data?.length) {
          const rows = sheet.data.slice(0, 20).map(row => row.map(v => String(v ?? '')).join('\t'));
          parts.push(`数据（前20行）：\n${rows.join('\n')}`);
        }
      }
      return parts.join('\n\n');
    }
    case 'stats': {
      const parts: string[] = [];
      for (const sheet of sheets.slice(0, 3)) {
        const stats = buildColumnStats(sheet);
        parts.push(`## 表格「${sheet.name}」统计`);
        parts.push(`行数：${sheet.data?.length || 0}，列数：${sheet.headers?.length || 0}`);
        for (const s of stats) {
          let line = `  ${s.name} [${s.type}]：非空 ${s.nonEmpty}，唯一值 ${s.unique}，空值率 ${(s.nullRate * 100).toFixed(0)}%`;
          if (s.type === 'number' && s.avg !== undefined) {
            line += `，范围 ${s.min}~${s.max}，均值 ${typeof s.avg === 'number' ? s.avg.toFixed(2) : s.avg}`;
          }
          parts.push(line);
        }
      }
      return parts.join('\n\n');
    }
    case 'structure': {
      const parts: string[] = [];
      for (const sheet of sheets) {
        const stats = buildColumnStats(sheet);
        parts.push(`## 表格「${sheet.name}」结构`);
        parts.push(`行数：${sheet.data?.length || 0}`);
        for (const s of stats) {
          parts.push(`  ${s.name}: 类型=${s.type}, 非空=${s.nonEmpty}, 唯一值=${s.unique}`);
        }
      }
      return parts.join('\n\n');
    }
    default:
      return '';
  }
}

// ── 上下文摘要 ──

export interface TableContextSummary {
  phase: TablePhase;
  sheetCount: number;
  totalRows: number;
  totalCols: number;
  sheetNames: string[];
}

export function getContextSummary(data: TablePluginData): TableContextSummary {
  const sheets = data.sheets || [];
  return {
    phase: detectTablePhase(data),
    sheetCount: sheets.length,
    totalRows: sheets.reduce((s, sh) => s + (sh.data?.length || 0), 0),
    totalCols: sheets.reduce((s, sh) => s + (sh.headers?.length || 0), 0),
    sheetNames: sheets.map(s => s.name),
  };
}

// ── 智能系统提示词 ──

const ACTION_PROTOCOL = `
【重要规则】
- 当用户表格已有数据时，优先使用增量操作（update_cells / append_rows / add_column / insert_rows），而非 generate_table 或 replace_sheet
- generate_table 仅用于创建全新表格（新 Sheet）
- replace_sheet 仅在用户明确要求"替换"或数据需要完全重构时使用
- 对于排序、格式化等简单操作，优先使用对应的专用动作（sort_data / set_format）
- 每个 JSON 代码块只包含一个动作

【结构化动作协议】
你可以在回复中输出以下 JSON 代码块，系统会自动解析并渲染可执行按钮：

1. 生成新表格数据（仅用于创建全新 Sheet）：
\`\`\`json
{"action":"generate_table","name":"表格名","headers":["列1","列2"],"rows":[["值1","值2"]]}
\`\`\`

2. 追加行数据到当前表格：
\`\`\`json
{"action":"append_rows","sheetName":"表格名","rows":[["值1","值2"]]}
\`\`\`

3. 添加计算列：
\`\`\`json
{"action":"add_column","sheetName":"表格名","header":"新列名","values":["值1","值2"]}
\`\`\`

4. 数据分析报告：
\`\`\`json
{"action":"analysis_report","title":"分析标题","findings":["发现1","发现2"],"suggestions":["建议1"]}
\`\`\`

5. 公式建议：
\`\`\`json
{"action":"formula_suggestion","cell":"A1","formula":"=SUM(B2:B10)","description":"计算B列总和"}
\`\`\`

6. 修改指定单元格（可批量）：
\`\`\`json
{"action":"update_cells","updates":[{"cell":"A3","value":"新值"},{"cell":"B5","value":100}]}
\`\`\`

7. 删除行（行号从1开始）：
\`\`\`json
{"action":"delete_rows","rows":[2,5,7]}
\`\`\`

8. 删除列（列字母）：
\`\`\`json
{"action":"delete_columns","columns":["C","E"]}
\`\`\`

9. 在指定行后插入新行：
\`\`\`json
{"action":"insert_rows","afterRow":3,"rows":[["值1","值2"],["值3","值4"]]}
\`\`\`

10. 完全替换当前 Sheet 数据（慎用，仅在数据需完全重构时）：
\`\`\`json
{"action":"replace_sheet","headers":["列1","列2"],"rows":[["值1","值2"]]}
\`\`\`

11. 按列排序：
\`\`\`json
{"action":"sort_data","column":"B","order":"asc"}
\`\`\`

12. 设置单元格格式（加粗/颜色）：
\`\`\`json
{"action":"set_format","ranges":[{"range":"A1:B5","bold":true,"color":"#FF0000","bg":"#FFFF00"}]}
\`\`\`

13. 清除指定区域数据：
\`\`\`json
{"action":"clear_range","range":"A2:D10"}
\`\`\`

14. 重命名列：
\`\`\`json
{"action":"rename_column","oldName":"旧列名","newName":"新列名"}
\`\`\`

15. 按条件筛选行（保留或删除匹配行）：
\`\`\`json
{"action":"filter_rows","condition":"金额>1000","keepMatched":true}
\`\`\`

16. 调整列顺序：
\`\`\`json
{"action":"reorder_columns","order":["姓名","部门","金额","日期"]}
\`\`\`

17. 高亮标记单元格：
\`\`\`json
{"action":"highlight_cells","cells":["A3","B5","C2"],"color":"#FFD700","reason":"异常值"}
\`\`\`
`;

const BASE_SYSTEM_PROMPT = `你是表格数据 AI 助手，精通数据分析、Excel 操作和表格处理。

你的能力：
1. 创建和生成结构化表格数据
2. 数据清洗：去重、填充缺失值、格式统一
3. 数据分析：趋势分析、异常检测、分布统计
4. 公式和计算：推荐和生成计算公式
5. 数据转换：透视表、分组汇总、数据重塑
6. 智能填充：基于规律自动生成列数据
7. 数据可视化建议：推荐图表类型和维度
8. 导入导出格式建议

${ACTION_PROTOCOL}
回复使用中文。`;

const PHASE_HINTS: Record<TablePhase, string> = {
  blank: '\n\n【当前状态】用户尚未创建表格数据，可能需要帮助创建表格、导入数据或了解功能。',
  editing: '\n\n【当前状态】用户正在编辑少量数据，可能需要帮助补充数据、设计表结构或导入更多数据。',
  data_ready: '\n\n【当前状态】表格已有数据，用户可能需要数据分析、清洗、计算或可视化建议。',
  analyzing: '\n\n【当前状态】用户正在进行数据分析，可能需要更深入的统计分析或可视化建议。',
};

/**
 * 构建完整的系统提示词
 */
export function buildSmartSystemPrompt(
  data: TablePluginData,
  docContent: string,
  customPrompt?: string,
): string {
  const phase = detectTablePhase(data);
  const basePrompt = customPrompt?.trim() || BASE_SYSTEM_PROMPT;
  const phaseHint = PHASE_HINTS[phase];
  const tableContext = buildTieredContext(data, docContent);

  // 注入当前日期，让 AI 即使不联网也知道今天的日期
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const dateHint = `\n\n【当前日期】${dateStr}（星期${weekdays[now.getDay()]}）`;

  return basePrompt + dateHint + phaseHint + tableContext;
}

/** 获取默认系统提示词 */
export function getDefaultSystemPrompt(): string {
  return BASE_SYSTEM_PROMPT;
}
