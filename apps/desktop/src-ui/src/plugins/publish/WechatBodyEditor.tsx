import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Extension } from '@tiptap/react';

import { usePluginHost } from '../_framework/PluginHostAPI';
import {
  Button, Separator,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '../_framework/ui';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  Heading1,
  List, ListOrdered, Quote, Code, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, ImagePlus,
  Undo2, Redo2, Palette, RemoveFormatting,
  PenLine, Code2, Eye,
  FileText, ChevronDown,
  Maximize2, Minimize2,
  Table as TableIcon, Trash2,
  WrapText, Space, IndentIncrease, PaintBucket,
  Smartphone,
} from 'lucide-react';
import { markdownToWechatHtml } from './wechatHtmlAdapter';
import { WECHAT_TEMPLATES, applyTemplate } from './wechatTemplates';

export interface WechatBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  articleTitle?: string;
  author?: string;
  thumbPreviewUrl?: string;
  activeTemplateId?: string;
  onTemplateChange?: (templateId: string | null) => void;
}

type EditorMode = 'edit' | 'source' | 'preview' | 'phone';

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
const LINE_HEIGHTS = ['1', '1.2', '1.5', '1.75', '2', '2.5', '3'];
const LETTER_SPACINGS = ['0px', '0.5px', '1px', '1.5px', '2px', '3px', '4px'];
const TEXT_INDENTS = ['0em', '1em', '2em', '3em', '4em'];

const HIGHLIGHT_COLORS = [
  '#FFEB3B', '#FFC107', '#FF9800', '#F44336',
  '#E91E63', '#9C27B0', '#03A9F4', '#00BCD4',
  '#4CAF50', '#8BC34A', '#07C160', '#CDDC39',
];

// ── 自定义 TipTap 扩展：行高 ──
const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() { return { types: ['paragraph', 'heading'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
          renderHTML: (attrs: Record<string, string | null>) => {
            if (!attrs.lineHeight) return {};
            return { style: `line-height: ${attrs.lineHeight}` };
          },
        },
      },
    }];
  },
});

// ── 自定义 TipTap 扩展：字间距 ──
const LetterSpacing = Extension.create({
  name: 'letterSpacing',
  addOptions() { return { types: ['paragraph', 'heading'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        letterSpacing: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.letterSpacing || null,
          renderHTML: (attrs: Record<string, string | null>) => {
            if (!attrs.letterSpacing) return {};
            return { style: `letter-spacing: ${attrs.letterSpacing}` };
          },
        },
      },
    }];
  },
});

// ── 自定义 TipTap 扩展：首行缩进 ──
const TextIndent = Extension.create({
  name: 'textIndent',
  addOptions() { return { types: ['paragraph'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        textIndent: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.textIndent || null,
          renderHTML: (attrs: Record<string, string | null>) => {
            if (!attrs.textIndent) return {};
            return { style: `text-indent: ${attrs.textIndent}` };
          },
        },
      },
    }];
  },
});

// ── HTML 格式化（源码模式用） ──
// const BLOCK_TAGS = new Set(['div','p','h1','h2','h3','h4','h5','h6','ul','ol','li','table','thead','tbody','tr','th','td','blockquote','pre','hr','br','img','section','figure','figcaption']);
function formatHtml(html: string): string {
  // 在块级标签前后添加换行，然后缩进
  let result = html
    .replace(/>\s+</g, '><')           // 先去除标签间空白
    .replace(/(<\/?(div|p|h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|blockquote|pre|section|figure|figcaption)[^>]*>)/gi, '\n$1')
    .replace(/(<(hr|br|img)[^>]*\/?>)/gi, '\n$1')
    .trim();

  // 缩进
  const lines = result.split('\n').filter(l => l.trim());
  const formatted: string[] = [];
  let indent = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 检测是否是闭合标签
    const isClose = /^<\/\w/.test(trimmed);
    // 检测是否是自闭合标签
    const isSelfClose = /\/>$/.test(trimmed) || /^<(hr|br|img)\b/i.test(trimmed);
    // 检测是否同时包含开闭标签（如 <p>...</p>）
    const hasOpen = /^<\w[^/]/.test(trimmed) && !isSelfClose;
    const hasClose = /<\/\w[^>]*>$/.test(trimmed);

    if (isClose && !hasOpen) indent = Math.max(0, indent - 1);
    formatted.push('    '.repeat(indent) + trimmed);
    if (hasOpen && !hasClose && !isSelfClose) indent++;
  }
  return formatted.join('\n');
}

