/**
 * CalculatorLineEditor — 行级计算编辑器（增强版）
 * 支持：多行输入、始终可见的语法高亮、奇偶行区分、拖拽排序、右键菜单
 */
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  memo,
  forwardRef,
  useImperativeHandle,
  type MutableRefObject,
  type ForwardedRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, X, GripVertical, Copy, Trash2, MessageSquare, ClipboardCopy, ArrowUpToLine, ArrowDownToLine,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { syncCalculatorLineMeta, generateLineId, type CalculatorLine, type CalcResult, type CalculatorHashBehavior, type ChartResultData, type SensitivityResultData, type NumberDisplayFormat, formatNumberByFormat } from './types';
import { CalculatorResizer } from './CalculatorResizer';
import { CalculatorChartRenderer } from './CalculatorChartRenderer';
import type { CalculatorCaretHint } from './calculatorFunctionCatalog';
import { isCalculatorBuiltinWord } from './calculatorBuiltinWords';
import { normalizeCalculatorInput } from './calculatorInputNormalize';
import {
  buildAutocompleteItems,
  caretInsideDoubleQuotes,
  getWordAtCaret,
  type AutocompleteItem,
} from './calculatorAutocomplete';

/** 与引擎内置标识符对齐：禁止作为赋值左侧名 */
function isBlockedAssignmentLhs(word: string): boolean {
  return isCalculatorBuiltinWord(word);
}

/** 从当前行文本推断赋值变量名，用于高亮与引擎 variables 尚未同步时 */
function inferAssignmentVariableNames(lines: CalculatorLine[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line.isNote) continue;
    let t = normalizeCalculatorInput(line.expression);
    t = t.replace(/^[\s]+/, '').trimStart();
    let m = t.match(/^let\s+([a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*)\s*=\s*/i);
    if (m) {
      out.push(m[1]);
      continue;
    }
    m = t.match(/^([a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*)\s*=\s*/);
    if (m && !isBlockedAssignmentLhs(m[1])) {
      out.push(m[1]);
    }
  }
  return out;
}

// ============================================================
// 语法高亮工具
// ============================================================

interface HighlightToken {
  type: 'variable' | 'number' | 'operator' | 'function' | 'comment' | 'text' | 'quoted';
  value: string;
}

/**
 * 语法高亮分析器
 * 变量名（红色）、数字（绿色）、操作符（灰色）、函数（蓝色）
 */
function tokenizeExpression(
  expr: string,
  variables: Set<string>,
  isNote: boolean
): HighlightToken[] {
  if (isNote) {
    return [{ type: 'comment', value: expr }];
  }

  let normalized = expr.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\uFF1D/g, '=');
  try {
    normalized = normalized.normalize('NFKC');
  } catch {
    /* ignore */
  }

  const tokens: HighlightToken[] = [];
  let remaining = normalized;

  const operators = ['+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', ':', '?', '·'];
  const builtInFunctions = new Set([
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
    'asinh', 'acosh', 'atanh', 'cot', 'csc', 'sec', 'csch', 'sech', 'coth',
    'log', 'ln', 'exp', 'sqrt', 'abs', 'floor', 'ceil', 'round', 'pow',
    'min', 'max', 'sum', 'mean', 'avg', 'std', 'median', 'variance',
    'erf', 'gamma', 'lgamma',
    'npv', 'irr', 'pmt', 'fv', 'pv', 'nper', 'rate', 'ipmt', 'ppmt', 'mirr',
    'normsdist', 'normsinv', 'normspdf',
    'listAt', 'listSlice', 'listLen', 'listRange', 'listSort',
    'rollMean', 'rollSum',
    'quantileSeq', 'prod', 'atan2',
    'xirr', 'xnpv',
    'chart', 'sens', 'fn',
    '合计', '求和', '平均', '均值', '最小值', '最大值', '标准差', '方差', '绝对值', '平方根', '开方',
  ]);
  const builtInConstants = new Set(['e', 'pi', 'PI', 'i']);

  while (remaining.length > 0) {
    const spaceMatch = remaining.match(/^(\s+)/);
    if (spaceMatch) {
      tokens.push({ type: 'text', value: spaceMatch[1] });
      remaining = remaining.slice(spaceMatch[1].length);
      continue;
    }

    const allLinesEn = remaining.match(/^all\s+lines\b/i);
    if (allLinesEn) {
      tokens.push({ type: 'function', value: allLinesEn[0] });
      remaining = remaining.slice(allLinesEn[0].length);
      continue;
    }

    if (remaining.startsWith('所有行')) {
      tokens.push({ type: 'function', value: '所有行' });
      remaining = remaining.slice(3);
      continue;
    }

    if (remaining[0] === '"') {
      let j = 1;
      let chunk = '"';
      while (j < remaining.length) {
        if (remaining[j] === '\\' && j + 1 < remaining.length) {
          chunk += remaining[j] + remaining[j + 1];
          j += 2;
          continue;
        }
        chunk += remaining[j];
        if (remaining[j] === '"') {
          j += 1;
          break;
        }
        j += 1;
      }
      tokens.push({ type: 'quoted', value: chunk });
      remaining = remaining.slice(j);
      continue;
    }

    const numMatch = remaining.match(/^(\d+(?:\.\d+)?(?:e[+-]?\d+)?%?)/i);
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[1] });
      remaining = remaining.slice(numMatch[1].length);
      continue;
    }

    const multiCharOps = ['**', '<=', '>=', '!=', '×', '÷'];
    const multiHit = multiCharOps.find((op) => remaining.startsWith(op));
    if (multiHit) {
      tokens.push({ type: 'operator', value: multiHit });
      remaining = remaining.slice(multiHit.length);
      continue;
    }

    const cnVarMatch = remaining.match(/^([\u4e00-\u9fa5]+)/);
    if (cnVarMatch) {
      const varName = cnVarMatch[1];
      if (variables.has(varName)) {
        tokens.push({ type: 'variable', value: varName });
      } else {
        tokens.push({ type: 'text', value: varName });
      }
      remaining = remaining.slice(varName.length);
      continue;
    }

    const idMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (idMatch) {
      const name = idMatch[1];
      if (builtInFunctions.has(name.toLowerCase())) {
        tokens.push({ type: 'function', value: name });
      } else if (builtInConstants.has(name)) {
        tokens.push({ type: 'variable', value: name });
      } else if (variables.has(name)) {
        tokens.push({ type: 'variable', value: name });
      } else if (['line', 'lines', 'let', 'today', 'now', 'if', 'else'].includes(name.toLowerCase())) {
        tokens.push({ type: 'function', value: name });
      } else {
        tokens.push({ type: 'text', value: name });
      }
      remaining = remaining.slice(name.length);
      continue;
    }

    if (operators.some(op => remaining.startsWith(op))) {
      const op = operators.find(op => remaining.startsWith(op))!;
      tokens.push({ type: 'operator', value: op });
      remaining = remaining.slice(op.length);
      continue;
    }

    tokens.push({ type: 'text', value: remaining[0] });
    remaining = remaining.slice(1);
  }

  return tokens;
}

