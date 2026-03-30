/**
 * 幕布式节点浮动菜单 — 每行「⋯」触发：格式区 + 操作列表 + 底部元信息
 */

import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { OutlineHeadingLevel, OutlineNode } from '../types';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Type,
  Highlighter,
  MessageSquareText,
  ImageIcon,
  Smile,
  Table2,
  Link2,
  Download,
  Trash2,
  Eraser,
} from 'lucide-react';

const HIGHLIGHT_SWATCHES = [
  { name: 'yellow', value: '#fef3c7', labelKey: 'outline.nodeMenu.swatchYellow' },
  { name: 'green', value: '#d1fae5', labelKey: 'outline.nodeMenu.swatchGreen' },
  { name: 'blue', value: '#dbeafe', labelKey: 'outline.nodeMenu.swatchBlue' },
  { name: 'purple', value: '#e9d5ff', labelKey: 'outline.nodeMenu.swatchPurple' },
  { name: 'pink', value: '#fce7f3', labelKey: 'outline.nodeMenu.swatchPink' },
  { name: 'red', value: '#fee2e2', labelKey: 'outline.nodeMenu.swatchRed' },
];

export interface OutlineNodeMenuActions {
  onHeading: (level: OutlineHeadingLevel) => void;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onStrike: () => void;
  onClearFormat: () => void;
  onHighlight: (color: string | null) => void;
  onEditNote: () => void;
  onCopyLink: () => void;
  onExport?: () => void;
  onDelete: () => void;
}

/** 由 OutlineEditor 注入；`onEditNote` 仅在 OutlineRow 内合并 */
export type OutlineNodeMenuHandlersPartial = Omit<OutlineNodeMenuActions, 'onEditNote'>;

interface NodeFloatingMenuProps {
  node: OutlineNode;
  actions: OutlineNodeMenuActions;
  /** 触发器（通常为 ⋯ 按钮） */
  trigger: React.ReactNode;
  /** 是否展示导出（由工作区传入） */
  showExport?: boolean;
}

