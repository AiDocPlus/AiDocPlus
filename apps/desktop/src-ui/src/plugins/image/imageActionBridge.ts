/**
 * AI 动作桥接引擎
 *
 * 监听 'image-ai-apply' CustomEvent，解析 AI 助手面板发来的结构化动作，
 * 调用 FabricCanvasEditorRef API 执行操作并触发持久化。
 *
 * 支持的动作类型：
 * - add_shape        → 添加形状
 * - add_text         → 添加文本
 * - add_image        → 添加图片
 * - load_svg         → 加载 SVG
 * - modify_object    → 修改选中对象属性
 * - delete_objects   → 删除选中对象
 * - set_canvas_bg    → 设置画布背景
 * - align_objects    → 对齐选中对象
 * - group_objects    → 组合选中对象
 * - generate_diagram → 生成完整图表（SVG）
 */

import { useEffect, useRef } from 'react';
import type { FabricCanvasEditorRef } from './FabricCanvasEditor';
import type { ImageAiAction, ImageAiActionResult } from './types';

interface AiActionDetail {
  type: string;
  data: Record<string, unknown>;
}

interface UseImageActionBridgeOptions {
  editorRef: React.RefObject<FabricCanvasEditorRef | null>;
  showStatus: (msg: string, isError?: boolean) => void;
}

/**
 * Hook：监听 image-ai-apply 事件并执行对应的画布操作
 */
export function useImageActionBridge({ editorRef, showStatus }: UseImageActionBridgeOptions) {
  const optionsRef = useRef({ showStatus });
  optionsRef.current = { showStatus };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AiActionDetail>).detail;
      if (!detail?.type) return;

      const editor = editorRef.current;
      if (!editor) {
        optionsRef.current.showStatus('画布实例未就绪', true);
        return;
      }

      try {
        const result = executeAction(editor, detail.type, detail.data);
        if (result.ok) {
          optionsRef.current.showStatus(result.message);
        } else {
          optionsRef.current.showStatus(result.message, true);
        }
        // 通知 AI 助手面板执行结果
        window.dispatchEvent(new CustomEvent('image-ai-apply-result', {
          detail: result,
        }));
      } catch (err) {
        const msg = `执行失败：${err instanceof Error ? err.message : String(err)}`;
        optionsRef.current.showStatus(msg, true);
        window.dispatchEvent(new CustomEvent('image-ai-apply-result', {
          detail: { ok: false, message: msg, actionType: detail.type },
        }));
      }
    };

    window.addEventListener('image-ai-apply', handler);
    return () => window.removeEventListener('image-ai-apply', handler);
  }, [editorRef]);
}

// ── 动作分发 ──

function executeAction(
  editor: FabricCanvasEditorRef,
  actionType: string,
  data: Record<string, unknown>,
): ImageAiActionResult {
  switch (actionType) {
    case 'add_shape':
      return handleAddShape(editor, data);
    case 'add_text':
      return handleAddText(editor, data);
    case 'add_image':
      return handleAddImage(editor, data);
    case 'load_svg':
      return handleLoadSVG(editor, data);
    case 'modify_object':
      return handleModifyObject(editor, data);
    case 'delete_objects':
      return handleDeleteObjects(editor);
    case 'set_canvas_bg':
      return handleSetCanvasBg(editor, data);
    case 'align_objects':
      return handleAlignObjects(editor, data);
    case 'group_objects':
      return handleGroupObjects(editor);
    case 'generate_diagram':
      return handleGenerateDiagram(editor, data);
    default:
      return { ok: false, message: `未知动作类型：${actionType}`, actionType: actionType as any };
  }
}

// ── 各动作处理器 ──

