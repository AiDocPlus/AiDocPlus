import { useCallback } from 'react';
import {
  Button, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../_framework/ui';
import { useEmailContext } from '../EmailContext';
import type { Contact, EmailStorageData } from '../types';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  csvHeaders: string[];
  csvData: string[][];
  csvEmailColumn: number;
  csvNameColumn: number;
  onEmailColumnChange: (v: number) => void;
  onNameColumnChange: (v: number) => void;
}

export function CsvImportDialog({
  open, onOpenChange,
  csvHeaders, csvData, csvEmailColumn, csvNameColumn,
  onEmailColumnChange, onNameColumnChange,
}: CsvImportDialogProps) {
  const { saveToStorage, showStatus, t, host } = useEmailContext();

  const handleImport = useCallback(() => {
    if (csvEmailColumn < 0) {
      showStatus(t('csvSelectEmailColumn'), true);
      return;
    }

    const current = host.storage.get<EmailStorageData>('emailData') || {};
    const existingContacts = current.contacts || [];

    const newContacts: Contact[] = csvData.map(row => {
      const email = row[csvEmailColumn] || '';
      const name = csvNameColumn >= 0 ? row[csvNameColumn] || '' : '';
      // 其他列按 "列名: 值" 格式每列一行写入备注
      const noteLines: string[] = [];
      csvHeaders.forEach((header, idx) => {
        if (idx !== csvEmailColumn && idx !== csvNameColumn && row[idx]?.trim()) {
          noteLines.push(`${header}: ${row[idx].trim()}`);
        }
      });
      return {
        id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        email,
        name,
        note: noteLines.length > 0 ? noteLines.join('\n') : undefined,
        createdAt: Date.now(),
      };
    }).filter(c => c.email.trim());

    const existingEmails = new Set(existingContacts.map(c => c.email.toLowerCase()));
    const toAdd = newContacts.filter(c => !existingEmails.has(c.email.toLowerCase()));
    const updated = [...existingContacts, ...toAdd];

    saveToStorage({ contacts: updated });
    onOpenChange(false);
    showStatus(t('csvImportSuccess', { count: toAdd.length, total: newContacts.length }));
  }, [csvData, csvEmailColumn, csvNameColumn, csvHeaders, host.storage, saveToStorage, showStatus, t, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] w-[95vw] h-[85vh] flex flex-col p-0" style={DIALOG_STYLE}>
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle>{t('csvImportTitle')}</DialogTitle>
          <DialogDescription>{t('csvImportDesc', { count: csvData.length })}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-4">
          {/* 列映射 */}
          <div className="flex gap-6 flex-shrink-0">
            <div className="flex-1 space-y-2">
              <Label className="text-sm font-medium">{t('csvEmailColumn')} *</Label>
              <Select value={String(csvEmailColumn)} onValueChange={v => onEmailColumnChange(parseInt(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('csvSelectColumn')} />
                </SelectTrigger>
                <SelectContent>
                  {csvHeaders.map((h, i) => (
                    <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-sm font-medium">{t('csvNameColumn')}</Label>
              <Select value={String(csvNameColumn)} onValueChange={v => onNameColumnChange(parseInt(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('csvSelectColumn')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">{t('csvNone')}</SelectItem>
                  {csvHeaders.map((h, i) => (
                    <SelectItem key={i} value={String(i)}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 数据预览 */}
          <div className="flex-1 min-h-0 border rounded-md overflow-auto" style={{ maxHeight: 'calc(85vh - 220px)' }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted z-10">
                <tr>
                  {csvHeaders.map((h, i) => (
                    <th key={i} className={`px-3 py-2 text-left font-medium border-b whitespace-nowrap ${i === csvEmailColumn ? 'bg-blue-500/20' : i === csvNameColumn ? 'bg-green-500/20' : ''}`}>
                      {h}
                      {i === csvEmailColumn && <span className="ml-1 text-blue-600 text-xs">({t('csvEmail')})</span>}
                      {i === csvNameColumn && <span className="ml-1 text-green-600 text-xs">({t('csvName')})</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(1, 21).map((row, ri) => (
                  <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-3 py-2 ${ci === csvEmailColumn ? 'bg-blue-500/10' : ci === csvNameColumn ? 'bg-green-500/10' : ''}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {csvData.length > 21 && (
              <div className="text-sm text-muted-foreground text-center py-3 bg-muted/50 sticky bottom-0">
                {t('csvMoreRows', { count: csvData.length - 21 })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0 bg-muted/30">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleImport} disabled={csvEmailColumn < 0}>
            {t('csvImportButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
