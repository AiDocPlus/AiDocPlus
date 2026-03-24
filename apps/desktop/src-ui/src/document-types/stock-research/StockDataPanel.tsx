/**
 * StockDataPanel — 数据面板（财务/技术/交易/新闻/对标）
 */

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DollarSign, LineChart, Target, FileText, AlertTriangle,
  Plus, Check, X, Users,
} from 'lucide-react';
import {
  type StockResearchDocumentContent, type FinancialMetrics, type TechnicalIndicators,
  type TradeRecord, type StockNews, type RiskAssessment,
  type PeerComparison, type FinancialHistory,
} from './types';
import { StockPriceChart } from './charts';
import { FinancialTrendChart } from './charts';
import { RISK_LEVELS } from './constants';

// ═══════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════

interface StockDataPanelProps {
  research: StockResearchDocumentContent;
  onUpdateFinancials: (metrics: Partial< FinancialMetrics>) => void;
  onUpdateTechnicals: (technicals: TechnicalIndicators | null) => void;
  onUpdateRisk: (risk: RiskAssessment | null) => void;
  onAddTrade: (trade: Omit<TradeRecord, 'id' | 'createdAt'>) => void;
  onDeleteTrade: (tradeId: string) => void;
  onAddNews: (news: Omit<StockNews, 'id'>) => void;
  onDeleteNews: (newsId: string) => void;
  onAddPeer: (peer: Omit<PeerComparison, 'id'>) => void;
  onDeletePeer: (peerId: string) => void;
}

// ═══════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════

