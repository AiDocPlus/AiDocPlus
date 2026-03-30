/**
 * 计算文档类型 - 数据模型定义
 * 复刻 Soulver 核心体验，增强计算能力
 */

// ============================================================
// 计算结果类型
// ============================================================

/** 计算结果类型枚举 */
export type CalcResultType =
  | 'number'      // 数值
  | 'percent'     // 百分比
  | 'currency'    // 货币
  | 'date'        // 日期
  | 'duration'    // 时长
  | 'matrix'      // 矩阵
  | 'complex'     // 复数
  | 'string'      // 字符串（备注）
  | 'error';      // 错误

/** 计算结果 */
export interface CalcResult {
  /** 结果类型 */
  type: CalcResultType;
  /** 原始值（number | string | object） */
  value: unknown;
  /** 格式化显示文本 */
  displayValue: string;
  /** 单位（如 km, USD, °C） */
  unit?: string;
  /** 错误信息（type === 'error' 时） */
  error?: string;
}

// ============================================================
// 单行数据
// ============================================================

/** 行语义角色（Soulver 风格：标题分段、小计、注释） */
export type CalculatorLineRole = 'normal' | 'heading' | 'comment' | 'subtotal';

/** `#` 行解释：legacy 与 // 同为注释；soulver 时 # 为标题并参与分段小计 */
export type CalculatorHashBehavior = 'legacy' | 'soulver';

const LINE_ROLES = new Set<CalculatorLineRole>(['normal', 'heading', 'comment', 'subtotal']);

function isStoredLineRole(raw: unknown): raw is CalculatorLineRole {
  return typeof raw === 'string' && LINE_ROLES.has(raw as CalculatorLineRole);
}

/** 小计关键字（整行匹配，忽略首尾空白） */
const SUBTOTAL_LINE_RE = /^(小计|分计|subtotal|SUBTOTAL)$/i;

/**
 * 由表达式与 # 行为推断行角色（无磁盘上的 lineRole 时使用）
 */
export function inferLineRole(
  expression: string,
  hashBehavior: CalculatorHashBehavior = 'legacy',
): CalculatorLineRole {
  const t = expression.trim();
  if (SUBTOTAL_LINE_RE.test(t)) return 'subtotal';
  const start = expression.trimStart();
  if (start.startsWith('//') || start.startsWith('@') || start.startsWith('/*')) {
    return 'comment';
  }
  if (start.startsWith('#')) {
    return hashBehavior === 'soulver' ? 'heading' : 'comment';
  }
  return 'normal';
}

/** 标题/注释：不调用数学求值 */
export function lineRoleSkipsEngineEvaluate(role: CalculatorLineRole): boolean {
  return role === 'heading' || role === 'comment';
}

/** 根据表达式与 # 行为刷新行的 lineRole / isNote（编辑时调用） */
export function syncCalculatorLineMeta(
  line: CalculatorLine,
  hashBehavior: CalculatorHashBehavior,
): CalculatorLine {
  const lineRole = inferLineRole(line.expression, hashBehavior);
  const isNote = lineRole === 'heading' || lineRole === 'comment';
  return { ...line, lineRole, isNote };
}

/** 单行计算数据 */
export interface CalculatorLine {
  /** 唯一标识 */
  id: string;
  /** 行号（从 1 开始） */
  lineNumber: number;
  /** 原始表达式文本 */
  expression: string;
  /** 计算结果 */
  result: CalcResult;
  /** 该行定义的变量名列表 */
  definedVariables: string[];
  /** 该行依赖的变量名或行引用 */
  dependencies: string[];
  /**
   * 行语义角色
   */
  lineRole: CalculatorLineRole;
  /**
   * 是否为「备注型」行（标题或注释）：不显示数值结果栏样式、不参与普通求值
   */
  isNote: boolean;
  /** 最后计算时间 */
  computedAt?: string;
}

// ============================================================
// 变量
// ============================================================

/** 变量定义 */
export interface CalculatorVariable {
  /** 变量名 */
  name: string;
  /** 当前值 */
  value: number | string;
  /** 定义该变量的行号 */
  sourceLine: number;
  /** 值类型 */
  type: 'number' | 'string' | 'matrix' | 'complex';
}

/**
 * 将引擎导出的变量表（name -> number）转为文档中的 CalculatorVariable 记录。
 */
