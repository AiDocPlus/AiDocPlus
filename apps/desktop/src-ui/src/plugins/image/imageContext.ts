/**
 * 图片插件 — 智能上下文引擎
 *
 * 职责：
 * - 画布阶段自动检测（blank / sketching / composing / polishing）
 * - 分层上下文构建（critical / important / supplementary）
 * - Token 预算管理，按层级裁剪
 * - 对象列表摘要、布局分析、色彩统计
 * - 生成智能系统提示词 + 结构化动作协议
 */

import type {
  ImagePluginData,
  ImageCanvas,
  ImagePhase,
  ImageContextMode,
  ImageContextLayer,
  ImageContextSummary,
} from './types';
import { IMAGE_CONTEXT_MODE_LABELS } from './types';

// ── 画布阶段检测 ──

export function detectImagePhase(data: ImagePluginData): ImagePhase {
  const canvases = data.canvases;
  if (!canvases || canvases.length === 0) return 'blank';

  const activeCanvas = canvases.find(c => c.id === data.activeCanvasId) || canvases[0];
  const objects = getCanvasObjects(activeCanvas);

  if (objects.length === 0) return 'blank';
  if (objects.length <= 3) return 'sketching';
  if (objects.length <= 10) return 'composing';
  return 'polishing';
}

// ── 辅助：从 fabricJson 提取对象列表 ──

function getCanvasObjects(canvas: ImageCanvas): Array<Record<string, unknown>> {
  const json = canvas.fabricJson;
  if (!json || !Array.isArray(json.objects)) return [];
  return json.objects as Array<Record<string, unknown>>;
}

// ── 对象类型统计 ──

