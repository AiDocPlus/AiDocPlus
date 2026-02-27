import { useState, useRef, useCallback, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import type { PosterData, PosterTheme } from './types';
import { POSTER_THEMES } from './types';
import { buildPosterSystemPrompt, buildPosterUserPrompt, extractHtmlFromResponse } from './posterAiPrompts';
import { truncateContent } from '../_framework/pluginUtils';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { Image, Download, ExternalLink } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';

const DEFAULT_PROMPT = '将文档内容转化为精美的信息图海报。';

export function PosterPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const [generating, setGenerating] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<PosterTheme>(POSTER_THEMES[0]);
  const [posterHtml, setPosterHtml] = useState<string>('');
  const [prompt, setPrompt] = useState(
    (pluginData as Record<string, unknown>)?.lastPrompt as string || DEFAULT_PROMPT
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const abortRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  useEffect(() => {
    if (pluginData && typeof pluginData === 'object' && 'html' in (pluginData as Record<string, unknown>)) {
      const saved = pluginData as PosterData;
      setPosterHtml(saved.html || '');
      const theme = POSTER_THEMES.find(t => t.key === saved.theme);
      if (theme) setSelectedTheme(theme);
    }
  }, [document.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    if (pluginData && typeof pluginData === 'object') {
      onPluginDataChange({ ...(pluginData as Record<string, unknown>), lastPrompt: val });
    }
    host.docData!.markDirty();
  }, [pluginData, onPluginDataChange, host]);

  const handleGenerate = useCallback(async () => {
    if (generating) {
      abortRef.current = true;
      setGenerating(false);
      showStatus('已中断生成');
      return;
    }

    const sourceContent = content || document.content || '';
    if (!sourceContent.trim()) {
      showStatus('文档内容为空，无法生成海报', true);
      return;
    }

    abortRef.current = false;
    setGenerating(true);
    showStatus(`正在生成「${selectedTheme.label}」主题信息图海报...`, false, true);

    try {
      const systemPrompt = buildPosterSystemPrompt(selectedTheme);
      const userPrompt = buildPosterUserPrompt(
        truncateContent(sourceContent),
        prompt !== DEFAULT_PROMPT ? prompt : undefined
      );

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 8192 });
      if (abortRef.current) return;

      const html = extractHtmlFromResponse(result);
      if (!html) {
        throw new Error('AI 返回的内容不是有效的 HTML');
      }

      setPosterHtml(html);
      const data: PosterData = {
        html,
        theme: selectedTheme.key,
        generatedAt: Date.now(),
        lastPrompt: prompt,
      };
      onPluginDataChange(data);
      host.docData!.markDirty();

      showStatus('信息图海报生成完成');
      onRequestSave?.();
    } catch (err) {
      if (abortRef.current) return;
      showStatus(`生成失败：${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setGenerating(false);
    }
  }, [generating, content, document.content, selectedTheme, prompt, host, onPluginDataChange, onRequestSave]);

  const handleExportHtml = async () => {
    if (!posterHtml) return;
    try {
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${document.title || '信息图海报'}</title></head><body style="margin:0;display:flex;justify-content:center;background:#f5f5f5;padding:20px">${posterHtml}</body></html>`;
      const safeTitle = (document.title || 'poster').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_海报.html`, extensions: ['html'] });
      if (!filePath) return;
      const data = Array.from(new TextEncoder().encode(fullHtml));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const handlePreviewInBrowser = async () => {
    if (!posterHtml) return;
    try {
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${document.title || '信息图海报'}</title></head><body style="margin:0;display:flex;justify-content:center;background:#f5f5f5;padding:20px">${posterHtml}</body></html>`;
      const safeTitle = (document.title || 'poster').replace(/[/\\:*?"<>|]/g, '_');
      const tempPath = `${await host.platform.invoke<string>('get_temp_dir', {})}/${safeTitle}_海报.html`;
      const data = Array.from(new TextEncoder().encode(fullHtml));
      await host.platform.invoke('write_binary_file', { path: tempPath, data });
      await host.platform.invoke('open_file_with_app', { path: tempPath, appName: null });
    } catch (error) {
      showStatus(`预览失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const hasContent = !!posterHtml;

  // 主题选择器
  const themeSelector = (
    <div className="space-y-2 mb-2">
      <div className="flex flex-wrap gap-1.5">
        {POSTER_THEMES.map(theme => (
          <button
            key={theme.key}
            onClick={() => setSelectedTheme(theme)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md border transition-colors cursor-pointer ${
              selectedTheme.key === theme.key
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-muted/30 border-border hover:bg-muted/60'
            }`}
            title={theme.description}
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 border"
              style={{ backgroundColor: theme.primaryColor }}
            />
            {theme.label}
          </button>
        ))}
      </div>
    </div>
  );

  const toolbarContent = (
    <>
      <div className="flex-1" />
      {posterHtml && (
        <>
          <Button variant="outline" size="sm" onClick={handlePreviewInBrowser} className="gap-1 h-7 text-xs">
            <ExternalLink className="h-3 w-3" />
            浏览器预览
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportHtml} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            导出 HTML
          </Button>
        </>
      )}
    </>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<Image className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title', { defaultValue: '信息图海报' })}
      pluginDesc={t('welcomeDesc', { defaultValue: '选择主题风格，AI 将文档内容转化为精美的可视化信息图海报' })}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder', { defaultValue: '描述海报设计需求...' })}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 生成海报' })}
      generatingLabel={t('stopGenerate', { defaultValue: '中断生成' })}
      toolbar={toolbarContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        setPosterHtml('');
        setPrompt(DEFAULT_PROMPT);
        onPluginDataChange(null);
        host.docData!.markDirty();
        showStatus('已清空海报内容');
      }}
      sourceCode={posterHtml || undefined}
      onSourceCodeSave={(code) => {
        setPosterHtml(code);
        const data: PosterData = { html: code, theme: selectedTheme.key, generatedAt: Date.now(), lastPrompt: prompt };
        onPluginDataChange(data);
        host.docData!.markDirty();
      }}
    >
      {/* 主题选择器 */}
      {!hasContent && themeSelector}

      {/* 海报预览 */}
      {posterHtml ? (
        <div className="w-full h-full flex flex-col">
          <div className="px-3 py-2 border-b bg-muted/20">
            {themeSelector}
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              ref={iframeRef}
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;display:flex;justify-content:center;background:#f5f5f5;padding:10px">${posterHtml}</body></html>`}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
              title="信息图海报预览"
            />
          </div>
        </div>
      ) : null}
    </PluginPanelLayout>
  );
}