export function sheetVariablesFromEngine(
  map: Record<string, number>,
  definitionLines?: Record<string, number>,
): Record<string, CalculatorVariable> {
  const out: Record<string, CalculatorVariable> = {};
  for (const [name, num] of Object.entries(map)) {
    if (typeof num === 'number' && Number.isFinite(num)) {
      const sl = definitionLines?.[name];
      const sourceLine =
        typeof sl === 'number' && Number.isFinite(sl) && sl >= 1 ? Math.floor(sl) : 0;
      out[name] = { name, value: num, sourceLine, type: 'number' };
    }
  }
  return out;
}

/**
 * 规范化从磁盘或旧版本写入的 variables：支持纯数字映射、完整 CalculatorVariable、过滤 null。
 */
export function normalizeCalculatorVariables(
  raw: Record<string, unknown> | undefined | null,
): Record<string, CalculatorVariable> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, CalculatorVariable> = {};
  for (const [name, entry] of Object.entries(raw)) {
    if (entry === null || entry === undefined) continue;
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      out[name] = { name, value: entry, sourceLine: 0, type: 'number' };
      continue;
    }
    if (typeof entry === 'string') {
      out[name] = { name, value: entry, sourceLine: 0, type: 'string' };
      continue;
    }
    if (typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const val = e.value;
    if (val === null || val === undefined) continue;
    const sourceLine = typeof e.sourceLine === 'number' ? e.sourceLine : 0;
    const typ = e.type;
    if (typeof val === 'number' && Number.isFinite(val)) {
      const t: CalculatorVariable['type'] =
        typ === 'matrix' || typ === 'complex' ? typ : 'number';
      out[name] = { name, value: val, sourceLine, type: t };
    } else if (typeof val === 'string') {
      out[name] = { name, value: val, sourceLine, type: 'string' };
    }
  }
  return out;
}

/** 合法的 CalcResult.type 集合（用于解析校验） */
const CALC_RESULT_TYPES = new Set<CalcResultType>([
  'number',
  'percent',
  'currency',
  'date',
  'duration',
  'matrix',
  'complex',
  'string',
  'error',
]);

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/**
 * 将磁盘/弱类型 JSON 中的 result 规范为 CalcResult。
 */
export function normalizeCalcResult(raw: unknown): CalcResult {
  if (raw === null || raw === undefined) {
    return { type: 'error', value: null, displayValue: '', error: 'missing_result' };
  }
  if (typeof raw !== 'object') {
    return { type: 'error', value: null, displayValue: '', error: 'invalid_result' };
  }
  const r = raw as Record<string, unknown>;
  const typeStr = typeof r.type === 'string' ? r.type : '';
  const type: CalcResultType = CALC_RESULT_TYPES.has(typeStr as CalcResultType)
    ? (typeStr as CalcResultType)
    : 'error';
  const displayValue = typeof r.displayValue === 'string' ? r.displayValue : '';
  const value = 'value' in r ? r.value : null;
  const unit = typeof r.unit === 'string' ? r.unit : undefined;
  let error = typeof r.error === 'string' ? r.error : undefined;
  if (type === 'error' && !error) {
    error = 'invalid_result';
  }
  const out: CalcResult = { type, value, displayValue };
  if (unit !== undefined) out.unit = unit;
  if (error !== undefined) out.error = error;
  return out;
}

/**
 * 规范化单行数据（缺字段补齐，非法 result 回退为 error）。
 * @param hashBehavior 用于从表达式推断 lineRole；默认 legacy 保持旧文档 # 为注释
 */
export function normalizeCalculatorLine(
  raw: unknown,
  lineIndexOneBased: number,
  hashBehavior: CalculatorHashBehavior = 'legacy',
): CalculatorLine {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const id = typeof r.id === 'string' && r.id ? r.id : generateLineId();
  const expression = typeof r.expression === 'string' ? r.expression : '';
  const definedVariables = normalizeStringArray(r.definedVariables);
  const dependencies = normalizeStringArray(r.dependencies);
  const lineRole: CalculatorLineRole = isStoredLineRole(r.lineRole)
    ? (r.lineRole as CalculatorLineRole)
    : inferLineRole(expression, hashBehavior);
  const isNote = lineRole === 'heading' || lineRole === 'comment';
  let result = normalizeCalcResult(r.result);
  if (isNote && result.type !== 'string') {
    result = {
      type: 'string',
      value: expression,
      displayValue: typeof result.displayValue === 'string' ? result.displayValue : '',
    };
  }
  const lineNumber =
    typeof r.lineNumber === 'number' &&
    Number.isFinite(r.lineNumber) &&
    r.lineNumber >= 1
      ? Math.floor(r.lineNumber)
      : lineIndexOneBased;
  const computedAt = typeof r.computedAt === 'string' ? r.computedAt : undefined;
  return {
    id,
    lineNumber,
    expression,
    result,
    definedVariables,
    dependencies,
    lineRole,
    isNote,
    computedAt,
  };
}

