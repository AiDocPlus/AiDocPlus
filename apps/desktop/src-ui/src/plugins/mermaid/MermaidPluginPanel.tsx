/**
 * Mermaid 图表插件主面板
 *
 * 直接复用主程序的 MarkdownEditor 组件，自带：
 * - CodeMirror 6 编辑器（编辑模式）
 * - MarkdownPreview（预览/分栏模式，自动渲染 Mermaid 代码块为 SVG）
 * - 工具栏、状态栏、文档大纲
 * - 视图模式切换（编辑/预览/分栏）
 *
 * 插件面板只需管理：
 * - value ↔ pluginData 之间的转换（Markdown fence ↔ 纯 Mermaid 代码）
 * - 监听 AI 助手发来的 diagram-apply-code 事件
 * - 导出功能（SVG/PNG/MMD）
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import type { PluginPanelProps } from '../types';
import type { MermaidPluginData, MermaidDiagram } from './types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import {
  Download, FileImage, FileCode, FileInput, Image, Plus, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

const DIALOG_STYLE = { fontFamily: '宋体', fontSize: '16px' };

/** 将纯 Mermaid 代码包裹为 Markdown 代码块 */
function wrapAsFencedBlock(mermaidCode: string): string {
  const trimmed = mermaidCode.trim();
  if (!trimmed) return '';
  return '```mermaid\n' + trimmed + '\n```';
}

