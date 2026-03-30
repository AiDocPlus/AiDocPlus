/**
 * 仿写文档导出工具
 * - Markdown：完整文档（原文 + 仿写 + 笔记）
 * - TXT：纯文本
 * - HTML：带样式的网页
 * 桌面端：系统「另存为」+ 写入文件
 */
import { saveTextFileWithDialog } from '@/lib/tauriSaveTextFile';
import type { ImitativeWritingContent } from './types';

export type ExportFormat = 'md' | 'txt' | 'html';

function getGenreLabel(genre: string): string {
  const map: Record<string, string> = {
    'novel-long': '长篇小说', 'novel-medium': '中篇小说', 'novel-short': '短篇小说', 'novel-mini': '微型小说',
    'prose-lyrical': '抒情散文', 'prose-narrative': '叙事散文', 'prose-essay': '议论性散文', 'prose-sketch': '散文速写',
    'poetry-modern': '现代诗', 'poetry-classical': '古典诗词', 'poetry-prose': '散文诗',
    'drama': '剧本', 'custom': '自定义',
  };
  return map[genre] || genre;
}

// ═══ Markdown 导出 ═══

export function exportAsMarkdown(content: ImitativeWritingContent, title: string): string {
  const lines: string[] = [];
  lines.push(`# ${title || '仿写练习'}`);
  lines.push('');

  if (content.genre) {
    lines.push(`**体裁：** ${getGenreLabel(content.genre)}`);
    lines.push('');
  }

  if (content.source.title || content.source.author) {
    const info = [content.source.title, content.source.author ? `（${content.source.author}）` : ''].filter(Boolean).join(' ');
    lines.push(`**原文：** ${info}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## 原文');
  lines.push('');
  lines.push(content.source.text || '（无原文）');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 仿写');
  lines.push('');
  lines.push(content.imitation.text || '（未开始仿写）');
  lines.push('');

  if (content.notes && content.notes.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 学习笔记');
    lines.push('');
    for (const note of content.notes) {
      lines.push(`### ${note.title}`);
      lines.push('');
      lines.push(note.content);
      lines.push('');
      if (note.tags && note.tags.length > 0) {
        lines.push(`*标签：${note.tags.join('、')}*`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ═══ TXT 导出 ═══

export function exportAsText(content: ImitativeWritingContent, title: string): string {
  const lines: string[] = [];
  lines.push(`${title || '仿写练习'}`);
  lines.push('═'.repeat(40));
  lines.push('');

  lines.push('【原文】');
  if (content.source.title) lines.push(`《${content.source.title}》${content.source.author ? `  ${content.source.author}` : ''}`);
  lines.push('');
  lines.push(content.source.text || '（无原文）');
  lines.push('');
  lines.push('─'.repeat(40));
  lines.push('');
  lines.push('【仿写】');
  lines.push('');
  lines.push(content.imitation.text || '（未开始仿写）');

  if (content.notes && content.notes.length > 0) {
    lines.push('');
    lines.push('─'.repeat(40));
    lines.push('');
    lines.push('【学习笔记】');
    lines.push('');
    for (const note of content.notes) {
      lines.push(`▶ ${note.title}`);
      lines.push(note.content);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ═══ HTML 导出 ═══

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export function exportAsHtml(content: ImitativeWritingContent, title: string): string {
  const safeTitle = escHtml(title || '仿写练习');
  const sourceTitle = content.source.title ? `《${escHtml(content.source.title)}》` : '';
  const sourceAuthor = content.source.author ? `  ${escHtml(content.source.author)}` : '';

  const noteHtml = (content.notes || []).map(n => `
    <div class="note">
      <h4>${escHtml(n.title)}</h4>
      <p>${escHtml(n.content)}</p>
      ${n.tags?.length ? `<p class="tags">${n.tags.map(escHtml).map(t => `<span>${t}</span>`).join('')}</p>` : ''}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>
    body { font-family: 'Songti SC', SimSun, serif; max-width: 800px; margin: 0 auto; padding: 24px; line-height: 1.9; color: #333; }
    h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; }
    h2 { font-size: 16px; margin-top: 28px; color: #555; border-left: 3px solid #888; padding-left: 8px; }
    h4 { margin: 0 0 4px; font-size: 14px; }
    .meta { color: #888; font-size: 13px; margin-bottom: 16px; }
    .content { background: #fafafa; border: 1px solid #ddd; padding: 16px; border-radius: 4px; white-space: pre-wrap; font-size: 15px; }
    .notes { margin-top: 32px; }
    .note { background: #f5f5f5; border-radius: 4px; padding: 12px; margin-bottom: 12px; font-size: 13px; }
    .tags span { background: #e0e7ff; color: #4f46e5; border-radius: 3px; padding: 1px 6px; margin-right: 4px; font-size: 11px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p class="meta">体裁：${escHtml(getGenreLabel(content.genre || ''))} &nbsp;|&nbsp; 导出时间：${new Date().toLocaleString('zh-CN')}</p>
  <h2>原文</h2>
  <p class="meta">${sourceTitle}${sourceAuthor}</p>
  <div class="content">${escHtml(content.source.text || '（无原文）')}</div>
  <hr>
  <h2>仿写</h2>
  <div class="content">${escHtml(content.imitation.text || '（未开始仿写）')}</div>
  ${noteHtml ? `<div class="notes"><h2>学习笔记</h2>${noteHtml}</div>` : ''}
</body>
</html>`;
}

export async function exportDocument(
  content: ImitativeWritingContent,
  title: string,
  format: ExportFormat,
): Promise<void> {
  const safeName = (title || '仿写练习').replace(/[/\\:*?"<>|]/g, '_');
  switch (format) {
    case 'md': {
      const md = exportAsMarkdown(content, title);
      await saveTextFileWithDialog({
        defaultPath: `${safeName}.md`,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
        content: md,
      });
      break;
    }
    case 'txt': {
      const txt = exportAsText(content, title);
      await saveTextFileWithDialog({
        defaultPath: `${safeName}.txt`,
        filters: [{ name: 'Text', extensions: ['txt'] }],
        content: txt,
      });
      break;
    }
    case 'html': {
      const html = exportAsHtml(content, title);
      await saveTextFileWithDialog({
        defaultPath: `${safeName}.html`,
        filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
        content: html,
      });
      break;
    }
  }
}
