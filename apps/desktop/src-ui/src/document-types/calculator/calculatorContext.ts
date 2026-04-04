/**
 * 计算文档 AI 上下文引擎
 *
 * 分层构建上下文（critical / important / supplementary），
 * 支持阶段检测（blank / editing / data_ready / has_errors）和 Token 预算管理。
 */
import type { CalculatorSheet } from './types';
import { normalizeCalculatorVariables } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════════════

/** 计算器阶段 */
export type CalculatorPhase = 'blank' | 'editing' | 'data_ready' | 'has_errors';

/** 分层上下文 */
export interface CalculatorContext {
  /** 核心层：最近行 + 错误信息（~800 token） */
  critical: string;
  /** 重要层：变量列表 + 统计摘要（~500 token） */
  important: string;
  /** 补充层：Sheet 名称、设置等（~300 token） */
  supplementary: string;
  /** 检测到的阶段 */
  phase: CalculatorPhase;
}

export interface BuildContextOptions {
  /** Token 预算（默认 ~1600，critical ~800 + important ~500 + supplementary ~300） */
  tokenBudget?: number;
  /** 强制指定阶段（不自动检测） */
  phase?: CalculatorPhase;
}

// ═══════════════════════════════════════════════════════════════════════════
// 阶段检测
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 检测计算器当前阶段
 *
 * - blank: 空白/仅有空行
 * - editing: 有数据但无有效计算
 * - data_ready: 有正常计算结果
 * - has_errors: 有错误行
 */
export function detectCalculatorPhase(sheet: CalculatorSheet): CalculatorPhase {
  const lines = sheet.lines || [];
  const hasErrors = lines.some((l) => l.result?.type === 'error');

  if (hasErrors) return 'has_errors';

  const nonEmptyLines = lines.filter((l) => l.expression?.trim());
  if (nonEmptyLines.length === 0) return 'blank';

  const hasValidResults = nonEmptyLines.some(
    (l) => l.result?.type === 'number' || l.result?.type === 'string',
  );
  if (hasValidResults) return 'data_ready';

  return 'editing';
}

// ═══════════════════════════════════════════════════════════════════════════
// 分层上下文构建
// ═══════════════════════════════════════════════════════════════════════════

/** 构建核心层：最近 N 行 + 错误信息 */
function buildCriticalLayer(
  sheet: CalculatorSheet,
  recentCount: number = 12,
  isEn: boolean = false,
): string {
  const lines = sheet.lines || [];
  const recentLines = lines.slice(-recentCount);

  const linesText = recentLines
    .map((l) => {
      if (l.isNote) return `// ${l.expression}`;
      if (l.result?.type === 'error') {
        return `${l.lineNumber}: ${l.expression} → ${isEn ? 'Error' : '错误'}: ${l.result.error || l.result.displayValue}`;
      }
      return `${l.lineNumber}: ${l.expression} = ${l.result?.displayValue ?? ''}`;
    })
    .join('\n');

  // 错误行样本（额外强调）
  const errorSamples = lines
    .filter((l) => l.result?.type === 'error')
    .slice(-6)
    .map((l) => `  ${isEn ? 'Line' : '第'}${l.lineNumber}${isEn ? '' : '行'}: ${l.expression} → ${l.result?.error || l.result?.displayValue}`)
    .join('\n');

  let result = `${isEn ? 'Recent calculations' : '最近计算'}（${recentLines.length} ${isEn ? 'lines' : '行'}）：\n${linesText || (isEn ? '(empty)' : '（空）')}`;
  if (errorSamples) {
    result += `\n\n${isEn ? 'Error lines (excerpt)' : '错误行（节选）'}：\n${errorSamples}`;
  }
  return result;
}

/** 格式化数值用于 AI 上下文（截断浮点噪声，最多保留 10 位有效数字） */
function formatNumberForContext(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(10)));
}

