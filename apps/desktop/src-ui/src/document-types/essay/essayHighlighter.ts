/**
 * essayHighlighter.ts — 散文修辞/意象实时高亮引擎
 *
 * Phase 3: 编辑器内实时检测并渲染高亮标注
 * - 防抖处理（300ms）
 * - 增量检测：仅重新检测变更段落
 * - 修辞高亮（比喻/拟人/排比/夸张/对偶等）
 * - 意象高亮（视觉/听觉/嗅觉/触觉/味觉/抽象）
 * - 超过 10000 字时降低检测频率
 */

import {
  detectMetaphors,
  detectPersonification,
  detectParallelism,
  detectAntithesis,
  detectHyperbole,
  detectRhetoricalQuestion,
  detectSynesthesia,
  detectAnadiplosis,
  IMAGERY_KEYWORDS,
} from './essayAnalysis';

// ═══════════════════════════════════════════════════════
// 高亮装饰数据结构
// ═══════════════════════════════════════════════════════

export type HighlightType = 'rhetoric' | 'imagery';

export interface HighlightDecoration {
  start: number;
  end: number;
  type: HighlightType;
  subtype: string;     // rhetoricType 或 imageryType
  label: string;       // 中文标签
  color: HighlightColor;
  text: string;
}

export interface HighlightColor {
  bg: string;          // Tailwind bg class
  text: string;        // Tailwind text class
  border: string;      // Tailwind border class
  hex: string;         // 十六进制颜色（用于 CodeMirror decoration）
}

