/**
 * 生成 ISO 8601 时间戳
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * 生成简短的资源 ID（基于名称的 slug）
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 从 author 字段提取名称字符串
 */
export function getAuthorName(author: string | { name: string } | undefined): string {
  if (!author) return '';
  if (typeof author === 'string') return author;
  return author.name || '';
}
