/**
 * EditorContextMenu — 编辑器右键上下文菜单
 *
 * 精选常用操作：剪贴板、选择、格式、行操作、文本转换、插入
 * 通过 CodeMirror EditorView 执行操作
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import { openSearchPanel } from '@codemirror/search';
import * as TU from '@/lib/textUtils';

const MENU_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '14px' };

interface EditorContextMenuProps {
  cmViewRef: React.RefObject<EditorView | null>;
  visible: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

type MenuAction = { label: string; shortcut?: string; action: (view: EditorView) => void; danger?: boolean };
type MenuGroup = (MenuAction | 'sep' | { label: string; children: (MenuAction | 'sep')[] })[];

function getSelection(view: EditorView): { from: number; to: number; text: string; hasSelection: boolean } {
  const { from, to } = view.state.selection.main;
  return { from, to, text: view.state.sliceDoc(from, to), hasSelection: to > from };
}

function applyTransform(view: EditorView, fn: (t: string) => string) {
  const { from, to, text, hasSelection } = getSelection(view);
  const target = hasSelection ? text : view.state.doc.toString();
  const result = fn(target);
  view.dispatch({ changes: { from: hasSelection ? from : 0, to: hasSelection ? to : view.state.doc.length, insert: result } });
  view.focus();
}

function wrapSelection(view: EditorView, prefix: string, suffix: string, placeholder: string) {
  const { from, to, text } = getSelection(view);
  const t = text || placeholder;
  view.dispatch({
    changes: { from, to, insert: prefix + t + suffix },
    selection: { anchor: from + prefix.length, head: from + prefix.length + t.length },
  });
  view.focus();
}

function insertText(view: EditorView, text: string) {
  const { from } = view.state.selection.main;
  view.dispatch({ changes: { from, to: from, insert: text } });
  view.focus();
}

export default function EditorContextMenu({ cmViewRef, visible, position, onClose }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) { setOpenSub(null); return; }
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [visible, onClose]);

  const exec = useCallback((fn: (view: EditorView) => void) => {
    onClose();
    setTimeout(() => { const v = cmViewRef.current; if (v) fn(v); }, 0);
  }, [cmViewRef, onClose]);

  if (!visible) return null;

  const menuGroups: MenuGroup = [
    // 剪贴板
    { label: '剪切', shortcut: '⌘X', action: (v) => { const s = getSelection(v); if (s.hasSelection) { navigator.clipboard.writeText(s.text); v.dispatch({ changes: { from: s.from, to: s.to, insert: '' } }); } } },
    { label: '复制', shortcut: '⌘C', action: (v) => { const s = getSelection(v); if (s.hasSelection) navigator.clipboard.writeText(s.text); } },
    { label: '粘贴', shortcut: '⌘V', action: async (v) => { const t = await navigator.clipboard.readText(); if (t) insertText(v, t); } },
    'sep',
    // 选择
    { label: '全选', shortcut: '⌘A', action: (v) => { v.dispatch({ selection: { anchor: 0, head: v.state.doc.length } }); v.focus(); } },
    { label: '选择当前行', shortcut: '⌘L', action: (v) => { const l = v.state.doc.lineAt(v.state.selection.main.from); v.dispatch({ selection: { anchor: l.from, head: l.to } }); v.focus(); } },
    { label: '选择当前词', shortcut: '⌘D', action: (v) => { const w = v.state.wordAt(v.state.selection.main.from); if (w) v.dispatch({ selection: { anchor: w.from, head: w.to } }); v.focus(); } },
    'sep',
    // 查找
    { label: '查找...', shortcut: '⌘F', action: (v) => openSearchPanel(v) },
    { label: '查找替换...', shortcut: '⌘H', action: (v) => openSearchPanel(v) },
    'sep',
    // 文本格式
    { label: '文本格式', children: [
      { label: '粗体', shortcut: '⌘B', action: (v) => wrapSelection(v, '**', '**', '粗体文本') },
      { label: '斜体', shortcut: '⌘I', action: (v) => wrapSelection(v, '*', '*', '斜体文本') },
      { label: '删除线', action: (v) => wrapSelection(v, '~~', '~~', '删除线文本') },
      { label: '行内代码', shortcut: '⌘E', action: (v) => wrapSelection(v, '`', '`', '代码') },
      'sep',
      { label: '高亮标记', action: (v) => wrapSelection(v, '==', '==', '高亮文本') },
      { label: '上标', action: (v) => wrapSelection(v, '^', '^', '上标') },
      { label: '下标', action: (v) => wrapSelection(v, '~', '~', '下标') },
    ] },
    // 行操作
    { label: '行操作', children: [
      { label: '上移行', shortcut: 'Alt+↑', action: (v) => { const l = v.state.doc.lineAt(v.state.selection.main.from); if (l.number <= 1) return; const p = v.state.doc.line(l.number - 1); v.dispatch({ changes: [{ from: p.from, to: p.to + 1, insert: '' }, { from: l.to, to: l.to, insert: '\n' + p.text }] }); } },
      { label: '下移行', shortcut: 'Alt+↓', action: (v) => { const l = v.state.doc.lineAt(v.state.selection.main.from); if (l.number >= v.state.doc.lines) return; const n = v.state.doc.line(l.number + 1); v.dispatch({ changes: [{ from: n.from - 1, to: n.to, insert: '' }, { from: l.from, to: l.from, insert: n.text + '\n' }] }); } },
      { label: '复制行', shortcut: '⌘⇧D', action: (v) => { const l = v.state.doc.lineAt(v.state.selection.main.from); v.dispatch({ changes: { from: l.to, to: l.to, insert: '\n' + l.text } }); } },
      { label: '删除行', shortcut: '⌘⇧K', action: (v) => { const l = v.state.doc.lineAt(v.state.selection.main.from); const df = l.from === 0 ? 0 : l.from - 1; const dt = l.to === v.state.doc.length ? l.to : l.to + 1; v.dispatch({ changes: { from: df, to: dt, insert: '' } }); } },
      'sep',
      { label: '行排序（升序）', action: (v) => applyTransform(v, TU.sortLinesAsc) },
      { label: '行排序（降序）', action: (v) => applyTransform(v, TU.sortLinesDesc) },
      { label: '去除重复行', action: (v) => applyTransform(v, TU.deduplicateLines) },
      { label: '反转行序', action: (v) => applyTransform(v, TU.reverseLines) },
      { label: '打乱行序', action: (v) => applyTransform(v, TU.shuffleLines) },
    ] },
    // 文本转换
    { label: '文本转换', children: [
      { label: '转为大写', action: (v) => applyTransform(v, TU.toUpperCase) },
      { label: '转为小写', action: (v) => applyTransform(v, TU.toLowerCase) },
      { label: '大小写互换', action: (v) => applyTransform(v, TU.swapCase) },
      { label: '首字母大写', action: (v) => applyTransform(v, TU.titleCase) },
      'sep',
      { label: '繁体→简体', action: (v) => applyTransform(v, TU.toSimplified) },
      { label: '简体→繁体', action: (v) => applyTransform(v, TU.toTraditional) },
      'sep',
      { label: '全角→半角', action: (v) => applyTransform(v, TU.toHalfWidth) },
      { label: '半角→全角', action: (v) => applyTransform(v, TU.toFullWidth) },
      'sep',
      { label: '中文标点→英文', action: (v) => applyTransform(v, TU.toEnglishPunctuation) },
      { label: '英文标点→中文', action: (v) => applyTransform(v, TU.toChinesePunctuation) },
    ] },
    // 文本处理
    { label: '文本处理', children: [
      { label: '去除空行', action: (v) => applyTransform(v, TU.removeEmptyLines) },
      { label: 'Trim 空格', action: (v) => applyTransform(v, TU.trimLines) },
      { label: '合并连续空格', action: (v) => applyTransform(v, TU.collapseSpaces) },
      'sep',
      { label: 'URL 编码', action: (v) => applyTransform(v, TU.urlEncode) },
      { label: 'URL 解码', action: (v) => applyTransform(v, TU.urlDecode) },
      { label: 'Base64 编码', action: (v) => applyTransform(v, TU.base64Encode) },
      { label: 'Base64 解码', action: (v) => applyTransform(v, TU.base64Decode) },
    ] },
    'sep',
    // 插入
    { label: '插入', children: [
      { label: '当前日期', action: (v) => insertText(v, TU.currentDate()) },
      { label: '当前时间', action: (v) => insertText(v, TU.currentTime()) },
      { label: '日期+时间', action: (v) => insertText(v, TU.currentDateTime()) },
      'sep',
      { label: '分隔线', action: (v) => insertText(v, '\n---\n') },
    ] },
  ];

  const itemClass = 'flex items-center justify-between px-3 py-1 text-sm cursor-pointer hover:bg-accent rounded-sm transition-colors w-full text-left';
  const subTriggerClass = 'flex items-center justify-between px-3 py-1 text-sm cursor-pointer hover:bg-accent rounded-sm transition-colors w-full text-left';

  const renderItem = (item: MenuAction | 'sep' | { label: string; children: (MenuAction | 'sep')[] }, idx: number) => {
    if (item === 'sep') return <div key={idx} className="h-px bg-border my-1" />;
    if ('children' in item) {
      const isOpen = openSub === item.label;
      return (
        <div key={idx} className="relative"
          onMouseEnter={() => setOpenSub(item.label)}
          onMouseLeave={() => setOpenSub(null)}>
          <button className={subTriggerClass}>
            <span>{item.label}</span>
            <span className="text-muted-foreground ml-4">▸</span>
          </button>
          {isOpen && (
            <div className="absolute left-full top-0 ml-0.5 min-w-[180px] rounded-md border p-1 shadow-lg z-[10000]"
              style={{ ...MENU_STYLE, backgroundColor: 'hsl(var(--card))', opacity: 1 }}>
              {item.children.map((child, ci) => renderItem(child, ci))}
            </div>
          )}
        </div>
      );
    }
    return (
      <button key={idx} className={itemClass} onClick={() => exec(item.action)}>
        <span>{item.label}</span>
        {item.shortcut && <span className="text-[10px] text-muted-foreground ml-4">{item.shortcut}</span>}
      </button>
    );
  };

  return (
    <div ref={menuRef}
      className="fixed z-[9999] min-w-[200px] rounded-md border p-1 shadow-xl"
      style={{
        left: Math.min(position.x, window.innerWidth - 220),
        top: Math.min(position.y, window.innerHeight - 400),
        ...MENU_STYLE,
        opacity: 1,
        backgroundColor: 'hsl(var(--card))',
      }}>
      {menuGroups.map((item, i) => renderItem(item, i))}
    </div>
  );
}
