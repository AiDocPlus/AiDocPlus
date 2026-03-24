/**
 * StockPriceChart — K线图组件
 *
 * 基于 lightweight-charts (TradingView 开源) 实现：
 * - 蜡烛图 + 成交量柱状图
 * - MA5/MA10/MA20/MA60 均线
 * - 支撑/阻力位标注
 * - 深色/浅色主题自动适配
 * - 响应容器宽度变化
 */

import { useRef, useEffect, useMemo, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, type IChartApi, type ISeriesApi, type CandlestickData, type HistogramData, type LineData, type Time, ColorType } from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DailyQuote } from '../types';

interface StockPriceChartProps {
  data: DailyQuote[];
  support?: number;
  resistance?: number;
  height?: number;
  className?: string;
}

type PeriodKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: '1M', label: '1月', days: 22 },
  { key: '3M', label: '3月', days: 66 },
  { key: '6M', label: '6月', days: 132 },
  { key: '1Y', label: '1年', days: 252 },
  { key: 'ALL', label: '全部', days: 0 },
];

const MA_CONFIGS = [
  { period: 5, color: '#f59e0b', label: 'MA5' },
  { period: 10, color: '#3b82f6', label: 'MA10' },
  { period: 20, color: '#a855f7', label: 'MA20' },
  { period: 60, color: '#22c55e', label: 'MA60' },
];

function calcMA(data: DailyQuote[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].date as Time,
      value: sum / period,
    });
  }
  return result;
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

export default function StockPriceChart({
  data, support, resistance, height = 320, className,
}: StockPriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maSeriesRefs = useRef<ISeriesApi<'Line'>[]>([]);
  const [activePeriod, setActivePeriod] = useState<PeriodKey>('3M');
  const [showMA, setShowMA] = useState(true);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const periodOpt = PERIOD_OPTIONS.find(p => p.key === activePeriod);
    if (!periodOpt || periodOpt.days === 0) return sorted;
    return sorted.slice(-periodOpt.days);
  }, [data, activePeriod]);

  const candleData = useMemo((): CandlestickData<Time>[] => {
    return filteredData.map(d => ({
      time: d.date as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
  }, [filteredData]);

  const volumeData = useMemo((): HistogramData<Time>[] => {
    return filteredData.map(d => ({
      time: d.date as Time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)',
    }));
  }, [filteredData]);

  const maData = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return MA_CONFIGS.map(cfg => ({
      ...cfg,
      data: calcMA(sorted, cfg.period),
    }));
  }, [data]);

  // 创建和更新图表
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const dark = isDarkTheme();
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: dark ? '#09090b' : '#ffffff' },
        textColor: dark ? '#a1a1aa' : '#71717a',
        fontFamily: "'宋体', 'SimSun', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: dark ? '#27272a' : '#f4f4f5' },
        horzLines: { color: dark ? '#27272a' : '#f4f4f5' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: dark ? '#3f3f46' : '#e4e4e7' },
      timeScale: {
        borderColor: dark ? '#3f3f46' : '#e4e4e7',
        timeVisible: false,
      },
    });
    chartRef.current = chart;

    // K线
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderUpColor: '#ef4444',
      borderDownColor: '#22c55e',
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });
    candleSeriesRef.current = candleSeries;

    // 成交量
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // 均线
    const maSeries: ISeriesApi<'Line'>[] = [];
    for (const cfg of MA_CONFIGS) {
      const s = chart.addSeries(LineSeries, {
        color: cfg.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      maSeries.push(s);
    }
    maSeriesRefs.current = maSeries;

    // ResizeObserver
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [height]);

  // 更新数据
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // 均线
    maSeriesRefs.current.forEach((s, i) => {
      const periodOpt = PERIOD_OPTIONS.find(p => p.key === activePeriod);
      const days = periodOpt?.days || 0;
      const relevantMAData = days > 0
        ? maData[i].data.slice(-days)
        : maData[i].data;
      if (showMA) {
        s.setData(relevantMAData);
        s.applyOptions({ visible: true });
      } else {
        s.applyOptions({ visible: false });
      }
    });

    // 支撑/阻力位价格线
    if (support) {
      candleSeriesRef.current.createPriceLine({
        price: support,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '支撑',
      });
    }
    if (resistance) {
      candleSeriesRef.current.createPriceLine({
        price: resistance,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '阻力',
      });
    }

    chartRef.current?.timeScale().fitContent();
  }, [candleData, volumeData, maData, showMA, activePeriod, support, resistance]);

  // 主题变化监听
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (!chartRef.current) return;
      const dark = isDarkTheme();
      chartRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: dark ? '#09090b' : '#ffffff' },
          textColor: dark ? '#a1a1aa' : '#71717a',
        },
        grid: {
          vertLines: { color: dark ? '#27272a' : '#f4f4f5' },
          horzLines: { color: dark ? '#27272a' : '#f4f4f5' },
        },
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-xs text-muted-foreground', className)} style={{ height }}>
        暂无行情数据，请通过 AI 助手或 Tushare 获取
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* 工具栏 */}
      <div className="flex items-center gap-1 px-2 py-1 border-b">
        {PERIOD_OPTIONS.map(p => (
          <Button
            key={p.key}
            variant={activePeriod === p.key ? 'default' : 'ghost'}
            size="sm"
            className="h-5 text-[10px] px-1.5"
            onClick={() => setActivePeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex-1" />
        <Button
          variant={showMA ? 'secondary' : 'ghost'}
          size="sm"
          className="h-5 text-[10px] px-1.5"
          onClick={() => setShowMA(!showMA)}
        >
          均线
        </Button>
        {/* 均线图例 */}
        {showMA && (
          <div className="flex items-center gap-1.5 ml-1">
            {MA_CONFIGS.map(cfg => (
              <span key={cfg.period} className="flex items-center gap-0.5 text-[9px]" style={{ color: cfg.color }}>
                <span className="inline-block w-2 h-[2px] rounded" style={{ backgroundColor: cfg.color }} />
                {cfg.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 图表容器 */}
      <div ref={chartContainerRef} style={{ height }} />
    </div>
  );
}
