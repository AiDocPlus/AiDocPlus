import DOMPurify from 'dompurify';

/**
 * 对 HTML 字符串进行消毒，移除潜在 XSS 攻击载荷（script 标签、事件处理器等）。
 * 用于所有 dangerouslySetInnerHTML 场景。
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    // 允许常见的格式化标签和样式
    ALLOWED_TAGS: [
      'a', 'b', 'i', 'u', 'em', 'strong', 'p', 'br', 'hr', 'div', 'span',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'pre', 'code', 'img', 'figure', 'figcaption',
      'sub', 'sup', 'mark', 'del', 'ins', 'details', 'summary',
      'section', 'article', 'header', 'footer', 'nav', 'aside',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'style', 'id', 'target', 'rel',
      'width', 'height', 'colspan', 'rowspan', 'align', 'valign',
    ],
    // 链接只允许安全协议
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * 轻量消毒：仅移除 script/event handler，保留所有标签和属性。
 * 适用于富文本编辑器预览等已知可信来源的场景。
 */
export function sanitizeHtmlPermissive(dirty: string): string {
  return DOMPurify.sanitize(dirty);
}
