/**
 * CalculatorEngine — 计算引擎核心
 * 基于 math.js 实现表达式解析和计算
 * 集成 date-fns 日期计算和 financial 金融函数
 */
import { create, all } from 'mathjs';
import {
  DEFAULT_CALCULATOR_SETTINGS,
  type CalcResult,
  type CalculatorSettings,
  isNoteLine as expressionIsCalculatorNoteLine,
} from '../types';
import { isCalculatorBuiltinWord } from '../calculatorBuiltinWords';
import { normalizeCalculatorInput } from '../calculatorInputNormalize';
import { tryParseDateExpression } from './dateCalculator';
import {
  tryParseFinancial,
  executeFinancialFunction,
  formatCurrency,
  formatPercent,
  npv as npvFinancial,
  irr as irrFinancial,
  pmt as pmtFinancial,
  fv as fvFinancial,
  pv as pvFinancial,
  nper as nperFinancial,
  rate as rateFinancial,
  ipmt as ipmtFinancial,
  ppmt as ppmtFinancial,
  mirr as mirrFinancial,
  xnpv as xnpvFinancial,
  xirr as xirrFinancial,
} from './financialCalculator';
import {
  normsdist as normsdistFn,
  normsinv as normsinvFn,
  normdist as normdistFn,
  normSdist as normSdistFn,
  normspdf as normspdfFn,
  slope as slopeFn,
  intercept as interceptFn,
  rsq as rsqFn,
} from './statSpreadsheetFunctions';
import { registerSpreadsheetExcelAliases } from './spreadsheetExcelAliases';
import * as listFn from './listComputation';

// ============================================================
// math.js 配置
// ============================================================

const math = create(all, {
  number: 'number',
  precision: 64,
});

