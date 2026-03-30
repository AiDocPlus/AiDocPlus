/**
 * 计算文档行内输入：函数 / 变量自动完成（与 calculatorFunctionCatalog 对齐）
 */
import { getAllCalculatorFunctions, type CalculatorFunctionEntry } from './calculatorFunctionCatalog';

export type AutocompleteItem =
  | {
      kind: 'function';
      label: string;
      insert: string;
      description: string;
      syntax: string;
    }
  | {
      kind: 'variable';
      label: string;
      insert: string;
      description: string;
    };

/** 光标是否在未闭合的双引号字符串内（不提示，避免干扰字面量） */
export function caretInsideDoubleQuotes(text: string, caret: number): boolean {
  let inStr = false;
  let esc = false;
  for (let i = 0; i < caret; i++) {
    const c = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
    }
  }
  return inStr;
}

/** 光标前正在输入的标识符（英文/中文变量名、函数名片段） */
export function getWordAtCaret(value: string, caret: number): { word: string; start: number } {
  const before = value.slice(0, caret);
  const m = before.match(/([a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*)$/);
  if (!m) {
    return { word: '', start: caret };
  }
  return { word: m[1], start: caret - m[1].length };
}

function functionInsertSnippet(entry: CalculatorFunctionEntry): string {
  const t = entry.insertTemplate;
  const p = t.indexOf('(');
  if (p >= 0) {
    return t.slice(0, p + 1);
  }
  return `${entry.nameEn}(`;
}

function matchesFunction(entry: CalculatorFunctionEntry, prefixLower: string, prefixRaw: string): boolean {
  if (!prefixRaw) return false;
  if (entry.nameEn.toLowerCase().startsWith(prefixLower)) return true;
  if (entry.nameZh.startsWith(prefixRaw)) return true;
  if (entry.nameZh.includes(prefixRaw)) return true;
  if (entry.tags.some((tag) => tag.toLowerCase().startsWith(prefixLower))) return true;
  return false;
}

/**
 * @param maxItems 最多返回条数（变量优先）
 */
export function buildAutocompleteItems(
  word: string,
  variables: Set<string>,
  isZh: boolean,
  maxItems = 16,
): AutocompleteItem[] {
  const prefixRaw = word;
  const prefixLower = word.toLowerCase();
  if (!prefixRaw) return [];

  const out: AutocompleteItem[] = [];
  const used = new Set<string>();

  for (const v of variables) {
    if (out.length >= maxItems) break;
    if (!v.startsWith(prefixRaw) && !v.toLowerCase().startsWith(prefixLower)) continue;
    const key = `v:${v}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({
      kind: 'variable',
      label: v,
      insert: v,
      description: isZh ? '工作表中的变量' : 'Sheet variable',
    });
  }

  for (const f of getAllCalculatorFunctions()) {
    if (out.length >= maxItems) break;
    if (!matchesFunction(f, prefixLower, prefixRaw)) continue;
    const key = `f:${f.nameEn}`;
    if (used.has(key)) continue;
    used.add(key);
    const desc = (isZh ? f.descriptionZh : f.descriptionEn) || f.syntax;
    out.push({
      kind: 'function',
      label: isZh ? `${f.nameZh} (${f.nameEn})` : f.nameEn,
      insert: functionInsertSnippet(f),
      description: desc || f.syntax,
      syntax: f.syntax,
    });
  }

  return out;
}
