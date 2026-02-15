import { useState, useCallback, useRef, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { GitBranch, Download, Code, Copy, Check } from 'lucide-react';
import { truncateContent } from '../_framework/pluginUtils';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { PluginPromptBuilderDialog } from '../_framework/PluginPromptBuilderDialog';

/** Mermaid 图表插件数据 */
interface DiagramPluginData {
  mermaidCode?: string;
  diagramType?: string;
  lastPrompt?: string;
}

const DEFAULT_PROMPT = '根据本文档的正文内容，生成流程图。';

const DIAGRAM_TYPES = [
  { key: 'auto', label: '自动选择', prompt: '根据本文档的正文内容，自动选择最合适的图表类型并生成' },
  { key: 'flowchart', label: '流程图', prompt: '根据本文档的正文内容，生成流程图（flowchart）' },
  { key: 'sequence', label: '时序图', prompt: '根据本文档的正文内容，生成时序图（sequenceDiagram）' },
  { key: 'classDiagram', label: '类图', prompt: '根据本文档的正文内容，生成类图（classDiagram）' },
  { key: 'stateDiagram', label: '状态图', prompt: '根据本文档的正文内容，生成状态图（stateDiagram-v2）' },
  { key: 'gantt', label: '甘特图', prompt: '根据本文档的正文内容，生成甘特图（gantt）' },
];

/**
 * Mermaid 图表插件面板 — 使用 PluginPanelLayout 统一模板
 */
export function DiagramPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const data = (pluginData as DiagramPluginData) || {};
  const [generating, setGenerating] = useState(false);
  const [showCodeView, setShowCodeView] = useState(false);
  const [activeDiagramType, setActiveDiagramType] = useState(data.diagramType || 'auto');
  const [prompt, setPrompt] = useState(data.lastPrompt || DEFAULT_PROMPT);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderType, setBuilderType] = useState(activeDiagramType);
  const renderRef = useRef<HTMLDivElement>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  const updateData = useCallback((updates: Partial<DiagramPluginData>) => {
    onPluginDataChange({ ...data, ...updates });
  }, [data, onPluginDataChange]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    updateData({ lastPrompt: val });
    host.docData!.markDirty();
  }, [updateData, host]);

  // 渲染 Mermaid 图表
  const renderIdRef = useRef(0);
  const renderMermaid = useCallback(async (code: string) => {
    if (!renderRef.current || !code) return;
    renderRef.current.innerHTML = '';
    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
      renderIdRef.current += 1;
      const uniqueId = `mermaid-diagram-${renderIdRef.current}-${Date.now()}`;
      const { svg } = await mermaid.render(uniqueId, code);
      renderRef.current.innerHTML = svg;
    } catch {
      renderRef.current.innerHTML = `<pre style="padding:16px;background:#f5f5f5;border-radius:8px;overflow:auto;font-size:13px;"><code>${code.replace(/</g, '&lt;')}</code></pre>`;
    }
  }, []);

  useEffect(() => {
    if (data.mermaidCode) renderMermaid(data.mermaidCode);
  }, [data.mermaidCode, renderMermaid]);

  const handleGenerate = async () => {
    const sourceContent = content || document.aiGeneratedContent || document.content || '';
    if (!sourceContent.trim()) {
      showStatus(t('emptyContent'), true);
      return;
    }

    const diagramType = DIAGRAM_TYPES.find(d => d.key === activeDiagramType) || DIAGRAM_TYPES[0];
    setGenerating(true);
    showStatus('正在生成图表，请稍候...', false, true);
    const userPrompt = prompt.trim() || `根据文档内容${diagramType.prompt}`;

    try {
      const messages = [
        { role: 'system', content: `你是一个专业的图表生成专家。请根据用户提供的文档内容生成 Mermaid 图表代码。${diagramType.prompt}。只输出 Mermaid 代码，不要包含 \`\`\`mermaid 标记，不要添加任何解释。确保语法正确。` },
        { role: 'user', content: `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` },
      ];

      let result = await host.ai.chat(messages, { maxTokens: 2048 });

      result = result.replace(/^```mermaid\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

      updateData({ mermaidCode: result, diagramType: activeDiagramType, lastPrompt: prompt });
      host.docData!.markDirty();
      showStatus(t('generateSuccess'));
      onRequestSave?.();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showStatus(t('generateFailed', { error: errMsg }), true);
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!renderRef.current) return;
    const safeTitle = document.title?.replace(/[/\\:*?"<>|]/g, '_') || '图表';
    const svg = renderRef.current.querySelector('svg');
    try {
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_图表.svg`, extensions: ['svg'] });
        if (!filePath) return;
        await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(new TextEncoder().encode(svgData)) });
        showStatus(`已导出: ${filePath}`);
      } else if (data.mermaidCode) {
        const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_图表.txt`, extensions: ['txt'] });
        if (!filePath) return;
        await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(new TextEncoder().encode(data.mermaidCode)) });
        showStatus(`已导出: ${filePath}`);
      }
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const handleCopyCode = async () => {
    if (!data.mermaidCode) return;
    await navigator.clipboard.writeText(data.mermaidCode);
    setCopied(true);
    showStatus(t('copiedToClipboard'));
    setTimeout(() => setCopied(false), 2000);
  };

  // 提示词构造器
  const handleBuilderConfirm = (builtPrompt: string) => {
    setActiveDiagramType(builderType);
    handlePromptChange(builtPrompt);
  };

  const handleBuilderOpen = () => {
    setBuilderType(activeDiagramType);
    setBuilderOpen(true);
  };

  const builderPreviewPrompt = DIAGRAM_TYPES.find(d => d.key === builderType)?.prompt || '';

  const hasContent = !!data.mermaidCode;

  // ── 工具栏 ──
  const toolbarContent = (
    <>
      {data.mermaidCode && (
        <Button variant="outline" size="sm" onClick={() => setShowCodeView(!showCodeView)} className="gap-1 h-7 text-xs">
          <Code className="h-3 w-3" />{showCodeView ? t('preview', { defaultValue: '预览' }) : t('code', { defaultValue: '代码' })}
        </Button>
      )}
      <div className="flex-1" />
      {data.mermaidCode && (
        <>
          <Button variant="outline" size="sm" onClick={handleCopyCode} className="gap-1 h-7 text-xs">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? t('copied') : t('copy')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />{t('export')}
          </Button>
        </>
      )}
    </>
  );

  // ── 提示词构造器弹窗 ──
  const promptBuilderDialog = (
    <PluginPromptBuilderDialog
      open={builderOpen}
      onOpenChange={setBuilderOpen}
      description={t('promptBuilderDesc', { defaultValue: '选择图表类型，自动组装提示词' })}
      onConfirm={handleBuilderConfirm}
      previewPrompt={builderPreviewPrompt}
    >
      <div className="space-y-3">
        <label className="text-sm font-medium">{t('diagramType', { defaultValue: '图表类型' })}</label>
        <div className="flex gap-2 flex-wrap">
          {DIAGRAM_TYPES.map(dt => (
            <Button
              key={dt.key}
              variant="outline"
              size="sm"
              onClick={() => setBuilderType(dt.key)}
              className={builderType === dt.key ? 'border-primary bg-primary/10 font-medium' : ''}
            >
              {dt.label}
            </Button>
          ))}
        </div>
      </div>
    </PluginPromptBuilderDialog>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<GitBranch className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('welcomeDesc')}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder')}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 生成图表' })}
      generatingLabel={t('generating')}
      onPromptBuilderOpen={handleBuilderOpen}
      promptBuilderDialog={promptBuilderDialog}
      toolbar={toolbarContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        onPluginDataChange({});
        setPrompt(DEFAULT_PROMPT);
        setActiveDiagramType('auto');
        host.docData!.markDirty();
        if (renderRef.current) renderRef.current.innerHTML = '';
        showStatus('已清空全部内容');
      }}
      sourceCode={data.mermaidCode || undefined}
      onSourceCodeSave={(code) => {
        onPluginDataChange({ ...data, mermaidCode: code });
        host.docData!.markDirty();
      }}
    >
      {/* ③ 内容区 */}
      {showCodeView ? (
        <pre className="p-4 bg-muted rounded-lg overflow-auto text-sm"><code>{data.mermaidCode}</code></pre>
      ) : (
        <div ref={renderRef} className="w-full flex justify-center p-4" />
      )}
    </PluginPanelLayout>
  );
}
