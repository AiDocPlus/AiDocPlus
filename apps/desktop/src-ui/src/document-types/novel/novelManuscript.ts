/**
 * novelManuscript.ts — 手稿格式化
 *
 * N4.2: 将小说内容转换为标准投稿手稿格式
 * 支持中文出版格式和西方标准手稿格式
 */

import type { NovelDocumentContent } from './types';
import { getChapterWordCount } from './types';

// ═══ 手稿格式配置 ═══

export type ManuscriptPreset = 'chinese-publish' | 'western-standard' | 'web-novel' | 'custom';

export interface ManuscriptConfig {
  preset: ManuscriptPreset;
  /** 作者名 */
  authorName: string;
  /** 书名 */
  bookTitle: string;
  /** 联系信息（用于投稿） */
  contactInfo?: string;
  /** 字体 */
  fontFamily: string;
  /** 字号（pt） */
  fontSize: number;
  /** 行距（倍数） */
  lineHeight: number;
  /** 首行缩进（em 数） */
  textIndent: number;
  /** 章节标题格式 */
  chapterTitleFormat: 'h1' | 'center-bold' | 'left-bold';
  /** 分隔符样式 */
  sceneSeparator: '***' | '---' | '* * *' | '◇' | '';
  /** 包含页眉（作者名+书名+页码） */
  includeHeader: boolean;
  /** 包含字数统计 */
  includeWordCount: boolean;
  /** 包含目录 */
  includeTOC: boolean;
}

const PRESETS: Record<ManuscriptPreset, Partial<ManuscriptConfig>> = {
  'chinese-publish': {
    fontFamily: '宋体',
    fontSize: 12,
    lineHeight: 1.8,
    textIndent: 2,
    chapterTitleFormat: 'center-bold',
    sceneSeparator: '◇',
    includeHeader: true,
    includeWordCount: true,
    includeTOC: true,
  },
  'western-standard': {
    fontFamily: 'Courier New',
    fontSize: 12,
    lineHeight: 2.0,
    textIndent: 5,
    chapterTitleFormat: 'center-bold',
    sceneSeparator: '***',
    includeHeader: true,
    includeWordCount: true,
    includeTOC: false,
  },
  'web-novel': {
    fontFamily: '微软雅黑',
    fontSize: 14,
    lineHeight: 1.8,
    textIndent: 2,
    chapterTitleFormat: 'h1',
    sceneSeparator: '---',
    includeHeader: false,
    includeWordCount: false,
    includeTOC: true,
  },
  'custom': {},
};

export function getPresetConfig(preset: ManuscriptPreset): Partial<ManuscriptConfig> {
  return PRESETS[preset] || {};
}

export function createDefaultConfig(): ManuscriptConfig {
  return {
    preset: 'chinese-publish',
    authorName: '',
    bookTitle: '',
    fontFamily: '宋体',
    fontSize: 12,
    lineHeight: 1.8,
    textIndent: 2,
    chapterTitleFormat: 'center-bold',
    sceneSeparator: '◇',
    includeHeader: true,
    includeWordCount: true,
    includeTOC: true,
  };
}

// ═══ 手稿 HTML 生成（用于导出 DOCX/PDF） ═══

