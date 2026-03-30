/**
 * 仿写指导 Tab
 * - 写作阶段感知的推荐指导操作
 * - 逐段指导、修辞练习、写作锦囊等（文字按钮）
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImitativeWritingContent } from './types';
import { countWords } from './types';
import { detectWritingPhase, type WritingPhase } from './imitativeAnalysis';

interface GuideTabProps {
  docContent: ImitativeWritingContent;
  onSendMessage: (prompt: string) => void;
  streaming: boolean;
}

interface GuideActionDef {
  id: string;
  phase: 'all' | Exclude<WritingPhase, 'not-started'>;
  prompt: (content: ImitativeWritingContent) => string;
}

const GUIDE_ACTION_DEFS: GuideActionDef[] = [
  {
    id: 'para-guide',
    phase: 'mid',
    prompt: c =>
      `请对比以下原文与仿写，逐段给出具体改进指导，指出差距所在和改进方向：\n\n【原文】\n${c.source.text}\n\n【仿写】\n${c.imitation.text}`,
  },
  {
    id: 'rhetoric-exercise',
    phase: 'all',
    prompt: c =>
      `请根据以下原文的修辞风格，设计5个针对性的修辞训练练习，帮助提升修辞运用能力：\n\n${c.source.text}`,
  },
  {
    id: 'writing-tips',
    phase: 'early',
    prompt: c =>
      `结合以下原文特点，给我10条具体的写作建议，帮助仿写时更好掌握原文精髓：\n\n${c.source.text}`,
  },
  {
    id: 'description-guide',
    phase: 'all',
    prompt: c =>
      `请分析以下原文的描写技法，并设计专项描写训练（景物/人物/细节），从示例中总结规律：\n\n${c.source.text}`,
  },
  {
    id: 'polish-guide',
    phase: 'late',
    prompt: c =>
      `请对以下仿写作品进行语言润色，参考原文风格使语言更优美、流畅：\n\n【原文参考】\n${c.source.text}\n\n【仿写】\n${c.imitation.text}`,
  },
  {
    id: 'opening-guide',
    phase: 'early',
    prompt: c =>
      `参考以下原文的开头方式，帮我构思3种不同的仿写开头（保持原文开头的节奏感和氛围）：\n\n【原文开头】\n${c.source.text}`,
  },
  {
    id: 'rhythm-guide',
    phase: 'mid',
    prompt: c =>
      `请分析原文语言节奏，调整仿写作品的句式长短和停顿安排，使节奏更接近原文：\n\n【原文】\n${c.source.text}\n\n【仿写】\n${c.imitation.text}`,
  },
  {
    id: 'imagery-guide',
    phase: 'mid',
    prompt: c =>
      `参考原文的意象系统，丰富仿写作品中的意象，使其更有画面感和象征意味：\n\n【原文意象参考】\n${c.source.text}\n\n【仿写】\n${c.imitation.text}`,
  },
  {
    id: 'dialogue-drill',
    phase: 'mid',
    prompt: c =>
      `请从原文中摘录或概括对话片段，分析语气与潜台词，并给出 3 组「原文式对话」仿写练习（含参考答案要点）：\n\n${c.source.text}`,
  },
  {
    id: 'micro-rewrite',
    phase: 'late',
    prompt: c =>
      `请从我仿写中选 3 句「最平淡」的句子，按原文风格做微改写示范，并说明改动理由：\n\n【原文】\n${c.source.text}\n\n【仿写】\n${c.imitation.text}`,
  },
];

const PHASE_HINT_KEYS: Record<WritingPhase, { key: string; defaultText: string }> = {
  'not-started': {
    key: 'imitativeWriting.guide.phaseHint.notStarted',
    defaultText: '尚未开始仿写，建议先用「写作锦囊」了解原文技法要点',
  },
  early: {
    key: 'imitativeWriting.guide.phaseHint.early',
    defaultText: '仿写刚起步，建议先做「开头指导」和「写作锦囊」',
  },
  mid: {
    key: 'imitativeWriting.guide.phaseHint.mid',
    defaultText: '仿写进行中，建议「逐段指导」找出差距，或做「修辞练习」',
  },
  late: {
    key: 'imitativeWriting.guide.phaseHint.late',
    defaultText: '仿写接近完成，建议用「润色指导」和「节奏调整」提升质量',
  },
  done: {
    key: 'imitativeWriting.guide.phaseHint.done',
    defaultText: '仿写已完成，可用「润色指导」进行最终打磨，或做综合评估',
  },
};

const ACTION_LABEL_DEFAULTS: Record<string, string> = {
  'para-guide': '逐段指导',
  'rhetoric-exercise': '修辞练习',
  'writing-tips': '写作锦囊',
  'description-guide': '描写训练',
  'polish-guide': '润色指导',
  'opening-guide': '开头指导',
  'rhythm-guide': '节奏调整',
  'imagery-guide': '意象丰富',
  'dialogue-drill': '对话专项',
  'micro-rewrite': '微改写示范',
};

export function GuideTab({ docContent, onSendMessage, streaming }: GuideTabProps) {
  const { t } = useTranslation();

  const sourceWc = useMemo(() => countWords(docContent.source.text), [docContent.source.text]);
  const imitationWc = useMemo(() => countWords(docContent.imitation.text), [docContent.imitation.text]);
  const phase = useMemo(() => detectWritingPhase(sourceWc, imitationWc), [sourceWc, imitationWc]);
  const phaseHintEntry = PHASE_HINT_KEYS[phase];
  const phaseHint = t(phaseHintEntry.key, { defaultValue: phaseHintEntry.defaultText });

  const hasSource = !!docContent.source.text.trim();

  const labelFor = (id: string) =>
    t(`imitativeWriting.guide.actions.${id.replace(/-/g, '_')}`, { defaultValue: ACTION_LABEL_DEFAULTS[id] || id });

  const recommendedActions = useMemo(() => {
    return GUIDE_ACTION_DEFS.filter(a => a.phase === 'all' || a.phase === phase);
  }, [phase]);

  const otherActions = useMemo(() => {
    return GUIDE_ACTION_DEFS.filter(a => a.phase !== 'all' && a.phase !== phase);
  }, [phase]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto bg-muted/5">
      {hasSource && (
        <div className="mx-2 mt-2 mb-1 p-2.5 bg-primary/5 border border-primary/15 rounded-md text-[10px] text-foreground/90">
          <div className="flex items-start gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <span className="leading-snug">{phaseHint}</span>
          </div>
        </div>
      )}

      {!hasSource && (
        <div className="flex items-center justify-center flex-1 text-[10px] text-muted-foreground/60 text-center p-4">
          {t('imitativeWriting.guide.noSource', { defaultValue: '请先添加原文内容' })}
        </div>
      )}

      {hasSource && (
        <>
          <div className="p-2 border-b border-border/60 bg-card/40">
            <div className="flex items-center gap-1 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-semibold text-foreground/90">
                {t('imitativeWriting.guide.recommended', { defaultValue: '当前阶段推荐' })}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {recommendedActions.map(action => (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  disabled={streaming}
                  onClick={() => onSendMessage(action.prompt(docContent))}
                  className="h-auto min-h-8 text-[10px] justify-start px-2 py-1.5 text-left whitespace-normal border-amber-500/25 hover:bg-amber-500/5"
                  title={labelFor(action.id)}
                >
                  {labelFor(action.id)}
                </Button>
              ))}
            </div>
          </div>

          {otherActions.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-1 mb-1.5">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t('imitativeWriting.guide.more', { defaultValue: '更多指导' })}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {otherActions.map(action => (
                  <Button
                    key={action.id}
                    variant="ghost"
                    size="sm"
                    disabled={streaming}
                    onClick={() => onSendMessage(action.prompt(docContent))}
                    className="h-auto min-h-8 text-[10px] justify-start px-2 py-1.5 text-left whitespace-normal"
                    title={labelFor(action.id)}
                  >
                    {labelFor(action.id)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
