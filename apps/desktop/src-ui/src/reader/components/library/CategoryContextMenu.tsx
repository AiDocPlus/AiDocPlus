// ── 分类右键菜单 ──

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import type { EbookCategory } from '../../useReaderStore';
import { S } from '../../styles';
import { Plus, FolderPlus, Pencil, ArrowRightLeft, ChevronRight, Trash2, Folder, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';

type CtxType = 'category' | 'uncategorized' | 'empty';

export function CategoryContextMenu({
  type, x, y, data, categories,
  onClose, onImport, onCreateSubcategory, onRename, onMoveCategory, onDelete,
  onExpandAll, onCollapseAll, onCreateRootCategory,
}: {
  type: CtxType;
  x: number; y: number;
  data: EbookCategory | null;
  categories: EbookCategory[];
  onClose: () => void;
  onImport: (categoryId: string | null) => void;
  onCreateSubcategory: (parentId: string) => void;
  onRename: (cat: EbookCategory) => void;
  onMoveCategory: (id: string, newParentId: string | null) => void;
  onDelete: (cat: EbookCategory) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onCreateRootCategory: () => void;
}) {
  const { t } = useTranslation();
  const [submenu, setSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      if (rect.right > window.innerWidth) menuRef.current.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
      if (rect.bottom > window.innerHeight) menuRef.current.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
      menuRef.current.focus();
    }
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const renderMoveSubmenu = (cat: EbookCategory) => {
    const descIds = descendantIds(categories, cat.id);
    const moveTargets = categories.filter(c => c.id !== cat.id && !descIds.includes(c.id));
    if (cat.parent_id === null && moveTargets.length === 0) return null;

    return (
      <div style={{ position: 'relative' }}>
        <button
          style={S.ctxMenuItem()}
          onMouseEnter={() => setSubmenu('moveCategory')}
          onClick={() => setSubmenu(submenu === 'moveCategory' ? null : 'moveCategory')}
        >
          <ArrowRightLeft size={14} />{t('reader.moveCategoryTo', { defaultValue: '移动分类到' })}
          <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
        </button>
        {submenu === 'moveCategory' && (
          <div style={{ ...S.ctxMenu, left: '100%', top: 0, marginLeft: 2, minWidth: '8rem' }} onMouseLeave={() => setSubmenu(null)}>
            {cat.parent_id !== null && (
              <button style={S.ctxMenuItem()} onClick={() => { onClose(); onMoveCategory(cat.id, null); }}>
                <Folder size={14} style={{ color: '#64748b' }} />
                {t('reader.rootLevel', { defaultValue: '根级别' })}
              </button>
            )}
            {moveTargets.map(c => (
              <button key={c.id} style={S.ctxMenuItem()} onClick={() => { onClose(); onMoveCategory(cat.id, c.id); }}>{c.name}</button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      <div ref={menuRef} tabIndex={-1} style={{ ...S.ctxMenu, left: x, top: y }} onMouseLeave={() => setSubmenu(null)}>
        {type === 'category' && data && (
          <>
            <button style={S.ctxMenuItem()} onClick={() => { onClose(); onImport(data.id); }}>
              <Plus size={14} />{t('reader.importToCategory', { defaultValue: '导入到此分类' })}
            </button>
            <button style={S.ctxMenuItem()} onClick={() => { onClose(); onCreateSubcategory(data.id); }}>
              <FolderPlus size={14} />{t('reader.createSubcategory', { defaultValue: '新建子分类' })}
            </button>
            <button style={S.ctxMenuItem()} onClick={() => { onClose(); onRename(data); }}>
              <Pencil size={14} />{t('reader.rename', { defaultValue: '重命名' })}
            </button>
            {renderMoveSubmenu(data)}
            <div style={S.ctxMenuSep} />
            <button style={S.ctxMenuItem(true)} onClick={() => { onClose(); onDelete(data); }}>
              <Trash2 size={14} />{t('reader.delete', { defaultValue: '删除' })}
            </button>
          </>
        )}

        {type === 'uncategorized' && (
          <>
            <button style={S.ctxMenuItem()} onClick={() => { onClose(); onImport(null); }}>
              <Plus size={14} />{t('reader.importToUncategorized', { defaultValue: '导入到未分类' })}
            </button>
            <div style={S.ctxMenuSep} />
            <button style={S.ctxMenuItem()} onClick={() => { onClose(); onExpandAll(); }}>
              <ChevronsUpDown size={14} />{t('reader.expandAllCategories', { defaultValue: '展开全部分类' })}
            </button>
            <button style={S.ctxMenuItem()} onClick={() => { onClose(); onCollapseAll(); }}>
              <ChevronsDownUp size={14} />{t('reader.collapseAllCategories', { defaultValue: '折叠全部分类' })}
            </button>
          </>
        )}

        {type === 'empty' && (
          <>
            <button style={S.ctxMenuItem()} onClick={() => { onClose(); onImport(null); }}>
              <Plus size={14} />{t('reader.importFile', { defaultValue: '导入文件' })}
            </button>
            <button style={S.ctxMenuItem()} onClick={() => { onClose(); onCreateRootCategory(); }}>
              <FolderPlus size={14} />{t('reader.createCategory', { defaultValue: '新建分类' })}
            </button>
          </>
        )}
      </div>
    </>
  );
}

function descendantIds(categories: EbookCategory[], id: string): string[] {
  const result: string[] = [id];
  let i = 0;
  while (i < result.length) {
    for (const c of categories) {
      if (c.parent_id === result[i] && !result.includes(c.id)) result.push(c.id);
    }
    i++;
  }
  return result;
}