/**
 * 按数组顺序重置行号 1..n（修复损坏的 lineNumber）。
 */
export function renumberCalculatorLines(lines: CalculatorLine[]): CalculatorLine[] {
  return lines.map((line, i) => ({ ...line, lineNumber: i + 1 }));
}

/**
 * 规范化 Sheet（lines、variables、元数据）。
 */
export function normalizeCalculatorSheet(
  raw: unknown,
  sheetIndex: number,
  hashBehavior: CalculatorHashBehavior = 'legacy',
): CalculatorSheet {
  const now = new Date().toISOString();
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const id = typeof r.id === 'string' && r.id ? r.id : generateSheetId();
  const name =
    typeof r.name === 'string' && r.name.trim()
      ? r.name
      : `Sheet ${sheetIndex + 1}`;
  const linesIn = Array.isArray(r.lines) ? r.lines : [];
  const lines = renumberCalculatorLines(
    linesIn.map((line, i) => normalizeCalculatorLine(line, i + 1, hashBehavior)),
  );
  const variables = normalizeCalculatorVariables(
    (r.variables as Record<string, unknown> | undefined) ?? {},
  );
  const createdAt = typeof r.createdAt === 'string' ? r.createdAt : now;
  const updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : now;
  return { id, name, lines, variables, createdAt, updatedAt };
}

/** 若 activeSheetId 无效则回退到第一张表 */
export function resolveActiveSheetId(
  sheets: CalculatorSheet[],
  requested: string,
): string {
  if (sheets.length === 0) return '';
  if (requested && sheets.some((s) => s.id === requested)) return requested;
  return sheets[0].id;
}

// ============================================================
// 文档结构
// ============================================================

/** 计算文档设置 */
export interface CalculatorSettings {
  /** 默认货币（USD, CNY, EUR 等） */
  defaultCurrency: string;
  /** 日期格式 */
  dateFormat: string;
  /** 数字格式（千分位、小数点等） */
  numberFormat: 'western' | 'chinese';
  /** 导出等待办展示：乘除符号 ascii 为 * /，cjk 为 × ÷（与 Soulver 等中文习惯一致） */
  operatorSymbols: 'ascii' | 'cjk';
  /** `#` 行：legacy 视为注释；soulver 视为标题并参与分段小计 */
  hashBehavior: CalculatorHashBehavior;
  /** 实时计算开关 */
  liveUpdate: boolean;
  /** 小数位数 */
  decimalPlaces: number;
}

/** 计算空间（Sheet） */
export interface CalculatorSheet {
  /** 唯一 ID */
  id: string;
  /** 名称 */
  name: string;
  /** 所有行 */
  lines: CalculatorLine[];
  /** 变量表（每个空间独立） */
  variables: Record<string, CalculatorVariable>;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

/** 计算文档内容 */
export interface CalculatorDocumentContent {
  /** 格式版本号 */
  version: number;
  /** 所有计算空间 */
  sheets: CalculatorSheet[];
  /** 当前激活的空间 ID */
  activeSheetId: string;
  /** 设置 */
  settings: CalculatorSettings;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;

