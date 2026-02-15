import { useState, useCallback, useRef, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { Brain, Download, Copy, Check, ListTree } from 'lucide-react';
import { truncateContent } from '../_framework/pluginUtils';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { PluginPromptBuilderDialog } from '../_framework/PluginPromptBuilderDialog';

/** 思维导图插件数据 */
interface MindMapPluginData {
  markdown?: string;
  mode?: 'ai' | 'heading';
  lastPrompt?: string;
}

const DEFAULT_PROMPT = '根据本文档的正文内容，生成结构化思维导图。';

const MINDMAP_MODES = [
  { key: 'ai', label: 'AI 智能分析', prompt: '根据本文档的正文内容，生成结构化思维导图。' },
  { key: 'detail', label: '详细展开', prompt: '根据本文档的正文内容，生成详细的多层级思维导图，尽量展开所有要点。' },
  { key: 'summary', label: '精简概括', prompt: '根据本文档的正文内容，生成精简的思维导图，只保留核心要点，不超过3层。' },
];

/** 将 Markdown 标题结构渲染为缩进树形 HTML */
function renderTreeHtml(md: string): string {
  const lines = md.split('\n').filter(l => l.trim());
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
  return lines.map(line => {
    const match = line.match(/^(#{1,6})\s+(.*)/);
    if (match) {
      const level = match[1].length;
      const text = match[2];
      const color = colors[(level - 1) % colors.length];
      const fontSize = Math.max(12, 18 - level * 1.5);
      const fontWeight = level <= 2 ? 600 : 400;
      return `<div style="padding-left:${(level - 1) * 28}px;padding:5px 0;font-size:${fontSize}px;font-weight:${fontWeight};">
        <span style="color:${color};margin-right:6px;">●</span>${text}
      </div>`;
    }
    const cleaned = line.replace(/^[-*]\s*/, '');
    return `<div style="padding-left:28px;padding:3px 0;font-size:13px;color:#888;">- ${cleaned}</div>`;
  }).join('');
}

/**
 * 思维导图插件面板 — 使用 PluginPanelLayout 统一模板
 */
export function MindMapPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const data = (pluginData as MindMapPluginData) || {};
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState(data.lastPrompt || DEFAULT_PROMPT);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState('ai');
  const containerRef = useRef<HTMLDivElement>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  const updateData = useCallback((updates: Partial<MindMapPluginData>) => {
    onPluginDataChange({ ...data, ...updates, lastPrompt: prompt });
  }, [data, prompt, onPluginDataChange]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    onPluginDataChange({ ...data, lastPrompt: val });
    host.docData!.markDirty();
  }, [data, onPluginDataChange, host]);

  useEffect(() => {
    if (containerRef.current && data.markdown) {
      containerRef.current.innerHTML = renderTreeHtml(data.markdown);
    }
  }, [data.markdown]);

  // 从文档标题结构提取
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
    updateData({ markdown: md, mode: 'heading' });
    host.docData!.markDirty();
    showStatus(t('generateSuccess'));
  };

  // AI 生成思维导图
  const handleAiGenerate = async () => {
    const sourceContent = content || document.aiGeneratedContent || document.content || '';
    if (!sourceContent.trim()) {
      showStatus(t('emptyContent'), true);
      return;
    }

    setGenerating(true);
    showStatus('正在生成思维导图，请稍候...', false, true);
    const userPrompt = prompt.trim() || DEFAULT_PROMPT;
    try {
      const messages = [
        { role: 'system', content: '你是一个专业的知识结构化专家。请将用户提供的文档内容分析后，生成一个 Markdown 格式的思维导图结构。使用 Markdown 标题层级（# ## ### ####）表示层级关系，每个节点一行。只输出 Markdown 标题结构，不要输出其他内容。根节点用 # 开头，子节点依次用 ## ### #### 等。每个节点文字简洁，不超过15字。' },
        { role: 'user', content: `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 2048 });

      updateData({ markdown: result, mode: 'ai' });
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

  const handleExportHtml = async () => {
    if (!data.markdown) return;
    try {
      const safeTitle = document.title?.replace(/[/\\:*?"<>|]/g, '_') || '思维导图';
      const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${document.title} - 思维导图</title><style>body{font-family:system-ui,sans-serif;padding:24px;}</style></head><body>${renderTreeHtml(data.markdown)}</body></html>`;
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_思维导图.html`, extensions: ['html'] });
      if (!filePath) return;
      const dataArr = Array.from(new TextEncoder().encode(htmlContent));
      await host.platform.invoke('write_binary_file', { path: filePath, data: dataArr });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!data.markdown) return;
    await navigator.clipboard.writeText(data.markdown);
    setCopied(true);
    showStatus(t('copiedToClipboard'));
    setTimeout(() => setCopied(false), 2000);
  };

  // 提示词构造器
  const handleBuilderConfirm = (builtPrompt: string) => {
    handlePromptChange(builtPrompt);
  };

  const handleBuilderOpen = () => {
    setBuilderMode('ai');
    setBuilderOpen(true);
  };

  const builderPreviewPrompt = MINDMAP_MODES.find(m => m.key === builderMode)?.prompt || DEFAULT_PROMPT;

  const hasContent = !!data.markdown;

  // ── 工具栏 ──
  const toolbarContent = (
    <>
      <Button variant="outline" size="sm" onClick={handleExtractHeadings} disabled={generating} className="gap-1 h-7 text-xs">
        <ListTree className="h-3 w-3" />
        {t('extractHeadings', { defaultValue: '提取标题' })}
      </Button>
      <div className="flex-1" />
      {data.markdown && (
        <>
          <Button variant="outline" size="sm" onClick={handleCopyMarkdown} className="gap-1 h-7 text-xs">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? t('copied') : 'MD'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportHtml} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />HTML
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
      description={t('promptBuilderDesc', { defaultValue: '选择生成模式，自动组装提示词' })}
      onConfirm={handleBuilderConfirm}
      previewPrompt={builderPreviewPrompt}
    >
      <div className="space-y-3">
        <label className="text-sm font-medium">{t('generateMode', { defaultValue: '生成模式' })}</label>
        <div className="flex gap-2 flex-wrap">
          {MINDMAP_MODES.map(m => (
            <Button
              key={m.key}
              variant="outline"
              size="sm"
              onClick={() => setBuilderMode(m.key)}
              className={builderMode === m.key ? 'border-primary bg-primary/10 font-medium' : ''}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>
    </PluginPromptBuilderDialog>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<Brain className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('welcomeDesc')}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder')}
      generating={generating}
      onGenerate={handleAiGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 生成思维导图' })}
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
        host.docData!.markDirty();
        if (containerRef.current) containerRef.current.innerHTML = '';
        showStatus('已清空全部内容');
      }}
      sourceCode={data.markdown || undefined}
      onSourceCodeSave={(code) => {
        onPluginDataChange({ ...data, markdown: code });
        host.docData!.markDirty();
      }}
    >
      {/* ③ 内容区 */}
      <div ref={containerRef} className="p-4" />
    </PluginPanelLayout>
  );
}
