// ── 单本书籍条目 ──

import type { EbookInfo, ReadingProgress } from '../../useReaderStore';
import { bookTitle, formatFileSize } from './BookPropertiesDialog';
import { Star } from 'lucide-react';
import { SortableItem } from '@/components/file-tree/SortableItem';

const FORMAT_COLORS: Record<string, { bg: string; text: string }> = {
  md:   { bg: '#eff6ff', text: '#2563eb' },
  html: { bg: '#ecfdf5', text: '#059669' },
  pdf:  { bg: '#fef2f2', text: '#dc2626' },
  docx: { bg: '#eef2ff', text: '#4f46e5' },
  epub: { bg: '#faf5ff', text: '#7c3aed' },
};

export function BookItem({
  book, isActive, depth, showDragHandle,
  readingProgress, isRenaming, onClick, onDoubleClick, onContextMenu,
  renameInput,
}: {
  book: EbookInfo;
  isActive: boolean;
  depth: number;
  showDragHandle: boolean;
  readingProgress: Record<string, ReadingProgress>;
  isRenaming: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  renameInput?: React.ReactNode;
}) {
  const badge = FORMAT_COLORS[book.format] || { bg: '#f1f5f9', text: '#475569' };
  const progress = readingProgress[book.filename];

  const itemContent = (
    <div
      onClick={() => !isRenaming && onClick()}
      onDoubleClick={() => !isRenaming && onDoubleClick()}
      onContextMenu={onContextMenu}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
        background: isActive ? '#eff6ff' : 'transparent',
        paddingLeft: `${depth * 16 + 6}px`,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* 封面 / 格式色块 */}
      <div style={{ position: 'relative', flexShrink: 0, marginTop: 1 }}>
        {book.cover_image ? (
          <div style={{ width: 24, height: 32, borderRadius: 2, overflow: 'hidden' }}>
            <img src={book.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{
            width: 24, height: 32, borderRadius: 2,
            background: badge.bg, color: badge.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          }}>
            {book.format}
          </div>
        )}
        {book.starred && (
          <Star size={10} style={{ position: 'absolute', top: -4, right: -4, color: '#eab308', fill: '#eab308' }} />
        )}
      </div>

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isRenaming ? (
          renameInput
        ) : (
          <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
            {bookTitle(book)}
          </p>
        )}
        {!isRenaming && book.author && (
          <p style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {book.author}
          </p>
        )}
        {!isRenaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {progress?.progressPercent && progress.progressPercent > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 40, height: 2, borderRadius: 1, background: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ width: `${progress.progressPercent}%`, height: '100%', background: '#3b82f6', borderRadius: 1 }} />
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{progress.progressPercent}%</span>
              </div>
            )}
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatFileSize(book.size_bytes)}</span>
          </div>
        )}
      </div>
    </div>
  );

  if (showDragHandle) {
    return <SortableItem key={book.filename} id={book.filename} showHandle>{itemContent}</SortableItem>;
  }
  return <div key={book.filename}>{itemContent}</div>;
}