// ── 修辞颜色表 ──
export const RHETORIC_HIGHLIGHT_COLORS: Record<string, HighlightColor> = {
  metaphor:          { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   hex: '#93c5fd' },
  personification:   { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  hex: '#86efac' },
  parallelism:       { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', hex: '#c4b5fd' },
  antithesis:        { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  hex: '#fcd34d' },
  hyperbole:         { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', hex: '#fdba74' },
  'rhetorical-question': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300',  hex: '#67e8f9' },
  synesthesia:       { bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-300',   hex: '#f9a8d4' },
  anadiplosis:       { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', hex: '#a5b4fc' },
  default:           { bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-300',   hex: '#d1d5db' },
};

// ── 意象颜色表（按感官类型）──
export const IMAGERY_HIGHLIGHT_COLORS: Record<string, HighlightColor> = {
  visual:    { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200',    hex: '#fca5a5' },
  auditory:  { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',   hex: '#93c5fd' },
  olfactory: { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  hex: '#86efac' },
  tactile:   { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200', hex: '#fde68a' },
  gustatory: { bg: 'bg-pink-50',   text: 'text-pink-600',   border: 'border-pink-200',   hex: '#fbcfe8' },
  abstract:  { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', hex: '#ddd6fe' },
};

// ── 意象中文标签 ──
const IMAGERY_LABELS: Record<string, string> = {
  visual:    '视觉意象',
  auditory:  '听觉意象',
  olfactory: '嗅觉意象',
  tactile:   '触觉意象',
  gustatory: '味觉意象',
  abstract:  '抽象意象',
};

// ── 修辞中文标签 ──
const RHETORIC_LABELS: Record<string, string> = {
  metaphor:          '比喻',
  personification:   '拟人',
  parallelism:       '排比',
  antithesis:        '对偶',
  hyperbole:         '夸张',
  'rhetorical-question': '设问',
  synesthesia:       '通感',
  anadiplosis:       '顶真',
};

// ═══════════════════════════════════════════════════════
// 高亮检测引擎
// ═══════════════════════════════════════════════════════

/**
 * 对一段文本运行所有修辞检测，返回高亮装饰列表
 */
export function detectRhetoricDecorations(text: string, offset: number = 0): HighlightDecoration[] {
  const detectors = [
    { fn: detectMetaphors,          type: 'metaphor' },
    { fn: detectPersonification,    type: 'personification' },
    { fn: detectParallelism,        type: 'parallelism' },
    { fn: detectAntithesis,         type: 'antithesis' },
    { fn: detectHyperbole,          type: 'hyperbole' },
    { fn: detectRhetoricalQuestion, type: 'rhetorical-question' },
    { fn: detectSynesthesia,        type: 'synesthesia' },
    { fn: detectAnadiplosis,        type: 'anadiplosis' },
  ];

  const decorations: HighlightDecoration[] = [];
  const coveredRanges: { start: number; end: number }[] = [];

  for (const { fn, type } of detectors) {
    const result = fn(text);
    const color = RHETORIC_HIGHLIGHT_COLORS[type] ?? RHETORIC_HIGHLIGHT_COLORS.default;
    const label = RHETORIC_LABELS[type] ?? type;

    for (const match of result.matches) {
      // 避免范围重叠
      const absStart = offset + match.start;
      const absEnd = offset + match.end;
      const overlaps = coveredRanges.some(r => absStart < r.end && absEnd > r.start);
      if (overlaps) continue;

      // 过滤过长（可能误检）或过短的匹配
      if (match.end - match.start > 120 || match.end - match.start < 3) continue;

      coveredRanges.push({ start: absStart, end: absEnd });
      decorations.push({
        start: absStart,
        end: absEnd,
        type: 'rhetoric',
        subtype: type,
        label,
        color,
        text: match.text,
      });
    }
  }

  return decorations;
}

/**
 * 对一段文本运行意象检测，返回高亮装饰列表
 */
export function detectImageryDecorations(text: string, offset: number = 0): HighlightDecoration[] {
  const decorations: HighlightDecoration[] = [];
  const coveredRanges: { start: number; end: number }[] = [];

  // 遍历各类意象关键词
  for (const [imageryType, keywords] of Object.entries(IMAGERY_KEYWORDS)) {
    const color = IMAGERY_HIGHLIGHT_COLORS[imageryType] ?? IMAGERY_HIGHLIGHT_COLORS.abstract;
    const label = IMAGERY_LABELS[imageryType] ?? imageryType;

    for (const keyword of keywords) {
      if (keyword.length < 2) continue; // 跳过单字，减少误判
      let searchFrom = 0;
      while (true) {
        const pos = text.indexOf(keyword, searchFrom);
        if (pos === -1) break;

        const absStart = offset + pos;
        const absEnd = offset + pos + keyword.length;

        const overlaps = coveredRanges.some(r => absStart < r.end && absEnd > r.start);
        if (!overlaps) {
          coveredRanges.push({ start: absStart, end: absEnd });
          decorations.push({
            start: absStart,
            end: absEnd,
            type: 'imagery',
            subtype: imageryType,
            label,
            color,
            text: keyword,
          });
        }
        searchFrom = pos + 1;
      }
    }
  }

  return decorations;
}

// ═══════════════════════════════════════════════════════
// 防抖 + 增量检测管理器
// ═══════════════════════════════════════════════════════

export interface HighlighterOptions {
  enableRhetoric: boolean;
  enableImagery: boolean;
  debounceMs?: number;       // 默认 300ms
  maxCharsForFull?: number;  // 超过此字数降频，默认 10000
}

type HighlightCallback = (decorations: HighlightDecoration[]) => void;

export class EssayHighlighter {
  private options: Required<HighlighterOptions>;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastText = '';
  private cachedDecorations: HighlightDecoration[] = [];
  private callback: HighlightCallback;

  // 段落缓存：paragraphHash → decorations
  private paragraphCache = new Map<string, HighlightDecoration[]>();

  constructor(callback: HighlightCallback, options: HighlighterOptions) {
    this.callback = callback;
    this.options = {
      debounceMs: 300,
      maxCharsForFull: 10000,
      ...options,
    };
  }

  /** 更新选项（如开关高亮类型）*/
  updateOptions(options: Partial<HighlighterOptions>) {
    const changed =
      (options.enableRhetoric !== undefined && options.enableRhetoric !== this.options.enableRhetoric) ||
      (options.enableImagery !== undefined && options.enableImagery !== this.options.enableImagery);
    Object.assign(this.options, options);
    if (changed) {
      // 选项变化时立即重新检测
      this.runDetection(this.lastText, true);
    }
  }

  /** 文本变化时调用 */
  onTextChange(text: string) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // 超过 10000 字时延迟增加到 800ms
    const delay = text.length > this.options.maxCharsForFull
      ? this.options.debounceMs * 2.5
      : this.options.debounceMs;

    this.debounceTimer = setTimeout(() => {
      this.runDetection(text);
    }, delay);
  }

  /** 立即触发检测（不防抖）*/
  forceDetect(text: string) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.runDetection(text, true);
  }

  /** 清理资源 */
  destroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.paragraphCache.clear();
  }

  private runDetection(text: string, forceAll = false) {
    if (!this.options.enableRhetoric && !this.options.enableImagery) {
      this.cachedDecorations = [];
      this.callback([]);
      this.lastText = text;
      return;
    }

    // 按段落拆分
    const paragraphs = this.splitParagraphs(text);
    const allDecorations: HighlightDecoration[] = [];

    for (const para of paragraphs) {
      const hash = this.hashParagraph(para.text);
      let paraDecorations: HighlightDecoration[];

      if (!forceAll && this.paragraphCache.has(hash)) {
        // 使用缓存结果，但要调整偏移量
        const cached = this.paragraphCache.get(hash)!;
        const offsetDiff = para.offset - (cached[0]?.start ?? para.offset);
        if (offsetDiff === 0) {
          paraDecorations = cached;
        } else {
          paraDecorations = cached.map(d => ({
            ...d,
            start: d.start - (cached[0]?.start ?? 0) + para.offset,
            end: d.end - (cached[0]?.start ?? 0) + para.offset,
          }));
        }
      } else {
        paraDecorations = [];
        if (this.options.enableRhetoric) {
          paraDecorations.push(...detectRhetoricDecorations(para.text, para.offset));
        }
        if (this.options.enableImagery) {
          paraDecorations.push(...detectImageryDecorations(para.text, para.offset));
        }
        this.paragraphCache.set(hash, paraDecorations);
      }

      allDecorations.push(...paraDecorations);
    }

    // 清理过期缓存（保留最近 200 个段落）
    if (this.paragraphCache.size > 200) {
      const keys = [...this.paragraphCache.keys()];
      keys.slice(0, keys.length - 200).forEach(k => this.paragraphCache.delete(k));
    }

    this.cachedDecorations = allDecorations;
    this.lastText = text;
    this.callback(allDecorations);
  }

  private splitParagraphs(text: string): { text: string; offset: number }[] {
    const result: { text: string; offset: number }[] = [];
    const len = text.length;
    let pos = 0;

    while (pos < len) {
      const blockStart = pos;
      let blockEnd = pos;

      // 扫描到段落分隔符（\n 后跟可选空白再跟 \n）
      while (blockEnd < len) {
        if (text[blockEnd] === '\n') {
          let look = blockEnd + 1;
          while (look < len && text[look] !== '\n' && /[ \t]/.test(text[look])) look++;
          if (look < len && text[look] === '\n') break;
        }
        blockEnd++;
      }

      const raw = text.slice(blockStart, blockEnd);
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        // 精确找到 trimmed 在 raw 中的前导空白偏移
        const leadingSpaces = raw.indexOf(trimmed);
        result.push({ text: trimmed, offset: blockStart + (leadingSpaces >= 0 ? leadingSpaces : 0) });
      }

      // 跳过段落分隔符
      pos = blockEnd;
      while (pos < len && /[\n\r ]/.test(text[pos])) pos++;
      if (pos <= blockEnd && blockEnd < len) pos = blockEnd + 1;
    }

    return result;
  }

  private hashParagraph(text: string): string {
    // 简单哈希：字符串长度 + 前后各20字符
    const prefix = text.slice(0, 20);
    const suffix = text.slice(-20);
    return `${text.length}:${prefix}:${suffix}`;
  }

  /** 获取当前缓存的装饰列表 */
  getDecorations(): HighlightDecoration[] {
    return this.cachedDecorations;
  }
}

// ═══════════════════════════════════════════════════════
// React Hook 封装
// ═══════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';

export function useEssayHighlighter(
  text: string,
  enableRhetoric: boolean,
  enableImagery: boolean,
): HighlightDecoration[] {
  const [decorations, setDecorations] = useState<HighlightDecoration[]>([]);
  const highlighterRef = useRef<EssayHighlighter | null>(null);

  // 初始化高亮引擎
  useEffect(() => {
    const highlighter = new EssayHighlighter(setDecorations, {
      enableRhetoric,
      enableImagery,
    });
    highlighterRef.current = highlighter;
    return () => {
      highlighter.destroy();
      highlighterRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 选项变化时更新
  useEffect(() => {
    highlighterRef.current?.updateOptions({ enableRhetoric, enableImagery });
  }, [enableRhetoric, enableImagery]);

  // 文本变化时触发检测
  useEffect(() => {
    highlighterRef.current?.onTextChange(text);
  }, [text]);

  return decorations;
}
