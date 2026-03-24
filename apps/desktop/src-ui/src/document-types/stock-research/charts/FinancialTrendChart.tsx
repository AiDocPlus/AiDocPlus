/**
 * FinancialTrendChart — 财务趋势图
 *
 * 基于 recharts 实现：
 * - 营收/净利润柱状图 + 增长率折线图
 * - ROE/毛利率/净利率趋势线
 * - 深色/浅色主题适配
 */

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FinancialHistory, FinancialMetrics } from '../types';

interface FinancialTrendChartProps {
  history: FinancialHistory[];
  current?: FinancialMetrics;
  height?: number;
  className?: string;
}

type ViewMode = 'revenue' | 'profitability' | 'valuation';

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: 'revenue', label: '营收利润' },
  { key: 'profitability', label: '盈利能力' },
  { key: 'valuation', label: '估值指标' },
];

export default function FinancialTrendChart({
  history, current: _current, height = 240, className,
}: FinancialTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('revenue');

  // 按年份排序的历史数据
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return (a.quarter || 0) - (b.quarter || 0);
    });
  }, [history]);

  // 营收利润图数据
  const revenueData = useMemo(() => {
    return sortedHistory.map(h => ({
      name: h.quarter ? `${h.year}Q${h.quarter}` : `${h.year}`,
      revenue: h.metrics.revenue ?? null,
      netIncome: h.metrics.netIncome ?? null,
      revenueGrowth: h.metrics.revenueGrowth ?? null,
      netIncomeGrowth: h.metrics.netIncomeGrowth ?? null,
    }));
  }, [sortedHistory]);

  // 盈利能力图数据
  const profitabilityData = useMemo(() => {
    return sortedHistory.map(h => ({
      name: h.quarter ? `${h.year}Q${h.quarter}` : `${h.year}`,
      roe: h.metrics.roe ?? null,
      grossMargin: h.metrics.grossMargin ?? null,
      netMargin: h.metrics.netMargin ?? null,
    }));
  }, [sortedHistory]);

  // 估值指标图数据
  const valuationData = useMemo(() => {
    return sortedHistory.map(h => ({
      name: h.quarter ? `${h.year}Q${h.quarter}` : `${h.year}`,
      pe: h.metrics.pe ?? null,
      pb: h.metrics.pb ?? null,
      eps: h.metrics.eps ?? null,
    }));
  }, [sortedHistory]);

  if (history.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-xs text-muted-foreground', className)} style={{ height }}>
        暂无历史财务数据
      </div>
    );
  }

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      fontSize: '11px',
      fontFamily: "'宋体', 'SimSun', sans-serif",
    },
  };

  return (
    <div className={cn('', className)}>
      {/* 视图切换 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b">
        {VIEW_OPTIONS.map(v => (
          <Button
            key={v.key}
            variant={viewMode === v.key ? 'default' : 'ghost'}
            size="sm"
            className="h-5 text-[10px] px-1.5"
            onClick={() => setViewMode(v.key)}
          >
            {v.label}
          </Button>
        ))}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'revenue' ? (
            <ComposedChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" unit="%" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar yAxisId="left" dataKey="revenue" name="营收(亿)" fill="#3b82f6" opacity={0.7} radius={[2, 2, 0, 0]} />
              <Bar yAxisId="left" dataKey="netIncome" name="净利润(亿)" fill="#22c55e" opacity={0.7} radius={[2, 2, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="revenueGrowth" name="营收增长%" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
              <Line yAxisId="right" type="monotone" dataKey="netIncomeGrowth" name="利润增长%" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          ) : viewMode === 'profitability' ? (
            <ComposedChart data={profitabilityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" unit="%" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="roe" name="ROE%" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="grossMargin" name="毛利率%" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="netMargin" name="净利率%" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          ) : (
            <ComposedChart data={valuationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line yAxisId="left" type="monotone" dataKey="pe" name="PE" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" type="monotone" dataKey="pb" name="PB" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
              <Bar yAxisId="right" dataKey="eps" name="EPS" fill="#22c55e" opacity={0.6} radius={[2, 2, 0, 0]} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
