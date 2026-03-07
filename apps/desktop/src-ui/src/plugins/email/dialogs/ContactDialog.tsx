import { useState, useCallback, useMemo } from 'react';
import {
  Button, Input, Label, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../_framework/ui';
import { Plus, Trash2, FileUp, FileText, Users, Star, Pencil, FolderOpen, UserPlus, Search } from 'lucide-react';
import { useEmailContext } from '../EmailContext';
import { ContactListSection } from '../ContactListSection';
import { parseCSV, detectEmailColumn, detectNameColumn, getCurrentDateString } from '../utils';
import type { Contact, ContactGroup, EmailStorageData } from '../types';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRecipients: string;
  onUseSelected: (emailStr: string, emails: string[], append: boolean) => void;
  onOpenCsvImport: (headers: string[], data: string[][], emailCol: number, nameCol: number) => void;
}

type SidebarFilter = 'all' | 'starred' | string;

export function ContactDialog({ open, onOpenChange, currentRecipients, onUseSelected, onOpenCsvImport }: ContactDialogProps) {
  const { saveToStorage, showStatus, t, host } = useEmailContext();

  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSearchText, setContactSearchText] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('all');
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [clearContactsDialogOpen, setClearContactsDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleOpenChange = useCallback((v: boolean) => {
    onOpenChange(v);
    if (v) {
      setEditingContact(null);
      const currentEmails = currentRecipients.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const contacts: Contact[] = (host.storage.get<EmailStorageData>('emailData') || {}).contacts || [];
      const ids = new Set(contacts.filter(c => currentEmails.includes(c.email.toLowerCase())).map(c => c.id));
      setSelectedContactIds(ids);
    }
  }, [onOpenChange, currentRecipients, host.storage]);

  const handleCsvFileSelect = useCallback(async () => {
    try {
      const selected = await host.ui.showOpenDialog({
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!selected) return;
      const content = await host.platform.invoke<string>('read_text_file', { path: selected });
      const rows = parseCSV(content);
      if (rows.length < 2) {
        showStatus(t('csvEmptyOrNoData'), true);
        return;
      }
      const headers = rows[0];
      const data = rows.slice(1);
      onOpenCsvImport(headers, data, detectEmailColumn(headers), detectNameColumn(headers));
    } catch (err) {
      showStatus(t('csvReadFailed') + ': ' + (err instanceof Error ? err.message : String(err)), true);
    }
  }, [host, showStatus, t, onOpenCsvImport]);

  const handleExportContacts = useCallback(async () => {
    const current = host.storage.get<EmailStorageData>('emailData') || {};
    const contactList = current.contacts || [];
    if (contactList.length === 0) { showStatus(t('noContactsToExport'), true); return; }

    const extraKeys = new Set<string>();
    contactList.forEach(c => { if (c.extraFields) Object.keys(c.extraFields).forEach(k => extraKeys.add(k)); });
    const extraKeysArr = Array.from(extraKeys);

    const headers = ['name', 'email', 'note', 'group', ...extraKeysArr];
    const escape = (s: string) => {
      if (!s) return '';
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = contactList.map(c => [
      escape(c.name || ''), escape(c.email), escape(c.note || ''), escape(c.groupId || ''),
      ...extraKeysArr.map(k => escape(c.extraFields?.[k] || '')),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    try {
      const savePath = await host.ui.showSaveDialog({
        defaultName: `contacts_${getCurrentDateString()}.csv`,
        extensions: ['csv'],
      });
      if (!savePath) return;
      await host.platform.invoke('write_text_file', { path: savePath, content: '\uFEFF' + csv });
      showStatus(t('exportContactsSuccess', { count: contactList.length }));
    } catch (err) {
      showStatus(t('exportContactsFailed') + ': ' + (err instanceof Error ? err.message : String(err)), true);
    }
  }, [host, showStatus, t]);

  const stored = host.storage.get<EmailStorageData>('emailData') || {};
  const allContacts: Contact[] = stored.contacts || [];
  const groups: ContactGroup[] = stored.contactGroups || [];

  // 侧边栏计数
  const starredCount = useMemo(() => allContacts.filter(c => c.starred).length, [allContacts]);
  const groupCounts = useMemo(() => {
    const map: Record<string, number> = {};
    groups.forEach(g => { map[g.id] = 0; });
    allContacts.forEach(c => { if (c.groupId && map[c.groupId] !== undefined) map[c.groupId]++; });
    return map;
  }, [allContacts, groups]);

  // 保存联系人
  const handleSaveContact = useCallback((contact: Contact) => {
    const contacts = stored.contacts || [];
    const idx = contacts.findIndex(c => c.id === contact.id);
    const withTimestamp = { ...contact, createdAt: contact.createdAt || Date.now() };
    const updated = idx >= 0
      ? contacts.map(c => c.id === contact.id ? withTimestamp : c)
      : [...contacts, withTimestamp];
    saveToStorage({ contacts: updated });
    setEditingContact(null);
    showStatus(t('contactSaved'));
  }, [stored.contacts, saveToStorage, showStatus, t]);

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    if (selectedContactIds.size === 0) return;
    const updated = allContacts.filter(c => !selectedContactIds.has(c.id));
    saveToStorage({ contacts: updated });
    setSelectedContactIds(new Set());
    showStatus(t('contactBatchDeleted', { count: selectedContactIds.size }));
  }, [selectedContactIds, allContacts, saveToStorage, showStatus, t]);

  // 批量移到分组
  const handleBatchMoveGroup = useCallback((groupId: string) => {
    const gid = groupId === '__none__' ? undefined : groupId;
    const updated = allContacts.map(c => selectedContactIds.has(c.id) ? { ...c, groupId: gid } : c);
    saveToStorage({ contacts: updated });
    showStatus(t('contactBatchMoved', { count: selectedContactIds.size }));
  }, [selectedContactIds, allContacts, saveToStorage, showStatus, t]);

  // 保存分组
  const handleSaveGroup = useCallback(() => {
    if (!editingGroup || !editingGroup.name.trim()) return;
    const idx = groups.findIndex(g => g.id === editingGroup.id);
    const updated = idx >= 0
      ? groups.map(g => g.id === editingGroup.id ? editingGroup : g)
      : [...groups, editingGroup];
    saveToStorage({ contactGroups: updated });
    setEditingGroup(null);
    showStatus(t('groupSaved'));
  }, [editingGroup, groups, saveToStorage, showStatus, t]);

  // 删除分组
  const handleDeleteGroup = useCallback(() => {
    if (!editingGroup) return;
    const updated = groups.filter(g => g.id !== editingGroup.id);
    const contacts = allContacts.map(c => c.groupId === editingGroup.id ? { ...c, groupId: undefined } : c);
    saveToStorage({ contactGroups: updated, contacts });
    if (sidebarFilter === editingGroup.id) setSidebarFilter('all');
    setEditingGroup(null);
    showStatus(t('groupDeleted'));
  }, [editingGroup, groups, allContacts, sidebarFilter, saveToStorage, showStatus, t]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[900px] w-[900px] h-[85vh] overflow-hidden flex flex-col p-0" style={DIALOG_STYLE}>
          {/* 顶部标题栏 */}
          <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base">{t('contactManage')}</DialogTitle>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleCsvFileSelect}>
                  <FileUp className="h-3 w-3" />
                  {t('importCsv')}
                </Button>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleExportContacts}>
                  <FileText className="h-3 w-3" />
                  {t('exportContacts')}
                </Button>
              </div>
            </div>
            <DialogDescription>{t('contactManageDesc')}</DialogDescription>
          </DialogHeader>

          {/* 双栏主体 */}
          <div className="flex flex-1 min-h-0 border-t">
            {/* ── 左侧分组侧边栏 ── */}
            <div className="w-[200px] flex-shrink-0 border-r flex flex-col bg-muted/20">
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {/* 全部 */}
                <button
                  onClick={() => setSidebarFilter('all')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    sidebarFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                  }`}
                >
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{t('groupAll')}</span>
                  <span className="text-xs text-muted-foreground">{allContacts.length}</span>
                </button>

                {/* 常用（星标） */}
                <button
                  onClick={() => setSidebarFilter('starred')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    sidebarFilter === 'starred' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                  }`}
                >
                  <Star className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{t('contactStarred')}</span>
                  <span className="text-xs text-muted-foreground">{starredCount}</span>
                </button>

                {/* 分组分隔线 */}
                {groups.length > 0 && (
                  <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('contactGroups')}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {/* 分组列表 */}
                {groups.map(g => (
                  <div key={g.id} className="group flex items-center">
                    <button
                      onClick={() => setSidebarFilter(sidebarFilter === g.id ? 'all' : g.id)}
                      className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        sidebarFilter === g.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0 border" style={{ backgroundColor: g.color || '#6366f1', borderColor: g.color || '#6366f1' }} />
                      <span className="flex-1 text-left truncate">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{groupCounts[g.id] || 0}</span>
                    </button>
                    <button
                      onClick={() => setEditingGroup({ ...g })}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity flex-shrink-0"
                      title={t('edit')}
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}

                {/* 新建分组按钮 */}
                <button
                  onClick={() => setEditingGroup(editingGroup ? null : { id: `grp_${Date.now()}`, name: '', color: '#6366f1' })}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('newGroup')}</span>
                </button>

                {/* 分组编辑行 */}
                {editingGroup && (
                  <div className="p-2 border rounded-md bg-background space-y-2 mx-1">
                    <div className="flex items-center gap-1.5">
                      <input type="color" value={editingGroup.color || '#6366f1'}
                        onChange={e => setEditingGroup({ ...editingGroup, color: e.target.value })}
                        title={t('groupColor')}
                        className="w-6 h-6 rounded border cursor-pointer p-0 flex-shrink-0" />
                      <Input value={editingGroup.name}
                        onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                        placeholder={t('groupNamePlaceholder')} className="h-7 text-xs flex-1"
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveGroup(); }} />
                    </div>
                    <div className="flex gap-1 justify-end">
                      {groups.some(g => g.id === editingGroup.id) && (
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={handleDeleteGroup}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEditingGroup(null)}>
                        {t('cancel')}
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 px-2 text-xs"
                        disabled={!editingGroup.name.trim()}
                        onClick={handleSaveGroup}>
                        {t('save')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* 侧边栏底部统计 */}
              <div className="px-3 py-2 border-t text-[11px] text-muted-foreground space-y-0.5 flex-shrink-0">
                <div>{t('contactTotalCount', { total: allContacts.length })}</div>
                <div>{t('contactGroupCount', { count: groups.length })}</div>
              </div>
            </div>

            {/* ── 右侧主区域 ── */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* 工具栏：搜索 + 排序 + 新建 + 批量操作 */}
              <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0 bg-muted/10">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input placeholder={t('contactSearchPlaceholder')} value={contactSearchText}
                    onChange={e => setContactSearchText(e.target.value)} className="h-8 text-sm pl-8" />
                </div>

                <Select value={`${sortBy}_${sortDir}`} onValueChange={v => {
                  const [field, dir] = v.split('_') as ['name' | 'email' | 'createdAt', 'asc' | 'desc'];
                  setSortBy(field);
                  setSortDir(dir);
                }}>
                  <SelectTrigger className="h-8 text-xs w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name_asc">{t('sortNameAsc')}</SelectItem>
                    <SelectItem value="name_desc">{t('sortNameDesc')}</SelectItem>
                    <SelectItem value="email_asc">{t('sortEmailAsc')}</SelectItem>
                    <SelectItem value="createdAt_desc">{t('sortNewest')}</SelectItem>
                    <SelectItem value="createdAt_asc">{t('sortOldest')}</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1" />

                {/* 批量操作 */}
                {selectedContactIds.size > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">
                      {t('contactSelectedCount', { count: selectedContactIds.size })}
                    </span>
                    {groups.length > 0 && (
                      <Select value="" onValueChange={handleBatchMoveGroup}>
                        <SelectTrigger className="h-7 text-xs w-auto gap-1 px-2">
                          <FolderOpen className="h-3 w-3" />
                          <span>{t('contactBatchMove')}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('noGroup')}</SelectItem>
                          {groups.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
                      onClick={handleBatchDelete}>
                      <Trash2 className="h-3 w-3" />
                      {t('contactBatchDeleteBtn')}
                    </Button>
                  </div>
                )}

                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => setEditingContact({ id: `ct_${Date.now()}`, name: '', email: '', note: '', createdAt: Date.now() })}>
                  <UserPlus className="h-3 w-3" />
                  {t('newContact')}
                </Button>

                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => { if (allContacts.length > 0) setClearContactsDialogOpen(true); }}
                  title={t('clearAllContacts')}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {/* 联系人编辑表单 */}
              {editingContact && (
                <div className="border-b p-4 space-y-3 bg-muted/10 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-1">
                    <UserPlus className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      {(stored.contacts || []).some(c => c.id === editingContact.id) ? t('editContact') : t('newContact')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('contactName')}</Label>
                      <Input value={editingContact.name}
                        onChange={e => { const v = e.target.value; setEditingContact(prev => prev ? { ...prev, name: v } : prev); }}
                        placeholder={t('contactNamePlaceholder')} className="h-8 text-sm" autoFocus />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('contactEmail')} *</Label>
                      <Input value={editingContact.email}
                        onChange={e => { const v = e.target.value; setEditingContact(prev => prev ? { ...prev, email: v } : prev); }}
                        placeholder="user@example.com" className="h-8 text-sm font-mono" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('contactNote')}</Label>
                      <Textarea value={editingContact.note || ''}
                        onChange={e => { const v = e.target.value; setEditingContact(prev => prev ? { ...prev, note: v } : prev); }}
                        placeholder={t('contactNotePlaceholder')} className="text-sm min-h-[120px] resize-y" rows={6} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('contactGroup')}</Label>
                      <Select value={editingContact.groupId || '__none__'} onValueChange={v => setEditingContact(prev => prev ? { ...prev, groupId: v === '__none__' ? undefined : v } : prev)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('noGroup')}</SelectItem>
                          {groups.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingContact(null)}>{t('cancel')}</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs"
                      disabled={!editingContact.email.trim()}
                      onClick={() => handleSaveContact(editingContact)}>
                      {t('save')}
                    </Button>
                  </div>
                </div>
              )}

              {/* 联系人列表 */}
              <ContactListSection
                host={host}
                saveToStorage={saveToStorage}
                showStatus={showStatus}
                selectedContactIds={selectedContactIds}
                setSelectedContactIds={setSelectedContactIds}
                setEditingContact={setEditingContact}
                searchText={contactSearchText}
                groupFilter={sidebarFilter === 'all' ? '' : sidebarFilter === 'starred' ? '__starred__' : sidebarFilter}
                sortBy={sortBy}
                sortDir={sortDir}
                t={t}
              />
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0 bg-muted/10">
            <span className="text-xs text-muted-foreground">
              {selectedContactIds.size > 0
                ? t('contactSelectedCount', { count: selectedContactIds.size })
                : t('contactTotalCount', { total: allContacts.length })}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                disabled={selectedContactIds.size === 0}
                onClick={() => {
                  const contacts: Contact[] = allContacts.filter(c => selectedContactIds.has(c.id));
                  const emailStr = contacts.map(c => c.name ? `${c.name} <${c.email}>` : c.email).join(', ');
                  onUseSelected(emailStr, contacts.map(c => c.email), true);
                  onOpenChange(false);
                }}>
                {t('appendToRecipients')}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                disabled={selectedContactIds.size === 0}
                onClick={() => {
                  const contacts: Contact[] = allContacts.filter(c => selectedContactIds.has(c.id));
                  const emailStr = contacts.map(c => c.name ? `${c.name} <${c.email}>` : c.email).join(', ');
                  onUseSelected(emailStr, contacts.map(c => c.email), false);
                  onOpenChange(false);
                }}>
                <Users className="h-3 w-3" />
                {t('replaceRecipients')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 清除联系人确认对话框 */}
      <Dialog open={clearContactsDialogOpen} onOpenChange={setClearContactsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" style={DIALOG_STYLE}>
          <DialogHeader>
            <DialogTitle>{t('confirmClearContacts')}</DialogTitle>
            <DialogDescription>{t('confirmClearContactsDesc')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setClearContactsDialogOpen(false)}>{t('cancel')}</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => {
              saveToStorage({ contacts: [] });
              setSelectedContactIds(new Set());
              setClearContactsDialogOpen(false);
              showStatus(t('allContactsCleared'));
            }}>
              {t('confirmClearBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
