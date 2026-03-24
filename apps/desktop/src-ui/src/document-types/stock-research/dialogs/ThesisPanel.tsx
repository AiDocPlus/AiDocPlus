/**
 * ThesisPanel — 投资论点管理弹窗
 *
 * 功能：
 * - 创建/编辑投资论点
 * - 设置多空立场、置信度
 * - 管理看多/看空因素列表
 * - 管理催化剂和风险列表
 * - 设置目标价和止损位
 * - 设置有效期
 */

import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, X, Target, TrendingUp, TrendingDown,
  Calendar, DollarSign, Shield, AlertTriangle, Sparkles,
  Check,
} from 'lucide-react';
import type { InvestmentThesis, ThesisStatus, ThesisConfidence } from '../types';
import { THESIS_STATUSES, THESIS_CONFIDENCES } from '../constants';

interface ThesisPanelProps {
  open: boolean;
  onClose: () => void;
  onSave: (thesis: Omit<InvestmentThesis, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingThesis?: InvestmentThesis | null;
  stockName?: string;
  stockCode?: string;
}

export default function ThesisPanel({
  open, onClose, onSave, editingThesis, stockName, stockCode,
}: ThesisPanelProps) {
  const { t } = useTranslation();

  // 表单状态
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<ThesisStatus>('bullish');
  const [confidence, setConfidence] = useState<ThesisConfidence>('moderate');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [bullishFactors, setBullishFactors] = useState<string[]>(['']);
  const [bearishFactors, setBearishFactors] = useState<string[]>(['']);
  const [catalysts, setCatalysts] = useState<string[]>(['']);
  const [risks, setRisks] = useState<string[]>(['']);
  const [validUntil, setValidUntil] = useState<string>('');

  // 初始化编辑状态
  useEffect(() => {
    if (editingThesis) {
      setTitle(editingThesis.title);
      setContent(editingThesis.content);
      setStatus(editingThesis.status);
      setConfidence(editingThesis.confidence);
      setTargetPrice(editingThesis.targetPrice?.toString() || '');
      setStopLoss(editingThesis.stopLoss?.toString() || '');
      setBullishFactors(editingThesis.bullishFactors.length > 0 ? editingThesis.bullishFactors : ['']);
      setBearishFactors(editingThesis.bearishFactors.length > 0 ? editingThesis.bearishFactors : ['']);
      setCatalysts(editingThesis.catalysts.length > 0 ? editingThesis.catalysts : ['']);
      setRisks(editingThesis.risks.length > 0 ? editingThesis.risks : ['']);
      setValidUntil(editingThesis.validUntil ? new Date(editingThesis.validUntil).toISOString().split('T')[0] : '');
    } else {
      resetForm();
    }
  }, [editingThesis, open]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setStatus('bullish');
    setConfidence('moderate');
    setTargetPrice('');
    setStopLoss('');
    setBullishFactors(['']);
    setBearishFactors(['']);
    setCatalysts(['']);
    setRisks(['']);
    setValidUntil('');
  };

  // 处理列表字段
  const handleListChange = (
    list: string[],
    index: number,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const newList = [...list];
    newList[index] = value;
    setter(newList);
  };

  const addListItem = (
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter([...list, '']);
  };

  const removeListItem = (
    list: string[],
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (list.length > 1) {
      setter(list.filter((_, i) => i !== index));
    }
  };

  // 保存
  const handleSave = () => {
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      content: content.trim(),
      status,
      confidence,
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      stopLoss: stopLoss ? Number(stopLoss) : undefined,
      bullishFactors: bullishFactors.filter(f => f.trim()),
      bearishFactors: bearishFactors.filter(f => f.trim()),
      catalysts: catalysts.filter(c => c.trim()),
      risks: risks.filter(r => r.trim()),
      validUntil: validUntil ? new Date(validUntil).getTime() : undefined,
    });

    onClose();
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-amber-500" />
            {editingThesis
              ? t('stockResearch.editThesis', { defaultValue: '编辑投资论点' })
              : t('stockResearch.addThesis', { defaultValue: '新建投资论点' })}
            {stockName && (
              <span className="text-muted-foreground text-xs font-normal">
                — {stockName} ({stockCode})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 标题 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('stockResearch.thesisTitle', { defaultValue: '论点标题' })} *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('stockResearch.thesisTitlePlaceholder', { defaultValue: '例如：长期看好消费升级趋势' })}
              className="text-sm"
            />
          </div>

