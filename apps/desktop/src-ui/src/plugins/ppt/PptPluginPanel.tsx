import { useState, useCallback, useRef } from 'react';
import type { SlidesDeck } from '@aidocplus/shared-types';
import { DEFAULT_PPT_THEME } from '@aidocplus/shared-types';
import type { PluginPanelProps } from '../types';
import { SlideDeck } from './SlideDeck';
import { PptGenerateDialog } from './PptGenerateDialog';
import { buildSlideSystemPrompt, parseSlidesFromAiResponse } from './slideAiPrompts';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { Presentation } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { truncateContent } from '../_framework/pluginUtils';

/** PPT 插件数据结构 */
interface PptPluginData {
  slidesDeck?: SlidesDeck;
  pptPrompt?: string;
  lastPrompt?: string;
}

const DEFAULT_PROMPT = '根据本文档的正文内容，生成演示文稿幻灯片，约 10 页。';

/**
 * PPT 插件面板 — 使用 PluginPanelLayout 统一模板
 */
export function PptPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  // 从 pluginData 中读取 PPT 数据
  const pptData = (pluginData as PptPluginData) || {};
  const slidesDeck = pptData.slidesDeck;

  const [pptGenerating, setPptGenerating] = useState(false);
  const [prompt, setPrompt] = useState(pptData.lastPrompt || pptData.pptPrompt || DEFAULT_PROMPT);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const pptAbortRef = useRef(false);

  const updatePptData = useCallback((updates: Partial<PptPluginData>) => {
    onPluginDataChange({ ...pptData, ...updates });
  }, [pptData, onPluginDataChange]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    updatePptData({ lastPrompt: val });
    host.docData!.markDirty();
  }, [updatePptData, host]);

  const showStatus = (msg: string, isError = false) => {
    setStatusMsg(msg);
    setStatusIsError(isError);
  };

  const handleGenerate = async () => {
    if (pptGenerating) {
      pptAbortRef.current = true;
      setPptGenerating(false);
      showStatus('已中断 PPT 生成');
      return;
    }

    const userPrompt = prompt.trim() || DEFAULT_PROMPT;
    updatePptData({ pptPrompt: userPrompt, lastPrompt: userPrompt });
    host.docData!.markDirty();

    pptAbortRef.current = false;
    setPptGenerating(true);
    showStatus('正在生成 PPT，请稍候...');

    try {
      const sourceContent = content || document.aiGeneratedContent || '';
      const truncated = truncateContent(sourceContent);
      const systemPrompt = buildSlideSystemPrompt();
      const userMessage = truncated?.trim()
        ? `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncated}`
        : userPrompt;
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];
      const result = await host.ai.chat(messages, { maxTokens: 8192 });
      if (pptAbortRef.current) return;
      const slidesRaw = parseSlidesFromAiResponse(result);
      if (!slidesRaw) {
        throw new Error(`AI 返回的幻灯片数据格式无效`);
      }
      const deck: SlidesDeck = {
        slides: slidesRaw.map((s, i) => ({
          id: `slide_${Date.now()}_${i}`,
          layout: s.layout,
          title: s.title,
          subtitle: s.subtitle,
          content: s.content,
          notes: s.notes,
          order: i,
        })),
        theme: DEFAULT_PPT_THEME,
        aspectRatio: '16:9',
      };
      updatePptData({ slidesDeck: deck });
      host.docData!.markDirty();
      showStatus(t('generateSuccess') + `，共 ${deck.slides.length} 页`);
      onRequestSave?.();
    } catch (err) {
      if (pptAbortRef.current) return;
      const errMsg = err instanceof Error ? err.message : String(err);
      showStatus(t('generateFailed', { error: errMsg }), true);
    } finally {
      setPptGenerating(false);
    }
  };

  // 提示词构造器弹窗回调：只填充提示词，不触发生成
  const handleBuilderConfirm = (builtPrompt: string) => {
    handlePromptChange(builtPrompt);
  };

  const handleDeckChange = useCallback((deck: SlidesDeck) => {
    updatePptData({ slidesDeck: deck });
    host.docData!.markDirty();
  }, [updatePptData, host]);

  const handleExportPptx = async () => {
    if (!slidesDeck) return;
    try {
      const { exportToPptx } = await import('./pptxExport');
      const defaultFileName = `${document.title}.pptx`;
      const filePath = await host.ui.showSaveDialog({ defaultName: defaultFileName, extensions: ['pptx'] });
      if (!filePath) return;

      const blob = await exportToPptx(slidesDeck);
      const arrayBuffer = await blob.arrayBuffer();
      const data = Array.from(new Uint8Array(arrayBuffer));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      showStatus(`导出失败: ${errMsg}`, true);
    }
  };

  const handleExportPptxAndOpen = async (app?: string) => {
    if (!slidesDeck) return;
    try {
      const { exportToPptx } = await import('./pptxExport');
      const blob = await exportToPptx(slidesDeck);
      const arrayBuffer = await blob.arrayBuffer();
      const data = Array.from(new Uint8Array(arrayBuffer));

      const safeTitle = document.title.replace(/[/\\:*?"<>|]/g, '_');
      const tempPath = `${await host.platform.invoke<string>('get_temp_dir', {})}/${safeTitle}.pptx`;
      await host.platform.invoke('write_binary_file', { path: tempPath, data });

      await host.platform.invoke('open_file_with_app', { path: tempPath, appName: app || null });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      showStatus(`导出并打开失败: ${errMsg}`, true);
    }
  };

  // 提示词构造器弹窗（复用已有的 PptGenerateDialog）
  const promptBuilderDialog = (
    <PptGenerateDialog
      open={builderOpen}
      onOpenChange={setBuilderOpen}
      defaultPrompt={prompt}
      documentTitle={document.title}
      aiContent={content || document.aiGeneratedContent || ''}
      onGenerate={handleBuilderConfirm}
    />
  );

  return (
    <PluginPanelLayout
      pluginIcon={<Presentation className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('welcome')}
      pluginDesc={t('welcomeDesc')}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder')}
      generating={pptGenerating}
      onGenerate={handleGenerate}
      generateLabel={t('aiGenerate')}
      generatingLabel={t('generating')}
      onPromptBuilderOpen={() => setBuilderOpen(true)}
      promptBuilderDialog={promptBuilderDialog}
      hasContent={!!slidesDeck}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        updatePptData({ slidesDeck: undefined, pptPrompt: undefined, lastPrompt: undefined });
        setPrompt(DEFAULT_PROMPT);
        host.docData!.markDirty();
        showStatus('已清空全部内容');
      }}
      sourceCode={slidesDeck ? JSON.stringify(slidesDeck, null, 2) : undefined}
      onSourceCodeSave={(code) => {
        try {
          const parsed = JSON.parse(code);
          updatePptData({ slidesDeck: parsed });
          host.docData!.markDirty();
        } catch { /* ignore invalid JSON */ }
      }}
    >
      {/* ③ 内容区 */}
      {slidesDeck && (
        <SlideDeck
          deck={slidesDeck}
          onDeckChange={handleDeckChange}
          onExportPptx={handleExportPptx}
          onExportPptxAndOpen={handleExportPptxAndOpen}
        />
      )}
    </PluginPanelLayout>
  );
}