export default function StockDataPanel({
  research, onUpdateFinancials, onUpdateTechnicals, onUpdateRisk,
  onAddTrade, onDeleteTrade,
  onAddNews, onDeleteNews,
  onAddPeer, onDeletePeer,
}: StockDataPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'financials' | 'technicals' | 'trades' | 'news' | 'risk' | 'peers'>('financials');

  const tabs: { key: typeof activeTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'financials', labelKey: 'stockResearch.tabFinancials', icon: DollarSign },
    { key: 'technicals', labelKey: 'stockResearch.tabTechnicals', icon: LineChart },
    { key: 'trades', labelKey: 'stockResearch.tabTrades', icon: Target },
    { key: 'news', labelKey: 'stockResearch.tabNews', icon: FileText },
    { key: 'risk', labelKey: 'stockResearch.tabRisk', icon: AlertTriangle },
    { key: 'peers', labelKey: 'stockResearch.tabPeers', icon: Users },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 标签栏 */}
      <div className="flex items-center border-b flex-shrink-0 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 text-[11px] border-b-2 transition-colors flex-shrink-0',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-3 w-3" />
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'financials' && (
          <FinancialsTab
            financials={research.financials}
            onUpdate={onUpdateFinancials}
          />
        )}
        {activeTab === 'technicals' && (
          <TechnicalsTab
            technicals={research.technicals}
            onUpdate={onUpdateTechnicals}
          />
        )}
        {activeTab === 'trades' && (
          <TradesTab
            trades={research.trades}
            onAdd={onAddTrade}
            onDelete={onDeleteTrade}
            currency={research.stock.currency}
          />
        )}
        {activeTab === 'news' && (
          <NewsTab
            news={research.news}
            onAdd={onAddNews}
            onDelete={onDeleteNews}
          />
        )}
        {activeTab === 'risk' && (
          <RiskTab
            risk={research.risk}
            onUpdate={onUpdateRisk}
          />
        )}
        {activeTab === 'peers' && (
          <PeersTab
            peers={research.peers}
            onAdd={onAddPeer}
            onDelete={onDeletePeer}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 财务指标 Tab
// ═══════════════════════════════════════════════════════

function FinancialsTab({
  financials,
  onUpdate,
}: {
  financials: { current: FinancialMetrics; history: FinancialHistory[] };
  onUpdate: (metrics: Partial<FinancialMetrics>) => void;
}) {
  const { t } = useTranslation();
  const { current, history } = financials;

  const metricGroups: { labelKey: string; metrics: { key: keyof FinancialMetrics; labelKey: string; unit?: string }[] }[] = [
    {
      labelKey: 'stockResearch.valuationMetrics',
      metrics: [
        { key: 'pe', labelKey: 'stockResearch.pe', unit: '' },
        { key: 'pb', labelKey: 'stockResearch.pb', unit: '' },
        { key: 'ps', labelKey: 'stockResearch.ps', unit: '' },
      ],
    },
    {
      labelKey: 'stockResearch.profitabilityMetrics',
      metrics: [
        { key: 'roe', labelKey: 'stockResearch.roe', unit: '%' },
        { key: 'roa', labelKey: 'stockResearch.roa', unit: '%' },
        { key: 'grossMargin', labelKey: 'stockResearch.grossMargin', unit: '%' },
        { key: 'netMargin', labelKey: 'stockResearch.netMargin', unit: '%' },
      ],
    },
    {
      labelKey: 'stockResearch.growthMetrics',
      metrics: [
        { key: 'revenue', labelKey: 'stockResearch.revenue', unit: '亿' },
        { key: 'revenueGrowth', labelKey: 'stockResearch.revenueGrowth', unit: '%' },
        { key: 'netIncome', labelKey: 'stockResearch.netIncome', unit: '亿' },
        { key: 'netIncomeGrowth', labelKey: 'stockResearch.profitGrowth', unit: '%' },
      ],
    },
    {
      labelKey: 'stockResearch.cashflowMetrics',
      metrics: [
        { key: 'operatingCashFlow', labelKey: 'stockResearch.operatingCashFlow', unit: '亿' },
        { key: 'freeCashFlow', labelKey: 'stockResearch.freeCashFlow', unit: '亿' },
      ],
    },
    {
      labelKey: 'stockResearch.solvencyMetrics',
      metrics: [
        { key: 'currentRatio', labelKey: 'stockResearch.currentRatio', unit: '' },
        { key: 'quickRatio', labelKey: 'stockResearch.quickRatio', unit: '' },
        { key: 'debtToEquity', labelKey: 'stockResearch.debtToEquity', unit: '%' },
      ],
    },
    {
      labelKey: 'stockResearch.perShareMetrics',
      metrics: [
        { key: 'eps', labelKey: 'stockResearch.eps', unit: '' },
        { key: 'bookValuePerShare', labelKey: 'stockResearch.bps', unit: '' },
        { key: 'dividendYield', labelKey: 'stockResearch.dividendYield', unit: '%' },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      {/* 财务趋势图 */}
      {history.length > 0 && (
        <FinancialTrendChart history={history} current={current} height={200} />
      )}

      <div className="p-2 space-y-3">
        {metricGroups.map(group => (
          <div key={group.labelKey}>
            <div className="text-[10px] text-muted-foreground font-medium mb-1">{t(group.labelKey)}</div>
            <div className="grid grid-cols-2 gap-1">
              {group.metrics.map(m => (
                <MetricInput
                  key={m.key}
                  label={t(m.labelKey)}
                  value={current[m.key]}
                  unit={m.unit}
                  onChange={(v) => onUpdate({ [m.key]: v })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricInput({
  label, value, unit, onChange,
}: {
  label: string;
  value: number | undefined;
  unit?: string;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground w-10 truncate">{label}</span>
      <input
        type="number"
        title={label}
        className="flex-1 text-xs px-1 py-0.5 border rounded bg-background outline-none focus:border-primary min-w-0"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        step="0.01"
      />
      {unit && <span className="text-[10px] text-muted-foreground w-3">{unit}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 技术指标 Tab
// ═══════════════════════════════════════════════════════

function TechnicalsTab({
  technicals,
  onUpdate,
}: {
  technicals: TechnicalIndicators | null;
  onUpdate: (technicals: TechnicalIndicators | null) => void;
}) {
  const { t } = useTranslation();

  if (!technicals) {
    return (
      <div className="p-4 text-center">
        <LineChart className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
        <div className="text-xs text-muted-foreground">{t('stockResearch.noTechnicals')}</div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 text-xs"
          onClick={() => onUpdate({
            price: 0,
            changePercent: 0,
            volume: 0,
          })}
        >
          {t('stockResearch.addTechnicals')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* K线图 */}
      {technicals.dailyData && technicals.dailyData.length > 0 && (
        <StockPriceChart
          data={technicals.dailyData}
          support={technicals.support}
          resistance={technicals.resistance}
          height={280}
        />
      )}

      <div className="p-2 space-y-2">
        <div className="grid grid-cols-2 gap-1">
          <MetricInput
            label={t('stockResearch.price')}
            value={technicals.price}
            onChange={(v) => onUpdate({ ...technicals, price: v ?? 0 })}
          />
          <MetricInput
            label={t('stockResearch.changePercent')}
            value={technicals.changePercent}
            unit="%"
            onChange={(v) => onUpdate({ ...technicals, changePercent: v ?? 0 })}
          />
        </div>

        <div className="grid grid-cols-2 gap-1">
          <MetricInput
            label="MA5"
            value={technicals.ma5}
            onChange={(v) => onUpdate({ ...technicals, ma5: v })}
          />
          <MetricInput
            label="MA20"
            value={technicals.ma20}
            onChange={(v) => onUpdate({ ...technicals, ma20: v })}
          />
        </div>

        <div className="grid grid-cols-2 gap-1">
          <MetricInput
            label={t('stockResearch.support')}
            value={technicals.support}
            onChange={(v) => onUpdate({ ...technicals, support: v })}
          />
          <MetricInput
            label={t('stockResearch.resistance')}
            value={technicals.resistance}
            onChange={(v) => onUpdate({ ...technicals, resistance: v })}
          />
        </div>

        {technicals.macd && (
          <div className="p-1.5 rounded bg-muted/30 text-[10px]">
            <div className="font-medium mb-0.5">MACD</div>
            <div className="grid grid-cols-3 gap-1 text-muted-foreground">
              <span>DIF: {technicals.macd.dif.toFixed(3)}</span>
              <span>DEA: {technicals.macd.dea.toFixed(3)}</span>
              <span>柱: {technicals.macd.histogram.toFixed(3)}</span>
            </div>
          </div>
        )}

        {technicals.rsi !== undefined && (
          <div className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-[10px]">
            <span>RSI</span>
            <span className={cn(
              technicals.rsi > 70 ? 'text-red-500' : technicals.rsi < 30 ? 'text-green-500' : '',
            )}>{technicals.rsi.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 交易记录 Tab
// ═══════════════════════════════════════════════════════

function TradesTab({
  trades, onAdd, onDelete, currency,
}: {
  trades: TradeRecord[];
  onAdd: (trade: Omit<TradeRecord, 'id' | 'createdAt'>) => void;
  onDelete: (tradeId: string) => void;
  currency: string;
}) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [newTrade, setNewTrade] = useState({
    direction: 'buy' as const,
    price: 0,
    quantity: 0,
    executedAt: Date.now(),
  });

  const handleAdd = () => {
    if (newTrade.price > 0 && newTrade.quantity > 0) {
      onAdd({
        ...newTrade,
        amount: newTrade.price * newTrade.quantity,
        type: 'market',
      });
      setShowAdd(false);
      setNewTrade({ direction: 'buy', price: 0, quantity: 0, executedAt: Date.now() });
    }
  };

  const symbol = currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : '¥';

  return (
    <div className="p-2 space-y-1">
      <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={() => setShowAdd(!showAdd)}>
        <Plus className="h-3 w-3" />
        {t('stockResearch.addTrade')}
      </Button>

      {showAdd && (
        <div className="p-2 rounded border bg-card space-y-1.5">
          <div className="grid grid-cols-2 gap-1">
            <select
              title={t('stockResearch.direction', { defaultValue: '方向' })}
              className="text-xs px-1 py-0.5 border rounded bg-background"
              value={newTrade.direction}
              onChange={(e) => setNewTrade(p => ({ ...p, direction: e.target.value as any }))}
            >
              <option value="buy">{t('stockResearch.tradeBuy')}</option>
              <option value="sell">{t('stockResearch.tradeSell')}</option>
              <option value="dividend">{t('stockResearch.tradeDividend')}</option>
            </select>
            <input
              type="number"
              className="text-xs px-1 py-0.5 border rounded bg-background"
              placeholder={t('stockResearch.quantity')}
              value={newTrade.quantity || ''}
              onChange={(e) => setNewTrade(p => ({ ...p, quantity: Number(e.target.value) }))}
            />
          </div>
          <div className="flex gap-1">
            <input
              type="number"
              className="flex-1 text-xs px-1 py-0.5 border rounded bg-background"
              placeholder={t('stockResearch.price')}
              value={newTrade.price || ''}
              onChange={(e) => setNewTrade(p => ({ ...p, price: Number(e.target.value) }))}
              step="0.01"
            />
            <Button size="sm" className="text-xs" onClick={handleAdd}>
              <Check className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-0.5">
        {trades.map(trade => (
          <div
            key={trade.id}
            className={cn(
              'flex items-center gap-1 p-1.5 rounded text-[11px]',
              trade.direction === 'buy' ? 'bg-green-500/10' : trade.direction === 'sell' ? 'bg-red-500/10' : 'bg-blue-500/10',
            )}
          >
            <span>{trade.direction === 'buy' ? '⬆️' : trade.direction === 'sell' ? '⬇️' : '💰'}</span>
            <span className="flex-1">{trade.quantity}股 × {symbol}{trade.price}</span>
            <span className="font-medium">{symbol}{trade.amount.toFixed(2)}</span>
            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => onDelete(trade.id)}>
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>
        ))}
        {trades.length === 0 && !showAdd && (
          <div className="text-center text-[10px] text-muted-foreground py-4">
            {t('stockResearch.noTrades')}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 新闻 Tab
// ═══════════════════════════════════════════════════════

function NewsTab({
  news, onAdd, onDelete,
}: {
  news: StockNews[];
  onAdd: (n: Omit<StockNews, 'id'>) => void;
  onDelete: (newsId: string) => void;
}) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [newNews, setNewNews] = useState({
    title: '',
    summary: '',
    source: '',
    url: '',
    sentiment: 'neutral' as const,
    importance: 'medium' as const,
    publishedAt: Date.now(),
  });

  const handleAdd = () => {
    if (newNews.title.trim()) {
      onAdd({
        ...newNews,
        title: newNews.title.trim(),
        summary: newNews.summary.trim(),
        source: newNews.source.trim(),
        url: newNews.url.trim() || undefined,
        createdAt: Date.now(),
      });
      setShowAdd(false);
      setNewNews({
        title: '', summary: '', source: '', url: '',
        sentiment: 'neutral', importance: 'medium', publishedAt: Date.now(),
      });
    }
  };

  const sentimentColors: Record<string, string> = {
    positive: 'text-green-500',
    negative: 'text-red-500',
    neutral: 'text-muted-foreground',
  };

  return (
    <div className="p-2 space-y-1">
      <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={() => setShowAdd(!showAdd)}>
        <Plus className="h-3 w-3" />
        {t('stockResearch.addNews')}
      </Button>

      {showAdd && (
        <div className="p-2 rounded border bg-card space-y-1.5">
          <input
            type="text"
            className="w-full text-xs px-1.5 py-1 border rounded bg-background"
            placeholder={t('stockResearch.titlePlaceholder')}
            value={newNews.title}
            onChange={(e) => setNewNews(p => ({ ...p, title: e.target.value }))}
          />
          <textarea
            className="w-full text-xs px-1.5 py-1 border rounded bg-background resize-none"
            rows={2}
            placeholder={t('stockResearch.summaryPlaceholder')}
            value={newNews.summary}
            onChange={(e) => setNewNews(p => ({ ...p, summary: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-1">
            <input
              type="text"
              className="text-xs px-1 py-0.5 border rounded bg-background"
              placeholder={t('stockResearch.sourcePlaceholder')}
              value={newNews.source}
              onChange={(e) => setNewNews(p => ({ ...p, source: e.target.value }))}
            />
            <select
              className="text-xs px-1 py-0.5 border rounded bg-background"
              value={newNews.sentiment}
              title={t('stockResearch.sentiment', { defaultValue: '情感倾向' })}
              onChange={(e) => setNewNews(p => ({ ...p, sentiment: e.target.value as any }))}
            >
              <option value="positive">{t('stockResearch.positive')}</option>
              <option value="negative">{t('stockResearch.negative')}</option>
              <option value="neutral">{t('stockResearch.neutral')}</option>
            </select>
          </div>
          <div className="flex gap-1">
            <select
              title={t('stockResearch.importance', { defaultValue: '重要性' })}
              className="flex-1 text-xs px-1 py-0.5 border rounded bg-background"
              value={newNews.importance}
              onChange={(e) => setNewNews(p => ({ ...p, importance: e.target.value as any }))}
            >
              <option value="high">{t('stockResearch.high')}</option>
              <option value="medium">{t('stockResearch.medium')}</option>
              <option value="low">{t('stockResearch.low')}</option>
            </select>
            <Button size="sm" className="text-xs" onClick={handleAdd} disabled={!newNews.title.trim()}>
              <Check className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-0.5">
        {news.map(n => (
          <div key={n.id} className="p-1.5 rounded border bg-card group">
            <div className="flex items-start gap-1">
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(n.publishedAt).toLocaleDateString('zh-CN')}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className={cn('text-[11px] font-medium truncate', sentimentColors[n.sentiment || 'neutral'])}>
                    {n.title}
                  </span>
                </div>
                {n.summary && (
                  <div className="text-[10px] text-muted-foreground line-clamp-2">{n.summary}</div>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => onDelete(n.id)}>
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {news.length === 0 && !showAdd && (
        <div className="text-center text-[10px] text-muted-foreground py-4">
          {t('stockResearch.noNews')}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 风险 Tab
// ═══════════════════════════════════════════════════════

function RiskTab({
  risk,
  onUpdate,
}: {
  risk: RiskAssessment | null;
  onUpdate: (risk: RiskAssessment | null) => void;
}) {
  const { t } = useTranslation();

  if (!risk) {
    return (
      <div className="p-4 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
        <div className="text-xs text-muted-foreground">{t('stockResearch.noRiskAssessment')}</div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 text-xs"
          onClick={() => onUpdate({
            level: 'medium',
            factors: [],
            warningSignals: [],
            assessedAt: Date.now(),
          })}
        >
          {t('stockResearch.addRiskAssessment')}
        </Button>
      </div>
    );
  }

  const levelInfo = RISK_LEVELS.find(l => l.key === risk.level) || RISK_LEVELS[1];

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs">{levelInfo.icon}</span>
        <span className={cn('text-sm font-medium', levelInfo.color)}>{t(levelInfo.labelKey)}</span>
        {risk.score !== undefined && (
          <span className="text-xs text-muted-foreground">({risk.score}/100)</span>
        )}
      </div>

      {risk.factors.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">{t('stockResearch.riskFactors')}</div>
          <ul className="text-[11px] space-y-0.5">
            {risk.factors.slice(0, 5).map((f, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-red-400">•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {risk.warningSignals.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">{t('stockResearch.warningSignals')}</div>
          <ul className="text-[11px] space-y-0.5">
            {risk.warningSignals.slice(0, 3).map((s, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-amber-400">⚠</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 对标 Tab
// ═══════════════════════════════════════════════════════

function PeersTab({
  peers, onAdd, onDelete,
}: {
  peers: PeerComparison[];
  onAdd: (peer: Omit<PeerComparison, 'id'>) => void;
  onDelete: (peerId: string) => void;
}) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [newPeer, setNewPeer] = useState({
    code: '',
    name: '',
    advantage: '',
    disadvantage: '',
  });

  const handleAdd = () => {
    if (newPeer.code.trim() && newPeer.name.trim()) {
      onAdd({
        code: newPeer.code.trim(),
        name: newPeer.name.trim(),
        metrics: {},
        advantage: newPeer.advantage.trim() || undefined,
        disadvantage: newPeer.disadvantage.trim() || undefined,
      });
      setShowAdd(false);
      setNewPeer({ code: '', name: '', advantage: '', disadvantage: '' });
    }
  };

  return (
    <div className="p-2 space-y-1">
      <Button variant="outline" size="sm" className="w-full text-xs gap-1" onClick={() => setShowAdd(!showAdd)}>
        <Plus className="h-3 w-3" />
        {t('stockResearch.addPeer')}
      </Button>

      {showAdd && (
        <div className="p-2 rounded border bg-card space-y-1.5">
          <div className="grid grid-cols-2 gap-1">
            <input
              type="text"
              className="text-xs px-1.5 py-1 border rounded bg-background"
              placeholder={t('stockResearch.peerCodePlaceholder')}
              value={newPeer.code}
              onChange={(e) => setNewPeer(p => ({ ...p, code: e.target.value }))}
            />
            <input
              type="text"
              className="text-xs px-1.5 py-1 border rounded bg-background"
              placeholder={t('stockResearch.peerNamePlaceholder')}
              value={newPeer.name}
              onChange={(e) => setNewPeer(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <input
            type="text"
            className="w-full text-xs px-1.5 py-1 border rounded bg-background"
            placeholder={t('stockResearch.advantagePlaceholder')}
            value={newPeer.advantage}
            onChange={(e) => setNewPeer(p => ({ ...p, advantage: e.target.value }))}
          />
          <div className="flex gap-1">
            <input
              type="text"
              className="flex-1 text-xs px-1.5 py-1 border rounded bg-background"
              placeholder={t('stockResearch.disadvantagePlaceholder')}
              value={newPeer.disadvantage}
              onChange={(e) => setNewPeer(p => ({ ...p, disadvantage: e.target.value }))}
            />
            <Button size="sm" className="text-xs" onClick={handleAdd} disabled={!newPeer.code.trim() || !newPeer.name.trim()}>
              <Check className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-0.5">
        {peers.map(p => (
          <div key={p.id} className="p-1.5 rounded border bg-card group">
            <div className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">{p.code}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => onDelete(p.id)}>
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
            {(p.advantage || p.disadvantage) && (
              <div className="mt-1 pt-1 border-t space-y-0.5">
                {p.advantage && (
                  <div className="text-[10px] text-green-600">+ {p.advantage}</div>
                )}
                {p.disadvantage && (
                  <div className="text-[10px] text-red-500">- {p.disadvantage}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {peers.length === 0 && !showAdd && (
        <div className="text-center text-[10px] text-muted-foreground py-4">
          {t('stockResearch.noPeers')}
        </div>
      )}
    </div>
  );
}
