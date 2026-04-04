/**
 * importer.ts — 计算结果导入模块
 * 支持 CSV、TXT、Soulver 2/3 文件导入
 */
import {
  createEmptyCalculatorContent,
  createEmptySheet,
  createLineFromExpression,
  DEFAULT_CALCULATOR_SETTINGS,
  generateLineId,
  normalizeCalculatorLine,
  type CalculatorDocumentContent,
  type CalculatorLineRole,
} from '../types';

const SUBTOTAL_IMPORT_RE = /^(小计|分计|subtotal|SUBTOTAL)$/i;

// ============================================================
// 统一导入入口
// ============================================================

export type ImportResult =
  | { success: true; content: CalculatorDocumentContent }
  | { success: false; error: string };

/**
 * 导入文件
 */
export async function importFile(file: File): Promise<ImportResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  try {
    switch (ext) {
      case 'slvr':
        return await importSlvrFile(file);
      case 'soulver':
        return await importSoulver2File(file);
      case 'csv':
        return await importCsvFile(file);
      case 'txt':
        return await importTxtFile(file);
      default:
        return { success: false, error: `不支持的文件格式: .${ext}` };
    }
  } catch (err) {
    return {
      success: false,
      error: `导入失败: ${err instanceof Error ? err.message : '未知错误'}`,
    };
  }
}

// ============================================================
// CSV 导入
// ============================================================

async function importCsvFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const lines = text.split('\n').filter(Boolean);

  // 智能检测表头：若第一行全是非数字文本（且不含数字表达式），视为表头跳过
  let startIdx = 0;
  if (lines.length > 1) {
    const firstParts = parseCSVLine(lines[0]!);
    const looksLikeHeader = firstParts.length > 0 && firstParts.every(cell => {
      const t = cell.trim();
      if (t === '') return true;
      // 纯数字、数字表达式、百分比等 → 不是表头
      return !/^[\d\s,.\-+*/%()eE]+$/.test(t) && isNaN(parseFloat(t));
    });
    if (looksLikeHeader) startIdx = 1;
  }
  const dataLines = lines.slice(startIdx);

  const sheet = createEmptySheet(file.name.replace(/\.csv$/i, ''));
  const hb = DEFAULT_CALCULATOR_SETTINGS.hashBehavior;
  sheet.lines = dataLines.map((line, i) => {
    const parts = parseCSVLine(line);
    const expression = parts[1] || parts[0] || '';

    return createLineFromExpression(expression, i + 1, hb);
  });

  return {
    success: true,
    content: {
      ...createEmptyCalculatorContent(),
      sheets: [sheet],
      activeSheetId: sheet.id,
    },
  };
}

/**
 * 解析 CSV 行
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// ============================================================
// TXT 导入
// ============================================================

async function importTxtFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const lines = text.split('\n');

  const sheet = createEmptySheet(file.name.replace(/\.txt$/i, ''));
  const hb = DEFAULT_CALCULATOR_SETTINGS.hashBehavior;
  sheet.lines = lines.map((expression, i) =>
    createLineFromExpression(expression.trim(), i + 1, hb),
  );

  return {
    success: true,
    content: {
      ...createEmptyCalculatorContent(),
      sheets: [sheet],
      activeSheetId: sheet.id,
    },
  };
}

// ============================================================
// Soulver 3 (.slvr) 导入
// ============================================================

async function importSlvrFile(file: File): Promise<ImportResult> {
  // Soulver 3 的 .slvr 文件可能是 JSON 或 ZIP
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);

  // 检查是否为 ZIP 文件（PK 签名）
  const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4b;

  let json: unknown;

  if (isZip) {
    // 动态导入 JSZip（如果可用）
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      const contentFile = zip.file('content.json') || zip.file('document.json');
      if (contentFile) {
        json = JSON.parse(await contentFile.async('text'));
      } else {
        // 尝试查找任何 JSON 文件
        for (const filename of Object.keys(zip.files)) {
          if (filename.endsWith('.json')) {
            json = JSON.parse(await zip.file(filename)!.async('text'));
            break;
          }
        }
      }
    } catch {
      return { success: false, error: '无法解析 .slvr ZIP 文件' };
    }
  } else {
    // 直接作为 JSON 解析
    const text = await file.text();
    json = JSON.parse(text);
  }

  if (!json) {
    return { success: false, error: '无法解析 .slvr 文件内容' };
  }

  return parseSlvrJson(json, file.name);
}

/**
 * 解析 Soulver 3 JSON 结构
 */
