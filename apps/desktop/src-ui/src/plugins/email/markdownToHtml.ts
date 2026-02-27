import { marked } from 'marked';

/**
 * 检测内容是否看起来像 Markdown（而非已有的 HTML）
 * 简单启发式：如果包含 HTML 标签则认为已经是 HTML
 */
export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim();
  // 如果以 HTML 标签开头，或包含大量 HTML 标签，认为已经是 HTML
  if (/^<[a-z][\s\S]*>/i.test(trimmed)) return false;
  if (/<(p|div|h[1-6]|ul|ol|table|br|img|a|span|strong|em)\b/i.test(trimmed)) return false;
  // 包含 Markdown 特征则认为是 Markdown
  if (/^#{1,6}\s/m.test(trimmed)) return true;       // 标题
  if (/^\s*[-*+]\s/m.test(trimmed)) return true;      // 无序列表
  if (/^\s*\d+\.\s/m.test(trimmed)) return true;      // 有序列表
  if (/\*\*.+?\*\*/m.test(trimmed)) return true;       // 加粗
  if (/\[.+?\]\(.+?\)/m.test(trimmed)) return true;    // 链接
  if (/^>/m.test(trimmed)) return true;                // 引用
  if (/```/m.test(trimmed)) return true;               // 代码块
  if (/^\|.+\|/m.test(trimmed)) return true;           // 表格
  // 默认当作纯文本，也走 Markdown 转换（段落包装）
  return true;
}

/**
 * 将 Markdown 文本转换为 HTML 字符串
 * 用于导入正文/插件内容/AI 生成内容时自动转换
 */
export function convertMarkdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '';

  const result = marked.parse(markdown, {
    gfm: true,
    breaks: true,
  });

  // marked.parse 可能返回 string | Promise<string>，同步模式下返回 string
  if (typeof result === 'string') {
    return result;
  }
  // 理论上同步调用不会走到这里，防御性处理
  return markdown;
}
