import { useRef, useState, useEffect, useMemo, useCallback } from 'react';

import { markdown, markdownLanguage, deleteMarkupBackward, insertNewlineContinueMarkup } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  EditorView, keymap, placeholder as cmPlaceholder,
  lineNumbers, highlightActiveLine, highlightSpecialChars,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor,
  highlightActiveLineGutter, scrollPastEnd,
} from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import {
  syntaxHighlighting, foldGutter, foldKeymap,
  bracketMatching, indentOnInput, HighlightStyle,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { highlightSelectionMatches, searchKeymap, openSearchPanel } from '@codemirror/search';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { cn } from '@/lib/utils';
import * as TU from '@/lib/textUtils';
import { useEditorSettings } from '@/stores/useSettingsStore';
import { EditorToolbar } from './EditorToolbar';
import { EditorStatusBar } from './EditorStatusBar';
import { MarkdownPreview } from './MarkdownPreview';
import { markdownCompletions } from './markdownCompletions';
import { checkboxWidgetExtension } from './extensions/checkboxWidget';
import { linkHoverTooltip } from './extensions/linkTooltip';
import { markdownLinterExtension } from './extensions/markdownLinter';
import { lintKeymap } from '@codemirror/lint';
import type { Document } from '@aidocplus/shared-types';
import { DocumentOutline, parseHeadings, getBreadcrumb } from './DocumentOutline';
import EditorSelectionToolbar from './EditorSelectionToolbar';
import EditorContextMenu from './EditorContextMenu';
import GotoLineDialog from './GotoLineDialog';
import { bookmarkExtension, toggleBookmark, nextBookmark, prevBookmark, clearAllBookmarks } from './extensions/bookmarks';
import { macroRecorderExtension, macroRecorder } from './extensions/macroRecorder';
import { textIndentPlugin } from './textIndentPlugin';

// 大文档阈值（字符数），超过此值启用性能降级模式
const LARGE_DOC_THRESHOLD = 100_000;
// 大文档 debounce 时间（ms），正常文档使用 300ms
const LARGE_DOC_DEBOUNCE = 800;
const NORMAL_DOC_DEBOUNCE = 300;

// 自定义高亮样式：基于 defaultHighlightStyle，去掉 heading 下划线，标题分级字号
const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.meta, color: '#404740' },
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold' },
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: 'bold' },
  { tag: tags.heading2, fontSize: '1.4em', fontWeight: 'bold' },
  { tag: tags.heading3, fontSize: '1.2em', fontWeight: 'bold' },
  { tag: tags.heading4, fontSize: '1.1em', fontWeight: 'bold' },
  { tag: tags.heading5, fontSize: '1.05em', fontWeight: 'bold' },
  { tag: tags.heading6, fontSize: '1em', fontWeight: 'bold', color: '#666' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.keyword, color: '#708' },
  { tag: [tags.atom, tags.bool, tags.url, tags.contentSeparator, tags.labelName], color: '#219' },
  { tag: [tags.literal, tags.inserted], color: '#164' },
  { tag: [tags.string, tags.deleted], color: '#a11' },
  { tag: [tags.regexp, tags.escape, tags.special(tags.string)], color: '#e40' },
  { tag: tags.definition(tags.variableName), color: '#00f' },
  { tag: tags.local(tags.variableName), color: '#30a' },
  { tag: [tags.typeName, tags.namespace], color: '#085' },
  { tag: tags.className, color: '#167' },
  { tag: [tags.special(tags.variableName), tags.macroName], color: '#256' },
  { tag: tags.definition(tags.propertyName), color: '#00c' },
  { tag: tags.comment, color: '#940' },
  { tag: tags.invalid, color: '#f00' },
]);

type ViewMode = 'edit' | 'preview' | 'split';

export interface ImportSources {
  aiContent?: string;
  document?: Document;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  theme?: 'light' | 'dark';
  editable?: boolean;
  showToolbar?: boolean;
  showViewModeSwitch?: boolean;
  initialLine?: number;
  onCursorLineChange?: (line: number) => void;
  editorClassName?: string;
  editorId?: string;
  importSources?: ImportSources;
  exportCallbacks?: import('./EditorToolbar').ExportCallbacks;
  initialViewMode?: 'edit' | 'preview' | 'split';
  showStatusBar?: boolean;
  editorRef?: React.MutableRefObject<EditorView | null>;
  enableSelectionToolbar?: boolean;
  textIndent?: boolean;
}

