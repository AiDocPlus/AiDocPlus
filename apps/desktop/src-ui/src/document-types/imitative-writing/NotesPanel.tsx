/**
 * 笔记栏 — 列表、搜索、分类筛选、内联编辑、置顶
 */
import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, Pin, PinOff, Trash2, Tag, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { NOTE_CATEGORIES, type NoteCategoryOption } from './constants';
import { createNote, type WritingNote, type NoteCategory } from './types';

interface NotesPanelProps {
  notes: WritingNote[];
  onNotesChange: (notes: WritingNote[]) => void;
}

export function NotesPanel({ notes, onNotesChange }: NotesPanelProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState<NoteCategory | 'all'>('all');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const getCategoryOption = (cat: NoteCategory): NoteCategoryOption | undefined =>
    NOTE_CATEGORIES.find(c => c.value === cat);

  const filteredNotes = notes
    .filter(n => filterCategory === 'all' || n.category === filterCategory)
    .filter(n => !searchText || n.title.includes(searchText) || n.content.includes(searchText))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const handleAddNote = useCallback(() => {
    const note = createNote({
      title: t('imitativeWriting.notes.newNoteTitle', { defaultValue: '新笔记' }),
      content: '',
      category: filterCategory === 'all' ? 'analysis' : filterCategory,
    });
    const next = [note, ...notes];
    onNotesChange(next);
    setExpandedNoteId(note.id);
    setEditingNoteId(note.id);
  }, [notes, onNotesChange, filterCategory, t]);

  const handleUpdateNote = useCallback((id: string, fields: Partial<WritingNote>) => {
    onNotesChange(notes.map(n => n.id === id
      ? { ...n, ...fields, updatedAt: new Date().toISOString() }
      : n
    ));
  }, [notes, onNotesChange]);

  const handleDeleteNote = useCallback((id: string) => {
    onNotesChange(notes.filter(n => n.id !== id));
    if (expandedNoteId === id) setExpandedNoteId(null);
    if (editingNoteId === id) setEditingNoteId(null);
  }, [notes, onNotesChange, expandedNoteId, editingNoteId]);

  const handleTogglePin = useCallback((id: string) => {
    handleUpdateNote(id, { pinned: !notes.find(n => n.id === id)?.pinned });
  }, [notes, handleUpdateNote]);

  const toggleExpand = (id: string) => {
    setExpandedNoteId(prev => prev === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 搜索栏 */}
      <div className="flex items-center gap-1 px-1.5 py-1 border-b flex-shrink-0">
        <div className="flex items-center flex-1 min-w-0 gap-1 border rounded px-1.5 h-6 bg-background">
          <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <input
            ref={searchRef}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder={t('imitativeWriting.notes.searchPlaceholder', { defaultValue: '搜索...' })}
            className="flex-1 text-xs bg-transparent focus:outline-none min-w-0"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="flex-shrink-0" title={t('common.clear', { defaultValue: '清空' })}>
              <X className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleAddNote}
          title={t('imitativeWriting.notes.addNote', { defaultValue: '新建笔记' })}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 分类筛选 */}
      <div className="flex items-center gap-0.5 px-1.5 py-0.5 border-b flex-shrink-0 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${filterCategory === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          {t('common.all', { defaultValue: '全部' })}
        </button>
        {NOTE_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(filterCategory === cat.value ? 'all' : cat.value)}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${filterCategory === cat.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            {t(cat.labelKey, { defaultValue: cat.value })}
          </button>
        ))}
      </div>

      {/* 笔记列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/50 p-4 text-center">
            <p className="text-xs">
              {notes.length === 0
                ? t('imitativeWriting.notes.empty', { defaultValue: '暂无笔记，点击 + 新建' })
                : t('imitativeWriting.notes.noMatch', { defaultValue: '无匹配笔记' })}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredNotes.map(note => {
              const catOpt = getCategoryOption(note.category);
              const isExpanded = expandedNoteId === note.id;
              return (
                <div key={note.id} className={`group ${note.pinned ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                  {/* 笔记标题行 */}
                  <div className="flex items-center gap-1 px-1.5 py-1.5 hover:bg-muted/30 cursor-pointer"
                    onClick={() => toggleExpand(note.id)}>
                    {isExpanded
                      ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    {note.pinned && <Pin className="h-2.5 w-2.5 text-amber-500 flex-shrink-0" />}
                    <span className="flex-1 text-xs truncate font-medium">{note.title}</span>
                    {catOpt && (
                      <span className={`flex-shrink-0 inline-block w-1.5 h-1.5 rounded-full ${catOpt.color}`} />
                    )}
                    {/* 操作按钮（hover 显示） */}
                    <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleTogglePin(note.id)}>
                        {note.pinned ? <PinOff className="h-2.5 w-2.5" /> : <Pin className="h-2.5 w-2.5" />}
                      </Button>
                      {/* 分类切换 */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                            <Tag className="h-2.5 w-2.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          {NOTE_CATEGORIES.map(cat => (
                            <DropdownMenuItem key={cat.value}
                              onClick={() => handleUpdateNote(note.id, { category: cat.value })}
                              className={note.category === cat.value ? 'font-semibold' : ''}>
                              <span className={`inline-block w-2 h-2 rounded-full ${cat.color} mr-1.5`} />
                              {t(cat.labelKey, { defaultValue: cat.value })}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteNote(note.id)}>
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>

                  {/* 展开内容 */}
                  {isExpanded && (
                    <div className="border-t bg-muted/10">
                      {/* 标题编辑 */}
                      <div className="flex items-center gap-1 px-2 py-1 border-b">
                        <input
                          value={note.title}
                          onChange={e => handleUpdateNote(note.id, { title: e.target.value })}
                          className="flex-1 text-xs font-medium bg-transparent focus:outline-none"
                          onClick={() => setEditingNoteId(note.id)}
                          title={t('imitativeWriting.notes.noteTitle', { defaultValue: '笔记标题' })}
                          placeholder={t('imitativeWriting.notes.noteTitlePlaceholder', { defaultValue: '输入标题...' })}
                          aria-label={t('imitativeWriting.notes.noteTitle', { defaultValue: '笔记标题' })}
                        />
                        <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">
                          {new Date(note.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {/* 内容编辑 */}
                      <div className="h-48 overflow-hidden" onClick={() => setEditingNoteId(note.id)}>
                        <MarkdownEditor
                          value={note.content}
                          onChange={content => handleUpdateNote(note.id, { content })}
                          placeholder={t('imitativeWriting.notes.contentPlaceholder', { defaultValue: '记录笔记...' })}
                          showToolbar={false}
                          showViewModeSwitch={false}
                        />
                      </div>
                      {/* 标签 */}
                      <NoteTagEditor
                        tags={note.tags}
                        onTagsChange={tags => handleUpdateNote(note.id, { tags })}
                        t={t}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部统计 */}
      <div className="flex items-center px-2 py-0.5 border-t bg-muted/10 flex-shrink-0">
        <span className="text-[10px] text-muted-foreground">
          {t('imitativeWriting.notes.count', { count: notes.length, defaultValue: `${notes.length} 条笔记` })}
        </span>
      </div>
    </div>
  );
}

// ── 标签编辑器 ──

function NoteTagEditor({ tags, onTagsChange, t }: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  t: (key: string, opts: Record<string, unknown>) => string;
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const tag = input.trim();
    if (!tag || tags.includes(tag)) { setInput(''); return; }
    onTagsChange([...tags, tag]);
    setInput('');
  };

  const removeTag = (tag: string) => onTagsChange(tags.filter(t => t !== tag));

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-t flex-wrap">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-muted rounded-full">
          {tag}
          <button onClick={() => removeTag(tag)} title={tag}><X className="h-2 w-2" /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
        placeholder={t('imitativeWriting.notes.tagPlaceholder', { defaultValue: '添加标签...' })}
        title={t('imitativeWriting.notes.tagInput', { defaultValue: '标签输入，回车确认' })}
        aria-label={t('imitativeWriting.notes.tagPlaceholder', { defaultValue: '添加标签...' })}
        className="text-[10px] bg-transparent focus:outline-none w-16 min-w-0"
      />
    </div>
  );
}
