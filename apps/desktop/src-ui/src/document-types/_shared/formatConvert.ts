/**
 * Markdown ↔ HTML 格式转换工具函数
 * MD→HTML 使用 marked，HTML→MD 使用 turndown
 */
import { marked } from 'marked';
import TurndownService from 'turndown';

let turndownService: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (!turndownService) {
    turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
    });
    turndownService.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
  }
  return turndownService;
}

/** MD → HTML */
export function convertMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';
  try {
    const result = marked.parse(markdown, { async: false });
    return result as string;
  } catch {
    return `<p>${markdown}</p>`;
  }
}

/** HTML → MD */
export function convertHtmlToMarkdown(html: string): string {
  if (!html) return '';
  try {
    return getTurndown().turndown(html);
  } catch {
    return html.replace(/<[^>]*>/g, '');
  }
}

/** 简单检测内容是否像 Markdown */
export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length < 10) return false;
  const mdPatterns = [
    /^#{1,6}\s/m,
    /\*\*[^*]+\*\*/,
    /\*[^*]+\*/,
    /^-\s/m,
    /^\d+\.\s/m,
    /^>\s/m,
    /```/,
    /\[.+\]\(.+\)/,
  ];
  return mdPatterns.filter(p => p.test(text)).length >= 2;
}
