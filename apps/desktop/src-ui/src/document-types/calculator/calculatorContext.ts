/**
 * 计算文档 AI 上下文引擎
 *
 * 分层构建上下文（critical / important / supplementary），
 * 支持阶段检测（blank / editing / data_ready / has_errors）和 Token 预算管理。
 */
import type { CalculatorSheet, CalculatorLine, CalculatorVariable } from './types';
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
): string {
  const lines = sheet.lines || [];
  const recentLines = lines.slice(-recentCount);

  const linesText = recentLines
    .map((l) => {
      if (l.isNote) return `// ${l.expression}`;
      if (l.result?.type === 'error') {
        return `${l.lineNumber}: ${l.expression} → 错误: ${l.result.error || l.result.displayValue}`;
      }
      return `${l.lineNumber}: ${l.expression} = ${l.result?.displayValue ?? ''}`;
    })
    .join('\n');

  // 错误行样本（额外强调）
  const errorSamples = lines
    .filter((l) => l.result?.type === 'error')
    .slice(-6)
    .map((l) => `  第${l.lineNumber}行: ${l.expression} → ${l.result?.error || l.result?.displayValue}`)
    .join('\n');

  let result = `最近计算（${recentLines.length} 行）：\n${linesText || '（空）'}`;
  if (errorSamples) {
    result += `\n\n错误行（节选）：\n${errorSamples}`;
  }
  return result;
}

/** 构建重要层：变量列表 + 统计摘要 */
function buildImportantLayer(sheet: CalculatorSheet): string {
  const normalizedVars = normalizeCalculatorVariables(
    sheet.variables as Record<string, unknown>,
  );
  const varEntries = Object.entries(normalizedVars);

  const varsText = varEntries
    .slice(0, 30) // 限制变量数量
    .map(([k, v]) => `${k} = ${v.value}`)
    .join(', ');

  const stats = {
    totalLines: (sheet.lines || []).length,
    errorCount: (sheet.lines || []).filter((l) => l.result?.type === 'error').length,
    variableCount: varEntries.length,
  };

  return `定义的变量（${stats.variableCount} 个）：${varsText || '（无）'}

统计：共 ${stats.totalLines} 行，${stats.errorCount} 个错误`;
}

/** 构建补充层：Sheet 名称等 */
function buildSupplementaryLayer(sheet: CalculatorSheet): string {
  return `当前 Sheet: ${sheet.name || '未命名'}`;
}

/**
 * 构建完整分层上下文
 */
export function buildCalculatorContext(
  sheet: CalculatorSheet,
  options?: BuildContextOptions,
): CalculatorContext {
  const phase = options?.phase ?? detectCalculatorPhase(sheet);

  return {
    critical: buildCriticalLayer(sheet),
    important: buildImportantLayer(sheet),
    supplementary: buildSupplementaryLayer(sheet),
    phase,
  };
}

/**
 * 将分层上下文合并为字符串（用于 AI 系统提示注入）
 */
export function formatContextForAI(ctx: CalculatorContext): string {
  return `当前计算上下文：

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
  options?: BuildContextOptions,
): string {
  const ctx = buildCalculatorContext(sheet, options);

  switch (ctx.phase) {
    case 'blank':
      return `当前计算上下文：

工作表为空，等待用户输入计算表达式。
`;
    case 'editing':
      return `当前计算上下文：

${ctx.critical}

${ctx.supplementary}
`;
    case 'has_errors':
      // 错误时优先显示错误信息
      return `当前计算上下文（有错误）：

${ctx.critical}

${ctx.important}

${ctx.supplementary}

⚠️ 注意：上述计算中有错误，请帮助用户排查并修正。
`;
    case 'data_ready':
    default:
      return formatContextForAI(ctx);
  }
}
