import { useState, useCallback, useRef, useEffect } from 'react';
import type { SlidesDeck, Slide, PptTheme, PptThemeFontSizes } from '@aidocplus/shared-types';
import { BUILT_IN_PPT_THEMES, DEFAULT_FONT_SIZES } from '@aidocplus/shared-types';
import { SlidePreview } from './SlidePreview';
import { SlideEditor } from './SlideEditor';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  MarkdownEditor,
} from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ChevronLeft, ChevronRight, Edit3, Eye, Palette, Plus, Trash2, Copy, ArrowUp, ArrowDown, GripVertical, Code, Download, Check, Type, Play, Undo2, Redo2 } from 'lucide-react';
import { SlideShow } from './SlideShow';
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { slidesToMarkdown, parseSlidesFromAiResponse } from './slideAiPrompts';

interface SlideDeckProps {
  deck: SlidesDeck;
  onDeckChange: (deck: SlidesDeck) => void;
  onExportPptx?: () => void;
  onExportPptxAndOpen?: (app?: string) => void;
}

export function SlideDeck({ deck, onDeckChange, onExportPptx, onExportPptxAndOpen }: SlideDeckProps) {
  const host = usePluginHost();
  const t = host.platform.t;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const sourceSlideIndexRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // 撤销/重做历史记录
  const [past, setPast] = useState<SlidesDeck[]>([]);
  const [future, setFuture] = useState<SlidesDeck[]>([]);

  // 保存历史记录（在执行操作前调用）
  const saveHistory = useCallback(() => {
    setPast(prev => [...prev, deck]);
    setFuture([]); // 新操作清空重做栈
  }, [deck]);

  // 撤销
  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(prev => prev.slice(0, -1));
    setFuture(prev => [deck, ...prev]);
    onDeckChange(previous);
    setSelectedIndex(Math.min(selectedIndex, previous.slides.length - 1));
  }, [past, deck, selectedIndex, onDeckChange]);

  // 重做
  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(prev => prev.slice(1));
    setPast(prev => [...prev, deck]);
    onDeckChange(next);
    setSelectedIndex(Math.min(selectedIndex, next.slides.length - 1));
  }, [future, deck, selectedIndex, onDeckChange]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const currentFontSizes = { ...DEFAULT_FONT_SIZES, ...deck.theme.fontSizes };

  const handleFontSizeChange = useCallback((preset: string) => {
    const scales: Record<string, number> = { small: 0.75, medium: 1, large: 1.25, xlarge: 1.5 };
    const scale = scales[preset] ?? 1;
    const newFontSizes: PptThemeFontSizes = {
      title: Math.round(DEFAULT_FONT_SIZES.title * scale),
      subtitle: Math.round(DEFAULT_FONT_SIZES.subtitle * scale),
      heading: Math.round(DEFAULT_FONT_SIZES.heading * scale),
      body: Math.round(DEFAULT_FONT_SIZES.body * scale),
    };
    onDeckChange({ ...deck, theme: { ...deck.theme, fontSizes: newFontSizes } });
  }, [deck, onDeckChange]);
  const thumbListRef = useRef<HTMLDivElement>(null);

  // 选中幻灯片变化时，自动滚动缩略图到可见区域
  useEffect(() => {
    const container = thumbListRef.current;
    if (!container) return;
    const child = container.children[selectedIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selectedIndex, showSource]);

  const currentSlide = deck.slides[selectedIndex];

  const handleSlideUpdate = useCallback((updatedSlide: Slide) => {
    const newSlides = deck.slides.map((s, i) => i === selectedIndex ? updatedSlide : s);
    onDeckChange({ ...deck, slides: newSlides });
  }, [deck, selectedIndex, onDeckChange]);

  const handleAddSlide = useCallback(() => {
    const newSlide: Slide = {
      id: `slide_${Date.now()}`,
      layout: 'content',
      title: t('slides.newSlide', { defaultValue: '新幻灯片' }),
      content: [],
      order: deck.slides.length,
    };
    const newSlides = [...deck.slides, newSlide];
    onDeckChange({ ...deck, slides: newSlides });
    setSelectedIndex(newSlides.length - 1);
  }, [deck, onDeckChange, t]);

  const handleDuplicateSlide = useCallback(() => {
    if (!currentSlide) return;
    const dup: Slide = { ...currentSlide, id: `slide_${Date.now()}`, order: selectedIndex + 1 };
    const newSlides = [...deck.slides];
    newSlides.splice(selectedIndex + 1, 0, dup);
    onDeckChange({ ...deck, slides: newSlides.map((s, i) => ({ ...s, order: i })) });
    setSelectedIndex(selectedIndex + 1);
  }, [deck, currentSlide, selectedIndex, onDeckChange]);

  const handleDeleteSlide = useCallback(() => {
    if (deck.slides.length <= 1) return;
    saveHistory();
    const newSlides = deck.slides.filter((_, i) => i !== selectedIndex);
    onDeckChange({ ...deck, slides: newSlides.map((s, i) => ({ ...s, order: i })) });
    setSelectedIndex(Math.min(selectedIndex, newSlides.length - 1));
  }, [deck, selectedIndex, onDeckChange, saveHistory]);

  const handleMoveSlide = useCallback((direction: -1 | 1) => {
    const newIndex = selectedIndex + direction;
    if (newIndex < 0 || newIndex >= deck.slides.length) return;
    const newSlides = [...deck.slides];
    [newSlides[selectedIndex], newSlides[newIndex]] = [newSlides[newIndex], newSlides[selectedIndex]];
    onDeckChange({ ...deck, slides: newSlides.map((s, i) => ({ ...s, order: i })) });
    setSelectedIndex(newIndex);
  }, [deck, selectedIndex, onDeckChange]);

  const handleThemeChange = useCallback((theme: PptTheme) => {
    onDeckChange({ ...deck, theme });
    setShowThemes(false);
  }, [deck, onDeckChange]);

  const handlePrev = () => setSelectedIndex(Math.max(0, selectedIndex - 1));
  const handleNext = () => setSelectedIndex(Math.min(deck.slides.length - 1, selectedIndex + 1));

  // dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = deck.slides.findIndex(s => s.id === active.id);
    const newIndex = deck.slides.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newSlides = [...deck.slides];
    const [moved] = newSlides.splice(oldIndex, 1);
    newSlides.splice(newIndex, 0, moved);
    onDeckChange({ ...deck, slides: newSlides.map((s, i) => ({ ...s, order: i })) });
    // 跟随选中项
    if (selectedIndex === oldIndex) {
      setSelectedIndex(newIndex);
    } else if (selectedIndex > oldIndex && selectedIndex <= newIndex) {
      setSelectedIndex(selectedIndex - 1);
    } else if (selectedIndex < oldIndex && selectedIndex >= newIndex) {
      setSelectedIndex(selectedIndex + 1);
    }
  }, [deck, selectedIndex, onDeckChange]);

  return (
    <>
    {isPlaying && (
      <SlideShow
        deck={deck}
        startIndex={selectedIndex}
        onExit={() => setIsPlaying(false)}
      />
    )}
    <div className="h-full flex flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
        {/* 左侧：幻灯片信息 */}
        <span className="text-sm font-medium">
          {t('slides.slideCount', { defaultValue: '幻灯片' })}: {deck.slides.length}
        </span>
        <span className="text-xs text-muted-foreground">
          ({selectedIndex + 1}/{deck.slides.length})
        </span>

        <div className="flex-1" />

        {/* 幻灯片操作：新增、复制、删除、上移、下移 */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAddSlide} title={t('slides.addSlide', { defaultValue: '新增' })}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDuplicateSlide} title={t('slides.duplicate', { defaultValue: '复制幻灯片' })}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDeleteSlide} disabled={deck.slides.length <= 1} title={t('slides.deleteSlide', { defaultValue: '删除' })}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveSlide(-1)} disabled={selectedIndex === 0} title={t('slides.moveUp', { defaultValue: '上移' })}>
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveSlide(1)} disabled={selectedIndex === deck.slides.length - 1} title={t('slides.moveDown', { defaultValue: '下移' })}>
          <ArrowDown className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* 撤销/重做 */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUndo} disabled={past.length === 0} title={t('slides.undo', { defaultValue: '撤销 (Cmd+Z)' })}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRedo} disabled={future.length === 0} title={t('slides.redo', { defaultValue: '重做 (Cmd+Shift+Z)' })}>
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* 视图切换：编辑/预览、Markdown源码、播放 */}
        <Button variant={editMode ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => { setEditMode(!editMode); setShowSource(false); }} title={editMode ? t('slides.preview', { defaultValue: '预览' }) : t('slides.edit', { defaultValue: '编辑' })}>
          {editMode ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
        </Button>
        <Button variant={showSource ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => {
          if (showSource) {
            setSelectedIndex(sourceSlideIndexRef.current);
          }
          setShowSource(!showSource); setEditMode(false);
        }} title={showSource ? t('slides.backToPreview', { defaultValue: '返回预览' }) : t('slides.viewSource', { defaultValue: 'Markdown 源码' })}>
          {showSource ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsPlaying(true)} title={t('slides.play', { defaultValue: '全屏播放' })}>
          <Play className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* 样式设置：主题、字体大小 */}
        <Button variant={showThemes ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setShowThemes(!showThemes)} title={t('slides.theme', { defaultValue: '主题' })}>
          <Palette className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title={t('slides.fontSize', { defaultValue: '字体大小' })}>
              <Type className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs">{t('slides.fontSize', { defaultValue: '字体大小' })}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { key: 'small', label: '小', sizes: '33/17/21/15' },
              { key: 'medium', label: '中（默认）', sizes: '44/22/28/20' },
              { key: 'large', label: '大', sizes: '55/28/35/25' },
              { key: 'xlarge', label: '特大', sizes: '66/33/42/30' },
            ].map(p => (
              <DropdownMenuItem
                key={p.key}
                onClick={() => handleFontSizeChange(p.key)}
                className={currentFontSizes.title === Math.round(DEFAULT_FONT_SIZES.title * ({ small: 0.75, medium: 1, large: 1.25, xlarge: 1.5 }[p.key] ?? 1)) ? 'bg-muted' : ''}
              >
                <span className="flex-1">{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.sizes}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {(onExportPptx || onExportPptxAndOpen) && (
          <>
            <div className="w-px h-5 bg-border mx-1" />

            {/* 导出 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title={t('slides.exportPptx', { defaultValue: '导出 PPTX' })}>
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onExportPptx && (
                  <DropdownMenuItem onClick={onExportPptx}>
                    <Download className="h-4 w-4 mr-2" />
                    {t('slides.exportPptxFile', { defaultValue: '导出 PPTX 文件' })}
                  </DropdownMenuItem>
                )}
                {onExportPptxAndOpen && (
                  <>
                    <DropdownMenuItem onClick={() => onExportPptxAndOpen('WPS Office')}>
                      导出并用 WPS 打开
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExportPptxAndOpen('Microsoft PowerPoint')}>
                      导出并用 PowerPoint 打开
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* 主题选择器 */}
      {showThemes && (
        <div className="px-4 py-3 border-b flex-shrink-0">
          <div className="text-xs font-medium mb-2 text-muted-foreground">{t('slides.selectTheme', { defaultValue: '选择主题' })}</div>
          <div className="flex gap-2 flex-wrap">
            {BUILT_IN_PPT_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs transition-all ${
                  deck.theme.id === theme.id ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.colors.primary }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.colors.background, border: '1px solid #ddd' }} />
                </div>
                {theme.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {showSource ? (
          /* 源码编辑占据整个面板 */
          <SourceView
            deck={deck}
            onDeckChange={onDeckChange}
            initialSlideIndex={selectedIndex}
            onSlideIndexChange={(idx) => { sourceSlideIndexRef.current = idx; }}
            onDone={(idx) => { setSelectedIndex(idx); setShowSource(false); }}
          />
        ) : (
          <>
        {/* 左侧缩略图列表（可拖拽排序） */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={deck.slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div ref={thumbListRef} className="w-48 flex-shrink-0 border-r overflow-y-auto p-2 space-y-2">
              {deck.slides.map((slide, index) => (
                <SortableThumbnail
                  key={slide.id}
                  slide={slide}
                  index={index}
                  theme={deck.theme}
                  selected={index === selectedIndex}
                  onClick={() => setSelectedIndex(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* 右侧大预览/编辑 */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto">
          {currentSlide && editMode ? (
            <SlideEditor
              slide={currentSlide}
              onSlideChange={handleSlideUpdate}
            />
          ) : currentSlide ? (
            <>
              <SlidePreview
                slide={currentSlide}
                theme={deck.theme}
              />
              {/* 导航按钮 */}
              <div className="flex items-center gap-4 mt-4">
                <Button variant="outline" size="icon" onClick={handlePrev} disabled={selectedIndex === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedIndex + 1} / {deck.slides.length}
                </span>
                <Button variant="outline" size="icon" onClick={handleNext} disabled={selectedIndex === deck.slides.length - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {/* 演讲者备注 */}
              {currentSlide.notes && (
                <div className="mt-4 w-full max-w-[640px] p-3 bg-muted/50 rounded-md">
                  <div className="text-xs font-medium text-muted-foreground mb-1">{t('slides.speakerNotes', { defaultValue: '演讲者备注' })}</div>
                  <div className="text-sm">{currentSlide.notes}</div>
                </div>
              )}
            </>
          ) : null}
        </div>
          </>
        )}
      </div>
    </div>
  </>
  );
}

/** 可拖拽排序的缩略图 */
function SortableThumbnail({
  slide,
  index,
  theme,
  selected,
  onClick,
}: {
  slide: Slide;
  index: number;
  theme: PptTheme;
  selected: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="flex items-center gap-0.5">
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <div className="text-[10px] text-muted-foreground">{index + 1}</div>
      </div>
      <SlidePreview
        slide={slide}
        theme={theme}
        width={160}
        selected={selected}
        onClick={onClick}
      />
    </div>
  );
}

/** 计算第 N 张幻灯片在 Markdown 源码中的起始行号（1-indexed） */
function getSlideStartLine(text: string, slideIndex: number): number {
  const lines = text.split('\n');
  let slideCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 第一张幻灯片从第 1 行开始
    if (i === 0) {
      if (slideCount === slideIndex) return 1;
    }
    // --- 分隔符后是下一张
    if (/^-{3,}$/.test(trimmed) && i > 0) {
      slideCount++;
      if (slideCount === slideIndex) return i + 2; // 分隔符下一行
    }
  }
  return 1;
}

/** 根据光标行号确定当前在第几张幻灯片 */
function getSlideIndexAtLine(text: string, lineNumber: number): number {
  const lines = text.split('\n');
  let slideIndex = 0;
  for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
    if (/^-{3,}$/.test(lines[i].trim()) && i > 0) {
      slideIndex++;
    }
  }
  return slideIndex;
}

/** Markdown 源码编辑视图 */
function SourceView({ deck, onDeckChange, initialSlideIndex, onSlideIndexChange, onDone }: {
  deck: SlidesDeck;
  onDeckChange: (deck: SlidesDeck) => void;
  initialSlideIndex: number;
  onSlideIndexChange: (idx: number) => void;
  onDone: (slideIndex: number) => void;
}) {
  const host = usePluginHost();
  const t = host.platform.t;
  const [sourceText, setSourceText] = useState(() => slidesToMarkdown(deck.slides));
  const [statusMsg, setStatusMsg] = useState('');
  const currentSlideIdxRef = useRef(initialSlideIndex);

  const initialLine = getSlideStartLine(sourceText, initialSlideIndex);

  const handleCursorLineChange = useCallback((line: number) => {
    const idx = getSlideIndexAtLine(sourceText, line);
    currentSlideIdxRef.current = idx;
    onSlideIndexChange(idx);
  }, [sourceText, onSlideIndexChange]);

  const handleApply = () => {
    const parsed = parseSlidesFromAiResponse(sourceText);
    if (!parsed || parsed.length === 0) {
      setStatusMsg(t('slides.sourceParseError', { defaultValue: '解析失败：Markdown 格式无效或为空' }));
      return;
    }
    const newSlides = parsed.map((s, i) => ({
      id: deck.slides[i]?.id || `slide_${Date.now()}_${i}`,
      layout: s.layout,
      title: s.title,
      subtitle: s.subtitle,
      content: s.content,
      notes: s.notes,
      order: i,
    }));
    onDeckChange({ ...deck, slides: newSlides });
    setStatusMsg('');
    const idx = Math.min(currentSlideIdxRef.current, newSlides.length - 1);
    onDone(idx);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 flex-shrink-0">
        <span className="text-sm font-medium">{t('slides.markdownSource', { defaultValue: 'Markdown 源码' })}</span>
        <div className="flex items-center gap-2">
          {statusMsg && <span className="text-xs text-destructive">{statusMsg}</span>}
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleApply}>
            <Check className="h-3.5 w-3.5" />
            {t('slides.applyChanges', { defaultValue: '应用修改' })}
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MarkdownEditor
          value={sourceText}
          onChange={setSourceText}
          showToolbar={true}
          showViewModeSwitch={false}
          editable={true}
          initialLine={initialLine}
          onCursorLineChange={handleCursorLineChange}
        />
      </div>
    </div>
  );
}
