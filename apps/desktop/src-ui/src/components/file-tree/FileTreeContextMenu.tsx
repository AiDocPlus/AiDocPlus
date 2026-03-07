/**
 * 文件树右键菜单组件 — 对标 VSCode Explorer 右键菜单
 */
import { useEffect, useRef, useCallback } from 'react';
import {
  FilePlus, LayoutTemplate, Edit2, Trash2, Star, Copy,
  ArrowRightLeft, FolderOpen,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

// ── 类型 ──

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ProjectContextMenuProps {
  type: 'project';
  projectId: string;
  projectName: string;
  position: ContextMenuPosition;
  onClose: () => void;
  onNewDocument: (projectId: string) => void;
  onNewFromTemplate: (projectId: string) => void;
  onRenameProject: (projectId: string, name: string) => void;
  onDeleteProject: (projectId: string, name: string) => void;
}

export interface DocumentContextMenuProps {
  type: 'document';
  projectId: string;
  documentId: string;
  documentTitle: string;
  isStarred: boolean;
  position: ContextMenuPosition;
  onClose: () => void;
  onRename: (docId: string, title: string) => void;
  onDuplicate: (projectId: string, docId: string) => void;
  onToggleStar: (projectId: string, docId: string) => void;
  onDelete: (projectId: string, docId: string, title: string) => void;
  onMoveTo?: (docId: string) => void;
  onRevealInFinder?: (projectId: string, docId: string) => void;
}

export type FileTreeContextMenuProps = ProjectContextMenuProps | DocumentContextMenuProps;

// ── 菜单项 ──

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

// ── 组件 ──

export function FileTreeContextMenu(props: FileTreeContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  const close = props.onClose;

  // 点击外部或 Escape 关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [close]);

  // 限制菜单不超出视口
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${vw - rect.width - 4}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${vh - rect.height - 4}px`;
    }
  }, []);

  // 构建菜单项
  const buildItems = useCallback((): (MenuItem | 'separator')[] => {
    if (props.type === 'project') {
      const p = props;
      return [
        {
          icon: <FilePlus className="h-3.5 w-3.5" />,
          label: t('fileTree.newDocument', { defaultValue: '新建文档' }),
          onClick: () => { p.onNewDocument(p.projectId); close(); },
        },
        {
          icon: <LayoutTemplate className="h-3.5 w-3.5" />,
          label: t('fileTree.newFromTemplate', { defaultValue: '从模板新建' }),
          onClick: () => { p.onNewFromTemplate(p.projectId); close(); },
        },
        'separator',
        {
          icon: <Edit2 className="h-3.5 w-3.5" />,
          label: t('fileTree.renameProject', { defaultValue: '重命名项目' }),
          onClick: () => { p.onRenameProject(p.projectId, p.projectName); close(); },
        },
        'separator',
        {
          icon: <Trash2 className="h-3.5 w-3.5" />,
          label: t('fileTree.deleteProject', { defaultValue: '删除项目' }),
          onClick: () => { p.onDeleteProject(p.projectId, p.projectName); close(); },
          danger: true,
        },
      ];
    } else {
      const d = props;
      const items: (MenuItem | 'separator')[] = [
        {
          icon: <Star className={cn("h-3.5 w-3.5", d.isStarred && "text-yellow-500 fill-yellow-500")} />,
          label: d.isStarred
            ? t('fileTree.unstar', { defaultValue: '取消收藏' })
            : t('fileTree.star', { defaultValue: '收藏' }),
          onClick: () => { d.onToggleStar(d.projectId, d.documentId); close(); },
        },
        'separator',
        {
          icon: <Edit2 className="h-3.5 w-3.5" />,
          label: t('fileTree.renameDocument', { defaultValue: '重命名' }),
          onClick: () => { d.onRename(d.documentId, d.documentTitle); close(); },
        },
        {
          icon: <Copy className="h-3.5 w-3.5" />,
          label: t('fileTree.duplicateDocument', { defaultValue: '复制文档' }),
          onClick: () => { d.onDuplicate(d.projectId, d.documentId); close(); },
        },
      ];
      if (d.onMoveTo) {
        items.push({
          icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
          label: t('fileTree.moveToProject', { defaultValue: '移动到项目...' }),
          onClick: () => { d.onMoveTo!(d.documentId); close(); },
        });
      }
      if (d.onRevealInFinder) {
        items.push({
          icon: <FolderOpen className="h-3.5 w-3.5" />,
          label: t('fileTree.revealInFinder', { defaultValue: '在文件夹中显示' }),
          onClick: () => { d.onRevealInFinder!(d.projectId, d.documentId); close(); },
        });
      }
      items.push('separator');
      items.push({
        icon: <Trash2 className="h-3.5 w-3.5" />,
        label: t('fileTree.deleteDocument', { defaultValue: '删除' }),
        onClick: () => { d.onDelete(d.projectId, d.documentId, d.documentTitle); close(); },
        danger: true,
      });
      return items;
    }
  }, [props, close, t]);

  const items = buildItems();

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border p-1 shadow-lg"
      style={{
        left: props.position.x,
        top: props.position.y,
        fontFamily: 'var(--font-sans, "宋体", sans-serif)',
        fontSize: '13px',
        backgroundColor: 'hsl(var(--popover))',
        opacity: 1,
      }}
    >
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={`sep-${i}`} className="h-px bg-border my-1" />
        ) : (
          <button
            key={i}
            className={cn(
              "flex items-center gap-2 w-full rounded-sm px-2 py-1 text-left text-[13px] hover:bg-blue-500/15 hover:text-blue-700 dark:hover:text-blue-300 focus:bg-blue-500/15 outline-none cursor-pointer",
              item.danger && "text-destructive hover:text-destructive"
            )}
            onClick={item.onClick}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  );
}
