/**
 * 图片插件类型定义
 *
 * 定义画布数据、图层、滤镜、模板、GIF 帧、AI 上下文等核心类型。
 */

// ── 单个画布数据 ──

export interface ImageCanvas {
  id: string;
  title: string;
  width: number;
  height: number;
  /** Fabric.js canvas.toJSON() 完整序列化 */
  fabricJson: Record<string, unknown>;
  /** base64 缩略图（JPEG q=0.3, max 200px） */
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

// ── 插件持久化数据 ──

export interface ImagePluginData {
  canvases: ImageCanvas[];
  activeCanvasId: string;
  version: number;
}

// ── 画布阶段（上下文引擎用） ──

export type ImagePhase = 'blank' | 'sketching' | 'composing' | 'polishing';

// ── AI 上下文 ──

export type ImageContextMode = 'none' | 'objects' | 'layout' | 'colors';

export const IMAGE_CONTEXT_MODE_LABELS: Record<ImageContextMode, string> = {
  none: '随便聊聊',
  objects: '对象列表',
  layout: '布局分析',
  colors: '色彩搭配',
};

export interface ImageContextLayer {
  label: string;
  content: string;
  priority: 'critical' | 'important' | 'supplementary';
}

// ── GIF 帧 ──

export interface GifFrame {
  fabricJson: Record<string, unknown>;
  delay: number;
  label?: string;
}

// ── 图形库条目 ──

export type ShapeCategory = 'basic' | 'arrow' | 'flowchart' | 'annotation' | 'icon' | 'infographic';

export interface ShapeTemplate {
  id: string;
  name: string;
  category: ShapeCategory;
  fabricJson: Record<string, unknown>;
  svgPreview: string;
}

// ── 画布预设模板 ──

export interface CanvasTemplate {
  id: string;
  name: string;
  category: 'social' | 'document' | 'infographic' | 'business';
  width: number;
  height: number;
  fabricJson?: Record<string, unknown>;
}

// ── 滤镜预设 ──

export interface FilterPreset {
  id: string;
  name: string;
  filters: Array<{ type: string; [key: string]: unknown }>;
}

// ── AI 动作类型 ──

export type ImageAiActionType =
  | 'add_shape'       // 添加形状
  | 'add_text'        // 添加文本
  | 'add_image'       // 添加图片（URL/SVG）
  | 'modify_object'   // 修改选中对象属性
  | 'delete_objects'   // 删除对象
  | 'set_canvas_bg'   // 设置画布背景
  | 'apply_filter'    // 应用滤镜
  | 'arrange_layout'  // 自动排列布局
  | 'group_objects'   // 组合对象
  | 'align_objects'   // 对齐对象
  | 'load_svg'        // 加载 SVG 到画布
  | 'generate_diagram'; // 生成完整图表（多对象组合）

export interface ImageAiAction {
  action: ImageAiActionType;
  [key: string]: unknown;
}

export interface ImageAiActionResult {
  ok: boolean;
  message: string;
  actionType?: ImageAiActionType;
}

// ── 上下文摘要 ──

export interface ImageContextSummary {
  phase: ImagePhase;
  canvasCount: number;
  activeCanvasTitle: string;
  objectCount: number;
  canvasSize: { width: number; height: number };
  objectTypes: Record<string, number>;
}

