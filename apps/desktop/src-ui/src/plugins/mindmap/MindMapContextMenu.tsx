/**
 * 思维导图右键菜单组件
 *
 * 监听 simple-mind-map 的 node_contextmenu 事件，
 * 在鼠标位置弹出操作菜单。
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, GitBranch, Trash2, Copy, ClipboardPaste,
  ChevronRight, ChevronsDown, ChevronsUp,
  Sparkles, Wand2, Languages, StickyNote, Minimize2,
} from 'lucide-react';

export interface ContextMenuAction {
  addChild: () => void;
  addSibling: () => void;
  deleteNode: () => void;
  expandAll: () => void;
  collapseToLevel: (level: number) => void;
  // AI 节点操作
  aiExpandNode?: () => void;
  aiSummarizeBranch?: () => void;
  aiRephraseNode?: () => void;
  aiSuggestSiblings?: () => void;
  aiTranslateBranch?: () => void;
  aiSetNote?: () => void;
}

interface MindMapContextMenuProps {
  /** simple-mind-map 实例获取函数（延迟求值，避免初始渲染时为 null） */
  getMindMapInstance: () => any;
  /** 操作回调 */
  actions: ContextMenuAction;
}

interface MenuPosition {
  x: number;
  y: number;
  visible: boolean;
  isRoot: boolean;
}

export function MindMapContextMenu({ getMindMapInstance, actions }: MindMapContextMenuProps) {
  const [menu, setMenu] = useState<MenuPosition>({ x: 0, y: 0, visible: false, isRoot: false });
  const menuRef = useRef<HTMLDivElement>(null);

  // 关闭菜单
  const closeMenu = useCallback(() => {
    setMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // 监听 simple-mind-map 事件（轮询获取实例，因为初始渲染时可能还未就绪）
  useEffect(() => {
    let instance: any = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const handleContextMenu = (e: MouseEvent, node: any) => {
      e.preventDefault();
      e.stopPropagation();
      const isRoot = node?.isRoot || false;
      setMenu({ x: e.clientX, y: e.clientY, visible: true, isRoot });
    };

    const handleClick = () => {
      closeMenu();
    };

    const bind = (mm: any) => {
      instance = mm;
      mm.on('node_contextmenu', handleContextMenu);
      mm.on('node_click', handleClick);
      mm.on('draw_click', handleClick);
      mm.on('svg_mousedown', handleClick);
    };

    const tryBind = () => {
      const mm = getMindMapInstance();
      if (mm) {
        bind(mm);
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      }
    };

    tryBind();
    if (!instance) {
      pollTimer = setInterval(tryBind, 500);
    }

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      if (instance) {
        instance.off('node_contextmenu', handleContextMenu);
        instance.off('node_click', handleClick);
        instance.off('draw_click', handleClick);
        instance.off('svg_mousedown', handleClick);
      }
    };
  }, [getMindMapInstance, closeMenu]);

  // 全局 click 关闭
  useEffect(() => {
    if (!menu.visible) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    // 延迟注册避免立即触发
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleGlobalClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [menu.visible, closeMenu]);

  // Esc 关闭
  useEffect(() => {
    if (!menu.visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menu.visible, closeMenu]);

  if (!menu.visible) return null;

  const menuItems: Array<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    separator?: boolean;
  }> = [
    {
      icon: <Plus className="h-3.5 w-3.5" />,
      label: '添加子节点',
      onClick: () => { actions.addChild(); closeMenu(); },
    },
    {
      icon: <GitBranch className="h-3.5 w-3.5" />,
      label: '添加同级节点',
      onClick: () => { actions.addSibling(); closeMenu(); },
      disabled: menu.isRoot,
    },
    {
      icon: <Trash2 className="h-3.5 w-3.5" />,
      label: '删除节点',
      onClick: () => { actions.deleteNode(); closeMenu(); },
      disabled: menu.isRoot,
      separator: true,
    },
    {
      icon: <Copy className="h-3.5 w-3.5" />,
      label: '复制节点',
      onClick: () => {
        getMindMapInstance()?.execCommand('COPY_NODE');
        closeMenu();
      },
      disabled: menu.isRoot,
    },
    {
      icon: <Copy className="h-3.5 w-3.5 rotate-180" />,
      label: '剪切节点',
      onClick: () => {
        getMindMapInstance()?.execCommand('CUT_NODE');
        closeMenu();
      },
      disabled: menu.isRoot,
    },
    {
      icon: <ClipboardPaste className="h-3.5 w-3.5" />,
      label: '粘贴节点',
      onClick: () => {
        getMindMapInstance()?.execCommand('PASTE_NODE');
        closeMenu();
      },
      separator: true,
    },
    {
      icon: <ChevronsDown className="h-3.5 w-3.5" />,
      label: '展开全部子节点',
      onClick: () => { actions.expandAll(); closeMenu(); },
    },
    {
      icon: <ChevronsUp className="h-3.5 w-3.5" />,
      label: '收起到第 2 层',
      onClick: () => { actions.collapseToLevel(2); closeMenu(); },
    },
    {
      icon: <ChevronRight className="h-3.5 w-3.5" />,
      label: '收起到第 3 层',
      onClick: () => { actions.collapseToLevel(3); closeMenu(); },
      separator: true,
    },
    // ── AI 助手 ──
    {
      icon: <Sparkles className="h-3.5 w-3.5 text-amber-500" />,
      label: 'AI 展开此节点',
      onClick: () => { actions.aiExpandNode?.(); closeMenu(); },
    },
    {
      icon: <Wand2 className="h-3.5 w-3.5 text-amber-500" />,
      label: 'AI 改写此节点',
      onClick: () => { actions.aiRephraseNode?.(); closeMenu(); },
    },
    {
      icon: <Minimize2 className="h-3.5 w-3.5 text-amber-500" />,
      label: 'AI 精简此分支',
      onClick: () => { actions.aiSummarizeBranch?.(); closeMenu(); },
    },
    {
      icon: <Languages className="h-3.5 w-3.5 text-amber-500" />,
      label: 'AI 翻译此分支',
      onClick: () => { actions.aiTranslateBranch?.(); closeMenu(); },
    },
    {
      icon: <GitBranch className="h-3.5 w-3.5 text-amber-500" />,
      label: 'AI 建议同级',
      onClick: () => { actions.aiSuggestSiblings?.(); closeMenu(); },
      disabled: menu.isRoot,
      separator: true,
    },
    {
      icon: <StickyNote className="h-3.5 w-3.5" />,
      label: '编辑备注',
      onClick: () => { actions.aiSetNote?.(); closeMenu(); },
    },
  ];

  // 计算菜单位置（避免超出视口）
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: menu.x,
    top: menu.y,
    zIndex: 50000,
  };

  return (
    <div
      ref={menuRef}
      className="bg-popover border rounded-lg shadow-lg py-1 min-w-[160px] text-sm"
      style={menuStyle}
    >
      {menuItems.map((item, idx) => (
        <div key={idx}>
          <button
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground transition-colors ${
              item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
            onClick={item.disabled ? undefined : item.onClick}
            disabled={item.disabled}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
          {item.separator && <div className="h-px bg-border my-1 mx-2" />}
        </div>
      ))}
    </div>
  );
}
