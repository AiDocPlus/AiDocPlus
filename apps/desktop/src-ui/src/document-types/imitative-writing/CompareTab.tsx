/**
 * 对比评析 Tab
 * - 本地段落对比面板（左右对照）
 * - AI 多维评分 / 整体评析 / 逐段对比
 * - 相似度可视化
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImitativeWritingContent } from './types';
import { compareParagraphs } from './imitativeAnalysis';

interface CompareTabProps {
  docContent: ImitativeWritingContent;
  onSendMessage: (prompt: string) => void;
  streaming: boolean;
}

export function CompareTab({ docContent, onSendMessage, streaming }: CompareTabProps) {
  const { t } = useTranslation();

  const hasSource = !!docContent.source.text.trim();
  const hasImitation = !!docContent.imitation.text.trim();
  const hasBoth = hasSource && hasImitation;

  const paragraphComparisons = useMemo(() => {
    if (!hasBoth) return [];
    return compareParagraphs(docContent.source.text, docContent.imitation.text).slice(0, 8);
  }, [docContent.source.text, docContent.imitation.text, hasBoth]);

  const aiActions = [
    {
      id: 'score',
      label: t('imitativeWriting.compare.score', { defaultValue: '多维评分' }),
      prompt: `请从以下维度为仿写作品打分（百分制）并详细说明：修辞运用、意象营造、节奏韵律、结构安排、情感表达、整体神韵。请用表格呈现评分结果：\n\n【原文参考】\n${docContent.source.text}\n\n【仿写】\n${docContent.imitation.text}`,
    },
    {
      id: 'full-compare',
      label: t('imitativeWriting.compare.fullCompare', { defaultValue: '逐段对比' }),
      prompt: `请逐段对比原文与仿写，分析相似之处和差距，指出仿写成功和需要改进的地方：\n\n【原文】\n${docContent.source.text}\n\n【仿写】\n${docContent.imitation.text}`,
    },
    {
      id: 'report',
      label: t('imitativeWriting.compare.report', { defaultValue: '评析报告' }),
      prompt: `请写一份详细的仿写评析报告，包括：仿写亮点（3条）、主要不足（3条）、改进建议（5条）、学习收获总结：\n\n【原文】\n${docContent.source.text}\n\n【仿写】\n${docContent.imitation.text}`,
    },
    {
      id: 'spirit-affinity',
      label: t('imitativeWriting.compare.spiritAffinity', { defaultValue: '神韵对照' }),
      prompt: `请用「神韵」视角（气息、留白、余味、语调）对照原文与仿写：各写一段总评，再给 5 条可操作的微调建议。\n\n【原文】\n${docContent.source.text}\n\n【仿写】\n${docContent.imitation.text}`,
    },
    {
      id: 'revision-list',
      label: t('imitativeWriting.compare.revisionList', { defaultValue: '修改优先级清单' }),
      prompt: `请输出 P0/P1/P2 三级修改清单（每级至少 2 条），每条对应原文或仿写中的具体现象描述，避免空泛评价。\n\n【原文】\n${docContent.source.text}\n\n【仿写】\n${docContent.imitation.text}`,
    },
  ];

  const getSimilarityColor = (sim: number) => {
    if (sim >= 60) return 'text-amber-500';
    if (sim >= 30) return 'text-blue-500';
    return 'text-green-500';
  };

  const getSimilarityBg = (sim: number) => {
    if (sim >= 60) return 'bg-amber-500/20';
    if (sim >= 30) return 'bg-blue-500/20';
    return 'bg-green-500/20';
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto bg-muted/5">
      {/* AI 评析 */}
      <div className="p-2 border-b border-border/60 bg-card/40 shrink-0">
        <div className="flex items-center gap-1 mb-1.5">
          <Scale className="h-3.5 w-3.5 text-primary/80" />
          <span className="text-[11px] font-semibold text-foreground/90">
            {t('imitativeWriting.compare.aiEval', { defaultValue: 'AI 评析' })}
          </span>
        </div>
        {!hasBoth ? (
          <p className="text-[10px] text-muted-foreground/60 text-center py-2">
            {t('imitativeWriting.compare.noBoth', { defaultValue: '请先添加原文和仿写内容' })}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
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
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* 段落对比 */}
      {paragraphComparisons.length > 0 && (
        <div className="p-2 flex-1">
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
            {t('imitativeWriting.compare.paragraphCompare', { defaultValue: '段落对照' })}
          </p>
          <div className="flex flex-col gap-2">
            {paragraphComparisons.map(item => (
              <div key={item.index} className="border rounded text-[10px] overflow-hidden">
                <div className={`flex items-center justify-between px-2 py-0.5 ${getSimilarityBg(item.similarity)}`}>
                  <span className="text-muted-foreground">
                    {t('imitativeWriting.compare.para', { defaultValue: '第' })} {item.index} {t('imitativeWriting.compare.paraUnit', { defaultValue: '段' })}
                  </span>
                  <span className={`font-medium text-[9px] ${getSimilarityColor(item.similarity)}`}>
                    {item.similarity}%
                  </span>
                </div>
                <div className="grid grid-cols-2 divide-x">
                  <div className="p-1.5">
                    <p className="text-[9px] text-muted-foreground/60 mb-0.5">
                      {t('imitativeWriting.compare.sourceLabel', { defaultValue: '原文' })}
                    </p>
                    <p className="line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {item.source || <span className="text-muted-foreground/40">—</span>}
                    </p>
                  </div>
                  <div className="p-1.5">
                    <p className="text-[9px] text-muted-foreground/60 mb-0.5">
                      {t('imitativeWriting.compare.imitationLabel', { defaultValue: '仿写' })}
                    </p>
                    <p className="line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {item.imitation || <span className="text-muted-foreground/40">—</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {paragraphComparisons.length >= 8 && (
              <p className="text-[9px] text-muted-foreground/50 text-center">
                {t('imitativeWriting.compare.showingFirst8', { defaultValue: '仅显示前 8 段' })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
