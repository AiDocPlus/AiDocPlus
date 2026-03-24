/**
 * StockResearchStatusBar — 股票研究状态栏
 *
 * 显示：
 * - 阶段 + 阶段图标
 * - 论点数 / 交易数 / 笔记数
 * - 持仓状态（持仓量 / 成本 / 盈亏）
 * - 保存状态
 * - 最后更新时间
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Target, FileText, BarChart3,
  Check, Loader2, Circle,
} from 'lucide-react';
import {
  type StockResearchDocumentContent,
} from './types';
import { RESEARCH_PHASES } from './constants';

interface StockResearchStatusBarProps {
  research: StockResearchDocumentContent;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  currentPosition: number;
  avgCost: number | null;
  totalPnL: number | null;
}

export default function StockResearchStatusBar({
  research, saveStatus, currentPosition, avgCost, totalPnL,
}: StockResearchStatusBarProps) {
  const { t } = useTranslation();
  const { stock, theses, trades, notes, metadata } = research;

  const phaseInfo = RESEARCH_PHASES.find(p => p.key === metadata.phase) || RESEARCH_PHASES[0];

  // 盈亏颜色
  const pnlColor = useMemo(() => {
    if (totalPnL === null) return 'text-muted-foreground';
    if (totalPnL > 0) return 'text-green-600';
    if (totalPnL < 0) return 'text-red-600';
    return 'text-muted-foreground';
  }, [totalPnL]);

  // 格式化盈亏
  const formatPnL = (value: number | null) => {
    if (value === null) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex items-center gap-3 px-3 py-1 border-t bg-card text-[11px] text-muted-foreground">
      {/* 阶段 */}
      <div className={cn('flex items-center gap-0.5', phaseInfo.color)}>
        <span>{phaseInfo.icon}</span>
        <span>{t(phaseInfo.labelKey)}</span>
      </div>

      <div className="w-px h-3 bg-border" />

      {/* 股票代码 */}
      {stock.code && (
        <>
          <span className="font-medium text-foreground">{stock.code}</span>
          <div className="w-px h-3 bg-border" />
        </>
      )}

      {/* 统计 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5" title={t('stockResearch.thesisCount')}>
          <Target className="h-3 w-3 text-amber-500" />
          <span>{theses.length}</span>
        </div>
        <div className="flex items-center gap-0.5" title={t('stockResearch.tradeCount')}>
          <BarChart3 className="h-3 w-3 text-blue-500" />
          <span>{trades.length}</span>
        </div>
        <div className="flex items-center gap-0.5" title={t('stockResearch.noteCount')}>
          <FileText className="h-3 w-3 text-green-500" />
          <span>{notes.length}</span>
        </div>
      </div>

      <div className="w-px h-3 bg-border" />

      {/* 持仓状态 */}
      {currentPosition > 0 && (
        <>
          <div className="flex items-center gap-1">
            <span>{t('stockResearch.position')}:</span>
            <span className="font-medium text-foreground">{currentPosition}</span>
            {avgCost && (
              <span className="text-muted-foreground">(@ {avgCost.toFixed(2)})</span>
            )}
          </div>
          {totalPnL !== null && (
            <div className={cn('flex items-center gap-0.5 font-medium', pnlColor)}>
              {totalPnL >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{formatPnL(totalPnL)}</span>
            </div>
          )}
          <div className="w-px h-3 bg-border" />
        </>
      )}

      {/* 弹性空间 */}
      <div className="flex-1" />

      {/* 保存状态 */}
      <div className="flex items-center gap-0.5">
        {saveStatus === 'saved' && (
          <>
            <Check className="h-3 w-3 text-green-500" />
            <span>{t('editor.saved')}</span>
          </>
        )}
        {saveStatus === 'saving' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{t('editor.saving')}</span>
          </>
        )}
        {saveStatus === 'unsaved' && (
          <>
            <Circle className="h-3 w-3 text-amber-500" />
            <span>{t('editor.unsaved')}</span>
          </>
        )}
      </div>

      {/* 最后更新 */}
      {metadata.updatedAt > 0 && (
        <>
          <div className="w-px h-3 bg-border" />
          <span>{formatTime(metadata.updatedAt)}</span>
        </>
      )}
    </div>
  );
}
