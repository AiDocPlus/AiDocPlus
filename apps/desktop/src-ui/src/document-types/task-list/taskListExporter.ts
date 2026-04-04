/**
 * 任务清单导出 — 与 calculator engine/exporter 风格一致
 */
import type { TaskListDocumentContent } from './types';
import { PRIORITY_CONFIG, normalizeTaskPriority } from './types';

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** Markdown：多列表 + 任务勾选风格 */
export function exportTaskListToMarkdown(
  doc: TaskListDocumentContent,
  labels: { list: string; pending: string; completed: string; priority: string; status: string },
  isEn = false,
): string {
  const lines: string[] = [`# ${labels.list}`, ''];
  for (const list of doc.lists) {
    lines.push(`## ${list.name}`, '');
    const pending = list.tasks.filter((t) => t.status === 'pending');
    const done = list.tasks.filter((t) => t.status === 'completed');
    if (pending.length > 0) {
      lines.push(`### ${labels.pending}`, '');
      for (const t of pending) {
        const pr = PRIORITY_CONFIG[normalizeTaskPriority(t.priority)][isEn ? 'labelEn' : 'label'];
        const content = t.content.replace(/\n/g, ' ');
        lines.push(`- [ ] **${pr}** ${content}`);
      }
      lines.push('');
    }
    if (done.length > 0) {
      lines.push(`### ${labels.completed}`, '');
      for (const t of done) {
        const content = t.content.replace(/\n/g, ' ');
        lines.push(`- [x] ${content}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n').trimEnd();
}

/** CSV：扁平行 */
export function exportTaskListToCSV(
  doc: TaskListDocumentContent,
  col: { list: string; content: string; priority: string; status: string; completedAt: string },
): string {
  const header = [col.list, col.content, col.priority, col.status, col.completedAt].map(escapeCSVField).join(',');
  const rows: string[] = [header];
  for (const list of doc.lists) {
    for (const t of list.tasks) {
      const pr = PRIORITY_CONFIG[normalizeTaskPriority(t.priority)].labelEn;
      rows.push(
        [
          escapeCSVField(list.name),
          escapeCSVField(t.content),
          escapeCSVField(pr),
          escapeCSVField(t.status),
          escapeCSVField(t.completedAt || ''),
        ].join(','),
      );
    }
  }
  return rows.join('\n');
}

/** 纯文本（全列表） */
export function exportTaskListToTXT(doc: TaskListDocumentContent, isEn = false): string {
  const lines: string[] = [];
  for (const list of doc.lists) {
    lines.push(`【${list.name}】`, '');
    for (const t of list.tasks) {
      const pr = PRIORITY_CONFIG[normalizeTaskPriority(t.priority)][isEn ? 'labelEn' : 'label'];
      const mark = t.status === 'completed' ? '✓' : '□';
      lines.push(`${mark} [${pr}] ${t.content}`);
      lines.push('');
    }
  }
  return lines.join('\n').trimEnd();
}

export function exportTaskListToJSON(doc: TaskListDocumentContent): string {
  return JSON.stringify(doc, null, 2);
}

const IMAGE_FONT_FAMILY =
  'system-ui, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

type ImageRowKind = 'title' | 'h2' | 'h3' | 'body' | 'gap';

interface ImageRow {
  kind: ImageRowKind;
  text: string;
}

function buildImageRows(
  doc: TaskListDocumentContent,
  labels: { list: string; pending: string; completed: string },
  isEn = false,
): ImageRow[] {
  const rows: ImageRow[] = [];
  rows.push({ kind: 'title', text: labels.list });
  rows.push({ kind: 'gap', text: '' });
  for (const list of doc.lists) {
    rows.push({ kind: 'h2', text: list.name });
    rows.push({ kind: 'gap', text: '' });
    const pending = list.tasks.filter((t) => t.status === 'pending');
    const done = list.tasks.filter((t) => t.status === 'completed');
    if (pending.length > 0) {
      rows.push({ kind: 'h3', text: labels.pending });
      for (const t of pending) {
        const pr = PRIORITY_CONFIG[normalizeTaskPriority(t.priority)][isEn ? 'labelEn' : 'label'];
        const content = t.content.replace(/\n/g, ' ');
        rows.push({ kind: 'body', text: `☐ [${pr}] ${content}` });
      }
      rows.push({ kind: 'gap', text: '' });
    }
    if (done.length > 0) {
      rows.push({ kind: 'h3', text: labels.completed });
      for (const t of done) {
        const content = t.content.replace(/\n/g, ' ');
        rows.push({ kind: 'body', text: `☑ ${content}` });
      }
      rows.push({ kind: 'gap', text: '' });
    }
  }
  return rows;
}

function fontForKind(kind: ImageRowKind): string {
  switch (kind) {
    case 'title':
      return `bold 22px ${IMAGE_FONT_FAMILY}`;
    case 'h2':
      return `bold 17px ${IMAGE_FONT_FAMILY}`;
    case 'h3':
      return `600 15px ${IMAGE_FONT_FAMILY}`;
    case 'body':
      return `14px ${IMAGE_FONT_FAMILY}`;
    default:
      return `14px ${IMAGE_FONT_FAMILY}`;
  }
}

function lineHeightForKind(kind: ImageRowKind): number {
  switch (kind) {
    case 'title':
      return 30;
    case 'h2':
      return 26;
    case 'h3':
      return 24;
    case 'gap':
      return 10;
    default:
      return 22;
  }
}

/** 按像素宽度折行（支持中英文混排） */
function wrapLineToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [''];
  if (maxWidth <= 0) return [text];
  const lines: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = text.length;
    while (end > i) {
      const w = ctx.measureText(text.slice(i, end)).width;
      if (w <= maxWidth) break;
      end -= 1;
    }
    if (end === i) end = i + 1;
    lines.push(text.slice(i, end));
    i = end;
  }
  return lines;
}

const MAX_IMAGE_CANVAS_HEIGHT = 12000;
const MAX_IMAGE_LINE_COUNT = 450;

/**
 * 将任务清单渲染到离屏 Canvas（供导出为 Blob 或触发下载）
 */
function renderTaskListRasterCanvas(
  doc: TaskListDocumentContent,
  labels: { list: string; pending: string; completed: string },
  isEn = false,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const padding = 28;
  const contentWidth = 760;
  const maxTextWidth = contentWidth;

  const rawRows = buildImageRows(doc, labels, isEn);
  const drawLines: { text: string; font: string; lineHeight: number }[] = [];

  for (const row of rawRows) {
    if (drawLines.length >= MAX_IMAGE_LINE_COUNT) break;
    ctx.font = fontForKind(row.kind);
    const lh = lineHeightForKind(row.kind);
    if (row.kind === 'gap') {
      drawLines.push({ text: '', font: ctx.font, lineHeight: lh });
      continue;
    }
    const wrapped = wrapLineToWidth(ctx, row.text, maxTextWidth);
    for (const line of wrapped) {
      if (drawLines.length >= MAX_IMAGE_LINE_COUNT) break;
      drawLines.push({ text: line, font: ctx.font, lineHeight: lh });
    }
  }

  let totalHeight = padding;
  for (const line of drawLines) {
    totalHeight += line.lineHeight;
  }
  totalHeight += padding;

  const h = Math.min(Math.ceil(totalHeight), MAX_IMAGE_CANVAS_HEIGHT);
  canvas.width = contentWidth + padding * 2;
  canvas.height = h;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111827';

  let y = padding;
  for (const line of drawLines) {
    ctx.font = line.font;
    if (line.text) {
      ctx.fillText(line.text, padding, y + line.lineHeight * 0.72);
    }
    y += line.lineHeight;
    if (y > canvas.height - padding) break;
  }

  return canvas;
}

/** 渲染为 PNG / JPEG Blob（供「另存为」对话框写入路径） */
export function exportTaskListRasterToBlob(
  doc: TaskListDocumentContent,
  format: 'png' | 'jpeg',
  labels: { list: string; pending: string; completed: string },
  isEn = false,
): Promise<Blob | null> {
  const canvas = renderTaskListRasterCanvas(doc, labels, isEn);
  if (!canvas) return Promise.resolve(null);
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const q = format === 'jpeg' ? 0.92 : undefined;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, q);
  });
}