function handleAddShape(editor: FabricCanvasEditorRef, data: Record<string, unknown>): ImageAiActionResult {
  const shapeType = String(data.shapeType || 'rect');
  const validTypes = ['rect', 'circle', 'triangle', 'line', 'arrow', 'star'];
  if (!validTypes.includes(shapeType)) {
    return { ok: false, message: `不支持的形状类型：${shapeType}`, actionType: 'add_shape' };
  }

  const options: Record<string, unknown> = {};
  if (data.left !== undefined) options.left = Number(data.left);
  if (data.top !== undefined) options.top = Number(data.top);
  if (data.width !== undefined) options.width = Number(data.width);
  if (data.height !== undefined) options.height = Number(data.height);
  if (data.fill !== undefined) options.fill = String(data.fill);
  if (data.stroke !== undefined) options.stroke = String(data.stroke);
  if (data.strokeWidth !== undefined) options.strokeWidth = Number(data.strokeWidth);
  if (data.opacity !== undefined) options.opacity = Number(data.opacity);
  if (data.rx !== undefined) options.rx = Number(data.rx);
  if (data.ry !== undefined) options.ry = Number(data.ry);
  if (data.radius !== undefined) options.radius = Number(data.radius);
  if (data.angle !== undefined) options.angle = Number(data.angle);

  editor.addShape(shapeType as any, options);
  return { ok: true, message: `已添加${shapeType}形状`, actionType: 'add_shape' };
}

function handleAddText(editor: FabricCanvasEditorRef, data: Record<string, unknown>): ImageAiActionResult {
  const text = String(data.text || '文本');
  const options: Record<string, unknown> = {};
  if (data.left !== undefined) options.left = Number(data.left);
  if (data.top !== undefined) options.top = Number(data.top);
  if (data.fontSize !== undefined) options.fontSize = Number(data.fontSize);
  if (data.fontWeight !== undefined) options.fontWeight = String(data.fontWeight);
  if (data.fontStyle !== undefined) options.fontStyle = String(data.fontStyle);
  if (data.fill !== undefined) options.fill = String(data.fill);
  if (data.textAlign !== undefined) options.textAlign = String(data.textAlign);
  if (data.width !== undefined) options.width = Number(data.width);

  editor.addText(text, options);
  return { ok: true, message: `已添加文本："${text.slice(0, 20)}"`, actionType: 'add_text' };
}

function handleAddImage(editor: FabricCanvasEditorRef, data: Record<string, unknown>): ImageAiActionResult {
  const url = String(data.url || '');
  if (!url) {
    return { ok: false, message: '缺少图片 URL', actionType: 'add_image' };
  }
  // addImageFromURL 是异步的，但我们同步返回结果
  editor.addImageFromURL(url).catch(() => {
    window.dispatchEvent(new CustomEvent('image-ai-apply-result', {
      detail: { ok: false, message: '图片加载失败', actionType: 'add_image' },
    }));
  });
  return { ok: true, message: '正在加载图片...', actionType: 'add_image' };
}

function handleLoadSVG(editor: FabricCanvasEditorRef, data: Record<string, unknown>): ImageAiActionResult {
  const svg = String(data.svg || '');
  if (!svg) {
    return { ok: false, message: '缺少 SVG 内容', actionType: 'load_svg' };
  }
  editor.loadSVG(svg).catch(() => {
    window.dispatchEvent(new CustomEvent('image-ai-apply-result', {
      detail: { ok: false, message: 'SVG 加载失败', actionType: 'load_svg' },
    }));
  });
  return { ok: true, message: '已加载 SVG 图形', actionType: 'load_svg' };
}

