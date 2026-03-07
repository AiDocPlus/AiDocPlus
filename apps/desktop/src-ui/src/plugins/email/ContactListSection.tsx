import { useMemo, useCallback } from 'react';
import { Trash2, Star, Pencil, UserRound } from 'lucide-react';
import { usePluginHost } from '../_framework/PluginHostAPI';
import type { Contact, ContactGroup, EmailStorageData } from './types';

/** 根据名字生成稳定的头像背景色 */
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-amber-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  const str = name || 'U';
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string, email: string): string {
  if (name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    // 中文名：取前两个字
    const chars = [...name.trim()];
    if (chars.length >= 2 && /[\u4e00-\u9fff]/.test(chars[0])) return chars[0] + chars[1];
    return chars[0].toUpperCase();
  }
  return email[0]?.toUpperCase() || 'U';
}

export function ContactListSection({
  host,
  saveToStorage,
  showStatus,
  selectedContactIds,
  setSelectedContactIds,
  setEditingContact,
  searchText,
  groupFilter,
  sortBy,
  sortDir,
  t,
}: {
  host: ReturnType<typeof usePluginHost>;
  saveToStorage: (data: Partial<EmailStorageData>) => void;
  showStatus: (msg: string, isError?: boolean) => void;
  selectedContactIds: Set<string>;
  setSelectedContactIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditingContact: React.Dispatch<React.SetStateAction<Contact | null>>;
  searchText: string;
  groupFilter: string;
  sortBy: 'name' | 'email' | 'createdAt';
  sortDir: 'asc' | 'desc';
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const allContacts: Contact[] = (host.storage.get<EmailStorageData>('emailData') || {}).contacts || [];
  const groups: ContactGroup[] = (host.storage.get<EmailStorageData>('emailData') || {}).contactGroups || [];

  // 过滤 + 排序
  const contacts = useMemo(() => {
    let list = allContacts;

    // 分组/星标过滤
    if (groupFilter === '__starred__') {
      list = list.filter(c => c.starred);
    } else if (groupFilter) {
      list = list.filter(c => c.groupId === groupFilter);
    }

    // 搜索过滤
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        (c.note || '').toLowerCase().includes(query) ||
        (c.extraFields && Object.values(c.extraFields).some(v => v.toLowerCase().includes(query)))
      );
    }

    // 排序
    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '', 'zh-CN');
      } else if (sortBy === 'email') {
        cmp = a.email.localeCompare(b.email);
      } else {
        cmp = (a.createdAt || 0) - (b.createdAt || 0);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return sorted;
  }, [allContacts, groupFilter, searchText, sortBy, sortDir]);

  // 全选/反选
  const allVisibleSelected = contacts.length > 0 && contacts.every(c => selectedContactIds.has(c.id));
  const someVisibleSelected = contacts.some(c => selectedContactIds.has(c.id));

  const handleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      // 取消选中当前可见的
      setSelectedContactIds(prev => {
        const next = new Set(prev);
        contacts.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      // 选中当前可见的
      setSelectedContactIds(prev => {
        const next = new Set(prev);
        contacts.forEach(c => next.add(c.id));
        return next;
      });
    }
  }, [allVisibleSelected, contacts, setSelectedContactIds]);

  // 切换星标（乐观更新：直接修改内存数据，异步写入存储）
  const handleToggleStar = useCallback((contactId: string) => {
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    const contacts = current.contacts || [];
    const idx = contacts.findIndex(c => c.id === contactId);
    if (idx < 0) return;
    const updated = [...contacts];
    updated[idx] = { ...updated[idx], starred: !updated[idx].starred };
    // 立即写入内存，UI 即时响应
    host.storage.set('emailData', { ...current, contacts: updated });
  }, [host.storage]);

  // 删除单个联系人
  const handleDeleteContact = useCallback((contactId: string) => {
    const updated = allContacts.filter(c => c.id !== contactId);
    saveToStorage({ contacts: updated });
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      next.delete(contactId);
      return next;
    });
    showStatus(t('contactDeleted'));
  }, [allContacts, saveToStorage, setSelectedContactIds, showStatus, t]);

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* 列表头：全选 + 列标题 */}
      {contacts.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-1.5 border-b flex-shrink-0 bg-muted/20 text-[11px] text-muted-foreground font-medium">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
            onChange={handleSelectAll}
            className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0 cursor-pointer"
          />
          <span className="w-8 flex-shrink-0" />
          <span className="flex-1">{t('contactName')}</span>
          <span className="w-[200px] flex-shrink-0">{t('contactEmail')}</span>
          <span className="w-[70px] flex-shrink-0 text-center">{t('contactGroup')}</span>
          <span className="w-[80px] flex-shrink-0" />
        </div>
      )}

      {/* 联系人列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {contacts.length > 0 ? (
          contacts.map(c => {
            const grp = c.groupId ? groups.find(g => g.id === c.groupId) : undefined;
            const initials = getInitials(c.name, c.email);
            const avatarColor = getAvatarColor(c.name || c.email);

            return (
              <div
                key={c.id}
                className={`group flex items-start gap-3 px-4 py-2.5 cursor-pointer text-sm border-b transition-colors ${
                  selectedContactIds.has(c.id)
                    ? 'bg-primary/5'
                    : 'hover:bg-muted/40'
                }`}
                onClick={() => {
                  setSelectedContactIds(prev => {
                    const next = new Set(prev);
                    next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                    return next;
                  });
                }}
              >
                {/* 复选框 */}
                <input
                  type="checkbox"
                  checked={selectedContactIds.has(c.id)}
                  readOnly
                  className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0 pointer-events-none mt-1"
                />

                {/* 头像 */}
                <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-medium flex-shrink-0 select-none mt-0.5`}>
                  {initials}
                </div>

                {/* 姓名 + 备注 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{c.name || t('contactUnnamed')}</span>
                  </div>
                  {c.note && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-line break-words">
                      {c.note}
                    </div>
                  )}
                </div>

                {/* 邮箱 */}
                <span className="w-[200px] flex-shrink-0 text-xs text-muted-foreground font-mono truncate">{c.email}</span>

                {/* 分组标签 */}
                <div className="w-[70px] flex-shrink-0 flex justify-center">
                  {grp ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border truncate max-w-full"
                      style={grp.color ? { borderColor: grp.color, color: grp.color, backgroundColor: grp.color + '15' } : {}}>
                      {grp.name}
                    </span>
                  ) : null}
                </div>

                {/* 操作按钮 */}
                <div className="w-[80px] flex-shrink-0 flex items-center justify-end gap-0.5">
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleStar(c.id); }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    title={c.starred ? t('contactUnstar') : t('contactStar')}
                  >
                    <Star className={`h-3.5 w-3.5 ${c.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40 group-hover:text-muted-foreground'}`} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingContact({ ...c }); }}
                    className="p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                    title={t('edit')}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteContact(c.id); }}
                    className="p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                    title={t('delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <UserRound className="h-12 w-12 mb-3 text-muted-foreground/30" />
            {searchText.trim() ? (
              <p className="text-sm">{t('noContactsFound')}</p>
            ) : groupFilter === '__starred__' ? (
              <>
                <p className="text-sm">{t('noStarredContacts')}</p>
                <p className="text-xs mt-1">{t('noStarredContactsHint')}</p>
              </>
            ) : groupFilter ? (
              <p className="text-sm">{t('noContactsInGroup')}</p>
            ) : (
              <>
                <p className="text-sm font-medium">{t('noContactsYet')}</p>
                <p className="text-xs mt-1">{t('noContactsYetHint')}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
