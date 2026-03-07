/**
 * 图片插件主面板
 *
 * 架构：
 * - 顶部工具栏：形状、文字、画笔、图片导入、滤镜、导出、画布设置
 * - 标签栏：多画布管理（新建/切换/关闭/重命名）
 * - 中央：FabricCanvasEditor（核心画布区）
 * - 底部：智能状态栏（尺寸/缩放/对象数/选中数/保存状态）
 *
 * 所有 AI 功能集中在右侧 AI 助手面板，本面板不含任何 AI 入口。
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PluginPanelProps } from '../types';
import type { ImagePluginData, ImageCanvas } from './types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import FabricCanvasEditor from './FabricCanvasEditor';
import type { FabricCanvasEditorRef } from './FabricCanvasEditor';
import { generateThumbnail, copyCanvasToClipboard, dataURLtoUint8Array } from './imageUtils';
import { useImageActionBridge } from './imageActionBridge';
import { PropertyPanel } from './PropertyPanel';
import { ImageContextMenu } from './ImageContextMenu';
import { QuickActionCommandPalette } from './QuickActionCommandPalette';
import {
  loadQuickActionStore, saveQuickActionStore, toggleFavorite, recordRecentUsed,
} from './quickActionDefs';
import type { QuickActionItem } from './quickActionDefs';
import { genCanvasId } from './imageUtils';
import {
  Square, Circle as CircleIcon, Triangle as TriangleIcon, Minus, ArrowRight, Star,
  Type, Heading, AlignLeft,
  Pencil, CircleDot, Wind,
  ImagePlus, FileImage, Clipboard,
  Download, FileImage as FilePng, FileCode, Copy,
  Grid3X3, ZoomIn, ZoomOut, Maximize,
  Undo2, Redo2, Trash2, Plus, X,
  Settings,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  Layers, Group, Ungroup,
  FlipHorizontal, FlipVertical,
  Ruler,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import './image-plugin.css';

const FONT_CLASS = 'image-plugin-font';
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

const PRESET_SIZES = [
  { label: '微信封面', w: 900, h: 383 },
  { label: '公众号头图', w: 1280, h: 720 },
  { label: 'PPT 16:9', w: 1920, h: 1080 },
  { label: 'PPT 4:3', w: 1024, h: 768 },
  { label: 'A4 横版', w: 1123, h: 794 },
  { label: 'A4 竖版', w: 794, h: 1123 },
  { label: '正方形', w: 800, h: 800 },
  { label: '手机壁纸', w: 1080, h: 1920 },
  { label: 'Banner', w: 1200, h: 400 },
];

function createDefaultCanvas(title?: string): ImageCanvas {
  return {
    id: genCanvasId(),
    title: title || '画布 1',
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    fabricJson: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function ImagePluginPanel({ pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const { t } = useTranslation('plugin-image');
  const editorRef = useRef<FabricCanvasEditorRef>(null);

  // ── 数据初始化 ──
  const initData = useMemo<ImagePluginData>(() => {
    const raw = pluginData as ImagePluginData | null;
    if (raw?.canvases?.length) return raw;
    const c = createDefaultCanvas();
    return { canvases: [c], activeCanvasId: c.id, version: 1 };
  }, [pluginData]);

  const [canvases, setCanvases] = useState<ImageCanvas[]>(initData.canvases);
  const [activeId, setActiveId] = useState(initData.activeCanvasId);
  const activeCanvas = useMemo(() => canvases.find(c => c.id === activeId) || canvases[0], [canvases, activeId]);

  // ── UI 状态 ──
  const [objectCount, setObjectCount] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [saveState, setSaveState] = useState<'saved' | 'unsaved' | 'idle'>('idle');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showProps, setShowProps] = useState(true);
  const [qaOpen, setQaOpen] = useState(false);
  const [qaStore, setQaStore] = useState(() => loadQuickActionStore());

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg);
    setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 3000);
  }, []);

  // ── AI 动作桥接 ──
  useImageActionBridge({ editorRef, showStatus });

  // ── 对齐操作 ──
  const alignObjects = useCallback((alignment: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
    const fc = editorRef.current?.getInstance();
    if (!fc) return;
    const objs = fc.getActiveObjects();
    if (objs.length < 2) return;
    const bounds = objs.map(o => ({
      obj: o,
      left: Number(o.left || 0),
      top: Number(o.top || 0),
      width: (o.width || 0) * (o.scaleX || 1),
      height: (o.height || 0) * (o.scaleY || 1),
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
      case 'centerH': {
        const avgCenter = bounds.reduce((s, b) => s + b.left + b.width / 2, 0) / bounds.length;
        bounds.forEach(b => b.obj.set({ left: avgCenter - b.width / 2 }));
        break;
      }
      case 'centerV': {
        const avgMiddle = bounds.reduce((s, b) => s + b.top + b.height / 2, 0) / bounds.length;
        bounds.forEach(b => b.obj.set({ top: avgMiddle - b.height / 2 }));
        break;
      }
    }
    objs.forEach(o => o.setCoords());
    fc.requestRenderAll();
    fc.fire('object:modified', {} as any);
  }, []);

  // ── 翻转 ──
  const handleFlip = useCallback((axis: 'x' | 'y') => {
    const fc = editorRef.current?.getInstance();
    if (!fc) return;
    const obj = fc.getActiveObject();
    if (!obj) return;
    if (axis === 'x') obj.set({ flipX: !obj.flipX });
    else obj.set({ flipY: !obj.flipY });
    fc.requestRenderAll();
  }, []);

  // ── 调整画布尺寸 ──
  const handleResizeCanvas = useCallback((w: number, h: number) => {
    editorRef.current?.setCanvasSize(w, h);
    setCanvases(prev => prev.map(c =>
      c.id === activeId ? { ...c, width: w, height: h, updatedAt: Date.now() } : c
    ));
    showStatus(`画布已调整为 ${w}×${h}`);
  }, [activeId, showStatus]);

  // ── 自定义尺寸 ──
  const handleCustomSize = useCallback(() => {
    const input = window.prompt('输入画布尺寸（宽×高），例如 1200x800', `${activeCanvas.width}x${activeCanvas.height}`);
    if (!input) return;
    const match = input.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (!match) { showStatus('格式错误，请使用 宽x高', true); return; }
    const w = Math.max(100, Math.min(4096, parseInt(match[1])));
    const h = Math.max(100, Math.min(4096, parseInt(match[2])));
    handleResizeCanvas(w, h);
  }, [activeCanvas, handleResizeCanvas, showStatus]);

  // ── 快捷操作 ──
  const handleQaToggleFavorite = useCallback((itemId: string) => {
    setQaStore(prev => {
      const next = toggleFavorite(prev, itemId);
      saveQuickActionStore(next);
      return next;
    });
  }, []);

  const handleQaAction = useCallback((item: QuickActionItem) => {
    // 记录最近使用
    setQaStore(prev => {
      const next = recordRecentUsed(prev, item.id);
      saveQuickActionStore(next);
      return next;
    });

    const mode = item.executionMode || 'ai';
    if (mode === 'direct' && item.directAction) {
      // 直接执行
      const editor = editorRef.current;
      if (!editor) return;
      switch (item.directAction) {
        case 'add_rect':      editor.addShape('rect'); break;
        case 'add_circle':    editor.addShape('circle'); break;
        case 'add_triangle':  editor.addShape('triangle'); break;
        case 'add_star':      editor.addShape('star'); break;
        case 'add_arrow':     editor.addShape('arrow'); break;
        case 'add_line':      editor.addShape('line'); break;
        case 'add_title':     editor.addText('标题', { fontSize: 36, fontWeight: 'bold' }); break;
        case 'add_body':      editor.addText('正文内容', { fontSize: 18 }); break;
        case 'add_caption':   editor.addText('说明文字', { fontSize: 12, fill: '#666666' }); break;
        case 'align_left':    alignObjects('left'); break;
        case 'align_centerH': alignObjects('centerH'); break;
        case 'align_right':   alignObjects('right'); break;
        case 'align_top':     alignObjects('top'); break;
        case 'align_centerV': alignObjects('centerV'); break;
        case 'align_bottom':  alignObjects('bottom'); break;
        case 'distribute_h':  /* TODO: 等距分布 */ showStatus('水平等距分布（开发中）'); break;
        case 'distribute_v':  /* TODO: 等距分布 */ showStatus('垂直等距分布（开发中）'); break;
        case 'group':         editor.groupSelected(); break;
        case 'ungroup':       editor.ungroupSelected(); break;
        case 'delete_selected': editor.deleteSelected(); break;
        case 'select_all':    editor.selectAll(); break;
        case 'undo':          editor.undo(); break;
        case 'redo':          editor.redo(); break;
        case 'flip_h':        handleFlip('x'); break;
        case 'flip_v':        handleFlip('y'); break;
        case 'lock': {
          const fc = editor.getInstance();
          if (fc) {
            const obj = fc.getActiveObject();
            if (obj) {
              const locked = !obj.lockMovementX;
              obj.set({ lockMovementX: locked, lockMovementY: locked, lockRotation: locked, lockScalingX: locked, lockScalingY: locked });
              fc.requestRenderAll();
              showStatus(locked ? '已锁定' : '已解锁');
            }
          }
          break;
        }
        case 'bring_forward':  editor.bringForward(); break;
        case 'send_backward':  editor.sendBackward(); break;
        case 'clear_canvas': {
          if (window.confirm('确定要清空画布吗？此操作无法撤销。')) {
            const fc = editor.getInstance();
            if (fc) { fc.clear(); fc.fire('object:modified', {} as any); }
            showStatus('画布已清空');
          }
          break;
        }
        case 'export_png':     handleExport('png'); break;
        case 'export_svg':     handleExport('svg'); break;
        case 'export_jpeg':    handleExport('jpeg'); break;
        case 'copy_clipboard': handleCopyToClipboard(); break;
        default: showStatus(`未知操作: ${item.directAction}`); break;
      }
    } else {
      // AI 操作：发送 prompt 到 AI 助手面板
      window.dispatchEvent(new CustomEvent('image-qa-ai', { detail: { prompt: item.prompt, label: item.label } }));
      showStatus(`已发送 AI 操作: ${item.label}`);
    }
  }, [alignObjects, handleFlip, showStatus]);

  // ── 数据持久化 ──
  const persistData = useCallback((newCanvases: ImageCanvas[], newActiveId: string) => {
    const data: ImagePluginData = { canvases: newCanvases, activeCanvasId: newActiveId, version: 1 };
    onPluginDataChange(data);
    host.docData?.markDirty();
    setSaveState('unsaved');
  }, [onPluginDataChange, host.docData]);

  // 画布变更回调
  const handleModified = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const json = editor.toJSON();
    const thumb = (() => {
      try {
        const fc = editor.getInstance();
        if (!fc) return undefined;
        return generateThumbnail(fc);
      } catch { return undefined; }
    })();
    setCanvases(prev => {
      const updated = prev.map(c =>
        c.id === activeId ? { ...c, fabricJson: json, thumbnail: thumb || c.thumbnail, updatedAt: Date.now() } : c,
      );
      persistData(updated, activeId);
      return updated;
    });
  }, [activeId, persistData]);

  // ── 标签管理 ──
  const handleNewCanvas = useCallback(() => {
    const num = canvases.length + 1;
    const c = createDefaultCanvas(`画布 ${num}`);
    const updated = [...canvases, c];
    setCanvases(updated);
    setActiveId(c.id);
    persistData(updated, c.id);
  }, [canvases, persistData]);

  const handleSwitchCanvas = useCallback((id: string) => {
    // 先保存当前画布
    const editor = editorRef.current;
    if (editor) {
      const json = editor.toJSON();
      setCanvases(prev => prev.map(c => c.id === activeId ? { ...c, fabricJson: json, updatedAt: Date.now() } : c));
    }
    setActiveId(id);
  }, [activeId]);

  const handleCloseCanvas = useCallback((id: string) => {
    if (canvases.length <= 1) return;
    const target = canvases.find(c => c.id === id);
    if (target && !window.confirm(t('confirmDelete', { name: target.title }))) return;
    const remaining = canvases.filter(c => c.id !== id);
    const newActive = id === activeId ? remaining[0].id : activeId;
    setCanvases(remaining);
    setActiveId(newActive);
    persistData(remaining, newActive);
  }, [canvases, activeId, persistData, t]);

  const handleRenameStart = useCallback((id: string) => {
    const c = canvases.find(c => c.id === id);
    if (!c) return;
    setRenamingId(id);
    setRenameValue(c.title);
  }, [canvases]);

  const handleRenameConfirm = useCallback(() => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    setCanvases(prev => {
      const updated = prev.map(c => c.id === renamingId ? { ...c, title: renameValue.trim() } : c);
      persistData(updated, activeId);
      return updated;
    });
    setRenamingId(null);
  }, [renamingId, renameValue, activeId, persistData]);

  // ── 导出 ──
  const handleExport = useCallback(async (format: 'png' | 'svg' | 'jpeg') => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      let data: string;
      let ext: string;
      let defaultName: string;
      switch (format) {
        case 'png':
          data = editor.toPNG();
          ext = 'png';
          defaultName = `${activeCanvas.title}.png`;
          break;
        case 'jpeg':
          data = editor.toJPEG();
          ext = 'jpeg';
          defaultName = `${activeCanvas.title}.jpg`;
          break;
        case 'svg':
          data = editor.toSVG();
          ext = 'svg';
          defaultName = `${activeCanvas.title}.svg`;
          break;
        default: return;
      }
      const path = await host.ui.showSaveDialog({ defaultName, extensions: [ext] });
      if (!path) return;
      if (format === 'svg') {
        await host.platform.invoke('write_binary_file', { path, data: Array.from(new TextEncoder().encode(data)) });
      } else {
        const bytes = dataURLtoUint8Array(data);
        await host.platform.invoke('write_binary_file', { path, data: Array.from(bytes) });
      }
      showStatus(t('exportSuccess') + `: ${path}`);
    } catch (e) {
      showStatus(t('exportFailed') + `: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }, [activeCanvas, host, showStatus, t]);

  const handleCopyToClipboard = useCallback(async () => {
    const fc = editorRef.current?.getInstance();
    if (!fc) return;
    try {
      await copyCanvasToClipboard(fc);
      showStatus(t('copied'));
    } catch (e) {
      showStatus(String(e), true);
    }
  }, [showStatus, t]);

  // ── 导入图片 ──
  const handleImportFromFile = useCallback(async () => {
    const path = await host.ui.showOpenDialog({ filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'] }] });
    if (!path) return;
    try {
      const base64: string = await host.platform.invoke('read_file_base64', { path });
      const ext = path.split('.').pop()?.toLowerCase() || 'png';
      const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' };
      const mime = mimeMap[ext] || 'image/png';
      await editorRef.current?.addImageFromURL(`data:${mime};base64,${base64}`);
    } catch (e) {
      showStatus(t('importFailed') + `: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }, [host, showStatus, t]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const url = URL.createObjectURL(blob);
          await editorRef.current?.addImageFromURL(url);
          URL.revokeObjectURL(url);
          return;
        }
      }
      showStatus('剪贴板中没有图片', true);
    } catch (e) {
      showStatus(String(e), true);
    }
  }, [showStatus]);

  // ── 画笔模式 ──
  const handleBrush = useCallback((type: 'pencil' | 'circle' | 'spray') => {
    editorRef.current?.enterDrawingMode(type, 3, '#1F2937');
    setDrawingMode(true);
  }, []);

  const handleExitDrawing = useCallback(() => {
    editorRef.current?.exitDrawingMode();
    setDrawingMode(false);
  }, []);

  // ── 监听 AI 直接操作事件 ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ actionId: string }>).detail;
      if (!detail?.actionId || !editorRef.current) return;
      const editor = editorRef.current;
      switch (detail.actionId) {
        case 'add_rect': editor.addShape('rect'); break;
        case 'add_circle': editor.addShape('circle'); break;
        case 'add_triangle': editor.addShape('triangle'); break;
        case 'add_line': editor.addShape('line'); break;
        case 'add_arrow': editor.addShape('arrow'); break;
        case 'add_star': editor.addShape('star'); break;
        case 'add_title': editor.addText('标题', { fontSize: 32, fontWeight: 'bold' }); break;
        case 'add_body': editor.addText('正文内容', { fontSize: 18 }); break;
        case 'delete': editor.deleteSelected(); break;
        case 'select_all': editor.selectAll(); break;
        case 'group': editor.groupSelected(); break;
        case 'ungroup': editor.ungroupSelected(); break;
        case 'bring_forward': editor.bringForward(); break;
        case 'send_backward': editor.sendBackward(); break;
        case 'zoom_fit': editor.zoomToFit(); break;
        case 'undo': editor.undo(); break;
        case 'redo': editor.redo(); break;
      }
      window.dispatchEvent(new CustomEvent('image-direct-action-result', {
        detail: { ok: true, message: `已执行：${detail.actionId}`, actionId: detail.actionId },
      }));
    };
    window.addEventListener('image-direct-action', handler);
    return () => window.removeEventListener('image-direct-action', handler);
  }, []);

  // ── 保存快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleModified();
        onRequestSave?.();
        setSaveState('saved');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleModified, onRequestSave]);

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${FONT_CLASS}`}>
      {/* ── 工具栏 ── */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/30 flex-shrink-0 flex-wrap">
        {/* 形状 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
              <Square className="h-3.5 w-3.5" />{t('shapes')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={FONT_CLASS}>
            <DropdownMenuItem onClick={() => editorRef.current?.addShape('rect')}>
              <Square className="h-4 w-4 mr-2" />{t('addRect')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.addShape('circle')}>
              <CircleIcon className="h-4 w-4 mr-2" />{t('addCircle')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.addShape('triangle')}>
              <TriangleIcon className="h-4 w-4 mr-2" />{t('addTriangle')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.addShape('line')}>
              <Minus className="h-4 w-4 mr-2" />{t('addLine')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.addShape('arrow')}>
              <ArrowRight className="h-4 w-4 mr-2" />{t('addArrow')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.addShape('star')}>
              <Star className="h-4 w-4 mr-2" />{t('addStar')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 文字 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
              <Type className="h-3.5 w-3.5" />{t('text')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={FONT_CLASS}>
            <DropdownMenuItem onClick={() => editorRef.current?.addText('标题', { fontSize: 32, fontWeight: 'bold' })}>
              <Heading className="h-4 w-4 mr-2" />{t('addTitle')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.addText('正文内容', { fontSize: 18 })}>
              <AlignLeft className="h-4 w-4 mr-2" />{t('addBody')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 画笔 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={drawingMode ? 'default' : 'outline'} size="sm" className="gap-1 h-7 text-xs">
              <Pencil className="h-3.5 w-3.5" />{t('brush')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={FONT_CLASS}>
            <DropdownMenuItem onClick={() => handleBrush('pencil')}>
              <Pencil className="h-4 w-4 mr-2" />{t('pencilBrush')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBrush('circle')}>
              <CircleDot className="h-4 w-4 mr-2" />{t('circleBrush')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBrush('spray')}>
              <Wind className="h-4 w-4 mr-2" />{t('sprayBrush')}
            </DropdownMenuItem>
            {drawingMode && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExitDrawing}>
                  <X className="h-4 w-4 mr-2" />{t('exitDrawing')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 图片导入 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
              <ImagePlus className="h-3.5 w-3.5" />{t('image')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={FONT_CLASS}>
            <DropdownMenuItem onClick={handleImportFromFile}>
              <FileImage className="h-4 w-4 mr-2" />{t('fromFile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePasteFromClipboard}>
              <Clipboard className="h-4 w-4 mr-2" />{t('fromClipboard')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* 导出 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
              <Download className="h-3.5 w-3.5" />{t('export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={FONT_CLASS}>
            <DropdownMenuItem onClick={() => handleExport('png')}>
              <FilePng className="h-4 w-4 mr-2" />{t('exportPNG')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('svg')}>
              <FileCode className="h-4 w-4 mr-2" />{t('exportSVG')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('jpeg')}>
              <FileImage className="h-4 w-4 mr-2" />{t('exportJPEG')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCopyToClipboard}>
              <Copy className="h-4 w-4 mr-2" />{t('copyToClipboard')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 画布控制 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
              <Settings className="h-3.5 w-3.5" />{t('canvasCtrl')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={FONT_CLASS}>
            <DropdownMenuItem onClick={() => editorRef.current?.zoomToFit()}>
              <Maximize className="h-4 w-4 mr-2" />{t('zoomFit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.zoomTo(zoom * 1.2)}>
              <ZoomIn className="h-4 w-4 mr-2" />{t('zoomIn')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.zoomTo(zoom / 1.2)}>
              <ZoomOut className="h-4 w-4 mr-2" />{t('zoomOut')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editorRef.current?.setShowGrid(true)}>
              <Grid3X3 className="h-4 w-4 mr-2" />{t('showGrid')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 对齐 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" disabled={selectedCount < 2}>
              <AlignCenterVertical className="h-3.5 w-3.5" />{t('align', { defaultValue: '对齐' })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={FONT_CLASS}>
            <DropdownMenuItem onClick={() => alignObjects('left')}>
              <AlignStartVertical className="h-4 w-4 mr-2" />{t('alignLeft', { defaultValue: '左对齐' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alignObjects('centerH')}>
              <AlignCenterVertical className="h-4 w-4 mr-2" />{t('alignCenterH', { defaultValue: '水平居中' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alignObjects('right')}>
              <AlignEndVertical className="h-4 w-4 mr-2" />{t('alignRight', { defaultValue: '右对齐' })}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => alignObjects('top')}>
              <AlignStartHorizontal className="h-4 w-4 mr-2" />{t('alignTop', { defaultValue: '顶部对齐' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alignObjects('centerV')}>
              <AlignCenterHorizontal className="h-4 w-4 mr-2" />{t('alignCenterV', { defaultValue: '垂直居中' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alignObjects('bottom')}>
              <AlignEndHorizontal className="h-4 w-4 mr-2" />{t('alignBottom', { defaultValue: '底部对齐' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 组合/图层 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" disabled={selectedCount === 0}>
              <Layers className="h-3.5 w-3.5" />{t('layer', { defaultValue: '图层' })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={FONT_CLASS}>
            <DropdownMenuItem onClick={() => editorRef.current?.bringForward()}>
              {t('bringForward', { defaultValue: '上移一层' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.sendBackward()}>
              {t('sendBackward', { defaultValue: '下移一层' })}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editorRef.current?.groupSelected()} disabled={selectedCount < 2}>
              <Group className="h-4 w-4 mr-2" />{t('group', { defaultValue: '编组' })} (⌘G)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editorRef.current?.ungroupSelected()}>
              <Ungroup className="h-4 w-4 mr-2" />{t('ungroup', { defaultValue: '取消编组' })} (⇧⌘G)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleFlip('x')}>
              <FlipHorizontal className="h-4 w-4 mr-2" />{t('flipH', { defaultValue: '水平翻转' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFlip('y')}>
              <FlipVertical className="h-4 w-4 mr-2" />{t('flipV', { defaultValue: '垂直翻转' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 预设尺寸 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
              <Ruler className="h-3.5 w-3.5" />{t('presetSize', { defaultValue: '尺寸' })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={FONT_CLASS}>
            {PRESET_SIZES.map(ps => (
              <DropdownMenuItem key={ps.label} onClick={() => handleResizeCanvas(ps.w, ps.h)}>
                {ps.label} ({ps.w}×{ps.h})
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCustomSize}>
              {t('customSize', { defaultValue: '自定义尺寸...' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 快捷操作 */}
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setQaOpen(true)}>
          <Sparkles className="h-3.5 w-3.5" />{t('quickAction', { defaultValue: '快捷操作' })}
        </Button>

        <div className="flex-1" />

        {/* 撤销/重做 */}
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => editorRef.current?.undo()} title={t('undo')}>
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => editorRef.current?.redo()} title={t('redo')}>
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => editorRef.current?.deleteSelected()} title={t('delete')}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── 标签栏 ── */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/20 flex-shrink-0 overflow-x-auto">
        {canvases.map(c => (
          <div key={c.id}
            className={`group flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer select-none ${
              c.id === activeId ? 'bg-background border shadow-sm' : 'hover:bg-muted/50'
            }`}
            onClick={() => handleSwitchCanvas(c.id)}
            onDoubleClick={() => handleRenameStart(c.id)}
          >
            {renamingId === c.id ? (
              <Input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRenameConfirm}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenamingId(null); }}
                className="h-5 w-24 text-xs px-1 py-0"
                autoFocus
              />
            ) : (
              <span className="max-w-[100px] truncate">{c.title}</span>
            )}
            {canvases.length > 1 && c.id === activeId && (
              <button
                title={t('delete')}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleCloseCanvas(c.id); }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleNewCanvas} title={t('newCanvas')}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── 画布区 ── */}
      <div className="flex-1 overflow-hidden relative">
        <FabricCanvasEditor
          ref={editorRef}
          key={activeId}
          width={activeCanvas.width}
          height={activeCanvas.height}
          fabricJson={activeCanvas.fabricJson}
          onModified={handleModified}
          onSelectionChange={setSelectedCount}
          onObjectCount={setObjectCount}
          onZoomChange={setZoom}
        />
        {showProps && (
          <PropertyPanel
            editorRef={editorRef}
            selectedCount={selectedCount}
            onClose={() => setShowProps(false)}
          />
        )}
        <ImageContextMenu editorRef={editorRef} onShowStatus={msg => showStatus(msg)} />
      </div>

      {/* ── 快捷操作面板 ── */}
      <QuickActionCommandPalette
        open={qaOpen}
        onOpenChange={setQaOpen}
        store={qaStore}
        onAction={handleQaAction}
        onToggleFavorite={handleQaToggleFavorite}
      />

      {/* ── 状态栏 ── */}
      <div className={`flex-shrink-0 flex items-center gap-3 px-3 py-1 text-xs border-t bg-muted/20 text-muted-foreground ${FONT_CLASS}`}>
        {statusMsg ? (
          <span className={statusIsError ? 'text-destructive' : 'text-foreground'}>{statusMsg}</span>
        ) : (
          <>
            <span>{activeCanvas.width}×{activeCanvas.height}</span>
            <span>{t('zoom')} {Math.round(zoom * 100)}%</span>
            <span>{t('objects')} {objectCount}</span>
            {selectedCount > 0 && <span>{t('selected')} {selectedCount}</span>}
            <div className="flex-1" />
            <span className={saveState === 'unsaved' ? 'text-amber-500' : ''}>
              {saveState === 'saved' ? `✓ ${t('saved')}` : saveState === 'unsaved' ? t('unsaved') : ''}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
