/**
 * Fabric.js 画布封装组件（核心渲染器）
 *
 * 职责：
 * - 初始化 Fabric.js Canvas 实例
 * - 暴露 ref API 供外部（AI 助手、工具栏）调用
 * - 事件监听：object:modified、selection:created/cleared、mouse:wheel（缩放）
 * - 画布缩放/平移（Space+拖拽）
 * - 键盘快捷键（Delete/Ctrl+C/V/Z/Y 等）
 * - 撤销/重做
 */

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { Canvas as FabricCanvas, Rect, Circle, Triangle, Line, Textbox, FabricImage, Polygon, PencilBrush, CircleBrush, SprayBrush, ActiveSelection, Point, Group, loadSVGFromString } from 'fabric';
import { CanvasHistory } from './canvasHistory';

// ── 公开 API 类型 ──

export interface FabricCanvasEditorRef {
  getInstance(): FabricCanvas | null;
  addShape(type: 'rect' | 'circle' | 'triangle' | 'line' | 'arrow' | 'star', options?: Record<string, unknown>): void;
  addText(text: string, options?: Record<string, unknown>): void;
  addImageFromURL(url: string): Promise<void>;
  addImageFromFile(file: File): Promise<void>;
  loadSVG(svgString: string): Promise<void>;
  loadJSON(json: Record<string, unknown>): Promise<void>;
  toJSON(): Record<string, unknown>;
  toSVG(): string;
  toPNG(multiplier?: number): string;
  toJPEG(quality?: number, multiplier?: number): string;
  getSelectedObjects(): unknown[];
  setCanvasSize(w: number, h: number): void;
  zoomToFit(): void;
  zoomTo(scale: number): void;
  undo(): void;
  redo(): void;
  enterDrawingMode(brush: 'pencil' | 'circle' | 'spray', width?: number, color?: string): void;
  exitDrawingMode(): void;
  groupSelected(): void;
  ungroupSelected(): void;
  deleteSelected(): void;
  selectAll(): void;
  bringForward(): void;
  sendBackward(): void;
  setShowGrid(show: boolean): void;
}

export interface FabricCanvasEditorProps {
  width: number;
  height: number;
  fabricJson?: Record<string, unknown>;
  onModified?: () => void;
  onSelectionChange?: (count: number) => void;
  onObjectCount?: (count: number) => void;
  onZoomChange?: (zoom: number) => void;
}

const GRID_SIZE = 20;

