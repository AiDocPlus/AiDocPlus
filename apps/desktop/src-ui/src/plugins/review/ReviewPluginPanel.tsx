import { useState, useCallback, useRef } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ClipboardCheck, Copy, Check } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { truncateContent } from '../_framework/pluginUtils';
import { PluginPromptBuilderDialog } from '../_framework/PluginPromptBuilderDialog';

interface ReviewPluginData {
  reviews?: Record<string, string>;
  lastStyle?: string;
  lastPrompt?: string;
}

const REVIEW_STYLES = [
  {
    key: 'comprehensive',
    label: 'styleComprehensive',
    prompt: '请对本文档进行综合评审，从以下维度分析：\n1. **内容完整性**：是否涵盖了主题的关键方面\n2. **逻辑结构**：论述是否有条理，段落衔接是否自然\n3. **语言表达**：用词是否准确，句式是否流畅\n4. **可读性**：排版格式是否清晰，是否便于阅读\n\n请给出总体评分（1-10分）、优点、不足和具体修改建议。',
  },
  {
    key: 'logic',
    label: 'styleLogic',
    prompt: '请重点评审本文档的逻辑结构：\n1. 论点是否清晰明确\n2. 论据是否充分有力\n3. 推理过程是否严密\n4. 段落之间的逻辑关系是否合理\n5. 是否存在逻辑漏洞或自相矛盾\n\n请给出具体的逻辑问题和改进建议。',
  },
  {
    key: 'language',
    label: 'styleLanguage',
    prompt: '请重点评审本文档的语言表达：\n1. 用词是否准确、恰当\n2. 句式是否多样、流畅\n3. 是否存在语法错误或病句\n4. 语气和风格是否一致\n5. 是否有冗余或啰嗦的表达\n\n请逐一指出问题并给出修改建议。',
  },
  {
    key: 'academic',
    label: 'styleAcademic',
    prompt: '请按学术论文标准评审本文档：\n1. 摘要是否完整（背景、方法、结果、结论）\n2. 文献引用是否规范\n3. 术语使用是否准确统一\n4. 数据和论证是否严谨\n5. 格式是否符合学术规范\n\n请给出学术规范性评分和改进建议。',
  },
  {
    key: 'business',
    label: 'styleBusiness',
    prompt: '请按商务文档标准评审：\n1. 目标受众是否明确\n2. 核心信息是否突出\n3. 语气是否专业得体\n4. 行动号召是否清晰\n5. 格式排版是否商务规范\n\n请给出专业性评分和改进建议。',
  },
  {
    key: 'technical',
    label: 'styleTechnical',
    prompt: '请按技术文档标准评审：\n1. 技术描述是否准确\n2. 步骤说明是否清晰可操作\n3. 代码示例是否正确\n4. 术语和缩写是否有解释\n5. 文档结构是否便于查阅\n\n请给出技术准确性评分和改进建议。',
  },
  {
    key: 'creative',
    label: 'styleCreative',
    prompt: '请从创意写作角度评审：\n1. 开头是否吸引人\n2. 叙事节奏是否合理\n3. 人物/场景描写是否生动\n4. 语言是否有感染力\n5. 结尾是否有力\n\n请给出创意性评分和改进建议。',
  },
];

const DEFAULT_PROMPT = REVIEW_STYLES[0].prompt;

export function ReviewPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const data = (pluginData as ReviewPluginData) || {};
  const reviews = data.reviews || {};

  const [generating, setGenerating] = useState(false);
  const [activeStyle, setActiveStyle] = useState(data.lastStyle || REVIEW_STYLES[0].key);
  const [prompt, setPrompt] = useState(data.lastPrompt || DEFAULT_PROMPT);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderStyle, setBuilderStyle] = useState(data.lastStyle || REVIEW_STYLES[0].key);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  const updateData = useCallback((updates: Partial<ReviewPluginData>) => {
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

    const style = REVIEW_STYLES.find(s => s.key === activeStyle);
    if (!style) return;

    setGenerating(true);
    showStatus(t('generating'), false, true);
    const userPrompt = prompt.trim() || style.prompt;

    try {
      const messages = [
        { role: 'system', content: t('systemPrompt') },
        { role: 'user', content: `${userPrompt}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 4096 });

      const newReviews = { ...reviews, [activeStyle]: result };
      updateData({ reviews: newReviews, lastStyle: activeStyle, lastPrompt: prompt });
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

  const handlePromptBuilderConfirm = (builtPrompt: string) => {
    setActiveStyle(builderStyle);
    handlePromptChange(builtPrompt);
  };

  const handleBuilderOpen = () => {
    setBuilderStyle(activeStyle);
    setBuilderOpen(true);
  };

  const handleBuilderStyleChange = (key: string) => {
    setBuilderStyle(key);
  };

  const builderPreviewPrompt = REVIEW_STYLES.find(s => s.key === builderStyle)?.prompt || '';

  const handleCopy = async () => {
    const text = reviews[activeStyle];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    showStatus(t('copiedToClipboard'));
    setTimeout(() => setCopied(false), 2000);
  };

  const currentReview = reviews[activeStyle];
  const hasReview = Object.keys(reviews).length > 0;

  const toolbarContent = (
    <>
      <div className="flex-1" />
      {currentReview && (
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
        <label className="text-sm font-medium">{t('styleLabel')}</label>
        <div className="flex gap-2 flex-wrap">
          {REVIEW_STYLES.map(style => (
            <Button
              key={style.key}
              variant="outline"
              size="sm"
              onClick={() => handleBuilderStyleChange(style.key)}
              className={builderStyle === style.key ? 'border-primary bg-primary/10 font-medium' : ''}
            >
              {t(style.label)}
            </Button>
          ))}
        </div>
      </div>
    </PluginPromptBuilderDialog>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<ClipboardCheck className="h-12 w-12 text-muted-foreground/50" />}
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
      hasContent={hasReview}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        onPluginDataChange({});
        setPrompt(DEFAULT_PROMPT);
        setActiveStyle(REVIEW_STYLES[0].key);
        host.docData!.markDirty();
        showStatus('已清空全部评审结果');
      }}
      sourceCode={currentReview || undefined}
      onSourceCodeSave={(code) => {
        const newReviews = { ...reviews, [activeStyle]: code };
        onPluginDataChange({ ...data, reviews: newReviews });
        host.docData!.markDirty();
      }}
    >
      {currentReview ? (
        <div className="p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          {currentReview}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          {t('selectStyleHint')}
        </div>
      )}
    </PluginPanelLayout>
  );
}
