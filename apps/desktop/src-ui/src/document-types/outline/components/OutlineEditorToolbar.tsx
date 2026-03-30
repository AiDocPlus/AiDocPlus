/**
 * 大纲节点编辑工具栏 — 子大纲标签下方
 * 分组：查找 → 节点结构 → 文本样式 → 大纲视图
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Indent,
  Outdent,
  CopyPlus,
  Search,
  ChevronsDown,
  ChevronsUp,
  CornerDownRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Heading,
  ChevronDown,
  RemoveFormatting,
  UnfoldVertical,
} from 'lucide-react';
import type { OutlineHeadingLevel } from '../types';

const EDIT_TB_ICON = 'h-7 w-7 shrink-0 p-0';

const HIGHLIGHT_COLORS = [
  { name: 'yellow', value: '#fef3c7', labelKey: 'outline.nodeMenu.swatchYellow' as const },
  { name: 'green', value: '#d1fae5', labelKey: 'outline.nodeMenu.swatchGreen' as const },
  { name: 'blue', value: '#dbeafe', labelKey: 'outline.nodeMenu.swatchBlue' as const },
  { name: 'purple', value: '#e9d5ff', labelKey: 'outline.nodeMenu.swatchPurple' as const },
  { name: 'pink', value: '#fce7f3', labelKey: 'outline.nodeMenu.swatchPink' as const },
  { name: 'red', value: '#fee2e2', labelKey: 'outline.nodeMenu.swatchRed' as const },
];

// GroupLabel removed — toolbar icons are self-explanatory with tooltips

export interface OutlineEditorToolbarProps {
  visible: boolean;
  /** 已有节点但无选中时，多数结构操作不可用；格式亦依赖选中节点 */
  hasActiveNode: boolean;
  /** 空大纲或已选中时可添加同级 */
  canAddSibling: boolean;
  /** 空大纲或已选中时可添加子级 */
  canAddChild: boolean;
  /** 当前选中节点有子节点时可切换展开/折叠 */
  canToggleExpandActive: boolean;

  onAddSibling: () => void;
  onAddChild: () => void;
  onDeleteNode: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onClone: () => void;
  onOpenSearch: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleExpandActive: () => void;

  onFormatBold: () => void;
  onFormatItalic: () => void;
  onFormatUnderline: () => void;
  onFormatStrike: () => void;
  onClearFormat: () => void;
  onFormatHighlight: (color: string | null) => void;
  onSetHeading: (level: OutlineHeadingLevel) => void;
  /** 当前选中节点的标题级别（用于工具栏下拉展示） */
  activeHeadingLevel: OutlineHeadingLevel;
}

