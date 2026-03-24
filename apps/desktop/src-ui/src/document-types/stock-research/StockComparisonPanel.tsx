/**
 * StockComparisonPanel — 股票对比面板
 *
 * 功能：
 * - 财务指标横向对比
 * - 估值指标对比
 * - 成长指标对比
 * - 优劣势分析
 * - AI 对比分析按钮
 */

import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Users, TrendingUp, TrendingDown, Sparkles,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import type { StockResearchDocumentContent, FinancialMetrics } from './types';
import { ComparisonRadarChart } from './charts';

interface StockComparisonPanelProps {
  research: StockResearchDocumentContent;
  onAICompare?: () => void;
  onAddPeer?: () => void;
  onDeletePeer?: (peerId: string) => void;
}

// 对比指标组
interface ComparisonMetric {
  key: keyof FinancialMetrics;
  label: string;
  format: 'number' | 'percent' | 'ratio';
  higherIsBetter: boolean;
}

const COMPARISON_METRICS: ComparisonMetric[] = [
  { key: 'pe', label: 'PE', format: 'number', higherIsBetter: false },
  { key: 'pb', label: 'PB', format: 'number', higherIsBetter: false },
  { key: 'roe', label: 'ROE', format: 'percent', higherIsBetter: true },
  { key: 'roa', label: 'ROA', format: 'percent', higherIsBetter: true },
  { key: 'grossMargin', label: '毛利率', format: 'percent', higherIsBetter: true },
  { key: 'netMargin', label: '净利率', format: 'percent', higherIsBetter: true },
  { key: 'revenueGrowth', label: '营收增长', format: 'percent', higherIsBetter: true },
  { key: 'netIncomeGrowth', label: '利润增长', format: 'percent', higherIsBetter: true },
  { key: 'currentRatio', label: '流动比率', format: 'ratio', higherIsBetter: true },
  { key: 'debtToEquity', label: '资产负债率', format: 'percent', higherIsBetter: false },
];

