/**
 * 幕布式大纲编辑器 - 对标幕布核心编辑体验
 *
 * 功能：拖拽排序、圆点悬浮菜单、撤销/重做、完成状态、备注、展开/折叠、
 *       上下移动、克隆节点、键盘快捷键（对标幕布完整快捷键表）
 */
import { useState, useCallback, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ChevronRight, ChevronDown, GripVertical, Check, Trash2, MessageSquare, Copy, Search, X, Home } from 'lucide-react';
import type { SMNode } from './mindmapConverter';
import { mindMapDataToMarkdown } from './mindmapConverter';

// ── 类型定义 ──

interface FlatNode {
  path: number[];
  depth: number;
  text: string;
  note: string;
  completed: boolean;
  hasChildren: boolean;
  expanded: boolean;
  childCount: number;
  key: string;
}

export interface OutlineEditorProps {
  data: SMNode;
  onDataChange: (data: SMNode) => void;
  className?: string;
}

export interface OutlineEditorRef {
  undo: () => void;
  redo: () => void;
  getSelectedNodePath: () => number[] | null;
  openSearch: () => void;
  focusOnNode: (path: number[]) => void;
  exitFocus: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  getActiveNodeInfo: () => { text: string; isRoot: boolean; path: string[]; childCount: number } | null;
  getActiveBranchMarkdown: () => string | null;
  insertChildrenToActive: (children: SMNode[]) => void;
  updateActiveNodeText: (text: string) => void;
  updateActiveNodeChildren: (children: SMNode[]) => void;
  setActiveNodeNote: (note: string) => void;
  // 工具栏操作
  addSibling: () => void;
  deleteNode: () => void;
  moveUp: () => void;
  moveDown: () => void;
  indent: () => void;
  outdent: () => void;
  cloneNode: () => void;
  toggleComplete: () => void;
}

// ── 工具函数 ──

function cloneTree(n: SMNode): SMNode {
  return { data: { ...n.data }, children: (n.children || []).map(cloneTree) };
}

function getNode(root: SMNode, path: number[]): SMNode | null {
  let cur: SMNode | undefined = root;
  for (const i of path) {
    if (!cur?.children || i >= cur.children.length) return null;
    cur = cur.children[i];
  }
  return cur ?? null;
}

function countDescendants(n: SMNode): number {
  let c = 0;
  if (n.children?.length) for (const ch of n.children) c += 1 + countDescendants(ch);
  return c;
}

function flatten(root: SMNode, collapsed: Set<string>): FlatNode[] {
  const res: FlatNode[] = [];
  function walk(n: SMNode, p: number[], d: number) {
    const key = p.length === 0 ? 'root' : p.join('-');
    const hc = !!(n.children?.length);
    const exp = !collapsed.has(key);
    const cc = hc ? countDescendants(n) : 0;
    res.push({
      path: [...p], depth: d, text: n.data?.text || '',
      note: (n.data as any)?.note || '',
      completed: !!(n.data as any)?.completed,
      hasChildren: hc, expanded: exp, childCount: cc, key,
    });
    if (hc && exp) n.children.forEach((c, i) => walk(c, [...p, i], d + 1));
  }
  walk(root, [], 0);
  return res;
}

// ── 撤销/重做栈 ──
const MAX_UNDO = 50;

function useUndoStack(data: SMNode, onDataChange: (d: SMNode) => void) {
  const undoStack = useRef<SMNode[]>([]);
  const redoStack = useRef<SMNode[]>([]);
  const lastData = useRef<SMNode>(data);

  const push = useCallback((newData: SMNode) => {
    undoStack.current.push(cloneTree(lastData.current));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    lastData.current = newData;
    onDataChange(newData);
  }, [onDataChange]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(cloneTree(lastData.current));
    lastData.current = prev;
    onDataChange(prev);
  }, [onDataChange]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(cloneTree(lastData.current));
    lastData.current = next;
    onDataChange(next);
  }, [onDataChange]);

  // 外部数据变更时同步
  useEffect(() => { lastData.current = data; }, [data]);

  return { push, undo, redo, canUndo: () => undoStack.current.length > 0, canRedo: () => redoStack.current.length > 0 };
}

