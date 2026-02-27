import { useState, useCallback, useRef } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { FileText, Copy, Check } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { truncateContent } from '../_framework/pluginUtils';
import { PluginPromptBuilderDialog } from '../_framework/PluginPromptBuilderDialog';

/** 摘要插件数据 */
interface SummaryPluginData {
  summaries?: Record<string, string>;
  lastStyle?: string;
  lastPrompt?: string;
}

const DEFAULT_PROMPT = '根据本文档的正文内容，用一句话概括核心内容，不超过50字。';

const SUMMARY_STYLES = [
  { key: 'oneline', label: '一句话摘要', prompt: '根据本文档的正文内容，用一句话概括核心内容，不超过50字。' },
  { key: 'keypoints', label: '要点提炼', prompt: '根据本文档的正文内容，提炼关键要点，以编号列表形式输出，每个要点一句话，最多10个要点。' },
  { key: 'outline', label: '结构化大纲', prompt: '根据本文档的正文内容，生成一个结构化大纲，使用 Markdown 标题层级格式，包含主要章节和子章节。' },
  { key: 'abstract', label: '学术摘要', prompt: '根据本文档的正文内容，撰写一段学术风格的摘要，包含研究背景、主要内容、核心观点和结论，约200-300字。' },
];

/**
 * 文档摘要插件面板 — 使用 PluginPanelLayout 统一模板
 */
export function SummaryPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const data = (pluginData as SummaryPluginData) || {};
  const summaries = data.summaries || {};

  const [generating, setGenerating] = useState(false);
  const [activeStyle, setActiveStyle] = useState(data.lastStyle || SUMMARY_STYLES[0].key);
  const [prompt, setPrompt] = useState(data.lastPrompt || DEFAULT_PROMPT);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderStyle, setBuilderStyle] = useState(data.lastStyle || SUMMARY_STYLES[0].key);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  const updateData = useCallback((updates: Partial<SummaryPluginData>) => {
    onPluginDataChange({ ...data, ...updates });
  }, [data, onPluginDataChange]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    updateData({ lastPrompt: val });
    host.docData!.markDirty();
  }, [updateData, host]);

  const handleGenerate = async () => {
    const sourceContent = content || document.aiGeneratedContent || document.content || '';
    if (!sourceContent.trim()) {
      showStatus(t('emptyContent'), true);
      return;
    }

    const style = SUMMARY_STYLES.find(s => s.key === activeStyle);
    if (!style) return;

    setGenerating(true);
    showStatus(`正在生成${style.label}，请稍候...`, false, true);
    const userPrompt = prompt.trim() || style.prompt;

    try {
      const messages = [
        { role: 'system', content: t('systemPrompt') },
        { role: 'user', content: `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 2048 });

      const newSummaries = { ...summaries, [activeStyle]: result };
      updateData({ summaries: newSummaries, lastStyle: activeStyle, lastPrompt: prompt });
      host.docData!.markDirty();
      showStatus(t('generateSuccess', { style: style.label }));
      onRequestSave?.();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showStatus(t('generateFailed', { error: errMsg }), true);
    } finally {
      setGenerating(false);
    }
  };

  // 提示词构建弹窗确认回调
  const handlePromptBuilderConfirm = (builtPrompt: string) => {
    setActiveStyle(builderStyle);
    handlePromptChange(builtPrompt);
  };

  // 弹窗打开时同步当前风格
  const handleBuilderOpen = () => {
    setBuilderStyle(activeStyle);
    setBuilderOpen(true);
  };

  // 弹窗内风格变更
  const handleBuilderStyleChange = (key: string) => {
    setBuilderStyle(key);
  };

  // 弹窗内实时预览的提示词
  const builderPreviewPrompt = SUMMARY_STYLES.find(s => s.key === builderStyle)?.prompt || '';

  const handleCopy = async () => {
    const text = summaries[activeStyle];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    showStatus(t('copiedToClipboard'));
    setTimeout(() => setCopied(false), 2000);
  };

  const currentSummary = summaries[activeStyle];
  const hasSummary = Object.keys(summaries).length > 0;

  // ── 工具栏内容 ──
  const toolbarContent = (
    <>
      <div className="flex-1" />
      {currentSummary && (
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1 h-7 text-xs">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? t('copied') : t('copy')}
        </Button>
      )}
    </>
  );

  // ── 提示词构建弹窗 ──
  const promptBuilderDialog = (
    <PluginPromptBuilderDialog
      open={builderOpen}
      onOpenChange={setBuilderOpen}
      description={t('promptBuilderDesc')}
      onConfirm={handlePromptBuilderConfirm}
      previewPrompt={builderPreviewPrompt}
    >
      <div className="space-y-3">
        <label className="text-sm font-medium">{t('styleLabel')}</label>
        <div className="flex gap-2 flex-wrap">
          {SUMMARY_STYLES.map(style => (
            <Button
              key={style.key}
              variant="outline"
              size="sm"
              onClick={() => handleBuilderStyleChange(style.key)}
              className={builderStyle === style.key ? 'border-primary bg-primary/10 font-medium' : ''}
            >
              {style.label}
            </Button>
          ))}
        </div>
      </div>
    </PluginPromptBuilderDialog>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<FileText className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder')}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('aiGenerate')}
      generatingLabel={t('generating')}
      onPromptBuilderOpen={handleBuilderOpen}
      promptBuilderDialog={promptBuilderDialog}
      toolbar={toolbarContent}
      hasContent={hasSummary}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        onPluginDataChange({});
        setPrompt(DEFAULT_PROMPT);
        setActiveStyle(SUMMARY_STYLES[0].key);
        host.docData!.markDirty();
        setStatusMsg('已清空全部内容');
        setStatusIsError(false);
        setTimeout(() => setStatusMsg(null), 4000);
      }}
      sourceCode={currentSummary || undefined}
      onSourceCodeSave={(code) => {
        const newSummaries = { ...summaries, [activeStyle]: code };
        onPluginDataChange({ ...data, summaries: newSummaries });
        host.docData!.markDirty();
      }}
    >
      {/* ③ 内容区 */}
      {currentSummary ? (
        <div className="p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          {currentSummary}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          {t('selectStyleHint')}
        </div>
      )}
    </PluginPanelLayout>
  );
}