export default function StockComparisonPanel({
  research, onAICompare, onAddPeer,
}: StockComparisonPanelProps) {
  const { t } = useTranslation();
  const { stock, financials, peers } = research;
  const [selectedMetricGroup, setSelectedMetricGroup] = useState<'valuation' | 'profitability' | 'growth' | 'solvency'>('valuation');

  // 主股票指标
  const mainMetrics = financials.current;

  // 指标分组
  const metricGroups: Record<string, ComparisonMetric[]> = {
    valuation: COMPARISON_METRICS.filter(m => ['pe', 'pb'].includes(m.key as string)),
    profitability: COMPARISON_METRICS.filter(m => ['roe', 'roa', 'grossMargin', 'netMargin'].includes(m.key as string)),
    growth: COMPARISON_METRICS.filter(m => ['revenueGrowth', 'netIncomeGrowth'].includes(m.key as string)),
    solvency: COMPARISON_METRICS.filter(m => ['currentRatio', 'debtToEquity'].includes(m.key as string)),
  };

  // 格式化指标值
  const formatMetricValue = (value: number | undefined, format: ComparisonMetric['format']): string => {
    if (value === undefined || value === null) return '-';
    switch (format) {
      case 'percent': return `${value.toFixed(1)}%`;
      case 'ratio': return value.toFixed(2);
      default: return value.toFixed(2);
    }
  };

  // 获取对比评级
  const getComparisonRating = (
    mainValue: number | undefined,
    peerValue: number | undefined,
    higherIsBetter: boolean
  ): 'better' | 'worse' | 'equal' | 'unknown' => {
    if (mainValue === undefined || peerValue === undefined) return 'unknown';
    const diff = mainValue - peerValue;
    if (Math.abs(diff) < 0.01 * Math.abs(peerValue || 1)) return 'equal';
    if (higherIsBetter) {
      return diff > 0 ? 'better' : 'worse';
    } else {
      return diff < 0 ? 'better' : 'worse';
    }
  };

  // 优劣势分析
  const analysis = useMemo(() => {
    if (peers.length === 0) return { advantages: [], disadvantages: [] };

    const advantages: string[] = [];
    const disadvantages: string[] = [];

    // 对每个指标与对标公司平均值对比
    COMPARISON_METRICS.forEach(metric => {
      const mainValue = mainMetrics[metric.key] as number | undefined;
      if (mainValue === undefined) return;

      // 收集对标公司的值
      const peerValues = peers
        .map(p => p.metrics[metric.key] as number | undefined)
        .filter((v): v is number => v !== undefined);

      if (peerValues.length === 0) return;

      const avgPeerValue = peerValues.reduce((a, b) => a + b, 0) / peerValues.length;
      const rating = getComparisonRating(mainValue, avgPeerValue, metric.higherIsBetter);

      if (rating === 'better') {
        advantages.push(`${metric.label}: ${formatMetricValue(mainValue, metric.format)} vs 平均 ${formatMetricValue(avgPeerValue, metric.format)}`);
      } else if (rating === 'worse') {
        disadvantages.push(`${metric.label}: ${formatMetricValue(mainValue, metric.format)} vs 平均 ${formatMetricValue(avgPeerValue, metric.format)}`);
      }
    });

    return { advantages, disadvantages };
  }, [mainMetrics, peers]);

  // 有对标公司时才显示
  if (peers.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('stockResearch.comparison', { defaultValue: '对比分析' })}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
          <Users className="h-8 w-8 mb-2 opacity-30" />
          <div className="text-sm">{t('stockResearch.noPeers', { defaultValue: '暂无对标公司' })}</div>
          <div className="text-xs mt-1">{t('stockResearch.addPeerHint', { defaultValue: '在数据面板中添加对标公司' })}</div>
          {onAddPeer && (
            <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={onAddPeer}>
              {t('stockResearch.addPeer', { defaultValue: '添加对标公司' })}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('stockResearch.comparison', { defaultValue: '对比分析' })}</span>
        </div>
        {onAICompare && (
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={onAICompare}>
            <Sparkles className="h-3 w-3" />
            {t('stockResearch.aiCompare', { defaultValue: 'AI分析' })}
          </Button>
        )}
      </div>

      {/* 指标组选择 */}
      <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto">
        {[
          { key: 'valuation', label: t('stockResearch.valuationMetrics', { defaultValue: '估值' }) },
          { key: 'profitability', label: t('stockResearch.profitabilityMetrics', { defaultValue: '盈利' }) },
          { key: 'growth', label: t('stockResearch.growthMetrics', { defaultValue: '成长' }) },
          { key: 'solvency', label: t('stockResearch.solvencyMetrics', { defaultValue: '偿债' }) },
        ].map(g => (
          <Button
            key={g.key}
            variant={selectedMetricGroup === g.key ? 'default' : 'ghost'}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setSelectedMetricGroup(g.key as any)}
          >
            {g.label}
          </Button>
        ))}
      </div>

      {/* 对比表格 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card border-b">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">指标</th>
              <th className="px-2 py-2 text-right font-medium">{stock.name || stock.code}</th>
              {peers.map(peer => (
                <th key={peer.id} className="px-2 py-2 text-right font-medium">
                  <div className="truncate max-w-[80px]">{peer.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricGroups[selectedMetricGroup].map(metric => {
              const mainValue = mainMetrics[metric.key] as number | undefined;

              return (
                <tr key={metric.key as string} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 text-muted-foreground">{metric.label}</td>
                  <td className="px-2 py-2 text-right font-medium">
                    {formatMetricValue(mainValue, metric.format)}
                  </td>
                  {peers.map(peer => {
                    const peerValue = peer.metrics[metric.key] as number | undefined;
                    const rating = getComparisonRating(mainValue, peerValue, metric.higherIsBetter);

                    return (
                      <td
                        key={peer.id}
                        className={cn(
                          'px-2 py-2 text-right',
                          rating === 'better' && 'text-green-500',
                          rating === 'worse' && 'text-red-500',
                        )}
                      >
                        <span className="flex items-center justify-end gap-0.5">
                          {formatMetricValue(peerValue, metric.format)}
                          {rating === 'better' && <ArrowUpRight className="h-2.5 w-2.5" />}
                          {rating === 'worse' && <ArrowDownRight className="h-2.5 w-2.5" />}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 雷达对比图 */}
      <div className="border-t">
        <ComparisonRadarChart
          mainName={stock.name || stock.code}
          mainMetrics={mainMetrics}
          peers={peers}
          height={220}
        />
      </div>

      {/* 优劣势分析 */}
      <div className="border-t">
        <div className="px-3 py-2">
          <div className="text-xs font-medium mb-2">{t('stockResearch.swotAnalysis', { defaultValue: '优劣势分析' })}</div>

          {/* 优势 */}
          <div className="mb-2">
            <div className="flex items-center gap-1 text-[10px] text-green-500 font-medium mb-1">
              <TrendingUp className="h-3 w-3" />
              {t('stockResearch.advantages', { defaultValue: '优势' })}
            </div>
            <div className="space-y-0.5">
              {analysis.advantages.length > 0 ? analysis.advantages.slice(0, 3).map((a, i) => (
                <div key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                  <span className="text-green-500 mt-0.5">+</span>
                  {a}
                </div>
              )) : (
                <div className="text-[10px] text-muted-foreground">{t('stockResearch.noAdvantages', { defaultValue: '暂无明显优势' })}</div>
              )}
            </div>
          </div>

          {/* 劣势 */}
          <div>
            <div className="flex items-center gap-1 text-[10px] text-red-500 font-medium mb-1">
              <TrendingDown className="h-3 w-3" />
              {t('stockResearch.disadvantages', { defaultValue: '劣势' })}
            </div>
            <div className="space-y-0.5">
              {analysis.disadvantages.length > 0 ? analysis.disadvantages.slice(0, 3).map((d, i) => (
                <div key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                  <span className="text-red-500 mt-0.5">-</span>
                  {d}
                </div>
              )) : (
                <div className="text-[10px] text-muted-foreground">{t('stockResearch.noDisadvantages', { defaultValue: '暂无明显劣势' })}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
