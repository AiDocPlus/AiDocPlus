import { useState, useCallback, useRef } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { Languages, Copy, Check } from 'lucide-react';
import { truncateContent } from '../_framework/pluginUtils';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { PluginPromptBuilderDialog } from '../_framework/PluginPromptBuilderDialog';

/** 翻译插件数据 */
interface TranslationPluginData {
  translations?: Record<string, string>;
  lastLang?: string;
  lastPrompt?: string;
}

const DEFAULT_PROMPT = '根据本文档的正文内容，将其翻译为英文。';

const TARGET_LANGUAGES = [
  { key: 'en', label: '英语' },
  { key: 'ja', label: '日语' },
  { key: 'ko', label: '韩语' },
  { key: 'fr', label: '法语' },
  { key: 'de', label: '德语' },
  { key: 'es', label: '西班牙语' },
  { key: 'zh', label: '中文' },
];

/**
 * 翻译插件面板 — 使用 PluginPanelLayout 统一模板
 */
export function TranslationPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const data = (pluginData as TranslationPluginData) || {};
  const translations = data.translations || {};

  const [generating, setGenerating] = useState(false);
  const [activeLang, setActiveLang] = useState(data.lastLang || 'en');
  const [prompt, setPrompt] = useState(data.lastPrompt || DEFAULT_PROMPT);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderLang, setBuilderLang] = useState(activeLang);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  const updateData = useCallback((updates: Partial<TranslationPluginData>) => {
    onPluginDataChange({ ...data, ...updates });
  }, [data, onPluginDataChange]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    updateData({ lastPrompt: val });
    host.docData!.markDirty();
  }, [updateData, host]);

  const handleTranslate = async () => {
    const sourceContent = content || document.aiGeneratedContent || document.content || '';
    if (!sourceContent.trim()) {
      showStatus(t('emptyContent'), true);
      return;
    }

    const lang = TARGET_LANGUAGES.find(l => l.key === activeLang);
    if (!lang) return;

    setGenerating(true);
    showStatus(`正在翻译为${lang.label}，请稍候...`, false, true);
    const userPrompt = prompt.trim() || `将文档内容翻译为${lang.label}`;

    try {
      const messages = [
        { role: 'system', content: `你是一个专业翻译。请将用户提供的文档内容翻译为${lang.label}。保持原文的格式（Markdown 格式）。只输出翻译结果，不要添加任何解释。` },
        { role: 'user', content: `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 8192 });

      const newTranslations = { ...translations, [activeLang]: result };
      updateData({ translations: newTranslations, lastLang: activeLang, lastPrompt: prompt });
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

  const handleCopy = async () => {
    const text = translations[activeLang];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    showStatus(t('copiedToClipboard'));
    setTimeout(() => setCopied(false), 2000);
  };

  // 提示词构造器弹窗确认回调
  const handleBuilderConfirm = (builtPrompt: string) => {
    setActiveLang(builderLang);
    handlePromptChange(builtPrompt);
  };

  const handleBuilderOpen = () => {
    setBuilderLang(activeLang);
    setBuilderOpen(true);
  };

  const builderPreviewPrompt = `根据本文档的正文内容，将其翻译为${TARGET_LANGUAGES.find(l => l.key === builderLang)?.label || '英语'}。`;

  const currentTranslation = translations[activeLang];
  const hasTranslation = Object.keys(translations).length > 0;

  // ── 工具栏 ──
  const toolbarContent = (
    <>
      <div className="flex-1" />
      {currentTranslation && (
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1 h-7 text-xs">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? t('copied') : t('copy')}
        </Button>
      )}
    </>
  );

  // ── 提示词构造器弹窗 ──
  const promptBuilderDialog = (
    <PluginPromptBuilderDialog
      open={builderOpen}
      onOpenChange={setBuilderOpen}
      description={t('promptBuilderDesc', { defaultValue: '选择目标语言，自动组装翻译提示词' })}
      onConfirm={handleBuilderConfirm}
      previewPrompt={builderPreviewPrompt}
    >
      <div className="space-y-3">
        <label className="text-sm font-medium">{t('targetLang', { defaultValue: '目标语言' })}</label>
        <div className="flex gap-2 flex-wrap">
          {TARGET_LANGUAGES.map(lang => (
            <Button
              key={lang.key}
              variant="outline"
              size="sm"
              onClick={() => setBuilderLang(lang.key)}
              className={builderLang === lang.key ? 'border-primary bg-primary/10 font-medium' : ''}
            >
              {lang.label}
            </Button>
          ))}
        </div>
      </div>
    </PluginPromptBuilderDialog>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<Languages className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('welcomeDesc')}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder')}
      generating={generating}
      onGenerate={handleTranslate}
      generateLabel={t('generate', { defaultValue: 'AI 生成翻译' })}
      generatingLabel={t('generating')}
      onPromptBuilderOpen={handleBuilderOpen}
      promptBuilderDialog={promptBuilderDialog}
      toolbar={toolbarContent}
      hasContent={hasTranslation}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        onPluginDataChange({});
        setPrompt(DEFAULT_PROMPT);
        setActiveLang('en');
        host.docData!.markDirty();
        showStatus('已清空全部内容');
      }}
      sourceCode={currentTranslation || undefined}
      onSourceCodeSave={(code) => {
        const newTranslations = { ...translations, [activeLang]: code };
        onPluginDataChange({ ...data, translations: newTranslations });
        host.docData!.markDirty();
      }}
    >
      {/* ③ 内容区 */}
      {currentTranslation ? (
        <div className="p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          {currentTranslation}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          {t('selectStyleHint', { defaultValue: '点击上方语言按钮后翻译' })}
        </div>
      )}
    </PluginPanelLayout>
  );
}
