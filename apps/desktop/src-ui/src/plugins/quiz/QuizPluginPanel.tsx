import { useState, useRef, useCallback, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import type { QuizConfig, QuizData, QuizQuestion } from './types';
import { calcTotalScore, DEFAULT_QUIZ_CONFIG } from './types';
import { QuizConfigDialog } from './QuizConfigDialog';
import { generateQuizHtml } from './quizHtmlTemplate';
import { buildQuizSystemPrompt, buildQuizUserPrompt, parseQuizFromAiResponse } from './quizAiPrompts';
import { truncateContent } from '../_framework/pluginUtils';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ClipboardList, Download, ExternalLink } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';

const DEFAULT_PROMPT = '根据本文档的正文内容，生成测试题。';

/**
 * 测试题插件面板 — 使用 PluginPanelLayout 统一模板
 */
export function QuizPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const [generating, setGenerating] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [quizHtml, setQuizHtml] = useState<string>('');
  const [prompt, setPrompt] = useState(
    (pluginData as Record<string, unknown>)?.lastPrompt as string || DEFAULT_PROMPT
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const abortRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // 保存最近一次配置，用于 onGenerate 直接调用
  const lastConfigRef = useRef<QuizConfig>({ ...DEFAULT_QUIZ_CONFIG, title: document.title ? `${document.title} - 测试题` : '测试题' });
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  // 从 pluginData 加载已保存的测试题数据
  useEffect(() => {
    if (pluginData && typeof pluginData === 'object' && 'questions' in (pluginData as Record<string, unknown>)) {
      const saved = pluginData as QuizData;
      setQuizData(saved);
      setQuizHtml(generateQuizHtml(saved));
      if (saved.config) lastConfigRef.current = saved.config;
    }
  }, [document.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    // 仅保存 prompt，不触发完整 pluginData 更新
    if (pluginData && typeof pluginData === 'object') {
      onPluginDataChange({ ...(pluginData as Record<string, unknown>), lastPrompt: val });
    }
    host.docData!.markDirty();
  }, [pluginData, onPluginDataChange, host]);

  // 点击 AI 生成按钮 → 打开配置弹窗
  const handleGenerateClick = () => {
    if (generating) {
      abortRef.current = true;
      setGenerating(false);
      showStatus('已中断测试题生成');
      return;
    }
    setConfigOpen(true);
  };

  const handleGenerate = useCallback(async (config: QuizConfig) => {
    const sourceContent = content || document.content || '';
    if (!sourceContent.trim()) {
      showStatus('文档内容为空，无法生成测试题', true);
      return;
    }

    lastConfigRef.current = config;
    abortRef.current = false;
    setGenerating(true);
    showStatus(`正在生成测试题「${config.title}」，共 ${config.singleCount + config.multipleCount + config.trueFalseCount} 道题，请稍候...`, false, true);

    try {
      const systemPrompt = buildQuizSystemPrompt();
      const userPrompt = buildQuizUserPrompt(truncateContent(sourceContent), config);

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 8192 });

      if (abortRef.current) return;

      const parsed = parseQuizFromAiResponse(result);
      if (!parsed) {
        throw new Error('AI 返回的测试题数据格式无效');
      }

      const totalScore = calcTotalScore(config);
      let qid = 0;
      const questions: QuizQuestion[] = parsed.map(q => {
        qid++;
        const type = q.type === 'multiple' ? 'multiple' : q.type === 'truefalse' ? 'truefalse' : 'single';
        const scorePerQ = type === 'single' ? config.singleScore
          : type === 'multiple' ? config.multipleScore
          : config.trueFalseScore;
        return {
          id: qid,
          type,
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          score: scorePerQ,
        };
      });

      const quiz: QuizData = {
        title: config.title,
        questions,
        totalScore,
        config,
        generatedAt: Date.now(),
      };

      setQuizData(quiz);
      const html = generateQuizHtml(quiz);
      setQuizHtml(html);

      const promptSummary = `${config.title} - ${config.singleCount}单选/${config.multipleCount}多选/${config.trueFalseCount}判断`;
      setPrompt(promptSummary);
      onPluginDataChange({ ...quiz, lastPrompt: promptSummary });
      host.docData!.markDirty();

      showStatus(`测试题生成完成，共 ${questions.length} 道题，总分 ${totalScore} 分`);
      onRequestSave?.();
    } catch (err) {
      if (abortRef.current) return;
      const errMsg = err instanceof Error ? err.message : String(err);
      showStatus(`测试题生成失败：${errMsg}`, true);
    } finally {
      setGenerating(false);
    }
  }, [content, document.content, onPluginDataChange, host]);

  const handleExportHtml = async () => {
    if (!quizData || !quizHtml) return;
    try {
      const safeTitle = quizData.title.replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}.html`, extensions: ['html'] });
      if (!filePath) return;

      const data = Array.from(new TextEncoder().encode(quizHtml));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      showStatus(`导出失败: ${errMsg}`, true);
    }
  };

  const handleExportAndOpen = async () => {
    if (!quizData || !quizHtml) return;
    try {
      const safeTitle = quizData.title.replace(/[/\\:*?"<>|]/g, '_');
      const tempPath = `${await host.platform.invoke<string>('get_temp_dir', {})}/${safeTitle}.html`;
      const data = Array.from(new TextEncoder().encode(quizHtml));
      await host.platform.invoke('write_binary_file', { path: tempPath, data });
      await host.platform.invoke('open_file_with_app', { path: tempPath, appName: null });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      showStatus(`导出并打开失败: ${errMsg}`, true);
    }
  };

  const hasContent = !!quizData;

  // ── 工具栏 ──
  const toolbarContent = (
    <>
      <div className="flex-1" />
      {quizData && (
        <>
          <Button variant="outline" size="sm" onClick={handleExportAndOpen} className="gap-1 h-7 text-xs">
            <ExternalLink className="h-3 w-3" />
            {t('quiz.preview', { defaultValue: '浏览器预览' })}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportHtml} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            {t('quiz.exportHtml', { defaultValue: '导出 HTML' })}
          </Button>
        </>
      )}
    </>
  );

  // QuizConfigDialog 作为 promptBuilderDialog（类似 PPT 复用 PptGenerateDialog）
  const promptBuilderDialog = (
    <QuizConfigDialog
      open={configOpen}
      onOpenChange={setConfigOpen}
      documentTitle={document.title}
      onGenerate={handleGenerate}
    />
  );

  return (
    <PluginPanelLayout
      pluginIcon={<ClipboardList className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('quiz.noQuiz', { defaultValue: '测试题生成' })}
      pluginDesc={t('quiz.generateHint', { defaultValue: '点击"AI 生成测试题"按钮，AI 将根据文档内容自动生成测试题' })}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('quiz.promptPlaceholder', { defaultValue: '描述测试题需求...' })}
      generating={generating}
      onGenerate={handleGenerateClick}
      generateLabel={t('quiz.generateQuiz', { defaultValue: 'AI 生成测试题' })}
      generatingLabel={t('quiz.stopGenerate', { defaultValue: '中断生成' })}
      onPromptBuilderOpen={() => setConfigOpen(true)}
      promptBuilderDialog={promptBuilderDialog}
      toolbar={toolbarContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        setQuizData(null);
        setQuizHtml('');
        setPrompt(DEFAULT_PROMPT);
        onPluginDataChange(null);
        host.docData!.markDirty();
        showStatus('已清空全部内容');
      }}
      sourceCode={quizData ? JSON.stringify(quizData, null, 2) : undefined}
      onSourceCodeSave={(code) => {
        try {
          const parsed = JSON.parse(code) as QuizData;
          setQuizData(parsed);
          setQuizHtml(generateQuizHtml(parsed));
          onPluginDataChange(parsed);
          host.docData!.markDirty();
        } catch { /* ignore invalid JSON */ }
      }}
    >
      {/* ③ 内容区 */}
      {quizHtml ? (
        <iframe
          ref={iframeRef}
          srcDoc={quizHtml}
          className="w-full h-full border-0"
          sandbox="allow-scripts"
          title={quizData?.title || '测试题'}
        />
      ) : null}
    </PluginPanelLayout>
  );
}
