/**
 * 计算文档 — 整表求值与分段小计（Soulver 风格）
 * 纯函数便于单测；与 CalculatorEngine 单行求值配合使用。
 */
import type { CalcResult, CalculatorLine, CalculatorLineRole, CalculatorHashBehavior } from './types';
import { inferLineRole } from './types';

export type EvaluateNormalLineFn = (expression: string, lineNumber: number) => CalcResult;
export type ExtractSemanticsFn = (
  expression: string,
  lineNumber: number,
) => { definedVariables: string[]; dependencies: string[] };

export interface ComputeSheetLinesOptions {
  hashBehavior: CalculatorHashBehavior;
  evaluateNormalLine: EvaluateNormalLineFn;
  extractSemantics: ExtractSemanticsFn;
  formatSubtotalDisplay: (sum: number) => string;
  nowIso: () => string;
}

/**
 * 解析后的行角色：以表达式为准，便于与编辑器状态一致
 */
export function resolveLineRole(
  line: CalculatorLine,
  hashBehavior: CalculatorHashBehavior,
): CalculatorLineRole {
  return inferLineRole(line.expression, hashBehavior);
}

/**
 * 对「普通」行在上一小计/标题之后到当前下标之前的已产出结果求和
 */
export function sumSectionNumericResults(
  built: CalculatorLine[],
  sectionBoundaryIndex: number,
  untilExclusive: number,
): number {
  let sum = 0;
  for (let j = sectionBoundaryIndex + 1; j < untilExclusive; j++) {
    const prev = built[j];
    if (!prev || prev.lineRole !== 'normal') continue;
    // 接受所有含数值 value 的类型（number/percent/currency/date/duration）
    if (prev.result.type !== 'number' && prev.result.type !== 'percent'
      && prev.result.type !== 'currency' && prev.result.type !== 'date'
      && prev.result.type !== 'duration') continue;
    const v = prev.result.value;
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v;
    }
  }
  return sum;
}

/**
 * 顺序求值：标题/注释跳过引擎；小计聚合段内 normal 数值行；普通行走引擎。
 */
export function computeSheetLinesSequential(
  lines: CalculatorLine[],
  options: ComputeSheetLinesOptions,
): CalculatorLine[] {
  const {
    hashBehavior,
    evaluateNormalLine,
    extractSemantics,
    formatSubtotalDisplay,
    nowIso,
  } = options;

  const built: CalculatorLine[] = [];
  let sectionBoundaryIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const lineRole = resolveLineRole(raw, hashBehavior);
    const isNote = lineRole === 'heading' || lineRole === 'comment';
    const lineNumber = i + 1;

    if (lineRole === 'heading' || lineRole === 'comment') {
      built.push({
        ...raw,
        lineNumber,
        lineRole,
        isNote,
        result: {
          type: 'string',
          value: raw.expression,
          displayValue: '',
        },
        definedVariables: [],
        dependencies: [],
        computedAt: nowIso(),
      });
      if (lineRole === 'heading') {
        sectionBoundaryIndex = i;
      }
      continue;
    }

    if (lineRole === 'subtotal') {
      const total = sumSectionNumericResults(built, sectionBoundaryIndex, i);
      built.push({
        ...raw,
        lineNumber,
        lineRole,
        isNote: false,
        result: {
          type: 'number',
          value: total,
          displayValue: formatSubtotalDisplay(total),
        },
        definedVariables: [],
        dependencies: ['__section_total__'],
        computedAt: nowIso(),
      });
      sectionBoundaryIndex = i;
      continue;
    }

    const result = evaluateNormalLine(raw.expression, lineNumber);
    const sem = extractSemantics(raw.expression, lineNumber);
    built.push({
      ...raw,
      lineNumber,
      lineRole: 'normal',
      isNote: false,
      result,
      definedVariables: sem.definedVariables,
      dependencies: sem.dependencies,
      computedAt: nowIso(),
    });
  }

  return built;
}