/** 获取 token 的样式类 */
function getTokenClass(type: HighlightToken['type'], isActive: boolean): string {
  const opacity = isActive ? '' : 'opacity-60';
  switch (type) {
    case 'variable':
      return `text-red-500 font-medium ${opacity}`;
    case 'number':
      return `text-green-600 dark:text-green-400 ${opacity}`;
    case 'operator':
      return `text-gray-500 dark:text-gray-400 ${opacity}`;
    case 'function':
      return `text-blue-500 dark:text-blue-400 ${opacity}`;
    case 'quoted':
      return `text-amber-700 dark:text-amber-400/90 ${opacity}`;
    case 'comment':
      return `text-gray-400 italic ${opacity}`;
    default:
      return '';
  }
}

// ============================================================
// 敏感性分析结果表格
// ============================================================

function SensitivityTable({ data }: { data: SensitivityResultData }) {
  return (
    <div className="border border-border/40 rounded-md overflow-hidden">
      {data.expression && (
        <div className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/30 border-b border-border/30 font-mono">
          {data.expression}
        </div>
      )}
      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="bg-muted/20">
              <th className="px-3 py-1 text-left text-muted-foreground border-b border-border/30">
                {data.variableName}
              </th>
              <th className="px-3 py-1 text-right text-muted-foreground border-b border-border/30">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {data.pairs.map((pair, i) => (
              <tr
                key={i}
                className="border-b border-border/20 last:border-b-0 hover:bg-muted/10"
              >
                <td className="px-3 py-0.5 text-foreground">
                  {Number.isFinite(pair.inputValue) ? pair.inputValue.toLocaleString() : '—'}
                </td>
                <td className="px-3 py-0.5 text-right text-foreground font-medium">
                  {Number.isFinite(pair.outputValue) ? pair.outputValue.toLocaleString() : 'Error'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 可排序行组件
// ============================================================

/** 由父组件每帧写入，避免 memo 因回调引用变化失效 */
export interface CalculatorLineRowActionsRef {
  onFocusLine: (index: number) => void;
  onLineChange: (index: number, value: string) => void;
  onDeleteLine: (index: number) => void;
  onDuplicateLine: (index: number) => void;
  onToggleCommentLine: (index: number) => void;
  onComputeCommit: () => void;
  /** 在指定行上方插入空行并聚焦，光标在行末 */
  insertLineAbove: (index: number) => void;
  /** 在指定行下方插入空行并聚焦，光标在行末 */
  insertLineBelow: (index: number) => void;
  /** 行间移动（↑↓），目标行聚焦且光标在行末 */
  navigateVertical: (fromIndex: number, delta: -1 | 1) => void;
  /** 将当前行表达式复制到剪贴板 */
  copyLineExpression: (index: number) => void;
}

interface SortableLineRowProps {
  line: CalculatorLine;
  lineIndex: number;
  lineNumber: number;
  /** 总行数（用于最后一行 Enter 行为） */
  lineCount: number;
  isActive: boolean;
  variables: Set<string>;
  /** 结果列宽度（像素），与表头一致 */
  resultWidth: number;
  actionsRef: MutableRefObject<CalculatorLineRowActionsRef>;
  liveUpdate?: boolean;
  /** 搜索匹配高亮 */
  isHighlighted?: boolean;
  isCurrentHighlight?: boolean;
  /** 多选状态 */
  isSelected?: boolean;
  /** 行点击回调 */
  onLineClick?: (index: number, modifiers: { cmdKey: boolean; shiftKey: boolean }) => void;
}

function sortableLineRowPropsEqual(a: SortableLineRowProps, b: SortableLineRowProps): boolean {
  if (
    a.line.id !== b.line.id ||
    a.line.expression !== b.line.expression ||
    a.line.isNote !== b.line.isNote ||
    a.line.lineRole !== b.line.lineRole
  ) {
    return false;
  }
  if (a.line.result.type !== b.line.result.type) return false;
  if (a.line.result.displayValue !== b.line.result.displayValue) return false;
  if (a.line.result.type === 'error' && b.line.result.type === 'error') {
    if (a.line.result.error !== b.line.result.error) return false;
  }
  if (a.lineIndex !== b.lineIndex || a.lineNumber !== b.lineNumber || a.lineCount !== b.lineCount || a.isActive !== b.isActive || a.liveUpdate !== b.liveUpdate) {
    return false;
  }
  if (a.resultWidth !== b.resultWidth) return false;
  if (a.variables !== b.variables) return false;
  return a.actionsRef === b.actionsRef;
}

const SortableLineRow = memo(function SortableLineRow({
  line,
  lineIndex,
  lineNumber,
  lineCount,
  isActive,
  variables,
  resultWidth,
  actionsRef,
  liveUpdate = true,
  isHighlighted,
  isCurrentHighlight,
  isSelected,
  onLineClick,
}: SortableLineRowProps) {
  const { t, i18n } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(line.expression);
  const [textareaHeight, setTextareaHeight] = useState(28);
  const [caretPos, setCaretPos] = useState(0);
  const [acSelectedIndex, setAcSelectedIndex] = useState(0);
  const [acHidden, setAcHidden] = useState(false);
  const acItemsRef = useRef<AutocompleteItem[]>([]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  useEffect(() => {
    setLocalValue(line.expression);
  }, [line.expression]);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      setTextareaHeight(Math.max(28, scrollHeight));
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [localValue]);

  const treatAsPlainNoteForHighlight =
    line.lineRole === 'heading' || line.lineRole === 'comment' || line.lineRole === 'subtotal';
  const tokens = useMemo(
    () => tokenizeExpression(localValue, variables, treatAsPlainNoteForHighlight),
    [localValue, variables, treatAsPlainNoteForHighlight],
  );

  const acWord = useMemo(() => getWordAtCaret(localValue, caretPos).word, [localValue, caretPos]);

  useEffect(() => {
    setAcHidden(false);
  }, [acWord]);

  const acItems = useMemo(() => {
    if (line.isNote || !isActive) return [];
    if (acHidden) return [];
    if (caretInsideDoubleQuotes(localValue, caretPos)) return [];
    const { word } = getWordAtCaret(localValue, caretPos);
    if (word.length < 1) return [];
    return buildAutocompleteItems(word, variables, i18n.language.startsWith('zh'));
  }, [localValue, caretPos, line.isNote, isActive, variables, i18n.language, acHidden]);

  acItemsRef.current = acItems;

  useEffect(() => {
    setAcSelectedIndex(0);
  }, [acItems]);

  const applyAutocomplete = useCallback(
    (item: AutocompleteItem) => {
      const ta = textareaRef.current;
      const c = ta?.selectionStart ?? caretPos;
      const { word, start } = getWordAtCaret(localValue, c);
      const end = start + word.length;
      const insert = item.insert;
      const newVal = localValue.slice(0, start) + insert + localValue.slice(end);
      setLocalValue(newVal);
      setAcHidden(true);
      setAcSelectedIndex(0);
      actionsRef.current.onLineChange(lineIndex, newVal);
      const newCaret = start + insert.length;
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCaret, newCaret);
        }
        setCaretPos(newCaret);
      });
    },
    [localValue, caretPos, lineIndex, actionsRef],
  );

  const commitIfNeeded = () => {
    if (!liveUpdate) {
      actionsRef.current.onComputeCommit();
    }
  };

  /** 光标在文本框内处于第几行（0-based）、列位置 */
  const getCaretLineInTextarea = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const lineIdx = before.split('\n').length - 1;
    return { lineIdx, totalLines: value ? value.split('\n').length : 1 };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    const caret = ta?.selectionStart ?? 0;
    const items = acItemsRef.current;

    if (items.length > 0 && !line.isNote) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAcSelectedIndex((i) => Math.min(items.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAcSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[acSelectedIndex];
        if (item) applyAutocomplete(item);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAcHidden(true);
        return;
      }
    }

    // ↑↓：在表达式首行/末行时切换到上一行/下一行，光标定位到行末
    if (e.key === 'ArrowUp' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const { lineIdx } = getCaretLineInTextarea(localValue, caret);
      if (lineIdx === 0 && lineIndex > 0) {
        e.preventDefault();
        actionsRef.current.navigateVertical(lineIndex, -1);
        return;
      }
    }
    if (e.key === 'ArrowDown' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const { lineIdx, totalLines } = getCaretLineInTextarea(localValue, caret);
      if (lineIdx >= totalLines - 1 && lineIndex < lineCount - 1) {
        e.preventDefault();
        actionsRef.current.navigateVertical(lineIndex, 1);
        return;
      }
    }

    // Enter（非 Shift）：末行时在下方新建空行并聚焦；否则仅提交重算
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (lineIndex === lineCount - 1) {
        commitIfNeeded();
        actionsRef.current.insertLineBelow(lineIndex);
        return;
      }
      commitIfNeeded();
      return;
    }
    // Tab: 插入缩进
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart || 0;
      const end = textareaRef.current?.selectionEnd || 0;
      const newValue = localValue.slice(0, start) + '  ' + localValue.slice(end);
      setLocalValue(newValue);
      actionsRef.current.onLineChange(lineIndex, newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
    setCaretPos(e.target.selectionStart ?? 0);
    actionsRef.current.onLineChange(lineIndex, e.target.value);
  };

  // 渲染结果
  const renderResult = (result: CalcResult) => {
    if (line.lineRole === 'heading') {
      return (
        <span className="text-muted-foreground/60 text-xs">
          {t('calculator.rowKindHeading', { defaultValue: '标题' })}
        </span>
      );
    }
    if (line.lineRole === 'comment') {
      return (
        <span className="text-muted-foreground/50 italic text-xs">
          {t('calculator.rowKindComment', { defaultValue: '注释' })}
        </span>
      );
    }
    if (line.lineRole === 'subtotal') {
      return (
        <span className="text-amber-700 dark:text-amber-400 text-xs font-medium">
          {result.displayValue || t('calculator.rowKindSubtotal', { defaultValue: '小计' })}
        </span>
      );
    }
    if (line.isNote) {
      return (
        <span className="text-muted-foreground/50 italic text-xs">
          {t('calculator.rowKindComment', { defaultValue: '注释' })}
        </span>
      );
    }
    if (result.type === 'error') {
      return (
        <span className="text-red-400 text-xs flex items-center gap-1">
          <X className="h-3 w-3" />
          {result.error || t('calculator.errorFallback', { defaultValue: 'Error' })}
        </span>
      );
    }
    if (!result.displayValue) {
      return <span className="text-muted-foreground/30">—</span>;
    }
    // 行级数字格式化
    let displayText = result.displayValue;
    if (line.displayFormat && result.type === 'number' && typeof result.value === 'number' && Number.isFinite(result.value)) {
      displayText = formatNumberByFormat(result.value, line.displayFormat, 2, navigator.language || 'zh-CN');
    }
    return (
      <span className="text-foreground font-medium">
        → {displayText}
      </span>
    );
  };

  // 奇数行：浅蓝背景；偶数行：灰条纹 + 左侧色条
  const isOddRow = lineNumber % 2 === 1;
  // 奇数行：天蓝色（sky 色相，浅底 + 略饱和左边线）
  const rowStripeClass = isOddRow
    ? 'bg-sky-200/21 dark:bg-sky-900/20 border-l-[3px] border-l-sky-500/33 dark:border-l-sky-400/28'
    : 'bg-muted/50 dark:bg-muted/40 border-l-[3px] border-l-primary/25';

  const roleStripeClass =
    line.lineRole === 'heading'
      ? 'bg-muted/30 dark:bg-muted/25 border-l-[3px] border-l-primary/45'
      : line.lineRole === 'comment'
        ? 'opacity-[0.93]'
        : line.lineRole === 'subtotal'
          ? 'bg-amber-500/10 dark:bg-amber-950/25 border-l-[3px] border-l-amber-500/40'
          : rowStripeClass;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            'group flex items-stretch border-b border-border/50 transition-colors',
            roleStripeClass,
            isActive && 'bg-primary/[0.07] ring-1 ring-primary/25 ring-inset',
            isSelected && !isActive && 'bg-blue-50/80 dark:bg-blue-950/25 border-l-[3px] border-l-blue-500/60',
            isHighlighted && !isActive && !isSelected && 'bg-yellow-100/50 dark:bg-yellow-900/20',
            isCurrentHighlight && !isActive && !isSelected && 'bg-yellow-200/60 dark:bg-yellow-800/30',
            isDragging && 'opacity-50 shadow-lg'
          )}
          onClick={() => textareaRef.current?.focus()}
        >
          {/* 拖拽手柄 */}
          <div
            {...attributes}
            {...listeners}
            className="w-8 flex-shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
          </div>

          {/* 行号 */}
          <div
            className={cn(
              'w-10 flex-shrink-0 flex items-center justify-center text-xs font-mono border-r border-border/30 bg-muted/20 cursor-pointer select-none',
              isSelected ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'text-muted-foreground/50',
            )}
            onClick={(e) => {
              e.stopPropagation();
              onLineClick?.(lineIndex, { cmdKey: e.metaKey || e.ctrlKey, shiftKey: e.shiftKey });
            }}
          >
            {isSelected && <span className="text-blue-500 dark:text-blue-400 mr-0.5">✓</span>}
            {lineNumber}
          </div>

          {/* 表达式编辑区 */}
          <div className="flex-1 min-w-0 relative">
            {/* 输入层 */}
            <Textarea
              ref={textareaRef}
              data-calculator-line={lineIndex}
              value={localValue}
              onChange={handleChange}
              onSelect={(e) => setCaretPos(e.currentTarget.selectionStart ?? 0)}
              onClick={(e) => setCaretPos(e.currentTarget.selectionStart ?? 0)}
              onKeyUp={(e) => setCaretPos(e.currentTarget.selectionStart ?? 0)}
              onFocus={() => actionsRef.current.onFocusLine(lineIndex)}
              onBlur={() => {
                commitIfNeeded();
              }}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full px-3 py-1.5 bg-transparent outline-none font-mono text-sm resize-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
                'min-h-[28px] text-foreground [caret-color:var(--foreground)]',
                line.lineRole === 'heading' && 'font-semibold',
                line.lineRole === 'comment' && 'italic text-muted-foreground',
                line.lineRole === 'subtotal' && 'text-amber-900/90 dark:text-amber-100/90',
              )}
              style={{ height: textareaHeight }}
              spellCheck={false}
              autoComplete="off"
              rows={1}
            />
            {isActive && acItems.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full z-[60] mt-0.5 mx-2 rounded-md border border-border bg-popover text-popover-foreground shadow-md"
                role="listbox"
                aria-label={t('calculator.autocompleteLabel', { defaultValue: '输入提示' })}
              >
                <div className="max-h-48 overflow-y-auto py-1">
                  {acItems.map((item, i) => (
                    <button
                      key={`${item.kind}-${item.label}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === acSelectedIndex}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 text-xs transition-colors',
                        i === acSelectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/80',
                      )}
                      onMouseEnter={() => setAcSelectedIndex(i)}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        applyAutocomplete(item);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'shrink-0 rounded px-1 py-px text-[10px] font-medium uppercase',
                            item.kind === 'function'
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                              : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
                          )}
                        >
                          {item.kind === 'function'
                            ? t('calculator.autocompleteKindFn', { defaultValue: '函数' })
                            : t('calculator.autocompleteKindVar', { defaultValue: '变量' })}
                        </span>
                        <span className="font-mono text-foreground truncate">{item.label}</span>
                      </div>
                      {item.kind === 'function' && (
                        <div className="mt-0.5 pl-0 font-mono text-[10px] text-muted-foreground truncate">
                          {item.syntax}
                        </div>
                      )}
                      {item.description ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                          {item.description}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* 语法高亮层：仅非聚焦行显示，避免双 DOM + 透明字带来的光标问题 */}
            {!isActive && (
              <div
                className="absolute inset-0 px-3 py-1.5 pointer-events-none font-mono text-sm overflow-hidden whitespace-pre-wrap"
                aria-hidden="true"
              >
                {tokens.map((token, i) => (
                  <span key={i} className={getTokenClass(token.type, false)}>
                    {token.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 结果区 */}
          {line.result.type === 'chart' && line.result.value ? (
            <div className="flex-1 min-w-0 px-3 py-1">
              <CalculatorChartRenderer data={line.result.value as ChartResultData} />
            </div>
          ) : line.result.type === 'sensitivity' && line.result.value ? (
            <div className="flex-1 min-w-0 px-3 py-1">
              <SensitivityTable data={line.result.value as SensitivityResultData} />
            </div>
          ) : (
            <div
              className="flex-shrink-0 flex items-center px-3 border-l border-border/30 bg-muted/5"
              style={{ width: resultWidth, minWidth: resultWidth }}
            >
              <span className="font-mono text-sm truncate">
                {renderResult(line.result)}
              </span>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => actionsRef.current.insertLineAbove(lineIndex)}>
          <ArrowUpToLine className="h-4 w-4 mr-2" />
          {t('calculator.insertLineAbove', { defaultValue: '在上方插入行' })}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => actionsRef.current.insertLineBelow(lineIndex)}>
          <ArrowDownToLine className="h-4 w-4 mr-2" />
          {t('calculator.insertLineBelow', { defaultValue: '在下方插入行' })}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => actionsRef.current.onDuplicateLine(lineIndex)}>
          <Copy className="h-4 w-4 mr-2" />
          {t('calculator.duplicateLine', { defaultValue: '复制行' })}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void actionsRef.current.copyLineExpression(lineIndex)}>
          <ClipboardCopy className="h-4 w-4 mr-2" />
          {t('calculator.copyLineExpression', { defaultValue: '复制表达式' })}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => actionsRef.current.onToggleCommentLine(lineIndex)}>
          <MessageSquare className="h-4 w-4 mr-2" />
          {t('calculator.toggleComment', { defaultValue: '切换注释' })}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => actionsRef.current.onDeleteLine(lineIndex)} className="text-red-500 focus:text-red-500">
          <Trash2 className="h-4 w-4 mr-2" />
          {t('calculator.deleteLine', { defaultValue: '删除行' })}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}, sortableLineRowPropsEqual);

// ============================================================
// 主组件
// ============================================================

interface CalculatorLineEditorProps {
  lines: CalculatorLine[];
  variables: Record<string, unknown>;
  onChange: (lines: CalculatorLine[]) => void;
  onAddLine?: () => void;
  /** 当前活动行索引（受控） */
  activeLineIndex?: number | null;
  /** 活动行变化回调 */
  onActiveLineChange?: (index: number | null) => void;
  /** 与文档设置一致：关闭时仅失焦/Enter 后重算 */
  liveUpdate?: boolean;
  /** 非实时模式下由子行失焦/Enter 触发 */
  onComputeCommit?: () => void;
  /** 与文档设置一致：`#` 行视为注释或标题（Soulver 分段） */
  hashBehavior?: CalculatorHashBehavior;
  /** 结果列宽度（px） */
  resultWidth: number;
  onResultWidthChange: (width: number) => void;
  minResultWidth?: number;
  maxResultWidth?: number;
  /** 搜索匹配的行索引集合（高亮显示） */
  highlightedLines?: Set<number>;
  /** 搜索导航中当前高亮行索引 */
  currentHighlightIndex?: number | null;
  /** 多选行索引集合 */
  selectedLineIndices?: Set<number>;
  /** 行点击回调（支持 Cmd/Shift 多选） */
  onLineClick?: (index: number, modifiers: { cmdKey: boolean; shiftKey: boolean }) => void;
}

export type CalculatorLineEditorHandle = {
  /** 在当前活动行（无活动行时落到最后一行）的光标处插入文本 */
  insertTextAtActiveCaret: (
    text: string,
    options?: { caretHint?: CalculatorCaretHint },
  ) => boolean;
  /** 将活动行整行表达式替换为给定文本（用于一键插入统计行等） */
  replaceExpressionAtActiveLine: (fullExpression: string) => boolean;
};

export const CalculatorLineEditor = forwardRef(function CalculatorLineEditor(
  {
    lines,
    variables,
    onChange,
    onAddLine,
    activeLineIndex: externalActiveLineIndex,
    onActiveLineChange,
    liveUpdate = true,
    onComputeCommit,
    hashBehavior = 'legacy',
    resultWidth,
    onResultWidthChange,
    minResultWidth,
    maxResultWidth,
    highlightedLines,
    currentHighlightIndex,
    selectedLineIndices,
    onLineClick,
  }: CalculatorLineEditorProps,
  ref: ForwardedRef<CalculatorLineEditorHandle>
) {
  const { t } = useTranslation();
  const [internalActiveLineIndex, setInternalActiveLineIndex] = useState<number | null>(null);

  // 支持受控和非受控模式
  const activeLineIndex = externalActiveLineIndex !== undefined ? externalActiveLineIndex : internalActiveLineIndex;
  const setActiveLineIndex = useCallback((index: number | null) => {
    if (externalActiveLineIndex === undefined) {
      setInternalActiveLineIndex(index);
    }
    onActiveLineChange?.(index);
  }, [externalActiveLineIndex, onActiveLineChange]);

  const containerRef = useRef<HTMLDivElement>(null);
  /** 行间 ↑↓ 或插入行后，将光标放到目标行行末 */
  const pendingCaretEndLineRef = useRef<number | null>(null);

  const variableNamesCacheRef = useRef<Set<string>>(new Set());
  const variableNames = useMemo(() => {
    const keys = Object.keys(variables);
    const inferred = inferAssignmentVariableNames(lines);
    const newSet = new Set<string>([...keys, ...inferred]);
    const cached = variableNamesCacheRef.current;
    if (newSet.size === cached.size && [...newSet].every(n => cached.has(n))) {
      return cached;
    }
    variableNamesCacheRef.current = newSet;
    return newSet;
  }, [variables, lines]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = lines.findIndex(line => line.id === active.id);
      const newIndex = lines.findIndex(line => line.id === over.id);

      const newLines = arrayMove(lines, oldIndex, newIndex).map((line, i) =>
        syncCalculatorLineMeta({ ...line, lineNumber: i + 1 }, hashBehavior),
      );

      onChange(newLines);
    }
  }, [lines, onChange, hashBehavior]);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const activeDragLine = useMemo(() => {
    if (!activeDragId) return null;
    return lines.find(l => l.id === activeDragId) ?? null;
  }, [activeDragId, lines]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleLineChange = useCallback((index: number, value: string) => {
    const newLines = [...lines];
    newLines[index] = syncCalculatorLineMeta(
      { ...newLines[index], expression: value },
      hashBehavior,
    );
    onChange(newLines);
  }, [lines, onChange, hashBehavior]);

  const handleLineChangeRef = useRef(handleLineChange);
  handleLineChangeRef.current = handleLineChange;
  const activeLineIndexRef = useRef(activeLineIndex);
  activeLineIndexRef.current = activeLineIndex;
  const linesLengthRef = useRef(lines.length);
  linesLengthRef.current = lines.length;
  const setActiveLineIndexRef = useRef(setActiveLineIndex);
  setActiveLineIndexRef.current = setActiveLineIndex;

  useImperativeHandle(ref, () => ({
    insertTextAtActiveCaret(text: string, options?: { caretHint?: CalculatorCaretHint }) {
      let idx = activeLineIndexRef.current;
      if (idx === null && linesLengthRef.current > 0) {
        idx = linesLengthRef.current - 1;
        setActiveLineIndexRef.current(idx);
      }
      if (idx === null) return false;
      const ta = containerRef.current?.querySelector(`textarea[data-calculator-line="${idx}"]`) as HTMLTextAreaElement | null;
      if (!ta) return false;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const cur = ta.value;
      const newVal = cur.slice(0, start) + text + cur.slice(end);
      handleLineChangeRef.current(idx, newVal);
      let sel = start + text.length;
      if (options?.caretHint === 'firstParenInside') {
        const p = text.indexOf('(');
        if (p >= 0) sel = start + p + 1;
      }
      requestAnimationFrame(() => {
        const ta2 = containerRef.current?.querySelector(`textarea[data-calculator-line="${idx}"]`) as HTMLTextAreaElement | null;
        if (ta2) {
          ta2.focus();
          const c = Math.min(Math.max(0, sel), ta2.value.length);
          ta2.setSelectionRange(c, c);
        }
      });
      return true;
    },
    replaceExpressionAtActiveLine(fullExpression: string) {
      let idx = activeLineIndexRef.current;
      if (idx === null && linesLengthRef.current > 0) {
        idx = linesLengthRef.current - 1;
        setActiveLineIndexRef.current(idx);
      }
      if (idx === null) return false;
      handleLineChangeRef.current(idx, fullExpression);
      requestAnimationFrame(() => {
        const ta2 = containerRef.current?.querySelector(`textarea[data-calculator-line="${idx}"]`) as HTMLTextAreaElement | null;
        if (ta2) {
          ta2.focus();
          const len = fullExpression.length;
          ta2.setSelectionRange(len, len);
        }
      });
      return true;
    },
  }), []);

  const handleDeleteLine = useCallback((index: number) => {
    const newLines = lines
      .filter((_, i) => i !== index)
      .map((line, i) => syncCalculatorLineMeta({ ...line, lineNumber: i + 1 }, hashBehavior));
    onChange(newLines);
    if (activeLineIndex === index) {
      if (newLines.length === 0) {
        setActiveLineIndex(null);
      } else {
        setActiveLineIndex(Math.min(index, newLines.length - 1));
      }
    } else if (activeLineIndex !== null && activeLineIndex > index) {
      setActiveLineIndex(activeLineIndex - 1);
    }
  }, [lines, onChange, activeLineIndex, setActiveLineIndex, hashBehavior]);

  const handleDuplicateLine = useCallback((index: number) => {
    const lineToDuplicate = lines[index];
    const newLine: CalculatorLine = {
      ...lineToDuplicate,
      id: generateLineId(),
    };
    const newLines = [...lines.slice(0, index + 1), newLine, ...lines.slice(index + 1)].map((line, i) =>
      syncCalculatorLineMeta({ ...line, lineNumber: i + 1 }, hashBehavior),
    );
    onChange(newLines);
    setActiveLineIndex(index + 1);
  }, [lines, onChange, setActiveLineIndex, hashBehavior]);

  const handleToggleComment = useCallback((index: number) => {
    const line = lines[index];
    let newExpression: string;

    if (line.isNote) {
      // 移除注释符号
      newExpression = line.expression
        .replace(/^\/\*\s*/, '')
        .replace(/\s*\*\/\s*$/, '')
        .replace(/^(\/\/\s?|#\s?|@\s?)/, '');
    } else {
      // 添加注释符号
      newExpression = '// ' + line.expression;
    }

    handleLineChange(index, newExpression);
  }, [lines, handleLineChange]);

  const navigateVertical = useCallback((from: number, delta: -1 | 1) => {
    const to = from + delta;
    if (to < 0 || to >= lines.length) return;
    pendingCaretEndLineRef.current = to;
    setActiveLineIndex(to);
  }, [lines.length, setActiveLineIndex]);

  const handleInsertLineAbove = useCallback((index: number) => {
    const newLine: CalculatorLine = syncCalculatorLineMeta(
      {
        id: generateLineId(),
        lineNumber: 0,
        expression: '',
        result: { type: 'number', value: 0, displayValue: '' },
        definedVariables: [],
        dependencies: [],
        lineRole: 'normal',
        isNote: false,
      },
      hashBehavior,
    );
    const newLines = [...lines.slice(0, index), newLine, ...lines.slice(index)].map((line, i) =>
      syncCalculatorLineMeta({ ...line, lineNumber: i + 1 }, hashBehavior),
    );
    onChange(newLines);
    pendingCaretEndLineRef.current = index;
    setActiveLineIndex(index);
  }, [lines, onChange, setActiveLineIndex, hashBehavior]);

  const handleInsertLineBelow = useCallback((index: number) => {
    const newLine: CalculatorLine = syncCalculatorLineMeta(
      {
        id: generateLineId(),
        lineNumber: 0,
        expression: '',
        result: { type: 'number', value: 0, displayValue: '' },
        definedVariables: [],
        dependencies: [],
        lineRole: 'normal',
        isNote: false,
      },
      hashBehavior,
    );
    const newLines = [...lines.slice(0, index + 1), newLine, ...lines.slice(index + 1)].map((line, i) =>
      syncCalculatorLineMeta({ ...line, lineNumber: i + 1 }, hashBehavior),
    );
    onChange(newLines);
    pendingCaretEndLineRef.current = index + 1;
    setActiveLineIndex(index + 1);
  }, [lines, onChange, setActiveLineIndex, hashBehavior]);

  const copyLineExpression = useCallback(async (index: number) => {
    const text = lines[index]?.expression ?? '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }, [lines]);

  useEffect(() => {
    const target = pendingCaretEndLineRef.current;
    if (target === null || target !== activeLineIndex) return;

    let cancelled = false;
    const tryFocusEnd = () => {
      if (cancelled) return;
      const el = containerRef.current?.querySelector(`textarea[data-calculator-line="${target}"]`);
      if (el instanceof HTMLTextAreaElement) {
        pendingCaretEndLineRef.current = null;
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
        return true;
      }
      return false;
    };

    const id1 = requestAnimationFrame(() => {
      if (tryFocusEnd()) return;
      requestAnimationFrame(() => {
        if (!cancelled) tryFocusEnd();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
    };
  }, [activeLineIndex, lines]);

  const rowActionsRef = useRef<CalculatorLineRowActionsRef>({
    onFocusLine: () => {},
    onLineChange: () => {},
    onDeleteLine: () => {},
    onDuplicateLine: () => {},
    onToggleCommentLine: () => {},
    onComputeCommit: () => {},
    insertLineAbove: () => {},
    insertLineBelow: () => {},
    navigateVertical: () => {},
    copyLineExpression: () => {},
  });
  rowActionsRef.current = {
    onFocusLine: (index) => setActiveLineIndex(index),
    onLineChange: handleLineChange,
    onDeleteLine: handleDeleteLine,
    onDuplicateLine: handleDuplicateLine,
    onToggleCommentLine: handleToggleComment,
    onComputeCommit: onComputeCommit ?? (() => {}),
    insertLineAbove: handleInsertLineAbove,
    insertLineBelow: handleInsertLineBelow,
    navigateVertical,
    copyLineExpression,
  };

  const handleAddLine = useCallback(() => {
    const newLine: CalculatorLine = syncCalculatorLineMeta(
      {
        id: generateLineId(),
        lineNumber: lines.length + 1,
        expression: '',
        result: { type: 'number', value: 0, displayValue: '' },
        definedVariables: [],
        dependencies: [],
        lineRole: 'normal',
        isNote: false,
      },
      hashBehavior,
    );
    onChange([...lines, newLine]);
    setTimeout(() => setActiveLineIndex(lines.length), 0);
    onAddLine?.();
  }, [lines, onChange, onAddLine, setActiveLineIndex, hashBehavior]);

  // 键盘导航（焦点不在具体行的 textarea 上时，如列表容器获得焦点）
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'TEXTAREA') return;

    if (e.key === 'ArrowUp' && activeLineIndex !== null && activeLineIndex > 0) {
      e.preventDefault();
      navigateVertical(activeLineIndex, -1);
    } else if (e.key === 'ArrowDown' && activeLineIndex !== null && activeLineIndex < lines.length - 1) {
      e.preventDefault();
      navigateVertical(activeLineIndex, 1);
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleAddLine();
    } else if (e.key === 'Delete' && activeLineIndex !== null) {
      handleDeleteLine(activeLineIndex);
    }
  }, [activeLineIndex, lines.length, handleAddLine, handleDeleteLine, navigateVertical]);

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col"
      onKeyDown={handleKeyDown}
    >
      {/* 行列表 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={(e) => { handleDragEnd(e); setActiveDragId(null); }}
      >
        <SortableContext
          items={lines.map(l => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex-1 overflow-auto">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <div className="text-sm mb-4">{t('calculator.startTyping', { defaultValue: '开始输入表达式' })}</div>
                <Button variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('calculator.addFirstLine', { defaultValue: '添加第一行' })}
                </Button>
              </div>
            ) : (
              <>
                <div
                  className="sticky top-0 z-10 flex items-stretch border-b border-border bg-muted/50 dark:bg-muted/40 backdrop-blur-sm"
                  aria-hidden
                >
                  <div className="w-8 flex-shrink-0 border-r border-border/30" />
                  <div className="w-10 flex-shrink-0 flex items-center justify-center text-[10px] text-muted-foreground font-mono border-r border-border/30">
                    #
                  </div>
                  <div className="flex-1 min-w-0 px-3 py-1.5 text-xs text-muted-foreground flex items-center">
                    {t('calculator.expression', { defaultValue: '表达式' })}
                  </div>
                  <CalculatorResizer
                    resultWidth={resultWidth}
                    onResultWidthChange={onResultWidthChange}
                    minWidth={minResultWidth}
                    maxWidth={maxResultWidth}
                  />
                  <div
                    className="flex-shrink-0 px-3 py-1.5 text-xs text-muted-foreground flex items-center border-l border-border/30 bg-muted/30"
                    style={{ width: resultWidth, minWidth: resultWidth }}
                  >
                    {t('calculator.result', { defaultValue: '结果' })}
                  </div>
                </div>
                {lines.map((line, index) => (
                  <SortableLineRow
                    key={line.id}
                    line={line}
                    lineIndex={index}
                    lineNumber={index + 1}
                    lineCount={lines.length}
                    isActive={activeLineIndex === index}
                    variables={variableNames}
                    resultWidth={resultWidth}
                    actionsRef={rowActionsRef}
                    liveUpdate={liveUpdate}
                    isHighlighted={highlightedLines?.has(index)}
                    isCurrentHighlight={currentHighlightIndex === index}
                    isSelected={selectedLineIndices?.has(index)}
                    onLineClick={onLineClick}
                  />
                ))}
              </>
            )}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeDragLine && (
            <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-md shadow-lg max-w-[320px]">
              <span className="text-xs text-muted-foreground font-mono">
                {activeDragLine.expression.slice(0, 60)}
                {activeDragLine.expression.length > 60 ? '…' : ''}
              </span>
              {activeDragLine.result?.displayValue && (
                <span className="text-xs text-foreground font-medium ml-auto shrink-0">
                  → {activeDragLine.result.displayValue}
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* 添加行按钮 */}
      {lines.length > 0 && (
        <div className="flex-shrink-0 p-2 border-t border-border/50 bg-muted/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddLine}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('calculator.addLine', { defaultValue: '添加行 (Ctrl+Enter)' })}
          </Button>
        </div>
      )}
    </div>
  );
});

CalculatorLineEditor.displayName = 'CalculatorLineEditor';

export default CalculatorLineEditor;
