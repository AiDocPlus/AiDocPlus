/**
 * 帮助中心 - Markdown 文档渲染区
 *
 * 简单的 Markdown → HTML 渲染器，不依赖 react-markdown 等重量级库，
 * 避免帮助窗口引入过多依赖。
 */

import { useMemo, useEffect, useRef } from 'react';
import type { HelpDoc } from './helpDocs';

interface HelpContentProps {
  doc: HelpDoc | null;
}

/** HTML 特殊字符转义，防止 XSS */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 简单 Markdown → HTML 转换 */
export function markdownToHtml(md: string): string {
  let html = md;

  // 代码块（```lang ... ```）
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // 行内代码（先处理行内代码，避免后续替换影响代码内容）
  html = html.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);

  // 表格
  html = html.replace(
    /(?:^|\n)(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/g,
    (_m, headerLine: string, _sepLine: string, bodyLines: string) => {
      const headers = headerLine.split('|').filter((c: string) => c.trim());
      const rows = bodyLines.trim().split('\n').map((row: string) =>
        row.split('|').filter((c: string) => c.trim())
      );
      let table = '<table><thead><tr>';
      headers.forEach((h: string) => { table += `<th>${escapeHtml(h.trim())}</th>`; });
      table += '</tr></thead><tbody>';
      rows.forEach((row: string[]) => {
        table += '<tr>';
        row.forEach((cell: string) => { table += `<td>${escapeHtml(cell.trim())}</td>`; });
        table += '</tr>';
      });
      table += '</tbody></table>';
      return table;
    }
  );

  // 标题
  html = html.replace(/^#### (.+)$/gm, (_m, t) => `<h4>${escapeHtml(t)}</h4>`);
  html = html.replace(/^### (.+)$/gm, (_m, t) => `<h3>${escapeHtml(t)}</h3>`);
  html = html.replace(/^## (.+)$/gm, (_m, t) => `<h2>${escapeHtml(t)}</h2>`);
  html = html.replace(/^# (.+)$/gm, (_m, t) => `<h1>${escapeHtml(t)}</h1>`);

  // 引用块
  html = html.replace(/^> (.+)$/gm, (_m, t) => `<blockquote>${escapeHtml(t)}</blockquote>`);
  // 合并连续的引用块
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // 粗体和斜体
  html = html.replace(/\*\*(.+?)\*\*/g, (_m, t) => `<strong>${escapeHtml(t)}</strong>`);
  html = html.replace(/\*(.+?)\*/g, (_m, t) => `<em>${escapeHtml(t)}</em>`);

  // 链接（文本和 URL 都需要转义）
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
    return `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
  });

  // 分隔线
  html = html.replace(/^---+$/gm, '<hr />');

  // 无序列表
  html = html.replace(/^- (.+)$/gm, (_m, t) => `<li>${escapeHtml(t)}</li>`);
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, (_m, t) => `<li>${escapeHtml(t)}</li>`);

  // 段落：非 HTML 标签开头的行包装为 <p>
  html = html.replace(/^(?!<[a-z/])((?!^\s*$).+)$/gm, (_m, t) => `<p>${escapeHtml(t)}</p>`);

  // 清理多余空行
  html = html.replace(/\n{3,}/g, '\n\n');

  return html;
}

export function HelpContent({ doc }: HelpContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // 切换文档时滚动到顶部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [doc?.id]);

  const renderedHtml = useMemo(() => {
    if (!doc) return '';
    return markdownToHtml(doc.content);
  }, [doc]);

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-base font-medium mb-1">欢迎使用帮助中心</p>
          <p className="text-sm">从左侧选择一个主题开始浏览</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={contentRef}
      className="flex-1 overflow-y-auto help-scroll p-8"
    >
      <div
        className="help-markdown max-w-3xl mx-auto"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}
