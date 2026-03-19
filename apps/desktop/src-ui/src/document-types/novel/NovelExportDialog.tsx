/**
 * NovelExportDialog — 全书导出对话框
 *
 * 左侧：格式选择 + 可选内容勾选
 * 右侧：导出内容预览（前500行）
 */
import { useState, useMemo, useCallback } from 'react';
import { FileDown, FileText, ListTree, BookOpen, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { NovelDocumentContent } from './types';
import { exportToMarkdown, exportToPlainText, exportOutline, exportSettings, type ExportOptions } from './novelExport';

const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

type ExportFormat = 'markdown' | 'plaintext' | 'outline' | 'settings';

interface NovelExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novel: NovelDocumentContent;
}

export default function NovelExportDialog({ open, onOpenChange, novel }: NovelExportDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [options, setOptions] = useState<ExportOptions>({
    includeOutline: false,
    includeSummary: false,
    includeAuthorNotes: false,
    includeForeshadowing: false,
    includeWordCount: true,
  });

  const exportContent = useMemo(() => {
    switch (format) {
      case 'markdown': return exportToMarkdown(novel, options);
      case 'plaintext': return exportToPlainText(novel);
      case 'outline': return exportOutline(novel);
      case 'settings': return exportSettings(novel);
      default: return '';
    }
  }, [format, novel, options]);

  const previewLines = useMemo(() => {
    return exportContent.split('\n').slice(0, 500).join('\n');
  }, [exportContent]);

  const handleExport = useCallback(() => {
    const extMap: Record<ExportFormat, string> = { markdown: 'md', plaintext: 'txt', outline: 'md', settings: 'md' };
    const ext = extMap[format];
    const defaultName = `novel-${format}.${ext}`;
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onOpenChange(false);
  }, [format, exportContent, onOpenChange]);

  const FORMATS: { key: ExportFormat; icon: typeof FileText; label: string; desc: string }[] = [
    { key: 'markdown', icon: FileText, label: t('novel.exportMarkdown', { defaultValue: 'Markdown' }), desc: t('novel.exportMarkdownDesc', { defaultValue: '完整正文 + 目录' }) },
    { key: 'plaintext', icon: FileDown, label: t('novel.exportPlainText', { defaultValue: '纯文本' }), desc: t('novel.exportPlainTextDesc', { defaultValue: '去除格式标记' }) },
    { key: 'outline', icon: ListTree, label: t('novel.exportOutline', { defaultValue: '大纲' }), desc: t('novel.exportOutlineDesc', { defaultValue: '标题 + 大纲 + 摘要' }) },
    { key: 'settings', icon: Settings, label: t('novel.exportSettings', { defaultValue: '设定集' }), desc: t('novel.exportSettingsDesc', { defaultValue: '角色/地点/世界观/伏笔' }) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[8vh] !translate-y-0 w-[80vw] h-[75vh] max-w-[1100px] max-h-[75vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('novel.exportNovel', { defaultValue: '导出全书' })}</DialogTitle>

        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <BookOpen className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">{t('novel.exportNovel', { defaultValue: '导出全书' })}</span>
          <div className="flex-1" />
          <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={handleExport}>
            <FileDown className="h-3 w-3" />{t('novel.exportSave', { defaultValue: '保存文件' })}
          </Button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧：格式 + 选项 */}
          <div className="w-[240px] flex-shrink-0 border-r p-3 space-y-3 overflow-auto">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('novel.exportFormat', { defaultValue: '导出格式' })}</label>
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

            {format === 'markdown' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('novel.exportOptions', { defaultValue: '可选内容' })}</label>
                {[
                  { key: 'includeOutline' as const, label: t('novel.exportIncludeOutline', { defaultValue: '包含大纲' }) },
                  { key: 'includeSummary' as const, label: t('novel.exportIncludeSummary', { defaultValue: '包含摘要' }) },
                  { key: 'includeAuthorNotes' as const, label: t('novel.exportIncludeNotes', { defaultValue: '包含作者注释' }) },
                  { key: 'includeForeshadowing' as const, label: t('novel.exportIncludeForeshadowing', { defaultValue: '包含伏笔标记' }) },
                  { key: 'includeWordCount' as const, label: t('novel.exportIncludeWordCount', { defaultValue: '包含字数统计' }) },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={options[opt.key]}
                      onChange={e => setOptions(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                      className="rounded border-border" />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}

            <div className="text-[10px] text-muted-foreground pt-2 border-t">
              {t('novel.exportPreviewHint', { defaultValue: '右侧为预览（前500行）' })}
              <br />
              {exportContent.length > 999 ? `${(exportContent.length / 1000).toFixed(1)}KB` : `${exportContent.length}B`}
            </div>
          </div>

          {/* 右侧：预览 */}
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
