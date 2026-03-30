/**
 * 仿写文档类型 — 数据结构与工具函数
 */

// ═══ 基础类型 ═══

export type EditorMode = 'markdown' | 'html';
export type SourceViewMode = EditorMode | 'docx-viewer' | 'pdf-viewer';

export type WritingGenre =
  | 'novel-long' | 'novel-medium' | 'novel-short' | 'novel-mini'
  | 'prose-lyrical' | 'prose-narrative' | 'prose-essay' | 'prose-sketch'
  | 'poetry-modern' | 'poetry-classical' | 'poetry-prose'
  | 'drama' | 'custom';

export type NoteCategory =
  | 'analysis'
  | 'technique'
  | 'comparison'
  | 'inspiration'
  | 'reflection'
  | 'other';

export type ImitationMode = 'full' | 'fragment' | 'style' | 'structure';

export type FocusArea =
  | 'rhetoric' | 'imagery' | 'rhythm' | 'narrative' | 'dialogue'
  | 'description' | 'emotion' | 'structure' | 'opening' | 'ending' | 'transition';

export type AnnotationType = 'rhetoric' | 'structure' | 'imagery' | 'rhythm' | 'narrative' | 'note';

// ═══ 原文批注 ═══

export interface SourceAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  text: string;
  type: AnnotationType;
  label: string;
  note: string;
  autoDetected: boolean;
}

// ═══ 笔记 ═══

export interface WritingNote {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  source: 'manual' | 'ai';
  aiActionId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
}

// ═══ 仿写草稿 ═══

export interface ImitationDraft {
  id: string;
  text: string;
  editorMode: EditorMode;
  createdAt: string;
  label: string;
}

// ═══ 仿写设置 ═══

export interface ImitationSettings {
  imitationMode: ImitationMode;
  focusAreas: FocusArea[];
  targetWordCount: number;
  keepStructure: boolean;
  customRequirement: string;
}

// ═══ AI 分析缓存 ═══

export interface AnalysisCache {
  genre: WritingGenre;
  structureAnalysis: string;
  rhetoricAnalysis: string;
  styleAnalysis: string;
  keyTechniques: string[];
  analyzedAt: string;
}

// ═══ 写作快照 ═══

export interface WritingSnapshot {
  id: string;
  sourceText: string;
  imitationText: string;
  createdAt: string;
  label: string;
  wordCount: number;
}

// ═══ 主数据模型 ═══

export interface ImitativeWritingContent {
  version: 1;
  genre: WritingGenre;
  subGenre: string;
  source: {
    text: string;
    title: string;
    author: string;
    era: string;
    style: string;
    editorMode: EditorMode;
    annotations: SourceAnnotation[];
    officeFile?: {
      path: string;
      name: string;
      type: 'docx' | 'pdf';
      extractedText?: string;
    };
  };
  imitation: {
    text: string;
    editorMode: EditorMode;
    drafts: ImitationDraft[];
  };
  notes: WritingNote[];
  settings: ImitationSettings;
  analysisCache: AnalysisCache | null;
  snapshots: WritingSnapshot[];
}

export interface OfficeFileInfo {
  path: string;
  name: string;
  type: 'docx' | 'pdf';
  extractedText?: string;
}

// ═══ 工具函数 ═══

export function createEmptyImitativeWritingContent(): ImitativeWritingContent {
  return {
    version: 1,
    genre: 'prose-lyrical',
    subGenre: '',
    source: {
      text: '',
      title: '',
      author: '',
      era: '',
      style: '',
      editorMode: 'markdown',
      annotations: [],
    },
    imitation: {
      text: '',
      editorMode: 'markdown',
      drafts: [],
    },
    notes: [],
    settings: {
      imitationMode: 'full',
      focusAreas: [],
      targetWordCount: 500,
      keepStructure: true,
      customRequirement: '',
    },
    analysisCache: null,
    snapshots: [],
  };
}

export function parseImitativeWritingContent(raw: string): ImitativeWritingContent {
  try {
    const data = JSON.parse(raw) as Partial<ImitativeWritingContent>;
    const empty = createEmptyImitativeWritingContent();
    return {
      ...empty,
      ...data,
      source: { ...empty.source, ...(data.source || {}) },
      imitation: { ...empty.imitation, ...(data.imitation || {}) },
      settings: { ...empty.settings, ...(data.settings || {}) },
      notes: data.notes || [],
      snapshots: data.snapshots || [],
    };
  } catch {
    return createEmptyImitativeWritingContent();
  }
}

export function countWords(text: string): number {
  if (!text) return 0;
  const clean = text.replace(/<[^>]*>/g, '');
  const chinese = (clean.match(/[\u4e00-\u9fa5]/g) || []).length;
  const english = (clean.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b[a-zA-Z]+\b/g) || []).length;
  return chinese + english;
}

/** 由工作区传入，用于侧栏子面板回写文档（如 analysisCache） */
export type PatchImitativeDocFn = (
  updater: (prev: ImitativeWritingContent) => ImitativeWritingContent,
) => void;

export function createNote(partial: Partial<WritingNote> & { title: string; content: string }): WritingNote {
  const now = new Date().toISOString();
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: 'analysis',
    source: 'manual',
    tags: [],
    createdAt: now,
    updatedAt: now,
    pinned: false,
    ...partial,
  };
}
