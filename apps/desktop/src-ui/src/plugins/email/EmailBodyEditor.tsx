import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';

import { usePluginHost } from '../_framework/PluginHostAPI';
import {
  Button, Separator,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '../_framework/ui';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Minus,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, ImagePlus, Table as TableIcon,
  Undo2, Redo2, Palette, RemoveFormatting,
  Trash2, ArrowDown, ArrowRight,
  PenLine, Code2, Eye,
  FileText, ChevronDown,
} from 'lucide-react';
import { looksLikeMarkdown, convertMarkdownToHtml } from './markdownToHtml';

export interface EmailBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * 邮件正文富文本编辑器
 * 基于 TipTap，所见即所得，输出 HTML，支持图片内嵌
 * 内置导入功能（正文/插件/合并区），统一 MD→HTML 转换
 * 完全独立于主程序编辑器，仅使用 SDK 接口
 */
type EditorMode = 'edit' | 'source' | 'preview';

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

export function EmailBodyEditor({ value, onChange, placeholder, t }: EmailBodyEditorProps) {
  const host = usePluginHost();
  const isDark = host.ui.getTheme() === 'dark';
  const skipNextUpdate = useRef(false);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [sourceCode, setSourceCode] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank' } }),
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || '' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false;
        return;
      }
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'email-tiptap-editor prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3 h-full',
        style: `font-family: 宋体, SimSun, serif; font-size: 16px;`,
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          event.preventDefault();
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUri = reader.result as string;
                view.dispatch(view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes.image.create({ src: dataUri })
                ));
              };
              reader.readAsDataURL(file);
            }
          }
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            const reader = new FileReader();
            reader.onload = () => {
              const dataUri = reader.result as string;
              view.dispatch(view.state.tr.replaceSelectionWith(
                view.state.schema.nodes.image.create({ src: dataUri })
              ));
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
  });

  // 外部 value 变化时同步（如 AI 生成内容注入）
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (value !== currentHtml && value !== undefined) {
      skipNextUpdate.current = true;
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  // ── 导入内容（统一 MD→HTML 转换） ──
  const importContent = useCallback((text: string) => {
    const html = looksLikeMarkdown(text) ? convertMarkdownToHtml(text) : text;
    onChange(html);
  }, [onChange]);

  const handleImportDocument = useCallback(() => {
    const text = host.content.getAIContent() || host.content.getDocumentContent();
    if (!text?.trim()) {
      host.ui.showStatus(t('importEmpty'), true);
      return;
    }
    importContent(text);
    host.ui.showStatus(t('importedFrom', { source: t('importSourceContent') }));
  }, [host, t, importContent]);

  const handleImportComposed = useCallback(() => {
    const text = host.content.getComposedContent();
    if (!text?.trim()) {
      host.ui.showStatus(t('importComposedEmpty'), true);
      return;
    }
    importContent(text);
    host.ui.showStatus(t('importedFrom', { source: t('importSourceComposed') }));
  }, [host, t, importContent]);

  const handleImportFragment = useCallback((markdown: string, title: string) => {
    importContent(markdown);
    host.ui.showStatus(t('importedFrom', { source: title }));
  }, [host, t, importContent]);

  // 插件片段
  const fragmentGroups = useMemo(() => host.content.getPluginFragments(), [host]);

  // ── 图片插入（通过文件选择器） ──
  const handleInsertImage = useCallback(async () => {
    if (!editor) return;
    const filePath = await host.ui.showOpenDialog({
      filters: [{ name: t('editorImageFilter'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    });
    if (!filePath) return;
    try {
      const dataUri = await host.platform.invoke<string>('read_file_base64', { path: filePath });
      editor.chain().focus().setImage({ src: dataUri }).run();
    } catch (err) {
      host.ui.showStatus(t('editorImageError', { error: err instanceof Error ? err.message : String(err) }), true);
    }
  }, [editor, host.ui, host.platform, t]);

  // ── 链接插入 ──
  const handleInsertLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt(t('editorLinkPrompt'), prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor, t]);

  // ── 表格插入 ──
  const handleInsertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  // ── 清除格式 ──
  const handleClearFormatting = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  }, [editor]);

  // ── 模式切换逻辑 ──
  const switchToMode = useCallback((newMode: EditorMode) => {
    if (!editor) return;
    if (mode === 'edit' && newMode === 'source') {
      setSourceCode(editor.getHTML());
    } else if (mode === 'source' && newMode === 'edit') {
      skipNextUpdate.current = true;
      editor.commands.setContent(sourceCode, { emitUpdate: false });
      onChange(sourceCode);
    } else if (mode === 'source' && newMode === 'preview') {
      skipNextUpdate.current = true;
      editor.commands.setContent(sourceCode, { emitUpdate: false });
      onChange(sourceCode);
    }
    setMode(newMode);
  }, [editor, mode, sourceCode, onChange]);

  // ── 字符计数 ──
  const charCount = useMemo(() => {
    if (mode === 'source') return sourceCode.length;
    const text = value?.replace(/<[^>]*>/g, '') || '';
    return text.length;
  }, [value, sourceCode, mode]);

  if (!editor) return null;

  const isInTable = editor.isActive('table');
  const hasFragments = fragmentGroups.size > 0;

  return (
    <div className={`overflow-hidden bg-background flex flex-col h-full ${isDark ? 'dark' : ''}`}>
      {/* ── 工具栏第一行：导入 + 格式 ── */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b bg-muted/30 flex-wrap">
        {/* 导入下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-0.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={handleImportDocument}>
              <FileText className="h-4 w-4 mr-2" />
              {t('importContent')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportComposed}>
              {t('importComposed')}
            </DropdownMenuItem>
            {hasFragments && (
              <>
                <DropdownMenuSeparator />
                {Array.from(fragmentGroups.entries()).map(([pluginId, group]) => {
                  const IconComp = group.pluginIcon;
                  if (group.fragments.length === 1) {
                    const f = group.fragments[0];
                    return (
                      <DropdownMenuItem key={pluginId} onClick={() => handleImportFragment(f.markdown, f.title)}>
                        {IconComp && <IconComp className="h-4 w-4 mr-2 flex-shrink-0" />}
                        <span className="truncate">{group.pluginName}：{f.title}</span>
                      </DropdownMenuItem>
                    );
                  }
                  return (
                    <DropdownMenuSub key={pluginId}>
                      <DropdownMenuSubTrigger>
                        {IconComp && <IconComp className="h-4 w-4 mr-2 flex-shrink-0" />}
                        <span className="truncate">{group.pluginName}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        {group.fragments.map((f) => (
                          <DropdownMenuItem key={f.id} onClick={() => handleImportFragment(f.markdown, f.title)}>
                            <span className="truncate">{f.title}</span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                          const allMd = group.fragments.map(f => f.markdown).join('\n\n---\n\n');
                          handleImportFragment(allMd, `${group.pluginName}`);
                        }}>
                          {t('importAll')}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                })}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={Undo2} title={t('editorUndo')} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
        <ToolBtn icon={Redo2} title={t('editorRedo')} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={Bold} title={t('editorBold')} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
        <ToolBtn icon={Italic} title={t('editorItalic')} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
        <ToolBtn icon={UnderlineIcon} title={t('editorUnderline')} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
        <ToolBtn icon={Strikethrough} title={t('editorStrikethrough')} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
        <ToolBtn icon={Highlighter} title={t('editorHighlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ColorPicker editor={editor} t={t} />
        <FontSizePicker editor={editor} t={t} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={Heading1} title="H1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} />
        <ToolBtn icon={Heading2} title="H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} />
        <ToolBtn icon={Heading3} title="H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={List} title={t('editorBulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
        <ToolBtn icon={ListOrdered} title={t('editorOrderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
        <ToolBtn icon={Quote} title={t('editorQuote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
        <ToolBtn icon={Code} title={t('editorCodeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={AlignLeft} title={t('editorAlignLeft')} onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} />
        <ToolBtn icon={AlignCenter} title={t('editorAlignCenter')} onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} />
        <ToolBtn icon={AlignRight} title={t('editorAlignRight')} onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={LinkIcon} title={t('editorLink')} onClick={handleInsertLink} active={editor.isActive('link')} />
        <ToolBtn icon={ImagePlus} title={t('editorImage')} onClick={handleInsertImage} />
        <ToolBtn icon={TableIcon} title={t('editorTable')} onClick={handleInsertTable} />
        <ToolBtn icon={Minus} title={t('editorHr')} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <ToolBtn icon={RemoveFormatting} title={t('editorClearFormat')} onClick={handleClearFormatting} />

        {/* 表格操作按钮（仅光标在表格内时显示） */}
        {mode === 'edit' && isInTable && (
          <>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <ToolBtn icon={ArrowDown} title={t('editorAddRow')} onClick={() => editor.chain().focus().addRowAfter().run()} />
            <ToolBtn icon={ArrowRight} title={t('editorAddCol')} onClick={() => editor.chain().focus().addColumnAfter().run()} />
            <ToolBtn icon={Trash2} title={t('editorDeleteTable')} onClick={() => editor.chain().focus().deleteTable().run()} className="text-destructive" />
          </>
        )}

        {/* 右侧模式切换按钮 */}
        <div className="flex-1" />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={PenLine} title={t('editorModeEdit')} onClick={() => switchToMode('edit')} active={mode === 'edit'} className={mode === 'edit' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : ''} />
        <ToolBtn icon={Code2} title={t('editorModeSource')} onClick={() => switchToMode('source')} active={mode === 'source'} className={mode === 'source' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : ''} />
        <ToolBtn icon={Eye} title={t('editorModePreview')} onClick={() => switchToMode('preview')} active={mode === 'preview'} className={mode === 'preview' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : ''} />
      </div>

      {/* ── 编辑模式：TipTap WYSIWYG ── */}
      {mode === 'edit' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <EditorContent editor={editor} />
        </div>
      )}

      {/* ── 源码模式：HTML 源码编辑 ── */}
      {mode === 'source' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <textarea
            value={sourceCode}
            onChange={(e) => setSourceCode(e.target.value)}
            placeholder={t('editorSourcePlaceholder')}
            className="w-full h-full px-4 py-3 text-sm font-mono bg-background resize-none focus:outline-none"
            style={{ fontFamily: 'monospace', fontSize: '13px', tabSize: 2 }}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      )}

      {/* ── 预览模式：只读 HTML 渲染 ── */}
      {mode === 'preview' && (
        <div
          className="email-tiptap-editor prose prose-sm dark:prose-invert max-w-none px-4 py-3 flex-1 min-h-0 overflow-auto"
          style={{ fontFamily: '宋体, SimSun, serif', fontSize: '16px' }}
          dangerouslySetInnerHTML={{ __html: value || '' }}
        />
      )}

      {/* ── 底部状态栏 ── */}
      <div className="flex items-center justify-between px-2 py-0.5 border-t bg-muted/20 text-[11px] text-muted-foreground">
        <span>
          {mode === 'edit' ? t('editorModeEdit') : mode === 'source' ? t('editorModeSource') : t('editorModePreview')}
        </span>
        <span>{t('editorCharCount', { count: charCount })}</span>
      </div>

      {/* ── TipTap 编辑器样式 ── */}
      <style>{`
        .email-tiptap-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 8px 0;
        }
        .email-tiptap-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
        }
        .email-tiptap-editor th,
        .email-tiptap-editor td {
          border: 1px solid var(--border, #ddd);
          padding: 6px 10px;
          min-width: 60px;
        }
        .email-tiptap-editor th {
          background: var(--muted, #f5f5f5);
          font-weight: 600;
        }
        .email-tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--muted-foreground, #999);
          pointer-events: none;
          height: 0;
        }
        .email-tiptap-editor blockquote {
          border-left: 3px solid var(--border, #ddd);
          padding-left: 1em;
          margin-left: 0;
          color: var(--muted-foreground, #666);
        }
        .email-tiptap-editor pre {
          background: var(--muted, #f5f5f5);
          border-radius: 6px;
          padding: 12px;
          overflow-x: auto;
        }
        .email-tiptap-editor code {
          background: var(--muted, #f5f5f5);
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 0.9em;
        }
        .email-tiptap-editor pre code {
          background: none;
          padding: 0;
        }
        .email-tiptap-editor hr {
          border: none;
          border-top: 1px solid var(--border, #ddd);
          margin: 16px 0;
        }
      `}</style>
    </div>
  );
}