/** 构建重要层：变量列表 + 统计摘要 */
function buildImportantLayer(sheet: CalculatorSheet, maxVars: number = 30, isEn: boolean = false): string {
  const normalizedVars = normalizeCalculatorVariables(
    sheet.variables as Record<string, unknown>,
  );
  const varEntries = Object.entries(normalizedVars);

  const varsText = varEntries
    .slice(0, maxVars)
    .map(([k, v]) => {
      const displayVal = typeof v.value === 'number'
        ? formatNumberForContext(v.value)
        : String(v.value);
      return `${k} = ${displayVal}`;
    })
    .join(', ');

  const stats = {
    totalLines: (sheet.lines || []).length,
    errorCount: (sheet.lines || []).filter((l) => l.result?.type === 'error').length,
    variableCount: varEntries.length,
  };

  return `${isEn ? 'Defined variables' : '定义的变量'}（${stats.variableCount} ${isEn ? '' : '个'}）：${varsText || (isEn ? '(none)' : '（无）')}

${isEn ? 'Stats' : '统计'}：${isEn ? 'total' : '共'} ${stats.totalLines} ${isEn ? 'lines' : '行'}，${stats.errorCount} ${isEn ? 'errors' : '个错误'}`;
}

/** 构建补充层：Sheet 名称等 */
function buildSupplementaryLayer(sheet: CalculatorSheet, isEn: boolean = false): string {
  return `${isEn ? 'Current Sheet' : '当前 Sheet'}: ${sheet.name || (isEn ? 'Untitled' : '未命名')}`;
}

/**
 * 构建完整分层上下文
 */
export function buildCalculatorContext(
  sheet: CalculatorSheet,
  options?: BuildContextOptions & { isEn?: boolean },
): CalculatorContext {
  const phase = options?.phase ?? detectCalculatorPhase(sheet);

  // tokenBudget 按比例分配：critical 50%, important 30%, supplementary 20%
  const budget = options?.tokenBudget ?? 1600;
  const criticalBudget = Math.max(4, Math.round(budget * 0.5));
  const importantBudget = Math.max(4, Math.round(budget * 0.3));

  // 每行约 ~30 token，变量约 ~8 token
  const recentCount = Math.max(2, Math.min(24, Math.floor(criticalBudget / 30)));
  const maxVars = Math.max(3, Math.min(40, Math.floor(importantBudget / 8)));

  const isEn = options?.isEn ?? false;
  return {
    critical: buildCriticalLayer(sheet, recentCount, isEn),
    important: buildImportantLayer(sheet, maxVars, isEn),
    supplementary: buildSupplementaryLayer(sheet, isEn),
    phase,
  };
}

/**
 * 将分层上下文合并为字符串（用于 AI 系统提示注入）
 */
export function formatContextForAI(ctx: CalculatorContext, isEn: boolean = false): string {
  return `${isEn ? 'Current calculation context' : '当前计算上下文'}：

${ctx.critical}

${ctx.important}

${ctx.supplementary}
`;
}

/**
 * 智能上下文构建（根据阶段调整内容）
 *
 * - blank: 只返回基本提示，鼓励用户开始
 * - editing: 返回当前输入内容
 * - data_ready: 完整上下文
 * - has_errors: 强调错误信息
 */
export function buildSmartContext(
  sheet: CalculatorSheet,
  options?: BuildContextOptions & { isEn?: boolean },
): string {
  const isEn = options?.isEn ?? false;
  const ctx = buildCalculatorContext(sheet, options);

  switch (ctx.phase) {
    case 'blank':
      return `${isEn ? 'Current calculation context' : '当前计算上下文'}：

${isEn ? 'The worksheet is empty, waiting for user input.' : '工作表为空，等待用户输入计算表达式。'}
`;
    case 'editing':
      return `${isEn ? 'Current calculation context' : '当前计算上下文'}：

${ctx.critical}

${ctx.supplementary}
`;
    case 'has_errors':
      // 错误时优先显示错误信息
      return `${isEn ? 'Current calculation context (has errors)' : '当前计算上下文（有错误）'}：

${ctx.critical}

${ctx.important}

${ctx.supplementary}

${isEn ? '⚠️ Note: There are errors in the above calculations. Please help the user identify and fix them.' : '⚠️ 注意：上述计算中有错误，请帮助用户排查并修正。'}
`;
    case 'data_ready':
    default:
      return formatContextForAI(ctx, isEn);
  }
}