// ── 主组件 ──

export const OutlineEditor = forwardRef<OutlineEditorRef, OutlineEditorProps>(
  function OutlineEditor({ data, onDataChange, className }, ref) {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [fKey, setFKey] = useState<string | null>(null);
    const [fEnd, setFEnd] = useState(false);
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');
    const [dragKey, setDragKey] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [focusedKey, setFocusedKey] = useState<string | null>(null);
    // Phase 2: 搜索
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    // Phase 2: 专注模式 (focusPath = 进入子树的路径)
    const [focusPath, setFocusPath] = useState<number[] | null>(null);
    // Phase 2: 多选
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
    const { push, undo, redo } = useUndoStack(data, onDataChange);

    // 专注模式：取子树作为虚拟根
    const focusNode = useMemo(() => {
      if (!focusPath) return data;
      return getNode(data, focusPath) || data;
    }, [data, focusPath]);

    // 面包屑路径
    const breadcrumbs = useMemo(() => {
      if (!focusPath) return [];
      const crumbs: { label: string; path: number[] }[] = [{ label: data.data?.text || '根节点', path: [] }];
      for (let i = 1; i <= focusPath.length; i++) {
        const p = focusPath.slice(0, i);
        const n = getNode(data, p);
        if (n) crumbs.push({ label: n.data?.text || '...', path: p });
      }
      return crumbs;
    }, [data, focusPath]);

    const flat = useMemo(() => flatten(focusNode, collapsed), [focusNode, collapsed]);

    // 搜索匹配
    const searchMatches = useMemo(() => {
      if (!searchText.trim()) return new Set<string>();
      const kw = searchText.toLowerCase();
      return new Set(flat.filter(n => n.text.toLowerCase().includes(kw) || n.note.toLowerCase().includes(kw)).map(n => n.key));
    }, [flat, searchText]);

    // 获取聚焦节点的实际路径（考虑专注模式偏移）
    const getActivePath = useCallback((): number[] | null => {
      if (!focusedKey) return null;
      const fn = flat.find(n => n.key === focusedKey);
      if (!fn) return null;
      return focusPath ? [...focusPath, ...fn.path] : fn.path;
    }, [focusedKey, flat, focusPath]);

    // 聚焦逻辑
    useEffect(() => {
      if (fKey !== null) {
        const el = inputRefs.current.get(fKey);
        if (el) { el.focus(); const l = el.value.length; el.setSelectionRange(fEnd ? l : 0, fEnd ? l : 0); }
        setFKey(null);
      }
    }, [fKey, fEnd, flat]);

    const toggle = useCallback((k: string) => {
      setCollapsed(p => { const s = new Set(p); s.has(k) ? s.delete(k) : s.add(k); return s; });
    }, []);

    // ── 编辑操作 ──

    const setText = useCallback((path: number[], text: string) => {
      const r = cloneTree(data); const n = getNode(r, path);
      if (n) { n.data.text = text; push(r); }
    }, [data, push]);

    const doEnter = useCallback((path: number[]) => {
      const r = cloneTree(data);
      if (path.length === 0) {
        r.children.unshift({ data: { text: '' }, children: [] });
        push(r); setFEnd(false); setFKey('0'); return;
      }
      const pp = path.slice(0, -1); const parent = getNode(r, pp); if (!parent) return;
      const idx = path[path.length - 1];
      parent.children.splice(idx + 1, 0, { data: { text: '' }, children: [] });
      push(r);
      setFEnd(false); setFKey([...pp, idx + 1].join('-'));
    }, [data, push]);

    const doBackspace = useCallback((path: number[], text: string): boolean => {
      if (text !== '' || path.length === 0) return false;
      const r = cloneTree(data);
      const pp = path.slice(0, -1); const parent = getNode(r, pp); if (!parent) return false;
      const idx = path[path.length - 1];
      const node = parent.children[idx];
      if (node.children.length > 0) return false;
      parent.children.splice(idx, 1); push(r);
      if (idx > 0) { setFEnd(true); setFKey([...pp, idx - 1].join('-')); }
      else if (pp.length > 0) { setFEnd(true); setFKey(pp.join('-')); }
      else { setFEnd(true); setFKey('root'); }
      return true;
    }, [data, push]);

    const doTab = useCallback((path: number[], shift: boolean) => {
      if (path.length === 0) return;
      const r = cloneTree(data);
      const pp = path.slice(0, -1); const parent = getNode(r, pp); if (!parent) return;
      const idx = path[path.length - 1];
      if (!shift) {
        if (idx === 0) return;
        const prev = parent.children[idx - 1];
        const node = parent.children.splice(idx, 1)[0];
        prev.children.push(node);
        const pk = [...pp, idx - 1].join('-');
        setCollapsed(p => { const s = new Set(p); s.delete(pk); return s; });
        push(r);
        setFEnd(true); setFKey([...pp, idx - 1, prev.children.length - 1].join('-'));
      } else {
        if (pp.length === 0) return;
        const gpp = pp.slice(0, -1); const gp = getNode(r, gpp); if (!gp) return;
        const pIdx = pp[pp.length - 1];
        const node = parent.children.splice(idx, 1)[0];
        gp.children.splice(pIdx + 1, 0, node);
        push(r);
        setFEnd(true); setFKey([...gpp, pIdx + 1].join('-'));
      }
    }, [data, push]);

    const doArrow = useCallback((flatIdx: number, dir: 'up' | 'down') => {
      const ti = dir === 'up' ? flatIdx - 1 : flatIdx + 1;
      if (ti >= 0 && ti < flat.length) { setFEnd(true); setFKey(flat[ti].key); }
    }, [flat]);

    // ── 上下移动节点 (Ctrl+Shift+↑↓) ──
    const doMove = useCallback((path: number[], dir: 'up' | 'down') => {
      if (path.length === 0) return;
      const r = cloneTree(data);
      const pp = path.slice(0, -1); const parent = getNode(r, pp); if (!parent) return;
      const idx = path[path.length - 1];
      const newIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= parent.children.length) return;
      const temp = parent.children[idx];
      parent.children[idx] = parent.children[newIdx];
      parent.children[newIdx] = temp;
      push(r);
      setFEnd(true); setFKey([...pp, newIdx].join('-'));
    }, [data, push]);

    // ── 克隆节点 (Ctrl+D) ──
    const doClone = useCallback((path: number[]) => {
      if (path.length === 0) return;
      const r = cloneTree(data);
      const pp = path.slice(0, -1); const parent = getNode(r, pp); if (!parent) return;
      const idx = path[path.length - 1];
      const clone = cloneTree(parent.children[idx]);
      parent.children.splice(idx + 1, 0, clone);
      push(r);
      setFEnd(true); setFKey([...pp, idx + 1].join('-'));
    }, [data, push]);

    // ── 删除节点 (Ctrl+Shift+Backspace) ──
    const doDeleteNode = useCallback((path: number[]) => {
      if (path.length === 0) return;
      const r = cloneTree(data);
      const pp = path.slice(0, -1); const parent = getNode(r, pp); if (!parent) return;
      const idx = path[path.length - 1];
      parent.children.splice(idx, 1);
      push(r);
      if (idx > 0) { setFEnd(true); setFKey([...pp, idx - 1].join('-')); }
      else if (pp.length > 0) { setFEnd(true); setFKey(pp.join('-')); }
      else { setFEnd(true); setFKey('root'); }
    }, [data, push]);

    // ── 完成状态 (Ctrl+Enter) ──
    const doToggleComplete = useCallback((path: number[]) => {
      const r = cloneTree(data); const n = getNode(r, path);
      if (n) { (n.data as any).completed = !(n.data as any).completed; push(r); }
    }, [data, push]);

    // ── 对外暴露方法 (useImperativeHandle 须在 do* 函数之后) ──
    useImperativeHandle(ref, () => ({
      undo, redo,
      getSelectedNodePath: () => {
        if (!focusedKey) return null;
        const node = flat.find(n => n.key === focusedKey);
        return node?.path ?? null;
      },
      openSearch: () => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); },
      focusOnNode: (path: number[]) => { setFocusPath(path); setSelectedKeys(new Set()); },
      exitFocus: () => { setFocusPath(null); setSelectedKeys(new Set()); },
      expandAll: () => { setCollapsed(new Set()); },
      collapseAll: () => {
        const keys = new Set<string>();
        function walk(n: SMNode, p: number[]) {
          if (n.children?.length) {
            keys.add(p.length === 0 ? 'root' : p.join('-'));
            n.children.forEach((c, i) => walk(c, [...p, i]));
          }
        }
        walk(focusNode, []);
        setCollapsed(keys);
      },
      getActiveNodeInfo: () => {
        const ap = getActivePath();
        if (!ap) return null;
        const n = getNode(data, ap);
        if (!n) return null;
        const pathLabels: string[] = [];
        for (let i = 1; i <= ap.length; i++) {
          const ancestor = getNode(data, ap.slice(0, i));
          if (ancestor) pathLabels.push(ancestor.data?.text || '');
        }
        return {
          text: n.data?.text || '',
          isRoot: ap.length === 0,
          path: [data.data?.text || '根节点', ...pathLabels],
          childCount: n.children?.length || 0,
        };
      },
      getActiveBranchMarkdown: () => {
        const ap = getActivePath();
        if (!ap) return null;
        const n = getNode(data, ap);
        if (!n) return null;
        return mindMapDataToMarkdown(n);
      },
      insertChildrenToActive: (children: SMNode[]) => {
        const ap = getActivePath();
        if (!ap) return;
        const r = cloneTree(data);
        const n = getNode(r, ap);
        if (n) { n.children.push(...children); push(r); }
      },
      updateActiveNodeText: (text: string) => {
        const ap = getActivePath();
        if (!ap) return;
        const r = cloneTree(data);
        const n = getNode(r, ap);
        if (n) { n.data.text = text; push(r); }
      },
      updateActiveNodeChildren: (children: SMNode[]) => {
        const ap = getActivePath();
        if (!ap) return;
        const r = cloneTree(data);
        const n = getNode(r, ap);
        if (n) { n.children = children; push(r); }
      },
      setActiveNodeNote: (note: string) => {
        const ap = getActivePath();
        if (!ap) return;
        const r = cloneTree(data);
        const n = getNode(r, ap);
        if (n) { (n.data as any).note = note; push(r); }
      },
      addSibling: () => {
        const fn = focusedKey ? flat.find(n => n.key === focusedKey) : null;
        const path = fn ? (focusPath ? [...focusPath, ...fn.path] : fn.path) : [];
        doEnter(path);
      },
      deleteNode: () => {
        const fn = focusedKey ? flat.find(n => n.key === focusedKey) : null;
        const path = fn ? (focusPath ? [...focusPath, ...fn.path] : fn.path) : [];
        if (path.length > 0) doDeleteNode(path);
      },
      moveUp: () => {
        const fn = focusedKey ? flat.find(n => n.key === focusedKey) : null;
        const path = fn ? (focusPath ? [...focusPath, ...fn.path] : fn.path) : [];
        if (path.length > 0) doMove(path, 'up');
      },
      moveDown: () => {
        const fn = focusedKey ? flat.find(n => n.key === focusedKey) : null;
        const path = fn ? (focusPath ? [...focusPath, ...fn.path] : fn.path) : [];
        if (path.length > 0) doMove(path, 'down');
      },
      indent: () => {
        const fn = focusedKey ? flat.find(n => n.key === focusedKey) : null;
        const path = fn ? (focusPath ? [...focusPath, ...fn.path] : fn.path) : [];
        if (path.length > 0) doTab(path, false);
      },
      outdent: () => {
        const fn = focusedKey ? flat.find(n => n.key === focusedKey) : null;
        const path = fn ? (focusPath ? [...focusPath, ...fn.path] : fn.path) : [];
        if (path.length > 0) doTab(path, true);
      },
      cloneNode: () => {
        const fn = focusedKey ? flat.find(n => n.key === focusedKey) : null;
        const path = fn ? (focusPath ? [...focusPath, ...fn.path] : fn.path) : [];
        if (path.length > 0) doClone(path);
      },
      toggleComplete: () => {
        const fn = focusedKey ? flat.find(n => n.key === focusedKey) : null;
        const path = fn ? (focusPath ? [...focusPath, ...fn.path] : fn.path) : [];
        doToggleComplete(path);
      },
    }), [undo, redo, focusedKey, flat, data, push, getActivePath, focusPath, focusNode, doEnter, doDeleteNode, doMove, doTab, doClone, doToggleComplete]);

    // ── 备注 ──
    const doSaveNote = useCallback((path: number[], note: string) => {
      const r = cloneTree(data); const n = getNode(r, path);
      if (n) { (n.data as any).note = note; push(r); }
    }, [data, push]);

    // ── 展开/折叠 (Ctrl+.) ──
    const doToggleFold = useCallback((key: string) => {
      setCollapsed(p => { const s = new Set(p); s.has(key) ? s.delete(key) : s.add(key); return s; });
    }, []);

    // ── 拖拽处理 ──
    const handleDragStart = useCallback((key: string) => { setDragKey(key); }, []);
    const handleDragOver = useCallback((e: React.DragEvent, key: string) => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(key);
    }, []);
    const handleDragEnd = useCallback(() => { setDragKey(null); setDropTarget(null); }, []);
    const handleDrop = useCallback((targetKey: string) => {
      if (!dragKey || dragKey === targetKey) { setDragKey(null); setDropTarget(null); return; }
      const srcNode = flat.find(n => n.key === dragKey);
      const tgtNode = flat.find(n => n.key === targetKey);
      if (!srcNode || !tgtNode || srcNode.path.length === 0) { setDragKey(null); setDropTarget(null); return; }
      // 不能拖到自己的子节点上
      const sp = srcNode.path.join('-');
      if (targetKey.startsWith(sp + '-') || targetKey === sp) { setDragKey(null); setDropTarget(null); return; }

      const r = cloneTree(data);
      // 先移除源节点
      const spp = srcNode.path.slice(0, -1);
      const sParent = getNode(r, spp); if (!sParent) { setDragKey(null); setDropTarget(null); return; }
      const sIdx = srcNode.path[srcNode.path.length - 1];
      const [moved] = sParent.children.splice(sIdx, 1);
      // 插入到目标节点之后（同级）
      if (tgtNode.path.length === 0) {
        // 拖到根节点 → 添加为根的第一个子节点
        const rootNode = getNode(r, []);
        if (rootNode) rootNode.children.unshift(moved);
      } else {
        const tpp = tgtNode.path.slice(0, -1);
        const tParent = getNode(r, tpp);
        if (tParent) {
          // 重新计算目标索引（因为源可能在目标之前被移除了）
          let tIdx = tgtNode.path[tgtNode.path.length - 1];
          // 如果源和目标同级且源在目标之前，目标索引需要-1
          if (spp.join('-') === tpp.join('-') && sIdx < tgtNode.path[tgtNode.path.length - 1]) {
            tIdx--;
          }
          tParent.children.splice(tIdx + 1, 0, moved);
        }
      }
      push(r);
      setDragKey(null); setDropTarget(null);
    }, [dragKey, flat, data, push]);

    // ── 键盘事件 ──
    const handleKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>, node: FlatNode, flatIdx: number) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Enter' && mod) { e.preventDefault(); doToggleComplete(node.path); return; }
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        setEditingNote(node.key);
        setNoteText((getNode(data, node.path)?.data as any)?.note || '');
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); doEnter(node.path); return; }
      if (e.key === 'Backspace' && (e.target as HTMLInputElement).value === '') {
        if (doBackspace(node.path, '')) e.preventDefault(); return;
      }
      if (e.key === 'Backspace' && mod && e.shiftKey) { e.preventDefault(); doDeleteNode(node.path); return; }
      if (e.key === 'Tab') { e.preventDefault(); doTab(node.path, e.shiftKey); return; }
      if (e.key === 'ArrowUp' && mod && e.shiftKey) { e.preventDefault(); doMove(node.path, 'up'); return; }
      if (e.key === 'ArrowDown' && mod && e.shiftKey) { e.preventDefault(); doMove(node.path, 'down'); return; }
      if (e.key === 'ArrowUp' && !mod) { e.preventDefault(); doArrow(flatIdx, 'up'); return; }
      if (e.key === 'ArrowDown' && !mod) { e.preventDefault(); doArrow(flatIdx, 'down'); return; }
      if (e.key === 'd' && mod) { e.preventDefault(); doClone(node.path); return; }
      if (e.key === '.' && mod) { e.preventDefault(); if (node.hasChildren) doToggleFold(node.key); return; }
      if (e.key === 'z' && mod && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (e.key === 'z' && mod && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (e.key === 'f' && mod) { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); return; }
      if (e.key === '/' && mod) {
        e.preventDefault();
        if (node.hasChildren) { setFocusPath(focusPath ? [...focusPath, ...node.path] : node.path); }
        return;
      }
      if (e.key === 'Escape' && focusPath) { e.preventDefault(); setFocusPath(null); return; }
    }, [data, focusPath, doEnter, doBackspace, doTab, doArrow, doMove, doClone, doDeleteNode, doToggleComplete, doToggleFold, undo, redo]);

    const fontStyle = { fontFamily: '"Songti SC", "SimSun", "STSong", sans-serif', fontSize: '16px' };

    // 多选：批量删除
    const doDeleteSelected = useCallback(() => {
      if (selectedKeys.size === 0) return;
      const r = cloneTree(data);
      // 按深度从深到浅删除，避免索引偏移
      const paths = flat.filter(n => selectedKeys.has(n.key) && n.path.length > 0).map(n => n.path);
      paths.sort((a, b) => b.length - a.length || b[b.length - 1] - a[a.length - 1]);
      for (const p of paths) {
        const pp = p.slice(0, -1);
        const parent = getNode(r, pp);
        if (parent) parent.children.splice(p[p.length - 1], 1);
      }
      push(r);
      setSelectedKeys(new Set());
    }, [data, flat, selectedKeys, push]);

    // 多选：批量完成
    const doCompleteSelected = useCallback(() => {
      if (selectedKeys.size === 0) return;
      const r = cloneTree(data);
      for (const fn of flat) {
        if (!selectedKeys.has(fn.key)) continue;
        const n = getNode(r, fn.path);
        if (n) (n.data as any).completed = !(n.data as any).completed;
      }
      push(r);
      setSelectedKeys(new Set());
    }, [data, flat, selectedKeys, push]);

    return (
      <div className={`h-full flex flex-col ${className || ''}`}>
        {/* 搜索栏 */}
        {searchOpen && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b flex-shrink-0">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={searchRef}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              style={fontStyle}
              placeholder="搜索节点..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setSearchOpen(false); setSearchText(''); }
              }}
              autoFocus
            />
            {searchText && (
              <span className="text-xs text-muted-foreground">{searchMatches.size} 个匹配</span>
            )}
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
              onClick={() => { setSearchOpen(false); setSearchText(''); }}
              title="关闭搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* 面包屑导航（专注模式） */}
        {focusPath && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1 px-3 py-1 bg-muted/30 border-b flex-shrink-0 text-xs">
            <button
              className="flex items-center gap-0.5 text-primary hover:text-primary/80"
              onClick={() => setFocusPath(null)}
            >
              <Home className="h-3 w-3" />根
            </button>
            {breadcrumbs.slice(1).map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <button
                  className={`hover:text-primary truncate max-w-[120px] ${
                    i === breadcrumbs.length - 2 ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                  onClick={() => setFocusPath(crumb.path)}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 多选操作栏 */}
        {selectedKeys.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border-b flex-shrink-0 text-xs">
            <span className="text-muted-foreground">已选 {selectedKeys.size} 项</span>
            <button className="text-primary hover:text-primary/80" onClick={doCompleteSelected}>批量完成</button>
            <button className="text-destructive hover:text-destructive/80" onClick={doDeleteSelected}>批量删除</button>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setSelectedKeys(new Set())}>取消选择</button>
          </div>
        )}

        {/* 节点列表 */}
        <div className="flex-1 overflow-y-auto py-2">
        {flat.map((node, fi) => (
          <div key={node.key}>
            <div
              className={`flex items-center group rounded-sm transition-colors ${
                selectedKeys.has(node.key) ? 'bg-primary/10' :
                dropTarget === node.key ? 'bg-primary/10 border-t-2 border-primary' :
                dragKey === node.key ? 'opacity-40' :
                searchMatches.has(node.key) ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                'hover:bg-muted/30'
              }`}
              style={{ paddingLeft: `${node.depth * 24 + 4}px` }}
              onDragOver={(e) => handleDragOver(e, node.key)}
              onDrop={() => handleDrop(node.key)}
            >
              {/* 拖拽手柄 (hover显示，独立列元素) */}
              {node.path.length > 0 ? (
                <div
                  className="w-5 h-6 flex items-center justify-center flex-shrink-0 invisible group-hover:visible"
                  draggable
                  onDragStart={(e) => { e.stopPropagation(); handleDragStart(node.key); }}
                  onDragEnd={handleDragEnd}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                </div>
              ) : (
                <span className="w-5 h-6 flex-shrink-0" />
              )}

              {/* 展开/折叠 */}
              {node.hasChildren ? (
                <button
                  className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0"
                  onClick={() => toggle(node.key)}
                  tabIndex={-1}
                >
                  {node.expanded
                    ? <ChevronDown className="h-3.5 w-3.5" />
                    : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <span className="w-5 h-5 flex-shrink-0" />
              )}

              {/* 圆点 + 多选 */}
              <div className="relative group/bullet flex-shrink-0">
                <span
                  className={`block w-2 h-2 rounded-full mr-2 transition-colors cursor-pointer ${
                    selectedKeys.has(node.key) ? 'bg-primary ring-2 ring-primary/30' :
                    node.completed ? 'bg-green-500' :
                    node.depth === 0 ? 'bg-primary w-2.5 h-2.5' :
                    node.hasChildren ? 'bg-foreground/40' : 'bg-foreground/20'
                  }`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey) {
                      setSelectedKeys(prev => {
                        const s = new Set(prev);
                        s.has(node.key) ? s.delete(node.key) : s.add(node.key);
                        return s;
                      });
                    } else if (e.shiftKey && focusedKey) {
                      const fi1 = flat.findIndex(n => n.key === focusedKey);
                      const fi2 = flat.findIndex(n => n.key === node.key);
                      if (fi1 >= 0 && fi2 >= 0) {
                        const [start, end] = fi1 < fi2 ? [fi1, fi2] : [fi2, fi1];
                        setSelectedKeys(new Set(flat.slice(start, end + 1).map(n => n.key)));
                      }
                    }
                  }}
                />
              </div>

              {/* 内容区 */}
              <div className="flex-1 min-w-0 self-stretch flex flex-col justify-center">
                <input
                  ref={el => { if (el) inputRefs.current.set(node.key, el); else inputRefs.current.delete(node.key); }}
                  className={`w-full bg-transparent outline-none py-1 min-w-0 leading-normal ${
                    node.depth === 0 ? 'font-bold text-lg' : ''
                  } ${node.completed ? 'line-through text-muted-foreground' : ''}`}
                  style={fontStyle}
                  value={node.text}
                  onChange={e => setText(node.path, e.target.value)}
                  onKeyDown={e => handleKey(e, node, fi)}
                  onFocus={() => setFocusedKey(node.key)}
                  placeholder={node.depth === 0 ? '输入主题...' : '输入内容...'}
                  spellCheck={false}
                  autoCorrect="off"
                />
                {/* 备注显示 */}
                {node.note && editingNote !== node.key && (
                  <div
                    className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-0.5 mb-1 cursor-pointer hover:bg-muted/50 max-w-full truncate"
                    onClick={() => { setEditingNote(node.key); setNoteText(node.note); }}
                    style={fontStyle}
                  >
                    📝 {node.note}
                  </div>
                )}
                {/* 备注编辑 */}
                {editingNote === node.key && (
                  <div className="flex items-center gap-1 mb-1">
                    <input
                      className="flex-1 text-xs bg-muted/50 rounded px-2 py-1 outline-none border border-border focus:border-primary"
                      style={fontStyle}
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { doSaveNote(node.path, noteText); setEditingNote(null); }
                        if (e.key === 'Escape') setEditingNote(null);
                      }}
                      placeholder="输入备注..."
                      autoFocus
                    />
                    <button
                      className="text-xs text-primary hover:text-primary/80 px-1"
                      onClick={() => { doSaveNote(node.path, noteText); setEditingNote(null); }}
                    >保存</button>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground px-1"
                      onClick={() => setEditingNote(null)}
                    >取消</button>
                  </div>
                )}
              </div>

              {/* 折叠计数 */}
              {node.hasChildren && !node.expanded && (
                <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1 py-0.5 flex-shrink-0 mt-1 mr-1">
                  +{node.childCount}
                </span>
              )}

              {/* 操作按钮（hover 显示） */}
              <div className="flex items-center gap-0.5 invisible group-hover:visible flex-shrink-0 mt-0.5">
                <button
                  className={`w-5 h-5 flex items-center justify-center rounded hover:bg-accent ${node.completed ? 'text-green-500' : 'text-muted-foreground'}`}
                  onClick={() => doToggleComplete(node.path)}
                  tabIndex={-1}
                  title="完成/激活 (Ctrl+Enter)"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                  onClick={() => { setEditingNote(node.key); setNoteText(node.note || ''); }}
                  tabIndex={-1}
                  title="编辑备注 (Shift+Enter)"
                >
                  <MessageSquare className="h-3 w-3" />
                </button>
                <button
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                  onClick={() => doClone(node.path)}
                  tabIndex={-1}
                  title="克隆节点 (Ctrl+D)"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {node.hasChildren && (
                  <button
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                    onClick={() => setFocusPath(focusPath ? [...focusPath, ...node.path] : node.path)}
                    tabIndex={-1}
                    title="专注此节点 (Ctrl+/)"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
                {node.path.length > 0 && (
                  <button
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-accent text-destructive"
                    onClick={() => doDeleteNode(node.path)}
                    tabIndex={-1}
                    title="删除节点 (Ctrl+Shift+Backspace)"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>
    );
  }
);