/**
 * 微信公众号正文富文本编辑器
 * 基于 TipTap，所见即所得，输出 HTML
 * 内置导入功能（正文/AI/合并区），MD→微信兼容HTML 转换
 */
export function WechatBodyEditor({ value, onChange, placeholder, t, maximized, onToggleMaximize, articleTitle, author, thumbPreviewUrl, activeTemplateId, onTemplateChange }: WechatBodyEditorProps) {
  const host = usePluginHost();
  const isDark = host.ui.getTheme() === 'dark';
  const skipNextUpdate = useRef(false);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [sourceCode, setSourceCode] = useState('');

  // 模板预览：编辑器保持原始 HTML，预览时动态应用模板样式
  const activeTemplate = useMemo(() => WECHAT_TEMPLATES.find(t => t.id === activeTemplateId), [activeTemplateId]);
  const styledValue = useMemo(() => {
    if (!activeTemplate || !value) return value || '';
    return applyTemplate(value, activeTemplate);
  }, [value, activeTemplate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
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
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Table.configure({ resizable: false, HTMLAttributes: { style: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;' } }),
      TableRow,
      TableHeader,
      TableCell,
      LineHeight,
      LetterSpacing,
      TextIndent,
      Placeholder.configure({ placeholder: placeholder || '' }),
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
        class: 'wechat-tiptap-editor prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3 h-full',
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

  // ── 导入内容（MD→微信兼容HTML 转换） ──
  const importContent = useCallback((text: string) => {
    const html = markdownToWechatHtml(text);
    onChange(html);
  }, [onChange]);

  const handleImportDocument = useCallback(() => {
    const text = host.content.getAIContent() || host.content.getDocumentContent();
    if (!text?.trim()) {
      host.ui.showStatus(t('wxImportEmpty'), true);
      return;
    }
    importContent(text);
    host.ui.showStatus(t('wxImportedContent'));
  }, [host, t, importContent]);

  const handleImportComposed = useCallback(() => {
    const text = host.content.getComposedContent();
    if (!text?.trim()) {
      host.ui.showStatus(t('wxImportComposedEmpty'), true);
      return;
    }
    importContent(text);
    host.ui.showStatus(t('wxImportedComposed'));
  }, [host, t, importContent]);

  const handleImportFragment = useCallback((markdown: string, title: string) => {
    importContent(markdown);
    host.ui.showStatus(t('wxImportedFrom', { source: title }));
  }, [t, importContent]);

  // 插件片段
  const fragmentGroups = useMemo(() => host.content.getPluginFragments(), [host]);

  // ── 图片插入 ──
  const handleInsertImage = useCallback(async () => {
    if (!editor) return;
    const filePath = await host.ui.showOpenDialog({
      filters: [{ name: t('wxEditorImageFilter'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    });
    if (!filePath) return;
    try {
      const dataUri = await host.platform.invoke<string>('read_file_base64', { path: filePath });
      editor.chain().focus().setImage({ src: dataUri }).run();
    } catch (err) {
      host.ui.showStatus(t('wxEditorImageError', { error: err instanceof Error ? err.message : String(err) }), true);
    }
  }, [editor, host.ui, host.platform, t]);

  // ── 链接插入 ──
  const handleInsertLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt(t('wxEditorLinkPrompt'), prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor, t]);

  // ── 清除格式 ──
  const handleClearFormatting = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  }, [editor]);

  // ── 模式切换 ──
  const switchToMode = useCallback((newMode: EditorMode) => {
    if (!editor) return;
    if (mode === newMode) return;
    // edit → source: 从 editor 取最新 HTML（格式化）
    if (mode === 'edit' && newMode === 'source') {
      setSourceCode(formatHtml(editor.getHTML()));
    }
    // source → edit / source → preview / source → phone: 回写 editor
    if (mode === 'source' && (newMode === 'edit' || newMode === 'preview' || newMode === 'phone')) {
      skipNextUpdate.current = true;
      editor.commands.setContent(sourceCode, { emitUpdate: false });
      onChange(sourceCode);
    }
    // preview/phone → source: 从 value 初始化 sourceCode（格式化）
    if ((mode === 'preview' || mode === 'phone') && newMode === 'source') {
      setSourceCode(formatHtml(value || ''));
    }
    // preview/phone → edit: 确保 editor 与 value 同步
    if ((mode === 'preview' || mode === 'phone') && newMode === 'edit') {
      const currentHtml = editor.getHTML();
      if (value !== currentHtml) {
        skipNextUpdate.current = true;
        editor.commands.setContent(value || '', { emitUpdate: false });
      }
    }
    setMode(newMode);
  }, [editor, mode, sourceCode, value, onChange]);

  // ── 字符计数 ──
  const charCount = useMemo(() => {
    if (mode === 'source') return sourceCode.length;
    const text = value?.replace(/<[^>]*>/g, '') || '';
    return text.length;
  }, [value, sourceCode, mode]);

  if (!editor) return null;

  const hasFragments = fragmentGroups.size > 0;

  return (
    <div className={`overflow-hidden bg-background flex flex-col h-full ${isDark ? 'dark' : ''}`}>
      {/* ── 工具栏 ── */}
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
              {t('wxImportContent')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportComposed}>
              {t('wxImportComposed')}
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
                          {t('wxImportAll')}
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
        <ToolBtn icon={Undo2} title={t('wxEditorUndo')} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
        <ToolBtn icon={Redo2} title={t('wxEditorRedo')} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={Bold} title={t('wxEditorBold')} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
        <ToolBtn icon={Italic} title={t('wxEditorItalic')} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
        <ToolBtn icon={UnderlineIcon} title={t('wxEditorUnderline')} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
        <ToolBtn icon={Strikethrough} title={t('wxEditorStrike')} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
        {/* 高亮多色 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${editor.isActive('highlight') ? 'bg-accent' : ''}`} title={t('wxEditorHighlight')}>
              <Highlighter className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="p-2 w-auto">
            <div className="grid grid-cols-4 gap-1">
              {HIGHLIGHT_COLORS.map(c => (
                <button key={c} className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setTimeout(() => onChange(editor.getHTML()), 0); }} />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { editor.chain().focus().unsetHighlight().run(); setTimeout(() => onChange(editor.getHTML()), 0); }}>
              {t('wxEditorClearHighlight')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ColorPicker editor={editor} t={t} onChange={onChange} />
        <FontSizePicker editor={editor} t={t} onChange={onChange} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        {/* 标题下拉 H1-H6 + 正文 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={`h-7 px-1.5 gap-0.5 text-xs ${editor.isActive('heading') ? 'bg-accent' : ''}`} title={t('wxEditorHeading')}>
              <Heading1 className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-36">
            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()} className={!editor.isActive('heading') ? 'bg-accent/50' : ''}>
              <span className="text-sm">{t('wxEditorParagraph')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {([1, 2, 3, 4, 5, 6] as const).map(level => (
              <DropdownMenuItem key={level} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
                className={editor.isActive('heading', { level }) ? 'bg-accent/50' : ''}>
                <span style={{ fontSize: `${22 - level * 2}px`, fontWeight: 'bold' }}>H{level}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={List} title={t('wxEditorBulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
        <ToolBtn icon={ListOrdered} title={t('wxEditorOrderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
        <ToolBtn icon={Quote} title={t('wxEditorQuote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
        <ToolBtn icon={Code} title={t('wxEditorCodeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={AlignLeft} title={t('wxEditorAlignLeft')} onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} />
        <ToolBtn icon={AlignCenter} title={t('wxEditorAlignCenter')} onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} />
        <ToolBtn icon={AlignRight} title={t('wxEditorAlignRight')} onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} />
        <ToolBtn icon={AlignJustify} title={t('wxEditorAlignJustify')} onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={LinkIcon} title={t('wxEditorLink')} onClick={handleInsertLink} active={editor.isActive('link')} />
        <ToolBtn icon={ImagePlus} title={t('wxEditorImage')} onClick={handleInsertImage} />
        {/* 表格下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('wxEditorTable')}>
              <TableIcon className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {/* 插入不同尺寸表格 */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <TableIcon className="h-4 w-4 mr-2" />{t('wxEditorTableInsert')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-36">
                {[[2,2],[3,3],[4,3],[4,4],[5,3],[5,5]].map(([r,c]) => (
                  <DropdownMenuItem key={`${r}x${c}`} onClick={() => editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run()}>
                    {r} × {c}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()} disabled={!editor.can().addRowBefore()}>
              {t('wxEditorTableAddRowBefore')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.can().addRowAfter()}>
              {t('wxEditorTableAddRowAfter')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()} disabled={!editor.can().addColumnBefore()}>
              {t('wxEditorTableAddColBefore')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.can().addColumnAfter()}>
              {t('wxEditorTableAddColAfter')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.can().deleteRow()}>
              {t('wxEditorTableDelRow')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.can().deleteColumn()}>
              {t('wxEditorTableDelCol')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeaderRow().run()} disabled={!editor.can().toggleHeaderRow()}>
              {t('wxEditorTableToggleHeader')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().mergeCells().run()} disabled={!editor.can().mergeCells()}>
              {t('wxEditorTableMerge')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().splitCell().run()} disabled={!editor.can().splitCell()}>
              {t('wxEditorTableSplit')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().deleteTable()} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />{t('wxEditorTableDelete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolBtn icon={Minus} title={t('wxEditorHr')} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        {/* 行高 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-0.5 text-xs" title={t('wxEditorLineHeight')}>
              <WrapText className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-24">
            {LINE_HEIGHTS.map(lh => (
              <DropdownMenuItem key={lh} onClick={() => editor.chain().focus().updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', { lineHeight: lh }).run()}>
                {lh}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', { lineHeight: null }).run()}>
              {t('wxEditorDefault')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* 字间距 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-0.5 text-xs" title={t('wxEditorLetterSpacing')}>
              <Space className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-24">
            {LETTER_SPACINGS.map(ls => (
              <DropdownMenuItem key={ls} onClick={() => editor.chain().focus().updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', { letterSpacing: ls }).run()}>
                {ls}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().updateAttributes(editor.isActive('heading') ? 'heading' : 'paragraph', { letterSpacing: null }).run()}>
              {t('wxEditorDefault')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* 首行缩进 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-0.5 text-xs" title={t('wxEditorTextIndent')}>
              <IndentIncrease className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-24">
            {TEXT_INDENTS.map(ti => (
              <DropdownMenuItem key={ti} onClick={() => editor.chain().focus().updateAttributes('paragraph', { textIndent: ti }).run()}>
                {ti}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.chain().focus().updateAttributes('paragraph', { textIndent: null }).run()}>
              {t('wxEditorDefault')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={RemoveFormatting} title={t('wxEditorClearFormat')} onClick={handleClearFormatting} />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        {/* 排版模板 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-0.5 text-xs" title={t('wxEditorTemplate')}>
              <PaintBucket className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44 max-h-[300px] overflow-y-auto">
            {WECHAT_TEMPLATES.map(tmpl => (
              <DropdownMenuItem key={tmpl.id} onClick={() => {
                onTemplateChange?.(activeTemplateId === tmpl.id ? null : tmpl.id);
              }}
                className={activeTemplateId === tmpl.id ? 'bg-accent/50' : ''}>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{tmpl.name}</span>
                  <span className="text-[10px] text-muted-foreground">{tmpl.description}</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onTemplateChange?.(null)}
              className={!activeTemplateId ? 'bg-accent/50' : ''}>
              <span className="text-xs">{t('wxEditorDefault')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 右侧模式切换 */}
        <div className="flex-1" />
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <ToolBtn icon={PenLine} title={t('wxEditorModeEdit')} onClick={() => switchToMode('edit')} active={mode === 'edit'} className={mode === 'edit' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : ''} />
        <ToolBtn icon={Code2} title={t('wxEditorModeSource')} onClick={() => switchToMode('source')} active={mode === 'source'} className={mode === 'source' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : ''} />
        <ToolBtn icon={Eye} title={t('wxEditorModePreview')} onClick={() => switchToMode('preview')} active={mode === 'preview'} className={mode === 'preview' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : ''} />
        <ToolBtn icon={Smartphone} title={t('wxEditorModePhone')} onClick={() => switchToMode('phone')} active={mode === 'phone'} className={mode === 'phone' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : ''} />
        {onToggleMaximize && (
          <>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <ToolBtn icon={maximized ? Minimize2 : Maximize2} title={maximized ? t('wxEditorRestore') : t('wxEditorMaximize')} onClick={onToggleMaximize} />
          </>
        )}
      </div>

      {/* ── 编辑模式（CSS 隐藏而非卸载，避免 TipTap 反复挂载丢失内容） ── */}
      <div className="flex-1 min-h-0 overflow-auto" style={{ display: mode === 'edit' ? undefined : 'none' }}>
        <EditorContent editor={editor} />
      </div>

      {/* ── 源码模式 ── */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ display: mode === 'source' ? undefined : 'none' }}>
        <CodeMirror
          value={sourceCode}
          onChange={(val: string) => setSourceCode(val)}
          extensions={[
            html(),
            EditorView.lineWrapping,
            indentUnit.of('    '),
            ...(isDark ? [] : [syntaxHighlighting(HighlightStyle.define([
              { tag: tags.tagName, color: '#22863a', fontWeight: 'bold' },
              { tag: tags.attributeName, color: '#6f42c1' },
              { tag: tags.attributeValue, color: '#032f62' },
              { tag: tags.string, color: '#032f62' },
              { tag: tags.comment, color: '#6a737d', fontStyle: 'italic' },
              { tag: tags.angleBracket, color: '#24292e' },
              { tag: tags.content, color: '#24292e' },
              { tag: tags.keyword, color: '#d73a49', fontWeight: 'bold' },
            ]))]),
          ]}
          theme={isDark ? oneDark : 'light'}
          placeholder={t('wxEditorSourcePlaceholder')}
          height="100%"
          style={{ height: '100%', fontSize: '14px' }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            highlightActiveLine: true,
            indentOnInput: true,
          }}
        />
      </div>

      {/* ── 预览模式 ── */}
      <div
        className="wechat-tiptap-editor prose prose-sm dark:prose-invert max-w-none px-4 py-3 flex-1 min-h-0 overflow-auto"
        style={{ fontFamily: '宋体, SimSun, serif', fontSize: '16px', display: mode === 'preview' ? undefined : 'none' }}
        dangerouslySetInnerHTML={{ __html: styledValue }}
      />

      {/* ── 手机预览模式 ── */}
      <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center py-4 bg-muted/40" style={{ display: mode === 'phone' ? undefined : 'none' }}>
        {/* 手机外壳 */}
        <div style={{ width: 375, minHeight: 667, maxHeight: '100%', borderRadius: 36, border: '3px solid #1a1a1a', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          {/* 状态栏 */}
          <div style={{ height: 44, background: '#ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#000', fontWeight: 600 }}>9:41</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <svg width="16" height="12" viewBox="0 0 16 12"><path d="M1 8h2v4H1zM5 5h2v7H5zM9 2h2v10H9zM13 0h2v12h-2z" fill="#000"/></svg>
              <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2C5.8 2 3.8 2.8 2.3 4.3l1.4 1.4C5 4.5 6.4 4 8 4s3 .5 4.3 1.7l1.4-1.4C12.2 2.8 10.2 2 8 2zM8 6c-1.4 0-2.6.5-3.5 1.5L5.9 8.9C6.5 8.3 7.2 8 8 8s1.5.3 2.1.9l1.4-1.4C10.6 6.5 9.4 6 8 6zM8 10c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1z" fill="#000"/></svg>
              <svg width="22" height="12" viewBox="0 0 22 12"><rect x="0" y="1" width="18" height="10" rx="2" stroke="#000" strokeWidth="1" fill="none"/><rect x="19" y="4" width="2" height="4" rx="1" fill="#000"/><rect x="2" y="3" width="12" height="6" rx="1" fill="#000"/></svg>
            </div>
          </div>
          {/* 微信导航栏 */}
          <div style={{ height: 44, background: '#ededed', display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '0.5px solid #d9d9d9', flexShrink: 0 }}>
            <svg width="10" height="18" viewBox="0 0 10 18" style={{ marginRight: 8 }}><path d="M9 1L1 9l8 8" stroke="#07C160" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 500, color: '#000' }}>公众号文章</div>
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="4" cy="10" r="1.5" fill="#000"/><circle cx="10" cy="10" r="1.5" fill="#000"/><circle cx="16" cy="10" r="1.5" fill="#000"/></svg>
          </div>
          {/* 文章内容区 */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
            {/* 封面图 */}
            {thumbPreviewUrl && (
              <div style={{ width: '100%', aspectRatio: '2.35/1', overflow: 'hidden' }}>
                <img src={thumbPreviewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            {/* 标题 */}
            <div style={{ padding: '20px 16px 0' }}>
              <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', lineHeight: 1.4, margin: 0 }}>
                {articleTitle || t('wxUntitled')}
              </h1>
            </div>
            {/* 作者信息栏 */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#07C160', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{(author || '公')[0]}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: '#576b95', fontWeight: 500 }}>{author || t('wxDefaultAuthor')}</div>
              </div>
              <span style={{ fontSize: 12, color: '#b2b2b2' }}>{new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>
            </div>
            {/* 分割线 */}
            <div style={{ height: 0.5, background: '#e5e5e5', margin: '0 16px' }} />
            {/* 正文 */}
            <div
              style={{ padding: '16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif', fontSize: 16, lineHeight: 1.8, color: '#333', wordWrap: 'break-word' }}
              dangerouslySetInnerHTML={{ __html: styledValue }}
            />
            {/* 底部 */}
            <div style={{ padding: '20px 16px 16px', borderTop: '0.5px solid #e5e5e5', margin: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 24 }}>
                  <span style={{ fontSize: 13, color: '#b2b2b2' }}>❤️ {t('wxPhoneLike')}</span>
                  <span style={{ fontSize: 13, color: '#b2b2b2' }}>⭐ {t('wxPhoneFavorite')}</span>
                </div>
                <span style={{ fontSize: 13, color: '#b2b2b2' }}>💬 {t('wxPhoneComment')}</span>
              </div>
            </div>
            {/* 安全底部间距 */}
            <div style={{ height: 34 }} />
          </div>
          {/* 底部 Home Indicator */}
          <div style={{ height: 34, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 134, height: 5, borderRadius: 3, background: '#1a1a1a' }} />
          </div>
        </div>
      </div>

      {/* ── 底部状态栏 ── */}
      <div className="flex items-center justify-between px-2 py-0.5 border-t bg-muted/20 text-[11px] text-muted-foreground">
        <span>
          {mode === 'edit' ? t('wxEditorModeEdit') : mode === 'source' ? t('wxEditorModeSource') : mode === 'phone' ? t('wxEditorModePhone') : t('wxEditorModePreview')}
        </span>
        <span>{t('wxEditorCharCount', { count: charCount })}</span>
      </div>

      {/* ── 编辑器样式 ── */}
      <style>{`
        .wechat-tiptap-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 8px 0;
        }
        .wechat-tiptap-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--muted-foreground, #999);
          pointer-events: none;
          height: 0;
        }
        .wechat-tiptap-editor blockquote {
          border-left: 3px solid #07C160;
          padding-left: 1em;
          margin-left: 0;
          color: var(--muted-foreground, #666);
        }
        .wechat-tiptap-editor pre {
          background: var(--muted, #f5f5f5);
          border-radius: 6px;
          padding: 12px;
          overflow-x: auto;
        }
        .wechat-tiptap-editor code {
          background: var(--muted, #f5f5f5);
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 0.9em;
        }
        .wechat-tiptap-editor pre code {
          background: none;
          padding: 0;
        }
        .wechat-tiptap-editor hr {
          border: none;
          border-top: 1px solid var(--border, #ddd);
          margin: 16px 0;
        }
      `}</style>
    </div>
  );
}

// ── 工具栏按钮 ──

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

// ── 颜色选择器 ──

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#2563eb', '#7c3aed', '#db2777', '#07C160',
];

function ColorPicker({ editor, t, onChange }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string; onChange: (html: string) => void }) {
  if (!editor) return null;
  const applyAndSync = (fn: () => void) => {
    fn();
    setTimeout(() => onChange(editor.getHTML()), 0);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('wxEditorColor')}>
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="p-2 w-auto">
        <div className="grid grid-cols-4 gap-1">
          {TEXT_COLORS.map(color => (
            <button
              key={color}
              className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={color}
              onClick={() => applyAndSync(() => editor.chain().focus().setColor(color).run())}
            />
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => applyAndSync(() => editor.chain().focus().unsetColor().run())}>
          {t('wxEditorColorReset')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── 字号选择器 ──

function FontSizePicker({ editor, t, onChange }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string; onChange: (html: string) => void }) {
  if (!editor) return null;
  const applyAndSync = (fn: () => void) => {
    fn();
    setTimeout(() => onChange(editor.getHTML()), 0);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-1 text-[11px] min-w-[32px]" title={t('wxEditorFontSize')}>
          <span className="font-mono">A</span>
          <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-20">
        {FONT_SIZES.map(size => (
          <DropdownMenuItem key={size} onClick={() => applyAndSync(() => editor.chain().focus().setFontSize(size).run())}>
            {size}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => applyAndSync(() => editor.chain().focus().unsetFontSize().run())}>
          {t('wxEditorFontSizeReset')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
