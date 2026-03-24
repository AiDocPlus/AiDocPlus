/**
 * ComparisonRadarChart — 对标公司雷达对比图
 *
 * 基于 recharts RadarChart 实现：
 * - 多公司指标雷达对比
 * - 自动归一化指标到 0-100 分
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { FinancialMetrics, PeerComparison } from '../types';

interface ComparisonRadarChartProps {
  mainName: string;
  mainMetrics: FinancialMetrics;
  peers: PeerComparison[];
  height?: number;
  className?: string;
}

const RADAR_METRICS: { key: keyof FinancialMetrics; label: string; higherIsBetter: boolean }[] = [
  { key: 'roe', label: 'ROE', higherIsBetter: true },
  { key: 'grossMargin', label: '毛利率', higherIsBetter: true },
  { key: 'netMargin', label: '净利率', higherIsBetter: true },
  { key: 'revenueGrowth', label: '营收增长', higherIsBetter: true },
  { key: 'netIncomeGrowth', label: '利润增长', higherIsBetter: true },
  { key: 'currentRatio', label: '流动比率', higherIsBetter: true },
];

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7'];

function normalize(value: number | undefined, min: number, max: number): number {
  if (value === undefined || value === null) return 0;
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export default function ComparisonRadarChart({
  mainName, mainMetrics, peers, height = 260, className,
}: ComparisonRadarChartProps) {
  const radarData = useMemo(() => {
    const allMetrics = [mainMetrics, ...peers.map(p => p.metrics)];

    return RADAR_METRICS.map(rm => {
      const values = allMetrics.map(m => (m as Record<string, unknown>)[rm.key] as number | undefined).filter(v => v !== undefined && v !== null) as number[];
      const min = values.length > 0 ? Math.min(...values) : 0;
      const max = values.length > 0 ? Math.max(...values) : 100;

      const entry: Record<string, string | number> = { metric: rm.label };
      entry[mainName] = normalize(mainMetrics[rm.key] as number | undefined, min, max);
      peers.forEach(p => {
        entry[p.name] = normalize(p.metrics[rm.key] as number | undefined, min, max);
      });
      return entry;
    });
  }, [mainName, mainMetrics, peers]);

  if (peers.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-xs text-muted-foreground', className)} style={{ height }}>
        添加对标公司后显示雷达对比图
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
    <div className={cn('', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} />
          <PolarRadiusAxis tick={{ fontSize: 9 }} domain={[0, 100]} tickCount={5} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Radar
            name={mainName}
            dataKey={mainName}
            stroke={COLORS[0]}
            fill={COLORS[0]}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          {peers.slice(0, 4).map((p, i) => (
            <Radar
              key={p.id}
              name={p.name}
              dataKey={p.name}
              stroke={COLORS[(i + 1) % COLORS.length]}
              fill={COLORS[(i + 1) % COLORS.length]}
              fillOpacity={0.1}
              strokeWidth={1.5}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
