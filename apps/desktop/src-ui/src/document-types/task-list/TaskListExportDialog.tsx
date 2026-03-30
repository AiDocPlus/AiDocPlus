/**
 * TaskListExportDialog — 任务清单导出
 * 文本类：Markdown / CSV / TXT / JSON（系统另存为 + write_file）
 * 版式类：DOCX / PDF（Rust 原生导出）
 * 图片：PNG / JPEG（Canvas 渲染）
 */
import { useState, useMemo, useCallback, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  FileCode2,
  FileType2,
  FileImage,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TaskListDocumentContent } from './types';
import { saveTextFileWithDialog } from '@/lib/tauriSaveTextFile';
import {
  exportTaskListToMarkdown,
  exportTaskListToCSV,
  exportTaskListToTXT,
  exportTaskListToJSON,
  exportTaskListRasterToBlob,
} from './taskListExporter';

type ExportFormat = 'md' | 'csv' | 'txt' | 'json' | 'docx' | 'pdf' | 'png' | 'jpg';

interface FormatOption {
  value: ExportFormat;
  icon: ComponentType<{ className?: string }>;
  labelKey: string;
  defaultLabel: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'md', icon: FileCode2, labelKey: 'taskList.exportFmtMd', defaultLabel: 'Markdown' },
  { value: 'csv', icon: FileSpreadsheet, labelKey: 'taskList.exportFmtCsv', defaultLabel: 'CSV' },
  { value: 'txt', icon: FileText, labelKey: 'taskList.exportFmtTxt', defaultLabel: 'TXT' },
  { value: 'json', icon: FileJson, labelKey: 'taskList.exportFmtJson', defaultLabel: 'JSON' },
  { value: 'docx', icon: FileType2, labelKey: 'taskList.exportFmtDocx', defaultLabel: 'Word (DOCX)' },
  { value: 'pdf', icon: FileText, labelKey: 'taskList.exportFmtPdf', defaultLabel: 'PDF' },
  { value: 'png', icon: FileImage, labelKey: 'taskList.exportFmtPng', defaultLabel: 'PNG' },
  { value: 'jpg', icon: FileImage, labelKey: 'taskList.exportFmtJpg', defaultLabel: 'JPEG' },
];

interface TaskListExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskDoc: TaskListDocumentContent;
  documentId: string;
  projectId: string;
  defaultTitle?: string;
}

