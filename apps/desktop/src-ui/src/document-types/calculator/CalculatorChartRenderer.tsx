/**
 * CalculatorChartRenderer — 行内图表渲染组件
 * 基于 recharts 将 ChartResultData 渲染为可交互图表
 */
import { useState, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2 } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ChartResultData } from './types';

// 配色方案（亮色/暗色均兼容）
const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#a855f7', '#e11d48', '#0ea5e9', '#84cc16', '#d946ef',
];

/** 将 labels + datasets 转换为 recharts 数据格式 */
function transformChartData(data: ChartResultData): Record<string, unknown>[] {
  return data.labels.map((label, i) => {
    const point: Record<string, unknown> = { name: label };
    for (const ds of data.datasets) {
      point[ds.name] = ds.data[i] ?? 0;
    }
    return point;
  });
}

interface ChartRendererProps {
  data: ChartResultData;
  /** 内联模式下的高度 */
  height?: number;
  /** 是否为 Dialog 展开模式 */
  expanded?: boolean;
}

const ChartRendererInner = memo(function ChartRendererInner({
  data,
  height = 180,
}: ChartRendererProps) {
  const chartData = transformChartData(data);
  const commonAxisProps = {
    tick: { fontSize: 11 },
  };

  switch (data.chartType) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--popover)',
                color: 'var(--popover-foreground)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {data.datasets.map((ds, i) => (
              <Line
                key={ds.name}
                type="monotone"
                dataKey={ds.name}
                stroke={ds.color || CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--popover)',
                color: 'var(--popover-foreground)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {data.datasets.map((ds, i) => (
              <Bar
                key={ds.name}
                dataKey={ds.name}
                fill={ds.color || CHART_COLORS[i % CHART_COLORS.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data.labels.map((label, i) => ({
                name: label,
                value: data.datasets[0]?.data[i] ?? 0,
              }))}
              cx="50%"
              cy="50%"
              outerRadius={height * 0.38}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={true}
              fontSize={11}
            >
              {data.labels.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--popover)',
                color: 'var(--popover-foreground)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" name="X" {...commonAxisProps} />
            <YAxis dataKey={data.datasets[0]?.name || 'Y'} name="Y" {...commonAxisProps} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--popover)',
                color: 'var(--popover-foreground)',
              }}
            />
            <Scatter
              name={data.datasets[0]?.name || 'Data'}
              data={chartData}
              fill={data.datasets[0]?.color || CHART_COLORS[0]}
            />
          </ScatterChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border)',
                backgroundColor: 'var(--popover)',
                color: 'var(--popover-foreground)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {data.datasets.map((ds, i) => (
              <Area
                key={ds.name}
                type="monotone"
                dataKey={ds.name}
                stroke={ds.color || CHART_COLORS[i % CHART_COLORS.length]}
                fill={ds.color || CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );

    default:
      return null;
  }
});

interface CalculatorChartRendererProps {
  data: ChartResultData;
  /** 内联高度 */
  inlineHeight?: number;
}

export function CalculatorChartRenderer({
  data,
  inlineHeight = 180,
}: CalculatorChartRendererProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const title = data.title || `${data.chartType} chart`;

  return (
    <>
      <div
        className="relative group rounded-md border border-border/40 bg-background overflow-hidden"
        style={{ height: inlineHeight }}
      >
        <ChartRendererInner data={data} height={inlineHeight} />
        {/* 展开按钮 */}
        <button
          type="button"
          onClick={toggleExpand}
          className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 border border-border/50 hover:bg-muted"
          title={t('calculator.chartExpand', { defaultValue: '展开图表' })}
        >
          <Maximize2 className="h-3 w-3" />
        </button>
        {title && (
          <div className="absolute top-1.5 left-2 text-[10px] text-muted-foreground/60 font-medium">
            {title}
          </div>
        )}
      </div>

      {/* 展开大图 Dialog */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Minimize2 className="h-4 w-4" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <ChartRendererInner data={data} height={400} expanded />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CalculatorChartRenderer;
