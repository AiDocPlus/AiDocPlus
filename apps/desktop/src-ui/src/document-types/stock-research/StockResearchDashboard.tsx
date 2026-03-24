/**
 * StockResearchDashboard — 研究仪表盘
 *
 * 功能：
 * - 概览卡片（股票信息、阶段、持仓、论点统计）
 * - 快速操作区（一键研究、快速分析、新建笔记）
 * - 近期动态（最新交易、新闻）
 * - 关键指标卡片
 * - AI 洞察卡片
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Target, FileText, Sparkles, Plus,
  Wallet, AlertTriangle, ChevronRight,
  DollarSign, Users,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import type { StockResearchDocumentContent } from './types';
import { RESEARCH_PHASES, RISK_LEVELS, CURRENCY_SYMBOLS } from './constants';
import { getCurrentPosition, calculateAverageCost, calculateTotalProfitLoss, getActiveTheses } from './types';

interface StockResearchDashboardProps {
  research: StockResearchDocumentContent;
  onOneClickResearch?: () => void;
  onAddNote?: () => void;
  onSelectNote?: (noteId: string) => void;
  onQuickAnalysis?: (type: string) => void;
  isResearching?: boolean;
}

export default function StockResearchDashboard({
  research, onOneClickResearch, onAddNote, onSelectNote, onQuickAnalysis, isResearching = false,
}: StockResearchDashboardProps) {
  const { t } = useTranslation();
  const { stock, financials, technicals, theses, trades, news, risk, peers, notes, metadata } = research;

  // 统计数据
  const currentPosition = useMemo(() => getCurrentPosition(research), [research]);
  const avgCost = useMemo(() => calculateAverageCost(research), [research]);
  const totalPnL = useMemo(() => calculateTotalProfitLoss(research), [research]);
  const activeTheses = useMemo(() => getActiveTheses(research), [research]);

  // 论点状态分布
  const thesisStats = useMemo(() => {
    const bullish = theses.filter(t => t.status === 'bullish').length;
    const bearish = theses.filter(t => t.status === 'bearish').length;
    const neutral = theses.filter(t => t.status === 'neutral').length;
    return { bullish, bearish, neutral };
  }, [theses]);

  // 阶段信息
  const phaseInfo = RESEARCH_PHASES.find(p => p.key === metadata.phase) || RESEARCH_PHASES[0];

  // 风险信息
  const riskInfo = risk ? RISK_LEVELS.find(l => l.key === risk.level) || RISK_LEVELS[1] : null;

  // 货币符号
  const currencySymbol = CURRENCY_SYMBOLS[stock.currency] || '¥';

  // 最近交易
  const recentTrades = useMemo(() => {
    return [...trades]
      .sort((a, b) => b.executedAt - a.executedAt)
      .slice(0, 3);
  }, [trades]);

  // 最近新闻
  const recentNews = useMemo(() => {
    return [...news]
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 3);
  }, [news]);

  // 格式化日期
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* ═══ 概览卡片 ═══ */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start gap-4">
            {/* 股票图标 */}
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>

            {/* 股票信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold truncate">{stock.name || t('stockResearch.untitled', { defaultValue: '未命名股票' })}</h2>
                <span className="text-sm text-muted-foreground">{stock.code}</span>
                <span className={cn('px-1.5 py-0.5 rounded text-[10px]', phaseInfo.color, 'bg-muted')}>
                  {phaseInfo.icon} {t(phaseInfo.labelKey)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                {stock.market && <span className="px-1.5 py-0.5 bg-muted rounded">{stock.market}</span>}
                {stock.industry && <span className="px-1.5 py-0.5 bg-muted rounded">{stock.industry}</span>}
                {stock.sector && <span className="px-1.5 py-0.5 bg-muted rounded">{stock.sector}</span>}
              </div>

              {/* 当前价格 */}
              {technicals && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-2xl font-bold">{currencySymbol}{technicals.price.toFixed(2)}</span>
                  <span className={cn(
                    'text-sm flex items-center gap-0.5',
                    technicals.changePercent > 0 ? 'text-green-500' : technicals.changePercent < 0 ? 'text-red-500' : 'text-muted-foreground',
                  )}>
                    {technicals.changePercent > 0 ? <ArrowUpRight className="h-3 w-3" /> :
                     technicals.changePercent < 0 ? <ArrowDownRight className="h-3 w-3" /> :
                     <Minus className="h-3 w-3" />}
                    {technicals.changePercent > 0 ? '+' : ''}{technicals.changePercent.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            {/* 统计数据 */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="px-3 py-2 rounded bg-muted/50">
                <div className="text-lg font-bold">{theses.length}</div>
                <div className="text-[10px] text-muted-foreground">{t('stockResearch.theses')}</div>
              </div>
              <div className="px-3 py-2 rounded bg-muted/50">
                <div className="text-lg font-bold">{trades.length}</div>
                <div className="text-[10px] text-muted-foreground">{t('stockResearch.trades')}</div>
              </div>
            </div>
          </div>

          {/* 持仓信息 */}
          {currentPosition > 0 && (
            <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">{t('stockResearch.currentPosition', { defaultValue: '当前持仓' })}</div>
                <div className="text-base font-bold">{currentPosition.toLocaleString()} {t('stockResearch.shares', { defaultValue: '股' })}</div>
              </div>
              {avgCost && (
                <div>
                  <div className="text-xs text-muted-foreground">{t('stockResearch.avgCost', { defaultValue: '持仓成本' })}</div>
                  <div className="text-base font-bold">{currencySymbol}{avgCost.toFixed(2)}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">{t('stockResearch.totalPnL', { defaultValue: '累计盈亏' })}</div>
                <div className={cn('text-base font-bold', totalPnL >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {totalPnL >= 0 ? '+' : ''}{currencySymbol}{totalPnL.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ 快速操作区 ═══ */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className="h-auto py-3 flex-col gap-1"
            onClick={onOneClickResearch}
            disabled={isResearching}
          >
            <Sparkles className={cn('h-4 w-4', isResearching && 'animate-pulse')} />
            <span className="text-xs">{t('stockResearch.oneClickResearch', { defaultValue: '一键研究' })}</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex-col gap-1"
            onClick={onAddNote}
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs">{t('stockResearch.addNote', { defaultValue: '新建笔记' })}</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex-col gap-1"
            onClick={() => onQuickAnalysis?.('summary')}
          >
            <FileText className="h-4 w-4" />
            <span className="text-xs">{t('stockResearch.quickSummary', { defaultValue: '快速摘要' })}</span>
          </Button>
        </div>

        {/* ═══ 近期动态 ═══ */}
        <div className="grid grid-cols-2 gap-4">
          {/* 最近交易 */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                {t('stockResearch.recentTrades', { defaultValue: '最近交易' })}
              </div>
              <span className="text-xs text-muted-foreground">{trades.length}</span>
            </div>
            <div className="p-2 space-y-1">
              {recentTrades.length > 0 ? recentTrades.map(trade => (
                <div key={trade.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/30 text-xs">
                  <span>{trade.direction === 'buy' ? '⬆️' : trade.direction === 'sell' ? '⬇️' : '💰'}</span>
                  <span className="flex-1">{formatDate(trade.executedAt)}</span>
                  <span className="font-mono">{trade.quantity}股</span>
                  <span className={cn(
                    'font-medium',
                    trade.direction === 'buy' && 'text-green-500',
                    trade.direction === 'sell' && 'text-red-500',
                  )}>
                    {currencySymbol}{trade.amount.toFixed(2)}
                  </span>
                </div>
              )) : (
                <div className="text-center text-xs text-muted-foreground py-4">
                  {t('stockResearch.noTrades', { defaultValue: '暂无交易记录' })}
                </div>
              )}
            </div>
          </div>

          {/* 最近新闻 */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {t('stockResearch.recentNews', { defaultValue: '最近新闻' })}
              </div>
              <span className="text-xs text-muted-foreground">{news.length}</span>
            </div>
            <div className="p-2 space-y-1">
              {recentNews.length > 0 ? recentNews.map(n => (
                <div key={n.id} className="px-2 py-1.5 rounded bg-muted/30">
                  <div className="flex items-start gap-1.5">
                    <span className="text-[10px] mt-0.5">
                      {n.sentiment === 'positive' ? '🟢' : n.sentiment === 'negative' ? '🔴' : '⚪'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate">{n.title}</div>
                      <div className="text-[10px] text-muted-foreground">{formatDate(n.publishedAt)}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center text-xs text-muted-foreground py-4">
                  {t('stockResearch.noNews', { defaultValue: '暂无新闻' })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ 关键指标卡片 ═══ */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b text-sm font-medium">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            {t('stockResearch.keyMetrics', { defaultValue: '关键指标' })}
          </div>
          <div className="grid grid-cols-4 gap-2 p-3">
            {/* 估值指标 */}
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">PE</div>
              <div className="text-base font-bold">{financials?.current?.pe?.toFixed(1) ?? '-'}</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">PB</div>
              <div className="text-base font-bold">{financials?.current?.pb?.toFixed(1) ?? '-'}</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">ROE</div>
              <div className="text-base font-bold">
                {financials?.current?.roe != null ? `${financials.current.roe.toFixed(1)}%` : '-'}
              </div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">{t('stockResearch.dividendYield', { defaultValue: '股息率' })}</div>
              <div className="text-base font-bold">
                {financials?.current?.dividendYield != null ? `${financials.current.dividendYield.toFixed(1)}%` : '-'}
              </div>
            </div>

            {/* 成长指标 */}
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">{t('stockResearch.revenueGrowth', { defaultValue: '营收增长' })}</div>
              <div className={cn(
                'text-base font-bold',
                (financials?.current?.revenueGrowth ?? 0) > 0 ? 'text-green-500' :
                (financials?.current?.revenueGrowth ?? 0) < 0 ? 'text-red-500' : '',
              )}>
                {financials?.current?.revenueGrowth != null ? `${financials.current.revenueGrowth.toFixed(1)}%` : '-'}
              </div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">{t('stockResearch.netIncomeGrowth', { defaultValue: '利润增长' })}</div>
              <div className={cn(
                'text-base font-bold',
                (financials?.current?.netIncomeGrowth ?? 0) > 0 ? 'text-green-500' :
                (financials?.current?.netIncomeGrowth ?? 0) < 0 ? 'text-red-500' : '',
              )}>
                {financials?.current?.netIncomeGrowth != null ? `${financials.current.netIncomeGrowth.toFixed(1)}%` : '-'}
              </div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">{t('stockResearch.grossMargin', { defaultValue: '毛利率' })}</div>
              <div className="text-base font-bold">
                {financials?.current?.grossMargin != null ? `${financials.current.grossMargin.toFixed(1)}%` : '-'}
              </div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="text-[10px] text-muted-foreground mb-0.5">{t('stockResearch.netMargin', { defaultValue: '净利率' })}</div>
              <div className="text-base font-bold">
                {financials?.current?.netMargin != null ? `${financials.current.netMargin.toFixed(1)}%` : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 投资论点统计 ═══ */}
        {theses.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Target className="h-4 w-4 text-muted-foreground" />
                {t('stockResearch.investmentTheses', { defaultValue: '投资论点' })}
              </div>
              <span className="text-xs text-muted-foreground">{activeTheses.length} {t('stockResearch.active', { defaultValue: '活跃' })}</span>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
                  {thesisStats.bullish > 0 && (
                    <div className="bg-green-500" style={{ width: `${(thesisStats.bullish / theses.length) * 100}%` }} />
                  )}
                  {thesisStats.neutral > 0 && (
                    <div className="bg-gray-400" style={{ width: `${(thesisStats.neutral / theses.length) * 100}%` }} />
                  )}
                  {thesisStats.bearish > 0 && (
                    <div className="bg-red-500" style={{ width: `${(thesisStats.bearish / theses.length) * 100}%` }} />
                  )}
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {t('stockResearch.bullish', { defaultValue: '看多' })} {thesisStats.bullish}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  {t('stockResearch.neutral', { defaultValue: '中性' })} {thesisStats.neutral}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {t('stockResearch.bearish', { defaultValue: '看空' })} {thesisStats.bearish}
                </span>
              </div>

              {/* 最新论点 */}
              {activeTheses[0] && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-1">{t('stockResearch.latestThesis', { defaultValue: '最新论点' })}</div>
                  <div className="flex items-start gap-2">
                    <span>{activeTheses[0].status === 'bullish' ? '📈' : activeTheses[0].status === 'bearish' ? '📉' : '➖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{activeTheses[0].title}</div>
                      {activeTheses[0].targetPrice && (
                        <div className="text-xs text-muted-foreground">
                          {t('stockResearch.targetPrice')}: {currencySymbol}{activeTheses[0].targetPrice}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ 风险评估 ═══ */}
        {risk && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                {t('stockResearch.riskAssessment', { defaultValue: '风险评估' })}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{riskInfo?.icon}</span>
                <span className={cn('text-xs font-medium', riskInfo?.color)}>{riskInfo && t(riskInfo.labelKey)}</span>
              </div>
            </div>
            <div className="p-3">
              {risk.score !== undefined && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        risk.score <= 25 ? 'bg-green-500' :
                        risk.score <= 50 ? 'bg-yellow-500' :
                        risk.score <= 75 ? 'bg-orange-500' : 'bg-red-500',
                      )}
                      style={{ width: `${risk.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono">{risk.score}/100</span>
                </div>
              )}
              {risk.factors.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {risk.factors.slice(0, 3).map((factor, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px]">
                      {factor}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ 对标公司 ═══ */}
        {peers.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground" />
                {t('stockResearch.peerComparison', { defaultValue: '对标公司' })}
              </div>
              <span className="text-xs text-muted-foreground">{peers.length}</span>
            </div>
            <div className="p-2 flex flex-wrap gap-1">
              {peers.map(peer => (
                <span key={peer.id} className="px-2 py-1 rounded bg-muted text-xs">
                  {peer.name} ({peer.code})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 研究笔记 ═══ */}
        {notes.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {t('stockResearch.researchNotes', { defaultValue: '研究笔记' })}
              </div>
              <span className="text-xs text-muted-foreground">{notes.length}</span>
            </div>
            <div className="divide-y">
              {notes.slice(0, 3).map(note => (
                <div
                  key={note.id}
                  className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-muted/30"
                  onClick={() => onSelectNote?.(note.id)}
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{note.title}</div>
                    <div className="text-[10px] text-muted-foreground">{formatDate(note.updatedAt)}</div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 底部空白 */}
        <div className="h-4" />
      </div>
    </div>
  );
}
