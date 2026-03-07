/**
 * 图片画布右键菜单组件
 *
 * 监听画布 contextmenu 事件，在鼠标位置弹出操作菜单。
 * 根据是否有选中对象显示不同的菜单项。
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { FabricCanvasEditorRef } from './FabricCanvasEditor';
import {
  Copy, Clipboard, Trash2, Layers, Ungroup,
  ArrowUp, ArrowDown, Lock, Unlock,
  FlipHorizontal, FlipVertical,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  Group,
} from 'lucide-react';

interface MenuPosition {
  x: number;
  y: number;
  visible: boolean;
  hasSelection: boolean;
  isGroup: boolean;
  isMulti: boolean;
  isLocked: boolean;
}

interface ImageContextMenuProps {
  editorRef: React.RefObject<FabricCanvasEditorRef | null>;
  onShowStatus?: (msg: string) => void;
}

export function ImageContextMenu({ editorRef, onShowStatus }: ImageContextMenuProps) {
  const [menu, setMenu] = useState<MenuPosition>({
    x: 0, y: 0, visible: false, hasSelection: false, isGroup: false, isMulti: false, isLocked: false,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // 监听画布右键
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const editor = editorRef.current;
      if (!editor) return;
      const fc = editor.getInstance();
      if (!fc) return;

      // 检查是否在画布容器内
      const canvasEl = (fc as any).lowerCanvasEl as HTMLCanvasElement | undefined;
      if (!canvasEl) return;
      const container = canvasEl.parentElement;
      if (!container || !container.contains(e.target as Node)) return;

      e.preventDefault();
      e.stopPropagation();

      const activeObj = fc.getActiveObject();
      const hasSelection = !!activeObj;
      const isGroup = activeObj?.type === 'group';
      const isMulti = activeObj?.type === 'activeselection';
      const isLocked = !!(activeObj as any)?.lockMovementX;

      setMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true,
        hasSelection,
        isGroup,
        isMulti,
        isLocked,
      });
    };

    const handleClick = () => closeMenu();

    window.addEventListener('contextmenu', handler, true);
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

    return () => {
      window.removeEventListener('contextmenu', handler, true);
      window.removeEventListener('click', handleClick);
    };
  }, [editorRef, closeMenu]);

  // 调整菜单位置避免溢出
  useEffect(() => {
    if (!menu.visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    if (menu.x > maxX || menu.y > maxY) {
      setMenu(prev => ({
        ...prev,
        x: Math.min(prev.x, maxX),
        y: Math.min(prev.y, maxY),
      }));
    }
  }, [menu.visible, menu.x, menu.y]);

  const exec = useCallback((fn: () => void) => {
    fn();
    closeMenu();
  }, [closeMenu]);

  if (!menu.visible) return null;

  const editor = editorRef.current;
  if (!editor) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[160px] text-sm font-[SimSun,'宋体',sans-serif]"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.hasSelection ? (
        <>
          {/* 复制/删除 */}
          <MenuItem icon={Copy} label="复制 (⌘C)" onClick={() => exec(() => {
            const fc = editor.getInstance();
            if (!fc) return;
            const active = fc.getActiveObject();
            if (active) {
              active.clone().then((cloned: any) => {
                (window as any).__imageClipboard = cloned;
                onShowStatus?.('已复制');
              });
            }
          })} />
          <MenuItem icon={Trash2} label="删除 (Del)" danger onClick={() => exec(() => editor.deleteSelected())} />
          <Divider />

          {/* 图层 */}
          <MenuItem icon={ArrowUp} label="上移一层" onClick={() => exec(() => editor.bringForward())} />
          <MenuItem icon={ArrowDown} label="下移一层" onClick={() => exec(() => editor.sendBackward())} />
          <Divider />

          {/* 翻转 */}
          <MenuItem icon={FlipHorizontal} label="水平翻转" onClick={() => exec(() => {
            const fc = editor.getInstance();
            const obj = fc?.getActiveObject();
            if (obj) { obj.set({ flipX: !obj.flipX }); fc?.requestRenderAll(); }
          })} />
          <MenuItem icon={FlipVertical} label="垂直翻转" onClick={() => exec(() => {
            const fc = editor.getInstance();
            const obj = fc?.getActiveObject();
            if (obj) { obj.set({ flipY: !obj.flipY }); fc?.requestRenderAll(); }
          })} />
          <Divider />

          {/* 锁定 */}
          <MenuItem
            icon={menu.isLocked ? Unlock : Lock}
            label={menu.isLocked ? '解锁对象' : '锁定对象'}
            onClick={() => exec(() => {
              const fc = editor.getInstance();
              const obj = fc?.getActiveObject();
              if (!obj) return;
              const lock = !menu.isLocked;
              obj.set({
                lockMovementX: lock, lockMovementY: lock,
                lockRotation: lock, lockScalingX: lock, lockScalingY: lock,
              } as any);
              fc?.requestRenderAll();
              onShowStatus?.(lock ? '已锁定' : '已解锁');
            })}
          />

          {/* 编组/取消编组 */}
          {menu.isMulti && (
            <MenuItem icon={Group} label="编组 (⌘G)" onClick={() => exec(() => editor.groupSelected())} />
          )}
          {menu.isGroup && (
            <MenuItem icon={Ungroup} label="取消编组 (⇧⌘G)" onClick={() => exec(() => editor.ungroupSelected())} />
          )}
        </>
      ) : (
        <>
          {/* 无选中：粘贴 */}
          <MenuItem icon={Clipboard} label="粘贴 (⌘V)" onClick={() => exec(() => {
            const clip = (window as any).__imageClipboard;
            if (!clip) { onShowStatus?.('剪贴板为空'); return; }
            const fc = editor.getInstance();
            if (!fc) return;
            clip.clone().then((cloned: any) => {
              cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
              if (cloned.type === 'activeselection') {
                cloned.canvas = fc;
                cloned.forEachObject((o: any) => fc.add(o));
              } else {
                fc.add(cloned);
              }
              fc.setActiveObject(cloned);
              fc.requestRenderAll();
              (window as any).__imageClipboard = cloned;
            });
          })} />
          <Divider />

          {/* 全选 */}
          <MenuItem icon={Layers} label="全选 (⌘A)" onClick={() => exec(() => editor.selectAll())} />

          {/* 居中对齐辅助 */}
          <MenuItem icon={AlignHorizontalJustifyCenter} label="水平居中画布" onClick={() => exec(() => {
            const fc = editor.getInstance();
            if (!fc) return;
            const objs = fc.getObjects();
            if (objs.length === 0) return;
            const cw = fc.getWidth();
            objs.forEach(obj => {
              const w = (obj.width || 0) * (obj.scaleX || 1);
              obj.set({ left: (cw - w) / 2 });
              obj.setCoords();
            });
            fc.requestRenderAll();
          })} />
          <MenuItem icon={AlignVerticalJustifyCenter} label="垂直居中画布" onClick={() => exec(() => {
            const fc = editor.getInstance();
            if (!fc) return;
            const objs = fc.getObjects();
            if (objs.length === 0) return;
            const ch = fc.getHeight();
            objs.forEach(obj => {
              const h = (obj.height || 0) * (obj.scaleY || 1);
              obj.set({ top: (ch - h) / 2 });
              obj.setCoords();
            });
            fc.requestRenderAll();
          })} />
        </>
      )}
    </div>
  );
}

// ── 子组件 ──

function MenuItem({ icon: Icon, label, onClick, danger }: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent transition-colors ${danger ? 'text-destructive hover:bg-destructive/10' : ''}`}
      onClick={onClick}
      title={label}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="border-t my-0.5" />;
}