export function TaskListExportDialog({
  open,
  onOpenChange,
  taskDoc,
  documentId,
  projectId,
  defaultTitle = 'tasks',
}: TaskListExportDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('md');
  const [filename, setFilename] = useState(defaultTitle);
  const [exporting, setExporting] = useState(false);

  const mdLabels = useMemo(
    () => ({
      list: t('taskList.exportMdHeading', { defaultValue: '任务清单' }),
      pending: t('taskList.exportMdPending', { defaultValue: '待办' }),
      completed: t('taskList.exportMdCompleted', { defaultValue: '已完成' }),
      priority: t('taskList.priority', { defaultValue: '优先级' }),
      status: t('taskList.status', { defaultValue: '状态' }),
    }),
    [t],
  );

  const imageLabels = useMemo(
    () => ({
      list: t('taskList.exportMdHeading', { defaultValue: '任务清单' }),
      pending: t('taskList.exportMdPending', { defaultValue: '待办' }),
      completed: t('taskList.exportMdCompleted', { defaultValue: '已完成' }),
    }),
    [t],
  );

  const csvCols = useMemo(
    () => ({
      list: t('taskList.exportColList', { defaultValue: '列表' }),
      content: t('taskList.exportColContent', { defaultValue: '内容' }),
      priority: t('taskList.exportColPriority', { defaultValue: '优先级' }),
      status: t('taskList.exportColStatus', { defaultValue: '状态' }),
      completedAt: t('taskList.exportColCompletedAt', { defaultValue: '完成时间' }),
    }),
    [t],
  );

  const previewContent = useMemo(() => {
    if (!taskDoc) return '';
    switch (format) {
      case 'csv':
        return exportTaskListToCSV(taskDoc, csvCols);
      case 'txt':
        return exportTaskListToTXT(taskDoc);
      case 'json':
        return exportTaskListToJSON(taskDoc);
      case 'md':
        return exportTaskListToMarkdown(taskDoc, mdLabels);
      case 'docx':
      case 'pdf':
        return `${exportTaskListToMarkdown(taskDoc, mdLabels)}\n\n---\n(${t('taskList.exportNativePreviewHint', { defaultValue: '预览为 Markdown 源；实际文件为' })} ${format.toUpperCase()})`;
      case 'png':
      case 'jpg':
        return `${exportTaskListToMarkdown(taskDoc, mdLabels)}\n\n---\n(${t('taskList.exportImagePreviewHint', { defaultValue: '图片导出为画布渲染，版式与上图文字一致' })})`;
      default:
        return '';
    }
  }, [taskDoc, format, csvCols, mdLabels, t]);

  const handleExport = useCallback(async () => {
    const base = filename.trim() || defaultTitle;

    if (format === 'docx' || format === 'pdf') {
      setExporting(true);
      try {
        const md = exportTaskListToMarkdown(taskDoc, mdLabels);
        const filePath = await save({
          defaultPath: `${base}.${format}`,
          filters: [{ name: format.toUpperCase(), extensions: [format] }],
        });
        if (!filePath) return;

        const result = await invoke<string>('export_document_native', {
          documentId,
          projectId,
          format,
          outputPath: filePath,
          contentOverride: md,
        });

        if (format === 'pdf') {
          await invoke('open_pdf_preview', {
            htmlPath: result,
            title: t('taskList.exportPdfPreviewTitle', { defaultValue: 'PDF 预览 — 任务清单' }),
          });
        }
        onOpenChange(false);
      } catch (e) {
        console.error('[TaskListExportDialog]', e);
      } finally {
        setExporting(false);
      }
      return;
    }

    if (format === 'png' || format === 'jpg') {
      const ext = format === 'jpg' ? 'jpg' : 'png';
      setExporting(true);
      try {
        const filePath = await save({
          defaultPath: `${base}.${ext}`,
          filters:
            format === 'jpg'
              ? [{ name: 'JPEG', extensions: ['jpg', 'jpeg'] }]
              : [{ name: 'PNG', extensions: ['png'] }],
        });
        if (!filePath) return;

        const blob = await exportTaskListRasterToBlob(
          taskDoc,
          format === 'jpg' ? 'jpeg' : 'png',
          imageLabels,
        );
        if (!blob) return;

        const bytes = new Uint8Array(await blob.arrayBuffer());
        await invoke('write_binary_file', {
          path: filePath,
          data: Array.from(bytes),
        });
        onOpenChange(false);
      } catch (e) {
        console.error('[TaskListExportDialog]', e);
      } finally {
        setExporting(false);
      }
      return;
    }

    let text = '';
    let extension = format;
    switch (format) {
      case 'csv':
        text = exportTaskListToCSV(taskDoc, csvCols);
        break;
      case 'txt':
        text = exportTaskListToTXT(taskDoc);
        break;
      case 'json':
        text = exportTaskListToJSON(taskDoc);
        break;
      case 'md':
        text = exportTaskListToMarkdown(taskDoc, mdLabels);
        extension = 'md';
        break;
      default:
        return;
    }
    setExporting(true);
    try {
      const filters =
        extension === 'md'
          ? [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
          : [{ name: extension.toUpperCase(), extensions: [extension] }];
      const path = await saveTextFileWithDialog({
        defaultPath: `${base}.${extension}`,
        filters,
        content: text,
      });
      if (path) onOpenChange(false);
    } catch (e) {
      console.error('[TaskListExportDialog]', e);
    } finally {
      setExporting(false);
    }
  }, [
    format,
    filename,
    defaultTitle,
    taskDoc,
    mdLabels,
    csvCols,
    imageLabels,
    documentId,
    projectId,
    onOpenChange,
    t,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('taskList.exportTitle', { defaultValue: '导出任务清单' })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('taskList.exportFormat', { defaultValue: '格式' })}</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" />
                          {t(opt.labelKey, { defaultValue: opt.defaultLabel })}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('taskList.exportFilename', { defaultValue: '文件名' })}</Label>
              <Input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder={defaultTitle}
              />
            </div>
          </div>

          {(format === 'md' ||
            format === 'csv' ||
            format === 'txt' ||
            format === 'json' ||
            format === 'png' ||
            format === 'jpg') && (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2">
              {t('taskList.exportChooseSavePathHint', {
                defaultValue:
                  '点击导出后将打开系统「另存为」对话框，请选择目标文件夹与文件名；可与上方文件名一致或另改。',
              })}
            </p>
          )}

          <div className="space-y-2">
            <Label>{t('taskList.exportPreview', { defaultValue: '预览' })}</Label>
            <ScrollArea className="h-[min(40vh,320px)] rounded-md border p-3 bg-muted/30">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">{previewContent}</pre>
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            {exporting
              ? t('taskList.exporting', { defaultValue: '导出中…' })
              : t('taskList.exportDownload', { defaultValue: '下载' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