// 创建一组 Compartment 实例（每个编辑器实例独立）
function createCompartments() {
  return {
    tabSize: new Compartment(),
    lineNumbers: new Compartment(),
    lineWrapping: new Compartment(),
    editable: new Compartment(),
    theme: new Compartment(),
    spellCheck: new Compartment(),
    highlightActiveLine: new Compartment(),
    bracketMatching: new Compartment(),
    closeBrackets: new Compartment(),
    codeFolding: new Compartment(),
    highlightSelMatch: new Compartment(),
    autocompletion: new Compartment(),
    multiCursor: new Compartment(),
    scrollPastEnd: new Compartment(),
    indentOnInput: new Compartment(),
    markdownLint: new Compartment(),
    textIndent: new Compartment(),
  };
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '输入内容...',
  theme = 'dark',
  editable = true,
  showToolbar = true,
  showViewModeSwitch = true,
  initialLine,
  onCursorLineChange,
  editorId: _editorId,
  importSources,
  exportCallbacks,
  initialViewMode,
  showStatusBar = true,
  editorRef,
  enableSelectionToolbar = true,
  textIndent = false,
}: MarkdownEditorProps) {
  const editorDivRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const cmViewRef = useRef<EditorView | null>(null);
  // Phase 2: Expose EditorView to parent via editorRef prop
  // (synced after view creation and on destroy)
  const scrollSyncLock = useRef(false);
  const compRef = useRef(createCompartments());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCursorLineChangeRef = useRef(onCursorLineChange);
  onCursorLineChangeRef.current = onCursorLineChange;
  const lastEmittedRef = useRef(value);
  const docContentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef(value.length > LARGE_DOC_THRESHOLD ? LARGE_DOC_DEBOUNCE : NORMAL_DOC_DEBOUNCE);

  const editorSettings = useEditorSettings();
  const [localFontSize, setLocalFontSize] = useState(editorSettings.fontSize);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1, selChars: 0, from: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || editorSettings.defaultViewMode || 'edit');
  const [docContent, setDocContent] = useState(value);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [selToolbar, setSelToolbar] = useState<{ visible: boolean; x: number; y: number; text: string; from: number; to: number }>({ visible: false, x: 0, y: 0, text: '', from: 0, to: 0 });
  const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
  // 持久保存选中状态，供系统菜单使用（菜单点击时编辑器会失焦导致 selection 被清除）
  const lastSelectionRef = useRef<{ from: number; to: number; text: string; hasSelection: boolean }>({ from: 0, to: 0, text: '', hasSelection: false });

  // 大文档检测：超过阈值启用性能降级模式
  const isLargeDoc = docContent.length > LARGE_DOC_THRESHOLD;

  // Markdown 快捷键
  const mdKeymap = useMemo(() => keymap.of([
    // Enter：使用官方 insertNewlineContinueMarkup（支持列表/引用/任务列表续行、空行退出、有序列表重编号）
    { key: 'Enter', run: insertNewlineContinueMarkup },
    {
      key: 'Tab',
      run: (view) => {
        const { from, to } = view.state.selection.main;
        const tabStr = ' '.repeat(editorSettings.tabSize);
        if (from === to) {
          // 无选中：插入 tab 空格
          view.dispatch({ changes: { from, to: from, insert: tabStr }, selection: { anchor: from + tabStr.length } });
        } else {
          // 有选中：对每行增加缩进
          const startLine = view.state.doc.lineAt(from);
          const endLine = view.state.doc.lineAt(to);
          const changes: { from: number; to: number; insert: string }[] = [];
          for (let i = startLine.number; i <= endLine.number; i++) {
            const ln = view.state.doc.line(i);
            changes.push({ from: ln.from, to: ln.from, insert: tabStr });
          }
          view.dispatch({ changes });
        }
        return true;
      },
    },
    {
      key: 'Shift-Tab',
      run: (view) => {
        const { from, to } = view.state.selection.main;
        const tabSize = editorSettings.tabSize;
        const startLine = view.state.doc.lineAt(from);
        const endLine = view.state.doc.lineAt(to);
        const changes: { from: number; to: number; insert: string }[] = [];
        for (let i = startLine.number; i <= endLine.number; i++) {
          const ln = view.state.doc.line(i);
          const text = ln.text;
          let removeCount = 0;
          for (let j = 0; j < Math.min(tabSize, text.length); j++) {
            if (text[j] === ' ') removeCount++;
            else break;
          }
          if (removeCount > 0) {
            changes.push({ from: ln.from, to: ln.from + removeCount, insert: '' });
          }
        }
        if (changes.length > 0) view.dispatch({ changes });
        return true;
      },
    },
    {
      key: 'Mod-b',
      run: (view) => { wrapSelection(view, '**', '**', '粗体文本'); return true; },
    },
    {
      key: 'Mod-i',
      run: (view) => { wrapSelection(view, '*', '*', '斜体文本'); return true; },
    },
    {
      key: 'Mod-e',
      run: (view) => { wrapSelection(view, '`', '`', '代码'); return true; },
    },
    {
      key: 'Mod-k',
      run: (view) => {
        const { from, to } = view.state.selection.main;
        const sel = view.state.sliceDoc(from, to);
        const linkText = sel || '链接文本';
        const insert = `[${linkText}](url)`;
        view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + linkText.length + 3, head: from + linkText.length + 6 } });
        return true;
      },
    },
    {
      key: 'Mod-Shift-x',
      run: (view) => { wrapSelection(view, '~~', '~~', '删除线文本'); return true; },
    },
    {
      key: 'Mod-Shift-k',
      run: (view) => {
        const { from } = view.state.selection.main;
        const insert = '\n```\n\n```\n';
        view.dispatch({ changes: { from, to: from, insert }, selection: { anchor: from + 5 } });
        return true;
      },
    },
    // ── 新增快捷键（对标 Sublime Text） ──
    { key: 'Alt-ArrowUp', run: (view) => {
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      if (line.number <= 1) return true;
      const prev = view.state.doc.line(line.number - 1);
      view.dispatch({ changes: [
        { from: prev.from, to: line.to, insert: line.text + '\n' + prev.text },
      ], selection: { anchor: prev.from + (from - line.from) } });
      return true;
    } },
    { key: 'Alt-ArrowDown', run: (view) => {
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      if (line.number >= view.state.doc.lines) return true;
      const next = view.state.doc.line(line.number + 1);
      view.dispatch({ changes: [
        { from: line.from, to: next.to, insert: next.text + '\n' + line.text },
      ], selection: { anchor: line.from + next.text.length + 1 + (from - line.from) } });
      return true;
    } },
    { key: 'Mod-Shift-d', run: (view) => {
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      view.dispatch({ changes: { from: line.to, to: line.to, insert: '\n' + line.text } });
      return true;
    } },
    { key: 'Ctrl-Shift-k', run: (view) => {
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      const df = line.from === 0 ? 0 : line.from - 1;
      const dt = line.to === view.state.doc.length ? line.to : line.to + 1;
      view.dispatch({ changes: { from: df, to: dt, insert: '' } });
      return true;
    } },
    { key: 'Mod-j', run: (view) => {
      const { from, to } = view.state.selection.main;
      const startLine = view.state.doc.lineAt(from);
      const endLine = view.state.doc.lineAt(to);
      if (startLine.number === endLine.number && endLine.number < view.state.doc.lines) {
        const nextLine = view.state.doc.line(endLine.number + 1);
        view.dispatch({ changes: { from: startLine.to, to: nextLine.to, insert: ' ' + nextLine.text.trimStart() } });
      } else if (startLine.number < endLine.number) {
        const lines: string[] = [];
        for (let i = startLine.number; i <= endLine.number; i++) lines.push(view.state.doc.line(i).text);
        view.dispatch({ changes: { from: startLine.from, to: endLine.to, insert: lines.join(' ') } });
      }
      return true;
    } },
    { key: 'Mod-l', run: (view) => {
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      view.dispatch({ selection: { anchor: line.from, head: line.to + 1 } });
      return true;
    } },
    { key: 'Mod-h', run: (view) => { openSearchPanel(view); return true; } },
    { key: 'Mod-=', run: (view) => { wrapSelection(view, '==', '==', '高亮文本'); return true; } },
  ]), [editorSettings.tabSize]);

  // 创建 EditorView（组件挂载时执行一次，通过 key prop 在文档切换时重新挂载）
  useEffect(() => {
    const parent = editorDivRef.current;
    if (!parent) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newDoc = update.state.doc.toString();
        lastEmittedRef.current = newDoc;
        onChangeRef.current(newDoc);
        // debounced 更新 docContent（用于统计、大纲、预览）
        // 大文档时使用更长的 debounce 减少重渲染
        debounceRef.current = newDoc.length > LARGE_DOC_THRESHOLD ? LARGE_DOC_DEBOUNCE : NORMAL_DOC_DEBOUNCE;
        if (docContentTimerRef.current) clearTimeout(docContentTimerRef.current);
        docContentTimerRef.current = setTimeout(() => {
          setDocContent(newDoc);
          docContentTimerRef.current = null;
        }, debounceRef.current);
      }
      // 更新光标（用 requestAnimationFrame 避免同步 setState 冲突，加值比较守卫避免不必要的重渲染）
      requestAnimationFrame(() => {
        try {
          const { from, to } = update.state.selection.main;
          const line = update.state.doc.lineAt(from);
          const newLine = line.number;
          const newCol = from - line.from + 1;
          const newSelChars = to - from;
          setCursorInfo(prev => {
            if (prev.line === newLine && prev.col === newCol && prev.selChars === newSelChars && prev.from === from) return prev;
            return { line: newLine, col: newCol, selChars: newSelChars, from };
          });
          // 持久保存选中状态（供系统菜单使用，菜单点击会导致编辑器失焦清除 selection）
          lastSelectionRef.current = { from, to, text: update.state.sliceDoc(from, to), hasSelection: to > from };
          onCursorLineChangeRef.current?.(newLine);
        } catch { /* view may be destroyed */ }
      });
    });

    const extensions = [
      // --- Compartment 动态扩展（可通过 reconfigure 更新） ---
      compRef.current.lineNumbers.of(editorSettings.showLineNumbers ? lineNumbers() : []),
      compRef.current.lineWrapping.of(editorSettings.wordWrap ? EditorView.lineWrapping : []),
      compRef.current.editable.of(EditorView.editable.of(editable)),
      compRef.current.theme.of(theme === 'dark' ? oneDark : []),
      compRef.current.tabSize.of(EditorState.tabSize.of(editorSettings.tabSize)),
      compRef.current.spellCheck.of(
        editorSettings.spellCheck
          ? EditorView.contentAttributes.of({ spellcheck: 'true' })
          : EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' })
      ),
      compRef.current.highlightActiveLine.of(
        editorSettings.highlightActiveLine !== false
          ? [highlightActiveLine(), highlightActiveLineGutter()]
          : []
      ),
      compRef.current.bracketMatching.of(
        editorSettings.bracketMatching !== false ? bracketMatching() : []
      ),
      compRef.current.closeBrackets.of(
        editorSettings.closeBrackets !== false ? closeBrackets() : []
      ),
      compRef.current.codeFolding.of(
        editorSettings.codeFolding !== false ? foldGutter() : []
      ),
      compRef.current.highlightSelMatch.of(
        editorSettings.highlightSelectionMatches !== false ? highlightSelectionMatches() : []
      ),
      compRef.current.autocompletion.of(
        editorSettings.autocompletion !== false
          ? autocompletion({ override: [markdownCompletions] })
          : []
      ),
      compRef.current.multiCursor.of(
        editorSettings.multiCursor !== false
          ? [EditorState.allowMultipleSelections.of(true), rectangularSelection(), crosshairCursor()]
          : []
      ),
      compRef.current.scrollPastEnd.of(
        editorSettings.scrollPastEnd !== false ? scrollPastEnd() : []
      ),
      compRef.current.indentOnInput.of(
        editorSettings.indentOnInput !== false ? indentOnInput() : []
      ),
      compRef.current.markdownLint.of(
        editorSettings.markdownLint !== false ? markdownLinterExtension : []
      ),
      compRef.current.textIndent.of(textIndent ? textIndentPlugin('2em') : []),
      // --- DOM 事件处理 ---
      EditorView.domEventHandlers({
        // 修复：编辑器无焦点时点击会导致错误选区扩展
        mousedown(event, view) {
          if (!view.hasFocus && event.button === 0 && !event.shiftKey) {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos != null) {
              event.preventDefault();
              view.dispatch({ selection: { anchor: pos } });
              view.focus();
              return true;
            }
          }
          return false;
        },
        paste(event, view) {
          const clipText = event.clipboardData?.getData('text/plain')?.trim();
          if (!clipText || !/^https?:\/\/\S+$/.test(clipText)) return false;
          const { from, to } = view.state.selection.main;
          if (from === to) return false; // 无选中文本，正常粘贴
          const sel = view.state.sliceDoc(from, to);
          const insert = `[${sel}](${clipText})`;
          view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } });
          event.preventDefault();
          return true;
        },
      }),
      // --- 静态扩展（始终启用） ---
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      syntaxHighlighting(markdownHighlightStyle, { fallback: true }),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      checkboxWidgetExtension,
      linkHoverTooltip,
      cmPlaceholder(placeholder),
      bookmarkExtension(),
      macroRecorderExtension,
      mdKeymap,
      keymap.of([
        { key: 'Backspace', run: deleteMarkupBackward },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...lintKeymap,
        { key: 'Mod-F2', run: toggleBookmark },
        { key: 'F2', run: nextBookmark },
        { key: 'Shift-F2', run: prevBookmark },
        { key: 'Mod-g', run: () => { window.dispatchEvent(new CustomEvent('editor-menu-action', { detail: 'goto_line' })); return true; } },
      ]),
      updateListener,
    ];

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({ state, parent });
    cmViewRef.current = view;
    if (editorRef) editorRef.current = view;

    // 初始化时跳转到指定行
    if (initialLine && initialLine > 1) {
      try {
        const lineInfo = view.state.doc.line(Math.min(initialLine, view.state.doc.lines));
        view.dispatch({
          selection: { anchor: lineInfo.from },
          scrollIntoView: true,
        });
      } catch { /* ignore */ }
    }

    return () => {
      view.destroy();
      cmViewRef.current = null;
      if (editorRef) editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖：只在挂载时创建一次，文档切换通过 key prop 重新挂载

  // 同步外部 value 变化到 EditorView（处理异步文档加载、版本恢复等场景）
  useEffect(() => {
    const view = cmViewRef.current;
    if (!view) return;
    // 只在外部值变化时更新（跳过自己 onChange 发出的值）
    if (value !== lastEmittedRef.current) {
      const currentDoc = view.state.doc.toString();
      if (value !== currentDoc) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
        });
      }
      setDocContent(value);
      lastEmittedRef.current = value;
    }
  }, [value]);

  // 动态更新 Compartment 设置（设置变化时无需重建编辑器，批量 dispatch）
  useEffect(() => {
    const view = cmViewRef.current;
    if (!view) return;
    const c = compRef.current;
    const effects = [
      c.tabSize.reconfigure(EditorState.tabSize.of(editorSettings.tabSize)),
      c.lineNumbers.reconfigure(editorSettings.showLineNumbers ? lineNumbers() : []),
      c.lineWrapping.reconfigure(editorSettings.wordWrap ? EditorView.lineWrapping : []),
      c.editable.reconfigure(EditorView.editable.of(editable)),
      c.theme.reconfigure(theme === 'dark' ? oneDark : []),
      c.spellCheck.reconfigure(
        editorSettings.spellCheck
          ? EditorView.contentAttributes.of({ spellcheck: 'true' })
          : EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' })
      ),
      c.highlightActiveLine.reconfigure(
        editorSettings.highlightActiveLine !== false
          ? [highlightActiveLine(), highlightActiveLineGutter()]
          : []
      ),
      c.bracketMatching.reconfigure(editorSettings.bracketMatching !== false ? bracketMatching() : []),
      c.closeBrackets.reconfigure(editorSettings.closeBrackets !== false ? closeBrackets() : []),
      c.codeFolding.reconfigure(editorSettings.codeFolding !== false ? foldGutter() : []),
      // 大文档时自动禁用选中匹配高亮（全文扫描开销大）
      c.highlightSelMatch.reconfigure(
        editorSettings.highlightSelectionMatches !== false && !isLargeDoc ? highlightSelectionMatches() : []
      ),
      c.autocompletion.reconfigure(
        editorSettings.autocompletion !== false
          ? autocompletion({ override: [markdownCompletions] })
          : []
      ),
      c.multiCursor.reconfigure(
        editorSettings.multiCursor !== false
          ? [EditorState.allowMultipleSelections.of(true), rectangularSelection(), crosshairCursor()]
          : []
      ),
      c.scrollPastEnd.reconfigure(editorSettings.scrollPastEnd !== false ? scrollPastEnd() : []),
      c.indentOnInput.reconfigure(editorSettings.indentOnInput !== false ? indentOnInput() : []),
      // 大文档时自动禁用 Markdown lint（逐行扫描开销大）
      c.markdownLint.reconfigure(
        editorSettings.markdownLint !== false && !isLargeDoc ? markdownLinterExtension : []
      ),
      c.textIndent.reconfigure(textIndent ? textIndentPlugin('2em') : []),
    ];
    view.dispatch({ effects });
  }, [
    editorSettings.tabSize, editorSettings.showLineNumbers, editorSettings.wordWrap,
    editable, theme, editorSettings.spellCheck, editorSettings.highlightActiveLine,
    editorSettings.bracketMatching, editorSettings.closeBrackets, editorSettings.codeFolding,
    editorSettings.highlightSelectionMatches, editorSettings.autocompletion,
    editorSettings.multiCursor, editorSettings.scrollPastEnd, editorSettings.indentOnInput,
    editorSettings.markdownLint, isLargeDoc, textIndent,
  ]);

  // 编辑器字体样式
  const editorFontStyle = useMemo(() => ({
    '--cm-font-size': `${localFontSize}px`,
    '--cm-font-family': editorSettings.fontFamily,
    '--cm-line-height': `${editorSettings.lineHeight}`,
  } as React.CSSProperties), [localFontSize, editorSettings.fontFamily, editorSettings.lineHeight]);

  // 统计数据（useMemo 避免每次渲染重算）
  const { characterCount, wordCount, lineCount } = useMemo(() => {
    const chars = docContent.length;
    // 用正则匹配计数代替 split+filter，减少大文档开销
    const words = (docContent.match(/\S+/g) || []).length;
    const lines = docContent.split('\n').length;
    return { characterCount: chars, wordCount: words, lineCount: lines };
  }, [docContent]);

  // 面包屑导航：显示当前光标所在章节路径
  const breadcrumb = useMemo(() => {
    const headings = parseHeadings(docContent);
    return getBreadcrumb(headings, cursorInfo.from);
  }, [docContent, cursorInfo.from]);

  const handleBreadcrumbClick = useCallback((from: number) => {
    const view = cmViewRef.current;
    if (!view) return;
    try {
      const pos = Math.min(from, view.state.doc.length);
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: 'start' }),
      });
      view.focus();
    } catch { /* view may be destroyed */ }
  }, []);

  const showPreview = viewMode === 'preview' || viewMode === 'split';

  // 分屏滚动同步：编辑区 → 预览区（rAF 节流，每帧最多同步一次）
  const handleEditorScroll = useCallback(() => {
    if (viewMode !== 'split' || scrollSyncLock.current) return;
    scrollSyncLock.current = true;
    requestAnimationFrame(() => {
      const editorEl = editorDivRef.current?.querySelector('.cm-scroller') as HTMLElement | null;
      const previewEl = previewRef.current;
      if (editorEl && previewEl) {
        const editorMaxScroll = editorEl.scrollHeight - editorEl.clientHeight;
        if (editorMaxScroll > 0) {
          const ratio = editorEl.scrollTop / editorMaxScroll;
          const previewMaxScroll = previewEl.scrollHeight - previewEl.clientHeight;
          previewEl.scrollTop = ratio * previewMaxScroll;
        }
      }
      scrollSyncLock.current = false;
    });
  }, [viewMode]);

  // 监听编辑区滚动
  useEffect(() => {
    if (viewMode !== 'split') return;
    const scroller = editorDivRef.current?.querySelector('.cm-scroller') as HTMLElement | null;
    if (!scroller) return;
    scroller.addEventListener('scroll', handleEditorScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', handleEditorScroll);
  }, [viewMode, handleEditorScroll]);

  // 选中文本检测：mouseup 时弹出浮动AI工具条
  const toolbarEnabled = enableSelectionToolbar && editorSettings.selectionToolbar?.enabled !== false;
  const toolbarTriggerAuto = editorSettings.selectionToolbar?.triggerMode !== 'manual';
  useEffect(() => {
    if (!toolbarEnabled || !toolbarTriggerAuto) return;
    const handleMouseUp = () => {
      const view = cmViewRef.current;
      if (!view) return;
      setTimeout(() => {
        try {
          const { from, to } = view.state.selection.main;
          if (to - from > 2) {
            const text = view.state.sliceDoc(from, to);
            const coords = view.coordsAtPos(from);
            if (coords) {
              setSelToolbar({ visible: true, x: coords.left, y: coords.top, text, from, to });
            }
          } else {
            setSelToolbar(prev => prev.visible ? { ...prev, visible: false } : prev);
          }
        } catch { /* view destroyed */ }
      }, 50);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [toolbarEnabled, toolbarTriggerAuto]);

  // ── 系统菜单事件监听（通过 useMenuEvents 转发的 CustomEvent） ──
  useEffect(() => {
    const handler = (e: Event) => {
      const view = cmViewRef.current;
      if (!view) return;
      const id = (e as CustomEvent<string>).detail;
      if (!id) return;
      try {
        // 使用持久保存的选中状态（系统菜单点击会导致编辑器失焦，实时 selection 已被清除）
        const { from, to, text: sel, hasSelection } = lastSelectionRef.current;

        // 文本转换类：对选中文本或全文执行转换
        const transformMap: Record<string, (t: string) => string> = {
          to_uppercase: TU.toUpperCase, to_lowercase: TU.toLowerCase,
          swap_case: TU.swapCase, title_case: TU.titleCase,
          to_simplified: TU.toSimplified, to_traditional: TU.toTraditional,
          to_fullwidth: TU.toFullWidth, to_halfwidth: TU.toHalfWidth,
          to_cn_punct: TU.toChinesePunctuation, to_en_punct: TU.toEnglishPunctuation,
          remove_empty_lines: TU.removeEmptyLines, trim_lines: TU.trimLines,
          collapse_spaces: TU.collapseSpaces,
          url_encode: TU.urlEncode, url_decode: TU.urlDecode,
          base64_encode: TU.base64Encode, base64_decode: TU.base64Decode,
          line_sort_asc: TU.sortLinesAsc, line_sort_desc: TU.sortLinesDesc,
          line_deduplicate: TU.deduplicateLines, line_reverse: TU.reverseLines,
          line_shuffle: TU.shuffleLines,
          // 中文排版
          cn_paragraph_indent: TU.addParagraphIndent,
          cn_remove_indent: TU.removeParagraphIndent,
          cn_space_cn_en: TU.addSpaceBetweenCnEn,
          cn_normalize_quotes: TU.normalizeQuotes,
          cn_compress_blank: TU.compressBlankLines,
          cn_reformat_para: TU.reformatParagraphs,
          cn_remove_trailing: TU.removeTrailingSpaces,
          // 文本处理扩展
          tp_remove_trailing: TU.removeTrailingSpaces,
          tp_add_line_numbers: TU.addLineNumbers,
          tp_remove_line_numbers: TU.removeLineNumbers,
          tp_strip_html: TU.stripHtmlTags,
          tp_strip_markdown: TU.stripMarkdown,
          tp_wrap_column: TU.wrapAtColumn,
          // 编码转换
          enc_unicode_escape: TU.unicodeEscape,
          enc_unicode_unescape: TU.unicodeUnescape,
          enc_html_entity_encode: TU.htmlEntityEncode,
          enc_html_entity_decode: TU.htmlEntityDecode,
          enc_json_escape: TU.jsonStringEscape,
          enc_json_unescape: TU.jsonStringUnescape,
          enc_num_to_chinese: TU.numberToChinese,
          enc_chinese_to_num: TU.chineseToNumber,
        };
        const transformFn = transformMap[id];
        if (transformFn) {
          const target = hasSelection ? sel : view.state.doc.toString();
          const result = transformFn(target);
          const rFrom = hasSelection ? from : 0;
          const rTo = hasSelection ? to : view.state.doc.length;
          view.dispatch({ changes: { from: rFrom, to: rTo, insert: result } });
          view.focus();
          return;
        }

        // 行操作类
        if (id === 'line_move_up') {
          const line = view.state.doc.lineAt(from);
          if (line.number <= 1) return;
          const prevLine = view.state.doc.line(line.number - 1);
          view.dispatch({ changes: [
            { from: prevLine.from, to: prevLine.to + 1, insert: '' },
            { from: line.to, to: line.to, insert: '\n' + prevLine.text },
          ] });
          view.focus(); return;
        }
        if (id === 'line_move_down') {
          const line = view.state.doc.lineAt(from);
          if (line.number >= view.state.doc.lines) return;
          const nextLine = view.state.doc.line(line.number + 1);
          view.dispatch({ changes: [
            { from: nextLine.from - 1, to: nextLine.to, insert: '' },
            { from: line.from, to: line.from, insert: nextLine.text + '\n' },
          ] });
          view.focus(); return;
        }
        if (id === 'line_duplicate') {
          const line = view.state.doc.lineAt(from);
          view.dispatch({ changes: { from: line.to, to: line.to, insert: '\n' + line.text } });
          view.focus(); return;
        }
        if (id === 'line_delete') {
          const line = view.state.doc.lineAt(from);
          const delFrom = line.from === 0 ? 0 : line.from - 1;
          const delTo = line.to === view.state.doc.length ? line.to : line.to + 1;
          view.dispatch({ changes: { from: delFrom, to: delTo, insert: '' } });
          view.focus(); return;
        }
        if (id === 'line_join') {
          if (!hasSelection) return;
          const startLine = view.state.doc.lineAt(from);
          const endLine = view.state.doc.lineAt(to);
          if (startLine.number === endLine.number) return;
          const lines: string[] = [];
          for (let i = startLine.number; i <= endLine.number; i++) lines.push(view.state.doc.line(i).text);
          view.dispatch({ changes: { from: startLine.from, to: endLine.to, insert: lines.join(' ') } });
          view.focus(); return;
        }

        // 选择类
        if (id === 'select_line') {
          const line = view.state.doc.lineAt(from);
          view.dispatch({ selection: { anchor: line.from, head: line.to } });
          view.focus(); return;
        }
        if (id === 'select_word') {
          const wordAt = view.state.wordAt(from);
          if (wordAt) view.dispatch({ selection: { anchor: wordAt.from, head: wordAt.to } });
          view.focus(); return;
        }
        if (id === 'select_paragraph') {
          let pFrom = from, pTo = from;
          while (pFrom > 0 && view.state.doc.sliceString(pFrom - 1, pFrom) !== '\n') pFrom--;
          while (pTo < view.state.doc.length && view.state.doc.sliceString(pTo, pTo + 1) !== '\n') pTo++;
          view.dispatch({ selection: { anchor: pFrom, head: pTo } });
          view.focus(); return;
        }

        // 文本格式类
        const wrapMap: Record<string, [string, string, string]> = {
          fmt_bold: ['**', '**', '粗体文本'],
          fmt_italic: ['*', '*', '斜体文本'],
          fmt_strikethrough: ['~~', '~~', '删除线文本'],
          fmt_inline_code: ['`', '`', '代码'],
          fmt_highlight: ['==', '==', '高亮文本'],
          fmt_superscript: ['^', '^', '上标'],
          fmt_subscript: ['~', '~', '下标'],
        };
        const wrap = wrapMap[id];
        if (wrap) {
          const [prefix, suffix, ph] = wrap;
          const text = sel || ph;
          view.dispatch({
            changes: { from, to, insert: prefix + text + suffix },
            selection: { anchor: from + prefix.length, head: from + prefix.length + text.length },
          });
          view.focus(); return;
        }

        // 插入类
        if (id === 'insert_date') { const ins = TU.currentDate(); view.dispatch({ changes: { from, to: from, insert: ins } }); view.focus(); return; }
        if (id === 'insert_time') { const ins = TU.currentTime(); view.dispatch({ changes: { from, to: from, insert: ins } }); view.focus(); return; }
        if (id === 'insert_datetime') { const ins = TU.currentDateTime(); view.dispatch({ changes: { from, to: from, insert: ins } }); view.focus(); return; }
        if (id === 'insert_hr') { view.dispatch({ changes: { from, to: from, insert: '\n---\n' } }); view.focus(); return; }

        // 粘贴（从 useMenuEvents 转发的 CodeMirror 粘贴）
        if (id === 'paste' || id === 'paste_plain') {
          navigator.clipboard.readText().then(text => {
            if (text) {
              view.dispatch({ changes: { from, to: hasSelection ? to : from, insert: text } });
              view.focus();
            }
          }).catch(() => {});
          return;
        }

        // 插入链接
        if (id === 'insert_link') {
          const linkText = sel || '链接文本';
          const ins = `[${linkText}](url)`;
          view.dispatch({ changes: { from, to, insert: ins }, selection: { anchor: from + linkText.length + 3, head: from + linkText.length + 6 } });
          view.focus(); return;
        }
        // 插入图片
        if (id === 'insert_image') {
          const ins = '![图片描述](url)';
          view.dispatch({ changes: { from, to: from, insert: ins }, selection: { anchor: from + 2, head: from + 6 } });
          view.focus(); return;
        }

        // 查找替换
        if (id === 'find_replace') { openSearchPanel(view); return; }

        // 书签操作
        if (id === 'bm_toggle') { toggleBookmark(view); return; }
        if (id === 'bm_next') { nextBookmark(view); return; }
        if (id === 'bm_prev') { prevBookmark(view); return; }
        if (id === 'bm_clear') { clearAllBookmarks(view); return; }

        // 宏操作
        if (id === 'macro_toggle_record') { macroRecorder.toggleRecording(); return; }
        if (id === 'macro_replay') { macroRecorder.replay(view); return; }

      } catch { /* view destroyed */ }
    };
    window.addEventListener('editor-menu-action', handler);
    return () => { window.removeEventListener('editor-menu-action', handler); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelReplace = useCallback((text: string) => {
    const view = cmViewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: selToolbar.from, to: selToolbar.to, insert: text },
      selection: { anchor: selToolbar.from + text.length },
    });
    view.focus();
  }, [selToolbar.from, selToolbar.to]);

  const handleSelInsertAfter = useCallback((text: string) => {
    const view = cmViewRef.current;
    if (!view) return;
    const insertPos = selToolbar.to;
    view.dispatch({
      changes: { from: insertPos, to: insertPos, insert: '\n\n' + text },
      selection: { anchor: insertPos + text.length + 2 },
    });
    view.focus();
  }, [selToolbar.to]);

  return (
    <div className="flex flex-col h-full bg-background rounded-md border overflow-hidden">
      {/* 工具栏 */}
      {showToolbar && (
        <div className="border-b bg-background flex-shrink-0">
          <EditorToolbar
            cmViewRef={cmViewRef}
            outlineOpen={outlineOpen}
            onToggleOutline={viewMode !== 'preview' ? () => setOutlineOpen(o => !o) : undefined}
            viewMode={viewMode}
            onViewModeChange={showViewModeSwitch ? setViewMode : undefined}
            showViewModeSwitch={showViewModeSwitch}
            importSources={importSources}
            fontSize={localFontSize}
            onFontSizeChange={setLocalFontSize}
            exportCallbacks={exportCallbacks}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* 文档大纲（左侧） */}
        {viewMode !== 'preview' && outlineOpen && (
          <DocumentOutline
            cmViewRef={cmViewRef}
            content={docContent}
            cursorPos={cursorInfo.from}
            className="border-r shrink-0"
          />
        )}

        {/* 编辑区（始终挂载，通过 CSS 控制显隐，保证 EditorView 不被销毁） */}
        <div
          ref={editorDivRef}
          className={cn('h-full overflow-hidden cm-font-override flex-1 min-w-0', {
            'border-r': viewMode === 'split',
            'hidden': viewMode === 'preview',
          })}
          style={editorFontStyle}
          onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ visible: true, x: e.clientX, y: e.clientY }); }}
        />

        {/* 预览区 */}
        {showPreview && (
          <div ref={previewRef} className={cn('h-full overflow-y-auto', viewMode === 'split' ? 'flex-1 min-w-0' : 'w-full')}>
            <MarkdownPreview
              content={docContent}
              theme={theme}
              className="px-4 py-3"
              fontSize={localFontSize}
              fontFamily={editorSettings.fontFamily}
            />
          </div>
        )}
      </div>

      {showStatusBar && (
        <EditorStatusBar
          lines={lineCount}
          words={wordCount}
          chars={characterCount}
          cursorLine={cursorInfo.line}
          cursorCol={cursorInfo.col}
          selectionChars={cursorInfo.selChars}
          isLargeDoc={isLargeDoc}
          breadcrumb={breadcrumb}
          onBreadcrumbClick={handleBreadcrumbClick}
          content={docContent}
        />
      )}

      {/* 浮动AI工具条 */}
      {toolbarEnabled && (
        <EditorSelectionToolbar
          visible={selToolbar.visible}
          position={{ x: selToolbar.x, y: selToolbar.y }}
          selectedText={selToolbar.text}
          onClose={() => setSelToolbar(prev => ({ ...prev, visible: false }))}
          onReplace={handleSelReplace}
          onInsertAfter={handleSelInsertAfter}
        />
      )}

      {/* 右键菜单 */}
      <EditorContextMenu
        cmViewRef={cmViewRef}
        visible={ctxMenu.visible}
        position={{ x: ctxMenu.x, y: ctxMenu.y }}
        onClose={() => setCtxMenu({ visible: false, x: 0, y: 0 })}
      />

      {/* 跳转到行对话框 */}
      <GotoLineDialog cmViewRef={cmViewRef} />
    </div>
  );
}

// 辅助函数
function wrapSelection(view: EditorView, prefix: string, suffix: string, placeholder: string) {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  const text = sel || placeholder;
  const insert = prefix + text + suffix;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + prefix.length, head: from + prefix.length + text.length },
  });
}
