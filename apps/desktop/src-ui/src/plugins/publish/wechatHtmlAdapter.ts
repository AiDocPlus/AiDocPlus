/**
 * Markdown → 微信公众号兼容 HTML 转换器
 * 微信编辑器只支持有限的 HTML 标签和内联样式
 */

const WECHAT_STYLES = {
  body: 'font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.8; color: #333; word-wrap: break-word;',
  h1: 'font-size: 22px; font-weight: bold; color: #1a1a1a; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #eee;',
  h2: 'font-size: 20px; font-weight: bold; color: #1a1a1a; margin: 20px 0 10px 0; padding-bottom: 6px; border-bottom: 1px solid #f0f0f0;',
  h3: 'font-size: 18px; font-weight: bold; color: #1a1a1a; margin: 16px 0 8px 0;',
  h4: 'font-size: 16px; font-weight: bold; color: #1a1a1a; margin: 14px 0 6px 0;',
  p: 'margin: 0 0 16px 0; text-align: justify;',
  blockquote: 'border-left: 3px solid #07C160; padding: 10px 16px; margin: 16px 0; background: #f8f8f8; color: #666; font-size: 15px;',
  code: 'background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 14px; font-family: Menlo, Monaco, Consolas, monospace; color: #c7254e;',
  pre: 'background: #2d2d2d; color: #ccc; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 14px; line-height: 1.6; font-family: Menlo, Monaco, Consolas, monospace; margin: 16px 0;',
  a: 'color: #576b95; text-decoration: none;',
  img: 'max-width: 100%; height: auto; border-radius: 4px; margin: 12px 0;',
  ul: 'padding-left: 24px; margin: 12px 0;',
  ol: 'padding-left: 24px; margin: 12px 0;',
  li: 'margin: 4px 0; line-height: 1.8;',
  hr: 'border: none; border-top: 1px solid #eee; margin: 24px 0;',
  strong: 'color: #07C160; font-weight: bold;',
  table: 'width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;',
  th: 'background: #f8f8f8; border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left; font-weight: bold;',
  td: 'border: 1px solid #e8e8e8; padding: 8px 12px; text-align: left;',
};

export function markdownToWechatHtml(md: string, title?: string): string {
  let html = md;

  // 代码块（先处理，避免内部被其他规则误匹配）
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre style="${WECHAT_STYLES.pre}"><code>${escaped}</code></pre>`;
  });

  // 表格
  html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (_match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').map((h: string) => h.trim()).filter(Boolean);
    const headerHtml = headers.map((h: string) => `<th style="${WECHAT_STYLES.th}">${h}</th>`).join('');

    const rows = bodyRows.trim().split('\n').map((row: string) => {
      const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean);
      return `<tr>${cells.map((c: string) => `<td style="${WECHAT_STYLES.td}">${c}</td>`).join('')}</tr>`;
    }).join('');

    return `<table style="${WECHAT_STYLES.table}"><thead><tr>${headerHtml}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // 标题
  html = html.replace(/^####\s+(.+)$/gm, `<h4 style="${WECHAT_STYLES.h4}">$1</h4>`);
  html = html.replace(/^###\s+(.+)$/gm, `<h3 style="${WECHAT_STYLES.h3}">$1</h3>`);
  html = html.replace(/^##\s+(.+)$/gm, `<h2 style="${WECHAT_STYLES.h2}">$1</h2>`);
  html = html.replace(/^#\s+(.+)$/gm, `<h1 style="${WECHAT_STYLES.h1}">$1</h1>`);

  // 粗体、斜体
  html = html.replace(/\*\*(.+?)\*\*/g, `<strong style="${WECHAT_STYLES.strong}">$1</strong>`);
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // 行内代码
  html = html.replace(/`([^`]+)`/g, `<code style="${WECHAT_STYLES.code}">$1</code>`);

  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, `<img src="$2" alt="$1" style="${WECHAT_STYLES.img}">`);

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="${WECHAT_STYLES.a}">$1</a>`);

  // 引用
  html = html.replace(/^>\s+(.+)$/gm, `<blockquote style="${WECHAT_STYLES.blockquote}">$1</blockquote>`);

  // 分割线
  html = html.replace(/^---+$/gm, `<hr style="${WECHAT_STYLES.hr}">`);

  // 无序列表
  html = html.replace(/^[-*]\s+(.+)$/gm, `<li style="${WECHAT_STYLES.li}">$1</li>`);
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="${WECHAT_STYLES.ul}">${match}</ul>`);

  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, `<li style="${WECHAT_STYLES.li}">$1</li>`);

  // 段落：连续两个换行分段
  html = html.replace(/\n\n/g, `</p><p style="${WECHAT_STYLES.p}">`);
  html = `<p style="${WECHAT_STYLES.p}">${html}</p>`;

  // 清理：移除包裹块级元素的 <p> 标签
  html = html.replace(/<p[^>]*>\s*<(h[1-4]|ul|ol|pre|blockquote|hr|table)/g, '<$1');
  html = html.replace(/<\/(h[1-4]|ul|ol|pre|blockquote|table)>\s*<\/p>/g, '</$1>');
  html = html.replace(/<p[^>]*>\s*<hr/g, '<hr');
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  const parts: string[] = [];
  if (title) {
    parts.push(`<h1 style="${WECHAT_STYLES.h1}">${title}</h1>`);
  }
  parts.push(html);

  return `<div style="${WECHAT_STYLES.body}">${parts.join('')}</div>`;
}

/**
 * 从 Markdown 内容中提取前 N 个字符作为摘要
 */
export function extractDigest(md: string, maxLen = 54): string {
  const plain = md
    .replace(/^#+\s+.+$/gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/[*_~`#>|-]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain;
}
