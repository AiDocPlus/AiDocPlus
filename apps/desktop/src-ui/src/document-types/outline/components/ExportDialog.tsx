/**
 * 导出对话框
 *
 * 支持导出大纲为多种格式：Markdown、OPML、JSON、HTML、DOCX、PDF
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  FileCode,
  FileJson,
  FileDown,
  FileType,
  Download,
  Check,
} from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import type { Outline, OutlineNode } from '../types';
import { outlineToMarkdown } from '../converters/markdownConverter';
import { outlineToOPML } from '../converters/opmlConverter';

export type ExportFormat = 'markdown' | 'opml' | 'json' | 'html' | 'docx' | 'pdf';

interface ExportOptions {
  format: ExportFormat;
  includeNotes: boolean;
  includeTags: boolean;
  includeCompletionStatus: boolean;
  numberedLists: boolean;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  outline: Outline;
  documentTitle: string;
  documentId?: string;
  projectId?: string;
}

export function ExportDialog({
  isOpen,
  onClose,
  outline,
  documentTitle,
  documentId,
  projectId,
}: ExportDialogProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const [options, setOptions] = useState<ExportOptions>({
    format: 'markdown',
    includeNotes: true,
    includeTags: true,
    includeCompletionStatus: false,
    numberedLists: false,
  });

  // 格式选项
  const formatOptions = useMemo(
    () => [
      {
        value: 'markdown',
        label: t('outline.export.markdown', { defaultValue: 'Markdown' }),
        description: t('outline.export.markdownDesc', {
          defaultValue: '标准 Markdown 格式，保留层级结构',
        }),
        icon: FileText,
      },
      {
        value: 'opml',
        label: t('outline.export.opml', { defaultValue: 'OPML' }),
        description: t('outline.export.opmlDesc', {
          defaultValue: '标准大纲格式，可导入其他大纲软件',
        }),
        icon: FileCode,
      },
      {
        value: 'json',
        label: t('outline.export.json', { defaultValue: 'JSON' }),
        description: t('outline.export.jsonDesc', {
          defaultValue: '完整数据格式，包含所有元数据',
        }),
        icon: FileJson,
      },
      {
        value: 'html',
        label: t('outline.export.html', { defaultValue: 'HTML' }),
        description: t('outline.export.htmlDesc', {
          defaultValue: '带样式的 HTML 文档',
        }),
        icon: FileText,
      },
      {
        value: 'docx',
        label: t('outline.export.docx', { defaultValue: 'Word (.docx)' }),
        description: t('outline.export.docxDesc', {
          defaultValue: '公文排版 DOCX 文档',
        }),
        icon: FileType,
      },
      {
        value: 'pdf',
        label: t('outline.export.pdf', { defaultValue: 'PDF' }),
        description: t('outline.export.pdfDesc', {
          defaultValue: '可打印 PDF 文档',
        }),
        icon: FileDown,
      },
    ],
    [t]
  );

  // 导出为 Markdown
  const exportToMarkdown = useCallback(
    (nodes: OutlineNode[], depth = 0): string => {
      const lines: string[] = [];
      const prefix = options.numberedLists ? '' : '  '.repeat(depth);

      let numberedIndex = 1;
      for (const node of nodes) {
        const bullet = options.numberedLists
          ? `${numberedIndex}. `
          : depth === 0
            ? '- '
            : '  - ';
        let line = prefix + bullet + node.plainText;

        // 添加标签
        if (options.includeTags && node.tags.length > 0) {
          line += ' ' + node.tags.map((t) => `#${t}`).join(' ');
        }

        // 添加完成状态
        if (options.includeCompletionStatus && node.completed) {
          line = '✓ ' + line;
        }

        lines.push(line);

        // 添加备注
        if (options.includeNotes && node.notePlainText) {
          lines.push(prefix + '  > ' + node.notePlainText);
        }

        // 递归处理子节点
        if (node.children.length > 0) {
          lines.push(exportToMarkdown(node.children, depth + 1));
        }

        if (options.numberedLists) numberedIndex++;
      }

      return lines.join('\n');
    },
    [options]
  );

  // 导出为 JSON
  const exportToJSON = useCallback(
    (outline: Outline): string => {
      return JSON.stringify(
        {
          title: documentTitle,
          exportedAt: new Date().toISOString(),
          nodes: outline.nodes,
        },
        null,
        2
      );
    },
    [documentTitle]
  );

  // 导出为 HTML
  const exportToHTML = useCallback(
    (nodes: OutlineNode[]): string => {
      function nodeToHTML(node: OutlineNode, depth: number): string {
        const indent = depth * 24;
        const completedClass = node.completed ? 'completed' : '';
        const headingClass =
          node.headingLevel && node.headingLevel > 0
            ? `heading-${node.headingLevel}`
            : '';

        let html = `<div class="outline-node ${completedClass} ${headingClass}" style="margin-left: ${indent}px;">`;
        html += `<div class="node-content">`;

        if (options.includeCompletionStatus) {
          html += `<span class="checkbox ${node.completed ? 'checked' : ''}"></span>`;
        }

        html += `<span class="text">${node.plainText}</span>`;

        if (options.includeTags && node.tags.length > 0) {
          html += `<span class="tags">${node.tags
            .map((t) => `<span class="tag">#${t}</span>`)
            .join('')}</span>`;
        }

        html += `</div>`;

        if (options.includeNotes && node.notePlainText) {
          html += `<div class="note">${node.notePlainText}</div>`;
        }

        if (node.children.length > 0) {
          html += `<div class="children">${node.children
            .map((n) => nodeToHTML(n, depth + 1))
            .join('')}</div>`;
        }

        html += `</div>`;
        return html;
      }

      return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #fff;
      color: #333;
      line-height: 1.6;
    }
    h1 { margin-bottom: 1rem; }
    .outline-node {
      padding: 0.25rem 0;
      transition: background 0.15s;
    }
    .outline-node:hover { background: #f5f5f5; }
    .node-content { display: flex; align-items: center; gap: 0.5rem; }
    .text { flex: 1; }
    .completed .text {
      text-decoration: line-through;
      color: #999;
    }
    .heading-1 .text { font-size: 1.5em; font-weight: bold; }
    .heading-2 .text { font-size: 1.3em; font-weight: bold; }
    .heading-3 .text { font-size: 1.15em; font-weight: 600; }
    .heading-4 .text { font-size: 1.05em; font-weight: 600; }
    .heading-5 .text { font-size: 1em; font-weight: 600; }
    .heading-6 .text { font-size: 0.95em; font-weight: 500; }
    .heading-7 .text { font-size: 0.9em; font-weight: 500; }
    .checkbox {
      width: 16px;
      height: 16px;
      border: 1px solid #ccc;
      border-radius: 50%;
    }
    .checkbox.checked {
      background: #22c55e;
      border-color: #22c55e;
    }
    .note {
      font-size: 0.85em;
      color: #666;
      background: #f5f5f5;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      margin: 0.25rem 0 0.25rem 1.5rem;
    }
    .tags { display: inline-flex; gap: 0.25rem; margin-left: 0.5rem; }
    .tag {
      font-size: 0.75em;
      padding: 0.125rem 0.375rem;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 4px;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1a; color: #e5e5e5; }
      .outline-node:hover { background: #2a2a2a; }
      .note { background: #2a2a2a; }
    }
  </style>
</head>
<body>
  <h1>${documentTitle}</h1>
  <div class="outline">
    ${nodes.map((n) => nodeToHTML(n, 0)).join('')}
  </div>
</body>
</html>`;
    },
    [documentTitle, options]
  );

  // 执行导出
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      let content: string;
      let defaultExt: string;
      let filterName: string;

      switch (options.format) {
        case 'markdown':
          content = outlineToMarkdown(
            { ...outline, title: documentTitle },
            {
              includeCompleted: options.includeCompletionStatus,
              includeNotes: options.includeNotes,
              numberedLists: options.numberedLists,
            }
          );
          defaultExt = 'md';
          filterName = 'Markdown';
          break;
        case 'opml':
          content = outlineToOPML({ ...outline, title: documentTitle });
          defaultExt = 'opml';
          filterName = 'OPML';
          break;
        case 'json':
          content = exportToJSON(outline);
          defaultExt = 'json';
          filterName = 'JSON';
          break;
        case 'html':
          content = exportToHTML(outline.nodes);
          defaultExt = 'html';
          filterName = 'HTML';
          break;
        case 'docx':
        case 'pdf': {
          // DOCX/PDF: 通过 Rust 后端 export_document_native 导出
          const md = outlineToMarkdown(
            { ...outline, title: documentTitle },
            {
              includeCompleted: options.includeCompletionStatus,
              includeNotes: options.includeNotes,
              numberedLists: options.numberedLists,
            }
          );
          const ext = options.format;
          const nativePath = await save({
            defaultPath: `${documentTitle}.${ext}`,
            filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
          });
          if (!nativePath) { setIsExporting(false); return; }

          const result = await invoke<string>('export_document_native', {
            documentId: documentId || '',
            projectId: projectId || '',
            format: ext,
            outputPath: nativePath,
            contentOverride: md,
          });

          if (ext === 'pdf') {
            await invoke('open_pdf_preview', {
              htmlPath: result,
              title: `PDF 预览 - ${documentTitle}`,
            });
          }
          setExportSuccess(true);
          setTimeout(() => onClose(), 1000);
          setIsExporting(false);
          return;
        }
      }

      const filePath = await save({
        defaultPath: `${documentTitle}.${defaultExt}`,
        filters: [
          {
            name: filterName,
            extensions: [defaultExt],
          },
        ],
      });

      if (filePath) {
        await invoke('write_file', { path: filePath, content });
        setExportSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [options, outline, documentTitle, exportToJSON, exportToHTML, onClose, documentId, projectId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('outline.export.title', { defaultValue: '导出大纲' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 格式选择 */}
          <RadioGroup
            value={options.format}
            onValueChange={(value) =>
              setOptions((prev) => ({ ...prev, format: value as ExportFormat }))
            }
            className="space-y-2"
          >
            {formatOptions.map((format) => (
              <Label
                key={format.value}
                htmlFor={format.value}
                className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has(:checked)]:bg-accent"
              >
                <RadioGroupItem value={format.value} id={format.value} className="mt-1" />
                <format.icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{format.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {format.description}
                  </div>
                </div>
              </Label>
            ))}
          </RadioGroup>

          {/* 导出选项 */}
          <div className="space-y-2 pt-2 border-t">
            <div className="text-sm font-medium text-muted-foreground">
              {t('outline.export.options', { defaultValue: '导出选项' })}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="includeNotes"
                checked={options.includeNotes}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, includeNotes: !!checked }))
                }
              />
              <Label htmlFor="includeNotes" className="text-sm cursor-pointer">
                {t('outline.export.includeNotes', { defaultValue: '包含备注' })}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="includeTags"
                checked={options.includeTags}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({ ...prev, includeTags: !!checked }))
                }
              />
              <Label htmlFor="includeTags" className="text-sm cursor-pointer">
                {t('outline.export.includeTags', { defaultValue: '包含标签' })}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="includeCompletionStatus"
                checked={options.includeCompletionStatus}
                onCheckedChange={(checked) =>
                  setOptions((prev) => ({
                    ...prev,
                    includeCompletionStatus: !!checked,
                  }))
                }
              />
              <Label
                htmlFor="includeCompletionStatus"
                className="text-sm cursor-pointer"
              >
                {t('outline.export.includeCompletion', {
                  defaultValue: '包含完成状态',
                })}
              </Label>
            </div>

            {options.format === 'markdown' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="numberedLists"
                  checked={options.numberedLists}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, numberedLists: !!checked }))
                  }
                />
                <Label htmlFor="numberedLists" className="text-sm cursor-pointer">
                  {t('outline.export.numberedLists', {
                    defaultValue: '使用有序列表',
                  })}
                </Label>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {t('outline.export.exporting', { defaultValue: '导出中...' })}
              </>
            ) : exportSuccess ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t('outline.export.success', { defaultValue: '导出成功' })}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('outline.export.export', { defaultValue: '导出' })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportDialog;
