/**
 * Mermaid 图表插件数据类型
 */

/** 单个图表数据 */
export interface MermaidDiagram {
  id: string;
  title: string;
  mermaidCode: string;
  diagramType?: string;
  lastRenderedAt?: number;
  /** 用户是否手动重命名过（true 时自动命名不覆盖） */
  userRenamed?: boolean;
}

export interface MermaidPluginData {
  /** 纯 Mermaid 代码（不含 fence 标记）— 向后兼容旧数据 */
  mermaidCode?: string;
  /** 图表类型（flowchart, sequence, class, state, er, gantt, pie, mindmap, timeline, journey, git） */
  diagramType?: string;
  /** 最后渲染时间戳 */
  lastRenderedAt?: number;
  /** AI 生成历史（最近 N 条） */
  aiHistory?: Array<{
    code: string;
    prompt: string;
    timestamp: number;
  }>;
  /** 多图表列表 */
  diagrams?: MermaidDiagram[];
  /** 当前活跃图表 ID */
  activeDiagramId?: string;
}

export type MermaidContextMode = 'none' | 'code' | 'structure' | 'full';

/** 上下文模式标签 */
export const MERMAID_CONTEXT_MODE_LABELS: Record<MermaidContextMode, string> = {
  none: '无',
  code: '图表代码',
  structure: '结构分析',
  full: '完整上下文',
};
