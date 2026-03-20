/**
 * DiaryImportDialog — 日记导入弹窗
 *
 * 左侧：文件选择+格式检测+选项  右侧：解析预览
 * 支持4种格式：自身JSON / Day One / Markdown / 纯文本
 */
import { useState, useCallback } from 'react';
import { FileUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import type { DiaryDocumentContent } from './types';
import {
  parseImport, mergeImportedEntries,
  type ImportResult, type ConflictMode,
} from './diaryImport';

const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

// FORMAT_LABELS 在组件内通过 t() 初始化

interface DiaryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diary: DiaryDocumentContent;
  onDiaryChange: (updated: DiaryDocumentContent) => void;
}

export default function DiaryImportDialog({
  open, onOpenChange, diary, onDiaryChange,
}: DiaryImportDialogProps) {
  const { t } = useTranslation();
  const FORMAT_LABELS: Record<string, string> = {
    'aidocplus-json': 'AiDocPlus JSON',
    'dayone-json': 'Day One JSON',
    'markdown': 'Markdown',
    'plaintext': t('diary.formatPlainText', { defaultValue: '纯文本' }),
    'unknown': t('diary.formatUnknown', { defaultValue: '未知格式' }),
  };
  const [result, setResult] = useState<ImportResult | null>(null);
  const [conflictMode, setConflictMode] = useState<ConflictMode>('skip');
  const [targetJournalId, setTargetJournalId] = useState(diary.settings.defaultJournalId);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; overwritten: number } | null>(null);

  const handleFileSelect = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.md,.txt,.markdown';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const parsed = parseImport(text);
      setResult(parsed);
      setImportResult(null);
    };
    input.click();
  }, []);

  const handleImport = useCallback(() => {
    if (!result || result.entries.length === 0) return;
    setImporting(true);
    try {
      const { diary: updated, added, skipped, overwritten } = mergeImportedEntries(
        diary, result.entries, targetJournalId, conflictMode,
      );
      onDiaryChange(updated);
      setImportResult({ added, skipped, overwritten });
    } finally {
      setImporting(false);
    }
  }, [result, diary, targetJournalId, conflictMode, onDiaryChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[8vh] !translate-y-0 w-[75vw] h-[70vh] max-w-[1000px] max-h-[70vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('diary.importDiary', { defaultValue: '导入日记' })}</DialogTitle>

        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <FileUp className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{t('diary.importDiary', { defaultValue: '导入日记' })}</span>
          <div className="flex-1" />
          {result && result.entries.length > 0 && !importResult && (
            <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={handleImport} disabled={importing}>
              <FileUp className="h-3 w-3" />
              {importing ? t('diary.importing', { defaultValue: '导入中...' }) : t('diary.doImport', { defaultValue: '确认导入' })}
            </Button>
          )}
          {importResult && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
              {t('diary.close', { defaultValue: '关闭' })}
            </Button>
          )}
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧选项 */}
          <div className="w-[240px] flex-shrink-0 border-r p-3 space-y-3 overflow-auto">
            {/* 选择文件 */}
            <Button variant="outline" className="w-full gap-1 text-xs" onClick={handleFileSelect}>
              <FileUp className="h-3.5 w-3.5" />
              {t('diary.selectFile', { defaultValue: '选择文件' })}
            </Button>

            {/* 格式检测结果 */}
            {result && (
              <div className="space-y-2">
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{t('diary.detectedFormat', { defaultValue: '检测格式:' })}</span>
                    <span className="font-medium">{FORMAT_LABELS[result.format]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{t('diary.entryCount', { defaultValue: '条目数:' })}</span>
                    <span className="font-medium">{result.entries.length}</span>
                  </div>
                  {result.dateRange && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{t('diary.dateRangeLabel', { defaultValue: '日期范围:' })}</span>
                      <span className="font-medium text-[10px]">{result.dateRange.from} ~ {result.dateRange.to}</span>
                    </div>
                  )}
                </div>

                {/* 错误信息 */}
                {result.errors.length > 0 && (
                  <div className="rounded border border-red-300 bg-red-50 dark:bg-red-900/20 p-2 space-y-0.5">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1 text-[10px] text-red-600">
                        <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}

                {/* 目标日记本 */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">{t('diary.importToJournal', { defaultValue: '导入到日记本' })}</label>
                  <select className="w-full text-xs px-2 py-1 border rounded bg-background"
                    value={targetJournalId}
                    onChange={e => setTargetJournalId(e.target.value)}>
                    {diary.journals.map(j => (
                      <option key={j.id} value={j.id}>{j.icon} {j.name}</option>
                    ))}
                  </select>
                </div>

                {/* 冲突处理 */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">{t('diary.conflictHandling', { defaultValue: '同日期同标题冲突' })}</label>
                  {[
                    { key: 'skip' as ConflictMode, label: t('diary.conflictSkip', { defaultValue: '跳过（保留现有）' }) },
                    { key: 'overwrite' as ConflictMode, label: t('diary.conflictOverwrite', { defaultValue: '覆盖（替换现有）' }) },
                    { key: 'append' as ConflictMode, label: t('diary.conflictAppend', { defaultValue: '追加为新条目' }) },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="radio" name="conflict" checked={conflictMode === opt.key}
                        onChange={() => setConflictMode(opt.key)} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 导入结果 */}
            {importResult && (
              <div className="rounded border border-green-300 bg-green-50 dark:bg-green-900/20 p-2 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-300 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t('diary.importComplete', { defaultValue: '导入完成' })}
                </div>
                <div className="text-[10px] text-green-600 dark:text-green-400 space-y-0.5">
                  <div>{t('diary.importAdded', { defaultValue: '新增: {{count}} 条', count: importResult.added })}</div>
                  {importResult.skipped > 0 && <div>{t('diary.importSkipped', { defaultValue: '跳过: {{count}} 条', count: importResult.skipped })}</div>}
                  {importResult.overwritten > 0 && <div>{t('diary.importOverwritten', { defaultValue: '覆盖: {{count}} 条', count: importResult.overwritten })}</div>}
                </div>
              </div>
            )}

            {/* 支持格式说明 */}
            {!result && (
              <div className="text-[10px] text-muted-foreground space-y-1 pt-2 border-t">
                <p className="font-medium">{t('diary.supportedFormats', { defaultValue: '支持的格式:' })}</p>
                <p>• AiDocPlus JSON{t('diary.formatDescJson', { defaultValue: '（导出的 JSON 文件）' })}</p>
                <p>• Day One JSON{t('diary.formatDescDayOne', { defaultValue: '（Day One 导出格式）' })}</p>
                <p>• Markdown{t('diary.formatDescMd', { defaultValue: '（按日期标题分割）' })}</p>
                <p>• {t('diary.formatPlainText', { defaultValue: '纯文本' })}{t('diary.formatDescTxt', { defaultValue: '（按日期行分割）' })}</p>
              </div>
            )}
          </div>

          {/* 右侧预览 */}
          <div className="flex-1 min-w-0 overflow-auto p-3">
            {!result && (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                {t('diary.importSelectHint', { defaultValue: '请选择要导入的文件' })}
              </div>
            )}
            {result && result.entries.length === 0 && (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                {t('diary.importNoEntries', { defaultValue: '未解析到任何日记条目' })}
              </div>
            )}
            {result && result.entries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  {t('diary.importPreview', { defaultValue: '预览（前50条）' })}
                </p>
                {result.entries.slice(0, 50).map((entry, i) => (
                  <div key={i} className="border rounded p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{entry.date}</span>
                      <span className="text-muted-foreground">{entry.time}</span>
                      {entry.mood && <span>{entry.mood}</span>}
                      {entry.weather && <span>{entry.weather}</span>}
                      {entry.starred && <span className="text-amber-500">★</span>}
                    </div>
                    {entry.title && <div className="font-medium">{entry.title}</div>}
                    <div className="text-muted-foreground line-clamp-2">{entry.content.slice(0, 200)}</div>
                    {entry.tags.length > 0 && (
                      <div className="flex gap-0.5">
                        {entry.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-1 py-0.5 rounded bg-muted">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