// ── 工具栏按钮子组件 ──

function ToolBtn({ icon: Icon, title, onClick, active, disabled, className }: {
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

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#2563eb', '#7c3aed', '#db2777', '#0d9488',
];

function ColorPicker({ editor, t }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string }) {
  if (!editor) return null;
  return (
    <div className="relative group">
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editorColor')}>
        <Palette className="h-3.5 w-3.5" />
      </Button>
      <div className="absolute top-full left-0 z-50 hidden group-hover:grid grid-cols-4 gap-1 p-2 bg-popover border rounded-md shadow-md min-w-[120px]">
        {TEXT_COLORS.map(color => (
          <button
            key={color}
            className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
            title={color}
            onClick={() => editor.chain().focus().setColor(color).run()}
          />
        ))}
        <button
          className="col-span-4 text-xs text-muted-foreground hover:text-foreground py-0.5"
          onClick={() => editor.chain().focus().unsetColor().run()}
        >
          {t('editorColorReset')}
        </button>
      </div>
    </div>
  );
}

// ── 字号选择器子组件 ──

function FontSizePicker({ editor, t }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string }) {
  if (!editor) return null;
  return (
    <div className="relative group">
      <Button variant="ghost" size="sm" className="h-7 px-1 text-[11px] min-w-[32px]" title={t('editorFontSize')}>
        <span className="font-mono">A</span>
        <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
      </Button>
      <div className="absolute top-full left-0 z-50 hidden group-hover:flex flex-col bg-popover border rounded-md shadow-md min-w-[80px] py-1">
        {FONT_SIZES.map(size => (
          <button
            key={size}
            className="px-3 py-1 text-xs text-left hover:bg-accent hover:text-accent-foreground"
            onClick={() => editor.chain().focus().setFontSize(size).run()}
          >
            {size}
          </button>
        ))}
        <button
          className="px-3 py-1 text-xs text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground border-t"
          onClick={() => editor.chain().focus().unsetFontSize().run()}
        >
          {t('editorFontSizeReset')}
        </button>
      </div>
    </div>
  );
}
