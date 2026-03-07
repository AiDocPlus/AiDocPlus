import type { useEditor } from '@tiptap/react';
import {
  Button,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../_framework/ui';
import {
  Palette, ChevronDown, Type, ArrowUpDown,
} from 'lucide-react';
import {
  DEFAULT_FONT_SIZE, FONT_SIZES, FONT_FAMILIES, LINE_HEIGHTS, TEXT_COLORS,
} from './editorConstants';

// ── 工具栏按钮子组件 ──

export function ToolBtn({ icon: Icon, title, onClick, active, disabled, className }: {
  icon: React.ElementType;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 w-7 p-0 ${active && !className ? 'bg-accent text-accent-foreground' : ''} ${className || ''}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

// ── 颜色选择器子组件 ──

export function ColorPicker({ editor, t }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string }) {
  if (!editor) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editorColor')}>
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="p-2 min-w-[120px]">
        <div className="grid grid-cols-4 gap-1">
          {TEXT_COLORS.map(color => (
            <button
              key={color}
              className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={color}
              onClick={() => editor.chain().focus().setColor(color).run()}
            />
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs text-muted-foreground justify-center"
          onClick={() => editor.chain().focus().unsetColor().run()}>
          {t('editorColorReset')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── 字号选择器子组件 ──

export function FontSizePicker({ editor, t }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string }) {
  if (!editor) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-1 text-[11px] min-w-[32px]" title={t('editorFontSize')}>
          <span className="font-mono">A</span>
          <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[80px]">
        {FONT_SIZES.map(size => (
          <DropdownMenuItem key={size}
            className={`text-xs ${size === DEFAULT_FONT_SIZE ? 'font-bold' : ''}`}
            onClick={() => editor.chain().focus().setFontSize(size).run()}>
            {size}{size === DEFAULT_FONT_SIZE ? ' ✓' : ''}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs text-muted-foreground"
          onClick={() => editor.chain().focus().unsetFontSize().run()}>
          {t('editorFontSizeReset')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── 字体选择器子组件 ──

export function FontFamilyPicker({ editor, t }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string }) {
  if (!editor) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[11px] min-w-[40px] gap-0.5" title={t('editorFontFamily')}>
          <Type className="h-3.5 w-3.5" />
          <ChevronDown className="h-2.5 w-2.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {FONT_FAMILIES.map(ff => (
          <DropdownMenuItem key={ff.label} className="text-xs"
            style={{ fontFamily: ff.value }}
            onClick={() => editor.chain().focus().setFontFamily(ff.value).run()}>
            {ff.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs text-muted-foreground"
          onClick={() => editor.chain().focus().unsetFontFamily().run()}>
          {t('editorFontFamilyReset')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── 行间距选择器子组件 ──

export function LineHeightPicker({ editor, t }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string }) {
  if (!editor) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editorLineHeight')}>
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[80px]">
        {LINE_HEIGHTS.map(lh => (
          <DropdownMenuItem key={lh} className="text-xs"
            onClick={() => (editor as any).commands.setLineHeight(lh)}>
            {lh}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs text-muted-foreground"
          onClick={() => (editor as any).commands.unsetLineHeight()}>
          {t('editorLineHeightReset')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
