import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tabs, TabsList, TabsTrigger,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../_framework/ui';
import {
  Search, Plus, Trash2, Pencil, Copy, Download, Upload,
  FileText, Lock, Archive,
} from 'lucide-react';
import { useEmailContext } from '../EmailContext';
import { getPresetVariables, getPresetSnippets, replaceVariables, getCurrentDateString } from '../utils';
import type { EmailStorageData, SubmissionTemplate, TextSnippet, VariableDef } from '../types';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

type TemplateSortKey = 'updatedAt_desc' | 'updatedAt_asc' | 'name_asc' | 'name_desc' | 'lastUsed' | 'useCount';
type SnippetSortKey = 'name_asc' | 'name_desc';
type ActiveTab = 'templates' | 'snippets';

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyTemplate: (tpl: SubmissionTemplate) => void;
  onInsertSnippet: (content: string) => void;
  docTitle: string;
  docContent: string;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diff = now.getTime() - ts;
  if (diff < 86400000 * 2) return '昨天';
  return d.toLocaleDateString();
}
function formatFullTime(ts: number) {
  return new Date(ts).toLocaleString();
}

export function TemplateDialog({ open, onOpenChange, onApplyTemplate, onInsertSnippet, docTitle, docContent }: TemplateDialogProps) {
  const { saveToStorage, showStatus, t, host } = useEmailContext();

  // ── Tab + 搜索 + 排序 ──
  const [activeTab, setActiveTab] = useState<ActiveTab>('templates');
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<TemplateSortKey>('updatedAt_desc');
  const [snippetSortKey, setSnippetSortKey] = useState<SnippetSortKey>('name_asc');
  const [snippetCategoryFilter, setSnippetCategoryFilter] = useState('all');

  // ── 预览 + 选择 ──
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── 编辑 ──
  const [editingTemplate, setEditingTemplate] = useState<SubmissionTemplate | null>(null);
  const [editingSnippet, setEditingSnippet] = useState<TextSnippet | null>(null);

  // ── 确认弹窗 ──
  const [confirmApplyTpl, setConfirmApplyTpl] = useState<SubmissionTemplate | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  // ── 数据读取 ──
  const stored = host.storage.get<EmailStorageData>('emailData') || {};
  const templates: SubmissionTemplate[] = stored.submissionTemplates || [];
  const userSnippets: TextSnippet[] = stored.textSnippets || [];
  const presetSnippets = useMemo(() => getPresetSnippets(t), [t]);
  const allSnippets = useMemo(() => [...presetSnippets, ...userSnippets], [presetSnippets, userSnippets]);
  const presetVars = useMemo(() => getPresetVariables(t), [t]);

  // ── Dialog open/close ──
  const handleOpenChange = useCallback((v: boolean) => {
    onOpenChange(v);
    if (v) {
      setSearchText('');
      setPreviewId(null);
      setSelectedIds(new Set());
      setEditingTemplate(null);
      setEditingSnippet(null);
      setConfirmApplyTpl(null);
      setConfirmDeleteId(null);
    }
  }, [onOpenChange]);

  // ── 变量替换上下文 ──
  const varContext = useMemo(() => ({
    title: docTitle, content: docContent, date: getCurrentDateString(),
  }), [docTitle, docContent]);

  // ══════════════════════════════════════
  // ── 模板 Tab 逻辑 ──
  // ══════════════════════════════════════

  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.recipients.join(', ').toLowerCase().includes(q) ||
        t.subjectTemplate.toLowerCase().includes(q) ||
        t.bodyTemplate.toLowerCase().includes(q)
      );
    }
    const [field, dir] = sortKey.split('_') as [string, string | undefined];
    list = [...list].sort((a, b) => {
      if (sortKey === 'lastUsed') return (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
      if (sortKey === 'useCount') return (b.useCount || 0) - (a.useCount || 0);
      if (field === 'name') {
        const cmp = a.name.localeCompare(b.name, 'zh');
        return dir === 'desc' ? -cmp : cmp;
      }
      // updatedAt
      const cmp = a.updatedAt - b.updatedAt;
      return dir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [templates, searchText, sortKey]);

  const previewTemplate = useMemo(() => {
    if (activeTab !== 'templates' || !previewId) return null;
    return templates.find(t => t.id === previewId) || null;
  }, [activeTab, previewId, templates]);

  // 模板 CRUD
  const handleSaveTemplate = useCallback(() => {
    if (!editingTemplate || !editingTemplate.name.trim()) {
      showStatus(t('pleaseEnterTemplateName'), true);
      return;
    }
    const exists = templates.find(x => x.id === editingTemplate.id);
    const updated = exists
      ? templates.map(x => x.id === editingTemplate.id ? { ...editingTemplate, updatedAt: Date.now() } : x)
      : [...templates, editingTemplate];
    saveToStorage({ submissionTemplates: updated });
    setEditingTemplate(null);
    setPreviewId(editingTemplate.id);
    showStatus(t('templateSaved'));
  }, [editingTemplate, templates, saveToStorage, showStatus, t]);

  const handleDeleteTemplate = useCallback((id: string) => {
    const updated = templates.filter(x => x.id !== id);
    saveToStorage({ submissionTemplates: updated });
    if (previewId === id) setPreviewId(null);
    if (editingTemplate?.id === id) setEditingTemplate(null);
    setConfirmDeleteId(null);
    showStatus(t('templateDeleted'));
  }, [templates, previewId, editingTemplate, saveToStorage, showStatus, t]);

  const handleDuplicateTemplate = useCallback((tpl: SubmissionTemplate) => {
    const clone: SubmissionTemplate = {
      ...tpl,
      id: `tpl_${Date.now()}`,
      name: tpl.name + ' (copy)',
      lastUsedAt: undefined,
      useCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveToStorage({ submissionTemplates: [...templates, clone] });
    setPreviewId(clone.id);
    showStatus(t('tplDuplicated'));
  }, [templates, saveToStorage, showStatus, t]);

  const handleNewTemplate = useCallback(() => {
    setEditingSnippet(null);
    setEditingTemplate({
      id: `tpl_${Date.now()}`,
      name: '',
      recipients: [],
      subjectTemplate: '',
      bodyTemplate: '',
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }, []);

  // ══════════════════════════════════════
  // ── 片段 Tab 逻辑 ──
  // ══════════════════════════════════════

  const snippetCategories = useMemo(() => {
    const cats = new Set<string>();
    allSnippets.forEach(s => { if (s.category) cats.add(s.category); });
    return Array.from(cats);
  }, [allSnippets]);

  const filteredSnippets = useMemo(() => {
    let list = allSnippets;
    if (snippetCategoryFilter !== 'all') {
      list = list.filter(s => s.category === snippetCategoryFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'zh');
      return snippetSortKey === 'name_desc' ? -cmp : cmp;
    });
    return list;
  }, [allSnippets, snippetCategoryFilter, searchText, snippetSortKey]);

  const previewSnippet = useMemo(() => {
    if (activeTab !== 'snippets' || !previewId) return null;
    return allSnippets.find(s => s.id === previewId) || null;
  }, [activeTab, previewId, allSnippets]);

  const isPresetSnippet = useCallback((id: string) => {
    return presetSnippets.some(p => p.id === id);
  }, [presetSnippets]);

  const handleSaveSnippet = useCallback(() => {
    if (!editingSnippet || !editingSnippet.name.trim()) {
      showStatus(t('pleaseEnterName'), true);
      return;
    }
    const exists = userSnippets.find(s => s.id === editingSnippet.id);
    const updated = exists
      ? userSnippets.map(s => s.id === editingSnippet.id ? editingSnippet : s)
      : [...userSnippets, editingSnippet];
    saveToStorage({ textSnippets: updated });
    setEditingSnippet(null);
    setPreviewId(editingSnippet.id);
    showStatus(t('snippetSaved'));
  }, [editingSnippet, userSnippets, saveToStorage, showStatus, t]);

  const handleDeleteSnippet = useCallback((id: string) => {
    if (isPresetSnippet(id)) { showStatus(t('cannotDeletePreset'), true); return; }
    const updated = userSnippets.filter(s => s.id !== id);
    saveToStorage({ textSnippets: updated });
    if (previewId === id) setPreviewId(null);
    if (editingSnippet?.id === id) setEditingSnippet(null);
    setConfirmDeleteId(null);
    showStatus(t('snippetDeleted'));
  }, [userSnippets, previewId, editingSnippet, isPresetSnippet, saveToStorage, showStatus, t]);

  const handleNewSnippet = useCallback(() => {
    setEditingTemplate(null);
    setEditingSnippet({
      id: `snippet_${Date.now()}`,
      name: '',
      content: '',
      category: '',
    });
  }, []);

  // ══════════════════════════════════════
  // ── 共享操作 ──
  // ══════════════════════════════════════

  // 全选/反选
  const currentList = activeTab === 'templates' ? filteredTemplates : filteredSnippets;
  const selectableItems = activeTab === 'snippets'
    ? (filteredSnippets as TextSnippet[]).filter(s => !isPresetSnippet(s.id))
    : currentList;
  const allVisibleSelected = selectableItems.length > 0 && selectableItems.every(item => selectedIds.has(item.id));
  const someVisibleSelected = selectableItems.some(item => selectedIds.has(item.id));

  const handleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableItems.map(item => item.id)));
    }
  }, [allVisibleSelected, selectableItems]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    if (activeTab === 'templates') {
      const updated = templates.filter(t => !selectedIds.has(t.id));
      saveToStorage({ submissionTemplates: updated });
    } else {
      const updated = userSnippets.filter(s => !selectedIds.has(s.id));
      saveToStorage({ textSnippets: updated });
    }
    const count = selectedIds.size;
    setSelectedIds(new Set());
    setPreviewId(null);
    setConfirmBatchOpen(false);
    showStatus(t('templateDeleted') + ` (${count})`);
  }, [activeTab, templates, userSnippets, selectedIds, saveToStorage, showStatus, t]);

  // 清空所有
  const handleClearAll = useCallback(() => {
    if (activeTab === 'templates') {
      saveToStorage({ submissionTemplates: [] });
    } else {
      saveToStorage({ textSnippets: [] });
    }
    setSelectedIds(new Set());
    setPreviewId(null);
    setEditingTemplate(null);
    setEditingSnippet(null);
    setConfirmClearOpen(false);
    showStatus(t('templateDeleted'));
  }, [activeTab, saveToStorage, showStatus, t]);

  // 导出
  const handleExport = useCallback(async () => {
    const data = {
      version: 1,
      exportedAt: Date.now(),
      templates: templates,
      snippets: userSnippets,
    };
    try {
      const savePath = await host.ui.showSaveDialog({
        defaultName: `email_templates_${getCurrentDateString()}.json`,
        extensions: ['json'],
      });
      if (!savePath) return;
      await host.platform.invoke('write_text_file', { path: savePath, content: JSON.stringify(data, null, 2) });
      showStatus(t('tplExported', { count: templates.length, snippetCount: userSnippets.length }));
    } catch (err) {
      showStatus(String(err), true);
    }
  }, [templates, userSnippets, host, showStatus, t]);

  // 导入
  const handleImport = useCallback(async () => {
    try {
      const selected = await host.ui.showOpenDialog({
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!selected) return;
      const content = await host.platform.invoke<string>('read_text_file', { path: selected });
      const data = JSON.parse(content);
      if (!data || data.version !== 1) { showStatus(t('tplImportFailed'), true); return; }

      const existingTplIds = new Set(templates.map(t => t.id));
      const existingSnpIds = new Set(userSnippets.map(s => s.id));
      const newTpls = (data.templates || []).filter((t: SubmissionTemplate) => !existingTplIds.has(t.id));
      const newSnps = (data.snippets || []).filter((s: TextSnippet) => !existingSnpIds.has(s.id));

      if (newTpls.length > 0 || newSnps.length > 0) {
        saveToStorage({
          submissionTemplates: [...templates, ...newTpls],
          textSnippets: [...userSnippets, ...newSnps],
        });
      }
      showStatus(t('tplImported', { tplCount: newTpls.length, snpCount: newSnps.length }));
    } catch (err) {
      showStatus(t('tplImportFailed') + ': ' + (err instanceof Error ? err.message : String(err)), true);
    }
  }, [templates, userSnippets, host, saveToStorage, showStatus, t]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = activeTab === 'templates' ? filteredTemplates : filteredSnippets;
      if (list.length === 0) return;
      const curIdx = list.findIndex(item => item.id === previewId);
      let nextIdx: number;
      if (e.key === 'ArrowDown') nextIdx = curIdx < list.length - 1 ? curIdx + 1 : 0;
      else nextIdx = curIdx > 0 ? curIdx - 1 : list.length - 1;
      setPreviewId(list[nextIdx].id);
    }
  }, [activeTab, filteredTemplates, filteredSnippets, previewId]);

  // 获取所有变量
  const getAllVariables = useCallback((tpl: SubmissionTemplate) => {
    return [...presetVars, ...tpl.variables];
  }, [presetVars]);

  // ══════════════════════════════════════
  // ── 渲染 ──
  // ══════════════════════════════════════

  const renderTemplateListItem = (tpl: SubmissionTemplate) => {
    const isActive = previewId === tpl.id;
    const isEditing = editingTemplate?.id === tpl.id;
    const customVarCount = tpl.variables.length;
    return (
      <div
        key={tpl.id}
        className={`flex items-start gap-2 px-3 py-2 cursor-pointer text-sm border-b transition-colors ${
          isActive ? 'bg-primary/10' : selectedIds.has(tpl.id) ? 'bg-primary/5' : 'hover:bg-muted/40'
        }`}
        onClick={() => { setEditingTemplate(null); setEditingSnippet(null); setPreviewId(tpl.id); }}
      >
        <input
          type="checkbox"
          checked={selectedIds.has(tpl.id)}
          readOnly
          onClick={(e) => { e.stopPropagation(); handleToggleSelect(tpl.id); }}
          className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0 cursor-pointer mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isEditing && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
            <span className="font-medium truncate text-sm">{tpl.name || t('tplNewTemplate')}</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {tpl.recipients.length > 0 ? `→ ${tpl.recipients.join(', ')}` : t('tplNoRecipients')}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            {(tpl.useCount || 0) > 0 ? (
              <span>{t('tplUsedCount', { count: tpl.useCount || 0 })}</span>
            ) : (
              <span className="opacity-60">{t('tplNeverUsed')}</span>
            )}
            {tpl.category && (
              <span className="px-1 py-0 bg-muted rounded text-[10px]">{tpl.category}</span>
            )}
            {customVarCount > 0 && (
              <span>{t('tplVarsCount', { count: customVarCount })}</span>
            )}
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground flex-shrink-0 mt-0.5">
          {formatTime(tpl.updatedAt)}
        </span>
      </div>
    );
  };

  const renderSnippetListItem = (snp: TextSnippet) => {
    const isActive = previewId === snp.id;
    const isPreset = isPresetSnippet(snp.id);
    return (
      <div
        key={snp.id}
        className={`flex items-start gap-2 px-3 py-2 cursor-pointer text-sm border-b transition-colors ${
          isActive ? 'bg-primary/10' : selectedIds.has(snp.id) ? 'bg-primary/5' : 'hover:bg-muted/40'
        }`}
        onClick={() => { setEditingTemplate(null); setEditingSnippet(null); setPreviewId(snp.id); }}
      >
        {!isPreset ? (
          <input
            type="checkbox"
            checked={selectedIds.has(snp.id)}
            readOnly
            onClick={(e) => { e.stopPropagation(); handleToggleSelect(snp.id); }}
            className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0 cursor-pointer mt-0.5"
          />
        ) : (
          <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium truncate text-sm">{snp.name}</span>
            {snp.category && (
              <span className="px-1 py-0 bg-muted rounded text-[10px] text-muted-foreground flex-shrink-0">{snp.category}</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {snp.content.slice(0, 60)}{snp.content.length > 60 ? '...' : ''}
          </div>
        </div>
      </div>
    );
  };

  // ── 右栏：模板预览 ──
  const renderTemplatePreview = (tpl: SubmissionTemplate) => {
    const resolvedSubject = replaceVariables(tpl.subjectTemplate, tpl.variables, varContext);
    const resolvedBody = replaceVariables(tpl.bodyTemplate, tpl.variables, varContext);
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {/* 标题行 */}
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold truncate flex-1">{tpl.name}</h3>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0"
            onClick={() => { setEditingSnippet(null); setEditingTemplate({ ...tpl }); }}
            title={t('tplEditBtn')}>
            <Pencil className="h-3 w-3" />
          </Button>
        </div>

        {/* 元信息网格 */}
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs border rounded-md p-3 bg-muted/30">
          {tpl.description && (
            <><span className="text-muted-foreground">{t('tplDescription')}</span><span className="truncate">{tpl.description}</span></>
          )}
          {tpl.category && (
            <><span className="text-muted-foreground">{t('tplCategoryLabel')}</span><span>{tpl.category}</span></>
          )}
          <span className="text-muted-foreground">{t('tplRecipients')}</span>
          <span className="font-mono truncate">{tpl.recipients.join(', ') || '-'}</span>
          {(tpl.cc && tpl.cc.length > 0) && (
            <><span className="text-muted-foreground">CC</span><span className="font-mono truncate">{tpl.cc.join(', ')}</span></>
          )}
          {(tpl.bcc && tpl.bcc.length > 0) && (
            <><span className="text-muted-foreground">BCC</span><span className="font-mono truncate">{tpl.bcc.join(', ')}</span></>
          )}
          <span className="text-muted-foreground">{t('tplVariables')}</span>
          <span>
            {presetVars.map(v => `{{${v.name}}}`).join(' ')}
            {tpl.variables.length > 0 && ` + ${t('tplVarsCount', { count: tpl.variables.length })}`}
          </span>
          <span className="text-muted-foreground">{t('tplCreatedAt')}</span>
          <span>{formatFullTime(tpl.createdAt)}</span>
          <span className="text-muted-foreground">{t('tplUpdatedAt')}</span>
          <span>{formatFullTime(tpl.updatedAt)}</span>
          <span className="text-muted-foreground">{t('tplUsageStats')}</span>
          <span>
            {(tpl.useCount || 0) > 0
              ? t('tplUsageDetail', { count: tpl.useCount || 0, date: tpl.lastUsedAt ? formatTime(tpl.lastUsedAt) : '-' })
              : t('tplNeverUsed')}
          </span>
        </div>

        {/* 主题预览 */}
        {tpl.subjectTemplate && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">{t('tplPreviewSubject')}</div>
            <div className="border rounded bg-background p-2 text-sm">
              {resolvedSubject}
            </div>
          </div>
        )}

        {/* 正文预览 */}
        {tpl.bodyTemplate && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">{t('tplPreviewBody')}</div>
            <div className="border rounded bg-background p-3 max-h-[250px] overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs"
                dangerouslySetInnerHTML={{ __html: resolvedBody }} />
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
            onClick={() => setConfirmApplyTpl(tpl)}>
            {t('tplApplyBtn')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
            onClick={() => { setEditingSnippet(null); setEditingTemplate({ ...tpl }); }}>
            <Pencil className="h-3 w-3" />
            {t('tplEditBtn')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
            onClick={() => handleDuplicateTemplate(tpl)}>
            <Copy className="h-3 w-3" />
            {t('tplDuplicateBtn')}
          </Button>
          <div className="flex-1" />
          {confirmDeleteId === tpl.id ? (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-destructive">{t('tplDeleteConfirm')}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                onClick={() => setConfirmDeleteId(null)}>
                {t('cancel')}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => handleDeleteTemplate(tpl.id)}>
                {t('tplDeleteConfirmYes')}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteId(tpl.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ── 右栏：模板编辑 ──
  const renderTemplateEdit = (tpl: SubmissionTemplate) => (
    <div className="flex-1 min-h-0 flex flex-col">
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
      <div className="space-y-1">
        <Label className="text-xs">{t('templateName')} *</Label>
        <Input value={tpl.name} onChange={e => setEditingTemplate({ ...tpl, name: e.target.value })} placeholder={t('templateNamePlaceholder')} className="h-8 text-sm" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('tplDescription')}</Label>
          <Input value={tpl.description || ''} onChange={e => setEditingTemplate({ ...tpl, description: e.target.value })} placeholder={t('descriptionPlaceholder')} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('tplCategoryLabel')}</Label>
          <Input value={tpl.category || ''} onChange={e => setEditingTemplate({ ...tpl, category: e.target.value })} placeholder={t('tplCategoryLabel')} className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('recipients')}</Label>
        <Input value={tpl.recipients.join(', ')} onChange={e => setEditingTemplate({ ...tpl, recipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder={t('recipientsPlaceholder')} className="h-8 text-sm font-mono" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('cc')}</Label>
          <Input value={(tpl.cc || []).join(', ')} onChange={e => setEditingTemplate({ ...tpl, cc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder={t('ccPlaceholder')} className="h-8 text-sm font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('bcc')}</Label>
          <Input value={(tpl.bcc || []).join(', ')} onChange={e => setEditingTemplate({ ...tpl, bcc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder={t('bccPlaceholder')} className="h-8 text-sm font-mono" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('subjectTemplate')}</Label>
        <div className="flex gap-2">
          <Input value={tpl.subjectTemplate} onChange={e => setEditingTemplate({ ...tpl, subjectTemplate: e.target.value })} placeholder={t('subjectTemplatePlaceholder')} className="h-8 text-sm flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">{t('insertVar')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {getAllVariables(tpl).map((v: VariableDef) => {
                const varStr = '{{' + v.name + '}}';
                return (
                  <DropdownMenuItem key={v.name} onClick={() => setEditingTemplate({ ...tpl, subjectTemplate: tpl.subjectTemplate + varStr })}>
                    {v.label} ({varStr})
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t('bodyTemplate')}</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-[10px]">{t('insertVar')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {getAllVariables(tpl).map((v: VariableDef) => {
                const varStr = '{{' + v.name + '}}';
                return (
                  <DropdownMenuItem key={v.name} onClick={() => setEditingTemplate({ ...tpl, bodyTemplate: tpl.bodyTemplate + varStr })}>
                    {v.label} ({varStr})
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <textarea
          value={tpl.bodyTemplate}
          onChange={e => setEditingTemplate({ ...tpl, bodyTemplate: e.target.value })}
          placeholder={t('bodyTemplatePlaceholder')}
          className="w-full h-[180px] p-2 text-sm border rounded-md resize-none font-mono"
        />
      </div>
      {/* 自定义变量管理 */}
      <div className="space-y-1.5 border rounded-md p-2.5 bg-muted/20">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">{t('customVariables')}</Label>
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={() => {
            const newVar: VariableDef = { name: `var_${Date.now()}`, label: '', defaultValue: '', source: 'user' };
            setEditingTemplate({ ...tpl, variables: [...tpl.variables, newVar] });
          }}>
            <Plus className="h-3 w-3 mr-0.5" />{t('addVariable')}
          </Button>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] text-muted-foreground">{t('presetVariables')}</div>
          <div className="flex flex-wrap gap-1">
            {presetVars.map(v => (
              <span key={v.name} className="text-[10px] px-1.5 py-0.5 bg-muted rounded border">
                {v.label} <code className="text-primary">{`{{${v.name}}}`}</code>
              </span>
            ))}
          </div>
        </div>
        {tpl.variables.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] text-muted-foreground">{t('customVariablesList')}</div>
            {tpl.variables.map((v, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Input value={v.name} onChange={e => {
                  const vars = [...tpl.variables];
                  vars[idx] = { ...v, name: e.target.value.replace(/\s/g, '_') };
                  setEditingTemplate({ ...tpl, variables: vars });
                }} placeholder={t('varName')} className="h-7 text-xs w-[100px] font-mono" />
                <Input value={v.label} onChange={e => {
                  const vars = [...tpl.variables];
                  vars[idx] = { ...v, label: e.target.value };
                  setEditingTemplate({ ...tpl, variables: vars });
                }} placeholder={t('varLabel')} className="h-7 text-xs flex-1" />
                <Input value={v.defaultValue || ''} onChange={e => {
                  const vars = [...tpl.variables];
                  vars[idx] = { ...v, defaultValue: e.target.value };
                  setEditingTemplate({ ...tpl, variables: vars });
                }} placeholder={t('varDefaultValue')} className="h-7 text-xs flex-1" />
                <Button variant="ghost" size="sm" className="h-7 px-1 text-destructive hover:text-destructive" onClick={() => {
                  const vars = tpl.variables.filter((_, i) => i !== idx);
                  setEditingTemplate({ ...tpl, variables: vars });
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {/* 固定底栏 */}
    <div className="flex justify-end gap-2 px-3 py-2 border-t bg-background flex-shrink-0">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingTemplate(null)}>{t('cancel')}</Button>
      <Button size="sm" className="h-7 text-xs" onClick={handleSaveTemplate} disabled={!tpl.name.trim()}>{t('save')}</Button>
    </div>
    </div>
  );

  // ── 右栏：片段预览 ──
  const renderSnippetPreview = (snp: TextSnippet) => {
    const isPreset = isPresetSnippet(snp.id);
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold truncate flex-1">{snp.name}</h3>
          {isPreset && (
            <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded border text-muted-foreground flex-shrink-0">
              <Lock className="h-2.5 w-2.5 inline mr-0.5" />{t('tplPresetLock')}
            </span>
          )}
        </div>
        {snp.category && (
          <div className="text-xs text-muted-foreground">{t('tplCategoryLabel')}: {snp.category}</div>
        )}
        <div className="border rounded bg-background p-3 max-h-[300px] overflow-y-auto">
          <div className="prose prose-sm dark:prose-invert max-w-none text-xs"
            dangerouslySetInnerHTML={{ __html: snp.content }} />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
            onClick={() => { onInsertSnippet(snp.content); showStatus(t('snippetInserted')); }}>
            {t('insertToBody')}
          </Button>
          {!isPreset && (
            <>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                onClick={() => { setEditingTemplate(null); setEditingSnippet({ ...snp }); }}>
                <Pencil className="h-3 w-3" />
                {t('tplEditBtn')}
              </Button>
              <div className="flex-1" />
              {confirmDeleteId === snp.id ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-destructive">{t('tplDeleteConfirm')}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                    onClick={() => setConfirmDeleteId(null)}>{t('cancel')}</Button>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDeleteSnippet(snp.id)}>{t('tplDeleteConfirmYes')}</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => setConfirmDeleteId(snp.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // ── 右栏：片段编辑 ──
  const renderSnippetEdit = (snp: TextSnippet) => (
    <div className="flex-1 min-h-0 flex flex-col">
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
      <div className="space-y-1">
        <Label className="text-xs">{t('snippetName')} *</Label>
        <Input value={snp.name} onChange={e => setEditingSnippet({ ...snp, name: e.target.value })} placeholder={t('snippetNamePlaceholder')} className="h-8 text-sm" autoFocus />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('tplCategoryLabel')}</Label>
        <Input value={snp.category || ''} onChange={e => setEditingSnippet({ ...snp, category: e.target.value })} placeholder={t('categoryPlaceholder')} className="h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('content')}</Label>
        <textarea
          value={snp.content}
          onChange={e => setEditingSnippet({ ...snp, content: e.target.value })}
          placeholder={t('snippetContentPlaceholder')}
          className="w-full h-[200px] p-2 text-sm border rounded-md resize-none font-mono"
        />
        <p className="text-xs text-muted-foreground">{t('snippetContentHint')}</p>
      </div>
    </div>
    {/* 固定底栏 */}
    <div className="flex justify-end gap-2 px-3 py-2 border-t bg-background flex-shrink-0">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingSnippet(null)}>{t('cancel')}</Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { onInsertSnippet(snp.content); showStatus(t('snippetInserted')); }}>{t('insertToBody')}</Button>
      <Button size="sm" className="h-7 text-xs" onClick={handleSaveSnippet} disabled={!snp.name.trim()}>{t('save')}</Button>
    </div>
    </div>
  );

  // ── 右栏总入口 ──
  const renderRightPane = () => {
    // 编辑模式优先
    if (editingTemplate) return renderTemplateEdit(editingTemplate);
    if (editingSnippet) return renderSnippetEdit(editingSnippet);
    // 预览模式
    if (activeTab === 'templates' && previewTemplate) return renderTemplatePreview(previewTemplate);
    if (activeTab === 'snippets' && previewSnippet) return renderSnippetPreview(previewSnippet);
    // 空状态
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <FileText className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">{t('tplSelectToPreview')}</p>
      </div>
    );
  };

  // ══════════════════════════════════════
  // ── 主体 JSX ──
  // ══════════════════════════════════════

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[960px] w-[960px] h-[85vh] overflow-hidden flex flex-col p-0" style={DIALOG_STYLE}>
          {/* 顶部标题栏 */}
          <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base">{t('tplManageTitle')}</DialogTitle>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleExport}
                  disabled={templates.length === 0 && userSnippets.length === 0}>
                  <Download className="h-3 w-3" />
                  {t('tplExport')}
                </Button>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleImport}>
                  <Upload className="h-3 w-3" />
                  {t('tplImport')}
                </Button>
              </div>
            </div>
            <DialogDescription>{t('tplManageDesc', { tplCount: templates.length, snpCount: userSnippets.length })}</DialogDescription>
          </DialogHeader>

          {/* Tab 切换 */}
          <div className="px-5 pb-2 flex-shrink-0">
            <Tabs value={activeTab} onValueChange={v => {
              setActiveTab(v as ActiveTab);
              setPreviewId(null);
              setSelectedIds(new Set());
              setSearchText('');
              setEditingTemplate(null);
              setEditingSnippet(null);
              setConfirmDeleteId(null);
            }}>
              <TabsList className="h-8">
                <TabsTrigger value="templates" className="text-xs px-4 h-7">{t('tplTabTemplates')}</TabsTrigger>
                <TabsTrigger value="snippets" className="text-xs px-4 h-7">{t('tplTabSnippets')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* 双栏主体 */}
          <div className="flex flex-1 min-h-0 border-t" onKeyDown={handleKeyDown} tabIndex={-1}>
            {/* ── 左栏 ── */}
            <div className="w-[320px] flex-shrink-0 border-r flex flex-col bg-muted/20">
              {/* 片段分类筛选条 */}
              {activeTab === 'snippets' && snippetCategories.length > 0 && (
                <div className="flex items-center gap-1 px-3 py-1.5 border-b flex-shrink-0 overflow-x-auto">
                  <button
                    onClick={() => setSnippetCategoryFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] whitespace-nowrap transition-colors ${
                      snippetCategoryFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >{t('tplCategoryAll')}</button>
                  {snippetCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSnippetCategoryFilter(snippetCategoryFilter === cat ? 'all' : cat)}
                      className={`px-2 py-0.5 rounded text-[11px] whitespace-nowrap transition-colors ${
                        snippetCategoryFilter === cat ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >{cat}</button>
                  ))}
                </div>
              )}

              {/* 搜索 + 排序 */}
              <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={activeTab === 'templates' ? t('tplSearchPlaceholder') : t('tplSnippetSearchPlaceholder')}
                    value={searchText}
                    onChange={e => { setSearchText(e.target.value); setPreviewId(null); }}
                    className="h-8 text-sm pl-8"
                  />
                </div>
                {activeTab === 'templates' ? (
                  <Select value={sortKey} onValueChange={v => setSortKey(v as TemplateSortKey)}>
                    <SelectTrigger className="h-8 text-xs w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updatedAt_desc">{t('tplSortTimeDesc')}</SelectItem>
                      <SelectItem value="updatedAt_asc">{t('tplSortTimeAsc')}</SelectItem>
                      <SelectItem value="name_asc">{t('tplSortNameAsc')}</SelectItem>
                      <SelectItem value="name_desc">{t('tplSortNameDesc')}</SelectItem>
                      <SelectItem value="lastUsed">{t('tplSortLastUsed')}</SelectItem>
                      <SelectItem value="useCount">{t('tplSortUseCount')}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={snippetSortKey} onValueChange={v => setSnippetSortKey(v as SnippetSortKey)}>
                    <SelectTrigger className="h-8 text-xs w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name_asc">{t('tplSortNameAsc')}</SelectItem>
                      <SelectItem value="name_desc">{t('tplSortNameDesc')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* 全选表头 */}
              {(activeTab === 'templates' ? filteredTemplates.length > 0 : filteredSnippets.length > 0) && (
                <div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0 bg-muted/30 text-[11px] text-muted-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                    onChange={handleSelectAll}
                    title={t('selectAll')}
                    className="h-3.5 w-3.5 rounded border-gray-300 flex-shrink-0 cursor-pointer"
                  />
                  <span className="flex-1">{t('tplName')}</span>
                  {activeTab === 'templates' && <span className="w-[60px] flex-shrink-0 text-right">{t('tplTime')}</span>}
                </div>
              )}

              {/* 列表 */}
              <div className="flex-1 min-h-0 overflow-y-auto" ref={listRef}>
                {activeTab === 'templates' ? (
                  filteredTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Archive className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">{templates.length === 0 ? t('tplEmpty') : t('tplNoMatch')}</p>
                      {templates.length === 0 && <p className="text-xs mt-1 opacity-70">{t('tplEmptyHint')}</p>}
                    </div>
                  ) : filteredTemplates.map(renderTemplateListItem)
                ) : (
                  filteredSnippets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Archive className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">{allSnippets.length === 0 ? t('tplSnippetEmpty') : t('tplNoMatch')}</p>
                    </div>
                  ) : filteredSnippets.map(renderSnippetListItem)
                )}
              </div>
            </div>

            {/* ── 右栏 ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {renderRightPane()}
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between px-5 py-3 border-t flex-shrink-0 bg-muted/10">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size > 0
                ? t('tplSelectedCount', { count: selectedIds.size })
                : t('tplManageDesc', { tplCount: templates.length, snpCount: userSnippets.length })}
            </span>
            <div className="flex gap-2">
              {activeTab === 'templates' ? (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleNewTemplate}>
                  <Plus className="h-3 w-3" />
                  {t('tplNewTemplate')}
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleNewSnippet}>
                  <Plus className="h-3 w-3" />
                  {t('tplNewSnippet')}
                </Button>
              )}
              {selectedIds.size > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
                  onClick={() => setConfirmBatchOpen(true)}>
                  <Trash2 className="h-3 w-3" />
                  {t('tplBatchDelete')}
                </Button>
              )}
              {((activeTab === 'templates' && templates.length > 0) || (activeTab === 'snippets' && userSnippets.length > 0)) && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => setConfirmClearOpen(true)}>
                  {t('tplClearAll')}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 应用模板确认弹窗 ── */}
      <Dialog open={!!confirmApplyTpl} onOpenChange={v => { if (!v) setConfirmApplyTpl(null); }}>
        <DialogContent className="sm:max-w-[460px]" style={DIALOG_STYLE}>
          <DialogHeader>
            <DialogTitle>{t('tplApplyConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('tplApplyConfirmDesc', { name: confirmApplyTpl?.name || '' })}</DialogDescription>
          </DialogHeader>
          {confirmApplyTpl && (
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs border rounded-md p-3 bg-muted/30 my-2">
              <span className="text-muted-foreground">{t('tplRecipients')}</span>
              <span className="font-mono truncate">{confirmApplyTpl.recipients.join(', ') || '-'}</span>
              <span className="text-muted-foreground">{t('subject')}</span>
              <span className="truncate">{replaceVariables(confirmApplyTpl.subjectTemplate, confirmApplyTpl.variables, varContext)}</span>
              <span className="text-muted-foreground">{t('bodyTemplate')}</span>
              <span className="truncate">{replaceVariables(confirmApplyTpl.bodyTemplate, confirmApplyTpl.variables, varContext).slice(0, 80)}...</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmApplyTpl(null)}>
              {t('cancel')}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => {
                if (confirmApplyTpl) {
                  onApplyTemplate(confirmApplyTpl);
                  handleOpenChange(false);
                }
                setConfirmApplyTpl(null);
              }}>
              {t('tplApplyConfirmBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 批量删除确认 ── */}
      <Dialog open={confirmBatchOpen} onOpenChange={setConfirmBatchOpen}>
        <DialogContent className="sm:max-w-[400px]" style={DIALOG_STYLE}>
          <DialogHeader>
            <DialogTitle>{t('tplBatchDelete')}</DialogTitle>
            <DialogDescription>{t('tplBatchDeleteConfirm', { count: selectedIds.size })}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmBatchOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={handleBatchDelete}>
              <Trash2 className="h-3 w-3 mr-1" />
              {t('tplDeleteConfirmYes')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 清空所有确认 ── */}
      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent className="sm:max-w-[400px]" style={DIALOG_STYLE}>
          <DialogHeader>
            <DialogTitle>{t('tplClearAllTitle')}</DialogTitle>
            <DialogDescription>{t('tplClearAllConfirm', { count: activeTab === 'templates' ? templates.length : userSnippets.length })}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmClearOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={handleClearAll}>
              <Trash2 className="h-3 w-3 mr-1" />
              {t('tplClearAll')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
