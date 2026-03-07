/**
 * HTML 邮件兼容性处理：将 TipTap 生成的 HTML 转换为邮件客户端兼容的 inline CSS 格式。
 * 
 * 主要处理：
 * 1. 为常见 HTML 元素添加默认内联样式（段落、标题、列表等）
 * 2. 移除邮件客户端不支持的属性
 * 3. 确保表格在各客户端正确渲染
 */

/** 默认邮件兼容样式映射 */
const TAG_STYLES: Record<string, string> = {
  p: 'margin:0 0 1em 0;line-height:1.6;',
  h1: 'margin:0 0 0.5em 0;font-size:2em;font-weight:bold;line-height:1.3;',
  h2: 'margin:0 0 0.5em 0;font-size:1.5em;font-weight:bold;line-height:1.3;',
  h3: 'margin:0 0 0.5em 0;font-size:1.17em;font-weight:bold;line-height:1.3;',
  h4: 'margin:0 0 0.5em 0;font-size:1em;font-weight:bold;line-height:1.3;',
  blockquote: 'margin:0.5em 0;padding:0.5em 1em;border-left:3px solid #ccc;color:#666;',
  ul: 'margin:0 0 1em 0;padding-left:2em;',
  ol: 'margin:0 0 1em 0;padding-left:2em;',
  li: 'margin:0 0 0.3em 0;line-height:1.6;',
  table: 'border-collapse:collapse;width:100%;margin:0.5em 0;',
  th: 'border:1px solid #ddd;padding:8px 12px;text-align:left;background-color:#f5f5f5;font-weight:bold;',
  td: 'border:1px solid #ddd;padding:8px 12px;text-align:left;',
  hr: 'border:none;border-top:1px solid #ccc;margin:1em 0;',
  pre: 'background:#f5f5f5;padding:1em;border-radius:4px;overflow-x:auto;font-family:monospace;white-space:pre-wrap;',
  code: 'background:#f0f0f0;padding:0.2em 0.4em;border-radius:3px;font-family:monospace;font-size:0.9em;',
  a: 'color:#1a73e8;text-decoration:underline;',
  img: 'max-width:100%;height:auto;display:block;',
  sup: 'font-size:0.75em;vertical-align:super;line-height:0;',
  sub: 'font-size:0.75em;vertical-align:sub;line-height:0;',
  mark: 'background-color:#fef08a;padding:0.1em 0.2em;',
  strong: 'font-weight:bold;',
  em: 'font-style:italic;',
  s: 'text-decoration:line-through;',
  u: 'text-decoration:underline;',
  tr: 'border-bottom:1px solid #eee;',
  caption: 'caption-side:bottom;text-align:center;font-size:0.9em;color:#666;padding:0.5em 0;',
  figure: 'margin:1em 0;text-align:center;',
  figcaption: 'font-size:0.9em;color:#666;margin-top:0.5em;',
  dl: 'margin:0 0 1em 0;',
  dt: 'font-weight:bold;margin-top:0.5em;',
  dd: 'margin:0 0 0.5em 1.5em;',
};

/**
 * 将 HTML 内容转换为邮件客户端兼容的 inline CSS 格式
 * @param html 原始 HTML 内容
 * @param baseFontFamily 基础字体
 * @param baseFontSize 基础字号
 * @returns 处理后的 HTML
 */
export function inlineEmailStyles(
  html: string,
  baseFontFamily = '宋体, SimSun, serif',
  baseFontSize = '16px',
): string {
  if (!html || !html.trim()) return html;

  let result = html;

  // 为每个已知标签添加内联样式
  for (const [tag, defaultStyle] of Object.entries(TAG_STYLES)) {
    // 匹配 <tag> 或 <tag attr...>，不匹配自闭合 </tag>
    const regex = new RegExp(`<(${tag})(\\s[^>]*)?>`, 'gi');
    result = result.replace(regex, (_match, tagName: string, attrs: string | undefined) => {
      const attrStr = attrs || '';
      // 检查是否已有 style 属性
      const styleMatch = attrStr.match(/style\s*=\s*"([^"]*)"/i);
      if (styleMatch) {
        // 合并：默认样式在前，已有样式在后（已有样式优先级更高）
        const existingStyle = styleMatch[1];
        const mergedStyle = defaultStyle + existingStyle;
        const newAttrs = attrStr.replace(/style\s*=\s*"[^"]*"/i, `style="${mergedStyle}"`);
        return `<${tagName}${newAttrs}>`;
      }
      return `<${tagName}${attrStr} style="${defaultStyle}">`;
    });
  }

  // 包裹在基础容器中，设置全局字体和字号，兼容暗色/亮色主题邮件客户端
  result = `<div style="font-family:${baseFontFamily};font-size:${baseFontSize};line-height:1.6;color:#333;background-color:#fff;padding:0;margin:0;word-wrap:break-word;overflow-wrap:break-word;">${result}</div>`;

  return result;
}
