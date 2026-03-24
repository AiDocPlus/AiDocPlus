/**
 * ResearchResultDialog — 一键研究结果预览弹窗
 *
 * 功能：
 * - 展示 AI 返回的研究数据预览
 * - 用户勾选要应用的字段
 * - 分类展示：股票信息、财务指标、技术指标、论点、新闻
 * - 应用选中字段到文档
 */

import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  ScrollArea,
} from '@/components/ui/scroll-area';
import {
  TrendingUp, DollarSign, LineChart, Target, FileText,
  Check, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import type { StockResearchDocumentContent, StockInfo, FinancialMetrics, TechnicalIndicators, InvestmentThesis, StockNews, RiskAssessment, PeerComparison } from '../types';
import { normalizeTsCodeForTushare } from '../ai/outputParser';

// 解析后的 AI 输出类型
export interface ParsedResearchOutput {
  stock?: Partial<StockInfo>;
  financials?: Partial<FinancialMetrics>;
  technicals?: Partial<TechnicalIndicators>;
  theses?: Array<Omit<InvestmentThesis, 'id' | 'createdAt' | 'updatedAt'>>;
  risk?: Partial<RiskAssessment>;
  news?: Array<Omit<StockNews, 'id' | 'createdAt'>>;
  peers?: Array<Omit<PeerComparison, 'id'>>;
}

interface FieldGroup {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  fields: FieldItem[];
}

interface FieldItem {
  key: string;
  label: string;
  value: any;
  type: 'text' | 'number' | 'percent' | 'list' | 'object';
}

interface ResearchResultDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (selectedFields: Record<string, boolean>) => void;
  isLoading?: boolean;
  researchOutput: ParsedResearchOutput | null;
  currentResearch: StockResearchDocumentContent;
}

