/**
 * StockInfoPanel — 股票信息面板（左侧）
 */

import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, FileText, ChevronRight, ChevronDown,
  Plus, Trash2, Target, Tag, X, Building2, Scale, GripVertical,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  type StockResearchDocumentContent, type StockInfo, type StockResearchPhase,
  type ResearchNote, getActiveTheses,
} from './types';
import { RESEARCH_PHASES, MARKET_CODES, INDUSTRIES_CN } from './constants';

interface StockInfoPanelProps {
  research: StockResearchDocumentContent;
  onUpdateStockInfo: (patch: Partial<StockInfo>) => void;
  onPhaseChange: (phase: StockResearchPhase) => void;
  onSelectNote: (noteId: string | null) => void;
  onAddNote: () => void;
  onDeleteNote: (noteId: string) => void;
  onRenameNote: (noteId: string, newTitle: string) => void;
  onReorderNotes: (noteIds: string[]) => void;
  activeNoteId: string | null;
}

// 可排序的笔记项组件
interface SortableNoteItemProps {
  note: ResearchNote;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditingTitleChange: (title: string) => void;
  onFinishEdit: (title: string) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

function SortableNoteItem({
  note, isActive, isEditing, editingTitle,
  onSelect, onStartEdit, onEditingTitleChange, onFinishEdit, onCancelEdit, onDelete,
}: SortableNoteItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1 px-1.5 py-1 rounded text-[11px] cursor-pointer group',
        'hover:bg-accent/50',
        isActive && 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/50',
        isDragging && 'shadow-md',
      )}
      onClick={() => !isEditing && onSelect()}
    >
      {/* 拖拽手柄 */}
      <button
        className="cursor-grab opacity-0 group-hover:opacity-50 hover:!opacity-100 flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <FileText className="h-3 w-3 flex-shrink-0" />
      {isEditing ? (
        <input
          className="flex-1 text-[11px] bg-transparent border-b border-primary outline-none px-0.5"
          value={editingTitle}
          onChange={(e) => onEditingTitleChange(e.target.value)}
          onBlur={() => onFinishEdit(editingTitle)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFinishEdit(editingTitle);
            if (e.key === 'Escape') onCancelEdit();
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <>
          <span
            className="flex-1 truncate"
            onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(); }}
          >
            {note.title}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-2.5 w-2.5 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
}