/** math.js 求值：标量转 number */
function mathToNumber(x: unknown): number {
  if (typeof x === 'number') return x;
  if (typeof x === 'boolean') return x ? 1 : 0;
  if (x && typeof x === 'object') {
    const o = x as { toNumber?: (u?: string) => number; re?: number };
    if (typeof o.toNumber === 'function') {
      try {
        return o.toNumber('SI');
      } catch {
        return Number.NaN;
      }
    }
    if (typeof o.re === 'number' && Number.isFinite(o.re)) return o.re;
  }
  const n = Number(x);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** math.js 矩阵 / 嵌套数组 → number[] */
function mathToNumberArray(x: unknown): number[] {
  if (x == null) return [];
  if (Array.isArray(x)) {
    return x.flat(10).map((v) => mathToNumber(v)).filter((n) => Number.isFinite(n));
  }
  if (typeof x === 'object') {
    const o = x as { toArray?: () => unknown; data?: unknown };
    if (typeof o.toArray === 'function') {
      return mathToNumberArray(o.toArray());
    }
    if (Array.isArray(o.data)) {
      return mathToNumberArray(o.data);
    }
  }
  return [];
}

/** 元素个数（标量/非序列返回 0） */
function sequenceElementCount(x: unknown): number {
  if (x == null) return 0;
  if (Array.isArray(x)) {
    return x.flat(Infinity).filter((v) => typeof v === 'number' && Number.isFinite(v)).length;
  }
  try {
    const s = math.size(x as never);
    const dims: number[] = [];
    if (Array.isArray(s)) {
      for (const d of s) dims.push(Number(d));
    } else if (s && typeof (s as { toArray?: () => unknown }).toArray === 'function') {
      const arr = (s as { toArray: () => unknown[] }).toArray();
      for (const d of arr) dims.push(Number(d));
    } else {
      dims.push(Number(s));
    }
    if (dims.length === 0) return 0;
    return dims.reduce((a, b) => a * b, 1);
  } catch {
    return 0;
  }
}

/** 是否为应存入变量的数列/矩阵（非单一标量），且不应参与「所有行」数值聚合 */
function isSequenceTensor(x: unknown): boolean {
  if (x == null || typeof x === 'boolean') return false;
  if (typeof x === 'number') return false;
  if (typeof x === 'bigint') return false;
  return sequenceElementCount(x) > 1;
}

/**
 * 兼容 npv(现金流, 折现率) 与 npv(折现率, 现金流)
 */
function npvMathJs(a: unknown, b: unknown): number {
  const arrA = mathToNumberArray(a);
  const arrB = mathToNumberArray(b);
  const numA = mathToNumber(a);
  const numB = mathToNumber(b);
  const aIsFlow = arrA.length >= 1;
  const bIsFlow = arrB.length >= 1;
  if (aIsFlow && !bIsFlow && Number.isFinite(numB)) {
    return npvFinancial(numB, arrA);
  }
  if (bIsFlow && !aIsFlow && Number.isFinite(numA)) {
    return npvFinancial(numA, arrB);
  }
  return Number.NaN;
}

// 中文数字单位映射
const CHINESE_UNITS: Record<string, number> = {
  '万': 1e4,
  '亿': 1e8,
  '兆': 1e12,
};

// 英文数字单位映射
const ENGLISH_UNITS: Record<string, number> = {
  'k': 1e3,
  'm': 1e6,
  'b': 1e9,
  't': 1e12,
};

/** 行范围求和最多展开行数（防止表达式爆炸） */
const MAX_LINE_REF_RANGE_SPAN = 200;

/**
 * 双引号内为「仅结果栏展示」的文本，不参与运算；如 10 "万" → 数值 10，显示 10 万
 */
function stripDoubleQuotedDisplayLiterals(input: string): { expr: string; quotedParts: string[] } {
  const quotedParts: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  const expr = input.replace(re, (_m, inner: string) => {
    quotedParts.push(inner.replace(/\\(.)/g, '$1'));
    return ' ';
  });
  const collapsed = expr.replace(/\s+/g, ' ').trim();
  return { expr: collapsed, quotedParts };
}

/**
 * 在变量/行结果作用域中求值（模块级，避免部分运行环境对 class private 方法原型链异常）
 */
function evaluateMathExpressionInScope(
  variables: Map<string, unknown>,
  lineResults: Map<number, number>,
  toInternalVarName: (name: string) => string,
  expr: string,
): unknown {
  const scope: Record<string, unknown> = {};

  variables.forEach((v, k) => {
    const internalName = /[\u4e00-\u9fa5]/.test(k) ? toInternalVarName(k) : k;
    scope[internalName] = v;
  });

  lineResults.forEach((v, k) => {
    scope[`__line_${k}__`] = v;
  });

  const compiled = math.compile(expr);
  return compiled.evaluate(scope);
}

// ============================================================
// 计算引擎类
// ============================================================

export class CalculatorEngine {
  /** 变量值：标量为 number，数列/矩阵为 math.js Matrix 或嵌套数组 */
  private variables: Map<string, unknown> = new Map();
  /** 变量最后一次被赋值时的行号 */
  private variableDefinitionLine: Map<string, number> = new Map();
  private lineResults: Map<number, number> = new Map();
  private displaySettings: CalculatorSettings = { ...DEFAULT_CALCULATOR_SETTINGS };

  constructor() {
    this.registerCustomFunctions();
  }

  /** 与文档设置同步（格式化小数位、地区、货币、日期显示） */
  setDisplaySettings(settings: CalculatorSettings): void {
    this.displaySettings = { ...DEFAULT_CALCULATOR_SETTINGS, ...settings };
  }

  /**
   * 在变量与行结果作用域中求值（实例入口，委托 evaluateMathExpressionInScope）。
   * 保留此方法名：避免旧构建或异常运行环境下出现 this.evaluateInScope is not a function。
   */
  private evaluateInScope(expr: string): unknown {
    return evaluateMathExpressionInScope(
      this.variables,
      this.lineResults,
      (name) => this.toInternalVarName(name),
      expr,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 公共 API
  // ═══════════════════════════════════════════════════════════

  /**
   * 计算单行表达式
   */
  evaluate(expression: string, lineNumber: number): CalcResult {
    try {
      // 0. 原始表达式（用于特殊解析）
      const original = normalizeCalculatorInput(expression);

      // 1. 检测是否为备注
      if (this.isNoteLine(original)) {
        return { type: 'string', value: original, displayValue: '' };
      }

      const { expr: coreExpr, quotedParts } = stripDoubleQuotedDisplayLiterals(original);

      // 2. 尝试日期计算（today + 2 weeks, 1月1日 to 12月31日）
      const dateResult = tryParseDateExpression(coreExpr, this.displaySettings.dateFormat, this.numberLocale());
      if (dateResult) {
        this.lineResults.set(
          lineNumber,
          dateResult.value instanceof Date ? dateResult.value.getTime() : (dateResult.value as number),
        );
        return {
          type: dateResult.type,
          value: dateResult.value,
          displayValue: this.appendQuotedDisplaySuffix(dateResult.displayValue, quotedParts),
        };
      }

      // 3. 预处理：识别自然语言语法
      const preprocessed = this.preprocessExpression(coreExpr, lineNumber);

      // 4. 变量赋值优先于金融字面量解析（避免 RHS 含列表/复杂式时被误伤）
      const varDef = this.detectVariableDefinition(preprocessed);
      if (varDef) {
        const raw = this.evaluateInScope(varDef.value);
        this.variables.set(varDef.name, raw);
        this.variableDefinitionLine.set(varDef.name, lineNumber);

        const scalarNum = mathToNumber(raw);
        if (Number.isFinite(scalarNum) && !isSequenceTensor(raw)) {
          this.lineResults.set(lineNumber, scalarNum);
        } else {
          this.lineResults.delete(lineNumber);
        }

        if (isSequenceTensor(raw)) {
          const n = sequenceElementCount(raw);
          return {
            type: 'matrix',
            value: raw,
            displayValue: this.appendQuotedDisplaySuffix(
              n > 0 ? `数列（${n} 项）` : '数列',
              quotedParts,
            ),
          };
        }

        return {
          type: 'number',
          value: scalarNum,
          displayValue: this.appendQuotedDisplaySuffix(
            this.formatScalarDisplay(scalarNum, 'number', varDef.value),
            quotedParts,
          ),
        };
      }

      // 5. 金融函数字面量（整行 npv/irr/pmt 等，无 = 赋值时）
      const financialMatch = tryParseFinancial(preprocessed);
      if (financialMatch) {
        const result = executeFinancialFunction(financialMatch.fn, financialMatch.args);
        this.lineResults.set(lineNumber, result);
        return {
          type: 'number',
          value: result,
          displayValue: this.appendQuotedDisplaySuffix(
            this.formatScalarDisplay(result, 'number', preprocessed),
            quotedParts,
          ),
        };
      }

      // 6. 空表达式
      if (!preprocessed.trim()) {
        return { type: 'string', value: '', displayValue: '' };
      }

      // 7. 执行计算
      const raw = this.evaluateInScope(preprocessed);

      // 矩阵/数列结果（如 [1,2,3]）
      if (isSequenceTensor(raw)) {
        const n = sequenceElementCount(raw);
        const scalarNum = mathToNumber(raw);
        if (Number.isFinite(scalarNum)) {
          this.lineResults.set(lineNumber, scalarNum);
        } else {
          this.lineResults.delete(lineNumber);
        }
        return {
          type: 'matrix',
          value: raw,
          displayValue: this.appendQuotedDisplaySuffix(
            n > 0 ? `数列（${n} 项）` : '数列',
            quotedParts,
          ),
        };
      }

      const result = mathToNumber(raw);
      if (Number.isFinite(result)) {
        this.lineResults.set(lineNumber, result);
      } else {
        this.lineResults.delete(lineNumber);
      }

      // 检测结果类型
      const resultType = this.detectResultType(result, original);

      return {
        type: resultType,
        value: result,
        displayValue: this.appendQuotedDisplaySuffix(
          this.formatScalarDisplay(result, resultType, original),
          quotedParts,
        ),
      };
    } catch (err) {
      return {
        type: 'error',
        value: null,
        displayValue: '',
        error: err instanceof Error ? err.message : '计算错误',
      };
    }
  }

  /**
   * 检测结果类型
   */
  private detectResultType(_result: number, original: string): 'number' | 'percent' | 'currency' {
    const hasCurrency = original.includes('$') || original.includes('¥') || original.includes('€') ||
        original.includes('£') || original.includes('₩') ||
        original.includes('元') || original.includes('美元') || original.includes('欧元') ||
        original.includes('日元') || original.includes('英镑') || original.includes('港元') || original.includes('港币') ||
        original.includes('韩元') || original.includes('卢布') || original.includes('澳元');
    const hasPercent = original.includes('%') || original.includes('percent') || original.includes('百分比');
    // 含货币符号时优先视为货币（如 $50 - 20%），纯百分比标记（50%）才返回 percent
    if (hasCurrency && hasPercent) return 'currency';
    if (hasPercent) return 'percent';
    if (hasCurrency) return 'currency';
    return 'number';
  }

  /**
   * 获取所有变量（仅标量，用于持久化到文档；数列变量由表达式重算恢复）
   */
  getVariables(): Record<string, number> {
    const out: Record<string, number> = {};
    this.variables.forEach((v, k) => {
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[k] = v;
      }
    });
    return out;
  }

  /** 各变量最后一次定义所在行号（与 getVariables 键一致） */
  getVariableDefinitionLines(): Record<string, number> {
    return Object.fromEntries(this.variableDefinitionLine);
  }

  /**
   * 从表达式提取定义变量名、行引用类依赖（用于文档元数据与 AI 上下文）
   */
  extractLineSemantics(
    expression: string,
    lineNumber: number,
  ): { definedVariables: string[]; dependencies: string[] } {
    const original = normalizeCalculatorInput(expression);
    if (this.isNoteLine(original)) {
      return { definedVariables: [], dependencies: [] };
    }
    const { expr: coreExpr } = stripDoubleQuotedDisplayLiterals(original);
    const preprocessed = this.preprocessExpression(coreExpr, lineNumber);
    const definedVariables: string[] = [];
    // 对原始表达式（非预处理后）检测变量定义，以获取用户书写的原始变量名
    const vd = this.detectVariableDefinition(coreExpr);
    if (vd) definedVariables.push(vd.name);

    const dependencies: string[] = [];
    if (
      /(?<![\u4e00-\u9fa5a-zA-Z0-9_])所有行(?![\u4e00-\u9fa5a-zA-Z0-9_])/.test(coreExpr) ||
      /\ball lines\b/i.test(coreExpr)
    ) {
      dependencies.push('__all_lines__');
    }
    const sumRangeMatch = coreExpr.match(
      /(?:sum\s+(?:of\s+)?lines?|合计)\s*[\(（]?\s*(\d+)\s*[-到~]\s*(\d+)\s*[\)）]?/i,
    );
    if (sumRangeMatch) {
      const a = parseInt(sumRangeMatch[1], 10);
      const b = parseInt(sumRangeMatch[2], 10);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const span = hi - lo + 1;
      if (lo >= 1 && span <= MAX_LINE_REF_RANGE_SPAN) {
        for (let i = lo; i <= hi; i++) dependencies.push(`line:${i}`);
      }
    }
    const enLineRe = /(?<![a-zA-Z])line\s+(\d+)/gi;
    let m: RegExpExecArray | null;
    while ((m = enLineRe.exec(coreExpr)) !== null) {
      dependencies.push(`line:${m[1]}`);
    }
    const zhLineRe = /第(\d+)(?:行)?/g;
    while ((m = zhLineRe.exec(coreExpr)) !== null) {
      dependencies.push(`line:${m[1]}`);
    }

    if (
      lineNumber > 1 &&
      (/(?<![\u4e00-\u9fa5a-zA-Z0-9_])上一行(?![\u4e00-\u9fa5a-zA-Z0-9_])/.test(coreExpr) ||
        /(?<![a-zA-Z])above\b(?![a-zA-Z])/i.test(coreExpr) ||
        /(?<![a-zA-Z])prev\b(?![a-zA-Z])/i.test(coreExpr))
    ) {
      dependencies.push(`line:${lineNumber - 1}`);
    }

    return { definedVariables, dependencies: [...new Set(dependencies)] };
  }

  /**
   * 清除所有变量
   */
  clearVariables(): void {
    this.variables.clear();
    this.variableDefinitionLine.clear();
    this.lineResults.clear();
  }

  /**
   * 获取指定行的结果
   */
  getLineResult(lineNumber: number): number | undefined {
    return this.lineResults.get(lineNumber);
  }

  // ═══════════════════════════════════════════════════════════
  // 预处理层：自然语言语法转换
  // ═══════════════════════════════════════════════════════════

  /**
   * 预处理表达式
   */
  private preprocessExpression(text: string, lineNumber: number): string {
    let expr = text.trim();

    // 0. 剥离货币符号（仅用于结果类型检测，不参与运算）
    expr = expr.replace(/[$¥€£₩]/g, '');

    // 0.5 剥离中文货币词（元、美元、欧元等），仅当不作为已定义变量名时
    const currencyWords = ['美元', '欧元', '日元', '英镑', '港元', '港币', '韩元', '卢布', '澳元', '加元', '法郎'];
    for (const cw of currencyWords) {
      if (!this.variables.has(cw)) {
        expr = expr.replace(new RegExp(cw, 'g'), '');
      }
    }

    // 1. 中文变量名转换（最先执行）
    expr = this.transformVariableNames(expr);

    // 2. 数字简写：25k → 25000, 1.5万 → 15000
    expr = this.transformNumberUnits(expr);

    // 3. 百分比计算：50 - 20% → 50 * (1 - 0.20)
    expr = this.transformPercentages(expr);

    // 4. 行引用：所有行 / all lines / line 1 / 第1行 / 区间合计
    expr = this.transformLineReferences(expr, lineNumber);

    // 5. 单位转换：10km in miles
    expr = this.transformUnitConversions(expr);

    // 6. 中文函数别名
    expr = this.transformChineseFunctions(expr);

    // 7. 比例计算：10 : 20 = 50 : x
    expr = this.transformProportions(expr);

    // 8. 进制转换：0xFF to binary, 1010b to hex, 0o77 to decimal
    expr = this.transformBaseConversions(expr);

    return expr;
  }

  /**
   * 转换进制计算
   * 支持：0xFF, 0b1010, 0o77, FFh, 1010b
   */
  private transformBaseConversions(expr: string): string {
    // 0xFF to binary / 0xFF 转二进制
    const hexToBinary = expr.match(/0x([0-9a-fA-F]+)\s*(?:to|转|转换为?)\s*(?:binary|二进制)/i);
    if (hexToBinary) {
      const decimal = parseInt(hexToBinary[1], 16);
      return expr.replace(hexToBinary[0], `"0b${decimal.toString(2)}"`);
    }

    // 0b1010 to hex / 0b1010 转十六进制
    const binaryToHex = expr.match(/0b([01]+)\s*(?:to|转|转换为?)\s*(?:hex|hexadecimal|十六进制)/i);
    if (binaryToHex) {
      const decimal = parseInt(binaryToHex[1], 2);
      return expr.replace(binaryToHex[0], `"0x${decimal.toString(16).toUpperCase()}"`);
    }

    // 0o77 to hex / 0o77 转十六进制
    const octalToHex = expr.match(/0o([0-7]+)\s*(?:to|转|转换为?)\s*(?:hex|hexadecimal|十六进制)/i);
    if (octalToHex) {
      const decimal = parseInt(octalToHex[1], 8);
      return expr.replace(octalToHex[0], `"0x${decimal.toString(16).toUpperCase()}"`);
    }

    // FFh to decimal (带后缀的十六进制)
    expr = expr.replace(/([0-9a-fA-F]+)h\b/g, (_, hex) => {
      return `0x${hex}`;
    });

    // 1010b to decimal (带后缀的二进制，但要避免与数学变量冲突)
    expr = expr.replace(/\b([01]+)b\b/g, (_, bin) => {
      // 只有纯 0/1 且长度 > 1 才认为是二进制
      if (bin.length > 1 && /^[01]+$/.test(bin)) {
        return `0b${bin}`;
      }
      return `${bin}b`;
    });

    return expr;
  }

  /**
   * 转换中文变量名为内部变量名
   * 市场 → __v__u24066__u22330__u__
   */
  private transformVariableNames(expr: string): string {
    // 替换所有已定义的中文变量名
    // 按变量名长度降序排序，避免短变量名先被替换导致长变量名无法匹配
    const sortedNames = Array.from(this.variables.keys()).sort((a, b) => b.length - a.length);

    for (const name of sortedNames) {
      if (/[\u4e00-\u9fa5]/.test(name)) {
        const internalName = this.toInternalVarName(name);
        const escapedName = this.escapeRegex(name);
        const regex = new RegExp(escapedName, 'g');
        expr = expr.replace(regex, internalName);
      }
    }

    return expr;
  }

  /**
   * 转换为内部变量名（中文变量名 → 英文内部名）
   */
  private toInternalVarName(name: string): string {
    // 使用简单编码：将每个字符转为 unicode 数字
    const encoded = Array.from(name)
      .map(c => `_u${c.charCodeAt(0)}_`)
      .join('');
    return `__v${encoded}__`;
  }

  /**
   * 转义正则特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 转换数字单位（k/m/b/万/亿）
   */
  private transformNumberUnits(expr: string): string {
    // 中文单位：1.5万, 2亿
    for (const [unit, multiplier] of Object.entries(CHINESE_UNITS)) {
      const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, 'g');
      expr = expr.replace(regex, (_, n) => `${Number(n) * multiplier}`);
    }

    // 英文单位：25k, 1.5m, 2b
    for (const [unit, multiplier] of Object.entries(ENGLISH_UNITS)) {
      const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}\\b`, 'gi');
      expr = expr.replace(regex, (_, n) => `${Number(n) * multiplier}`);
    }

    return expr;
  }

  /**
   * 转换百分比表达式
   */
  private transformPercentages(expr: string): string {
    // 100 打8折 → 100 * 0.8
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*打(\d+(?:\.\d+)?)\s*折/g, (_, base, discount) => {
      return `${base} * ${Number(discount) / 10}`;
    });

    // 30 as % of 200 → 30 / 200 * 100
    expr = expr.replace(/(\d+(?:\.\d+)?)\s+as\s+%\s+of\s+(\d+(?:\.\d+)?)/gi, '($1 / $2 * 100)');

    // 15% of $200 → 0.15 * 200
    expr = expr.replace(/(\d+(?:\.\d+)?)%\s+of\s+(\d+(?:\.\d+)?)/gi, '($1 / 100 * $2)');

    // $50 + 10% → $50 * 1.10
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*%/g, '($1 * (1 + $2 / 100))');

    // $50 - 20% → $50 * 0.80
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*%/g, '($1 * (1 - $2 / 100))');

    // 纯百分比：50% → 0.5
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1 / 100)');

    return expr;
  }

  /**
   * 当前行之前已有数值结果展开为 math.js 数组字面量（供 sum/mean 等使用）
   */
  private buildAllLinesArrayLiteral(lineNumber: number): string {
    const sorted = [...this.lineResults.entries()]
      .filter(([ln, v]) => ln < lineNumber && Number.isFinite(v))
      .sort((a, b) => a[0] - b[0])
      .map(([ln]) => `__line_${ln}__`);
    let refs = sorted;
    if (refs.length > MAX_LINE_REF_RANGE_SPAN) {
      refs = refs.slice(-MAX_LINE_REF_RANGE_SPAN);
    }
    return `[${refs.join(', ')}]`;
  }

  /**
   * 转换行引用
   */
  private transformLineReferences(expr: string, lineNumber: number): string {
    const allLinesLiteral = this.buildAllLinesArrayLiteral(lineNumber);
    expr = expr.replace(
      /(?<![\u4e00-\u9fa5a-zA-Z0-9_])所有行(?![\u4e00-\u9fa5a-zA-Z0-9_])/g,
      allLinesLiteral,
    );
    expr = expr.replace(/\ball lines\b/gi, allLinesLiteral);

    // sum of lines 1-5 / 合计(第1到5行)
    const sumRangeMatch = expr.match(/(?:sum\s+(?:of\s+)?lines?|合计)\s*[\(（]?\s*(\d+)\s*[-到~]\s*(\d+)\s*[\)）]?/i);
    if (sumRangeMatch) {
      const start = parseInt(sumRangeMatch[1], 10);
      const end = parseInt(sumRangeMatch[2], 10);
      const span = end - start + 1;
      if (start >= 1 && end >= start && span <= MAX_LINE_REF_RANGE_SPAN) {
        const refs: string[] = [];
        for (let i = start; i <= end; i++) {
          refs.push(`__line_${i}__`);
        }
        expr = expr.replace(sumRangeMatch[0], `(${refs.join(' + ')})`);
      }
    }

    // line 1 / Line 2（要求 line 前非字母，避免 airline 12 误匹配为 line 12）
    expr = expr.replace(/(?<![a-zA-Z])line\s+(\d+)/gi, (_, n) => `__line_${n}__`);
    // 第1行 / 第3（要求后面是运算符、标点或行尾，避免匹配"第3季度"等）
    expr = expr.replace(/第(\d+)(?:行)?(?=[\s\+\-\*\/\(\)\[\],;:：，。）\】]|$)/g, (_, n) => `__line_${n}__`);

    // 上一行 / above / prev（Soulver 类「上一答案」引用）
    const prevLn = lineNumber - 1;
    if (prevLn >= 1) {
      expr = expr.replace(
        /(?<![\u4e00-\u9fa5a-zA-Z0-9_])上一行(?![\u4e00-\u9fa5a-zA-Z0-9_])/g,
        `__line_${prevLn}__`,
      );
      expr = expr.replace(/(?<![a-zA-Z])above\b(?![a-zA-Z])/gi, `__line_${prevLn}__`);
      expr = expr.replace(/(?<![a-zA-Z])prev\b(?![a-zA-Z])/gi, `__line_${prevLn}__`);
    }

    return expr;
  }

  /**
   * 转换单位转换
   */
  private transformUnitConversions(expr: string): string {
    // 10km in miles / 10公里换算英里
    const unitMatch = expr.match(/(\d+(?:\.\d+)?)\s*(\w+)\s+(?:in|to|换算)\s+(\w+)/i);
    if (unitMatch) {
      const [, value, fromUnit, toUnit] = unitMatch;
      // 使用 math.js 内置单位
      try {
        const result = math.evaluate(`${value} ${fromUnit} to ${toUnit}`);
        const num = typeof result === 'number' ? result : mathToNumber(result);
        if (Number.isFinite(num)) return String(num);
        return expr;
      } catch {
        // 如果单位不识别，保持原样
        return expr;
      }
    }
    return expr;
  }

  /**
   * 转换中文函数别名
   */
  private transformChineseFunctions(expr: string): string {
    const aliases: [string, string][] = [
      ['最小值', 'min'],
      ['最大值', 'max'],
      ['标准差', 'std'],
      ['方差', 'variance'],
      ['绝对值', 'abs'],
      ['平方根', 'sqrt'],
      ['求和', 'sum'],
      ['均值', 'mean'],
      ['合计', 'sum'],
      ['平均', 'mean'],
      ['开方', 'sqrt'],
    ];
    // 仅替换「中文函数名(」形式，避免把变量名如 均值、最大值M、合计 等整词误替换
    const before = '(?<![\\u4e00-\\u9fa5a-zA-Z0-9_])';
    for (const [cn, en] of aliases) {
      const re = new RegExp(`${before}${this.escapeRegex(cn)}\\s*\\(`, 'g');
      expr = expr.replace(re, `${en}(`);
    }
    return expr;
  }

  /**
   * 转换比例计算
   */
  private transformProportions(expr: string): string {
    // 10 : 20 = 50 : x → 50 * 20 / 10
    const match = expr.match(/(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)\s*[:：]\s*(?:x|y|X|Y|\?)\s*/i);
    if (match) {
      const [_, a, b, c] = match;
      return `(${c} * ${b} / ${a})`;
    }
    return expr;
  }

  // ═══════════════════════════════════════════════════════════
  // 变量定义检测
  // ═══════════════════════════════════════════════════════════

  /**
   * 检测变量定义
   */
  private detectVariableDefinition(expr: string): { name: string; value: string } | null {
    // let x = 100
    const letMatch = expr.match(/^let\s+([a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*)\s*=\s*(.+)$/i);
    if (letMatch && !isCalculatorBuiltinWord(letMatch[1])) {
      return { name: letMatch[1], value: letMatch[2] };
    }

    // x = 100 / 总价 = 500
    const assignMatch = expr.match(/^([a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*)\s*=\s*(.+)$/);
    if (assignMatch && !isCalculatorBuiltinWord(assignMatch[1])) {
      return { name: assignMatch[1], value: assignMatch[2] };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // 表达式执行
  // ═══════════════════════════════════════════════════════════

  /**
   * 执行表达式，结果为标量 number
   */
  private evaluateExpression(expr: string): number {
    const result = this.evaluateInScope(expr);

    if (result && typeof result === 'object' && (result as { toNumber?: (u?: string) => number }).toNumber) {
      try {
        return (result as { toNumber: (u?: string) => number }).toNumber('SI');
      } catch {
        return Number.NaN;
      }
    }

    return mathToNumber(result);
  }

  // ═══════════════════════════════════════════════════════════
  // 工具方法
  // ═══════════════════════════════════════════════════════════

  /** 将双引号中的展示片段接到数值格式化结果后（空格分隔） */
  private appendQuotedDisplaySuffix(display: string, parts: string[]): string {
    if (!parts.length) return display;
    const tail = parts.join(' ');
    if (!tail) return display;
    return `${display} ${tail}`;
  }

  private numberLocale(): string {
    return this.displaySettings.numberFormat === 'chinese' ? 'zh-CN' : 'en-US';
  }

  /**
   * 标量结果展示（小数位、千分位、货币、百分比）
   */
  private formatScalarDisplay(
    n: number,
    resultType: 'number' | 'percent' | 'currency',
    _originalExpr: string
  ): string {
    if (!Number.isFinite(n)) {
      return '—';
    }
    const decimals = this.displaySettings.decimalPlaces;
    const loc = this.numberLocale();

    if (resultType === 'currency') {
      return formatCurrency(n, this.displaySettings.defaultCurrency);
    }
    if (resultType === 'percent') {
      return formatPercent(n, decimals);
    }
    if (Number.isInteger(n)) {
      return n.toLocaleString(loc);
    }
    return n.toLocaleString(loc, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }

  /**
   * 检测是否为备注行
   */
  private isNoteLine(text: string): boolean {
    return expressionIsCalculatorNoteLine(text);
  }

  /**
   * 注册自定义函数（金融函数需参与含变量/表达式的求值，不能仅靠字面量 tryParseFinancial）
   */
  private registerCustomFunctions(): void {
    math.import(
      {
        pmt: (rate: unknown, nper: unknown, pv: unknown, fv?: unknown, type?: unknown) =>
          pmtFinancial(
            mathToNumber(rate),
            mathToNumber(nper),
            mathToNumber(pv),
            fv !== undefined ? mathToNumber(fv) : 0,
            type !== undefined ? mathToNumber(type) : 0,
          ),
        fv: (rate: unknown, nper: unknown, pmtVal: unknown, pv?: unknown, type?: unknown) =>
          fvFinancial(
            mathToNumber(rate),
            mathToNumber(nper),
            mathToNumber(pmtVal),
            pv !== undefined ? mathToNumber(pv) : 0,
            type !== undefined ? mathToNumber(type) : 0,
          ),
        pv: (rate: unknown, nper: unknown, pmtVal: unknown, fv?: unknown, type?: unknown) =>
          pvFinancial(
            mathToNumber(rate),
            mathToNumber(nper),
            mathToNumber(pmtVal),
            fv !== undefined ? mathToNumber(fv) : 0,
            type !== undefined ? mathToNumber(type) : 0,
          ),
        npv: npvMathJs,
        irr: (cashFlows: unknown) => irrFinancial(mathToNumberArray(cashFlows)),
        nper: (rate: unknown, pmtVal: unknown, pv: unknown, fv?: unknown, type?: unknown) =>
          nperFinancial(
            mathToNumber(rate),
            mathToNumber(pmtVal),
            mathToNumber(pv),
            fv !== undefined ? mathToNumber(fv) : 0,
            type !== undefined ? mathToNumber(type) : 0,
          ),
        rate: (
          nper: unknown,
          pmtVal: unknown,
          pv: unknown,
          fv?: unknown,
          type?: unknown,
          guess?: unknown,
          tol?: unknown,
          maxIter?: unknown,
        ) =>
          rateFinancial(
            mathToNumber(nper),
            mathToNumber(pmtVal),
            mathToNumber(pv),
            fv !== undefined ? mathToNumber(fv) : 0,
            type !== undefined ? mathToNumber(type) : 0,
            guess !== undefined ? mathToNumber(guess) : undefined,
            tol !== undefined ? mathToNumber(tol) : undefined,
            maxIter !== undefined ? mathToNumber(maxIter) : undefined,
          ),
        ipmt: (rate: unknown, per: unknown, nper: unknown, pv: unknown, fv?: unknown, type?: unknown) =>
          ipmtFinancial(
            mathToNumber(rate),
            mathToNumber(per),
            mathToNumber(nper),
            mathToNumber(pv),
            fv !== undefined ? mathToNumber(fv) : 0,
            type !== undefined ? mathToNumber(type) : 0,
          ),
        ppmt: (rate: unknown, per: unknown, nper: unknown, pv: unknown, fv?: unknown, type?: unknown) =>
          ppmtFinancial(
            mathToNumber(rate),
            mathToNumber(per),
            mathToNumber(nper),
            mathToNumber(pv),
            fv !== undefined ? mathToNumber(fv) : 0,
            type !== undefined ? mathToNumber(type) : 0,
          ),
        mirr: (values: unknown, financeRate: unknown, reinvestRate: unknown) =>
          mirrFinancial(
            mathToNumberArray(values),
            mathToNumber(financeRate),
            mathToNumber(reinvestRate),
          ),
        xnpv: (rate: unknown, values: unknown, dates: unknown) =>
          xnpvFinancial(
            mathToNumber(rate),
            mathToNumberArray(values),
            mathToNumberArray(dates),
          ),
        xirr: (values: unknown, dates: unknown, guess?: unknown) =>
          xirrFinancial(
            mathToNumberArray(values),
            mathToNumberArray(dates),
            guess !== undefined ? mathToNumber(guess) : 0.1,
          ),
        normsdist: (z: unknown) => normsdistFn(mathToNumber(z)),
        normsinv: (p: unknown) => normsinvFn(mathToNumber(p)),
        normdist: (x: unknown, mean: unknown, sd: unknown, cum: unknown) =>
          normdistFn(
            mathToNumber(x),
            mathToNumber(mean),
            mathToNumber(sd),
            mathToNumber(cum),
          ),
        normSdist: (z: unknown, cum?: unknown) =>
          normSdistFn(mathToNumber(z), cum !== undefined ? mathToNumber(cum) : 1),
        normspdf: (z: unknown) => normspdfFn(mathToNumber(z)),
        slope: (knownY: unknown, knownX: unknown) =>
          slopeFn(mathToNumberArray(knownY), mathToNumberArray(knownX)),
        intercept: (knownY: unknown, knownX: unknown) =>
          interceptFn(mathToNumberArray(knownY), mathToNumberArray(knownX)),
        rsq: (knownY: unknown, knownX: unknown) =>
          rsqFn(mathToNumberArray(knownY), mathToNumberArray(knownX)),
        listLen: (a: unknown) => listFn.listLen(listFn.clampList(mathToNumberArray(a))),
        listAt: (a: unknown, i: unknown) =>
          listFn.listAt(listFn.clampList(mathToNumberArray(a)), mathToNumber(i)),
        listSlice: (a: unknown, start: unknown, end: unknown) =>
          listFn.listSlice(
            listFn.clampList(mathToNumberArray(a)),
            mathToNumber(start),
            mathToNumber(end),
          ),
        listConcat: (...args: unknown[]) =>
          listFn.listConcat(args.map((x) => listFn.clampList(mathToNumberArray(x)))),
        listReverse: (a: unknown) => listFn.listReverse(listFn.clampList(mathToNumberArray(a))),
        listDiff: (a: unknown) => listFn.listDiff(listFn.clampList(mathToNumberArray(a))),
        listCumprod: (a: unknown) => listFn.listCumprod(listFn.clampList(mathToNumberArray(a))),
        listCumsum: (a: unknown) => math.cumsum(listFn.clampList(mathToNumberArray(a))) as unknown,
        listSort: (a: unknown) => listFn.listSort(listFn.clampList(mathToNumberArray(a))),
        listRank: (a: unknown) => listFn.listRank(listFn.clampList(mathToNumberArray(a))),
        listUnique: (a: unknown) => listFn.listUnique(listFn.clampList(mathToNumberArray(a))),
        listIndexOf: (value: unknown, keys: unknown) =>
          listFn.listIndexOf(mathToNumber(value), listFn.clampList(mathToNumberArray(keys))),
        listLookup: (value: unknown, keys: unknown, values: unknown) =>
          listFn.listLookup(
            mathToNumber(value),
            listFn.clampList(mathToNumberArray(keys)),
            listFn.clampList(mathToNumberArray(values)),
          ),
        rollMean: (a: unknown, window: unknown) =>
          listFn.rollMean(listFn.clampList(mathToNumberArray(a)), mathToNumber(window)),
        rollSum: (a: unknown, window: unknown) =>
          listFn.rollSum(listFn.clampList(mathToNumberArray(a)), mathToNumber(window)),
        listFill: (n: unknown, value: unknown) =>
          listFn.listFill(mathToNumber(n), mathToNumber(value)),
        listRange: (start: unknown, end: unknown, step?: unknown) =>
          listFn.listRange(
            mathToNumber(start),
            mathToNumber(end),
            step !== undefined ? mathToNumber(step) : 1,
          ),
        listQuantile: (a: unknown, p: unknown) =>
          listFn.listQuantile(listFn.clampList(mathToNumberArray(a)), mathToNumber(p)),
        listArgSort: (a: unknown) => listFn.listArgSort(listFn.clampList(mathToNumberArray(a))),
        listMean: (a: unknown) => listFn.listMean(listFn.clampList(mathToNumberArray(a))),
      },
      { override: true, silent: true },
    );
    registerSpreadsheetExcelAliases(math, mathToNumber, mathToNumberArray);
  }
}

// ============================================================
// 工厂函数
// ============================================================

export function createCalculatorEngine(): CalculatorEngine {
  return new CalculatorEngine();
}
