import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Extension } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
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
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  List, ListOrdered, Quote, Code, Minus,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, ImagePlus, Table as TableIcon,
  Undo2, Redo2, Palette, RemoveFormatting,
  Trash2, ArrowDown, ArrowRight,
  PenLine, Code2, Eye,
  FileText, ChevronDown, IndentIncrease,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Type, ArrowUpDown, Wand2, FileType,
  Save,
  Scissors, Copy, ClipboardPaste, ClipboardCheck, MousePointerClick,
  Search, Replace, X as XIcon,
  Calendar, Hash, Pilcrow,
  WrapText,
} from 'lucide-react';
import { looksLikeMarkdown, convertMarkdownToHtml } from './markdownToHtml';

export interface EmailBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** 邮件格式：富文本(html) 或 纯文本(plaintext) */
  format?: 'html' | 'plaintext';
  onFormatChange?: (format: 'html' | 'plaintext') => void;
  /** 自动保存状态回调 */
  onSaveStatus?: (saved: boolean) => void;
}

/**
 * 邮件正文富文本编辑器
 * 基于 TipTap，所见即所得，输出 HTML，支持图片内嵌
 * 内置导入功能（正文/插件/合并区），统一 MD→HTML 转换
 * 完全独立于主程序编辑器，仅使用 SDK 接口
 */
type EditorMode = 'edit' | 'source' | 'preview';

const DEFAULT_FONT_SIZE = '18px';
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
const LINE_HEIGHTS = ['1.0', '1.2', '1.5', '1.75', '2.0', '2.5', '3.0'];
const FONT_FAMILIES = [
  { label: '宋体', value: '宋体, SimSun, serif' },
  { label: '黑体', value: '黑体, SimHei, sans-serif' },
  { label: '楷体', value: '楷体, KaiTi, serif' },
  { label: '仿宋', value: '仿宋, FangSong, serif' },
  { label: '微软雅黑', value: '微软雅黑, "Microsoft YaHei", sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
];

/** 一键排版预设 */
interface TypographyPreset {
  name: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  textIndent: string | null;
  textAlign: string;
}
function getTypographyPresets(t: (key: string) => string): TypographyPreset[] {
  return [
    { name: t('typographyOfficial'), fontFamily: '仿宋, FangSong, serif', fontSize: '16px', lineHeight: '2.0', textIndent: '2em', textAlign: 'left' },
    { name: t('typographyThesis'), fontFamily: '宋体, SimSun, serif', fontSize: '14px', lineHeight: '1.5', textIndent: '2em', textAlign: 'left' },
    { name: t('typographyBusiness'), fontFamily: '微软雅黑, "Microsoft YaHei", sans-serif', fontSize: '14px', lineHeight: '1.6', textIndent: null, textAlign: 'left' },
    { name: t('typographyBrief'), fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineHeight: '1.5', textIndent: null, textAlign: 'left' },
  ];
}

/** 自定义首行缩进扩展：为段落/标题添加 text-indent 样式属性，支持 Tab 快捷键 */
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
      setTextIndent: (indent: string) => ({ commands }: { commands: any }) => {
        return commands.updateAttributes('paragraph', { textIndent: indent })
          || commands.updateAttributes('heading', { textIndent: indent });
      },
      unsetTextIndent: () => ({ commands }: { commands: any }) => {
        return commands.updateAttributes('paragraph', { textIndent: null })
          || commands.updateAttributes('heading', { textIndent: null });
      },
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
        return (ed as any).commands.setTextIndent('2em');
      },
      'Shift-Tab': () => {
        const ed = this.editor;
        if (ed.isActive('bulletList') || ed.isActive('orderedList')) return false;
        return (ed as any).commands.unsetTextIndent();
      },
    };
  },
});

