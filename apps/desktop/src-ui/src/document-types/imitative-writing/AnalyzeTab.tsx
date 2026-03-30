/**
 * 智能分析 Tab
 * - 本地统计展示（字数/段落/修辞密度/相似度/写作阶段）
 * - AI 快速分析按钮（全文分析/修辞分析/结构分析/风格识别）
 */
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, Sparkles, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImitativeWritingContent, PatchImitativeDocFn } from './types';
import { countWords } from './types';
import {
  analyzeText, detectRhetoric, estimateSimilarity,
  detectWritingPhase, getWritingPhaseLabel, getWritingPhaseColor,
} from './imitativeAnalysis';

interface AnalyzeTabProps {
  docContent: ImitativeWritingContent;
  onSendMessage: (prompt: string) => void;
  streaming: boolean;
  onPatchDoc?: PatchImitativeDocFn;
}

function parseTechniqueInput(raw: string): string[] {
  const parts = raw.split(/[,，、;；\n]/).map(s => s.trim()).filter(Boolean);
  return [...new Set(parts)];
}

export function AnalyzeTab({ docContent, onSendMessage, streaming, onPatchDoc }: AnalyzeTabProps) {
  const { t } = useTranslation();

  const cacheSyncKey = docContent.analysisCache
    ? `${docContent.analysisCache.analyzedAt}\0${docContent.analysisCache.keyTechniques.join('\u0001')}`
    : '';

  const [techniqueDraft, setTechniqueDraft] = useState(() =>
    docContent.analysisCache?.keyTechniques?.join('、') ?? '',
  );

  useEffect(() => {
    setTechniqueDraft(docContent.analysisCache?.keyTechniques?.join('、') ?? '');
  }, [cacheSyncKey]);

  const sourceStats = useMemo(() => analyzeText(docContent.source.text), [docContent.source.text]);
  const imitationStats = useMemo(() => analyzeText(docContent.imitation.text), [docContent.imitation.text]);
  const sourceRhetoric = useMemo(() => detectRhetoric(docContent.source.text), [docContent.source.text]);
  const similarity = useMemo(() =>
    estimateSimilarity(docContent.source.text, docContent.imitation.text),
  [docContent.source.text, docContent.imitation.text]);
  const sourceWc = useMemo(() => countWords(docContent.source.text), [docContent.source.text]);
  const imitationWc = useMemo(() => countWords(docContent.imitation.text), [docContent.imitation.text]);
  const phase = useMemo(() => detectWritingPhase(sourceWc, imitationWc), [sourceWc, imitationWc]);
  const phaseLabel = getWritingPhaseLabel(phase);
  const phaseColor = getWritingPhaseColor(phase);

  const hasSource = !!docContent.source.text.trim();
  const hasImitation = !!docContent.imitation.text.trim();

  const aiActions = [
    {
      id: 'full-analyze',
      label: t('imitativeWriting.analyze.fullAnalyze', { defaultValue: '全文分析' }),
      prompt: `请对以下原文进行全面的文学分析，包括写作手法、修辞特点、意象运用、结构安排、语言风格，并列出最值得仿写的3个核心技法：\n\n${docContent.source.text}`,
    },
    {
      id: 'rhetoric-analyze',
      label: t('imitativeWriting.analyze.rhetoricAnalyze', { defaultValue: '修辞分析' }),
      prompt: `请逐一列举以下文段中的修辞手法（比喻、拟人、排比、对偶等），分析其表达效果，并给出仿写建议：\n\n${docContent.source.text}`,
    },
    {
      id: 'structure-analyze',
      label: t('imitativeWriting.analyze.structureAnalyze', { defaultValue: '结构分析' }),
      prompt: `请分析以下文章的篇章结构：开头方式、段落安排、过渡衔接、结尾处理，并绘制结构简图：\n\n${docContent.source.text}`,
    },
    {
      id: 'style-identify',
      label: t('imitativeWriting.analyze.styleIdentify', { defaultValue: '风格识别' }),
      prompt: `请识别以下文章的写作风格：语言特色、句式偏好、情感基调，并推断作者可能的文学流派倾向：\n\n${docContent.source.text}`,
    },
    {
      id: 'narrator-voice',
      label: t('imitativeWriting.analyze.narratorVoice', { defaultValue: '叙述视角' }),
      prompt: `请分析以下原文的叙述视角与人称策略：全知/限知、距离感、可靠性，并说明仿写时应如何对齐或刻意变化：\n\n${docContent.source.text}`,
    },
    {
      id: 'gap-diagnosis',
      label: t('imitativeWriting.analyze.gapDiagnosis', { defaultValue: '仿写缺口诊断' }),
      prompt: hasImitation
        ? `请对照原文与下方仿写，诊断「尚未覆盖」的结构节点、意象链或修辞习惯（各列 3～5 条），并给出下一步最小补写建议：\n\n【原文】\n${docContent.source.text}\n\n【仿写】\n${docContent.imitation.text}`
        : `请先阅读原文，预判仿写者最容易忽略的 5 类技法或结构要点，并说明如何在动笔前规避：\n\n${docContent.source.text}`,
    },
    {
      id: 'technique-matrix',
      label: t('imitativeWriting.analyze.techniqueMatrix', { defaultValue: '技法对照表' }),
      prompt: hasImitation
        ? `请用 Markdown 表格对比原文与仿写：维度含「修辞密度、意象、句式长短、对话占比、节奏」。每格一句简评并给改进优先级（高/中/低）。\n\n【原文】\n${docContent.source.text}\n\n【仿写】\n${docContent.imitation.text}`
        : `请基于原文预估一张「技法—难度—仿写要点」三列表，帮助规划仿写路径：\n\n${docContent.source.text}`,
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto bg-muted/5">
      {/* 统计面板 */}
      <div className="p-2 border-b border-border/60 bg-card/40">
        <div className="flex items-center gap-1 mb-1.5">
          <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('imitativeWriting.analyze.stats', { defaultValue: '文本统计' })}
          </span>
        </div>

        {/* 进度条 */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>{t('imitativeWriting.analyze.progress', { defaultValue: '仿写进度' })}</span>
            <span className={phaseColor}>{phaseLabel}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            {/* eslint-disable-next-line react/forbid-component-props */}
            <div
              className="h-full bg-primary/70 rounded-full transition-all"
              style={{ width: `${sourceWc > 0 ? Math.min(100, Math.round((imitationWc / sourceWc) * 100)) : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-0.5">
            <span>{t('imitativeWriting.analyze.sourceWords', { defaultValue: '原文' })} {sourceWc}</span>
            <span>{t('imitativeWriting.analyze.imitationWords', { defaultValue: '仿写' })} {imitationWc}</span>
          </div>
        </div>

        {/* 字符相似度 */}
        {hasSource && hasImitation && (
          <div className="flex items-center justify-between text-[10px] py-0.5">
            <span className="text-muted-foreground">{t('imitativeWriting.analyze.similarity', { defaultValue: '字符相似度' })}</span>
            <span className={similarity > 60 ? 'text-amber-500' : similarity > 30 ? 'text-blue-500' : 'text-green-500'}>
              {similarity}%
            </span>
          </div>
        )}

        {/* 段落数 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
          {hasSource && (
            <>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{t('imitativeWriting.analyze.sourceParagraphs', { defaultValue: '原文段落' })}</span>
                <span>{sourceStats.paragraphCount}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{t('imitativeWriting.analyze.avgLength', { defaultValue: '均长' })}</span>
                <span>{sourceStats.avgParagraphLength}</span>
              </div>
            </>
          )}
          {hasImitation && (
            <>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{t('imitativeWriting.analyze.imitationParagraphs', { defaultValue: '仿写段落' })}</span>
                <span>{imitationStats.paragraphCount}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{t('imitativeWriting.analyze.avgLength', { defaultValue: '均长' })}</span>
                <span>{imitationStats.avgParagraphLength}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 修辞检测 */}
      {sourceRhetoric.length > 0 && (
        <div className="p-2 border-b">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">
            {t('imitativeWriting.analyze.rhetoricDetected', { defaultValue: '检测到修辞手法' })}
          </p>
          <div className="flex flex-wrap gap-1">
            {sourceRhetoric.map(r => (
              <span key={r.type} className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded px-1.5 py-0.5"
                title={r.description}>
                {r.type} ×{r.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI 快速分析 */}
      <div className="p-2 flex-1">
        <div className="flex items-center gap-1 mb-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary/80" />
          <span className="text-[11px] font-semibold text-foreground/90">
            {t('imitativeWriting.analyze.aiAnalysis', { defaultValue: 'AI 深度分析' })}
          </span>
        </div>
        {!hasSource ? (
          <p className="text-[10px] text-muted-foreground/60 text-center py-3">
            {t('imitativeWriting.analyze.noSource', { defaultValue: '请先添加原文' })}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-1">
            {aiActions.map(action => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                disabled={streaming}
                onClick={() => onSendMessage(action.prompt)}
                className="h-auto min-h-8 text-[10px] justify-start px-2 py-1.5 text-left whitespace-normal"
                title={action.label}
              >
                <span className="truncate">{action.label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {onPatchDoc && (
        <div className="p-2 border-t border-border/60 bg-muted/20 space-y-1.5 shrink-0">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-foreground/85">
            <Database className="h-3 w-3 text-muted-foreground" />
            {t('imitativeWriting.analyze.cacheTitle', { defaultValue: '核心技法缓存' })}
          </div>
          <p className="text-[9px] text-muted-foreground leading-snug">
            {t('imitativeWriting.analyze.cacheHint', {
              defaultValue:
                '保存后写入文档，并自动融入对话系统提示。可与上方 AI 分析对照填写，顿号、逗号或换行分隔多条。',
            })}
          </p>
          <textarea
            value={techniqueDraft}
            onChange={e => setTechniqueDraft(e.target.value)}
            className="w-full text-[10px] border rounded-md p-1.5 bg-background min-h-[3.25rem] resize-y focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder={t('imitativeWriting.analyze.cachePlaceholder', {
              defaultValue: '比喻、排比、限知叙事、白描…',
            })}
            disabled={streaming}
            aria-label={t('imitativeWriting.analyze.cacheTitle', { defaultValue: '核心技法缓存' })}
          />
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 text-[10px] flex-1"
              disabled={streaming}
              onClick={() => {
                const keyTechniques = parseTechniqueInput(techniqueDraft);
                onPatchDoc(prev => ({
                  ...prev,
                  analysisCache: {
                    genre: prev.genre,
                    structureAnalysis: prev.analysisCache?.structureAnalysis ?? '',
                    rhetoricAnalysis: prev.analysisCache?.rhetoricAnalysis ?? '',
                    styleAnalysis: prev.analysisCache?.styleAnalysis ?? '',
                    keyTechniques,
                    analyzedAt: new Date().toISOString(),
                  },
                }));
              }}
            >
              {t('imitativeWriting.analyze.cacheSave', { defaultValue: '保存到文档' })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[10px] shrink-0"
              disabled={streaming || !docContent.analysisCache}
              onClick={() => {
                setTechniqueDraft('');
                onPatchDoc(prev => ({ ...prev, analysisCache: null }));
              }}
            >
              {t('imitativeWriting.analyze.cacheClear', { defaultValue: '清除缓存' })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
