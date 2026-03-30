/**
 * TranslationExportDialog — 翻译文档导出对话框
 * 支持 Markdown 双语对照、Markdown 纯译文、CSV 段落级 三种格式
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download, FileCode2, FileText, FileSpreadsheet,
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
import type { TranslationDocumentContent } from './types';
import {
  exportToMarkdownBilingual,
  exportToMarkdownTargetOnly,
  exportToCSV,
  type TranslationExportFormat,
  TRANSLATION_EXPORT_FORMATS,
} from './translationExporter';

interface FormatOption {
  value: TranslationExportFormat;
  icon: React.ComponentType<{ className?: string }>;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'md-bilingual', icon: FileCode2 },
  { value: 'md-target', icon: FileText },
  { value: 'csv', icon: FileSpreadsheet },
];

interface TranslationExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transDoc: TranslationDocumentContent;
  defaultTitle?: string;
}

export function TranslationExportDialog({
  open,
  onOpenChange,
  transDoc,
  defaultTitle = 'translation',
}: TranslationExportDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<TranslationExportFormat>('md-bilingual');
  const [filename, setFilename] = useState(defaultTitle);
  const [exporting, setExporting] = useState(false);

  const csvLabels = useMemo(() => ({
    source: t('translation.exportColSource', { defaultValue: '原文' }),
    target: t('translation.exportColTarget', { defaultValue: '译文' }),
    paragraph: t('translation.exportColParagraph', { defaultValue: '段落' }),
  }), [t]);

  // 生成预览内容
  const previewContent = useMemo(() => {
    if (!transDoc) return '';
    switch (format) {
      case 'md-bilingual': {
        const srcTitle = transDoc.direction === 'zh-en'
          ? t('translation.sourceZh', { defaultValue: '原文（中文）' })
          : t('translation.sourceEn', { defaultValue: '原文（英文）' });
        const tgtTitle = transDoc.direction === 'zh-en'
          ? t('translation.targetEn', { defaultValue: '译文（英文）' })
          : t('translation.targetZh', { defaultValue: '译文（中文）' });
        return exportToMarkdownBilingual(transDoc, { sourceTitle: srcTitle, targetTitle: tgtTitle });
      }
      case 'md-target':
        return exportToMarkdownTargetOnly(transDoc);
      case 'csv':
        return exportToCSV(transDoc, csvLabels);
      default:
        return '';
    }
  }, [transDoc, format, csvLabels, t]);

  const handleExport = useCallback(async () => {
    const fmtConfig = TRANSLATION_EXPORT_FORMATS.find(f => f.id === format);
    if (!fmtConfig) return;
    const fullFilename = `${filename || defaultTitle}.${fmtConfig.extension}`;
    setExporting(true);
    try {
      const filters =
        fmtConfig.extension === 'md'
          ? [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
          : [{ name: 'CSV', extensions: ['csv'] }];
      const path = await saveTextFileWithDialog({
        defaultPath: fullFilename,
        filters,
        content: previewContent,
      });
      if (path) onOpenChange(false);
    } catch (e) {
      console.error('[TranslationExportDialog]', e);
    } finally {
      setExporting(false);
    }
  }, [format, filename, defaultTitle, previewContent, onOpenChange]);

  const getFormatLabel = (fmt: TranslationExportFormat): string => {
    const cfg = TRANSLATION_EXPORT_FORMATS.find(f => f.id === fmt);
    return cfg?.name || fmt;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t('translation.exportTitle', { defaultValue: '导出翻译' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 文件名 */}
          <div className="space-y-2">
            <Label className="text-sm">
              {t('translation.exportFilename', { defaultValue: '文件名' })}
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
              {t('translation.exportFormat', { defaultValue: '导出格式' })}
            </Label>
            <Select value={format} onValueChange={(v) => setFormat(v as TranslationExportFormat)}>
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
              {t('translation.exportPreview', { defaultValue: '预览' })}
            </Label>
            <ScrollArea className="h-64 w-full rounded-md border bg-muted/30">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {previewContent.slice(0, 5000)}
                {previewContent.length > 5000 && '\n...'}
              </pre>
            </ScrollArea>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('translation.exportHint', {
              defaultValue: '导出时将打开系统「另存为」对话框，可选择目标文件夹与文件名。',
            })}
          </p>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={exporting}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button size="sm" onClick={() => void handleExport()} disabled={exporting || !previewContent.trim()}>
            <Download className="h-3 w-3 mr-1" />
            {exporting
              ? t('translation.exporting', { defaultValue: '导出中…' })
              : t('translation.export', { defaultValue: '导出' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TranslationExportDialog;
