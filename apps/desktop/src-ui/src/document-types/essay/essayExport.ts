/**
 * essayExport.ts — 散文导出工具函数
 *
 * Phase 7: 导出与快照
 * - 多格式导出实现
 * - 快照管理
 * - 分享链接生成
 */

import type { EssayDocumentContent } from './types';

/** HTML 特殊字符转义，防止用户内容注入 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ExportOptions {
  format: 'word' | 'pdf' | 'html' | 'markdown' | 'txt';
  includeMetadata: boolean;
  includeAnalysis: boolean;
  includeWatermark: boolean;
  watermarkText?: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  pageMargin: number;
}

// ═══════════════════════════════════════════════════════
// 导出功能
// ═══════════════════════════════════════════════════════

/**
 * 导出为 Word 文档
 */
export async function exportToWord(essay: EssayDocumentContent, options: ExportOptions): Promise<Blob> {
  // 构建 HTML 内容（Word 可以直接打开 HTML）
  const htmlContent = generateHTMLContent(essay);
  
  // 添加 Word 专用的 XML 头部
  const wordHTML = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(essay.title || '未命名散文')}</title>
  <style>
    body { font-family: ${options.fontFamily}; font-size: ${options.fontSize}px; line-height: ${options.lineHeight}; margin: ${options.pageMargin}cm; }
    h1 { font-size: ${options.fontSize + 4}px; margin-bottom: 1em; }
    h2 { font-size: ${options.fontSize + 2}px; margin-bottom: 0.8em; }
    .metadata { background: #f5f5f5; padding: 1em; margin-bottom: 2em; border-radius: 4px; }
    .watermark { 
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%) rotate(-45deg); 
      opacity: 0.1; 
      font-size: 72px; 
      color: #000; 
      z-index: -1; 
    }
  </style>
</head>
<body>
  ${options.includeWatermark && options.watermarkText ? `<div class="watermark">${escapeHtml(options.watermarkText)}</div>` : ''}
  ${options.includeMetadata ? generateMetadataHTML(essay) : ''}
  ${htmlContent}
</body>
</html>`;

  return new Blob([wordHTML], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/**
 * 导出为 PDF
 */
export async function exportToPDF(essay: EssayDocumentContent, options: ExportOptions): Promise<Blob> {
  // 使用浏览器的打印功能生成 PDF
  const html = generateHTMLContent(essay);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(essay.title || '未命名散文')}</title>
  <style>
    body { font-family: ${options.fontFamily}; font-size: ${options.fontSize}px; line-height: ${options.lineHeight}; margin: ${options.pageMargin}cm; }
    @media print { body { margin: ${options.pageMargin}cm; } }
    .metadata { background: #f5f5f5; padding: 1em; margin-bottom: 2em; border-radius: 4px; page-break-inside: avoid; }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      opacity: 0.05;
      font-size: 72px;
      color: #000;
      z-index: -1;
    }
  </style>
</head>
<body>
  ${options.includeWatermark && options.watermarkText ? `<div class="watermark">${escapeHtml(options.watermarkText)}</div>` : ''}
  ${options.includeMetadata ? generateMetadataHTML(essay) : ''}
  ${html}
</body>
</html>`);
    
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  }
  
  // 返回 HTML 内容作为 Blob（实际 PDF 由打印窗口处理）
  const htmlContent = generateHTMLContent(essay);
  return new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
}

/**
 * 导出为 HTML
 */
