/**
 * 思维导图插件类型定义
 *
 * 定义插件数据结构、颜色方案、AI 操作类型、上下文类型等。
 */

import type { SMNode } from './mindmapConverter';
import type { MindMapLayout } from './SimpleMindMapRenderer';

// ── 颜色方案 ──

export type MindmapColorScheme = 'colorful' | 'blue' | 'green' | 'dark' | 'monochrome';

export const MINDMAP_COLOR_SCHEMES: { key: MindmapColorScheme; label: string; desc: string; colors: string[] }[] = [
  { key: 'colorful', label: '经典多彩', desc: '默认多彩配色', colors: ['#4ecdc4', '#ff6b6b', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#6c5ce7'] },
  { key: 'blue',     label: '蓝色系',   desc: '专业蓝色调', colors: ['#2196f3', '#42a5f5', '#64b5f6', '#90caf9', '#bbdefb', '#1976d2', '#1565c0', '#0d47a1'] },
  { key: 'green',    label: '绿色系',   desc: '护眼清新',   colors: ['#4caf50', '#66bb6a', '#81c784', '#a5d6a7', '#c8e6c9', '#388e3c', '#2e7d32', '#1b5e20'] },
  { key: 'dark',     label: '暗色系',   desc: '暗色背景',   colors: ['#bb86fc', '#03dac6', '#cf6679', '#ffb74d', '#81d4fa', '#a5d6a7', '#f48fb1', '#ce93d8'] },
  { key: 'monochrome', label: '单色',   desc: '黑白灰调',   colors: ['#424242', '#616161', '#757575', '#9e9e9e', '#bdbdbd', '#e0e0e0', '#333333', '#555555'] },
];

// ── 单个思维导图标签数据 ──

export interface MindmapDiagram {
  id: string;
  title: string;
  markdownContent?: string;
  jsonData?: SMNode;
  layout?: MindMapLayout;
  smTheme?: string;
  /** 用户是否手动重命名过（true 时自动命名不覆盖） */
  userRenamed?: boolean;
}

// ── 插件持久化数据 ──

export interface MindmapPluginData {
  /** Markdown 源码（标题层级结构），用于 AI 交互和向后兼容 */
  markdownContent?: string;
  /** simple-mind-map JSON 树数据（主存储格式） */
  jsonData?: SMNode;
  /** 颜色方案（旧版 markmap 用，保留兼容） */
  colorScheme?: MindmapColorScheme;
  /** simple-mind-map 布局类型 */
  layout?: MindMapLayout;
  /** simple-mind-map 主题名 */
  smTheme?: string;
  /** 最后使用的提示词 */
  lastPrompt?: string;
  /** 多标签图表列表 */
  diagrams?: MindmapDiagram[];
  /** 当前活跃图表 ID */
  activeDiagramId?: string;
}

// ── AI 相关类型 ──

export type MindmapPhase = 'blank' | 'has_content' | 'detailed' | 'iterating';

export type MindmapContextMode = 'none' | 'structure' | 'content' | 'full';

export const MINDMAP_CONTEXT_MODE_LABELS: Record<MindmapContextMode, string> = {
  none: '随便聊聊',
  structure: '结构概览',
  content: '完整内容',
  full: '完整上下文',
};

export interface MindmapContextLayer {
  label: string;
  content: string;
  priority: 'critical' | 'important' | 'supplementary';
}
