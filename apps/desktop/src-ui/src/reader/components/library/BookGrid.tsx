// ── 磁力网格布局 ──

import { bookTitle, formatFileSize } from './BookPropertiesDialog';
import type { EbookInfo, ReadingProgress } from '../../useReaderStore';
import { useTranslation } from '@/i18n';
import { Star } from 'lucide-react';

const FORMAT_COLORS: Record<string, { bg: string; text: string }> = {
  md:   { bg: '#eff6ff', text: '#2563eb' },
  html: { bg: '#ecfdf5', text: '#059669' },
  pdf:  { bg: '#fef2f2', text: '#dc2626' },
  docx: { bg: '#eef2ff', text: '#4f46e5' },
  epub: { bg: '#faf5ff', text: '#7c3aed' },
};

const STATUS_DOT: Record<string, { bg: string; text: string }> = {
  '':        { bg: '#e2e8f0', text: '#94a3b8' },
  'unread':   { bg: '#f0f9f0', text: '#6b7280' },
  'reading':  { bg: '#dbebff', text: '#92400e' },
  'completed': { bg: '#dcfce7', text: '#16a34a' },
};

const STATUS_LABEL_KEY: Record<string, string> = {
  'unread': 'reader.statusUnread',
  'reading': 'reader.statusReading',
  'completed': 'reader.statusCompleted',
};

function BookGridItem({
  book,
  progress,
  onClick,
  onContextMenu,
}: {
  book: EbookInfo;
  progress: ReadingProgress | null;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  const badge = FORMAT_COLORS[book.format] || { bg: '#f1f5f9', text: '#475569' };
  const statusDot = STATUS_DOT[book.reading_status] || STATUS_DOT[''];
  const labelKey = STATUS_LABEL_KEY[book.reading_status];
  const statusLabel = labelKey ? t(labelKey, { defaultValue: '' }) : '';

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        borderRadius: 6,
        cursor: 'pointer',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* 封面 */}
      <div style={{ position: 'relative' }}>
        {book.cover_image ? (
          <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 4, overflow: 'hidden' }}>
            <img src={book.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{
            width: '100%', aspectRatio: '3/4', borderRadius: 4,
            background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: badge.text, }}>
              {book.format.toUpperCase()}
            </span>
          </div>
        )}
        {/* 收藏星标 */}
        {book.starred && (
          <Star size={14} style={{ position: 'absolute', top: 4, right: 4, color: '#eab308', fill: '#eab308', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3)' }} />
        )}
        {/* 阅读状态 */}
        <div style={{
          position: 'absolute', bottom: 4, left: 4,
          background: statusDot.bg, color: statusDot.text,
          fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 3,
          lineHeight: 1,
        }}>
          {statusLabel}
        </div>
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
          {bookTitle(book)}
        </p>
        {book.author && (
          <p style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {book.author}
          </p>
        )}
        {/* 进度条 */}
        {progress?.progressPercent && progress.progressPercent > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{ width: `${progress.progressPercent}%`, height: '100%', background: '#3b82f6', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{progress.progressPercent}%</span>
          </div>
        )}
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatFileSize(book.size_bytes)}</span>
      </div>
    </div>
  );
}

export function BookGrid({
  books,
  readingProgress,
  onOpenBook,
  onContextMenu,
}: {
  books: EbookInfo[];
  readingProgress: Record<string, ReadingProgress>;
  onOpenBook: (book: EbookInfo) => void;
  onContextMenu: (e: React.MouseEvent, book: EbookInfo) => void;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 8,
      padding: 4,
    }}>
      {books.map(book => (
        <BookGridItem
          key={book.filename}
          book={book}
          progress={readingProgress[book.filename] ?? null}
          onClick={() => onOpenBook(book)}
          onContextMenu={e => onContextMenu(e, book)}
        />
      ))}
    </div>
  );
}