export function exportToHTML(essay: EssayDocumentContent, options: ExportOptions): Blob {
  const bodyHtml = generateHTMLContent(essay);
  const fullDocumentHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(essay.title || '未命名散文')}</title>
  <style>
    body { 
      font-family: ${options.fontFamily}; 
      font-size: ${options.fontSize}px; 
      line-height: ${options.lineHeight}; 
      max-width: 800px; 
      margin: 0 auto; 
      padding: ${options.pageMargin}cm; 
      background: #fff; 
    }
    h1 { font-size: ${options.fontSize + 6}px; margin-bottom: 1em; color: #333; }
    h2 { font-size: ${options.fontSize + 4}px; margin-bottom: 0.8em; color: #333; }
    .metadata { 
      background: #f8f9fa; 
      padding: 1.5em; 
      margin-bottom: 2em; 
      border-radius: 8px; 
      border-left: 4px solid #007bff; 
    }
    .metadata-item { margin-bottom: 0.5em; }
    .metadata-label { font-weight: bold; color: #666; }
    .watermark { 
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%) rotate(-45deg); 
      opacity: 0.03; 
      font-size: 120px; 
      color: #000; 
      z-index: -1; 
      pointer-events: none; 
    }
    .content { white-space: pre-wrap; }
    .footer { 
      margin-top: 3em; 
      padding-top: 1em; 
      border-top: 1px solid #eee; 
      font-size: 0.9em; 
      color: #666; 
      text-align: center; 
    }
  </style>
</head>
<body>
  ${options.includeWatermark && options.watermarkText ? `<div class="watermark">${escapeHtml(options.watermarkText)}</div>` : ''}
  ${options.includeMetadata ? generateMetadataHTML(essay) : ''}
  <main class="content">${bodyHtml}</main>
  <div class="footer">
    <p>本文由 AiDocPlus 散文写作工具生成</p>
    <p>导出时间：${new Date().toLocaleString()}</p>
  </div>
</body>
</html>`;

  return new Blob([fullDocumentHtml], { type: 'text/html;charset=utf-8' });
}

/**
 * 导出为 Markdown
 */
export function exportToMarkdown(essay: EssayDocumentContent, options: ExportOptions): Blob {
  let markdown = '';

  // 添加标题
  if (essay.title) {
    markdown += `# ${essay.title}\n\n`;
  }

  // 添加元数据
  if (options.includeMetadata) {
    markdown += '---\n';
    markdown += `标题: ${essay.title || '未命名散文'}\n`;
    markdown += `子类型: ${essay.settings.subtype || 'lyrical'}\n`;
    markdown += `情感基调: ${essay.settings.mood || 'warm'}\n`;
    markdown += `目标字数: ${essay.settings.targetWordCount || 0}\n`;
    markdown += `当前字数: ${essay.content.length}\n`;
    markdown += `创建时间: ${essay.createdAt || new Date().toISOString()}\n`;
    markdown += `修改时间: ${essay.updatedAt || new Date().toISOString()}\n`;
    if (essay.author) {
      markdown += `作者: ${essay.author}\n`;
    }
    markdown += '---\n\n';
  }

  // 添加内容
  markdown += essay.content;

  // 添加文学分析
  if (options.includeAnalysis && essay.analysisCache) {
    markdown += '\n\n---\n\n## 文学分析\n\n';
    if (essay.analysisCache.rhetoricsCount !== undefined) {
      markdown += `- 修辞数量: ${essay.analysisCache.rhetoricsCount}\n`;
    }
    if (essay.analysisCache.imageryCount !== undefined) {
      markdown += `- 意象数量: ${essay.analysisCache.imageryCount}\n`;
    }
    if (essay.analysisCache.literaryScore !== undefined) {
      markdown += `- 文学评分: ${essay.analysisCache.literaryScore}/100\n`;
    }
  }

  // 添加水印
  if (options.includeWatermark && options.watermarkText) {
    markdown += `\n\n---\n\n*${options.watermarkText}*`;
  }

  return new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
}

/**
 * 导出为纯文本
 */
export function exportToText(essay: EssayDocumentContent, options: ExportOptions): Blob {
  let text = '';

  // 添加标题
  if (essay.title) {
    text += `${essay.title}\n${'='.repeat(essay.title.length)}\n\n`;
  }

  // 添加元数据
  if (options.includeMetadata) {
    text += `标题: ${essay.title || '未命名散文'}\n`;
    text += `子类型: ${essay.settings.subtype || 'lyrical'}\n`;
    text += `情感基调: ${essay.settings.mood || 'warm'}\n`;
    text += `目标字数: ${essay.settings.targetWordCount || 0}\n`;
    text += `当前字数: ${essay.content.length}\n`;
    text += `创建时间: ${essay.createdAt || new Date().toISOString()}\n`;
    text += `修改时间: ${essay.updatedAt || new Date().toISOString()}\n`;
    if (essay.author) {
      text += `作者: ${essay.author}\n`;
    }
    text += '\n';
  }

  // 添加内容
  text += essay.content;

  // 添加文学分析
  if (options.includeAnalysis && essay.analysisCache) {
    text += '\n\n---\n\n文学分析:\n';
    if (essay.analysisCache.rhetoricsCount !== undefined) {
      text += `修辞数量: ${essay.analysisCache.rhetoricsCount}\n`;
    }
    if (essay.analysisCache.imageryCount !== undefined) {
      text += `意象数量: ${essay.analysisCache.imageryCount}\n`;
    }
    if (essay.analysisCache.literaryScore !== undefined) {
      text += `文学评分: ${essay.analysisCache.literaryScore}/100\n`;
    }
  }

  // 添加水印
  if (options.includeWatermark && options.watermarkText) {
    text += `\n\n---\n${options.watermarkText}`;
  }

  return new Blob([text], { type: 'text/plain;charset=utf-8' });
}