function buildObjectTypeCounts(objects: Array<Record<string, unknown>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const obj of objects) {
    const type = String(obj.type || 'unknown');
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

// ── 色彩统计 ──

function extractColors(objects: Array<Record<string, unknown>>): string[] {
  const colors = new Set<string>();
  for (const obj of objects) {
    if (typeof obj.fill === 'string' && obj.fill !== '' && obj.fill !== 'transparent') {
      colors.add(obj.fill);
    }
    if (typeof obj.stroke === 'string' && obj.stroke !== '' && obj.stroke !== 'transparent') {
      colors.add(obj.stroke);
    }
  }
  return Array.from(colors).slice(0, 20);
}

// ── 布局摘要 ──

function buildLayoutSummary(objects: Array<Record<string, unknown>>, canvasW: number, canvasH: number): string {
  if (objects.length === 0) return '画布为空';
  const positions = objects.map(obj => ({
    type: String(obj.type || 'unknown'),
    left: Number(obj.left || 0),
    top: Number(obj.top || 0),
    width: Number(obj.width || 0) * Number(obj.scaleX || 1),
    height: Number(obj.height || 0) * Number(obj.scaleY || 1),
  }));

  const minX = Math.min(...positions.map(p => p.left));
  const maxX = Math.max(...positions.map(p => p.left + p.width));
  const minY = Math.min(...positions.map(p => p.top));
  const maxY = Math.max(...positions.map(p => p.top + p.height));

  const parts: string[] = [];
  parts.push(`画布尺寸：${canvasW}×${canvasH}`);
  parts.push(`内容区域：(${Math.round(minX)},${Math.round(minY)}) 到 (${Math.round(maxX)},${Math.round(maxY)})`);
  parts.push(`内容覆盖率：${Math.round(((maxX - minX) * (maxY - minY)) / (canvasW * canvasH) * 100)}%`);

  // 粗略分区
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;
  let leftCount = 0, rightCount = 0, topCount = 0, bottomCount = 0;
  for (const p of positions) {
    const cx = p.left + p.width / 2;
    const cy = p.top + p.height / 2;
    if (cx < centerX) leftCount++; else rightCount++;
    if (cy < centerY) topCount++; else bottomCount++;
  }
  parts.push(`分布：左侧${leftCount}个 右侧${rightCount}个 上方${topCount}个 下方${bottomCount}个`);

  return parts.join('\n');
}

// ── 对象详情列表 ──

function buildObjectList(objects: Array<Record<string, unknown>>): string {
  if (objects.length === 0) return '（空画布）';
  const lines: string[] = [];
  for (let i = 0; i < Math.min(objects.length, 30); i++) {
    const obj = objects[i];
    const type = String(obj.type || 'unknown');
    const left = Math.round(Number(obj.left || 0));
    const top = Math.round(Number(obj.top || 0));
    const w = Math.round(Number(obj.width || 0) * Number(obj.scaleX || 1));
    const h = Math.round(Number(obj.height || 0) * Number(obj.scaleY || 1));
    let desc = `${i + 1}. [${type}] 位置(${left},${top}) 尺寸${w}×${h}`;
    if (type === 'textbox' || type === 'i-text' || type === 'text') {
      const text = String(obj.text || '').slice(0, 30);
      desc += ` 内容="${text}"`;
    }
    if (typeof obj.fill === 'string') desc += ` 填充=${obj.fill}`;
    lines.push(desc);
  }
  if (objects.length > 30) {
    lines.push(`...（共 ${objects.length} 个对象，仅显示前 30 个）`);
  }
  return lines.join('\n');
}

// ── 分层上下文构建 ──

function buildContextLayers(
  data: ImagePluginData,
  docContent?: string,
): { critical: ImageContextLayer[]; important: ImageContextLayer[]; supplementary: ImageContextLayer[] } {
  const critical: ImageContextLayer[] = [];
  const important: ImageContextLayer[] = [];
  const supplementary: ImageContextLayer[] = [];
  const canvases = data.canvases || [];
  const activeCanvas = canvases.find(c => c.id === data.activeCanvasId) || canvases[0];

  if (!activeCanvas) {
    critical.push({ label: '画布状态', content: '当前没有画布', priority: 'critical' });
    return { critical, important, supplementary };
  }

  const objects = getCanvasObjects(activeCanvas);
  const typeCounts = buildObjectTypeCounts(objects);

  // ── Critical ──
  critical.push({
    label: '画布概览',
    content: `当前画布「${activeCanvas.title}」：${activeCanvas.width}×${activeCanvas.height}，${objects.length} 个对象`,
    priority: 'critical',
  });
  if (canvases.length > 1) {
    critical.push({
      label: '画布列表',
      content: `共 ${canvases.length} 个画布：${canvases.map(c => c.title).join('、')}`,
      priority: 'critical',
    });
  }
  if (Object.keys(typeCounts).length > 0) {
    const typeText = Object.entries(typeCounts).map(([t, c]) => `${t}×${c}`).join(', ');
    critical.push({
      label: '对象类型分布',
      content: `对象类型：${typeText}`,
      priority: 'critical',
    });
  }

  // ── Important ──
  if (objects.length > 0) {
    important.push({
      label: '对象列表',
      content: buildObjectList(objects),
      priority: 'important',
    });
    important.push({
      label: '布局分析',
      content: buildLayoutSummary(objects, activeCanvas.width, activeCanvas.height),
      priority: 'important',
    });
    const colors = extractColors(objects);
    if (colors.length > 0) {
      important.push({
        label: '色彩方案',
        content: `使用的颜色：${colors.join(', ')}`,
        priority: 'important',
      });
    }
  }

  // ── Supplementary ──
  if (docContent && docContent.trim()) {
    supplementary.push({
      label: '文档正文',
      content: `文档正文参考（截取前1500字）：\n${docContent.slice(0, 1500)}`,
      priority: 'supplementary',
    });
  }

  return { critical, important, supplementary };
}

// ── Token 预算内上下文字符串 ──

export function buildTieredContext(data: ImagePluginData, docContent?: string, budget = 4000): string {
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

  return parts.length > 0 ? '\n\n--- 当前画布状态 ---\n' + parts.join('\n') : '';
}

// ── 按模式构建上下文 ──

export function buildContextForMode(data: ImagePluginData, mode: ImageContextMode): string {
  const canvases = data.canvases || [];
  const activeCanvas = canvases.find(c => c.id === data.activeCanvasId) || canvases[0];
  if (!activeCanvas) return '当前没有画布。';

  const objects = getCanvasObjects(activeCanvas);

  switch (mode) {
    case 'objects':
      return `## 画布「${activeCanvas.title}」对象列表\n${buildObjectList(objects)}`;
    case 'layout':
      return `## 画布「${activeCanvas.title}」布局分析\n${buildLayoutSummary(objects, activeCanvas.width, activeCanvas.height)}`;
    case 'colors': {
      const colors = extractColors(objects);
      return `## 画布「${activeCanvas.title}」色彩分析\n使用的颜色：${colors.length > 0 ? colors.join(', ') : '（暂无）'}`;
    }
    default:
      return '';
  }
}

// ── 上下文摘要 ──

export function getContextSummary(data: ImagePluginData): ImageContextSummary {
  const canvases = data.canvases || [];
  const activeCanvas = canvases.find(c => c.id === data.activeCanvasId) || canvases[0];
  const objects = activeCanvas ? getCanvasObjects(activeCanvas) : [];
  return {
    phase: detectImagePhase(data),
    canvasCount: canvases.length,
    activeCanvasTitle: activeCanvas?.title || '未命名',
    objectCount: objects.length,
    canvasSize: { width: activeCanvas?.width || 0, height: activeCanvas?.height || 0 },
    objectTypes: buildObjectTypeCounts(objects),
  };
}

// ── 结构化动作协议 ──

const ACTION_PROTOCOL = `
【重要规则】
- 你可以通过输出 JSON 代码块来直接操作画布
- 每个 JSON 代码块只包含一个动作
- 优先使用结构化动作，避免让用户手动操作
- 生成 SVG 时优先使用 load_svg 动作

【结构化动作协议】
你可以在回复中输出以下 JSON 代码块，系统会自动解析并渲染可执行按钮：

1. 添加形状：
\`\`\`json
{"action":"add_shape","shapeType":"rect","left":100,"top":100,"width":150,"height":100,"fill":"#3B82F6","stroke":"#1E40AF","strokeWidth":1}
\`\`\`
shapeType 可选：rect / circle / triangle / line / arrow / star

2. 添加文本：
\`\`\`json
{"action":"add_text","text":"标题文本","left":100,"top":100,"fontSize":32,"fontWeight":"bold","fill":"#1F2937"}
\`\`\`

3. 添加图片（URL 或 base64）：
\`\`\`json
{"action":"add_image","url":"https://example.com/img.png","left":50,"top":50}
\`\`\`

4. 加载 SVG 到画布（用于生成矢量图形、图表、图标等）：
\`\`\`json
{"action":"load_svg","svg":"<svg>...</svg>"}
\`\`\`

5. 修改选中对象属性：
\`\`\`json
{"action":"modify_object","fill":"#EF4444","stroke":"#B91C1C","opacity":0.8,"scaleX":1.5,"scaleY":1.5}
\`\`\`

6. 删除选中对象：
\`\`\`json
{"action":"delete_objects"}
\`\`\`

7. 设置画布背景色：
\`\`\`json
{"action":"set_canvas_bg","color":"#F3F4F6"}
\`\`\`

8. 对齐选中对象：
\`\`\`json
{"action":"align_objects","alignment":"center-horizontal"}
\`\`\`
alignment 可选：left / center-horizontal / right / top / center-vertical / bottom

9. 组合选中对象：
\`\`\`json
{"action":"group_objects"}
\`\`\`

10. 生成完整图表（多对象组合，用 SVG 实现）：
\`\`\`json
{"action":"generate_diagram","svg":"<svg xmlns=\\"http://www.w3.org/2000/svg\\" ...>...</svg>","description":"流程图描述"}
\`\`\`
`;

// ── 智能系统提示词 ──

const BASE_SYSTEM_PROMPT = `你是图片编辑 AI 助手，精通矢量图形设计、数据可视化、信息图和图片处理。

你的能力：
1. 绘制矢量图形：流程图、组织架构图、信息图、图解
2. 生成 SVG：通过 load_svg 动作将 SVG 代码直接渲染到画布
3. 图形排版：对齐、分布、分组
4. 色彩搭配：推荐配色方案、统一色调
5. 文字排版：标题/正文层次、字体建议
6. 图表设计：柱状图、饼图、折线图（通过 SVG 实现）
7. 画布布局：分析当前布局并提供优化建议
8. 图片编辑建议：裁剪、滤镜、特效

${ACTION_PROTOCOL}
回复使用中文。当用户需要生成图形时，优先使用 load_svg 或 add_shape 动作直接操作画布。`;

const PHASE_HINTS: Record<ImagePhase, string> = {
  blank: '\n\n【当前状态】画布为空，用户可能需要帮助创建图形、生成图表或导入图片。',
  sketching: '\n\n【当前状态】画布上有少量对象，用户正在构思阶段，可能需要帮助完善设计或添加更多元素。',
  composing: '\n\n【当前状态】画布上有多个对象，正在组合阶段，可能需要布局优化、对齐调整或色彩统一。',
  polishing: '\n\n【当前状态】画布内容丰富，正在精修阶段，可能需要细节调整、整体优化或最终导出。',
};

export function buildSmartSystemPrompt(
  data: ImagePluginData,
  docContent: string,
  customPrompt?: string,
): string {
  const phase = detectImagePhase(data);
  const basePrompt = customPrompt?.trim() || BASE_SYSTEM_PROMPT;
  const phaseHint = PHASE_HINTS[phase];
  const imageContext = buildTieredContext(data, docContent);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const dateHint = `\n\n【当前日期】${dateStr}（星期${weekdays[now.getDay()]}）`;

  return basePrompt + dateHint + phaseHint + imageContext;
}

export function getDefaultSystemPrompt(): string {
  return BASE_SYSTEM_PROMPT;
}

// re-export for convenience
export type { ImageContextMode };
export { IMAGE_CONTEXT_MODE_LABELS };
