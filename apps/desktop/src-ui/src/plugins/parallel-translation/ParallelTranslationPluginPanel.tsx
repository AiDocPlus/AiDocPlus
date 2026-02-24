import { useState, useCallback, useRef } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { Languages, Copy, Check, Columns2, FileText } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { truncateContent } from '../_framework/pluginUtils';
import { PluginPromptBuilderDialog } from '../_framework/PluginPromptBuilderDialog';

interface ParallelTranslationData {
  translations?: Record<string, string>;
  sourceText?: string;
  lastLang?: string;
  lastPrompt?: string;
}

const LANGUAGES = [
  { key: 'en', label: 'langEn', name: 'English' },
  { key: 'zh', label: 'langZh', name: '中文' },
  { key: 'ja', label: 'langJa', name: '日本語' },
  { key: 'ko', label: 'langKo', name: '한국어' },
  { key: 'fr', label: 'langFr', name: 'Français' },
  { key: 'de', label: 'langDe', name: 'Deutsch' },
  { key: 'es', label: 'langEs', name: 'Español' },
  { key: 'ru', label: 'langRu', name: 'Русский' },
  { key: 'pt', label: 'langPt', name: 'Português' },
  { key: 'ar', label: 'langAr', name: 'العربية' },
];

const DEFAULT_PROMPT = '请将以下文档内容翻译为英语，保持原文的格式和结构，确保翻译准确、自然、流畅。';

export function ParallelTranslationPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const data = (pluginData as ParallelTranslationData) || {};
  const translations = data.translations || {};

  const [generating, setGenerating] = useState(false);
  const [activeLang, setActiveLang] = useState(data.lastLang || LANGUAGES[0].key);
  const [prompt, setPrompt] = useState(data.lastPrompt || DEFAULT_PROMPT);
  const [copied, setCopied] = useState(false);
  const [parallelView, setParallelView] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderLang, setBuilderLang] = useState(data.lastLang || LANGUAGES[0].key);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  const updateData = useCallback((updates: Partial<ParallelTranslationData>) => {
    onPluginDataChange({ ...data, ...updates });
  }, [data, onPluginDataChange]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    updateData({ lastPrompt: val });
    host.docData!.markDirty();
  }, [updateData, host]);

  const getSourceContent = useCallback((): string => {
    return content || document.aiGeneratedContent || document.content || '';
  }, [content, document]);

  const handleGenerate = async () => {
    const sourceContent = getSourceContent();
    if (!sourceContent.trim()) {
      showStatus(t('emptyContent'), true);
      return;
    }

    const lang = LANGUAGES.find(l => l.key === activeLang);
    if (!lang) return;

    setGenerating(true);
    showStatus(t('generating'), false, true);

    const userPrompt = prompt.trim() || `请将以下文档内容翻译为${lang.name}，保持原文的格式和结构，确保翻译准确、自然、流畅。`;

    try {
      const messages = [
        { role: 'system', content: t('systemPrompt') },
        { role: 'user', content: `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 4096 });

      const newTranslations = { ...translations, [activeLang]: result };
      updateData({
        translations: newTranslations,
        sourceText: sourceContent,
        lastLang: activeLang,
        lastPrompt: prompt,
      });
      host.docData!.markDirty();
      showStatus(t('generateSuccess', { lang: t(lang.label) }));
      onRequestSave?.();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showStatus(t('generateFailed', { error: errMsg }), true);
    } finally {
      setGenerating(false);
    }
  };

  const handlePromptBuilderConfirm = (builtPrompt: string) => {
    setActiveLang(builderLang);
    handlePromptChange(builtPrompt);
  };

  const handleBuilderOpen = () => {
    setBuilderLang(activeLang);
    setBuilderOpen(true);
  };

  const handleBuilderLangChange = (key: string) => {
    setBuilderLang(key);
  };

  const builderLangObj = LANGUAGES.find(l => l.key === builderLang);
  const builderPreviewPrompt = builderLangObj
    ? `请将以下文档内容翻译为${builderLangObj.name}，保持原文的格式和结构，确保翻译准确、自然、流畅。`
    : '';

  const handleCopy = async () => {
    const text = translations[activeLang];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    showStatus(t('copiedToClipboard'));
    setTimeout(() => setCopied(false), 2000);
  };

  const currentTranslation = translations[activeLang];
  const hasTranslation = Object.keys(translations).length > 0;
  const sourceText = data.sourceText || getSourceContent();

  // 已翻译的语言标签
  const translatedLangs = Object.keys(translations);

  const toolbarContent = (
    <>
      {/* 已翻译语言标签 */}
      {translatedLangs.length > 0 && (
        <div className="flex items-center gap-1">
          {translatedLangs.map(langKey => {
            const lang = LANGUAGES.find(l => l.key === langKey);
            return (
              <button
                key={langKey}
                onClick={() => setActiveLang(langKey)}
                className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                  activeLang === langKey
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {lang ? t(lang.label) : langKey}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex-1" />
      {/* 视图切换 */}
      {currentTranslation && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setParallelView(!parallelView)}
          className="gap-1 h-7 text-xs"
          title={t('switchView')}
        >
          {parallelView ? <Columns2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          {parallelView ? t('parallelView') : t('translationOnly')}
        </Button>
      )}
      {currentTranslation && (
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1 h-7 text-xs">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? t('copied') : t('copy')}
        </Button>
      )}
    </>
  );

  const promptBuilderDialog = (
    <PluginPromptBuilderDialog
      open={builderOpen}
      onOpenChange={setBuilderOpen}
      description={t('promptBuilderDesc')}
      onConfirm={handlePromptBuilderConfirm}
      previewPrompt={builderPreviewPrompt}
    >
      <div className="space-y-3">
        <label className="text-sm font-medium">{t('targetLang')}</label>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map(lang => (
            <Button
              key={lang.key}
              variant="outline"
              size="sm"
              onClick={() => handleBuilderLangChange(lang.key)}
              className={builderLang === lang.key ? 'border-primary bg-primary/10 font-medium' : ''}
            >
              {t(lang.label)}
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
      hasContent={hasTranslation}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        onPluginDataChange({});
        setPrompt(DEFAULT_PROMPT);
        setActiveLang(LANGUAGES[0].key);
        host.docData!.markDirty();
        showStatus('已清空全部翻译');
      }}
      sourceCode={currentTranslation || undefined}
      onSourceCodeSave={(code) => {
        const newTranslations = { ...translations, [activeLang]: code };
        onPluginDataChange({ ...data, translations: newTranslations });
        host.docData!.markDirty();
      }}
    >
      {currentTranslation ? (
        parallelView ? (
          /* 对照视图 */
          <div className="grid grid-cols-2 divide-x divide-border h-full">
            <div className="overflow-auto">
              <div className="px-3 py-1.5 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
                {t('original')}
              </div>
              <div className="p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" style={{ fontFamily: '宋体', fontSize: '16px' }}>
                {sourceText}
              </div>
            </div>
            <div className="overflow-auto">
              <div className="px-3 py-1.5 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
                {t('translation')} ({LANGUAGES.find(l => l.key === activeLang)?.name})
              </div>
              <div className="p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" style={{ fontFamily: '宋体', fontSize: '16px' }}>
                {currentTranslation}
              </div>
            </div>
          </div>
        ) : (
          /* 仅译文 */
          <div className="p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" style={{ fontFamily: '宋体', fontSize: '16px' }}>
            {currentTranslation}
          </div>
        )
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          {t('selectLangHint')}
        </div>
      )}
    </PluginPanelLayout>
  );
}