/** 生成手稿格式的 HTML */
export function generateManuscriptHTML(novel: NovelDocumentContent, config: ManuscriptConfig): string {
  const parts: string[] = [];
  const totalWords = novel.volumes.reduce((s, v) => s + v.chapters.reduce((ss, c) => ss + getChapterWordCount(c), 0), 0);

  // CSS 样式
  parts.push(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(config.bookTitle || '未命名')}</title>
<style>
@page {
  size: A4;
  margin: 2.5cm 3cm 2.5cm 3cm;
}
body {
  font-family: '${config.fontFamily}', serif;
  font-size: ${config.fontSize}pt;
  line-height: ${config.lineHeight};
  color: #000;
}
p {
  text-indent: ${config.textIndent}em;
  margin: 0;
}
.chapter-title {
  ${config.chapterTitleFormat === 'center-bold' ? 'text-align: center; font-weight: bold;' : ''}
  ${config.chapterTitleFormat === 'left-bold' ? 'font-weight: bold;' : ''}
  font-size: ${config.fontSize + 4}pt;
  margin: 2em 0 1em 0;
  text-indent: 0;
  page-break-before: always;
}
.chapter-title:first-of-type { page-break-before: avoid; }
.volume-title {
  text-align: center;
  font-weight: bold;
  font-size: ${config.fontSize + 6}pt;
  margin: 3em 0 1em 0;
  text-indent: 0;
  page-break-before: always;
}
.scene-separator {
  text-align: center;
  margin: 1.5em 0;
  text-indent: 0;
  letter-spacing: 0.5em;
}
.header {
  text-align: right;
  font-size: ${config.fontSize - 2}pt;
  color: #666;
  margin-bottom: 2em;
  text-indent: 0;
}
.title-page {
  text-align: center;
  padding-top: 30%;
}
.title-page h1 { font-size: 24pt; margin-bottom: 0.5em; }
.title-page .author { font-size: 14pt; margin-bottom: 2em; }
.title-page .info { font-size: 10pt; color: #666; }
.toc { page-break-after: always; }
.toc h2 { text-align: center; text-indent: 0; }
.toc ul { list-style: none; padding: 0; }
.toc li { margin: 0.3em 0; text-indent: 0; }
.toc .vol { font-weight: bold; margin-top: 1em; }
</style>
</head>
<body>`);

  // 标题页
  parts.push(`<div class="title-page">
<h1>${escapeHtml(config.bookTitle || novel.settings.synopsis?.split('\n')[0]?.slice(0, 50) || '未命名')}</h1>
<div class="author">${escapeHtml(config.authorName || '佚名')}</div>
${config.includeWordCount ? `<div class="info">全书约 ${totalWords} 字</div>` : ''}
${config.contactInfo ? `<div class="info">${escapeHtml(config.contactInfo)}</div>` : ''}
</div>`);

  // 目录
  if (config.includeTOC) {
    parts.push('<div class="toc"><h2>目录</h2><ul>');
    for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
      parts.push(`<li class="vol">${escapeHtml(vol.title)}</li>`);
      for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
        const wc = getChapterWordCount(ch);
        parts.push(`<li>&emsp;${escapeHtml(ch.title)}${config.includeWordCount ? ` (${wc}字)` : ''}</li>`);
      }
    }
    parts.push('</ul></div>');
  }

  // 正文
  for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (novel.volumes.length > 1) {
      parts.push(`<div class="volume-title">${escapeHtml(vol.title)}</div>`);
    }

    for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
      parts.push(`<div class="chapter-title">${escapeHtml(ch.title)}</div>`);

      if (config.includeHeader) {
        parts.push(`<div class="header">${escapeHtml(config.authorName)} / ${escapeHtml(config.bookTitle || '未命名')}</div>`);
      }

      if (ch.scenes && ch.scenes.length > 0) {
        const sortedScenes = [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder);
        for (let i = 0; i < sortedScenes.length; i++) {
          if (i > 0 && config.sceneSeparator) {
            parts.push(`<div class="scene-separator">${escapeHtml(config.sceneSeparator)}</div>`);
          }
          parts.push(contentToHTML(sortedScenes[i].content));
        }
      } else {
        parts.push(contentToHTML(ch.content));
      }
    }
  }

  parts.push('</body></html>');
  return parts.join('\n');
}

/** 将正文内容转换为 HTML 段落 */
function contentToHTML(content: string): string {
  if (!content) return '';
  return content
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 生成手稿格式的纯 Markdown */
export function generateManuscriptMarkdown(novel: NovelDocumentContent, config: ManuscriptConfig): string {
  const parts: string[] = [];
  const totalWords = novel.volumes.reduce((s, v) => s + v.chapters.reduce((ss, c) => ss + getChapterWordCount(c), 0), 0);

  // 标题页
  parts.push(`# ${config.bookTitle || '未命名'}\n`);
  parts.push(`**作者：${config.authorName || '佚名'}**\n`);
  if (config.includeWordCount) parts.push(`*全书约 ${totalWords} 字*\n`);
  parts.push('---\n');

  // 目录
  if (config.includeTOC) {
    parts.push('## 目录\n');
    for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
      parts.push(`**${vol.title}**`);
      for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
        const wc = getChapterWordCount(ch);
        parts.push(`- ${ch.title}${config.includeWordCount ? ` (${wc}字)` : ''}`);
      }
      parts.push('');
    }
    parts.push('---\n');
  }

  // 正文
  for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (novel.volumes.length > 1) {
      parts.push(`\n## ${vol.title}\n`);
    }
    for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
      parts.push(`### ${ch.title}\n`);
      if (ch.scenes && ch.scenes.length > 0) {
        const sorted = [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder);
        for (let i = 0; i < sorted.length; i++) {
          if (i > 0 && config.sceneSeparator) parts.push(`\n${config.sceneSeparator}\n`);
          if (sorted[i].content) parts.push(sorted[i].content);
        }
      } else if (ch.content) {
        parts.push(ch.content);
      }
      parts.push('');
    }
  }

  return parts.join('\n');
}
