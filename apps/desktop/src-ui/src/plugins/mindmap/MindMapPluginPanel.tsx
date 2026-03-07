import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import {
  Brain, Download, Copy, Check, ListTree,
  Maximize2, Minimize2, Scan, ChevronDown, Image, FileCode,
  Plus, Trash2, Undo2, Redo2, ChevronsUpDown, Layout,
  GitBranch, ChevronsDown, ChevronsUp, Search, X,
  Map, Rainbow, Upload, FileJson,
  AlignLeft, Network, ArrowUp, ArrowDown, Indent, Outdent, CopyPlus, CheckCircle,
  ZoomIn, ZoomOut, Crosshair,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { MindmapPluginData, MindmapDiagram } from './types';
import { Input } from '@/components/ui/input';
import { SimpleMindMapRenderer, SM_THEMES, SM_LAYOUTS } from './SimpleMindMapRenderer';
import type { SimpleMindMapRendererRef, MindMapLayout } from './SimpleMindMapRenderer';
import { markdownToMindMapData, mindMapDataToMarkdown, countNodes, getMaxDepth, isValidSMNode, markdownToBranch } from './mindmapConverter';
import type { SMNode } from './mindmapConverter';
import { MindMapContextMenu } from './MindMapContextMenu';
import type { ContextMenuAction } from './MindMapContextMenu';
import { OutlineEditor } from './OutlineEditor';
import type { OutlineEditorRef } from './OutlineEditor';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';

export type MindMapViewMode = 'outline' | 'mindmap' | 'source';

/** 生成图表 ID */
function genDiagramId(): string {
  return 'mm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

/** 数据迁移：旧的单图表 → 多图表 diagrams 数组 */
function migrateToDiagrams(data: MindmapPluginData): MindmapDiagram[] {
  if (data.diagrams && data.diagrams.length > 0) return data.diagrams;
  if (data.jsonData || data.markdownContent) {
    return [{ id: genDiagramId(), title: '导图 1', markdownContent: data.markdownContent, jsonData: data.jsonData, layout: data.layout, smTheme: data.smTheme }];
  }
  return [{ id: genDiagramId(), title: '导图 1' }];
}

/**
 * 思维导图插件面板
 *
 * UI 架构：
 * - 默认打开大纲编辑模式（Markdown 标题层级）
 * - 切换到思维导图模式时显示交互式导图（auto-fit）
 * - AI 功能全部在侧边助手面板中，主面板只做编辑和可视化
 */
export function MindMapPluginPanel({ document, content, pluginData, onPluginDataChange }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const data = (pluginData as MindmapPluginData) || {};

  // ── 多标签管理 ──
  const [diagrams, setDiagrams] = useState<MindmapDiagram[]>(() => migrateToDiagrams(data));
  const [activeTabId, setActiveTabId] = useState<string>(() => data.activeDiagramId || migrateToDiagrams(data)[0]?.id || '');
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activeDiagram = useMemo(() => diagrams.find(d => d.id === activeTabId) || diagrams[0], [diagrams, activeTabId]);

  // 旧数据迁移：如果只有 markdownContent 没有 jsonData，自动转换
  const initialJsonData = activeDiagram?.jsonData || (activeDiagram?.markdownContent ? markdownToMindMapData(activeDiagram.markdownContent) : undefined);

  const [viewMode, setViewMode] = useState<MindMapViewMode>('outline');
  const [sourceMarkdown, setSourceMarkdown] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentLayout, setCurrentLayout] = useState<MindMapLayout>(activeDiagram?.layout || 'logicalStructure');
  const [currentTheme, setCurrentTheme] = useState(activeDiagram?.smTheme || 'default');
  const [fullscreen, setFullscreen] = useState(false);
  const [jsonData, setJsonData] = useState<SMNode | undefined>(initialJsonData);
  const [showSearch, setShowSearch] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [rainbowLines, setRainbowLines] = useState(false);
  const [zoomScale, setZoomScale] = useState(100);
  const mindmapRef = useRef<SimpleMindMapRendererRef>(null);
  const fullscreenMindmapRef = useRef<SimpleMindMapRendererRef>(null);
  const outlineRef = useRef<OutlineEditorRef>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 防止内部数据变更 → pluginData → 外部监听 → 再次 setJsonData 的回流循环
  const internalUpdateRef = useRef(false);

  // 节点统计
  const nodeCount = jsonData ? countNodes(jsonData) : 0;
  const maxDepth = jsonData ? getMaxDepth(jsonData) : 0;

  // 右键菜单操作（使用 ref 回调，避免依赖 AI handler 的声明顺序）
  const aiHandlersRef = useRef<{
    expand: () => void; summarize: () => void; rephrase: () => void;
    siblings: () => void; translate: () => void; setNote: () => void;
  }>({ expand: () => {}, summarize: () => {}, rephrase: () => {}, siblings: () => {}, translate: () => {}, setNote: () => {} });

  const contextMenuActions: ContextMenuAction = useMemo(() => ({
    addChild: () => mindmapRef.current?.addChildNode(),
    addSibling: () => mindmapRef.current?.addSiblingNode(),
    deleteNode: () => mindmapRef.current?.deleteNode(),
    expandAll: () => mindmapRef.current?.expandAll(),
    collapseToLevel: (level: number) => mindmapRef.current?.collapseToLevel(level),
    aiExpandNode: () => aiHandlersRef.current.expand(),
    aiSummarizeBranch: () => aiHandlersRef.current.summarize(),
    aiRephraseNode: () => aiHandlersRef.current.rephrase(),
    aiSuggestSiblings: () => aiHandlersRef.current.siblings(),
    aiTranslateBranch: () => aiHandlersRef.current.translate(),
    aiSetNote: () => aiHandlersRef.current.setNote(),
  }), []);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  // ── 持久化 diagrams → pluginData ──
  const persistDiagrams = useCallback((newDiagrams: MindmapDiagram[], newActiveId?: string) => {
    setDiagrams(newDiagrams);
    const active = newDiagrams.find(d => d.id === (newActiveId || activeTabId)) || newDiagrams[0];
    onPluginDataChange({
      ...data, diagrams: newDiagrams, activeDiagramId: active?.id,
      jsonData: active?.jsonData, markdownContent: active?.markdownContent,
      layout: active?.layout, smTheme: active?.smTheme,
    });
  }, [data, onPluginDataChange, activeTabId]);

  const updateData = useCallback((updates: Partial<MindmapPluginData>) => {
    // 同步更新当前标签的数据
    const newDiagrams = diagrams.map(d => {
      if (d.id !== activeTabId) return d;
      const u: Partial<MindmapDiagram> = {};
      if (updates.jsonData !== undefined) u.jsonData = updates.jsonData;
      if (updates.markdownContent !== undefined) u.markdownContent = updates.markdownContent;
      if (updates.layout !== undefined) u.layout = updates.layout;
      if (updates.smTheme !== undefined) u.smTheme = updates.smTheme;
      return { ...d, ...u };
    });
    persistDiagrams(newDiagrams);
  }, [diagrams, activeTabId, persistDiagrams]);

  // ── 标签页操作 ──
  const handleAddTab = useCallback(() => {
    const newId = genDiagramId();
    const nd: MindmapDiagram = { id: newId, title: `导图 ${diagrams.length + 1}` };
    const newDiagrams = [...diagrams, nd];
    setActiveTabId(newId);
    setJsonData(undefined);
    setCurrentLayout('logicalStructure');
    setCurrentTheme('default');
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
      const target = newDiagrams.find(d => d.id === newActiveId);
      setJsonData(target?.jsonData);
      setCurrentLayout(target?.layout || 'logicalStructure');
      setCurrentTheme(target?.smTheme || 'default');
    }
    persistDiagrams(newDiagrams, newActiveId);
  }, [diagrams, activeTabId, persistDiagrams]);

  const handleSwitchTab = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    setActiveTabId(tabId);
    const target = diagrams.find(d => d.id === tabId);
    const jd = target?.jsonData || (target?.markdownContent ? markdownToMindMapData(target.markdownContent) : undefined);
    setJsonData(jd);
    setCurrentLayout(target?.layout || 'logicalStructure');
    setCurrentTheme(target?.smTheme || 'default');
    setShowSearch(false);
    setSearchKeyword('');
    setReplaceText('');
  }, [activeTabId, diagrams]);

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

  // ── 布局切换 ──
  const handleLayoutChange = useCallback((layout: MindMapLayout) => {
    setCurrentLayout(layout);
    mindmapRef.current?.setLayout(layout);
    updateData({ layout });
    host.docData!.markDirty();
  }, [updateData, host]);

  // ── 主题切换 ──
  const handleThemeChange = useCallback((themeName: string) => {
    setCurrentTheme(themeName);
    mindmapRef.current?.setTheme(themeName);
    updateData({ smTheme: themeName });
    host.docData!.markDirty();
  }, [updateData, host]);

  // ── simple-mind-map 数据变更回调 ──
  const handleMindmapDataChange = useCallback((newData: SMNode) => {
    internalUpdateRef.current = true;
    setJsonData(newData);
    const md = mindMapDataToMarkdown(newData);
    updateData({ jsonData: newData, markdownContent: md });
    host.docData!.markDirty();
    // 异步清除标志，确保 React 批量更新完成后再允许外部数据同步
    queueMicrotask(() => { setTimeout(() => { internalUpdateRef.current = false; }, 0); });
  }, [updateData, host]);

  // ── 大纲编辑（直接操作 SMNode 树） ──
  const handleOutlineDataChange = useCallback((newData: SMNode) => {
    internalUpdateRef.current = true;
    setJsonData(newData);
    const md = mindMapDataToMarkdown(newData);
    updateData({ jsonData: newData, markdownContent: md });
    host.docData!.markDirty();
    queueMicrotask(() => { setTimeout(() => { internalUpdateRef.current = false; }, 0); });
  }, [updateData, host]);

  // ── 从文档标题结构提取 ──
  const handleExtractHeadings = () => {
    const sourceContent = content || document.aiGeneratedContent || document.content || '';
    if (!sourceContent.trim()) {
      showStatus(t('emptyContent'), true);
      return;
    }

    const lines = sourceContent.split('\n');
    const headings: string[] = [`# ${document.title || '文档'}`];
    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.*)/);
      if (match) headings.push(line);
    }

    if (headings.length <= 1) {
      const paragraphs = sourceContent.split(/\n\n+/).filter(p => p.trim()).slice(0, 20);
      for (const p of paragraphs) {
        const firstLine = p.split('\n')[0].trim().slice(0, 40);
        headings.push(`## ${firstLine}`);
      }
    }

    const md = headings.join('\n');
    const newJsonData = markdownToMindMapData(md);
    setJsonData(newJsonData);
    updateData({ markdownContent: md, jsonData: newJsonData });
    host.docData!.markDirty();
    showStatus(t('generateSuccess'));
  };

  // ── 模式切换 ──
  const handleSwitchToMindmap = useCallback(() => {
    setViewMode('mindmap');
  }, []);

  const handleSwitchToOutline = useCallback(() => {
    setViewMode('outline');
  }, []);

  const handleSwitchToSource = useCallback(() => {
    if (jsonData) {
      setSourceMarkdown(mindMapDataToMarkdown(jsonData));
    }
    setViewMode('source');
  }, [jsonData]);

  const handleSourceChange = useCallback((md: string) => {
    internalUpdateRef.current = true;
    setSourceMarkdown(md);
    const newJson = markdownToMindMapData(md);
    setJsonData(newJson);
    updateData({ jsonData: newJson, markdownContent: md });
    host.docData!.markDirty();
    queueMicrotask(() => { setTimeout(() => { internalUpdateRef.current = false; }, 0); });
  }, [updateData, host]);

  // 切换到思维导图模式后触发 resize + 居中
  useEffect(() => {
    if (viewMode === 'mindmap' && jsonData) {
      const timer = setTimeout(() => {
        const inst = mindmapRef.current?.getInstance();
        if (inst) {
          inst.resize?.();
          // 首次切换到导图模式时，fit 并将根节点居中
          setTimeout(() => {
            mindmapRef.current?.fitContent();
            setTimeout(() => mindmapRef.current?.moveToCenter(), 100);
          }, 100);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  // 监听外部数据变化（助手面板"替换导图"/"追加到导图"等操作）
  const prevDataRef = useRef(data);
  useEffect(() => {
    // 内部变更引发的 pluginData 更新不需要回流
    if (internalUpdateRef.current) return;
    if (data !== prevDataRef.current) {
      prevDataRef.current = data;
      if (data.jsonData && data.jsonData !== jsonData) {
        setJsonData(data.jsonData);
        // 同步到当前标签
        setDiagrams(prev => prev.map(d => d.id !== activeTabId ? d : { ...d, jsonData: data.jsonData, markdownContent: data.markdownContent }));
      }
    }
  }, [data, jsonData, activeTabId]);

  // ── 导出功能 ──
  const safeTitle = document.title?.replace(/[/\\:*?"<>|]/g, '_') || '思维导图';

  const handleExportSvg = async () => {
    if (!mindmapRef.current) { showStatus('请先切换到思维导图模式再导出 SVG', true); return; }
    try {
      const svgDataUrl = await mindmapRef.current.exportSvg();
      if (!svgDataUrl) { showStatus('SVG 导出失败', true); return; }
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_思维导图.svg`, extensions: ['svg'] });
      if (!filePath) return;
      const svgStr = decodeURIComponent(svgDataUrl.split(',').slice(1).join(','));
      await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(new TextEncoder().encode(svgStr)) });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const handleExportPng = async () => {
    if (!mindmapRef.current) { showStatus('请先切换到思维导图模式再导出 PNG', true); return; }
    try {
      const pngDataUrl = await mindmapRef.current.exportPng();
      if (!pngDataUrl) { showStatus('PNG 导出失败', true); return; }
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_思维导图.png`, extensions: ['png'] });
      if (!filePath) return;
      const base64 = pngDataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(bytes) });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const handleExportMarkdown = async () => {
    const md = data.markdownContent || (jsonData ? mindMapDataToMarkdown(jsonData) : '');
    if (!md) return;
    try {
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_思维导图.md`, extensions: ['md', 'txt'] });
      if (!filePath) return;
      await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(new TextEncoder().encode(md)) });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const handleExportHtml = async () => {
    const md = data.markdownContent || (jsonData ? mindMapDataToMarkdown(jsonData) : '');
    if (!md) return;
    try {
      const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${document.title || '思维导图'}</title>
<script src="https://cdn.jsdelivr.net/npm/markmap-autoloader"></script>
</head><body>
<div class="markmap">
<script type="text/template">
${md}
</script>
</div>
</body></html>`;
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_思维导图.html`, extensions: ['html'] });
      if (!filePath) return;
      await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(new TextEncoder().encode(htmlContent)) });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const handleExportJson = async () => {
    const exportData = mindmapRef.current?.getData() || jsonData;
    if (!exportData) return;
    try {
      const jsonStr = JSON.stringify(exportData, null, 2);
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_思维导图.json`, extensions: ['json'] });
      if (!filePath) return;
      await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(new TextEncoder().encode(jsonStr)) });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  // ── 导入功能 ──
  const handleImport = async (type: 'json' | 'markdown') => {
    try {
      const filters = type === 'json'
        ? [{ name: 'JSON 文件', extensions: ['json'] }]
        : [{ name: 'Markdown 文件', extensions: ['md', 'txt', 'markdown'] }];
      const filePath = await host.ui.showOpenDialog({ filters });
      if (!filePath) return;
      const fileContent = await host.platform.invoke('read_text_file', { path: filePath }) as string;
      if (!fileContent?.trim()) { showStatus('文件内容为空', true); return; }

      let newJsonData: SMNode;
      if (type === 'json') {
        const parsed = JSON.parse(fileContent);
        if (!isValidSMNode(parsed)) { showStatus('JSON 格式不符合思维导图数据结构', true); return; }
        newJsonData = parsed;
      } else {
        newJsonData = markdownToMindMapData(fileContent);
      }

      const md = mindMapDataToMarkdown(newJsonData);
      setJsonData(newJsonData);
      updateData({ markdownContent: md, jsonData: newJsonData });
      host.docData!.markDirty();
      showStatus(`已导入: ${filePath.split('/').pop() || filePath}`);
    } catch (error) {
      showStatus(`导入失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  // ── AI 节点级操作（保留给右键菜单使用） ──
  const [_aiNodeBusy, setAiNodeBusy] = useState(false);

  const aiNodeOp = useCallback(async (buildPrompt: () => { system: string; user: string } | null, applyResult: (md: string) => void) => {
    const prompts = buildPrompt();
    if (!prompts) { showStatus('请先选中一个节点', true); return; }
    setAiNodeBusy(true);
    showStatus('AI 正在处理...', false, true);
    try {
      const result = await host.ai.chat([
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user },
      ], { maxTokens: 2048 });
      applyResult(result);
      host.docData!.markDirty();
      showStatus('AI 操作完成');
    } catch (err) {
      showStatus(`AI 操作失败: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setAiNodeBusy(false);
    }
  }, [host, showStatus]);

  // 获取当前模式下的活动节点信息
  const getActiveRef = useCallback(() => {
    return viewMode === 'outline' ? outlineRef.current : mindmapRef.current;
  }, [viewMode]);

  const handleAiExpandNode = useCallback(() => {
    aiNodeOp(
      () => {
        const info = getActiveRef()?.getActiveNodeInfo();
        if (!info) return null;
        return {
          system: '你是思维导图专家。根据提供的节点信息，为该节点生成3-5个子节点。使用 Markdown 标题语法输出，其中 # 是当前节点，## 是子节点。只输出 Markdown，不要解释。每个节点文字简洁，不超过12字。',
          user: `当前节点: "${info.text}"\n路径: ${info.path.join(' > ')}\n\n请为此节点生成子节点。`,
        };
      },
      (md) => {
        const children = markdownToBranch(md);
        if (children.length > 0) getActiveRef()?.insertChildrenToActive(children);
      },
    );
  }, [aiNodeOp, getActiveRef]);

  const handleAiSummarizeBranch = useCallback(() => {
    aiNodeOp(
      () => {
        const branchMd = getActiveRef()?.getActiveBranchMarkdown();
        if (!branchMd) return null;
        return {
          system: '你是思维导图专家。请精简以下分支结构，合并重复内容，保留核心要点，层级不超过3层。使用 Markdown 标题语法输出。只输出 Markdown，不要解释。',
          user: branchMd,
        };
      },
      (md) => {
        const newData = markdownToMindMapData(md);
        if (newData.children.length > 0) getActiveRef()?.updateActiveNodeChildren(newData.children);
      },
    );
  }, [aiNodeOp, getActiveRef]);

  const handleAiRephraseNode = useCallback(() => {
    aiNodeOp(
      () => {
        const info = getActiveRef()?.getActiveNodeInfo();
        if (!info) return null;
        return {
          system: '你是文案专家。请将以下思维导图节点文字改写为更简洁专业的表述。只输出改写后的文字，不超过15字，不要加任何标点或解释。',
          user: `原文: "${info.text}"`,
        };
      },
      (text) => {
        const clean = text.replace(/^["'#\s]+|["'#\s]+$/g, '').trim();
        if (clean) getActiveRef()?.updateActiveNodeText(clean);
      },
    );
  }, [aiNodeOp, getActiveRef]);

  const handleAiSuggestSiblings = useCallback(() => {
    aiNodeOp(
      () => {
        const info = getActiveRef()?.getActiveNodeInfo();
        if (!info || info.isRoot) { showStatus('根节点无法添加同级', true); return null; }
        const parentPath = info.path.slice(0, -1);
        return {
          system: '你是思维导图专家。根据上下文，建议2-4个与当前节点同级的新节点。每行一个节点名称，不加序号和标点，每个不超过12字。',
          user: `父节点路径: ${parentPath.join(' > ')}\n当前节点: "${info.text}"\n\n请建议同级节点。`,
        };
      },
      (text) => {
        const ref = getActiveRef();
        if (viewMode === 'mindmap') {
          const lines = text.split('\n').map(l => l.replace(/^[-*\d.#\s]+/, '').trim()).filter(l => l && l.length < 30);
          for (const line of lines) {
            mindmapRef.current?.addSiblingNode();
            setTimeout(() => mindmapRef.current?.updateActiveNodeText(line), 100);
          }
        } else {
          const children = text.split('\n').map(l => l.replace(/^[-*\d.#\s]+/, '').trim()).filter(l => l && l.length < 30)
            .map(l => ({ data: { text: l }, children: [] as SMNode[] }));
          if (children.length > 0 && ref) ref.insertChildrenToActive(children);
        }
      },
    );
  }, [aiNodeOp, getActiveRef, viewMode, showStatus]);

  const handleAiTranslateBranch = useCallback(() => {
    aiNodeOp(
      () => {
        const branchMd = getActiveRef()?.getActiveBranchMarkdown();
        if (!branchMd) return null;
        const isChinese = /[\u4e00-\u9fa5]/.test(branchMd);
        const targetLang = isChinese ? '英文' : '中文';
        return {
          system: `你是翻译专家。将以下思维导图分支翻译为${targetLang}。保持 Markdown 标题层级结构不变。只输出翻译后的 Markdown，不要解释。`,
          user: branchMd,
        };
      },
      (md) => {
        const ref = getActiveRef();
        const newData = markdownToMindMapData(md);
        ref?.updateActiveNodeText(newData.data.text);
        if (newData.children.length > 0) ref?.updateActiveNodeChildren(newData.children);
      },
    );
  }, [aiNodeOp, getActiveRef]);

  const handleAiContinue = useCallback(() => {
    const currentMd = data.markdownContent || (jsonData ? mindMapDataToMarkdown(jsonData) : '');
    if (!currentMd.trim()) { showStatus('没有可续写的内容', true); return; }
    aiNodeOp(
      () => ({
        system: '你是思维导图专家。分析当前思维导图结构，找出内容薄弱或缺少子节点的分支，补充2-3个子节点。保持现有结构不变，只在薄弱处添加内容。使用 Markdown 标题语法输出完整的思维导图。只输出 Markdown。',
        user: `当前思维导图：\n${currentMd}`,
      }),
      (md) => {
        const newJsonData = markdownToMindMapData(md);
        setJsonData(newJsonData);
        updateData({ markdownContent: mindMapDataToMarkdown(newJsonData), jsonData: newJsonData });
      },
    );
  }, [aiNodeOp, data.markdownContent, jsonData, updateData, showStatus]);

  const handleAiBeautify = useCallback(() => {
    const currentMd = data.markdownContent || (jsonData ? mindMapDataToMarkdown(jsonData) : '');
    if (!currentMd.trim()) { showStatus('没有可美化的内容', true); return; }
    aiNodeOp(
      () => ({
        system: '你是思维导图专家。请优化以下思维导图：1）精炼每个节点文字（不超过12字）2）优化层级结构（合理分组、去重）3）确保逻辑清晰、层次分明。使用 Markdown 标题语法输出完整的优化后思维导图。只输出 Markdown。',
        user: `当前思维导图：\n${currentMd}`,
      }),
      (md) => {
        const newJsonData = markdownToMindMapData(md);
        setJsonData(newJsonData);
        updateData({ markdownContent: mindMapDataToMarkdown(newJsonData), jsonData: newJsonData });
      },
    );
  }, [aiNodeOp, data.markdownContent, jsonData, updateData, showStatus]);

  // 编辑备注（弹出 prompt 输入）
  const handleSetNote = useCallback(() => {
    const ref = getActiveRef();
    const info = ref?.getActiveNodeInfo();
    if (!info) { showStatus('请先选中一个节点', true); return; }
    const note = window.prompt('输入节点备注：', '');
    if (note !== null) {
      ref?.setActiveNodeNote(note);
      host.docData!.markDirty();
      showStatus(note ? '已添加备注' : '已清除备注');
    }
  }, [host, showStatus, getActiveRef]);

  // 绑定 AI handler 引用
  aiHandlersRef.current = {
    expand: handleAiExpandNode,
    summarize: handleAiSummarizeBranch,
    rephrase: handleAiRephraseNode,
    siblings: handleAiSuggestSiblings,
    translate: handleAiTranslateBranch,
    setNote: handleSetNote,
  };

  // ── 监听快捷操作面板的 direct-action 事件 ──
  useEffect(() => {
    const handler = (e: Event) => {
      const actionId = (e as CustomEvent).detail?.actionId;
      if (actionId === 'node_expand') handleAiExpandNode();
      else if (actionId === 'node_summarize') handleAiSummarizeBranch();
      else if (actionId === 'node_rephrase') handleAiRephraseNode();
      else if (actionId === 'node_siblings') handleAiSuggestSiblings();
      else if (actionId === 'node_translate') handleAiTranslateBranch();
      else if (actionId === 'node_continue') handleAiContinue();
      else if (actionId === 'node_beautify') handleAiBeautify();
      else if (actionId === 'export_svg') handleExportSvg();
      else if (actionId === 'export_png') handleExportPng();
      else if (actionId === 'export_markdown') handleExportMarkdown();
      else if (actionId === 'export_html') handleExportHtml();
      else if (actionId === 'export_json') handleExportJson();
    };
    window.addEventListener('mindmap-direct-action', handler);
    return () => window.removeEventListener('mindmap-direct-action', handler);
  }, [handleAiExpandNode, handleAiSummarizeBranch, handleAiRephraseNode, handleAiSuggestSiblings, handleAiTranslateBranch, handleAiContinue, handleAiBeautify]);

  const handleCopyMarkdown = async () => {
    const md = data.markdownContent || (jsonData ? mindMapDataToMarkdown(jsonData) : '');
    if (!md) return;
    await navigator.clipboard.writeText(md);
    setCopied(true);
    showStatus(t('copiedToClipboard'));
    setTimeout(() => setCopied(false), 2000);
  };

  const hasContent = !!jsonData;
  const currentLayoutLabel = SM_LAYOUTS.find(l => l.key === currentLayout)?.label || '逻辑结构图';
  const currentThemeLabel = SM_THEMES.find(t => t.key === currentTheme)?.label || '默认';

  // ── 清空（当前标签） ──
  const handleClearAll = () => {
    setJsonData(undefined);
    setCurrentLayout('logicalStructure');
    setCurrentTheme('default');
    const newDiagrams = diagrams.map(d => d.id !== activeTabId ? d : { ...d, jsonData: undefined, markdownContent: undefined, layout: undefined, smTheme: undefined });
    persistDiagrams(newDiagrams);
    host.docData!.markDirty();
    showStatus('已清空当前导图');
  };

  // ── 渲染 ──
  return (
      <div className="h-full flex flex-col">
        {/* ① 工具栏 */}
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20 flex-shrink-0 flex-wrap">
          {/* 模式切换 */}
          <div className="flex items-center bg-muted rounded-md p-0.5">
            <Button
              variant={viewMode === 'outline' ? 'default' : 'ghost'}
              size="sm"
              onClick={handleSwitchToOutline}
              className={`h-6 px-2 text-xs gap-1 ${viewMode === 'outline' ? 'bg-primary text-primary-foreground shadow-sm font-medium' : ''}`}
            >
              <AlignLeft className="h-3 w-3" />大纲
            </Button>
            <Button
              variant={viewMode === 'mindmap' ? 'default' : 'ghost'}
              size="sm"
              onClick={handleSwitchToMindmap}
              className={`h-6 px-2 text-xs gap-1 ${viewMode === 'mindmap' ? 'bg-primary text-primary-foreground shadow-sm font-medium' : ''}`}
              disabled={!jsonData}
            >
              <Network className="h-3 w-3" />导图
            </Button>
            <Button
              variant={viewMode === 'source' ? 'default' : 'ghost'}
              size="sm"
              onClick={handleSwitchToSource}
              className={`h-6 px-2 text-xs gap-1 ${viewMode === 'source' ? 'bg-primary text-primary-foreground shadow-sm font-medium' : ''}`}
              disabled={!jsonData}
            >
              <FileCode className="h-3 w-3" />源码
            </Button>
          </div>

          {/* 提取标题 */}
          <Button variant="outline" size="sm" onClick={handleExtractHeadings} className="gap-1 h-7 text-xs">
            <ListTree className="h-3 w-3" />提取标题
          </Button>

          {/* 大纲模式工具 */}
          {viewMode === 'outline' && jsonData && (
            <>
              <div className="w-px h-4 bg-border" />
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.addSibling()} className="h-7 px-1.5" title="添加节点 (Enter)">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.deleteNode()} className="h-7 px-1.5" title="删除节点 (Ctrl+Shift+Backspace)">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border" />
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.moveUp()} className="h-7 px-1.5" title="上移节点 (Ctrl+Shift+↑)">
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.moveDown()} className="h-7 px-1.5" title="下移节点 (Ctrl+Shift+↓)">
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.indent()} className="h-7 px-1.5" title="缩进 (Tab)">
                <Indent className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.outdent()} className="h-7 px-1.5" title="反缩进 (Shift+Tab)">
                <Outdent className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border" />
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.cloneNode()} className="h-7 px-1.5" title="克隆节点 (Ctrl+D)">
                <CopyPlus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.toggleComplete()} className="h-7 px-1.5" title="标记完成 (Ctrl+Enter)">
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border" />
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.undo()} className="h-7 px-1.5" title="撤销 (Ctrl+Z)">
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.redo()} className="h-7 px-1.5" title="重做 (Ctrl+Shift+Z)">
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border" />
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.openSearch()} className="h-7 px-1.5" title="搜索 (Ctrl+F)">
                <Search className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.expandAll()} className="h-7 px-1.5" title="展开全部">
                <ChevronsDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => outlineRef.current?.collapseAll()} className="h-7 px-1.5" title="折叠全部">
                <ChevronsUp className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {/* 思维导图模式工具 */}
          {viewMode === 'mindmap' && jsonData && (
            <>
              <div className="w-px h-4 bg-border" />

              {/* 布局切换 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                    <Layout className="h-3 w-3" />{currentLayoutLabel}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {SM_LAYOUTS.map(l => (
                    <DropdownMenuItem
                      key={l.key}
                      onClick={() => handleLayoutChange(l.key)}
                      className={currentLayout === l.key ? 'bg-primary/10 font-medium' : ''}
                    >
                      {l.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 主题切换 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                    <ChevronsUpDown className="h-3 w-3" />{currentThemeLabel}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                  {SM_THEMES.map(th => (
                    <DropdownMenuItem
                      key={th.key}
                      onClick={() => handleThemeChange(th.key)}
                      className={currentTheme === th.key ? 'bg-primary/10 font-medium' : ''}
                    >
                      {th.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <div className="flex-1" />

          {/* 思维导图模式编辑工具 */}
          {viewMode === 'mindmap' && jsonData && (
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="sm" onClick={() => mindmapRef.current?.addChildNode()} className="h-7 px-1.5" title="添加子节点 (Tab)">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => mindmapRef.current?.addSiblingNode()} className="h-7 px-1.5" title="添加同级节点 (Enter)">
                <GitBranch className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => mindmapRef.current?.deleteNode()} className="h-7 px-1.5" title="删除节点 (Delete)">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <Button variant="ghost" size="sm" onClick={() => mindmapRef.current?.undo()} className="h-7 px-1.5" title="撤销 (Ctrl+Z)">
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => mindmapRef.current?.redo()} className="h-7 px-1.5" title="重做 (Ctrl+Y)">
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5" />
              {/* 展开/收起 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-1.5" title="展开/收起">
                    <ChevronsDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => mindmapRef.current?.expandAll()}>
                    <ChevronsDown className="h-4 w-4 mr-2" />展开全部
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => mindmapRef.current?.collapseToLevel(1)}>
                    <ChevronsUp className="h-4 w-4 mr-2" />收起到第 1 层
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => mindmapRef.current?.collapseToLevel(2)}>
                    <ChevronsUp className="h-4 w-4 mr-2" />收起到第 2 层
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => mindmapRef.current?.collapseToLevel(3)}>
                    <ChevronsUp className="h-4 w-4 mr-2" />收起到第 3 层
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="w-px h-4 bg-border mx-0.5" />
              {/* 搜索 */}
              <Button variant="ghost" size="sm" onClick={() => setShowSearch(!showSearch)} className={`h-7 px-1.5 ${showSearch ? 'bg-accent' : ''}`} title="搜索节点 (Ctrl+F)">
                <Search className="h-3.5 w-3.5" />
              </Button>
              {/* 小地图 */}
              <Button variant="ghost" size="sm" onClick={() => { setShowMiniMap(!showMiniMap); mindmapRef.current?.toggleMiniMap(!showMiniMap); }} className={`h-7 px-1.5 ${showMiniMap ? 'bg-accent' : ''}`} title="小地图">
                <Map className="h-3.5 w-3.5" />
              </Button>
              {/* 彩虹线条 */}
              <Button variant="ghost" size="sm" onClick={() => { setRainbowLines(!rainbowLines); mindmapRef.current?.toggleRainbowLines(!rainbowLines); }} className={`h-7 px-1.5 ${rainbowLines ? 'bg-accent' : ''}`} title="彩虹线条">
                <Rainbow className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5" />
              {/* 缩放控件 */}
              <Button variant="ghost" size="sm" onClick={() => mindmapRef.current?.zoomOut()} className="h-7 w-7 p-0" title="缩小 (Ctrl+-)">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <button
                className="text-xs text-muted-foreground hover:text-foreground px-1 min-w-[36px] text-center"
                onClick={() => { mindmapRef.current?.resetScale(); setZoomScale(100); }}
                title="重置缩放"
              >
                {zoomScale}%
              </button>
              <Button variant="ghost" size="sm" onClick={() => mindmapRef.current?.zoomIn()} className="h-7 w-7 p-0" title="放大 (Ctrl++)">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <Button variant="ghost" size="sm" onClick={() => mindmapRef.current?.moveToCenter()} className="h-7 w-7 p-0" title="定位根节点到中心">
                <Crosshair className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => mindmapRef.current?.fitContent()} className="h-7 w-7 p-0" title="适应窗口">
                <Scan className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setFullscreen(true)} className="h-7 w-7 p-0" title="全屏预览">
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* 复制 & 导入 & 导出 & 清空 */}
          {hasContent && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopyMarkdown} className="gap-1 h-7 text-xs">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? t('copied') : 'MD'}
              </Button>
              {/* 导入 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                    <Upload className="h-3 w-3" />导入
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleImport('json')}>
                    <FileJson className="h-4 w-4 mr-2" />导入 JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleImport('markdown')}>
                    <FileCode className="h-4 w-4 mr-2" />导入 Markdown
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* 导出 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                    <Download className="h-3 w-3" />{t('export')}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportSvg}>
                    <Download className="h-4 w-4 mr-2" />导出 SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPng}>
                    <Image className="h-4 w-4 mr-2" />导出 PNG（高清）
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportMarkdown}>
                    <FileCode className="h-4 w-4 mr-2" />导出 Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJson}>
                    <FileJson className="h-4 w-4 mr-2" />导出 JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportHtml}>
                    <FileCode className="h-4 w-4 mr-2" />导出 HTML（自包含）
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* 清空 */}
              <Button variant="outline" size="sm" onClick={handleClearAll} className="gap-1 h-7 text-xs text-destructive border-destructive/50 hover:bg-destructive/10">
                <Trash2 className="h-3 w-3" />清空
              </Button>
            </>
          )}
        </div>

        {/* ①-b 导图标签栏 */}
        <div className="flex items-center gap-0 px-1 border-b bg-muted/30 flex-shrink-0 overflow-x-auto scrollbar-hide">
          {diagrams.map(d => (
            <div
              key={d.id}
              className={`group flex items-center gap-1 px-2 py-1 text-xs cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
                d.id === activeTabId
                  ? 'border-primary text-foreground bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
              onClick={() => handleSwitchTab(d.id)}
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
            title="新建导图"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ② 搜索栏（仅思维导图模式） */}
        {viewMode === 'mindmap' && showSearch && jsonData && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="搜索节点..."
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                if (e.target.value) mindmapRef.current?.search(e.target.value);
                else mindmapRef.current?.closeSearch();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setShowSearch(false); mindmapRef.current?.closeSearch(); }
                if (e.key === 'Enter' && searchKeyword) mindmapRef.current?.search(searchKeyword);
              }}
              autoFocus
            />
            <input
              className="w-32 bg-transparent text-sm outline-none placeholder:text-muted-foreground border-l pl-2"
              placeholder="替换为..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setShowSearch(false); mindmapRef.current?.closeSearch(); }
              }}
            />
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { if (searchKeyword && replaceText) mindmapRef.current?.replace(replaceText); }}>
              替换
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { if (searchKeyword && replaceText) mindmapRef.current?.replaceAll(searchKeyword, replaceText); }}>
              全部
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setShowSearch(false); setSearchKeyword(''); setReplaceText(''); mindmapRef.current?.closeSearch(); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* ③ 内容区 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {viewMode === 'outline' ? (
            /* 幕布式大纲编辑模式 */
            !jsonData ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
                <Brain className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-lg font-medium text-muted-foreground">{t('title')}</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  点击下方按钮开始创建大纲，或点击"提取标题"从文档中生成，也可以在 AI 助手面板中使用 AI 生成。
                </p>
                <Button
                  onClick={() => {
                    const root: SMNode = { data: { text: '思维导图' }, children: [{ data: { text: '' }, children: [] }] };
                    handleOutlineDataChange(root);
                  }}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />开始创建大纲
                </Button>
              </div>
            ) : (
              <OutlineEditor
                ref={outlineRef}
                data={jsonData}
                onDataChange={handleOutlineDataChange}
                className="h-full"
              />
            )
          ) : viewMode === 'source' ? (
            /* Markdown 源码编辑模式 */
            <MarkdownEditor
              value={sourceMarkdown}
              onChange={handleSourceChange}
              placeholder="输入 Markdown 思维导图源码..."
              showToolbar={true}
              showViewModeSwitch={false}
              editable={true}
            />
          ) : (
            /* 思维导图模式 */
            <div className="w-full h-full relative">
              {jsonData && (
                <>
                  <SimpleMindMapRenderer
                    ref={mindmapRef}
                    data={jsonData}
                    layout={currentLayout}
                    theme={currentTheme}
                    onDataChange={handleMindmapDataChange}
                    showMiniMap={showMiniMap}
                    rainbowLines={rainbowLines}
                    onScaleChange={setZoomScale}
                    className="w-full h-full"
                  />
                  <MindMapContextMenu
                    getMindMapInstance={() => mindmapRef.current?.getInstance()}
                    actions={contextMenuActions}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* ④ 永久状态栏 */}
        <div className="flex items-center gap-2 px-3 py-0.5 border-t bg-muted/30 flex-shrink-0 text-xs text-muted-foreground">
          {/* 当前模式 */}
          <span className="flex items-center gap-1 font-medium">
            {viewMode === 'outline' && <><AlignLeft className="h-3 w-3" />大纲</>}
            {viewMode === 'mindmap' && <><Network className="h-3 w-3" />导图</>}
            {viewMode === 'source' && <><FileCode className="h-3 w-3" />源码</>}
          </span>
          <span className="w-px h-3 bg-border" />
          {/* 节点统计 */}
          {hasContent && (
            <span>{nodeCount} 节点 / {maxDepth} 层</span>
          )}
          {/* 缩放百分比（导图模式） */}
          {viewMode === 'mindmap' && (
            <>
              <span className="w-px h-3 bg-border" />
              <span>{zoomScale}%</span>
            </>
          )}
          {/* 操作反馈消息 */}
          <span className="flex-1" />
          {statusMsg && (
            <span className={statusIsError ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>
              {statusMsg}
            </span>
          )}
        </div>
        {/* 全屏预览 Dialog */}
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              {document.title || '思维导图'} — 全屏预览
              <span className="text-sm font-normal text-muted-foreground ml-2">布局: {currentLayoutLabel} | 主题: {currentThemeLabel}</span>
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)} className="h-8 w-8 p-0">
              <Minimize2 className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-background rounded-lg border">
            {jsonData && (
              <SimpleMindMapRenderer
                ref={fullscreenMindmapRef}
                data={jsonData}
                layout={currentLayout}
                theme={currentTheme}
                onDataChange={handleMindmapDataChange}
                className="w-full h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
  );
}
