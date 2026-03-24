/**
 * EssayContextMenu.tsx — 散文编辑器右键上下文菜单
 *
 * Phase 6: 右键上下文菜单
 * 段落级操作：
 *   - 标记段落角色（起/承/转/合/无）
 *   - 在上方/下方插入新段落
 *   - 移动段落（上移/下移）
 * 选中文本操作：
 *   - AI 分析 / AI 润色 / AI 续写
 *   - 添加到素材库
 *   - 标注修辞手法
 *   - 复制
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Sparkles, Wand2, PenLine, BookOpen, Tag,
  ArrowUp, ArrowDown, Plus, Copy, ChevronRight,
} from 'lucide-react';
import type { ParagraphRole } from './types';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuState {
  visible: boolean;
  position: ContextMenuPosition;
  selectedText: string;
  paragraphIndex: number;  // -1 表示无对应段落
  paragraphId: string;
}

interface EssayContextMenuProps {
  state: ContextMenuState;
  paragraphCount: number;
  onClose: () => void;
  // 段落操作
  onSetParagraphRole: (paragraphId: string, role: ParagraphRole) => void;
  onInsertParagraphAbove: (index: number) => void;
  onInsertParagraphBelow: (index: number) => void;
  onMoveParagraphUp: (index: number) => void;
  onMoveParagraphDown: (index: number) => void;
  // 选中文本操作
  onAIAnalyze: (text: string) => void;
  onAIPolish: (text: string) => void;
  onAIContinue: (text: string) => void;
  onAddToMaterials: (text: string, type: 'inspiration' | 'quote' | 'imagery' | 'reference') => void;
  onAnnotateRhetoric: (text: string) => void;
  onCopy: (text: string) => void;
}

// ── 角色选项 ──
const ROLE_ITEMS: { role: ParagraphRole; label: string; desc: string; color: string }[] = [
  { role: 'open',  label: '起', desc: '开篇·引入', color: 'text-blue-600' },
  { role: 'carry', label: '承', desc: '承接·展开', color: 'text-green-600' },
  { role: 'turn',  label: '转', desc: '转折·深化', color: 'text-orange-600' },
  { role: 'close', label: '合', desc: '收束·升华', color: 'text-purple-600' },
  { role: 'none',  label: '—', desc: '清除标记',  color: 'text-muted-foreground' },
];

// ── 素材类型选项 ──
const MATERIAL_TYPE_ITEMS: { type: 'inspiration' | 'quote' | 'imagery' | 'reference'; label: string }[] = [
  { type: 'inspiration', label: '灵感片段' },
  { type: 'quote',       label: '引用语录' },
  { type: 'imagery',     label: '意象笔记' },
  { type: 'reference',   label: '参考文段' },
];

// ── 菜单项组件 ──
function MenuItem({
  icon, label, onClick, disabled, className, danger,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left rounded-sm',
        'hover:bg-accent transition-colors',
        disabled && 'opacity-40 pointer-events-none',
        danger && 'text-destructive hover:bg-destructive/10',
        className,
      )}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {icon && <span className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

// ── 分隔线 ──
function Divider() {
  return <div className="my-1 border-t border-border/60" />;
}

// ── 子菜单容器 ──
function SubMenu({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [flipLeft, setFlipLeft] = useState(false);
  const subRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    setOpen(true);
    // 下一帧检测是否溢出右边界
    requestAnimationFrame(() => {
      if (subRef.current) {
        const rect = subRef.current.getBoundingClientRect();
        setFlipLeft(rect.right > window.innerWidth - 8);
      }
    });
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setOpen(false); setFlipLeft(false); }}
    >
      <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left rounded-sm hover:bg-accent transition-colors">
        {trigger}
        <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
      </button>
      {open && (
        <div
          ref={subRef}
          className={cn(
            'absolute top-0 min-w-[150px] py-1',
            'bg-popover border border-border rounded-md shadow-lg z-[10000]',
            flipLeft ? 'right-full mr-0.5' : 'left-full ml-0.5',
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function EssayContextMenu({
  state,
  paragraphCount,
  onClose,
  onSetParagraphRole,
  onInsertParagraphAbove,
  onInsertParagraphBelow,
  onMoveParagraphUp,
  onMoveParagraphDown,
  onAIAnalyze,
  onAIPolish,
  onAIContinue,
  onAddToMaterials,
  onAnnotateRhetoric,
  onCopy,
}: EssayContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { visible, position, selectedText, paragraphIndex, paragraphId } = state;
  const hasSelection = selectedText.trim().length > 0;
  const hasParagraph = paragraphIndex >= 0;

  // ── 点击外部关闭 ──
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  // ── 菜单位置调整（DOM 挂载后精确计算，避免首次 offsetHeight=0）──
  const [displayPos, setDisplayPos] = useState(position);

  useEffect(() => {
    if (visible) setDisplayPos(position);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible || !menuRef.current) return;
    const el = menuRef.current;
    const menuH = el.offsetHeight;
    const menuW = el.offsetWidth;
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    setDisplayPos({
      x: Math.max(4, Math.min(position.x, viewW - menuW - 8)),
      y: Math.max(4, Math.min(position.y, viewH - menuH - 8)),
    });
  }, [visible, position]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[9999] min-w-[200px] py-1',
        'bg-popover border border-border rounded-md shadow-xl',
        'animate-in fade-in-0 zoom-in-95 duration-100',
      )}
      style={{ left: displayPos.x, top: displayPos.y }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* ── AI 操作区（选中文本时显示）── */}
      {hasSelection && (
        <>
          <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium">
            AI 操作 · "{selectedText.slice(0, 15)}{selectedText.length > 15 ? '…' : ''}"
          </div>
          <MenuItem
            icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
            label="AI 分析"
            onClick={() => { onAIAnalyze(selectedText); onClose(); }}
          />
          <MenuItem
            icon={<Wand2 className="h-3.5 w-3.5 text-blue-500" />}
            label="AI 润色"
            onClick={() => { onAIPolish(selectedText); onClose(); }}
          />
          <MenuItem
            icon={<PenLine className="h-3.5 w-3.5 text-green-500" />}
            label="AI 续写"
            onClick={() => { onAIContinue(selectedText); onClose(); }}
          />
          <Divider />

          {/* 添加到素材库 */}
          <SubMenu
            trigger={
              <>
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                <span>添加到素材库</span>
              </>
            }
          >
            {MATERIAL_TYPE_ITEMS.map(item => (
              <MenuItem
                key={item.type}
                label={item.label}
                onClick={() => { onAddToMaterials(selectedText, item.type); onClose(); }}
              />
            ))}
          </SubMenu>

          <MenuItem
            icon={<Tag className="h-3.5 w-3.5 text-orange-500" />}
            label="标注修辞手法"
            onClick={() => { onAnnotateRhetoric(selectedText); onClose(); }}
          />
          <MenuItem
            icon={<Copy className="h-3.5 w-3.5" />}
            label="复制"
            onClick={() => { onCopy(selectedText); onClose(); }}
          />
          <Divider />
        </>
      )}

      {/* ── 段落操作区 ── */}
      {hasParagraph && (
        <>
          <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium">
            段落操作 · 第 {paragraphIndex + 1} 段
          </div>

          {/* 标记段落角色 */}
          <SubMenu
            trigger={
              <>
                <Tag className="h-3.5 w-3.5 flex-shrink-0" />
                <span>标记段落角色</span>
              </>
            }
          >
            {ROLE_ITEMS.map(item => (
              <button
                key={item.role}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left rounded-sm hover:bg-accent"
                onClick={() => { onSetParagraphRole(paragraphId, item.role); onClose(); }}
              >
                <span className={cn('font-bold w-4', item.color)}>{item.label}</span>
                <span>{item.desc}</span>
              </button>
            ))}
          </SubMenu>

          <Divider />

          {/* 段落移动与插入 */}
          <MenuItem
            icon={<ArrowUp className="h-3.5 w-3.5" />}
            label="上移段落"
            disabled={paragraphIndex <= 0}
            onClick={() => { onMoveParagraphUp(paragraphIndex); onClose(); }}
          />
          <MenuItem
            icon={<ArrowDown className="h-3.5 w-3.5" />}
            label="下移段落"
            disabled={paragraphIndex >= paragraphCount - 1}
            onClick={() => { onMoveParagraphDown(paragraphIndex); onClose(); }}
          />
          <Divider />
          <MenuItem
            icon={<Plus className="h-3.5 w-3.5" />}
            label="在上方插入段落"
            onClick={() => { onInsertParagraphAbove(paragraphIndex); onClose(); }}
          />
          <MenuItem
            icon={<Plus className="h-3.5 w-3.5" />}
            label="在下方插入段落"
            onClick={() => { onInsertParagraphBelow(paragraphIndex); onClose(); }}
          />
        </>
      )}

      {/* 无任何操作时的提示 */}
      {!hasSelection && !hasParagraph && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          选中文本或右键点击段落以操作
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// useEssayContextMenu hook — 管理右键菜单状态
// ═══════════════════════════════════════════════════════

export function useEssayContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
    selectedText: '',
    paragraphIndex: -1,
    paragraphId: '',
  });

  const open = useCallback((
    e: React.MouseEvent,
    options: { selectedText?: string; paragraphIndex?: number; paragraphId?: string },
  ) => {
    e.preventDefault();
    setState({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      selectedText: options.selectedText ?? '',
      paragraphIndex: options.paragraphIndex ?? -1,
      paragraphId: options.paragraphId ?? '',
    });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  return { state, open, close };
}
