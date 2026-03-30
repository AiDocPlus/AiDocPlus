/**
 * 大纲节点「标题级别」：仅通过显式标题格式改变字号，深度不缩字。
 * 0 = 正文（与编辑器默认一致），1–7 对应 H1–H7，字号逐级递减、梯度明显。
 */

export type OutlineHeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function normalizeOutlineHeadingLevel(raw: unknown): OutlineHeadingLevel {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 7) return 7;
  return Math.floor(n) as OutlineHeadingLevel;
}

/** ProseMirrorNodeEditor 外层 className：仅标题级别影响字号 */
export function outlineHeadingEditorClass(level: OutlineHeadingLevel): string {
  switch (level) {
    case 1:
      return 'text-2xl font-bold tracking-tight';
    case 2:
      return 'text-xl font-bold';
    case 3:
      return 'text-lg font-semibold';
    case 4:
      return 'text-base font-semibold';
    case 5:
      return 'text-sm font-semibold';
    case 6:
      return 'text-sm font-medium';
    case 7:
      return 'text-xs font-medium text-muted-foreground';
    default:
      return '';
  }
}
