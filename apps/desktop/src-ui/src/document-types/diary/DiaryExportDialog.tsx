/**
 * DiaryExportDialog — 日记导出弹窗
 *
 * 左侧：范围/格式/选项  右侧：实时预览
 * 6种格式：Markdown / 纯文本 / DOCX / PDF / JSON / HTML
 */
import { useState, useMemo, useCallback } from 'react';
import { FileDown, FileText, FileJson, Globe, FileType } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { DiaryDocumentContent } from './types';
import { saveTextFileWithDialog } from '@/lib/tauriSaveTextFile';
import {
  exportToMarkdown, exportToPlainText, exportToJSON, buildExportMarkdown,
  DEFAULT_EXPORT_OPTIONS, type DiaryExportOptions,
} from './diaryExport';

const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

type ExportFormat = 'markdown' | 'plaintext' | 'docx' | 'pdf' | 'json' | 'html';

interface DiaryExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diary: DiaryDocumentContent;
  documentId: string;
  projectId: string;
}

export default function DiaryExportDialog({
  open, onOpenChange, diary, documentId, projectId,
}: DiaryExportDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [options, setOptions] = useState<DiaryExportOptions>({ ...DEFAULT_EXPORT_OPTIONS });
  const [exporting, setExporting] = useState(false);

  const FORMATS: { key: ExportFormat; icon: typeof FileText; label: string; desc: string }[] = [
    { key: 'markdown', icon: FileText, label: 'Markdown', desc: t('diary.exportMdDesc', { defaultValue: '按日期分组，含元数据' }) },
    { key: 'plaintext', icon: FileType, label: t('diary.exportPlainText', { defaultValue: '纯文本' }), desc: t('diary.exportTxtDesc', { defaultValue: '去除格式标记' }) },
    { key: 'docx', icon: FileText, label: 'Word (.docx)', desc: t('diary.exportDocxDesc', { defaultValue: '公文排版 DOCX' }) },
    { key: 'pdf', icon: FileDown, label: 'PDF', desc: t('diary.exportPdfDesc', { defaultValue: '可打印 PDF' }) },
    { key: 'json', icon: FileJson, label: 'JSON', desc: t('diary.exportJsonDesc', { defaultValue: '完整数据（可导入）' }) },
    { key: 'html', icon: Globe, label: 'HTML', desc: t('diary.exportHtmlDesc', { defaultValue: '单页网页' }) },
  ];

  const previewContent = useMemo(() => {
    switch (format) {
      case 'markdown': return exportToMarkdown(diary, options);
      case 'plaintext': return exportToPlainText(diary, options);
      case 'json': return exportToJSON(diary, options);
      case 'docx': case 'pdf': case 'html':
        return buildExportMarkdown(diary, options) + '\n\n(' + t('diary.exportPreviewHint', { defaultValue: '预览为 Markdown 源文本，实际导出为 {{format}} 格式', format: format.toUpperCase() }) + ')';
      default: return '';
    }
  }, [format, diary, options]);

  const previewLines = useMemo(() => previewContent.split('\n').slice(0, 500).join('\n'), [previewContent]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      if (format === 'markdown' || format === 'plaintext' || format === 'json') {
        const content = format === 'markdown' ? exportToMarkdown(diary, options)
          : format === 'plaintext' ? exportToPlainText(diary, options)
          : exportToJSON(diary, options);
        const ext = format === 'markdown' ? 'md' : format === 'plaintext' ? 'txt' : 'json';
        const filters =
          ext === 'md'
            ? [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
            : [{ name: ext.toUpperCase(), extensions: [ext] }];
        const path = await saveTextFileWithDialog({
          defaultPath: `diary-export.${ext}`,
          filters,
          content,
        });
        if (path) onOpenChange(false);
      } else {
        // DOCX/PDF/HTML: 通过 Rust 后端导出
        const md = buildExportMarkdown(diary, options);
        const ext = format;
        const defaultFileName = `diary-export.${ext}`;
        const filePath = await save({
          defaultPath: defaultFileName,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
        });
        if (!filePath) { setExporting(false); return; }

        const result = await invoke<string>('export_document_native', {
          documentId,
          projectId,
          format: ext,
          outputPath: filePath,
          contentOverride: md,
        });

        if (format === 'pdf') {
          await invoke('open_pdf_preview', {
            htmlPath: result,
            title: `PDF 预览 - 日记导出`,
          });
        }
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Diary export error:', err);
    } finally {
      setExporting(false);
    }
  }, [format, diary, options, documentId, projectId, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[8vh] !translate-y-0 w-[80vw] h-[75vh] max-w-[1100px] max-h-[75vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('diary.exportDiary', { defaultValue: '导出日记' })}</DialogTitle>

        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <FileDown className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{t('diary.exportDiary', { defaultValue: '导出日记' })}</span>
          <div className="flex-1" />
          <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={handleExport} disabled={exporting}>
            <FileDown className="h-3 w-3" />{exporting ? t('diary.exporting', { defaultValue: '导出中...' }) : t('diary.exportSave', { defaultValue: '导出' })}
          </Button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧选项 */}
          <div className="w-[260px] flex-shrink-0 border-r p-3 space-y-3 overflow-auto">
            {/* 导出范围 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('diary.exportRange', { defaultValue: '导出范围' })}</label>
              {[
                { key: 'all' as const, label: t('diary.exportAll', { defaultValue: '全部日记' }) },
                { key: 'starred' as const, label: t('diary.exportStarred', { defaultValue: '仅收藏' }) },
              ].map(r => (
                <label key={r.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name="range" checked={options.range === r.key}
                    onChange={() => setOptions(prev => ({ ...prev, range: r.key }))} />
                  {r.label}
                </label>
              ))}
              {diary.journals.length > 1 && diary.journals.map(j => (
                <label key={j.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name="range" checked={options.range === 'journal' && options.journalId === j.id}
                    onChange={() => setOptions(prev => ({ ...prev, range: 'journal', journalId: j.id }))} />
                  {j.icon} {j.name}
                </label>
              ))}
            </div>

            {/* 导出格式 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('diary.exportFormat', { defaultValue: '导出格式' })}</label>
              {FORMATS.map(f => {
                const Icon = f.icon;
                return (
                  <button key={f.key}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-sm text-left transition-colors ${format === f.key ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-foreground'}`}
                    onClick={() => setFormat(f.key)}>
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <div>
                      <div>{f.label}</div>
                      <div className="text-[10px] text-muted-foreground">{f.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 包含内容 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('diary.exportIncludes', { defaultValue: '包含内容' })}</label>
              {[
                { key: 'includeMood' as const, label: t('diary.exportIncMood', { defaultValue: '心情标记' }) },
                { key: 'includeWeather' as const, label: t('diary.exportIncWeather', { defaultValue: '天气信息' }) },
                { key: 'includeTags' as const, label: t('diary.exportIncTags', { defaultValue: '标签' }) },
                { key: 'includeLocation' as const, label: t('diary.exportIncLocation', { defaultValue: '位置' }) },
                { key: 'includeWordCount' as const, label: t('diary.exportIncWordCount', { defaultValue: '字数统计' }) },
                { key: 'includeTimestamp' as const, label: t('diary.exportIncTimestamp', { defaultValue: '创建时间' }) },
              ].map(opt => (
                <label key={opt.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={options[opt.key]}
                    onChange={e => setOptions(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                    className="rounded border-border" />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* 排序 */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{t('diary.exportSort', { defaultValue: '排序:' })}</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="sort" checked={options.sortOrder === 'asc'}
                  onChange={() => setOptions(prev => ({ ...prev, sortOrder: 'asc' }))} />
                {t('diary.sortAsc', { defaultValue: '日期正序' })}
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="sort" checked={options.sortOrder === 'desc'}
                  onChange={() => setOptions(prev => ({ ...prev, sortOrder: 'desc' }))} />
                {t('diary.sortDesc', { defaultValue: '日期倒序' })}
              </label>
            </div>

            <div className="text-[10px] text-muted-foreground pt-2 border-t">
              {previewContent.length > 999 ? `${(previewContent.length / 1000).toFixed(1)}KB` : `${previewContent.length}B`}
            </div>
          </div>

          {/* 右侧预览 */}
          <div className="flex-1 min-w-0 overflow-auto p-3">
            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 leading-relaxed">
              {previewLines}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