function formatNodeUpdatedAt(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function NodeFloatingMenu({ node, actions, trigger, showExport }: NodeFloatingMenuProps) {
  const { t, i18n } = useTranslation();
  const hl = node.headingLevel ?? 0;
  const wordCount = node.plainText?.length ?? 0;
  const updatedLabel = formatNodeUpdatedAt(node.updatedAt, i18n.language);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={6}
        className={cn(
          'w-[min(calc(100vw-2rem),18rem)] p-0 shadow-xl border bg-popover',
          '[background-color:hsl(var(--popover))] !opacity-100'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[min(calc(100vh-2rem),40rem)] overflow-y-auto overflow-x-hidden overscroll-contain">
        {/* 格式：标题 H1–H7 + 正文合并为子菜单 */}
        <div className="p-2 border-b border-border/80">
          <div className="grid grid-cols-4 gap-1">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={cn(
                  'col-span-2 flex h-9 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs outline-none',
                  'hover:bg-muted focus:bg-muted data-[state=open]:bg-muted',
                  hl > 0 && 'border-primary/30 bg-primary/5'
                )}
              >
                <Heading1 className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left font-medium">
                  {hl === 0
                    ? t('outline.nodeMenu.normalText', { defaultValue: '正文' })
                    : t('outline.toolbar.headingN', { n: hl, defaultValue: `标题 ${hl}` })}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[10rem] p-0" sideOffset={4}>
                <div className="max-h-[min(calc(100vh-2rem),24rem)] overflow-y-auto overflow-x-hidden p-1 overscroll-contain">
                  <DropdownMenuItem
                    className="text-sm"
                    onClick={() => actions.onHeading(0)}
                  >
                    {t('outline.nodeMenu.normalText', { defaultValue: '正文' })}
                  </DropdownMenuItem>
                  {([1, 2, 3, 4, 5, 6, 7] as const).map((lv) => (
                    <DropdownMenuItem
                      key={lv}
                      className="text-sm"
                      onClick={() => actions.onHeading(lv)}
                    >
                      {t(`outline.toolbar.heading${lv}`, {
                        defaultValue: `标题 ${lv}`,
                      })}
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <FormatCell
              title={t('outline.toolbar.bold', { defaultValue: '加粗' })}
              onClick={actions.onBold}
            >
              <Bold className="h-4 w-4" />
            </FormatCell>
            <FormatCell
              title={t('outline.toolbar.italic', { defaultValue: '斜体' })}
              onClick={actions.onItalic}
            >
              <Italic className="h-4 w-4" />
            </FormatCell>
            <FormatCell
              title={t('outline.toolbar.underline', { defaultValue: '下划线' })}
              onClick={actions.onUnderline}
            >
              <Underline className="h-4 w-4" />
            </FormatCell>
            <FormatCell
              title={t('outline.toolbar.strike', { defaultValue: '删除线' })}
              onClick={actions.onStrike}
            >
              <Strikethrough className="h-4 w-4" />
            </FormatCell>
          </div>
        </div>

        <DropdownMenuItem disabled className="gap-2 py-2 opacity-60">
          <Type className="h-4 w-4 shrink-0" />
          {t('outline.nodeMenu.fontColorSoon', { defaultValue: '字体颜色（即将支持）' })}
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 px-2 py-2 rounded-none">
            <Highlighter className="h-4 w-4 shrink-0 text-amber-500" />
            <span>{t('outline.nodeMenu.highlighter', { defaultValue: '荧光笔' })}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="p-0">
            <div className="max-h-[min(calc(100vh-2rem),24rem)] overflow-y-auto overflow-x-hidden p-2 overscroll-contain">
              <button
                type="button"
                className="mb-2 flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                onClick={() => actions.onHighlight(null)}
              >
                {t('outline.toolbar.clearHighlight', { defaultValue: '清除高亮' })}
              </button>
              <div className="grid grid-cols-3 gap-1.5">
                {HIGHLIGHT_SWATCHES.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    className="h-8 w-full rounded border border-border/60 hover:ring-2 hover:ring-primary/30"
                    style={{ backgroundColor: s.value }}
                    title={t(s.labelKey, { defaultValue: s.name })}
                    onClick={() => actions.onHighlight(s.value)}
                  />
                ))}
              </div>
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="my-0" />

        <DropdownMenuItem className="gap-2 py-2" onClick={() => actions.onClearFormat()}>
          <Eraser className="h-4 w-4 shrink-0" />
          {t('outline.nodeMenu.clearFormat', { defaultValue: '清除内联格式' })}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-0" />

        <DropdownMenuItem className="gap-2 py-2" onClick={() => actions.onEditNote()}>
          <MessageSquareText className="h-4 w-4 shrink-0" />
          {t('outline.nodeMenu.editNote', { defaultValue: '编辑描述' })}
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-2 py-2 opacity-50">
          <ImageIcon className="h-4 w-4 shrink-0" />
          {t('outline.nodeMenu.addImage', { defaultValue: '添加图片' })}
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-2 py-2 opacity-50">
          <Smile className="h-4 w-4 shrink-0" />
          {t('outline.nodeMenu.addIcon', { defaultValue: '添加图标' })}
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-2 py-2 opacity-50">
          <Table2 className="h-4 w-4 shrink-0" />
          {t('outline.nodeMenu.addTable', { defaultValue: '添加表格' })}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 py-2" onClick={() => actions.onCopyLink()}>
          <Link2 className="h-4 w-4 shrink-0" />
          {t('outline.nodeMenu.copyLink', { defaultValue: '复制主题链接' })}
        </DropdownMenuItem>
        {showExport && actions.onExport ? (
          <DropdownMenuItem className="gap-2 py-2" onClick={() => actions.onExport?.()}>
            <Download className="h-4 w-4 shrink-0" />
            {t('outline.nodeMenu.export', { defaultValue: '导出' })}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem
          className="gap-2 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={() => actions.onDelete()}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          {t('outline.nodeMenu.delete', { defaultValue: '删除' })}
        </DropdownMenuItem>

        <div className="border-t border-border/80 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <div>
            {t('outline.nodeMenu.editedAt', { defaultValue: '编辑于' })} {updatedLabel}
          </div>
          <div>
            {t('outline.nodeMenu.wordCount', { defaultValue: '字数' })} {wordCount}
          </div>
        </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FormatCell({
  children,
  title,
  active,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex h-9 w-full items-center justify-center rounded-md border border-transparent',
        'hover:bg-muted transition-colors',
        active && 'bg-primary/15 border-primary/30 text-primary'
      )}
    >
      {children}
    </button>
  );
}

export default NodeFloatingMenu;