          {/* 多空立场 + 置信度 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('stockResearch.thesisStatus', { defaultValue: '多空立场' })}
              </label>
              <div className="flex gap-1">
                {THESIS_STATUSES.map(s => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatus(s.key)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs border transition-colors',
                      status === s.key
                        ? 'border-primary bg-primary/10 ' + s.color
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span>{s.icon}</span>
                    <span>{t(s.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('stockResearch.confidence', { defaultValue: '置信度' })}
              </label>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as ThesisConfidence)}
                className="w-full h-8 px-2 text-xs border rounded bg-background"
              >
                {THESIS_CONFIDENCES.map(c => (
                  <option key={c.key} value={c.key}>
                    {t(c.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 论点内容 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('stockResearch.thesisContent', { defaultValue: '论点内容' })}
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('stockResearch.thesisContentPlaceholder', { defaultValue: '详细描述你的投资逻辑...' })}
              className="min-h-[80px] text-sm resize-none"
              rows={4}
            />
          </div>

          {/* 目标价 + 止损位 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {t('stockResearch.targetPrice', { defaultValue: '目标价' })}
              </label>
              <Input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder={t('stockResearch.targetPricePlaceholder', { defaultValue: '例如：100.00' })}
                className="text-sm"
                step="0.01"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {t('stockResearch.stopLoss', { defaultValue: '止损位' })}
              </label>
              <Input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder={t('stockResearch.stopLossPlaceholder', { defaultValue: '例如：80.00' })}
                className="text-sm"
                step="0.01"
              />
            </div>
          </div>

          {/* 看多因素 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              {t('stockResearch.bullishFactors', { defaultValue: '看多因素' })}
            </label>
            <div className="space-y-1">
              {bullishFactors.map((factor, i) => (
                <div key={i} className="flex gap-1">
                  <Input
                    value={factor}
                    onChange={(e) => handleListChange(bullishFactors, i, e.target.value, setBullishFactors)}
                    placeholder={t('stockResearch.bullishFactorPlaceholder', { defaultValue: '输入看多因素' })}
                    className="text-xs flex-1"
                  />
                  {bullishFactors.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeListItem(bullishFactors, i, setBullishFactors)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-6"
              onClick={() => addListItem(bullishFactors, setBullishFactors)}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('stockResearch.addBullishFactor', { defaultValue: '添加看多因素' })}
            </Button>
          </div>

          {/* 看空因素 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              {t('stockResearch.bearishFactors', { defaultValue: '看空因素' })}
            </label>
            <div className="space-y-1">
              {bearishFactors.map((factor, i) => (
                <div key={i} className="flex gap-1">
                  <Input
                    value={factor}
                    onChange={(e) => handleListChange(bearishFactors, i, e.target.value, setBearishFactors)}
                    placeholder={t('stockResearch.bearishFactorPlaceholder', { defaultValue: '输入看空因素' })}
                    className="text-xs flex-1"
                  />
                  {bearishFactors.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeListItem(bearishFactors, i, setBearishFactors)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-6"
              onClick={() => addListItem(bearishFactors, setBearishFactors)}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('stockResearch.addBearishFactor', { defaultValue: '添加看空因素' })}
            </Button>
          </div>

          {/* 催化剂 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              {t('stockResearch.catalysts', { defaultValue: '催化剂' })}
            </label>
            <div className="space-y-1">
              {catalysts.map((catalyst, i) => (
                <div key={i} className="flex gap-1">
                  <Input
                    value={catalyst}
                    onChange={(e) => handleListChange(catalysts, i, e.target.value, setCatalysts)}
                    placeholder={t('stockResearch.catalystPlaceholder', { defaultValue: '输入催化剂事件' })}
                    className="text-xs flex-1"
                  />
                  {catalysts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeListItem(catalysts, i, setCatalysts)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-6"
              onClick={() => addListItem(catalysts, setCatalysts)}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('stockResearch.addCatalyst', { defaultValue: '添加催化剂' })}
            </Button>
          </div>

          {/* 风险因素 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              {t('stockResearch.risks', { defaultValue: '风险因素' })}
            </label>
            <div className="space-y-1">
              {risks.map((risk, i) => (
                <div key={i} className="flex gap-1">
                  <Input
                    value={risk}
                    onChange={(e) => handleListChange(risks, i, e.target.value, setRisks)}
                    placeholder={t('stockResearch.riskPlaceholder', { defaultValue: '输入风险因素' })}
                    className="text-xs flex-1"
                  />
                  {risks.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeListItem(risks, i, setRisks)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-6"
              onClick={() => addListItem(risks, setRisks)}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('stockResearch.addRisk', { defaultValue: '添加风险' })}
            </Button>
          </div>

          {/* 有效期 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {t('stockResearch.validUntil', { defaultValue: '有效期至' })}
            </label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
            <Check className="h-3.5 w-3.5 mr-1" />
            {editingThesis
              ? t('stockResearch.updateThesis', { defaultValue: '更新论点' })
              : t('stockResearch.createThesis', { defaultValue: '创建论点' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
