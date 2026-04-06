/**
 * 大纲节点行组件
 *
 * 单个大纲节点的渲染和交互，支持：
 * - ProseMirror 富文本编辑
 * - 拖拽排序
 * - 备注编辑
 * - 标签显示
 */

import { useState, useRef, useCallback, useMemo, forwardRef, type ForwardedRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  ChevronDown,
  MessageSquare,
  MoreHorizontal,
  ZoomIn,
} from 'lucide-react';

import type { OutlineNode, RichTextContent } from '../types';
import { outlineHeadingEditorClass } from '../outlineHeadingLevel';
import { createRichTextFromPlain } from '../types';
import {
  ProseMirrorNodeEditor,
} from './ProseMirrorNodeEditor';
import type { ProseMirrorNodeEditorRef } from './ProseMirrorNodeEditor';
import { NodeFloatingMenu } from './NodeFloatingMenu';
import type { OutlineNodeMenuHandlersPartial } from './NodeFloatingMenu';

/**
 * 节点行属性
 */
interface OutlineRowProps {
  /** 用于 @dnd-kit 与列表 key，须在同一棵树内唯一（建议用 path.join('.')，避免重复 node.id） */
  sortableId: string;
  node: OutlineNode;
  depth: number;
  isLast: boolean;
  isSelected: boolean;
  isActive: boolean;
  isCollapsed: boolean;
  isSearchMatch: boolean;
  isDragOverTarget?: boolean;
  showGuideLines: boolean;
  showNotes: 'all' | 'hover' | 'active';
  lineSpacing: 'compact' | 'normal' | 'loose';
  enableDragAndDrop?: boolean;
  searchQuery?: string;
  searchCaseSensitive?: boolean;
  searchUseRegex?: boolean;
  onContentChange: (content: RichTextContent) => void;
  onNoteChange: (note: RichTextContent) => void;
  onToggleExpand: () => void;
  onSelect: (mode: 'single' | 'toggle' | 'range') => void;
  onActivate: () => void;
  onFocus: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  onAddSibling?: () => void;
  onDeleteIfEmpty?: () => void;
  onEditNote?: () => void;
  onKeyDown?: (event: KeyboardEvent) => boolean;
  /**
   * 注册/注销该节点的富文本编辑器实例（用于悬浮工具栏等全局格式化入口）
   * - mount 时传实例
   * - unmount 时传 null
   */
  onRegisterEditor?: (nodeId: string, editor: ProseMirrorNodeEditorRef | null) => void;
  /** 幕布式节点菜单（不含「编辑描述」，由本行合并备注编辑） */
  nodeMenuHandlers?: OutlineNodeMenuHandlersPartial;
  showExportInMenu?: boolean;
}