function handleModifyObject(editor: FabricCanvasEditorRef, data: Record<string, unknown>): ImageAiActionResult {
  const fc = editor.getInstance();
  if (!fc) return { ok: false, message: '画布实例未就绪', actionType: 'modify_object' };

  const active = fc.getActiveObject();
  if (!active) return { ok: false, message: '请先选中一个对象', actionType: 'modify_object' };

  const props: Record<string, unknown> = {};
  const allowedProps = ['fill', 'stroke', 'strokeWidth', 'opacity', 'scaleX', 'scaleY', 'angle', 'left', 'top', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign'];
  for (const key of allowedProps) {
    if (data[key] !== undefined) {
      props[key] = typeof data[key] === 'string' ? data[key] : Number(data[key]);
    }
  }

  active.set(props as any);
  active.setCoords();
  fc.requestRenderAll();
  return { ok: true, message: '已修改对象属性', actionType: 'modify_object' };
}

function handleDeleteObjects(editor: FabricCanvasEditorRef): ImageAiActionResult {
  const fc = editor.getInstance();
  if (!fc) return { ok: false, message: '画布实例未就绪', actionType: 'delete_objects' };

  const objects = fc.getActiveObjects();
  if (objects.length === 0) return { ok: false, message: '没有选中的对象', actionType: 'delete_objects' };

  editor.deleteSelected();
  return { ok: true, message: `已删除 ${objects.length} 个对象`, actionType: 'delete_objects' };
}

function handleSetCanvasBg(editor: FabricCanvasEditorRef, data: Record<string, unknown>): ImageAiActionResult {
  const fc = editor.getInstance();
  if (!fc) return { ok: false, message: '画布实例未就绪', actionType: 'set_canvas_bg' };

  const color = String(data.color || '#ffffff');
  fc.backgroundColor = color;
  fc.requestRenderAll();
  return { ok: true, message: `已设置画布背景色：${color}`, actionType: 'set_canvas_bg' };
}

function handleAlignObjects(editor: FabricCanvasEditorRef, data: Record<string, unknown>): ImageAiActionResult {
  const fc = editor.getInstance();
  if (!fc) return { ok: false, message: '画布实例未就绪', actionType: 'align_objects' };

  const objects = fc.getActiveObjects();
  if (objects.length < 2) return { ok: false, message: '需要选中至少 2 个对象', actionType: 'align_objects' };

  const alignment = String(data.alignment || 'left');
  const bounds = objects.map(obj => ({
    obj,
    left: Number(obj.left || 0),
    top: Number(obj.top || 0),
    width: Number(obj.width || 0) * Number(obj.scaleX || 1),
    height: Number(obj.height || 0) * Number(obj.scaleY || 1),
  }));

  switch (alignment) {
    case 'left': {
      const minLeft = Math.min(...bounds.map(b => b.left));
      bounds.forEach(b => b.obj.set({ left: minLeft }));
      break;
    }
    case 'right': {
      const maxRight = Math.max(...bounds.map(b => b.left + b.width));
      bounds.forEach(b => b.obj.set({ left: maxRight - b.width }));
      break;
    }
    case 'center-horizontal': {
      const avgCenter = bounds.reduce((s, b) => s + b.left + b.width / 2, 0) / bounds.length;
      bounds.forEach(b => b.obj.set({ left: avgCenter - b.width / 2 }));
      break;
    }
    case 'top': {
      const minTop = Math.min(...bounds.map(b => b.top));
      bounds.forEach(b => b.obj.set({ top: minTop }));
      break;
    }
    case 'bottom': {
      const maxBottom = Math.max(...bounds.map(b => b.top + b.height));
      bounds.forEach(b => b.obj.set({ top: maxBottom - b.height }));
      break;
    }
    case 'center-vertical': {
      const avgMiddle = bounds.reduce((s, b) => s + b.top + b.height / 2, 0) / bounds.length;
      bounds.forEach(b => b.obj.set({ top: avgMiddle - b.height / 2 }));
      break;
    }
  }

  objects.forEach(obj => obj.setCoords());
  fc.requestRenderAll();
  return { ok: true, message: `已对齐（${alignment}）`, actionType: 'align_objects' };
}

function handleGroupObjects(editor: FabricCanvasEditorRef): ImageAiActionResult {
  editor.groupSelected();
  return { ok: true, message: '已组合选中对象', actionType: 'group_objects' };
}

function handleGenerateDiagram(editor: FabricCanvasEditorRef, data: Record<string, unknown>): ImageAiActionResult {
  const svg = String(data.svg || '');
  if (!svg) {
    return { ok: false, message: '缺少 SVG 内容', actionType: 'generate_diagram' };
  }
  const desc = String(data.description || '图表');
  editor.loadSVG(svg).catch(() => {
    window.dispatchEvent(new CustomEvent('image-ai-apply-result', {
      detail: { ok: false, message: '图表生成失败', actionType: 'generate_diagram' },
    }));
  });
  return { ok: true, message: `已生成图表：${desc}`, actionType: 'generate_diagram' };
}

// ── 解析 AI 回复中的 JSON 动作块 ──

export function parseAiActions(content: string): ImageAiAction[] {
  const actions: ImageAiAction[] = [];
  // 匹配 ```json ... ``` 代码块
  const jsonBlockRegex = /```json\s*\n?([\s\S]*?)\n?\s*```/g;
  let match;
  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === 'object' && parsed.action) {
        actions.push(parsed as ImageAiAction);
      }
    } catch {
      // 忽略解析失败的块
    }
  }
  return actions;
}

// ── 触发动作执行 ──

export function dispatchImageAction(action: ImageAiAction): void {
  window.dispatchEvent(new CustomEvent('image-ai-apply', {
    detail: { type: action.action, data: action },
  }));
}