export function OutlineEditorToolbar({
  visible,
  hasActiveNode,
  canAddSibling,
  canAddChild,
  canToggleExpandActive,
  onAddSibling,
  onAddChild,
  onDeleteNode,
  onMoveUp,
  onMoveDown,
  onIndent,
  onOutdent,
  onClone,
  onOpenSearch,
  onExpandAll,
  onCollapseAll,
  onToggleExpandActive,
  onFormatBold,
  onFormatItalic,
  onFormatUnderline,
  onFormatStrike,
  onClearFormat,
  onFormatHighlight,
  onSetHeading,
  activeHeadingLevel,
}: OutlineEditorToolbarProps) {
  const { t } = useTranslation();
  const [highlightOpen, setHighlightOpen] = useState(false);

  if (!visible) return null;

  const fmt = hasActiveNode;

  return (
    <div
      className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border/60 bg-muted/20 px-2 py-1.5 flex-shrink-0"
      role="toolbar"
      aria-label={t('outline.editorToolbar.aria', { defaultValue: '大纲节点编辑' })}
    >
      {/* —— 查找 —— */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        onClick={onOpenSearch}
        title={t('outline.toolbar.search', { defaultValue: '搜索' })}
        aria-label={t('outline.toolbar.search', { defaultValue: '搜索' })}
      >
        <Search className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-4 data-[orientation=vertical]:h-4" />

      {/* —— 节点 —— */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!canAddSibling}
        onClick={onAddSibling}
        title={t('outline.toolbar.addSibling', { defaultValue: '添加同级' })}
        aria-label={t('outline.toolbar.addSibling', { defaultValue: '添加同级' })}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!canAddChild}
        onClick={onAddChild}
        title={t('outline.toolbar.addChild', { defaultValue: '添加子节点' })}
        aria-label={t('outline.toolbar.addChild', { defaultValue: '添加子节点' })}
      >
        <CornerDownRight className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!hasActiveNode}
        onClick={onDeleteNode}
        title={t('outline.toolbar.deleteNode', { defaultValue: '删除节点' })}
        aria-label={t('outline.toolbar.deleteNode', { defaultValue: '删除节点' })}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!hasActiveNode}
        onClick={onMoveUp}
        title={t('outline.toolbar.moveUp', { defaultValue: '上移' })}
        aria-label={t('outline.toolbar.moveUp', { defaultValue: '上移' })}
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!hasActiveNode}
        onClick={onMoveDown}
        title={t('outline.toolbar.moveDown', { defaultValue: '下移' })}
        aria-label={t('outline.toolbar.moveDown', { defaultValue: '下移' })}
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!hasActiveNode}
        onClick={onIndent}
        title={t('outline.toolbar.indent', { defaultValue: '缩进' })}
        aria-label={t('outline.toolbar.indent', { defaultValue: '缩进' })}
      >
        <Indent className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!hasActiveNode}
        onClick={onOutdent}
        title={t('outline.toolbar.outdent', { defaultValue: '反缩进' })}
        aria-label={t('outline.toolbar.outdent', { defaultValue: '反缩进' })}
      >
        <Outdent className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!hasActiveNode}
        onClick={onClone}
        title={t('outline.toolbar.clone', { defaultValue: '克隆' })}
        aria-label={t('outline.toolbar.clone', { defaultValue: '克隆' })}
      >
        <CopyPlus className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-4" />

      {/* —— 样式 —— */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!fmt}
        onClick={onFormatBold}
        title={t('outline.toolbar.bold', { defaultValue: '加粗' })}
        aria-label={t('outline.toolbar.bold', { defaultValue: '加粗' })}
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!fmt}
        onClick={onFormatItalic}
        title={t('outline.toolbar.italic', { defaultValue: '斜体' })}
        aria-label={t('outline.toolbar.italic', { defaultValue: '斜体' })}
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!fmt}
        onClick={onFormatUnderline}
        title={t('outline.toolbar.underline', { defaultValue: '下划线' })}
        aria-label={t('outline.toolbar.underline', { defaultValue: '下划线' })}
      >
        <Underline className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!fmt}
        onClick={onFormatStrike}
        title={t('outline.toolbar.strike', { defaultValue: '删除线' })}
        aria-label={t('outline.toolbar.strike', { defaultValue: '删除线' })}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!fmt}
        onClick={onClearFormat}
        title={t('outline.toolbar.clearFormat', { defaultValue: '清除内联格式' })}
        aria-label={t('outline.toolbar.clearFormat', { defaultValue: '清除内联格式' })}
      >
        <RemoveFormatting className="h-3.5 w-3.5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!fmt}
            className="h-7 shrink-0 gap-0.5 px-2 text-xs font-medium"
            title={t('outline.toolbar.headingPicker', { defaultValue: '标题与正文' })}
            aria-label={t('outline.toolbar.headingPicker', { defaultValue: '标题与正文' })}
          >
            <Heading className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[4.5rem] truncate tabular-nums">
              {fmt
                ? activeHeadingLevel === 0
                  ? t('outline.toolbar.normal', { defaultValue: '正文' })
                  : t('outline.toolbar.headingNShort', {
                      n: activeHeadingLevel,
                      defaultValue: `H${activeHeadingLevel}`,
                    })
                : '—'}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[10rem]">
          <DropdownMenuItem className="text-sm" onClick={() => onSetHeading(0)}>
            {t('outline.toolbar.normal', { defaultValue: '正文' })}
          </DropdownMenuItem>
          {([1, 2, 3, 4, 5, 6, 7] as const).map((lv) => (
            <DropdownMenuItem key={lv} className="text-sm" onClick={() => onSetHeading(lv)}>
              {t(`outline.toolbar.heading${lv}`, { defaultValue: `标题 ${lv}` })}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={EDIT_TB_ICON}
            disabled={!fmt}
            title={t('outline.toolbar.highlight', { defaultValue: '高亮' })}
            aria-label={t('outline.toolbar.highlight', { defaultValue: '高亮' })}
          >
            <Highlighter className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div className="mb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!fmt}
              onClick={() => {
                onFormatHighlight(null);
                setHighlightOpen(false);
              }}
            >
              {t('outline.toolbar.clearHighlight', { defaultValue: '清除高亮' })}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                disabled={!fmt}
                onClick={() => {
                  onFormatHighlight(c.value);
                  setHighlightOpen(false);
                }}
                className="h-7 w-7 shrink-0 rounded border hover:scale-105 transition-transform disabled:opacity-40"
                style={{ backgroundColor: c.value }}
                title={t(c.labelKey, { defaultValue: c.name })}
                aria-label={t(c.labelKey, { defaultValue: c.name })}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-0.5 h-4" />

      {/* —— 视图 —— */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        disabled={!canToggleExpandActive}
        onClick={onToggleExpandActive}
        title={t('outline.toolbar.toggleExpandBranch', { defaultValue: '展开/折叠当前分支' })}
        aria-label={t('outline.toolbar.toggleExpandBranch', { defaultValue: '展开/折叠当前分支' })}
      >
        <UnfoldVertical className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        onClick={onExpandAll}
        title={t('outline.toolbar.expandAll', { defaultValue: '全部展开' })}
        aria-label={t('outline.toolbar.expandAll', { defaultValue: '全部展开' })}
      >
        <ChevronsDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={EDIT_TB_ICON}
        onClick={onCollapseAll}
        title={t('outline.toolbar.collapseAll', { defaultValue: '全部折叠' })}
        aria-label={t('outline.toolbar.collapseAll', { defaultValue: '全部折叠' })}
      >
        <ChevronsUp className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default OutlineEditorToolbar;