/** 自定义行间距扩展：为段落/标题添加 line-height 样式属性 */
const LineHeight = Extension.create({
  name: 'lineHeight',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style?.lineHeight || null,
          renderHTML: (attrs: Record<string, string | null>) => {
            if (!attrs.lineHeight) return {};
            return { style: `line-height: ${attrs.lineHeight}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setLineHeight: (height: string) => ({ commands }: { commands: any }) => {
        return commands.updateAttributes('paragraph', { lineHeight: height })
          || commands.updateAttributes('heading', { lineHeight: height });
      },
      unsetLineHeight: () => ({ commands }: { commands: any }) => {
        return commands.updateAttributes('paragraph', { lineHeight: null })
          || commands.updateAttributes('heading', { lineHeight: null });
      },
    } as any;
  },
});

/** 简易 HTML 格式化：将压缩的 HTML 转为带缩进的可读格式 */
function formatHtml(html: string): string {
  if (!html.trim()) return '';
  let result = '';
  let indent = 0;
  const tab = '  ';
  // 按标签拆分，保留标签
  const tokens = html.replace(/>(\s*)</g, '>\n<').split('\n');
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;
    // 闭合标签：先减缩进再输出
    if (/^<\//.test(token)) {
      indent = Math.max(0, indent - 1);
      result += tab.repeat(indent) + token + '\n';
    }
    // 自闭合标签或非容器标签
    else if (/\/>$/.test(token) || /^<(img|br|hr|input|meta|link)\b/i.test(token)) {
      result += tab.repeat(indent) + token + '\n';
    }
    // 同一行包含开标签和闭标签（如 <p>text</p>）
    else if (/^<[^/][^>]*>.*<\/[^>]+>$/.test(token)) {
      result += tab.repeat(indent) + token + '\n';
    }
    // 开标签：输出后增缩进
    else if (/^<[^/]/.test(token)) {
      result += tab.repeat(indent) + token + '\n';
      indent++;
    }
    // 纯文本
    else {
      result += tab.repeat(indent) + token + '\n';
    }
  }
  return result.trimEnd();
}

// HTML → 纯文本，保留段落和换行结构
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  let text = html;
  // 块级元素前添加换行
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');
  // 列表项标记
  text = text.replace(/<li[^>]*>/gi, '• ');
  // 去除剩余标签
  text = text.replace(/<[^>]*>/g, '');
  // 解码 HTML 实体
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  // 清理多余空行（最多保留一个空行）
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export function EmailBodyEditor({ value, onChange, placeholder, t, format = 'html', onFormatChange, onSaveStatus }: EmailBodyEditorProps) {
  const host = usePluginHost();
  const isDark = host.ui.getTheme() === 'dark';
  const skipNextUpdate = useRef(false);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [sourceCode, setSourceCode] = useState('');
  const [plainText, setPlainText] = useState('');
  const savedHtmlRef = useRef<string>('');
  const [saved, setSaved] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findResults, setFindResults] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const findInputRef = useRef<HTMLInputElement>(null);
  const plainTextRef = useRef<HTMLTextAreaElement>(null);

  // 防抖自动保存
  const debouncedOnChange = useCallback((html: string) => {
    setSaved(false);
    onSaveStatus?.(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onChange(html);
      setSaved(true);
      onSaveStatus?.(true);
    }, 1000);
  }, [onChange, onSaveStatus]);

  // 组件卸载时立即保存
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
      FontFamily,
      Superscript,
      Subscript,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank' } }),
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || '' }),
      TextIndent,
      LineHeight,
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
      debouncedOnChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'email-tiptap-editor prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3 h-full',
        style: `font-family: 宋体, SimSun, serif; font-size: ${DEFAULT_FONT_SIZE};`,
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

  // 纯文本模式同步
  useEffect(() => {
    if (format === 'plaintext' && value) {
      setPlainText(htmlToPlainText(value));
    }
  }, [format]);

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

  // ── 一键排版 ──
  const applyTypography = useCallback((preset: TypographyPreset) => {
    if (!editor) return;
    editor.chain().focus().selectAll().run();
    editor.chain().focus().setFontFamily(preset.fontFamily).run();
    editor.chain().focus().setFontSize(preset.fontSize).run();
    (editor as any).commands.setLineHeight(preset.lineHeight);
    if (preset.textIndent) {
      (editor as any).commands.setTextIndent(preset.textIndent);
    } else {
      (editor as any).commands.unsetTextIndent();
    }
    editor.chain().focus().setTextAlign(preset.textAlign).run();
  }, [editor]);

  const resetTypography = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().selectAll().clearNodes().unsetAllMarks().run();
  }, [editor]);

  // ── 查找替换 ──
  const windowFind = (text: string, backward: boolean): boolean => {
    const w = window as any;
    if (typeof w.find === 'function') return w.find(text, false, backward, true);
    return false;
  };

  const handleFind = useCallback((searchText: string) => {
    if (!editor || !searchText) { setFindResults({ current: 0, total: 0 }); return; }
    const content = editor.getText();
    const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = content.match(regex);
    setFindResults({ current: matches ? 1 : 0, total: matches ? matches.length : 0 });
    window.getSelection()?.collapseToStart();
    windowFind(searchText, false);
  }, [editor]);

  const handleFindNext = useCallback(() => {
    if (!findText) return;
    const found = windowFind(findText, false);
    if (!found) { window.getSelection()?.collapseToStart(); windowFind(findText, false); }
    if (findResults.total > 0) {
      setFindResults(prev => ({ ...prev, current: prev.current >= prev.total ? 1 : prev.current + 1 }));
    }
  }, [findText, findResults.total]);

  const handleFindPrev = useCallback(() => {
    if (!findText) return;
    const found = windowFind(findText, true);
    if (!found) { window.getSelection()?.collapseToEnd(); windowFind(findText, true); }
    if (findResults.total > 0) {
      setFindResults(prev => ({ ...prev, current: prev.current <= 1 ? prev.total : prev.current - 1 }));
    }
  }, [findText, findResults.total]);

  const handleReplace = useCallback(() => {
    if (!editor || !findText) return;
    const sel = window.getSelection();
    if (sel && sel.toString().toLowerCase() === findText.toLowerCase()) {
      document.execCommand('insertText', false, replaceText);
      handleFindNext();
      const content = editor.getText();
      const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = content.match(regex);
      setFindResults(prev => ({ current: Math.min(prev.current, matches?.length || 0), total: matches?.length || 0 }));
    } else {
      handleFindNext();
    }
  }, [editor, findText, replaceText, handleFindNext]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || !findText) return;
    const html = editor.getHTML();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newHtml = html.replace(regex, replaceText);
    editor.commands.setContent(newHtml);
    onChange(newHtml);
    setFindResults({ current: 0, total: 0 });
  }, [editor, findText, replaceText, onChange]);

  const toggleFindReplace = useCallback(() => {
    setShowFindReplace(prev => {
      if (!prev) setTimeout(() => findInputRef.current?.focus(), 100);
      return !prev;
    });
  }, []);

  // ── 编辑操作 ──
  const handleCut = useCallback(() => { document.execCommand('cut'); }, []);
  const handleCopy = useCallback(() => { document.execCommand('copy'); }, []);
  const handlePaste = useCallback(() => { navigator.clipboard.readText().then(text => { if (editor) { editor.chain().focus().insertContent(text).run(); } }); }, [editor]);
  const handlePastePlain = useCallback(() => { navigator.clipboard.readText().then(text => { if (editor) { document.execCommand('insertText', false, text); } }); }, [editor]);
  const handleSelectAll = useCallback(() => { if (editor) editor.commands.selectAll(); }, [editor]);

  // ── 纯文本/富文本切换 ──
  const handleFormatToggle = useCallback(() => {
    if (!editor) return;
    if (format === 'html') {
      // 保存当前 HTML 以便切回时恢复
      savedHtmlRef.current = editor.getHTML();
      const text = htmlToPlainText(savedHtmlRef.current);
      setPlainText(text);
      onFormatChange?.('plaintext');
    } else {
      // 切回富文本：如果纯文本未修改则恢复原始 HTML，否则从纯文本重建
      const originalPlain = htmlToPlainText(savedHtmlRef.current);
      if (plainText === originalPlain && savedHtmlRef.current) {
        onChange(savedHtmlRef.current);
      } else {
        const html = plainText.split('\n').map(line => {
          if (line.trim() === '') return '<p><br></p>';
          if (line.trim() === '---') return '<hr>';
          if (line.trim().startsWith('• ')) return `<li>${line.trim().substring(2)}</li>`;
          return `<p>${line}</p>`;
        }).join('');
        onChange(html);
      }
      savedHtmlRef.current = '';
      onFormatChange?.('html');
    }
  }, [editor, format, plainText, onChange, onFormatChange]);

  // ── 模式切换逻辑 ──
  const switchToMode = useCallback((newMode: EditorMode) => {
    if (!editor) return;
    if (mode === 'edit' && newMode === 'source') {
      setSourceCode(formatHtml(editor.getHTML()));
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
    if (format === 'plaintext') return plainText.length;
    if (mode === 'source') return sourceCode.length;
    const text = value?.replace(/<[^>]*>/g, '') || '';
    return text.length;
  }, [value, sourceCode, mode, format, plainText]);

  if (!editor) return null;

  const isInTable = editor.isActive('table');
  const hasFragments = fragmentGroups.size > 0;
  const isPlaintext = format === 'plaintext';

  return (
    <div className={`overflow-hidden bg-background flex flex-col h-full ${isDark ? 'dark' : ''}`}>

      {/* ── 纯文本模式 ── */}
      {isPlaintext ? (
        <>
          <div className="flex items-center gap-0.5 px-1.5 py-1 border-b bg-muted/30 flex-wrap">
            {/* 导入 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-0.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={handleImportDocument}>
                  <FileText className="h-4 w-4 mr-2" />{t('importContent')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportComposed}>{t('importComposed')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            {/* 编辑操作 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[11px] gap-0.5">
                  <Scissors className="h-3.5 w-3.5" />
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                <DropdownMenuItem onClick={() => { plainTextRef.current?.focus(); document.execCommand('cut'); }}>
                  <Scissors className="h-4 w-4 mr-2" />{t('editorCut')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { plainTextRef.current?.focus(); document.execCommand('copy'); }}>
                  <Copy className="h-4 w-4 mr-2" />{t('editorCopy')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { navigator.clipboard.readText().then(text => { if (plainTextRef.current) { const ta = plainTextRef.current; const start = ta.selectionStart; const end = ta.selectionEnd; const newVal = plainText.substring(0, start) + text + plainText.substring(end); setPlainText(newVal); debouncedOnChange(newVal); setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + text.length; }, 0); } }); }}>
                  <ClipboardPaste className="h-4 w-4 mr-2" />{t('editorPaste')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { plainTextRef.current?.select(); }}>
                  <MousePointerClick className="h-4 w-4 mr-2" />{t('editorSelectAll')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            {/* 插入 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[11px] gap-0.5">
                  <Hash className="h-3.5 w-3.5" />
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => { if (plainTextRef.current) { const ta = plainTextRef.current; const pos = ta.selectionStart; const dateStr = new Date().toLocaleDateString(); const newVal = plainText.substring(0, pos) + dateStr + plainText.substring(ta.selectionEnd); setPlainText(newVal); debouncedOnChange(newVal); } }}>
                  <Calendar className="h-4 w-4 mr-2" />{t('editorInsertDate')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { if (plainTextRef.current) { const ta = plainTextRef.current; const pos = ta.selectionStart; const timeStr = new Date().toLocaleTimeString(); const newVal = plainText.substring(0, pos) + timeStr + plainText.substring(ta.selectionEnd); setPlainText(newVal); debouncedOnChange(newVal); } }}>
                  <Calendar className="h-4 w-4 mr-2" />{t('editorInsertTime')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { if (plainTextRef.current) { const ta = plainTextRef.current; const pos = ta.selectionStart; const sep = '\n' + '─'.repeat(40) + '\n'; const newVal = plainText.substring(0, pos) + sep + plainText.substring(ta.selectionEnd); setPlainText(newVal); debouncedOnChange(newVal); } }}>
                  <Minus className="h-4 w-4 mr-2" />{t('editorHr')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* 字数统计 */}
            <span className="text-[10px] text-muted-foreground ml-1">{plainText.length} {t('editorCharCount')}</span>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleFormatToggle}>
              <FileType className="h-3.5 w-3.5" />
              {t('editorSwitchToRichText')}
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <textarea
              ref={plainTextRef}
              value={plainText}
              onChange={(e) => { setPlainText(e.target.value); debouncedOnChange(e.target.value); }}
              placeholder={placeholder}
              className="w-full h-full px-4 py-3 bg-background resize-none focus:outline-none"
              style={{ fontFamily: '宋体, SimSun, serif', fontSize: DEFAULT_FONT_SIZE }}
            />
          </div>
        </>
      ) : (
        <>
          {/* ── 工具栏第一行：导入 + 撤销 + 字体/字号/颜色 + 文字格式 + 清除格式 ── */}
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 border-b bg-muted/30 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-0.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={handleImportDocument}>
                  <FileText className="h-4 w-4 mr-2" />{t('importContent')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportComposed}>{t('importComposed')}</DropdownMenuItem>
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

            {/* ── 编辑菜单 ── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[11px] gap-0.5">
                  <Scissors className="h-3.5 w-3.5" />
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                <DropdownMenuItem onClick={handleCut}>
                  <Scissors className="h-4 w-4 mr-2" />{t('editorCut')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />{t('editorCopy')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePaste}>
                  <ClipboardPaste className="h-4 w-4 mr-2" />{t('editorPaste')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePastePlain}>
                  <ClipboardCheck className="h-4 w-4 mr-2" />{t('editorPastePlain')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSelectAll}>
                  <MousePointerClick className="h-4 w-4 mr-2" />{t('editorSelectAll')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleFindReplace}>
                  <Search className="h-4 w-4 mr-2" />{t('editorFindReplace')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-5 mx-0.5" />

            <FontFamilyPicker editor={editor} t={t} />
            <FontSizePicker editor={editor} t={t} />
            <ColorPicker editor={editor} t={t} />
            <Separator orientation="vertical" className="h-5 mx-0.5" />

            <ToolBtn icon={Bold} title={t('editorBold')} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
            <ToolBtn icon={Italic} title={t('editorItalic')} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
            <ToolBtn icon={UnderlineIcon} title={t('editorUnderline')} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
            <ToolBtn icon={Strikethrough} title={t('editorStrikethrough')} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
            <ToolBtn icon={Highlighter} title={t('editorHighlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} />
            <ToolBtn icon={SuperscriptIcon} title={t('editorSuperscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} />
            <ToolBtn icon={SubscriptIcon} title={t('editorSubscript')} onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} />
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <ToolBtn icon={RemoveFormatting} title={t('editorClearFormat')} onClick={handleClearFormatting} />
          </div>

          {/* ── 工具栏第二行：段落格式 + 列表 + 对齐 + 缩进/行距 + 插入 + 排版 + 模式切换 ── */}
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 border-b bg-muted/30 flex-wrap">
            {/* 段落格式下拉菜单（H1-H6 + 正文） */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[11px] gap-0.5">
                  <Pilcrow className="h-3.5 w-3.5" />
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[150px]">
                <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()} className={!editor.isActive('heading') ? 'font-bold' : ''}>
                  <Pilcrow className="h-4 w-4 mr-2" />{t('editorParagraph')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'font-bold' : ''}>
                  <Heading1 className="h-4 w-4 mr-2" />{t('editorH1')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'font-bold' : ''}>
                  <Heading2 className="h-4 w-4 mr-2" />{t('editorH2')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'font-bold' : ''}>
                  <Heading3 className="h-4 w-4 mr-2" />{t('editorH3')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} className={editor.isActive('heading', { level: 4 }) ? 'font-bold' : ''}>
                  <Heading4 className="h-4 w-4 mr-2" />{t('editorH4')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()} className={editor.isActive('heading', { level: 5 }) ? 'font-bold' : ''}>
                  <Heading5 className="h-4 w-4 mr-2" />{t('editorH5')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()} className={editor.isActive('heading', { level: 6 }) ? 'font-bold' : ''}>
                  <Heading6 className="h-4 w-4 mr-2" />{t('editorH6')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <ToolBtn icon={List} title={t('editorBulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
            <ToolBtn icon={ListOrdered} title={t('editorOrderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
            <ToolBtn icon={Quote} title={t('editorQuote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
            <ToolBtn icon={Code} title={t('editorCodeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} />
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            {/* 对齐方式下拉菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[11px] gap-0.5">
                  <AlignLeft className="h-3.5 w-3.5" />
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[120px]">
                <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'font-bold' : ''}>
                  <AlignLeft className="h-4 w-4 mr-2" />{t('editorAlignLeft')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'font-bold' : ''}>
                  <AlignCenter className="h-4 w-4 mr-2" />{t('editorAlignCenter')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'font-bold' : ''}>
                  <AlignRight className="h-4 w-4 mr-2" />{t('editorAlignRight')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <ToolBtn icon={IndentIncrease} title={t('editorIndent')} onClick={() => (editor as any).commands.toggleTextIndent('2em')}
              active={!!(editor.getAttributes('paragraph').textIndent || editor.getAttributes('heading').textIndent)} />
            <LineHeightPicker editor={editor} t={t} />
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            {/* 插入菜单下拉 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-[11px] gap-0.5">
                  <Hash className="h-3.5 w-3.5" />
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                <DropdownMenuItem onClick={handleInsertLink}>
                  <LinkIcon className="h-4 w-4 mr-2" />{t('editorLink')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleInsertImage}>
                  <ImagePlus className="h-4 w-4 mr-2" />{t('editorImage')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleInsertTable}>
                  <TableIcon className="h-4 w-4 mr-2" />{t('editorTable')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                  <Minus className="h-4 w-4 mr-2" />{t('editorHr')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => editor.chain().focus().insertContent(new Date().toLocaleDateString()).run()}>
                  <Calendar className="h-4 w-4 mr-2" />{t('editorInsertDate')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().insertContent(new Date().toLocaleTimeString()).run()}>
                  <Calendar className="h-4 w-4 mr-2" />{t('editorInsertTime')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <WrapText className="h-4 w-4 mr-2" />{t('editorSpecialChars')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[180px]">
                    {['©', '®', '™', '→', '←', '↑', '↓', '★', '☆', '♠', '♥', '♦', '♣', '—', '…', '·', '§', '¶', '†', '‡'].map(ch => (
                      <DropdownMenuItem key={ch} className="text-sm font-mono" onClick={() => editor.chain().focus().insertContent(ch).run()}>
                        {ch}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {mode === 'edit' && isInTable && (
              <>
                <Separator orientation="vertical" className="h-5 mx-0.5" />
                <ToolBtn icon={ArrowDown} title={t('editorAddRow')} onClick={() => editor.chain().focus().addRowAfter().run()} />
                <ToolBtn icon={ArrowRight} title={t('editorAddCol')} onClick={() => editor.chain().focus().addColumnAfter().run()} />
                <ToolBtn icon={Trash2} title={t('editorDeleteTable')} onClick={() => editor.chain().focus().deleteTable().run()} className="text-destructive" />
              </>
            )}

            <Separator orientation="vertical" className="h-5 mx-0.5" />
            {/* 一键排版下拉 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 gap-0.5 text-xs">
                  <Wand2 className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                {getTypographyPresets(t).map((preset: TypographyPreset) => (
                  <DropdownMenuItem key={preset.name} onClick={() => applyTypography(preset)}>
                    {preset.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={resetTypography} className="text-destructive">
                  {t('editorResetTypography')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 右侧：格式切换 + 模式切换 */}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleFormatToggle}>
              <FileType className="h-3.5 w-3.5" />
              {t('editorSwitchToPlainText')}
            </Button>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <ToolBtn icon={PenLine} title={t('editorModeEdit')} onClick={() => switchToMode('edit')} active={mode === 'edit'} className={mode === 'edit' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : ''} />
            <ToolBtn icon={Code2} title={t('editorModeSource')} onClick={() => switchToMode('source')} active={mode === 'source'} className={mode === 'source' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : ''} />
            <ToolBtn icon={Eye} title={t('editorModePreview')} onClick={() => switchToMode('preview')} active={mode === 'preview'} className={mode === 'preview' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : ''} />
          </div>

          {/* ── 查找替换面板 ── */}
          {showFindReplace && (
            <div className="flex items-center gap-1.5 px-2 py-1 border-b bg-muted/20">
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input ref={findInputRef} value={findText} onChange={(e) => { setFindText(e.target.value); handleFind(e.target.value); }}
                placeholder={t('editorFindPlaceholder')} className="h-6 px-1.5 text-xs border rounded bg-background min-w-[120px] focus:outline-none focus:ring-1 focus:ring-ring" />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{findResults.total > 0 ? `${findResults.current}/${findResults.total}` : ''}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleFindPrev} title={t('editorFindPrev')}>
                <ChevronDown className="h-3 w-3 rotate-180" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleFindNext} title={t('editorFindNext')}>
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Separator orientation="vertical" className="h-4" />
              <Replace className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input value={replaceText} onChange={(e) => setReplaceText(e.target.value)}
                placeholder={t('editorReplacePlaceholder')} className="h-6 px-1.5 text-xs border rounded bg-background min-w-[120px] focus:outline-none focus:ring-1 focus:ring-ring" />
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={handleReplace}>{t('editorReplace')}</Button>
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={handleReplaceAll}>{t('editorReplaceAll')}</Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto" onClick={() => setShowFindReplace(false)}>
                <XIcon className="h-3 w-3" />
              </Button>
            </div>
          )}

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
              style={{ fontFamily: '宋体, SimSun, serif', fontSize: DEFAULT_FONT_SIZE }}
              dangerouslySetInnerHTML={{ __html: value || '' }}
            />
          )}
        </>
      )}

      {/* ── 底部状态栏 ── */}
      <div className="flex items-center justify-between px-2 py-0.5 border-t bg-muted/20 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-2">
          {isPlaintext ? t('editorModePlainText') : mode === 'edit' ? t('editorModeEdit') : mode === 'source' ? t('editorModeSource') : t('editorModePreview')}
          {!isPlaintext && (
            <span className={saved ? 'text-green-600' : 'text-orange-500'}>
              {saved ? <Save className="inline h-3 w-3" /> : '●'} {saved ? t('editorSaved') : t('editorUnsaved')}
            </span>
          )}
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

function FontSizePicker({ editor, t }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string }) {
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

function FontFamilyPicker({ editor, t }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string }) {
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

function LineHeightPicker({ editor, t }: { editor: ReturnType<typeof useEditor>; t: (key: string) => string }) {
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
