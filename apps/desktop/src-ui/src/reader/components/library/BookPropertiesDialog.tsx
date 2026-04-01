// ── 书籍属性对话框 ──

import type { EbookInfo, EbookCategory, ReadingProgress } from '../../useReaderStore';
import { S } from '../../styles';
import { X } from 'lucide-react';

export function bookTitle(book: EbookInfo): string {
  return book.display_name || book.original_name || book.filename;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function BookPropertiesDialog({ book, open, onClose, categories, readingProgress, t }: {
  book: EbookInfo | null;
  open: boolean;
  onClose: () => void;
  categories: EbookCategory[];
  readingProgress: Record<string, ReadingProgress>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (!open || !book) return null;
  const category = categories.find(c => c.id === book.category_id);
  const progress = readingProgress[book.filename];

  const rows = [
    { label: t('reader.propDisplayName', { defaultValue: '显示名称' }), value: bookTitle(book) },
    { label: t('reader.propOriginalName', { defaultValue: '原始文件名' }), value: book.original_name || '—' },
    { label: t('reader.propAuthor', { defaultValue: '作者' }), value: book.author || '—' },
    { label: t('reader.propFilename', { defaultValue: '文件名' }), value: book.filename },
    { label: t('reader.propFormat', { defaultValue: '格式' }), value: book.format.toUpperCase() },
    { label: t('reader.propSize', { defaultValue: '大小' }), value: formatFileSize(book.size_bytes) },
    { label: t('reader.propAddedAt', { defaultValue: '添加时间' }), value: new Date(book.added_at).toLocaleString() },
    { label: t('reader.propCategory', { defaultValue: '分类' }), value: category?.name || t('reader.uncategorized', { defaultValue: '未分类' }) },
    { label: t('reader.propStarred', { defaultValue: '收藏' }), value: book.starred ? '\u2605' : '\u2014' },
    { label: t('reader.propReadingProgress', { defaultValue: '阅读进度' }), value: progress?.progressPercent ? `${progress.progressPercent}%` : '\u2014' },
  ];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.dialog} onClick={e => e.stopPropagation()}>
        <div style={S.dialogHeader}>
          <span style={S.titleText}>{bookTitle(book)}</span>
          <button onClick={onClose} style={S.iconBtn()}><X size={16} /></button>
        </div>
        <div style={S.dialogBody}>
          {rows.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
              <span style={{ width: 96, flexShrink: 0, color: '#64748b' }}>{row.label}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#1e293b' }} title={row.value}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
