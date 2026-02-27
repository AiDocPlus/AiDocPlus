import { useState, useCallback, useEffect, useRef } from 'react';
import type { PluginPanelProps } from '../types';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { BookOpen, Download, Copy, Check } from 'lucide-react';
import { truncateContent } from '../_framework/pluginUtils';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';
import { PluginPromptBuilderDialog } from '../_framework/PluginPromptBuilderDialog';

/** 教案插件数据 */
interface LessonPlanPluginData {
  lessonPlan?: string;
  config?: LessonPlanConfig;
  lastPrompt?: string;
}

interface LessonPlanConfig {
  subject: string;
  grade: string;
  duration: string;
}

const DEFAULT_PROMPT = '根据本文档的正文内容，生成结构化教案。';
const GRADE_OPTIONS = ['小学', '初中', '高中', '大学', '成人培训'];
const DURATION_OPTIONS = ['1课时(40分钟)', '2课时(80分钟)', '3课时(120分钟)'];

/**
 * 教案生成插件面板 — 使用 PluginPanelLayout 统一模板
 */
export function LessonPlanPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const data = (pluginData as LessonPlanPluginData) || {};
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState(data.lastPrompt || DEFAULT_PROMPT);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [config, setConfig] = useState<LessonPlanConfig>(data.config || {
    subject: document.title || '课程',
    grade: '高中',
    duration: '1课时(40分钟)',
  });
  // 弹窗内临时配置
  const [builderConfig, setBuilderConfig] = useState<LessonPlanConfig>(config);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  const updateData = useCallback((updates: Partial<LessonPlanPluginData>) => {
    onPluginDataChange({ ...data, ...updates });
  }, [data, onPluginDataChange]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    updateData({ lastPrompt: val });
    host.docData!.markDirty();
  }, [updateData, host]);

  useEffect(() => {
    if (data.config) setConfig(data.config);
  }, [data.config]);

  const handleGenerate = async () => {
    const sourceContent = content || document.aiGeneratedContent || document.content || '';
    if (!sourceContent.trim()) {
      showStatus(t('emptyContent'), true);
      return;
    }

    setGenerating(true);
    showStatus('正在生成教案，请稍候...', false, true);
    const userPrompt = prompt.trim() || DEFAULT_PROMPT;
    try {
      const messages = [
        { role: 'system', content: `你是一位经验丰富的教学设计专家。请根据用户提供的教学内容，生成一份完整的教案。教案应包含以下部分：

1. **课题名称**
2. **教学目标**（知识目标、能力目标、情感目标）
3. **教学重难点**
4. **教学准备**（教具、多媒体等）
5. **教学过程**
   - 导入新课（约5分钟）
   - 新课讲授（主体部分）
   - 课堂练习
   - 课堂小结
   - 布置作业
6. **板书设计**
7. **教学反思**（留空供教师填写）

请使用 Markdown 格式输出，结构清晰，内容详实。` },
        { role: 'user', content: `${userPrompt}\n\n学科/课题：${config.subject}\n学段：${config.grade}\n课时：${config.duration}\n\n---\n本文档的正文内容如下：\n${truncateContent(sourceContent)}` },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 4096 });

      updateData({ lessonPlan: result, config, lastPrompt: prompt });
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
    if (!data.lessonPlan) return;
    await navigator.clipboard.writeText(data.lessonPlan);
    setCopied(true);
    showStatus(t('copiedToClipboard'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    if (!data.lessonPlan) return;
    const safeTitle = config.subject?.replace(/[/\\:*?"<>|]/g, '_') || '教案';
    try {
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_教案.md`, extensions: ['md'] });
      if (!filePath) return;
      const dataArr = Array.from(new TextEncoder().encode(data.lessonPlan));
      await host.platform.invoke('write_binary_file', { path: filePath, data: dataArr });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  // 提示词构造器弹窗确认回调
  const handleBuilderConfirm = (builtPrompt: string) => {
    setConfig(builderConfig);
    handlePromptChange(builtPrompt);
  };

  // 弹窗打开时同步当前配置
  const handleBuilderOpen = () => {
    setBuilderConfig(config);
    setBuilderOpen(true);
  };

  // 弹窗内实时预览的提示词
  const builderPreviewPrompt = `根据本文档的正文内容，为「${builderConfig.subject}」（${builderConfig.grade}，${builderConfig.duration}）生成结构化教案。`;

  const hasContent = !!data.lessonPlan;

  // ── 工具栏 ──
  const toolbarContent = (
    <>
      <div className="flex-1" />
      {data.lessonPlan && (
        <>
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1 h-7 text-xs">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? t('copied') : t('copy')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />{t('export', { defaultValue: '导出' })}
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
      description={t('promptBuilderDesc', { defaultValue: '设置教案参数，自动组装提示词' })}
      onConfirm={handleBuilderConfirm}
      previewPrompt={builderPreviewPrompt}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('subject', { defaultValue: '学科/课题' })}</label>
          <input
            type="text"
            value={builderConfig.subject}
            onChange={e => setBuilderConfig(prev => ({ ...prev, subject: e.target.value }))}
            className="w-full h-9 px-3 text-sm border rounded-md bg-background"
            style={{ fontFamily: '宋体', fontSize: '16px' }}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('grade', { defaultValue: '学段' })}</label>
          <div className="flex gap-2 flex-wrap">
            {GRADE_OPTIONS.map(g => (
              <Button
                key={g}
                variant="outline"
                size="sm"
                onClick={() => setBuilderConfig(prev => ({ ...prev, grade: g }))}
                className={builderConfig.grade === g ? 'border-primary bg-primary/10 font-medium' : ''}
              >
                {g}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('duration', { defaultValue: '课时' })}</label>
          <div className="flex gap-2 flex-wrap">
            {DURATION_OPTIONS.map(d => (
              <Button
                key={d}
                variant="outline"
                size="sm"
                onClick={() => setBuilderConfig(prev => ({ ...prev, duration: d }))}
                className={builderConfig.duration === d ? 'border-primary bg-primary/10 font-medium' : ''}
              >
                {d}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </PluginPromptBuilderDialog>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<BookOpen className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('welcomeDesc')}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder')}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 生成教案' })}
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
        setConfig({ subject: document.title || '课程', grade: '高中', duration: '1课时(40分钟)' });
        host.docData!.markDirty();
        showStatus('已清空全部内容');
      }}
      sourceCode={data.lessonPlan || undefined}
      onSourceCodeSave={(code) => {
        onPluginDataChange({ ...data, lessonPlan: code });
        host.docData!.markDirty();
      }}
    >
      {/* ③ 内容区 */}
      {data.lessonPlan && (
        <div className="p-4 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          {data.lessonPlan}
        </div>
      )}
    </PluginPanelLayout>
  );
}