/** 从 Markdown 文本中提取纯 Mermaid 代码（去掉 fence 标记） */
function extractMermaidCode(markdown: string): string {
  const match = markdown.match(/```mermaid\s*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  return markdown.trim();
}

/** 图表类型中文映射 */
const DIAGRAM_TYPE_LABELS: Record<string, string> = {
  flowchart: '流程图', graph: '流程图', sequenceDiagram: '时序图', classDiagram: '类图',
  stateDiagram: '状态图', erDiagram: 'ER图', gantt: '甘特图', pie: '饼图',
  mindmap: '思维导图', timeline: '时间线', journey: '用户旅程', gitGraph: 'Git图',
  quadrantChart: '象限图', xychart: 'XY图表', block: '块图', sankey: '桑基图',
  requirement: '需求图', C4Context: 'C4架构图',
};

/** 从 Mermaid 代码推断图表标题 */
function inferDiagramTitle(code: string, fallback: string): string {
  if (!code?.trim()) return fallback;
  const lines = code.trim().split('\n').map(l => l.trim()).filter(Boolean);

  // 1. 查找 title 指令
  for (const line of lines) {
    const titleMatch = line.match(/^\s*title\s+(.+)$/i);
    if (titleMatch) return titleMatch[1].trim().slice(0, 30);
  }

  // 2. 查找 accTitle 指令
  for (const line of lines) {
    const accMatch = line.match(/^\s*accTitle\s*:\s*(.+)$/);
    if (accMatch) return accMatch[1].trim().slice(0, 30);
  }

  // 3. 检测图表类型
  const firstLine = lines[0] || '';
  let diagramType = '';
  for (const key of Object.keys(DIAGRAM_TYPE_LABELS)) {
    if (firstLine.toLowerCase().startsWith(key.toLowerCase())) {
      diagramType = key;
      break;
    }
  }
  // flowchart / graph 特殊匹配
  if (!diagramType && /^(flowchart|graph)\s/i.test(firstLine)) diagramType = 'flowchart';

  const label = diagramType ? (DIAGRAM_TYPE_LABELS[diagramType] || diagramType) : '';

  // 4. 尝试提取首个有意义的节点/参与者名称
  if (diagramType === 'sequenceDiagram') {
    const pMatch = lines.find(l => /^participant\s/i.test(l) || /^actor\s/i.test(l));
    if (pMatch) {
      const name = pMatch.replace(/^(participant|actor)\s+/i, '').replace(/\s+as\s+.*/i, '').trim();
      if (name) return `时序图: ${name.slice(0, 20)}`;
    }
  }
  if (diagramType === 'flowchart' || diagramType === 'graph') {
    // 提取第一个节点文本 A[文本] 或 A(文本) 或 A{文本}
    for (let i = 1; i < lines.length; i++) {
      const nodeMatch = lines[i].match(/\w+[\[({](.+?)[\])}]/);
      if (nodeMatch) return `流程图: ${nodeMatch[1].trim().slice(0, 20)}`;
    }
  }

  // 5. 仅返回图表类型
  if (label) return label;

  return fallback;
}

/** 生成图表 ID */
function genDiagramId(): string {
  return 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

/** 数据迁移：旧的单图表 → 多图表 diagrams 数组 */
function migrateToDiagrams(data: MermaidPluginData): MermaidDiagram[] {
  if (data.diagrams && data.diagrams.length > 0) return data.diagrams;
  if (data.mermaidCode?.trim()) {
    return [{ id: genDiagramId(), title: '图表 1', mermaidCode: data.mermaidCode, diagramType: data.diagramType, lastRenderedAt: data.lastRenderedAt }];
  }
  return [{ id: genDiagramId(), title: '图表 1', mermaidCode: '' }];
}

/** SVG → Canvas 导出通用函数（使用 data URI 绕过 WebView CSP 限制） */
async function svgToImageBlob(svgEl: SVGSVGElement, mimeType: string, quality?: number): Promise<Blob | null> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('width') || !clone.getAttribute('height')) {
    const bbox = svgEl.getBBox();
    const vb = svgEl.viewBox.baseVal;
    const w = vb.width || bbox.width || 800;
    const h = vb.height || bbox.height || 600;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
  }
  const svgStr = new XMLSerializer().serializeToString(clone);
  // 使用 data URI 而非 blob URL，避免 Tauri WebView 的 CSP 阻止加载
  const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
  return new Promise<Blob | null>((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = 2;
      const canvas = window.document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((result) => resolve(result), mimeType, quality);
    };
    img.onerror = (e) => { console.warn('[Mermaid] svgToImageBlob img.onerror:', e); resolve(null); };
    img.src = dataUri;
  });
}

export function MermaidPluginPanel({
  document: doc,
  pluginData: rawPluginData,
  onPluginDataChange,
  content: aiContent,
}: PluginPanelProps) {
  const { t: _t } = useTranslation('plugin-mermaid');
  const host = usePluginHost();
  const { platform, ui } = host;

  const pluginData = (rawPluginData as MermaidPluginData) || {};
  const [diagrams, setDiagrams] = useState<MermaidDiagram[]>(() => migrateToDiagrams(pluginData));
  const [activeTabId, setActiveTabId] = useState<string>(() => pluginData.activeDiagramId || diagrams[0]?.id || '');
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeDiagram = useMemo(() => diagrams.find(d => d.id === activeTabId) || diagrams[0], [diagrams, activeTabId]);

  const [editorValue, setEditorValue] = useState<string>(() =>
    activeDiagram?.mermaidCode ? wrapAsFencedBlock(activeDiagram.mermaidCode) : ''
  );

  // 切换标签时同步编辑器
  useEffect(() => {
    if (activeDiagram) setEditorValue(activeDiagram.mermaidCode ? wrapAsFencedBlock(activeDiagram.mermaidCode) : '');
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [statusMsg, setStatusMsg] = useState('');
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showStatus = useCallback((msg: string, duration = 3000) => {
    setStatusMsg(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMsg(''), duration);
  }, []);

  // 持久化 diagrams → pluginData
  const persistDiagrams = useCallback((newDiagrams: MermaidDiagram[], newActiveId?: string) => {
    setDiagrams(newDiagrams);
    const active = newDiagrams.find(d => d.id === (newActiveId || activeTabId)) || newDiagrams[0];
    onPluginDataChange({
      ...pluginData, diagrams: newDiagrams, activeDiagramId: active?.id,
      mermaidCode: active?.mermaidCode || '', diagramType: active?.diagramType, lastRenderedAt: active?.lastRenderedAt,
    });
  }, [pluginData, onPluginDataChange, activeTabId]);

  const handleChange = useCallback((newValue: string) => {
    setEditorValue(newValue);
    const code = extractMermaidCode(newValue);
    const newDiagrams = diagrams.map(d => {
      if (d.id !== activeTabId) return d;
      const updated = { ...d, mermaidCode: code, lastRenderedAt: Date.now() };
      if (!d.userRenamed) updated.title = inferDiagramTitle(code, d.title);
      return updated;
    });
    persistDiagrams(newDiagrams);
  }, [diagrams, activeTabId, persistDiagrams]);

  // ── 标签页操作 ──
  const handleAddTab = useCallback(() => {
    const newId = genDiagramId();
    const nd: MermaidDiagram = { id: newId, title: `图表 ${diagrams.length + 1}`, mermaidCode: '' };
    const newDiagrams = [...diagrams, nd];
    setActiveTabId(newId);
    persistDiagrams(newDiagrams, newId);
  }, [diagrams, persistDiagrams]);

  const handleCloseTab = useCallback((tabId: string) => {
    if (diagrams.length <= 1) return;
    const newDiagrams = diagrams.filter(d => d.id !== tabId);
    let newActiveId = activeTabId;
    if (activeTabId === tabId) {
      const idx = diagrams.findIndex(d => d.id === tabId);
      newActiveId = newDiagrams[Math.min(idx, newDiagrams.length - 1)]?.id || newDiagrams[0]?.id;
      setActiveTabId(newActiveId);
    }
    persistDiagrams(newDiagrams, newActiveId);
  }, [diagrams, activeTabId, persistDiagrams]);

  const handleStartRename = useCallback((tabId: string) => {
    const d = diagrams.find(dd => dd.id === tabId);
    setRenamingTabId(tabId);
    setRenameValue(d?.title || '');
    setTimeout(() => renameInputRef.current?.select(), 50);
  }, [diagrams]);

  const handleConfirmRename = useCallback(() => {
    if (!renamingTabId) return;
    const title = renameValue.trim() || '未命名';
    const newDiagrams = diagrams.map(d => d.id === renamingTabId ? { ...d, title, userRenamed: true } : d);
    setRenamingTabId(null);
    persistDiagrams(newDiagrams);
  }, [renamingTabId, renameValue, diagrams, persistDiagrams]);

  // 监听 AI 助手面板发来的「应用到编辑器」事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.code) {
        const newValue = wrapAsFencedBlock(detail.code);
        setEditorValue(newValue);
        const codeStr = detail.code.trim();
        const newDiagrams = diagrams.map(d => {
          if (d.id !== activeTabId) return d;
          const updated = { ...d, mermaidCode: codeStr, lastRenderedAt: Date.now() };
          if (!d.userRenamed) updated.title = inferDiagramTitle(codeStr, d.title);
          return updated;
        });
        setDiagrams(newDiagrams);
        onPluginDataChange({
          ...pluginData, diagrams: newDiagrams, activeDiagramId: activeTabId,
          mermaidCode: detail.code.trim(), lastRenderedAt: Date.now(),
          aiHistory: [...(pluginData.aiHistory || []).slice(-9), { code: detail.code.trim(), prompt: detail.prompt || '', timestamp: Date.now() }],
        });
        showStatus(_t('status.applied', { defaultValue: '已应用到编辑器' }));
      }
    };
    window.addEventListener('diagram-apply-code', handler);
    return () => window.removeEventListener('diagram-apply-code', handler);
  }, [pluginData, onPluginDataChange, showStatus, _t, diagrams, activeTabId]);

  // ── 查找 SVG 元素（限定在插件面板 DOM 内） ──
  const findSvgElement = useCallback((): SVGSVGElement | null => {
    const root = panelRef.current || window.document;
    const el = root.querySelector('.mermaid-diagram svg, .markdown-preview svg') as SVGSVGElement | null;
    if (!el) console.warn('[Mermaid Export] findSvgElement: 未找到 SVG，panelRef=', !!panelRef.current);
    return el;
  }, []);

  // ── 导出 SVG ──
  const handleExportSVG = useCallback(async () => {
    console.warn('[Mermaid Export] handleExportSVG 开始');
    const svgEl = findSvgElement();
    if (!svgEl) { showStatus('未找到已渲染的图表，请先切换到预览或分栏模式'); return; }
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgStr = new XMLSerializer().serializeToString(clone);
    try {
      const path = await ui.showSaveDialog({ defaultName: `mermaid-${Date.now()}.svg`, extensions: ['svg'] });
      console.warn('[Mermaid Export] SVG 保存路径:', path);
      if (path) {
        const data = Array.from(new TextEncoder().encode(svgStr));
        await platform.invoke('write_binary_file', { path, data });
        showStatus(_t('status.exported', { defaultValue: '导出成功' }));
      }
    } catch (err) {
      console.error('[Mermaid Export] SVG 导出失败:', err);
      showStatus('导出 SVG 失败: ' + String(err));
    }
  }, [findSvgElement, showStatus, _t, ui, platform]);

  // ── 通用图像导出 (PNG/JPEG/WebP) ──
  const handleExportImage = useCallback(async (format: 'png' | 'jpeg' | 'webp') => {
    console.warn('[Mermaid Export] handleExportImage 开始, format:', format);
    const svgEl = findSvgElement();
    if (!svgEl) { showStatus('未找到已渲染的图表，请先切换到预览或分栏模式'); return; }
    try {
      const blob = await svgToImageBlob(svgEl, `image/${format}`, format === 'png' ? undefined : 0.92);
      console.warn('[Mermaid Export] svgToImageBlob 结果:', blob ? `${blob.size} bytes` : 'null');
      if (!blob) { showStatus('图像转换失败，请检查图表是否正常渲染'); return; }
      const ext = format === 'jpeg' ? 'jpg' : format;
      const path = await ui.showSaveDialog({ defaultName: `mermaid-${Date.now()}.${ext}`, extensions: [ext] });
      console.warn('[Mermaid Export] 图像保存路径:', path);
      if (path) {
        const buffer = await blob.arrayBuffer();
        const data = Array.from(new Uint8Array(buffer));
        await platform.invoke('write_binary_file', { path, data });
        showStatus(_t('status.exported', { defaultValue: '导出成功' }));
      }
    } catch (err) {
      console.error('[Mermaid Export] 图像导出失败:', err);
      showStatus(`导出 ${format.toUpperCase()} 失败: ` + String(err));
    }
  }, [findSvgElement, showStatus, _t, ui, platform]);

  const handleExportPNG = useCallback(() => handleExportImage('png'), [handleExportImage]);
  const handleExportJPEG = useCallback(() => handleExportImage('jpeg'), [handleExportImage]);
  const handleExportWebP = useCallback(() => handleExportImage('webp'), [handleExportImage]);

  // ── 导出代码文件 ──
  const handleExportCode = useCallback(async () => {
    console.warn('[Mermaid Export] handleExportCode 开始');
    const code = activeDiagram?.mermaidCode;
    if (!code?.trim()) { showStatus('当前图表无代码'); return; }
    try {
      const path = await ui.showSaveDialog({ defaultName: `mermaid-${Date.now()}.mmd`, extensions: ['mmd'] });
      console.warn('[Mermaid Export] 代码保存路径:', path);
      if (path) {
        const data = Array.from(new TextEncoder().encode(code));
        await platform.invoke('write_binary_file', { path, data });
        showStatus(_t('status.exported', { defaultValue: '导出成功' }));
      }
    } catch (err) {
      console.error('[Mermaid Export] 代码导出失败:', err);
      showStatus('导出失败: ' + String(err));
    }
  }, [activeDiagram, showStatus, _t, ui, platform]);

  // ── 插入到文档 ──
  const handleInsertToDoc = useCallback(() => {
    console.warn('[Mermaid Export] handleInsertToDoc 开始');
    const code = activeDiagram?.mermaidCode;
    if (!code?.trim()) { showStatus('当前图表无代码'); return; }
    navigator.clipboard.writeText('```mermaid\n' + code.trim() + '\n```');
    showStatus(_t('status.copied', { defaultValue: '已复制到剪贴板' }));
  }, [activeDiagram, showStatus, _t]);

  // ── 监听快捷操作面板的 direct-action 事件 ──
  useEffect(() => {
    const handler = (e: Event) => {
      const actionId = (e as CustomEvent).detail?.actionId;
      if (actionId === 'export_svg') handleExportSVG();
      else if (actionId === 'export_png') handleExportPNG();
      else if (actionId === 'export_jpeg') handleExportJPEG();
      else if (actionId === 'export_webp') handleExportWebP();
      else if (actionId === 'export_code') handleExportCode();
      else if (actionId === 'export_to_doc') handleInsertToDoc();
    };
    window.addEventListener('mermaid-direct-action', handler);
    return () => window.removeEventListener('mermaid-direct-action', handler);
  }, [handleExportSVG, handleExportPNG, handleExportJPEG, handleExportWebP, handleExportCode, handleInsertToDoc]);

  const theme = useMemo(() => {
    return window.document.documentElement.classList.contains('dark') ? 'dark' as const : 'light' as const;
  }, []);

  return (
    <div ref={panelRef} className="flex flex-col h-full" style={DIALOG_STYLE}>
      {/* 插件顶部工具栏 */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-background/80 flex-shrink-0">
        <span className="text-sm font-medium">{_t('pluginName', { defaultValue: 'Mermaid 图表' })}</span>
        <div className="flex-1" />

        {/* 导出菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Download className="h-3 w-3" />
              {_t('toolbar.export', { defaultValue: '导出' })}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportSVG}>
              <FileImage className="h-4 w-4 mr-2" />导出 SVG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPNG}>
              <Image className="h-4 w-4 mr-2" />导出 PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJPEG}>
              <Image className="h-4 w-4 mr-2" />导出 JPEG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportWebP}>
              <Image className="h-4 w-4 mr-2" />导出 WebP
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExportCode}>
              <FileCode className="h-4 w-4 mr-2" />导出代码文件
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleInsertToDoc}>
              <FileInput className="h-4 w-4 mr-2" />插入到文档
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {statusMsg && (
          <span className="text-xs text-muted-foreground ml-2">{statusMsg}</span>
        )}
      </div>

      {/* 图表标签栏 */}
      <div className="flex items-center gap-0 px-1 border-b bg-muted/30 flex-shrink-0 overflow-x-auto scrollbar-hide">
        {diagrams.map(d => (
          <div
            key={d.id}
            className={`group flex items-center gap-1 px-2 py-1 text-xs cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              d.id === activeTabId
                ? 'border-primary text-foreground bg-background'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
            onClick={() => setActiveTabId(d.id)}
            onDoubleClick={() => handleStartRename(d.id)}
          >
            {renamingTabId === d.id ? (
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleConfirmRename}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setRenamingTabId(null); }}
                className="h-5 w-20 text-xs px-1 py-0 border-0 shadow-none focus-visible:ring-1"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="truncate max-w-[100px]">{d.title}</span>
            )}
            {diagrams.length > 1 && d.id === activeTabId && renamingTabId !== d.id && (
              <button
                className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:bg-destructive/20 transition-opacity"
                onClick={e => { e.stopPropagation(); handleCloseTab(d.id); }}
                title="关闭标签"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <button
          className="flex items-center px-1.5 py-1 text-muted-foreground hover:text-foreground hover:bg-background/50 rounded transition-colors ml-0.5"
          onClick={handleAddTab}
          title="新建图表"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* MarkdownEditor 编辑器区域 */}
      <div className="flex-1 min-h-0">
        <MarkdownEditor
          key={activeTabId}
          value={editorValue}
          onChange={handleChange}
          placeholder={_t('status.empty', { defaultValue: '输入 Mermaid 代码开始创建图表' })}
          theme={theme}
          showToolbar={true}
          showViewModeSwitch={true}
          editorId={`mermaid-editor-${doc.id}-${activeTabId}`}
          importSources={{ aiContent, document: doc }}
          initialViewMode="split"
        />
      </div>
    </div>
  );
}