const FabricCanvasEditor = forwardRef<FabricCanvasEditorRef, FabricCanvasEditorProps>(function FabricCanvasEditor(
  { width, height, fabricJson, onModified, onSelectionChange, onObjectCount, onZoomChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fcRef = useRef<FabricCanvas | null>(null);
  const historyRef = useRef(new CanvasHistory());
  const [showGrid, setShowGrid] = useState(false);
  const isPanningRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);
  const initDoneRef = useRef(false);

  // ── 通知变更 ──
  const notifyModified = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const json = JSON.stringify(fc.toJSON());
    historyRef.current.push(json);
    onModified?.();
    onObjectCount?.(fc.getObjects().length);
  }, [onModified, onObjectCount]);

  // ── 初始化 Canvas ──
  useEffect(() => {
    if (!canvasElRef.current || initDoneRef.current) return;
    initDoneRef.current = true;

    const fc = new FabricCanvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    });
    fcRef.current = fc;

    // 保存初始快照
    historyRef.current.push(JSON.stringify(fc.toJSON()));

    // 事件监听
    fc.on('object:modified', () => notifyModified());
    fc.on('object:added', () => notifyModified());
    fc.on('object:removed', () => notifyModified());
    fc.on('path:created', () => notifyModified());

    fc.on('selection:created', () => {
      onSelectionChange?.(fc.getActiveObjects().length);
    });
    fc.on('selection:updated', () => {
      onSelectionChange?.(fc.getActiveObjects().length);
    });
    fc.on('selection:cleared', () => {
      onSelectionChange?.(0);
    });

    // 鼠标滚轮缩放
    fc.on('mouse:wheel', (opt) => {
      const evt = opt.e as WheelEvent;
      if (!evt.ctrlKey && !evt.metaKey) return;
      evt.preventDefault();
      evt.stopPropagation();
      const delta = evt.deltaY;
      let zoom = fc.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.max(0.1, Math.min(5, zoom));
      fc.zoomToPoint(new Point(evt.offsetX, evt.offsetY), zoom);
      onZoomChange?.(zoom);
      fc.requestRenderAll();
    });

    // Space + 拖拽 平移
    fc.on('mouse:down', (opt) => {
      if (spaceHeldRef.current) {
        isPanningRef.current = true;
        const evt = opt.e as MouseEvent;
        lastPosRef.current = { x: evt.clientX, y: evt.clientY };
        fc.selection = false;
      }
    });
    fc.on('mouse:move', (opt) => {
      if (!isPanningRef.current) return;
      const evt = opt.e as MouseEvent;
      const vpt = fc.viewportTransform;
      if (vpt) {
        vpt[4] += evt.clientX - lastPosRef.current.x;
        vpt[5] += evt.clientY - lastPosRef.current.y;
        fc.requestRenderAll();
      }
      lastPosRef.current = { x: evt.clientX, y: evt.clientY };
    });
    fc.on('mouse:up', () => {
      isPanningRef.current = false;
      fcRef.current!.selection = true;
    });

    // 加载初始数据
    if (fabricJson && Object.keys(fabricJson).length > 0) {
      historyRef.current.lock();
      fc.loadFromJSON(fabricJson).then(() => {
        fc.requestRenderAll();
        historyRef.current.unlock();
        historyRef.current.clear();
        historyRef.current.push(JSON.stringify(fc.toJSON()));
        onObjectCount?.(fc.getObjects().length);
      });
    }

    return () => {
      fc.dispose();
      fcRef.current = null;
      initDoneRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 键盘事件 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const fc = fcRef.current;
      if (!fc) return;
      // 检查是否在输入框中
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // 检查是否正在编辑文本
      const activeObj = fc.getActiveObject();
      if (activeObj && (activeObj as any).isEditing) return;

      const mod = e.ctrlKey || e.metaKey;

      if (e.code === 'Space') {
        e.preventDefault();
        spaceHeldRef.current = true;
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedImpl(fc);
        notifyModified();
        return;
      }

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoImpl();
        return;
      }
      if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoImpl();
        return;
      }
      if (mod && e.key === 'a') {
        e.preventDefault();
        selectAllImpl(fc);
        return;
      }
      if (mod && e.key === 'c') {
        copyImpl(fc);
        return;
      }
      if (mod && e.key === 'v') {
        pasteImpl(fc);
        return;
      }
      if (mod && e.key === 'd') {
        e.preventDefault();
        duplicateImpl(fc);
        notifyModified();
        return;
      }
      if (mod && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupImpl(fc);
        notifyModified();
        return;
      }
      if (mod && e.key === 'g' && e.shiftKey) {
        e.preventDefault();
        ungroupImpl(fc);
        notifyModified();
        return;
      }
      if (e.key === 'Escape') {
        fc.discardActiveObject();
        if (fc.isDrawingMode) fc.isDrawingMode = false;
        fc.requestRenderAll();
        onSelectionChange?.(0);
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [notifyModified, onSelectionChange]);

  // ── 剪贴板 ──
  const clipboardRef = useRef<unknown>(null);

  const copyImpl = (fc: FabricCanvas) => {
    const active = fc.getActiveObject();
    if (!active) return;
    active.clone().then((cloned: any) => {
      clipboardRef.current = cloned;
    });
  };

  const pasteImpl = (fc: FabricCanvas) => {
    if (!clipboardRef.current) return;
    (clipboardRef.current as any).clone().then((cloned: any) => {
      fc.discardActiveObject();
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      if (cloned.type === 'activeselection') {
        cloned.canvas = fc;
        cloned.forEachObject((obj: any) => fc.add(obj));
        cloned.setCoords();
      } else {
        fc.add(cloned);
      }
      clipboardRef.current = cloned;
      fc.setActiveObject(cloned);
      fc.requestRenderAll();
      notifyModified();
    });
  };

  const duplicateImpl = (fc: FabricCanvas) => {
    const active = fc.getActiveObject();
    if (!active) return;
    active.clone().then((cloned: any) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      if (cloned.type === 'activeselection') {
        cloned.canvas = fc;
        cloned.forEachObject((obj: any) => fc.add(obj));
      } else {
        fc.add(cloned);
      }
      fc.setActiveObject(cloned);
      fc.requestRenderAll();
    });
  };

  // ── 撤销/重做实现 ──
  const undoImpl = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const json = historyRef.current.undo(JSON.stringify(fc.toJSON()));
    if (!json) return;
    historyRef.current.lock();
    fc.loadFromJSON(JSON.parse(json)).then(() => {
      fc.requestRenderAll();
      historyRef.current.unlock();
      onObjectCount?.(fc.getObjects().length);
    });
  }, [onObjectCount]);

  const redoImpl = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const json = historyRef.current.redo();
    if (!json) return;
    historyRef.current.lock();
    fc.loadFromJSON(JSON.parse(json)).then(() => {
      fc.requestRenderAll();
      historyRef.current.unlock();
      onObjectCount?.(fc.getObjects().length);
    });
  }, [onObjectCount]);

  // ── 辅助操作 ──
  const deleteSelectedImpl = (fc: FabricCanvas) => {
    const objs = fc.getActiveObjects();
    if (objs.length === 0) return;
    fc.discardActiveObject();
    objs.forEach(obj => fc.remove(obj));
    fc.requestRenderAll();
    onSelectionChange?.(0);
  };

  const selectAllImpl = (fc: FabricCanvas) => {
    fc.discardActiveObject();
    const objs = fc.getObjects();
    if (objs.length === 0) return;
    const sel = new ActiveSelection(objs, { canvas: fc });
    fc.setActiveObject(sel);
    fc.requestRenderAll();
    onSelectionChange?.(objs.length);
  };

  const groupImpl = (fc: FabricCanvas) => {
    const active = fc.getActiveObject();
    if (!active || active.type !== 'activeselection') return;
    (active as any).toGroup();
    fc.requestRenderAll();
    onSelectionChange?.(1);
  };

  const ungroupImpl = (fc: FabricCanvas) => {
    const active = fc.getActiveObject();
    if (!active || active.type !== 'group') return;
    (active as any).toActiveSelection();
    fc.requestRenderAll();
    onSelectionChange?.(fc.getActiveObjects().length);
  };

  // ── 网格绘制 ──
  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return;
    // 使用 afterRender 画网格
    const drawGrid = () => {
      if (!showGrid) return;
      const ctx = fc.getContext();
      const vpt = fc.viewportTransform || [1, 0, 0, 1, 0, 0];
      const zoom = fc.getZoom();
      ctx.save();
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 0.5 / zoom;
      const w = fc.getWidth() / zoom;
      const h = fc.getHeight() / zoom;
      const offsetX = (vpt[4] / zoom) % GRID_SIZE;
      const offsetY = (vpt[5] / zoom) % GRID_SIZE;
      for (let x = offsetX; x < w; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = offsetY; y < h; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();
    };
    fc.on('after:render', drawGrid);
    fc.requestRenderAll();
    return () => {
      fc.off('after:render', drawGrid as any);
    };
  }, [showGrid]);

  // ── 监听 AI 动作事件 ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !fcRef.current) return;
      // AI 面板会通过 imageAiEngine 解析后 dispatch 此事件
      // Phase 2 中实现具体逻辑
    };
    window.addEventListener('image-ai-apply', handler);
    return () => window.removeEventListener('image-ai-apply', handler);
  }, []);

  // ── Ref API ──
  useImperativeHandle(ref, () => ({
    getInstance: () => fcRef.current,

    addShape: (type, options = {}) => {
      const fc = fcRef.current;
      if (!fc) return;
      const defaults = { left: 100, top: 100, fill: '#3B82F6', stroke: '#1E40AF', strokeWidth: 1 };
      const merged = { ...defaults, ...options };
      let obj: any;
      switch (type) {
        case 'rect':
          obj = new Rect({ width: 150, height: 100, rx: 4, ry: 4, ...merged });
          break;
        case 'circle':
          obj = new Circle({ radius: 60, ...merged });
          break;
        case 'triangle':
          obj = new Triangle({ width: 120, height: 120, ...merged });
          break;
        case 'line':
          obj = new Line([0, 0, 200, 0], { stroke: merged.stroke || '#1E40AF', strokeWidth: 2, left: merged.left, top: merged.top });
          break;
        case 'arrow': {
          const pts = [
            { x: 0, y: 10 }, { x: 160, y: 10 }, { x: 160, y: 0 },
            { x: 200, y: 20 }, { x: 160, y: 40 }, { x: 160, y: 30 }, { x: 0, y: 30 },
          ];
          obj = new Polygon(pts, { ...merged, width: 200, height: 40 });
          break;
        }
        case 'star': {
          const starPts = createStarPoints(5, 50, 25);
          obj = new Polygon(starPts, { ...merged });
          break;
        }
      }
      if (obj) {
        fc.add(obj);
        fc.setActiveObject(obj);
        fc.requestRenderAll();
      }
    },

    addText: (text, options = {}) => {
      const fc = fcRef.current;
      if (!fc) return;
      const tb = new Textbox(text, {
        left: 100,
        top: 100,
        fontSize: 20,
        fontFamily: 'SimSun, "宋体", "Songti SC", serif',
        fill: '#1F2937',
        width: 200,
        ...options,
      });
      fc.add(tb);
      fc.setActiveObject(tb);
      fc.requestRenderAll();
    },

    addImageFromURL: async (url) => {
      const fc = fcRef.current;
      if (!fc) return;
      const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
      scaleImageToFit(img, fc.getWidth() * 0.6, fc.getHeight() * 0.6);
      img.set({ left: 50, top: 50 });
      fc.add(img);
      fc.setActiveObject(img);
      fc.requestRenderAll();
    },

    addImageFromFile: async (file) => {
      const fc = fcRef.current;
      if (!fc) return;
      const url = URL.createObjectURL(file);
      try {
        const img = await FabricImage.fromURL(url);
        scaleImageToFit(img, fc.getWidth() * 0.6, fc.getHeight() * 0.6);
        img.set({ left: 50, top: 50 });
        fc.add(img);
        fc.setActiveObject(img);
        fc.requestRenderAll();
      } finally {
        URL.revokeObjectURL(url);
      }
    },

    loadSVG: async (svgString) => {
      const fc = fcRef.current;
      if (!fc) return;
      const result = await loadSVGFromString(svgString);
      const objs = (result.objects || []).filter(Boolean) as any[];
      if (objs.length === 0) return;
      const group = objs.length === 1 ? objs[0] : new Group(objs);
      group.set({ left: 50, top: 50 });
      fc.add(group);
      fc.setActiveObject(group);
      fc.requestRenderAll();
    },

    loadJSON: async (json) => {
      const fc = fcRef.current;
      if (!fc) return;
      historyRef.current.lock();
      await fc.loadFromJSON(json);
      fc.requestRenderAll();
      historyRef.current.unlock();
      historyRef.current.push(JSON.stringify(fc.toJSON()));
      onObjectCount?.(fc.getObjects().length);
    },

    toJSON: () => fcRef.current?.toJSON() || {},
    toSVG: () => fcRef.current?.toSVG() || '',
    toPNG: (multiplier = 2) => fcRef.current?.toDataURL({ format: 'png', multiplier }) || '',
    toJPEG: (quality = 0.92, multiplier = 2) => fcRef.current?.toDataURL({ format: 'jpeg', quality, multiplier }) || '',
    getSelectedObjects: () => fcRef.current?.getActiveObjects() || [],

    setCanvasSize: (w, h) => {
      const fc = fcRef.current;
      if (!fc) return;
      fc.setDimensions({ width: w, height: h });
      fc.requestRenderAll();
    },

    zoomToFit: () => {
      const fc = fcRef.current;
      if (!fc) return;
      fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
      onZoomChange?.(1);
      fc.requestRenderAll();
    },

    zoomTo: (scale) => {
      const fc = fcRef.current;
      if (!fc) return;
      const center = fc.getCenterPoint();
      fc.zoomToPoint(center, Math.max(0.1, Math.min(5, scale)));
      onZoomChange?.(fc.getZoom());
      fc.requestRenderAll();
    },

    undo: undoImpl,
    redo: redoImpl,

    enterDrawingMode: (brush, brushWidth = 3, color = '#1F2937') => {
      const fc = fcRef.current;
      if (!fc) return;
      fc.isDrawingMode = true;
      let b: any;
      switch (brush) {
        case 'circle':
          b = new CircleBrush(fc);
          break;
        case 'spray':
          b = new SprayBrush(fc);
          break;
        default:
          b = new PencilBrush(fc);
      }
      b.width = brushWidth;
      b.color = color;
      fc.freeDrawingBrush = b;
    },

    exitDrawingMode: () => {
      const fc = fcRef.current;
      if (fc) fc.isDrawingMode = false;
    },

    groupSelected: () => {
      if (fcRef.current) groupImpl(fcRef.current);
    },
    ungroupSelected: () => {
      if (fcRef.current) ungroupImpl(fcRef.current);
    },
    deleteSelected: () => {
      if (fcRef.current) {
        deleteSelectedImpl(fcRef.current);
        notifyModified();
      }
    },
    selectAll: () => {
      if (fcRef.current) selectAllImpl(fcRef.current);
    },
    bringForward: () => {
      const fc = fcRef.current;
      if (!fc) return;
      const obj = fc.getActiveObject();
      if (obj) { fc.bringObjectForward(obj); fc.requestRenderAll(); notifyModified(); }
    },
    sendBackward: () => {
      const fc = fcRef.current;
      if (!fc) return;
      const obj = fc.getActiveObject();
      if (obj) { fc.sendObjectBackwards(obj); fc.requestRenderAll(); notifyModified(); }
    },
    setShowGrid: (show) => setShowGrid(show),
  }), [undoImpl, redoImpl, notifyModified, onSelectionChange, onObjectCount, onZoomChange]);

  return (
    <div ref={containerRef} className="relative overflow-hidden flex-1 bg-gray-100 dark:bg-gray-900 image-canvas-container"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
          const fc = fcRef.current;
          if (!fc) return;
          const url = URL.createObjectURL(files[0]);
          FabricImage.fromURL(url).then(img => {
            scaleImageToFit(img, fc.getWidth() * 0.6, fc.getHeight() * 0.6);
            img.set({ left: 50, top: 50 });
            fc.add(img);
            fc.setActiveObject(img);
            fc.requestRenderAll();
            URL.revokeObjectURL(url);
          });
        }
      }}
    >
      <canvas ref={canvasElRef} />
    </div>
  );
});

export default FabricCanvasEditor;

// ── 辅助函数 ──

function createStarPoints(spikes: number, outerRadius: number, innerRadius: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const step = Math.PI / spikes;
  let rot = -Math.PI / 2;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    points.push({ x: Math.cos(rot) * r + outerRadius, y: Math.sin(rot) * r + outerRadius });
    rot += step;
  }
  return points;
}

function scaleImageToFit(img: FabricImage, maxW: number, maxH: number) {
  const w = img.width || 1;
  const h = img.height || 1;
  const scale = Math.min(maxW / w, maxH / h, 1);
  if (scale < 1) {
    img.scaleX = scale;
    img.scaleY = scale;
  }
}
