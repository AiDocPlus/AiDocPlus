/**
 * 计算器输入规范化与展示格式化
 * 对齐 Soulver 类文本计算器：中英文标点、乘除符号变体、千分位、‰/‱、自然语言「乘以/除以」等
 */

/**
 * 求值前规范化：输出可被 math.js 解析的 ASCII 核心运算符与小数点结构
 */
export function normalizeCalculatorInput(raw: string): string {
  let s = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  s = s.replace(/\uFF1D/g, '=');
  try {
    s = s.normalize('NFKC');
  } catch {
    /* ignore */
  }
  // 顿号枚举 → 列表逗号（NFKC 不转换 U+3001）
  s = s.replace(/、/g, ',');

  s = stripThousandsSeparators(s);
  s = normalizeCalculatorOperators(s);

  return s.trim();
}

/**
 * 去掉西式千分位（1,234,567.89），但保留方括号内的逗号（数组字面量如 [100,234]）。
 * 按 [] 括号深度分段：仅对方括号外部做千分位剥离，括号内部（含逗号分隔的数组元素）原样保留。
 */
export function stripThousandsSeparators(s: string): string {
  // 收集括号内/外片段（支持任意嵌套深度）
  const segments: { text: string; insideBracket: boolean }[] = [];
  let depth = 0;
  let segStart = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '[') {
      if (depth === 0 && i > segStart) {
        segments.push({ text: s.slice(segStart, i), insideBracket: false });
        segStart = i;
      }
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0) {
        segments.push({ text: s.slice(segStart, i + 1), insideBracket: true });
        segStart = i + 1;
      }
    }
  }
  if (segStart < s.length) {
    segments.push({ text: s.slice(segStart), insideBracket: depth > 0 });
  }
  if (segments.length === 0) return s;
  const THOUSANDS_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?/g;
  return segments.map(seg => {
    if (seg.insideBracket) return seg.text;
    return seg.text.replace(THOUSANDS_RE, chunk => chunk.replace(/,/g, ''));
  }).join('');
}

/**
 * 运算符与比较符统一为 ASCII（math.js）
 */
export function normalizeCalculatorOperators(s: string): string {
  let out = s;
  out = out.replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=');
  // 乘号常见字形
  out = out.replace(/[×✕✖⨉⨯]/g, '*');
  out = out.replace(/÷/g, '/');
  out = out.replace(/\u2215/g, '/'); // ∕
  // 各类破折号作负号（在数字前由 math.js 解析）
  out = out.replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\uFE58\uFE63\uFF0D]/g, '-');
  // 数字之间的中点/点运算符视为乘法
  out = out.replace(/(\d)\s*[\u00B7\u22C5\u2219]\s*(\d)/g, '$1*$2');
  // 自然语言「乘以 / 除以」（先匹配标识符/数字与数字的紧邻写法，再匹配空白分隔的通用形式）
  out = out.replace(
    /([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)\s*乘以\s*(\d+(?:\.\d+)?)/g,
    '$1*$2',
  );
  out = out.replace(
    /([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)\s*除以\s*(\d+(?:\.\d+)?)/g,
    '$1/$2',
  );
  out = out.replace(/(\d+(?:\.\d+)?)\s*乘以\s*(\d+(?:\.\d+)?)/g, '$1*$2');
  out = out.replace(/(\d+(?:\.\d+)?)\s*除以\s*(\d+(?:\.\d+)?)/g, '$1/$2');
  // 标识符 乘以/除以 标识符（如 "利润乘以税率" 无空格也能匹配）
  out = out.replace(
    /([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)\s*乘以\s*([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)/g,
    '$1*$2',
  );
  out = out.replace(
    /([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)\s*除以\s*([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)/g,
    '$1/$2',
  );
  out = out.replace(/\s+乘以\s+/g, '*');
  out = out.replace(/\s+除以\s+/g, '/');
  // 万分率、千分率
  out = out.replace(/(\d+(?:\.\d+)?)\s*‰/g, '($1/1000)');
  out = out.replace(/(\d+(?:\.\d+)?)\s*‱/g, '($1/10000)');
  return out;
}

/**
 * 展示用：将表达式中的乘除转为中文习惯符号 × ÷（不改变用户编辑区原文，用于导出等）
 */
export function formatExpressionOperatorsForDisplay(expr: string, mode: 'ascii' | 'cjk'): string {
  if (mode !== 'cjk' || !expr) return expr;
  let out = expr;
  // 括号与数字之间的乘除
  out = out.replace(/\)\s*\*\s*(?=\d)/g, ') × ');
  out = out.replace(/\)\s*\/\s*(?=\d)/g, ') ÷ ');
  out = out.replace(/\)\*(\d)/g, ')×$1');
  out = out.replace(/\)\/(\d)/g, ')÷$1');
  // 链式 digit * digit / digit / digit：用 while 循环替代固定 24 次迭代
  let changed = true;
  while (changed) {
    const next = out
      .replace(/(\d)\s*\*\s*(\d)/g, '$1 × $2')
      .replace(/(\d)\s*\/\s*(\d)/g, '$1 ÷ $2');
    changed = next !== out;
    out = next;
  }
  return out;
}
