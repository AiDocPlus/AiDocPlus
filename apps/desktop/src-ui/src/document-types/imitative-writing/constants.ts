/**
 * 仿写文档类型 — 常量与配置
 */
import type { WritingGenre, NoteCategory, FocusArea, ImitationMode } from './types';

// ═══ 布局尺寸 ═══

export const NOTES_DEFAULT_WIDTH = 220;
export const NOTES_MIN_WIDTH = 160;
export const NOTES_MAX_WIDTH = 300;

export const AI_DEFAULT_WIDTH = 400;
export const AI_MIN_WIDTH = 300;
export const AI_MAX_WIDTH = 560;

export const TOOLBAR_HEIGHT = 40;
export const STATUS_BAR_HEIGHT = 24;

// ═══ 布局模式 ═══

export type LayoutMode = 'four-col' | 'three-col' | 'top-bottom' | 'focus-write' | 'focus-read';

export const LAYOUT_MODES: { value: LayoutMode; labelKey: string }[] = [
  { value: 'four-col', labelKey: 'imitativeWriting.layout.fourCol' },
  { value: 'three-col', labelKey: 'imitativeWriting.layout.threeCol' },
  { value: 'top-bottom', labelKey: 'imitativeWriting.layout.topBottom' },
  { value: 'focus-write', labelKey: 'imitativeWriting.layout.focusWrite' },
  { value: 'focus-read', labelKey: 'imitativeWriting.layout.focusRead' },
];

// ═══ 文学体裁 ═══

export interface GenreOption {
  value: WritingGenre;
  labelKey: string;
  group: string;
}

export const GENRE_OPTIONS: GenreOption[] = [
  { value: 'novel-long', labelKey: 'imitativeWriting.genre.novelLong', group: 'novel' },
  { value: 'novel-medium', labelKey: 'imitativeWriting.genre.novelMedium', group: 'novel' },
  { value: 'novel-short', labelKey: 'imitativeWriting.genre.novelShort', group: 'novel' },
  { value: 'novel-mini', labelKey: 'imitativeWriting.genre.novelMini', group: 'novel' },
  { value: 'prose-lyrical', labelKey: 'imitativeWriting.genre.proseLyrical', group: 'prose' },
  { value: 'prose-narrative', labelKey: 'imitativeWriting.genre.proseNarrative', group: 'prose' },
  { value: 'prose-essay', labelKey: 'imitativeWriting.genre.proseEssay', group: 'prose' },
  { value: 'prose-sketch', labelKey: 'imitativeWriting.genre.proseSketch', group: 'prose' },
  { value: 'poetry-modern', labelKey: 'imitativeWriting.genre.poetryModern', group: 'poetry' },
  { value: 'poetry-classical', labelKey: 'imitativeWriting.genre.poetryClassical', group: 'poetry' },
  { value: 'poetry-prose', labelKey: 'imitativeWriting.genre.poetryProse', group: 'poetry' },
  { value: 'drama', labelKey: 'imitativeWriting.genre.drama', group: 'drama' },
  { value: 'custom', labelKey: 'imitativeWriting.genre.custom', group: 'other' },
];

export const GENRE_GROUP_LABELS: Record<string, string> = {
  novel: 'imitativeWriting.genreGroup.novel',
  prose: 'imitativeWriting.genreGroup.prose',
  poetry: 'imitativeWriting.genreGroup.poetry',
  drama: 'imitativeWriting.genreGroup.drama',
  other: 'imitativeWriting.genreGroup.other',
};

// ═══ 笔记分类 ═══

export interface NoteCategoryOption {
  value: NoteCategory;
  labelKey: string;
  color: string;
}

export const NOTE_CATEGORIES: NoteCategoryOption[] = [
  { value: 'analysis', labelKey: 'imitativeWriting.noteCategory.analysis', color: 'bg-blue-500' },
  { value: 'technique', labelKey: 'imitativeWriting.noteCategory.technique', color: 'bg-purple-500' },
  { value: 'comparison', labelKey: 'imitativeWriting.noteCategory.comparison', color: 'bg-amber-500' },
  { value: 'inspiration', labelKey: 'imitativeWriting.noteCategory.inspiration', color: 'bg-green-500' },
  { value: 'reflection', labelKey: 'imitativeWriting.noteCategory.reflection', color: 'bg-pink-500' },
  { value: 'other', labelKey: 'imitativeWriting.noteCategory.other', color: 'bg-gray-500' },
];

// ═══ 仿写模式 ═══

export const IMITATION_MODES: { value: ImitationMode; labelKey: string }[] = [
  { value: 'full', labelKey: 'imitativeWriting.imitationMode.full' },
  { value: 'fragment', labelKey: 'imitativeWriting.imitationMode.fragment' },
  { value: 'style', labelKey: 'imitativeWriting.imitationMode.style' },
  { value: 'structure', labelKey: 'imitativeWriting.imitationMode.structure' },
];

// ═══ 焦点区域 ═══

export const FOCUS_AREAS: { value: FocusArea; labelKey: string }[] = [
  { value: 'rhetoric', labelKey: 'imitativeWriting.focusArea.rhetoric' },
  { value: 'imagery', labelKey: 'imitativeWriting.focusArea.imagery' },
  { value: 'rhythm', labelKey: 'imitativeWriting.focusArea.rhythm' },
  { value: 'narrative', labelKey: 'imitativeWriting.focusArea.narrative' },
  { value: 'dialogue', labelKey: 'imitativeWriting.focusArea.dialogue' },
  { value: 'description', labelKey: 'imitativeWriting.focusArea.description' },
  { value: 'emotion', labelKey: 'imitativeWriting.focusArea.emotion' },
  { value: 'structure', labelKey: 'imitativeWriting.focusArea.structure' },
  { value: 'opening', labelKey: 'imitativeWriting.focusArea.opening' },
  { value: 'ending', labelKey: 'imitativeWriting.focusArea.ending' },
  { value: 'transition', labelKey: 'imitativeWriting.focusArea.transition' },
];

// ═══ 原文视图模式 ═══

export type SourceViewMode = 'markdown' | 'html' | 'docx-viewer' | 'pdf-viewer';

export const SOURCE_VIEW_MODES: { value: SourceViewMode; labelKey: string }[] = [
  { value: 'markdown', labelKey: 'imitativeWriting.viewMode.markdown' },
  { value: 'html', labelKey: 'imitativeWriting.viewMode.html' },
  { value: 'docx-viewer', labelKey: 'imitativeWriting.viewMode.docxViewer' },
  { value: 'pdf-viewer', labelKey: 'imitativeWriting.viewMode.pdfViewer' },
];