function parseSlvrJson(json: unknown, filename: string): ImportResult {
  const sheet = createEmptySheet(filename.replace(/\.slvr$/i, ''));

  // Soulver 3 JSON 结构（基于逆向分析推测）
  // 可能的结构：{ lines: [...], variables: {...} }
  interface SlvrLine {
    line?: string;
    expression?: string;
    text?: string;
    result?: string | number;
    value?: string | number;
    comment?: boolean;
    isComment?: boolean;
    isSubtotal?: boolean;
    isHeading?: boolean;
    kind?: string;
    type?: string;
  }

  interface SlvrJson {
    lines?: SlvrLine[];
    sections?: Array<{ lines: SlvrLine[] }>;
    variables?: Record<string, number>;
  }

  const data = json as SlvrJson;
  const slvrLines: SlvrLine[] = data.lines || (data.sections?.flatMap(s => s.lines) || []);

  sheet.lines = slvrLines.map((slvrLine, i) => {
    let expression = String(slvrLine.line || slvrLine.expression || slvrLine.text || '');
    const isComment = Boolean(slvrLine.comment || slvrLine.isComment);
    let forcedRole: CalculatorLineRole | undefined;

    if (
      slvrLine.isSubtotal === true ||
      slvrLine.kind === 'subtotal' ||
      slvrLine.type === 'subtotal'
    ) {
      if (!SUBTOTAL_IMPORT_RE.test(expression.trim())) {
        expression = 'subtotal';
      }
      forcedRole = 'subtotal';
    } else if (
      slvrLine.isHeading === true ||
      slvrLine.kind === 'heading' ||
      slvrLine.type === 'heading' ||
      slvrLine.type === 'title'
    ) {
      const ts = expression.trimStart();
      if (!ts.startsWith('#')) {
        expression = `# ${expression.trim()}`;
      }
      forcedRole = 'heading';
    } else if (isComment) {
      forcedRole = 'comment';
    }

    const raw = {
      id: generateLineId(),
      lineNumber: i + 1,
      expression,
      result: {
        type: 'number' as const,
        value: typeof slvrLine.result === 'number' ? slvrLine.result : 0,
        displayValue:
          typeof slvrLine.result === 'string'
            ? slvrLine.result
            : typeof slvrLine.value === 'string'
              ? slvrLine.value
              : '',
      },
      definedVariables: [] as string[],
      dependencies: [] as string[],
      ...(forcedRole ? { lineRole: forcedRole } : {}),
    };
    return normalizeCalculatorLine(raw, i + 1, 'soulver');
  });

  return {
    success: true,
    content: {
      ...createEmptyCalculatorContent(),
      settings: { ...DEFAULT_CALCULATOR_SETTINGS, hashBehavior: 'soulver' },
      sheets: [sheet],
      activeSheetId: sheet.id,
    },
  };
}

// ============================================================
// Soulver 2 (.soulver) 导入
// ============================================================

async function importSoulver2File(file: File): Promise<ImportResult> {
  const text = await file.text();

  // Soulver 2 使用 XML 格式
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  const sheet = createEmptySheet(file.name.replace(/\.soulver$/i, ''));

  // 解析 XML 结构
  // <document><lines><line><expression>...</expression><result>...</result></line></lines></document>
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return { success: false, error: '无法解析 .soulver XML 文件：XML 格式无效' };
  }
  const lineElements = doc.querySelectorAll('line');

  sheet.lines = Array.from(lineElements).map((lineEl, i) => {
    const expression = lineEl.querySelector('expression')?.textContent || '';
    const resultText = lineEl.querySelector('result')?.textContent || '';
    const base = createLineFromExpression(expression, i + 1, 'soulver');
    return {
      ...base,
      result: {
        type: 'number' as const,
        value: parseFloat(resultText) || 0,
        displayValue: resultText,
      },
    };
  });

  // 如果 XML 解析失败，尝试备选结构
  if (sheet.lines.length === 0) {
    // 尝试 <entry> 结构
    const entryElements = doc.querySelectorAll('entry');
    sheet.lines = Array.from(entryElements).map((entryEl, i) => {
      const expression = entryEl.getAttribute('text') || entryEl.textContent || '';
      return createLineFromExpression(expression, i + 1, 'soulver');
    });
  }

  return {
    success: true,
    content: {
      ...createEmptyCalculatorContent(),
      settings: { ...DEFAULT_CALCULATOR_SETTINGS, hashBehavior: 'soulver' },
      sheets: [sheet],
      activeSheetId: sheet.id,
    },
  };
}

// ============================================================
// 拖放文件检测
// ============================================================

/**
 * 检测文件是否可导入
 */
export function isImportableFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['slvr', 'soulver', 'csv', 'txt'].includes(ext || '');
}

/**
 * 获取支持的导入格式
 */
export const SUPPORTED_IMPORT_FORMATS = [
  { id: 'slvr', name: 'Soulver 3', extension: '.slvr' },
  { id: 'soulver', name: 'Soulver 2', extension: '.soulver' },
  { id: 'csv', name: 'CSV', extension: '.csv' },
  { id: 'txt', name: 'TXT', extension: '.txt' },
];