export default function StockInfoPanel({
  research, onUpdateStockInfo, onPhaseChange,
  onSelectNote, onAddNote, onDeleteNote, onRenameNote, onReorderNotes, activeNoteId,
}: StockInfoPanelProps) {
  const { t } = useTranslation();
  const { stock, theses, notes, metadata } = research;

  const [editingCode, setEditingCode] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [codeInput, setCodeInput] = useState(stock.code);
  const [nameInput, setNameInput] = useState(stock.name);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['stock', 'theses', 'notes']));

  // 笔记编辑状态
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState('');

  // 标签编辑状态
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = notes.findIndex(n => n.id === active.id);
      const newIndex = notes.findIndex(n => n.id === over.id);
      const newOrder = arrayMove(notes, oldIndex, newIndex).map(n => n.id);
      onReorderNotes(newOrder);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const activeTheses = useMemo(() => getActiveTheses(research), [research]);

  const phaseInfo = RESEARCH_PHASES.find(p => p.key === metadata.phase) || RESEARCH_PHASES[0];

  return (
    <div className="flex flex-col h-full">
      {/* 股票代码/名称 */}
      <div className="p-2 border-b space-y-1">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4 text-primary" />
          {editingCode ? (
            <input
              className="flex-1 text-sm font-bold bg-transparent border-b border-primary outline-none px-0.5"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onBlur={() => { onUpdateStockInfo({ code: codeInput }); setEditingCode(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateStockInfo({ code: codeInput }); setEditingCode(false); }}}
              autoFocus
            />
          ) : (
            <span
              className="flex-1 text-sm font-bold cursor-pointer hover:text-primary"
              onClick={() => { setCodeInput(stock.code); setEditingCode(true); }}
              title={t('stockResearch.clickToEdit')}
            >
              {stock.code || t('stockResearch.inputCode')}
            </span>
          )}
        </div>
        {editingName ? (
          <input
            className="w-full text-xs text-muted-foreground bg-transparent border-b border-primary outline-none px-0.5"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => { onUpdateStockInfo({ name: nameInput }); setEditingName(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateStockInfo({ name: nameInput }); setEditingName(false); }}}
            autoFocus
          />
        ) : (
          <div
            className="text-xs text-muted-foreground cursor-pointer hover:text-foreground truncate"
            onClick={() => { setNameInput(stock.name); setEditingName(true); }}
            title={t('stockResearch.clickToEdit')}
          >
            {stock.name || t('stockResearch.inputName')}
          </div>
        )}
      </div>

      {/* 阶段指示器 */}
      <div className="px-2 py-1.5 border-b flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground">{t('stockResearch.market')}:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-xs hover:text-primary">
              {stock.market || t('stockResearch.selectMarket')}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.entries(MARKET_CODES).map(([code, market]) => (
              <DropdownMenuItem
                key={code}
                className="text-xs"
                onClick={() => onUpdateStockInfo({ market: code })}
              >
                {market.name} ({code})
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">{t('stockResearch.phase')}:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn('flex items-center gap-0.5 text-xs', phaseInfo.color)}>
              <span>{phaseInfo.icon}</span>
              <span>{t(phaseInfo.labelKey)}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {RESEARCH_PHASES.map(phase => (
              <DropdownMenuItem key={phase.key} className={cn('text-xs', phase.color)} onClick={() => onPhaseChange(phase.key)}>
                {phase.icon} {t(phase.labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 行业/板块 */}
      <div className="px-2 py-1 border-b space-y-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground w-8">{t('stockResearch.industry')}:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-xs hover:text-primary truncate flex-1 text-left">
                {stock.industry || t('stockResearch.selectIndustry')}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              {INDUSTRIES_CN.map(ind => (
                <DropdownMenuItem key={ind.key} className="text-xs" onClick={() => onUpdateStockInfo({ industry: ind.name })}>
                  {ind.icon} {ind.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground w-8">{t('stockResearch.sector')}:</span>
          <input
            className="flex-1 text-xs bg-transparent outline-none border-b border-transparent hover:border-border focus:border-primary px-0.5"
            value={stock.sector}
            onChange={(e) => onUpdateStockInfo({ sector: e.target.value })}
            placeholder={t('stockResearch.inputSector')}
          />
        </div>
      </div>

      {/* 标签 */}
      <div className="px-2 py-1 border-b">
        <div className="flex items-center gap-1 flex-wrap">
          <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          {stock.tags.map((tag, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-0.5 group"
            >
              {tag}
              <button
                className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                onClick={() => onUpdateStockInfo({ tags: stock.tags.filter((_, idx) => idx !== i) })}
                title={t('stockResearch.removeTag')}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {showTagInput ? (
            <input
              type="text"
              className="text-[10px] px-1 py-0.5 rounded border border-primary outline-none w-20"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={() => {
                if (tagInput.trim()) {
                  onUpdateStockInfo({ tags: [...stock.tags, tagInput.trim()] });
                }
                setTagInput('');
                setShowTagInput(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (tagInput.trim()) {
                    onUpdateStockInfo({ tags: [...stock.tags, tagInput.trim()] });
                  }
                  setTagInput('');
                  setShowTagInput(false);
                }
              }}
              placeholder={t('stockResearch.tagPlaceholder')}
              title={t('stockResearch.tagInputTitle')}
              autoFocus
            />
          ) : (
            <button
              className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
              onClick={() => setShowTagInput(true)}
              title={t('stockResearch.addTag')}
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* 公司简介 */}
      <div className="px-2 py-1 border-b">
        <div className="flex items-start gap-1">
          <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
          <Textarea
            value={stock.description || ''}
            onChange={(e) => onUpdateStockInfo({ description: e.target.value })}
            placeholder={t('stockResearch.companyDescriptionPlaceholder')}
            className="min-h-[60px] text-[11px] resize-none border-0 p-0 focus-visible:ring-0 bg-transparent"
            rows={3}
          />
        </div>
      </div>

      {/* 市值/货币 */}
      <div className="px-2 py-1 border-b">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 flex-1">
            <Scale className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{t('stockResearch.marketCap')}:</span>
            <input
              type="number"
              className="flex-1 text-xs bg-transparent outline-none border-b border-transparent hover:border-border focus:border-primary px-0.5"
              value={stock.marketCap || ''}
              onChange={(e) => onUpdateStockInfo({ marketCap: e.target.value ? Number(e.target.value) : undefined })}
              placeholder={t('stockResearch.inputMarketCap')}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{t('stockResearch.currency')}:</span>
            {stock.market && MARKET_CODES[stock.market] ? (
              <span className="text-xs">{MARKET_CODES[stock.market].currency}</span>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 论点列表 */}
        <div className="border-b">
          <button
            className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-accent text-xs font-medium"
            onClick={() => toggleSection('theses')}
          >
            {expandedSections.has('theses') ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Target className="h-3 w-3 text-amber-500" />
            <span>{t('stockResearch.theses')}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{theses.length}</span>
          </button>
          {expandedSections.has('theses') && (
            <div className="px-2 pb-1 space-y-0.5">
              {activeTheses.length === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-2">
                  {t('stockResearch.noTheses')}
                </div>
              )}
              {activeTheses.map(thesis => (
                <div
                  key={thesis.id}
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-1 rounded text-[11px] cursor-pointer hover:bg-accent',
                    thesis.status === 'bullish' && 'text-green-600',
                    thesis.status === 'bearish' && 'text-red-600',
                  )}
                >
                  <span>{thesis.status === 'bullish' ? '📈' : thesis.status === 'bearish' ? '📉' : '➖'}</span>
                  <span className="flex-1 truncate">{thesis.title}</span>
                  {thesis.targetPrice && <span className="text-[10px] text-muted-foreground">¥{thesis.targetPrice}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 笔记列表 */}
        <div className="border-b">
          <div
            className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-accent text-xs font-medium cursor-pointer"
            onClick={() => toggleSection('notes')}
          >
            {expandedSections.has('notes') ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <FileText className="h-3 w-3 text-blue-500" />
            <span>{t('stockResearch.notes')}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{notes.length}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 ml-1"
              onClick={(e) => { e.stopPropagation(); onAddNote(); }}
            >
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </div>
          {expandedSections.has('notes') && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={notes.map(n => n.id)} strategy={verticalListSortingStrategy}>
                <div className="px-2 pb-1 space-y-0.5">
                  {notes.length === 0 && (
                    <div className="text-[10px] text-muted-foreground text-center py-2">
                      {t('stockResearch.noNotes')}
                    </div>
                  )}
                  {notes.map(note => (
                    <SortableNoteItem
                      key={note.id}
                      note={note}
                      isActive={activeNoteId === note.id}
                      isEditing={editingNoteId === note.id}
                      editingTitle={editingNoteTitle}
                      onSelect={() => onSelectNote(note.id)}
                      onStartEdit={() => { setEditingNoteTitle(note.title); setEditingNoteId(note.id); }}
                      onEditingTitleChange={setEditingNoteTitle}
                      onFinishEdit={(title) => {
                        if (title.trim()) onRenameNote(note.id, title.trim());
                        setEditingNoteId(null);
                      }}
                      onCancelEdit={() => setEditingNoteId(null)}
                      onDelete={() => onDeleteNote(note.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* 底部统计 */}
      <div className="px-2 py-1 border-t text-[10px] text-muted-foreground space-y-0.5 flex-shrink-0">
        <div className="flex justify-between">
          <span>{t('stockResearch.thesisCount')}: {theses.length}</span>
          <span>{t('stockResearch.tradeCount')}: {research.trades.length}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('stockResearch.noteCount')}: {notes.length}</span>
          <span>{t('stockResearch.newsCount')}: {research.news.length}</span>
        </div>
      </div>
    </div>
  );
}
