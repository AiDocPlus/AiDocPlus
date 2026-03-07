import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Button, Input,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../_framework/ui';
import { Trash2, Search, Archive, Pencil, Download, Upload, Paperclip } from 'lucide-react';
import { useEmailContext } from '../EmailContext';
import type { EmailDraft, EmailAccount, EmailStorageData } from '../types';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

interface DraftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadDraft: (draft: EmailDraft) => void;
  onDeleteDraft: (id: string) => void;
  onRenameDraft: (id: string, newName: string) => void;
  currentDraftId: string | null;
  accounts: EmailAccount[];
}

type SortKey = 'updatedAt_desc' | 'updatedAt_asc' | 'name_asc' | 'name_desc' | 'createdAt_desc';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (isToday) return hm;
  if (isYesterday) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function formatFullTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DraftsDialog({ open, onOpenChange, onLoadDraft, onDeleteDraft, onRenameDraft, currentDraftId, accounts }: DraftsDialogProps) {
  const { state, showStatus, t, host } = useEmailContext();
  const { drafts } = state;

  // ── 状态 ──
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt_desc');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // 打开对话框时自动选中当前编辑的草稿
  useEffect(() => {
    if (open && currentDraftId) {
      setPreviewId(currentDraftId);
    }
    if (!open) {
      setSearchText('');
      setSelectedIds(new Set());
      setPreviewId(null);
      setRenamingId(null);
      setConfirmDeleteId(null);
      setConfirmBatchOpen(false);
      setConfirmClearOpen(false);
    }
  }, [open, currentDraftId]);

  // 重命名 Input 聚焦
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // ── 搜索 + 排序 ──
  const filtered = useMemo(() => {
    let list = drafts;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.recipients.toLowerCase().includes(q) ||
        d.subject.toLowerCase().includes(q) ||
        d.emailBody.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sortKey) {
      case 'updatedAt_desc': sorted.sort((a, b) => b.updatedAt - a.updatedAt); break;
      case 'updatedAt_asc': sorted.sort((a, b) => a.updatedAt - b.updatedAt); break;
      case 'name_asc': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name_desc': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'createdAt_desc': sorted.sort((a, b) => b.createdAt - a.createdAt); break;
    }
    return sorted;
  }, [drafts, searchText, sortKey]);

  const previewDraft = useMemo(() => previewId ? drafts.find(d => d.id === previewId) : null, [previewId, drafts]);

  // ── 全选逻辑 ──
  const allVisibleSelected = filtered.length > 0 && filtered.every(d => selectedIds.has(d.id));
  const someVisibleSelected = filtered.some(d => selectedIds.has(d.id));

  const handleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(d => d.id)));
    }
  }, [allVisibleSelected, filtered]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── 重命名 ──
  const handleRenameConfirm = useCallback(() => {
    if (renamingId && renamingName.trim()) {
      onRenameDraft(renamingId, renamingName.trim());
    }
    setRenamingId(null);
  }, [renamingId, renamingName, onRenameDraft]);

  // ── 批量删除 ──
  const handleBatchDelete = useCallback(() => {
    selectedIds.forEach(id => onDeleteDraft(id));
    setSelectedIds(new Set());
    setConfirmBatchOpen(false);
    if (previewId && selectedIds.has(previewId)) setPreviewId(null);
  }, [selectedIds, onDeleteDraft, previewId]);

  // ── 清空所有 ──
  const handleClearAll = useCallback(() => {
    drafts.forEach(d => onDeleteDraft(d.id));
    setSelectedIds(new Set());
    setPreviewId(null);
    setConfirmClearOpen(false);
  }, [drafts, onDeleteDraft]);

  // ── 导出 ──
  const handleExport = useCallback(() => {
    const json = JSON.stringify(drafts, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-drafts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus(t('draftExported'));
  }, [drafts, showStatus, t]);

  // ── 导入 ──
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as EmailDraft[];
        if (!Array.isArray(imported)) throw new Error('Invalid');
        const existingIds = new Set(drafts.map(d => d.id));
        const newDrafts = imported.filter(d => d.id && d.name && !existingIds.has(d.id));
        if (newDrafts.length > 0) {
          const merged = [...newDrafts, ...drafts];
          const current = host.storage.get<EmailStorageData>('emailData') || {};
          host.storage.set('emailData', { ...current, drafts: merged });
        }
        showStatus(t('draftImported', { count: newDrafts.length }));
      } catch {
        showStatus(t('importFailed'), true);
      }
    };
    input.click();
  }, [drafts, showStatus, t, host.storage]);

  // ── 键盘导航 ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = filtered.findIndex(d => d.id === previewId);
      const next = e.key === 'ArrowDown' ? Math.min(idx + 1, filtered.length - 1) : Math.max(idx - 1, 0);
      if (filtered[next]) setPreviewId(filtered[next].id);
    }
  }, [filtered, previewId]);

  const acct = previewDraft ? accounts.find(a => a.id === previewDraft.accountId) : null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] w-[900px] h-[85vh] overflow-hidden flex flex-col p-0" style={DIALOG_STYLE}>
        {/* 顶部标题栏 */}
        <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">{t('draftManageTitle')}</DialogTitle>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleExport}
                disabled={drafts.length === 0}>
                <Download className="h-3 w-3" />
                {t('draftExport')}
              </Button>
              <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleImport}>
                <Upload className="h-3 w-3" />
                {t('draftImport')}
              </Button>
            </div>
          </div>
          <DialogDescription>{t('draftManageDesc', { count: drafts.length })}</DialogDescription>
        </DialogHeader>

        {/* 双栏主体 */}
        <div className="flex flex-1 min-h-0 border-t" onKeyDown={handleKeyDown} tabIndex={-1}>
          {/* ── 左栏：草稿列表 ── */}
          <div className="w-[310px] flex-shrink-0 border-r flex flex-col bg-muted/20">
            {/* 搜索 + 排序 */}
            <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input placeholder={t('draftSearchPlaceholder')} value={searchText}
                  onChange={e => { setSearchText(e.target.value); setPreviewId(null); }}
                  className="h-8 text-sm pl-8" />
              </div>
              <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-8 text-xs w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt_desc">{t('draftSortTimeDesc')}</SelectItem>
                  <SelectItem value="updatedAt_asc">{t('draftSortTimeAsc')}</SelectItem>
                  <SelectItem value="name_asc">{t('draftSortNameAsc')}</SelectItem>
                  <SelectItem value="name_desc">{t('draftSortNameDesc')}</SelectItem>
                  <SelectItem value="createdAt_desc">{t('draftSortCreated')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 全选表头 */}
            {filtered.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0 bg-muted/30 text-[11px] text-muted-foreground font-medium">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                  onChange={handleSelectAll}
                  title={t('selectAll')}
                  className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0 cursor-pointer"
                />
                <span className="flex-1">{t('draftName')}</span>
                <span className="w-[60px] flex-shrink-0 text-right">{t('draftTime')}</span>
              </div>
            )}

            {/* 草稿列表 */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Archive className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">{drafts.length === 0 ? t('draftEmpty') : t('draftNoMatch')}</p>
                  {drafts.length === 0 && (
                    <p className="text-xs mt-1 opacity-70">{t('draftEmptyHint')}</p>
                  )}
                </div>
              ) : filtered.map(draft => {
                const isActive = previewId === draft.id;
                const isEditing = currentDraftId === draft.id;
                return (
                  <div
                    key={draft.id}
                    className={`flex items-start gap-2 px-3 py-2 cursor-pointer text-sm border-b transition-colors ${
                      isActive ? 'bg-primary/10' : selectedIds.has(draft.id) ? 'bg-primary/5' : 'hover:bg-muted/40'
                    }`}
                    onClick={() => setPreviewId(draft.id)}
                    onDoubleClick={() => onLoadDraft(draft)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(draft.id)}
                      readOnly
                      onClick={(e) => { e.stopPropagation(); handleToggleSelect(draft.id); }}
                      className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0 cursor-pointer mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isEditing && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" title={t('draftEditing')} />
                        )}
                        <span className="font-medium truncate text-sm">{draft.name}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                        <span className="truncate">
                          {draft.recipients ? `→ ${draft.recipients}` : t('draftNoRecipients')}
                        </span>
                        {draft.attachments?.length > 0 && (
                          <span className="flex items-center gap-0.5 flex-shrink-0 text-muted-foreground/70">
                            <Paperclip className="h-2.5 w-2.5" />
                            {draft.attachments.length}
                          </span>
                        )}
                        {draft.emailFormat === 'plaintext' && (
                          <span className="flex-shrink-0 text-muted-foreground/70">{t('draftPlaintext')}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0 mt-0.5">
                      {formatTime(draft.updatedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 右栏：预览 ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {previewDraft ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {/* 草稿标题 */}
                <div className="flex items-center gap-2">
                  {renamingId === previewDraft.id ? (
                    <Input
                      ref={renameInputRef}
                      value={renamingName}
                      onChange={e => setRenamingName(e.target.value)}
                      onBlur={handleRenameConfirm}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingId(null); }}
                      className="h-8 text-base font-semibold flex-1"
                    />
                  ) : (
                    <>
                      <h3 className="text-base font-semibold truncate flex-1">{previewDraft.name}</h3>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => { setRenamingId(previewDraft.id); setRenamingName(previewDraft.name); }}
                        title={t('draftRenameBtn')}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>

                {/* 元信息网格 */}
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs border rounded-md p-3 bg-muted/30">
                  {acct && (
                    <><span className="text-muted-foreground">{t('draftFrom')}</span><span className="font-mono truncate">{acct.email}</span></>
                  )}
                  <span className="text-muted-foreground">{t('to')}</span>
                  <span className="font-mono truncate">{previewDraft.recipients || '-'}</span>
                  {previewDraft.cc && (
                    <><span className="text-muted-foreground">CC</span><span className="font-mono truncate">{previewDraft.cc}</span></>
                  )}
                  {previewDraft.bcc && (
                    <><span className="text-muted-foreground">BCC</span><span className="font-mono truncate">{previewDraft.bcc}</span></>
                  )}
                  <span className="text-muted-foreground">{t('draftSubjectLabel')}</span>
                  <span className="font-medium truncate">{previewDraft.subject || '-'}</span>
                  {previewDraft.attachments?.length > 0 && (
                    <><span className="text-muted-foreground">{t('draftAttachments', { count: previewDraft.attachments.length })}</span>
                    <span className="truncate">{previewDraft.attachments.map(a => a.filename).join(', ')}</span></>
                  )}
                  <span className="text-muted-foreground">{t('draftFormat')}</span>
                  <span>{previewDraft.emailFormat === 'html' ? 'HTML' : t('draftPlaintext')} · {t('draftCharCount', { count: previewDraft.emailBody.length })}</span>
                  <span className="text-muted-foreground">{t('draftCreatedAt')}</span>
                  <span>{formatFullTime(previewDraft.createdAt)}</span>
                  <span className="text-muted-foreground">{t('draftUpdatedAt')}</span>
                  <span>{formatFullTime(previewDraft.updatedAt)}</span>
                </div>

                {/* 正文预览 */}
                {previewDraft.emailBody && (
                  <div className="border rounded bg-background p-3 max-h-[250px] overflow-y-auto">
                    {previewDraft.emailFormat === 'html' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs"
                        dangerouslySetInnerHTML={{ __html: previewDraft.emailBody }} />
                    ) : (
                      <pre className="text-xs whitespace-pre-wrap break-words font-mono">{previewDraft.emailBody}</pre>
                    )}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => onLoadDraft(previewDraft)}>
                    {t('draftLoadBtn')}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => { setRenamingId(previewDraft.id); setRenamingName(previewDraft.name); }}>
                    <Pencil className="h-3 w-3" />
                    {t('draftRenameBtn')}
                  </Button>
                  <div className="flex-1" />
                  {confirmDeleteId === previewDraft.id ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-destructive">{t('draftDeleteConfirm')}</span>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                        onClick={() => setConfirmDeleteId(null)}>
                        {t('cancel')}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                          onDeleteDraft(previewDraft.id);
                          setConfirmDeleteId(null);
                          setPreviewId(null);
                        }}>
                        {t('draftDeleteConfirmYes')}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setConfirmDeleteId(previewDraft.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Archive className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">{t('draftSelectToPreview')}</p>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0 bg-muted/10">
          <span className="text-xs text-muted-foreground">
            {selectedIds.size > 0
              ? t('draftSelectedCount', { count: selectedIds.size })
              : t('draftManageDesc', { count: drafts.length })}
          </span>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
                onClick={() => setConfirmBatchOpen(true)}>
                <Trash2 className="h-3 w-3" />
                {t('draftBatchDeleteTitle')}
              </Button>
            )}
            {drafts.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmClearOpen(true)}>
                {t('draftClearAll')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* 批量删除确认 */}
    <Dialog open={confirmBatchOpen} onOpenChange={setConfirmBatchOpen}>
      <DialogContent className="sm:max-w-[400px]" style={DIALOG_STYLE}>
        <DialogHeader>
          <DialogTitle>{t('draftBatchDeleteTitle')}</DialogTitle>
          <DialogDescription>{t('draftBatchDeleteConfirm', { count: selectedIds.size })}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmBatchOpen(false)}>
            {t('cancel')}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={handleBatchDelete}>
            <Trash2 className="h-3 w-3 mr-1" />
            {t('draftDeleteConfirmYes')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* 清空所有确认 */}
    <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
      <DialogContent className="sm:max-w-[400px]" style={DIALOG_STYLE}>
        <DialogHeader>
          <DialogTitle>{t('draftClearAllTitle')}</DialogTitle>
          <DialogDescription>{t('draftClearAllConfirm', { count: drafts.length })}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmClearOpen(false)}>
            {t('cancel')}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={handleClearAll}>
            <Trash2 className="h-3 w-3 mr-1" />
            {t('draftClearAll')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
