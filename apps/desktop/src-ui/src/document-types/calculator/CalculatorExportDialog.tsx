/**
 * CalculatorExportDialog — 计算结果导出对话框
 * 支持 CSV、TXT、JSON、Markdown 四种格式导出
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download, FileSpreadsheet, FileText, FileJson, FileCode2
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
import { saveTextFileWithDialog } from '@/lib/tauriSaveTextFile';
import type { CalculatorDocumentContent } from './types';
import {
  exportToCSV,
  exportToTXT,
  exportToJSON,
  exportToMarkdown,
} from './engine/exporter';

type ExportFormat = 'csv' | 'txt' | 'json' | 'md';

interface FormatOption {
  value: ExportFormat;
  icon: React.ComponentType<{ className?: string }>;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'csv', icon: FileSpreadsheet },
  { value: 'txt', icon: FileText },
  { value: 'json', icon: FileJson },
  { value: 'md', icon: FileCode2 },
];

interface CalculatorExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calcDoc: CalculatorDocumentContent;
  defaultTitle?: string;
}

export function CalculatorExportDialog({
  open,
  onOpenChange,
  calcDoc,
  defaultTitle = 'calculator',
}: CalculatorExportDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filename, setFilename] = useState(defaultTitle);
  const [exporting, setExporting] = useState(false);

  const csvColumnLabels = useMemo(
    () => ({
      lineNumber: t('calculator.exportColLineNo', { defaultValue: '行号' }),
      expression: t('calculator.exportColExpression', { defaultValue: '表达式' }),
      result: t('calculator.exportColResult', { defaultValue: '结果' }),
      type: t('calculator.exportColType', { defaultValue: '类型' }),
      noteKind: t('calculator.exportColNote', { defaultValue: '备注' }),
    }),
    [t],
  );

  const mdColumnLabels = useMemo(
    () => ({
      lineNumber: t('calculator.exportColLineNo', { defaultValue: '行号' }),
      expression: t('calculator.exportColExpression', { defaultValue: '表达式' }),
      result: t('calculator.exportColResult', { defaultValue: '结果' }),
    }),
    [t],
  );

  // 生成预览内容
  const previewContent = useMemo(() => {
    if (!calcDoc) return '';

    switch (format) {
      case 'csv':
        return exportToCSV(calcDoc, undefined, csvColumnLabels);
      case 'txt':
        return exportToTXT(calcDoc);
      case 'json':
        return exportToJSON(calcDoc);
      case 'md':
        return exportToMarkdown(calcDoc, undefined, mdColumnLabels);
      default:
        return '';
    }
  }, [calcDoc, format, csvColumnLabels, mdColumnLabels]);

  const handleExport = useCallback(async () => {
    const extension = format === 'md' ? 'md' : format;
    const fullFilename = `${filename || defaultTitle}.${extension}`;
    setExporting(true);
    try {
      const filters =
        extension === 'md'
          ? [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
          : [{ name: extension.toUpperCase(), extensions: [extension] }];
      const path = await saveTextFileWithDialog({
        defaultPath: fullFilename,
        filters,
        content: previewContent,
      });
      if (path) onOpenChange(false);
    } catch (e) {
      console.error('[CalculatorExportDialog]', e);
    } finally {
      setExporting(false);
    }
  }, [format, filename, defaultTitle, previewContent, onOpenChange]);

  const getFormatLabel = (fmt: ExportFormat): string => {
    switch (fmt) {
      case 'csv':
        return t('calculator.exportCSV', { defaultValue: 'CSV Spreadsheet' });
      case 'txt':
        return t('calculator.exportTXT', { defaultValue: 'Plain Text' });
      case 'json':
        return t('calculator.exportJSON', { defaultValue: 'JSON Data' });
      case 'md':
        return t('calculator.exportMarkdown', { defaultValue: 'Markdown' });
      default:
        return fmt.toUpperCase();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t('calculator.exportTitle', { defaultValue: 'Export Results' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 文件名 */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t('calculator.exportFilename', { defaultValue: 'Filename' })}
            </Label>
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder={defaultTitle}
            />
          </div>

          {/* 格式选择 */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t('calculator.exportFormat', { defaultValue: 'Export Format' })}
            </Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <opt.icon className="h-3.5 w-3.5" />
                      {getFormatLabel(opt.value)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 预览 */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t('calculator.exportPreview', { defaultValue: 'Preview' })}
            </Label>
            <ScrollArea className="h-64 w-full rounded-md border bg-muted/30">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {previewContent.slice(0, 5000)}
                {previewContent.length > 5000 && '\n...'}
              </pre>
            </ScrollArea>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('calculator.exportChooseSavePathHint', {
              defaultValue: '导出时将打开系统「另存为」对话框，可选择目标文件夹与文件名。',
            })}
          </p>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={exporting}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button size="sm" onClick={() => void handleExport()} disabled={exporting}>
            <Download className="h-3 w-3 mr-1" />
            {exporting
              ? t('calculator.exporting', { defaultValue: '导出中…' })
              : t('calculator.export', { defaultValue: 'Export' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CalculatorExportDialog;
