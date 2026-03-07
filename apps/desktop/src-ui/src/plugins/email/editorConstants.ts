import { Extension } from '@tiptap/core';

export const DEFAULT_FONT_SIZE = '18px';
export const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
export const LINE_HEIGHTS = ['1.0', '1.2', '1.5', '1.75', '2.0', '2.5', '3.0'];
export const FONT_FAMILIES = [
  { label: '宋体', value: '宋体, SimSun, serif' },
  { label: '黑体', value: '黑体, SimHei, sans-serif' },
  { label: '楷体', value: '楷体, KaiTi, serif' },
  { label: '仿宋', value: '仿宋, FangSong, serif' },
  { label: '微软雅黑', value: '微软雅黑, "Microsoft YaHei", sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
];

export const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#2563eb', '#7c3aed', '#db2777', '#0d9488',
];

/** 一键排版预设 */
export interface TypographyPreset {
  name: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  textIndent: string | null;
  textAlign: string;
}
export function getTypographyPresets(t: (key: string) => string): TypographyPreset[] {
  return [
    { name: t('typographyOfficial'), fontFamily: '仿宋, FangSong, serif', fontSize: '16px', lineHeight: '2.0', textIndent: '2em', textAlign: 'left' },
    { name: t('typographyThesis'), fontFamily: '宋体, SimSun, serif', fontSize: '14px', lineHeight: '1.5', textIndent: '2em', textAlign: 'left' },
    { name: t('typographyBusiness'), fontFamily: '微软雅黑, "Microsoft YaHei", sans-serif', fontSize: '14px', lineHeight: '1.6', textIndent: null, textAlign: 'left' },
    { name: t('typographyBrief'), fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineHeight: '1.5', textIndent: null, textAlign: 'left' },
  ];
}

/** 自定义首行缩进扩展：为段落/标题添加 text-indent 样式属性，支持 Tab 快捷键 */
export const TextIndent = Extension.create({
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
export const LineHeight = Extension.create({
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
export function formatHtml(html: string): string {
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
