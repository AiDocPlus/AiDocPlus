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
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { cn } from '@/lib/utils';
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
import { DocumentOutline } from './DocumentOutline';

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
}: MarkdownEditorProps) {
  const editorDivRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const cmViewRef = useRef<EditorView | null>(null);
  const scrollSyncLock = useRef(false);
  const compRef = useRef(createCompartments());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCursorLineChangeRef = useRef(onCursorLineChange);
  onCursorLineChangeRef.current = onCursorLineChange;
  const lastEmittedRef = useRef(value);
  const docContentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editorSettings = useEditorSettings();
  const [localFontSize, setLocalFontSize] = useState(editorSettings.fontSize);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1, selChars: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>(editorSettings.defaultViewMode || 'edit');
  const [docContent, setDocContent] = useState(value);
  const [outlineOpen, setOutlineOpen] = useState(false);

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
        if (docContentTimerRef.current) clearTimeout(docContentTimerRef.current);
        docContentTimerRef.current = setTimeout(() => {
          setDocContent(newDoc);
          docContentTimerRef.current = null;
        }, 300);
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
            if (prev.line === newLine && prev.col === newCol && prev.selChars === newSelChars) return prev;
            return { line: newLine, col: newCol, selChars: newSelChars };
          });
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
      // --- 粘贴 URL 自动转链接 ---
      EditorView.domEventHandlers({
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
      mdKeymap,
      keymap.of([
        { key: 'Backspace', run: deleteMarkupBackward },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...lintKeymap,
      ]),
      updateListener,
    ];

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({ state, parent });
    cmViewRef.current = view;

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
      c.highlightSelMatch.reconfigure(editorSettings.highlightSelectionMatches !== false ? highlightSelectionMatches() : []),
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
      c.markdownLint.reconfigure(editorSettings.markdownLint !== false ? markdownLinterExtension : []),
    ];
    view.dispatch({ effects });
  }, [
    editorSettings.tabSize, editorSettings.showLineNumbers, editorSettings.wordWrap,
    editable, theme, editorSettings.spellCheck, editorSettings.highlightActiveLine,
    editorSettings.bracketMatching, editorSettings.closeBrackets, editorSettings.codeFolding,
    editorSettings.highlightSelectionMatches, editorSettings.autocompletion,
    editorSettings.multiCursor, editorSettings.scrollPastEnd, editorSettings.indentOnInput,
    editorSettings.markdownLint,
  ]);

  // 编辑器字体样式
  const editorFontStyle = useMemo(() => ({
    '--cm-font-size': `${localFontSize}px`,
    '--cm-font-family': editorSettings.fontFamily,
    '--cm-line-height': `${editorSettings.lineHeight}`,
  } as React.CSSProperties), [localFontSize, editorSettings.fontFamily, editorSettings.lineHeight]);

  // 统计数据
  const characterCount = docContent.length;
  const wordCount = docContent.split(/\s+/).filter((w: string) => w).length;
  const lineCount = docContent.split('\n').length;

  const showPreview = viewMode === 'preview' || viewMode === 'split';

  // 分屏滚动同步：编辑区 → 预览区
  const handleEditorScroll = useCallback(() => {
    if (viewMode !== 'split' || scrollSyncLock.current) return;
    const editorEl = editorDivRef.current?.querySelector('.cm-scroller') as HTMLElement | null;
    const previewEl = previewRef.current;
    if (!editorEl || !previewEl) return;
    const editorMaxScroll = editorEl.scrollHeight - editorEl.clientHeight;
    if (editorMaxScroll <= 0) return;
    const ratio = editorEl.scrollTop / editorMaxScroll;
    const previewMaxScroll = previewEl.scrollHeight - previewEl.clientHeight;
    scrollSyncLock.current = true;
    previewEl.scrollTop = ratio * previewMaxScroll;
    requestAnimationFrame(() => { scrollSyncLock.current = false; });
  }, [viewMode]);

  // 监听编辑区滚动
  useEffect(() => {
    if (viewMode !== 'split') return;
    const scroller = editorDivRef.current?.querySelector('.cm-scroller') as HTMLElement | null;
    if (!scroller) return;
    scroller.addEventListener('scroll', handleEditorScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', handleEditorScroll);
  }, [viewMode, handleEditorScroll]);

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

      <EditorStatusBar
        lines={lineCount}
        words={wordCount}
        chars={characterCount}
        cursorLine={cursorInfo.line}
        cursorCol={cursorInfo.col}
        selectionChars={cursorInfo.selChars}
      />
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
