/**
 * translationExporter.ts — 翻译文档导出模块
 * 支持 Markdown 双语对照、纯译文、CSV 段落级 三种格式
 */
import type { TranslationDocumentContent } from './types';

// ============================================================
// Markdown 双语对照导出
// ============================================================

/**
 * 导出为 Markdown 双语对照格式
 * 按段落交替排列，原文和译文配对
 */
export function exportToMarkdownBilingual(
  doc: TranslationDocumentContent,
  labels?: { sourceTitle: string; targetTitle: string },
): string {
  const srcTitle = labels?.sourceTitle || (doc.direction === 'zh-en' ? '原文（中文）' : '原文（英文）');
  const tgtTitle = labels?.targetTitle || (doc.direction === 'zh-en' ? '译文（英文）' : '译文（中文）');

  // 按空行分段
  const sourceParagraphs = splitParagraphs(doc.source);
  const targetParagraphs = splitParagraphs(doc.target);
  const maxLen = Math.max(sourceParagraphs.length, targetParagraphs.length);

  const lines: string[] = [
    `# 翻译对照（${doc.direction === 'zh-en' ? '中 → 英' : '英 → 中'}）`,
    '',
  ];

  for (let i = 0; i < maxLen; i++) {
    lines.push(`### ${srcTitle}`);
    lines.push(sourceParagraphs[i] || '（空）');
    lines.push('');
    lines.push(`### ${tgtTitle}`);
    lines.push(targetParagraphs[i] || '（空）');
    lines.push('');
    if (i < maxLen - 1) {
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ============================================================
// 纯译文导出（Markdown）
// ============================================================

/**
 * 导出为纯译文 Markdown
 */
export function exportToMarkdownTargetOnly(
  doc: TranslationDocumentContent,
): string {
  return doc.target || '';
}

// ============================================================
// CSV 段落级导出
// ============================================================

interface CSVLabels {
  source: string;
  target: string;
  paragraph: string;
}

const DEFAULT_CSV_LABELS: CSVLabels = {
  source: '原文',
  target: '译文',
  paragraph: '段落',
};

/**
 * 导出为 CSV 段落级格式
 * 原文、译文两列，按段落分行
 */
export function exportToCSV(
  doc: TranslationDocumentContent,
  labels: CSVLabels = DEFAULT_CSV_LABELS,
): string {
  const sourceParagraphs = splitParagraphs(doc.source);
  const targetParagraphs = splitParagraphs(doc.target);
  const maxLen = Math.max(sourceParagraphs.length, targetParagraphs.length);

  const rows: string[][] = [
    [labels.paragraph, labels.source, labels.target],
  ];

  for (let i = 0; i < maxLen; i++) {
    rows.push([
      String(i + 1),
      escapeCSVField(sourceParagraphs[i] || ''),
      escapeCSVField(targetParagraphs[i] || ''),
    ]);
  }

  return rows.map(row => row.join(',')).join('\n');
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 按连续空行分段
 */
function splitParagraphs(text: string): string[] {
  if (!text.trim()) return [];
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

/**
 * 转义 CSV 字段
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * 下载导出文件（浏览器方式，适用于 Tauri WebView）
 */
export function downloadExport(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// 导出格式配置
// ============================================================

export type TranslationExportFormat = 'md-bilingual' | 'md-target' | 'csv';

export interface TranslationExportFormatConfig {
  id: TranslationExportFormat;
  name: string;
  extension: string;
  mimeType: string;
}

export const TRANSLATION_EXPORT_FORMATS: TranslationExportFormatConfig[] = [
  {
    id: 'md-bilingual',
    name: 'Markdown 双语对照',
    extension: 'md',
    mimeType: 'text/markdown',
  },
  {
    id: 'md-target',
    name: 'Markdown 纯译文',
    extension: 'md',
    mimeType: 'text/markdown',
  },
  {
    id: 'csv',
    name: 'CSV 段落级对照',
    extension: 'csv',
    mimeType: 'text/csv',
  },
];
