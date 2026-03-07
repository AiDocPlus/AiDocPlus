/**
 * 思维导图 AI 助手 — 智能上下文引擎
 *
 * 职责：
 * - 分层构建思维导图上下文（critical / important / supplementary）
 * - Token 预算管理，按层级裁剪
 * - 思维导图阶段自动检测（blank → has_content → detailed → iterating）
 * - 生成智能系统提示词
 */

import type {
  MindmapPluginData,
  MindmapContextMode,
  MindmapContextLayer,
} from './types';
import type { MindmapPhase } from './types';

export type { MindmapPhase };

// ── 阶段检测 ──

export function detectMindmapPhase(data: MindmapPluginData): MindmapPhase {
  if (!data.markdownContent?.trim()) return 'blank';
  const lines = data.markdownContent.split('\n').filter(l => l.trim());
  if (lines.length > 20) {
    if (data.lastPrompt) return 'iterating';
    return 'detailed';
  }
  if (data.lastPrompt) return 'iterating';
  return 'has_content';
}

// ── 结构分析 ──

interface MindmapStructure {
  totalNodes: number;
  maxDepth: number;
  depthCounts: Record<number, number>;
  rootTitle: string;
}

export function analyzeMindmapStructure(markdown: string): MindmapStructure {
  const lines = markdown.split('\n').filter(l => l.trim());
  let maxDepth = 0;
  const depthCounts: Record<number, number> = {};
  let rootTitle = '';

  for (const line of lines) {
    const trimmed = line.trim();
    // 检测 Markdown 标题层级
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      if (depth === 1 && !rootTitle) rootTitle = headingMatch[2];
      maxDepth = Math.max(maxDepth, depth);
      depthCounts[depth] = (depthCounts[depth] || 0) + 1;
      continue;
    }
    // 检测缩进列表
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const depth = Math.floor(indent / 2) + 2; // 列表从 depth 2 开始
      maxDepth = Math.max(maxDepth, depth);
      depthCounts[depth] = (depthCounts[depth] || 0) + 1;
    }
  }

  const totalNodes = Object.values(depthCounts).reduce((a, b) => a + b, 0);
  return { totalNodes, maxDepth, depthCounts, rootTitle: rootTitle || '未知' };
}

// ── 分层上下文构建 ──

function buildContextLayers(
  data: MindmapPluginData,
  docContent?: string,
): { critical: MindmapContextLayer[]; important: MindmapContextLayer[]; supplementary: MindmapContextLayer[] } {
  const critical: MindmapContextLayer[] = [];
  const important: MindmapContextLayer[] = [];
  const supplementary: MindmapContextLayer[] = [];
  const md = data.markdownContent || '';

  // ── Critical ──
  const phase = detectMindmapPhase(data);
  critical.push({
    label: '思维导图状态',
    content: `当前阶段: ${phase}，颜色方案: ${data.colorScheme || 'colorful'}`,
    priority: 'critical',
  });

  if (md) {
    const structure = analyzeMindmapStructure(md);
    critical.push({
      label: '结构概览',
      content: `根节点: ${structure.rootTitle}，总节点数: ${structure.totalNodes}，最大深度: ${structure.maxDepth}`,
      priority: 'critical',
    });
  }

  // ── Important ──
  if (md) {
    const preview = md.length > 2000 ? md.slice(0, 2000) + '\n...(已截断)' : md;
    important.push({
      label: 'Markdown 内容',
      content: `当前思维导图 Markdown：\n\`\`\`markdown\n${preview}\n\`\`\``,
      priority: 'important',
    });
  }

  // ── Supplementary ──
  if (docContent?.trim()) {
    supplementary.push({
      label: '文档正文',
      content: `文档正文参考（截取前1500字）：\n${docContent.slice(0, 1500)}`,
      priority: 'supplementary',
    });
  }

  return { critical, important, supplementary };
}

/**
 * 构建 token 预算内的上下文字符串
 */
export function buildTieredContext(data: MindmapPluginData, docContent?: string, budget = 4000): string {
  const layers = buildContextLayers(data, docContent);
  const parts: string[] = [];
  let remaining = budget;

  for (const layer of [layers.critical, layers.important, layers.supplementary]) {
    for (const item of layer) {
      if (item.content.length <= remaining) {
        parts.push(item.content);
        remaining -= item.content.length;
      } else if (remaining > 100) {
        parts.push(item.content.slice(0, remaining - 20) + '\n...(已截断)');
        remaining = 0;
        break;
      }
    }
    if (remaining <= 0) break;
  }

  return parts.length > 0 ? '\n\n--- 当前思维导图状态 ---\n' + parts.join('\n') : '';
}

/**
 * 按上下文模式构建
 */
export function buildContextForMode(data: MindmapPluginData, mode: MindmapContextMode, docContent?: string): string {
  const md = data.markdownContent || '';
  if (mode === 'none') return '';

  if (mode === 'structure') {
    if (!md) return '';
    const s = analyzeMindmapStructure(md);
    const depthInfo = Object.entries(s.depthCounts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([d, c]) => `第${d}层: ${c}个`)
      .join(', ');
    return `\n\n--- 结构概览 ---\n根节点: ${s.rootTitle}\n总节点: ${s.totalNodes}\n最大深度: ${s.maxDepth}\n各层分布: ${depthInfo}`;
  }

  if (mode === 'content') {
    if (!md) return '';
    const preview = md.length > 3000 ? md.slice(0, 3000) + '\n...(已截断)' : md;
    return `\n\n--- 当前思维导图内容 ---\n\`\`\`markdown\n${preview}\n\`\`\``;
  }

  // full
  return buildTieredContext(data, docContent);
}

// ── 智能系统提示词 ──

export function getDefaultSystemPrompt(): string {
  return `你是一位专业的思维导图专家。你擅长：
1. 将文档内容组织为清晰的层级结构
2. 使用 Markdown 标题语法（# ## ### ####）构建思维导图
3. 优化和改进现有思维导图结构
4. 分析思维导图的完整性和逻辑性

输出规则：
- 当用户要求生成或修改思维导图时，直接输出 Markdown 格式内容
- 使用 # 作为根节点，## 作为一级分支，### 作为二级分支，以此类推
- 每个标题就是一个节点，保持简洁精练
- 当用户要求解释或分析时，用中文回答`;
}

export function buildSmartSystemPrompt(data: MindmapPluginData, docContent?: string): string {
  const base = getDefaultSystemPrompt();
  const phase = detectMindmapPhase(data);
  const context = buildTieredContext(data, docContent, 3000);

  let phaseHint = '';
  switch (phase) {
    case 'blank':
      phaseHint = '\n\n当前状态：用户还没有生成思维导图。主动建议适合文档内容的结构方式。';
      break;
    case 'has_content':
      phaseHint = '\n\n当前状态：已有基础结构。用户可能想要扩展、精简或重组。';
      break;
    case 'detailed':
      phaseHint = '\n\n当前状态：思维导图已较详细。关注优化和完善。';
      break;
    case 'iterating':
      phaseHint = '\n\n当前状态：用户正在迭代改进。关注具体的修改需求。';
      break;
  }

  return base + phaseHint + context;
}

/**
 * 获取上下文摘要（用于 UI 显示）
 */
export function getContextSummary(data: MindmapPluginData): string {
  const md = data.markdownContent || '';
  if (!md) return '空白';
  const s = analyzeMindmapStructure(md);
  return `${s.rootTitle} · ${s.totalNodes}节点 · ${s.maxDepth}层`;
}