export default function ResearchResultDialog({
  open, onClose, onApply, isLoading = false, researchOutput, currentResearch,
}: ResearchResultDialogProps) {
  const { t } = useTranslation();

  const codeApplyWarnings = useMemo(() => {
    const msgs: string[] = [];
    const rawNew = researchOutput?.stock?.code?.trim();
    if (!rawNew) return msgs;
    const normNew = normalizeTsCodeForTushare(rawNew);
    if (!normNew) {
      msgs.push(
        t('stockResearch.applyWarningInvalidTsCode', {
          code: rawNew,
          defaultValue:
            'AI 返回的股票代码「{{code}}」不符合标准 ts_code（如 000001.SZ），应用时将忽略该代码字段。',
        }),
      );
      return msgs;
    }
    const rawCur = currentResearch.stock.code?.trim();
    if (rawCur) {
      const normCur = normalizeTsCodeForTushare(rawCur);
      if (normCur && normNew !== normCur) {
        msgs.push(
          t('stockResearch.applyWarningCodeMismatch', {
            newCode: normNew,
            currentCode: normCur,
            defaultValue: 'AI 返回代码 {{newCode}} 与当前文档 {{currentCode}} 不一致，请确认后再应用。',
          }),
        );
      }
    }
    return msgs;
  }, [researchOutput?.stock?.code, currentResearch.stock.code, t]);

  // 选中的字段
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});

  // 构建字段组
  const fieldGroups = useMemo((): FieldGroup[] => {
    if (!researchOutput) return [];

    const groups: FieldGroup[] = [];

    // 股票信息
    if (researchOutput.stock && Object.keys(researchOutput.stock).length > 0) {
      const s = researchOutput.stock;
      const fields: FieldItem[] = [];

      if (s.code) fields.push({ key: 'stock.code', label: t('stockResearch.code'), value: s.code, type: 'text' });
      if (s.name) fields.push({ key: 'stock.name', label: t('stockResearch.name'), value: s.name, type: 'text' });
      if (s.market) fields.push({ key: 'stock.market', label: t('stockResearch.market'), value: s.market, type: 'text' });
      if (s.industry) fields.push({ key: 'stock.industry', label: t('stockResearch.industry'), value: s.industry, type: 'text' });
      if (s.sector) fields.push({ key: 'stock.sector', label: t('stockResearch.sector'), value: s.sector, type: 'text' });
      if (s.description) fields.push({ key: 'stock.description', label: t('stockResearch.description'), value: s.description, type: 'text' });
      if (s.marketCap) fields.push({ key: 'stock.marketCap', label: t('stockResearch.marketCap'), value: s.marketCap + '亿', type: 'text' });

      if (fields.length > 0) {
        groups.push({
          key: 'stock',
          label: t('stockResearch.stockInfo', { defaultValue: '股票信息' }),
          icon: TrendingUp,
          iconColor: 'text-primary',
          fields,
        });
      }
    }

    // 财务指标
    if (researchOutput.financials && Object.keys(researchOutput.financials).length > 0) {
      const f = researchOutput.financials;
      const fields: FieldItem[] = [];

      if (f.pe !== undefined) fields.push({ key: 'financials.pe', label: 'PE', value: f.pe, type: 'number' });
      if (f.pb !== undefined) fields.push({ key: 'financials.pb', label: 'PB', value: f.pb, type: 'number' });
      if (f.ps !== undefined) fields.push({ key: 'financials.ps', label: 'PS', value: f.ps, type: 'number' });
      if (f.roe !== undefined) fields.push({ key: 'financials.roe', label: 'ROE', value: f.roe, type: 'percent' });
      if (f.roa !== undefined) fields.push({ key: 'financials.roa', label: 'ROA', value: f.roa, type: 'percent' });
      if (f.grossMargin !== undefined) fields.push({ key: 'financials.grossMargin', label: t('stockResearch.grossMargin'), value: f.grossMargin, type: 'percent' });
      if (f.netMargin !== undefined) fields.push({ key: 'financials.netMargin', label: t('stockResearch.netMargin'), value: f.netMargin, type: 'percent' });
      if (f.revenue !== undefined) fields.push({ key: 'financials.revenue', label: t('stockResearch.revenue'), value: f.revenue + '亿', type: 'text' });
      if (f.revenueGrowth !== undefined) fields.push({ key: 'financials.revenueGrowth', label: t('stockResearch.revenueGrowth'), value: f.revenueGrowth, type: 'percent' });
      if (f.netIncome !== undefined) fields.push({ key: 'financials.netIncome', label: t('stockResearch.netIncome'), value: f.netIncome + '亿', type: 'text' });
      if (f.eps !== undefined) fields.push({ key: 'financials.eps', label: 'EPS', value: f.eps, type: 'number' });
      if (f.dividendYield !== undefined) fields.push({ key: 'financials.dividendYield', label: t('stockResearch.dividendYield'), value: f.dividendYield, type: 'percent' });
      if (f.debtToEquity !== undefined) fields.push({ key: 'financials.debtToEquity', label: t('stockResearch.debtToEquity'), value: f.debtToEquity, type: 'percent' });
      if (f.currentRatio !== undefined) fields.push({ key: 'financials.currentRatio', label: t('stockResearch.currentRatio'), value: f.currentRatio, type: 'number' });

      if (fields.length > 0) {
        groups.push({
          key: 'financials',
          label: t('stockResearch.financialMetrics', { defaultValue: '财务指标' }),
          icon: DollarSign,
          iconColor: 'text-green-500',
          fields,
        });
      }
    }

    // 技术指标
    if (researchOutput.technicals && Object.keys(researchOutput.technicals).length > 0) {
      const tech = researchOutput.technicals;
      const fields: FieldItem[] = [];

      if (tech.price !== undefined) fields.push({ key: 'technicals.price', label: t('stockResearch.price'), value: tech.price, type: 'number' });
      if (tech.changePercent !== undefined) fields.push({ key: 'technicals.changePercent', label: t('stockResearch.changePercent'), value: tech.changePercent, type: 'percent' });
      if (tech.volume !== undefined) fields.push({ key: 'technicals.volume', label: t('stockResearch.volume'), value: tech.volume.toLocaleString(), type: 'text' });
      if (tech.turnoverRate !== undefined) fields.push({ key: 'technicals.turnoverRate', label: t('stockResearch.turnoverRate'), value: tech.turnoverRate, type: 'percent' });
      if (tech.ma5 !== undefined) fields.push({ key: 'technicals.ma5', label: 'MA5', value: tech.ma5, type: 'number' });
      if (tech.ma20 !== undefined) fields.push({ key: 'technicals.ma20', label: 'MA20', value: tech.ma20, type: 'number' });
      if (tech.support !== undefined) fields.push({ key: 'technicals.support', label: t('stockResearch.support'), value: tech.support, type: 'number' });
      if (tech.resistance !== undefined) fields.push({ key: 'technicals.resistance', label: t('stockResearch.resistance'), value: tech.resistance, type: 'number' });
      if (tech.trend) fields.push({ key: 'technicals.trend', label: t('stockResearch.trend'), value: tech.trend, type: 'text' });

      if (fields.length > 0) {
        groups.push({
          key: 'technicals',
          label: t('stockResearch.technicalIndicators', { defaultValue: '技术指标' }),
          icon: LineChart,
          iconColor: 'text-blue-500',
          fields,
        });
      }
    }

    // 投资论点
    if (researchOutput.theses && researchOutput.theses.length > 0) {
      const fields: FieldItem[] = researchOutput.theses.map((thesis, i) => ({
        key: `theses.${i}`,
        label: `${t('stockResearch.thesis')} ${i + 1}`,
        value: {
          title: thesis.title,
          status: thesis.status,
          content: thesis.content?.slice(0, 100) + (thesis.content && thesis.content.length > 100 ? '...' : ''),
        },
        type: 'object',
      }));

      groups.push({
        key: 'theses',
        label: t('stockResearch.investmentTheses', { defaultValue: '投资论点' }),
        icon: Target,
        iconColor: 'text-amber-500',
        fields,
      });
    }

    // 风险评估
    if (researchOutput.risk && Object.keys(researchOutput.risk).length > 0) {
      const r = researchOutput.risk;
      const fields: FieldItem[] = [];

      if (r.level) fields.push({ key: 'risk.level', label: t('stockResearch.riskLevel'), value: r.level, type: 'text' });
      if (r.score !== undefined) fields.push({ key: 'risk.score', label: t('stockResearch.riskScore'), value: r.score, type: 'number' });
      if (r.factors && r.factors.length > 0) fields.push({ key: 'risk.factors', label: t('stockResearch.riskFactors'), value: r.factors, type: 'list' });

      if (fields.length > 0) {
        groups.push({
          key: 'risk',
          label: t('stockResearch.riskAssessment', { defaultValue: '风险评估' }),
          icon: FileText,
          iconColor: 'text-orange-500',
          fields,
        });
      }
    }

    // 新闻
    if (researchOutput.news && researchOutput.news.length > 0) {
      const fields: FieldItem[] = researchOutput.news.slice(0, 5).map((n, i) => ({
        key: `news.${i}`,
        label: `${t('stockResearch.news')} ${i + 1}`,
        value: {
          title: n.title,
          sentiment: n.sentiment,
          summary: n.summary?.slice(0, 80) + (n.summary && n.summary.length > 80 ? '...' : ''),
        },
        type: 'object',
      }));

      groups.push({
        key: 'news',
        label: t('stockResearch.recentNews', { defaultValue: '近期新闻' }),
        icon: FileText,
        iconColor: 'text-purple-500',
        fields,
      });
    }

    return groups;
  }, [researchOutput, t]);

  // 初始化选中状态 - 全选
  useMemo(() => {
    if (open && researchOutput) {
      const initial: Record<string, boolean> = {};
      fieldGroups.forEach(group => {
        group.fields.forEach(field => {
          initial[field.key] = true;
        });
      });
      // 只在首次打开时设置
      if (Object.keys(selectedFields).length === 0) {
        setSelectedFields(initial);
      }
    }
  }, [open, researchOutput, fieldGroups]);

  // 重置选中状态
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedFields({});
      onClose();
    }
  };

  // 切换字段选中
  const toggleField = (key: string) => {
    setSelectedFields(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 切换整组
  const toggleGroup = (groupKey: string, checked: boolean) => {
    const group = fieldGroups.find(g => g.key === groupKey);
    if (!group) return;

    setSelectedFields(prev => {
      const next = { ...prev };
      group.fields.forEach(f => {
        next[f.key] = checked;
      });
      return next;
    });
  };

  // 全选/取消全选
  const toggleAll = (checked: boolean) => {
    setSelectedFields(prev => {
      const next = { ...prev };
      Object.keys(prev).forEach(k => {
        next[k] = checked;
      });
      return next;
    });
  };

  // 应用选中字段
  const handleApply = () => {
    onApply(selectedFields);
    setSelectedFields({});
    onClose();
  };

  // 统计选中数量
  const selectedCount = Object.values(selectedFields).filter(Boolean).length;
  const totalCount = Object.keys(selectedFields).length;

  // 渲染字段值
  const renderFieldValue = (field: FieldItem) => {
    if (field.type === 'object') {
      const obj = field.value as any;
      return (
        <div className="text-xs space-y-0.5">
          {obj.title && <div className="font-medium truncate">{obj.title}</div>}
          {obj.status && (
            <div className={cn(
              'text-[10px]',
              obj.status === 'bullish' && 'text-green-500',
              obj.status === 'bearish' && 'text-red-500',
            )}>
              {obj.status === 'bullish' ? '📈 看多' : obj.status === 'bearish' ? '📉 看空' : '➖ 中性'}
            </div>
          )}
          {obj.sentiment && (
            <div className={cn(
              'text-[10px]',
              obj.sentiment === 'positive' && 'text-green-500',
              obj.sentiment === 'negative' && 'text-red-500',
            )}>
              {obj.sentiment === 'positive' ? '🟢 利好' : obj.sentiment === 'negative' ? '🔴 利空' : '⚪ 中性'}
            </div>
          )}
          {obj.content && <div className="text-muted-foreground line-clamp-2">{obj.content}</div>}
          {obj.summary && <div className="text-muted-foreground line-clamp-2">{obj.summary}</div>}
        </div>
      );
    }

    if (field.type === 'list') {
      const items = field.value as string[];
      return (
        <div className="text-xs">
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className="truncate">• {item}</div>
          ))}
          {items.length > 3 && <div className="text-muted-foreground">+{items.length - 3} 更多</div>}
        </div>
      );
    }

    if (field.type === 'percent') {
      return <span className={cn('text-xs', field.value > 0 ? 'text-green-500' : field.value < 0 ? 'text-red-500' : '')}>{field.value}%</span>;
    }

    if (field.type === 'number') {
      return <span className="text-xs font-mono">{typeof field.value === 'number' ? field.value.toFixed(2) : field.value}</span>;
    }

    return <span className="text-xs">{String(field.value)}</span>;
  };

  if (!researchOutput && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t('stockResearch.confirmResearch', { defaultValue: '确认研究结果' })}
          </DialogTitle>
          <DialogDescription>
            {t('stockResearch.selectFieldsToApply', { defaultValue: '选择要应用到文档的字段' })}
          </DialogDescription>
        </DialogHeader>

        {codeApplyWarnings.length > 0 && (
          <div
            role="status"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100 space-y-1"
          >
            {codeApplyWarnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">{t('stockResearch.researching', { defaultValue: '正在获取数据...' })}</p>
          </div>
        ) : (
          <>
            {/* 工具栏 */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="text-xs text-muted-foreground">
                {t('stockResearch.selectedCount', { count: selectedCount, total: totalCount, defaultValue: `已选择 ${selectedCount}/${totalCount} 项` })}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => toggleAll(true)}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {t('stockResearch.selectAll', { defaultValue: '全选' })}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => toggleAll(false)}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  {t('stockResearch.deselectAll', { defaultValue: '取消全选' })}
                </Button>
              </div>
            </div>

            {/* 内容区 */}
            <ScrollArea className="flex-1 -mx-4 px-4" style={{ maxHeight: 'calc(80vh - 200px)' }}>
              <div className="space-y-4 py-2">
                {fieldGroups.map(group => {
                  const Icon = group.icon;
                  const groupSelectedCount = group.fields.filter(f => selectedFields[f.key]).length;
                  const groupAllSelected = groupSelectedCount === group.fields.length;

                  return (
                    <div key={group.key} className="border rounded-lg">
                      {/* 组标题 */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer"
                        onClick={() => toggleGroup(group.key, !groupAllSelected)}
                      >
                        <Checkbox
                          checked={groupAllSelected}
                          className="pointer-events-none"
                        />
                        <Icon className={cn('h-4 w-4', group.iconColor)} />
                        <span className="text-sm font-medium">{group.label}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {groupSelectedCount}/{group.fields.length}
                        </span>
                      </div>

                      {/* 字段列表 */}
                      <div className="divide-y">
                        {group.fields.map(field => (
                          <div
                            key={field.key}
                            className={cn(
                              'flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-muted/20 transition-colors',
                              selectedFields[field.key] && 'bg-primary/5',
                            )}
                            onClick={() => toggleField(field.key)}
                          >
                            <Checkbox
                              checked={selectedFields[field.key]}
                              className="mt-0.5 pointer-events-none"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-muted-foreground">{field.label}</div>
                              {renderFieldValue(field)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {fieldGroups.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t('stockResearch.noDataToApply', { defaultValue: '没有可应用的数据' })}
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                {t('common.cancel', { defaultValue: '取消' })}
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={selectedCount === 0}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                {t('stockResearch.applySelected', { defaultValue: '应用选中' })} ({selectedCount})
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
