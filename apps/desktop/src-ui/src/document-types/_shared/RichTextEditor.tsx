/**
 * 公共 TipTap 富文本编辑器
 * 从 EmailBodyEditor 提取核心，适配文档类型上下文（使用 useTranslation）
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Extension } from '@tiptap/core';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Quote, Code, Minus, Link as LinkIcon, Undo2, Redo2,
  PenLine, Code2, Eye, RemoveFormatting, Pilcrow, ChevronDown,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Table as TableIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── TipTap 自定义扩展（复用邮件插件的逻辑）──

const TextIndent = Extension.create({
  name: 'textIndent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        textIndent: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style?.textIndent || null,
          renderHTML: (attrs: Record<string, string | null>) => {
            if (!attrs.textIndent) return {};
            return { style: `text-indent: ${attrs.textIndent}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      toggleTextIndent: (indent: string) => ({ editor: ed, commands }: { editor: any; commands: any }) => {
        const current = ed.getAttributes('paragraph').textIndent || ed.getAttributes('heading').textIndent;
        if (current) {
          return commands.updateAttributes('paragraph', { textIndent: null })
            || commands.updateAttributes('heading', { textIndent: null });
        }
        return commands.updateAttributes('paragraph', { textIndent: indent })
          || commands.updateAttributes('heading', { textIndent: indent });
      },
    } as any;
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const ed = this.editor;
        if (ed.isActive('bulletList') || ed.isActive('orderedList')) return false;
        return (ed as any).commands.toggleTextIndent('2em');
      },
    };
  },
});

// ── 工具栏按钮 ──

function ToolBtn({ icon: Icon, title, onClick, active, disabled }: {
  icon: React.ElementType; title: string; onClick: () => void;
  active?: boolean; disabled?: boolean;
}) {
  return (
    <Button variant="ghost" size="sm"
      className={`h-6 w-6 p-0 ${active ? 'bg-accent text-accent-foreground' : ''}`}
      title={title} onClick={onClick} disabled={disabled}>
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

// ── 颜色选择器 ──

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#2563eb', '#7c3aed', '#db2777', '#0d9488',
];

// ── 公共编辑器类型 ──

export type RichTextEditorMode = 'edit' | 'source' | 'preview';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, editable = true, className }: RichTextEditorProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<RichTextEditorMode>('edit');
  const [sourceCode, setSourceCode] = useState('');
  const skipNextUpdate = useRef(false);
  const isInternalChange = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);

  const debouncedOnChange = useCallback((html: string) => {
    pendingHtmlRef.current = html;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      isInternalChange.current = true;
      onChange(html);
      pendingHtmlRef.current = null;
    }, 400);
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingHtmlRef.current !== null) onChange(pendingHtmlRef.current);
    };
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false, underline: false }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      Superscript,
      Subscript,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || '' }),
      TextIndent,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value || '',
    editable,
    onUpdate: ({ editor: ed }) => {
      if (skipNextUpdate.current) { skipNextUpdate.current = false; return; }
      debouncedOnChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'rich-text-editor prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2 h-full',
        style: 'font-family: "Songti SC", "SimSun", "STSong", serif; font-size: 16px;',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (isInternalChange.current) { isInternalChange.current = false; return; }
    const currentHtml = editor.getHTML();
    if (value !== currentHtml && value !== undefined) {
      skipNextUpdate.current = true;
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  const switchToMode = useCallback((newMode: RichTextEditorMode) => {
    if (!editor) return;
    if (mode === 'edit' && newMode === 'source') {
      setSourceCode(editor.getHTML());
    } else if (mode === 'source' && (newMode === 'edit' || newMode === 'preview')) {
      skipNextUpdate.current = true;
      editor.commands.setContent(sourceCode, { emitUpdate: false });
      onChange(sourceCode);
    }
    setMode(newMode);
  }, [editor, mode, sourceCode, onChange]);

  const handleInsertLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt(t('editor.linkPrompt', { defaultValue: '输入链接地址' }), prev);
    if (url === null) return;
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, t]);

  const handleInsertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={`flex flex-col h-full overflow-hidden bg-background ${className || ''}`}>
      {/* 工具栏 */}
      {editable && (
        <div className="flex items-center gap-0.5 px-1.5 py-0.5 border-b bg-muted/30 flex-wrap flex-shrink-0">
          {/* 撤销/重做 */}
          <ToolBtn icon={Undo2} title={t('editor.undo', { defaultValue: '撤销' })} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
          <ToolBtn icon={Redo2} title={t('editor.redo', { defaultValue: '重做' })} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
          <Separator orientation="vertical" className="h-4 mx-0.5" />
          {/* 段落格式 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-1 text-[10px] gap-0.5">
                <Pilcrow className="h-3 w-3" /><ChevronDown className="h-2.5 w-2.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[120px]">
              <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                <Pilcrow className="h-4 w-4 mr-2" />{t('editor.paragraph', { defaultValue: '正文' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {([1, 2, 3] as const).map(level => {
                const icons = [Heading1, Heading2, Heading3];
                const Icon = icons[level - 1];
                return (
                  <DropdownMenuItem key={level} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
                    className={editor.isActive('heading', { level }) ? 'font-bold' : ''}>
                    <Icon className="h-4 w-4 mr-2" />H{level}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-4 mx-0.5" />
          {/* 文字格式 */}
          <ToolBtn icon={Bold} title={t('editor.bold', { defaultValue: '加粗' })} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
          <ToolBtn icon={Italic} title={t('editor.italic', { defaultValue: '斜体' })} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
          <ToolBtn icon={UnderlineIcon} title={t('editor.underline', { defaultValue: '下划线' })} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
          <ToolBtn icon={Strikethrough} title={t('editor.strikethrough', { defaultValue: '删除线' })} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
          <ToolBtn icon={Highlighter} title={t('editor.highlight', { defaultValue: '高亮' })} onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} />
          <ToolBtn icon={SuperscriptIcon} title={t('editor.superscript', { defaultValue: '上标' })} onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} />
          <ToolBtn icon={SubscriptIcon} title={t('editor.subscript', { defaultValue: '下标' })} onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} />
          {/* 颜色 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title={t('editor.color', { defaultValue: '文字颜色' })}>
                <span className="text-[10px] font-bold" style={{ color: editor.getAttributes('textStyle').color || 'currentColor' }}>A</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="p-2">
              <div className="grid grid-cols-4 gap-1">
                {TEXT_COLORS.map(color => (
                  <button key={color} className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }} onClick={() => editor.chain().focus().setColor(color).run()} />
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs justify-center" onClick={() => editor.chain().focus().unsetColor().run()}>
                {t('editor.colorReset', { defaultValue: '重置颜色' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-4 mx-0.5" />
          {/* 对齐 */}
          <ToolBtn icon={AlignLeft} title={t('editor.alignLeft', { defaultValue: '左对齐' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} />
          <ToolBtn icon={AlignCenter} title={t('editor.alignCenter', { defaultValue: '居中' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} />
          <ToolBtn icon={AlignRight} title={t('editor.alignRight', { defaultValue: '右对齐' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} />
          <Separator orientation="vertical" className="h-4 mx-0.5" />
          {/* 列表/引用/代码 */}
          <ToolBtn icon={List} title={t('editor.bulletList', { defaultValue: '无序列表' })} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
          <ToolBtn icon={ListOrdered} title={t('editor.orderedList', { defaultValue: '有序列表' })} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
          <ToolBtn icon={Quote} title={t('editor.blockquote', { defaultValue: '引用' })} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
          <ToolBtn icon={Code} title={t('editor.codeBlock', { defaultValue: '代码块' })} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} />
          <Separator orientation="vertical" className="h-4 mx-0.5" />
          {/* 插入 */}
          <ToolBtn icon={LinkIcon} title={t('editor.link', { defaultValue: '插入链接' })} onClick={handleInsertLink} />
          <ToolBtn icon={TableIcon} title={t('editor.table', { defaultValue: '插入表格' })} onClick={handleInsertTable} />
          <ToolBtn icon={Minus} title={t('editor.hr', { defaultValue: '分割线' })} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
          <Separator orientation="vertical" className="h-4 mx-0.5" />
          <ToolBtn icon={RemoveFormatting} title={t('editor.clearFormat', { defaultValue: '清除格式' })} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
          {/* 模式切换 */}
          <div className="flex-1" />
          <ToolBtn icon={PenLine} title={t('editor.modeEdit', { defaultValue: '编辑模式' })} onClick={() => switchToMode('edit')} active={mode === 'edit'} />
          <ToolBtn icon={Code2} title={t('editor.modeSource', { defaultValue: '源码模式' })} onClick={() => switchToMode('source')} active={mode === 'source'} />
          <ToolBtn icon={Eye} title={t('editor.modePreview', { defaultValue: '预览模式' })} onClick={() => switchToMode('preview')} active={mode === 'preview'} />
        </div>
      )}

      {/* 编辑器内容区 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {mode === 'edit' && <EditorContent editor={editor} className="h-full" />}
        {mode === 'source' && (
          <textarea value={sourceCode} onChange={(e) => setSourceCode(e.target.value)}
            className="w-full h-full px-3 py-2 text-xs font-mono bg-background resize-none focus:outline-none"
            style={{ tabSize: 2 }} spellCheck={false} />
        )}
        {mode === 'preview' && (
          <div className="rich-text-editor prose prose-sm dark:prose-invert max-w-none px-3 py-2"
            style={{ fontFamily: '"Songti SC", "SimSun", "STSong", serif', fontSize: '16px' }}
            dangerouslySetInnerHTML={{ __html: value || '' }} />
        )}
      </div>

      {/* TipTap 样式 */}
      <style>{`
        .rich-text-editor table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .rich-text-editor th, .rich-text-editor td { border: 1px solid var(--border, #ddd); padding: 4px 8px; min-width: 50px; }
        .rich-text-editor th { background: var(--muted, #f5f5f5); font-weight: 600; }
        .rich-text-editor p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: var(--muted-foreground, #999); pointer-events: none; height: 0; }
        .rich-text-editor blockquote { border-left: 3px solid var(--border, #ddd); padding-left: 1em; margin-left: 0; color: var(--muted-foreground, #666); }
        .rich-text-editor pre { background: var(--muted, #f5f5f5); border-radius: 4px; padding: 8px; overflow-x: auto; }
        .rich-text-editor code { background: var(--muted, #f5f5f5); padding: 1px 3px; border-radius: 3px; font-size: 0.9em; }
        .rich-text-editor pre code { background: none; padding: 0; }
        .rich-text-editor img { max-width: 100%; height: auto; }
      `}</style>
    </div>
  );
}