// ═══════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════

/**
 * 生成 HTML 内容
 */
function generateHTMLContent(essay: EssayDocumentContent): string {
  // 将换行符转换为 HTML 段落，并对内容进行 HTML 转义防止 XSS
  const paragraphs = essay.content.split('\n').filter(p => p.trim());
  return paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`).join('\n');
}

/**
 * 生成元数据 HTML
 */
function generateMetadataHTML(essay: EssayDocumentContent): string {
  return `
  <div class="metadata">
    <h2>文档信息</h2>
    <div class="metadata-item">
      <span class="metadata-label">标题：</span>${escapeHtml(essay.title || '未命名散文')}
    </div>
    <div class="metadata-item">
      <span class="metadata-label">子类型：</span>${escapeHtml(essay.settings.subtype || 'lyrical')}
    </div>
    <div class="metadata-item">
      <span class="metadata-label">情感基调：</span>${escapeHtml(essay.settings.mood || 'warm')}
    </div>
    <div class="metadata-item">
      <span class="metadata-label">目标字数：</span>${essay.settings.targetWordCount || 0}
    </div>
    <div class="metadata-item">
      <span class="metadata-label">当前字数：</span>${essay.content.length}
    </div>
    <div class="metadata-item">
      <span class="metadata-label">创建时间：</span>${essay.createdAt ? new Date(essay.createdAt).toLocaleString() : new Date().toLocaleString()}
    </div>
    <div class="metadata-item">
      <span class="metadata-label">修改时间：</span>${essay.updatedAt ? new Date(essay.updatedAt).toLocaleString() : new Date().toLocaleString()}
    </div>
    ${essay.author ? `
    <div class="metadata-item">
      <span class="metadata-label">作者：</span>${escapeHtml(essay.author)}
    </div>
    ` : ''}
  </div>`;
}

/**
 * 另存为对话框：默认文件名与扩展名（与 `exportEssay` 实际产出一致；「PDF」当前实现为 HTML 内容）
 */
export function getEssayExportSaveDialogParams(
  format: ExportOptions['format'],
  title: string,
): { defaultPath: string; filters: { name: string; extensions: string[] }[] } {
  const base = (title || '未命名散文').replace(/[/\\:*?"<>|]/g, '_');
  switch (format) {
    case 'word':
      return {
        defaultPath: `${base}.doc`,
        filters: [{ name: 'Word', extensions: ['doc', 'docx', 'html', 'htm'] }],
      };
    case 'pdf':
      return {
        defaultPath: `${base}.html`,
        filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
      };
    case 'html':
      return {
        defaultPath: `${base}.html`,
        filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
      };
    case 'markdown':
      return {
        defaultPath: `${base}.md`,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      };
    case 'txt':
      return {
        defaultPath: `${base}.txt`,
        filters: [{ name: 'Text', extensions: ['txt'] }],
      };
    default:
      return {
        defaultPath: `${base}.txt`,
        filters: [{ name: 'Text', extensions: ['txt'] }],
      };
  }
}

/**
 * 统一导出函数
 */
export async function exportEssay(essay: EssayDocumentContent, options: ExportOptions): Promise<Blob> {
  switch (options.format) {
    case 'word':
      return exportToWord(essay, options);
    case 'pdf':
      return exportToPDF(essay, options);
    case 'html':
      return exportToHTML(essay, options);
    case 'markdown':
      return exportToMarkdown(essay, options);
    case 'txt':
      return exportToText(essay, options);
    default:
      throw new Error(`不支持的导出格式: ${options.format}`);
  }
}

// ═══════════════════════════════════════════════════════
// 快照管理（完整实现在 types.ts 中）
// ═══════════════════════════════════════════════════════