  // === 向后兼容（旧版数据迁移用） ===
  /** @deprecated 使用 sheets[0].lines 替代 */
  lines?: CalculatorLine[];
  /** @deprecated 使用 sheets[0].variables 替代 */
  variables?: Record<string, CalculatorVariable>;
}

// ============================================================
// 默认值
// ============================================================

/** 默认设置 */
export const DEFAULT_CALCULATOR_SETTINGS: CalculatorSettings = {
  defaultCurrency: 'CNY',
  dateFormat: 'YYYY-MM-DD',
  numberFormat: 'western',
  operatorSymbols: 'ascii',
  hashBehavior: 'legacy',
  liveUpdate: true,
  decimalPlaces: 2,
};

/** 生成唯一 Sheet ID */
export function generateSheetId(): string {
  return `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 创建空 Sheet */
export function createEmptySheet(name: string = 'Sheet 1'): CalculatorSheet {
  const now = new Date().toISOString();
  return {
    id: generateSheetId(),
    name,
    lines: [],
    variables: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** 创建空文档 */
export function createEmptyCalculatorContent(): CalculatorDocumentContent {
  const now = new Date().toISOString();
  const defaultSheet = createEmptySheet('Sheet 1');
  return {
    version: 2,
    sheets: [defaultSheet],
    activeSheetId: defaultSheet.id,
    settings: { ...DEFAULT_CALCULATOR_SETTINGS },
    createdAt: now,
    updatedAt: now,
  };
}

/** 从无法识别的 JSON 降级为可编辑的文本行（避免静默丢数据） */
function calculatorContentFromUnknownJson(parsed: unknown): CalculatorDocumentContent {
  const raw =
    typeof parsed === 'string'
      ? parsed
      : JSON.stringify(parsed, null, 2);
  const textLines = raw.split('\n');
  const now = new Date().toISOString();
  const sheet = createEmptySheet('Sheet 1');
  sheet.name = 'Recovered';
  sheet.lines = renumberCalculatorLines(
    textLines.map((expr, i) =>
      normalizeCalculatorLine(
        {
          expression: expr,
          result: { type: 'string' as const, value: expr, displayValue: '' },
        },
        i + 1,
        DEFAULT_CALCULATOR_SETTINGS.hashBehavior,
      ),
    ),
  );
  return {
    version: 2,
    sheets: [sheet],
    activeSheetId: sheet.id,
    settings: { ...DEFAULT_CALCULATOR_SETTINGS },
    createdAt: now,
    updatedAt: now,
  };
}

/** 解析文档内容 */
export function parseCalculatorContent(content: string): CalculatorDocumentContent | null {
  if (!content || !content.trim()) {
    return createEmptyCalculatorContent();
  }

  try {
    const parsed = JSON.parse(content);

    // V2 格式（多 Sheet）
    if (parsed && typeof parsed === 'object' && parsed.version === 2 && Array.isArray(parsed.sheets)) {
      const p = parsed as Record<string, unknown>;
      const rawSheets = p.sheets as unknown[];
      const settingsIn = p.settings && typeof p.settings === 'object' && p.settings !== null
        ? (p.settings as Partial<CalculatorSettings>)
        : {};
      const mergedSettings = { ...DEFAULT_CALCULATOR_SETTINGS, ...settingsIn };
      const sheets =
        rawSheets.length > 0
          ? rawSheets.map((s, i) => normalizeCalculatorSheet(s, i, mergedSettings.hashBehavior))
          : [createEmptySheet('Sheet 1')];
      const requested =
        typeof p.activeSheetId === 'string' ? p.activeSheetId : '';
      return {
        version: 2,
        sheets,
        activeSheetId: resolveActiveSheetId(sheets, requested),
        settings: mergedSettings,
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
        updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
      };
    }

    // V1 格式（单 Sheet）- 迁移到 V2
    if (parsed && typeof parsed === 'object' && parsed.version === 1 && Array.isArray(parsed.lines)) {
      const p1 = parsed as Record<string, unknown>;
      const settingsV1 =
        p1.settings && typeof p1.settings === 'object' && p1.settings !== null
          ? (p1.settings as Partial<CalculatorSettings>)
          : {};
      const mergedV1 = { ...DEFAULT_CALCULATOR_SETTINGS, ...settingsV1 };
      const migratedSheet = normalizeCalculatorSheet(
        {
          id: generateSheetId(),
          name: 'Sheet 1',
          lines: parsed.lines,
          variables:
            (parsed as Record<string, unknown>).variables ?? {},
          createdAt:
            typeof (parsed as Record<string, unknown>).createdAt === 'string'
              ? (parsed as Record<string, unknown>).createdAt
              : new Date().toISOString(),
          updatedAt:
            typeof (parsed as Record<string, unknown>).updatedAt === 'string'
              ? (parsed as Record<string, unknown>).updatedAt
              : new Date().toISOString(),
        },
        0,
        mergedV1.hashBehavior,
      );
      return {
        version: 2,
        sheets: [migratedSheet],
        activeSheetId: migratedSheet.id,
        settings: mergedV1,
        createdAt:
          typeof (parsed as Record<string, unknown>).createdAt === 'string'
            ? ((parsed as Record<string, unknown>).createdAt as string)
            : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // JSON 合法但结构不符：降级为文本行，保留内容
    if (parsed !== null && (typeof parsed === 'object' || typeof parsed === 'string')) {
      return calculatorContentFromUnknownJson(parsed);
    }
    if (typeof parsed === 'number' || typeof parsed === 'boolean' || parsed === null) {
      return calculatorContentFromUnknownJson(parsed);
    }
  } catch {
    // 解析失败，尝试作为纯文本处理
    const textLines = content.split('\n').filter(Boolean);
    const textSheet = normalizeCalculatorSheet(
      {
        id: generateSheetId(),
        name: 'Sheet 1',
        lines: textLines.map((expr, i) =>
          normalizeCalculatorLine(
            {
              expression: expr,
              result: { type: 'error', value: null, displayValue: '' },
            },
            i + 1,
            DEFAULT_CALCULATOR_SETTINGS.hashBehavior,
          ),
        ),
        variables: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      0,
      DEFAULT_CALCULATOR_SETTINGS.hashBehavior,
    );
    return {
      version: 2,
      sheets: [textSheet],
      activeSheetId: textSheet.id,
      settings: { ...DEFAULT_CALCULATOR_SETTINGS },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return createEmptyCalculatorContent();
}

/** 提取纯文本（用于搜索） */
export function extractCalculatorPlainText(content: string): string {
  const doc = parseCalculatorContent(content);
  if (!doc) return '';

  // 提取所有 sheet 的内容
  return doc.sheets.map(sheet => {
    const header = `[${sheet.name}]`;
    const lines = sheet.lines
      .map(line => {
        const parts = [line.expression];
        if (line.result.displayValue && !line.isNote) {
          parts.push(`= ${line.result.displayValue}`);
        }
        return parts.join(' ');
      })
      .join('\n');
    return `${header}\n${lines}`;
  }).join('\n\n');
}

// ============================================================
// 辅助函数
// ============================================================

/** 生成唯一 ID */
export function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 检测是否为备注行 */
export function isNoteLine(text: string): boolean {
  const trimmed = text.trimStart();
  // 支持 //、#、@、/* 作为注释开头
  return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('@') || trimmed.startsWith('/*');
}

/** 从文本创建行 */
export function createLineFromExpression(
  expression: string,
  lineNumber: number,
  hashBehavior: CalculatorHashBehavior = 'legacy',
): CalculatorLine {
  const lineRole = inferLineRole(expression, hashBehavior);
  const isNote = lineRole === 'heading' || lineRole === 'comment';
  return {
    id: generateLineId(),
    lineNumber,
    expression,
    result: { type: 'number', value: 0, displayValue: '' },
    definedVariables: [],
    dependencies: [],
    lineRole,
    isNote,
  };
}

// ============================================================
// Sheet 管理辅助函数
// ============================================================

/** 获取当前激活的 Sheet */
export function getActiveSheet(doc: CalculatorDocumentContent): CalculatorSheet | undefined {
  const hit = doc.sheets.find((s) => s.id === doc.activeSheetId);
  if (hit) return hit;
  return doc.sheets[0];
}

/** 添加新 Sheet */
export function addSheet(doc: CalculatorDocumentContent, name?: string): CalculatorDocumentContent {
  const newSheet = createEmptySheet(name || `Sheet ${doc.sheets.length + 1}`);
  return {
    ...doc,
    sheets: [...doc.sheets, newSheet],
    activeSheetId: newSheet.id,
    updatedAt: new Date().toISOString(),
  };
}

/** 删除 Sheet（至少保留一个） */
export function deleteSheet(doc: CalculatorDocumentContent, sheetId: string): CalculatorDocumentContent {
  if (doc.sheets.length <= 1) return doc;

  const newSheets = doc.sheets.filter(s => s.id !== sheetId);
  const newActiveSheetId = doc.activeSheetId === sheetId
    ? newSheets[0].id
    : doc.activeSheetId;

  return {
    ...doc,
    sheets: newSheets,
    activeSheetId: newActiveSheetId,
    updatedAt: new Date().toISOString(),
  };
}

/** 重命名 Sheet */
export function renameSheet(doc: CalculatorDocumentContent, sheetId: string, newName: string): CalculatorDocumentContent {
  return {
    ...doc,
    sheets: doc.sheets.map(s =>
      s.id === sheetId ? { ...s, name: newName, updatedAt: new Date().toISOString() } : s
    ),
    updatedAt: new Date().toISOString(),
  };
}

/** 切换激活 Sheet */
export function switchSheet(doc: CalculatorDocumentContent, sheetId: string): CalculatorDocumentContent {
  if (!doc.sheets.find(s => s.id === sheetId)) return doc;
  return {
    ...doc,
    activeSheetId: sheetId,
    updatedAt: new Date().toISOString(),
  };
}

/** 更新 Sheet 内容 */
export function updateSheet(
  doc: CalculatorDocumentContent,
  sheetId: string,
  updates: Partial<CalculatorSheet>
): CalculatorDocumentContent {
  return {
    ...doc,
    sheets: doc.sheets.map(s =>
      s.id === sheetId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
    ),
    updatedAt: new Date().toISOString(),
  };
}
