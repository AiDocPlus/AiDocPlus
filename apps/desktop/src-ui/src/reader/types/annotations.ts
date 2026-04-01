// ── 批注与高亮系统 — 类型定义 ──

/** 批注类型 */
export type AnnotationType = 'highlight' | 'note' | 'bookmark';

/** 高亮颜色 */
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange';

/** 通用位置描述（各渲染器可扩展） */
export interface TextPosition {
  /** 滚动位置（Markdown/HTML） */
  scrollPosition?: number;
  /** 进度百分比 */
  progressPercent?: number;
  /** EPUB CFI range */
  epubCfiRange?: string;
  /** PDF 页码 */
  pdfPage?: number;
}

/** 选中文本快照 */
export interface TextSnapshot {
  /** 选中的文本内容 */
  text: string;
  /** 选中文本前后的上下文（各约50字符） */
  before?: string;
  after?: string;
}

/** 单个批注 */
export interface Annotation {
  id: string;
  /** 关联的书籍 filename */
  filename: string;
  type: AnnotationType;
  /** 高亮颜色（仅 highlight 类型） */
  color?: HighlightColor;
  /** 位置信息 */
  position: TextPosition;
  /** 选中文本快照 */
  textSnapshot?: TextSnapshot;
  /** 用户笔记（仅 note 类型） */
  note?: string;
  /** 书签标签（仅 bookmark 类型） */
  label?: string;
  createdAt: string;
  updatedAt: string;
}

/** 按文件名索引的批注 */
export type AnnotationsMap = Record<string, Annotation[]>;

/** 高亮颜色预设 */
export const HIGHLIGHT_COLORS: { id: HighlightColor; labelKey: string; bg: string; border: string }[] = [
  { id: 'yellow',  labelKey: 'reader.colorYellow',  bg: 'rgba(255, 235, 59, 0.3)',  border: '#fbc02d' },
  { id: 'green',   labelKey: 'reader.colorGreen',   bg: 'rgba(76, 175, 80, 0.25)',   border: '#66bb6a' },
  { id: 'blue',    labelKey: 'reader.colorBlue',    bg: 'rgba(33, 150, 243, 0.25)',  border: '#42a5f5' },
  { id: 'pink',    labelKey: 'reader.colorPink',    bg: 'rgba(233, 30, 99, 0.2)',    border: '#ec407a' },
  { id: 'purple',  labelKey: 'reader.colorPurple',  bg: 'rgba(156, 39, 176, 0.2)',   border: '#ab47bc' },
  { id: 'orange',  labelKey: 'reader.colorOrange',  bg: 'rgba(255, 152, 0, 0.25)',   border: '#ffa726' },
];
