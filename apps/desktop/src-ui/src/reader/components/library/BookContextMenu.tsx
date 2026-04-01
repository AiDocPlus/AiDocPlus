// ── 书籍右键菜单 ──

import React from 'react';
import { useTranslation } from '@/i18n';
import type { EbookInfo, EbookCategory, ReaderSortField } from '../../useReaderStore';
import { bookTitle, formatFileSize } from './BookPropertiesDialog';
import { S } from '../../styles';
import {
  BookOpen, Star, Pencil, ArrowRightLeft, ArrowUpDown,
  ArrowUp, ArrowDown, GripVertical, Download, Copy,
  FileText, FolderOpen, ChevronRight, Trash2,
  BookMarked, BookCheck, Circle, Check,
} from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

function SortIcon({ field, sortField, sortDirection }: { field: ReaderSortField; sortField: ReaderSortField; sortDirection: 'asc' | 'desc' }) {
  if (sortField !== field) return null;
  return sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

export function BookContextMenu({
  book, x, y, categories, onClose,
  onOpen, onToggleStarred, onRename, onMove, onDelete,
  sortField, sortDirection, onToggleSort,
  onUpdateReadingStatus,
}: {
  book: EbookInfo;
  x: number; y: number;
  categories: EbookCategory[];
  onClose: () => void;
  onOpen: (book: EbookInfo) => void;
  onToggleStarred: (filename: string) => void;
  onRename: (book: EbookInfo) => void;
  onMove: (filename: string, categoryId: string | null) => void;
  onDelete: (book: EbookInfo) => void;
  sortField: ReaderSortField;
  sortDirection: 'asc' | 'desc';
  onToggleSort: (field: ReaderSortField) => void;
  onUpdateReadingStatus?: (filename: string, status: string) => void;
}) {
  const { t } = useTranslation();
  const [submenu, setSubmenu] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const moveTargets = categories.filter(c => c.id !== book.category_id);

  React.useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      if (rect.right > window.innerWidth) menuRef.current.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
      if (rect.bottom > window.innerHeight) menuRef.current.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
      menuRef.current.focus();
    }
  }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleExport = async () => {
    onClose();
    try {
      const ext = book.filename.split('.').pop() || '';
      const filePath = await save({
        defaultPath: bookTitle(book) + '.' + ext,
        filters: [{ name: 'E-books', extensions: ['md', 'html', 'htm', 'docx', 'pdf', 'epub'] }],
      });
      if (filePath) await invoke('export_ebook', { filename: book.filename, destPath: filePath });
    } catch (e) { console.warn('[BookContextMenu] export failed:', e); }
  };

  const getFullPath = async () => {
    const dir = await invoke<string>('get_ebook_library_dir');
    const sep = dir.includes('\\') ? '\\' : '/';
    return dir + (dir.endsWith('/') || dir.endsWith('\\') ? '' : sep) + book.filename;
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      <div
        ref={menuRef}
        tabIndex={-1}
        style={{ ...S.ctxMenu, left: x, top: y }}
        onMouseLeave={() => setSubmenu(null)}
      >
        <button style={S.ctxMenuItem()} onClick={() => { onClose(); onOpen(book); }}>
          <BookOpen size={14} />{t('reader.open', { defaultValue: '打开' })}
        </button>
        <button style={S.ctxMenuItem()} onClick={() => { onClose(); onToggleStarred(book.filename); }}>
          <Star size={14} style={book.starred ? { color: '#eab308', fill: '#eab308' } : {}} />
          {book.starred ? t('reader.unstar', { defaultValue: '取消收藏' }) : t('reader.star', { defaultValue: '收藏' })}
        </button>
        <button style={S.ctxMenuItem()} onClick={() => { onClose(); onRename(book); }}>
          <Pencil size={14} />{t('reader.rename', { defaultValue: '重命名' })}
        </button>

        {/* 阅读状态子菜单 */}
        {onUpdateReadingStatus && (
          <div style={{ position: 'relative' }}>
            <button
              style={S.ctxMenuItem()}
              onMouseEnter={() => setSubmenu('readingStatus')}
              onClick={() => setSubmenu(submenu === 'readingStatus' ? null : 'readingStatus')}
            >
              <BookMarked size={14} />{t('reader.readingStatus', { defaultValue: '阅读状态' })}
              <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
            </button>
            {submenu === 'readingStatus' && (
              <div style={{ ...S.ctxMenu, left: '100%', top: 0, marginLeft: 2, minWidth: '8rem' }} onMouseLeave={() => setSubmenu(null)}>
                {([
                  { value: '', label: t('reader.statusUnset', { defaultValue: '未设置' }), icon: <Circle size={12} /> },
                  { value: 'unread', label: t('reader.statusUnread', { defaultValue: '未读' }), icon: <BookOpen size={12} /> },
                  { value: 'reading', label: t('reader.statusReading', { defaultValue: '在读' }), icon: <BookMarked size={12} /> },
                  { value: 'completed', label: t('reader.statusCompleted', { defaultValue: '已读' }), icon: <BookCheck size={12} /> },
                ] as const).map(opt => (
                  <button key={opt.value} style={S.ctxMenuItem()} onClick={() => { onClose(); onUpdateReadingStatus(book.filename, opt.value); }}>
                    {opt.icon}
                    <span style={{ flex: 1 }}>{opt.label}</span>
                    {book.reading_status === opt.value && <Check size={12} style={{ color: '#2563eb' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 移动到子菜单 */}
        {moveTargets.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              style={S.ctxMenuItem()}
              onMouseEnter={() => setSubmenu('moveBook')}
              onClick={() => setSubmenu(submenu === 'moveBook' ? null : 'moveBook')}
            >
              <ArrowRightLeft size={14} />{t('reader.moveTo', { defaultValue: '移动到' })}
              <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
            </button>
            {submenu === 'moveBook' && (
              <div style={{ ...S.ctxMenu, left: '100%', top: 0, marginLeft: 2, minWidth: '8rem' }} onMouseLeave={() => setSubmenu(null)}>
                {book.category_id !== null && (
                  <button style={S.ctxMenuItem()} onClick={() => { onClose(); onMove(book.filename, null); }}>
                    {t('reader.uncategorized', { defaultValue: '未分类' })}
                  </button>
                )}
                {moveTargets.map(c => (
                  <button key={c.id} style={S.ctxMenuItem()} onClick={() => { onClose(); onMove(book.filename, c.id); }}>{c.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 排序子菜单 */}
        <div style={{ position: 'relative' }}>
          <button
            style={S.ctxMenuItem()}
            onMouseEnter={() => setSubmenu('sort')}
            onClick={() => setSubmenu(submenu === 'sort' ? null : 'sort')}
          >
            <ArrowUpDown size={14} />{t('reader.sort', { defaultValue: '排序' })}
            <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
          </button>
          {submenu === 'sort' && (
            <div style={{ ...S.ctxMenu, left: '100%', top: 0, marginLeft: 2, minWidth: '8rem' }} onMouseLeave={() => setSubmenu(null)}>
              {(['custom', 'name', 'addedAt', 'lastReadAt', 'format', 'size', 'author'] as const).map(field => (
                <button key={field} style={S.ctxMenuItem()} onClick={() => { onClose(); onToggleSort(field); }}>
                  <span style={{ flex: 1 }}>{t(`reader.sort${field.charAt(0).toUpperCase() + field.slice(1)}`, { defaultValue: field })}</span>
                  <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
                  {sortField === field && field === 'custom' && <GripVertical size={12} style={{ marginLeft: 4 }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={S.ctxMenuSep} />
        <button style={S.ctxMenuItem()} onClick={handleExport}>
          <Download size={14} />{t('reader.exportBook', { defaultValue: '导出/另存为' })}
        </button>
        <div style={S.ctxMenuSep} />
        <button style={S.ctxMenuItem()} onClick={() => { onClose(); navigator.clipboard.writeText(bookTitle(book)).catch(() => {}); }}>
          <Copy size={14} />{t('reader.copyTitle', { defaultValue: '复制书名' })}
        </button>
        <button style={S.ctxMenuItem()} onClick={async () => { onClose(); try { const path = await getFullPath(); await navigator.clipboard.writeText(path); } catch {} }}>
          <Copy size={14} />{t('reader.copyFilePath', { defaultValue: '复制文件路径' })}
        </button>
        <button style={S.ctxMenuItem()} onClick={() => {
          onClose();
          const info = `${bookTitle(book)} | ${book.format.toUpperCase()} | ${formatFileSize(book.size_bytes)}`;
          navigator.clipboard.writeText(info).catch(() => {});
        }}>
          <FileText size={14} />{t('reader.copyBookInfo', { defaultValue: '复制书籍信息' })}
        </button>
        <div style={S.ctxMenuSep} />
        <button style={S.ctxMenuItem()} onClick={async () => { onClose(); try { const path = await getFullPath(); await invoke('show_in_folder', { path }); } catch {} }}>
          <FolderOpen size={14} />{t('reader.showInFolder', { defaultValue: '在文件夹中显示' })}
        </button>
        <div style={S.ctxMenuSep} />
        <button style={S.ctxMenuItem(true)} onClick={() => { onClose(); onDelete(book); }}>
          <Trash2 size={14} />{t('reader.delete', { defaultValue: '删除' })}
        </button>
      </div>
    </>
  );
}