export const OutlineRow = forwardRef(function OutlineRow(
  {
    sortableId,
    node,
    depth,
    isSelected,
    isActive,
    isCollapsed,
    isSearchMatch,
    isDragOverTarget = false,
    showGuideLines,
    showNotes,
    lineSpacing,
    enableDragAndDrop = true,
    onContentChange,
    onNoteChange,
    onToggleExpand,
    onSelect,
    onActivate,
    onFocus,
    onIndent,
    onOutdent,
    onAddSibling,
    onKeyDown,
    onRegisterEditor,
    nodeMenuHandlers,
    showExportInMenu,
  }: OutlineRowProps,
  ref: ForwardedRef<HTMLDivElement>
) {
    const { t } = useTranslation();
    const editorRef = useRef<ProseMirrorNodeEditorRef>(null);
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');

    // 拖拽功能
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: sortableId,
      data: {
        node,
        depth,
      },
    });

    // 拖拽样式
    const dragStyle = transform
      ? {
          transform: CSS.Transform.toString(transform),
          transition,
        }
      : undefined;

    // 是否显示备注
    const showNote = useMemo(() => {
      if (!node.notePlainText) return false;
      switch (showNotes) {
        case 'all':
          return true;
        case 'active':
          return isActive;
        case 'hover':
          return isActive || isSelected;
        default:
          return false;
      }
    }, [node.notePlainText, showNotes, isActive, isSelected]);

    // 行间距样式
    const spacingClass = useMemo(() => {
      switch (lineSpacing) {
        case 'compact':
          return 'py-0.5';
        case 'loose':
          return 'py-2';
        default:
          return 'py-1';
      }
    }, [lineSpacing]);

    // 层级缩进（避免 inline style：使用 CSS 变量）
    const indentVars = useMemo(
      () =>
        ({
          '--outline-indent': `${depth * 24 + 8}px`,
          '--outline-guide-left': `${(depth - 1) * 24 + 16}px`,
        }) as React.CSSProperties,
      [depth]
    );

    // 是否有子节点（防御：异常数据或热更新半态）
    const hasChildren = (node.children?.length ?? 0) > 0;

    // 处理编辑器键盘事件
    const handleEditorKeyDown = useCallback(
      (event: KeyboardEvent) => {
        // 先交给父组件处理
        if (onKeyDown?.(event)) {
          return true;
        }

        // IME 组字/选词：勿拦截 Enter/Tab，避免与输入法冲突
        if (event.isComposing || event.keyCode === 229) {
          return false;
        }

        // Tab - 缩进
        if (event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          onIndent?.();
          return true;
        }

        // Shift+Tab - 提升
        if (event.key === 'Tab' && event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          onOutdent?.();
          return true;
        }

        // Enter - 新建同级（须阻断冒泡到 window，否则 useOutlineKeyboard 会再建一条）
        if (event.key === 'Enter' && !event.shiftKey) {
          if (event.repeat) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return true;
          }
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          onAddSibling?.();
          return true;
        }

        // Shift+Enter - 编辑备注
        if (event.key === 'Enter' && event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          setIsEditingNote(true);
          setNoteDraft(node.notePlainText || '');
          return true;
        }

        return false;
      },
      [onKeyDown, onIndent, onOutdent, onAddSibling, node.notePlainText]
    );

    // 处理内容变更
    const handleContentChange = useCallback(
      (content: RichTextContent, _plainText: string, _tags: string[], _mentions: string[]) => {
        onContentChange(content);
      },
      [onContentChange]
    );

    // 处理备注保存
    const handleSaveNote = useCallback(() => {
      if (noteDraft.trim()) {
        const note = createRichTextFromPlain(noteDraft.trim());
        onNoteChange(note);
      } else {
        onNoteChange({ type: 'doc', content: [] });
      }
      setIsEditingNote(false);
    }, [noteDraft, onNoteChange]);

    // 处理编辑器实例注册
    const registerEditor = useCallback(
      (editor: ProseMirrorNodeEditorRef | null) => {
        editorRef.current = editor;
        onRegisterEditor?.(node.id, editor);
      },
      [node.id, onRegisterEditor]
    );

    // 合并 refs
    const setRefs = useCallback(
      (el: HTMLDivElement | null) => {
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref) {
          ref.current = el;
        }
        setNodeRef(el);
      },
      [ref, setNodeRef]
    );

    return (
      <div
        ref={setRefs}
        style={{ ...dragStyle, ...indentVars }}
        className={cn(
          'group outline-row flex items-start gap-x-[1ch] transition-colors rounded-sm relative',
          spacingClass,
          isSelected && 'selected bg-primary/10',
          isSearchMatch && 'search-match',
          isDragOverTarget && 'ring-1 ring-primary/40 bg-primary/5',
          !isSelected && !isSearchMatch && 'hover:bg-muted/50',
          isActive && 'active bg-muted/30',
          node.completed && 'completed',
          isDragging && 'dragging opacity-50'
        )}
        data-depth={depth}
        onClick={(e) => {
          if (e.shiftKey) {
            onSelect('range');
          } else if (e.metaKey || e.ctrlKey) {
            onSelect('toggle');
          } else {
            onSelect('single');
          }
        }}
      >
        {/* 层级引导线 */}
        {showGuideLines && depth > 0 && (
          <div
            className="outline-guide-line"
            data-level={Math.min(depth, 3)}
          />
        )}

        {/* 外侧：⋯ 菜单 → 折叠 → 小黑点；与正文间隔 1ch（见 outline-row gap-x-[1ch]） */}
        <div className="outline-row-gutter">
          {nodeMenuHandlers ? (
            <NodeFloatingMenu
              node={node}
              showExport={!!showExportInMenu}
              actions={{
                ...nodeMenuHandlers,
                onEditNote: () => {
                  setIsEditingNote(true);
                  setNoteDraft(node.notePlainText || '');
                },
              }}
              trigger={
                <button
                  type="button"
                  className={cn(
                    'outline-node-menu-trigger flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none',
                    'border border-transparent text-muted-foreground',
                    'opacity-40 transition-opacity hover:opacity-100 hover:bg-muted/80 hover:border-border',
                    (isActive || isSelected) && 'opacity-100'
                  )}
                  onClick={(e) => e.stopPropagation()}
                  tabIndex={-1}
                  aria-label={t('outline.nodeMenu.open', { defaultValue: '节点菜单' })}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              }
            />
          ) : null}

          <button
            className={cn(
              'flex h-5 w-5 flex-shrink-0 items-center justify-center leading-none',
              hasChildren
                ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                : 'invisible pointer-events-none'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            tabIndex={-1}
          >
            {hasChildren &&
              (isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              ))}
          </button>

          {/* 幕布式小黑点；与拖拽合并 */}
          <button
            type="button"
            {...(enableDragAndDrop ? { ...attributes, ...listeners } : {})}
            className={cn(
              'outline-bullet',
              enableDragAndDrop && 'outline-bullet-draggable cursor-grab active:cursor-grabbing touch-none',
              'circle'
            )}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
            aria-label={t('outline.dragHandle', { defaultValue: '拖拽排序' })}
          >
            <span className="outline-bullet-dot" aria-hidden />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-w-0 outline-node-content">
          {/* 富文本编辑器 */}
          {node.colorHighlight ? (
            <div className="inline-block rounded-sm" style={{ backgroundColor: node.colorHighlight }}>
              <ProseMirrorNodeEditor
            ref={registerEditor}
            content={node.content}
            isActive={isActive}
            completed={node.completed}
            onChange={handleContentChange}
            onFocus={onActivate}
            onKeyDown={handleEditorKeyDown}
            className={outlineHeadingEditorClass(node.headingLevel ?? 0)}
          />
            </div>
          ) : (
          <ProseMirrorNodeEditor
            ref={registerEditor}
            content={node.content}
            isActive={isActive}
            completed={node.completed}
            onChange={handleContentChange}
            onFocus={onActivate}
            onKeyDown={handleEditorKeyDown}
            className={outlineHeadingEditorClass(node.headingLevel ?? 0)}
          />
          )}

          {/* 备注显示 */}
          {showNote && !isEditingNote && (
            <div
              className="outline-note"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingNote(true);
                setNoteDraft(node.notePlainText || '');
              }}
            >
              <MessageSquare className="h-3 w-3 inline mr-1" />
              {node.notePlainText}
            </div>
          )}

          {/* 备注编辑 */}
          {isEditingNote && (
            <div className="flex items-center gap-1 mt-1">
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveNote();
                  } else if (e.key === 'Escape') {
                    setIsEditingNote(false);
                  }
                }}
                className="flex-1 text-xs bg-muted/50 rounded px-2 py-1 outline-none border border-border focus:border-primary"
                placeholder={t('outline.notePlaceholder', {
                  defaultValue: '输入备注...',
                })}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button
                className="text-xs text-primary hover:text-primary/80 px-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveNote();
                }}
              >
                {t('common.save', { defaultValue: '保存' })}
              </button>
              <button
                className="text-xs text-muted-foreground hover:text-foreground px-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingNote(false);
                }}
              >
                {t('common.cancel', { defaultValue: '取消' })}
              </button>
            </div>
          )}

          {/* 标签显示 */}
          {((node.tags?.length ?? 0) > 0 || (node.mentions?.length ?? 0) > 0) && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {(node.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="outline-tag-item hash"
                >
                  #{tag}
                </span>
              ))}
              {(node.mentions ?? []).map((mention) => (
                <span
                  key={mention}
                  className="outline-tag-item mention"
                >
                  @{mention}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 操作按钮（悬浮显示） */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
            }}
            title={t('outline.focusMode', { defaultValue: '进入专注模式' })}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>

          <button
            className={cn(
              'w-6 h-6 flex items-center justify-center rounded hover:bg-accent',
              node.notePlainText ? 'text-primary' : 'text-muted-foreground'
            )}
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingNote(true);
              setNoteDraft(node.notePlainText || '');
            }}
            title={t('outline.addNote', { defaultValue: '添加备注' })}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }
);

export default OutlineRow;
