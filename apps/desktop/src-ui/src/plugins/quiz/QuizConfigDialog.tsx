import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, Label } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { DEFAULT_QUIZ_CONFIG, calcTotalScore, type QuizConfig } from './types';

interface QuizConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  onGenerate: (config: QuizConfig) => void;
}

export function QuizConfigDialog({ open, onOpenChange, documentTitle, onGenerate }: QuizConfigDialogProps) {
  const host = usePluginHost();
  const t = host.platform.t;
  const [config, setConfig] = useState<QuizConfig>({
    ...DEFAULT_QUIZ_CONFIG,
    title: documentTitle ? `${documentTitle} - 测试题` : '测试题',
  });

  useEffect(() => {
    if (open) {
      setConfig(prev => ({
        ...prev,
        title: documentTitle ? `${documentTitle} - 测试题` : prev.title,
      }));
    }
  }, [open, documentTitle]);

  const totalScore = calcTotalScore(config);

  const updateField = (field: keyof QuizConfig, value: number | string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = () => {
    onGenerate(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('quiz.configTitle', { defaultValue: '测试题配置' })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 标题 */}
          <div className="space-y-1.5">
            <Label>{t('quiz.title', { defaultValue: '测试题标题' })}</Label>
            <Input
              value={config.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="请输入测试题标题"
            />
          </div>

          {/* 题型配置 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('quiz.questionConfig', { defaultValue: '题型与分值' })}</Label>

            {/* 单选题 */}
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
              <span className="text-sm">{t('quiz.singleChoice', { defaultValue: '单选题' })}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={config.singleCount}
                  onChange={e => updateField('singleCount', Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-center"
                />
                <span className="text-xs text-muted-foreground">题</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={config.singleScore}
                  onChange={e => updateField('singleScore', Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-center"
                />
                <span className="text-xs text-muted-foreground">分/题</span>
              </div>
            </div>

            {/* 多选题 */}
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
              <span className="text-sm">{t('quiz.multipleChoice', { defaultValue: '多选题' })}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={config.multipleCount}
                  onChange={e => updateField('multipleCount', Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-center"
                />
                <span className="text-xs text-muted-foreground">题</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={config.multipleScore}
                  onChange={e => updateField('multipleScore', Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-center"
                />
                <span className="text-xs text-muted-foreground">分/题</span>
              </div>
            </div>

            {/* 判断题 */}
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 items-center">
              <span className="text-sm">{t('quiz.trueFalse', { defaultValue: '判断题' })}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={config.trueFalseCount}
                  onChange={e => updateField('trueFalseCount', Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-center"
                />
                <span className="text-xs text-muted-foreground">题</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={config.trueFalseScore}
                  onChange={e => updateField('trueFalseScore', Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-center"
                />
                <span className="text-xs text-muted-foreground">分/题</span>
              </div>
            </div>
          </div>

          {/* 总分显示 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <span className="text-sm font-medium">{t('quiz.totalScore', { defaultValue: '总分' })}</span>
            <span className={`text-lg font-bold ${totalScore === 100 ? 'text-green-600' : 'text-amber-600'}`}>
              {totalScore} {t('quiz.points', { defaultValue: '分' })}
            </span>
          </div>
          {totalScore !== 100 && (
            <p className="text-xs text-amber-600">
              {t('quiz.scoreTip', { defaultValue: '提示：建议将总分设为 100 分' })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={config.singleCount + config.multipleCount + config.trueFalseCount === 0}
          >
            {t('quiz.generate', { defaultValue: '生成测试题' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
